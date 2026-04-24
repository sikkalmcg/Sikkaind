'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
    Eye, 
    Navigation, 
    Edit2, 
    MoreHorizontal,
    Truck,
    RotateCcw,
    Trash2,
    FileText,
    PlusCircle,
    MapPin,
    User,
    UserCircle,
    Phone,
    ClipboardCheck,
    Calendar,
    ArrowRight,
    Clock,
    Activity,
    Smartphone,
    History,
    FileCheck,
    ArrowRightLeft,
    Ban,
    ChevronRight,
    Package,
    Weight,
    Factory,
    ShieldCheck,
    X,
    Filter,
    ArrowUpDown,
    Upload,
    XCircle,
    Signal,
    Loader2,
    Plus,
    AlertTriangle,
    MessageSquare
} from 'lucide-react';
import { cn, parseSafeDate, normalizePlantId } from '@/lib/utils';
import { format, isValid, differenceInHours } from 'date-fns';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuPortal
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { fetchWheelseyeLocation } from '@/app/actions/wheelseye';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { DEFAULT_LMC_TERMS } from '@/lib/constants';

interface TripBoardTableProps {
  data: any[];
  activeTab: string;
  isAdmin: boolean;
  isReadOnly?: boolean;
  onAction: (type: string, trip: any) => void;
  selectedIds?: string[];
  onSelectRow?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
}

const getStatusColor = (status: string) => {
    const s = status?.toLowerCase().replace(/[\s/_-]+/g, '-') || '';
    switch(s) {
        case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
        case 'partly-vehicle-assigned': return 'bg-orange-500/10 text-orange-700 border-orange-200';
        case 'assigned': 
        case 'vehicle-assigned': return 'bg-blue-50/10 text-blue-700 border-blue-200';
        case 'yard':
        case 'loading':
        case 'yard-loading':
        case 'loaded':
        case 'loading-complete': return 'bg-orange-50/10 text-orange-700 border-orange-200';
        case 'in-transit': return 'bg-purple-500/10 text-purple-700 border-indigo-200';
        case 'arrived': 
        case 'arrival-for-delivery':
        case 'arrive-for-deliver': return 'bg-teal-500/10 text-teal-700 border-teal-200';
        case 'delivered': return 'bg-green-500/10 text-green-700 border-green-200';
        case 'rejected': return 'bg-red-500/10 text-red-700 border-red-200';
        case 'closed': return 'bg-slate-900 text-white border-none';
        default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
}

function LiveLocationNode({ vehicleNo, vehicleType, onClick }: { vehicleNo: string, vehicleType: string, onClick: () => void }) {
    const [location, setLocation] = useState<{ city: string; full: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const isSimTrackMode = vehicleType === 'Market Vehicle' || vehicleType === 'Contract Vehicle';

    const syncLocation = useCallback(async () => {
        if (!vehicleNo || isSimTrackMode) return;
        setIsLoading(true);
        try {
            const res = await fetchWheelseyeLocation(vehicleNo);
            if (res && res.data && res.data.location && !res.data.location.includes('Sync...')) {
                const fullAddress = res.data.location;
                const parts = fullAddress.split(',').map((p: string) => p.trim()).filter(Boolean);
                
                setLocation({
                    city: parts[0] || 'RESOLVING...',
                    full: fullAddress
                });
            }
        } catch (e) {
            console.warn("Telemetry pulse delayed.");
        } finally {
            setIsLoading(false);
        }
    }, [vehicleNo, isSimTrackMode]);

    useEffect(() => {
        if (!isSimTrackMode) {
            syncLocation();
            const interval = setInterval(syncLocation, 30000);
            return () => clearInterval(interval);
        }
    }, [isSimTrackMode, syncLocation]);

    if (isSimTrackMode) {
        return (
            <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-5 rounded-xl gap-2 text-[10px] font-black uppercase text-blue-600 hover:bg-blue-900 hover:text-white border-2 border-blue-100 transition-all active:scale-95 shadow-sm"
                onClick={onClick}
            >
                <Signal className="h-3.5 w-3.5" /> SIM TRACK
            </Button>
        );
    }

    if (isLoading && !location) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl opacity-60">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-900" />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Resolving Node...</span>
            </div>
        );
    }

    const displayCity = location?.city || 'RESOLVING...';
    const displayFull = location?.full || 'Establishing Satellite Registry Pulse...';

    return (
        <div 
            className="group/loc relative flex items-center transition-all duration-700 ease-in-out cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
        >
            <div className={cn(
                "flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-2 border-blue-100 rounded-[1.25rem] transition-all duration-700 shadow-sm group-hover/loc:shadow-2xl group-hover/loc:border-blue-500 group-hover/loc:bg-white overflow-hidden",
                isHovered ? "max-w-[700px] pr-8" : "max-w-[160px]"
            )}>
                <div className={cn(
                    "p-1.5 rounded-lg transition-all duration-500",
                    isHovered ? "bg-blue-600 text-white rotate-45 shadow-lg" : "bg-blue-100 text-blue-600"
                )}>
                    <Navigation className="h-3.5 w-3.5 shrink-0" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className={cn(
                        "text-[11px] font-black uppercase truncate transition-colors duration-500",
                        isHovered ? "text-blue-900 whitespace-normal leading-tight" : "text-blue-700"
                    )}>
                        {isHovered ? displayFull : displayCity}
                    </span>
                    {isHovered && (
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 animate-in fade-in slide-in-from-left-2 duration-700">
                            AUTHORIZED GIS TELEMETRY HANDSHAKE
                        </span>
                    )}
                </div>
                {!isHovered && location && (
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse ml-1 shrink-0" />
                )}
            </div>
        </div>
    );
}

