"use client";

import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WithId, Trip, Shipment, Plant } from "@/types";
import { mockTrips, mockShipments, mockPlants } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay } from "date-fns";
import { useFirestore } from "@/firebase";
import { collection, getDocs, doc, getDoc, Timestamp } from "firebase/firestore";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ShieldCheck, Search, Loader2 } from "lucide-react";

type EnrichedTrip = WithId<Trip> & {
    shipment?: WithId<Shipment>;
};

export default function CompletedShipmentsModal({ isOpen, onClose, plantId, plantName, authorizedPlantIds, fromDate, toDate }: { isOpen: boolean; onClose: () => void; plantId: string; plantName: string; authorizedPlantIds: string[]; fromDate?: Date; toDate?: Date; }) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<EnrichedTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !firestore) return;

    const fetchData = async () => {
        setLoading(true);
        try {
            const isAllPlants = plantId === 'all-plants';
            const scopePlants = isAllPlants ? authorizedPlantIds : [plantId];

            const dayStart = fromDate ? startOfDay(fromDate) : startOfDay(new Date());
            const dayEnd = toDate ? endOfDay(toDate) : endOfDay(new Date());

            const allEnriched: EnrichedTrip[] = [];

            for (const pId of scopePlants) {
                try {
                    const tripSnap = await getDocs(collection(firestore, `plants/${pId}/trips`));
                    
                    for (const tripDoc of tripSnap.docs) {
                        const t = tripDoc.data();
                        const completionTime = t.actualCompletionDate instanceof Timestamp ? t.actualCompletionDate.toDate() : (t.actualCompletionDate ? new Date(t.actualCompletionDate) : undefined);
                        const status = t.currentStatusId?.toLowerCase();

                        if (status === 'delivered' && completionTime && completionTime >= dayStart && completionTime <= dayEnd) {
                            const shipId = t.shipmentIds[0];
                            const shipDoc = await getDoc(doc(firestore, `plants/${pId}/shipments`, shipId));
                            
                            allEnriched.push({
                                id: tripDoc.id,
                                ...t,
                                actualCompletionDate: completionTime,
                                shipment: shipDoc.exists() ? ({ id: shipDoc.id, ...shipDoc.data() } as WithId<Shipment>) : undefined
                            } as EnrichedTrip);
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to fetch completed data for plant ${pId}`);
                }
            }

            allEnriched.sort((a, b) => (b.actualCompletionDate?.getTime() || 0) - (a.actualCompletionDate?.getTime() || 0));
            setData(allEnriched);
        } catch (error) {
            console.error("Completed shipments modal fetch error:", error);
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
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Completed Mission Registry</DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
            Plant: {plantName} | Finalized Delivery Handbook
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
                    <Table className="border-collapse w-full min-w-[1600px]">
                    <TableHeader className="sticky top-0 bg-slate-100 z-10 border-b-2">
                        <TableRow className="h-14 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500">Trip ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Vehicle Number</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Driver Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Consignor</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Bill To Party</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Ship To Party</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500">Unloading Point</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-500">Quantity</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-500">Delivered Date/Time</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-6 text-right text-slate-500">POD Status</TableHead>
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
                            <TableCell colSpan={9} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No completed missions in selected scope.</TableCell>
                        </TableRow>
                        ) : (
                        filteredData.map((item, index) => (
                            <TableRow key={index} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                            <TableCell className="px-6 font-black text-blue-700 font-mono text-[11px] uppercase tracking-tighter">{item.tripId}</TableCell>
                            <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{item.vehicleNumber ?? 'N/A'}</TableCell>
                            <TableCell className="px-4 font-bold text-slate-700 uppercase text-[10px]">{item.driverName ?? 'N/A'}</TableCell>
                            <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[150px]">{item.shipment?.consignor ?? 'N/A'}</TableCell>
                            <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[150px]">{item.shipment?.billToParty ?? 'N/A'}</TableCell>
                            <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[150px]">{item.shipToParty ?? 'N/A'}</TableCell>
                            <TableCell className="px-4 font-medium text-slate-500 uppercase text-xs truncate max-w-[200px]">{item.unloadingPoint ?? 'N/A'}</TableCell>
                            <TableCell className="px-4 text-right font-black text-blue-900">{item.assignedQtyInTrip} MT</TableCell>
                            <TableCell className="px-4 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap">{item.actualCompletionDate ? format(new Date(item.actualCompletionDate), 'dd/MM/yy HH:mm') : 'N/A'}</TableCell>
                            <TableCell className="px-6 text-right">
                                <Badge className="font-black uppercase text-[9px] px-3 shadow-sm border-none" variant={item.podReceived ? 'default' : 'destructive'}>
                                    {item.podReceived ? 'Received' : 'Pending'}
                                </Badge>
                            </TableCell>
                            </TableRow>
                        ))
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
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Mission Registry Archive Synchronized
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none">Close History</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}