'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Eye, 
    Printer, 
    Upload, 
    Trash2, 
    Navigation, 
    Edit2, 
    CheckCircle2, 
    MoreHorizontal,
    Truck,
    Clock,
    FileText,
    MapPin,
    AlertCircle,
    Info,
    Smartphone
} from 'lucide-react';
import { cn, parseSafeDate } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';

interface TripBoardTableProps {
  data: any[];
  activeTab: string;
  isAdmin: boolean;
  canVerifyPod: boolean;
  selectedIds: string[];
  onSelectRow: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onVerifyPod: (trip: any) => void;
  onUploadPod: (trip: any) => void;
  onGenerateLR: (trip: any) => void;
  onEditLR: (trip: any) => void;
  onViewLR: (row: any) => void;
  onViewTrip: (trip: any) => void;
  onUpdatePod: (trip: any) => void;
  onCancelTrip: (trip: any) => void;
  onEditTrip: (trip: any) => void;
  onTrack: (row: any) => void;
  onEditVehicle: (trip: any) => void;
}

const getStatusColor = (status: string) => {
    const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
    switch(s) {
        case 'assigned':
        case 'vehicle-assigned': return 'bg-blue-500/10 text-blue-700 border-blue-200';
        case 'loaded':
        case 'loading-complete': return 'bg-orange-500/10 text-orange-700 border-orange-200';
        case 'in-transit': return 'bg-purple-500/10 text-purple-700 border-indigo-200';
        case 'arrived':
        case 'arrival-for-delivery': return 'bg-teal-500/10 text-teal-700 border-teal-200';
        case 'delivered': return 'bg-green-500/10 text-green-700 border-green-200';
        case 'closed': return 'bg-slate-900 text-white border-none';
        default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
}

const formatSafeDateString = (date: any, formatStr: string = 'dd/MM/yy') => {
    const d = parseSafeDate(date);
    if (!d) return '--';
    return format(d, formatStr);
}

export default function TripBoardTable({ 
    data, 
    activeTab, 
    isAdmin,
    canVerifyPod, 
    selectedIds,
    onSelectRow,
    onSelectAll,
    onVerifyPod, 
    onUploadPod, 
    onGenerateLR, 
    onEditLR,
    onViewLR, 
    onViewTrip, 
    onUpdatePod, 
    onCancelTrip, 
    onEditTrip, 
    onTrack, 
    onEditVehicle 
}: TripBoardTableProps) {
  
  const isAllSelected = data.length > 0 && data.every(item => selectedIds.includes(item.id));

  return (
    <div className="overflow-x-auto">
      <Table className="border-collapse w-full min-w-[3000px] table-fixed">
        <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
          <TableRow className="h-14 hover:bg-transparent">
            {isAdmin && (
                <TableHead className="w-16 px-6">
                    <Checkbox 
                        checked={isAllSelected}
                        onCheckedChange={(checked) => onSelectAll(!!checked)}
                        className="h-5 w-5 data-[state=checked]:bg-blue-900 shadow-md border-slate-300"
                    />
                </TableHead>
            )}
            <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500 w-32">Plant</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36">LR No</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-40 text-center">LR Date</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36">Trip ID</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-36">Vehicle No</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-48 text-center">Invoice Node</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-48">Consignor</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-48">Consignee</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-64">Item Description</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-40">Destination</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-center w-24">Units</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-32 text-right font-black">Weight (MT)</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-40 text-center">Trip Status</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500 w-40 text-center">POD Registry</TableHead>
            <TableHead className="text-[10px] font-black uppercase px-8 text-right sticky right-0 bg-slate-50 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] w-32">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isAdmin ? 16 : 15} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                No mission nodes detected in current registry view.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.id} className={cn(
                  "h-16 border-b border-slate-100 last:border-0 hover:bg-blue-50/20 transition-all group",
                  selectedIds.includes(row.id) && "bg-blue-50/40"
              )}>
                {isAdmin && (
                    <TableCell className="px-6">
                        <Checkbox 
                            checked={selectedIds.includes(row.id)}
                            onCheckedChange={(checked) => onSelectRow(row.id, !!checked)}
                            className="h-5 w-5 data-[state=checked]:bg-blue-900 shadow-sm border-slate-300"
                        />
                    </TableCell>
                )}
                <TableCell className="px-6 font-bold text-slate-600 uppercase truncate">{row.plantName}</TableCell>
                <TableCell className="px-4 text-center">
                    {row.lrNumber && row.lrNumber !== 'PENDING' ? (
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onViewLR(row);
                            }} 
                            className="font-black text-blue-700 hover:underline text-[11px] uppercase tracking-tighter"
                        >
                            {row.lrNumber}
                        </button>
                    ) : (
                        <button 
                            type="button"
                            className="h-7 text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 px-2 rounded-md hover:bg-white transition-colors" 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onGenerateLR(row);
                            }}
                        >
                            Pending
                        </button>
                    )}
                </TableCell>
                <TableCell className="px-4 text-center text-slate-500 font-bold whitespace-nowrap text-[11px]">
                    {formatSafeDateString(row.lrDate)}
                </TableCell>
                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs uppercase">{row.tripId}</TableCell>
                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{row.vehicleNumber}</TableCell>
                <TableCell className="px-4 text-center font-bold text-slate-800 text-[10px] truncate" title={row.invoiceNumbers}>
                    {row.invoiceNumbers}
                </TableCell>
                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-xs" title={row.consignor}>{row.consignor}</TableCell>
                <TableCell className="px-4 truncate font-medium text-slate-500 uppercase text-xs">{row.billToParty}</TableCell>
                <TableCell className="px-4 truncate font-bold text-slate-700 uppercase italic text-[10px]" title={row.itemDescription}>
                    "{row.itemDescription || '--'}"
                </TableCell>
                <TableCell className="px-4 truncate font-black text-slate-900 uppercase text-xs">{row.unloadingPoint}</TableCell>
                <TableCell className="px-4 text-center font-black text-slate-900 text-xs">
                    {row.lrUnits || '--'}
                </TableCell>
                <TableCell className="px-4 text-right font-black text-blue-900 text-xs">
                    {(Number(row.dispatchedQty) || Number(row.assignedQtyInTrip) || 0).toFixed(3)} MT
                </TableCell>
                <TableCell className="px-4 text-center">
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 h-6 border shadow-sm", getStatusColor(row.tripStatus || row.currentStatusId))}>
                        {row.tripStatus || row.currentStatusId}
                    </Badge>
                </TableCell>
                <TableCell className="px-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                        <Badge className={cn(
                            "text-[8px] font-black uppercase px-2 h-5 border-none shadow-sm",
                            row.podReceived ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                        )}>
                            {row.podReceived ? 'Verified' : 'Pending'}
                        </Badge>
                    </div>
                </TableCell>
                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/20 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                    <DropdownMenu modal={true}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white text-slate-400 hover:text-blue-900 transition-all"><MoreHorizontal className="h-5 w-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-slate-200 shadow-2xl">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-2 pb-2">Mission Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onViewTrip(row)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-xl hover:bg-blue-50"><Eye className="h-4 w-4 text-blue-600" /> View Mission</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onTrack(row)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-xl hover:bg-blue-50"><Navigation className="h-4 w-4 text-emerald-600" /> Track GIS</DropdownMenuItem>
                            
                            {row.lrNumber && row.lrNumber !== 'PENDING' && (
                                <DropdownMenuItem onClick={() => onEditLR(row)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-xl hover:bg-blue-50">
                                    <Edit2 className="h-4 w-4 text-amber-600" /> Edit LR Manifest
                                </DropdownMenuItem>
                            )}

                            {(!row.podReceived || canVerifyPod) && (
                                <>
                                    <DropdownMenuSeparator className="bg-slate-100" />
                                    <DropdownMenuItem onClick={() => onUploadPod(row)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-xl hover:bg-blue-50"><Upload className="h-4 w-4 text-blue-600" /> Upload POD</DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuSeparator className="bg-slate-100" />
                            <DropdownMenuItem onClick={() => onEditVehicle(row)} className="gap-3 font-bold py-2.5 cursor-pointer rounded-xl hover:bg-blue-50"><Truck className="h-4 w-4 text-slate-600" /> Correct Vehicle</DropdownMenuItem>
                            {isAdmin && (
                                <DropdownMenuItem onClick={() => onCancelTrip(row)} className="gap-3 font-bold py-2.5 text-red-600 cursor-pointer rounded-xl hover:bg-red-50"><Trash2 className="h-4 w-4" /> Purge Mission</DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
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
