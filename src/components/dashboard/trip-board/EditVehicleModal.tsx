'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
    Truck, 
    ShieldCheck, 
    Loader2, 
    Smartphone, 
    CheckCircle2, 
    AlertCircle,
    Save,
    History,
    Smartphone as MobileIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const vehicleNumberRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;

const formSchema = z.object({
  vehicleNumber: z.string().min(1, "Vehicle number is mandatory.").transform(v => v.toUpperCase().replace(/\s/g, '')).refine(val => vehicleNumberRegex.test(val), {
    message: 'Invalid Format (e.g. MH12AB1234)'
  }),
  driverMobile: z.string().min(1, "Driver mobile is required.").refine(val => /^\d{10}$/.test(val), {
    message: 'Mobile must be 10 digits.'
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditVehicleModal({ isOpen, onClose, trip, onSave }: { isOpen: boolean; onClose: () => void; trip: any; onSave: (tripId: string, values: FormValues) => Promise<void> }) {
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleNumber: trip?.vehicleNumber || '',
      driverMobile: trip?.driverMobile || ''
    }
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: FormValues) => {
    try {
        await onSave(trip.id, values);
        onClose();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Correction Failed', description: error.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                <Truck className="h-7 w-7 text-white" />
            </div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Vehicle Correction Node</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Sync Node: {trip.tripId}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-10">
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
                                    <Input placeholder="XX00XX0000" {...field} className="pl-12 h-14 rounded-2xl font-black text-blue-900 text-xl uppercase shadow-inner border-slate-200 focus-visible:ring-blue-900" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[9px] font-black uppercase" />
                        </FormItem>
                    )} />

                    <FormField name="driverMobile" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Correct Pilot Mobile *</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <MobileIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                    <Input placeholder="10 Digit Number" {...field} maxLength={10} className="pl-12 h-14 rounded-2xl font-black text-slate-900 text-xl font-mono shadow-inner border-slate-200 focus-visible:ring-blue-900" />
                                </div>
                            </FormControl>
                            <FormMessage className="text-[9px] font-black uppercase" />
                        </FormItem>
                    )} />

                    <DialogFooter className="pt-8 border-t flex-row justify-end gap-3 bg-slate-50 -mx-10 -mb-10 p-8">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-8">Discard</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-10 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 border-none">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Commit Corrected Node
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
