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
    User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate, normalizePlantId } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview Track Consignment Terminal.
 * Implementation of advanced mission progress animation.
 * Features: Sequential truck movement every 1.5-2 second until current status is reached.
 * Hardened: Uses refs to prevent infinite animation re-loads during registry sync.
 */

function TrackConsignmentContent() {
    const firestore = useFirestore();
    const [tripIdInput, setTripIdInput] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [generatedCaptcha, setGeneratedCaptcha] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<any>(null);
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
                        setAnimIndex(4);
                        setTimeout(() => {
                            setIsReversed(true);
                            let rev = 4;
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

    // REAL-TIME PULSE node for public tracking
    useEffect(() => {
        if (!result?.id || !firestore) return;

        const tripRef = doc(firestore, "trips", result.id);
        const unsubscribe = onSnapshot(tripRef, (snap) => {
            if (snap.exists()) {
                const updatedTrip = snap.data();
                const newStatus = (updatedTrip.tripStatus || updatedTrip.currentStatusId || 'assigned').toLowerCase();
                const targetIdx = getTargetIndex(newStatus);
                
                // MISSION FIX: Only run animation if target index has changed to prevent infinite re-loads
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
    }, [result?.id, firestore, getTargetIndex, runAnimation]);

    const handleTrack = async () => {
        if (!tripIdInput.trim()) {
            setError("Registry Trip ID Required.");
            return;
        }
        if (captchaInput.toUpperCase() !== generatedCaptcha) {
            setError("Security Code Mismatch.");
            refreshCaptcha();
            return;
        }

        if (!firestore) {
            setError("Database Node Offline. Please wait.");
            return;
        }

        setIsSearching(true);
        setError(null);
        setResult(null);
        lastTargetIndexRef.current = -1; // Reset lock for new search

        try {
            const term = tripIdInput.trim().toUpperCase();
            const tripsRef = collection(firestore, "trips");
            const q = query(tripsRef, where("tripId", "==", term), limit(1));
            const snap = await getDocs(q);

            let tripDoc = !snap.empty ? snap.docs[0] : null;

            if (!tripDoc) {
                const qLr = query(tripsRef, where("lrNumber", "==", term), limit(1));
                const snapLr = await getDocs(qLr);
                if (!snapLr.empty) tripDoc = snapLr.docs[0];
            }

            if (!tripDoc) {
                setError("Mission Node not found in registry.");
                refreshCaptcha();
            } else {
                const tripData = { id: tripDoc.id, ...tripDoc.data() } as any;
                const plantId = normalizePlantId(tripData.originPlantId);
                const shipId = Array.isArray(tripData.shipmentIds) ? tripData.shipmentIds[0] : tripData.shipmentId;
                
                let shipmentData = null;
                if (shipId) {
                    try {
                        const shipSnap = await getDoc(doc(firestore, `plants/${plantId}/shipments`, shipId));
                        if (shipSnap.exists()) shipmentData = shipSnap.data();
                    } catch (e) {
                        console.warn("Shipment context inaccessible.");
                    }
                }

                const status = (tripData.tripStatus || tripData.currentStatusId || 'assigned').toLowerCase();
                const isRejected = status === 'rejected';

                const resObj = {
                    ...tripData,
                    shipment: shipmentData,
                    isRejected: isRejected,
                    qtyUom: `${tripData.assignedQtyInTrip || 0} MT`,
                    route: `${(shipmentData?.loadingPoint || tripData.loadingPoint || 'Dispatch').split(',')[0]} → ${(shipmentData?.unloadingPoint || tripData.unloadingPoint || 'Destination').split(',')[0]}`
                };

                setResult(resObj);
                // Initial animation node handshake
                const targetIdx = getTargetIndex(status);
                lastTargetIndexRef.current = targetIdx;
                runAnimation(targetIdx, isRejected);
            }
        } catch (e: any) {
            console.error("Tracking registry error:", e);
            setError("Registry Link Failure.");
        } finally {
            setIsSearching(false);
        }
    };

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

                {!result ? (
                    <Card className="max-w-2xl mx-auto border-none shadow-3xl rounded-[3rem] overflow-hidden bg-white">
                        <div className="p-10 md:p-14 space-y-10">
                            {error && (
                                <motion.div 
                                    initial={{ x: -10, opacity: 0 }} 
                                    animate={{ x: 0, opacity: 1 }}
                                    className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] border border-red-100"
                                >
                                    <AlertCircle size={16}/> {error}
                                </motion.div>
                            )}

                            <div className="flex items-center justify-center gap-3 py-2">
                                <div className={cn("h-2 w-2 rounded-full transition-colors", dbReady ? "bg-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-slate-200")}/>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    {dbReady ? "Registry Handshake Active" : "Establishing Cloud Pulse..."}
                                </span>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <Label htmlFor="trip-id" className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Registry Trip ID Node *</Label>
                                    <Input 
                                        id="trip-id"
                                        placeholder="e.g. T1000456" 
                                        value={tripIdInput} 
                                        onChange={e => setTripIdInput(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && handleTrack()}
                                        className="h-16 rounded-2xl font-black text-blue-900 uppercase text-2xl text-center border-2 border-slate-100 shadow-inner focus-visible:ring-blue-900" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Security Code *</Label>
                                    <div className="flex gap-4">
                                        <div className="flex-1 h-16 bg-slate-900 rounded-2xl flex items-center justify-center font-black tracking-[0.6em] text-white text-2xl italic shadow-inner select-none">
                                            {generatedCaptcha}
                                        </div>
                                        <Input 
                                            value={captchaInput} 
                                            onChange={e => setCaptchaInput(e.target.value)} 
                                            className="w-40 h-16 rounded-2xl font-black text-center text-xl border-2 border-slate-200 focus-visible:ring-blue-900" 
                                        />
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={refreshCaptcha} 
                                            className="h-16 w-16 rounded-2xl hover:bg-blue-50 text-blue-900"
                                        >
                                            <RefreshCcw size={24} />
                                        </Button>
                                    </div>
                                </div>
                                <Button 
                                    onClick={handleTrack} 
                                    disabled={isSearching || !dbReady} 
                                    className="w-full h-16 rounded-2xl bg-blue-900 text-white font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-black transition-all active:scale-95 border-none"
                                >
                                    {isSearching ? <Loader2 className="animate-spin mr-3" /> : <Search className="mr-3" />} RESOLVE MISSION
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-20">
                        <button 
                            onClick={() => {setResult(null); refreshCaptcha();}} 
                            className="font-black text-slate-400 hover:text-blue-900 uppercase text-[11px] tracking-widest gap-2 flex items-center"
                        >
                            <ArrowLeft size={16}/> Back to Registry Search
                        </button>
                        
                        <Card className="border-none shadow-3xl rounded-[3.5rem] bg-slate-900 text-white p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110"><Box size={240} /></div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-8 relative z-10">
                                {[
                                    { label: 'Vehicle', value: result.vehicleNumber, bold: true, icon: Truck },
                                    { label: 'Pilot Mobile', value: result.driverMobile || '--', mono: true, color: 'text-blue-200', icon: Smartphone },
                                    { label: 'Trip ID', value: result.tripId, mono: true, color: 'text-blue-400', icon: FileText },
                                    { label: 'LR Number', value: result.lrNumber || '--', bold: true, icon: FileText },
                                    { label: 'Mission Route', value: result.route, color: 'text-emerald-400', bold: true, icon: MapPin },
                                    { label: 'Ship To', value: result.shipToParty || '--', truncate: true, icon: User },
                                    { label: 'Weight', value: result.qtyUom, color: 'text-emerald-400', bold: true, icon: Weight },
                                ].map((item, i) => (
                                    <div key={i} className="space-y-1">
                                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest leading-none flex items-center gap-1.5">
                                            {item.icon && <item.icon size={10} />} {item.label}
                                        </span>
                                        <p className={cn(
                                            "text-[11px] font-bold uppercase leading-tight", 
                                            item.bold && "font-black text-xs", 
                                            item.color || "text-white", 
                                            item.truncate && "truncate"
                                        )} title={item.value as string}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* ADVANCED TRUCK ANIMATION TERMINAL */}
                        <div className="relative p-12 md:p-20 bg-white border border-slate-100 rounded-[4rem] shadow-2xl overflow-hidden min-h-[500px] flex flex-col justify-center">
                            {/* PROGRESS LINE BACKGROUND */}
                            <div className="absolute top-1/2 left-24 right-24 h-2 bg-slate-100 -translate-y-1/2 rounded-full overflow-hidden shadow-inner">
                                <motion.div 
                                    className={cn(
                                        "h-full transition-colors duration-700", 
                                        (result.isRejected && isReversed) ? "bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                                    )}
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
                                    
                                    const activeColor = (result.isRejected && isReversed) ? "bg-red-600 border-red-400" : "bg-blue-600 border-blue-400";
                                    const label = (isFinal && result.isRejected) ? 'MISSION REJECTED' : stage.label;
                                    const timestampNode = result.lastUpdated || result.startDate || Date.now();
                                    const timestamp = timestampNode instanceof Timestamp ? timestampNode.toDate() : new Date(timestampNode);

                                    return (
                                        <div key={i} className="flex flex-col items-center gap-6 md:gap-10 relative z-10 w-48">
                                            <motion.div 
                                                animate={active ? { 
                                                    scale: isTarget ? [1, 1.2, 1.1] : 1,
                                                    boxShadow: isTarget ? "0 20px 40px rgba(0,0,0,0.15)" : "none"
                                                } : {}}
                                                className={cn(
                                                    "h-16 w-16 md:h-24 md:w-24 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center transition-all duration-700 border-4",
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
                                                        {(isFinal && result.isRejected) ? <XCircle size={32} /> : <Truck size={40} />}
                                                    </motion.div>
                                                ) : (
                                                    (isFinal && result.isRejected) ? <XCircle size={28} className="opacity-20" /> : <stage.icon size={28} className={cn(isReversed && i < animIndex && "scale-x-[-1] opacity-50")} />
                                                )}
                                            </motion.div>
                                            <div className="text-center space-y-2">
                                                <p className={cn(
                                                    "text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-colors duration-500", 
                                                    active ? ((result.isRejected && isReversed) ? "text-red-700" : "text-blue-900") : "text-slate-200"
                                                )}>{label}</p>
                                                {active && (
                                                    <div className="flex flex-col items-center gap-1 mt-1 animate-in fade-in duration-700">
                                                        <p className="text-[9px] font-black font-mono text-blue-600 leading-none tracking-tighter">
                                                            {format(timestamp, 'dd MMM yy')}
                                                        </p>
                                                        <p className="text-[9px] font-black font-mono text-slate-400 leading-none">
                                                            {format(timestamp, 'HH:mm')}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <AnimatePresence>
                                {result.isRejected && isReversed && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }} 
                                        animate={{ opacity: 1, y: 0 }} 
                                        exit={{ opacity: 0 }}
                                        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 px-10 py-5 bg-red-50 border-2 border-red-100 rounded-[2.5rem] shadow-2xl"
                                    >
                                        <div className="p-2.5 bg-red-600 rounded-full animate-pulse shadow-lg text-white">
                                            <AlertCircle size={24} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black uppercase text-red-900 tracking-[0.2em]">CRITICAL MISSION REJECTION</span>
                                            <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest mt-1">RETURNING ASSETS TO ORIGINAL LIFTING NODE REGISTRY</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
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
