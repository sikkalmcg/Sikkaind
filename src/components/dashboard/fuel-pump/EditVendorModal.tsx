
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
import { Loader2, Save, Edit2, Upload, X } from 'lucide-react';
import { FuelPumpPaymentMethods } from '@/lib/constants';
import type { FuelPump, WithId } from '@/types';
import { cn, sanitizeRegistryNode } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
  name: z.string().min(1, 'Vendor Name is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().min(1, 'Physical Address is mandatory'),
  route: z.string().min(1, 'Operational Route is mandatory'),
  gstin: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  paymentMethod: z.enum(FuelPumpPaymentMethods, { required_error: 'Payment method is required' }),
  receiverName: z.string().optional().or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  accountNumber: z.string().optional().or(z.literal('')),
  ifsc: z.string().optional().or(z.literal('')),
  upiId: z.string().optional().or(z.literal('')),
  qrCode: z.any().optional(),
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

interface EditVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: WithId<FuelPump>;
  onSave: (id: string, data: Partial<FuelPump>) => Promise<void>;
}

export default function EditVendorModal({ isOpen, onClose, vendor, onSave }: EditVendorModalProps) {
  const [preview, setPreview] = useState<string | null>(vendor.qrCodeUrl || null);

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
      paymentMethod: (vendor.paymentMethod as any) || 'Cash',
      receiverName: vendor.receiverName || '',
      bankName: vendor.bankName || '',
      accountNumber: vendor.accountNumber || '',
      ifsc: vendor.ifsc || '',
      upiId: vendor.upiId || '',
    },
  });

  const { watch, handleSubmit, formState: { isSubmitting }, reset } = form;
  const paymentMethod = watch('paymentMethod');

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
        paymentMethod: (vendor.paymentMethod as any) || 'Cash',
        receiverName: vendor.receiverName || '',
        bankName: vendor.bankName || '',
        accountNumber: vendor.accountNumber || '',
        ifsc: vendor.ifsc || '',
        upiId: vendor.upiId || '',
      });
      setPreview(vendor.qrCodeUrl || null);
    }
  }, [vendor, isOpen, reset]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onSubmit = async (values: FormValues) => {
    let qrCodeUrl = vendor.qrCodeUrl;
    if (values.qrCode?.[0]) {
      qrCodeUrl = await convertFileToBase64(values.qrCode[0]);
    }

    const { qrCode: _, ...rest } = values;
    const sanitizedData = sanitizeRegistryNode({
      ...rest,
      qrCodeUrl,
    });

    await onSave(vendor.id, sanitizedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] border-none shadow-3xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-blue-400" /> Edit Vendor Node
          </DialogTitle>
          <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Correction Handbook</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Vendor Name *</FormLabel>
                    <FormControl><Input {...field} className="h-12 rounded-xl font-bold" /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Vendor Mobile *</FormLabel>
                    <FormControl><Input {...field} maxLength={10} className="h-12 rounded-xl font-mono font-bold" /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="route" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Operational Route *</FormLabel>
                    <FormControl><Input {...field} className="h-12 rounded-xl font-black uppercase text-blue-900" /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator />

            <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Payment Handbook</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">Primary Method</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent className="rounded-xl" modal={false}>{FuelPumpPaymentMethods.map(pm => <SelectItem key={pm} value={pm} className="font-bold py-2">{pm}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>

                {paymentMethod !== 'Cash' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2">
                        <FormField control={form.control} name="receiverName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Receiver Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl font-bold" /></FormControl></FormItem>)} />
                        {(paymentMethod === 'Banking' || paymentMethod === 'Cheque' || paymentMethod === 'Multiple') && (
                            <>
                                <FormField control={form.control} name="bankName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Bank Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl" /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="accountNumber" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">A/C Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl font-mono" /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="ifsc" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">IFSC Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl uppercase font-mono" /></FormControl></FormItem>)} />
                            </>
                        )}
                    </div>
                )}
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
