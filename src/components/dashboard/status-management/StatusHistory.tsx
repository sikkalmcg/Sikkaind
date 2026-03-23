'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import type { StatusUpdate, WithId } from '@/types';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { History, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StatusHistoryProps {
  history: WithId<StatusUpdate>[];
}

const ITEMS_PER_PAGE = 10;

const getStatusBadgeStyle = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('delivered')) return 'bg-emerald-600 text-white border-transparent shadow-sm shadow-emerald-200';
    if (s.includes('transit')) return 'bg-indigo-600 text-white border-transparent shadow-sm shadow-indigo-200';
    if (s.includes('maintenance') || s.includes('break-down')) return 'bg-red-600 text-white border-transparent shadow-sm shadow-red-200';
    if (s.includes('arrival')) return 'bg-teal-600 text-white border-transparent shadow-sm shadow-teal-200';
    if (s.includes('assigned')) return 'bg-blue-600 text-white border-transparent shadow-sm shadow-blue-200';
    if (s.includes('loaded')) return 'bg-orange-600 text-white border-transparent shadow-sm shadow-orange-200';
    return 'bg-slate-900 text-white border-transparent';
}

export default function StatusHistory({ history }: StatusHistoryProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const filteredHistory = useMemo(() => {
        if (!history) return [];
        const s = searchTerm.toLowerCase();
        return history.filter(item => 
            (item.tripId?.toLowerCase() ?? '').includes(s) ||
            (item.vehicleNumber?.toLowerCase() ?? '').includes(s) ||
            (item.shipToParty?.toLowerCase() ?? '').includes(s) ||
            (item.newStatus?.toLowerCase() ?? '').includes(s) ||
            (item.updatedBy?.toLowerCase() ?? '').includes(s) ||
            (item.remarks?.toLowerCase() ?? '').includes(s)
        );
    }, [history, searchTerm]);

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginatedHistory = filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
                            <div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900">SIKKA LMC Status Registry</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Complete audit trail of mission transitions</CardDescription>
                            </div>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                            <Input 
                                placeholder="Search registry..." 
                                value={searchTerm} 
                                onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} 
                                className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900 font-bold" 
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="hover:bg-transparent border-b border-slate-100">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-6 text-slate-400">Timestamp</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">Trip ID</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">Vehicle No.</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">Destination Context</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400 text-center">Prev Status</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400 text-center">New Status</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">Updated By</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-6 text-slate-400">Remarks</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!history ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={8} className="p-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                    ))
                                ) : paginatedHistory.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium">No transition records found in current registry scope.</TableCell></TableRow>
                                ) : (
                                    paginatedHistory.map(item => (
                                        <TableRow key={item.id} className="h-16 hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0 group">
                                            <TableCell className="px-6">
                                                <span className="text-[11px] font-black text-slate-500 font-mono">{format(new Date(item.timestamp), 'dd/MM/yy HH:mm:ss')}</span>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <span className="font-black text-blue-700 font-mono text-[11px] uppercase tracking-widest">{item.tripId || '--'}</span>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <Badge variant="outline" className="font-black uppercase tracking-tighter border-slate-200 text-slate-900 bg-white shadow-sm">
                                                    {item.vehicleNumber || '--'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <div className="flex flex-col min-w-[150px]">
                                                    <span className="text-[11px] font-black text-slate-800 uppercase truncate">{item.shipToParty || '--'}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{item.unloadingPoint || '--'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 text-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase italic">{item.previousStatus || 'INIT'}</span>
                                            </TableCell>
                                            <TableCell className="px-4 text-center">
                                                <Badge className={cn("text-[9px] font-black uppercase px-3 py-1 border-none shadow-sm", getStatusBadgeStyle(item.newStatus))}>
                                                    {item.newStatus || '--'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">{item.updatedBy || 'System'}</span>
                                            </TableCell>
                                            <TableCell className="px-6">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <p className="text-[11px] font-medium text-slate-500 truncate max-w-[200px] cursor-help italic">
                                                                {item.remarks ? `"${item.remarks}"` : '--'}
                                                            </p>
                                                        </TooltipTrigger>
                                                        {item.remarks && <TooltipContent className="bg-slate-900 text-white border-none p-3 max-w-xs rounded-xl shadow-2xl"><p className="text-xs font-medium leading-relaxed">{item.remarks}</p></TooltipContent>}
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            
            <div className="bg-white border border-slate-200 rounded-[1.5rem] px-8 py-3 shadow-md flex items-center justify-between">
                <Pagination 
                    currentPage={currentPage} 
                    totalPages={totalPages} 
                    onPageChange={setCurrentPage} 
                    itemCount={filteredHistory.length}
                    canPreviousPage={currentPage > 1}
                    canNextPage={currentPage < totalPages}
                />
            </div>
        </div>
    );
}
