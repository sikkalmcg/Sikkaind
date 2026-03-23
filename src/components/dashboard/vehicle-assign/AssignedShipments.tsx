'use client';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import UnassignConfirmationDialog from './UnassignConfirmationDialog';
import { useUser } from '@/firebase';
import type { Shipment, Trip, WithId, Plant, Carrier } from '@/types';
import { mockPlants, mockTrips, mockShipments, mockLrs, mockCarriers } from '@/lib/mock-data';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import LRPreviewModal from './LRPreviewModal';
import { type EnrichedLR } from './PrintableLR';
import { Timestamp } from "firebase/firestore";
import { Search } from 'lucide-react';
import { cn, normalizePlantId } from '@/lib/utils';

interface AssignedShipmentsProps {
  trips: WithId<Trip>[];
  shipments: WithId<Shipment>[];
  plants: WithId<Plant>[];
  isLoading?: boolean;
  onUnassign: (trip: WithId<Trip>) => void;
  onEdit: (trip: WithId<Trip>) => void;
  onFreightToClick: (trip: WithId<Trip>) => void;
}

type EnrichedTrip = WithId<Trip> & {
    plantName?: string;
    shipment: WithId<Shipment>;
};

const getStatusColor = (status: Shipment['currentStatusId']) => {
    switch(status) {
        case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
        case 'Partly Vehicle Assigned': return 'bg-orange-500/10 text-orange-700 border-orange-200';
        case 'Assigned': return 'bg-blue-500/10 text-blue-700 border-blue-200';
        case 'in-transit': return 'bg-indigo-500/10 text-indigo-700 border-indigo-200';
        case 'arrival-for-delivery': return 'bg-purple-500/10 text-purple-700 border-purple-200';
        case 'delivered': return 'bg-green-500/10 text-green-700 border-green-200';
        default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
}

const formatSafeDate = (date: any, formatStr: string) => {
    if (!date) return 'Pending...';
    try {
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';
        return format(d, formatStr);
    } catch (e) {
        return 'N/A';
    }
}

export default function AssignedShipments({ trips, shipments, plants, isLoading = false, onUnassign, onEdit, onFreightToClick }: AssignedShipmentsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [previewingLR, setPreviewingLR] = useState<EnrichedLR | null>(null);
  
  const isAdmin = !isUserLoading && (user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com');
  const currentUserName = !isUserLoading && user ? (isAdmin ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0])) : undefined;

  const enrichedTrips = useMemo(() => {
    return trips
        .map(trip => {
            const shipment = shipments.find(s => s.id === trip.shipmentIds[0]);
            if (!shipment) return null;

            const plant = plants.find(p => normalizePlantId(p.id) === normalizePlantId(trip.originPlantId));
            return { ...trip, plantName: plant?.name || trip.originPlantId, shipment };
        })
        .filter((t): t is EnrichedTrip => t !== null);
    }, [trips, shipments, plants]);

  const filteredTrips = useMemo(() => {
    return enrichedTrips.filter(t =>
      Object.values(t).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase())) ||
      Object.values(t.shipment).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [enrichedTrips, searchTerm]);

  const handlePreviewLR = (trip: EnrichedTrip) => {
    if (!trip.lrNumber) return;
    const lr = mockLrs.find(l => l.lrNumber === trip.lrNumber);
    if (!lr) {
        toast({
            variant: "destructive",
            title: "LR Not Found",
            description: "Could not find the LR details for this trip.",
        });
        return;
    }
    const carrier = mockCarriers.find(c => c.id === lr.carrierId);
    if (!carrier) {
         toast({
            variant: "destructive",
            title: "Carrier Not Found",
            description: "Could not find the carrier details for this LR.",
        });
        return;
    }

    setPreviewingLR({
        ...lr,
        trip: trip,
        shipment: trip.shipment,
        carrier: carrier,
    });
  };

  const combinedIsLoading = isLoading || isUserLoading;

  return (
    <>
      <Card className="border-none shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <CardTitle className="text-xl font-bold">Assigned Shipment Registry</CardTitle>
                <CardDescription className="text-xs font-medium">Tracking shipments actively assigned to vehicles and pilots.</CardDescription>
            </div>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search assigned records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[280px] h-9 bg-muted/50 border-none focus-visible:ring-1"
                />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Plant</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Shipment ID</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Trip ID</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">LR No.</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Consignor</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">From</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Ship to</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">To</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10 text-right">Order Qty</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10 text-right">Assigned Qty</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10 text-right">Balance Qty</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Vehicle No.</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10 text-right">Qty (MT)</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10">Status</TableHead>
                  <TableHead className="text-[13px] font-bold uppercase tracking-wider h-10 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedIsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={15} className="py-4"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : filteredTrips.length === 0 ? (
                  <TableRow><TableCell colSpan={15} className="text-center h-32 text-muted-foreground italic text-sm">No active assignments found.</TableCell></TableRow>
                ) : (
                  filteredTrips.map(t => {
                      const isAssignedStatus = t.shipment.currentStatusId === 'Assigned' || t.shipment.currentStatusId === 'Partly Vehicle Assigned';
                      const canModify = isAdmin || isAssignedStatus;
                      const canAccessFreightTo = isAdmin || currentUserName === t.userName;
                      const isFreightToDisabled = !canAccessFreightTo || !t.lrGenerated;

                    return (
                      <TableRow key={t.id} className="hover:bg-muted/30 transition-colors h-12 text-[14px]">
                          <TableCell className="font-bold text-slate-600">{t.plantName}</TableCell>
                          <TableCell className="font-mono text-blue-600 font-bold">{t.shipment.shipmentId}</TableCell>
                          <TableCell className="font-mono uppercase font-bold">{t.tripId}</TableCell>
                          <TableCell>
                            {t.lrNumber ? (
                              <Button variant="link" className="p-0 h-auto font-bold text-slate-800" onClick={() => handlePreviewLR(t)}>
                                {t.lrNumber}
                              </Button>
                            ) : '--'}
                          </TableCell>
                          <TableCell className="truncate max-w-[120px] font-medium">{t.shipment.consignor}</TableCell>
                          <TableCell className="truncate max-w-[120px]">{t.shipment.loadingPoint}</TableCell>
                          <TableCell className="truncate max-w-[120px] font-medium">{t.shipToParty}</TableCell>
                          <TableCell className="truncate max-w-[120px]">{t.unloadingPoint}</TableCell>
                          <TableCell className="text-right">{t.shipment.quantity.toFixed(3)}</TableCell>
                          <TableCell className="text-right font-medium text-blue-600">{t.shipment.assignedQty.toFixed(3)}</TableCell>
                          <TableCell className="text-right font-bold text-red-600">{t.shipment.balanceQty.toFixed(3)}</TableCell>
                          <TableCell className="font-black text-slate-900 tracking-tight">{t.vehicleNumber}</TableCell>
                          <TableCell className="text-right font-bold text-primary">{t.assignedQtyInTrip.toFixed(3)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[9px] h-5 px-1.5 font-bold uppercase border", getStatusColor(t.shipment.currentStatusId))}>
                                {t.shipment.currentStatusId}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right p-1 pr-4">
                             <div className="flex justify-end gap-1">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" disabled={isFreightToDisabled} onClick={() => onFreightToClick(t)}>
                                                Freight
                                            </Button>
                                        </TooltipTrigger>
                                        {isFreightToDisabled && <TooltipContent><p className="text-[10px]">Permission restricted or LR pending.</p></TooltipContent>}
                                    </Tooltip>
                                </TooltipProvider>
                                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canModify} onClick={() => onEdit(t)}>
                                    <EditIcon className="h-3.5 w-3.5 text-blue-600" />
                                </Button>
                                <UnassignConfirmationDialog onConfirm={() => onUnassign(t)} disabled={!isAdmin && !isAssignedStatus}>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!isAdmin && !isAssignedStatus}>
                                        <XCircleIcon className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                </UnassignConfirmationDialog>
                             </div>
                          </TableCell>
                      </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {previewingLR && (
        <LRPreviewModal 
            isOpen={!!previewingLR} 
            onClose={() => setPreviewingLR(null)} 
            lr={previewingLR} 
        />
      )}
    </>
  );
}

const EditIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
);
