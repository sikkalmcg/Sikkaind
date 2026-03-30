
'use client';

import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileDown, Search, Ban, Edit2, FileText, Printer, PlusCircle, WifiOff } from 'lucide-react';
import { format, isValid } from 'date-fns';
import type { Shipment, Plant, Trip, WithId, Carrier, LR } from '@/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc, limit, orderBy } from 'firebase/firestore';
import DeleteShipmentConfirmationDialog from './DeleteShipmentConfirmationDialog';
import { Timestamp } from "firebase/firestore";
import { cn, normalizePlantId, parseSafeDate } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import LRPrintPreviewModal from '@/components/dashboard/lr-create/LRPrintPreviewModal';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { useLoading } from '@/context/LoadingContext';
import { useToast } from '@/hooks/use-toast';
import VehicleAssignModal from '@/components/dashboard/shipment-plan/VehicleAssignModal';

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
    lrDate?: Date | null;
    lrData?: any;
    carrierObj?: any;
    plant?: Plant;
    summarizedInvoices?: string;
    summarizedItems?: string;
    totalUnitsCount?: number;
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

const formatSafeDateString = (date: any, formatStr: string = 'dd/MM/yy') => {
    const d = parseSafeDate(date);
    if (!d) return '--';
    return format(d, formatStr);
}

