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
import { differenceInHours, format, startOfDay, endOfDay } from 'date-fns';
import { useFirestore } from "@/firebase";
import { collection, getDocs, doc, getDoc, Timestamp } from "firebase/firestore";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ShieldCheck, Search, Loader2 } from "lucide-react";
import { cn, normalizePlantId } from "@/lib/utils";

type StayHoursColor = "success" | "warning" | "alert" | "danger";

const getStayHoursColor = (hours: number): StayHoursColor => {
  if (hours > 48) return "danger";
  if (hours > 24) return "alert";
  if (hours > 12) return "warning";
  return "success";
};

const badgeClassMap: Record<StayHoursColor, string> = {
    success: "bg-green-600 text-white",
    warning: "bg-yellow-500 text-black",
    alert: "bg-orange-500 text-white",
    danger: "bg-red-600 text-white"
}

export default function LoadedStayModal({ isOpen, onClose, plantId, plantName, authorizedPlantIds, fromDate, toDate }: { isOpen: boolean; onClose: () => void; plantId: string; plantName: string; authorizedPlantIds: string[]; fromDate?: Date; toDate?: Date; }) {
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

            const dayStart = fromDate ? startOfDay(fromDate) : startOfDay(new Date());
            const dayEnd = toDate ? endOfDay(toDate) : endOfDay(new Date());

            const allLoaded: WithId<Trip>[] = [];

            for (const pId of scopePlants) {
                try {
                    const tripSnap = await getDocs(collection(firestore, `plants/${pId}/trips`));
                    
                    tripSnap.forEach(doc => {
                        const t = doc.data();
                        const startTime = t.startDate instanceof Timestamp ? t.startDate.toDate() : new Date(t.startDate);
                        // REGISTRY CHANGE: Use tripStatus (Operational Node)
                        const rawStatus = t.tripStatus?.toLowerCase() || '';
                        const status = rawStatus.replace(/[\s_-]+/g, '-');

                        if ((status === 'loading-complete' || status === 'loaded') && startTime >= dayStart && startTime <= dayEnd) {
                            allLoaded.push({
                                id: doc.id,
                                ...t,
                                lastUpdated: t.lastUpdated instanceof Timestamp ? t.lastUpdated.toDate() : (t.lastUpdated ? new Date(t.lastUpdated) : undefined),
                            } as WithId<Trip>);
                        }
                    });
                } catch (e) {
                    console.warn(`Failed to fetch loaded stay data for plant ${pId}`);
                }
            }

            setData(allLoaded);
        } catch (error) {
            console.error("Loaded stay modal fetch error:", error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [isOpen, plantId, authorizedPlantIds, fromDate, toDate, firestore]);
  
  const filteredData = useMemo(() => {
    return data.filter(item =>
      Object.values(item).some(value =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, data]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Loaded Stay Inventory Registry</DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
            Plant: {plantName} | Assets Loaded & Awaiting Exit
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
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Ship to Party</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Unloading Point</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-500">Quantity</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Status Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Load Finish Time</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-6 text-center text-slate-500">Stay Duration</TableHead>
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
                            <TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No vehicles in loaded-stay scope.</TableCell>
                        </TableRow>
                        ) : (
                        filteredData.map((item) => {
                            const stayHours = item.lastUpdated ? differenceInHours(new Date(), new Date(item.lastUpdated)) : 0;
                            const colorKey = getStayHoursColor(stayHours);
                            return (
                                <TableRow key={item.id} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                                    <TableCell className="px-6 font-black text-slate-600 uppercase text-xs">{plants.find(p => p.id === item.originPlantId)?.name ?? 'N/A'}</TableCell>
                                    <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter text-[13px]">{item.vehicleNumber ?? 'N/A'}</TableCell>
                                    <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[200px]">{item.shipToParty ?? 'N/A'}</TableCell>
                                    <TableCell className="px-4 font-medium text-slate-500 uppercase text-xs truncate max-w-[200px]">{item.unloadingPoint ?? 'N/A'}</TableCell>
                                    <TableCell className="px-4 text-right font-black text-blue-900">{item.assignedQtyInTrip} MT</TableCell>
                                    <TableCell className="px-4 text-center">
                                        <Badge variant="secondary" className="font-black uppercase text-[9px] px-3 shadow-sm border-none bg-blue-50 text-blue-700">
                                            {item.tripStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap">{item.lastUpdated ? format(new Date(item.lastUpdated), 'dd/MM/yy HH:mm') : 'N/A'}</TableCell>
                                    <TableCell className="px-6 text-center">
                                        <Badge className={cn("font-black uppercase text-[10px] px-4 py-1 border-none shadow-sm", badgeClassMap[colorKey])}>
                                            {stayHours} HRS
                                        </Badge>
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
                <ShieldCheck className="h-4 w-4 text-blue-600" /> Yard Inventory Manifest Synchronized
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close Manifest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
