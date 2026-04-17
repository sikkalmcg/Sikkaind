
'use client';

import React from 'react';
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
    Package
} from 'lucide-react';
import { cn, parseSafeDate } from '@/lib/utils';
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
        case 'partly vehicle assigned': return 'bg-orange-500/10 text-orange-700 border-orange-200';
        case 'assigned': 
        case 'vehicle assigned': return 'bg-blue-500/10 text-blue-700 border-blue-200';
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
 * @fileOverview Mission Registry Card Node.
 * High-density UI node for monitoring mission status across all operational tabs.
 */
function MissionRegistryCard({ row, activeTab, isAdmin, onAction }: { row: any, activeTab: string, isAdmin: boolean, onAction: (type: string, trip: any) => void }) {
    const formattedDate = row.startDate ? format(new Date(row.startDate), 'dd MMM') : '--';
    const statusTime = row.lastUpdated ? format(new Date(row.lastUpdated), 'dd MMM, hh:mm aa') : '--';
    
    // REGISTRY RULE: Remove Edit LR for tabs after In-Transit
    const tabsAfterTransit = ['arrived', 'pod-status', 'rejection', 'closed'];
    const canEditLR = !tabsAfterTransit.includes(activeTab);

    return (
        <div className="bg-white border border-slate-200 rounded-[1.5rem] mb-6 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group">
            {/* 1. PRIMARY MANIFEST ROW */}
            <div className="grid grid-cols-1 md:grid-cols-10 gap-3 p-5 pb-3 bg-white">
                <div className="col-span-1 space-y-1">
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-tighter">#{row.tripId}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{formattedDate}</p>
                </div>
                
                <div className="col-span-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-700 uppercase truncate" title={row.consignor}>{row.consignor}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 truncate pl-3 uppercase italic">"{row.from}"</p>
                </div>

                <div className="col-span-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-700 uppercase truncate" title={row.consignee}>{row.consignee}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 truncate pl-3 uppercase italic">"{row.unloadingPoint}"</p>
                </div>

                <div className="col-span-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase leading-tight line-clamp-2">{row.carrier || row.transporterName || 'Self Registry'}</span>
                </div>

                <div className="col-span-1 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 rounded-lg"><Truck className="h-3.5 w-3.5 text-blue-600" /></div>
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">{row.vehicleNumber}</span>
                </div>

                <div className="col-span-1 flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5 text-slate-300" />
                    <span className="text-[10px] font-mono font-bold text-slate-700">{row.driverMobile || '--'}</span>
                </div>

                <div className="col-span-1">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-blue-800 truncate" title={row.invoiceNumbers}>{row.invoiceNumbers}</span>
                        <span className="text-[8px] font-bold text-slate-300 uppercase">INVOICES</span>
                    </div>
                </div>

                <div className="col-span-1 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-orange-400" />
                    <span className="text-[10px] font-black text-slate-900 uppercase">{row.lrNumber || '--'}</span>
                </div>

                <div className="col-span-2 text-right">
                    <p className="text-[13px] font-black text-slate-900 tracking-tighter">{row.qtyUom}</p>
                    <Badge variant="outline" className="text-[8px] font-black uppercase px-2 h-4 border-slate-100 bg-slate-50 text-slate-400">NODE: {row.material || 'CARGO'}</Badge>
                </div>
            </div>

            {/* 2. REGISTRY METADATA ROW */}
            <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-6 text-[10px] font-bold text-slate-500 bg-slate-50/40 border-y border-slate-100">
                <div className="flex items-center gap-10">
                    <div className="flex flex-col">
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none">Sales Order No</span>
                        <span className="text-blue-900 font-black tracking-tight">{row.orderNo}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none">Route Distance</span>
                        <span className="text-slate-900 font-bold">{row.distance || '--'} KMS</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none">Payment Term</span>
                        <span className="text-slate-700 font-black uppercase">{row.paymentTerm}</span>
                    </div>
                </div>

                <div className="flex items-center gap-10">
                    {activeTab === 'transit' && (
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none">Expected arrival (STA)</span>
                            <span className="text-blue-600 font-black uppercase">{row.staDate || 'TBD'}</span>
                        </div>
                    )}
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest leading-none">Assigned Operator</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <User size={10} className="text-slate-300" />
                            <span className="text-[10px] font-black text-slate-600 uppercase">@{row.assignedUsername?.split('@')[0]}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. ACTION TERMINAL ROW */}
            <div className="p-3 px-5 flex items-center justify-between bg-white">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-[9px] h-6 font-black uppercase tracking-tighter px-4 border shadow-sm", getStatusColor(row.tripStatus))}>
                            {row.tripStatus}
                        </Badge>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-slate-400 leading-none">Registry Update</span>
                            <span className="text-[10px] font-bold text-slate-500">{statusTime}</span>
                        </div>
                    </div>
                    <Separator orientation="vertical" className="h-5 bg-slate-100" />
                    <div className="flex items-center gap-4 opacity-30 group-hover:opacity-100 transition-all duration-500">
                        <Activity size={14} className="text-slate-400 hover:text-blue-600 cursor-help" title="Mission Telemetry" />
                        <History size={14} className="text-slate-400 hover:text-blue-600 cursor-help" title="Registry History" />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* CONTEXTUAL ACTION NODES */}
                    {activeTab === 'open-order' && (
                        <Button size="sm" onClick={() => onAction('vehicle-in', row)} className="h-9 px-6 bg-blue-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Vehicle IN</Button>
                    )}
                    {activeTab === 'loading' && (
                        <Button size="sm" onClick={() => onAction('vehicle-out', row)} className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Vehicle OUT</Button>
                    )}
                    {activeTab === 'transit' && (
                        <>
                            <Button variant="outline" size="sm" onClick={() => onAction('pod-upload', row)} className="h-9 px-5 border-slate-200 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-slate-50">Upload POD</Button>
                            <Button size="sm" onClick={() => onAction('arrived', row)} className="h-9 px-8 bg-blue-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/10">Arrived In</Button>
                        </>
                    )}
                    {activeTab === 'arrived' && (
                        <>
                            <Button variant="outline" size="sm" onClick={() => onAction('pod-upload', row)} className="h-9 px-5 border-slate-200 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-slate-50">Upload POD</Button>
                            <Button size="sm" onClick={() => onAction('unloaded', row)} className="h-9 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Mark Unloaded</Button>
                        </>
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
                                <DropdownMenuItem onClick={() => onAction('view', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50"><Eye className="h-4 w-4 text-blue-600" /> View Mission</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction('track', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50"><Navigation className="h-4 w-4 text-emerald-600" /> Track GIS</DropdownMenuItem>
                                {canEditLR && (
                                    <DropdownMenuItem onClick={() => onAction('edit-lr', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50"><FileText className="h-4 w-4 text-orange-600" /> Edit LR manifest</DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => onAction('edit-vehicle', row)} className="gap-3 font-bold py-2.5 rounded-xl cursor-pointer hover:bg-blue-50"><Edit2 className="h-4 w-4 text-blue-400" /> Correct Vehicle</DropdownMenuItem>
                                {isAdmin && (
                                    <>
                                        <DropdownMenuSeparator className="bg-slate-50" />
                                        <DropdownMenuItem onClick={() => onAction('cancel', row)} className="gap-3 font-bold py-2.5 text-red-600 rounded-xl cursor-pointer hover:bg-red-50"><Ban className="h-4 w-4" /> Purge Mission</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenuPortal>
                    </DropdownMenu>
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
  
  const isAllOnPageSelected = data.length > 0 && data.every(row => selectedIds.includes(row.id));

  // --- PENDING ASSIGNMENT Table View ---
  if (activeTab === 'pending-assignment') {
      return (
        <div className="overflow-x-auto">
            <Table className="border-collapse w-full min-w-[1200px]">
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                    <TableRow className="h-10 md:h-12 hover:bg-transparent text-[9px] md:text-[10px] font-black uppercase text-slate-500">
                        <TableHead className="w-12 px-4 bg-slate-100 align-middle">
                            <Checkbox 
                                checked={isAllOnPageSelected} 
                                onCheckedChange={(v) => onSelectAll?.(!!v)}
                                className="h-4 w-4 data-[state=checked]:bg-blue-900 border-slate-300"
                            />
                        </TableHead>
                        <TableHead className="px-6 w-32 bg-slate-100 align-middle">Plant</TableHead>
                        <TableHead className="px-4 w-36 bg-slate-100 align-middle">Sales Order No</TableHead>
                        <TableHead className="px-4 w-48 bg-slate-100 align-middle">Consignor</TableHead>
                        <TableHead className="px-4 w-48 bg-slate-100 align-middle">Consignee</TableHead>
                        <TableHead className="px-4 w-48 bg-slate-100 align-middle">Destination</TableHead>
                        <TableHead className="px-4 w-32 text-right bg-slate-100 align-middle">Order Qty</TableHead>
                        <TableHead className="px-4 w-32 text-right bg-slate-100 align-middle">Balance Qty</TableHead>
                        <TableHead className="px-4 text-center bg-slate-100 align-middle">Status</TableHead>
                        <TableHead className="px-8 w-24 text-right sticky right-0 bg-slate-100 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] align-middle">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow><TableCell colSpan={10} className="h-64 text-center text-slate-400 italic font-black uppercase tracking-widest opacity-20">No pending assignments.</TableCell></TableRow>
                    ) : (
                        data.map((row) => (
                            <TableRow key={row.id} className="h-12 md:h-14 border-b border-slate-100 last:border-0 hover:bg-blue-50/20 even:bg-slate-50/30 transition-all group text-[10px] md:text-[11px] font-medium text-slate-600">
                                <TableCell className="px-4 align-middle">
                                    <Checkbox 
                                        checked={selectedIds.includes(row.id)} 
                                        onCheckedChange={(checked) => onSelectRow?.(row.id, !!checked)}
                                        className="h-4 w-4 data-[state=checked]:bg-blue-900 border-slate-300"
                                    />
                                </TableCell>
                                <TableCell className="px-6 font-bold uppercase truncate align-middle">{row.plantName}</TableCell>
                                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-[10px] md:text-xs align-middle">{row.orderNo}</TableCell>
                                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-[10px] md:text-xs align-middle">{row.consignor}</TableCell>
                                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-[10px] md:text-xs align-middle">{row.billToParty}</TableCell>
                                <TableCell className="px-4 truncate font-black text-slate-900 uppercase text-[10px] md:text-xs align-middle">{row.unloadingPoint}</TableCell>
                                <TableCell className="px-4 text-right font-black text-slate-900 align-middle">{row.qtyUom}</TableCell>
                                <TableCell className="px-4 text-right font-black text-orange-600 bg-orange-50/10 align-middle">{row.balanceUom}</TableCell>
                                <TableCell className="px-4 text-center align-middle">
                                    <Badge variant="outline" className={cn("text-[8px] md:text-[9px] font-black uppercase px-2.5 h-5 md:h-6", getStatusColor(row.currentStatusId))}>{row.currentStatusId}</Badge>
                                </TableCell>
                                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/20 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.02)] align-middle">
                                    <Button size="sm" onClick={() => onAction('assign', row)} className="h-7 md:h-8 bg-blue-900 hover:bg-black text-white font-black text-[8px] md:text-[9px] uppercase px-3 md:px-4 rounded-lg gap-1.5 border-none shadow-md transition-all active:scale-95">
                                        <PlusCircle size={10}/> Assign
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
      );
  }

  // --- GLOBAL CARD VIEW Node ---
  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-700">
        {data.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center bg-white border-2 border-slate-100 rounded-[2.5rem] border-dashed">
                <div className="p-4 bg-slate-50 rounded-2xl mb-4"><Package className="h-10 w-10 text-slate-200" /></div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">No mission nodes found in {activeTab.toUpperCase()} registry.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-1">
                {data.map((row) => (
                    <MissionRegistryCard key={row.id} row={row} activeTab={activeTab} isAdmin={isAdmin} onAction={onAction} />
                ))}
            </div>
        )}
    </div>
  );
}
