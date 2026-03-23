'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Switch } from '@/components/ui/switch';
import { Loader2, Search } from 'lucide-react';
import type { MasterDataItem, Plant, WithId } from '@/types';
import { InvoiceTypes, MasterDataChargeTypes, MasterDataUnitTypes } from '@/lib/constants';
import { mockAccountPlants } from '@/lib/mock-data';
import SearchHelpModal from '@/components/sikka-accounts/invoice-report/SearchHelpModal';

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

interface EditItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: WithId<MasterDataItem>;
    onSave: (id: string, data: Partial<Omit<MasterDataItem, 'id'>>) => void;
}

export default function EditItemModal({ isOpen, onClose, item, onSave }: EditItemModalProps) {
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [isSearchHelpOpen, setIsSearchHelpOpen] = useState(false);
  useEffect(() => { setPlants(mockAccountPlants) }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const { watch, formState: { isSubmitting }, setValue } = form;
  const isGstApplicable = watch('isGstApplicable');

  useEffect(() => {
    if (item) {
        form.reset({
            ...item,
            validFrom: new Date(item.validFrom),
            validTo: new Date(item.validTo),
        });
    }
  }, [item, form]);

  const onSubmit = (values: FormValues) => {
    onSave(item.id, values);
  };
  
  const handleF4 = (e: React.KeyboardEvent) => {
    if (e.key === 'F4') {
        e.preventDefault();
        setIsSearchHelpOpen(true);
    }
  };

  const handlePlantSelect = (code: string) => {
    setValue('plantId', code, { shouldValidate: true });
    setIsSearchHelpOpen(false);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Master Data Item</DialogTitle>
          <DialogDescription>Update details for {item.itemDescription}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-6">
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <FormField control={form.control} name="plantId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Plant</FormLabel>
                        <div className="flex gap-1">
                            <FormControl>
                                <Input {...field} onKeyDown={handleF4} />
                            </FormControl>
                            <Button type="button" variant="outline" size="icon" onClick={() => setIsSearchHelpOpen(true)}>
                                <Search className="h-4 w-4" />
                            </Button>
                        </div>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="invoiceType" render={({ field }) => (<FormItem><FormLabel>Invoice Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl><SelectContent>{InvoiceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="chargeType" render={({ field }) => (<FormItem><FormLabel>Charge Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl><SelectContent>{MasterDataChargeTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="itemDescription" render={({ field }) => (<FormItem><FormLabel>Item Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="hsnSac" render={({ field }) => (<FormItem><FormLabel>HSN/SAC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="unitType" render={({ field }) => (<FormItem><FormLabel>Unit Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger></FormControl><SelectContent>{MasterDataUnitTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="rate" render={({ field }) => (<FormItem><FormLabel>Rate</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="isGstApplicable" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>GST Applicable</FormLabel><FormControl><Switch className="mt-2" checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                {isGstApplicable && <FormField control={form.control} name="gstRate" render={({ field }) => (<FormItem><FormLabel>GST Rate %</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />}
                <FormField control={form.control} name="validFrom" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Valid From</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="validTo" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Valid up to</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update Item
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <SearchHelpModal
        isOpen={isSearchHelpOpen}
        onClose={() => setIsSearchHelpOpen(false)}
        title="Select Plant"
        data={plants}
        onSelect={handlePlantSelect}
    />
    </>
  );
}
