
'use client';

import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileDown, Search, Ban, Edit2, FileText, PlusCircle, Trash2, CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';
import type { Shipment, Plant, Trip, WithId, Carrier, LR } from '@/types';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, limit } from 'firebase/firestore';
import DeleteShipmentConfirmationDialog from './DeleteShipmentConfirmationDialog';
import { cn, normalizePlantId, parseSafeDate } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import LRPrintPreviewModal from '@/components/dashboard/lr-create/LRPrintPreviewModal';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { useLoading } from '@/context/LoadingContext';
import { useToast } from '@/hooks/use-toast';
import VehicleAssignModal from '@/components/dashboard/vehicle-assign/VehicleAssignModal';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ShipmentDataProps {
  shipments: WithId<Shipment>[];
  plants: WithId<Plant>[];
  onEdit: (shipment: WithId<Shipment>) => void;
  onDelete: (shipmentId: string) => void;
  onBulkDelete?: (ids: string[]) => Promise<void>;
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

export default function ShipmentData({ shipments, plants, onEdit, onDelete, onBulkDelete }: ShipmentDataProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [previewLr, setPreviewLr] = useState<EnrichedLR | null>(null);
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<WithId<Shipment> | null>(null);
  const [plantCarriers, setPlantCarriers] = useState<WithId<Carrier>[]>([]);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
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

  const enrichedShipments: EnrichedShipment[] = useMemo((): any => {
    if (!allCarriers) return [];
    return shipments.map(shipment => {
        const trip = trips.find(t => t.shipmentIds && t.shipmentIds.includes(shipment.id));
        const plant = plants.find(p => normalizePlantId(p.id) === normalizePlantId(shipment.originPlantId));
        const carrier = allCarriers.find(c => c.id === trip?.carrierId || c.id === shipment.carrierId);

        const itemsManifest = shipment.items || [];
        const summarizedInvoices = Array.from(new Set(itemsManifest.map(i => i.invoiceNumber).filter(Boolean))).join(', ') || shipment.invoiceNumber || '--';
        const summarizedItems = Array.from(new Set(itemsManifest.map(i => i.itemDescription || i.description).filter(Boolean))).join(', ') || shipment.itemDescription || shipment.material || '--';
        const totalUnitsCount = itemsManifest.reduce((sum, i) => sum + (Number(i.units) || 0), 0) || shipment.totalUnits || 0;

        const resolvedLrDate = parseSafeDate(trip?.lrDate || shipment.lrDate);

        return {
            ...shipment,
            plant,
            plantName: plant?.name || shipment.originPlantId,
            tripId: trip?.tripId,
            vehicleNumber: trip?.vehicleNumber || shipment.vehicleNumber,
            driverName: trip?.driverName || shipment.driverName,
            driverMobile: trip?.driverMobile || shipment.driverMobile,
            tripStartDate: parseSafeDate(trip?.startDate),
            lrNumber: trip?.lrNumber || shipment.lrNumber,
            lrDate: resolvedLrDate,
            carrierObj: carrier,
            summarizedInvoices,
            summarizedItems,
            totalUnitsCount,
            vehicleType: trip?.vehicleType || shipment.materialTypeId,
            paymentTerm: trip?.paymentTerm || shipment.paymentTerm
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
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredShipments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredShipments, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage);

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
      checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const handleSelectAllOnPage = (checked: boolean) => {
    const pageIds = paginatedShipments.map(s => s.id);
    if (checked) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  const isAllOnPageSelected = paginatedShipments.length > 0 && 
    paginatedShipments.every(s => selectedIds.includes(s.id));

  const handleBulkDeleteAction = async () => {
    if (!onBulkDelete || selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
        await onBulkDelete(selectedIds);
        setSelectedIds([]);
    } finally {
        setIsBulkDeleting(false);
    }
  };

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
        'Consignor Code': s.customerCode || '--',
        'Bill to Party': s.billToParty || 'N/A',
        'Bill to Code': s.billToCode || '--',
        'Ship to Party': s.shipToParty || 'N/A',
        'Ship to Code': s.shipToCode || '--',
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
        
        const pIdStr = normalizePlantId(row.originPlantId);
        const isSikkaLmcShorthand = row.carrierName?.toLowerCase().trim() === 'sikka lmc';
        let finalCarrier: any = row.carrierObj || (allCarriers || []).find(c => c.id === row.carrierId);

        if (!finalCarrier && (pIdStr === '1426' || pIdStr === 'ID20')) {
            finalCarrier = {
                id: 'ID20',
                name: 'SIKKA LMC',
                address: '20Km. Stone, Near Tivoli Grand Resort, Khasra No. -9, G.T. Karnal Road, Jindpur, Delhi - 110036',
                mobile: '9136688004',
                gstin: '07AYQPS6936B1ZZ',
                stateCode: '07',
                stateName: 'DELHI',
                pan: 'AYQPS6936B',
                email: 'sil@sikkaenterprises.com'
            };
        } else if (!finalCarrier && (pIdStr === '1214' || pIdStr === 'ID23' || isSikkaLmcShorthand)) {
            finalCarrier = {
                id: 'ID21',
                name: 'SIKKA LMC',
                address: 'B-11, BULANDSHAHR ROAD INDLAREA, GHAZIABAD, UTTAR PRADESH, 201009',
                mobile: '9136688004',
                gstin: '09AYQPS6936B1ZV',
                stateCode: '09',
                stateName: 'UTTAR PRADESH',
                pan: 'AYQPS6936B',
                email: 'sil@sikkaenterprises.com'
            };
        }

        if (!finalCarrier) {
            finalCarrier = {
                id: 'ID20',
                name: 'SIKKA LMC',
                address: '20Km. Stone, Near Tivoli Grand Resort, Khasra No. -9, G.T. Karnal Road, Jindpur, Delhi - 110036',
                mobile: '9136688004',
                gstin: '07AYQPS6936B1ZZ',
                stateCode: '07',
                stateName: 'DELHI',
                pan: 'AYQPS6936B',
                email: 'sil@sikkaenterprises.com'
            };
        }

        const shipmentObj = row as any;

        const manifestItems = row.items && row.items.length > 0 ? row.items : [{
            invoiceNumber: row.summarizedInvoices || 'NA',
            ewaybillNumber: row.ewaybillNumber || '',
            units: row.totalUnitsCount || 1,
            unitType: 'Package',
            itemDescription: row.summarizedItems || 'GENERAL CARGO',
            weight: row.quantity
        }];

        if (snap.empty) {
            setPreviewLr({
                lrNumber: row.lrNumber,
                date: row.lrDate || new Date(),
                trip: row as any,
                carrier: finalCarrier,
                shipment: shipmentObj,
                plant: row.plant || { id: row.originPlantId, name: row.plantName },
                items: manifestItems,
                weightSelection: 'Assigned Weight',
                assignedTripWeight: row.quantity,
                from: row.loadingPoint || row.plantName || '',
                to: row.unloadingPoint || '',
                consignorName: row.consignor || '',
                consignorGtin: row.consignorGtin || '',
                consignorAddress: row.consignorAddress || '',
                consignorCode: row.customerCode || '',
                buyerName: row.billToParty || '',
                buyerAddress: row.billToAddress || row.deliveryAddress || row.unloadingPoint || '',
                buyerGtin: row.billToGtin || '',
                buyerCode: row.billToCode || '',
                shipToParty: row.shipToParty || row.billToParty || '',
                shipToGtin: row.shipToGtin || '',
                shipToCode: row.shipToCode || '',
                deliveryAddress: row.deliveryAddress || row.unloadingPoint || '',
                vehicleNumber: row.vehicleNumber || '--',
                driverName: row.driverName || '--',
                driverMobile: row.driverMobile || '--',
                paymentTerm: row.paymentTerm || '--',
                id: row.id
            } as any);
        } else {
            const lrDoc = snap.docs[0].data() as LR;
            setPreviewLr({
                ...lrDoc,
                id: snap.docs[0].id,
                date: parseSafeDate(lrDoc.date),
                trip: row as any,
                carrier: finalCarrier,
                shipment: shipmentObj,
                plant: row.plant || { id: row.originPlantId, name: row.plantName },
                consignorName: lrDoc.consignorName || row.consignor || '',
                consignorAddress: lrDoc.consignorAddress || row.consignorAddress || '',
                consignorGtin: lrDoc.consignorGtin || row.consignorGtin || '',
                consignorCode: lrDoc.consignorCode || row.customerCode || '',
                buyerName: lrDoc.buyerName || row.billToParty || '',
                buyerAddress: lrDoc.buyerAddress || row.billToAddress || row.deliveryAddress || row.unloadingPoint || '',
                buyerGtin: lrDoc.buyerGtin || row.billToGtin || '',
                buyerCode: lrDoc.buyerCode || row.billToCode || '',
                shipToParty: lrDoc.shipToParty || row.shipToParty || row.billToParty || '',
                shipToGtin: lrDoc.shipToGtin || row.shipToGtin || '',
                shipToCode: lrDoc.shipToCode || row.shipToCode || '',
                deliveryAddress: lrDoc.deliveryAddress || row.deliveryAddress || row.unloadingPoint || '',
                vehicleNumber: row.vehicleNumber || lrDoc.vehicleNumber,
                driverName: row.driverName || lrDoc.driverName,
                driverMobile: row.driverMobile || lrDoc.driverMobile,
                paymentTerm: row.paymentTerm || lrDoc.paymentTerm
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
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-lg rotate-3"><FileText className="h-6 w-6" /></div>
                <div>
                    <CardTitle className="text-xl font-black uppercase text-blue-900 italic leading-none">Order Ledger Registry</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Consolidated mission plans across authorized nodes</CardDescription>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {selectedIds.length > 0 && isAdmin && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="h-11 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-red-100 animate-in zoom-in duration-300 border-none transition-all active:scale-95">
                                <Trash2 className="h-4 w-4" /> Purge Selected ({selectedIds.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-none shadow-3xl rounded-[2rem] p-0 overflow-hidden bg-white">
                            <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><Ban className="h-8 w-8" /></div>
                                <div>
                                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tight italic text-red-900 leading-none">Bulk Mission Revocation?</AlertDialogTitle>
                                    <p className="text-red-700 font-bold uppercase text-[9px] tracking-widest mt-2">Authorized Admin Override Node</p>
                                </div>
                            </div>
                            <div className="p-10">
                                <p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-4 border-red-100 pl-4">
                                    "You are about to permanently erase <span className="font-black text-slate-900">{selectedIds.length} mission nodes</span> from the active registry. All associated vehicle allocations will be reverted and records moved to system archive. This action is irreversible."
                                </p>
                            </div>
                            <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                                <AlertDialogCancel className="font-bold border-slate-200 h-11 px-8 rounded-xl m-0">Abort</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkDeleteAction} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-10 h-11 rounded-xl shadow-lg border-none">Confirm Bulk Purge</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input
                        placeholder="Quick filter registry..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
        <div className="relative overflow-hidden">
            <div className="overflow-auto max-h-[600px] custom-scrollbar border-t">
                <Table className="border-collapse w-full min-w-[2800px] table-fixed border-separate border-spacing-0">
                    <TableHeader className="bg-slate-100 sticky top-0 z-50 shadow-[0_2px_5px_rgba(0,0,0,0.05)]">
                    <TableRow className="h-14 hover:bg-transparent border-b-2 border-slate-200">
                        {isAdmin && (
                            <TableHead className="w-16 px-6 bg-slate-100">
                                <Checkbox 
                                    checked={isAllOnPageSelected}
                                    onCheckedChange={(checked) => handleSelectAllOnPage(!!checked)}
                                    className="h-5 w-5 data-[state=checked]:bg-blue-900 shadow-md border-slate-300"
                                />
                            </TableHead>
                        )}
                        <TableHead className="text-[10px] font-black uppercase px-6 w-32 bg-slate-100">Plant</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 w-36 bg-slate-100">Order ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center w-40 bg-slate-100">Order Date</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 w-36 text-center bg-slate-100">Vehicle No</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center w-36 bg-slate-100">Pilot Mobile</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center w-36 bg-slate-100">Invoice No</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center w-36 bg-slate-100">E-Waybill No</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center w-36 bg-slate-100">LR No</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center w-36 bg-slate-100">LR Date</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 w-48 bg-slate-100">Consignor</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 w-48 bg-slate-100">Consignee</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 w-48 bg-slate-100">Item Description</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center w-24 bg-slate-100">Units</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-right w-32 bg-slate-100">Order Qty</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center w-40 bg-slate-100">Status</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-8 text-right w-32 sticky right-0 bg-slate-100 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">Action</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="h-16"><TableCell colSpan={isAdmin ? 17 : 16} className="px-6 py-2"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                        ))
                    ) : paginatedShipments.length === 0 ? (
                        <TableRow><TableCell colSpan={isAdmin ? 17 : 16} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No mission plans detected in current registry.</TableCell></TableRow>
                    ) : (
                        paginatedShipments.map(s => {
                        const isChecked = selectedIds.includes(s.id);
                        const isCancelled = s.currentStatusId?.toLowerCase() === 'cancelled';
                        const isShortClosed = s.currentStatusId?.toLowerCase() === 'short closed';
                        const canAssign = !isCancelled && !isShortClosed && (s.materialTypeId === 'FTL' ? s.assignedQty < 1 : s.balanceQty > 0);
                        const canEdit = isAdmin || (!isCancelled && !isShortClosed && (s.currentStatusId === 'pending' || s.currentStatusId === 'partly vehicle assigned'));
                        
                        return (
                            <TableRow key={s.id} className={cn(
                                "hover:bg-blue-50/20 even:bg-slate-50/50 transition-all h-16 border-b border-slate-100 last:border-0 group text-[11px] font-medium text-slate-600",
                                isChecked && "bg-blue-50/40"
                            )}>
                            {isAdmin && (
                                <TableCell className="px-6">
                                    <Checkbox 
                                        checked={isChecked}
                                        onCheckedChange={(checked) => handleSelectRow(s.id, !!checked)}
                                        className="h-5 w-5 data-[state=checked]:bg-blue-900 shadow-sm border-slate-300"
                                    />
                                </TableCell>
                            )}
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
                            <TableCell className="px-4 truncate font-medium text-slate-500 uppercase italic text-[10px]" title={s.summarizedItems}>"{s.summarizedItems}"</TableCell>
                            <TableCell className="px-4 text-center font-black text-slate-900">{s.totalUnitsCount}</TableCell>
                            <TableCell className="px-4 text-right font-black text-blue-900">
                                {s.materialTypeId === 'FTL' ? '1 LOAD' : s.quantity.toFixed(3)}
                            </TableCell>
                            <TableCell className="px-4 text-center">
                                <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2.5 h-6 border shadow-sm", getStatusColor(s.currentStatusId))}>
                                    {s.currentStatusId}
                                </Badge>
                            </TableCell>
                            <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/20 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" disabled={!canAssign} onClick={() => handleOpenAssignModal(s)}>
                                                    <PlusCircle className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-slate-900 text-white font-black uppercase text-[10px]">{!canAssign ? 'Blocked' : 'Assign Fleet'}</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={!canEdit} onClick={() => onEdit(s)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-slate-900 text-white font-black uppercase text-[10px]">Registry Lock</TooltipContent>
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
                                            <TooltipContent className="bg-slate-900 text-white font-black uppercase text-[10px]">Revocation</TooltipContent>
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
        </div>
        
        <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-10">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Rows per page:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                        <SelectTrigger className="h-9 w-[80px] rounded-xl border-slate-200 bg-white font-black text-xs shadow-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="10" className="font-bold py-2">10</SelectItem>
                            <SelectItem value="25" className="font-bold py-2">25</SelectItem>
                            <SelectItem value="50" className="font-bold py-2">50</SelectItem>
                            <SelectItem value="100" className="font-bold py-2">100</SelectItem>
                            <SelectItem value="200" className="font-bold py-2">200</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span className="text-[10px] font-black uppercase text-blue-900">{selectedIds.length} Mission Nodes Selected</span>
                        <button onClick={() => setSelectedIds([])} className="text-[10px] font-bold text-slate-400 hover:text-red-600 underline ml-2">Clear</button>
                    </div>
                )}
            </div>

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
            onClose={() => { setAssignModalOpen(false); setSelectedShipment(null); }}
            shipment={selectedShipment}
            onAssignmentComplete={() => { setAssignModalOpen(false); setSelectedShipment(null); }}
            carriers={plantCarriers}
        />
      )}
    </Card>
  );
}
