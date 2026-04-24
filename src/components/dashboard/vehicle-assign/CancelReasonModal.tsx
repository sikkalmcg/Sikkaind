'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Ban, AlertTriangle, ShieldCheck, ArrowRightLeft } from 'lucide-react';

interface CancelReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title?: string;
  description?: string;
}

/**
 * @fileOverview SIKKA LMC - Universal Revocation Reason Terminal.
 * Used for short-closing orders and cancelling assignments with mandatory audit notes.
 */
export default function CancelReasonModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title = "Mission Revocation Registry",
    description = "A mandatory justification node is required to update the system audit ledger."
}: CancelReasonModalProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-8 bg-red-600 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                <Ban className="h-8 w-8 text-white" />
            </div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic leading-none">{title}</DialogTitle>
                <DialogDescription className="text-red-100 font-bold uppercase text-[9px] tracking-widest mt-2 opacity-80">Registry Security Override Active</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-8">
            <p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-4 border-red-100 pl-4">
                {description}
            </p>

            <div className="space-y-3">
                <Label htmlFor="revocation-reason" className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Mandatory Justification *</Label>
                <div className="relative group">
                    <Textarea 
                        id="revocation-reason"
                        placeholder="State reason for short-close or cancellation..." 
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        className="resize-none rounded-2xl border-slate-200 font-bold p-5 shadow-inner bg-slate-50 focus-visible:ring-red-600 transition-all"
                    />
                    <div className="absolute bottom-4 right-4 opacity-10"><ArrowRightLeft className="h-8 w-8" /></div>
                </div>
            </div>

            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4 shadow-sm">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                    Warning: This action will permanently modify the mission lifecycle and restore order balances where applicable.
                </p>
            </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3 shrink-0">
            <Button variant="ghost" onClick={onClose} className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-8 h-11">Abort</Button>
            <Button 
                onClick={handleConfirm} 
                disabled={!reason.trim()} 
                className="bg-red-600 hover:bg-red-700 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95 disabled:grayscale disabled:opacity-30"
            >
                Confirm Revocation
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
