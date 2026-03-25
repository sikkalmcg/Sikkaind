'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
    Radar, 
    Factory, 
    Truck, 
    MapPin,
    X,
    RefreshCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDoc } from 'firebase/firestore';
import type { Plant, Vehicle } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const TrackingMap = dynamic(() => import('@/components/dashboard/shipment-tracking/TrackingMap'), { 
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-900 animate-pulse rounded-[3rem]" />
});

export default function FleetLiveMapPage() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [apiKey, setApiKey] = useState<string | null>(null);
    const [runningIconUrl, setRunningIconUrl] = useState<string | null>(null);
    const [stoppedIconUrl, setStoppedIconUrl] = useState<string | null>(null);
    const [fleet, setFleet] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPlant, setSelectedPlant] = useState('all');
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
        [firestore]
    );
    const { data: plants } = useCollection<Plant>(plantsQuery);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!firestore) return;
            const settingsDoc = doc(firestore, 'gps_settings', 'api_config');
            const docSnap = await getDoc(settingsDoc);
            if (docSnap.exists()) {
                const settingsData = docSnap.data();
                if (settingsData.apiKey) {
                    setApiKey(settingsData.apiKey);
                    setRunningIconUrl(settingsData.runningIconUrl || null);
                    setStoppedIconUrl(settingsData.stoppedIconUrl || null);
                } else {
                     toast({ variant: 'destructive', title: 'Configuration Missing', description: 'Please configure your GPS API key in the settings first.' });
                }
            } else {
                toast({ variant: 'destructive', title: 'Configuration Missing', description: 'Please configure your GPS API key in the settings first.' });
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [firestore, toast]);

    const refreshFleet = async () => {
        if (!apiKey) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/track', {
              method: 'POST',
              headers: {
                'Content-Type': 'text/plain',
              },
              body: apiKey,
            }); 
            const result = await response.json();
    
            if (Array.isArray(result)) {
                setFleet(result);
            } else {
                console.error("Data list missing or failed:", result);
                toast({ variant: 'destructive', title: 'Sync Error', description: result.message || 'Failed to sync fleet data.' });
                setFleet([]);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unexpected network error occurred.';
            console.error("GIS Registry Sync Error:", error);
            toast({ variant: 'destructive', title: 'Sync Error', description: errorMessage });
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

    const filteredFleet = useMemo(() => {
        if (selectedPlant === 'all') return fleet;
        return fleet.filter(v => v.plantId === selectedPlant);
    }, [fleet, selectedPlant]);

    const stats = useMemo(() => {
        return filteredFleet.reduce((acc, v) => {
            if (v.speed > 5) acc.moving++;
            else if (v.ignition) acc.idle++;
            else acc.parked++;
            return acc;
        }, { moving: 0, idle: 0, parked: 0 });
    }, [filteredFleet]);

    const handleVehicleSelect = (vehicle: any) => {
        setSelectedVehicle(vehicle);
    };

    return (
        <main className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
            <div className="absolute top-6 left-6 right-6 z-40 flex flex-col md:flex-row justify-between gap-4 pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl flex items-center gap-4">
                        <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg"><Radar className="h-6 w-6" /></div>
                        <div>
                            <h1 className="text-lg font-black uppercase tracking-tight italic">Fleet Live Map</h1>
                            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Live Registry Sync Node</p>
                        </div>
                    </div>
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl flex items-center gap-8">
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Moving</span><span className="text-sm font-black text-emerald-400">{stats.moving}</span></div>
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Idle</span><span className="text-sm font-black text-amber-400">{stats.idle}</span></div>
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-slate-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Parked</span><span className="text-sm font-black text-slate-300">{stats.parked}</span></div>
                    </div>
                </div>
                <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl pointer-events-auto flex items-center gap-4">
                    <div className="flex items-center gap-2 border-r border-white/10 pr-4 mr-2"><Factory className="h-4 w-4 text-slate-400" /><select className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none text-blue-400 cursor-pointer" value={selectedPlant} onChange={e => setSelectedPlant(e.target.value)}><option value="all">All Authorized Nodes</option>{plants?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={refreshFleet}><RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} /></Button>
                </div>
            </div>
            <div className="flex-1 relative">
                <TrackingMap vehicles={filteredFleet} height="100%" runningIconUrl={runningIconUrl} stoppedIconUrl={stoppedIconUrl} />
            </div>
            <div className="absolute bottom-6 left-6 w-80 max-h-[40vh] z-40 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
                <div className="p-6 bg-white/5 border-b border-white/10 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Fleet Registry ({filteredFleet.length})</span><Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/20 text-[8px] font-black uppercase">Sync Active</Badge></div>
                <div className="flex-1 overflow-auto p-2">{isLoading ? <p className="p-4 text-center text-[10px] text-slate-500 uppercase font-bold">Loading Fleet Data...</p> : filteredFleet.length === 0 ? <p className="p-4 text-center text-[10px] text-slate-500 uppercase font-bold">No vehicles found</p> : filteredFleet.map((v, i) => <button key={i} onClick={() => handleVehicleSelect(v)} className={cn("w-full flex items-center justify-between p-4 rounded-2xl transition-all mb-1 border border-transparent text-left", selectedVehicle?.vehicleNumber === v.vehicleNumber ? "bg-blue-600 border-blue-400 text-white shadow-lg" : "hover:bg-white/5 text-slate-400")}><div className="flex items-center gap-3"><div className={cn("h-2 w-2 rounded-full", !v.ignition ? "bg-slate-600" : (v.speed > 5 ? "bg-emerald-500 animate-pulse" : "bg-red-500"))} /><span className="text-xs font-black uppercase tracking-tighter">{v.vehicleNumber}</span></div><span className="text-[10px] font-mono">{v.speed} km/h</span></button>)}</div>
            </div>
            {selectedVehicle && <div className="absolute bottom-6 right-6 w-96 z-40 bg-white text-slate-900 rounded-[2.5rem] shadow-3xl overflow-hidden pointer-events-auto animate-in slide-in-from-right"><div className="bg-slate-900 p-6 flex items-center justify-between"><div className="flex items-center gap-3"><Truck className="h-6 w-6 text-blue-400" /><span className="text-lg font-black uppercase text-white tracking-tighter">{selectedVehicle.vehicleNumber}</span></div><button onClick={() => setSelectedVehicle(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button></div><div className="p-8 space-y-6"><div className="grid grid-cols-2 gap-6"><div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Current Speed</p><p className="text-xl font-black">{selectedVehicle.speed} KM/H</p></div><div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Engine Status</p><p className={cn("text-xl font-black uppercase", selectedVehicle.ignition ? "text-emerald-600" : "text-slate-400")}>{selectedVehicle.ignition ? 'ON' : 'OFF'}</p></div></div><div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2"><p className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2"><MapPin className="h-3 w-3 text-blue-600" /> Location Node</p><p className="text-xs font-bold text-slate-700 leading-relaxed uppercase">{selectedVehicle.location || 'Syncing...'}</p></div></div></div>}
        </main>
    );
}
