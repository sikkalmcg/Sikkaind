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
        
        let filteredRejections = mockRejectionShortageItems.filter(r => r.status === 'Pending');

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
            const plant = trip ? mockPlants.find(p => p.id === trip.originPlantId) : undefined;
            return { ...rejection, trip, plant };
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Pending Rejection & Shortage</DialogTitle>
          <DialogDescription>Cases awaiting resolution.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead>Trip ID</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Rejection Type</TableHead>
                  <TableHead>Reason</TableHead>
                   <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredData.length === 0 ? (
                   <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">No pending rejections found.</TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => (
                    <TableRow key={item.id}>
                        <TableCell>{item.trip?.tripId}</TableCell>
                        <TableCell>{item.trip?.vehicleNumber}</TableCell>
                        <TableCell><Badge variant="destructive">{item.rejectionType}</Badge></TableCell>
                        <TableCell>{item.reason || item.items.map(i => i.reason).join(', ')}</TableCell>
                        <TableCell>{format(new Date(item.createdAt), 'PP')}</TableCell>
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
