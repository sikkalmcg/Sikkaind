'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
    Radar, 
    Truck, 
    MapPin,
    X,
    RefreshCcw,
    Activity,
    Navigation,
    Clock,
    User,
    ShieldCheck,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const TrackingMap = dynamic(() => import('@/components/dashboard/shipment-tracking/TrackingMap'), { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-950 animate-pulse rounded-[3rem]" />
});

/**
 * @fileOverview Fleet Live Map Terminal.
 * Optimized GIS interface for real-time fleet visibility.
 * CSS Refinement: Fixed h-screen overflow by switching to h-full.
 * Registry Node: Plant selector removed to prioritize global visibility.
 */
export default function FleetLiveMapPage() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [apiKey, setApiKey] = useState<string | null>(null);
    const [runningIconUrl, setRunningIconUrl] = useState<string | null>(null);
    const [stoppedIconUrl, setStoppedIconUrl] = useState<string | null>(null);
    const [fleet, setFleet] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!firestore) return;
            const settingsDoc = doc(firestore, 'gps_settings', 'api_config');
            try {
                const docSnap = await getDoc(settingsDoc);
                if (docSnap.exists()) {
                    const settingsData = docSnap.data();
                    if (settingsData.apiKey) {
                        setApiKey(settingsData.apiKey);
                        setRunningIconUrl(settingsData.runningIconUrl || null);
                        setStoppedIconUrl(settingsData.stoppedIconUrl || null);
                    }
                }
            } catch (e) {
                console.warn("Registry configuration node handshake failed.");
            }
        };
        fetchSettings();
    }, [firestore]);

    const refreshFleet = async () => {
        if (!apiKey) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/track', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: apiKey, 
            }); 
            const result = await response.json();
    
            if (Array.isArray(result)) {
                setFleet(result);
            } else {
                toast({ variant: 'destructive', title: 'Sync Error', description: 'Failed to sync fleet registry.' });
                setFleet([]);
            }
        } catch (error) {
            console.error("GIS Registry Sync Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (apiKey) {
            refreshFleet();
            const interval = setInterval(refreshFleet, 30000);
            return () => clearInterval(interval);
        }
    }, [apiKey]);

    const stats = useMemo(() => {
        return fleet.reduce((acc, v) => {
            if (v.speed > 5) acc.moving++;
            else acc.stopped++;
            return acc;
        }, { moving: 0, stopped: 0, total: fleet.length });
    }, [fleet]);

    const handleVehicleSelect = (vehicle: any) => {
        setSelectedVehicle(vehicle);
    };

    return (
        <main className="flex flex-col h-full bg-slate-950 text-white overflow-hidden relative">
            {/* 1. TOP OVERLAY CONTROLS */}
            <div className="absolute top-6 left-6 right-6 z-40 flex justify-between items-start pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 p-5 rounded-[2rem] shadow-3xl flex items-center gap-5 transition-all">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3">
                            <Radar className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight italic leading-none">Fleet Live Map</h1>
                            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-2">Satellite Registry Node</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 p-5 rounded-[2rem] shadow-3xl flex items-center gap-10">
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                            <div>
                                <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Moving</p>
                                <p className="text-lg font-black text-emerald-400 leading-none">{stats.moving}</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-white/10 mx-2" />
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                            <div>
                                <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Stopped</p>
                                <p className="text-lg font-black text-red-400 leading-none">{stats.stopped}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pointer-events-auto">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-14 w-14 bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl text-white hover:bg-blue-600 shadow-2xl transition-all active:scale-95"
                        onClick={refreshFleet}
                    >
                        <RefreshCcw className={cn("h-6 w-6", isLoading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* 2. MAIN MAP NODE */}
            <div className="flex-1 h-full">
                <TrackingMap 
                    vehicles={fleet} 
                    height="100%" 
                    runningIconUrl={runningIconUrl} 
                    stoppedIconUrl={stoppedIconUrl} 
                />
            </div>

            {/* 3. BOTTOM LEFT REGISTRY LIST */}
            <div className="absolute bottom-8 left-8 w-80 max-h-[45vh] z-40 bg-slate-900/70 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-3xl flex flex-col overflow-hidden pointer-events-auto">
                <div className="p-5 md:p-6 bg-slate-950/30 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Fleet Registry</span>
                        <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">{stats.total} Nodes Syncing</p>
                    </div>
                    <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/20 text-[8px] font-black uppercase animate-pulse">Sync Active</Badge>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar p-2">
                    {isLoading && fleet.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center gap-4 opacity-40">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Resolving Satellite Registry...</span>
                        </div>
                    ) : (
                        fleet.map((v, i) => {
                            const isMoving = v.speed > 5;
                            const isActive = selectedVehicle?.vehicleNumber === v.vehicleNumber;
                            return (
                                <button 
                                    key={i} 
                                    onClick={() => handleVehicleSelect(v)} 
                                    className={cn(
                                        "w-full flex items-center justify-between p-3.5 rounded-xl transition-all mb-1 border-2 text-left group",
                                        isActive 
                                            ? "bg-blue-600 border-blue-400 text-white shadow-xl translate-x-1" 
                                            : "hover:bg-white/10 border-transparent text-slate-400"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "h-1.5 w-1.5 rounded-full", 
                                            isMoving ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                                        )} />
                                        <span className={cn("text-[13px] font-black uppercase tracking-tighter", isActive ? "text-white" : "text-slate-200 group-hover:text-white")}>
                                            {v.vehicleNumber}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn("text-[10px] font-mono font-black", isActive ? "text-blue-100" : "text-slate-500")}>
                                            {v.speed} <span className="text-[8px] opacity-60">KM/H</span>
                                        </span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* 4. BOTTOM RIGHT DETAIL NODE */}
            {selectedVehicle && (
                <div className="absolute bottom-8 right-8 w-96 z-40 bg-white text-slate-900 rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto animate-in slide-in-from-right-10 duration-500">
                    <div className="bg-slate-900 p-6 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg rotate-3"><Truck className="h-6 w-6 text-white" /></div>
                            <div>
                                <span className="text-xl font-black uppercase text-white tracking-tighter leading-none">{selectedVehicle.vehicleNumber}</span>
                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mt-1">Live Node Details</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedVehicle(null)} 
                            className="h-10 w-10 flex items-center justify-center bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1.5 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Navigation className="h-3 w-3" /> Current Speed</p>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-2xl font-black text-slate-900 tracking-tighter">{selectedVehicle.speed}</p>
                                    <span className="text-[10px] font-black text-slate-400 uppercase">KM/H</span>
                                </div>
                            </div>
                            <div className="space-y-1.5 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Activity className="h-3 w-3" /> Engine status</p>
                                <p className={cn(
                                    "text-xl font-black uppercase tracking-tight", 
                                    selectedVehicle.ignition ? "text-emerald-600" : "text-slate-400"
                                )}>
                                    {selectedVehicle.ignition ? 'ACTIVE ON' : 'OFFLINE'}
                                </p>
                            </div>
                        </div>

                        <div className="p-6 bg-blue-50/50 rounded-[2rem] border-2 border-blue-100 shadow-sm space-y-3 relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-[0.05] group-hover:scale-110 transition-transform duration-700">
                                <MapPin size={100} />
                            </div>
                            <p className="text-[9px] font-black uppercase text-blue-900 flex items-center gap-2 tracking-widest relative z-10">
                                <MapPin className="h-3.5 w-3.5 text-blue-600" /> Current Location Node
                            </p>
                            <p className="text-sm font-bold text-slate-700 leading-relaxed uppercase relative z-10">
                                {selectedVehicle.location || 'Resolving Registry Node...'}
                            </p>
                            <div className="h-px w-full bg-blue-100 my-1" />
                            <div className="flex justify-between items-center relative z-10">
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Last registry update</span>
                                <span className="text-[10px] font-black text-blue-600 font-mono">{selectedVehicle.lastUpdate || '--:--:--'}</span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <User className="h-4 w-4 text-slate-400" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase text-slate-400">PILOT</span>
                                    <span className="text-[10px] font-bold uppercase truncate max-w-[100px]">{selectedVehicle.driverName || 'N/A'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <ShieldCheck className="h-4 w-4 text-slate-400" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase text-slate-400">STATUS</span>
                                    <span className="text-[10px] font-black text-blue-900 uppercase truncate">AUTHORIZED</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
