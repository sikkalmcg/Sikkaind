"use client";

import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WithId, Plant, VehicleEntryExit } from "@/types";
import { mockPlants } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay, isValid } from "date-fns";
import { useFirestore } from "@/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { normalizePlantId } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ShieldCheck, Search, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchFleetLocation } from "@/app/actions/wheelseye";

export default function BreakdownMaintenanceModal({ isOpen, onClose, plantId, plantName, authorizedPlantIds, fromDate, toDate }: { isOpen: boolean; onClose: () => void; plantId: string; plantName: string; authorizedPlantIds: string[]; fromDate?: Date; toDate?: Date; }) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<(WithId<VehicleEntryExit> & { gpsData?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);

  const fetchRegistryWithGps = async (entries: WithId<VehicleEntryExit>[]) => {
    try {
        const res = await fetchFleetLocation();
        if (res.data && res.data.length > 0) {
            const gpsMap = new Map();
            res.data.forEach((v: any) => {
                const vNo = v.vehicleNumber?.toUpperCase().replace(/\s/g, '');
                gpsMap.set(vNo, {
                    location: v.location || 'N/A',
                    lastUpdate: v.lastUpdateRaw ? format(new Date(v.lastUpdateRaw), 'HH:mm:ss') : '--:--:--'
                });
            });

            const enriched = entries.map(e => ({
                ...e,
                gpsData: gpsMap.get(e.vehicleNumber?.toUpperCase().replace(/\s/g, ''))
            }));
            setData(enriched);
        } else {
            setData(entries);
        }
    } catch (e) {
        setData(entries);
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
            const scopePlantsNormalized = (isAllPlants ? authorizedPlantIds : [plantId]).map(normalizePlantId);

            const dayStart = fromDate ? startOfDay(fromDate) : startOfDay(new Date());
            const dayEnd = toDate ? endOfDay(toDate) : endOfDay(new Date());

            const q = query(
                collection(firestore, "vehicleEntries"), 
                where("status", "==", "IN")
            );
            const snapshot = await getDocs(q);

            const entries: WithId<VehicleEntryExit>[] = snapshot.docs
                .map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        ...d,
                        entryTimestamp: d.entryTimestamp instanceof Timestamp ? d.entryTimestamp.toDate() : new Date(d.entryTimestamp),
                        statusUpdatedAt: d.statusUpdatedAt instanceof Timestamp ? d.statusUpdatedAt.toDate() : (d.statusUpdatedAt ? new Date(d.statusUpdatedAt) : undefined),
                    } as WithId<VehicleEntryExit>;
                })
                .filter(entry => {
                    const normalizedEntryPlantId = normalizePlantId(entry.plantId);
                    const plantMatch = scopePlantsNormalized.includes(normalizedEntryPlantId);
                    const dateMatch = entry.entryTimestamp >= dayStart && entry.entryTimestamp <= dayEnd;
                    const isInMaintenance = entry.remarks && ['Break-down', 'Under Maintenance'].includes(entry.remarks);
                    return plantMatch && dateMatch && isInMaintenance;
                });

            await fetchRegistryWithGps(entries);
        } catch (error) {
            console.error("Breakdown modal fetch error:", error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [isOpen, plantId, authorizedPlantIds, firestore, fromDate, toDate]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
        const normalizedItemPlantId = normalizePlantId(item.plantId);
        const pName = plants?.find(p=> normalizePlantId(p.id) === normalizedItemPlantId)?.name || item.plantId || '';
        return (
            pName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.remarks?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.statusUpdatedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.gpsData?.location?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });
  }, [searchTerm, data, plants]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Fleet Maintenance Registry</DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
            Plant: {plantName} | Non-Operational Asset Monitoring
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          <div className="p-6 bg-white border-b shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search registry..."
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
                    <Table className="border-collapse w-full min-w-[1400px]">
                    <TableHeader className="sticky top-0 bg-slate-100 z-10 border-b-2">
                        <TableRow className="h-14 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500">Plant Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Vehicle Number</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Location Registry</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Last Update</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Status Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Transition Timestamp</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-6 text-right text-slate-500">Actioned By</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                        Array.from({length: 10}).map((_, i) => (
                            <TableRow key={i} className="h-16">
                            <TableCell colSpan={7} className="px-6"><Skeleton className="h-8 w-full" /></TableCell>
                            </TableRow>
                        ))
                        ) : filteredData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No vehicles in maintenance scope.</TableCell>
                        </TableRow>
                        ) : (
                        filteredData.map((item) => {
                            const normalizedItemPlantId = normalizePlantId(item.plantId);
                            const plantNameResolved = plants?.find(p=> normalizePlantId(p.id) === normalizedItemPlantId)?.name ?? 'N/A';
                            const isOffline = !item.gpsData || item.gpsData.location === 'GPS Offline';
                            return (
                                <TableRow key={item.id} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                                <TableCell className="px-6 font-black text-slate-600 uppercase text-xs">{plantNameResolved}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter text-[13px]">{item.vehicleNumber}</TableCell>
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
                                <TableCell className="px-4 text-center">
                                    <Badge className="font-black uppercase text-[9px] px-3 shadow-sm border-none bg-red-600 text-white">
                                        {item.remarks}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-4 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap">{item.statusUpdatedAt ? format(new Date(item.statusUpdatedAt), 'dd/MM/yy HH:mm') : 'N/A'}</TableCell>
                                <TableCell className="px-6 text-right font-bold text-slate-700 uppercase text-[10px]">{item.statusUpdatedBy || 'System Registry'}</TableCell>
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
                <ShieldCheck className="h-4 w-4 text-red-600" /> Maintenance Audit Trail Active
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close Registry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
