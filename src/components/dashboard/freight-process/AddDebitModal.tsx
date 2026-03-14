
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Wallet, ShieldCheck, Loader2, MinusCircle, AlertTriangle } from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, arrayUnion, serverTimestamp, runTransaction } from "firebase/firestore";
import HeaderSummary from './HeaderSummary';
import ConfirmationModal from './ConfirmationModal';

const formSchema = z.object({
  debitAmount: z.coerce.number().positive("Debit amount must be positive"),
  debitType: z.enum(['Shortage', 'Damage', 'Others'], { required_error: "Type is required" }),
  remark: z.string().optional(),
});

export default function AddDebitModal({ isOpen, onClose, trip, onSuccess }: { isOpen: boolean; onClose: () => void; trip: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [showConfirm, setShowConfirm] = useState(false);

  const freightData = trip.freightData || { totalFreightAmount: 0, paidAmount: 0, advanceAmount: 0 };
  const currentPayable = (freightData.totalFreightAmount || 0) - (freightData.paidAmount || 0) - (freightData.advanceAmount || 0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { debitAmount: 0, debitType: 'Others', remark: '' },
  });

  const { watch, handleSubmit } = form;
  const debitAmount = watch('debitAmount');

  const updatedTotalFreight = (freightData.totalFreightAmount || 0) - (debitAmount || 0);
  const updatedNetPayable = Math.max(0, currentPayable - (debitAmount || 0));

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (values.debitAmount > currentPayable) {
        toast({ variant: 'destructive', title: 'Limit Exceeded', description: 'Debit amount cannot exceed remaining freight payable amount.' });
        return;
    }
    setShowConfirm(true);
  };

  const handlePost = async () => {
    if (!firestore || !user) return;
    const values = form.getValues();
    try {
        await runTransaction(firestore, async (transaction) => {
            const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
            const globalTripRef = doc(firestore, 'trips', trip.id);
            const freightRef = doc(firestore, `plants/${trip.originPlantId}/freights`, `fr-${trip.id}`);
            
            const currentName = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
            const timestamp = serverTimestamp();

            const newCharge = {
                id: `deb-${Date.now()}`,
                amount: values.debitAmount,
                type: 'Debit',
                debitType: values.debitType,
                remark: values.remark || '',
                postedBy: currentName,
                postedAt: new Date()
            };

            transaction.update(freightRef, {
                totalFreightAmount: updatedTotalFreight,
                balanceAmount: updatedNetPayable,
                lastUpdated: timestamp,
                charges: arrayUnion(newCharge)
            });

            const tripUpdate = {
                lastUpdated: timestamp,
                isFreightPosted: true
            };

            transaction.update(tripRef, tripUpdate);
            transaction.update(globalTripRef, tripUpdate);
        });

        toast({ title: "Debit Posted", description: "Financial adjustment successfully completed." });
        onSuccess();
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Post Failed", description: e.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[60vw] h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-red-50 border-b border-red-100">
          <DialogTitle className="text-2xl font-bold text-red-900 uppercase flex items-center gap-2">
            <MinusCircle className="h-6 w-6" /> Financial Debit Registry
          </DialogTitle>
          <DialogDescription className="text-red-700 font-medium">Record shortages or damages to adjust final trip settlement.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          <HeaderSummary trip={trip} />

          <Form {...form}>
            <form className="space-y-8">
              <section className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                    <AlertTriangle className="h-4 w-4 text-red-600"/> Debit particulars
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 border rounded-xl bg-white shadow-sm border-red-100">
                  <FormField name="debitAmount" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-bold text-red-900">Debit Amount (₹) *</FormLabel>
                        <FormControl><Input type="number" {...field} className="h-11 font-black text-lg text-red-600 focus-visible:ring-red-600" /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="debitType" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Debit Reason *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {['Shortage', 'Damage', 'Others'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="remark" control={form.control} render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="font-bold text-slate-600">Adjustment Remark</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Specific reason for financial reduction..." className="resize-none h-24" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </section>

              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-8">
                <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Freight (Updated)</p>
                    <p className="text-2xl font-black text-slate-900">₹ {updatedTotalFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400">Net Payable Balance</p>
                    <p className="text-2xl font-black text-blue-900">₹ {updatedNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t">
          <Button variant="ghost" onClick={onClose}>Discard</Button>
          <Button onClick={handleSubmit(onSubmit)} className="bg-red-600 hover:bg-red-700 text-white px-10">Post Debit</Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handlePost}
        title="Confirm Debit Adjustment"
        message="Please verify debit details carefully. Once posted, financial values will be adjusted permanently. Do you want to continue?"
      />
    </Dialog>
  );
}
