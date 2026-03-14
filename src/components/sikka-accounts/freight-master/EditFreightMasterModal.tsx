'use client';
import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { Loader2, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import type { FreightMaster, WithId, Plant, MasterChargeType } from '@/types';
import SearchHelpModal from '@/components/sikka-accounts/invoice-report/SearchHelpModal';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { mockMasterChargeTypes } from '@/lib/mock-data';
import { Switch } from '@/components/ui/switch';

const formSchema = z.object({
  plantId: z.string().min(1, "Plant is required."),
  chargeTypeId: z.string().min(1, 'Charge Type is required.'),
  from: z.string().min(1, "From location is required."),
  destination: z.string().min(1, "Destination is required."),
  rate: z.coerce.number().positive(),
  isGstApplicable: z.boolean().default(false),
  gstRate: z.coerce.number().optional(),
  validFrom: z.date().optional(),
  validTo: z.date().optional(),
  ota: z.boolean().default(false),
}).refine(data => {
    if (data.isGstApplicable) {
        return data.gstRate !== undefined && data.gstRate > 0;
    }
    return true;
}, {
    message: "GST Rate is required if GST is applicable.",
    path: ["gstRate"],
}).refine(data => {
    if (!data.ota) {
        return !!data.validFrom && !!data.validTo;
    }
    return true;
}, {
    message: "Validity date range is required when OTA is No.",
    path: ["validFrom"],
}).refine(data => {
    if (!data.ota && data.validFrom && data.validTo) {
        return data.validFrom <= data.validTo;
    }
    return true;
}, {
    message: "Valid From must be on or before Valid To.",
    path: ["validFrom"],
});

type FormValues = z.infer<typeof formSchema>;

interface EditFreightMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: WithId<FreightMaster>;
    onSave: (id: string, data: Partial<Omit<FreightMaster, 'id'>>) => void;
    plants: WithId<Plant>[];
}

export default function EditFreightMasterModal({ isOpen, onClose, item, onSave, plants }: EditFreightMasterModalProps) {
  const [isSearchHelpOpen, setIsSearchHelpOpen] = useState(false);
  const [chargeTypes, setChargeTypes] = useState<WithId<MasterChargeType>[]>([]);
  
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });
  const { watch, formState: { isSubmitting }, setValue, reset, handleSubmit } = form;
  const ota = watch('ota');
  const isGstApplicable = watch('isGstApplicable');
  const selectedPlantId = watch('plantId');

  useEffect(() => {
    setChargeTypes(mockMasterChargeTypes);
  }, []);

  const filteredChargeTypes = useMemo(() => {
    return chargeTypes.filter(ct => ct.plantId === selectedPlantId);
  }, [selectedPlantId, chargeTypes]);


  useEffect(() => {
    if (item) {
      reset({
        ...item,
        validFrom: item.validFrom ? new Date(item.validFrom) : undefined,
        validTo: item.validTo ? new Date(item.validTo) : undefined,
      });
    }
  }, [item, reset]);

  const onSubmit = (values: FormValues) => {
    onSave(item.id, values);
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
          <DialogTitle>Edit Freight Master</DialogTitle>
          <DialogDescription>Update details for {item.from} to {item.destination}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-6">
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4 items-end'>
              <FormField control={form.control} name="plantId" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">PLANT ID *</FormLabel>
                    <div className="flex gap-1">
                        <FormControl><Input {...field} onKeyDown={handleF4} className="h-11 rounded-xl font-bold border-slate-200" /></FormControl>
                        <Button type="button" variant="outline" size="icon" onClick={() => setIsSearchHelpOpen(true)} className="h-11 w-11 rounded-xl"><Search className="h-4 w-4" /></Button>
                    </div>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="chargeTypeId" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Charge Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPlantId}><FormControl><SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">{filteredChargeTypes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                    </FormItem>
                )} />
              <FormField control={form.control} name="from" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">From *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="destination" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Destination *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="rate" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Rate *</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-11 rounded-xl font-black text-blue-900" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="isGstApplicable" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-400">GST Active</FormLabel><FormControl><Switch className="mt-2" checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
              {isGstApplicable && <FormField control={form.control} name="gstRate" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">GST % *</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-11 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />}
              <FormField control={form.control} name="validFrom" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-blue-600">Valid From</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} disabled={ota} className="h-11" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="validTo" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-blue-600">Valid Up To</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} disabled={ota} className="h-11" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="ota" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-400">OTA Applicable</FormLabel>
                      <Button type="button" variant="outline" size="icon" onClick={() => field.onChange(!field.value)} className="mt-2 rounded-xl h-11 w-11">
                          {field.value ? <ToggleRight className="text-emerald-600 h-6 w-6"/> : <ToggleLeft className="text-slate-300 h-6 w-6"/>}
                      </Button>
                  </FormItem>
              )} />
            </div>
            <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 border-t flex-row justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="font-bold">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-10 h-11 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Update Registry
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <SearchHelpModal isOpen={isSearchHelpOpen} onClose={() => setIsSearchHelpOpen(false)} title="Select a Plant" data={plants} onSelect={handlePlantSelect} />
    </>
  );
}
