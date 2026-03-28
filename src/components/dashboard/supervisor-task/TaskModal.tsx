'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Weight, Calculator, Save, AlertTriangle, Loader2 } from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { doc, serverTimestamp, collection, runTransaction } from "firebase/firestore";
import { useLoading } from '@/context/LoadingContext';

export default function TaskModal({ isOpen, onClose, task, onSuccess }: { isOpen: boolean; onClose: () => void; task: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const [actualWeight, setActualWeight] = useState(task.assignedQty || 0);

  const handleCommit = async () => {
    if (!firestore || !user) return;
    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const plantId = task.plantId;
            const historyRef = doc(collection(firestore, `plants/${plantId}/supervisor_tasks`));
            
            if (task.entryData?.id) {
                const entryRef = doc(firestore, 'vehicleEntries', task.entryData.id);
                transaction.update(entryRef, { 
                    isTaskCompleted: true, 
                    actualWeight: actualWeight,
                    taskCompletedAt: serverTimestamp(),
                    taskCompletedBy: user.displayName || user.email
                });
            }

            transaction.set(historyRef, {
                tripId: task.tripId,
                vehicleNumber: task.vehicleNumber,
                purpose: task.purpose,
                assignedQty: task.assignedQty,
                actualWeight: actualWeight,
                timestamp: serverTimestamp(),
                supervisor: user.displayName || user.email
            });
        });

        toast({ title: 'Task Verified', description: 'Manifest weight synchronized with registry.' });
        onSuccess();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    } finally {
        hideLoader();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Verify Task Weight</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Handshake Node: {task.tripId}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-8">
            <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                <div className="space-y-1">
                    <span className="text-[8px] font-black uppercase text-slate-400">Vehicle</span>
                    <p className="text-sm font-black text-slate-900">{task.vehicleNumber}</p>
                </div>
                <div className="space-y-1 text-right">
                    <span className="text-[8px] font-black uppercase text-slate-400">Purpose</span>
                    <p className="text-sm font-black text-blue-600 uppercase">{task.purpose}</p>
                </div>
            </div>

            <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Actual Manifest Weight (MT) *</Label>
                <div className="relative">
                    <Input 
                        type="number" 
                        step="0.001"
                        value={actualWeight}
                        onChange={(e) => setActualWeight(Number(e.target.value))}
                        className="h-16 rounded-2xl font-black text-blue-900 text-3xl shadow-inner border-blue-900/20 focus-visible:ring-blue-900 pl-14"
                    />
                    <Weight className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-emerald-500" />
                </div>
            </div>

            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                    Authorized Data Capture: Once committed, the task node is marked as completed in the mission registry.
                </p>
            </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t flex-row justify-end gap-4">
            <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500 uppercase text-[10px]">Discard</Button>
            <Button onClick={handleCommit} className="bg-blue-900 hover:bg-black text-white px-12 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                Commit Verification
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}