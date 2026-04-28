
'use client';

import { useState, useMemo, useEffect, useCallback, Suspense, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Search, 
    Truck, 
    MapPin, 
    ShieldCheck, 
    Radar, 
    Factory, 
    Loader2, 
    ClipboardList,
    CheckCircle2,
    Box,
    FileText,
    Weight,
    XCircle,
    Navigation,
    Activity,
    AlertCircle,
    Smartphone,
    User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate, normalizePlantId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useSearchParams } from 'next/navigation';

const TrackingMap = dynamic(() => import('@/components/dashboard/shipment-tracking/TrackingMap'), { 
    ssr: false,
    loading: () => <div className="w-full h-[500px] bg-slate-100 animate-pulse rounded-[3rem] border-4 border-white shadow-inner" />
});

/**
 * @fileOverview Consignment Terminal - Tracking Hub.
 * Hardened: Robust stage timestamp resolution with progression fallbacks.
 * Optimized: Uses ref lock to prevent infinite re-loads of truck animation.
 * Fixed: Telemetry sync node ordering resolved. Fallback timestamp node for specific plants.
 * Layout: Renamed stages to match public standard (VEHICLE ASSIGN).
 */
function TrackConsignmentContent() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const urlSearch = searchParams.get('search');

    const [apiKey, setApiKey] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(urlSearch || '');
    const [isSearching, setIsSearching] = useState(false);
    const [consignment, setConsignment] = useState<any>(null);
    const [livePos, setLivePos] = useState<any>(null);
    const [isGpsEnabled, setIsGpsEnabled] = useState(false);
    const [animIndex, setAnimIndex] = useState(-1);
    const [isReversed, setIsReversed] = useState(false);

    // Registry Guard Nodes
    const animationIntervalRef = useRef<any>(null);
    const lastTargetIndexRef = useRef<number>(-1);

    useEffect(() => {
        const fetchApiKey = async () => {
            if (!firestore) return;
            const settingsDoc = doc(firestore, 'gps_settings', 'api_config');
            try {
                const docSnap = await getDoc(settingsDoc);
                if (docSnap.exists() && docSnap.data().apiKey) {
                    setApiKey(docSnap.data().apiKey);
                }
            } catch (error) {
                console.error(error);
            }
        };
        fetchApiKey();
    }, [firestore]);

    const stages = [
        { id: 'allocated', label: 'ORDER ALLOCATED', icon: FileText },
        { id: 'assign', label: 'VEHICLE ASSIGN', icon: ClipboardList },
        { id: 'loading', label: 'LOADING', icon: Factory },
        { id: 'transit', label: 'IN-TRANSIT', icon: Truck },
        { id: 'arrived', label: 'ARRIVED', icon: MapPin },
        { id: 'delivered', label: 'DELIVERED', icon: CheckCircle2 }
    ];

    const getTargetIndex = useCallback((status: string) => {
        const s = status?.toLowerCase().trim().replace(/[\s/_-]+/g, '-') || '';
        if (['delivered', 'closed'].includes(s)) return 5;
        if (['arrived', 'arrival-for-delivery', 'arrive-for-deliver', 'rejected'].includes(s)) return 4;
        if (['in-transit', 'out-for-delivery', 'dispatched'].includes(s)) return 3;
        if (['yard', 'loading', 'loaded', 'loading-complete', 'yard-loading'].includes(s)) return 2;
        if (['assigned', 'vehicle-assigned'].includes(s)) return 1;
        return 0; // ORDER ALLOCATED
    }, []);

    /**
     * MISSION REGISTRY PROGRESSION LOGIC
     * Fallback strategy ensures the timeline is never empty if the mission has moved to later stages.
     */
    const getStageTimestamp = useCallback((index: number) => {
        if (!consignment) return null;
        
        const t = {
            allocated: parseSafeDate(consignment.shipment?.creationDate || consignment.creationDate),
            assigned: parseSafeDate(consignment.startDate),
            loading: parseSafeDate(consignment.entryTime),
            transit: parseSafeDate(consignment.outDate),
            arrived: parseSafeDate(consignment.arrivalDate),
            delivered: parseSafeDate(consignment.actualCompletionDate)
        };

        switch (index) {
            case 0: return t.allocated;
            case 1: return t.assigned; // STRICT: Only show assignment time
            case 2: return t.loading || t.assigned || t.allocated;
            case 3: return t.transit || t.loading || t.assigned;
            case 4: return t.arrived || t.transit;
            case 5: return t.delivered || t.arrived;
            default: return null;
        }
    }, [consignment]);

    const runAnimation = useCallback((targetIndex: number, rejected: boolean) => {
        // Clear existing pulse to prevent collision
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
                        setAnimIndex(5);
                        setTimeout(() => {
                            setIsReversed(true);
                            let rev = 5;
                            const revInterval = setInterval(() => {
                                rev--;
                                if (rev >= 0) {
                                    setAnimIndex(rev);
                                } else {
                                    clearInterval(revInterval);
                                }
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
                const vehicleData = result.find(v => v.vehicleNumber === vNo);
                if (vehicleData) {
                    setLivePos(vehicleData);
                    setIsGpsEnabled(true);
                }
            }
        } catch (e) {
            console.warn("Telemetry pulse delayed.");
        }
    }, [apiKey]);

    // REAL-TIME REGISTRY LISTENER node
    useEffect(() => {
        if (!consignment?.id || !firestore) return;

        const tripRef = doc(firestore, "trips", consignment.id);
        const unsubscribe = onSnapshot(tripRef, (snap) => {
            if (snap.exists()) {
                const updatedTrip = snap.data();
                const newStatus = (updatedTrip.tripStatus || updatedTrip.currentStatusId || 'assigned').toLowerCase();
                const targetIdx = getTargetIndex(newStatus);
                
                if (targetIdx !== lastTargetIndexRef.current) {
                    lastTargetIndexRef.current = targetIdx;
                    runAnimation(targetIdx, newStatus === 'rejected');
                }
            }
        });

        return () => {
            unsubscribe();
            if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        };
    }, [consignment?.id, firestore, getTargetIndex, runAnimation]);

    useEffect(() => {
        if (!consignment?.vehicleNumber) return;
        const interval = setInterval(() => {
            refreshTelemetry(consignment.vehicleNumber);
        }, 30000);
        return () => clearInterval(interval);
    }, [consignment?.vehicleNumber, refreshTelemetry]);

    const handleSearch = useCallback(async (overriddenQuery?: string) => {
        const term = (overriddenQuery || searchQuery).trim().toUpperCase();
        if (!term) return;
        if (!firestore || !apiKey) return;

        setIsSearching(true);
        setConsignment(null);
        setLivePos(null);
        setIsGpsEnabled(false);
        setAnimIndex(-1);
        lastTargetIndexRef.current = -1; // Reset lock for new search

        try {
            const tripsRef = collection(firestore, "trips");
            let q = query(tripsRef, where("tripId", "==", term), limit(1));
            let snap = await getDocs(q);
            
            if (snap.empty) {
                q = query(tripsRef, where("lrNumber", "==", term), limit(1));
                snap = await getDocs(q);
            }

            if (snap.empty) {
                toast({ variant: 'destructive', title: "Registry Conflict", description: "Consignment ID not recognized." });
                setIsSearching(false);
                return;
            }

            const trip = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
            const plantSnap = await getDoc(doc(firestore, "logistics_plants", trip.originPlantId));
            trip.plantName = plantSnap.exists() ? plantSnap.data().name : trip.originPlantId;
            
            trip.toCity = trip.unloadingPoint?.split(',')[0].trim() || 'N/A';
            const fromLoc = trip.loadingPoint || trip.plantName || '';
            trip.fromCity = fromLoc.split(',')[0].trim();

            const response = await fetch('/api/track', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: apiKey,
            }); 
            const result = await response.json();
            
            if (Array.isArray(result) && result.length > 0) {
                const vehicleData = result.find(v => v.vehicleNumber === trip.vehicleNumber);
                if (vehicleData) {
                    setLivePos(vehicleData);
                    setIsGpsEnabled(true);
                }
            }
            
            const status = (trip.tripStatus || trip.currentStatusId || 'assigned').toLowerCase();
            const isRejected = status === 'rejected';

            // Resolve shipment context for fallback dates
            const plantId = normalizePlantId(trip.originPlantId);
            const shipId = Array.isArray(trip.shipmentIds) ? trip.shipmentIds[0] : trip.shipmentId;
            let shipmentData = null;
            if (shipId) {
                const sSnap = await getDoc(doc(firestore, `plants/${plantId}/shipments`, shipId));
                if (sSnap.exists()) shipmentData = sSnap.data();
            }

            setConsignment({ 
                ...trip, 
                shipment: shipmentData,
                assignedAt: parseSafeDate(trip.startDate) || new Date(),
                isRejected
            });

            const targetIdx = getTargetIndex(status);
            lastTargetIndexRef.current = targetIdx;
            runAnimation(targetIdx, isRejected);

        } catch (e) {
            toast({ variant: 'destructive', title: "Sync Error", description: "Registry handshake failed." });
        } finally {
            setIsSearching(false);
        }
    }, [firestore, searchQuery, toast, apiKey, runAnimation, getTargetIndex]);

    useEffect(() => {
        if (urlSearch && firestore && apiKey) {
            handleSearch(urlSearch);
        }
    }, [urlSearch, firestore, apiKey, handleSearch]);

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
            <div className="p-8 space-y-10 max-w-7xl mx-auto w-full">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b pb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                            <Radar className="h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">Consignment Terminal</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Mission Registry & Live Tracking</p>
                        </div>
                    </div>

                    <div className="flex items-end gap-4 bg-white p-6 rounded-3xl border shadow-lg border-slate-100">
                        <div className="grid gap-2 min-w-[300px]">
                            <Label htmlFor="registry-id" className="text-[10px] font-black uppercase text-slate-400 px-1">Registry ID (SO / Trip / LR)</Label>
                            <Input 
                                id="registry-id"
                                placeholder="Resolve Registry..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                className="h-12 rounded-xl font-black text-blue-900 uppercase shadow-inner" 
                            />
                        </div>
                        <Button 
                            disabled={isSearching || !apiKey}
                            onClick={() => handleSearch()}
                            className="bg-blue-900 hover:bg-slate-900 text-white h-12 px-12 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all active:scale-95 border-none"
                        >
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="mr-2 h-4 w-4" />}
                            Resolve
                        </Button>
                    </div>
                </div>

                {consignment && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                            {[
                                { label: 'Vehicle', value: consignment.vehicleNumber, bold: true, icon: Truck },
                                { label: 'Pilot Mobile', value: consignment.driverMobile || '--', mono: true, color: 'text-blue-200', icon: Smartphone },
                                { label: 'Trip ID', value: consignment.tripId, mono: true, color: 'text-blue-400', icon: FileText },
                                { label: 'LR Number', value: consignment.lrNumber || '--', bold: true, icon: FileText },
                                { label: 'Mission Route', value: `${consignment.fromCity} → ${consignment.toCity}`, color: 'text-emerald-400', bold: true, icon: MapPin },
                                { label: 'Ship To', value: consignment.shipToParty || '--', truncate: true, icon: User },
                                { label: 'Weight', value: `${consignment.assignedQtyInTrip || consignment.quantity} MT`, color: 'text-emerald-400', bold: true, icon: Weight },
                            ].map((item, i) => (
                                <div key={i} className="space-y-1 relative z-10">
                                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                                        {item.icon && <item.icon className="h-2.5 w-2.5" />} {item.label}
                                    </p>
                                    <p className={cn("text-xs font-bold uppercase", item.bold && "font-black text-[13px]", item.mono && "font-mono", item.color || "text-white", item.truncate && "truncate")} title={item.value as string}>{item.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* ADVANCED PROGRESS ANIMATION NODE */}
                        <div className="relative p-12 md:p-20 bg-white border border-slate-100 rounded-[4rem] shadow-3xl overflow-hidden min-h-[450px] flex flex-col justify-center">
                            {/* PROGRESS LINE BACKGROUND */}
                            <div className="absolute top-1/2 left-24 right-24 h-2 bg-slate-100 -translate-y-1/2 rounded-full overflow-hidden shadow-inner">
                                <motion.div 
                                    className={cn(
                                        "h-full transition-colors duration-700", 
                                        (consignment.isRejected && isReversed) ? "bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                                    )}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(animIndex / 5) * 100}%` }}
                                    transition={{ duration: 0.8, ease: "easeInOut" }}
                                />
                            </div>

                            <div className="relative flex justify-between items-center h-full">
                                {stages.map((stage, i) => {
                                    const active = i <= animIndex;
                                    const isTarget = i === animIndex;
                                    const isFinal = i === 5;
                                    
                                    const activeColor = (consignment.isRejected && isReversed) ? "bg-red-600 border-red-400" : "bg-blue-600 border-blue-400";
                                    const label = (isFinal && consignment.isRejected) ? 'MISSION REJECTED' : stage.label;
                                    
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-8 relative z-10 w-48">
                                            <motion.div 
                                                animate={active ? { 
                                                    scale: isTarget ? [1, 1.2, 1.1] : 1,
                                                    boxShadow: isTarget ? "0 20px 40px rgba(0,0,0,0.15)" : "none"
                                                } : {}}
                                                className={cn(
                                                    "h-20 w-20 md:h-24 md:w-24 rounded-[2.5rem] flex items-center justify-center transition-all duration-700 border-4",
                                                    active ? `${activeColor} text-white` : "bg-white border-slate-100 text-slate-200"
                                                )}
                                            >
                                                {isTarget ? (
                                                    <motion.div 
                                                        animate={{ 
                                                            x: isReversed ? [-2, 2, -2] : [2, -2, 2],
                                                            scaleX: isReversed ? -1 : 1 
                                                        }} 
                                                        transition={{ repeat: Infinity, duration: 0.6 }}
                                                    >
                                                        {(isFinal && consignment.isRejected) ? <XCircle size={40} /> : <Truck size={40} />}
                                                    </motion.div>
                                                ) : (
                                                    (isFinal && consignment.isRejected) ? <XCircle size={36} className="opacity-20" /> : <stage.icon size={36} className={cn(isReversed && i < animIndex && "scale-x-[-1] opacity-50")} />
                                                )}
                                            </motion.div>
                                            <div className="text-center space-y-2">
                                                <p className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest transition-colors duration-500", 
                                                    active ? ((consignment.isRejected && isReversed) ? "text-red-700" : "text-slate-900") : "text-slate-200"
                                                )}>{label}</p>
                                                {active && (
                                                    <div className="flex flex-col items-center gap-1.5 mt-2 animate-in fade-in duration-700">
                                                        <p className="text-[10px] font-black font-mono text-blue-600 leading-none tracking-tighter">
                                                            {(() => {
                                                                const d = parseSafeDate(getStageTimestamp(i));
                                                                return d ? format(d, 'dd MMM yyyy') : '--';
                                                            })()}
                                                        </p>
                                                        <p className="text-[10px] font-black font-mono text-slate-400 leading-none">
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

                            <AnimatePresence>
                                {consignment.isRejected && isReversed && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }} 
                                        animate={{ opacity: 1, y: 0 }} 
                                        exit={{ opacity: 0 }}
                                        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-5 px-10 py-5 bg-red-50 border-2 border-red-100 rounded-[2.5rem] shadow-2xl"
                                    >
                                        <div className="p-2 bg-red-600 rounded-full animate-pulse shadow-lg text-white">
                                            <AlertCircle size={24} />
                                        </div>
                                        <div className="flex col flex-col">
                                            <span className="text-xs font-black uppercase text-red-900 tracking-[0.2em]">CRITICAL MISSION REJECTION</span>
                                            <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest mt-1">RETURNING ASSETS TO ORIGINAL LIFTING NODE REGISTRY</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* LIVE MAP NODE */}
                        <div className="pt-8">
                            <Card className="border-none shadow-3xl rounded-[3rem] overflow-hidden bg-white">
                                <CardHeader className="bg-slate-900 text-white p-6 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-600 rounded-lg shadow-lg"><Navigation className="h-4 w-4 text-white" /></div>
                                        <CardTitle className="text-sm font-black uppercase tracking-widest">Live Satellite Telemetry Registry</CardTitle>
                                    </div>
                                    {isGpsEnabled ? (
                                        <Badge className="bg-emerald-600 font-black text-[8px] uppercase px-4 h-6 border-none shadow-md animate-pulse">GPS ACTIVE</Badge>
                                    ) : (
                                        <Badge variant="outline" className="border-slate-50 text-slate-500 font-black text-[8px] uppercase px-4 h-6">AWAITING HANDSHAKE</Badge>
                                    )}
                                </CardHeader>
                                <CardContent className="p-0 h-[550px] relative">
                                    <TrackingMap 
                                        livePos={livePos}
                                        origin={consignment.loadingPoint || consignment.fromCity}
                                        destination={consignment.unloadingPoint || consignment.toCity}
                                        height="100%"
                                    />
                                    {/* MAP OVERLAY LEGEND */}
                                    <div className="absolute bottom-6 right-6 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-3xl space-y-3 z-10 pointer-events-none">
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
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function TrackConsignmentPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <TrackConsignmentContent />
        </Suspense>
    );
}
