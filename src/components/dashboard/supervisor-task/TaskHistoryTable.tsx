'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { History, Trash2, User, Clock, Edit2, MessageSquare, Package, MapPin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, parseSafeDate } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TaskHistoryTableProps {
    data: any[];
    isAdmin: boolean;
    onRemove: (id: string, plantId: string) => void;
    onEdit: (task: any) => void;
}

const cleanName = (name?: string) => {
    if (!name) return '--';
    return name.split('@')[0].toUpperCase();
};

/**
 * @fileOverview Supervisor Task History Table.
 * Reverted to item-level ledger to ensure every line item's invoice and delivery numbers are visible.
 */
export default function TaskHistoryTable({ data, isAdmin, onRemove, onEdit }: TaskHistoryTableProps) {
  
  const formatSafeDate = (date: any) => {
    const d = parseSafeDate(date);
    return d && isValid(d) ? format(d, 'dd/MM/yy HH:mm') : '--:--';
  };

  return (
    <div className="overflow-x-auto">
        <Table className="min-w-[2400px]">
            <TableHeader className="bg-slate-50/50">
                <TableRow className="h-14 hover:bg-transparent border-b">
                    <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400 w-48">Timestamp node</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-36">Trip ID</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-36">Vehicle</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-48">Delivery No</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-48 text-blue-600">Invoice No</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Item Description</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400 w-32">Planned Unit</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400 w-32">Load Unit</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400 w-24">UOM</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-64">Supervisor Remarks</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-40">Supervisor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400 sticky right-0 bg-slate-50/50 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] w-32">Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow><TableCell colSpan={12} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No historical records detected in registry.</TableCell></TableRow>
                ) : (
                    data.map((row, idx) => {
                        const variance = (row.loadUnit || 0) - (row.plannedUnit || 0);

                        return (
                            <TableRow key={`${row.taskId}-${idx}`} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                <TableCell className="px-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-blue-900 group-hover:text-white transition-colors">
                                            <Clock className="h-3.5 w-3.5" />
                                        </div>
                                        <span className="text-[11px] font-black text-slate-500 font-mono uppercase">{formatSafeDate(row.timestamp)}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs uppercase">{row.tripId}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{row.vehicleNumber}</TableCell>
                                <TableCell className="px-4 font-bold text-slate-900 uppercase text-[10px]">{row.deliveryNo || '--'}</TableCell>
                                <TableCell className="px-4 font-black text-blue-900 uppercase text-[10px]">{row.invoiceNo || '--'}</TableCell>
                                <TableCell className="px-4">
                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{row.itemDescription}</span>
                                </TableCell>
                                <TableCell className="px-4 text-center font-black text-slate-400 text-xs">{row.plannedUnit || 0}</TableCell>
                                <TableCell className="px-4 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className="font-black text-blue-900 text-sm">{row.loadUnit || 0}</span>
                                        {variance !== 0 && (
                                            <span className={cn(
                                                "text-[9px] font-black leading-none",
                                                variance > 0 ? "text-emerald-600" : "text-red-600"
                                            )}>
                                                {variance > 0 ? `+${variance}` : variance}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 text-center font-black text-slate-400 uppercase text-[10px]">{row.uom || '--'}</TableCell>
                                <TableCell className="px-4 italic text-slate-400 font-medium text-[10px] truncate max-w-[200px]" title={row.remarks}>
                                    {row.remarks ? `"${row.remarks}"` : '--'}
                                </TableCell>
                                <TableCell className="px-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-slate-50 border flex items-center justify-center">
                                            <User className="h-3 w-3 text-slate-400" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-700 truncate max-w-[100px]">{cleanName(row.supervisor)}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/30 transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                    <div className="flex justify-end gap-2">
                                        {isAdmin && row.isFirstOfTask && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-xl"
                                                            onClick={() => onEdit(row)}
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-slate-900 text-white text-[10px] font-black uppercase">Edit Registry Node</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        {isAdmin && row.isFirstOfTask && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl" 
                                                onClick={() => onRemove(row.taskId, row.originPlantId)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </Table>
    </div>
  );
}
