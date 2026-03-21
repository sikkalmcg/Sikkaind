'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileDown, Upload, ToggleLeft, ToggleRight, Search, Factory } from 'lucide-react';
import type { WithId, FreightMaster, Plant, MasterChargeType } from '@/types';
import { addMockFreightMaster, logBulkUpload, mockMasterChargeTypes } from '@/lib/mock-data';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import SearchHelpModal from '@/components/sikka-accounts/invoice-report/SearchHelpModal';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLoading } from '@/context/LoadingContext';
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { cn } from '@/lib/utils';

const formSchema = z.object({
  plantId: z.string().min(1, "PLANT ID is required."),
  chargeTypeId: z.string().min(1, 'Charge Type is required.'),
  from: z.string().min(1, "From location is required."),
  destination: z.string().min(1, "Destination is required."),
  rate: z.coerce.number().positive(),
  isGstApplicable: z.boolean().default(false),
  gstRate: z.coerce.number().optional(),
  ota: z.boolean().default(false),
  validFrom: z.date().optional(),
  validTo: z.date().optional(),
  validityDate: z.date().optional(),
}).refine(data => {
    if (data.isGstApplicable) {
        return data.gstRate !== undefined && data.gstRate > 0;
    }
    return true;
}, {
    message: "GST Rate is required if GST is applicable.",
    path: ["gstRate"],
}).refine(data => {
    // Logic: If NOT OTA (NO), From/To required. If OTA (YES), Validity Date required.
    if (!data.ota) {
        return !!data.validFrom && !!data.validTo;
    }
    return !!data.validityDate;
}, {
    message: "Mandatory date fields missing.",
    path: ["validFrom"],
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateFreightMasterTab({ plants }: { plants: WithId<Plant>[] }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { showLoader, hideLoader } = useLoading();
  const { setSaveAction, setCancelAction, setStatusBar } = useSikkaAccountsPage();
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSearchHelpOpen, setIsSearchHelpOpen] = useState(false);

  const ctQuery = useMemo(() => 
    firestore ? query(collection(firestore, "master_charge_types")) : null, 
    [firestore]
  );
  const { data: dbChargeTypes } = useCollection<MasterChargeType>(ctQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantId: '',
      from: '',
      destination: '',
      rate: undefined,
      ota: false,
      isGstApplicable: false,
    },
  });

  const { watch, handleSubmit, reset, setValue } = form;
  const ota = watch('ota');
  const isGstApplicable = watch('isGstApplicable');
  const selectedPlantId = watch('plantId');

  const filteredChargeTypes = useMemo(() => {
    if (!selectedPlantId || !dbChargeTypes) return [];
    return dbChargeTypes.filter(ct => ct.plantId === selectedPlantId);
  }, [selectedPlantId, dbChargeTypes]);

  const onCancel = useCallback(() => {
    reset();
    setStatusBar({message: 'Data entry cancelled.', type: 'warning'});
  }, [reset, setStatusBar]);
  
  const onSubmit = useCallback((values: FormValues) => {
    showLoader();
    try {
      addMockFreightMaster(values);
      setStatusBar({ message: 'Freight Master entry saved successfully.', type: 'success' });
      reset();
    } catch (error: any) {
      setStatusBar({ message: error.message, type: 'error' });
    } finally {
        hideLoader();
    }
  }, [reset, setStatusBar, showLoader, hideLoader]);

  useEffect(() => {
    setSaveAction(() => handleSubmit(onSubmit));
    setCancelAction(() => onCancel);
    return () => {
        setSaveAction(null);
        setCancelAction(null);
    };
  }, [setSaveAction, handleSubmit, onSubmit, setCancelAction, onCancel]);
  
  const handlePlantSelect = (plantId: string) => {
    setValue('plantId', plantId, { shouldValidate: true });
    setIsSearchHelpOpen(false);
  };

  const handleTemplateDownload = () => {
    const headers = ["Plant", "Charge Type", "From", "Destination", "Rate", "GST Applicable", "GST %", "OTA Applicable", "Valid From", "Valid Up To"];
    const sampleData = ["ID23", "Freight Charge", "Ghaziabad", "Mumbai", 2500, "Yes", 12, "No", "01/04/2024", "31/03/2025"];
    const ws = XLSX.utils.aoa_to_sheet([headers, [sampleData]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Freight Master");
    XLSX.writeFile(wb, "FreightMaster_Template.xlsx");
  };

  return (
    <>
      <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50 border-b p-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-900 text-white rounded-lg"><Factory className="h-5 w-5" /></div>
                <div>
                    <CardTitle className="text-xl font-black uppercase italic text-blue-900">Create Freight Master</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Registry: Persistent Logistics Node Rates</CardDescription>
                </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleTemplateDownload} className="h-9 px-4 font-bold text-[11px] uppercase border-slate-300">
                <FileDown className="mr-2 h-4 w-4" /> Bulk Template
              </Button>
              <Button variant="outline" size="sm" asChild className="h-9 px-4 font-bold text-[11px] uppercase border-slate-300">
                <label htmlFor="freight-bulk-upload" className="cursor-pointer">
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Bulk Upload
                </label>
              </Button>
              <input id="freight-bulk-upload" type="file" className="hidden" accept=".xlsx,.xls" disabled={isUploading} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-10">
          <Form {...form}>
            <form className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-10 items-end">
                 <FormField control={form.control} name="plantId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PLANT ID *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 border-slate-200 shadow-sm focus:ring-blue-900"><SelectValue placeholder="Pick Node" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">
                                {plants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3">{p.id}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                 )} />
                <FormField control={form.control} name="chargeTypeId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Charge Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPlantId}>
                            <FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-bold border-slate-200 shadow-sm focus:ring-blue-900"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">
                                {filteredChargeTypes.map(c => <SelectItem key={c.id} value={c.id} className="font-bold py-3">{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="from" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">From *</FormLabel><FormControl><Input className="h-12 rounded-xl font-black text-slate-900 focus:ring-blue-900 shadow-sm" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="destination" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Destination *</FormLabel><FormControl><Input className="h-12 rounded-xl font-black text-slate-900 focus:ring-blue-900 shadow-sm" {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                <div className="flex flex-wrap items-end gap-10 lg:col-span-4 bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner mt-4">
                    <FormField control={form.control} name="rate" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Standard Rate *</FormLabel><FormControl><Input type="number" className="h-11 rounded-xl font-black text-lg text-blue-900 bg-white" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="isGstApplicable" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-400">GST Active</FormLabel><FormControl><Switch className="mt-2" checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    {isGstApplicable && <FormField control={form.control} name="gstRate" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">GST % *</FormLabel><FormControl><Input type="number" className="h-11 rounded-xl font-bold bg-white" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />}
                    <FormField control={form.control} name="ota" render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">One-Time (OTA)</FormLabel>
                            <Button type="button" variant="outline" size="icon" onClick={() => field.onChange(!field.value)} className="mt-2 rounded-xl h-11 w-11 bg-white border-slate-200">
                                {field.value ? <ToggleRight className="text-emerald-600 h-6 w-6"/> : <ToggleLeft className="text-slate-300 h-6 w-6"/>}
                            </Button>
                        </FormItem>
                    )} />
                    
                    {/* Logic: If OTA is NO, show From/To dates. If YES, show Validity Date. */}
                    {!ota ? (
                        <>
                            <FormField control={form.control} name="validFrom" render={({ field }) => (<FormItem className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300"><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">From Date *</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 rounded-xl bg-white border-blue-200 shadow-sm" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="validTo" render={({ field }) => (<FormItem className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300"><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">To Date *</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 rounded-xl bg-white border-blue-200 shadow-sm" /></FormControl><FormMessage /></FormItem>)} />
                        </>
                    ) : (
                        <FormField control={form.control} name="validityDate" render={({ field }) => (<FormItem className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300"><FormLabel className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Validity Date *</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 rounded-xl bg-white border-emerald-200 shadow-sm" /></FormControl><FormMessage /></FormItem>)} />
                    )}
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <SearchHelpModal isOpen={isSearchHelpOpen} onClose={() => setIsSearchHelpOpen(false)} title="Select a Plant" data={plants} onSelect={handlePlantSelect} />
    </>
  );
}
