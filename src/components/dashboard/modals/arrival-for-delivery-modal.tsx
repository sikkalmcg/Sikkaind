
"use client";

import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WithId, Trip, Shipment, Plant } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format, Timestamp } from 'date-fns';
import { useFirestore } from "@/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { normalizePlantId } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ShieldCheck, Search, MapPin, Loader2, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchFleetLocation } from "@/app/actions/wheelseye";

type EnrichedTrip = WithId<Trip> & {
    shipment?: WithId<Shipment>;
    gpsData?: any;
};

export default function ArrivalForDeliveryModal({ isOpen, onClose, plantId, plantName, authorizedPlantIds, fromDate, toDate }: { isOpen: boolean; onClose: () => void; plantId: string; plantName: string; authorizedPlantIds: string[]; fromDate?: Date; toDate?: Date; }) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [shipments, setShipments] = useState<WithId<Shipment>[]>([]);
  const [gpsMap, setGpsMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  const refreshGps = async () => {
    try {
        const res = await fetchFleetLocation();
        if (res.data) {
            const newMap = new Map();
            res.data.forEach((v: any) => {
                newMap.set(v.vehicleNumber?.toUpperCase().replace(/\s/g, ''), {
                    location: v.location,
                    lastUpdate: v.lastUpdateRaw ? format(new Date(v.lastUpdateRaw), 'HH:mm:ss') : null
                });
            });
            setGpsMap(newMap);
        }
    } catch (e) {
        console.warn("GPS Sync Latency");
    }
  };

  useEffect(() => {
    if (!isOpen || !firestore || (plantId === 'all-plants' && authorizedPlantIds.length === 0)) return;

    const scopePlants = plantId === 'all-plants' ? authorizedPlantIds : [plantId];
    const unsubscribers: (() => void)[] = [];
    
    setLoading(true);
    refreshGps();

    scopePlants.forEach(pId => {
        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/trips`), (snap) => {
            const plantTrips = snap.docs.map(docSnap => {
                const t = docSnap.data();
                const statusRaw = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim().replace(/[\s_-]+/g, '-');
                if (['arrived', 'arrival-for-delivery', 'arrive-for-deliver'].includes(statusRaw)) {
                    return {
                        id: docSnap.id,
                        ...t,
                        originPlantId: pId,
                        arrivalDate: t.arrivalDate?.toDate ? t.arrivalDate.toDate() : (t.arrivalDate ? new Date(t.arrivalDate) : undefined),
                        lastUpdated: t.lastUpdated?.toDate ? t.lastUpdated.toDate() : (t.lastUpdated ? new Date(t.lastUpdated) : new Date())
                    } as WithId<Trip>;
                }
                return null;
            }).filter((t): t is WithId<Trip> => t !== null);

            setTrips(prev => [...prev.filter(t => t.originPlantId !== pId), ...plantTrips]);
            setLoading(false);
        }));

        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/shipments`), (snap) => {
            const plantShipments = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as WithId<Shipment>));
            setShipments(prev => [...prev.filter(s => s.originPlantId !== pId), ...plantShipments]);
        }));
    });

    const interval = setInterval(refreshGps, 30000);
    return () => {
        unsubscribers.forEach(u => u());
        clearInterval(interval);
    };
  }, [isOpen, plantId, JSON.stringify(authorizedPlantIds), firestore]);

  const joinedData = useMemo((): EnrichedTrip[] => {
    return trips.map(t => {
        const shipment = shipments.find(s => s.id === t.shipmentIds?.[0]);
        const vNo = t.vehicleNumber?.toUpperCase().replace(/\s/g, '');
        return {
            ...t,
            shipment,
            gpsData: gpsMap.get(vNo)
        };
    }).sort((a, b) => (b.arrivalDate?.getTime() || 0) - (a.arrivalDate?.getTime() || 0));
  }, [trips, shipments, gpsMap]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return joinedData;
    const s = searchTerm.toLowerCase();
    return joinedData.filter(item =>
      Object.values(item).some(val => val?.toString().toLowerCase().includes(s)) ||
      item.shipment?.shipToParty?.toLowerCase().includes(s) ||
      item.gpsData?.location?.toLowerCase().includes(s)
    );
  }, [searchTerm, joinedData]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-blue-400" /> Arrival Vehicles Registry
          </DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
            Plant: {plantName} | Destination Telemetry Handbook
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          <div className="p-6 bg-white border-b shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search trip, vehicle, or party..."
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
                        <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500 w-32">Trip ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-40">Vehicle Number</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Location Registry</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500 w-32">Last Sync</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500 w-40">Arrival Timestamp</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-64">Ship To Party</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-64">Destination Address</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-500 w-32">Manifest Qty</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && trips.length === 0 ? (
                        Array.from({length: 10}).map((_, i) => (
                            <TableRow key={i} className="h-16"><TableCell colSpan={8} className="px-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                        ))
                        ) : filteredData.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No arrivals detected in registry.</TableCell></TableRow>
                        ) : (
                        filteredData.map((item, index) => {
                            const isOffline = !item.gpsData || !item.gpsData.location;
                            const syncTime = item.gpsData?.lastUpdate || (item.lastUpdated ? format(item.lastUpdated, 'HH:mm:ss') : '--:--:--');
                            
                            const shipTo = item.shipToParty || item.shipment?.shipToParty || item.shipment?.billToParty || 'N/A';
                            const destination = item.unloadingPoint || item.shipment?.deliveryAddress || item.shipment?.unloadingPoint || 'N/A';

                            return (
                                <TableRow key={index} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                                <TableCell className="px-6 font-black text-blue-700 font-mono text-[11px] uppercase tracking-tighter">{item.tripId}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter text-[13px]">{item.vehicleNumber ?? 'N/A'}</TableCell>
                                <TableCell className="px-4">
                                    <div className="flex items-center gap-2 text-xs font-bold">
                                        <MapPin className={cn("h-3 w-3 shrink-0", isOffline ? "text-slate-300" : "text-blue-500")} />
                                        <span className={cn("truncate max-w-[350px] uppercase", isOffline ? "text-slate-300 font-normal" : "text-slate-700")}>
                                            {isOffline ? 'GPS Signal Pending' : item.gpsData.location}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 text-center text-[10px] font-black text-slate-400 font-mono">{syncTime}</TableCell>
                                <TableCell className="px-4 text-center text-[10px] font-black text-blue-900 whitespace-nowrap">{item.arrivalDate ? format(new Date(item.arrivalDate), 'dd/MM HH:mm') : 'N/A'}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase text-xs truncate">{shipTo}</TableCell>
                                <TableCell className="px-4 font-bold text-slate-500 uppercase text-[10px] leading-tight line-clamp-2" title={destination}>{destination}</TableCell>
                                <TableCell className="px-4 text-right font-black text-blue-900">{item.assignedQtyInTrip || 0} MT</TableCell>
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
            <div className="flex items-center gap-4">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Arrival Telemetry Synchronized</span>
            </div>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close Registry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
