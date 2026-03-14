
'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, Ban } from 'lucide-react';

interface CancelReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export default function CancelReasonModal({ isOpen, onClose, onConfirm }: CancelReasonModalProps) {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 text-white rounded-lg shadow-sm"><Ban className="h-5 w-5" /></div>
            <DialogTitle className="text-xl font-black text-red-900 uppercase">Revoke Action Required</DialogTitle>
          </div>
          <DialogDescription className="text-red-700 font-medium">
            You are about to cancel or short-close a record. This action requires a mandatory justification.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="reason" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason for Cancellation *</Label>
                <Textarea 
                    id="reason"
                    placeholder="Provide details for this revocation..."
                    className="min-h-[120px] bg-slate-50 border-slate-200 resize-none font-medium focus-visible:ring-red-600"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100 text-[11px] text-amber-800 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>This action will be permanently recorded in the system audit log with your username.</span>
            </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t flex-row sm:justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500">Close Window</Button>
          <Button 
            disabled={!reason.trim()} 
            onClick={() => onConfirm(reason)} 
            className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest shadow-md border-none px-8"
          >
            Confirm Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
