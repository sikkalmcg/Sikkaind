
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck, Truck, Phone, User, AlertCircle, Lock, Save, History } from 'lucide-react';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const vehicleNumberRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;

const formSchema = z.object({
  vehicleNumber: z.string()
    .min(1, 'Vehicle Number is mandatory.')
    .transform(v => v.toUpperCase().replace(/\s/g, ''))
    .refine(val => vehicleNumberRegex.test(val), {
      message: 'Invalid Format (e.g. MH12AB1234)'
    }),
  driverMobile: z.string()
    .min(1, "Driver mobile is required.")
    .refine(val => /^\d{10}$/.test(val), {
        message: 'Mobile must be exactly 10 digits.'
    }),
});

type FormValues = z.infer<typeof formSchema>;

interface EditVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  onSave: (tripId: string, values: FormValues) => Promise<void>;
}

export default function EditVehicleModal({ isOpen, onClose, trip, onSave }: EditVehicleModalProps) {
  const { user } = useUser();
  
  // ACCESS RULE Node: Only assigned user or admin can edit
  const isAssignedUser = user?.uid === trip.userId || user?.email?.split('@')[0] === trip.userName;
  const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
  const canEdit = isAssignedUser || isAdmin;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleNumber: trip.vehicleNumber || '',
      driverMobile: trip.driverMobile || '',
    },
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (isOpen && trip) {
      form.reset({
        vehicleNumber: trip.vehicleNumber || '',
        driverMobile: trip.driverMobile || '',
      });
    }
  }, [isOpen, trip, form]);

  const onSubmit = async (values: FormValues) => {
    if (!canEdit) return;
    await onSave(trip.id, values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                <Truck className="h-7 w-7 text-white" />
            </div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Vehicle Correction Hub</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                    Registry Node Synchronization Terminal
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-slate-400">Mission Node</p>
                    <p className="text-sm font-black text-blue-900 font-mono">{trip.tripId}</p>
                </div>
                <div className="space-y-1 text-right">
                    <p className="text-[9px] font-black uppercase text-slate-400">Operator</p>
                    <p className="text-xs font-bold text-slate-700 uppercase">{trip.userName || 'System'}</p>
                </div>
            </div>

            {!canEdit && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-800 leading-normal uppercase">
                        SECURITY RESTRICTION: This mission registry is locked. Only the assigned operator ({trip.userName}) can authorize vehicle corrections.
                    </p>
                </div>
            )}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="vehicleNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vehicle Registry Number *</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                        <Input 
                                            {...field} 
                                            disabled={!canEdit}
                                            placeholder="XX00XX0000" 
                                            className="h-12 pl-10 rounded-xl font-black text-blue-900 border-slate-200 shadow-inner uppercase text-lg focus-visible:ring-blue-900" 
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage className="text-[9px] font-bold" />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="driverMobile"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pilot Mobile Registry *</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                        <Input 
                                            {...field} 
                                            disabled={!canEdit}
                                            placeholder="10 Digits" 
                                            className="h-12 pl-10 rounded-xl font-mono font-bold border-slate-200 shadow-inner focus-visible:ring-blue-900" 
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage className="text-[9px] font-bold" />
                            </FormItem>
                        )}
                    />

                    {canEdit && (
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3 shadow-sm">
                            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-bold text-blue-800 leading-normal uppercase">
                                ERP Notice: Saving will automatically update this vehicle across the Trip Board, LR manifest, and gate registry nodes.
                            </p>
                        </div>
                    )}

                    <DialogFooter className="bg-slate-50 -mx-8 -mb-8 p-6 border-t flex-row justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400 uppercase text-[10px]">Discard</Button>
                        {canEdit && (
                            <Button 
                                type="submit" 
                                disabled={isSubmitting} 
                                className="bg-blue-900 hover:bg-slate-900 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95"
                            >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Commit Change
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
