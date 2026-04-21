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
import { Loader2, PlusCircle, Calculator, ShieldCheck, Save } from 'lucide-react';
import type { EnrichedFreight } from '@/app/dashboard/freight-management/page';
import { ChargeTypes } from '@/lib/constants';
import { useFirestore, useUser } from "@/firebase";
import { doc, runTransaction, serverTimestamp, arrayUnion } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AddChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: EnrichedFreight;
  onSave: () => void;
}

const formSchema = z.object({
  amount: z.coerce.number().positive("Amount must be a positive number."),
  chargeType: z.enum(ChargeTypes, { required_error: "Charge type is required." }),
  remark: z.string().optional(),
}).refine(data => {
    if (data.chargeType === 'Other') {
        return !!data.remark && data.remark.length > 0;
    }
    return true;
}, {
    message: "Remark is required for 'Other' charge type.",
    path: ['remark'],
});

type FormValues = z.infer<typeof formSchema>;

export default function AddChargeModal({ isOpen, onClose, freight, onSave }: AddChargeModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      amount: 0, 
      chargeType: 'Detention', 
      remark: '' 
    },
  });

  const { watch, formState: { isSubmitting }, handleSubmit } = form;
  const chargeType = watch('chargeType');
  const amount = watch('amount');

  const tripDetails = [
    { label: "Trip ID", value: freight.trip.tripId },
    { label: "LR Number", value: freight.trip.lrNumber || `LR-${freight.trip.tripId.slice(-4)}`},
    { label: "Vehicle Number", value: freight.trip.vehicleNumber },
    { label: "Transporter", value: freight.trip.transporterName },
    { label: "Unloading Point", value: freight.trip.unloadingPoint },
    { label: "Current Registry Total", value: `₹ ${Number(freight.totalFreightAmount || 0).toLocaleString('en-IN')}` },
  ];

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;

    try {
        await runTransaction(firestore, async (transaction) => {
            const freightRef = doc(firestore, `plants/${freight.originPlantId}/freights`, freight.id);
            const tripRef = doc(firestore, `plants/${freight.originPlantId}/trips`, freight.trip.id);

            const newCharge = {
                id: `chg-${Date.now()}`,
                amount: values.amount,
                type: values.chargeType,
                remark: values.remark || '',
                createdAt: new Date(),
            };

            const updatedTotalFreight = Number(freight.totalFreightAmount || 0) + Number(values.amount);
            const updatedBalance = Number(freight.balanceAmount || 0) + Number(values.amount);

            transaction.update(freightRef, {
                charges: arrayUnion(newCharge),
                totalFreightAmount: updatedTotalFreight,
                balanceAmount: updatedBalance,
                lastUpdated: serverTimestamp()
            });

            transaction.update(tripRef, { lastUpdated: serverTimestamp() });
        });

        toast({ title: 'Adjustment Recorded', description: 'Additional charge successfully committed to registry.' });
        onSave();
        onClose();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Commit Failed', description: e.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 border-none shadow-3xl overflow-hidden bg-white">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg"><PlusCircle className="h-5 w-5" /></div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Record Additional Charge</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Correction node</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-8 flex-1 overflow-y-auto space-y-10">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                {tripDetails.map(d => (
                    <div key={d.label} className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase text-slate-400">{d.label}</span>
                        <span className="text-xs font-bold truncate text-slate-800">{d.value || '--'}</span>
                    </div>
                ))}
            </div>

            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    <div className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                            <Calculator className="h-4 w-4 text-blue-600" /> Charge Particulars
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-white rounded-3xl border-2 border-blue-50 shadow-sm items-end">
                            <FormField name="amount" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Adjustment Amount (₹) *</FormLabel>
                                    <FormControl><Input type="number" {...field} className="h-12 rounded-xl font-black text-blue-900 text-lg shadow-inner focus-visible:ring-blue-900" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="chargeType" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Charge Nature *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Pick Type" /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">
                                            {ChargeTypes.map(ct => <SelectItem key={ct} value={ct} className="font-bold py-2.5">{ct}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            {chargeType === 'Other' && (
                                <FormField name="remark" control={form.control} render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Mandatory Justification *</FormLabel>
                                        <FormControl><Input {...field} placeholder="Specific reason for additional charge..." className="h-12 rounded-xl border-blue-200" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-900 text-white rounded-3xl border border-white/5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12 transition-transform duration-1000 group-hover:scale-110"><Calculator className="h-16 w-16" /></div>
                        <div className="text-left relative z-10">
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em] block mb-1">Post Adjustment Balance</span>
                            <p className="text-3xl font-black tracking-tighter text-emerald-400">₹ {(Number(freight.balanceAmount || 0) + (Number(amount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl border border-white/10 relative z-10">
                            <ShieldCheck className="h-5 w-5 text-blue-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 leading-tight">
                                Transaction will be logged under Trip {freight.trip.tripId}
                            </span>
                        </div>
                    </div>
                </form>
            </Form>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-bold text-slate-400 uppercase text-[10px] tracking-widest px-8">Discard</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-12 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Charge (F8)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
