'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Plant, Shipment, WithId, Party } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Factory, ShieldCheck, MapPin, UserCircle, Save, X, Fingerprint, Weight } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, updateDoc, serverTimestamp, getDocs, limit, getDoc } from "firebase/firestore";
import { cn, normalizePlantId } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  originPlantId: z.string().min(1, 'Plant is required'),
  consignor: z.string().min(1, 'Consignor node required.'),
  consignorAddress: z.string().optional().default(''),
  consignorGtin: z.string().optional(),
  consignorCode: z.string().optional(),
  loadingPoint: z.string().min(1, 'Loading point is required'),
  billToParty: z.string().min(1, 'Consignee node required.'),
  billToGtin: z.string().optional(),
  billToCode: z.string().optional(),
  isSameAsBillTo: z.boolean().default(false),
  shipToParty: z.string().min(1, 'Ship to node required.'),
  shipToGtin: z.string().optional(),
  shipToCode: z.string().optional(),
  unloadingPoint: z.string().min(1, 'Unloading point is required'),
  deliveryAddress: z.string().optional().default(''),
  quantity: z.coerce.number().positive('Weight must be positive'),
  materialTypeId: z.string({ required_error: 'Qty Type is required' }).min(1, 'Qty Type is required'),
});

type FormValues = z.infer<typeof formSchema>;

