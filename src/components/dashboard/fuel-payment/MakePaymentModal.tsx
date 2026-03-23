
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Loader2 } from 'lucide-react';
import type { WithId, FuelPump, FuelPayment, FuelEntry } from '@/types';
import { FuelPaymentTransactionMethods } from '@/lib/constants';
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from "firebase/firestore";

interface MakePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pump: WithId<FuelPump>;
  totalAmount: number;
  fromDate?: Date;
  toDate?: Date;
  relevantEntries: WithId<FuelEntry>[];
  onSave: (paymentData: Omit<FuelPayment, 'id'>) => void;
}

const formSchema = z.object({
  paidAmount: z.coerce.number().positive(),
  paymentMethod: z.enum(FuelPaymentTransactionMethods),
  paymentDate: z.date(),
  bankingRef: z.string().optional(),
}).superRefine((data, ctx) => {
    if ((data.paymentMethod === 'Banking' || data.paymentMethod === 'Cheque') && !data.bankingRef) {
        ctx.addIssue({ code: 'custom', message: data.paymentMethod === 'Cheque' ? 'Cheque number is required.' : 'Reference number is required.', path: ['bankingRef'] });
    }
});

type FormValues = z.infer<typeof formSchema>;

export default function MakePaymentModal({ isOpen, onClose, pump, totalAmount, fromDate, toDate, relevantEntries, onSave }: MakePaymentModalProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paidAmount: totalAmount || 0,
      paymentDate: new Date(),
      paymentMethod: 'Banking',
      bankingRef: '',
    },
  });

  const { watch, formState: { isSubmitting } } = form;
  const paymentMethod = watch('paymentMethod');
  const paidAmount = watch('paidAmount');
  const balanceAmount = totalAmount - (paidAmount || 0);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;

    try {
        const batch = writeBatch(firestore);
        const paymentId = `fpay-${Date.now()}`;
        const paymentRef = doc(firestore, "fuel_payments", paymentId);

        const paymentData: any = {
            pumpId: pump.id,
            fromDate: fromDate || new Date(),
            toDate: toDate || new Date(),
            totalAmount,
            paidAmount: values.paidAmount,
            balanceAmount: totalAmount - values.paidAmount,
            paymentMethod: values.paymentMethod,
            bankingRef: values.bankingRef || '',
            paymentDate: values.paymentDate,
            paidBy: user.email?.split('@')[0] || 'System',
            createdAt: serverTimestamp(),
        };

        batch.set(paymentRef, paymentData);

        // Update individual fuel slips
        let remainingToPay = values.paidAmount;
        const sortedSlips = [...relevantEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const slip of sortedSlips) {
            if (remainingToPay <= 0) break;

            const amountToApply = Math.min(slip.balanceAmount, remainingToPay);
            const newPaidAmount = (slip.paidAmount || 0) + amountToApply;
            const newBalanceAmount = slip.balanceAmount - amountToApply;
            
            const slipRef = doc(firestore, `plants/${slip.plantId}/fuel_entries`, slip.id);
            
            const newPaymentEntry = {
                paymentId: paymentId,
                amount: amountToApply,
                date: values.paymentDate,
                method: values.paymentMethod,
                ref: values.bankingRef || '',
            };

            batch.update(slipRef, {
                paidAmount: newPaidAmount,
                balanceAmount: newBalanceAmount,
                paymentStatus: newBalanceAmount === 0 ? 'Paid' : 'Partial',
                payments: [...(slip.payments || []), newPaymentEntry]
            });

            remainingToPay -= amountToApply;
        }

        await batch.commit();
        onSave(paymentData);
        onClose();
    } catch (error: any) {
        console.error("Payment transaction error:", error);
    }
  };

  const pumpDetails = [
    { label: "Pump Name", value: pump.name },
    { label: "Owner Name", value: pump.ownerName },
    { label: "GSTIN", value: pump.gstin },
    { label: "PAN", value: pump.pan },
    { label: "Total Pending", value: totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Process Pump Payment</DialogTitle>
          <DialogDescription>
             Clear outstanding fuel bills for period: {fromDate ? format(fromDate, 'PP') : 'N/A'} to {toDate ? format(toDate, 'PP') : 'N/A'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm p-4 border rounded-md bg-muted/50">
          {pumpDetails.map(d => (
            <div key={d.label}>
              <p className="font-medium text-muted-foreground">{d.label}</p>
              <p className="font-semibold">{d.value || 'N/A'}</p>
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
               <FormField name="paidAmount" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Paying Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormItem><FormLabel>Remaining Balance</FormLabel><Input readOnly disabled value={balanceAmount.toLocaleString('en-IN')} /></FormItem>
                 <FormField name="paymentMethod" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                        <SelectContent>{FuelPaymentTransactionMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {(paymentMethod === 'Banking' || paymentMethod === 'Cheque') && (
                    <FormField name="bankingRef" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel>{paymentMethod === 'Cheque' ? 'Cheque Number' : 'Banking Reference'}</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                )}
                 <FormField name="paymentDate" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Payment Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Process Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
