'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, WifiOff, Search, Navigation as NavigationIcon, ShieldCheck, Radar, Factory, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Trip, Shipment, Plant, SubUser, Vehicle } from '@/types';
import TrackingDetails from '@/components/dashboard/shipment-tracking/TrackingDetails';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, getDocs, doc, getDoc, where, limit, onSnapshot } from "firebase/firestore";
import { cn, normalizePlantId } from '@/lib/utils';
import { fetchWheelseyeLocation } from '@/app/actions/wheelseye';

const TrackingMap = dynamic(() => import('@/components/dashboard/shipment-tracking/TrackingMap'), { 
    ssr: false,
    loading: () => <div className="w-full h-[500px] bg-slate-100 animate-pulse rounded-[3rem] border-4 border-white shadow-xl" />
});

export type EnrichedTrip = WithId<Trip> & {
    shipment: WithId<Shipment>;
    plant: WithId<Plant>;
    liveLocation?: any;
};

function ShipmentTrackingContent() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTrips, setActiveTrips] = useState<EnrichedTrip[]>([]);
    const [gpsEnabledVehicles, setGpsEnabledVehicles] = useState<string[]>([]);
    const [selectedTrip, setSelectedTrip] = useState<EnrichedTrip | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTrackingLoading, setIsTrackingLoading] = useState(false);

    // 1. Fetch GPS Master Registry
    useEffect(() => {
        if (!firestore) return;
        const unsub = onSnapshot(collection(firestore, "vehicles"), (snap) => {
            const enabled = snap.docs
                .filter(d => d.data().gps_enabled === true)
                .map(d => d.data().vehicleNumber);
            setGpsEnabledVehicles(enabled);
        });
        return () => unsub();
    }, [firestore]);

    // 2. Fetch Active Missions
    useEffect(() => {
        if (!firestore) return;
        setIsLoading(true);
        
        const unsub = onSnapshot(collection(firestore, "trips"), async (snap) => {
            const trips = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as WithId<Trip>))
                .filter(t => !['delivered', 'closed', 'cancelled'].includes(t.currentStatusId?.toLowerCase()));
            
            const enriched = await Promise.all(trips.map(async t => {
                try {
                    const shipRef = doc(firestore, `plants/${t.originPlantId}/shipments`, t.shipmentIds[0]);
                    const shipSnap = await getDoc(shipRef);
                    const plantSnap = await getDoc(doc(firestore, "logistics_plants", t.originPlantId));
                    
                    return {
                        ...t,
                        shipment: shipSnap.exists() ? { id: shipSnap.id, ...shipSnap.data() } : null,
                        plant: plantSnap.exists() ? { id: plantSnap.id, ...plantSnap.data() } : { name: t.originPlantId }
                    } as EnrichedTrip;
                } catch (e) {
                    return null;
                }
            }));

            setActiveTrips(enriched.filter(t => t !== null && t.shipment) as EnrichedTrip[]);
            setIsLoading(false);
        });

        return () => unsub();
    }, [firestore]);

    const handleInitializeTracking = async (trip: EnrichedTrip) => {
        const isGpsEnabled = gpsEnabledVehicles.includes(trip.vehicleNumber || '');
        if (!isGpsEnabled) {
            toast({ variant: "destructive", title: "No GPS Link", description: "This vehicle is not configured for GPS tracking." });
            setSelectedTrip({ ...trip, liveLocation: null }); // Ensure UI updates to offline state
            return;
        }

        setIsTrackingLoading(true);
        try {
            const response = await fetchWheelseyeLocation(trip.vehicleNumber || '');
            if (response.data) {
                setSelectedTrip({ ...trip, liveLocation: response.data });
                toast({ title: "Telemetry established", description: `GIS Handshake successful for ${trip.vehicleNumber}` });
            } else {
                setSelectedTrip({ ...trip, liveLocation: null }); // Explicitly set to null for offline state
                toast({ variant: 'destructive', title: "Signal Lost", description: response.error || "Registry terminal offline." });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: "API Failure", description: e.message || "Wheelseye gateway unreachable." });
        } finally {
            setIsTrackingLoading(false);
        }
    };

    // 3. Auto-Refresh Telemetry Node
    useEffect(() => {
        if (!selectedTrip || !selectedTrip.liveLocation) return;
        const interval = setInterval(() => {
            handleInitializeTracking(selectedTrip);
        }, 30000);
        return () => clearInterval(interval);
    }, [selectedTrip?.id, selectedTrip?.liveLocation]);

    const filteredTrips = activeTrips.filter(t => 
        t.tripId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.plant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.shipment.unloadingPoint?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
            <div className="sticky top-0 z-30 bg-white border-b px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                        <Radar className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-blue-900 tracking-tight uppercase italic">GIS Telemetry Node</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Wheelseye Handshake & Live Monitor</p>
                    </div>
                </div>
                
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input 
                        placeholder="Search Trip ID, Vehicle No, Location..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 w-[320px] rounded-xl bg-slate-50 border-slate-200 font-bold"
                    />
                </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto space-y-10">
                {selectedTrip ? (
                    <div className="space-y-6">
                        <Button onClick={() => setSelectedTrip(null)} variant="ghost" className="gap-2 font-black uppercase text-[10px] tracking-widest">
                            <Radar className="h-4 w-4" /> Return to Mission Registry
                        </Button>
                        <TrackingDetails trip={selectedTrip} MapComponent={TrackingMap} />
                    </div>
                ) : (
                    <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                        <CardHeader className="bg-slate-50 border-b p-8">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Active Mission Registry</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Select an asset node to initialize GIS tracking</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="flex h-64 flex-col items-center justify-center gap-4">
                                    <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Scanning Registry...</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow className="h-12 border-b border-slate-100 hover:bg-transparent text-[10px] font-black uppercase text-slate-400">
                                            <TableHead className="px-8">Plant</TableHead>
                                            <TableHead className="px-4">Trip ID</TableHead>
                                            <TableHead className="px-4">Vehicle No.</TableHead>
                                            <TableHead className="px-4">FROM</TableHead>
                                            <TableHead className="px-4">Destination</TableHead>
                                            <TableHead className="px-8 text-right">GIS Telemetry</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTrips.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400 italic">No trackable missions in registry scope.</TableCell></TableRow>
                                        ) : (
                                            filteredTrips.map(trip => {
                                                const isGpsEnabled = gpsEnabledVehicles.includes(trip.vehicleNumber || '');
                                                return (
                                                    <TableRow key={trip.id} className="h-16 border-b border-slate-50 hover:bg-blue-50/20 transition-all group">
                                                        <TableCell className="px-8 font-black text-slate-600 uppercase text-xs">{trip.plant.name || trip.originPlantId}</TableCell>
                                                        <TableCell className="px-4 font-mono font-black text-blue-700">{trip.tripId}</TableCell>
                                                        <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{trip.vehicleNumber}</TableCell>
                                                        <TableCell className="px-4 font-bold text-slate-500 uppercase text-[11px] truncate max-w-[150px]">{trip.shipment.loadingPoint}</TableCell>
                                                        <TableCell className="px-4 font-bold text-slate-800 uppercase text-[11px] truncate max-w-[150px]">{trip.shipment.unloadingPoint}</TableCell>
                                                        <TableCell className="px-8 text-right">
                                                            <Button 
                                                                onClick={() => handleInitializeTracking(trip)}
                                                                disabled={isTrackingLoading && selectedTrip?.id === trip.id}
                                                                className={cn(
                                                                    "h-9 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all",
                                                                    isGpsEnabled ? "bg-blue-900 hover:bg-black text-white" : "bg-slate-200 text-slate-500 cursor-not-allowed"
                                                                )}
                                                            >
                                                                {(isTrackingLoading && selectedTrip?.id === trip.id) ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Radar className="h-3 w-3 mr-2" />}
                                                                {isGpsEnabled ? 'Track Mission' : 'No GPS Link'}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}

export default function ShipmentTrackingPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <ShipmentTrackingContent />
        </Suspense>
    );
}