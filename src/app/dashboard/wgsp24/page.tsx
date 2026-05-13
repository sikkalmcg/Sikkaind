'use client';

import * as React from 'react';
import { Radar, MapPin, Truck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WGPS24Page() {
  const [gpsData, setGpsData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedVehicle, setSelectedVehicle] = React.useState<any>(null);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const googleMap = React.useRef<any>(null);

  const fetchGps = React.useCallback(async () => {
    try {
      const res = await fetch('/api/gps');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.list) {
          setGpsData(json.data.list);
          setLoading(false);
        }
      }
    } catch (e) { console.error(e); }
  }, []);

  React.useEffect(() => {
    fetchGps();
    const i = setInterval(fetchGps, 30000);
    return () => clearInterval(i);
  }, [fetchGps]);

  React.useEffect(() => {
    if (!window.google || !mapRef.current) return;
    if (!googleMap.current) {
      googleMap.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20.5937, lng: 78.9629 }, zoom: 5,
        mapTypeControl: false, streetViewControl: false
      });
    }
    
    // Update markers based on gpsData
    gpsData.forEach(v => {
      new window.google.maps.Marker({
        position: { lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) },
        map: googleMap.current,
        title: v.vehicleNumber,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/truck.png',
          scaledSize: new window.google.maps.Size(40, 40)
        }
      });
    });
  }, [gpsData]);

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 flex items-center gap-4 shrink-0">
        <Radar className="h-5 w-5 text-[#1e3a8a]" />
        <h2 className="text-[14px] font-black uppercase italic tracking-tighter">WGPS24 – GLOBAL FLEET MONITORING NODE</h2>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-white border-r border-slate-300 flex flex-col shadow-lg z-10">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
             <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 uppercase tracking-widest">{gpsData.length} Active Nodes</span>
          </div>
          <div className="flex-1 overflow-y-auto green-scrollbar">
            {gpsData.map((v: any, i: number) => (
              <div key={i} onClick={() => {
                setSelectedVehicle(v);
                googleMap.current?.setCenter({ lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) });
                googleMap.current?.setZoom(14);
              }} className="p-4 border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[12px] font-black text-slate-800">{v.vehicleNumber}</span>
                  <div className={cn("w-2 h-2 rounded-full", v.status === 'RUNNING' ? "bg-emerald-500" : "bg-red-500")} />
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase truncate">{v.lastLocation || 'SYNCING...'}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 relative">
           <div ref={mapRef} className="w-full h-full" />
           {loading && (
             <div className="absolute inset-0 bg-slate-100/50 flex items-center justify-center backdrop-blur-sm">
                <Loader2 className="h-8 w-8 text-[#1e3a8a] animate-spin" />
             </div>
           )}
        </div>
      </div>
    </div>
  );
}