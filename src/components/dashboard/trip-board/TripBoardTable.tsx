'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Eye, 
    Navigation, 
    Edit2, 
    MoreHorizontal,
    Truck,
    RotateCcw,
    Trash2,
    FileText
} from 'lucide-react';
import { cn, parseSafeDate } from '@/lib/utils';
import { format } from 'date-fns';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuPortal
} from '@/components/ui/dropdown-menu';

interface TripBoardTableProps {
  data: any[];
  activeTab: string;
  isAdmin: boolean;
  onAction: (type: string, trip: any) => void;
}

const getStatusColor = (status: string) => {
    const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
    switch(s) {
        case 'assigned':
        case 'vehicle-assigned': return 'bg-blue-500/10 text-blue-700 border-blue-200';
        case 'loaded':
        case 'loading-complete': return 'bg-orange-500/10 text-orange-700 border-orange-200';
        case 'in-transit': return 'bg-purple-500/10 text-purple-700 border-indigo-200';
        case 'arrived': return 'bg-teal-500/10 text-teal-700 border-teal-200';
        case 'delivered': return 'bg-green-500/10 text-green-700 border-green-200';
        case 'rejected': return 'bg-red-500/10 text-red-700 border-red-200';
        case 'closed': return 'bg-slate-900 text-white border-none';
        default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
}

const formatDate = (date: any) => {
    if (!date) return '--';
    const d = parseSafeDate(date);
    return d ? format(d, 'dd/MM/yy HH:mm') : '--';
};

const cleanName = (name?: string) => {
    if (!name) return '--';
    return name.split('@')[0].toUpperCase();
};

export default function TripBoardTable({ 
    data, 
    activeTab, 
    isAdmin,
    onAction 
}: TripBoardTableProps) {
  
  const LRButton = ({ row }: { row: any }) => {
    if (!row.lrNumber) return <span>--</span>;
    return (
        <button 
            type="button"
            onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                onAction('view-lr', row); 
            }} 
            className="font-black text-blue-700 hover:underline text-[11px] uppercase tracking-tighter transition-all active:scale-95"
        >
            {row.lrNumber}
        </button>
    );
  };

  if (activeTab === 'closed') {
    return (
        <div className="overflow-x-auto">
            <Table className="border-collapse w-full min-w-[4500px] table-fixed">
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                    <TableRow className="h-14 hover:bg-transparent text-[10px] font-black uppercase text-slate-500">
                        <TableHead className="px-6 w-32">Plant</TableHead>
                        <TableHead className="px-4 w-36">Order No.</TableHead>
                        <TableHead className="px-4 w-40">Order Creator</TableHead>
                        <TableHead className="px-4 w-48">Consignor</TableHead>
                        <TableHead className="px-4 w-48">Consignee</TableHead>
                        <TableHead className="px-4 w-48">Ship To Party</TableHead>
                        <TableHead className="px-4 w-64">Route Registry</TableHead>
                        <TableHead className="px-4 w-36">Vehicle No</TableHead>
                        <TableHead className="px-4 w-36">Pilot Mobile</TableHead>
                        <TableHead className="px-4 w-36 text-center">Fleet Type</TableHead>
                        <TableHead className="px-4 w-48">Vendor Name</TableHead>
                        <TableHead className="px-4 w-40">Assigned User</TableHead>
                        <TableHead className="px-4 w-48">Invoice No</TableHead>
                        <TableHead className="px-4 w-40">Ewaybill No</TableHead>
                        <TableHead className="px-4 w-32 text-center">Unit-UOM</TableHead>
                        <TableHead className="px-4 w-32 text-right">Qty-UOM</TableHead>
                        <TableHead className="px-4 w-36 text-center">LR Number</TableHead>
                        <TableHead className="px-4 w-32 text-center">LR Date</TableHead>
                        <TableHead className="px-4 w-40 text-center">Assigned At</TableHead>
                        <TableHead className="px-4 w-40 text-center">Gate Out At</TableHead>
                        <TableHead className="px-4 w-40 text-center">Arrived At</TableHead>
                        <TableHead className="px-4 w-40 text-center">Unloaded At</TableHead>
                        <TableHead className="px-4 w-40 text-center text-red-600">Reject At</TableHead>
                        <TableHead className="px-4 w-40 text-center text-blue-600">Re-sent At</TableHead>
                        <TableHead className="px-4 w-40">Resent User</TableHead>
                        <TableHead className="px-4 w-36">SRN Number</TableHead>
                        <TableHead className="px-4 w-32 text-center">SRN Date</TableHead>
                        <TableHead className="px-4 w-40">SRN User</TableHead>
                        <TableHead className="px-4 w-32 text-center">POD Status</TableHead>
                        <TableHead className="px-4 w-40">POD Operator</TableHead>
                        <TableHead className="px-4 w-32 text-center bg-blue-50/50">Dispatch (Hr)</TableHead>
                        <TableHead className="px-4 w-32 text-center bg-blue-50/50">Transit (Hr)</TableHead>
                        <TableHead className="px-4 w-32 text-center bg-blue-50/50">Unload (Hr)</TableHead>
                        <TableHead className="px-8 w-32 text-right sticky right-0 bg-slate-50 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow><TableCell colSpan={34} className="h-64 text-center text-slate-400 italic">No historical records matching registry scope.</TableCell></TableRow>
                    ) : (
                        data.map((row) => (
                            <TableRow key={row.id} className="h-16 border-b border-slate-100 last:border-0 hover:bg-blue-50/20 transition-all group text-[11px] font-medium text-slate-600">
                                <TableCell className="px-6 font-bold uppercase truncate">{row.plantName}</TableCell>
                                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs">{row.orderNo}</TableCell>
                                <TableCell className="px-4 font-bold uppercase text-[10px] text-slate-400 truncate">{cleanName(row.orderCreatedUser)}</TableCell>
                                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-xs" title={row.consignor}>{row.consignor}</TableCell>
                                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-xs" title={row.consignee}>{row.consignee}</TableCell>
                                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-xs" title={row.shipToParty}>{row.shipToParty}</TableCell>
                                <TableCell className="px-4 truncate font-black text-slate-900 uppercase text-xs">{row.loadingPoint} → {row.unloadingPoint}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{row.vehicleNumber}</TableCell>
                                <TableCell className="px-4 font-mono font-bold text-slate-400">{row.driverMobile || '--'}</TableCell>
                                <TableCell className="px-4 text-center"><Badge variant="outline" className="text-[9px] font-black uppercase bg-slate-50">{row.fleetType}</Badge></TableCell>
                                <TableCell className="px-4 font-bold text-slate-700 uppercase truncate">{row.vendorName}</TableCell>
                                <TableCell className="px-4 font-black text-blue-900 uppercase text-[10px]">{cleanName(row.assignedUsername)}</TableCell>
                                <TableCell className="px-4 truncate font-bold text-slate-800">{row.invoiceNumbers}</TableCell>
                                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase">{row.ewaybillNumber}</TableCell>
                                <TableCell className="px-4 text-center font-black text-slate-900">{row.unitUom}</TableCell>
                                <TableCell className="px-4 text-right font-black text-blue-900">{row.qtyUom}</TableCell>
                                <TableCell className="px-4 text-center">
                                    <LRButton row={row} />
                                </TableCell>
                                <TableCell className="px-4 text-center text-slate-500 font-bold whitespace-nowrap text-[11px]">{formatDate(row.lrDate)}</TableCell>
                                <TableCell className="px-4 text-center text-slate-500 font-bold whitespace-nowrap">{formatDate(row.assignedDateTime)}</TableCell>
                                <TableCell className="px-4 text-center text-slate-500 font-bold whitespace-nowrap">{formatDate(row.gateOutDateTime)}</TableCell>
                                <TableCell className="px-4 text-center text-slate-500 font-bold whitespace-nowrap">{formatDate(row.arrivedDateTime)}</TableCell>
                                <TableCell className="px-4 text-center text-slate-500 font-bold whitespace-nowrap">{formatDate(row.unloadDateTime)}</TableCell>
                                <TableCell className="px-4 text-center text-red-600 font-bold whitespace-nowrap">{formatDate(row.rejectDateTime)}</TableCell>
                                <TableCell className="px-4 text-center text-blue-600 font-bold whitespace-nowrap">{formatDate(row.resentDateTime)}</TableCell>
                                <TableCell className="px-4 font-black text-slate-400 uppercase text-[10px]">{cleanName(row.resentUsername)}</TableCell>
                                <TableCell className="px-4 font-black text-blue-900 uppercase font-mono">{row.srnNumber}</TableCell>
                                <TableCell className="px-4 text-center text-slate-500 font-bold whitespace-nowrap">{formatDate(row.srnDate)}</TableCell>
                                <TableCell className="px-4 font-black text-slate-400 uppercase text-[10px]">{cleanName(row.srnUsername)}</TableCell>
                                <TableCell className="px-4 text-center">
                                    <Badge className={cn("text-[9px] font-black uppercase h-6 px-3 border-none", row.podStatus === 'Received' ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
                                        {row.podStatus}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-4 font-black text-slate-400 uppercase text-[10px]">{cleanName(row.podUpdateUsername)}</TableCell>
                                <TableCell className="px-4 text-center font-black text-blue-900 bg-blue-50/20">{row.dispatchHour}</TableCell>
                                <TableCell className="px-4 text-center font-black text-blue-900 bg-blue-50/20">{row.transitHour}</TableCell>
                                <TableCell className="px-4 text-center font-black text-blue-900 bg-blue-50/20">{row.unloadHour}</TableCell>
                                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/20 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white text-slate-400 hover:text-blue-900"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-slate-200 shadow-2xl z-[100] bg-white">
                                                <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400 px-2 pb-2">Archived Node</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => onAction('view', row)} className="gap-3 font-bold py-2.5 rounded-lg cursor-pointer hover:bg-blue-50"><Eye className="h-4 w-4 text-blue-600" /> View Summary</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onAction('edit-lr', row)} className="gap-3 font-bold py-2.5 rounded-lg cursor-pointer hover:bg-blue-50"><FileText className="h-4 w-4 text-orange-600" /> Correct LR manifest</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="border-collapse w-full min-w-[2500px] table-fixed">
        <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
          <TableRow className="h-14 hover:bg-transparent">
            <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500 w-32">Plant</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36 text-center">LR No</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36 text-center">LR Date</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36">Trip ID</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36">Vehicle No</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-48">Consignor</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-48">Consignee</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-64">Item Description</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-40">Destination</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-32 text-right font-black">Weight (MT)</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-40 text-center">Trip Status</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-8 text-right sticky right-0 bg-slate-50 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] w-48">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                No records detected in {activeTab} view.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.id} className="h-16 border-b border-slate-100 last:border-0 hover:bg-blue-50/20 transition-all group text-[11px] font-medium text-slate-600">
                <TableCell className="px-6 font-bold text-slate-600 uppercase truncate">{row.plantName}</TableCell>
                <TableCell className="px-4 text-center">
                    <LRButton row={row} />
                </TableCell>
                <TableCell className="px-4 text-center text-slate-500 font-bold whitespace-nowrap text-[11px]">
                    {row.lrDate ? format(new Date(row.lrDate), 'dd/MM/yy') : '--'}
                </TableCell>
                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs uppercase">{row.tripId}</TableCell>
                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{row.vehicleNumber}</TableCell>
                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-xs" title={row.consignor}>{row.consignor}</TableCell>
                <TableCell className="px-4 truncate font-medium text-slate-500 uppercase text-xs">{row.consignee}</TableCell>
                <TableCell className="px-4 truncate font-bold text-slate-700 uppercase italic text-[10px]">"{row.itemDescription || '--'}"</TableCell>
                <TableCell className="px-4 truncate font-black text-slate-900 uppercase text-xs">{row.unloadingPoint}</TableCell>
                <TableCell className="px-4 text-right font-black text-blue-900 text-xs">{(Number(row.dispatchedQty) || 0).toFixed(3)} MT</TableCell>
                <TableCell className="px-4 text-center">
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 h-6 border shadow-sm", getStatusColor(row.tripStatus))}>
                        {row.tripStatus}
                    </Badge>
                </TableCell>
                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/20 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                    <div className="flex justify-end items-center gap-2">
                        {activeTab === 'transit' && (
                            <Button size="sm" onClick={() => onAction('arrived', row)} className="h-8 bg-blue-900 hover:bg-black text-white font-black text-[9px] uppercase px-4 rounded-lg">Arrived</Button>
                        )}
                        {activeTab === 'arrived' && (
                            <>
                                <Button size="sm" onClick={() => onAction('unloaded', row)} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase px-4 rounded-lg">Unloaded</Button>
                                <Button size="sm" onClick={() => onAction('reject', row)} className="h-8 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] uppercase px-4 rounded-lg">Reject</Button>
                            </>
                        )}
                        {activeTab === 'pod-status' && (
                            <Button size="sm" onClick={() => onAction('pod-status', row)} className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] uppercase px-4 rounded-lg">POD Status</Button>
                        )}
                        {activeTab === 'rejection' && (
                            <>
                                <Button size="sm" onClick={() => onAction('re-sent', row)} className="h-8 bg-orange-500 hover:bg-orange-600 text-white font-black text-[9px] uppercase px-4 rounded-lg gap-1"><RotateCcw size={12}/> Re-sent</Button>
                                <Button size="sm" onClick={() => onAction('srn', row)} className="h-8 bg-slate-900 hover:bg-black text-white font-black text-[9px] uppercase px-4 rounded-lg">SRN</Button>
                            </>
                        )}

                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white text-slate-400 hover:text-blue-900"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-slate-200 shadow-2xl z-[100] bg-white">
                                    <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400 px-2 pb-2">Registry Control</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => onAction('view', row)} className="gap-3 font-bold py-2.5 rounded-lg cursor-pointer hover:bg-blue-50"><Eye className="h-4 w-4 text-blue-600" /> View Mission</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onAction('track', row)} className="gap-3 font-bold py-2.5 rounded-lg cursor-pointer hover:bg-blue-50"><Navigation className="h-4 w-4 text-emerald-600" /> Track GIS</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onAction('edit-lr', row)} className="gap-3 font-bold py-2.5 rounded-lg cursor-pointer hover:bg-blue-50"><FileText className="h-4 w-4 text-orange-600" /> Edit LR manifest</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onAction('edit-vehicle', row)} className="gap-3 font-bold py-2.5 rounded-lg cursor-pointer hover:bg-blue-50"><Truck className="h-4 w-4 text-slate-600" /> Correct Vehicle</DropdownMenuItem>
                                    {isAdmin && <DropdownMenuItem onClick={() => onAction('cancel', row)} className="gap-3 font-bold py-2.5 text-red-600 rounded-lg cursor-pointer hover:bg-red-50"><Trash2 className="h-4 w-4" /> Purge Mission</DropdownMenuItem>}
                                </DropdownMenuContent>
                            </DropdownMenuPortal>
                        </DropdownMenu>
                    </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
