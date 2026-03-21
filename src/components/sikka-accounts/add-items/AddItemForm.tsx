
'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import type { MasterDataItem, Plant, WithId } from '@/types';
import { InvoiceTypes, MasterDataChargeTypes, MasterDataUnitTypes } from '@/lib/constants';
import { mockPlants } from '@/lib/mock-data';

const formSchema = z.object({
  plantId: z.string().min(1, "Plant is required"),
  invoiceType: z.enum(InvoiceTypes),
  chargeType: z.enum(MasterDataChargeTypes),
  itemDescription: z.string().min(1, "Item Description is required"),
  hsnSac: z.string().min(1, "HSN/SAC is required"),
  unitType: z.enum(MasterDataUnitTypes),
  rate: z.coerce.number().positive(),
  isGstApplicable: z.boolean().default(false),
  gstRate: z.coerce.number().optional(),
  validFrom: z.date({ required_error: 'Validity start date is required.' }),
  validTo: z.date({ required_error: 'Validity end date is required.' }),
}).refine((data) => {
    if (data.isGstApplicable) {
        return data.gstRate !== undefined && data.gstRate > 0;
    }
    return true;
}, {
    message: "GST Rate is required if GST is applicable.",
    path: ["gstRate"],
});

type FormValues = z.infer<typeof formSchema>;

interface AddItemFormProps {
    onSave: (data: Omit<MasterDataItem, 'id'>) => void;
}

export default function AddItemForm({ onSave }: AddItemFormProps) {
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  useEffect(() => {
    setPlants(mockPlants);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { isGstApplicable: false },
  });
  
  const { watch, formState: { isSubmitting } } = form;
  const isGstApplicable = watch('isGstApplicable');

  const onSubmit = (values: FormValues) => {
    onSave(values);
    form.reset({ isGstApplicable: false });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Material Master</CardTitle>
        <CardDescription>Add a new material master item for invoicing.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <FormField control={form.control} name="plantId" render={({ field }) => (<FormItem><FormLabel>Plant Code</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Plant" /></SelectTrigger></FormControl><SelectContent>{plants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="invoiceType" render={({ field }) => (<FormItem><FormLabel>Invoice Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl><SelectContent>{InvoiceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="chargeType" render={({ field }) => (<FormItem><FormLabel>Charge Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl><SelectContent>{MasterDataChargeTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="itemDescription" render={({ field }) => (<FormItem><FormLabel>Item Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="hsnSac" render={({ field }) => (<FormItem><FormLabel>HSN/SAC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="unitType" render={({ field }) => (<FormItem><FormLabel>Unit Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger></FormControl><SelectContent>{MasterDataUnitTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="rate" render={({ field }) => (<FormItem><FormLabel>Rate</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="isGstApplicable" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>GST Applicable</FormLabel><FormControl><Switch className="mt-2" checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                {isGstApplicable && <FormField control={form.control} name="gstRate" render={({ field }) => (<FormItem><FormLabel>GST Rate %</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />}
                <FormField control={form.control} name="validFrom" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Valid From</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="validTo" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Valid up to</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Execute (F8)</Button>
              <Button type="button" variant="outline" onClick={() => form.reset({ isGstApplicable: false })}>Cancel</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
