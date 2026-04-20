'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
    Loader2
} from 'lucide-react';
import { cn, parseSafeDate, normalizePlantId } from '@/lib/utils';
import { format, isValid } from 'date-fns';
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

interface TripBoardTableProps {
  data: any[];
  activeTab: string;
  isAdmin: boolean;
  onAction: (type: string, trip: any) => void;
  selectedIds?: string[];
  onSelectRow?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
}

const getStatusColor = (status: string) => {
    const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
    switch(s) {
        case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
        case 'partly-vehicle-assigned': return 'bg-orange-500/10 text-orange-700 border-orange-200';
        case 'assigned': 
        case 'vehicle-assigned': return 'bg-blue-500/10 text-blue-700 border-blue-200';
        case 'yard':
        case 'loading':
        case 'yard/loading':
        case 'loaded':
        case 'loading-complete': return 'bg-orange-500/10 text-orange-700 border-orange-200';
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

/**
 * @fileOverview Live Location Node Component.
 * Optimized GIS Handshake: Own Vehicles show live telemetry; Market/Contract show SIM TRACK.
 * Updated to display FULL physical address on hover with sliding transition.
 */
function LiveLocationNode({ vehicleNo, vehicleType, onClick }: { vehicleNo: string, vehicleType: string, onClick: () => void }) {
    const [location, setLocation] = useState<{ city: string; full: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // REGISTRY HANDSHAKE: Market & Contract vehicles utilize Sim Track node
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
            console.warn("Telemetry signal latency.");
        } finally {
            setIsLoading(false);
        }
    }, [vehicleNo, isSimTrackMode]);

    useEffect(() => {
        if (!isSimTrackMode) {
            syncLocation();
            const interval = setInterval(syncLocation, 30000); // 30s Registry Pulse
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
                "flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-2 border-blue-100 rounded-[1.25rem] transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-sm group-hover/loc:shadow-2xl group-hover/loc:border-blue-500 group-hover/loc:bg-white overflow-hidden",
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
    onAction,
    isSelected,
    onSelect
}: { 
    row: any, 
    activeTab: string, 
    isAdmin: boolean, 
    onAction: (type: string, trip: any) => void,
    isSelected?: boolean,
    onSelect?: (checked: boolean) => void
}) {
    const isPending = activeTab === 'pending-assignment';
    const dateNode = isPending ? row.creationDate : row.startDate;
    const formattedDate = dateNode ? format(new Date(dateNode), 'dd MMM') : '--';
    const statusTime = row.lastUpdated ? format(new Date(row.lastUpdated), 'dd MMM, hh:mm aa') : (row.creationDate ? format(new Date(row.creationDate), 'dd MMM, hh:mm aa') : '--');
    
    const allowedTabs = ['pending-assignment', 'open-order', 'loading'];
    const canEditLR = allowedTabs.includes(activeTab);

    const fromCity = (row.loadingPoint || row.from || row.plantName || '').split(',')[0].trim();
    const toCity = (row.unloadingPoint || row.destination || '').split(',')[0].trim();

    return (
        <div className={cn(
            "bg-white border-2 rounded-[1.5rem] mb-6 overflow-hidden transition-all duration-300 group relative",
            isSelected ? "border-blue-600 shadow-2xl bg-blue-50/5" : "border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200"
        )}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-5 pb-3">
                {isPending && (
                    <div className="col-span-1 flex items-center justify-center border-r border-slate-100 pr-2">
                        <Checkbox 
                            checked={isSelected}
                            onCheckedChange={(checked) => onSelect?.(!!checked)}
                            className="h-5 w-5 data-[state=checked]:bg-blue-900 shadow-md border-slate-300"
                        />
                    </div>
                )}
                
                <div className={cn("space-y-1", isPending ? "col-span-1" : "col-span-1")}>
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-tighter">
                        {isPending ? `SO: ${row.shipmentId}` : `#${row.tripId}`}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{formattedDate}</p>
                </div>
                
                <div className="col-span-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-700 uppercase truncate" title={row.consignor}>{row.consignor}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                        <span className="text-[10px] font-black text-slate-800">{fromCity}</span>
                        <ArrowRight size={10} className="text-slate-300" />
                        <span className="text-[10px] font-black text-blue-900">{toCity}</span>
                    </div>
                </div>

                <div className="col-span-2">
                    <div className="flex items-center gap-2">
                        <Factory className="h-3 w-3 text-slate-400" />
                        <span className="text-[9px] font-black text-slate-500 uppercase truncate leading-tight">{row.plantName || row.originPlantId}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                        <UserCircle className="h-3 w-3 text-slate-300" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{row.carrier || row.transporterName || 'AWAITING ALLOCATION'}</span>
                    </div>
                </div>

                <div className="col-span-1.5 flex flex-col justify-center">
                    {!isPending ? (
                        <>
                            <div className="flex items-center gap-2">
                                <Truck className="h-3.5 w-3.5 text-blue-600" />
                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">{row.vehicleNumber}</span>
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-400 pl-5">{row.driverMobile || '--'}</span>
                        </>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit bg-slate-50 text-slate-400 border-slate-100 text-[8px] font-black uppercase">FLEET PENDING</Badge>
                        </div>
                    )}
                </div>

                <div className="col-span-1.5 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-orange-400" />
                        {row.lrNumber ? (
                            <button 
                                onClick={() => onAction('view-lr', row)}
                                className="text-[10px] font-black text-blue-700 hover:underline uppercase tracking-tighter text-left"
                            >
                                {row.lrNumber}
                            </button>
                        ) : (
                            <span className="text-[10px] font-black text-slate-900 uppercase">--</span>
                        )}
                    </div>
                </div>

                <div className="col-span-2 text-right flex flex-col justify-center">
                    <div className="flex items-baseline justify-end gap-1">
                        <p className="text-[14px] font-black text-slate-900 tracking-tighter">
                            {isPending ? row.balanceUom : row.qtyUom}
                        </p>
                    </div>
                    <Badge variant="outline" className="w-fit ml-auto text-[8px] font-black uppercase px-2 h-4 border-slate-100 bg-slate-50 text-slate-400">
                        {isPending ? `TOTAL: ${row.qtyUom}` : `NODE: ${row.material || 'CARGO'}`}
                    </Badge>
                </div>
            </div>

            <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-8 text-[10px] font-bold text-slate-500 bg-slate-50/50 border-y border-slate-100">
                <div className="flex flex-1 items-center gap-12">
                    <div className="flex flex-col min-w-[150px]">
                        <span className="text-[7px] font-black uppercase text-blue-600 tracking-widest leading-none mb-1">Ship To Party</span>
                        <span className="text-slate-900 font-black uppercase truncate max-w-[250px]">{row.shipToParty || '--'}</span>
                    </div>
                    <div className="flex flex-col min-w-[150px]">
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Consignee Name</span>
                        <span className="text-slate-900 font-bold uppercase truncate max-w-[250px]">{row.consignee || '--'}</span>
                    </div>
                    <div className="flex flex-col min-w-[120px]">
                        <span className="text-[7px] font-black uppercase text-blue-900 tracking-widest leading-none mb-1">Invoice Numbers</span>
                        <span className="text-blue-700 font-black font-mono tracking-tighter truncate max-w-[180px]">{row.invoiceNumbers || row.summarizedInvoices || '--'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6 border-l pl-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none">Registry operator</span>
                        <div className="flex items-center gap-1.5 mt-1">
                            <User size={10} className="text-slate-300" />
                            <span className="text-[10px] font-black text-slate-600 uppercase">@{ (row.assignedUsername || row.orderCreatedUser || 'System')?.split('@')[0]}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 px-5 flex items-center justify-between bg-white">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-[9px] h-6 font-black uppercase tracking-tighter px-4 border shadow-sm", getStatusColor(row.tripStatus || row.currentStatusId))}>
                            {row.tripStatus || row.currentStatusId}
                        </Badge>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-slate-400 leading-none">Registry Update</span>
                            <span className="text-[10px] font-bold text-slate-500">{statusTime}</span>
                        </div>
                    </div>
                    <Separator orientation="vertical" className="h-5 bg-slate-100" />
                    <div className="flex items-center gap-4 opacity-30 group-hover:opacity-100 transition-all duration-500">
                        {!isPending && <History size={14} className="text-slate-400 hover:text-blue-600 cursor-help" title="Registry History" />}
                    </div>
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
                        {isPending && (
                            <Button 
                                size="sm" 
                                onClick={() => onAction('assign', row)} 
                                className="h-9 px-8 bg-blue-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all gap-2"
                            >
                                <PlusCircle size={14} /> Assign Fleet
                            </Button>
                        )}
                        
                        {activeTab === 'open-order' && (
                            <Button size="sm" onClick={() => onAction('vehicle-in', row)} className="h-9 px-6 bg-blue-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Vehicle IN</Button>
                        )}
                        {activeTab === 'loading' && (
                            <Button size="sm" onClick={() => onAction('vehicle-out', row)} className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Vehicle OUT</Button>
                        )}
                        {activeTab === 'transit' && (
                            <Button size="sm" onClick={() => onAction('arrived', row)} className="h-9 px-10 bg-blue-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-900/10">Arrived In</Button>
                        )}
                        {activeTab === 'arrived' && (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => onAction('reject', row)} className="h-9 px-6 border-red-200 text-red-600 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-red-50 shadow-sm transition-all active:scale-95">REJECT MISSION</Button>
                                <Button size="sm" onClick={() => onAction('unloaded', row)} className="h-9 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">MARK UNLOADED</Button>
                            </div>
                        )}
                        {activeTab === 'pod-status' && (
                            <Button variant="outline" size="sm" onClick={() => onAction('pod-upload', row)} className="h-9 px-8 border-slate-200 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-slate-50 gap-2">
                                <Upload size={14} className="text-blue-600" /> Upload POD
                            </Button>
                        )}
                        {activeTab === 'rejection' && (
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
                                    <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-2 pb-2">Registry Control</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => onAction(isPending ? 'view-order' : 'view', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50"><Eye className="h-4 w-4 text-blue-600" /> View Mission</DropdownMenuItem>
                                    
                                    {canEditLR && (
                                        <DropdownMenuItem onClick={() => onAction('edit-lr', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50">
                                            <FileText className="h-4 w-4 text-orange-600" /> Edit LR manifest
                                        </DropdownMenuItem>
                                    )}
                                    
                                    {!isPending && (
                                        <DropdownMenuItem onClick={() => onAction('edit-vehicle', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50">
                                            <Edit2 className="h-4 w-4 text-blue-400" /> Correct Vehicle
                                        </DropdownMenuItem>
                                    )}

                                    {isAdmin && (
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
    onAction,
    selectedIds = [],
    onSelectRow,
    onSelectAll
}: TripBoardTableProps) {

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
                            onAction={onAction} 
                            isSelected={selectedIds.includes(row.id)}
                            onSelect={(checked) => onSelectRow?.(row.id, checked)}
                        />
                    ))}
                </div>
            )}
        </div>
    </div>
  );
}
