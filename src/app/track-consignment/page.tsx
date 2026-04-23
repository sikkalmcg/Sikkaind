
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react';
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
    Loader2, 
    Calendar,
    CheckCircle2,
    AlertCircle,
    ArrowLeft,
    Factory,
    ClipboardList,
    Box,
    ArrowRight,
    CircleDot,
    RefreshCcw,
    X,
    XCircle,
    Wifi,
    Smartphone,
    FileText,
    Weight,
    User,
    ChevronRight,
    ListTree
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp, onSnapshot, collectionGroup } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate, normalizePlantId } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * @fileOverview Public Track Consignment Terminal v2.5.
 * Features: Dual Search (SO/Trip ID), Scenario Handling (A/B/C), and Progress Animation.
 */

function TrackConsignmentContent() {
    const firestore = useFirestore();
    const [registryInput, setRegistryInput] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [generatedCaptcha, setGeneratedCaptcha] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    // Result States
    const [shipmentResult, setShipmentResult] = useState<any>(null);
    const [linkedTrips, setLinkedTrips] = useState<any[]>([]);
    const [activeTrip, setActiveTrip] = useState<any>(null);
    
    const [error, setError] = useState<string | null>(null);
    const [animIndex, setAnimIndex] = useState(-1);
    const [isReversed, setIsReversed] = useState(false);
    const [dbReady, setDbReady] = useState(false);

    // Registry Guard Nodes
    const animationIntervalRef = useRef<any>(null);
    const lastTargetIndexRef = useRef<number>(-1);

    useEffect(() => {
        if (firestore) setDbReady(true);
        refreshCaptcha();
    }, [firestore]);

    const refreshCaptcha = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let res = '';
        for (let i = 0; i < 5; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        setGeneratedCaptcha(res);
        setCaptchaInput('');
    };

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

    // REAL-TIME TRIP Pulse node
    useEffect(() => {
        if (!activeTrip?.id || !firestore) return;

        const tripRef = doc(firestore, "trips", activeTrip.id);
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
    }, [activeTrip?.id, firestore, getTargetIndex, runAnimation]);

    const handleTrack = async () => {
        if (!registryInput.trim()) {
            setError("Registry Node ID Required.");
            return;
        }
        if (captchaInput.toUpperCase() !== generatedCaptcha) {
            setError("Security Code Mismatch.");
            refreshCaptcha();
            return;
        }

        if (!firestore) {
            setError("Database Node Offline.");
            return;
        }

        setIsSearching(true);
        setError(null);
        setShipmentResult(null);
        setLinkedTrips([]);
        setActiveTrip(null);
        lastTargetIndexRef.current = -1;

        try {
            const term = registryInput.trim().toUpperCase();
            
            // 1. Resolve as Trip ID / LR First
            const tripsRef = collection(firestore, "trips");
            let tripQuery = query(tripsRef, where("tripId", "==", term), limit(1));
            let tripSnap = await getDocs(tripQuery);
            
            if (tripSnap.empty) {
                tripQuery = query(tripsRef, where("lrNumber", "==", term), limit(1));
                tripSnap = await getDocs(tripQuery);
            }

            if (!tripSnap.empty) {
                const tripData = { id: tripSnap.docs[0].id, ...tripSnap.docs[0].data() } as any;
                const plantId = normalizePlantId(tripData.originPlantId);
                const shipId = Array.isArray(tripData.shipmentIds) ? tripData.shipmentIds[0] : tripData.shipmentId;
                
                let shipmentData = null;
                if (shipId) {
                    const sSnap = await getDoc(doc(firestore, `plants/${plantId}/shipments`, shipId));
                    if (sSnap.exists()) shipmentData = sSnap.data();
                }

                setActiveTrip({ ...tripData, shipment: shipmentData });
                setShipmentResult(shipmentData);
                
                const status = (tripData.tripStatus || tripData.currentStatusId || 'assigned').toLowerCase();
                const targetIdx = getTargetIndex(status);
                lastTargetIndexRef.current = targetIdx;
                runAnimation(targetIdx, status === 'rejected');
                setIsSearching(false);
                return;
            }

            // 2. Resolve as Sale Order (Assign Fleet Pending Node)
            const shipmentGroup = collectionGroup(firestore, "shipments");
            const shipQuery = query(shipmentGroup, where("shipmentId", "==", term), limit(1));
            const shipSnap = await getDocs(shipQuery);

            if (!shipSnap.empty) {
                const shipDoc = shipSnap.docs[0];
                const shipData = { id: shipDoc.id, ...shipDoc.data() } as any;
                setShipmentResult(shipData);

                // Check for linked trips (Scenario B or C)
                const linkedTripsQuery = query(tripsRef, where("shipmentIds", "array-contains", shipDoc.id));
                const lTripsSnap = await getDocs(linkedTripsQuery);
                
                if (!lTripsSnap.empty) {
                    const tripsList = lTripsSnap.docs.map(d => ({ 
                        id: d.id, 
                        ...d.data(),
                        startDate: parseSafeDate(d.data().startDate)
                    }));
                    setLinkedTrips(tripsList);
                    
                    if (tripsList.length === 1) {
                        // Scenario B: Single Assignment
                        const trip = tripsList[0];
                        setActiveTrip(trip);
                        const status = (trip.tripStatus || trip.currentStatusId || 'assigned').toLowerCase();
                        const targetIdx = getTargetIndex(status);
                        lastTargetIndexRef.current = targetIdx;
                        runAnimation(targetIdx, status === 'rejected');
                    }
                    // Else Scenario C will render the table
                }
                // Else Scenario A (No trips found) will render the booked message
            } else {
                setError("Mission Node not found in registry.");
                refreshCaptcha();
            }
        } catch (e: any) {
            setError("Registry Link Failure.");
        } finally {
            setIsSearching(false);
        }
    };

    const formattedOrderTime = useMemo(() => {
        if (!shipmentResult?.creationDate) return '--';
        const d = parseSafeDate(shipmentResult.creationDate);
        return d ? format(d, 'dd-MMM-yyyy HH:mm') : '--';
    }, [shipmentResult]);

    return (
        <div className="min-h-screen bg-white flex flex-col items-center py-12 px-4 md:py-20 font-body">
            <div className="max-w-7xl w-full space-y-12">
                <div className="text-center">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        className="inline-block p-5 bg-blue-900 text-white rounded-[2.5rem] shadow-3xl rotate-3 mb-8"
                    >
                        <Radar className="h-12 w-12" />
                    </motion.div>
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Track Consignment</h1>
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-[0.4em] mt-4">Authorized Mission Registry Hub</p>
                </div>

                {!shipmentResult && !activeTrip && (
                    <Card className="max-w-2xl mx-auto border-none shadow-3xl rounded-[3rem] overflow-hidden bg-white">
                        <div className="p-10 md:p-14 space-y-10">
                            {error && (
                                <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] border border-red-100">
                                    <AlertCircle size={16}/> {error}
                                </motion.div>
                            )}

                            <div className="flex items-center justify-center gap-3 py-2">
                                <div className={cn("h-2 w-2 rounded-full transition-colors", dbReady ? "bg-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-slate-200")}/>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{dbReady ? "Registry Handshake Active" : "Establishing Pulse..."}</span>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <Label htmlFor="registry-id" className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Sale Order / Trip ID Node *</Label>
                                    <Input 
                                        id="registry-id"
                                        placeholder="e.g. S0000456 / T1000789" 
                                        value={registryInput} 
                                        onChange={e => setRegistryInput(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && handleTrack()}
                                        className="h-16 rounded-2xl font-black text-blue-900 uppercase text-2xl text-center border-2 border-slate-100 shadow-inner" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Security Code *</Label>
                                    <div className="flex gap-4">
                                        <div className="flex-1 h-16 bg-slate-900 rounded-2xl flex items-center justify-center font-black tracking-[0.6em] text-white text-2xl italic shadow-inner select-none">{generatedCaptcha}</div>
                                        <Input value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} className="w-40 h-16 rounded-2xl font-black text-center text-xl border-2 border-slate-200" />
                                        <Button variant="ghost" size="icon" onClick={refreshCaptcha} className="h-16 w-16 rounded-2xl hover:bg-blue-50 text-blue-900"><RefreshCcw size={24} /></Button>
                                    </div>
                                </div>
                                <Button onClick={handleTrack} disabled={isSearching || !dbReady} className="w-full h-16 rounded-2xl bg-blue-900 text-white font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-black transition-all active:scale-95 border-none">
                                    {isSearching ? <Loader2 className="animate-spin mr-3" /> : <Search className="mr-3" />} RESOLVE MISSION
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                {(shipmentResult || activeTrip) && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-20">
                        <button onClick={() => {setShipmentResult(null); setActiveTrip(null); setLinkedTrips([]); refreshCaptcha();}} className="font-black text-slate-400 hover:text-blue-900 uppercase text-[11px] tracking-widest gap-2 flex items-center">
                            <ArrowLeft size={16}/> Back to Registry Search
                        </button>
                        
                        {/* 1. MANIFEST HEADER (Requirement A/B) */}
                        <Card className="border-none shadow-3xl rounded-[3.5rem] bg-slate-900 text-white p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110"><Box size={240} /></div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 relative z-10">
                                {[
                                    { label: 'Sale Order', value: shipmentResult?.shipmentId || activeTrip?.shipmentId, bold: true, icon: FileText, color: 'text-blue-400' },
                                    { label: 'Consignor', value: shipmentResult?.consignor || activeTrip?.consignor, icon: User },
                                    { label: 'Consignee', value: shipmentResult?.billToParty || activeTrip?.billToParty, icon: User },
                                    { label: 'Ship To Party', value: shipmentResult?.shipToParty || activeTrip?.shipToParty, icon: MapPin },
                                    { label: 'Order Quantity', value: `${shipmentResult?.quantity || activeTrip?.quantity || 0} MT`, bold: true, color: 'text-emerald-400', icon: Weight },
                                ].map((item, i) => (
                                    <div key={i} className="space-y-1">
                                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest leading-none flex items-center gap-1.5">
                                            {item.icon && <item.icon size={10} />} {item.label}
                                        </span>
                                        <p className={cn("text-[11px] font-bold uppercase leading-tight", item.bold && "font-black text-xs", item.color || "text-white")}>{item.value || '--'}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* 2. SCENARIO C: MULTIPLE TRIPS TABLE */}
                        {!activeTrip && linkedTrips.length > 1 && (
                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden animate-in zoom-in-95 duration-500">
                                <div className="p-8 bg-slate-50 border-b flex items-center gap-4">
                                    <div className="p-2 bg-blue-900 text-white rounded-lg shadow-md"><ListTree size={16}/></div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Consolidated Mission Registry</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow className="h-12 hover:bg-transparent border-b">
                                                <TableHead className="text-[10px] font-black uppercase px-8">Sale Order</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4">Trip ID Node</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4">Assigned Date & Time</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-8 text-right">Assigned Quantity</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {linkedTrips.map((trip) => (
                                                <TableRow key={trip.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b last:border-0 group cursor-pointer" onClick={() => { setActiveTrip(trip); const targetIdx = getTargetIndex(trip.currentStatusId); lastTargetIndexRef.current = targetIdx; runAnimation(targetIdx, trip.currentStatusId === 'rejected'); }}>
                                                    <TableCell className="px-8 font-black text-slate-400 text-xs">{shipmentResult?.shipmentId}</TableCell>
                                                    <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter">{trip.tripId}</TableCell>
                                                    <TableCell className="px-4 font-bold text-slate-500 uppercase text-[10px]">{trip.startDate ? format(trip.startDate, 'dd-MMM-yyyy HH:mm') : '--'}</TableCell>
                                                    <TableCell className="px-8 text-right font-black text-blue-900">{trip.assignedQtyInTrip} MT <ChevronRight className="inline-block ml-4 h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all"/></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        )}

                        {/* 3. SCENARIO A/B MESSAGING NODE */}
                        {linkedTrips.length <= 1 && (
                            <div className="max-w-4xl mx-auto text-center space-y-10 animate-in fade-in duration-700">
                                <div className="p-10 bg-blue-50 border-2 border-blue-100 rounded-[3rem] shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
                                    <p className="text-lg md:text-xl font-bold text-slate-700 leading-relaxed uppercase tracking-tight italic">
                                        {linkedTrips.length === 0 ? (
                                            <>
                                                Sale Order <span className="text-blue-900 font-black">{shipmentResult?.shipmentId}</span> is booked for dispatch on <span className="text-blue-600 font-black">{formattedOrderTime}</span>. 
                                                Vehicle will be assigned shortly. Please wait. Once assigned, the Trip ID will be shared to track your shipment.
                                            </>
                                        ) : (
                                            <>
                                                Sale Order <span className="text-blue-900 font-black">{shipmentResult?.shipmentId}</span> has been assigned to a vehicle. 
                                                You can track your shipment using Trip ID <span className="text-blue-600 font-black tracking-tighter">{activeTrip?.tripId}</span>.
                                            </>
                                        )}
                                    </p>
                                </div>

                                {/* 4. TRACKING ANIMATION (Requirement B) */}
                                {activeTrip && (
                                    <div className="relative p-12 md:p-20 bg-white border border-slate-100 rounded-[4rem] shadow-2xl overflow-hidden min-h-[450px] flex flex-col justify-center">
                                        <div className="absolute top-1/2 left-24 right-24 h-2 bg-slate-100 -translate-y-1/2 rounded-full overflow-hidden shadow-inner">
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
                                                    <div key={i} className="flex flex-col items-center gap-6 md:gap-10 relative z-10 w-48">
                                                        <motion.div 
                                                            animate={active ? { scale: isTarget ? [1, 1.2, 1.1] : 1, boxShadow: isTarget ? "0 20px 40px rgba(0,0,0,0.15)" : "none" } : {}}
                                                            className={cn("h-16 w-16 md:h-24 md:w-24 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center transition-all duration-700 border-4", active ? `${activeColor} text-white` : "bg-white border-slate-100 text-slate-200")}
                                                        >
                                                            {isTarget ? (
                                                                <motion.div animate={{ x: isReversed ? [-2, 2, -2] : [2, -2, 2], scaleX: isReversed ? -1 : 1 }} transition={{ repeat: Infinity, duration: 0.6 }}>
                                                                    {(isFinal && activeTrip.isRejected) ? <XCircle size={32} /> : <Truck size={40} />}
                                                                </motion.div>
                                                            ) : (
                                                                (isFinal && activeTrip.isRejected) ? <XCircle size={28} className="opacity-20" /> : <stage.icon size={28} className={cn(isReversed && i < animIndex && "scale-x-[-1] opacity-50")} />
                                                            )}
                                                        </motion.div>
                                                        <p className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-colors duration-500", active ? ((activeTrip.isRejected && isReversed) ? "text-red-700" : "text-blue-900") : "text-slate-200")}>{label}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
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
