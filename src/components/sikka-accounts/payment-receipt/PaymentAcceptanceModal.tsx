'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet, ShieldCheck, CheckCircle2, AlertCircle, Calculator, Landmark } from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { doc, arrayUnion, serverTimestamp, runTransaction } from "firebase/firestore";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { DatePicker } from '@/components/date-picker';

const formSchema = z.object({
  receiptAmount: z.coerce.number().min(0, "Amount required."),
  tdsAmount: z.coerce.number().min(0).default(0),
  bankingRef: z.string().min(1, "Bank UTR is mandatory."),
  paymentAdvise: z.string().optional(),
  receiptDate: z.date({ required_error: "Receipt date required." }),
  interestAmount: z.coerce.number().min(0).default(0),
  remark: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.interestAmount > 0 && !data.remark?.trim()) {
        ctx.addIssue({ code: 'custom', message: "Remark is mandatory for interest.", path: ['remark'] });
    }
});

type FormValues = z.infer<typeof formSchema>;

export default function PaymentAcceptanceModal({ isOpen, onClose, invoice, onSuccess }: { isOpen: boolean; onClose: () => void; invoice: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { setStatusBar } = useSikkaAccountsPage();

  // Robust financial resolution nodes
  const grandTotalResolved = invoice?.totals?.grandTotal ?? invoice?.totals?.grand ?? 0;
  const taxableAmountResolved = invoice?.totals?.taxableAmount ?? invoice?.totals?.taxable ?? 0;

  const existingPayments = invoice.payments || [];
  const totalAlreadyPaid = existingPayments.reduce((sum: number, p: any) => sum + (p.receiptAmount || 0) + (p.tdsAmount || 0), 0);
  const currentRegistryBalance = grandTotalResolved - totalAlreadyPaid;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      receiptAmount: currentRegistryBalance > 0 ? currentRegistryBalance : 0,
      tdsAmount: 0,
      bankingRef: '',
      paymentAdvise: '',
      receiptDate: new Date(),
      interestAmount: 0,
      remark: ''
    },
  });

  const { watch, handleSubmit, formState: { isSubmitting } } = form;
  const receiptAmount = watch('receiptAmount') || 0;
  const tdsAmount = watch('tdsAmount') || 0;
  const interestAmount = watch('interestAmount') || 0;

  // Calculation Logic Node: Balance = (Total - Receipt - TDS)
  const rawBalance = currentRegistryBalance - receiptAmount - tdsAmount;
  const isRoundOffApplied = rawBalance > 0 && rawBalance < 100;
  const balanceAmount = isRoundOffApplied ? 0 : rawBalance;
  const roundOffValue = isRoundOffApplied ? rawBalance : 0;
  const status = balanceAmount === 0 ? 'PAID' : 'PARTIAL';

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;

    if ((values.receiptAmount + values.tdsAmount) > currentRegistryBalance) {
        setStatusBar({ message: "Sum of Receipt and TDS cannot exceed Balance Amount. Excess amount must be entered in Interest Amount column.", type: 'error' });
        return;
    }

    try {
        await runTransaction(firestore, async (transaction) => {
            const counterRef = doc(firestore, "counters", "migo");
            const counterSnap = await transaction.get(counterRef);
            
            // Sequential Serial Logic Node
            const currentCount = counterSnap.exists() ? counterSnap.data().count : 0;
            const newCount = currentCount + 1;
            const migoNumber = "8" + String(newCount).padStart(7, '0'); // Generate 8-digit serial starting with 8

            const invoiceRef = doc(firestore, "invoices", invoice.id);
            const ts = serverTimestamp();
            const currentName = (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);

            const paymentData = {
                id: `mig-${Date.now()}`,
                migoNumber,
                receiptAmount: values.receiptAmount + roundOffValue,
                actualReceipt: values.receiptAmount,
                tdsAmount: values.tdsAmount,
                interestAmount: values.interestAmount,
                remark: values.remark || '',
                roundOff: roundOffValue,
                bankingRef: values.bankingRef,
                paymentAdvise: values.paymentAdvise || '',
                paymentDate: values.receiptDate,
                balanceAfterPayment: balanceAmount,
                createdAt: new Date(),
                createdBy: currentName
            };

            transaction.update(invoiceRef, {
                payments: arrayUnion(paymentData),
                paymentStatus: balanceAmount === 0 ? 'Paid' : 'Partly Paid',
                lastUpdatedAt: ts
            });

            // Commit counter increment to registry
            transaction.set(counterRef, { count: newCount }, { merge: true });

            return migoNumber;
        }).then((migoNo) => {
            setStatusBar({ message: `Payment Accepted Successfully. Payment No: ${migoNo}`, type: 'success' });
            toast({ title: "MIGO Posted", description: `Transaction recorded under MIGO Node: ${migoNo}` });
            onSuccess();
        });
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Posting Failed", description: e.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[70vw] w-[1200px] h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden bg-white">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center pr-12">
            <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                    <Wallet className="h-7 w-7 text-blue-400" /> Payment Acceptance Handbook
                </DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                    Financial Registry Liquidation Handshake
                </DialogDescription>
            </div>
            <Badge className="bg-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] px-6 py-2 border-none shadow-lg">
                Verified Node
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-[#f8fafc]">
            {/* 1. TOP HEADER SECTION - READ ONLY */}
            <section className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                    <ShieldCheck className="h-4 w-4 text-blue-600"/> 1. Registry Data Manifest (Read Only)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-8 gap-y-6 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Plant Node</p><p className="text-xs font-bold text-slate-800">{invoice.plantId}</p></div>
                    <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Consignor</p><p className="text-xs font-bold text-slate-800 truncate">{invoice.consignorName}</p></div>
                    <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Consignee</p><p className="text-xs font-bold text-slate-800 truncate">{invoice.consigneeName}</p></div>
                    <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Invoice Ref</p><p className="text-xs font-black text-blue-700 font-mono">{invoice.invoiceNo}</p></div>
                    <div className="space-y-1 col-span-1 min-w-[140px]"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider leading-none mb-1">Total Net Payable amount</p><p className="text-sm font-black text-blue-900">₹ {grandTotalResolved.toLocaleString()}</p></div>
                    <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Registry Bal</p><p className={cn("text-sm font-black", currentRegistryBalance > 0 ? "text-red-600" : "text-emerald-600")}>₹ {currentRegistryBalance.toLocaleString()}</p></div>
                    
                    <Separator className="col-span-full opacity-50" />

                    <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Taxable</p><p className="text-xs font-bold">₹ {taxableAmountResolved.toLocaleString()}</p></div>
                    <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Charge Type</p><p className="text-[11px] font-black text-slate-700 uppercase italic truncate">{invoice.chargeTypeName || invoice.chargeType}</p></div>
                    {invoice.totals?.cgst > 0 && <div className="space-y-1"><p className="text-[9px] font-black uppercase text-emerald-600">CGST</p><p className="text-xs font-bold">₹ {invoice.totals.cgst.toLocaleString()}</p></div>}
                    {invoice.totals?.sgst > 0 && <div className="space-y-1"><p className="text-[9px] font-black uppercase text-emerald-600">SGST</p><p className="text-xs font-bold">₹ {invoice.totals.sgst.toLocaleString()}</p></div>}
                    {invoice.totals?.igst > 0 && <div className="space-y-1"><p className="text-[9px] font-black uppercase text-orange-600">IGST</p><p className="text-xs font-bold">₹ {invoice.totals.igst.toLocaleString()}</p></div>}
                </div>
            </section>

            {/* 2. CENTRE SECTION - USER ENTRY */}
            <Form {...form}>
                <form className="space-y-10">
                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                            <Calculator className="h-4 w-4 text-blue-600"/> 2. Liquidation Particulars
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm items-end">
                            <FormField name="receiptAmount" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-black text-[10px] uppercase text-slate-500">Receipt Amount (₹) *</FormLabel>
                                    <FormControl><Input type="number" {...field} className="h-12 rounded-xl font-black text-blue-900 border-blue-900/20 shadow-inner text-lg focus-visible:ring-blue-900" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="tdsAmount" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-black text-[10px] uppercase text-slate-500">TDS Amount (₹)</FormLabel>
                                    <FormControl><Input type="number" {...field} className="h-12 rounded-xl font-black text-orange-600 border-orange-200 bg-orange-50/10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="bankingRef" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-black text-[10px] uppercase text-slate-500">Bank UTR / Ref No *</FormLabel>
                                    <FormControl><Input placeholder="Mandatory" {...field} className="h-12 rounded-xl font-bold border-slate-200" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="receiptDate" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="font-black text-[10px] uppercase text-slate-500">Receipt Date *</FormLabel>
                                    <FormControl>
                                        <div className="h-12 border border-slate-200 rounded-xl px-4 flex items-center bg-white shadow-sm">
                                            <DatePicker 
                                                date={field.value} 
                                                setDate={field.onChange} 
                                                className="w-full border-none shadow-none p-0 h-10" 
                                                calendarProps={{ disabled: { after: new Date() } }}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="paymentAdvise" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-black text-[10px] uppercase text-slate-500">Payment Advise Node</FormLabel>
                                    <FormControl><Input {...field} className="h-12 rounded-xl border-slate-200" /></FormControl>
                                </FormItem>
                            )} />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                            <Landmark className="h-4 w-4 text-blue-600"/> 3. Excess & Adjustments
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm items-start">
                            <FormField name="interestAmount" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-black text-[10px] uppercase text-slate-500">Interest / Excess Amount (₹)</FormLabel>
                                    <FormControl><Input type="number" {...field} className="h-12 rounded-xl font-black text-emerald-600 border-emerald-600/20 bg-emerald-50/10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <FormField name="remark" control={form.control} render={({ field }) => (
                                <FormItem className={cn("transition-all duration-500", interestAmount <= 0 && "opacity-30 pointer-events-none")}>
                                    <FormLabel className="font-black text-[10px] uppercase text-slate-500">Remark (Mandatory if Interest &gt; 0) *</FormLabel>
                                    <FormControl><Input placeholder="Reason for interest node..." {...field} className="h-12 rounded-xl border-slate-200" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </section>
                </form>
            </Form>

            <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-12 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 transition-transform duration-1000 group-hover:scale-110"><Calculator className="h-48 w-48" /></div>
                <div className="space-y-6 text-center md:text-left z-10 flex-1">
                    <p className="text-[10px] font-black uppercase text-blue-300 tracking-[0.4em]">Handshake Finalization Summary</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="space-y-1"><span className="text-[10px] font-black text-slate-500 uppercase block">Closing Balance</span><span className={cn("text-3xl font-black", balanceAmount > 0 ? "text-red-400" : "text-emerald-400")}>₹ {balanceAmount.toLocaleString()}</span></div>
                        <div className="space-y-1"><span className="text-[10px] font-black text-slate-500 uppercase block">Auto Round-off</span><span className="text-3xl font-black text-amber-400">₹ {roundOffValue.toLocaleString()}</span></div>
                        <div className="space-y-1"><span className="text-[10px] font-black text-slate-500 uppercase block">Registry Status</span><span className="text-3xl font-black text-white">{status}</span></div>
                    </div>
                </div>
                <div className="p-6 bg-white/10 rounded-2xl border border-white/10 flex flex-col items-center gap-3 backdrop-blur-md">
                    <AlertCircle className="h-6 w-6 text-blue-400" />
                    <p className="text-[10px] font-bold text-center leading-tight uppercase max-w-[180px]">MIGO Commitment Locks this liquidation Node.</p>
                </div>
            </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row items-center justify-end gap-4 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-black text-slate-500 uppercase text-[11px] tracking-widest px-8">Abort</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-16 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-200 transition-all active:scale-95 border-none">
            {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-3 h-4 w-4" />}
            Confirm Acceptance (F8)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
