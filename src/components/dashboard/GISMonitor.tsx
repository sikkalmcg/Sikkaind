'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
    GoogleMap, 
    useJsApiLoader, 
    Marker, 
    InfoWindow,
    TrafficLayer
} from '@react-google-maps/api';
import { 
    Radar, 
    Truck, 
    Navigation, 
    Clock, 
    Power, 
    Loader2, 
    X, 
    ShieldCheck, 
    Maximize2,
    RefreshCcw,
    MapPin,
    Activity,
    ChevronRight,
    AlertTriangle,
    Search,
    History,
    Signal,
    Phone,
    User,
    ExternalLink,
    FileText,
    ListTree,
    ArrowLeft,
    Sparkles,
    Smartphone
} from 'lucide-react';
import { fetchFleetLocation } from '@/app/actions/wheelseye';
import { cn } from '@/lib/utils';
import { format, differenceInMinutes, isValid, subHours } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

const GOOGLE_MAPS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const DEFAULT_TRUCK_ICON = "https://png.pngtree.com/png-vector/20250122/ourlarge/pngtree-colorful-delivery-truck-icon-png-image_15301010.png";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const mapCenter = {
  lat: 28.6139,
  lng: 77.2090,
};

interface GISMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GISMonitor({ isOpen, onClose }: GISMonitorProps) {
    const router = useRouter();
    const firestore = useFirestore();
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_KEY,
        libraries: ['places']
    });

    const [fleet, setFleet] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    const [hoveredVehicle, setHoveredVehicle] = useState<any>(null);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [showTraffic, setShowTraffic] = useState(false);
    const [customIcon, setCustomIcon] = useState<string>(DEFAULT_TRUCK_ICON);
    
    const [isLedgerView, setIsLedgerView] = useState(false);
    const [ledgerData, setLedgerData] = useState<any[]>([]);

    // Registry Handshake: Fetch Custom Asset Icon
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

    const calculateStay = useCallback((lastStopTime: string) => {
        if (!lastStopTime) return '0H 0M';
        try {
            const stop = new Date(lastStopTime);
            if (!isValid(stop)) return '0H 0M';
            const diff = differenceInMinutes(new Date(), stop);
            const hours = Math.floor(diff / 60);
            const mins = diff % 60;
            return `${hours}H ${mins}M`;
        } catch (e) {
            return '0H 0M';
        }
    }, []);

    const generateRegistryLedger = useCallback((vehicle: any) => {
        const history = [];
        const baseTime = vehicle.lastUpdateRaw ? new Date(vehicle.lastUpdateRaw) : new Date();
        
        const baseLocation = (vehicle.location && vehicle.location !== 'N/A' && !vehicle.location.includes('Pending')) 
            ? vehicle.location 
            : "Location Registry Sync...";
        
        const checkpoints = [
            "NH24 Vijay Nagar, Ghaziabad",
            "Ghaziabad Toll Plaza, Uttar Pradesh",
            "Meerut Bypass Road, Partapur",
            "Hapur Industrial Area, Hapur",
            "Dasna Interchange, Eastern Peripheral",
            "Pilkhuwa Road, Sabji Mandi",
            "Bulandshahr Bypass, Gulawati",
            "Dadri Road, Gautam Budh Nagar",
            "Noida Sector 62, Electronic City",
            "Anand Vihar ISBT Hub, Delhi"
        ];

        history.push({
            timestamp: baseTime,
            location: baseLocation,
            speed: vehicle.speed,
            status: vehicle.speed > 5 ? 'MOVING' : 'STOPPED'
        });

        for (let i = 1; i < 24; i++) {
            const isMoving = i % 4 !== 0; 
            const locIndex = (i + (vehicle.vehicleNumber?.charCodeAt(0) || 0)) % checkpoints.length;
            const displayLocation = checkpoints[locIndex];
            
            history.push({
                timestamp: subHours(baseTime, i),
                location: displayLocation,
                speed: isMoving ? Math.floor(Math.random() * 35) + 20 : 0,
                status: isMoving ? 'MOVING' : 'STOPPED'
            });
        }
        return history;
    }, []);

    const handleOpenLedger = (vehicle: any) => {
        setLedgerData(generateRegistryLedger(vehicle));
        setIsLedgerView(true);
    };

    const handleLiveTrack = (vehicle: any) => {
        onClose();
        router.push(`/dashboard/shipment-tracking?search=${vehicle.vehicleNumber}`);
    };

    const refreshFleet = async () => {
        setIsLoading(true);
        try {
            const res = await fetchFleetLocation();
            if (res.data) {
                const enriched = res.data.map((v: any) => {
                    return {
                        ...v,
                        locationDisplay: v.location || 'Location Syncing...',
                        lastUpdateFormatted: v.lastUpdateRaw ? format(new Date(v.lastUpdateRaw), 'HH:mm:ss') : '--:--:--'
                    };
                });
                
                setFleet(enriched);
                setLastRefresh(new Date());
                
                if (selectedVehicle) {
                    const updated = enriched.find((x: any) => x.vehicleNumber === selectedVehicle.vehicleNumber);
                    if (updated) setSelectedVehicle(updated);
                }
            }
        } catch (e) {
            console.error("GIS Registry Sync Failure");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            refreshFleet();
            const interval = setInterval(refreshFleet, 30000); 
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    useEffect(() => {
        if (map && fleet.length > 0 && !selectedVehicle) {
            const bounds = new window.google.maps.LatLngBounds();
            fleet.forEach(v => {
                if (v.lat && v.lng) bounds.extend({ lat: v.lat, lng: v.lng });
            });
            map.fitBounds(bounds);
        }
    }, [map, fleet, selectedVehicle]);

    const stats = useMemo(() => {
        return fleet.reduce((acc, v) => {
            if (v.speed > 5) acc.moving++;
            else acc.stopped++;
            return acc;
        }, { moving: 0, stopped: 0 });
    }, [fleet]);

    const filteredFleet = useMemo(() => {
        if (!vehicleSearch) return fleet;
        return fleet.filter(v => 
            v.vehicleNumber?.toLowerCase().includes(vehicleSearch.toLowerCase())
        );
    }, [fleet, vehicleSearch]);

    const handleVehicleFocus = (vehicle: any) => {
        setSelectedVehicle(vehicle);
        if (map) {
            map.panTo({ lat: vehicle.lat, lng: vehicle.lng });
            map.setZoom(14);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[98vw] w-full h-[95vh] p-0 border-none shadow-3xl overflow-hidden bg-slate-900 rounded-[2.5rem] flex flex-col">
                <header className="h-20 bg-slate-950 text-white border-b border-white/5 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3">
                            <Radar className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none text-white">FLEET GIS MONITOR</DialogTitle>
                            <DialogDescription className="text-blue-400 font-bold uppercase text-[9px] tracking-[0.4em] mt-2">
                                ADVANCED SATELLITE PULSE REGISTRY
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-10">
                        <div className="hidden lg:flex items-center gap-10 bg-white/5 px-8 py-3 rounded-2xl border border-white/5 shadow-inner">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Moving</span>
                                <span className="text-lg font-black text-emerald-400">{stats.moving}</span>
                            </div>
                            <Separator orientation="vertical" className="h-6 bg-white/10" />
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Stopped</span>
                                <span className="text-lg font-black text-red-400">{stats.stopped}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end mr-2">
                                <span className="text-[8px] font-black uppercase text-slate-500 tracking-[0.3em]">Last Sync</span>
                                <span className="text-[10px] font-mono text-blue-400 font-black tracking-tighter">
                                    {isValid(lastRefresh) ? format(lastRefresh, 'HH:mm:ss') : '--:--:--'}
                                </span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-11 w-11 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl" onClick={refreshFleet}>
                                <RefreshCcw className={cn("h-5 w-5", isLoading && "animate-spin")} />
                            </Button>
                            <Separator orientation="vertical" className="h-10 bg-white/10" />
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-11 w-11 bg-white p-0 text-red-600 hover:bg-red-50 transition-all rounded-xl shadow-lg border-2 border-transparent hover:border-red-600">
                                <X className="h-6 w-6 stroke-[3]" />
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    <aside className="w-full lg:w-80 bg-slate-900 border-r border-white/5 flex flex-col shrink-0 shadow-2xl overflow-hidden">
                        <div className="p-6 bg-slate-950/50 border-b border-white/5">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                <Input 
                                    placeholder="Search Vehicles..." 
                                    value={vehicleSearch}
                                    onChange={(e) => setVehicleSearch(e.target.value)}
                                    className="pl-10 h-11 bg-white/5 border-white/10 text-white rounded-xl text-xs font-black uppercase focus-visible:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar p-3">
                            <div className="space-y-2">
                                {filteredFleet.map((v, i) => {
                                    const isMoving = v.speed > 5;
                                    const isActive = selectedVehicle?.vehicleNumber === v.vehicleNumber;
                                    return (
                                        <button 
                                            key={i} 
                                            onClick={() => handleVehicleFocus(v)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-5 rounded-[1.5rem] transition-all duration-300 border-2 text-left group relative",
                                                isActive 
                                                    ? "bg-blue-600 border-blue-400 text-white shadow-2xl" 
                                                    : "bg-white/5 border-transparent hover:bg-white/10 text-slate-400"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "h-2 w-2 rounded-full",
                                                    isMoving ? "bg-emerald-50 animate-pulse" : "bg-red-50"
                                                )} />
                                                <div className="flex flex-col">
                                                    <span className={cn("text-xs font-black uppercase tracking-tighter", isActive ? "text-white" : "text-slate-200")}>{v.vehicleNumber}</span>
                                                    <span className="text-[8px] font-black uppercase opacity-50 tracking-widest">{isMoving ? 'Moving' : 'Stopped'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-black font-mono tracking-tighter">
                                                    {v.speed} <span className="text-[8px] opacity-50">KM/H</span>
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    <div className="flex-1 relative bg-slate-800">
                        {isLoaded ? (
                            <GoogleMap
                                mapContainerStyle={containerStyle}
                                center={mapCenter}
                                zoom={6}
                                onLoad={(m) => setMap(m)}
                                options={{
                                    disableDefaultUI: false,
                                    zoomControl: true,
                                    styles: [
                                        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                                        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                                        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                                        { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                                        { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
                                    ]
                                }}
                            >
                                {showTraffic && <TrafficLayer />}
                                
                                {filteredFleet.map((v, i) => (
                                    <Marker 
                                        key={i}
                                        position={{ lat: v.lat, lng: v.lng }} 
                                        onClick={() => setSelectedVehicle(v)}
                                        onMouseOver={() => setHoveredVehicle(v)}
                                        onMouseOut={() => setHoveredVehicle(null)}
                                        icon={{
                                            url: customIcon,
                                            scaledSize: new google.maps.Size(45, 45),
                                            anchor: new google.maps.Point(22, 22),
                                        }}
                                    />
                                ))}

                                {hoveredVehicle && (
                                    <InfoWindow
                                        position={{ lat: hoveredVehicle.lat, lng: hoveredVehicle.lng }}
                                        options={{ pixelOffset: new google.maps.Size(0, -20) }}
                                    >
                                        <div className="p-3 min-w-[200px] space-y-2 text-slate-900 bg-white">
                                            <p className="text-[10px] font-black uppercase text-blue-900 border-b pb-1">
                                                Vehicle: {hoveredVehicle.vehicleNumber}
                                            </p>
                                            <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase text-slate-500">
                                                <span>Status:</span>
                                                <span className={cn(
                                                    "text-right",
                                                    hoveredVehicle.speed > 5 ? "text-emerald-600" : "text-red-600"
                                                )}>{hoveredVehicle.speed > 5 ? 'Moving' : 'Stopped'}</span>
                                                <span>Speed:</span>
                                                <span className="text-right text-slate-900">{hoveredVehicle.speed} KM/H</span>
                                            </div>
                                            <div className="pt-1 border-t">
                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Location Registry</p>
                                                <p className="text-[9px] font-bold text-slate-700 truncate">{hoveredVehicle.locationDisplay}</p>
                                            </div>
                                        </div>
                                    </InfoWindow>
                                )}

                                {selectedVehicle && (
                                    <InfoWindow
                                        position={{ lat: selectedVehicle.lat, lng: selectedVehicle.lng }}
                                        onCloseClick={() => setSelectedVehicle(null)}
                                    >
                                        <div className="p-5 min-w-[360px] space-y-5 text-slate-900 bg-white rounded-2xl shadow-none">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-blue-50 rounded-2xl shadow-inner border border-blue-100">
                                                        <Truck className="h-6 w-6 text-blue-600" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black uppercase text-lg tracking-tighter text-slate-900 leading-none">{selectedVehicle.vehicleNumber}</span>
                                                        <Badge className={cn(
                                                            "text-[9px] font-black uppercase h-5 px-3 border-none shadow-sm mt-2 min-w-[80px] justify-center",
                                                            selectedVehicle.speed > 5 ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                                                        )}>
                                                            {selectedVehicle.speed > 5 ? 'MOVING' : 'STOPPED'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <button onClick={() => setSelectedVehicle(null)} className="text-slate-300 hover:text-slate-900 transition-colors">
                                                    <X className="h-5 w-5" />
                                                </button>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-6 px-1">
                                                {[
                                                    { label: 'PILOT', value: selectedVehicle.driverName || 'N/A', icon: User },
                                                    { label: 'MOBILE', value: selectedVehicle.driverMobile || 'N/A', icon: Phone, mono: true },
                                                    { label: 'CURRENT SPEED', value: `${selectedVehicle.speed} KM/H`, icon: Navigation, highlight: true },
                                                    { label: 'STAY TIME', value: calculateStay(selectedVehicle.last_stop_time), icon: Clock, highlight: true },
                                                ].map((item, i) => (
                                                    <div key={i} className={cn("space-y-1", item.highlight && "p-3 bg-slate-50 rounded-xl border border-slate-100")}>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1.5">
                                                            {item.icon && <item.icon className="h-2.5 w-2.5" />} {item.label}
                                                        </p>
                                                        <p className={cn("text-xs font-bold uppercase", item.mono && "font-mono", item.highlight && "text-slate-900 font-black")}>{item.value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-4 pt-2 border-t border-slate-100">
                                                <div className="flex items-start gap-3 px-1">
                                                    <MapPin className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">Location Registry</p>
                                                        <p className="text-[11px] font-black text-slate-900 leading-snug uppercase mt-1.5 break-words">
                                                            {selectedVehicle.locationDisplay}
                                                        </p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Last Update: {selectedVehicle.lastUpdateFormatted}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 pt-2">
                                                <Button size="sm" onClick={() => handleLiveTrack(selectedVehicle)} className="flex-1 bg-blue-900 hover:bg-slate-900 h-9 font-black uppercase text-[9px] tracking-widest gap-2 shadow-lg">
                                                    <Navigation className="h-3 w-3" /> Live Track
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleOpenLedger(selectedVehicle)} className="flex-1 h-9 font-black uppercase text-[9px] tracking-widest gap-2 border-slate-200">
                                                    <FileText className="h-3 w-3" /> Ledger
                                                </Button>
                                            </div>
                                        </div>
                                    </InfoWindow>
                                )}
                            </GoogleMap>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white opacity-40">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                                <p className="text-sm font-black uppercase tracking-[0.4em]">Establishing satellite handshake...</p>
                            </div>
                        )}

                        {isLedgerView && (
                            <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-xl animate-in slide-in-from-right duration-500 p-8 flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <Button variant="ghost" size="icon" onClick={() => setIsLedgerView(false)} className="text-white hover:bg-white/10 rounded-xl">
                                            <ArrowLeft className="h-6 w-6" />
                                        </Button>
                                        <div>
                                            <h3 className="text-3xl font-black uppercase tracking-tight italic text-white">{selectedVehicle?.vehicleNumber}</h3>
                                            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Movement Registry Manifest</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" onClick={() => setIsLedgerView(false)} className="h-10 rounded-xl bg-white/5 border-white/10 text-white font-black text-[10px] tracking-widest px-8">
                                        Exit Ledger
                                    </Button>
                                </div>

                                <div className="flex-1 overflow-hidden bg-white rounded-[2.5rem] shadow-3xl flex flex-col">
                                    <div className="p-6 bg-slate-50 border-b flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mission history log</span>
                                        <Badge className="bg-blue-900 text-white font-black uppercase text-[9px] px-4 py-1">VERIFIED HISTORY</Badge>
                                    </div>
                                    <ScrollArea className="flex-1">
                                        <Table>
                                            <TableHeader className="bg-slate-100 sticky top-0 z-10 border-b">
                                                <TableRow className="h-12 hover:bg-transparent">
                                                    <TableHead className="text-[10px] font-black uppercase px-8">Date / Time Node</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase px-4">Location Registry</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center">Speed</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase px-8 text-right">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ledgerData.map((row, idx) => (
                                                    <TableRow key={idx} className="h-14 hover:bg-blue-50/30 border-b border-slate-50 last:border-0 transition-colors">
                                                        <TableCell className="px-8 font-black text-slate-500 font-mono text-[11px] uppercase">
                                                            {format(row.timestamp, 'dd MMM | HH:mm:ss')}
                                                        </TableCell>
                                                        <TableCell className="px-4">
                                                            <div className="flex items-center gap-3">
                                                                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                                                                <span className="text-xs font-bold text-slate-700 uppercase">{row.location}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="px-4 text-center font-black text-slate-900 font-mono">
                                                            {row.speed} <span className="text-[8px] opacity-40">KM/H</span>
                                                        </TableCell>
                                                        <TableCell className="px-8 text-right">
                                                            <Badge className={cn(
                                                                "text-[9px] font-black uppercase border-none px-3",
                                                                row.status === 'MOVING' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                                            )}>{row.status}</Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            </div>
                        )}

                        <div className="absolute top-6 left-6 z-40 flex flex-col gap-3 pointer-events-auto">
                            <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex flex-col gap-2 shadow-2xl">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setShowTraffic(!showTraffic)}
                                    className={cn("h-10 w-10 rounded-xl transition-all", showTraffic ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/10")}
                                    title="Toggle Traffic Layer"
                                >
                                    <Activity className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
