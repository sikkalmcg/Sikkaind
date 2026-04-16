
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
    FileText,
    PlusCircle
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
    onAction,
    selectedIds = [],
    onSelectRow,
    onSelectAll
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
            className="font-black text-blue-700 hover:underline text-[10px] md:text-[11px] uppercase tracking-tighter transition-all active:scale-95"
        >
            {row.lrNumber}
        </button>
    );
  };

  const isAllOnPageSelected = data.length > 0 && data.every(row => selectedIds.includes(row.id));

  if (activeTab === 'pending-assignment') {
      return (
        <div className="overflow-x-auto">
            <Table className="border-collapse w-full min-w-[1200px]">
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                    <TableRow className="h-10 md:h-12 hover:bg-transparent text-[9px] md:text-[10px] font-black uppercase text-slate-500">
                        <TableHead className="w-12 px-4 bg-slate-100">
                            <Checkbox 
                                checked={isAllOnPageSelected} 
                                onCheckedChange={(v) => onSelectAll?.(!!v)}
                                className="h-4 w-4 data-[state=checked]:bg-blue-900"
                            />
                        </TableHead>
                        <TableHead className="px-6 w-32 bg-slate-100">Plant</TableHead>
                        <TableHead className="px-4 w-36 bg-slate-100">Order ID</TableHead>
                        <TableHead className="px-4 w-48 bg-slate-100">Consignor</TableHead>
                        <TableHead className="px-4 w-48 bg-slate-100">Consignee</TableHead>
                        <TableHead className="px-4 w-48 bg-slate-100">Destination</TableHead>
                        <TableHead className="px-4 w-32 text-right bg-slate-100">Total Qty</TableHead>
                        <TableHead className="px-4 w-32 text-right bg-slate-100">Balance Qty</TableHead>
                        <TableHead className="px-4 text-center bg-slate-100">Status</TableHead>
                        <TableHead className="px-8 w-24 text-right sticky right-0 bg-slate-100 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow><TableCell colSpan={10} className="h-48 text-center text-slate-400 italic font-black uppercase tracking-widest opacity-20">No pending assignments.</TableCell></TableRow>
                    ) : (
                        data.map((row) => (
                            <TableRow key={row.id} className="h-12 md:h-14 border-b border-slate-100 last:border-0 hover:bg-blue-50/20 even:bg-slate-50/30 transition-all group text-[10px] md:text-[11px] font-medium text-slate-600">
                                <TableCell className="px-4">
                                    <Checkbox 
                                        checked={selectedIds.includes(row.id)} 
                                        onCheckedChange={(v) => onSelectRow?.(row.id, !!v)}
                                        className="h-4 w-4 data-[state=checked]:bg-blue-900"
                                    />
                                </TableCell>
                                <TableCell className="px-6 font-bold uppercase truncate">{row.plantName}</TableCell>
                                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-[10px] md:text-xs">{row.orderNo}</TableCell>
                                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-[10px] md:text-xs">{row.consignor}</TableCell>
                                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-[10px] md:text-xs">{row.billToParty}</TableCell>
                                <TableCell className="px-4 truncate font-black text-slate-900 uppercase text-[10px] md:text-xs">{row.unloadingPoint}</TableCell>
                                <TableCell className="px-4 text-right font-black text-slate-900">{row.qtyUom}</TableCell>
                                <TableCell className="px-4 text-right font-black text-orange-600 bg-orange-50/10">{row.balanceUom}</TableCell>
                                <TableCell className="px-4 text-center">
                                    <Badge variant="outline" className={cn("text-[8px] md:text-[9px] font-black uppercase px-2 h-5 md:h-6", getStatusColor(row.currentStatusId))}>{row.currentStatusId}</Badge>
                                </TableCell>
                                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/20 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                    <Button size="sm" onClick={() => onAction('assign', row)} className="h-7 md:h-8 bg-blue-900 hover:bg-black text-white font-black text-[8px] md:text-[9px] uppercase px-3 md:px-4 rounded-lg gap-1.5">
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

  return (
    <div className="overflow-x-auto">
      <Table className="border-collapse w-full min-w-[1400px]">
        <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
          <TableRow className="h-10 md:h-12 hover:bg-transparent text-[9px] md:text-[10px] font-black uppercase text-slate-500">
            <TableHead className="px-6 w-32 bg-slate-100">Plant</TableHead>
            <TableHead className="px-4 w-36 text-center bg-slate-100">LR No</TableHead>
            <TableHead className="px-4 w-32 text-center bg-slate-100">LR Date</TableHead>
            <TableHead className="px-4 w-32 bg-slate-100">Trip ID</TableHead>
            <TableHead className="px-4 w-36 bg-slate-100">Vehicle No</TableHead>
            <TableHead className="px-4 w-48 bg-slate-100">Consignor</TableHead>
            <TableHead className="px-4 w-48 bg-slate-100">Consignee</TableHead>
            <TableHead className="px-4 text-right font-black bg-slate-100 w-32">Weight (MT)</TableHead>
            <TableHead className="px-4 text-center bg-slate-100 w-40">Trip Status</TableHead>
            <TableHead className="px-8 text-right sticky right-0 bg-slate-100 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] w-24">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="h-48 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                No records detected in {activeTab} view.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.id} className="h-12 md:h-14 border-b border-slate-100 last:border-0 hover:bg-blue-50/20 transition-all group text-[10px] md:text-[11px] font-medium text-slate-600">
                <TableCell className="px-6 font-bold text-slate-600 uppercase truncate">{row.plantName}</TableCell>
                <TableCell className="px-4 text-center">
                    <LRButton row={row} />
                </TableCell>
                <TableCell className="px-4 text-center text-slate-500 font-bold whitespace-nowrap text-[10px] md:text-[11px]">
                    {row.lrDate ? format(new Date(row.lrDate), 'dd/MM/yy') : '--'}
                </TableCell>
                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-[10px] md:text-xs uppercase">{row.tripId}</TableCell>
                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{row.vehicleNumber}</TableCell>
                <TableCell className="px-4 truncate font-bold text-slate-800 uppercase text-[10px] md:text-xs" title={row.consignor}>{row.consignor}</TableCell>
                <TableCell className="px-4 truncate font-medium text-slate-500 uppercase text-[10px] md:text-xs">{row.consignee}</TableCell>
                <TableCell className="px-4 text-right font-black text-blue-900 text-[10px] md:text-xs">{(Number(row.dispatchedQty) || 0).toFixed(3)} MT</TableCell>
                <TableCell className="px-4 text-center">
                    <Badge variant="outline" className={cn("text-[8px] md:text-[9px] font-black uppercase px-2 h-5 md:h-6 border shadow-sm", getStatusColor(row.tripStatus))}>
                        {row.tripStatus}
                    </Badge>
                </TableCell>
                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/20 transition-all shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                    <div className="flex justify-end items-center gap-2">
                        {activeTab === 'transit' && (
                            <Button size="sm" onClick={() => onAction('arrived', row)} className="h-7 md:h-8 bg-blue-900 hover:bg-black text-white font-black text-[8px] md:text-[9px] uppercase px-3 md:px-4 rounded-lg">Arrived</Button>
                        )}
                        {activeTab === 'arrived' && (
                            <Button size="sm" onClick={() => onAction('unloaded', row)} className="h-7 md:h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[8px] md:text-[9px] uppercase px-3 md:px-4 rounded-lg">Unloaded</Button>
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
