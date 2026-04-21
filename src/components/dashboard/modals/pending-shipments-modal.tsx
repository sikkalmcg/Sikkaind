"use client";

import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { WithId, Plant, Shipment } from "@/types";
import { mockPlants } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInHours, format, startOfDay, endOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useFirestore } from "@/firebase";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { normalizePlantId } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ShieldCheck, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PendingShipmentsModal({ isOpen, onClose, plantId, plantName, authorizedPlantIds, fromDate, toDate }: { isOpen: boolean; onClose: () => void; plantId: string; plantName: string; authorizedPlantIds: string[]; fromDate?: Date; toDate?: Date; }) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<WithId<Shipment>[]>([]);
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
            const scopePlants = isAllPlants ? authorizedPlantIds : [plantId];

            const dayStart = fromDate ? startOfDay(fromDate) : startOfDay(new Date());
            const dayEnd = toDate ? endOfDay(toDate) : endOfDay(new Date());

            const allPending: WithId<Shipment>[] = [];

            for (const pId of scopePlants) {
                try {
                    const shipSnap = await getDocs(collection(firestore, `plants/${pId}/shipments`));
                    shipSnap.forEach(doc => {
                        const d = doc.data();
                        const createTime = d.creationDate instanceof Timestamp ? d.creationDate.toDate() : new Date(d.creationDate);
                        
                        if (['pending', 'Partly Vehicle Assigned'].includes(d.currentStatusId) && createTime >= dayStart && createTime <= dayEnd) {
                            allPending.push({
                                id: doc.id,
                                ...d,
                                creationDate: createTime,
                                lastUpdateDate: d.lastUpdateDate instanceof Timestamp ? d.lastUpdateDate.toDate() : (d.lastUpdateDate ? new Date(d.lastUpdateDate) : undefined)
                            } as WithId<Shipment>);
                        }
                    });
                } catch (e) {
                    console.warn(`Failed to fetch pending shipments for plant ${pId}`);
                }
            }

            setData(allPending);
        } catch (error) {
            console.error("Pending shipments modal fetch error:", error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [isOpen, plantId, authorizedPlantIds, firestore, fromDate, toDate]);

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
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Open Orders Manifest</DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
            Plant: {plantName} | Shipments Awaiting Allocation
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          <div className="p-6 bg-white border-b shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search orders..."
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
                        <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500">Plant Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Consignor</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Bill To Party</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Ship To Party</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Unloading Point</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-500">Quantity</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Status Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Creation Timestamp</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-6 text-center text-slate-500">Ageing</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                        Array.from({length: 10}).map((_, i) => (
                            <TableRow key={i} className="h-16">
                            <TableCell colSpan={9} className="px-6"><Skeleton className="h-8 w-full" /></TableCell>
                            </TableRow>
                        ))
                        ) : filteredData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={9} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No pending shipments detected.</TableCell>
                        </TableRow>
                        ) : (
                        filteredData.map((item, index) => {
                            const statusDate = item.lastUpdateDate || item.creationDate;
                            const hours = differenceInHours(new Date(), new Date(statusDate));
                            const originName = plants?.find(p=> normalizePlantId(p.id) === normalizePlantId(item.originPlantId))?.name ?? item.originPlantId;
                            return (
                                <TableRow key={index} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                                    <TableCell className="px-6 font-black text-slate-600 uppercase text-xs">{originName}</TableCell>
                                    <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[150px]">{item.consignor ?? 'N/A'}</TableCell>
                                    <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[150px]">{item.billToParty ?? 'N/A'}</TableCell>
                                    <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[150px]">{item.shipToParty ?? 'N/A'}</TableCell>
                                    <TableCell className="px-4 font-medium text-slate-500 uppercase text-xs truncate max-w-[200px]">{item.unloadingPoint ?? item.destination}</TableCell>
                                    <TableCell className="px-4 text-right font-black text-blue-900">{item.quantity} {item.materialTypeId}</TableCell>
                                    <TableCell className="px-4 text-center">
                                        <Badge className="font-black uppercase text-[9px] px-3 shadow-sm border-none bg-orange-500 text-white">
                                            {item.currentStatusId}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap">{format(new Date(statusDate), 'dd/MM/yy HH:mm')}</TableCell>
                                    <TableCell className="px-6 text-center">
                                        <Badge variant="outline" className={cn("font-black uppercase text-[10px] px-3", hours > 24 ? 'text-red-600 border-red-200 bg-red-50' : 'text-slate-500 border-slate-200')}>
                                            {hours} HRS
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
                <ShieldCheck className="h-4 w-4 text-blue-600" /> Order Lifecycle Registry OK
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close Manifest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
