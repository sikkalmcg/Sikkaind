
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
    Loader2, 
    Calculator, 
    ShieldCheck, 
    AlertCircle, 
    Wallet, 
    Landmark, 
    History, 
    CheckCircle2, 
    AlertTriangle, 
    User, 
    TrendingUp, 
    Save, 
    Factory, 
    Truck, 
    MapPin, 
    Package, 
    FileText,
    Smartphone,
    QrCode,
    X as XIcon,
    ChevronRight
} from 'lucide-react';
import type { EnrichedFreight } from '@/app/dashboard/freight-management/page';
import { PaymentModes } from '@/lib/constants';
import { format } from 'date-fns';
import { useFirestore, useUser } from "@/firebase";
import { doc, runTransaction, serverTimestamp, arrayUnion } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useMemo, useEffect, useState } from 'react';
import Image from 'next/image';
import ConfirmationModal from '../freight-process/ConfirmationModal';

interface MakePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: EnrichedFreight;
  onSave: () => void;
}

const formSchema = z.object({
  accountHolderName: z.string().min(1, "Account holder name is required."),
  accountDetails: z.string().min(1, "Account details are mandatory."),
  requestedAmountType: z.enum(['Advance', 'POD Amount']),
  payAmount: z.coerce.number().positive("Pay amount must be a positive number."),
  tdsAmount: z.coerce.number().min(0).default(0),
  deductionAmount: z.coerce.number().min(0).default(0),
  bankRef: z.string().min(1, "Bank Reference (UTR) is mandatory."),
  payDate: z.date({ required_error: "Payment date is required." }),
  paymentMode: z.enum(PaymentModes, { required_error: "Payment mode is required." }),
  remark: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function MakePaymentModal({ isOpen, onClose, freight, onSave }: MakePaymentModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [showConfirm, setShowConfirm] = useState(false);

  // Registry Logic Node: Resolve current requested context
  const requestedAmt = Number(freight.advanceAmount || 0);
  const totalFreight = Number(freight.totalFreightAmount || 0);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        accountHolderName: freight.trip.freightReceiverName || '',
        accountDetails: freight.trip.bankName ? `${freight.trip.bankName} | A/C: ${freight.trip.accountNumber}` : (freight.trip.upiId || ''),
        requestedAmountType: 'Advance',
        payAmount: requestedAmt,
        tdsAmount: 0,
        deductionAmount: 0,
        bankRef: '',
        payDate: new Date(),
        paymentMode: 'Banking',
        remark: ''
    },
  });

  const { watch, formState: { isSubmitting }, handleSubmit, setValue } = form;
  const payAmount = watch('payAmount') || 0;
  const tdsAmount = watch('tdsAmount') || 0;
  const deductionAmount = watch('deductionAmount') || 0;

  const totalPaidAlready = (freight.payments || []).reduce((s, p) => s + (Number(p.paidAmount) || 0) + (Number(p.tdsAmount) || 0) + (Number(p.deductionAmount) || 0), 0);
  const currentEntryTotal = Number(payAmount) + Number(tdsAmount) + Number(deductionAmount);

  // Footer Calculation Rule
  const freightBalance = totalFreight - (totalPaidAlready + currentEntryTotal);

  const onSubmit = async (values: FormValues) => {
    // RULE: User cannot make payment exceeding Requested Freight Amount or Total Freight Amount
    if (values.payAmount > requestedAmt) {
        toast({ variant: 'destructive', title: "Payment Restricted", description: `Pay Amount (₹${values.payAmount.toLocaleString()}) cannot exceed Requested Amount (₹${requestedAmt.toLocaleString()}).` });
        return;
    }
    if ((totalPaidAlready + currentEntryTotal) > totalFreight) {
        toast({ variant: 'destructive', title: "Over-payment Blocked", description: `Aggregate payment exceeds Total Freight liability.` });
        return;
    }
    setShowConfirm(true);
  };

  const handleConfirmedPost = async () => {
    if (!firestore || !user) return;
    const values = form.getValues();

    try {
        await runTransaction(firestore, async (transaction) => {
            const counterRef = doc(firestore, "counters", "payment_vouchers");
            const counterSnap = await transaction.get(counterRef);
            const currentCount = counterSnap.exists() ? counterSnap.data().count : 0;
            const newCount = currentCount + 1;
            const voucherNo = "PV" + String(newCount).padStart(8, '0');

            const freightRef = doc(firestore, `plants/${freight.originPlantId}/freights`, freight.id);
            const tripRef = doc(firestore, `plants/${freight.originPlantId}/trips`, freight.trip.id);
            const globalTripRef = doc(firestore, 'trips', freight.trip.id);

            const paymentEntry = {
                id: `pay-${Date.now()}`,
                slipNumber: voucherNo,
                actualReceipt: values.payAmount,
                paidAmount: values.payAmount,
                tdsAmount: values.tdsAmount,
                deductionAmount: values.deductionAmount,
                mode: values.paymentMode,
                referenceNo: values.bankRef,
                remark: values.remark || '',
                paymentDate: values.payDate,
                voucherNo,
                type: values.requestedAmountType
            };

            const updatedPayments = [...(freight.payments || []), paymentEntry];
            const totalPaidNew = updatedPayments.reduce((s, p) => s + (Number(p.paidAmount) || 0) + (Number(p.tdsAmount) || 0) + (Number(p.deductionAmount) || 0), 0);
            
            // Sync with registry aggregate
            const balanceNew = totalFreight - totalPaidNew;

            transaction.update(freightRef, {
                payments: arrayUnion(paymentEntry),
                paidAmount: totalPaidNew,
                balanceAmount: balanceNew,
                paymentStatus: balanceNew <= 0.01 ? 'Paid' : 'Partially Paid',
                lastUpdated: serverTimestamp()
            });

            const nextFreightStatus = balanceNew <= 0.01 ? 'Paid' : 'Under Process';
            const tripUpdate = {
                freightStatus: nextFreightStatus,
                lastUpdated: serverTimestamp()
            };

            transaction.update(tripRef, tripUpdate);
            transaction.update(globalTripRef, tripUpdate);
            transaction.set(counterRef, { count: newCount }, { merge: true });

            return voucherNo;
        }).then((vNo) => {
            toast({ title: 'Success', description: `Payment Voucher ${vNo} has been successfully saved.` });
            onSave();
            onClose();
        });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Registry Error', description: e.message });
    }
  };

  const tripHeaderNodes = [
    { label: 'Plant Node', value: freight.plant.name, icon: Factory },
    { label: 'Trip ID', value: freight.trip.tripId, mono: true, bold: true, color: 'text-blue-700' },
    { label: 'LR Number', value: freight.trip.lrNumber || '--', mono: true, bold: true },
    { label: 'FROM', value: freight.trip.loadingPoint, icon: MapPin },
    { label: 'Destination', value: freight.trip.unloadingPoint, icon: MapPin },
    { label: 'Vehicle', value: freight.trip.vehicleNumber, bold: true },
    { label: 'TOTAL FREIGHT', value: `₹ ${totalFreight.toLocaleString()}`, highlight: true },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[1450px] h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-12">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg shadow-lg rotate-3"><Wallet className="h-6 w-6" /></div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Freight Payment Window</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Authorized Registry Settlement Node</DialogDescription>
                </div>
            </div>
            <div className="text-right">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Aggregate Mission Total</p>
                <p className="text-3xl font-black tracking-tighter text-blue-400">₹ {totalFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col bg-[#f8fafc]">
            <div className="p-8 bg-white border-b shadow-sm shrink-0">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                    {tripHeaderNodes.map((node, i) => (
                        <div key={i} className={cn("flex flex-col gap-1", node.highlight && "bg-blue-50 p-2 rounded-xl border border-blue-100")}>
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                {node.icon && <node.icon className="h-2.5 w-2.5" />} {node.label}
                            </span>
                            <span className={cn(
                                "text-[11px] font-bold truncate leading-tight uppercase",
                                node.bold && "font-black text-slate-900",
                                node.mono && "font-mono tracking-tighter text-blue-700",
                                node.highlight && "text-blue-900 font-black",
                                node.color
                            )}>{node.value || '--'}</span>
                        </div>
                    ))}
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-10 space-y-12">
                        
                        <section className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1 italic">
                                <Landmark className="h-4 w-4 text-blue-600" /> 1. Transporter Account details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl relative overflow-hidden">
                                <FormField name="accountHolderName" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Account Holder Name *</FormLabel>
                                        <FormControl><Input placeholder="Legal name" {...field} className="h-12 rounded-xl font-black text-slate-900 uppercase" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField name="accountDetails" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Account Details *</FormLabel>
                                        <FormControl><Input placeholder="Bank / UPI particulars" {...field} className="h-12 rounded-xl font-bold text-blue-900" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-slate-500">Requested Amount</label>
                                    <div className="h-12 px-4 flex items-center bg-blue-50/50 rounded-xl font-black text-blue-900 shadow-inner">₹ {requestedAmt.toLocaleString()}</div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1 italic">
                                <Calculator className="h-4 w-4 text-blue-600" /> 2. Manual Entry Registry
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-8 p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl items-end">
                                <FormField name="payAmount" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-black text-[10px] uppercase text-blue-900">Pay Amount *</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} className="h-14 rounded-2xl font-black text-blue-900 text-2xl shadow-inner border-blue-900/20 focus-visible:ring-blue-900" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="tdsAmount" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="font-black text-[10px] uppercase text-slate-500">TDS (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-12 rounded-xl font-bold" /></FormControl></FormItem>
                                )} />
                                <FormField name="deductionAmount" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="font-black text-[10px] uppercase text-red-600 tracking-widest">Deduction (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-12 rounded-xl font-bold border-red-100" /></FormControl></FormItem>
                                )} />
                                <FormField name="bankRef" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Bank Ref (UTR) *</FormLabel>
                                        <FormControl><Input placeholder="Registry Ref" {...field} className="h-12 font-mono font-bold border-slate-200 rounded-xl" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="paymentMode" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Mode</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{PaymentModes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="p-8 rounded-[2.5rem] bg-blue-900 text-white shadow-2xl flex items-center justify-between gap-8 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-5 -rotate-12 group-hover:scale-110 transition-transform duration-1000"><Landmark className="h-32 w-32" /></div>
                                <div className="text-left relative z-10">
                                    <span className="text-[9px] font-black uppercase text-blue-300 tracking-[0.3em] block mb-1">Remaining Balance</span>
                                    <p className={cn(
                                        "text-4xl font-black tracking-tighter transition-all duration-500",
                                        freightBalance > 50 ? "text-white" : "text-emerald-400"
                                    )}>₹ {freightBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-slate-50 border-t shrink-0 flex-row justify-end items-center gap-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-auto flex items-center gap-2 italic">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            Verified Mission Registry Settlement Node (F110 Handshake)
                        </p>
                        <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-black text-slate-500 uppercase text-[11px] tracking-widest px-8 h-12 rounded-xl">Discard</Button>
                        <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-900/50 border-none transition-all active:scale-95">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Post Settlement (F8)
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </div>

        <ConfirmationModal
            isOpen={showConfirm}
            onClose={() => setShowConfirm(false)}
            onConfirm={handleConfirmedPost}
            title="Registry Authorization Required"
            message="Please ensure all payment details are correct before posting. This will generate a permanent Payment Voucher node."
        />
      </DialogContent>
    </Dialog>
  );
}
