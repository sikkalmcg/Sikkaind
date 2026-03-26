'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WithId, Trip, Shipment, Plant } from '@/types';
import { 
    Truck, 
    MapPin, 
    CheckCircle, 
    Package, 
    ShieldCheck, 
    Activity,
    Clock,
    User,
    TrendingUp,
    WifiOff, // Changed from Wifi
    Radar,
    Phone,
    Factory,
    Power
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type EnrichedTrip = WithId<Trip> & {
    shipment: WithId<Shipment>;
    plant: WithId<Plant>;
    liveLocation?: any;
    gpsImeiNo?: string;
};

interface TrackingDetailsProps {
    trip: EnrichedTrip;
    MapComponent?: any;
}

export default function TrackingDetails({ trip, MapComponent }: TrackingDetailsProps) {
    const live = trip.liveLocation;
    const isOffline = !live;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            {/* 1. MISSION HEADER REGISTRY */}
            <div className="flex flex-wrap items-center gap-6 p-8 bg-slate-900 text-white rounded-[3rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 transition-transform duration-1000">
                    <Radar className="h-64 w-64" />
                </div>
                <div className="bg-blue-600 p-4 rounded-3xl shadow-2xl">
                    <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight italic">Mission Telemetry Link</h2>
                    <div className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-1 flex items-center gap-2">
                        <div className={cn("h-1.5 w-1.5 rounded-full", isOffline ? "bg-red-500" : "bg-emerald-500 animate-pulse")} />
                        Registry ID: {trip.tripId}
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-10 pr-4">
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase text-blue-400 mb-1">Vehicle No</p>
                        <p className="text-2xl font-black uppercase text-white">{trip.vehicleNumber}</p>
                    </div>
                    <Separator orientation="vertical" className="h-12 bg-white/10" />
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase text-blue-400 mb-1">Status</p>
                        <Badge className={cn("font-black uppercase tracking-widest text-[11px] px-6 py-2 rounded-xl border-none", isOffline ? "bg-red-600" : "bg-emerald-600")}>
                            {isOffline ? "GPS OFFLINE" : trip.currentStatusId}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* 2. GIS MAP & LIVE DATA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8">
                    {isOffline ? (
                        <div className="w-full h-full min-h-[400px] bg-slate-100 rounded-[3rem] border-4 border-white shadow-xl flex flex-col items-center justify-center gap-4">
                            <WifiOff className="h-16 w-16 text-slate-400" />
                            <h3 className="text-xl font-black text-slate-600">GPS Signal Offline</h3>
                            <p className="text-sm text-slate-500 text-center max-w-xs">The vehicle is not registered for GPS tracking or the signal is currently inactive.</p>
                        </div>
                    ) : (
                        MapComponent && (
                            <MapComponent 
                                livePos={live} 
                                tripId={trip.tripId} 
                                origin={{ lat: 28.6139, lng: 77.2090, name: trip.plant.name }} 
                                destination={{ lat: 19.0760, lng: 72.8777, name: trip.unloadingPoint }} 
                            />
                        )
                    )}
                </div>
                
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden h-full">
                        <CardHeader className="bg-slate-50 border-b p-6">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Live Diagnostics</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex flex-col items-center gap-2">
                                    <TrendingUp className="h-8 w-8 text-blue-600" />
                                    <p className="text-[9px] font-black uppercase text-slate-400">Speed</p>
                                    <p className="text-2xl font-black text-slate-900">{live?.speed || 0} <span className="text-[10px]">KM/H</span></p>
                                </div>
                                <div className={cn(
                                    "p-6 rounded-3xl border flex flex-col items-center gap-2",
                                    live?.ignition ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-400"
                                )}>
                                    <Power className="h-8 w-8" />
                                    <p className="text-[9px] font-black uppercase">Ignition</p>
                                    <p className="text-xl font-black uppercase">{live?.ignition ? 'ON' : 'OFF'}</p>
                                </div>
                            </div>

                            <div className="space-y-6 px-2">
                                <div className="space-y-1.5">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Last registry handshake</p>
                                    <p className="text-xs font-bold text-slate-700 uppercase">
                                        {live?.lastUpdate || 'Waiting for signal...'}
                                    </p>
                                </div>
                                <Separator />
                                <div className="space-y-1.5">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Lifting Node Source</p>
                                    <p className="text-xs font-bold text-slate-700 uppercase truncate">
                                        {trip.plant.name}
                                    </p>
                                </div>
                                <Separator />
                                <div className="space-y-1.5">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Delivery Destination</p>
                                    <p className="text-xs font-bold text-slate-700 uppercase truncate">
                                        {trip.unloadingPoint}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
