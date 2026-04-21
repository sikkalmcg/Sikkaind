'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Truck, MapPin, Navigation, Clock, User, Phone, Factory, ShieldCheck, Radar } from 'lucide-react';
import type { EnrichedTrip } from '@/app/dashboard/shipment-tracking/page';

interface TrackingDetailsProps {
  trip: EnrichedTrip;
  MapComponent: React.ComponentType<any>;
}

export default function TrackingDetails({ trip, MapComponent }: TrackingDetailsProps) {
  const isMoving = (trip.liveLocation?.speed || 0) > 5;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* MAP VIEW */}
      <Card className="lg:col-span-8 border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
        <CardContent className="p-0">
          <MapComponent 
            livePos={trip.liveLocation} 
            origin={{ 
                lat: trip.plant?.latitude || 28.6139, 
                lng: trip.plant?.longitude || 77.2090, 
                name: trip.plant?.name || "Lifting Node" 
            }}
            destination={trip.shipment?.unloadingPoint || trip.destination}
          />
        </CardContent>
      </Card>

      {/* TRIP TELEMETRY */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b p-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg"><Radar className="h-4 w-4" /></div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Live Telemetry</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                <div className={cn(
                    "p-3 rounded-full border-4",
                    isMoving ? "bg-emerald-100 border-emerald-200 text-emerald-600" : "bg-red-50 border-red-100 text-red-600"
                )}>
                    <Truck className="h-8 w-8" />
                </div>
                <div className="flex-1">
                    <h4 className="font-black uppercase text-slate-900 leading-none">{isMoving ? 'Moving' : 'Stopped'}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                        Current Speed: <span className="text-blue-600">{trip.liveLocation?.speed || 0} KM/H</span>
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {[
                    { label: 'Vehicle Number', value: trip.vehicleNumber, icon: Truck, bold: true },
                    { label: 'Pilot Name', value: trip.driverName, icon: User },
                    { label: 'Lifting Site', value: trip.plant?.name || trip.originPlantId, icon: Factory },
                    { label: 'Last Sync Node', value: trip.liveLocation?.location || 'Location Registry Sync...', icon: MapPin, color: 'text-blue-600 animate-pulse' },
                    { label: 'Assigned Status', value: trip.currentStatusId, icon: ShieldCheck, badge: true }
                ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4 group">
                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                            <item.icon className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-slate-400 leading-none">{item.label}</p>
                            {item.badge ? (
                                <Badge className="bg-blue-900 text-white font-black uppercase text-[9px] mt-1 border-none shadow-sm">{item.value}</Badge>
                            ) : (
                                <p className={cn("text-xs uppercase leading-tight", item.bold ? "font-black text-slate-900" : "font-bold text-slate-600", item.color)}>{item.value || '--'}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
