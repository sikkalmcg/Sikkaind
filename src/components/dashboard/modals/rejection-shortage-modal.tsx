"use client";

import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { WithId, Trip, Plant, RejectionShortage } from "@/types";
import { mockTrips, mockPlants, mockRejectionShortageItems } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

type EnrichedRejection = WithId<RejectionShortage> & {
    trip?: WithId<Trip>;
    plant?: WithId<Plant>;
};

export default function RejectionShortageModal({ isOpen, onClose, plant, fromDate, toDate }: { isOpen: boolean; onClose: () => void; plant: string, fromDate?: Date, toDate?: Date }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<EnrichedRejection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    setTimeout(() => {
        const isAllPlants = plant === 'all-plants';
        
        // Registry Logic node: Filter by pending status
        let filteredRejections = (mockRejectionShortageItems || []).filter(r => r.status === 'Pending');

        if (fromDate) {
            filteredRejections = filteredRejections.filter(r => new Date(r.createdAt) >= fromDate);
        }
        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            filteredRejections = filteredRejections.filter(r => new Date(r.createdAt) <= to);
        }

        const enrichedData = filteredRejections.map(rejection => {
            const trip = mockTrips.find(t => t.id === rejection.tripId);
            const plantObj = trip ? mockPlants.find(p => p.id === trip.originPlantId) : undefined;
            return { ...rejection, trip, plant: plantObj };
        }).filter((item): item is EnrichedRejection => !!item.trip);
        
        let finalData = enrichedData;
        if (!isAllPlants) {
            finalData = enrichedData.filter(item => item.trip?.originPlantId === plant);
        }

        setData(finalData);
        setLoading(false);
    }, 300);

  }, [isOpen, plant, fromDate, toDate]);
  
  const filteredData = useMemo(() => {
    return data.filter(item =>
      Object.values(item).some(value =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      ) || item.trip?.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, data]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-[2rem] border-none shadow-3xl">
        <DialogHeader className="p-4">
          <DialogTitle className="font-black uppercase tracking-tight italic">Pending Rejection Ledger</DialogTitle>
          <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mission nodes awaiting resolution handshake</DialogDescription>
        </DialogHeader>
        <div className="py-4 px-6">
          <Input
            placeholder="Search registry..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-6 h-11 rounded-xl bg-slate-50 border-slate-200 font-bold shadow-inner"
          />
          <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-slate-100 shadow-inner bg-white">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 z-10 border-b">
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHead className="text-[9px] font-black uppercase text-slate-500">Trip ID</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-slate-500">Vehicle</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-slate-500">Rejection Type</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-slate-500">Reason Node</TableHead>
                   <TableHead className="text-[9px] font-black uppercase text-slate-500 text-right">Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i} className="h-12">
                      <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredData.length === 0 ? (
                   <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">No pending rejections in current scope.</TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => (
                    <TableRow key={item.id} className="h-14 hover:bg-blue-50/20 transition-colors border-b last:border-0 group">
                        <TableCell className="font-black text-blue-700 font-mono tracking-tighter text-xs uppercase">{item.trip?.tripId}</TableCell>
                        <TableCell className="font-black text-slate-900 uppercase tracking-tighter">{item.trip?.vehicleNumber}</TableCell>
                        <TableCell><Badge variant="destructive" className="font-black uppercase text-[8px] px-2">{item.rejectionType}</Badge></TableCell>
                        <TableCell className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{item.reason || item.items?.map(i => i.reason).join(', ') || '--'}</TableCell>
                        <TableCell className="text-right text-[10px] font-bold text-slate-400 font-mono">{format(new Date(item.createdAt), 'dd.MM.yy')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
