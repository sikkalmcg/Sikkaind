'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-0">
          <div className="p-6 bg-amber-50 flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-full"><AlertTriangle className="h-6 w-6 text-amber-600" /></div>
            <div>
              <DialogTitle className="font-black text-amber-900 uppercase tracking-tight">{title}</DialogTitle>
              <DialogDescription className="text-xs text-amber-700 font-medium mt-1">{message}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="p-4 bg-slate-50 border-t flex-row justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>No, Review</Button>
          <Button onClick={onConfirm} className="bg-blue-900 hover:bg-slate-900 text-white gap-2 font-bold px-6">
            <CheckCircle2 className="h-4 w-4" /> Yes, Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
