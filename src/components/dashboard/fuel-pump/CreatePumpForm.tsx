'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Save, MapPin, ShieldCheck } from 'lucide-react';
import type { FuelPump } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FuelPumpPaymentMethods } from '@/lib/constants';
import { cn, sanitizeRegistryNode } from '@/lib/utils';

const formSchema = z.object({
  name: z.string().min(1, 'Vendor Name is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().min(1, 'Physical Address is mandatory'),
  route: z.string().min(1, 'Operational Route is mandatory'),
  gstin: z.string().optional().or(z.literal('')),
  pan: z.string().min(1, 'PAN Number is mandatory').transform(v => v.toUpperCase()),
  category: z.enum(FuelPumpPaymentMethods, { required_error: 'Category is required' }),
});

type FormValues = z.infer<typeof formSchema>;

interface CreatePumpFormProps {
  onSave: (data: Omit<FuelPump, 'id'>) => Promise<void>;
}

export default function CreatePumpForm({ onSave }: CreatePumpFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      mobile: '',
      phone: '',
      address: '',
      route: '',
      gstin: '',
      pan: '',
      category: 'All Type',
    },
  });

  const { handleSubmit, formState: { isSubmitting } } = form;

  const onSubmit = async (values: FormValues) => {
    const dataToSave = sanitizeRegistryNode(values);
    await onSave(dataToSave as Omit<FuelPump, 'id'>);
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* TOP MANIFEST GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Vendor Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Sikka Logistics Solutions" {...field} className="h-12 rounded-xl font-bold" /></FormControl>
                <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="mobile" render={({ field }) => (
            <FormItem>
                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Vendor Mobile *</FormLabel>
                <FormControl><Input type="tel" maxLength={10} placeholder="10-digit mobile" {...field} className="h-12 rounded-xl font-mono font-bold" /></FormControl>
                <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Vendor Category *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-12 rounded-xl font-black text-blue-900 border-blue-200 shadow-inner"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent className="rounded-xl" modal={false}>{FuelPumpPaymentMethods.map(pm => <SelectItem key={pm} value={pm} className="font-bold py-2">{pm}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
          )} />
          
          <FormField control={form.control} name="route" render={({ field }) => (
            <FormItem>
                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Operational Route *</FormLabel>
                <FormControl><Input placeholder="e.g. GZB - MUM" {...field} className="h-12 rounded-xl font-black uppercase text-blue-900" /></FormControl>
                <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="gstin" render={({ field }) => (
            <FormItem>
                <FormLabel className="text-[10px] font-black uppercase text-slate-400">GSTIN Registry</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} placeholder="09AAAAA..." className="h-12 rounded-xl uppercase font-mono shadow-sm" /></FormControl>
                <FormMessage />
            </FormItem>
          )} />
        </div>
        
        <Separator className="my-6" />

        {/* REGISTRY PARTICULARS SECTION (REPLACED FINANCIAL HANDBOOK) */}
        <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" /> Registry Particulars
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-slate-50/50 rounded-[2rem] border border-slate-100 shadow-inner">
                <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Physical Address node *</FormLabel>
                        <FormControl>
                            <div className="relative group">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                <Input placeholder="Full registered business address" {...field} className="h-12 pl-12 rounded-xl bg-white border-slate-200" />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="pan" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">PAN Registry Number *</FormLabel>
                        <FormControl><Input placeholder="ABCDE1234F" {...field} className="h-12 rounded-xl uppercase font-black tracking-widest bg-white border-slate-200" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
        </div>

        <div className="flex gap-4 pt-8 border-t border-slate-100 justify-end">
          <Button type="button" variant="ghost" onClick={() => form.reset()} className="font-black text-slate-400 uppercase text-[11px] tracking-widest px-8 h-12">Discard</Button>
          <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-16 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Commit Vendor Node
          </Button>
        </div>
      </form>
    </Form>
  );
}
