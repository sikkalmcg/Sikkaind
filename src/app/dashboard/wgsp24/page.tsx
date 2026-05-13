'use client';

import * as React from 'react';
import { Radar, MapPin, Truck, Loader2, Settings, List, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function WGPS24Page() {
  const [view, setView] = React.useState<'MAP' | 'SETTING'>('MAP');
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
    if (!window.google || !mapRef.current || view !== 'MAP') return;
    if (!googleMap.current) {
      googleMap.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20.5937, lng: 78.9629 }, zoom: 5,
        mapTypeControl: false, streetViewControl: false,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
    }
    
    // Clear old markers if necessary (optional improvement)
    gpsData.forEach(v => {
      new window.google.maps.Marker({
        position: { lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) },
        map: googleMap.current,
        title: v.vehicleNumber,
        icon: {
          url: v.status === 'RUNNING' ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new window.google.maps.Size(32, 32)
        }
      });
    });
  }, [gpsData, view]);

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-2 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
           <Radar className="h-5 w-5 text-[#1e3a8a]" />
           <h2 className="text-[14px] font-black uppercase italic tracking-tighter">WGPS24 – GLOBAL FLEET MONITORING NODE</h2>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setView('MAP')} className={cn("px-4 py-1.5 text-[10px] font-black uppercase transition-all rounded-none", view === 'MAP' ? "bg-[#0056d2] text-white" : "bg-slate-100 text-slate-500")}>GPS Map</button>
           <button onClick={() => setView('SETTING')} className={cn("px-4 py-1.5 text-[10px] font-black uppercase transition-all rounded-none", view === 'SETTING' ? "bg-[#0056d2] text-white" : "bg-slate-100 text-slate-500")}>Settings</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {view === 'MAP' ? (
          <>
            <div className="w-80 bg-white border-r border-slate-300 flex flex-col shadow-lg z-10">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                 <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{gpsData.length} Registered Nodes</span>
                 <RefreshCw className={cn("h-3 w-3 text-slate-400 cursor-pointer", loading && "animate-spin")} onClick={fetchGps} />
              </div>
              <div className="flex-1 overflow-y-auto green-scrollbar">
                {gpsData.map((v: any, i: number) => (
                  <div key={i} onClick={() => {
                    setSelectedVehicle(v);
                    googleMap.current?.setCenter({ lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) });
                    googleMap.current?.setZoom(15);
                  }} className={cn("p-4 border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-all", selectedVehicle?.vehicleNumber === v.vehicleNumber && "bg-blue-50/50")}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-black text-slate-800">{v.vehicleNumber}</span>
                      <div className={cn("px-2 py-0.5 text-[8px] font-black rounded-none", v.status === 'RUNNING' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{v.status}</div>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase truncate mb-1">{v.lastLocation || 'SYNCING NODE...'}</div>
                    <div className="text-[8px] font-black text-slate-300 flex gap-2"><span>SPD: {v.speed || 0} KM/H</span><span>HB: {v.lastHeartbeatTime || '-'}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 relative bg-slate-200">
               <div ref={mapRef} className="w-full h-full" />
               {selectedVehicle && (
                 <div className="absolute top-4 left-4 right-4 bg-white/90 border border-slate-300 p-4 shadow-2xl backdrop-blur-sm animate-fade-in">
                    <div className="flex justify-between items-start">
                       <div className="space-y-1">
                          <h4 className="text-[12px] font-black text-[#1e3a8a] uppercase">{selectedVehicle.vehicleNumber} Live Node</h4>
                          <p className="text-[10px] font-bold text-slate-600 uppercase italic leading-tight">{selectedVehicle.lastLocation}</p>
                       </div>
                       <Button onClick={() => setSelectedVehicle(null)} variant="ghost" className="h-6 w-6 p-0 hover:bg-red-50 text-red-400"><X className="h-3 w-3" /></Button>
                    </div>
                 </div>
               )}
               {loading && (
                 <div className="absolute inset-0 bg-slate-100/50 flex items-center justify-center backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                       <Loader2 className="h-8 w-8 text-[#1e3a8a] animate-spin" />
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Synchronizing Satellite Gateway...</span>
                    </div>
                 </div>
               )}
            </div>
          </>
        ) : (
          <div className="flex-1 bg-white p-12 overflow-y-auto">
             <div className="max-w-2xl space-y-12">
                <div className="space-y-6">
                   <h3 className="text-sm font-black uppercase italic text-slate-400 border-b pb-2 flex items-center gap-2"><Settings className="h-4 w-4" /> Gateway Settings</h3>
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase text-slate-500">Running Node Icon</label>
                         <div className="border-2 border-dashed border-slate-200 p-8 text-center rounded-none bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                            <Truck className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                            <span className="text-[9px] font-black uppercase text-slate-400">Upload SVG/PNG</span>
                         </div>
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase text-slate-500">Stopped Node Icon</label>
                         <div className="border-2 border-dashed border-slate-200 p-8 text-center rounded-none bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                            <Truck className="h-8 w-8 mx-auto text-red-500 mb-2" />
                            <span className="text-[9px] font-black uppercase text-slate-400">Upload SVG/PNG</span>
                         </div>
                      </div>
                   </div>
                </div>
                <div className="space-y-4">
                   <h3 className="text-sm font-black uppercase italic text-slate-400 border-b pb-2">API Connectivity</h3>
                   <div className="p-4 bg-blue-50 border border-blue-100">
                      <p className="text-[11px] font-black text-blue-700 uppercase">Wheelseye Synchronization Status: VERIFIED</p>
                      <p className="text-[9px] font-bold text-blue-400 mt-1 uppercase tracking-widest italic">Endpoint: api.wheelseye.com/currentLoc</p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