export default function ShipmentData({ shipments, plants, onEdit, onDelete }: ShipmentDataProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewLr, setPreviewLr] = useState<EnrichedLR | null>(null);
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<WithId<Shipment> | null>(null);
  const [plantCarriers, setPlantCarriers] = useState<WithId<Carrier>[]>([]);
  
  const { user } = useUser();
  const firestore = useFirestore();
  const { showLoader, hideLoader } = useLoading();
  const { toast } = useToast();
  
  const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const allCarriersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "carriers")) : null, 
    [firestore]
  );
  const { data: allCarriers } = useCollection<Carrier>(allCarriersQuery);

  useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    const unsubTrips = onSnapshot(collection(firestore, "trips"), (snap) => {
        setTrips(snap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Trip>)));
        setLoading(false);
    });

    return () => unsubTrips();
  }, [firestore]);

  const enrichedShipments: EnrichedShipment[] = useMemo(() => {
    if (!allCarriers) return [];
    return shipments.map(shipment => {
        const trip = trips.find(t => t.shipmentIds && t.shipmentIds.includes(shipment.id));
        const plant = plants.find(p => normalizePlantId(p.id) === normalizePlantId(shipment.originPlantId));
        const carrier = allCarriers.find(c => c.id === trip?.carrierId || c.id === shipment.carrierId);

        // Registry Data Resolution Node
        const itemsManifest = shipment.items || [];
        const summarizedInvoices = Array.from(new Set(itemsManifest.map(i => i.invoiceNumber).filter(Boolean))).join(', ') || shipment.invoiceNumber || '--';
        const summarizedItems = Array.from(new Set(itemsManifest.map(i => i.itemDescription || i.description).filter(Boolean))).join(', ') || shipment.itemDescription || shipment.material || '--';
        const totalUnitsCount = itemsManifest.reduce((sum, i) => sum + (Number(i.units) || 0), 0) || shipment.totalUnits || 0;

        // Resolve LR Date with precedence: Trip Registry > Shipment Registry
        const resolvedLrDate = parseSafeDate(trip?.lrDate || shipment.lrDate);

        return {
            ...shipment,
            plant,
            plantName: plant?.name || shipment.originPlantId,
            tripId: trip?.tripId,
            vehicleNumber: trip?.vehicleNumber || shipment.vehicleNumber,
            driverMobile: trip?.driverMobile || shipment.driverMobile,
            tripStartDate: parseSafeDate(trip?.startDate),
            lrNumber: trip?.lrNumber || shipment.lrNumber,
            lrDate: resolvedLrDate,
            carrierObj: carrier,
            summarizedInvoices,
            summarizedItems,
            totalUnitsCount
        }
    });
  }, [shipments, plants, trips, allCarriers]);

  const filteredShipments = useMemo(() => {
    if (!searchTerm) return enrichedShipments;
    const s = searchTerm.toLowerCase();
    return enrichedShipments.filter(row => 
        Object.values(row).some(val => val?.toString().toLowerCase().includes(s)) ||
        row.summarizedInvoices?.toLowerCase().includes(s) ||
        row.summarizedItems?.toLowerCase().includes(s)
    );
  }, [enrichedShipments, searchTerm]);

  const paginatedShipments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredShipments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredShipments, currentPage]);

  const totalPages = Math.ceil(filteredShipments.length / ITEMS_PER_PAGE);

  const handleOpenAssignModal = (shipment: WithId<Shipment>) => {
    if (!allCarriers) return;
    const carriersForPlant = allCarriers.filter(c => normalizePlantId(c.plantId) === normalizePlantId(shipment.originPlantId));
    setPlantCarriers(carriersForPlant);
    setSelectedShipment(shipment);
    setAssignModalOpen(true);
  };

  const handleExport = () => {
    const dataToExport = filteredShipments.map(s => ({
        'Plant': s.plantName,
        'Order ID': s.shipmentId,
        'Order Date': formatSafeDateString(s.creationDate, 'dd/MM/yy HH:mm'),
        'Vehicle Number': s.vehicleNumber || '--',
        'Pilot Mobile': s.driverMobile || '--',
        'Invoice Number': s.summarizedInvoices || '--',
        'E-Waybill Number': s.ewaybillNumber || '--',
        'LR Number': s.lrNumber || '--',
        'LR Date': formatSafeDateString(s.lrDate, 'dd-MM-yyyy'),
        'Item Description': s.summarizedItems || '--',
        'Total Units': s.totalUnitsCount || '--',
        'FROM': s.loadingPoint || s.plantName,
        'Consignor': s.consignor || 'N/A',
        'Bill to Party': s.billToParty || 'N/A',
        'Ship to Party': s.shipToParty || 'N/A',
        'Destination': s.unloadingPoint || 'N/A',
        'Order Qty': s.materialTypeId === 'FTL' ? '1 Load' : `${s.quantity.toFixed(3)} ${s.materialTypeId}`,
        'Status': s.currentStatusId,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Order Ledger Registry");
    XLSX.writeFile(workbook, `Order_Ledger_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const openLRPrint = async (e: React.MouseEvent, row: EnrichedShipment) => {
    e.preventDefault();
    e.stopPropagation();

    if (!row.lrNumber || !firestore) return;
    showLoader();
    try {
        const plantId = normalizePlantId(row.originPlantId);
        const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
        
        let q = query(lrsRef, where("lrNumber", "==", row.lrNumber), limit(1));
        let snap = await getDocs(q);
        
        if (snap.empty) {
            const manifestItems = row.items && row.items.length > 0 ? row.items : [{
                invoiceNumber: row.invoiceNumber || 'NA',
                ewaybillNumber: row.ewaybillNumber || '',
                units: row.totalUnitsCount || 1,
                unitType: 'Package',
                itemDescription: row.summarizedItems || 'GENERAL CARGO',
                weight: row.quantity
            }];

            setPreviewLr({
                lrNumber: row.lrNumber,
                date: row.lrDate || new Date(),
                trip: row as any,
                carrier: row.carrierObj || (allCarriers || [])[0],
                shipment: row as any,
                plant: row.plant || { id: row.originPlantId, name: row.plantName },
                items: manifestItems,
                weightSelection: 'Assigned Weight',
                assignedTripWeight: row.quantity,
                from: row.loadingPoint || row.plantName || '',
                to: row.unloadingPoint || '',
                consignorName: row.consignor || '',
                consignorGtin: row.consignorGtin || '',
                buyerName: row.billToParty || '',
                buyerGtin: row.billToGtin || '',
                shipToParty: row.shipToParty || '',
                shipToGtin: row.shipToGtin || '',
                deliveryAddress: row.unloadingPoint || '',
                id: row.id
            } as any);
        } else {
            const lrDoc = snap.docs[0].data() as LR;
            setPreviewLr({
                ...lrDoc,
                id: snap.docs[0].id,
                date: parseSafeDate(lrDoc.date),
                trip: row as any,
                carrier: row.carrierObj || (allCarriers || [])[0],
                shipment: row as any,
                plant: row.plant || { id: row.originPlantId, name: row.plantName },
                // Registry Resolution Node: Force sync GSTINs from shipment if missing in LR doc
                consignorGtin: lrDoc.consignorGtin || row.consignorGtin || '',
                buyerGtin: lrDoc.buyerGtin || row.billToGtin || '',
                shipToGtin: lrDoc.shipToGtin || row.shipToGtin || '',
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
                  <TableRow key={i}><TableCell colSpan={17} className="p-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : paginatedShipments.length === 0 ? (
                <TableRow><TableCell colSpan={17} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No mission plans detected in current registry.</TableCell></TableRow>
              ) : (
                paginatedShipments.map(s => {
                  const isCancelled = s.currentStatusId?.toLowerCase() === 'cancelled';
                  const isShortClosed = s.currentStatusId?.toLowerCase() === 'short closed';
                  const canAssign = !isCancelled && !isShortClosed && (s.materialTypeId === 'FTL' ? s.assignedQty < 1 : s.balanceQty > 0);
                  const canEdit = isAdmin || (!isCancelled && !isShortClosed && (s.currentStatusId === 'pending' || s.currentStatusId === 'partly vehicle assigned'));
                  
                  return (
                    <TableRow key={s.id} className="hover:bg-blue-50/20 transition-colors h-16 border-b border-slate-100 last:border-0 group text-[11px] font-medium text-slate-600">
                      <TableCell className="px-6 font-bold text-slate-600 uppercase truncate">{s.plantName}</TableCell>
                      <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs">{s.shipmentId}</TableCell>
                      <TableCell className="px-4 text-center whitespace-nowrap text-slate-500 font-bold">{formatSafeDateString(s.creationDate, 'dd/MM/yy HH:mm')}</TableCell>
                      <TableCell className="px-4 text-center font-black text-slate-900 uppercase tracking-tighter">{s.vehicleNumber || '--'}</TableCell>
                      <TableCell className="px-4 text-center font-mono font-bold text-slate-400">{s.driverMobile || '--'}</TableCell>
                      <TableCell className="px-4 text-center font-bold text-slate-800">{s.summarizedInvoices}</TableCell>
                      <TableCell className="px-4 text-center font-bold text-slate-800">{s.ewaybillNumber || '--'}</TableCell>
                      <TableCell className="px-4 text-center">
                        {s.lrNumber ? (
                            <button 
                                type="button" 
                                onClick={(e) => openLRPrint(e, s)} 
                                className="font-black text-blue-700 hover:underline underline-offset-4 decoration-blue-200 uppercase text-[11px]"
                            >
                                {s.lrNumber}
                            </button>
                        ) : '--'}
                      </TableCell>
                      <TableCell className="px-4 text-center whitespace-nowrap text-slate-500">{formatSafeDateString(s.lrDate, 'dd/MM/yy')}</TableCell>
                      <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-xs" title={s.consignor}>{s.consignor}</TableCell>
                      <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-xs" title={s.billToParty}>{s.billToParty}</TableCell>
                      <TableCell className="px-4 truncate font-medium text-slate-500 italic">"{s.summarizedItems}"</TableCell>
                      <TableCell className="px-4 text-center font-black text-slate-900">{s.totalUnitsCount}</TableCell>
                      <TableCell className="px-4 text-right font-black text-blue-900">
                        {s.materialTypeId === 'FTL' ? '1 LOAD' : s.quantity.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 h-6 border shadow-sm", getStatusColor(s.currentStatusId))}>
                            {s.currentStatusId}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-8 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" disabled={!canAssign} onClick={() => handleOpenAssignModal(s)}>
                                            <PlusCircle className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    {!canAssign ? (
                                        <TooltipContent className="bg-slate-900 text-white font-black uppercase text-[10px]">Vehicle Allocation Blocked</TooltipContent>
                                    ) : <TooltipContent className="bg-slate-900 text-white font-black uppercase text-[10px]">Assign Vehicle</TooltipContent>}
                                </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEdit} onClick={() => onEdit(s)}>
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
                                            <DeleteShipmentConfirmationDialog onConfirm={() => onDelete(s.id)} shipment={s} disabled={!isAdmin}>
                                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" disabled={!isAdmin}>
                                                    <Ban className="h-4 w-4" />
                                                </Button>
                                            </DeleteShipmentConfirmationDialog>
                                        </div>
                                    </TooltipTrigger>
                                    {!isAdmin && (
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
      {isAssignModalOpen && selectedShipment && (
        <VehicleAssignModal 
            isOpen={isAssignModalOpen}
            onClose={() => setAssignModalOpen(false)}
            shipment={selectedShipment}
            onAssignmentComplete={() => setAssignModalOpen(false)}
            carriers={plantCarriers}
        />
      )}
    </Card>
  );
}
