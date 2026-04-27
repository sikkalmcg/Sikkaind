'use client';

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Search, 
    Truck, 
    MapPin, 
    Radar, 
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    ArrowLeft,
    Factory,
    ClipboardList,
    Box,
    RefreshCcw,
    XCircle,
    User,
    ListTree,
    FileText,
    Weight,
    Smartphone,
    UserCircle,
    AlertTriangle,
    Navigation,
    ArrowRight,
    ShieldCheck,
    Activity,
    X as XIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate, normalizePlantId } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

// Dynamic Import for GIS Node to optimize initial pulse
const TrackingMap = dynamic(() => import('@/components/dashboard/shipment-tracking/TrackingMap'), { 
    ssr: false,
    loading: () => <div className="w-full h-[500px] bg-slate-100 animate-pulse rounded-[3rem] border-4 border-white shadow-inner" />
});

/**
 * @fileOverview Public Track Consignment Terminal v3.0.
 * Hardened: Live map trigger node restricted to Transit/Arrival states.
 * Sync: Handshakes with Wheelseye satellite registry for real-time telemetry.
 * UI: High-density layout for mission manifest and route visualization.
 */

function TrackConsignmentContent() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [searchType, setSearchType] = useState<'TRIP' | 'SO'>('TRIP');
    const [registryInput, setRegistryInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    
    // Result States
    const [shipmentResult, setShipmentResult] = useState<any>(null);
    const [linkedTrips, setLinkedTrips] = useState<any[]>([]);
    const [activeTrip, setActiveTrip] = useState<any>(null);
    const [livePos, setLivePos] = useState<any>(null);
    
    const [error, setError] = useState<string | null>(null);
    const [animIndex, setAnimIndex] = useState(-1);
    const [isReversed, setIsReversed] = useState(false);
    const [dbReady, setDbReady] = useState(false);

    // Registry Guard Nodes
    const animationIntervalRef = useRef<any>(null);
    const lastTargetIndexRef = useRef<number>(-1);

    // Fetch API Registry Node
    useEffect(() => {
        const fetchApiKey = async () => {
            if (!firestore) return;
            const settingsDoc = doc(firestore, 'gps_settings', 'api_config');
            try {
                const docSnap = await getDoc(settingsDoc);
                if (docSnap.exists() && docSnap.data().apiKey) {
                    setApiKey(docSnap.data().apiKey);
                    setDbReady(true);
                }
            } catch (error) {
                console.error("Registry config error");
            }
        };
        fetchApiKey();
    }, [firestore]);

    const stages = [
        { id: 'assign', label: 'ASSIGN', icon: ClipboardList },
        { id: 'loading', label: 'LOADING', icon: Factory },
        { id: 'transit', label: 'IN-TRANSIT', icon: Truck },
        { id: 'arrived', label: 'ARRIVED', icon: MapPin },
        { id: 'final', label: 'DELIVERED', icon: CheckCircle2 }
    ];

    const getTargetIndex = useCallback((status: string) => {
        const s = status?.toLowerCase().trim().replace(/[\s/_-]+/g, '-') || '';
        if (['delivered', 'closed'].includes(s)) return 4;
        if (['arrived', 'arrival-for-delivery', 'arrive-for-deliver', 'rejected'].includes(s)) return 3;
        if (['in-transit', 'out-for-delivery', 'dispatched'].includes(s)) return 2;
        if (['yard', 'loading', 'loaded', 'loading-complete', 'yard-loading'].includes(s)) return 1;
        return 0;
    }, []);

    const getStageTimestamp = useCallback((index: number) => {
        if (!activeTrip) return null;
        switch (index) {
            case 0: return activeTrip.startDate || activeTrip.shipment?.creationDate || activeTrip.creationDate;
            case 1: return activeTrip.entryTime || activeTrip.startDate || activeTrip.shipment?.creationDate;
            case 2: return activeTrip.outDate || activeTrip.lastUpdated || activeTrip.startDate;
            case 3: return activeTrip.arrivalDate || activeTrip.lastUpdated;
            case 4: return activeTrip.actualCompletionDate || activeTrip.lastUpdated;
            default: return null;
        }
    }, [activeTrip]);

    const runAnimation = useCallback((targetIndex: number, rejected: boolean) => {
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        
        setAnimIndex(-1);
        setIsReversed(false);
        let current = -1;
        const STEP_DURATION = 1500;

        animationIntervalRef.current = setInterval(() => {
            current++;
            if (current <= targetIndex) {
                setAnimIndex(current);
            } else {
                if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
                if (rejected) {
                    setTimeout(() => {
                        setAnimIndex(4);
                        setTimeout(() => {
                            setIsReversed(true);
                            let rev = 4;
                            const revInterval = setInterval(() => {
                                rev--;
                                if (rev >= 0) setAnimIndex(rev);
                                else clearInterval(revInterval);
                            }, 1000);
                        }, 2000);
                    }, STEP_DURATION);
                }
            }
        }, STEP_DURATION);
    }, []);

    const refreshTelemetry = useCallback(async (vNo: string) => {
        if (!vNo || !apiKey) return;
        try {
            const response = await fetch('/api/track', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: apiKey,
            }); 
            const result = await response.json();
    
            if (Array.isArray(result) && result.length > 0) {
                const vehicleData = result.find((v: any) => v.vehicleNumber === vNo);
                if (vehicleData) {
                    setLivePos(vehicleData);
                }
            }
        } catch (e) {
            console.warn("Telemetry pulse delayed.");
        }
    }, [apiKey]);

    const handleSearch = useCallback(async (overriddenQuery?: string) => {
        const term = (overriddenQuery || registryInput).trim().toUpperCase();
        if (!term) return;
        if (!firestore) return;

        setIsSearching(true);
        setError(null);
        setShipmentResult(null);
        setLinkedTrips([]);
        setActiveTrip(null);
        setLivePos(null);
        lastTargetIndexRef.current = -1;

        try {
            if (searchType === 'TRIP') {
                const tripsRef = collection(firestore, "trips");
                let tripQuery = query(tripsRef, where("tripId", "==", term), limit(1));
                let tripSnap = await getDocs(tripQuery);
                
                if (!tripSnap.empty) {
                    const tripData = { id: tripSnap.docs[0].id, ...tripSnap.docs[0].data() } as any;
                    const plantId = normalizePlantId(tripData.originPlantId);
                    const shipId = Array.isArray(tripData.shipmentIds) ? tripData.shipmentIds[0] : tripData.shipmentId;
                    
                    let shipmentData = null;
                    if (shipId) {
                        const sSnap = await getDoc(doc(firestore, `plants/${plantId}/shipments`, shipId));
                        if (sSnap.exists()) shipmentData = sSnap.data();
                    }

                    const fromLoc = tripData.loadingPoint || shipmentData?.loadingPoint || '';
                    tripData.fromCity = fromLoc.split(',')[0].trim();
                    const toLoc = tripData.unloadingPoint || tripData.destination || shipmentData?.unloadingPoint || '';
                    tripData.toCity = toLoc.split(',')[0].trim();

                    setActiveTrip({ ...tripData, shipment: shipmentData });
                    
                    const status = (tripData.tripStatus || tripData.currentStatusId || 'assigned').toLowerCase();
                    const targetIdx = getTargetIndex(status);
                    lastTargetIndexRef.current = targetIdx;
                    runAnimation(targetIdx, status === 'rejected');

                    // Immediate Telemetry Handshake
                    if (tripData.vehicleNumber) {
                        refreshTelemetry(tripData.vehicleNumber);
                    }
                } else {
                    setError("Trip ID not recognized in mission registry.");
                }
            } else {
                const plantsSnap = await getDocs(collection(firestore, "logistics_plants"));
                const plantIds = plantsSnap.docs.map(d => d.id);
                
                let foundShipment: any = null;
                let shipDocId: string | null = null;

                for (const pId of plantIds) {
                    const sQ = query(collection(firestore, `plants/${pId}/shipments`), where("shipmentId", "==", term), limit(1));
                    const sSnap = await getDocs(sQ);
                    if (!sSnap.empty) {
                        foundShipment = sSnap.docs[0].data();
                        shipDocId = sSnap.docs[0].id;
                        break;
                    }
                }

                if (foundShipment && shipDocId) {
                    const fromLoc = foundShipment.loadingPoint || '';
                    foundShipment.fromCity = fromLoc.split(',')[0].trim();
                    const toLoc = foundShipment.unloadingPoint || foundShipment.destination || '';
                    foundShipment.toCity = toLoc.split(',')[0].trim();

                    setShipmentResult(foundShipment);

                    const linkedTripsQuery = query(collection(firestore, "trips"), where("shipmentIds", "array-contains", shipDocId));
                    const lTripsSnap = await getDocs(linkedTripsQuery);
                    
                    if (!lTripsSnap.empty) {
                        const tripsList = lTripsSnap.docs.map(d => ({ 
                            id: d.id, 
                            ...d.data(),
                            startDate: parseSafeDate(d.data().startDate)
                        }));
                        setLinkedTrips(tripsList);
                    }
                } else {
                    setError("Sale Order node not found in registry.");
                }
            }
        } catch (e: any) {
            console.error("Registry resolving error:", e);
            setError("Registry Handshake Failure.");
        } finally {
            setIsSearching(false);
        }
    }, [firestore, registryInput, searchType, getTargetIndex, runAnimation, refreshTelemetry]);

    const handleDirectTripClick = useCallback((tId: string) => {
        setSearchType('TRIP');
        setRegistryInput(tId);
        setTimeout(() => {
            handleSearch(tId);
        }, 10);
    }, [handleSearch]);

    // Live Telemetry Sync Loop
    useEffect(() => {
        if (searchType !== 'TRIP' || !activeTrip?.vehicleNumber) return;
        const interval = setInterval(() => {
            refreshTelemetry(activeTrip.vehicleNumber);
        }, 30000);
        return () => clearInterval(interval);
    }, [activeTrip?.vehicleNumber, searchType, refreshTelemetry]);

    // Conditional Map Trigger Node
    const showLiveMap = useMemo(() => {
        if (searchType !== 'TRIP' || !activeTrip) return false;
        const s = (activeTrip.tripStatus || activeTrip.currentStatusId || '').toLowerCase().trim().replace(/[\s/_-]+/g, '-');
        return ['in-transit', 'arrived', 'arrival-for-delivery', 'arrive-for-deliver'].includes(s);
    }, [searchType, activeTrip]);

    const displayFields = useMemo(() => {
        if (!shipmentResult && !activeTrip) return [];

        const isTripMode = searchType === 'TRIP';
        const tripNode = activeTrip || (linkedTrips.length > 0 ? linkedTrips[0] : null);
        const shipNode = shipmentResult || activeTrip?.shipment;
        
        const fromCity = shipNode?.fromCity || activeTrip?.fromCity || '--';
        const toCity = shipNode?.toCity || activeTrip?.toCity || '--';
        const route = `${fromCity} → ${toCity}`;

        const baseFields = [
            { label: 'Sale Order', value: shipNode?.shipmentId || activeTrip?.shipmentId, bold: true, icon: FileText, color: 'text-blue-400' },
            { label: 'Consignor', value: shipNode?.consignor || activeTrip?.consignor, icon: User },
            { label: 'Consignee', value: shipNode?.billToParty || activeTrip?.billToParty, icon: User },
            { label: 'Ship To Party', value: shipNode?.shipToParty || activeTrip?.shipToParty, icon: MapPin },
            { label: 'Order Quantity', value: `${shipNode?.quantity || activeTrip?.quantity || 0} MT`, bold: true, color: 'text-emerald-400', icon: Weight },
            { label: 'Route', value: route, icon: Navigation, bold: true, color: 'text-blue-300' },
        ];

        if (isTripMode) {
            return [
                ...baseFields,
                { label: 'Vehicle Number', value: tripNode?.vehicleNumber || '--', bold: true, icon: Truck, color: 'text-white' },
                { label: 'Mobile No.', value: tripNode?.driverMobile || '--', icon: Smartphone, mono: true, color: 'text-blue-200' },
            ];
        }

        return baseFields;
    }, [shipmentResult, activeTrip, linkedTrips, searchType]);

    const formattedOrderTime = useMemo(() => {
        const d = parseSafeDate(shipmentResult?.creationDate || activeTrip?.shipment?.creationDate);
        return d ? format(d, 'dd MMM yyyy') : '--';
    }, [shipmentResult?.creationDate, activeTrip?.shipment?.creationDate]);

    return (
        <div className="min-h-screen bg-white flex flex-col items-center py-6 px-4 md:py-10 font-body">
            <div className="max-w-7xl w-full space-y-8">
                <div className="text-center">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        className="inline-block p-4 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3 mb-4"
                    >
                        <Radar className="h-10 w-10" />
                    </motion.div>
                    <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Track Consignment</h1>
                </div>

                {!shipmentResult && !activeTrip && (
                    <Card className="max-w-2xl mx-auto border-none shadow-3xl rounded-[2.5rem] overflow-hidden bg-white">
                        <div className="p-8 md:p-12 space-y-8">
                            {error && (
                                <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] border border-red-100">
                                    <AlertCircle size={16}/> {error}
                                </motion.div>
                            )}

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Registry Node Type *</Label>
                                    <Select value={searchType} onValueChange={(v: any) => setSearchType(v)}>
                                        <SelectTrigger className="h-12 rounded-xl font-black text-blue-900 uppercase border-2 border-slate-100 bg-slate-50/30">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="TRIP" className="font-black py-3 uppercase text-xs">TRIP ID</SelectItem>
                                            <SelectItem value="SO" className="font-black py-3 uppercase text-xs">SALES ORDER NO</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="registry-id" className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">
                                        {searchType === 'TRIP' ? 'Enter Trip ID *' : 'Enter Sales Order No. *'}
                                    </Label>
                                    <Input 
                                        id="registry-id"
                                        placeholder={searchType === 'TRIP' ? "e.g. T1000789" : "e.g. S0000456"} 
                                        value={registryInput} 
                                        onChange={e => setRegistryInput(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        className="h-14 rounded-2xl font-black text-blue-900 uppercase text-xl text-center border-2 border-slate-100 shadow-inner" 
                                    />
                                </div>

                                <Button onClick={() => handleSearch()} disabled={isSearching || !dbReady} className="w-full h-14 rounded-2xl bg-blue-900 text-white font-black uppercase tracking-[0.3em] shadow-xl hover:bg-black transition-all active:scale-95 border-none">
                                    {isSearching ? <Loader2 className="animate-spin mr-3 h-4 w-4" /> : <Search className="mr-3 h-4 w-4" />} TRACK NOW
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                {(shipmentResult || activeTrip) && (
                    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
                        <button onClick={() => {setShipmentResult(null); setActiveTrip(null); setLinkedTrips([]); setLivePos(null);}} className="font-black text-slate-400 hover:text-blue-900 uppercase text-[10px] tracking-widest gap-2 flex items-center">
                            <ArrowLeft size={14}/> Back to Search
                        </button>
                        
                        <Card className="border-none shadow-3xl rounded-[2.5rem] bg-slate-900 text-white p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110"><Box size={240} /></div>
                            <div className={cn(
                                "grid grid-cols-2 md:grid-cols-3 gap-6 relative z-10",
                                searchType === 'TRIP' ? "lg:grid-cols-8" : "lg:grid-cols-6"
                            )}>
                                {displayFields.map((item, i) => (
                                    <div key={i} className="space-y-1">
                                        <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest leading-none flex items-center gap-1.5">
                                            {item.icon && <item.icon size={8} />} {item.label}
                                        </span>
                                        <p className={cn(
                                            "text-[9px] font-bold uppercase leading-tight", 
                                            item.bold && "font-black text-[10px]", 
                                            item.mono && "font-mono tracking-tighter",
                                            item.color || "text-white"
                                        )}>
                                            {item.value || '--'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {searchType === 'SO' && !activeTrip && (
                            <div className="max-w-4xl mx-auto text-center space-y-8 animate-in fade-in duration-700">
                                {shipmentResult?.currentStatusId?.toLowerCase() === 'cancelled' ? (
                                    <div className="p-10 bg-red-50 border-2 border-red-100 rounded-[3rem] shadow-2xl relative overflow-hidden group flex flex-col items-center">
                                        <div className="absolute top-0 left-0 w-2 h-full bg-red-600" />
                                        <div className="p-4 bg-red-100 rounded-full mb-6">
                                            <XCircle className="h-12 w-12 text-red-600 animate-in zoom-in duration-500" />
                                        </div>
                                        <p className="text-xl md:text-2xl font-black text-red-900 leading-relaxed uppercase tracking-tight italic text-center">
                                            Sale Order <span className="text-red-700">{shipmentResult?.shipmentId}</span> has been CANCELLED.
                                        </p>
                                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-3">
                                            Registry Revocation node established
                                        </p>
                                        {shipmentResult.cancelReason && (
                                            <div className="mt-8 p-6 bg-white border border-red-100 rounded-2xl shadow-inner max-w-xl w-full">
                                                <p className="text-[10px] font-black uppercase text-red-300 mb-2 tracking-widest">OFFICIAL REMARK</p>
                                                <p className="text-sm font-bold text-red-800 italic leading-relaxed">"{shipmentResult.cancelReason}"</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {linkedTrips.length > 1 && (
                                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden animate-in zoom-in-95 duration-500">
                                                <div className="p-6 bg-slate-50 border-b flex items-center gap-4">
                                                    <div className="p-2 bg-blue-900 text-white rounded-lg shadow-md"><ListTree size={14}/></div>
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Consolidated Mission Registry</h3>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50/50">
                                                            <TableRow className="h-10 hover:bg-transparent border-b">
                                                                <TableHead className="text-[9px] font-black uppercase px-6">Sale Order</TableHead>
                                                                <TableHead className="text-[9px] font-black uppercase px-4 text-slate-400">Trip ID Node</TableHead>
                                                                <TableHead className="text-[9px] font-black uppercase px-4 text-center">Assigned Date & Time</TableHead>
                                                                <TableHead className="text-[9px] font-black uppercase px-6 text-right">Assigned Quantity</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {linkedTrips.map((trip) => (
                                                                <TableRow key={trip.id} className="h-14 border-b last:border-0 group transition-all">
                                                                    <TableCell className="px-6 font-black text-slate-400 text-xs">{shipmentResult?.shipmentId}</TableCell>
                                                                    <TableCell className="px-4">
                                                                        <button 
                                                                            onClick={() => handleDirectTripClick(trip.tripId)}
                                                                            className="font-black text-blue-700 font-mono tracking-tighter uppercase hover:underline"
                                                                        >
                                                                            {trip.tripId}
                                                                        </button>
                                                                    </TableCell>
                                                                    <TableCell className="px-4 text-center font-bold text-slate-500 uppercase text-[9px]">{trip.startDate ? format(trip.startDate, 'dd-MMM-yyyy HH:mm') : '--'}</TableCell>
                                                                    <TableCell className="px-6 text-right font-black text-blue-900">{trip.assignedQtyInTrip} MT</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </Card>
                                        )}

                                        {linkedTrips.length <= 1 && (
                                            <div className="p-8 bg-blue-50 border-2 border-blue-100 rounded-[2.5rem] shadow-xl relative overflow-hidden group flex flex-col items-center">
                                                <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
                                                <p className="text-md md:text-lg font-bold text-slate-700 leading-relaxed uppercase tracking-tight italic text-center">
                                                    {linkedTrips.length === 0 ? (
                                                        <>
                                                            Sale Order <span className="text-blue-900 font-black">{shipmentResult?.shipmentId}</span> is booked for dispatch on <span className="text-blue-600 font-black">{formattedOrderTime}</span>. 
                                                            Vehicle will be assigned shortly.
                                                        </>
                                                    ) : (
                                                        <>
                                                            Sale Order <span className="text-blue-900 font-black">{shipmentResult?.shipmentId}</span> has been assigned. 
                                                            Track using Trip ID <button onClick={() => handleDirectTripClick(linkedTrips[0].tripId)} className="text-blue-700 font-black tracking-tighter hover:underline">{linkedTrips[0]?.tripId}</button>.
                                                        </>
                                                    )}
                                                </p>

                                                {shipmentResult?.delayRemark && (
                                                    <div className="mt-6 p-4 bg-amber-600 rounded-2xl text-white shadow-xl animate-in zoom-in-95 duration-500 max-w-2xl border-2 border-amber-400">
                                                        <div className="flex items-center gap-2 mb-2 border-b border-white/20 pb-2">
                                                            <AlertTriangle size={16} className="animate-pulse" />
                                                            <h4 className="font-black uppercase tracking-widest text-[10px]">Official Delay Reason Remark</h4>
                                                        </div>
                                                        <p className="text-[11px] font-black italic tracking-tight leading-relaxed">
                                                            "{shipmentResult.delayRemark}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {searchType === 'TRIP' && activeTrip && (
                            <div className="space-y-10">
                                {/* PROGRESS ANIMATION NODE */}
                                <div className="relative p-10 md:p-14 bg-white border border-slate-100 rounded-[3rem] shadow-2xl overflow-hidden min-h-[350px] flex flex-col justify-center">
                                    <div className="absolute top-1/2 left-16 right-16 h-1.5 bg-slate-100 -translate-y-1/2 rounded-full overflow-hidden shadow-inner">
                                        <motion.div 
                                            className={cn("h-full transition-colors duration-700", (activeTrip.isRejected && isReversed) ? "bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]")}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(animIndex / 4) * 100}%` }}
                                            transition={{ duration: 0.8, ease: "easeInOut" }}
                                        />
                                    </div>

                                    <div className="relative flex justify-between items-center h-full">
                                        {stages.map((stage, i) => {
                                            const active = i <= animIndex;
                                            const isTarget = i === animIndex;
                                            const isFinal = i === 4;
                                            const activeColor = (activeTrip.isRejected && isReversed) ? "bg-red-600 border-red-400" : "bg-blue-600 border-blue-400";
                                            const label = (isFinal && activeTrip.isRejected) ? 'MISSION REJECTED' : stage.label;
                                            
                                            return (
                                                <div key={i} className="flex flex-col items-center gap-4 md:gap-6 relative z-10 w-40">
                                                    <motion.div 
                                                        animate={active ? { scale: isTarget ? [1, 1.2, 1.1] : 1, boxShadow: isTarget ? "0 15px 30px rgba(0,0,0,0.15)" : "none" } : {}}
                                                        className={cn("h-12 w-12 md:h-20 md:w-20 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center transition-all duration-700 border-2 md:border-4", active ? `${activeColor} text-white` : "bg-white border-slate-100 text-slate-200")}
                                                    >
                                                        {isTarget ? (
                                                            <motion.div animate={{ x: isReversed ? [-2, 2, -2] : [2, -2, 2], scaleX: isReversed ? -1 : 1 }} transition={{ repeat: Infinity, duration: 0.6 }}>
                                                                {(isFinal && activeTrip.isRejected) ? <XCircle size={24} className="md:h-8 md:w-8" /> : <Truck size={24} className="md:h-8 md:w-8" />}
                                                            </motion.div>
                                                        ) : (
                                                            (isFinal && activeTrip.isRejected) ? <XCircle size={20} className="md:h-6 md:w-6 opacity-20" /> : <stage.icon size={20} className={cn("md:h-6 md:w-6", isReversed && i < animIndex && "scale-x-[-1] opacity-50")} />
                                                        )}
                                                    </motion.div>
                                                    <div className="text-center space-y-1">
                                                        <p className={cn("text-[7px] md:text-[9px] font-black uppercase tracking-widest transition-colors duration-500", active ? ((activeTrip.isRejected && isReversed) ? "text-red-700" : "text-blue-900") : "text-slate-200")}>{label}</p>
                                                        {active && (
                                                            <div className="flex flex-col items-center gap-0.5 mt-1 animate-in fade-in duration-1000">
                                                                <p className="text-[8px] md:text-[10px] font-black font-mono text-blue-600 leading-none tracking-tighter">
                                                                    {(() => {
                                                                        const d = parseSafeDate(getStageTimestamp(i));
                                                                        return d ? format(d, 'dd MMM yyyy') : '--';
                                                                    })()}
                                                                </p>
                                                                <p className="text-[8px] md:text-[10px] font-black font-mono text-slate-400 leading-none mt-1">
                                                                    {(() => {
                                                                        const d = parseSafeDate(getStageTimestamp(i));
                                                                        return d ? format(d, 'HH:mm') : '--:--';
                                                                    })()}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* LIVE MAP TRIGGER NODE - CONDITIONAL VISIBILITY */}
                                <AnimatePresence>
                                    {showLiveMap && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 40 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 40 }}
                                            transition={{ duration: 0.6, ease: "easeOut" }}
                                            className="pt-8"
                                        >
                                            <Card className="border-none shadow-3xl rounded-[3rem] overflow-hidden bg-white">
                                                <CardHeader className="bg-slate-900 text-white p-6 border-b border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-600 rounded-lg shadow-lg"><Navigation className="h-4 w-4 text-white" /></div>
                                                        <CardTitle className="text-sm font-black uppercase tracking-widest">Live Mission Telemetry</CardTitle>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Badge className="bg-emerald-600 font-black text-[8px] uppercase px-4 h-6 border-none shadow-md animate-pulse">GPS ACTIVE</Badge>
                                                        {livePos && (
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter font-mono">
                                                                Speed: <span className="text-emerald-400">{livePos.speed} KM/H</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-0 h-[550px] relative">
                                                    <TrackingMap 
                                                        livePos={livePos}
                                                        origin={activeTrip.consignorAddress || activeTrip.loadingPoint || activeTrip.fromCity}
                                                        destination={activeTrip.deliveryAddress || activeTrip.unloadingPoint || activeTrip.toCity}
                                                        height="100%"
                                                    />
                                                    
                                                    {/* SATELLITE INFO OVERLAY */}
                                                    <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-xl border border-slate-200 p-5 rounded-2xl shadow-3xl max-w-sm space-y-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><MapPin size={18} /></div>
                                                            <div className="space-y-1">
                                                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Current Location Registry</p>
                                                                <p className="text-xs font-bold text-slate-800 leading-snug uppercase">
                                                                    {livePos?.location || 'Resolving Satellite Pulse...'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Separator className="bg-slate-100" />
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <Activity size={12} className="text-emerald-500" />
                                                                <span className="text-[9px] font-black uppercase text-slate-400">Registry Pulse:</span>
                                                                <span className="text-[10px] font-black text-emerald-600 uppercase">Synchronized</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* MAP LEGEND */}
                                                    <div className="absolute bottom-6 right-6 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-3xl space-y-3 pointer-events-none">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                                            <span className="text-[8px] font-black text-white uppercase tracking-widest">Lifting node</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                                            <span className="text-[8px] font-black text-white uppercase tracking-widest">Drop node</span>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TrackConsignmentPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <TrackConsignmentContent />
        </Suspense>
    );
}
