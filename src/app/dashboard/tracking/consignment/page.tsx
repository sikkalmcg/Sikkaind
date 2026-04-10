
'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
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
    Factory, 
    ChevronRight,
    Loader2,
    Calendar,
    User,
    Clock,
    Navigation,
    CircleDot,
    X as XIcon,
    AlertCircle,
    Smartphone,
    RefreshCcw
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp } from 'firebase/firestore';
import { format, addSeconds, isValid } from 'date-fns';
import { cn, parseSafeDate } from '@/lib/utils';
import { useJsApiLoader, GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
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

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: MAPS_JS_KEY,
        libraries: ['places']
    });

    const refreshTelemetry = useCallback(async (vNo: string) => {
        if (!vNo || !apiKey) return;
        try {
            const response = await fetch('/api/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiKey }),
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
            
            // CONCISE CITY LOGIC NODE
            trip.toCity = trip.unloadingPoint?.split(',')[0].trim() || 'N/A';
            trip.fromCity = (trip.loadingPoint || trip.plantName).split(',')[0].trim();

            const response = await fetch('/api/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiKey }),
            }); 
            const result = await response.json();
            
            if (Array.isArray(result) && result.length > 0) {
                const vehicleData = result.find(v => v.vehicleNumber === trip.vehicleNumber);
                if (vehicleData) {
                    setLivePos(vehicleData);
                    setIsGpsEnabled(true);
                }
            }
            
            setConsignment({ 
                ...trip, 
                assignedAt: parseSafeDate(trip.startDate) || new Date()
            });

        } catch (e) {
            toast({ variant: 'destructive', title: "Sync Error", description: "Registry handshake failed." });
        } finally {
            setIsSearching(false);
        }
    }, [firestore, searchQuery, toast, apiKey]);

    useEffect(() => {
        if (urlSearch && firestore && apiKey) {
            handleSearch(urlSearch);
        }
    }, [urlSearch, firestore, apiKey, handleSearch]);

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500 overflow-y-auto">
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
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6 p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                            {[
                                { label: 'Plant Node', value: consignment.plantName, icon: Factory },
                                { label: 'Vehicle', value: consignment.vehicleNumber, bold: true },
                                { label: 'Trip ID', value: consignment.tripId, mono: true, color: 'text-blue-400' },
                                { label: 'LR Number', value: consignment.lrNumber || '--', bold: true },
                                { label: 'FROM (City)', value: consignment.fromCity, color: 'text-blue-200' },
                                { label: 'TO (City)', value: consignment.toCity, color: 'text-emerald-400' },
                                { label: 'Ship To', value: consignment.shipToParty || '--', truncate: true },
                                { label: 'Weight', value: `${consignment.assignedQtyInTrip} MT`, color: 'text-emerald-400', bold: true },
                            ].map((item, i) => (
                                <div key={i} className="space-y-1 relative z-10">
                                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                                        {item.icon && <item.icon className="h-2.5 w-2.5" />} {item.label}
                                    </p>
                                    <p className={cn("text-xs font-bold uppercase", item.bold && "font-black text-[13px]", item.mono && "font-mono", item.color || "text-white", item.truncate && "truncate")} title={item.value}>{item.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <Card className="lg:col-span-2 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                                <CardHeader className="bg-slate-50 border-b p-8"><CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Mission Tracking Manifest</CardTitle></CardHeader>
                                <CardContent className="p-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-10">
                                            <div className="flex gap-6 items-start">
                                                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm"><MapPin className="h-6 w-6 text-blue-600" /></div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">From Location Node</p>
                                                    <p className="text-sm font-black text-slate-900 uppercase leading-tight">{consignment.fromCity}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-2">
                                                        <Clock className="h-3 w-3" /> Assigned: {isValid(consignment.assignedAt) ? format(consignment.assignedAt, 'dd MMM yyyy p') : '--'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-6 items-start">
                                                <div className="p-3 bg-red-50 rounded-2xl border border-red-100 shadow-sm"><CircleDot className="h-6 w-6 text-red-600" /></div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">To Destination Node</p>
                                                    <p className="text-sm font-black text-slate-900 uppercase leading-tight">{consignment.toCity}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-10">
                                            <div className="p-8 bg-blue-50 rounded-[2rem] border-2 border-blue-100 flex flex-col justify-center items-center text-center shadow-inner">
                                                <Calendar className="h-10 w-10 text-blue-600 mb-4" />
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Expected Delivery Node</p>
                                                <p className="text-2xl font-black text-blue-900 tracking-tighter">
                                                    {eta && isValid(eta) ? format(eta, 'dd MMM yyyy') : '--'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            
                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
                                <CardHeader className="bg-slate-50 border-b p-8"><CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Fleet Authorization</CardTitle></CardHeader>
                                <CardContent className="p-8 flex-1 flex flex-col justify-between">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border">
                                            <div className={cn("p-3 rounded-full border-4", isGpsEnabled ? "bg-emerald-100 border-emerald-200 text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-400")}>
                                                <Smartphone className="h-8 w-8" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-black uppercase text-slate-900">{isGpsEnabled ? 'Satellite Link Active' : 'GPS Signal Offline'}</h4>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-tight">{isGpsEnabled ? 'Live telemetry signal active.' : 'Vehicle signal inactive.'}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <InfoRow icon={Truck} label="Vehicle Number" value={consignment.vehicleNumber} />
                                            <InfoRow icon={User} label="Driver" value={livePos?.driverName || 'N/A'} />
                                            <InfoRow icon={MapPin} label="Live Location" value={livePos?.location || 'Syncing...'} isLocation={true} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col w-full gap-3 mt-6">
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
            <p className={cn("text-sm font-bold uppercase", isLocation ? "text-blue-600 animate-pulse" : "text-slate-800")}>{value}</p>
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
                    onEtaResolved(addSeconds(new Date(), duration));
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
                            options={{ disableDefaultUI: true, styles: [{ elementType: "geometry", stylers: [{ color: "#242f3e" }] }] }}
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
    return <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}><TrackConsignmentContent /></Suspense>;
}