function MissionRegistryCard({ 
    row, 
    activeTab, 
    isAdmin, 
    isReadOnly,
    onAction,
    isSelected,
    onSelect,
    allCarriers,
    parties,
    firestore
}: { 
    row: any, 
    activeTab: string, 
    isAdmin: boolean, 
    isReadOnly?: boolean,
    onAction: (type: string, trip: any) => void,
    isSelected?: boolean,
    onSelect?: (checked: boolean) => void,
    allCarriers: any[],
    parties: any[],
    firestore: any
}) {
    const isPending = activeTab === 'pending-assignment';
    const showLrAndInvoices = ['loading', 'transit', 'arrived', 'pod-status', 'rejection', 'closed'].includes(activeTab);
    const canEditLRNode = ['loading', 'transit'].includes(activeTab) && !isReadOnly;
    
    const dateNode = isPending ? row.creationDate : row.startDate;
    const formattedDate = dateNode ? format(new Date(dateNode), 'dd MMM') : '--';
    const statusTime = row.lastUpdated ? format(new Date(row.lastUpdated), 'dd MMM, hh:mm aa') : (row.creationDate ? format(new Date(row.creationDate), 'dd MMM, hh:mm aa') : '--');
    const unloadTime = row.unloadDateTime ? format(new Date(row.unloadDateTime), 'dd MMM, hh:mm aa') : null;

    const fromCity = (row.loadingPoint || row.from || row.plantName || '').split(',')[0].trim();
    const toCity = (row.unloadingPoint || row.destination || '').split(',')[0].trim();

    const creationTime = parseSafeDate(row.creationDate);
    const ageInHours = creationTime ? differenceInHours(new Date(), creationTime) : 0;
    const isDelayed = isPending && ageInHours >= 12;

    const getFleetLabel = (type: string) => {
        const t = type?.toLowerCase() || '';
        if (t.includes('own')) return 'OWN FLEET';
        if (t.includes('contract')) return 'CONTRACT NODE';
        if (t.includes('market')) return 'MARKET NODE';
        return type?.toUpperCase() || 'UNASSIGNED';
    };

    const resolvedItemsDescription = useMemo(() => {
        const uniqueDescs = Array.from(new Set((row.items || []).map((i: any) => (i.itemDescription || i.description || '').toUpperCase().trim()).filter(Boolean)));
        if (uniqueDescs.length > 2) return "VARIOUS ITEMS AS PER INVOICE";
        return uniqueDescs.join(', ') || row.itemDescription || '--';
    }, [row.items, row.itemDescription]);

    const operatorId = (row.assignedUsername || row.orderCreatedUser || 'System');
    const displayOperator = operatorId !== '--' ? operatorId : 'System';

    const handleLRViewClick = async () => {
        if (!row.lrNumber) return;
        if (!firestore) {
            onAction('view-lr', row);
            return;
        }

        const plantId = normalizePlantId(row.originPlantId);
        const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
        const q = query(lrsRef, where("lrNumber", "==", row.lrNumber), limit(1));
        const snap = await getDocs(q);

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
                email: 'sil@sikkaenterprises.com',
                terms: DEFAULT_LMC_TERMS
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
                email: 'sil@sikkaenterprises.com',
                terms: DEFAULT_LMC_TERMS
            };
        }

        const resolveGtin = (name: string, code: string, current: string) => {
            if (current && current !== 'N/A' && current !== '') return current;
            const match = (parties || []).find(p => 
                (code && p.customerCode?.toUpperCase() === code.toUpperCase()) || 
                (p.name?.toUpperCase() === name?.toUpperCase())
            );
            return match?.gstin || '';
        };

        const consignorGtin = resolveGtin(row.consignor, row.customerCode || '', row.consignorGtin || '');
        const buyerGtin = resolveGtin(row.billToParty, row.billToCode || '', row.billToGtin || '');
        const shipToGtin = resolveGtin(row.shipToParty || '', row.shipToCode || '', row.shipToGtin || '');

        const manifestItems = row.items && row.items.length > 0 ? row.items : [{
            invoiceNumber: row.summarizedInvoices || row.invoiceNumbers || 'NA',
            ewaybillNumber: row.ewaybillNumber || '',
            units: row.totalUnitsCount || 1,
            unitType: 'Package',
            itemDescription: row.summarizedItems || row.itemDescription || 'GENERAL CARGO',
            weight: row.dispatchedQty || row.assignedQtyInTrip || row.quantity
        }];

        let enrichedLR: any;
        if (snap.empty) {
            enrichedLR = {
                lrNumber: row.lrNumber,
                date: row.lrDate || new Date(),
                trip: row as any,
                carrier: finalCarrier,
                shipment: row.shipmentObj || row,
                plant: row.plant || { id: row.originPlantId, name: row.plantName },
                items: manifestItems,
                weightSelection: 'Assigned Weight',
                assignedTripWeight: row.dispatchedQty || row.assignedQtyInTrip || row.quantity,
                from: row.from || row.shipmentObj?.loadingPoint || '',
                to: row.unloadingPoint || row.shipmentObj?.unloadingPoint || '',
                consignorName: row.consignor || shipmentObj.consignor || '',
                consignorGtin: consignorGtin,
                consignorAddress: row.consignorAddress || '',
                buyerName: row.billToParty || '',
                buyerAddress: row.billToAddress || row.deliveryAddress || row.unloadingPoint || '',
                buyerGtin: buyerGtin,
                shipToParty: row.shipToParty || row.billToParty || '',
                shipToGtin: shipToGtin,
                shipToCode: row.shipToCode || '',
                deliveryAddress: row.deliveryAddress || row.unloadingPoint || '',
                vehicleNumber: row.vehicleNumber || '--',
                driverName: row.driverName || '--',
                driverMobile: row.driverMobile || '--',
                paymentTerm: row.paymentTerm || '--',
                id: row.id
            } as any;
        } else {
            const lrDoc = snap.docs[0].data() as any;
            enrichedLR = {
                ...lrDoc,
                id: snap.docs[0].id,
                date: parseSafeDate(lrDoc.date),
                trip: row as any,
                carrier: finalCarrier,
                shipment: row.shipmentObj || row,
                plant: row.plant || { id: row.originPlantId, name: row.plantName },
                consignorGtin: lrDoc.consignorGtin || consignorGtin,
                buyerGtin: lrDoc.buyerGtin || buyerGtin,
                shipToGtin: lrDoc.shipToGtin || shipToGtin
            } as any;
        }
        onAction('view-lr-direct', enrichedLR);
    };

    return (
        <div className={cn(
            "bg-white border-2 rounded-[1.5rem] mb-6 overflow-hidden transition-all duration-300 group relative",
            isSelected ? "border-blue-600 shadow-2xl bg-blue-50/5" : "border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200"
        )}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 pb-3 items-start">
                {isPending && !isReadOnly && (
                    <div className="col-span-1 flex items-center justify-center border-r border-slate-100 pr-2 h-full">
                        <Checkbox 
                            checked={isSelected}
                            onCheckedChange={(checked) => onSelect?.(!!checked)}
                            className="h-5 w-5 data-[state=checked]:bg-blue-900 shadow-md border-slate-300"
                        />
                    </div>
                )}
                
                <div className={cn("space-y-1", (isPending && !isReadOnly) ? "col-span-1" : "col-span-1")}>
                    <p className="text-xs font-black text-blue-700 uppercase tracking-tighter">
                        {isPending ? `SO: ${row.shipmentId || 'N/A'}` : `#${row.tripId || 'N/A'}`}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                        {isPending ? formattedDate : (row.orderNo || '--')}
                    </p>
                </div>
                
                <div className={cn("space-y-1 pr-4", showLrAndInvoices ? "col-span-3" : (isPending ? "col-span-4" : "col-span-4"))}>
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-700 uppercase truncate" title={row.consignor}>{row.consignor || '--'}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                        <span className="text-[10px] font-black text-slate-800 truncate max-w-[80px]">{fromCity || '--'}</span>
                        <ArrowRight size={10} className="text-slate-300 shrink-0" />
                        <span className="text-[10px] font-black text-blue-900 truncate max-w-[120px]">{toCity || '--'}</span>
                    </div>
                </div>

                <div className={cn("space-y-1", showLrAndInvoices ? "col-span-2" : (isPending ? "col-span-3" : "col-span-3"))}>
                    <div className="flex items-center gap-2">
                        <Factory className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter truncate leading-tight">
                            {row.originPlantId || 'N/A'} <span className="text-slate-400 font-bold ml-1">{row.plantName}</span>
                        </span>
                    </div>
                    {!isPending ? (
                        <div className="flex flex-col gap-0.5 mt-1 border-l-2 border-slate-100 pl-3">
                            <span className="text-[9px] font-black text-blue-900 uppercase truncate" title={row.carrierName}>{row.carrierName || '--'}</span>
                            <div className="flex items-center gap-1.5">
                                <UserCircle className="h-2.5 w-2.5 text-slate-300 shrink-0" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase truncate" title={row.transporterName}>{row.transporterName || 'SELF REGISTRY'}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-1 flex items-center gap-2">
                            <UserCircle className="h-3 w-3 text-slate-300 shrink-0" />
                            <span className="text-[9px] font-bold text-slate-400 uppercase truncate">AWAITING ALLOCATION</span>
                        </div>
                    )}
                </div>

                <div className="col-span-2 flex flex-col justify-center">
                    {!isPending ? (
                        <>
                            <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter truncate">{row.vehicleNumber || 'PENDING'}</span>
                                {row.ewaybillNumber && row.ewaybillNumber !== '--' && (
                                    <div className="flex items-center gap-1 ml-2">
                                        <FileCheck size={12} className="text-orange-400" />
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{row.ewaybillNumber.slice(-4)}</span>
                                    </div>
                                )}
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-400 pl-6">{row.driverMobile || '--'}</span>
                        </>
                    ) : (
                        <Badge variant="outline" className="w-fit bg-slate-50 text-slate-400 border-slate-100 text-[8px] font-black uppercase whitespace-nowrap">FLEET PENDING</Badge>
                    )}
                </div>

                {showLrAndInvoices && (
                    <div className="col-span-2 flex flex-col justify-center">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">LR Number</span>
                        <div className="flex items-center gap-2">
                            {row.lrNumber ? (
                                <>
                                    <FileText className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                    <button 
                                        onClick={handleLRViewClick} 
                                        className="font-black text-blue-700 hover:underline text-[11px] uppercase tracking-tighter text-left"
                                    >
                                        {row.lrNumber}
                                    </button>
                                </>
                            ) : (
                                canEditLRNode && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100"
                                                    onClick={() => onAction('edit-lr', row)}
                                                >
                                                    <Plus size={16} className="stroke-[3]" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-slate-900 text-white text-[10px] font-black uppercase">Initialize LR Registry</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )
                            )}
                        </div>
                    </div>
                )}

                <div className={cn("flex flex-col justify-center h-full min-h-[60px]", (isPending || !showLrAndInvoices) ? "col-span-3" : "col-span-2")}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col items-start pb-1">
                            <p className="text-xl font-black text-slate-900 tracking-tighter leading-none">
                                {isPending ? (row.balanceUom || '0 MT') : (row.qtyUom || '0 MT')}
                            </p>
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] leading-none mt-2">
                                {isPending ? `TOTAL REQ: ${row.qtyUom || '0 MT'}` : `NODE: ${row.material || 'CARGO'}`}
                            </span>
                        </div>

                        {!isPending && row.vehicleType && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[8px] font-black uppercase px-3 h-5 shadow-sm rounded-lg shrink-0">
                                {getFleetLabel(row.vehicleType)}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-8 text-[10px] font-bold text-slate-500 bg-slate-50/50 border-y border-slate-100">
                <div className="flex flex-1 items-center gap-12">
                    <div className="flex flex-col min-w-[150px]">
                        <span className="text-[7px] font-black uppercase text-blue-600 tracking-widest leading-none mb-1">Ship To Party</span>
                        <span className="text-slate-900 font-black uppercase truncate max-w-[250px]">{row.shipToParty || '--'}</span>
                    </div>
                    <div className="flex flex-col min-w-[150px]">
                        <span className="text-[7px] font-black uppercase text-orange-600 tracking-widest leading-none mb-1">Invoice Number</span>
                        <span className="text-slate-900 font-black uppercase truncate max-w-[200px]" title={row.invoiceNumbers}>{row.invoiceNumbers || '--'}</span>
                    </div>
                    <div className="flex flex-col min-w-[150px]">
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Consignee Name</span>
                        <span className="text-slate-900 font-bold uppercase truncate max-w-[250px]">{row.consignee || '--'}</span>
                    </div>
                    
                    <div className="flex flex-col min-w-[150px]">
                        <span className="text-[7px] font-black uppercase text-blue-600 tracking-widest leading-none mb-1">Item Description</span>
                        <span className="text-slate-900 font-bold uppercase truncate max-w-[300px]" title={resolvedItemsDescription}>{resolvedItemsDescription}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6 border-l pl-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none">Registry operator</span>
                        <div className="flex items-center gap-1.5 mt-1">
                            <UserCircle size={10} className="text-slate-300" />
                            <span className="text-[10px] font-black text-slate-600 uppercase">@{ displayOperator?.split('@')[0]}</span>
                        </div>
                    </div>
                </div>
            </div>

            {row.delayRemark && (
                <div className="px-5 py-2.5 bg-amber-50/50 border-b border-amber-100 flex items-center gap-3">
                    <MessageSquare size={12} className="text-amber-600 shrink-0" />
                    <p className="text-[10px] font-bold text-amber-800 uppercase leading-none">
                        Delay Remark: <span className="italic font-medium text-slate-600 capitalize">"{row.delayRemark}"</span>
                    </p>
                </div>
            )}

            <div className="p-3 px-5 flex items-center justify-between bg-white">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-[9px] h-6 font-black uppercase tracking-tighter px-4 border shadow-sm", getStatusColor(row.tripStatus || row.currentStatusId))}>
                            {row.tripStatus || row.currentStatusId || 'ASSIGNED'}
                        </Badge>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-slate-400 leading-none">Registry Update</span>
                            <span className="text-[10px] font-bold text-slate-500">{statusTime}</span>
                        </div>
                        {unloadTime && (
                            <div className="flex items-center">
                                <div className="h-6 w-px bg-slate-100 mx-4" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase text-emerald-600 leading-none">Unload Time</span>
                                    <span className="text-[10px] font-black text-slate-900">{unloadTime}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {isDelayed && (
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 border border-red-100 rounded-full animate-pulse shadow-sm">
                            <AlertTriangle size={12} className="text-red-600" />
                            <span className="text-[8px] font-black uppercase text-red-700 tracking-widest">ALLOCATION DELAY: {ageInHours} HR</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-6">
                    {(activeTab === 'transit' || activeTab === 'arrived') && (
                        <LiveLocationNode 
                            vehicleNo={row.vehicleNumber} 
                            vehicleType={row.vehicleType} 
                            onClick={() => onAction('track', row)}
                        />
                    )}

                    <div className="flex items-center gap-3">
                        {isDelayed && !isReadOnly && (
                            <Button 
                                variant="outline"
                                size="sm" 
                                onClick={() => onAction('delay-remark', row)} 
                                className="h-9 px-6 border-amber-200 text-amber-700 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-amber-50 shadow-sm transition-all"
                            >
                                <MessageSquare size={14} className="mr-1.5" /> Delay Remark
                            </Button>
                        )}

                        {isPending && !isReadOnly && (
                            <Button 
                                size="sm" 
                                onClick={() => onAction('assign', row)} 
                                className="h-9 px-8 bg-blue-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all gap-2"
                            >
                                <PlusCircle size={14} /> Assign Fleet
                            </Button>
                        )}
                        
                        {activeTab === 'open-order' && !isReadOnly && (
                            <Button size="sm" onClick={() => onAction('vehicle-in', row)} className="h-9 px-6 bg-blue-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Vehicle IN</Button>
                        )}
                        {activeTab === 'loading' && !isReadOnly && (
                            <Button size="sm" onClick={() => onAction('vehicle-out', row)} className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Vehicle OUT</Button>
                        )}
                        {activeTab === 'transit' && !isReadOnly && (
                            <Button size="sm" onClick={() => onAction('arrived', row)} className="h-9 px-10 bg-blue-900 hover:bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-blue-900/10">Arrived In</Button>
                        )}
                        {activeTab === 'arrived' && !isReadOnly && (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => onAction('reject', row)} className="h-9 px-6 border-red-200 text-red-600 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-red-50 shadow-sm transition-all active:scale-95">REJECT MISSION</Button>
                                <Button size="sm" onClick={() => onAction('unloaded', row)} className="h-9 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">MARK UNLOADED</Button>
                            </div>
                        )}
                        {activeTab === 'pod-status' && !isReadOnly && (
                            <Button variant="outline" size="sm" onClick={() => onAction('pod-upload', row)} className="h-9 px-8 border-slate-200 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-slate-50 gap-2">
                                <Upload size={14} className="text-blue-600" /> Upload POD
                            </Button>
                        )}
                        {activeTab === 'rejection' && !isReadOnly && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => onAction('re-sent', row)} className="h-9 px-6 border-blue-200 text-blue-700 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-blue-50">Mission Re-sent</Button>
                                <Button size="sm" onClick={() => onAction('srn', row)} className="h-9 px-8 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">SRN Entry</Button>
                            </>
                        )}

                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all"><MoreHorizontal size={18} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-slate-200 shadow-3xl bg-white z-[100]">
                                    <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-2 pb-2">Mission Control</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => onAction(isPending ? 'view-order' : 'view', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50"><Eye className="h-4 w-4 text-blue-600" /> View Mission</DropdownMenuItem>
                                    
                                    {showLrAndInvoices && canEditLRNode && !isReadOnly && (
                                        <DropdownMenuItem onClick={() => onAction('edit-lr', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50">
                                            <FileText className="h-4 w-4 text-orange-600" /> Edit LR manifest
                                        </DropdownMenuItem>
                                    )}
                                    
                                    {!isPending && !isReadOnly && activeTab !== 'closed' && (
                                        <DropdownMenuItem onClick={() => onAction('edit-vehicle', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50">
                                            <Edit2 className="h-4 w-4 text-blue-400" /> Correct Vehicle
                                        </DropdownMenuItem>
                                    )}

                                    {activeTab === 'closed' && !isReadOnly && (
                                        <DropdownMenuItem onClick={() => onAction('pod-upload', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50">
                                            <Upload className="h-4 w-4 text-emerald-600" /> Edit POD manifest
                                        </DropdownMenuItem>
                                    )}

                                    {isAdmin && !isReadOnly && (
                                        <>
                                            <DropdownMenuSeparator className="bg-slate-50" />
                                            <DropdownMenuItem onClick={() => onAction('cancel', row)} className="gap-3 font-bold py-2.5 text-red-600 rounded-xl cursor-pointer hover:bg-red-50">
                                                <Ban className="h-4 w-4" /> Purge Mission
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenuPortal>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TripBoardTable({ 
    data, 
    activeTab, 
    isAdmin,
    isReadOnly = false,
    onAction,
    selectedIds = [],
    onSelectRow,
    onSelectAll
}: TripBoardTableProps) {
  const firestore = useFirestore();
  const allCarriersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "carriers")) : null, [firestore]);
  const { data: allCarriers } = useCollection<any>(allCarriersQuery);
  const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, [firestore]);
  const { data: parties } = useCollection<any>(partiesQuery);

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-700">
        <div className="space-y-1">
            {data.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center bg-white border-2 border-slate-100 rounded-[3rem] border-dashed">
                    <div className="p-6 bg-slate-50 rounded-[2rem] mb-6 animate-pulse">
                        <Package className="h-14 w-14 text-slate-200" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300">
                        No active mission nodes in current registry.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-0">
                    {data.map((row) => (
                        <MissionRegistryCard 
                            key={row.id} 
                            row={row} 
                            activeTab={activeTab} 
                            isAdmin={isAdmin} 
                            isReadOnly={isReadOnly}
                            onAction={onAction} 
                            isSelected={selectedIds.includes(row.id)}
                            onSelect={(checked) => onSelectRow?.(row.id, checked)}
                            allCarriers={allCarriers || []}
                            parties={parties || []}
                            firestore={firestore}
                        />
                    ))}
                </div>
            )}
        </div>
    </div>
  );
}
