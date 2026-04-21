'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Sparkles, ShieldCheck, Fingerprint } from 'lucide-react';
import { PartyTypes } from '@/lib/constants';
import type { Party, WithId } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { statesAndUTs } from '@/lib/states';

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const formSchema = z.object({
  name: z.string().min(1, 'Party Name is required.'),
  customerCode: z.string().min(1, 'Customer Code is mandatory.').toUpperCase().transform(v => v.replace(/\s+/g, '')),
  type: z.enum(PartyTypes, { required_error: 'Type is required.' }),
  gstin: z.string().optional().refine(val => !val || val.length === 15, "GSTIN must be 15 characters.").refine(val => !val || gstinRegex.test(val.toUpperCase()), {
    message: 'Invalid GSTIN format.'
  }),
  pan: z.string().optional().refine(val => !val || panRegex.test(val.toUpperCase()), 'Invalid PAN format. Example: ABCDE1234F'),
  mobile: z.string().optional().refine(val => !val || /^\d{10}$/.test(val), 'Enter valid 10 digit mobile number'),
  address: z.string().min(1, 'Address is mandatory.'),
  city: z.string().min(1, 'City is mandatory.'),
  state: z.string().min(1, 'State is required.'),
  stateCode: z.string().min(1, 'State Code is mandatory.'),
});

type FormValues = z.infer<typeof formSchema>;

interface EditPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: WithId<Party>;
  onSave: (id: string, data: Partial<Party>) => void;
}

export default function EditPartyModal({ isOpen, onClose, party, onSave }: EditPartyModalProps) {
  const [isPanAutoFilled, setIsPanAutoFilled] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: party.name,
      customerCode: party.customerCode || '',
      type: party.type as any,
      gstin: party.gstin || '',
      pan: party.pan || '',
      mobile: party.mobile || '',
      address: party.address || '',
      city: party.city || '',
      state: party.state || '',
      stateCode: party.stateCode || '',
    },
  });

  const { watch, formState: { isSubmitting }, setValue } = form;
  const gstinValue = watch('gstin');

  useEffect(() => {
    if (party) {
      form.reset({
        name: party.name,
        customerCode: party.customerCode || '',
        type: party.type as any,
        gstin: party.gstin || '',
        pan: party.pan || '',
        mobile: party.mobile || '',
        address: party.address || '',
        city: party.city || '',
        state: party.state || '',
        stateCode: party.stateCode || '',
      });
    }
  }, [party, form]);

  useEffect(() => {
    if (gstinValue && gstinValue.length === 15) {
        const extractedPan = gstinValue.substring(2, 12).toUpperCase();
        form.setValue('pan', extractedPan, { shouldValidate: true });
        setIsPanAutoFilled(true);

        const code = gstinValue.substring(0, 2);
        const stateInfo = statesAndUTs.find(s => s.code === code);
        if (stateInfo) {
            form.setValue('state', stateInfo.name, { shouldValidate: true });
            form.setValue('stateCode', stateInfo.code, { shouldValidate: true });
        }
    } else {
        setIsPanAutoFilled(false);
    }
  }, [gstinValue, form]);

  const onSubmit = (values: FormValues) => {
    onSave(party.id, {
        ...values,
        pan: values.pan?.toUpperCase(),
        gstin: values.gstin?.toUpperCase(),
        customerCode: values.customerCode?.toUpperCase()
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl border-none shadow-3xl p-0 overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg"><ShieldCheck className="h-6 w-6" /></div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Correct Party Registry</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Ref: {party.id}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 max-h-[75vh] overflow-y-auto">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Party Name *</FormLabel>
                                <FormControl><Input placeholder="Legal name" {...field} className="h-11 font-black text-slate-900 uppercase" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="customerCode" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">Customer Code * <Fingerprint className="h-3 w-3 opacity-40"/></FormLabel>
                                <FormControl><Input placeholder="Unique Code" {...field} className="h-11 font-black text-blue-900 uppercase shadow-inner border-blue-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Type *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 font-bold border-slate-200"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">{PartyTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2.5">{t}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="mobile" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact Number</FormLabel>
                                <FormControl><Input placeholder="10-digit mobile" {...field} value={field.value ?? ''} className="h-11 font-mono" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <FormField control={form.control} name="gstin" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">GSTIN Number</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="09AYQPS6936B1ZV" 
                                        {...field} 
                                        value={field.value ?? ''} 
                                        className="uppercase font-bold border-slate-200 h-11" 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="pan" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                    PAN Number *
                                    {isPanAutoFilled && <Sparkles className="h-3 w-3 text-blue-600 animate-pulse" />}
                                </FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="ABCDE1234F" 
                                        {...field} 
                                        value={field.value ?? ''} 
                                        className={cn(
                                            "uppercase font-black h-11 transition-all duration-500",
                                            isPanAutoFilled && "border-blue-400 bg-blue-50/10 shadow-inner"
                                        )} 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="city" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">City *</FormLabel>
                                <FormControl><Input {...field} className="h-11 font-bold" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="state" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">State *</FormLabel>
                                <Select onValueChange={(val) => {
                                    field.onChange(val);
                                    const stateInfo = statesAndUTs.find(s => s.name === val);
                                    if (stateInfo) setValue('stateCode', stateInfo.code, { shouldValidate: true });
                                }} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent className="max-h-80 rounded-xl">
                                        {statesAndUTs.map(s => <SelectItem key={s.code} value={s.name} className="font-bold py-2.5">{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem className="md:col-span-2 lg:col-span-3">
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Physical Address Node *</FormLabel>
                                <FormControl><Input {...field} className="h-11 font-medium border-slate-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <DialogFooter className="pt-8 border-t bg-slate-50 -mx-8 -mb-8 p-6 flex-row justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-bold text-slate-400 uppercase text-[10px]">Discard</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-12 h-11 rounded-xl gap-2 font-black uppercase text-[11px] tracking-widest shadow-lg border-none transition-all active:scale-95">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Update Registry
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
