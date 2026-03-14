
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
    ArrowRightLeft,
    Clock,
    Navigation,
    CircleDot,
    X as XIcon,
    AlertCircle,
    Smartphone,
    RefreshCcw
} from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp } from 'firebase/firestore';
import { format, addHours, addSeconds, isValid } from 'date-fns';
import { cn, normalizePlantId } from '@/lib/utils';
import { useJsApiLoader, GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useToast } from '@/hooks/use-toast';
import { fetchWheelseyeLocation } from '@/app/actions/wheelseye';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const DEFAULT_TRUCK_ICON = "https://png.pngtree.com/png-vector/20250122/ourlarge/pngtree-colorful-delivery-truck-icon-png-image_15301010.png";

function TrackConsignmentContent() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const urlSearch = searchParams.get('search');

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: MAPS_JS_KEY,
        libraries: ['places']
    });

    const [searchQuery, setSearchQuery] = useState(urlSearch || '');
    const [isSearching, setIsSearching] = useState(false);
    const [consignment, setConsignment] = useState<any>(null);
    const [livePos, setLivePos] = useState<any>(null);
    const [isGpsEnabled, setIsGpsEnabled] = useState(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [eta, setEta] = useState<Date | null>(null);

    /**
     * REGISTRY REFRESH NODE
     * Synchronizes live telemetry signal with the dashboard state.
     */
    const refreshTelemetry = useCallback(async (vNo: string) => {
        if (!vNo) return;
        try {
            const gpsRes = await fetchWheelseyeLocation(vNo);
            if (gpsRes.data) {
                setLivePos(gpsRes.data);
                setIsGpsEnabled(true);
            }
        } catch (e) {
            console.warn("Registry handshake failed during refresh pulse.");
        }
    }, []);

    // AUTO-REFRESH PULSE: 30s interval for active consignment
    useEffect(() => {
        if (!consignment?.vehicleNumber) return;
        const interval = setInterval(() => {
            refreshTelemetry(consignment.vehicleNumber);
        }, 30000);
        return () => clearInterval(interval);
    }, [consignment?.vehicleNumber, refreshTelemetry]);

    const handleSearch = useCallback(async (overriddenQuery?: string) => {
        if (!firestore) return;
        const term = (overriddenQuery || searchQuery).trim().toUpperCase();
        if (!term) return;

        setIsSearching(true);
        setConsignment(null);
        setLivePos(null);
        setIsGpsEnabled(false);
        setEta(null);

        try {
            const tripsRef = collection(firestore, "trips");
            
            // 1. Resolve Trip ID or LR Number
            let q = query(tripsRef, where("tripId", "==", term), limit(1));
            let snap = await getDocs(q);
            
            if (snap.empty) {
                q = query(tripsRef, where("lrNumber", "==", term), limit(1));
                snap = await getDocs(q);
            }

            if (snap.empty) {
                toast({ variant: 'destructive', title: "Registry Conflict", description: "Consignment ID not recognized in mission database." });
                setIsSearching(false);
                return;
            }

            const trip = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
            
            // 2. Cross-reference Plant and Shipment data for Dynamic Location
            const plantSnap = await getDoc(doc(firestore, "logistics_plants", trip.originPlantId));
            if (plantSnap.exists()) {
                const pData = plantSnap.data();
                trip.plantName = pData.name;
                trip.plantLat = pData.latitude;
                trip.plantLng = pData.longitude;
            } else {
                trip.plantName = trip.originPlantId;
            }

            const shipId = trip.shipmentIds?.[0];
            if (shipId) {
                const shipRef = doc(firestore, `plants/${trip.originPlantId}/shipments`, shipId);
                const shipSnap = await getDoc(shipRef);
                if (shipSnap.exists()) {
                    const shipData = shipSnap.data();
                    trip.shipmentInfo = shipData;
                    trip.loadingPoint = trip.loadingPoint || shipData.loadingPoint || trip.plantName;
                }
            }
            
            if (!trip.loadingPoint) trip.loadingPoint = trip.plantName;

            // 3. GIS HANDSHAKE (Primary Authorization)
            const gpsRes = await fetchWheelseyeLocation(trip.vehicleNumber);
            
            if (gpsRes.data) {
                setLivePos(gpsRes.data);
                setIsGpsEnabled(true);
                toast({ title: "Signal Established", description: `Live telemetry node linked for ${trip.vehicleNumber}.` });
            } else {
                const vNoClean = trip.vehicleNumber?.toUpperCase().replace(/\s/g, '');
                const vRef = query(collection(firestore, "vehicles"), where("vehicleNumber", "==", vNoClean), limit(1));
                const vSnap = await getDocs(vRef);
                const internalGpsStatus = !vSnap.empty && vSnap.docs[0].data().gps_enabled === true;
                setIsGpsEnabled(internalGpsStatus);
            }
            
            setConsignment({ 
                ...trip, 
                assignedAt: trip.startDate instanceof Timestamp ? trip.startDate.toDate() : (trip.startDate ? new Date(trip.startDate) : new Date())
            });

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: "Sync Error", description: "Mission registry handshake failed." });
        } finally {
            setIsSearching(false);
        }
    }, [firestore, searchQuery, toast]);

    // MISSION HANDSHAKE: Auto-resolve from URL
    useEffect(() => {
        if (urlSearch && firestore) {
            handleSearch(urlSearch);
        }
    }, [urlSearch, firestore, handleSearch]);

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500 overflow-y-auto">
            <div className="p-8 space-y-10 max-w-7xl mx-auto w-full">
                {/* SEARCH INTERFACE */}
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
                            <Label htmlFor="registry-id" className="text-[10px] font-black uppercase text-slate-400 px-1">Registry Identifier (Trip ID / LR #)</Label>
                            <Input 
                                id="registry-id"
                                placeholder="Resolve Registry..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                className="h-12 rounded-xl font-black text-blue-900 uppercase shadow-inner bg-slate-50 border-slate-200" 
                            />
                        </div>
                        <Button 
                            disabled={isSearching} 
                            onClick={() => handleSearch()}
                            className="bg-blue-900 hover:bg-slate-900 text-white h-12 px-12 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all active:scale-95 border-none"
                        >
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="mr-2 h-4 w-4" />}
                            Resolve
                        </Button>
                    </div>
                </div>

                {consignment && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
                        {/* 1. TOP HEADER SECTION (Consignment Summary) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6 p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110">
                                <ShieldCheck className="h-64 w-64" />
                            </div>
                            {[
                                { label: 'Plant Node', value: consignment.plantName, icon: Factory },
                                { label: 'Vehicle', value: consignment.vehicleNumber, bold: true },
                                { label: 'Trip ID', value: consignment.tripId, mono: true, color: 'text-blue-400' },
                                { label: 'LR Number', value: consignment.lrNumber || '--', mono: true, bold: true },
                                { label: 'FROM (Dispatch)', value: consignment.loadingPoint || consignment.plantName, truncate: true, color: 'text-blue-200' },
                                { label: 'Ship To', value: consignment.shipToParty || '--', truncate: true },
                                { label: 'Destination', value: consignment.unloadingPoint || '--', truncate: true },
                                { label: 'LR Weight', value: `${consignment.assignedQtyInTrip} MT`, color: 'text-emerald-400', bold: true },
                            ].map((item, i) => (
                                <div key={i} className="space-y-1 relative z-10">
                                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                                        {item.icon && <item.icon className="h-2.5 w-2.5" />} {item.label}
                                    </p>
                                    <p className={cn(
                                        "text-xs font-bold uppercase", 
                                        item.bold && "font-black text-[13px]", 
                                        item.mono && "font-mono tracking-tighter",
                                        item.color || "text-white",
                                        item.truncate && "truncate"
                                    )} title={item.value}>{item.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* 2. CENTRE SECTION (Shipment Tracking Details) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <Card className="lg:col-span-2 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                                <CardHeader className="bg-slate-50 border-b p-8">
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Mission Tracking Manifest</CardTitle>
                                </CardHeader>
                                <CardContent className="p-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-10">
                                            <div className="flex gap-6 items-start">
                                                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm"><MapPin className="h-6 w-6 text-blue-600" /></div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">From Location Registry</p>
                                                    <p className="text-sm font-black text-slate-900 uppercase leading-tight">{consignment.loadingPoint}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-2">
                                                        <Clock className="h-3 w-3" /> Assigned: {isValid(consignment.assignedAt) ? format(consignment.assignedAt, 'dd MMM yyyy p') : '--'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex gap-6 items-start">
                                                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm"><Navigation className="h-6 w-6 text-emerald-600" /></div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Current Status Node</p>
                                                    <Badge className={cn(
                                                        "font-black uppercase text-[10px] px-4 py-1 border-none shadow-md h-7",
                                                        consignment.currentStatusId?.toLowerCase() === 'delivered' ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                                                    )}>
                                                        {consignment.currentStatusId}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="flex gap-6 items-start">
                                                <div className="p-3 bg-red-50 rounded-2xl border border-red-100 shadow-sm"><CircleDot className="h-6 w-6 text-red-600" /></div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Final Destination Drop</p>
                                                    <p className="text-sm font-black text-slate-900 uppercase leading-tight">{consignment.unloadingPoint}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-10">
                                            <div className="p-8 bg-slate-900 text-white rounded-[2rem] shadow-2xl relative overflow-hidden group/loc">
                                                <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12 transition-transform duration-700 group-hover/loc:scale-110"><Radar className="h-24 w-24" /></div>
                                                <div className="text-[9px] font-black uppercase text-blue-400 tracking-widest mb-3 flex items-center gap-2">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    Current Location Registry
                                                </div>
                                                <p className="text-sm font-black uppercase leading-relaxed relative z-10">
                                                    {livePos?.location || 'Handshaking Satellite Registry...'}
                                                </p>
                                                {livePos && (
                                                    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                                                        <div className="text-left">
                                                            <p className="text-[8px] font-black uppercase text-slate-500">Telemetry Pulse</p>
                                                            <p className="text-[10px] font-bold text-blue-300 font-mono">{livePos.lastUpdate || 'LIVE'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[8px] font-black uppercase text-slate-500">Speed node</p>
                                                            <p className="text-[10px] font-black text-emerald-400">{livePos.speed} KM/H</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-8 bg-blue-50 rounded-[2rem] border-2 border-blue-100 flex flex-col justify-center items-center text-center shadow-inner">
                                                <Calendar className="h-10 w-10 text-blue-600 mb-4" />
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Expected Delivery Node</p>
                                                <p className="text-2xl font-black text-blue-900 tracking-tighter">
                                                    {eta ? format(eta, 'dd MMM yyyy') : '--'}
                                                </p>
                                                <p className="text-[9px] font-bold text-blue-400 uppercase mt-2 italic">Based on velocity Registry Logic</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
                                <CardHeader className="bg-slate-50 border-b p-8">
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Fleet Authorization</CardTitle>
                                </CardHeader>
                                <CardContent className="p-10 flex-1 flex flex-col justify-center items-center gap-8">
                                    <div className={cn(
                                        "p-10 rounded-full border-4 transition-all duration-500",
                                        isGpsEnabled ? "bg-emerald-50 border-emerald-100 text-emerald-600 shadow-emerald-100 shadow-2xl" : "bg-slate-50 border-slate-100 text-slate-300"
                                    )}>
                                        <Smartphone className="h-20 w-20" />
                                    </div>
                                    
                                    <div className="text-center space-y-2">
                                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                                            {isGpsEnabled ? 'Satellite Registry Linked' : 'GPS Node Not Linked'}
                                        </h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed max-w-[200px]">
                                            {isGpsEnabled ? 'Telemetry signal detected for this vehicle node.' : 'This vehicle number is not registered or signal is inactive.'}
                                        </p>
                                    </div>

                                    <div className="flex flex-col w-full gap-3">
                                        <Button 
                                            onClick={() => setIsMapModalOpen(true)}
                                            disabled={!isGpsEnabled}
                                            className={cn(
                                                "w-full h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 border-none",
                                                isGpsEnabled ? "bg-blue-900 hover:bg-slate-900 text-white shadow-blue-100" : "bg-slate-100 text-slate-300 opacity-50"
                                            )}
                                        >
                                            Track Consignment Mission
                                            <ChevronRight className="ml-2 h-4 w-4" />
                                        </Button>
                                        <Button 
                                            variant="outline"
                                            onClick={() => refreshTelemetry(consignment.vehicleNumber)}
                                            disabled={isSearching}
                                            className="w-full h-10 rounded-xl font-black uppercase text-[9px] tracking-widest border-slate-200 gap-2"
                                        >
                                            <RefreshCcw className={cn("h-3 w-3", isSearching && "animate-spin")} />
                                            Force Registry Sync
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>

            {/* LIVE TRACKING POPUP MODAL */}
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

function TrackingPopup({ isOpen, onClose, consignment, livePos, onEtaResolved }: { 
    isOpen: boolean; 
    onClose: () => void; 
    consignment: any; 
    livePos: any;
    onEtaResolved: (date: Date) => void;
}) {
    const firestore = useFirestore();
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: MAPS_JS_KEY,
        libraries: ['places']
    });

    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [customIcon, setCustomIcon] = useState<string>(DEFAULT_TRUCK_ICON);

    // Registry Handshake: Fetch Custom Asset Icon from Firestore
    useEffect(() => {
        if (!firestore) return;
        const fetchSettings = async () => {
            const snap = await getDoc(doc(firestore, "gps_settings", "wheelseye"));
            if (snap.exists() && snap.data().iconUrl) {
                setCustomIcon(snap.data().iconUrl);
            }
        };
        fetchSettings();
    }, [firestore]);

    // Registry Node: Fixed Dispatch Point from actual plant coordinates
    const dispatchCoord = useMemo(() => ({
        lat: consignment.plantLat || 28.6139,
        lng: consignment.plantLng || 77.2090
    }), [consignment.plantLat, consignment.plantLng]);

    const origin = livePos ? { lat: livePos.lat, lng: livePos.lng } : dispatchCoord;
    const destination = consignment.unloadingPoint || "";

    const onMapLoad = useCallback((map: google.maps.Map) => {
        if (!window.google || !destination) return;

        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
            {
                origin: origin,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === "OK" && result) {
                    setDirections(result);
                    const durationSeconds = result.routes[0].legs[0].duration?.value || 0;
                    onEtaResolved(addSeconds(new Date(), durationSeconds));
                }
            }
        );
    }, [origin, destination, onEtaResolved]);

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
                            center={origin}
                            zoom={12}
                            onLoad={onMapLoad}
                            options={{
                                disableDefaultUI: false,
                                zoomControl: true,
                                styles: [
                                    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                                    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                                    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                                    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                                ]
                            }}
                        >
                            {/* Corrected Dispatch Marker: Anchored to actual Plant Registry Coordinates */}
                            <Marker 
                                position={dispatchCoord} 
                                label={{ text: "Dispatch", color: "white", fontWeight: "900" }}
                                icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                            />
                            
                            <Marker 
                                position={origin} 
                                icon={{
                                    url: customIcon, 
                                    scaledSize: new google.maps.Size(45, 45),
                                    anchor: new google.maps.Point(22, 22),
                                }}
                                title={`${consignment.vehicleNumber} | ${livePos?.speed || 0} KM/H`}
                            />

                            {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
                        </GoogleMap>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white opacity-40">
                            <Loader2 className="h-10 w-10 animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em]">Establishing satellite handshake...</p>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-950/80 border-t border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Speed node</span>
                            <span className="text-lg font-black text-emerald-400 font-mono">{livePos?.speed || 0} KM/H</span>
                        </div>
                        <Separator orientation="vertical" className="h-8 bg-white/10" />
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Last registry pulse</span>
                            <span className="text-lg font-black text-blue-400 font-mono">{livePos?.lastUpdate || 'LIVE'}</span>
                        </div>
                    </div>
                    <div className="text-[9px] font-black uppercase text-slate-600 tracking-[0.3em] flex items-center gap-2">
                        <ShieldCheck className="h-3 w-3" /> Authorized Satellite handshake active
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function TrackConsignmentPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-blue-900" /></div>}>
            <TrackConsignmentContent />
        </Suspense>
    );
}
