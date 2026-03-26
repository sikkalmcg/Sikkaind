'use client';

import { useState, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { History, User, AlertCircle, Edit2, Search, FileDown, PlusCircle, MinusCircle, CheckCircle2, Trash2 } from 'lucide-react';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';

const ITEMS_PER_PAGE = 10;

interface TaskHistoryTableProps {
    data: any[];
    isAdmin: boolean;
    onRemove: (taskId: string, plantId: string) => Promise<void>;
}

/**
 * Registry Logic: Safe Date Handshake
 * Ensures Firestore Timestamps or raw date nodes are formatted without crashing.
 */
const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    try {
        // Case 1: Firestore Timestamp instance
        if (date instanceof Timestamp) return date.toDate();
        
        // Case 2: JavaScript Date instance
        if (date instanceof Date) return isValid(date) ? date : null;

        // Case 3: Firestore-like object { seconds: ..., nanoseconds: ... }
        if (typeof date === 'object' && date !== null && typeof date.seconds === 'number') {
            return new Date(date.seconds * 1000);
        }

        // Case 4: String or number that can be parsed by new Date()
        const d = new Date(date);
        return isValid(d) ? d : null;
    } catch (e) {
        return null;
    }
};

const formatSafeDate = (date: any, pattern: string) => {
    const d = getSafeDate(date);
    if (!d) return '--:--';
    return format(d, pattern);
};

