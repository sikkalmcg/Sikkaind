'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { History, FileText, ShieldCheck, Clock } from 'lucide-react';
import type { Activity, SubUser, WithId } from '@/types';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: { user: WithId<SubUser>, date: Date, logs: Activity[] };
}

export default function ActivityLogModal({ isOpen, onClose, data }: ActivityLogModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[3rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0 pr-12">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-5">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3">
                    <History className="h-8 w-8 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none">Activity Investigation Node</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-2">
                        User: {data.user.fullName} (@{data.user.username}) | Registry Date: {format(data.date, 'dd MMMM yyyy')}
                    </DialogDescription>
                </div>
            </div>
            <Badge className="bg-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] px-6 h-10 border-none">Verified Audit trail</Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-[#f8fafc] p-8">
            <div className="h-full rounded-[2.5rem] border-2 border-slate-100 bg-white shadow-xl overflow-hidden flex flex-col">
                <div className="p-6 bg-slate-50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-blue-900" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mission logs manifest</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black bg-white">{data.logs.length} ENTRIES FOUND</Badge>
                </div>
                
                <ScrollArea className="flex-1">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white z-10 border-b-2">
                            <TableRow className="h-12 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Timestamp node</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">T-Code</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Page Node</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Registry Action</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.logs.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-64 text-center text-slate-400 italic">No activity registered for this period node.</TableCell></TableRow>
                            ) : (
                                data.logs.map((log) => (
                                    <TableRow key={log.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                        <TableCell className="px-8">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-blue-900 group-hover:text-white transition-colors">
                                                    <Clock className="h-3.5 w-3.5" />
                                                </div>
                                                <span className="text-[11px] font-black text-slate-500 font-mono uppercase">{format(log.timestamp, 'HH:mm:ss')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 font-mono font-bold text-blue-700 text-xs">{log.tcode}</TableCell>
                                        <TableCell className="px-4 font-black text-slate-900 uppercase text-[10px] tracking-tight">{log.pageName}</TableCell>
                                        <TableCell className="px-4">
                                            <Badge variant="outline" className="text-[9px] font-black uppercase px-2.5 h-6 bg-slate-50 border-slate-200">{log.action}</Badge>
                                        </TableCell>
                                        <TableCell className="px-8 text-slate-600 text-xs font-medium italic">"{log.description}"</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t shrink-0 flex-row justify-end gap-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-auto flex items-center gap-2 italic">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Authorized Audit Sync: Optimal
            </p>
            <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                Close Investigation
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}