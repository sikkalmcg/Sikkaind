'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, 
    Calculator, 
    Wallet, 
    ShieldCheck, 
    AlertTriangle, 
    AlertCircle, 
    ArrowRightLeft, 
    FileText, 
    CheckCircle2,
    Landmark,
    User,
    History,
    Info,
    TrendingUp,
    Smartphone,
    Save,
    ChevronRight,
    Search
} from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { doc, runTransaction, serverTimestamp, collection, query, where, getDocs, limit, Timestamp } from "firebase/firestore";
import HeaderSummary from './HeaderSummary';
import ConfirmationModal from './ConfirmationModal';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useLoading } from '@/context/LoadingContext';

const formSchema = z.object({
  paymentPurpose: z.enum(['Advance Freight', 'POD Amount'], { required_error: "Purpose is mandatory" }),
  targetAccountId: z.string().min(1, "Authorized Role selection is mandatory."),
  advanceRequest: z.coerce.number().min(0).default(0),
  cashPayment: z.coerce.number().min(0).default(0),
  manualAccountHolder: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddFreightModal({ isOpen, onClose, trip, onSuccess }: { isOpen: boolean; onClose: () => void; trip: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const [showConfirm, setShowConfirm] = useState(false);

  const hasBankingDetails = useMemo(() => (trip.bankingAccounts?.length || 0) > 0, [trip.bankingAccounts]);

  const baseFreight = useMemo(() => {
    if (Number(trip.freightAmount) > 0) return Number(trip.freightAmount);
    const rate = Number(trip.freightRate || 0);
    const qty = Number(trip.quantity || trip.assignedQtyInTrip || 0);
    return rate * qty;
  }, [trip]);

  const previousSettledPayments = useMemo(() => {
    if (!trip.freightData || !trip.freightData.payments) return [];
    return trip.freightData.payments;
  }, [trip.freightData]);

  const totalPaidInHistory = useMemo(() => {
    return previousSettledPayments.reduce((s: number, p: any) => 
        s + (Number(p.paidAmount || p.amount || 0)) + (Number(p.tdsAmount || 0)) + (Number(p.deductionAmount || 0)), 
    0);
  }, [previousSettledPayments]);

  const otherChargesTotal = useMemo(() => (trip.otherCharges || []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0), [trip.otherCharges]);
  const deductionsTotal = useMemo(() => (trip.freightData?.charges || []).filter((c:any) => c.type === 'Debit').reduce((s: number, c: any) => s + Number(c.amount || 0), 0), [trip.freightData?.charges]);

  const totalFreightAmount = baseFreight + otherChargesTotal - deductionsTotal;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paymentPurpose: 'Advance Freight',
      targetAccountId: '',
      advanceRequest: 0,
      cashPayment: 0,
      manualAccountHolder: '',
    },
  });

  const { watch, handleSubmit, setValue, formState: { isSubmitting } } = form;
  const paymentPurpose = watch('paymentPurpose');
  const targetAccountId = watch('targetAccountId');
  const advanceRequest = watch('advanceRequest');
  const cashPayment = watch('cashPayment');

  const selectedAccount = useMemo(() => {
    const accounts = trip.bankingAccounts || [];
    return accounts.find((acc: any) => acc.id === targetAccountId);
  }, [trip.bankingAccounts, targetAccountId]);

  const currentRequestTotal = (Number(advanceRequest) || 0);
  const aggregateRequestTotal = currentRequestTotal + Number(trip.freightData?.advanceAmount || 0);
  const totalPaidAmount = (Number(cashPayment) || 0) + totalPaidInHistory;
  const podStatus = trip.podStatus || 'None';
  const holdback = podStatus === 'Hard Copy' ? 0 : (podStatus === 'Soft Copy' ? 500 : 1000);
  const remainingBalance = totalFreightAmount - totalPaidAmount - holdback;

  const handlePost = async () => {
    if (!firestore || !user) return;
    const values = form.getValues();

    if (aggregateRequestTotal > totalFreightAmount) {
        toast({ variant: 'destructive', title: "Validation Error", description: `Aggregate Request (₹${aggregateRequestTotal.toLocaleString()}) cannot exceed Total Freight (₹${totalFreightAmount.toLocaleString()}).` });
        return;
    }

    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
            const globalTripRef = doc(firestore, 'trips', trip.id);
            const freightRef = doc(firestore, `plants/${trip.originPlantId}/freights`, `fr-${trip.id}`);
            
            const [tripSnap, freightSnap] = await Promise.all([
                transaction.get(tripRef),
                transaction.get(freightRef)
            ]);

            const timestamp = serverTimestamp();
            const currentName = (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System');

            const tripUpdate = {
                freightStatus: 'Requested', // Synchronized with Financial Node Only
                lastUpdated: timestamp,
                isFreightPosted: true,
                podStatus: podStatus
            };

            transaction.update(tripRef, tripUpdate);
            transaction.update(globalTripRef, tripUpdate);

            if (freightSnap.exists()) {
                const currentData = freightSnap.data();
                transaction.update(freightRef, {
                    advanceAmount: (currentData.advanceAmount || 0) + values.advanceRequest,
                    paidAmount: (currentData.paidAmount || 0) + values.cashPayment,
                    balanceAmount: remainingBalance,
                    totalFreightAmount: totalFreightAmount,
                    podStatus: podStatus,
                    lastUpdated: timestamp
                });
            } else {
                transaction.set(freightRef, {
                    tripId: trip.id,
                    originPlantId: trip.originPlantId,
                    totalFreightAmount: totalFreightAmount,
                    baseFreightAmount: baseFreight,
                    advanceAmount: values.advanceRequest,
                    paidAmount: values.cashPayment,
                    balanceAmount: remainingBalance,
                    targetAccountId: values.targetAccountId,
                    paymentStatus: 'Pending',
                    podStatus: podStatus,
                    postedBy: currentName,
                    createdAt: timestamp,
                    lastUpdated: timestamp
                });
            }
        });

        toast({ title: "Request Committed", description: "Freight request successfully recorded in mission registry." });
        onSuccess();
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Post Failed", description: error.message });
    } finally {
        hideLoader();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[1450px] h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-3xl bg-[#f8fafc]">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-12">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg shadow-lg rotate-3"><ArrowRightLeft className="h-6 w-6" /></div>
                <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">PROCESS FREIGHT POST – Create Freight Request</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                        Independent Payment Authorization & History Node
                    </DialogDescription>
                </div>
            </div>
            <div className="text-right">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Total Freight</p>
                <p className="text-3xl font-black tracking-tighter text-blue-400">₹ {totalFreightAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-10 space-y-12">
          <HeaderSummary trip={{ ...trip, freightAmount: totalFreightAmount }} />

          <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-10 items-start transition-all duration-500", !hasBankingDetails && "opacity-20 pointer-events-none grayscale")}>
            
            <div className="lg:col-span-5 space-y-6">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1">
                    <History className="h-4 w-4 text-blue-600"/> 1. PREVIOUS SUCCESSFUL PAYMENT HISTORY
                </h3>
                
                <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden flex flex-col min-h-[450px]">
                    <div className="p-0 flex-1 overflow-auto">
                        <Table>
                            <TableHeader className="bg-slate-900 text-white h-12">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="text-[9px] font-black uppercase px-4">Pay Amount (₹)</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase px-4">Payment Date</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase px-4">Mode</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase px-4">Account Holder</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase px-2 text-right">TDS</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase px-2 text-right">Ded</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previousSettledPayments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">
                                            No prior settlements detected.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    previousSettledPayments.map((p: any, i: number) => (
                                        <TableRow key={i} className="h-12 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                            <TableCell className="px-4 font-black text-slate-900 text-[11px]">
                                                ₹ {(Number(p.paidAmount || p.amount) || 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="px-4 text-[10px] font-bold text-slate-500">
                                                {format(new Date(p.paymentDate.toDate ? p.paymentDate.toDate() : p.paymentDate), 'dd.MM.yy')}
                                            </TableCell>
                                            <TableCell className="px-4 text-[9px] font-black uppercase text-slate-400">
                                                {p.mode || 'Banking'}
                                            </TableCell>
                                            <TableCell className="px-4 text-[10px] font-bold text-slate-700 truncate max-w-[100px]">
                                                {p.accountHolderName || '--'}
                                            </TableCell>
                                            <TableCell className="px-2 text-right font-bold text-orange-600">
                                                {(p.tdsAmount || 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="px-2 text-right font-bold text-red-600">
                                                {(p.deductionAmount || 0).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400">Total Paid Amount (₹)</span>
                        <span className="text-lg font-black text-blue-900">₹ {totalPaidInHistory.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                </Card>
            </div>

            <div className="lg:col-span-7 space-y-10">
                <Form {...form}>
                    <form className="space-y-10">
                        <section className="space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1 italic">
                                <Calculator className="h-4 w-4 text-blue-600"/> 2. REQUEST PARTICULARS
                            </h3>
                            <div className="p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl relative overflow-hidden">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                    <FormField name="paymentPurpose" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Description / Particular</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12 rounded-xl font-black text-blue-900 border-blue-900/20 shadow-inner"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="Advance Freight" className="font-bold py-2.5">Advance Freight</SelectItem>
                                                    <SelectItem value="POD Amount" className="font-bold py-2.5">POD Amount</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />

                                    <FormField name="targetAccountId" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Authorized Role</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12 rounded-xl font-black text-slate-900 border-blue-900/20 shadow-inner"><SelectValue placeholder="Select authorized account" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">
                                                    {(trip.bankingAccounts || []).map((acc: any) => (
                                                        <SelectItem key={acc.id} value={acc.id} className="py-3 px-4 border-b last:border-0">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-xs uppercase">{acc.role}: {acc.accountHolderName}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{acc.purpose} | {acc.paymentMethod}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField name="advanceRequest" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Amount (₹)</FormLabel>
                                            <FormControl><Input type="number" {...field} placeholder="Enter amount" className="h-12 rounded-xl font-black text-blue-900 text-lg shadow-inner" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField name="cashPayment" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Cash Payment (₹)</FormLabel>
                                            <FormControl><Input type="number" {...field} placeholder="Enter cash amount" className="h-12 rounded-xl font-black text-blue-900 border-blue-900/20 shadow-inner" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    {Number(cashPayment) > 0 && (
                                        <FormField name="manualAccountHolder" control={form.control} render={({ field }) => (
                                            <FormItem className="md:col-span-2 animate-in slide-in-from-top-2">
                                                <FormLabel className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Account Holder Name (Manual Entry)</FormLabel>
                                                <FormControl><Input placeholder="Enter account holder name for cash payment" {...field} className="h-12 rounded-xl font-black border-emerald-500/30 bg-emerald-50/10" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                </div>
                            </div>
                        </section>
                    </form>
                </Form>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-900 text-white shrink-0 flex flex-col md:flex-row items-center justify-between sm:justify-between border-t border-white/5">
          <div className="flex items-center gap-8">
            <div className="text-left space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em]">Total Freight</p>
                <p className="text-2xl font-black tracking-tighter text-white">₹ {totalFreightAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="w-px h-10 bg-white/10" />

            <div className="text-left space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em]">Aggregate Request Total</p>
                <p className="text-2xl font-black tracking-tighter text-blue-400">₹ {aggregateRequestTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="w-px h-10 bg-white/10" />

            <div className="text-left space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em]">Total Paid Amount</p>
                <p className="text-2xl font-black tracking-tighter text-emerald-400">₹ {totalPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="w-px h-10 bg-white/10" />

            <div className="text-left space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em]">Remaining Balance</p>
                <p className={cn(
                    "text-2xl font-black tracking-tighter transition-all duration-500",
                    remainingBalance <= 50 ? "text-emerald-400" : "text-amber-400"
                )}>
                    ₹ {remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="text-slate-400 hover:text-white font-black uppercase text-[11px] tracking-widest px-8">Discard</Button>
            <Button 
                disabled={isSubmitting || (currentRequestTotal <= 0 && Number(cashPayment) <= 0)} 
                onClick={() => setShowConfirm(true)} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-900/50 border-none transition-all active:scale-95 border-none disabled:opacity-30 disabled:grayscale"
            >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Submit Freight Request
            </Button>
          </div>
        </div>
      </DialogContent>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit(handlePost)}
        title="Verify Freight Request"
        message="Please confirm all request details. This will update the mission financial registry."
      />
    </Dialog>
  );
}
