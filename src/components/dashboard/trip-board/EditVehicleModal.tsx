'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
    Truck, 
    ShieldCheck, 
    Loader2, 
    Smartphone, 
    AlertCircle,
    Save,
    User,
    Layers,
    X,
    Search,
    IndianRupee,
    Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VehicleTypes } from '@/lib/constants';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { FuelPump } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const vehicleNumberRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;

const formSchema = z.object({
  vehicleNumber: z.string().min(1, "Vehicle number is mandatory.").transform(v => v.toUpperCase().replace(/\s/g, '')).refine(val => vehicleNumberRegex.test(val), {
    message: 'Invalid Format (e.g. MH12AB1234)'
  }),
  driverMobile: z.string().optional().or(z.literal('')).refine(val => !val || /^\d{10}$/.test(val), {
    message: 'Mobile must be 10 digits if provided.'
  }),
  vehicleType: z.enum(VehicleTypes, { required_error: 'Vehicle type is required' }),
  transporterName: z.string().optional().default(''),
  freightRate: z.coerce.number().optional().default(0),
  isFixRate: z.boolean().default(false),
  fixedAmount: z.coerce.number().optional().default(0),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditVehicleModal({ isOpen, onClose, trip, onSave }: { isOpen: boolean; onClose: () => void; trip: any; onSave: (tripId: string, values: FormValues) => Promise<void> }) {
  const { toast } = useToast();
  const firestore = useFirestore();

  // Registry Handshake: Fetch Transporters from Master Vendor Registry
  const vendorQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "fuel_pumps")) : null, [firestore]);
  const { data: vendors } = useCollection<FuelPump>(vendorQuery);

  const vendorOptions = useMemo(() => {
    return (vendors || [])
      .map(v => ({ value: v.id, label: v.name }));
  }, [vendors]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleNumber: trip?.vehicleNumber || '',
      driverMobile: trip?.driverMobile || '',
      vehicleType: (trip?.vehicleType as any) || 'Own Vehicle',
      transporterName: trip?.transporterName || '',
      freightRate: trip?.freightRate || 0,
      isFixRate: trip?.isFixRate || false,
      fixedAmount: trip?.fixedAmount || 0,
    }
  });

  const { isSubmitting, watch, reset, setValue } = form;
  const watchedVehicleType = watch('vehicleType');
  const currentTransporterName = watch('transporterName');
  const isFixRate = watch('isFixRate');
  const freightRate = watch('freightRate');
  const fixedAmount = watch('fixedAmount');

  // MISSION PULSE: Reset form nodes when trip identity changes
  useEffect(() => {
    if (isOpen && trip) {
      reset({
        vehicleNumber: trip.vehicleNumber || '',
        driverMobile: trip.driverMobile || '',
        vehicleType: (trip.vehicleType as any) || 'Own Vehicle',
        transporterName: trip.transporterName || '',
        freightRate: trip.freightRate || 0,
        isFixRate: !!trip.isFixRate,
        fixedAmount: trip.fixedAmount || 0,
      });
    }
  }, [trip, isOpen, reset]);

  const handleTransporterSelect = (vendorId: string) => {
    const vendor = vendors?.find(v => v.id === vendorId);
    if (vendor) {
        setValue('transporterName', vendor.name, { shouldValidate: true });
    }
  };

  const calculatedFreight = useMemo(() => {
    if (isFixRate) return Number(fixedAmount) || 0;
    const qty = Number(trip?.assignedQtyInTrip) || 0;
    return (Number(freightRate) || 0) * qty;
  }, [isFixRate, fixedAmount, freightRate, trip]);

  const onSubmit = async (values: FormValues) => {
    try {
        await onSave(trip.id, values);
        onClose();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Correction Failed', description: error.message });
    }
  };

  const showFinancials = watchedVehicleType === 'Market Vehicle' || watchedVehicleType === 'Contract Vehicle';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center pr-12">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                    <Truck className="h-7 w-7 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Vehicle Correction Node</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Sync Node: {trip.tripId}</DialogDescription>
                </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 text-white/40 hover:text-white transition-all"><X size={20} /></button>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-start gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-blue-700 leading-normal uppercase">
                    Establishing a corrective registry pulse. This will update the vehicle identity across all mission manifests (LR, Trip, Gate).
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FormField name="vehicleNumber" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">New Vehicle Number *</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <Truck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                    <Input placeholder="XX00XX0000" {...field} className="pl-12 h-12 rounded-xl font-black text-blue-900 text-lg uppercase shadow-inner border-slate-200 focus-visible:ring-blue-900" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[9px] font-black uppercase" />
                        </FormItem>
                    )} />

                    <FormField name="vehicleType" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Fleet Category *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-12 rounded-xl font-black text-blue-900 shadow-sm border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <Layers className="h-4 w-4 text-slate-300" />
                                            <SelectValue placeholder="Select Category" />
                                        </div>
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                    {VehicleTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2.5 uppercase italic">{t.toUpperCase()}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[9px] font-black uppercase" />
                        </FormItem>
                    )} />

                    {watchedVehicleType === 'Market Vehicle' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Transporter Name *</label>
                            <SearchableSelect 
                                options={vendorOptions} 
                                onChange={(vId) => handleTransporterSelect(vId)} 
                                value={vendors?.find(v => v.name === currentTransporterName)?.id || ''} 
                                placeholder="Resolve from Registry"
                                className="h-12"
                            />
                        </div>
                    )}

                    <FormField name="driverMobile" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Correct Pilot Mobile</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                    <Input placeholder="Optional" {...field} maxLength={10} className="pl-12 h-12 rounded-xl font-black text-blue-900 text-lg font-mono shadow-inner border-slate-200 focus-visible:ring-blue-900" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[9px] font-black uppercase" />
                        </FormItem>
                    )} />

                    {showFinancials && (
                        <div className="p-8 bg-blue-50/50 rounded-[2rem] border-2 border-blue-100 shadow-sm space-y-8 animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-3 border-b border-blue-100 pb-4">
                                <IndianRupee className="h-5 w-5 text-blue-600" />
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Financial Correction Node</h3>
                            </div>

                            <div className="space-y-6">
                                <FormField name="isFixRate" control={form.control} render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4 border rounded-xl bg-white shadow-sm">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-6 w-6 rounded-lg data-[state=checked]:bg-blue-900 shadow-md" />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest cursor-pointer">Manual Fix Rate Node</FormLabel>
                                        </div>
                                    </FormItem>
                                )} />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField name="freightRate" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={cn("text-[10px] font-black uppercase", isFixRate ? "text-slate-300" : "text-slate-500")}>Freight Rate (MT) *</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} disabled={isFixRate} className="h-12 rounded-xl bg-white font-black text-blue-900 text-lg shadow-inner disabled:bg-slate-50 disabled:text-slate-300" />
                                            </FormControl>
                                        </FormItem>
                                    )} />

                                    <FormField name="fixedAmount" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={cn("text-[10px] font-black uppercase", !isFixRate ? "text-slate-300" : "text-emerald-600")}>Fixed Amount *</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} disabled={!isFixRate} className="h-12 rounded-xl bg-white font-black text-emerald-900 text-lg shadow-inner disabled:bg-slate-50 disabled:text-slate-300" />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-2xl relative overflow-hidden group">
                                    <div className="absolute right-0 p-4 opacity-5 transition-transform duration-700 group-hover:scale-110"><Calculator size={60} /></div>
                                    <div className="flex flex-col relative z-10">
                                        <span className="text-[8px] font-black uppercase text-blue-300 tracking-widest">Adjusted Mission Total</span>
                                        <span className="text-2xl font-black tracking-tighter">₹ {calculatedFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/20 text-[8px] font-black uppercase relative z-10 h-6">Live Pulse</Badge>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </Form>
        </div>

        <DialogFooter className="pt-8 border-t flex-row justify-end gap-3 bg-slate-50 p-8 shrink-0">
            <Button variant="ghost" type="button" onClick={onClose} disabled={form.formState.isSubmitting} className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-8">Discard</Button>
            <Button 
                onClick={form.handleSubmit(onSubmit)}
                disabled={form.formState.isSubmitting} 
                className="bg-blue-900 hover:bg-black text-white px-10 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 border-none"
            >
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Commit Corrected Node
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