// Helper Components synchronized with CreatePlan logic
function AutocompleteInput({ value, onChange, onSearchClick, suggestions, placeholder, label, error, disabled = false, onSelect }: { value: string; onChange: (val: string) => void; onSearchClick: () => void; suggestions: Party[]; placeholder: string; label: string; error?: string; disabled?: boolean; onSelect?: (party: Party) => void; }) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filteredSuggestions = useMemo(() => {
        if (!value) return [];
        return suggestions.filter(s => s.name?.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
    }, [value, suggestions]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-1.5 relative" ref={wrapperRef}>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{label}</label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Input 
                        placeholder={placeholder} 
                        value={value} 
                        onChange={(e) => { onChange(e.target.value); setIsOpen(true); }} 
                        onFocus={() => setIsOpen(true)} 
                        className="h-10 rounded-xl font-bold text-slate-900 border-slate-200 bg-slate-50/50 shadow-inner" 
                        disabled={disabled} 
                    />
                    {isOpen && filteredSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
                            {filteredSuggestions.map((suggestion) => (
                                <div key={suggestion.id} onMouseDown={() => { if(onSelect) onSelect(suggestion); else onChange(suggestion.name); setIsOpen(false); }} className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 border-b last:border-0 group">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-tight text-slate-700 group-hover:text-blue-900">{suggestion.name}</span>
                                        <span className="text-[8px] font-bold uppercase text-slate-400">{suggestion.city} | {suggestion.customerCode || 'NO CODE'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <Button type="button" variant="outline" size="icon" disabled={disabled} className="h-10 w-10 rounded-xl shrink-0 shadow-sm hover:bg-blue-50 border-slate-200" onClick={onSearchClick}>
                    <Search className="h-4 w-4 text-blue-600" />
                </Button>
            </div>
            {error && <p className="text-[9px] font-bold text-red-600 mt-1 uppercase">{error}</p>}
        </div>
    );
}

function SearchRegistryModal({ isOpen, onClose, title, data, onSelect }: { isOpen: boolean; onClose: () => void; title: string; data: any[]; onSelect: (party: Party) => void; }) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        return data.filter(item => item.name?.toLowerCase().includes(s) || item.customerCode?.toLowerCase().includes(s) || item.city?.toLowerCase().includes(s));
    }, [data, search]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3"><Search className="h-5 w-5 text-blue-400" /> {title}</DialogTitle>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search registry..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-200 font-bold shadow-inner" autoFocus />
                    </div>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-white">
                        <ScrollArea className="h-[40vh]">
                            <Table>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-400 italic">No records found.</TableCell></TableRow>
                                    ) : (
                                        filtered.map(item => (
                                            <TableRow key={item.id} className="cursor-pointer h-12 transition-all group hover:bg-blue-50" onClick={() => onSelect(item)}>
                                                <TableCell className="px-4 font-black text-slate-800 uppercase text-xs">{item.name}</TableCell>
                                                <TableCell className="px-4 text-center font-mono text-[10px] text-blue-700 font-black">{item.customerCode || '--'}</TableCell>
                                                <TableCell className="px-4 text-right"><Button variant="ghost" size="sm" className="h-7 text-blue-600 font-black text-[10px] uppercase">Select</Button></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface EditShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: WithId<Shipment>;
  onShipmentUpdated: (userId: string, data: Partial<Omit<Shipment, 'id'>>) => Promise<void>;
}

export default function EditShipmentModal({ isOpen, onClose, shipment, onShipmentUpdated }: EditShipmentModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [helpModal, setHelpModal] = useState<{ type: string; title: string; data: any[] } | null>(null);

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, [firestore]);
  const { data: parties } = useCollection<Party>(partiesQuery);

  const activeParties = useMemo(() => (parties || []), [parties]);
  const consignorRegistry = useMemo(() => activeParties.filter(p => p.type?.toLowerCase() === 'consignor'), [activeParties]);
  const consigneeRegistry = useMemo(() => activeParties.filter(p => {
    const type = p.type?.toLowerCase() || '';
    return type.includes('consignee') || type.includes('buyer') || type.includes('ship to');
  }), [activeParties]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const { handleSubmit, setValue, reset, control, formState: { isSubmitting } } = form;
  
  const watchedConsignor = useWatch({ control, name: 'consignor' });
  const watchedBillTo = useWatch({ control, name: 'billToParty' });
  const watchedShipTo = useWatch({ control, name: 'shipToParty' });
  const isSameAsBillTo = useWatch({ control, name: 'isSameAsBillTo' });

  useEffect(() => {
    if (isOpen && shipment) {
      reset({
        originPlantId: shipment.originPlantId,
        consignor: shipment.consignor || '',
        consignorAddress: shipment.consignorAddress || '',
        consignorGtin: shipment.consignorGtin || '',
        consignorCode: shipment.consignorCode || shipment.customerCode || '',
        loadingPoint: shipment.loadingPoint || '',
        billToParty: shipment.billToParty || '',
        billToGtin: shipment.billToGtin || '',
        billToCode: shipment.billToCode || '',
        shipToParty: shipment.shipToParty || '',
        shipToGtin: shipment.shipToGtin || '',
        shipToCode: shipment.shipToCode || '',
        isSameAsBillTo: shipment.billToParty === shipment.shipToParty,
        unloadingPoint: shipment.unloadingPoint || '',
        deliveryAddress: shipment.deliveryAddress || '',
        quantity: shipment.quantity,
        materialTypeId: shipment.materialTypeId === 'Metric Ton' ? 'MT' : shipment.materialTypeId,
      });
    }
  }, [shipment, isOpen, reset]);

  // Auto-sync Ship To if same as Bill To
  useEffect(() => {
    if (isSameAsBillTo && watchedBillTo) {
        setValue('shipToParty', watchedBillTo, { shouldValidate: true });
        const match = consigneeRegistry.find(p => p.name === watchedBillTo);
        if (match) {
            setValue('shipToGtin', match.gstin || '', { shouldValidate: true });
            setValue('shipToCode', match.customerCode || '', { shouldValidate: true });
            const city = (match.city && match.city !== 'N/A') ? match.city : (match.address && match.address !== 'N/A' ? match.address : 'N/A');
            if (city) setValue('unloadingPoint', city.toUpperCase(), { shouldValidate: true });
            if (match.address) setValue('deliveryAddress', match.address, { shouldValidate: true });
        }
    }
  }, [isSameAsBillTo, watchedBillTo, setValue, consigneeRegistry]);

  const selectPartyNode = useCallback((party: Party, type: string) => {
    setValue(type as any, party.name, { shouldValidate: true });
    
    if (type === 'consignor') {
        setValue('consignorGtin', party.gstin || '', { shouldValidate: true });
        setValue('consignorCode', party.customerCode || '', { shouldValidate: true });
        if(party.address) setValue('consignorAddress', party.address, { shouldValidate: true });
        if(party.city) setValue('loadingPoint', party.city.toUpperCase(), { shouldValidate: true });
    } else if (type === 'billToParty') {
        setValue('billToGtin', party.gstin || '', { shouldValidate: true });
        setValue('billToCode', party.customerCode || '', { shouldValidate: true });
        if(isSameAsBillTo) {
            setValue('shipToParty', party.name, { shouldValidate: true });
            setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
            setValue('shipToCode', party.customerCode || '', { shouldValidate: true });
            const city = (party.city && party.city !== 'N/A') ? party.city : (party.address && party.address !== 'N/A' ? party.address : 'N/A');
            if (city) {
                setValue('unloadingPoint', city.toUpperCase(), { shouldValidate: true });
                setValue('deliveryAddress', party.address || '', { shouldValidate: true });
            }
        }
    } else if (type === 'shipToParty') {
        setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
        setValue('shipToCode', party.customerCode || '', { shouldValidate: true });
        const city = (party.city && party.city !== 'N/A') ? party.city : (party.address && party.address !== 'N/A' ? party.address : 'N/A');
        if (city) {
            setValue('unloadingPoint', city.toUpperCase(), { shouldValidate: true });
            setValue('deliveryAddress', party.address || '', { shouldValidate: true });
        }
    }
  }, [setValue, isSameAsBillTo]);

  const handleRegistrySelect = useCallback((party: Party) => {
    if (!helpModal) return;
    selectPartyNode(party, helpModal.type);
    setHelpModal(null);
  }, [helpModal, selectPartyNode]);

  const onSubmit = (values: FormValues) => {
    onShipmentUpdated(shipment.id, {
        ...values,
        weight: (values.quantity || 0) * 1000,
        balanceQty: values.quantity - (shipment.assignedQty || 0),
    });
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2rem]">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-12">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3"><ShieldCheck className="h-6 w-6" /></div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Correct Mission Plan</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Correction node: {shipment.shipmentId}</DialogDescription>
                </div>
            </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] p-8 bg-[#f8fafc]">
            <Form {...form}>
                <form className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-900" />
                        <FormField control={form.control} name="originPlantId" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Lifting Node *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-10 rounded-xl font-black text-blue-900 shadow-inner border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">
                                        {plants?.map((plant) => (<SelectItem key={plant.id} value={plant.id} className="font-bold py-2 uppercase italic">{plant.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">Order Weight (MT) * <Weight className="h-3 w-3 opacity-20"/></label>
                            <FormField name="quantity" control={form.control} render={({field}) => <FormControl><Input type="number" step="0.001" {...field} className="h-10 rounded-xl font-black text-blue-900 shadow-inner border-slate-200" /></FormControl>} />
                        </div>

                        <FormField control={form.control} name="materialTypeId" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Qty Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                    <FormControl><SelectTrigger className="h-10 rounded-xl font-bold border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl"><SelectItem value="MT" className="font-bold">Metric Ton (MT)</SelectItem><SelectItem value="Other" className="font-bold">Other</SelectItem></SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="p-8 space-y-6 rounded-[2rem] border border-slate-200 shadow-lg bg-white relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
                            <AutocompleteInput label="Consignor node *" placeholder="Search registry..." value={watchedConsignor} onChange={v => setValue('consignor', v)} suggestions={consignorRegistry} onSearchClick={() => setHelpModal({type: 'consignor', title: 'Consignor Handbook', data: consignorRegistry})} onSelect={(p) => selectPartyNode(p, 'consignor')} />
                            <FormField name="consignorAddress" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Registry Address</FormLabel><FormControl><Input {...field} className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs italic" /></FormControl></FormItem>
                            )} />
                            <FormField name="loadingPoint" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Lifting City *</FormLabel><FormControl><Input {...field} className="h-10 font-bold uppercase border-slate-200 rounded-xl" /></FormControl></FormItem>
                            )} />
                        </Card>

                        <Card className="p-8 space-y-6 rounded-[2rem] border border-slate-200 shadow-lg bg-white relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600" />
                            <AutocompleteInput label="Consignee Node *" placeholder="Search registry..." value={watchedBillTo} onChange={v => setValue('billToParty', v)} suggestions={consigneeRegistry} onSearchClick={() => setHelpModal({type: 'billToParty', title: 'Buyer Registry', data: consigneeRegistry})} onSelect={(p) => selectPartyNode(p, 'billToParty')} />
                            
                            <FormField name="isSameAsBillTo" control={form.control} render={({ field }) => (
                                <div className="flex items-center gap-3 px-1"><Checkbox checked={field.value} onCheckedChange={field.onChange} id="edit-sameAs" className="h-5 w-5 rounded-md data-[state=checked]:bg-emerald-600" /><label htmlFor="edit-sameAs" className="text-[10px] font-black uppercase text-slate-400 cursor-pointer tracking-widest">Ship to is same as Consignee</label></div>
                            )} />

                            <div className={cn("space-y-6 transition-all", isSameAsBillTo && "opacity-30 grayscale pointer-events-none")}>
                                <AutocompleteInput label="Ship To Node *" placeholder="Search drop hub..." value={watchedShipTo} onChange={v => setValue('shipToParty', v)} suggestions={consigneeRegistry} onSearchClick={() => setHelpModal({type: 'shipToParty', title: 'Drop Site Registry', data: consigneeRegistry})} onSelect={(p) => selectPartyNode(p, 'shipToParty')} />
                            </div>

                            <FormField name="unloadingPoint" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Destination city *</FormLabel><FormControl><Input {...field} className="h-10 font-bold uppercase border-slate-200 rounded-xl" /></FormControl></FormItem>
                            )} />
                        </Card>
                    </div>
                </form>
            </Form>
        </ScrollArea>

        <DialogFooter className="p-6 bg-slate-50 border-t shrink-0 flex-row justify-end gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-8 h-12">Discard</Button>
            <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-12 h-12 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl transition-all active:scale-95 border-none">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sync Corrections
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {helpModal && (
        <SearchRegistryModal 
            isOpen={!!helpModal} 
            onClose={() => setHelpModal(null)} 
            title={helpModal.title} 
            data={helpModal.data} 
            onSelect={handleRegistrySelect} 
        />
    )}
    </>
  );
}
