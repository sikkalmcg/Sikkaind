'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Search, 
    Truck, 
    MapPin, 
    FileText, 
    ShieldCheck, 
    Radar, 
    Loader2,
    Calendar,
    Clock,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    ArrowLeft,
    Package,
    Factory,
    RefreshCcw,
    TrendingUp,
    Timer,
    UserCircle,
    Calculator,
    ClipboardList
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp } from 'firebase/firestore';
import { format, addHours, isValid } from 'date-fns';
import { cn, normalizePlantId } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useJsApiLoader } from '@react-google-maps/api';

/**
 * @fileOverview Public Consignment Tracking Terminal.
 * Anonymous access node for customers to track mission progress using Trip ID.
 * Visualization: Assigned -> Loading -> In Transit -> Arrived -> Delivered
 */

const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";

function TrackConsignmentContent() {
    const firestore = useFirestore();
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: MAPS_JS_KEY,
        libraries: ['places']
    });
    
    const [tripIdInput, setTripIdInput] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [generatedCaptcha, setGeneratedCaptcha] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

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

    const calculateExpectedDelivery = useCallback((assignDate: Date, distance: number) => {
        let hoursToAdd = 48; 
        if (distance > 0) {
            if (distance < 100) hoursToAdd = 24;
            else if (distance <= 200) hoursToAdd = 48;
            else if (distance <= 300) hoursToAdd = 72;
            else hoursToAdd = 96;
        }
        return addHours(assignDate, hoursToAdd);
    }, []);

    useEffect(() => {
        if (!isLoaded || !result || result.distanceValue > 0 || !result.loadingPoint || !result.unloadingPoint) return;

        try {
            const directionsService = new google.maps.DirectionsService();
            directionsService.route({
                origin: result.loadingPoint,
                destination: result.unloadingPoint,
                travelMode: google.maps.TravelMode.DRIVING,
            }, (response, status) => {
                if (status === 'OK' && response) {
                    const distKm = (response.routes[0].legs[0].distance?.value || 0) / 1000;
                    setResult((prev: any) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            distanceValue: Number(distKm.toFixed(2)),
                            expectedDelivery: calculateExpectedDelivery(prev.assignDate, distKm)
                        };
                    });
                }
            });
        } catch (e) {
            console.error("GIS Handshake Error:", e);
        }
    }, [isLoaded, result?.id, result?.loadingPoint, result?.unloadingPoint, calculateExpectedDelivery]);

    const handleTrack = async () => {
        if (!tripIdInput.trim()) {
            setError("Please enter a valid Trip ID.");
            return;
        }

        if (captchaInput.toUpperCase() !== generatedCaptcha) {
            setError("Invalid Capture Code. Please try again.");
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
                setError("Invalid Trip ID. Please check and try again.");
                refreshCaptcha();
            } else {
                const tripData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
                
                const shipId = tripData.shipmentIds?.[0];
                let shipmentData = null;
                if (shipId) {
                    const shipRef = doc(firestore!, `plants/${tripData.originPlantId}/shipments`, shipId);
                    const shipSnap = await getDoc(shipRef);
                    if (shipSnap.exists()) {
                        shipmentData = shipSnap.data();
                    }
                }

                const assignDate = tripData.startDate instanceof Timestamp ? tripData.startDate.toDate() : new Date(tripData.startDate);
                const distance = Number(tripData.distance || 0); 
                const expectedDelivery = calculateExpectedDelivery(assignDate, distance);

                setResult({
                    ...tripData,
                    shipment: shipmentData,
                    assignDate,
                    expectedDelivery,
                    distanceValue: distance,
                    loadingPoint: shipmentData?.loadingPoint || tripData.loadingPoint,
                    unloadingPoint: shipmentData?.unloadingPoint || tripData.unloadingPoint || tripData.destination
                });
            }
        } catch (e) {
            setError("Mission Control: Connection Interrupted. Try again.");
        } finally {
            setIsSearching(false);
        }
    };

    const getActiveStage = (status: string) => {
        const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
        if (['delivered', 'closed', 'trip-closed'].includes(s)) return 4;
        if (['arrived', 'arrival-for-delivery', 'arrive-for-deliver'].includes(s)) return 3;
        if (['in-transit'].includes(s)) return 2;
        if (['loaded', 'loading-complete'].includes(s)) return 1;
        return 0; // Assigned / Vehicle Assigned
    };

    const progressStages = [
        { label: 'Assigned', desc: 'Mission Planned', icon: ClipboardList, key: 'startDate' },
        { label: 'Loading', desc: 'Task Complete', icon: Factory, key: 'loadingDate' }, // Proxy: Uses lastUpdated if Loaded
        { label: 'In Transit', desc: 'Cargo Movement', icon: Truck, key: 'outDate' },
        { label: 'Arrived', desc: 'At Destination', icon: MapPin, key: 'arrivalDate' },
        { label: 'Delivered', desc: 'Mission Finished', icon: CheckCircle2, key: 'actualCompletionDate' }
    ];

    const getStageTimestamp = (idx: number, key: string) => {
        if (!result) return null;
        
        // Logical Fallbacks for Timestamps
        if (idx === 0) return result.startDate;
        if (idx === 1 && (result.tripStatus?.includes('Load') || getActiveStage(result.tripStatus) >= 1)) {
            return result.lastUpdated; // Supervisor Task Completion Node
        }
        if (idx === 2) return result.outDate;
        if (idx === 3) return result.arrivalDate;
        if (idx === 4) return result.actualCompletionDate;
        
        return null;
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-16 px-4 font-body">
            <div className="max-w-6xl w-full space-y-12">
                <div className="text-center space-y-4">
                    <div className="flex justify-center mb-6">
                        <div className="p-5 bg-blue-900 text-white rounded-[2.5rem] shadow-3xl rotate-3">
                            <Radar className="h-12 w-12" />
                        </div>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                        Track Consignment
                    </h1>
                </div>

                {!result ? (
                    <Card className="border-none shadow-3xl rounded-[3rem] bg-white overflow-hidden animate-in fade-in zoom-in-95 duration-500 max-w-2xl mx-auto">
                        <CardHeader className="bg-slate-50 border-b p-10 text-center">
                            <CardTitle className="text-2xl font-black uppercase text-blue-900 tracking-tight">Track your Shipment</CardTitle>
                        </CardHeader>
                        <CardContent className="p-12 space-y-10">
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-700 animate-in shake-in duration-300">
                                    <AlertCircle className="h-6 w-6 shrink-0" />
                                    <p className="text-sm font-black uppercase tracking-tight leading-tight">{error}</p>
                                </div>
                            )}

                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <Label htmlFor="trip-id" className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 flex items-center gap-2">
                                        <FileText className="h-3 w-3" /> Mandatory Trip ID Node
                                    </Label>
                                    <Input 
                                        id="trip-id"
                                        placeholder="e.g. T8492038475" 
                                        value={tripIdInput}
                                        onChange={e => setTripIdInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleTrack()}
                                        className="h-16 rounded-2xl font-black text-blue-900 uppercase text-2xl text-center border-slate-200 shadow-inner focus-visible:ring-blue-900"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 flex items-center gap-2">
                                        <ShieldCheck className="h-3 w-3" /> Security CAPTCHA Handshake
                                    </Label>
                                    <div className="flex gap-4">
                                        <div className="flex-1 h-16 bg-slate-900 rounded-2xl flex items-center justify-center font-black tracking-[0.6em] text-white italic text-2xl select-none border-4 border-slate-800 shadow-xl relative group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg] group-hover:translate-x-full transition-transform duration-1000" />
                                            {generatedCaptcha}
                                        </div>
                                        <Input 
                                            placeholder="Enter Code" 
                                            value={captchaInput}
                                            onChange={e => setCaptchaInput(e.target.value)}
                                            className="w-40 h-16 rounded-2xl font-black text-center uppercase border-slate-200 text-xl focus-visible:ring-blue-900"
                                        />
                                    </div>
                                </div>

                                <Button 
                                    onClick={handleTrack} 
                                    disabled={isSearching || !tripIdInput}
                                    className="w-full h-16 rounded-2xl bg-blue-900 hover:bg-black text-white font-black uppercase tracking-[0.3em] text-sm shadow-2xl shadow-blue-900/30 transition-all active:scale-95 border-none disabled:opacity-30"
                                >
                                    {isSearching ? <Loader2 className="h-6 w-6 animate-spin mr-3" /> : <Search className="mr-3 h-6 w-6" />}
                                    TRACK CONSIGNMENT
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-10 animate-in slide-in-from-bottom-12 duration-1000 pb-24">
                        <div className="flex justify-between items-center px-4">
                            <Button variant="ghost" onClick={() => {setResult(null); refreshCaptcha();}} className="font-black text-slate-400 hover:text-blue-900 uppercase text-[11px] tracking-[0.2em] gap-2 transition-all">
                                <ArrowLeft className="h-4 w-4" /> Return to Registry Search
                            </Button>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border shadow-sm">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Signal: Optimal</span>
                                </div>
                            </div>
                        </div>

                        <Card className="border-none shadow-3xl rounded-[3.5rem] bg-slate-900 text-white overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-16 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110">
                                <Package className="h-80 w-80" />
                            </div>
                            <CardHeader className="bg-white/5 border-b border-white/5 p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-blue-600 rounded-3xl shadow-2xl rotate-3">
                                        <Truck className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Mission Particulars</h2>
                                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em] mt-2">Real-time status synchronized</p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Registry Trip ID</span>
                                    <Badge variant="outline" className="mt-1 border-blue-500/30 text-blue-400 font-mono text-lg font-black px-6 h-10 tracking-[0.2em] bg-white/5">
                                        {result.tripId}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-12">
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-10">
                                    {[
                                        { label: 'Lifting Site', value: result.loadingPoint || result.originPlantId, icon: Factory },
                                        { label: 'Ship to Node', value: result.shipToParty || result.shipment?.shipToParty, icon: UserCircle },
                                        { label: 'Drop destination', value: result.unloadingPoint || result.destination, icon: MapPin },
                                        { label: 'Vehicle Number', value: result.vehicleNumber, bold: true, icon: Truck },
                                        { label: 'Invoice ref', value: result.shipment?.invoiceNumber || '--', mono: true, icon: FileText },
                                        { label: 'LR Number', value: result.lrNumber || '--', mono: true, bold: true, color: 'text-blue-400', icon: FileText },
                                        { label: 'Manifest Qty', value: `${result.assignedQtyInTrip} MT`, color: 'text-emerald-400', bold: true, icon: Calculator },
                                    ].map((item, i) => (
                                        <div key={i} className="space-y-2 relative z-10">
                                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                                <item.icon className="h-3 w-3" /> {item.label}
                                            </span>
                                            <p className={cn(
                                                "text-xs font-bold uppercase truncate leading-tight",
                                                item.bold && "font-black text-[14px]",
                                                item.mono && "font-mono tracking-tighter",
                                                item.color || "text-white"
                                            )} title={item.value}>{item.value || '--'}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <section className="space-y-8">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-sm font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-3">
                                    <TrendingUp className="h-5 w-5 text-blue-600"/> Consignment Tracking Details
                                </h3>
                                <Badge className="bg-slate-900 text-white font-black uppercase text-[10px] px-6 h-8 border-none shadow-xl flex gap-2">
                                    <Timer className="h-3.5 w-3.5 text-blue-400" /> 
                                    Active: {result.tripStatus || result.currentStatusId}
                                </Badge>
                            </div>

                            <div className="relative p-12 bg-white rounded-[4rem] shadow-3xl border-2 border-slate-100 overflow-hidden group/timeline">
                                <div className="absolute top-1/2 left-24 right-24 h-3 bg-slate-100 -translate-y-1/2 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="h-full bg-blue-900 transition-all duration-1000 ease-in-out shadow-[0_0_15px_rgba(30,58,138,0.5)]"
                                        style={{ width: `${(getActiveStage(result.tripStatus || result.currentStatusId) / (progressStages.length - 1)) * 100}%` }}
                                    />
                                </div>

                                <div className="relative flex justify-between items-center px-4">
                                    {progressStages.map((stage, i) => {
                                        const activeIndex = getActiveStage(result.tripStatus || result.currentStatusId);
                                        const isCompleted = i <= activeIndex;
                                        const isActive = i === activeIndex;
                                        const timestamp = getStageTimestamp(i, stage.key);
                                        
                                        return (
                                            <div key={i} className="flex flex-col items-center gap-6 relative z-10 w-36 group">
                                                <div className={cn(
                                                    "h-16 w-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 border-4",
                                                    isCompleted && !isActive ? "bg-emerald-600 border-emerald-400 text-white shadow-emerald-100 shadow-xl" :
                                                    isActive ? "bg-blue-900 border-blue-400 text-white scale-125 shadow-2xl rotate-3" :
                                                    "bg-white border-slate-100 text-slate-300 shadow-sm"
                                                )}>
                                                    <stage.icon className={cn("h-7 w-7", isActive && "animate-pulse")} />
                                                </div>
                                                <div className="text-center space-y-1">
                                                    <p className={cn(
                                                        "text-[11px] font-black uppercase tracking-tight transition-colors duration-500",
                                                        isActive ? "text-blue-900 scale-110" : isCompleted ? "text-emerald-700" : "text-slate-400"
                                                    )}>{stage.label}</p>
                                                    <p className="text-[8px] font-bold uppercase text-slate-300 tracking-widest">{stage.desc}</p>
                                                    
                                                    {isCompleted && timestamp && (
                                                        <div className="mt-2 flex flex-col items-center animate-in fade-in duration-700">
                                                            <span className="text-[9px] font-black text-slate-900 font-mono">
                                                                {format(new Date(timestamp.toDate ? timestamp.toDate() : timestamp), 'dd/MM/yy')}
                                                            </span>
                                                            <span className="text-[8px] font-bold text-blue-600 font-mono">
                                                                {format(new Date(timestamp.toDate ? timestamp.toDate() : timestamp), 'HH:mm')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                {isActive && (
                                                    <div className="absolute -top-12 animate-bounce">
                                                        <Badge className="bg-blue-900 font-black text-[8px] uppercase border-none shadow-lg">Current Node</Badge>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden group">
                                <CardHeader className="bg-slate-50 border-b p-8">
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Journey Particulars</CardTitle>
                                </CardHeader>
                                <CardContent className="p-10 space-y-10">
                                    <div className="flex gap-6 items-start">
                                        <div className="p-4 bg-blue-50 rounded-2xl shadow-sm border border-blue-100"><MapPin className="h-6 w-6 text-blue-600" /></div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Lifting Origin</p>
                                            <p className="text-sm font-black text-slate-900 uppercase leading-snug">{result.loadingPoint}</p>
                                            <p className="text-[10px] font-bold text-blue-600 mt-2 flex items-center gap-2">
                                                <Calendar className="h-3 w-3" /> {format(result.assignDate, 'dd MMMM yyyy | HH:mm')}
                                            </p>
                                        </div>
                                    </div>

                                    <Separator className="border-slate-100" />

                                    <div className="flex gap-6 items-start">
                                        <div className="p-4 bg-red-50 rounded-2xl shadow-sm border border-red-100"><MapPin className="h-6 w-6 text-red-600" /></div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Delivery Destination</p>
                                            <p className="text-sm font-black text-slate-900 uppercase leading-snug">{result.unloadingPoint}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-2xl rounded-[3rem] bg-slate-900 text-white overflow-hidden flex flex-col relative">
                                <div className="absolute top-0 right-0 p-10 opacity-[0.05]"><Clock className="h-40 w-40" /></div>
                                <CardHeader className="p-10 border-b border-white/5 relative z-10">
                                    <div className="flex items-center gap-3 text-blue-400">
                                        <ShieldCheck className="h-5 w-5" />
                                        <CardTitle className="text-sm font-black uppercase tracking-widest">Delivery Intelligence</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-12 flex-1 flex flex-col justify-center items-center text-center space-y-10 relative z-10">
                                    <div className="p-8 bg-white/5 rounded-full border-4 border-white/10 shadow-2xl">
                                        <Calendar className="h-16 w-16 text-blue-400" />
                                    </div>
                                    
                                    <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full">
                                        <div className="space-y-2">
                                            <p className="text-[11px] font-black uppercase text-blue-300 tracking-[0.3em]">Total Distance</p>
                                            <h4 className="text-3xl font-black tracking-tighter text-white">
                                                {result.distanceValue > 0 ? (
                                                    `${Number(result.distanceValue).toFixed(2)} KM`
                                                ) : (
                                                    <span className="flex items-center gap-2 justify-center">
                                                        -- 
                                                        <Loader2 className="h-4 w-4 animate-spin opacity-30" />
                                                    </span>
                                                )}
                                            </h4>
                                        </div>
                                        
                                        <Separator orientation="vertical" className="hidden md:block h-12 bg-white/10" />
                                        
                                        <div className="space-y-2">
                                            <p className="text-[11px] font-black uppercase text-blue-300 tracking-[0.3em]">Expected Delivery Node</p>
                                            <h4 className="text-3xl font-black tracking-tighter text-white">
                                                {format(result.expectedDelivery, 'dd MMMM yyyy')}
                                            </h4>
                                        </div>
                                    </div>

                                    <div className="h-1 w-20 bg-blue-600 mx-auto rounded-full" />
                                    
                                    <p className="text-[9px] font-bold text-slate-500 uppercase italic max-w-[250px] leading-relaxed">
                                        Calculation based on mission velocity registry and dispatch distance node according to Google Maps logic.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-10 bg-blue-50 rounded-[3rem] border-2 border-blue-100 border-dashed relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700"><CheckCircle2 className="h-20 w-20 text-blue-900" /></div>
                            <div className="flex items-start gap-5 relative z-10">
                                <AlertCircle className="h-8 w-8 text-blue-600 shrink-0 mt-1" />
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-blue-900 uppercase">Registry Synchronization Policy</p>
                                    <p className="text-[10px] font-bold text-blue-700 leading-normal uppercase">
                                        Mission status nodes are auto-fetched from the Trip Board registry. Telemetry pulses are synchronized every 60 seconds across the mission hub.
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" onClick={() => window.location.reload()} className="h-12 px-10 rounded-xl font-black uppercase text-[10px] tracking-widest border-blue-200 text-blue-900 bg-white gap-3 shadow-lg hover:bg-blue-50 transition-all relative z-10 shrink-0">
                                <RefreshCcw className="h-4 w-4" /> Refresh Registry Signal
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function useToast() {
    return {
        toast: (props: any) => console.log("Toast:", props)
    };
}

export default function TrackConsignmentPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-blue-900" /></div>}>
            <TrackConsignmentContent />
        </Suspense>
    );
}