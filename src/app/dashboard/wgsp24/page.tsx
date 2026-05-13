'use client';

import * as React from 'react';
import { Radar, MapPin, Truck, Loader2, Settings, X, RefreshCw, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

/**
 * @fileOverview WGPS24 – Global Fleet Monitoring Node.
 * Integrates live Wheelseye API data with Google Maps for real-time tracking.
 */
export default function WGPS24Page() {
  const [view, setView] = React.useState<'MAP' | 'SETTING'>('MAP');
  const [gpsData, setGpsData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedVehicle, setSelectedVehicle] = React.useState<any>(null);
  const [resolvedAddress, setResolvedAddress] = React.useState<string>('RESOLVING GATEWAY...');
  
  // Icon State
  const [activeIcon, setActiveIcon] = React.useState<string>('https://maps.google.com/mapfiles/ms/icons/green-dot.png');
  const [stoppedIcon, setStoppedIcon] = React.useState<string>('https://maps.google.com/mapfiles/ms/icons/red-dot.png');

  const activeFileInputRef = React.useRef<HTMLInputElement>(null);
  const stoppedFileInputRef = React.useRef<HTMLInputElement>(null);

  const mapRef = React.useRef<HTMLDivElement>(null);
  const googleMap = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);

  // Handle Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'ACTIVE' | 'STOPPED') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 500 * 1024) {
      alert("SATELLITE REGISTRY ERROR: FILE EXCEEDS 500KB LIMIT");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (type === 'ACTIVE') setActiveIcon(result);
      else setStoppedIcon(result);
    };
    reader.readAsDataURL(file);
  };

  // Fetch GPS data from Wheelseye Proxy
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
    } catch (e) {
      console.error("GPS Node Sync Failure:", e);
    }
  }, []);

  // Set up synchronization interval
  React.useEffect(() => {
    fetchGps();
    const interval = setInterval(fetchGps, 30000); // 30s heartbeat
    return () => clearInterval(interval);
  }, [fetchGps]);

  // Reverse Geocoding Helper
  const reverseGeocode = React.useCallback((lat: number, lng: number) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]) {
        setResolvedAddress(results[0].formatted_address);
      } else {
        setResolvedAddress('COORDINATE LOCK ACQUIRED (ADDRESS UNAVAILABLE)');
      }
    });
  }, []);

  // Handle Map and Marker Lifecycle
  React.useEffect(() => {
    if (!window.google || !mapRef.current || view !== 'MAP') return;

    // Initialize Map instance if not present
    if (!googleMap.current) {
      googleMap.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20.5937, lng: 78.9629 }, // Center of India
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ]
      });
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers for synced nodes
    gpsData.forEach(v => {
      const marker = new window.google.maps.Marker({
        position: { lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) },
        map: googleMap.current,
        title: `${v.vehicleNumber} - ${v.status}`,
        icon: {
          url: v.status === 'RUNNING' ? activeIcon : stoppedIcon,
          scaledSize: new window.google.maps.Size(32, 32)
        }
      });

      marker.addListener('click', () => {
        handleSelectVehicle(v);
      });

      markersRef.current.push(marker);
    });
  }, [gpsData, view, activeIcon, stoppedIcon]);

  const handleSelectVehicle = (v: any) => {
    setSelectedVehicle(v);
    setResolvedAddress('SYNCHRONIZING LOCATION...');
    reverseGeocode(parseFloat(v.latitude), parseFloat(v.longitude));
    if (googleMap.current) {
      googleMap.current.setCenter({ lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) });
      googleMap.current.setZoom(14);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      {/* Transaction Header */}
      <div className="bg-white border-b border-slate-300 px-8 py-2 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
           <Radar className="h-5 w-5 text-[#1e3a8a]" />
           <h2 className="text-[14px] font-black uppercase italic tracking-tighter text-[#1e3a8a]">
             WGPS24 – GLOBAL FLEET MONITORING HUB
           </h2>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setView('MAP')} 
             className={cn(
               "px-6 py-1.5 text-[10px] font-black uppercase transition-all rounded-none border border-slate-300", 
               view === 'MAP' ? "bg-[#0056d2] text-white border-[#0056d2]" : "bg-slate-100 text-slate-500 hover:bg-white"
             )}
           >
             GPS Tracking Map
           </button>
           <button 
             onClick={() => setView('SETTING')} 
             className={cn(
               "px-6 py-1.5 text-[10px] font-black uppercase transition-all rounded-none border border-slate-300", 
               view === 'SETTING' ? "bg-[#0056d2] text-white border-[#0056d2]" : "bg-slate-100 text-slate-500 hover:bg-white"
             )}
           >
             Settings
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {view === 'MAP' ? (
          <>
            {/* Vehicle Registry Sidebar */}
            <div className="w-80 bg-white border-r border-slate-300 flex flex-col shadow-lg z-10">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                 <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">
                   {gpsData.length} Registered Nodes
                 </span>
                 <button onClick={fetchGps} className="p-1 hover:bg-slate-200 transition-colors">
                    <RefreshCw className={cn("h-3 w-3 text-slate-400", loading && "animate-spin")} />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto green-scrollbar">
                {gpsData.map((v: any, i: number) => (
                  <div 
                    key={i} 
                    onClick={() => handleSelectVehicle(v)} 
                    className={cn(
                      "p-4 border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-all", 
                      selectedVehicle?.vehicleNumber === v.vehicleNumber && "bg-blue-50 border-l-4 border-l-[#0056d2]"
                    )}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-black text-slate-800">{v.vehicleNumber}</span>
                      <div className={cn(
                        "px-2 py-0.5 text-[8px] font-black rounded-none", 
                        v.status === 'RUNNING' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {v.status}
                      </div>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase truncate mb-1">
                      {v.lastLocation || 'SYNCING NODE...'}
                    </div>
                    <div className="text-[8px] font-black text-slate-300 flex justify-between">
                      <span>SPEED: {v.speed || 0} KM/H</span>
                      <span>HB: {v.lastHeartbeatTime ? new Date(v.lastHeartbeatTime).toLocaleTimeString() : '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative bg-slate-200">
               <div ref={mapRef} className="w-full h-full" />
               
               {/* Selection Details Overlay */}
               {selectedVehicle && (
                 <div className="absolute top-4 left-4 right-4 bg-white/95 border border-slate-300 p-4 shadow-2xl backdrop-blur-sm animate-fade-in z-20">
                    <div className="flex justify-between items-start">
                       <div className="space-y-2">
                          <div className="flex items-center gap-3">
                             <h4 className="text-[12px] font-black text-[#1e3a8a] uppercase">
                               {selectedVehicle.vehicleNumber} Live Monitoring Node
                             </h4>
                             <Badge className={cn(
                               "rounded-none h-4 px-2 text-[8px] border-none",
                               selectedVehicle.status === 'RUNNING' ? "bg-emerald-500" : "bg-red-500"
                             )}>
                               {selectedVehicle.status}
                             </Badge>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-700 uppercase italic flex items-start gap-2">
                               <MapPin className="h-3 w-3 text-red-500 shrink-0 mt-0.5" /> 
                               <span className="leading-tight">{resolvedAddress}</span>
                             </p>
                             <div className="flex gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest pt-1">
                                <span>Speed: {selectedVehicle.speed} KM/H</span>
                                <span>Altitude Sync: ACTIVE</span>
                             </div>
                          </div>
                       </div>
                       <Button 
                         onClick={() => setSelectedVehicle(null)} 
                         variant="ghost" 
                         className="h-8 w-8 p-0 hover:bg-red-50 text-red-400 rounded-none"
                       >
                         <X className="h-4 w-4" />
                       </Button>
                    </div>
                 </div>
               )}

               {loading && (
                 <div className="absolute inset-0 bg-slate-100/50 flex items-center justify-center backdrop-blur-sm z-30">
                    <div className="flex flex-col items-center gap-4">
                       <Loader2 className="h-10 w-10 text-[#1e3a8a] animate-spin" />
                       <span className="text-[11px] font-black uppercase text-[#1e3a8a] tracking-[0.4em]">
                         Synchronizing Satellite Gateway...
                       </span>
                    </div>
                 </div>
               )}
            </div>
          </>
        ) : (
          /* Settings Tab */
          <div className="flex-1 bg-white p-12 overflow-y-auto">
             <div className="max-w-4xl space-y-12 animate-slide-up">
                <div className="space-y-8">
                   <h3 className="text-sm font-black uppercase italic text-slate-400 border-b border-slate-200 pb-3 flex items-center gap-2">
                     <Settings className="h-4 w-4" /> Gateway Visualization Settings
                   </h3>
                   <div className="grid grid-cols-2 gap-12">
                      <div className="space-y-4">
                         <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Active (Running) Node Icon</label>
                            <span className="text-[9px] text-slate-400 italic">Recommended: 64x64 PNG/SVG</span>
                         </div>
                         <input 
                            type="file" 
                            ref={activeFileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'ACTIVE')}
                         />
                         <div 
                            onClick={() => activeFileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 p-12 text-center rounded-none bg-slate-50 hover:bg-slate-100 hover:border-blue-300 transition-all cursor-pointer group min-h-[180px] flex flex-col items-center justify-center"
                         >
                            {activeIcon.startsWith('data:') ? (
                               <div className="relative w-16 h-16 mb-4">
                                  <img src={activeIcon} alt="Active Preview" className="object-contain w-full h-full" />
                               </div>
                            ) : (
                               <Truck className="h-10 w-10 mx-auto text-emerald-500 mb-4 group-hover:scale-110 transition-transform" />
                            )}
                            <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-blue-600">Upload Icon Registry</span>
                         </div>
                      </div>
                      <div className="space-y-4">
                         <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Stopped (Idle) Node Icon</label>
                            <span className="text-[9px] text-slate-400 italic">Recommended: 64x64 PNG/SVG</span>
                         </div>
                         <input 
                            type="file" 
                            ref={stoppedFileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'STOPPED')}
                         />
                         <div 
                            onClick={() => stoppedFileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 p-12 text-center rounded-none bg-slate-50 hover:bg-slate-100 hover:border-blue-300 transition-all cursor-pointer group min-h-[180px] flex flex-col items-center justify-center"
                         >
                            {stoppedIcon.startsWith('data:') ? (
                               <div className="relative w-16 h-16 mb-4">
                                  <img src={stoppedIcon} alt="Stopped Preview" className="object-contain w-full h-full" />
                               </div>
                            ) : (
                               <Truck className="h-10 w-10 mx-auto text-red-500 mb-4 group-hover:scale-110 transition-transform" />
                            )}
                            <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-blue-600">Upload Icon Registry</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h3 className="text-sm font-black uppercase italic text-slate-400 border-b border-slate-200 pb-3">API Synchronization Status</h3>
                   <div className="p-6 bg-blue-50 border border-blue-100 shadow-sm flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[12px] font-black text-blue-700 uppercase tracking-tight">
                          Wheelseye Synchronization Protocol: <span className="text-emerald-600">VERIFIED</span>
                        </p>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest italic">
                          ENDPOINT: api.wheelseye.com/currentLoc
                        </p>
                      </div>
                      <Badge className="bg-blue-600 rounded-none text-[9px] font-black h-5">GATEWAY ACTIVE</Badge>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
