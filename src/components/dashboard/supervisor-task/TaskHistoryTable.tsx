'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { History, Trash2, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

export default function TaskHistoryTable({ data, isAdmin, onRemove }: { data: any[], isAdmin: boolean, onRemove: (id: string, plantId: string) => void }) {
  
  const formatSafeDate = (date: any) => {
    if (!date) return '--:--';
    let d: Date | null = null;
    
    if (date instanceof Timestamp) {
        d = date.toDate();
    } else if (date instanceof Date) {
        d = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
        const parsed = new Date(date);
        if (isValid(parsed)) d = parsed;
    }
    
    return d && isValid(d) ? format(d, 'dd/MM/yy HH:mm') : '--:--';
  };

  return (
    <div className="overflow-x-auto">
        <Table>
            <TableHeader className="bg-slate-50/50">
                <TableRow className="h-14 hover:bg-transparent border-b">
                    <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Verification Timestamp</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Trip ID</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Purpose</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-400">Manifest Weight</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-400">Actual Weight</TableHead>
                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Supervisor</TableHead>
                    {isAdmin && <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Action</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow><TableCell colSpan={isAdmin ? 8 : 7} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No historical tasks detected in registry.</TableCell></TableRow>
                ) : (
                    data.map((item) => (
                        <TableRow key={item.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                            <TableCell className="px-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-blue-900 group-hover:text-white transition-colors">
                                        <Clock className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-500 font-mono uppercase">{formatSafeDate(item.timestamp)}</span>
                                </div>
                            </TableCell>
                            <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs uppercase">{item.tripId}</TableCell>
                            <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{item.vehicleNumber}</TableCell>
                            <TableCell className="px-4 text-center">
                                <Badge variant="outline" className={cn("text-[9px] uppercase font-black px-2.5 h-6", item.purpose === 'Loading' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                    {item.purpose}
                                </Badge>
                            </TableCell>
                            <TableCell className="px-4 text-right font-bold text-slate-400">{item.assignedQty} MT</TableCell>
                            <TableCell className="px-4 text-right font-black text-blue-900">{item.actualWeight} MT</TableCell>
                            <TableCell className="px-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-slate-50 border flex items-center justify-center">
                                        <User className="h-3 w-3 text-slate-400" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-slate-700">{item.supervisor}</span>
                                </div>
                            </TableCell>
                            {isAdmin && (
                                <TableCell className="px-8 text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl" onClick={() => onRemove(item.id, item.originPlantId)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            )}
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    </div>
  );
}
