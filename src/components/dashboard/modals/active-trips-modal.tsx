"use client";

import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WithId, Trip, Plant } from "@/types";
import { mockTrips, mockPlants } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay, subDays, isValid } from "date-fns";
import { useFirestore } from "@/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ShieldCheck, Search, Radar, MapPin, Loader2 } from "lucide-react";
import { cn, normalizePlantId } from "@/lib/utils";
import { fetchFleetLocation } from "@/app/actions/wheelseye";

const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
    switch (s) {
        case "assigned":
        case "vehicle-assigned":
            return "default";
        case "in-transit":
            return "secondary";
        case "arrival-for-delivery":
        case "arrived-at-destination":
            return "destructive";
        default:
            return "outline";
    }
};

type EnrichedTrip = WithId<Trip> & {
    gpsData?: any;
};

export default function ActiveTripsModal({ isOpen, onClose, plantId, plantName, authorizedPlantIds, fromDate, toDate }: { isOpen: boolean; onClose: () => void; plantId: string; plantName: string; authorizedPlantIds: string[]; fromDate?: Date; toDate?: Date; }) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<EnrichedTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);

  const fetchRegistryWithGps = async (trips: WithId<Trip>[]) => {
    try {
        const res = await fetchFleetLocation();
        if (res.data && res.data.length > 0) {
            const gpsMap = new Map();
            res.data.forEach((v: any) => {
                const vNo = v.vehicleNumber?.toUpperCase().replace(/\s/g, '');
                gpsMap.set(vNo, {
                    speed: Number(v.speed || 0),
                    ignition: v.ignition,
                    // REGISTRY FIX: Show actual location node
                    location: v.location || 'N/A',
                    lastUpdate: v.lastUpdateRaw ? format(new Date(v.lastUpdateRaw), 'HH:mm:ss') : '--:--:--'
                });
            });

            const enriched = trips.map(t => ({
                ...t,
                gpsData: gpsMap.get(t.vehicleNumber?.toUpperCase().replace(/\s/g, ''))
            }));
            setData(enriched);
        } else {
            setData(trips.map(t => ({ ...t })));
        }
    } catch (e) {
        setData(trips.map(t => ({ ...t })));
    }
  };

  useEffect(() => {
    if (!isOpen || !firestore) return;

    const fetchData = async () => {
        setLoading(true);
        try {
            const plantSnap = await getDocs(collection(firestore, "logistics_plants"));
            const masterPlants = plantSnap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Plant>));
            setPlants(masterPlants.length > 0 ? masterPlants : mockPlants);

            const isAllPlants = plantId === 'all-plants';
            const scopePlants = isAllPlants ? authorizedPlantIds : [plantId];

            const dayStart = fromDate ? startOfDay(fromDate) : startOfDay(subDays(new Date(), 30));
            const dayEnd = toDate ? endOfDay(toDate) : endOfDay(new Date());

            const allActive: WithId<Trip>[] = [];

            for (const pId of scopePlants) {
                const tripSnap = await getDocs(collection(firestore, `plants/${pId}/trips`));
                tripSnap.forEach(docSnap => {
                    const t = docSnap.data();
                    const rawStatus = t.tripStatus?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
                    const startTime = t.startDate instanceof Timestamp ? t.startDate.toDate() : new Date(t.startDate);
                    
                    if (['assigned', 'vehicle-assigned', 'in-transit', 'arrival-for-delivery', 'arrived-at-destination'].includes(rawStatus) && startTime >= dayStart && startTime <= dayEnd) {
                        allActive.push({
                            id: docSnap.id,
                            ...t,
                            startDate: startTime
                        } as WithId<Trip>);
                    }
                });
            }

            await fetchRegistryWithGps(allActive);
        } catch (error) {
            console.error("Active trips fetch failure:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [isOpen, plantId, firestore, authorizedPlantIds, fromDate, toDate]);
  
  const filteredData = useMemo(() => {
    return data.filter(item =>
      Object.values(item).some(value =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      ) || (item.gpsData?.location?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, data]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Active Trips Manifest</DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
            Plant: {plantName} | Live GIS Handshake Active
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          <div className="p-6 bg-white border-b shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search trip, vehicle, or area..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-200 font-bold shadow-inner"
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
                <div className="p-6 min-w-full inline-block">
                <div className="rounded-3xl border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
                    <Table className="border-collapse w-full min-w-[1600px]">
                    <TableHeader className="sticky top-0 bg-slate-100 z-10 border-b-2">
                        <TableRow className="h-14 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500">Trip ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Vehicle Number</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Location Registry</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Last Update</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Ship to Party</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-500">Quantity</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Status Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-6 text-right text-slate-500">Track</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                        Array.from({length: 10}).map((_, i) => (
                            <TableRow key={i} className="h-16">
                            <TableCell colSpan={8} className="px-6"><Skeleton className="h-8 w-full" /></TableCell>
                            </TableRow>
                        ))
                        ) : filteredData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No movement detected in registry.</TableCell>
                        </TableRow>
                        ) : (
                        filteredData.map((item) => {
                            const isOffline = !item.gpsData || item.gpsData.location === 'GPS Offline';
                            return (
                                <TableRow key={item.id} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                                <TableCell className="px-6 font-black text-blue-700 font-mono text-[11px] uppercase tracking-tighter">{item.tripId}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{item.vehicleNumber ?? 'N/A'}</TableCell>
                                <TableCell className="px-4">
                                    <div className="flex items-center gap-2 text-xs font-bold">
                                        <MapPin className={cn("h-3 w-3 shrink-0", isOffline ? "text-slate-300" : "text-blue-500")} />
                                        <span className={cn(
                                            "truncate max-w-[350px] uppercase",
                                            isOffline ? "text-slate-300 font-normal" : "text-slate-700"
                                        )}>
                                            {isOffline ? 'GPS Offline' : item.gpsData.location}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 text-center text-[10px] font-black text-slate-400 font-mono">{item.gpsData?.lastUpdate || '--:--:--'}</TableCell>
                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[200px]">{item.shipToParty ?? 'N/A'}</TableCell>
                                <TableCell className="px-4 text-right font-black text-blue-900">{item.assignedQtyInTrip} MT</TableCell>
                                <TableCell className="px-4 text-center">
                                    <Badge className="font-black uppercase text-[9px] px-3 shadow-sm border-none" variant={getStatusColor(item.tripStatus)}>
                                        {item.tripStatus}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-6 text-right">
                                    <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg font-black text-[10px] uppercase text-blue-600 hover:bg-blue-100">
                                        <a href={`/dashboard/shipment-tracking?search=${item.vehicleNumber}`} target="_blank" rel="noopener noreferrer">Live Track</a>
                                    </Button>
                                </TableCell>
                                </TableRow>
                            );
                        })
                        )}
                    </TableBody>
                    </Table>
                </div>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
        
        <DialogFooter className="p-6 bg-slate-50 border-t flex-row items-center justify-between sm:justify-between shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" /> Registry Extraction Synchronized
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close Manifest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
