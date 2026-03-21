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
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';
import type { MasterDataItem, Plant, WithId, MasterInvoiceType, MasterChargeType, MasterUnitType } from '@/types';
import { mockAccountPlants, mockMasterInvoiceTypes, mockMasterChargeTypes, mockMasterUnitTypes } from '@/lib/mock-data';
import SearchHelpModal from '@/components/sikka-accounts/invoice-report/SearchHelpModal';

const formSchema = z.object({
  plantId: z.string().min(1, "Plant is required"),
  invoiceTypeId: z.string().min(1),
  chargeTypeId: z.string().min(1),
  itemDescription: z.string().min(1, "Item Description is required"),
  hsnSac: z.string().min(1, "HSN/SAC is required"),
  unitTypeId: z.string().min(1),
  rate: z.coerce.number().positive(),
  isGstApplicable: z.boolean().default(false),
  gstRate: z.coerce.number().optional(),
  ota: z.boolean().default(false),
  validFrom: z.date().optional(),
  validTo: z.date().optional(),
}).refine((data) => {
    if (data.isGstApplicable) {
        return data.gstRate !== undefined && data.gstRate > 0;
    }
    return true;
}, {
    message: "GST Rate is required if GST is applicable.",
    path: ["gstRate"],
}).refine((data) => {
    if (!data.ota) {
        return !!data.validFrom && !!data.validTo;
    }
    return true;
}, {
    message: "Validity date range is required when OTA is No.",
    path: ["validFrom"],
}).refine((data) => {
    if (!data.ota && data.validFrom && data.validTo) {
        return data.validFrom <= data.validTo;
    }
    return true;
}, {
    message: "Valid From must be on or before Valid To.",
    path: ["validFrom"],
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
  const [invoiceTypes, setInvoiceTypes] = useState<WithId<MasterInvoiceType>[]>([]);
  const [chargeTypes, setChargeTypes] = useState<WithId<MasterChargeType>[]>([]);
  const [unitTypes, setUnitTypes] = useState<WithId<MasterUnitType>[]>([]);
  const [isSearchHelpOpen, setIsSearchHelpOpen] = useState(false);
  useEffect(() => { setPlants(mockAccountPlants) }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const { watch, formState: { isSubmitting }, setValue } = form;
  const isGstApplicable = watch('isGstApplicable');
  const ota = watch('ota');
  const selectedPlantId = watch('plantId');

  useEffect(() => {
    if (selectedPlantId) {
        setInvoiceTypes(mockMasterInvoiceTypes.filter(it => it.plantId === selectedPlantId));
        setChargeTypes(mockMasterChargeTypes.filter(ct => ct.plantId === selectedPlantId));
        setUnitTypes(mockMasterUnitTypes.filter(ut => ut.plantId === selectedPlantId));
    } else {
        setInvoiceTypes([]);
        setChargeTypes([]);
        setUnitTypes([]);
    }
  }, [selectedPlantId]);
  
  useEffect(() => {
    if (item) {
        form.reset({
            ...item,
            validFrom: item.validFrom ? new Date(item.validFrom) : undefined,
            validTo: item.validTo ? new Date(item.validTo) : undefined,
        });
    }
  }, [item, form]);

  const onSubmit = (values: FormValues) => {
    let dataToSave: Partial<Omit<MasterDataItem, 'id'>> = {...values};
    if (values.ota) {
        dataToSave.validFrom = undefined;
        dataToSave.validTo = undefined;
    }
    onSave(item.id, dataToSave);
  };
  
  const handleF4 = (e: React.KeyboardEvent) => {
    if (e.key === 'F4') {
        e.preventDefault();
        setIsSearchHelpOpen(true);
    }
  };

  const handlePlantSelect = (plantId: string) => {
    setValue('plantId', plantId, { shouldValidate: true });
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
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select Plant" /></SelectTrigger></FormControl>
                            <SelectContent>{plants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="invoiceTypeId" render={({ field }) => (<FormItem><FormLabel>Invoice Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl><SelectContent>{invoiceTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="chargeTypeId" render={({ field }) => (<FormItem><FormLabel>Charge Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl><SelectContent>{chargeTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="itemDescription" render={({ field }) => (<FormItem><FormLabel>Item Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="hsnSac" render={({ field }) => (<FormItem><FormLabel>HSN/SAC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="unitTypeId" render={({ field }) => (<FormItem><FormLabel>Unit Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger></FormControl><SelectContent>{unitTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="rate" render={({ field }) => (<FormItem><FormLabel>Rate</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="isGstApplicable" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>GST Applicable</FormLabel><FormControl><Switch className="mt-2" checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                {isGstApplicable && <FormField control={form.control} name="gstRate" render={({ field }) => (<FormItem><FormLabel>GST Rate %</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />}
                <FormField control={form.control} name="ota" render={({ field }) => (
                    <FormItem className="flex flex-col pt-2">
                        <FormLabel>OTA (One Time Approval)</FormLabel>
                        <FormControl>
                            <div className="flex items-center space-x-2 pt-2">
                                <Label htmlFor="ota-switch-edit">No</Label>
                                <Switch id="ota-switch-edit" checked={field.value} onCheckedChange={field.onChange} />
                                <Label htmlFor="ota-switch-edit">Yes</Label>
                            </div>
                        </FormControl>
                    </FormItem>
                )} />
                <FormField control={form.control} name="validFrom" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Valid From</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} disabled={ota} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="validTo" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Valid up to</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} disabled={ota} /></FormControl><FormMessage /></FormItem>)} />
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
