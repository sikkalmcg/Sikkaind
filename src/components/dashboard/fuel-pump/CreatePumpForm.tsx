'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import type { FuelPump } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FuelPumpPaymentMethods, VendorCapacities } from '@/lib/constants';
import { Checkbox } from '@/components/ui/checkbox';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
  name: z.string().min(1, 'Vendor Name is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().min(1, 'Physical Address is mandatory'),
  route: z.string().min(1, 'Operational Route is mandatory'),
  capacities: z.array(z.string()).min(1, 'Select at least one capacity node'),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  paymentMethod: z.enum(FuelPumpPaymentMethods).optional(),
  receiverName: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  upiId: z.string().optional(),
  qrCode: z.any().optional()
    .refine((files) => !files || files?.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max image size is 1MB.`)
    .refine((files) => !files || files?.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type), "Only .jpg, .jpeg, .png and .webp formats are supported."),
}).superRefine((data, ctx) => {
    if (!data.gstin && !data.pan) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either GSTIN or PAN is required.",
            path: ["pan"],
        });
    }

    if (data.paymentMethod && data.paymentMethod !== 'Cash') {
        if (!data.receiverName) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Receiver Name is required.", path: ["receiverName"] });
        }
    }
    
    if (data.paymentMethod === 'Banking' || data.paymentMethod === 'Cheque' || data.paymentMethod === 'Multiple') {
        if (!data.bankName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank Name is required.", path: ["bankName"] });
        if (!data.accountNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Account Number is required.", path: ["accountNumber"] });
        if (!data.ifsc) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "IFSC Code is required.", path: ["ifsc"] });
    }
    if (data.paymentMethod === 'UPI Payment' || data.paymentMethod === 'Multiple') {
        if (!data.upiId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "UPI ID is required.", path: ["upiId"] });
    }
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
      capacities: [],
      gstin: '',
      pan: '',
    },
  });

  const { watch, setValue, formState: { isSubmitting } } = form;
  const paymentMethod = watch('paymentMethod');
  const selectedCapacities = watch('capacities') || [];

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const toggleCapacity = (val: string) => {
    const next = selectedCapacities.includes(val)
        ? selectedCapacities.filter(c => c !== val)
        : [...selectedCapacities, val];
    setValue('capacities', next, { shouldValidate: true });
  };

  const onSubmit = async (values: FormValues) => {
    let qrCodeUrl = undefined;
    if (values.qrCode?.[0]) {
      qrCodeUrl = await convertFileToBase64(values.qrCode[0]);
    }

    const { qrCode: _, ...rest } = values;
    const dataToSave = {
      ...rest,
      qrCodeUrl,
    } as Omit<FuelPump, 'id'>;

    await onSave(dataToSave);
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Vendor Phone</FormLabel>
                <FormControl><Input type="tel" placeholder="Landline Node" {...field} className="h-12 rounded-xl font-mono" /></FormControl>
                <FormMessage />
            </FormItem>
          )} />
          
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem className="md:col-span-2">
                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Address Node *</FormLabel>
                <FormControl><Input placeholder="Physical business address" {...field} className="h-12 rounded-xl" /></FormControl>
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

          <div className="md:col-span-3 space-y-4 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 shadow-inner">
            <FormLabel className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Asset Capacity Authorization *</FormLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {VendorCapacities.map(cap => (
                    <div key={cap} onClick={() => toggleCapacity(cap)} className={cn(
                        "flex items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-pointer group",
                        selectedCapacities.includes(cap) ? "bg-blue-900 border-blue-900 shadow-lg text-white" : "bg-white border-slate-100 hover:border-slate-300 text-slate-400"
                    )}>
                        <Checkbox checked={selectedCapacities.includes(cap)} className="hidden" />
                        <span className="text-[9px] font-black uppercase leading-tight">{cap}</span>
                    </div>
                ))}
            </div>
            <FormMessage>{form.formState.errors.capacities?.message}</FormMessage>
          </div>

          <FormField control={form.control} name="gstin" render={({ field }) => (
            <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">GSTIN Registry</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="09AAAAA..." className="h-11 rounded-xl uppercase font-mono" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="pan" render={({ field }) => (
            <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">PAN Registry</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="ABCDE1234F" className="h-11 rounded-xl uppercase font-mono" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        
        <Separator className="my-6" />

        <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Payment Handbook</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Primary Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">{FuelPumpPaymentMethods.map(pm => <SelectItem key={pm} value={pm} className="font-bold py-2">{pm}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            {paymentMethod && paymentMethod !== 'Cash' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-500">
                    <FormField control={form.control} name="receiverName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Receiver Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl font-bold" /></FormControl><FormMessage /></FormItem>)} />
                    {(paymentMethod === 'Banking' || paymentMethod === 'Cheque' || paymentMethod === 'Multiple') && (
                        <>
                            <FormField control={form.control} name="bankName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Bank Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="accountNumber" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">A/C Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl font-mono" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="ifsc" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">IFSC Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl uppercase font-mono" /></FormControl></FormItem>)} />
                        </>
                    )}
                     {(paymentMethod === 'UPI Payment' || paymentMethod === 'Multiple') && (
                        <>
                            <FormField control={form.control} name="upiId" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">UPI ID Registry</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="qrCode" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">QR Manifest</FormLabel><FormControl><Input type="file" accept="image/*" onChange={e => field.onChange(e.target.files)} className="h-11 pt-3" /></FormControl></FormItem>)} />
                        </>
                    )}
                </div>
            )}
        </div>

        <div className="flex gap-4 pt-8 border-t border-slate-100 justify-end">
          <Button type="button" variant="ghost" onClick={() => form.reset()} className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-8 h-12">Discard</Button>
          <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-16 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Commit Vendor Node
          </Button>
        </div>
      </form>
    </Form>
  );
}
