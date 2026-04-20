
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Radar, ShieldCheck, MapPin, Truck, Factory } from 'lucide-react';
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp } from "firebase/firestore";
import VehicleMap from '@/components/dashboard/shipment-tracking/VehicleMap';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fetchWheelseyeLocation } from '@/app/actions/wheelseye';
import { useToast } from '@/hooks/use-toast';

/**
 * @fileOverview Trip Tracking Client Handbook.
 * Handles the live GIS telemetry handshake and monitoring UI.
 * Updated: Implements live GPS refresh loop for "Original Location" precision.
 */

export function TripTrackingClient({ tripId }: { tripId: string }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [trip, setTrip] = useState<any>(null);
  const [livePos, setLivePos] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLiveTelemetry = useCallback(async (vNo: string) => {
    if (!vNo) return;
    setRefreshing(true);
    try {
        const response = await fetchWheelseyeLocation(vNo);
        if (response.data) {
            setLivePos(response.data);
        }
    } catch (e) {
        console.warn("Telemetry pulse delayed.");
    } finally {
        setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!firestore || !tripId || tripId === 'default') {
        if (tripId === 'default') setLoading(false);
        return;
    }

    const fetchTrip = async () => {
        try {
            // Find trip across all plant nodes
            const q = query(collection(firestore, "trips"), where("tripId", "==", tripId), limit(1));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                const tripData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
                
                // Registry Handshake: Fetch plant coordinates for correct Dispatch Point
                const plantRef = doc(firestore, "logistics_plants", tripData.originPlantId);
                const plantSnap = await getDoc(plantRef);
                if (plantSnap.exists()) {
                    const pData = plantSnap.data();
                    tripData.plantLat = pData.latitude || 28.6139;
                    tripData.plantLng = pData.longitude || 77.2090;
                    tripData.plantNameResolved = pData.name;
                }
                
                setTrip(tripData);
                // Initial Telemetry Pulse
                fetchLiveTelemetry(tripData.vehicleNumber);
            }
        } catch (e) {
            console.error("Registry error");
        } finally {
            setLoading(false);
        }
    };
    fetchTrip();
  }, [tripId, firestore, fetchLiveTelemetry]);

  // Auto-refresh Registry Node
  useEffect(() => {
    if (!trip?.vehicleNumber) return;
    const interval = setInterval(() => {
        fetchLiveTelemetry(trip.vehicleNumber);
    }, 30000);
    return () => clearInterval(interval);
  }, [trip?.vehicleNumber, fetchLiveTelemetry]);

  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#f8fafc]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Mission Registry...</p>
            </div>
        </div>
    );
  }

  if (!trip || tripId === 'default') {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-6">
            <Radar className="h-16 w-16 text-slate-200" />
            <h2 className="text-xl font-black uppercase text-slate-400">Mission Node Not Found</h2>
            <Button onClick={() => router.back()} variant="outline" className="rounded-xl px-8 h-11 uppercase font-black text-[10px]">Return to Board</Button>
        </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
        <div className="sticky top-0 z-30 bg-white border-b px-8 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <Button onClick={() => router.back()} variant="ghost" size="icon" className="h-10 w-10 rounded-xl"><ArrowLeft className="h-5 w-5 text-slate-400" /></Button>
                <div>
                    <h1 className="text-2xl font-black text-blue-900 tracking-tight uppercase italic">GIS Telemetry Monitor</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Wheelseye Handbook Node: {trip.tripId}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Badge variant="outline" className={cn(
                    "font-black uppercase text-[10px] h-8 px-4 flex gap-2 border-none",
                    livePos ? "bg-emerald-50 text-emerald-700 shadow-sm" : "bg-red-50 text-red-600"
                )}>
                    {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    {livePos ? "Live Handshake Active" : "Searching Signal..."}
                </Badge>
            </div>
        </div>

        <div className="flex-1 p-8 space-y-8 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* MAP AREA */}
                <Card className="lg:col-span-8 border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
                    <CardContent className="p-0">
                        <VehicleMap 
                            vehicleNo={trip.vehicleNumber} 
                            livePos={livePos}
                            origin={{ 
                                lat: trip.plantLat || 28.6139, 
                                lng: trip.plantLng || 77.2090, 
                                name: trip.plantNameResolved || "Lifting Node" 
                            }}
                            destination={trip.unloadingPoint}
                        />
                    </CardContent>
                </Card>

                {/* MISSION STATS */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                        <CardHeader className="bg-slate-50 border-b p-6">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700">Mission Context</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            {[
                                { label: 'Vehicle Registry', value: trip.vehicleNumber, icon: Truck, bold: true },
                                { label: 'Pilot Name', value: trip.driverName, icon: User },
                                { label: 'Current location', value: livePos?.location || "Resolving Satellite...", icon: MapPin, color: "text-blue-600 animate-pulse" },
                                { label: 'Dispatch point', value: trip.plantNameResolved || trip.originPlantId, icon: Factory },
                                { label: 'Delivery point', value: trip.unloadingPoint, icon: MapPin },
                                { label: 'Assigned Status', value: trip.currentStatusId, icon: ShieldCheck, badge: true }
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-4 group">
                                    <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                                        <item.icon className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black uppercase text-slate-400 leading-none">{item.label}</p>
                                        {item.badge ? (
                                            <Badge className="bg-blue-900 text-white font-black uppercase text-[9px] mt-1 shadow-md border-none">{item.value}</Badge>
                                        ) : (
                                            <p className={cn("text-xs uppercase leading-tight", item.bold ? "font-black text-slate-900" : "font-bold text-slate-600", item.color)}>{item.value || '--'}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    </main>
  );
}
