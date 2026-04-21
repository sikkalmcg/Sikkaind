'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';

interface Summary {
    totalFreight: number;
    advance: number;
    mode: string;
    receiver: string;
    netPayable: number;
}

export default function PostConfirmationModal({ isOpen, onClose, onConfirm, summary }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; summary: Summary }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-amber-50 border-b border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-lg shadow-sm"><AlertTriangle className="h-5 w-5" /></div>
            <DialogTitle className="text-xl font-black text-amber-900 uppercase">Review Freight Post</DialogTitle>
          </div>
          <DialogDescription className="text-amber-700 font-medium mt-2">
            Please ensure all freight details are correct before posting. Once posted, changes may be restricted.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-y-4 text-sm font-medium">
                <span className="text-slate-500">Total Freight Amount:</span>
                <span className="text-right font-bold text-slate-900">₹ {summary.totalFreight.toLocaleString('en-IN')}</span>
                
                <span className="text-slate-500">Advance Paid:</span>
                <span className="text-right font-bold text-green-600">₹ {summary.advance.toLocaleString('en-IN')}</span>
                
                <span className="text-slate-500">Payment Mode:</span>
                <span className="text-right font-bold text-slate-900 uppercase">{summary.mode}</span>
                
                <span className="text-slate-500">Receiver Name:</span>
                <span className="text-right font-bold text-slate-900">{summary.receiver}</span>

                <div className="col-span-2 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-slate-900 font-black uppercase text-xs tracking-wider">Final Net Payable:</span>
                    <span className="text-xl font-black text-blue-900 tracking-tighter">₹ {summary.netPayable.toLocaleString('en-IN')}</span>
                </div>
            </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t flex-row sm:justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500 gap-2"><ArrowLeft className="h-4 w-4"/> Back to Edit</Button>
          <Button onClick={onConfirm} className="bg-blue-900 hover:bg-slate-900 text-white font-black uppercase tracking-widest shadow-md border-none px-8 h-10 gap-2">
            <CheckCircle2 className="h-4 w-4" /> Confirm Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
