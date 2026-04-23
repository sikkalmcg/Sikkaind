'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Edit2, MapPin, ShieldCheck, X } from 'lucide-react';
import { FuelPumpPaymentMethods } from '@/lib/constants';
import type { FuelPump, WithId } from '@/types';
import { cn, sanitizeRegistryNode } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  name: z.string().min(1, 'Vendor Name is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().min(1, 'Physical Address is mandatory'),
  route: z.string().min(1, 'Operational Route is mandatory'),
  gstin: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')).transform(v => v ? v.toUpperCase() : ''),
  category: z.enum(FuelPumpPaymentMethods, { required_error: 'Category is required' }),
});

type FormValues = z.infer<typeof formSchema>;

interface EditVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: WithId<FuelPump>;
  onSave: (id: string, data: Partial<FuelPump>) => Promise<void>;
}

export default function EditVendorModal({ isOpen, onClose, vendor, onSave }: EditVendorModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: vendor.name,
      mobile: vendor.mobile,
      phone: vendor.phone || '',
      address: vendor.address || '',
      route: vendor.route || '',
      gstin: vendor.gstin || '',
      pan: vendor.pan || '',
      category: (vendor.category as any) || 'All Type',
    },
  });

  const { handleSubmit, formState: { isSubmitting }, reset } = form;

  useEffect(() => {
    if (vendor && isOpen) {
      reset({
        name: vendor.name,
        mobile: vendor.mobile,
        phone: vendor.phone || '',
        address: vendor.address || '',
        route: vendor.route || '',
        gstin: vendor.gstin || '',
        pan: vendor.pan || '',
        category: (vendor.category as any) || 'All Type',
      });
    }
  }, [vendor, isOpen, reset]);

  const onSubmit = async (values: FormValues) => {
    const sanitizedData = sanitizeRegistryNode(values);
    await onSave(vendor.id, sanitizedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] border-none shadow-3xl p-0">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-blue-400" /> Edit Vendor Node
          </DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Correction Handbook</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-10 bg-[#f8fafc]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Vendor Name *</FormLabel>
                    <FormControl><Input {...field} className="h-12 rounded-xl font-bold bg-white" /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Vendor Mobile *</FormLabel>
                    <FormControl><Input {...field} maxLength={10} className="h-12 rounded-xl font-mono font-bold bg-white" /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Vendor Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-12 rounded-xl font-black text-blue-900 border-blue-200 bg-white shadow-inner"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl" modal={false}>{FuelPumpPaymentMethods.map(pm => <SelectItem key={pm} value={pm} className="font-bold py-2">{pm}</SelectItem>)}</SelectContent>
                    </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="route" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Operational Route *</FormLabel>
                    <FormControl><Input placeholder="e.g. GZB - MUM" {...field} className="h-12 rounded-xl font-black uppercase text-blue-900 bg-white" /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="gstin" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">GSTIN Registry</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} className="h-12 rounded-xl uppercase font-mono bg-white" /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator />

            <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" /> Registry Particulars
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm items-end">
                    <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Physical Address node *</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                    <Input {...field} className="h-12 pl-12 rounded-xl bg-slate-50/50 border-slate-200 font-medium" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="pan" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">PAN Registry Number</FormLabel>
                            <FormControl><Input placeholder="ABCDE1234F" {...field} className="h-12 rounded-xl uppercase font-black tracking-widest bg-slate-50/50 border-slate-200" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            </div>

            <DialogFooter className="pt-8 border-t flex-row justify-end gap-4">
              <Button type="button" variant="ghost" onClick={onClose} className="font-black text-slate-400 uppercase text-[11px] h-12 px-8">Discard</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-16 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                Commit Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}