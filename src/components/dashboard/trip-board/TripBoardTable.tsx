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
    CheckCircle2,
    XCircle,
    RotateCcw,
    ClipboardCheck,
    FileCheck,
    Ban,
    Trash2
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

export default function TripBoardTable({ 
    data, 
    activeTab, 
    isAdmin,
    onAction 
}: TripBoardTableProps) {
  
  return (
    <div className="overflow-x-auto">
      <Table className="border-collapse w-full min-w-[2500px] table-fixed">
        <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
          <TableRow className="h-14 hover:bg-transparent">
            <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500 w-32">Plant</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36">LR No</TableHead>
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
                <TableCell className="px-4 text-center font-black text-blue-700 text-[11px] uppercase tracking-tighter">{row.lrNumber || '--'}</TableCell>
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

                        <DropdownMenu modal={true}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white text-slate-400 hover:text-blue-900"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuContent align="end" className="w-52 p-2 rounded-xl border-slate-200 shadow-2xl z-[100] bg-white">
                                    <DropdownMenuLabel className="text-[9px] font-black uppercase text-slate-400">Registry Control</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => onAction('view', row)} className="gap-3 font-bold py-2.5 rounded-lg cursor-pointer"><Eye className="h-4 w-4 text-blue-600" /> View Mission</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onAction('track', row)} className="gap-3 font-bold py-2.5 rounded-lg cursor-pointer"><Navigation className="h-4 w-4 text-emerald-600" /> Track GIS</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onAction('edit-vehicle', row)} className="gap-3 font-bold py-2.5 rounded-lg cursor-pointer"><Truck className="h-4 w-4 text-slate-600" /> Correct Vehicle</DropdownMenuItem>
                                    {isAdmin && <DropdownMenuItem onClick={() => onAction('cancel', row)} className="gap-3 font-bold py-2.5 text-red-600 rounded-lg cursor-pointer"><Trash2 className="h-4 w-4" /> Purge Mission</DropdownMenuItem>}
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
