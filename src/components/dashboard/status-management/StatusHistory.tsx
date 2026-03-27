'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from "@/components/ui/card";
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { User, MapPin, Clock, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusHistoryProps {
  history: any[];
}

const getStatusColor = (status: string) => {
    const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
    switch(s) {
        case 'assigned':
        case 'vehicle-assigned': return 'bg-blue-500/10 text-blue-700 border-blue-200';
        case 'loaded':
        case 'loading-complete': return 'bg-orange-500/10 text-orange-700 border-orange-200';
        case 'in-transit': return 'bg-purple-500/10 text-purple-700 border-purple-200';
        case 'arrival-for-delivery':
        case 'arrived': return 'bg-teal-500/10 text-teal-700 border-teal-200';
        case 'delivered': return 'bg-green-500/10 text-green-700 border-green-200';
        default: return 'bg-slate-500/10 text-slate-700 border-slate-200';
    }
}

export default function StatusHistory({ history }: StatusHistoryProps) {
  return (
    <div className="rounded-[2rem] border-2 border-slate-100 shadow-xl bg-white overflow-hidden animate-in fade-in duration-500">
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b">
                    <TableRow className="h-14 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Timestamp node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Trip ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle Registry</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Previous Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">New status node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Registry Operator</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Mission Remark</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {history.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                                No status transitions detected in registry.
                            </TableCell>
                        </TableRow>
                    ) : (
                        history.map((h) => (
                            <TableRow key={h.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                <TableCell className="px-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-blue-900 group-hover:text-white transition-colors">
                                            <Clock className="h-3.5 w-3.5" />
                                        </div>
                                        <span className="text-[11px] font-black text-slate-500 font-mono">{format(h.timestamp, 'dd/MM/yy HH:mm:ss')}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs uppercase">{h.tripId}</TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{h.vehicleNumber}</TableCell>
                                <TableCell className="px-4">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase line-through opacity-50">{h.previousStatus || 'INITIAL'}</span>
                                </TableCell>
                                <TableCell className="px-4">
                                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2.5 h-6 shadow-sm border", getStatusColor(h.newStatus))}>
                                        {h.newStatus}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-slate-50 border flex items-center justify-center">
                                            <User className="h-3 w-3 text-slate-400" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-700">{h.updatedBy || 'System'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-8 italic text-slate-400 font-medium text-[11px] truncate max-w-[200px]">
                                    {h.remarks ? `"${h.remarks}"` : '--'}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}
