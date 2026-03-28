'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/date-picker';
import type { Plant, Shipment, WithId, SubUser, Party, MasterQtyType, Carrier } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Search, Upload, Truck, Info, Calculator, Trash2, PlusCircle } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, doc, runTransaction, where, serverTimestamp, orderBy, getDoc } from "firebase/firestore";
import { cn, normalizePlantId, formatSequenceId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import * as XLSX from 'xlsx';
import { PaymentTerms } from '@/lib/constants';

// ========== SCHEMA ========== //
const formSchema = z.object({
  originPlantId: z.string().min(1, 'Plant node selection is required.'),
  consignor: z.string().min(1, 'Consignor is mandatory.'),
  consignorGtin: z.string().optional(),
  loadingPoint: z.string().min(1, 'Lifting city is required.'),
  billToParty: z.string().min(1, 'Consignee is mandatory.'),
  billToGtin: z.string().optional(),
  isSameAsBillTo: z.boolean().default(false),
  shipToParty: z.string().optional(),
  shipToGtin: z.string().optional(),
  unloadingPoint: z.string().min(1, 'Destination city is mandatory.'),
  quantity: z.coerce.number().min(0.001, 'Quantity must be positive'),
  materialTypeId: z.string().min(1, 'UOM is required.'),
  lrNumber: z.string().optional().or(z.literal('')),
  lrDate: z.date().optional().nullable(),
  carrierId: z.string().optional().or(z.literal('')),
  paymentTerm: z.enum(PaymentTerms).optional(),
  deliveryAddress: z.string().optional().or(z.literal('')),
  items: z.array(z.object({
    invoiceNumber: z.string().min(1, "Doc ref required"),
    ewaybillNumber: z.string().optional(),
    units: z.coerce.number().min(1, "Units required"),
    unitType: z.string().default('Package'),
    itemDescription: z.string().min(1, "Item desc required"),
    weight: z.coerce.number().min(0.001, "Weight required"),
    hsnSac: z.string().optional(),
  })).optional().default([]),
});

type FormValues = z.infer<typeof formSchema>;

// ========== HELPER COMPONENTS ========== //

function AutocompleteInput({ value, onChange, onSearchClick, suggestions, placeholder, label, error, disabled = false, onSelect }: { value: string; onChange: (val: string) => void; onSearchClick: () => void; suggestions: Party[]; placeholder: string; label: string; error?: string; disabled?: boolean; onSelect?: (party: Party) => void; }) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filteredSuggestions = useMemo(() => {
        if (!value) return [];
        return suggestions.filter(s => s.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
    }, [value, suggestions]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <FormItem className="relative" ref={wrapperRef}>
            <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">{label}</FormLabel>
            <div className="flex gap-3">
                <FormControl>
                    <div className="relative flex-1">
                        <Input placeholder={placeholder} value={value} onChange={(e) => { onChange(e.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} className="h-14 rounded-2xl font-black text-slate-900 border-slate-200 bg-slate-50/30 focus-visible:ring-blue-900" disabled={disabled} />
                        {isOpen && filteredSuggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                                {filteredSuggestions.map((suggestion) => (
                                    <div key={suggestion.id} onClick={() => { if(onSelect) onSelect(suggestion); else onChange(suggestion.name); setIsOpen(false); }} className="px-5 py-3 cursor-pointer hover:bg-blue-50 border-b last:border-0">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black uppercase tracking-tight">{suggestion.name}</span>
                                            <span className="text-[9px] font-bold uppercase text-slate-400">{suggestion.city} | {suggestion.gstin || 'No GSTIN'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </FormControl>
                <Button type="button" variant="outline" size="icon" disabled={disabled} className="h-14 w-14 rounded-2xl shrink-0 shadow-lg hover:bg-blue-50" onClick={onSearchClick}>
                    <Search className="h-6 w-6 text-blue-600" />
                </Button>
            </div>
            {error && <p className="text-[10px] font-bold text-red-600 mt-1">{error}</p>}
        </FormItem>
    );
}

// ========== MAIN COMPONENT ========== //

export default function CreatePlan({ onShipmentCreated }: { onShipmentCreated: (shipment: any) => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
  const [currentDate, setCurrentTime] = useState(new Date());
  const [helpModal, setHelpModal] = useState<{ type: string; title: string; data: any[] } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        originPlantId: '', consignor: '', billToParty: '', loadingPoint: '', unloadingPoint: '',
        materialTypeId: 'METRIC TON', quantity: 0, lrNumber: '', carrierId: '', paymentTerm: 'Paid',
        isSameAsBillTo: false, lrDate: null, items: []
    },
  });

  const { watch, setValue, control, handleSubmit, reset } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  
  const originPlantId = watch('originPlantId');
  const isSameAsBillTo = watch('isSameAsBillTo');

  // --- Data Queries ---
  const { data: qtyTypes } = useCollection<MasterQtyType>(useMemoFirebase(() => firestore ? query(collection(firestore, "material_types")) : null, [firestore]));
  const { data: parties } = useCollection<Party>(useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, [firestore]));
  const { data: allPlants } = useCollection<Plant>(useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, [firestore]));
  
  const { data: carriers } = useCollection<Carrier>(useMemoFirebase(() => {
    if (!firestore || !originPlantId) return null;
    return query(collection(firestore, "carriers"), where("plantId", "==", originPlantId));
  }, [firestore, originPlantId]));

  const consignorRegistry = useMemo(() => (parties || []).filter(p => p.type === 'Consignor'), [parties]);
  const consigneeRegistry = useMemo(() => (parties || []).filter(p => p.type === 'Consignee & Ship to'), [parties]);

  useEffect(() => {
    if (allPlants && user) {
        const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
        setAuthorizedPlants(isAdmin ? allPlants : allPlants.filter(p => p.id === '1426')); 
    }
  }, [allPlants, user]);

  const handleShipToSelect = useCallback((p: Party) => {
    setValue('shipToParty', p.name, { shouldValidate: true });
    setValue('shipToGtin', p.gstin || '', { shouldValidate: true });
    const address = (p.address && p.address !== 'N/A') ? p.address : p.city;
    if (address) setValue('unloadingPoint', address, { shouldValidate: true });
  }, [setValue]);

  const handlePost = async (values: FormValues) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        await runTransaction(firestore, async (tx) => {
            const countSnap = await tx.get(doc(firestore, "counters", "shipments"));
            const newCount = (countSnap.exists() ? countSnap.data().count : 0) + 1;
            const shipmentId = formatSequenceId("S", newCount);
            const plantId = normalizePlantId(values.originPlantId);
            const shipRef = doc(collection(firestore, `plants/${plantId}/shipments`));

            // REGISTRY SECURITY: Ensure manifest is never empty
            let manifestItems = values.items || [];
            if (manifestItems.length === 0) {
                manifestItems = [{
                    invoiceNumber: 'INITIAL-PLAN',
                    units: 1,
                    unitType: 'Package',
                    itemDescription: 'AUTO-GEN MISSION PAYLOAD',
                    weight: values.quantity,
                    ewaybillNumber: '',
                    hsnSac: ''
                }];
            }

            tx.set(doc(firestore, "counters", "shipments"), { count: newCount }, { merge: true });
            tx.set(shipRef, {
                ...values,
                shipmentId,
                items: manifestItems,
                currentStatusId: 'pending',
                creationDate: serverTimestamp(),
                assignedQty: 0,
                balanceQty: values.quantity,
                userId: user.uid
            });
        });
        toast({ title: 'Plan Committed Successfully' });
        reset();
        onShipmentCreated({ id: 'new' } as any);
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally { hideLoader(); }
  };

  return (
    <div className="w-full space-y-10">
      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/80 p-10 border-b">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-blue-900 rounded-2xl text-white shadow-xl"><ShieldCheck size={32} /></div>
                    <div>
                        <CardTitle className="text-3xl font-black text-blue-900 tracking-tight uppercase italic">Order Plan Registry</CardTitle>
                        <CardDescription className="text-xs font-bold text-slate-400">Secure Mission Asset Deployment</CardDescription>
                    </div>
                </div>
                <div className="flex gap-4">
                    <Button onClick={handleSubmit(handlePost)} className="h-14 px-10 bg-blue-900 rounded-2xl font-black shadow-lg hover:scale-105 transition-transform text-white border-none">
                        Commit Plan (F8)
                    </Button>
                </div>
            </div>
        </CardHeader>

        <CardContent className="p-12">
          <Form {...form}>
            <form className="space-y-16">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-8 bg-slate-50 p-8 rounded-3xl border border-slate-100 shadow-inner">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Registry Timestamp</label>
                    <div className="h-14 bg-white border rounded-xl flex items-center px-5 font-mono text-blue-900 font-bold shadow-sm">{format(currentDate, 'dd-MM-yyyy HH:mm:ss')}</div>
                  </div>
                  
                  <FormField control={control} name="originPlantId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Plant Node Registry *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-14 bg-white rounded-xl font-bold"><SelectValue placeholder="Select Node" /></SelectTrigger></FormControl>
                            <SelectContent>{authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name} ({p.id})</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                  )} />

                  <FormField control={control} name="materialTypeId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">UOM (Unit) *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-14 bg-white rounded-xl font-bold"><SelectValue placeholder="UOM" /></SelectTrigger></FormControl>
                            <SelectContent>{qtyTypes?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                  )} />

                  <FormField control={control} name="quantity" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Total Quantity *</FormLabel>
                        <FormControl><Input type="number" step="0.001" {...field} className="h-14 bg-white rounded-xl font-black text-xl text-center" /></FormControl>
                    </FormItem>
                  )} />
               </div>

               <div className="p-10 rounded-[2rem] border-2 border-dashed border-blue-100 bg-blue-50/20 space-y-8">
                  <div className="flex items-center gap-3 text-blue-900 font-black text-sm uppercase tracking-tighter border-b border-blue-100 pb-4"><Truck size={20}/> Optional LR Registry Section</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                      <FormField control={control} name="lrNumber" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-bold text-slate-400 uppercase">LR Number</FormLabel><FormControl><Input {...field} placeholder="Enter LR" className="h-14 bg-white rounded-xl" /></FormControl></FormItem>
                      )} />

                      <FormField control={control} name="lrDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-bold text-slate-400 uppercase">LR Date</FormLabel><DatePicker date={field.value || undefined} setDate={field.onChange} /><FormMessage /></FormItem>
                      )} />

                      <FormField control={control} name="carrierId" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-bold text-blue-600 uppercase">Carrier Agent *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-14 border-blue-200 bg-white rounded-xl"><SelectValue placeholder="Select Carrier" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {carriers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </FormItem>
                      )} />

                      <FormField control={control} name="paymentTerm" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-bold text-slate-400 uppercase">Payment Term</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-14 bg-white rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{PaymentTerms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                        </FormItem>
                      )} />
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8 p-10 rounded-[2.5rem] border bg-white shadow-xl">
                      <AutocompleteInput 
                        label="Consignor Entity *" 
                        placeholder="Search consignor registry..." 
                        value={watch('consignor')} 
                        onChange={v => setValue('consignor', v)} 
                        suggestions={consignorRegistry} 
                        onSearchClick={() => setHelpModal({type: 'consignor', title: 'Consignor Handbook', data: consignorRegistry})} 
                        onSelect={p => {
                            setValue('consignor', p.name, {shouldValidate: true});
                            setValue('consignorGtin', p.gstin || '');
                            const addr = (p.address && p.address !== 'N/A') ? p.address : p.city;
                            if(addr) setValue('loadingPoint', addr);
                        }}
                      />
                      <FormField control={control} name="loadingPoint" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-slate-400">Lifting City (Point) *</FormLabel><FormControl><Input {...field} className="h-14 rounded-xl" /></FormControl></FormItem>)} />
                  </div>

                  <div className="space-y-8 p-10 rounded-[2.5rem] border bg-white shadow-xl">
                      <AutocompleteInput 
                        label="Consignee / Bill To *" 
                        placeholder="Search buyer registry..." 
                        value={watch('billToParty')} 
                        onChange={v => setValue('billToParty', v)} 
                        suggestions={consigneeRegistry} 
                        onSearchClick={() => setHelpModal({type: 'billToParty', title: 'Buyer Registry', data: consigneeRegistry})} 
                        onSelect={p => {
                            setValue('billToParty', p.name, {shouldValidate: true});
                            setValue('billToGtin', p.gstin || '');
                            if(isSameAsBillTo) handleShipToSelect(p);
                        }}
                      />
                      <div className="flex items-center justify-between px-2">
                        <FormField control={control} name="isSameAsBillTo" render={({ field }) => (
                            <div className="flex items-center gap-2"><Checkbox checked={field.value} onCheckedChange={field.onChange} id="sameAs" /><label htmlFor="sameAs" className="text-xs font-bold text-slate-500">Unloading same as Bill-To</label></div>
                        )} />
                      </div>
                      <FormField control={control} name="unloadingPoint" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-slate-400">Destination City *</FormLabel><FormControl><Input {...field} className="h-14 rounded-xl" /></FormControl></FormItem>)} />
                  </div>
               </div>

               <section className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                            <Calculator className="h-5 w-5 text-blue-600" /> Optional Manifest Items Registry
                        </h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ invoiceNumber: '', units: 1, unitType: 'Package', itemDescription: '', weight: 0.001 })} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-blue-200 text-blue-700 bg-white shadow-md hover:bg-blue-50 transition-all">
                            <PlusCircle size={16} /> Add Node
                        </Button>
                    </div>
                    <div className="rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-900">
                                <TableRow className="hover:bg-transparent h-14 border-none">
                                    <TableHead className="text-white text-[10px] font-black uppercase px-8">Invoice #</TableHead>
                                    <TableHead className="text-white text-[10px] font-black uppercase px-4">Item description</TableHead>
                                    <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center">Units</TableHead>
                                    <TableHead className="text-white text-[10px] font-black uppercase px-8 text-right">Weight (MT)</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-slate-400 italic border-none">No detailed items added. Registry will auto-generate from header.</TableCell></TableRow>
                                ) : (
                                    fields.map((field, index) => (
                                        <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-none hover:bg-blue-50/10 transition-colors">
                                            <TableCell className="px-8"><Input {...form.register(`items.${index}.invoiceNumber`)} className="h-10 rounded-xl font-bold" /></TableCell>
                                            <TableCell className="px-4"><Input {...form.register(`items.${index}.itemDescription`)} className="h-10 rounded-xl font-bold" /></TableCell>
                                            <TableCell className="px-4"><Input type="number" {...form.register(`items.${index}.units`)} className="h-10 text-center font-black text-blue-900 bg-transparent border-none shadow-none focus-visible:ring-0" /></TableCell>
                                            <TableCell className="px-8 text-right"><Input type="number" step="0.001" {...form.register(`items.${index}.weight`)} className="h-10 text-right font-black text-blue-900 bg-transparent border-none shadow-none focus-visible:ring-0" /></TableCell>
                                            <TableCell className="pr-6 text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></Button></TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
               </section>
            </form>
          </Form>
        </CardContent>
      </Card>

      {helpModal && (
        <Dialog open={!!helpModal} onOpenChange={() => setHelpModal(null)}>
            <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-none shadow-3xl">
                <div className="bg-slate-900 p-6 text-white font-black uppercase italic tracking-tighter flex items-center gap-3"><Search /> {helpModal.title}</div>
                <div className="p-6 h-[50vh] overflow-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Entity Name</TableHead><TableHead>GSTIN</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {helpModal.data.map(item => (
                                <TableRow key={item.id} className="cursor-pointer hover:bg-blue-50" onClick={() => {
                                    if(helpModal.type === 'consignor') {
                                        setValue('consignor', item.name);
                                        const addr = (item.address && item.address !== 'N/A') ? item.address : item.city;
                                        if(addr) setValue('loadingPoint', addr);
                                    } else {
                                        setValue('billToParty', item.name);
                                    }
                                    setHelpModal(null);
                                }}>
                                    <TableCell className="font-black text-xs uppercase">{item.name}</TableCell>
                                    <TableCell className="font-mono text-[10px]">{item.gstin || '--'}</TableCell>
                                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="font-bold text-blue-600 text-[10px]">SELECT</Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}