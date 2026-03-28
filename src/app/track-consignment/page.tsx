
'use client';

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
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
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useJsApiLoader } from '@react-google-maps/api';

const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const libraries: ("places")[] = ['places'];

function TrackConsignmentContent() {
    const firestore = useFirestore();
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: MAPS_JS_KEY,
        libraries
    });
    
    const [tripIdInput, setTripIdInput] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');
    const [generatedCaptcha, setGeneratedCaptcha] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [runningIcon, setRunningIcon] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;
        const fetchSettings = async () => {
            const snap = await getDoc(doc(firestore, "gps_settings", "api_config"));
            if (snap.exists() && snap.data().runningIconUrl) {
                setRunningIcon(snap.data().runningIconUrl);
            }
        };
        fetchSettings();
    }, [firestore]);

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

    const handleTrack = async () => {
        if (!tripIdInput.trim()) {
            setError("Please enter a valid Trip ID.");
            return;
        }
        if (captchaInput.toUpperCase() !== generatedCaptcha) {
            setError("Invalid Code. Please try again.");
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
                setError("Invalid Trip ID. Check Registry.");
                refreshCaptcha();
            } else {
                const tripData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
                const shipId = tripData.shipmentIds?.[0];
                let shipmentData = null;
                if (shipId) {
                    const shipRef = doc(firestore!, `plants/${tripData.originPlantId}/shipments`, shipId);
                    const shipSnap = await getDoc(shipRef);
                    if (shipSnap.exists()) shipmentData = shipSnap.data();
                }

                const plantSnap = await getDoc(doc(firestore!, "logistics_plants", tripData.originPlantId));
                const plantName = plantSnap.exists() ? plantSnap.data().name : tripData.originPlantId;

                setResult({
                    ...tripData,
                    shipment: shipmentData,
                    plantName,
                    assignDate: tripData.startDate instanceof Timestamp ? tripData.startDate.toDate() : new Date(tripData.startDate),
                    loadingCity: (shipmentData?.loadingPoint || tripData.loadingPoint || plantName).split(',')[0].trim(),
                    unloadingCity: (shipmentData?.unloadingPoint || tripData.unloadingPoint || tripData.destination).split(',')[0].trim()
                });
            }
        } catch (e) {
            setError("Connection Interrupted.");
        } finally {
            setIsSearching(false);
        }
    };

    const progressStages = [
        { label: 'Assigned', desc: 'Planned', icon: ClipboardList },
        { label: 'Loading', desc: 'In Yard', icon: Factory }, 
        { label: 'In Transit', desc: 'Moving', icon: Truck },
        { label: 'Arrived', desc: 'Dest Node', icon: MapPin },
        { label: 'Delivered', desc: 'Finished', icon: CheckCircle2 }
    ];

    const getActiveStage = (status: string) => {
        const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
        if (['delivered', 'closed'].includes(s)) return 4;
        if (['arrived', 'arrival-for-delivery'].includes(s)) return 3;
        if (['in-transit'].includes(s)) return 2;
        if (['loaded', 'loading-complete'].includes(s)) return 1;
        return 0;
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-16 px-4 font-body">
            <div className="max-w-6xl w-full space-y-12">
                <div className="text-center space-y-4">
                    <div className="flex justify-center mb-6"><div className="p-5 bg-blue-900 text-white rounded-[2.5rem] shadow-3xl rotate-3"><Radar className="h-12 w-12" /></div></div>
                    <h1 className="text-5xl md:text-6xl font-black text-slate-900 uppercase italic">Track Consignment</h1>
                </div>

                {!result ? (
                    <Card className="border-none shadow-3xl rounded-[3rem] bg-white overflow-hidden max-w-2xl mx-auto">
                        <CardHeader className="bg-slate-50 border-b p-10 text-center"><CardTitle className="text-2xl font-black uppercase text-blue-900">Track Mission</CardTitle></CardHeader>
                        <CardContent className="p-12 space-y-10">
                            {error && <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-4 font-black uppercase text-xs border border-red-100"><AlertCircle /> {error}</div>}
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <Label className="text-[11px] font-black uppercase text-slate-400 px-1 tracking-widest">Trip ID Node *</Label>
                                    <Input placeholder="e.g. T8492038475" value={tripIdInput} onChange={e => setTripIdInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTrack()} className="h-16 rounded-2xl font-black text-blue-900 uppercase text-2xl text-center shadow-inner" />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-[11px] font-black uppercase text-slate-400 px-1">CAPTCHA Handshake *</Label>
                                    <div className="flex gap-4">
                                        <div className="flex-1 h-16 bg-slate-900 rounded-2xl flex items-center justify-center font-black tracking-[0.6em] text-white text-2xl italic">{generatedCaptcha}</div>
                                        <Input placeholder="Code" value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} className="w-40 h-16 rounded-2xl font-black text-center text-xl" />
                                    </div>
                                </div>
                                <Button onClick={handleTrack} disabled={isSearching || !tripIdInput} className="w-full h-16 rounded-2xl bg-blue-900 text-white font-black uppercase tracking-[0.3em] shadow-2xl">
                                    {isSearching ? <Loader2 className="animate-spin mr-3" /> : <Search className="mr-3" />} TRACK MISSION
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-10 animate-in slide-in-from-bottom-12 duration-1000">
                        <Button variant="ghost" onClick={() => {setResult(null); refreshCaptcha();}} className="font-black text-slate-400 hover:text-blue-900 uppercase text-[11px] tracking-[0.2em] gap-2"><ArrowLeft size={16}/> Return</Button>
                        <Card className="border-none shadow-3xl rounded-[3.5rem] bg-slate-900 text-white p-12">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-10">
                                {[
                                    { label: 'FROM (City)', value: result.loadingCity, icon: Factory, color: 'text-blue-300' },
                                    { label: 'TO (Destination)', value: result.unloadingCity, icon: MapPin, color: 'text-emerald-400' },
                                    { label: 'Vehicle Registry', value: result.vehicleNumber, bold: true },
                                    { label: 'Trip ID Node', value: result.tripId, mono: true, color: 'text-blue-400' },
                                    { label: 'LR Number', value: result.lrNumber || '--', bold: true },
                                    { label: 'Manifest Qty', value: `${result.assignedQtyInTrip} MT`, color: 'text-emerald-400' },
                                    { label: 'Mission Status', value: result.tripStatus || result.currentStatusId, highlight: true },
                                ].map((item, i) => (
                                    <div key={i} className="space-y-1">
                                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">{item.icon && <item.icon size={10}/>} {item.label}</span>
                                        <p className={cn("text-xs font-bold uppercase truncate", item.bold && "font-black text-sm", item.mono && "font-mono tracking-tighter", item.color, item.highlight && "bg-blue-600 px-2 py-0.5 rounded text-[10px]")}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <div className="relative p-12 bg-white rounded-[4rem] shadow-3xl border-2 border-slate-100 overflow-hidden">
                            <div className="absolute top-1/2 left-24 right-24 h-3 bg-slate-100 -translate-y-1/2 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-900 transition-all duration-1000" style={{ width: `${(getActiveStage(result.tripStatus) / 4) * 100}%` }} />
                            </div>
                            <div className="relative flex justify-between items-center">
                                {progressStages.map((stage, i) => {
                                    const active = getActiveStage(result.tripStatus);
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-4 relative z-10 w-32">
                                            <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center transition-all border-4 shadow-xl", i <= active ? "bg-blue-900 border-blue-400 text-white" : "bg-white border-slate-100 text-slate-300")}><stage.icon /></div>
                                            <p className={cn("text-[10px] font-black uppercase tracking-tight", i <= active ? "text-blue-900" : "text-slate-400")}>{stage.label}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TrackConsignmentPage() {
    return <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-900" /></div>}><TrackConsignmentContent /></Suspense>;
}
