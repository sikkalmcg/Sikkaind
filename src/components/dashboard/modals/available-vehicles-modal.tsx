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
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { useFirestore } from "@/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { normalizePlantId } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ShieldCheck, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const getStayHours = (inDateTime: string | Date) => {
  const hours = (new Date().getTime() - new Date(inDateTime).getTime()) / (1000 * 60 * 60);
  return Math.floor(hours);
};

type StayHoursColor = "success" | "warning" | "alert" | "danger";

const getStayHoursColor = (hours: number): StayHoursColor => {
  if (hours > 48) return "danger";
  if (hours > 24) return "alert";
  if (hours > 12) return "warning";
  return "success";
};

const badgeClassMap: Record<StayHoursColor, string> = {
    success: "bg-green-500 text-white",
    warning: "bg-yellow-500 text-black",
    alert: "bg-orange-500 text-white",
    danger: "bg-red-500 text-white"
}

export default function AvailableVehiclesModal({ isOpen, onClose, plantId, plantName, authorizedPlantIds, fromDate, toDate }: { isOpen: boolean; onClose: () => void; plantId: string; plantName: string; authorizedPlantIds: string[]; fromDate?: Date; toDate?: Date; }) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<WithId<VehicleEntryExit>[]>([]);
  const [loading, setLoading] = useState(false);
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
            const scopePlantsNormalized = (isAllPlants ? authorizedPlantIds : [plantId]).map(normalizePlantId);

            const dayStart = fromDate ? startOfDay(fromDate) : startOfDay(subDays(new Date(), 30));
            const dayEnd = toDate ? endOfDay(toDate) : endOfDay(new Date());

            const entriesRef = collection(firestore, "vehicleEntries");
            const q = query(entriesRef, where("status", "==", "IN"));
            const snapshot = await getDocs(q);

            const results: WithId<VehicleEntryExit>[] = snapshot.docs
                .map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        ...d,
                        entryTimestamp: d.entryTimestamp instanceof Timestamp ? d.entryTimestamp.toDate() : new Date(d.entryTimestamp)
                    } as WithId<VehicleEntryExit>;
                })
                .filter(entry => {
                    const normalizedEntryPlantId = normalizePlantId(entry.plantId);
                    const plantMatch = scopePlantsNormalized.includes(normalizedEntryPlantId);
                    const dateMatch = entry.entryTimestamp >= dayStart && entry.entryTimestamp <= dayEnd;
                    const notInMaintenance = !entry.remarks || !['Break-down', 'Under Maintenance'].includes(entry.remarks);
                    return plantMatch && dateMatch && notInMaintenance;
                });

            setData(results);
        } catch (error) {
            console.error("Available vehicles modal fetch error:", error);
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
            item.driverName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });
  }, [searchTerm, data, plants]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Available Vehicles Registry</DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
            Plant: {plantName} | Live Gate Presence Analysis
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          <div className="p-6 bg-white border-b shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by plant, vehicle, or driver..."
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
                    <Table className="border-collapse w-full min-w-[1200px]">
                    <TableHeader className="sticky top-0 bg-slate-100 z-10 border-b-2">
                        <TableRow className="h-14 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500">Plant Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Vehicle Registry</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Pilot Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Gate IN Timestamp</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-6 text-center text-slate-500">Stay Duration</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                        Array.from({length: 10}).map((_, i) => (
                            <TableRow key={i} className="h-16">
                            <TableCell colSpan={5} className="px-6"><Skeleton className="h-8 w-full" /></TableCell>
                            </TableRow>
                        ))
                        ) : filteredData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No available vehicles in yard scope.</TableCell>
                        </TableRow>
                        ) : (
                        filteredData.map((item) => {
                            const stayHours = getStayHours(item.entryTimestamp);
                            const colorKey = getStayHoursColor(stayHours);
                            const normalizedItemPlantId = normalizePlantId(item.plantId);
                            const plantNameResolved = plants?.find(p=> normalizePlantId(p.id) === normalizedItemPlantId)?.name ?? item.plantId;
                            return (
                            <TableRow key={item.id} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                                <TableCell className="px-6 font-black text-slate-600 uppercase text-xs">{plantNameResolved}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter text-[13px]">{item.vehicleNumber ?? 'N/A'}</TableCell>
                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs">{item.driverName ?? 'N/A'}</TableCell>
                                <TableCell className="px-4 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap">{format(item.entryTimestamp, 'dd/MM/yy HH:mm')}</TableCell>
                                <TableCell className="px-6 text-center">
                                <Badge className={cn("font-black uppercase text-[10px] px-4 py-1 border-none shadow-sm", badgeClassMap[colorKey])}>
                                    {stayHours} HRS
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
                <ShieldCheck className="h-4 w-4 text-blue-600" /> Gate Registry Sync: OK
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close Inventory</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}