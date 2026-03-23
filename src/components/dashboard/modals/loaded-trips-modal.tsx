"use client";

import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WithId, Trip, Plant } from "@/types";
import { mockPlants } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { useFirestore } from "@/firebase";
import { collection, getDocs, doc, getDoc, Timestamp, query, where } from "firebase/firestore";
import { normalizePlantId } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ShieldCheck, Search, Loader2, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @fileOverview Loaded Trips Modal.
 * Registry manifest for vehicles where loading task is finalized but departure is pending.
 */

export default function LoadedTripsModal({ isOpen, onClose, plantId, plantName, authorizedPlantIds, fromDate, toDate }: { isOpen: boolean; onClose: () => void; plantId: string; plantName: string; authorizedPlantIds: string[]; fromDate?: Date; toDate?: Date; }) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<WithId<Trip>[]>([]);
  const [loading, setLoading] = useState(true);
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);

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

            const allLoaded: WithId<Trip>[] = [];

            for (const pId of scopePlants) {
                const tripSnap = await getDocs(collection(firestore, `plants/${pId}/trips`));
                
                tripSnap.forEach(docSnap => {
                    const t = docSnap.data();
                    const startTime = t.startDate instanceof Timestamp ? t.startDate.toDate() : new Date(t.startDate);
                    const rawStatus = t.tripStatus?.toLowerCase() || '';
                    const status = rawStatus.replace(/[\s_-]+/g, '-');

                    // Filter: Logic for "Loaded Trips"
                    if ((status === 'loading-complete' || status === 'loaded') && startTime >= dayStart && startTime <= dayEnd) {
                        allLoaded.push({
                            id: docSnap.id,
                            ...t,
                            startDate: startTime,
                            lrDate: t.lrDate instanceof Timestamp ? t.lrDate.toDate() : (t.lrDate ? new Date(t.lrDate) : undefined)
                        } as WithId<Trip>);
                    }
                });
            }

            setData(allLoaded.sort((a, b) => b.startDate.getTime() - a.startDate.getTime()));
        } catch (error) {
            console.error("Loaded trips modal fetch error:", error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [isOpen, plantId, authorizedPlantIds, firestore, fromDate, toDate]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
        const pName = plants?.find(p=> normalizePlantId(p.id) === normalizePlantId(item.originPlantId))?.name || item.originPlantId || '';
        return (
            pName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.shipToParty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.unloadingPoint?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.lrNumber?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });
  }, [searchTerm, data, plants]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
            <Truck className="h-6 w-6 text-blue-400" /> Loaded Trips Manifest
          </DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
            Plant: {plantName} | Loading Finalized Node Registry
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          <div className="p-6 bg-white border-b shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by vehicle, party, destination..."
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
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Ship to party</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Destination</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">LR Number</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">LR Date</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-500">LR Weight</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-6 text-center text-slate-500">LR Unit</TableHead>
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
                            <TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No loaded trips detected awaiting exit.</TableCell>
                        </TableRow>
                        ) : (
                        filteredData.map((item) => {
                            const normalizedItemPlantId = normalizePlantId(item.originPlantId);
                            const plantNameResolved = plants?.find(p=> normalizePlantId(p.id) === normalizedItemPlantId)?.name ?? item.originPlantId;
                            return (
                            <TableRow key={item.id} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                                <TableCell className="px-6 font-black text-slate-600 uppercase text-xs">{plantNameResolved}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter text-[13px]">{item.vehicleNumber ?? 'N/A'}</TableCell>
                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[200px]">{item.shipToParty ?? 'N/A'}</TableCell>
                                <TableCell className="px-4 font-medium text-slate-500 uppercase text-xs truncate max-w-[200px]">{item.unloadingPoint ?? 'N/A'}</TableCell>
                                <TableCell className="px-4 text-center font-mono font-bold text-blue-700 text-xs">{item.lrNumber || '--'}</TableCell>
                                <TableCell className="px-4 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap">{item.lrDate ? format(new Date(item.lrDate), 'dd/MM/yy') : '--'}</TableCell>
                                <TableCell className="px-4 text-right font-black text-blue-900">{item.assignedQtyInTrip.toFixed(3)}</TableCell>
                                <TableCell className="px-6 text-center">
                                    <Badge variant="outline" className="font-black uppercase text-[10px] px-3 shadow-sm bg-blue-50 text-blue-700 border-blue-200">
                                        MT
                                    </Badge>
                                </TableCell>
                            </TableRow>
                            )
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
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Mission Registry Ready for Dispatch
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close Manifest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
