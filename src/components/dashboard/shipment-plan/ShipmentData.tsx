'use client';

import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileDown, Search, Ban, Edit2, FileText, Printer, FileDown as DownloadIcon, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import type { Shipment, Plant, Trip, WithId, Carrier, LR } from '@/types';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, limit } from 'firebase/firestore';
import DeleteShipmentConfirmationDialog from './DeleteShipmentConfirmationDialog';
import { Timestamp } from "firebase/firestore";
import { cn, normalizePlantId } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import LRPrintPreviewModal from '@/components/dashboard/lr-create/LRPrintPreviewModal';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { useLoading } from '@/context/LoadingContext';
import { useToast } from '@/hooks/use-toast';

interface ShipmentDataProps {
  shipments: WithId<Shipment>[];
  plants: WithId<Plant>[];
  onEdit: (shipment: WithId<Shipment>) => void;
  onDelete: (shipmentId: string) => void;
}

type EnrichedShipment = WithId<Shipment> & {
    plantName?: string;
    tripId?: string;
    vehicleNumber?: string;
    driverMobile?: string;
    tripStartDate?: Date;
    lrNumber?: string;
    lrDate?: Date;
    lrData?: any;
    carrierObj?: any;
    plant?: Plant;
};

const ITEMS_PER_PAGE = 10;

const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    switch(s) {
        case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
        case 'partly vehicle assigned': return 'bg-orange-500/10 text-orange-700 border-orange-200';
        case 'assigned': 
        case 'vehicle assigned': return 'bg-blue-500/10 text-blue-700 border-blue-200';
        case 'in-transit': return 'bg-indigo-500/10 text-indigo-700 border-indigo-200';
        case 'arrival-for-delivery': return 'bg-purple-500/10 text-purple-700 border-purple-200';
        case 'delivered': return 'bg-green-500/10 text-green-700 border-green-200';
        case 'cancelled': return 'bg-red-500/10 text-red-700 border-red-200';
        case 'short closed': return 'bg-slate-500/10 text-slate-700 border-slate-200';
        default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
}

const formatSafeDate = (date: any, formatStr: string) => {
    if (!date) return '--';
    try {
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return '--';
        return format(d, formatStr);
    } catch (e) {
        return '--';
    }
}

