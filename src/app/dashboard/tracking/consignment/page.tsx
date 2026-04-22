
'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
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
    Calendar,
    User,
    Clock,
    CircleDot,
    X as XIcon,
    AlertCircle,
    Smartphone,
    RefreshCcw,
    ClipboardList,
    CheckCircle2,
    Box,
    ArrowLeft,
    FileText,
    Weight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate, normalizePlantId } from '@/lib/utils';
import { useJsApiLoader, GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSearchParams } from 'next/navigation';

const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const DEFAULT_TRUCK_ICON = "https://png.pngtree.com/png-vector/20250122/ourlarge/pngtree-colorful-delivery-truck-icon-png-image_15301010.png";

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
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [eta, setEta] = useState<Date | null>(null);
    
    const [animIndex, setAnimIndex] = useState(-1);
    const [isReversed, setIsReversed] = useState(false);

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
        { id: 'assign', label: 'ASSIGN', icon: ClipboardList },
        { id: 'loading', label: 'LOADING', icon: Factory },
        { id: 'transit', label: 'IN-TRANSIT', icon: Truck },
        { id: 'arrived', label: 'ARRIVED', icon: MapPin },
        { id: 'delivered', label: 'DELIVERED', icon: CheckCircle2 }
    ];

    const getTargetIndex = (status: string) => {
        const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
        if (['delivered', 'closed'].includes(s)) return 4;
        if (['arrived', 'arrival-for-delivery', 'arrive-for-deliver', 'rejected'].includes(s)) return 3;
        if (['in-transit', 'out-for-delivery'].includes(s)) return 2;
        if (['yard', 'loading', 'loaded', 'loading-complete'].includes(s)) return 1;
        return 0;
    };

    const runAnimation = useCallback((targetIndex: number, rejected: boolean) => {
        setAnimIndex(-1);
        setIsReversed(false);
        let current = -1;
        
        const STEP_DURATION = 1500;

        const interval = setInterval(() => {
            current++;
            if (current <= targetIndex) {
                setAnimIndex(current);
            } else {
                clearInterval(interval);
                
                // MISSION REJECTION SEQUENCE node
                if (rejected) {
                    setTimeout(() => {
                        setAnimIndex(4); // Reach Rejection status
                        
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
            console.warn("Telemetry refresh failure.");
        }
    }, [apiKey]);

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

            setConsignment({ 
                ...trip, 
                assignedAt: parseSafeDate(trip.startDate) || new Date(),
                isRejected
            });

            runAnimation(getTargetIndex(status), isRejected);

        } catch (e) {
            toast({ variant: 'destructive', title: "Sync Error", description: "Registry handshake failed." });
        } finally {
            setIsSearching(false);
        }
    }, [firestore, searchQuery, toast, apiKey, runAnimation]);

    useEffect(() => {
        if (urlSearch && firestore && apiKey) {
            handleSearch(urlSearch);
        }
    }, [urlSearch, firestore, apiKey, handleSearch]);

    return (
        <main className="flex flex-1 flex-col h-full bg-white animate-in fade-in duration-500 overflow-y-auto">
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
                            <Label htmlFor="registry-id" className="text-[10px] font-black uppercase text-slate-400 px-1">Registry ID (Trip ID / LR #)</Label>
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
                            className="bg-blue-900 hover:bg-slate-900 text-white h-12 px-12 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl"
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
                                { label: 'Weight', value: `${consignment.assignedQtyInTrip} MT`, color: 'text-emerald-400', bold: true, icon: Weight },
                            ].map((item, i) => (
                                <div key={i} className="space-y-1 relative z-10">
                                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                                        {item.icon && <item.icon className="h-2.5 w-2.5" />} {item.label}
                                    </p>
                                    <p className={cn("text-xs font-bold uppercase", item.bold && "font-black text-[13px]", item.mono && "font-mono", item.color || "text-white", item.truncate && "truncate")} title={item.value as string}>{item.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* PROGRESS ANIMATION TERMINAL */}
                        <div className="relative p-12 md:p-20 bg-white border border-slate-100 rounded-[4rem] shadow-3xl overflow-hidden min-h-[450px] flex flex-col justify-center">
                            {/* PROGRESS LINE BACKGROUND */}
                            <div className="absolute top-1/2 left-24 right-24 h-2 bg-slate-100 -translate-y-1/2 rounded-full overflow-hidden shadow-inner">
                                <motion.div 
                                    className={cn(
                                        "h-full transition-colors duration-700", 
                                        (consignment.isRejected && isReversed) ? "bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "bg-blue-600"
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
                                    
                                    const activeColor = (consignment.isRejected && isReversed) ? "bg-red-600 border-red-400" : "bg-blue-600 border-blue-400";
                                    const label = (isFinal && consignment.isRejected) ? 'MISSION REJECTED' : stage.label;
                                    const timestampNode = consignment.lastUpdated || consignment.startDate || Date.now();
                                    const timestamp = timestampNode instanceof Timestamp ? timestampNode.toDate() : new Date(timestampNode);

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
                                                        {i === 2 ? <Truck size={40} /> : <stage.icon size={40} />}
                                                    </motion.div>
                                                ) : (
                                                    <stage.icon size={36} className={cn(isReversed && i < animIndex && "scale-x-[-1] opacity-50")} />
                                                )}
                                            </motion.div>
                                            <div className="text-center space-y-2">
                                                <p className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest transition-colors duration-500", 
                                                    active ? ((consignment.isRejected && isReversed) ? "text-red-700" : "text-slate-900") : "text-slate-200"
                                                )}>{label}</p>
                                                {active && (
                                                    <div className="flex flex-col items-center gap-1.5 mt-2 animate-in fade-in duration-700">
                                                        <p className="text-[10px] font-black font-mono text-red-600 leading-none tracking-tighter">
                                                            {format(timestamp, 'dd MMM yyyy')}
                                                        </p>
                                                        <p className="text-[10px] font-black font-mono text-red-600 leading-none">
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
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black uppercase text-red-900 tracking-[0.2em]">CRITICAL MISSION REJECTION</span>
                                            <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest mt-1">RETURNING ASSETS TO ORIGINAL LIFTING NODE REGISTRY</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
                                <CardHeader className="bg-slate-50 border-b p-8"><CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Fleet Authorization</CardTitle></CardHeader>
                                <CardContent className="p-8 flex-1 flex flex-col md:flex-row justify-between items-center gap-10">
                                    <div className="flex-1 space-y-6">
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border">
                                            <div className={cn("p-3 rounded-full border-4", isGpsEnabled ? "bg-emerald-100 border-emerald-200 text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-400")}>
                                                <Smartphone className="h-8 w-8" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-black uppercase text-slate-900">{isGpsEnabled ? 'Satellite Link Active' : 'GPS Signal Offline'}</h4>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{isGpsEnabled ? 'Live telemetry signal active.' : 'Vehicle signal inactive.'}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <InfoRow icon={Truck} label="Vehicle Number" value={consignment.vehicleNumber} />
                                            <InfoRow icon={User} label="Driver" value={livePos?.driverName || consignment.driverName || 'N/A'} />
                                            <InfoRow icon={MapPin} label="Live Location" value={livePos?.location || 'Syncing...'} isLocation={true} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col w-full md:w-64 gap-3">
                                        <Button onClick={() => setIsMapModalOpen(true)} disabled={!isGpsEnabled} className="w-full h-12 rounded-xl font-black uppercase text-xs shadow-lg">Track Mission</Button>
                                        <Button variant="outline" onClick={() => refreshTelemetry(consignment.vehicleNumber)} disabled={isSearching} className="w-full h-10 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2">
                                            <RefreshCcw className={cn("h-3 w-3", isSearching && "animate-spin")} /> Force Sync
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>

            {isMapModalOpen && consignment && (
                <TrackingPopup 
                    isOpen={isMapModalOpen}
                    onClose={() => setIsMapModalOpen(false)}
                    consignment={consignment}
                    livePos={livePos}
                    onEtaResolved={setEta}
                />
            )}
        </main>
    );
}

const InfoRow = ({ icon: Icon, label, value, isLocation = false }: { icon: any, label: string, value: string, isLocation?: boolean }) => (
    <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 text-slate-400 mt-1" />
        <div className="flex-1">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
            <p className={cn("text-sm font-bold uppercase", isLocation ? "text-blue-600 animate-pulse" : "text-slate-800")}>{value || '--'}</p>
        </div>
    </div>
);

function TrackingPopup({ isOpen, onClose, consignment, livePos, onEtaResolved }: { isOpen: boolean; onClose: () => void; consignment: any; livePos: any; onEtaResolved: (date: Date) => void; }) {
    const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: MAPS_JS_KEY, libraries: ['places'] });
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

    const onMapLoad = useCallback((map: google.maps.Map) => {
        if (!window.google || !consignment.unloadingPoint) return;
        const directionsService = new google.maps.DirectionsService();
        const origin = { lat: livePos.latitude, lng: livePos.longitude };
        directionsService.route(
            { origin, destination: consignment.unloadingPoint, travelMode: google.maps.TravelMode.DRIVING },
            (result, status) => {
                if (status === "OK" && result) {
                    setDirections(result);
                    const duration = result.routes[0].legs[0].duration?.value || 0;
                    onEtaResolved(new Date(Date.now() + duration * 1000));
                }
            }
        );
    }, [livePos, consignment.unloadingPoint, onEtaResolved]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 border-none shadow-3xl overflow-hidden bg-slate-900 rounded-[3rem] flex flex-col">
                <DialogHeader className="p-6 bg-slate-950 border-b border-white/5 flex flex-row items-center justify-between space-y-0 pr-12">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg"><Radar className="h-6 w-6 text-white" /></div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight italic text-white leading-none">Live Mission Telemetry</DialogTitle>
                            <DialogDescription className="text-blue-400 font-bold uppercase text-[9px] tracking-widest mt-2">Vehicle: {consignment.vehicleNumber} | Registry ID: {consignment.tripId}</DialogDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 text-white/40 hover:text-white hover:bg-white/10 rounded-xl"><XIcon className="h-6 w-6" /></Button>
                </DialogHeader>
                <div className="flex-1 relative bg-slate-800">
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={{ lat: livePos.latitude, lng: livePos.longitude }}
                            zoom={12}
                            onLoad={onMapLoad}
                            options={{ 
                                disableDefaultUI: true, 
                                styles: [
                                    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                                    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                                    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                                    { 
                                        featureType: "road", 
                                        elementType: "geometry", 
                                        stylers: [{ color: "#485a71" }] 
                                    },
                                    { 
                                        featureType: "road", 
                                        elementType: "geometry.stroke", 
                                        stylers: [{ color: "#212a37" }] 
                                    },
                                    { 
                                        featureType: "road.highway", 
                                        elementType: "geometry", 
                                        stylers: [{ color: "#746855" }] 
                                    },
                                    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
                                ]
                            }}
                        >
                            <Marker position={{ lat: livePos.latitude, lng: livePos.longitude }} icon={{ url: DEFAULT_TRUCK_ICON, scaledSize: new google.maps.Size(45, 45) }} />
                            {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
                        </GoogleMap>
                    ) : <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function TrackConsignmentPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <TrackConsignmentContent />
        </Suspense>
    );
}