export default function TaskHistoryTable({ data, isAdmin, onRemove }: TaskHistoryTableProps) {
    const { toast } = useToast();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = useMemo(() => {
        if (!data) return [];
        const s = searchTerm.toLowerCase();
        return data.filter(item => {
            return (
                item.tripId?.toLowerCase().includes(s) ||
                item.vehicleNumber?.toLowerCase().includes(s) ||
                item.driverMobile?.includes(s) ||
                item.from?.toLowerCase().includes(s) ||
                item.shipTo?.toLowerCase().includes(s) ||
                item.destination?.toLowerCase().includes(s) ||
                item.supervisor?.toLowerCase().includes(s) ||
                item.remarks?.toLowerCase().includes(s)
            );
        });
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredData.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredData, currentPage]);

    const handleExport = useCallback(() => {
        if (filteredData.length === 0) {
            toast({ variant: 'destructive', title: "No Data", description: "Registry is empty for current search." });
            return;
        }

        const dataToExport = filteredData.map(row => {
            const slips = row.loadingSlips || [];
            return {
                'Timestamp': formatSafeDate(row.timestamp, 'dd-MMM-yyyy HH:mm'),
                'Plant ID': row.plantId,
                'Purpose': row.purpose,
                'Vehicle Number': row.vehicleNumber,
                'Pilot Mobile': row.driverMobile || '--',
                'From': row.from || '--',
                'Ship To': row.shipTo || '--',
                'Destination': row.destination || '--',
                'Assigned Qty': row.assignedQty || '--',
                'Delivery No': slips.map((s: any) => s.slipNo).join(', '),
                'Invoice Numbers': slips.map((s: any) => s.invoiceNo).filter(Boolean).join(', '),
                'Delivery Unit': row.totalDeliveryUnit || row.totalSlipQty || '--',
                'Load Unit': row.totalLoadUnit || row.totalLoadQty || '--',
                'Balance Unit': row.totalBalanceUnit || row.totalBalanceQty || '--',
                'Unload Qty': row.unloadQty || '--',
                'Short/Excess': row.shortExcess || '--',
                'Supervisor': row.supervisor,
                'Remarks': row.remarks || '--'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Supervisor Task History");
        XLSX.writeFile(workbook, `Supervisor_Tasks_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
        
        toast({ title: "Ledger Exported", description: "Excel manifest downloaded successfully." });
    }, [filteredData, toast]);

    return (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-slate-400" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase text-slate-700 tracking-tight">Supervisor Registry history</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Audit trail of completed loading & unloading tasks</CardDescription>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                            <Input 
                                placeholder="Search across page..." 
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="pl-10 h-10 w-[300px] rounded-xl bg-white border-slate-200 shadow-sm font-bold focus-visible:ring-blue-900"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExport} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
                            <FileDown className="h-4 w-4" /> Export Ledger
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className="border-collapse w-full min-w-[2200px]">
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="h-12 border-b border-slate-100 hover:bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <TableHead className="px-6">Timestamp</TableHead>
                                <TableHead className="px-4">Plant</TableHead>
                                <TableHead className="px-4 text-center">Purpose</TableHead>
                                <TableHead className="px-4">Vehicle No.</TableHead>
                                <TableHead className="px-4">Pilot Detail</TableHead>
                                <TableHead className="px-4">FROM</TableHead>
                                <TableHead className="px-4">Ship to party</TableHead>
                                <TableHead className="px-4 text-right">Assigned Qty</TableHead>
                                <TableHead className="px-4">Delivery No</TableHead>
                                <TableHead className="px-4">Invoice Nos</TableHead>
                                <TableHead className="px-4 text-right">Delivery Unit</TableHead>
                                <TableHead className="px-4 text-right">Load Unit</TableHead>
                                <TableHead className="px-4 text-right">Balance Unit</TableHead>
                                <TableHead className="px-4 text-right">Unload Qty</TableHead>
                                <TableHead className="px-4 text-center">Short / Excess</TableHead>
                                <TableHead className="px-4">Supervisor</TableHead>
                                <TableHead className="px-6 text-right sticky right-0 bg-slate-50/50">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow><TableCell colSpan={17} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No task records found in registry.</TableCell></TableRow>
                            ) : (
                                paginatedData.map((row) => {
                                    const isOutward = row.purpose === 'Loading';
                                    const slips = row.loadingSlips || [];
                                    const slipNos = slips.map((s: any) => s.slipNo).join(', ') || '--';
                                    const invNos = slips.map((s: any) => s.invoiceNo).filter(Boolean).join(', ') || '--';
                                    
                                    return (
                                        <TableRow key={row.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group text-[11px] font-medium text-slate-600">
                                            <TableCell className="px-6 whitespace-nowrap font-bold text-slate-400 font-mono">
                                                {formatSafeDate(row.timestamp, 'dd/MM/yy HH:mm')}
                                            </TableCell>
                                            <TableCell className="px-4 font-black text-slate-900 uppercase">{row.plantId}</TableCell>
                                            <TableCell className="px-4 text-center">
                                                <Badge variant="outline" className={cn("text-[9px] uppercase font-black px-2 py-0.5", isOutward ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                                    {row.purpose}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-4 font-black text-slate-900 tracking-tighter uppercase text-[13px]">{row.vehicleNumber}</TableCell>
                                            <TableCell className="px-4 font-mono text-xs font-bold text-slate-500">{row.driverMobile}</TableCell>
                                            <TableCell className="px-4 truncate max-w-[150px] uppercase font-bold text-slate-500 italic">"{row.from}"</TableCell>
                                            <TableCell className="px-4 truncate max-w-[150px] font-bold text-slate-800 uppercase">{row.shipTo}</TableCell>
                                            <TableCell className="px-4 text-right font-black text-blue-900">{row.assignedQty || '--'}</TableCell>
                                            <TableCell className="px-4 truncate max-w-[120px] font-mono font-bold text-blue-600">{slipNos}</TableCell>
                                            <TableCell className="px-4 truncate max-w-[120px] font-mono text-slate-400">{invNos}</TableCell>
                                            <TableCell className="px-4 text-right font-bold">{isOutward ? (row.totalDeliveryUnit || row.totalSlipQty)?.toFixed(3) : '--'}</TableCell>
                                            <TableCell className="px-4 text-right font-black text-blue-900">{isOutward ? (row.totalLoadUnit || row.totalLoadQty)?.toFixed(3) : '--'}</TableCell>
                                            <TableCell className="px-4 text-right">
                                                {isOutward && Number(row.totalBalanceUnit || row.totalBalanceQty) > 0.001 ? (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="cursor-help font-black text-red-600 underline decoration-red-200 decoration-dashed underline-offset-4">
                                                                    {(row.totalBalanceUnit || row.totalBalanceQty)?.toFixed(3)}
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-slate-900 text-white p-3 border-none shadow-2xl rounded-xl max-w-xs">
                                                                <p className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2"><AlertCircle className="h-3 w-3 text-red-400" /> Discrepancy Remark</p>
                                                                <p className="text-xs font-medium italic leading-relaxed">"{row.remarks || 'No justification provided.'}"</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : isOutward ? '0.000' : '--'}
                                            </TableCell>
                                            <TableCell className="px-4 text-right font-black text-blue-900 bg-blue-50/10">
                                                {!isOutward ? row.unloadQty?.toFixed(3) : '--'}
                                            </TableCell>
                                            <TableCell className="px-4 text-center">
                                                {!isOutward ? (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className={cn(
                                                                    "inline-flex items-center gap-2 px-3 py-1 rounded-full border shadow-sm cursor-help transition-transform hover:scale-105",
                                                                    Math.abs(row.shortExcess || 0) < 0.001 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                                    row.shortExcess < 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-red-50 text-red-700 border-red-200"
                                                                )}>
                                                                    <span className="font-black font-mono text-xs">{Math.abs(row.shortExcess || 0).toFixed(3)}</span>
                                                                    {Math.abs(row.shortExcess || 0) < 0.001 ? <CheckCircle2 className="h-3 w-3" /> : 
                                                                     row.shortExcess < 0 ? <PlusCircle className="h-3 w-3" /> : <MinusCircle className="h-3 w-3" />}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-slate-900 text-white p-3 border-none shadow-2xl rounded-xl max-w-xs">
                                                                <p className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2"><AlertCircle className="h-3 w-3 text-amber-400" /> Receipt Audit Remark</p>
                                                                <p className="text-xs font-medium italic leading-relaxed">"{row.remarks || 'No justification provided.'}"</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : '--'}
                                            </TableCell>
                                            <TableCell className="px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center"><User className="h-3 w-3 text-slate-400" /></div>
                                                    <span className="font-black text-slate-900 uppercase text-[10px]">{row.supervisor}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-6 text-right sticky right-0 bg-white group-hover:bg-blue-50/30 transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                                <div className="flex justify-end gap-2">
                                                    {isAdmin && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 rounded-lg">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="border-none shadow-2xl">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="font-black uppercase text-red-900">Remove Task Node?</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-sm font-medium">This will permanently delete this supervisor task record from the mission registry.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 border-t flex-row justify-end gap-3">
                                                                    <AlertDialogCancel className="font-bold border-slate-200 rounded-xl px-8 h-10 m-0">Abort</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => onRemove(row.id, row.originPlantId)} className="bg-red-600 hover:bg-red-700 font-black uppercase text-[10px] tracking-widest px-8">Confirm Remove</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
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
                <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
                    <Pagination 
                        currentPage={currentPage}
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                        itemCount={filteredData.length}
                        canPreviousPage={currentPage > 1}
                        canNextPage={currentPage < totalPages}
                    />
                </div>
            </CardContent>
        </Card>
    );
}