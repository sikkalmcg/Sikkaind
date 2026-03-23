
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
import { FuelPumpPaymentMethods } from '@/lib/constants';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
  name: z.string().min(1, 'Fuel Pump Name is required'),
  address: z.string().optional(),
  ownerName: z.string().min(1, 'Owner Name is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
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
    // Mandatory Check: Pump Name, Owner Name, Mobile
    if (!data.name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fuel Pump Name is required.", path: ["name"] });
    if (!data.ownerName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Owner Name is required.", path: ["ownerName"] });
    if (!data.mobile) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mobile Number is required.", path: ["mobile"] });

    // Conditional validation for GSTIN or PAN: Either one must be provided
    if (!data.gstin && !data.pan) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either GSTIN or PAN is required.",
            path: ["gstin"],
        });
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
      address: '',
      ownerName: '',
      mobile: '',
      gstin: '',
      pan: '',
    },
  });

  const { watch, formState: { isSubmitting } } = form;
  const paymentMethod = watch('paymentMethod');

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Fuel Pump Name *</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="ownerName" render={({ field }) => (
            <FormItem><FormLabel>Owner Name *</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="mobile" render={({ field }) => (
            <FormItem><FormLabel>Mobile Number *</FormLabel><FormControl><Input type="tel" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="gstin" render={({ field }) => (
            <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="Required if PAN is blank" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="pan" render={({ field }) => (
            <FormItem><FormLabel>PAN Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="Required if GST is blank" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        
        <Separator className="my-6" />

        <div>
            <h3 className="text-md font-medium mb-4">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a method" /></SelectTrigger></FormControl>
                            <SelectContent>{FuelPumpPaymentMethods.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            {paymentMethod && paymentMethod !== 'Cash' && (
                <div className="mt-6 space-y-6">
                    {(paymentMethod === 'Banking' || paymentMethod === 'Cheque' || paymentMethod === 'Multiple') && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <FormField control={form.control} name="receiverName" render={({ field }) => (<FormItem><FormLabel>Receiver Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="bankName" render={({ field }) => (<FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="accountNumber" render={({ field }) => (<FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="ifsc" render={({ field }) => (<FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    )}
                     {(paymentMethod === 'UPI Payment' || paymentMethod === 'Multiple') && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             {paymentMethod === 'UPI Payment' && <FormField control={form.control} name="receiverName" render={({ field }) => (<FormItem><FormLabel>Receiver Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />}
                            <FormField control={form.control} name="upiId" render={({ field }) => (<FormItem><FormLabel>UPI ID</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="qrCode" render={({ field }) => (<FormItem><FormLabel>QR Code</FormLabel><FormControl><Input type="file" accept="image/*" onChange={e => field.onChange(e.target.files)} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    )}
                </div>
            )}
        </div>


        <div className="flex gap-4 pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
          <Button type="button" variant="destructive" onClick={() => form.reset()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