export default function ShipmentData({ shipments, plants, onEdit, onDelete }: ShipmentDataProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [carriers, setCarriers] = useState<WithId<Carrier>[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewLr, setPreviewLr] = useState<EnrichedLR | null>(null);
  
  const { user } = useUser();
  const firestore = useFirestore();
  const { showLoader, hideLoader } = useLoading();
  const { toast } = useToast();
  
  const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    
    // Mission Registry Handshake: Broad extraction for enrichment
    const unsubTrips = onSnapshot(collection(firestore, "trips"), (snap) => {
        setTrips(snap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Trip>)));
    });

    const unsubCarriers = onSnapshot(collection(firestore, "carriers"), (snap) => {
        setCarriers(snap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Carrier>)));
    });

    setLoading(false);

    return () => {
        unsubTrips();
        unsubCarriers();
    };
  }, [firestore]);

  const enrichedShipments: EnrichedShipment[] = useMemo(() => {
    return shipments.map(shipment => {
        const trip = trips.find(t => t.shipmentIds && t.shipmentIds.includes(shipment.id));
        const plant = plants.find(p => normalizePlantId(p.id) === normalizePlantId(shipment.originPlantId));
        const carrier = carriers.find(c => c.id === trip?.carrierId || c.id === shipment.carrierId);

        return {
            ...shipment,
            plant,
            plantName: plant?.name || shipment.originPlantId,
            tripId: trip?.tripId,
            vehicleNumber: trip?.vehicleNumber || shipment.vehicleNumber,
            driverMobile: trip?.driverMobile || shipment.driverMobile,
            tripStartDate: trip?.startDate instanceof Timestamp ? trip.startDate.toDate() : (trip?.startDate ? new Date(trip.startDate) : undefined),
            lrNumber: trip?.lrNumber || shipment.lrNumber,
            lrDate: trip?.lrDate instanceof Timestamp ? trip.lrDate.toDate() : (trip?.lrDate ? new Date(trip.lrDate) : (shipment.lrDate ? new Date(shipment.lrDate) : undefined)),
            carrierObj: carrier
        }
    });
  }, [shipments, plants, trips, carriers]);

  const filteredShipments = useMemo(() => {
    if (!searchTerm) return enrichedShipments;
    const s = searchTerm.toLowerCase();
    return enrichedShipments.filter(row => 
        Object.values(row).some(val => val?.toString().toLowerCase().includes(s))
    );
  }, [enrichedShipments, searchTerm]);

  const paginatedShipments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredShipments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredShipments, currentPage]);

  const totalPages = Math.ceil(filteredShipments.length / ITEMS_PER_PAGE);

  const handleExport = () => {
    const dataToExport = filteredShipments.map(s => ({
        'Plant': s.plantName,
        'Order ID': s.shipmentId,
        'Order Date': formatSafeDate(s.creationDate, 'dd/MM/yy HH:mm'),
        'Vehicle Number': s.vehicleNumber || '--',
        'Pilot Mobile': s.driverMobile || '--',
        'Invoice Number': s.invoiceNumber || '--',
        'E-Waybill Number': s.ewaybillNumber || '--',
        'LR Number': s.lrNumber || '--',
        'LR Date': s.lrDate ? format(new Date(s.lrDate), 'dd-MM-yyyy') : '--',
        'Item Description': s.itemDescription || '--',
        'Total Units': s.totalUnits || '--',
        'FROM': s.loadingPoint || s.plantName,
        'Consignor': s.consignor || 'N/A',
        'Bill to Party': s.billToParty || 'N/A',
        'Ship to Party': s.shipToParty || 'N/A',
        'Destination': s.unloadingPoint || 'N/A',
        'Order Qty': `${s.quantity.toFixed(3)} ${s.materialTypeId}`,
        'Status': s.currentStatusId,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Order Ledger Registry");
    XLSX.writeFile(workbook, `Order_Ledger_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const openLRPrint = async (row: EnrichedShipment) => {
    if (!row.lrNumber || !firestore) return;
    showLoader();
    try {
        const plantId = normalizePlantId(row.originPlantId);
        const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
        
        // Strategy: First check standard registry path
        let q = query(lrsRef, where("lrNumber", "==", row.lrNumber), limit(1));
        let snap = await getDocs(q);
        
        // Strategy Fallback: Check for LR stored in shipment itself if document missing
        if (snap.empty) {
            if (row.items && row.items.length > 0) {
                setPreviewLr({
                    lrNumber: row.lrNumber,
                    date: row.lrDate instanceof Date ? row.lrDate : (row.lrDate as any)?.toDate(),
                    trip: row as any,
                    carrier: row.carrierObj,
                    shipment: row as any,
                    plant: row.plant,
                    items: row.items,
                    weightSelection: 'Assigned Weight',
                    assignedTripWeight: row.quantity,
                    from: row.loadingPoint || row.plantName || '',
                    to: row.unloadingPoint || '',
                    consignorName: row.consignor || '',
                    buyerName: row.billToParty || '',
                    shipToParty: row.shipToParty || '',
                    deliveryAddress: row.unloadingPoint || '',
                    id: row.id
                } as any);
                hideLoader();
                return;
            }
            toast({ variant: 'destructive', title: "LR Node Missing", description: "Lorry Receipt particulars not found in registry." });
        } else {
            const lrDoc = snap.docs[0].data() as LR;
            setPreviewLr({
                ...lrDoc,
                id: snap.docs[0].id,
                date: lrDoc.date instanceof Timestamp ? lrDoc.date.toDate() : new Date(lrDoc.date),
                trip: row as any,
                carrier: row.carrierObj,
                shipment: row as any,
                plant: row.plant
            } as EnrichedLR);
        }
    } catch (e) {
        toast({ variant: 'destructive', title: "Registry Error", description: "Could not extract LR manifest." });
    } finally {
        hideLoader();
    }
  };
  
  return (
    <Card className="border-none shadow-md bg-white rounded-[2.5rem] overflow-hidden">
      <CardHeader className="bg-slate-50 border-b p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><FileText className="h-5 w-5" /></div>
                <div>
                    <CardTitle className="text-xl font-black uppercase text-blue-900 italic">Order Ledger Registry</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Consolidated mission plans across authorized nodes</CardDescription>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input
                        placeholder="Quick filter registry..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm font-bold focus-visible:ring-blue-900"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-11 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
                    <FileDown className="h-4 w-4" /> Export Ledger
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <Table className="border-collapse w-full min-w-[2800px] table-fixed">
            <TableHeader className="bg-slate-100/90 backdrop-blur sticky top-0 z-20">
              <TableRow className="hover:bg-transparent border-b-2 border-slate-200 h-14">
                <TableHead className="text-[10px] font-black uppercase px-6 w-32">Plant</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 w-36">Order ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center w-40">Order Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 w-36 text-center">Vehicle No</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 w-36 text-center">Pilot Mobile</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center w-36">Invoice No</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center w-36">E-Waybill No</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center w-36">LR No</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center w-36">LR Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 w-48">Consignor</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 w-48">Consignee</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 w-48">Item Description</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center w-24">Unit</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-right w-32">Order Qty</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center w-40">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-8 text-right w-32">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={16} className="p-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : paginatedShipments.length === 0 ? (
                <TableRow><TableCell colSpan={16} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No mission plans detected in current registry.</TableCell></TableRow>
              ) : (
                paginatedShipments.map(s => {
                  const isCancelled = s.currentStatusId?.toLowerCase() === 'cancelled';
                  const isShortClosed = s.currentStatusId?.toLowerCase() === 'short closed';
                  const canCancel = isAdmin || (!isCancelled && !isShortClosed && s.balanceQty > 0);
                  const canEdit = isAdmin || (!isCancelled && !isShortClosed && (s.currentStatusId === 'pending' || s.currentStatusId === 'partly vehicle assigned'));
                  
                  return (
                    <TableRow key={s.id} className="hover:bg-blue-50/20 transition-colors h-16 border-b border-slate-100 last:border-0 group text-[11px] font-medium text-slate-600">
                      <TableCell className="px-6 font-bold text-slate-600 uppercase truncate">{s.plantName}</TableCell>
                      <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs">{s.shipmentId}</TableCell>
                      <TableCell className="px-4 text-center whitespace-nowrap text-slate-500 font-bold">{formatSafeDate(s.creationDate, 'dd/MM/yy HH:mm')}</TableCell>
                      <TableCell className="px-4 text-center font-black text-slate-900 uppercase tracking-tighter">{s.vehicleNumber || '--'}</TableCell>
                      <TableCell className="px-4 text-center font-mono font-bold text-slate-400">{s.driverMobile || '--'}</TableCell>
                      <TableCell className="px-4 text-center font-bold text-slate-800">{s.invoiceNumber || '--'}</TableCell>
                      <TableCell className="px-4 text-center font-bold text-slate-800">{s.ewaybillNumber || '--'}</TableCell>
                      <TableCell className="px-4 text-center">
                        {s.lrNumber ? (
                            <button onClick={() => openLRPrint(s)} className="font-black text-blue-700 hover:underline underline-offset-4 decoration-blue-200">
                                {s.lrNumber}
                            </button>
                        ) : '--'}
                      </TableCell>
                      <TableCell className="px-4 text-center whitespace-nowrap text-slate-500">{formatSafeDate(s.lrDate, 'dd/MM/yy')}</TableCell>
                      <TableCell className="px-4 truncate font-bold text-slate-800 uppercase">{s.consignor}</TableCell>
                      <TableCell className="px-4 truncate font-bold text-slate-800 uppercase">{s.billToParty}</TableCell>
                      <TableCell className="px-4 truncate font-medium text-slate-500 italic">"{s.itemDescription || '--'}"</TableCell>
                      <TableCell className="px-4 text-center font-black text-slate-900">{s.totalUnits || '0'}</TableCell>
                      <TableCell className="px-4 text-right font-black text-blue-900">{s.quantity.toFixed(3)}</TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 h-6 border shadow-sm", getStatusColor(s.currentStatusId))}>
                            {s.currentStatusId}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-8 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEdit} onClick={() => onEdit(s)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    {!canEdit && (
                                        <TooltipContent className="bg-slate-900 text-white font-black uppercase text-[10px]">Registry Locked</TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-block">
                                            <DeleteShipmentConfirmationDialog onConfirm={() => onDelete(s.id)} shipment={s} disabled={!canCancel}>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" disabled={!canCancel}>
                                                    <Ban className="h-4 w-4" />
                                                </Button>
                                            </DeleteShipmentConfirmationDialog>
                                        </div>
                                    </TooltipTrigger>
                                    {!canCancel && (
                                        <TooltipContent className="bg-slate-900 text-white font-black uppercase text-[10px]">Revocation Restricted</TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="p-8 bg-slate-50 border-t flex items-center justify-between">
            <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                canPreviousPage={currentPage > 1}
                canNextPage={currentPage < totalPages}
                itemCount={filteredShipments.length}
            />
        </div>
      </CardContent>
      {previewLr && <LRPrintPreviewModal isOpen={!!previewLr} onClose={() => setPreviewLr(null)} lr={previewLr} />}
    </Card>
  );
}