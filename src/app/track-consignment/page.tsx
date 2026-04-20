
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
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
    User,
    ArrowRight,
    CircleDot,
    RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate, normalizePlantId } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview Track Consignment Terminal.
 * Implementation of advanced mission progress animation.
 * Features: Multi-stage tracking, Rejection-Return logic, and Red-Alert status nodes.
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

    useEffect(() => {
        refreshCaptcha();
    }, []);

    const refreshCaptcha = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let res = '';
        for (let i = 0; i < 5; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        setGeneratedCaptcha(res);
        setCaptchaInput('');
    };

    const stages = [
        { id: 'assigned', label: 'Assign', icon: ClipboardList },
        { id: 'loading', label: 'Loading', icon: Factory },
        { id: 'transit', label: 'In-Transit', icon: Truck },
        { id: 'arrived', label: 'Arrived', icon: MapPin },
        { id: 'delivered', label: 'Delivered', icon: CheckCircle2 }
    ];

    const getTargetIndex = (status: string) => {
        const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
        if (['delivered', 'closed'].includes(s)) return 4;
        if (['arrived', 'arrival-for-delivery', 'arrive-for-deliver'].includes(s)) return 3;
        if (['in-transit', 'out-for-delivery'].includes(s)) return 2;
        if (['yard', 'loading', 'loaded', 'loading-complete'].includes(s)) return 1;
        return 0;
    };

    const runAnimation = useCallback((targetIndex: number, rejected: boolean) => {
        setAnimIndex(-1);
        setIsReversed(false);
        let current = -1;
        
        // Registry Pulse: 2.5 seconds per stop as requested
        const STEP_DURATION = 2500;

        const interval = setInterval(() => {
            current++;
            if (current <= targetIndex) {
                setAnimIndex(current);
            } else {
                clearInterval(interval);
                if (rejected) {
                    setTimeout(() => {
                        setIsReversed(true);
                        let rev = targetIndex;
                        const revInterval = setInterval(() => {
                            rev--;
                            if (rev >= 0) setAnimIndex(rev);
                            else {
                                clearInterval(revInterval);
                            }
                        }, STEP_DURATION);
                    }, 1000);
                }
            }
        }, STEP_DURATION);
    }, []);

    const handleTrack = async () => {
        if (!tripIdInput.trim()) return setError("Registry Trip ID Required.");
        if (captchaInput.toUpperCase() !== generatedCaptcha) {
            setError("Security Code Mismatch.");
            refreshCaptcha();
            return;
        }

        setIsSearching(true);
        setError(null);
        setResult(null);

        try {
            const tripsRef = collection(firestore!, "trips");
            const q = query(tripsRef, where("tripId", "==", tripIdInput.trim().toUpperCase()), limit(1));
            const snap = await getDocs(q);

            if (snap.empty) {
                setError("Mission Node not found in registry.");
                refreshCaptcha();
            } else {
                const tripData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
                const plantId = normalizePlantId(tripData.originPlantId);
                const shipId = tripData.shipmentIds?.[0];
                
                let shipmentData = null;
                if (shipId) {
                    const shipSnap = await getDoc(doc(firestore!, `plants/${plantId}/shipments`, shipId));
                    if (shipSnap.exists()) shipmentData = shipSnap.data();
                }

                const status = (tripData.tripStatus || tripData.currentStatusId || 'assigned').toLowerCase();
                const isRejected = status === 'rejected';

                const resObj = {
                    ...tripData,
                    shipment: shipmentData,
                    isRejected: isRejected,
                    qtyUom: `${tripData.assignedQtyInTrip || 0} MT`,
                    route: `${(shipmentData?.loadingPoint || tripData.loadingPoint || 'Node').split(',')[0]} → ${(shipmentData?.unloadingPoint || tripData.unloadingPoint || 'Node').split(',')[0]}`
                };

                setResult(resObj);
                runAnimation(getTargetIndex(status), isRejected);
            }
        } catch (e) {
            setError("Registry Link Failure.");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-12 px-4 md:py-20">
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
                        <div className="p-12 space-y-10">
                            {error && (
                                <motion.div 
                                    initial={{ x: -10, opacity: 0 }} 
                                    animate={{ x: 0, opacity: 1 }}
                                    className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] border border-red-100"
                                >
                                    <AlertCircle size={16}/> {error}
                                </motion.div>
                            )}
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Registry Trip ID Node *</Label>
                                    <Input 
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
                                        <div className="flex-1 h-16 bg-slate-900 rounded-2xl flex items-center justify-center font-black tracking-[0.6em] text-white text-2xl italic shadow-inner">
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
                                    disabled={isSearching} 
                                    className="w-full h-16 rounded-2xl bg-blue-900 text-white font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-black transition-all active:scale-95 border-none"
                                >
                                    {isSearching ? <Loader2 className="animate-spin mr-3" /> : <Search className="mr-3" />} RESOLVE MISSION
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 pb-20">
                        <Button 
                            variant="ghost" 
                            onClick={() => {setResult(null); refreshCaptcha();}} 
                            className="font-black text-slate-400 hover:text-blue-900 uppercase text-[11px] tracking-widest gap-2"
                        >
                            <ArrowLeft size={16}/> Back to Registry Search
                        </Button>
                        
                        <Card className="border-none shadow-3xl rounded-[3.5rem] bg-slate-900 text-white p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110"><Box size={240} /></div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 relative z-10">
                                {[
                                    { label: 'Consignor', value: result.consignor },
                                    { label: 'Consignee', value: result.billToParty },
                                    { label: 'Ship To', value: result.shipToParty },
                                    { label: 'Route Registry', value: result.route, color: 'text-blue-400' },
                                    { label: 'Vehicle No', value: result.vehicleNumber, bold: true },
                                    { label: 'Material', value: result.material, truncate: true },
                                    { label: 'Qty Node', value: result.qtyUom, color: 'text-emerald-400', bold: true },
                                    { label: 'LR Number', value: result.lrNumber || '--', bold: true },
                                ].map((item, i) => (
                                    <div key={i} className="space-y-1">
                                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest leading-none">{item.label}</span>
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

                        {/* ADVANCED ANIMATION NODE */}
                        <div className="relative p-12 md:p-20 bg-white rounded-[4rem] shadow-3xl border-2 border-slate-50 overflow-hidden min-h-[400px] flex flex-col justify-center">
                            <div className="absolute top-1/2 left-24 right-24 h-3 bg-slate-100 -translate-y-1/2 rounded-full overflow-hidden shadow-inner">
                                <motion.div 
                                    className={cn("h-full transition-colors duration-1000", result.isRejected ? "bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-blue-900 shadow-[0_0_15px_rgba(30,58,138,0.5)]")}
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
                                    
                                    // Visual Handshake: Red node for Rejection
                                    const nodeColor = (result.isRejected && active) ? "bg-red-600 border-red-400" : "bg-blue-900 border-blue-400";
                                    const label = (isFinal && result.isRejected) ? 'Mission Rejected' : stage.label;

                                    return (
                                        <div key={i} className="flex flex-col items-center gap-8 relative z-10 w-48">
                                            <motion.div 
                                                animate={active ? { 
                                                    scale: isTarget ? [1, 1.2, 1.1] : 1,
                                                    boxShadow: isTarget ? "0 20px 40px rgba(0,0,0,0.15)" : "none"
                                                } : {}}
                                                className={cn(
                                                    "h-20 w-20 md:h-24 md:w-24 rounded-[2rem] flex items-center justify-center transition-all duration-700 border-4",
                                                    active ? `${nodeColor} text-white` : "bg-white border-slate-100 text-slate-200"
                                                )}
                                            >
                                                {isTarget ? (
                                                    <motion.div 
                                                        animate={{ 
                                                            x: isReversed ? [-3, 3, -3] : [3, -3, 3],
                                                            scaleX: isReversed ? -1 : 1 
                                                        }} 
                                                        transition={{ repeat: Infinity, duration: 0.6 }}
                                                    >
                                                        <stage.icon size={36} />
                                                    </motion.div>
                                                ) : (
                                                    <stage.icon size={36} className={cn(isReversed && i < animIndex && "scale-x-[-1] opacity-50")} />
                                                )}
                                            </motion.div>
                                            <div className="text-center space-y-2">
                                                <p className={cn(
                                                    "text-xs font-black uppercase tracking-widest transition-colors duration-500", 
                                                    active ? (result.isRejected ? "text-red-700" : "text-slate-900") : "text-slate-300"
                                                )}>{label}</p>
                                                {active && (
                                                    <Badge variant="outline" className={cn(
                                                        "text-[9px] font-black font-mono border-none h-5",
                                                        result.isRejected ? "text-red-400" : "text-blue-500"
                                                    )}>
                                                        {format(new Date(result.lastUpdated?.toDate ? result.lastUpdated.toDate() : (result.lastUpdated || Date.now())), 'HH:mm')}
                                                    </Badge>
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
                                        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 px-10 py-4 bg-red-50 border-2 border-red-100 rounded-[2rem] shadow-2xl"
                                    >
                                        <div className="p-2 bg-red-600 rounded-full animate-pulse shadow-lg"><AlertCircle className="text-white h-5 w-5" /></div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black uppercase text-red-900 tracking-widest">CRITICAL MISSION REJECTION</span>
                                            <span className="text-[10px] font-bold text-red-600 uppercase">Returning assets to original lifting node registry</span>
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
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <TrackConsignmentContent />
        </Suspense>
    );
}
