'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Customer, Plant, WithId } from '@/types';
import { statesAndUTs } from '@/lib/states';
import { Separator } from '@/components/ui/separator';

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg"];

const formSchema = z.object({
  plantId: z.string().min(1, "Plant is required."),
  name: z.string().min(1, "Name is required."),
  address: z.string().min(1, "Address is required."),
  gstin: z.string().regex(gstinRegex, 'Invalid GSTIN format.'),
  pan: z.string().regex(panRegex, 'Invalid PAN format.'),
  state: z.string().min(1, 'State is required.'),
  stateCode: z.string().min(1, 'State code is required.'),
  contactPerson: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  upiId: z.string().optional(),
  qrCode: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: WithId<Customer>;
    onSave: (id: string, data: Partial<Customer>) => void;
    plants: WithId<Plant>[];
}

export default function EditCustomerModal({ isOpen, onClose, customer, onSave, plants }: EditCustomerModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const { watch, setValue, formState: { isSubmitting } } = form;
  const gstin = watch('gstin');

  useEffect(() => {
    if (customer) {
      form.reset({
        plantId: customer.plantId,
        name: customer.name,
        address: customer.address,
        gstin: customer.gstin,
        pan: customer.pan,
        state: customer.state,
        stateCode: customer.stateCode,
        contactPerson: customer.contactPerson || '',
        mobile: customer.mobile || '',
        email: customer.email || '',
        bankName: customer.bankName || '',
        accountNumber: customer.accountNumber || '',
        ifsc: customer.ifsc || '',
        upiId: customer.upiId || '',
      });
    }
  }, [customer, form]);

  useEffect(() => {
    if (gstin && gstin.length >= 2) {
        const code = gstin.substring(0, 2);
        const stateInfo = statesAndUTs.find(s => s.code === code);
        if (stateInfo) {
            setValue('state', stateInfo.name, { shouldValidate: true });
            setValue('stateCode', stateInfo.code, { shouldValidate: true });
        }
    }
  }, [gstin, setValue]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onSubmit = async (values: FormValues) => {
    let qrCodeUrl = customer.qrCodeUrl;
    if (values.qrCode?.[0]) {
      qrCodeUrl = await convertFileToBase64(values.qrCode[0]);
    }

    const dataToSave = {
      ...values,
      qrCodeUrl,
    };
    delete (dataToSave as any).qrCode;

    onSave(customer.id, dataToSave);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit {customer.clientType}: {customer.name}</DialogTitle>
          <DialogDescription>Update the details for this customer.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                <FormField control={form.control} name="plantId" render={({ field }) => (
                    <FormItem><FormLabel>Plant</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a plant code" /></SelectTrigger></FormControl>
                            <SelectContent>{plants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{customer.clientType} Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="pan" render={({ field }) => (<FormItem><FormLabel>PAN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="stateCode" render={({ field }) => (<FormItem><FormLabel>State Code</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="mobile" render={({ field }) => (<FormItem><FormLabel>Mobile (Optional)</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            {customer.clientType === 'Vendor' && (
                <>
                    <Separator />
                    <h3 className="font-semibold text-lg">Financial Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        <FormField control={form.control} name="bankName" render={({ field }) => (<FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="accountNumber" render={({ field }) => (<FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="ifsc" render={({ field }) => (<FormItem><FormLabel>IFSC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="upiId" render={({ field }) => (<FormItem><FormLabel>UPI ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="qrCode" render={({ field }) => (
                            <FormItem><FormLabel>Change QR Code</FormLabel><FormControl><Input type="file" accept="image/png, image/jpeg" onChange={e => field.onChange(e.target.files)} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update Customer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}