
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Radar, 
    X, 
    ShieldCheck, 
    MapPin, 
    Loader2, 
    Navigation, 
    Truck,
    Factory,
    User,
    Activity,
    RefreshCcw
} from 'lucide-react';
import { cn, normalizePlantId } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import dynamic from 'next/dynamic';
import { fetchWheelseyeLocation } from '@/app/actions/wheelseye';
import { ScrollArea } from '@/components/ui/scroll-area';

const TrackingMap = dynamic(() => import('@/components/dashboard/shipment-tracking/TrackingMap'), { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-100 animate-pulse rounded-3xl" />
});

interface TripTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
}

/**
 * @fileOverview Trip Tracking Modal Terminal.
 * Synchronized with Server-side GIS Handshake node.
 * Updated: Renders mission route with descriptive Lifting/Drop node labels.
 */
export default function TripTrackingModal({ isOpen, onClose, trip }: TripTrackingModalProps) {
    const firestore = useFirestore();
    const [livePos, setLivePos] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [originData, setOriginData] = useState<{ lat?: number; lng?: number; name: string } | null>(null);

    const refreshTelemetry = useCallback(async () => {
        if (!trip?.vehicleNumber) return;
        try {
            const res = await fetchWheelseyeLocation(trip.vehicleNumber);
            if (res.data) {
                setLivePos(res.data);
            }
        } catch (e) {
            console.warn("Telemetry pulse delayed.");
        } finally {
            setIsLoading(false);
        }
    }, [trip?.vehicleNumber]);

    useEffect(() => {
        if (!isOpen || !firestore || !trip) return;

        const fetchMeta = async () => {
            setIsLoading(true);
            try {
                // Registry Handshake: Resolve origin plant context
                const plantId = normalizePlantId(trip.originPlantId);
                const plantRef = doc(firestore, "logistics_plants", plantId);
                const plantSnap = await getDoc(plantRef);
                
                if (plantSnap.exists()) {
                    const pData = plantSnap.data();
                    setOriginData({
                        lat: pData.latitude || 28.6139,
                        lng: pData.longitude || 77.2090,
                        name: pData.name
                    });
                }
                
                await refreshTelemetry();
            } catch (e) {
                console.error("Registry meta fetch error:", e);
                setIsLoading(false);
            }
        };

        fetchMeta();
        const interval = setInterval(refreshTelemetry, 30000);
        return () => clearInterval(interval);
    }, [isOpen, trip, firestore, refreshTelemetry]);

    // Resolve specific names for labels
    const originLabel = useMemo(() => originData?.name || trip.plantName || 'Lifting Node', [originData, trip]);
    const destinationLabel = useMemo(() => trip.shipToParty || trip.unloadingPoint || 'Drop Node', [trip]);

    // Resolve specific addresses for the route routing protocol
    const originLocation = useMemo(() => trip.consignorAddress || trip.loadingPoint || originData?.name || 'Lifting Node', [trip, originData]);
    const destinationLocation = useMemo(() => trip.deliveryAddress || trip.unloadingPoint || trip.destination || 'Drop Node', [trip]);

    if (!trip) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 border-none shadow-3xl overflow-hidden bg-[#f8fafc] rounded-[3rem] flex flex-col">
                <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 flex flex-row items-center justify-between space-y-0 pr-12">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg rotate-3"><Radar className="h-6 w-6 text-white" /></div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight italic text-white leading-none">MISSION TELEMETRY HANDSHAKE</DialogTitle>
                            <DialogDescription className="text-blue-400 font-bold uppercase text-[9px] tracking-widest mt-2">Vehicle: {trip.vehicleNumber} | Registry ID: {trip.tripId}</DialogDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Badge variant="outline" className="bg-white/5 border-white/10 text-emerald-400 font-black uppercase text-[10px] px-4 h-8 border-none">Live Handshake Active</Badge>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"><X className="h-6 w-6" /></Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    {/* GIS MONITOR */}
                    <div className="flex-1 relative bg-slate-200">
                        {isLoading && !livePos ? (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-slate-100/80 backdrop-blur-sm">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Mission Registry...</p>
                            </div>
                        ) : (
                            <TrackingMap 
                                livePos={livePos}
                                origin={originLocation}
                                destination={destinationLocation}
                                originLabel={originLabel}
                                destinationLabel={destinationLabel}
                                height="100%"
                            />
                        )}
                    </div>

                    {/* TELEMETRY DATA NODE */}
                    <aside className="w-full lg:w-96 bg-white border-l border-slate-100 flex flex-col shrink-0 shadow-2xl">
                        <div className="p-8 bg-slate-50 border-b">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-blue-600" /> Satellite Registry Node
                            </h3>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-8 space-y-8">
                                {[
                                    { label: 'Pilot Node', value: trip.driverName, icon: User },
                                    { label: 'Dispatch Point', value: originData?.name || trip.plantName, icon: Factory },
                                    { label: 'Current location', value: livePos?.location || (isLoading ? 'Resolving...' : 'Signal searching...'), icon: MapPin, color: livePos ? 'text-blue-600 font-black' : 'text-slate-400' },
                                    { label: 'Drop node', value: trip.shipToParty || trip.unloadingPoint, icon: MapPin, bold: true },
                                    { label: 'Mission speed', value: `${livePos?.speed || 0} KM/H`, icon: Navigation, color: 'text-emerald-600 font-black' },
                                    { label: 'Registry status', value: trip.tripStatus, icon: ShieldCheck, badge: true }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-4 group">
                                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                                            <item.icon className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase text-slate-400 leading-none">{item.label}</p>
                                            {item.badge ? (
                                                <Badge className="bg-blue-900 text-white font-black uppercase text-[9px] mt-1 border-none shadow-md">{item.value}</Badge>
                                            ) : (
                                                <p className={cn("text-xs uppercase leading-tight", item.bold ? "font-black text-slate-900" : "font-bold text-slate-700", item.color)}>{item.value || '--'}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <div className="p-8 bg-slate-50 border-t">
                            <Button variant="outline" className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2" onClick={refreshTelemetry} disabled={isLoading}>
                                <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} /> Force Registry Sync
                            </Button>
                        </div>
                    </aside>
                </div>
            </DialogContent>
        </Dialog>
    );
}
