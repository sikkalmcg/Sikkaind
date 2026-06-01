'use client';

import * as React from 'react';
import { Radar, MapPin, Truck, Loader2, Settings, X, RefreshCw, Upload, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFirestore, setDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { format } from 'date-fns';

const SHARED_HUB_ID = 'Sikkaind';

declare global {
  interface Window {
    require?: any;
  }
}

/**
 * @fileOverview WGPS24 – Global Fleet Monitoring.
 * Integrates live Wheelseye API data with ArcGIS Maps for real-time tracking.
 */
export default function WGPS24Page() {
  const db = useFirestore();
  const [view, setView] = React.useState<'MAP' | 'SETTING'>('MAP');
  const [gpsData, setGpsData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedVehicle, setSelectedVehicle] = React.useState<any>(null);
  const [resolvedAddress, setResolvedAddress] = React.useState<string>('RESOLVING...');
  
  // Persistent Settings
  const settingsRef = useMemoFirebase(() => doc(db, 'users', SHARED_HUB_ID, 'gps_tracking', 'settings'), [db]);
  const { data: settings } = useDoc(settingsRef);

  const [activeIcon, setActiveIcon] = React.useState<string>('https://static.arcgis.com/images/Symbols/Shapes/GreenCircleLargeB.png');
  const [stoppedIcon, setStoppedIcon] = React.useState<string>('https://static.arcgis.com/images/Symbols/Shapes/RedCircleLargeB.png');

  const activeFileInputRef = React.useRef<HTMLInputElement>(null);
  const stoppedFileInputRef = React.useRef<HTMLInputElement>(null);

  const mapRef = React.useRef<HTMLDivElement>(null);
  const arcgisView = React.useRef<any>(null);
  const graphicsLayer = React.useRef<any>(null);
  const [mapError, setMapError] = React.useState<string | null>(null);

  // Update icons when settings load
  React.useEffect(() => {
    if (settings) {
      if (settings.activeIcon) setActiveIcon(settings.activeIcon);
      if (settings.stoppedIcon) setStoppedIcon(settings.stoppedIcon);
    }
  }, [settings]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'ACTIVE' | 'STOPPED') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 500 * 1024) {
      alert("SATELLITE ERROR: FILE EXCEEDS 500KB LIMIT");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (type === 'ACTIVE') setActiveIcon(result);
      else setStoppedIcon(result);
      
      const updates = type === 'ACTIVE' ? { activeIcon: result } : { stoppedIcon: result };
      setDocumentNonBlocking(settingsRef, updates, { merge: true });
    };
    reader.readAsDataURL(file);
  };

  const fetchGps = React.useCallback(async () => {
    try {
      const res = await fetch('/api/gps');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.list) {
          setGpsData(json.data.list);
        }
      }
    } catch (e) {
      console.error("GPS Sync Failure:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchGps();
    const interval = setInterval(fetchGps, 900000); // 15 Min Refresh
    return () => clearInterval(interval);
  }, [fetchGps]);

  const loadArcgisModules = React.useCallback((moduleNames: string[]) => {
    return new Promise<any[]>((resolve, reject) => {
      if (!window.require) {
        reject(new Error('ArcGIS SDK did not load yet.'));
        return;
      }

      window.require(moduleNames, (...modules: any[]) => resolve(modules), reject);
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      if (!mapRef.current || view !== 'MAP') return;

      const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
      if (!apiKey) {
        setMapError('ArcGIS API key missing. Add `NEXT_PUBLIC_ARCGIS_API_KEY` in `.env.local`.');
        return;
      }

      try {
        const [esriConfig, ArcGISMap, MapView, GraphicsLayer, Graphic] = await loadArcgisModules([
          'esri/config',
          'esri/Map',
          'esri/views/MapView',
          'esri/layers/GraphicsLayer',
          'esri/Graphic',
        ]);

        if (cancelled || !mapRef.current) return;

        esriConfig.apiKey = apiKey;
        setMapError(null);

        if (!arcgisView.current) {
          graphicsLayer.current = new GraphicsLayer();
          const map = new ArcGISMap({
            basemap: 'arcgis/navigation',
            layers: [graphicsLayer.current],
          });

          arcgisView.current = new MapView({
            container: mapRef.current,
            map,
            center: [78.9629, 20.5937],
            zoom: 5,
            constraints: {
              snapToZoom: false,
            },
            ui: {
              components: ['zoom', 'attribution'],
            },
          });
        }

        graphicsLayer.current.removeAll();

        gpsData.forEach(v => {
          if (!v.latitude || !v.longitude) return;

          const point = {
            type: 'point',
            longitude: parseFloat(v.longitude),
            latitude: parseFloat(v.latitude),
          };

          const graphic = new Graphic({
            geometry: point,
            attributes: v,
            symbol: {
              type: 'picture-marker',
              url: v.status === 'RUNNING' ? activeIcon : stoppedIcon,
              width: '32px',
              height: '32px',
            },
          });

          graphicsLayer.current.add(graphic);
        });

        if (!arcgisView.current.__sikkaClickHandler) {
          arcgisView.current.__sikkaClickHandler = arcgisView.current.on('click', async (event: any) => {
            const hit = await arcgisView.current.hitTest(event);
            const result = hit.results?.find((item: any) => item.graphic?.layer === graphicsLayer.current);
            if (result?.graphic?.attributes) {
              handleSelectVehicle(result.graphic.attributes);
            }
          });
        }
      } catch (error) {
        console.error('ArcGIS map initialization failed:', error);
        setMapError('ArcGIS map did not load. Check `NEXT_PUBLIC_ARCGIS_API_KEY` and API key restrictions.');
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, [gpsData, view, activeIcon, stoppedIcon, loadArcgisModules]);

  const reverseGeocode = React.useCallback(async (lat: number, lng: number) => {
    try {
      const [Locator] = await loadArcgisModules(['esri/rest/locator']);
      const response = await Locator.locationToAddress(
        'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer',
        {
          location: {
            longitude: lng,
            latitude: lat,
          },
        }
      );

      setResolvedAddress(response?.address || 'COORDINATE LOCK ACQUIRED (ADDRESS UNAVAILABLE)');
    } catch (error) {
      console.error('ArcGIS reverse geocode failed:', error);
      setResolvedAddress('COORDINATE LOCK ACQUIRED (ADDRESS UNAVAILABLE)');
    }
  }, [loadArcgisModules]);

  React.useEffect(() => {
    return () => {
      if (arcgisView.current) {
        arcgisView.current.destroy();
        arcgisView.current = null;
        graphicsLayer.current = null;
      }
    };
  }, []);

  const handleSelectVehicle = (v: any) => {
    setSelectedVehicle(v);
    setResolvedAddress('SYNCHRONIZING LOCATION...');
    reverseGeocode(parseFloat(v.latitude), parseFloat(v.longitude));
    if (arcgisView.current) {
      arcgisView.current.goTo({
        center: [parseFloat(v.longitude), parseFloat(v.latitude)],
        zoom: 14,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-2 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
           <Radar className="h-5 w-5 text-[#1e3a8a]" />
           <h2 className="text-[14px] font-black uppercase italic tracking-tighter text-[#1e3a8a]">
             WGPS24 – GLOBAL FLEET MONITORING
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
            <div className="w-80 bg-white border-r border-slate-300 flex flex-col shadow-lg z-10">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                 <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">
                   {gpsData.length} Registered Nodes
                 </span>
                 <button onClick={() => { setLoading(true); fetchGps(); }} className="p-1 hover:bg-slate-200 transition-colors">
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
                    <div className="text-[8px] font-black text-slate-300 flex justify-between mt-2">
                      <span>SPEED: {v.speed || 0} KM/H</span>
                      <span>HB: {v.lastHeartbeatTime ? format(new Date(v.lastHeartbeatTime), 'HH:mm:ss') : '-'}</span>
                    </div>
                  </div>
                ))}
                {gpsData.length === 0 && !loading && (
                  <div className="p-10 text-center space-y-3">
                     <AlertCircle className="h-6 w-6 text-slate-200 mx-auto" />
                     <p className="text-[9px] font-black text-slate-400 uppercase leading-relaxed">No live data received from satellite gateway.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 relative bg-slate-200">
               <div ref={mapRef} className="w-full h-full" />
               
               {selectedVehicle && (
                 <div className="absolute top-4 left-4 right-4 bg-white border border-slate-300 p-4 shadow-2xl animate-fade-in z-20">
                    <div className="flex justify-between items-start">
                       <div className="space-y-2">
                          <div className="flex items-center gap-3">
                             <h4 className="text-[12px] font-black text-[#1e3a8a] uppercase italic">
                               {selectedVehicle.vehicleNumber} Monitoring Active
                             </h4>
                             <Badge className={cn(
                               "rounded-none h-4 px-2 text-[8px] border-none",
                               selectedVehicle.status === 'RUNNING' ? "bg-emerald-500" : "bg-red-500"
                             )}>
                               {selectedVehicle.status}
                             </Badge>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-800 uppercase italic flex items-start gap-2">
                               <MapPin className="h-3 w-3 text-red-500 shrink-0 mt-0.5" /> 
                               <span className="leading-tight">{resolvedAddress}</span>
                             </p>
                             <div className="flex gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest pt-1">
                                <span>Current Speed: {selectedVehicle.speed} KM/H</span>
                                <span>Satellite Sync: OK</span>
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
                 <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-sm z-30">
                    <div className="flex flex-col items-center gap-4">
                       <Loader2 className="h-10 w-10 text-[#1e3a8a] animate-spin" />
                       <span className="text-[11px] font-black uppercase text-[#1e3a8a] tracking-[0.4em]">
                         Establishing Satellite Link...
                       </span>
                    </div>
                 </div>
               )}

                 {mapError && (
                   <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-40 p-6">
                     <div className="max-w-xl bg-red-50 border border-red-200 p-6 text-center">
                       <h4 className="text-sm font-black text-red-700 mb-2">Map Load Error</h4>
                       <p className="text-[11px] text-red-600 mb-3">{mapError}</p>
                       <p className="text-[10px] text-slate-500 mb-4">Quick fixes:</p>
                       <ul className="text-[10px] text-slate-500 list-disc list-inside text-left mb-4">
                         <li>Confirm `NEXT_PUBLIC_ARCGIS_API_KEY` in your `.env.local` is a valid ArcGIS API key.</li>
                         <li>Allow your local app URL in the API key referrers, or remove restrictions while testing.</li>
                         <li>Make sure the key has ArcGIS location services enabled.</li>
                       </ul>
                       <div className="flex justify-center gap-3">
                         <a href="https://developers.arcgis.com/api-keys/" target="_blank" rel="noreferrer" className="px-4 py-1 bg-red-600 text-white text-[11px] font-black">Open API Keys</a>
                         <button onClick={() => window.location.reload()} className="px-4 py-1 border border-slate-200 text-[11px] font-black">Reload</button>
                       </div>
                     </div>
                   </div>
                 )}
            </div>
          </>
        ) : (
          <div className="flex-1 bg-white p-12 overflow-y-auto">
             <div className="max-w-4xl space-y-12 animate-slide-up">
                <div className="space-y-8">
                   <h3 className="text-sm font-black uppercase italic text-slate-400 border-b border-slate-200 pb-3 flex items-center gap-2">
                     <Settings className="h-4 w-4" /> Visual Identity Settings
                   </h3>
                   <div className="grid grid-cols-2 gap-12">
                      <div className="space-y-4">
                         <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-black">Active (Running) Icon</label>
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
                            {activeIcon.startsWith('data:') || activeIcon.startsWith('http') ? (
                               <div className="relative w-20 h-20 mb-4">
                                  <img src={activeIcon} alt="Active Preview" className="object-contain w-full h-full" />
                               </div>
                            ) : (
                               <Truck className="h-10 w-10 mx-auto text-emerald-500 mb-4 group-hover:scale-110 transition-transform" />
                            )}
                            <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-blue-600">Update Active Icon</span>
                         </div>
                      </div>
                      <div className="space-y-4">
                         <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-black">Stopped (Idle) Icon</label>
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
                            {stoppedIcon.startsWith('data:') || stoppedIcon.startsWith('http') ? (
                               <div className="relative w-20 h-20 mb-4">
                                  <img src={stoppedIcon} alt="Stopped Preview" className="object-contain w-full h-full" />
                               </div>
                            ) : (
                               <Truck className="h-10 w-10 mx-auto text-red-500 mb-4 group-hover:scale-110 transition-transform" />
                            )}
                            <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-blue-600">Update Stopped Icon</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h3 className="text-sm font-black uppercase italic text-slate-400 border-b border-slate-200 pb-3">Operational Status</h3>
                   <div className="p-6 bg-blue-50 border border-blue-100 shadow-sm flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[12px] font-black text-blue-700 uppercase tracking-tight">
                          SATELLITE GATEWAY: <span className="text-emerald-600">ACTIVE & VERIFIED</span>
                        </p>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest italic">
                          PROTOCOL: WHEELSEYE_LMC_V1
                        </p>
                      </div>
                      <Badge className="bg-blue-600 rounded-none text-[9px] font-black h-5 uppercase tracking-widest">Connected</Badge>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
