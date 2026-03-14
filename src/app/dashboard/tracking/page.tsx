
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Radar, 
    Truck, 
    CircleDot, 
    Power, 
    RefreshCcw, 
    Search, 
    Navigation,
    Loader2,
    WifiOff,
    MapPin,
    Smartphone
} from 'lucide-react';
import { fetchFleetLocation } from '@/app/actions/wheelseye';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const TrackingMap = dynamic(() => import('@/components/dashboard/shipment-tracking/TrackingMap'), { 
    ssr: false,
    loading: () => <div className="w-full h-[500px] bg-slate-100 animate-pulse rounded-[3rem]" />
});

export default function TrackingDashboard() {
    const [fleet, setFleet] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const refreshRegistry = async () => {
        setIsLoading(true);
        const res = await fetchFleetLocation();
        if (res.data) {
            setFleet(res.data);
            setLastRefresh(new Date());
        }
        setIsLoading(false);
    };

    useEffect(() => {
        refreshRegistry();
        const interval = setInterval(refreshRegistry, 30000);
        return () => clearInterval(interval);
    }, []);

    const stats = useMemo(() => {
        const res = { total: fleet.length, moving: 0, stopped: 0, off: 0 };
        fleet.forEach(v => {
            if (!v.ignition) res.off++;
            else if (v.speed > 5) res.moving++;
            else res.stopped++;
        });
        return res;
    }, [fleet]);

    const filteredFleet = fleet.filter(v => 
        v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.deviceNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
            <div className="sticky top-0 z-30 bg-white border-b px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                        <Radar className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-blue-900 tracking-tight uppercase italic">Fleet Tracking Dashboard</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Live GIS Telemetry & Analytics Overview</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black uppercase text-slate-400">Last Registry Sync</p>
                        <p className="text-xs font-bold text-slate-600 font-mono">{lastRefresh.toLocaleTimeString()}</p>
                    </div>
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={refreshRegistry}>
                        <RefreshCcw className={cn("h-5 w-5 text-blue-900", isLoading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto space-y-10">
                {/* KPI INDICATORS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total GPS Vehicles', value: stats.total, icon: Radar, color: 'text-blue-900', bg: 'bg-blue-50' },
                        { label: 'Moving (Registry)', value: stats.moving, icon: Navigation, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Stopped (Idle)', value: stats.stopped, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                        { label: 'Ignition Off', value: stats.off, icon: Power, color: 'text-slate-400', bg: 'bg-slate-50' },
                    ].map((card, i) => (
                        <Card key={i} className="border-none shadow-md rounded-2xl group transition-all hover:shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{card.label}</p>
                                        <h4 className={cn("text-3xl font-black tracking-tighter", card.color)}>{card.value}</h4>
                                    </div>
                                    <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", card.bg, card.color)}>
                                        <card.icon className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LIVE FLEET MAP */}
                    <Card className="lg:col-span-8 border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white h-[600px]">
                        <CardHeader className="bg-slate-900 text-white p-6 border-b border-white/5">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                                <Navigation className="h-4 w-4 text-blue-400" /> Live Fleet GIS Registry
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 h-full">
                            <TrackingMap 
                                livePos={fleet[0]} 
                                tripId="Fleet Overview"
                                // We could extend TrackingMap to show all vehicles, but for now we show the selected one
                            />
                        </CardContent>
                    </Card>

                    {/* VEHICLE LIST REGISTRY */}
                    <Card className="lg:col-span-4 border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden flex flex-col">
                        <CardHeader className="bg-slate-50 border-b p-6">
                            <div className="space-y-4">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Vehicle Registry Monitor</CardTitle>
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900" />
                                    <Input 
                                        placeholder="Search vehicle number..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-10 h-10 rounded-xl bg-white border-slate-200 font-bold shadow-sm"
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-auto custom-scrollbar">
                            {isLoading && fleet.length === 0 ? (
                                <div className="p-20 flex flex-col items-center justify-center gap-4 opacity-40">
                                    <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Scanning Satellite Registry...</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                        <TableRow className="h-10 hover:bg-transparent">
                                            <TableHead className="text-[9px] font-black uppercase px-6">Vehicle</TableHead>
                                            <TableHead className="text-[9px] font-black uppercase px-2 text-center">Status</TableHead>
                                            <TableHead className="text-[9px] font-black uppercase px-6 text-right">Track</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredFleet.map((v, i) => (
                                            <TableRow key={i} className="h-12 border-b border-slate-50 hover:bg-blue-50/20 transition-all group">
                                                <TableCell className="px-6 font-black text-slate-900 uppercase tracking-tighter text-xs">
                                                    {v.vehicleNumber}
                                                </TableCell>
                                                <TableCell className="px-2 text-center">
                                                    <div className={cn(
                                                        "h-2 w-2 rounded-full mx-auto shadow-sm",
                                                        !v.ignition ? "bg-slate-300" : (v.speed > 5 ? "bg-emerald-500 animate-pulse" : "bg-red-500")
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-6 text-right">
                                                    <Button variant="ghost" size="sm" className="h-7 rounded-lg font-black text-[9px] uppercase text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100">
                                                        Track
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
