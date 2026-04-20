
'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, PlusCircle, Trash2, ShieldCheck, FileText, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import type { WithId, Trip, Carrier, Shipment, LR, Party } from '@/types';
import { PaymentTerms, LRUnitTypes } from '@/lib/constants';
import { DatePicker } from '@/components/date-picker';
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, serverTimestamp, doc, getDoc, getDocs, limit, runTransaction, where, Timestamp } from "firebase/firestore";
import { cn, normalizePlantId, parseSafeDate } from '@/lib/utils';

const itemSchema = z.object({
  invoiceNumber: z.string().optional().or(z.literal('')),
  ewaybillNumber: z.string().optional().or(z.literal('')),
  units: z.coerce.number().min(1, "Units required"),
  unitType: z.string().default('Package'),
  itemDescription: z.string().min(1, "Item desc required"),
  hsnSac: z.string().optional(),
});

const formSchema = z.object({
  lrNumber: z.string().min(1, "LR Number is mandatory."),
  date: z.date({ required_error: "Registration date is required." }),
  from: z.string().min(1, "From location required."),
  to: z.string().min(1, "To location required."),
  vehicleNumber: z.string().min(1, "Vehicle number is required."),
  driverName: z.string().optional().default(''),
  driverMobile: z.string().optional().default('').refine(val => !val || val === '' || /^\d{10}$/.test(val), {
    message: 'Valid 10-digit mobile required.'
  }),
  paymentTerm: z.enum(PaymentTerms),
  weightSelection: z.enum(['Assigned Weight', 'Actual Weight']),
  items: z.array(itemSchema).min(1, "At least one row is required."),
  deliveryAddress: z.string().min(1, "Delivery Address is mandatory."),
  consignorName: z.string().min(1, "Consignor node required."),
  consignorAddress: z.string().optional().default(''),
  consignorGtin: z.string().optional(),
  consignorCode: z.string().optional(),
  consignorMobile: z.string().optional(),
  buyerName: z.string().min(1, "Consignee node required."),
  buyerGtin: z.string().optional(),
  buyerCode: z.string().optional(),
  buyerMobile: z.string().optional(),
  shipToParty: z.string().min(1, "Drop node required."),
  shipToGtin: z.string().optional(),
  shipToCode: z.string().optional(),
  shipToMobile: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function SearchRegistryModal({ 
    isOpen, 
    onClose, 
    title, 
    data, 
    onSelect 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    title: string; 
    data: any[]; 
    onSelect: (party: Party) => void;
}) {
    const [search, setSearch] = useState('');
    const filtered = data.filter(item => {
        const s = search.toLowerCase();
        return item.name?.toLowerCase().includes(s) ||
            item.customerCode?.toLowerCase().includes(s) ||
            item.city?.toLowerCase().includes(s)
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
                        <Search className="h-5 w-5 text-blue-400" /> {title}
                    </DialogTitle>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search by Name, Code, or City..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-200 font-bold shadow-inner"
                            autoFocus
                        />
                    </div>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-white">
                        <ScrollArea className="h-[40vh]">
                            <Table>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-400 italic">No nodes matching search.</TableCell></TableRow>
                                    ) : (
                                        filtered.map(item => (
                                            <TableRow key={item.id} className="cursor-pointer h-12 hover:bg-blue-50" onClick={() => onSelect(item)}>
                                                <TableCell className="px-4 font-black text-slate-800 uppercase text-xs">{item.name}</TableCell>
                                                <TableCell className="px-4 text-center font-mono text-[10px] text-blue-700 font-black">{item.customerCode || '--'}</TableCell>
                                                <TableCell className="px-4 text-right">
                                                    <Button variant="ghost" size="sm" className="h-7 text-blue-600 font-black text-[10px] uppercase">Select</Button>
                                                </TableCell>
                                            </TableRow>
                                        )))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter className="p-4 bg-slate-50 border-t flex-row justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400 uppercase text-[10px]">Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface LRGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: WithId<Trip> | WithId<Shipment>;
  carrier: WithId<Carrier>;
  lrToEdit?: WithId<LR> | null;
  onGenerate: (lrData: any) => void;
}

export default function LRGenerationModal({ isOpen, onClose, trip: providedTrip, carrier: providedCarrier, lrToEdit, onGenerate }: LRGenerationModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [shipment, setShipment] = useState<WithId<Shipment> | null>(null);
  const [activeTrip, setActiveTrip] = useState<any | null>(providedTrip || null);
  const [activeCarrier, setActiveCarrier] = useState<WithId<Carrier> | null>(providedCarrier || null);
  const [loading, setLoading] = useState(true);
  const [helpModal, setHelpModal] = useState<{ type: string; title: string; data: any[] } | null>(null);

  const partiesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, 
    [firestore]
  );
  const { data: parties } = useCollection<Party>(partiesQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
        lrNumber: '',
        date: new Date(),
        from: '',
        to: '',
        vehicleNumber: '',
        paymentTerm: 'Paid',
        weightSelection: 'Assigned Weight',
        items: []
    }
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const { handleSubmit, setValue, control, reset, watch } = form;
  const watchedItems = watch("items") || [];

  const activeParties = useMemo(() => (parties || []).filter(p => p.isDeleted === false || p.isDeleted === undefined), [parties]);
  const consignorRegistry = useMemo(() => activeParties.filter(p => p.type?.toLowerCase() === 'consignor'), [activeParties]);
  const consigneeRegistry = useMemo(() => activeParties.filter(p => {
    const type = p.type?.toLowerCase() || '';
    return type.includes('consignee') || type.includes('buyer') || type.includes('ship to');
  }), [activeParties]);

  useEffect(() => {
    if (!isOpen || !firestore) return;

    const fetchData = async () => {
        setLoading(true);
        try {
            const isTripNode = !!(activeTrip as any).tripId;
            const shipId = isTripNode ? activeTrip?.shipmentIds?.[0] : activeTrip?.id;
            
            if (!shipId) { setLoading(false); return; }

            const shipmentSnap = await getDoc(doc(firestore, `plants/${activeTrip!.originPlantId}/shipments`, shipId));
            if (shipmentSnap.exists()) {
                const sData = shipmentSnap.data() as Shipment;
                setShipment({ id: shipmentSnap.id, ...sData } as WithId<Shipment>);

                let initialItems = (sData.items || []).map(i => ({
                    invoiceNumber: i.invoiceNumber || '',
                    ewaybillNumber: i.ewaybillNumber || '',
                    units: i.units || 1,
                    unitType: i.unitType || 'Package',
                    itemDescription: i.itemDescription || i.description || sData.material || '',
                    hsnSac: i.hsnSac || ''
                }));

                if (initialItems.length === 0) {
                    initialItems = [{ 
                        invoiceNumber: sData.invoiceNumber || '', 
                        ewaybillNumber: sData.ewaybillNumber || '',
                        units: Number(sData.totalUnits) || 1, 
                        unitType: 'Package', 
                        itemDescription: sData.itemDescription || sData.material || 'GENERAL CARGO', 
                        hsnSac: '' 
                    }];
                }

                const pTerm = (sData.paymentTerm || activeTrip.paymentTerm || 'Paid').toLowerCase().includes('to pay') ? 'To Pay' : 'Paid';

                reset({
                    lrNumber: sData.lrNumber || activeTrip.lrNumber || '',
                    date: parseSafeDate(sData.lrDate || activeTrip.lrDate) || new Date(),
                    from: sData.loadingPoint || activeTrip.loadingPoint || '',
                    to: sData.unloadingPoint || activeTrip.unloadingPoint || '',
                    vehicleNumber: activeTrip!.vehicleNumber || '',
                    driverName: activeTrip!.driverName || '',
                    driverMobile: activeTrip!.driverMobile || '',
                    paymentTerm: pTerm as any,
                    weightSelection: 'Assigned Weight',
                    consignorName: sData.consignor || activeTrip.consignor || '',
                    consignorAddress: sData.consignorAddress || sData.loadingPoint || '', 
                    consignorGtin: sData.consignorGtin || '',
                    consignorCode: sData.consignorCode || '',
                    buyerName: sData.billToParty || activeTrip.billToParty || '',
                    buyerGtin: sData.billToGtin || '',
                    buyerCode: sData.billToCode || '',
                    shipToParty: sData.shipToParty || activeTrip.shipToParty || '',
                    shipToGtin: sData.shipToGtin || '',
                    shipToCode: sData.shipToCode || '',
                    deliveryAddress: sData.deliveryAddress || sData.unloadingPoint || '',
                    items: initialItems
                });
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, [isOpen, activeTrip, firestore, reset]);

  const selectPartyNode = useCallback((party: Party, type: string) => {
    setValue(type as any, party.name, { shouldValidate: true });

    if (type === 'consignorName') {
        setValue('consignorGtin', party.gstin || '', { shouldValidate: true });
        setValue('consignorCode', party.customerCode || '', { shouldValidate: true });
        setValue('consignorAddress', party.address || party.city || '', { shouldValidate: true });
        setValue('from', (party.city || '').toUpperCase(), { shouldValidate: true });
    } else if (type === 'buyerName') {
        setValue('buyerGtin', party.gstin || '', { shouldValidate: true });
        setValue('buyerCode', party.customerCode || '', { shouldValidate: true });
        setValue('shipToParty', party.name, { shouldValidate: true });
        setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
        setValue('shipToCode', party.customerCode || '', { shouldValidate: true });
        setValue('deliveryAddress', party.address || party.city || '', { shouldValidate: true });
        setValue('to', (party.city || '').toUpperCase(), { shouldValidate: true });
    } else if (type === 'shipToParty') {
        setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
        setValue('shipToCode', party.customerCode || '', { shouldValidate: true });
        setValue('deliveryAddress', party.address || party.city || '', { shouldValidate: true });
        setValue('to', (party.city || '').toUpperCase(), { shouldValidate: true });
    }
  }, [setValue]);

  const handleRegistrySelect = useCallback((party: Party) => {
    if (!helpModal) return;
    selectPartyNode(party, helpModal.type);
    setHelpModal(null);
  }, [helpModal, selectPartyNode]);

  const totals = useMemo(() => {
    return watchedItems.reduce((acc, item) => ({
        units: acc.units + (Number(item?.units) || 0),
    }), { units: 0 });
  }, [watchedItems]);

  const handlePost = async (values: FormValues) => {
    if (!firestore || !shipment || !activeTrip || !user) return;

    try {
        await runTransaction(firestore, async (transaction) => {
            const plantId = normalizePlantId(activeTrip.originPlantId);
            const lrId = lrToEdit?.id || `lr-${Date.now()}`;
            const lrRef = doc(firestore, `plants/${plantId}/lrs`, lrId);
            const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipment.id);

            const isTripNode = !!(activeTrip as any).tripId;
            const finalWeight = isTripNode ? activeTrip.assignedQtyInTrip : activeTrip.quantity;

            const lrData = {
                ...values,
                tripDocId: isTripNode ? activeTrip.id : null,
                tripId: isTripNode ? activeTrip.tripId : 'PENDING_ALLOCATION', 
                carrierId: activeCarrier!.id,
                originPlantId: plantId,
                assignedTripWeight: finalWeight,
                updatedAt: serverTimestamp(),
                userName: user.displayName || user.email,
                userId: user.uid
            };

            transaction.set(lrRef, lrData, { merge: true });

            if (isTripNode) {
                const tripRef = doc(firestore, `plants/${plantId}/trips`, activeTrip.id);
                const globalTripRef = doc(firestore, 'trips', activeTrip.id);
                const tripUpdate = { 
                    lrGenerated: true, 
                    lrNumber: values.lrNumber, 
                    lrDate: values.date, 
                    assignedQtyInTrip: finalWeight, 
                    vehicleNumber: values.vehicleNumber,
                    items: values.items,
                    paymentTerm: values.paymentTerm
                };
                transaction.update(tripRef, tripUpdate);
                transaction.update(globalTripRef, tripUpdate);
            }

            transaction.update(shipmentRef, { 
                lrNumber: values.lrNumber,
                lrDate: values.date,
                paymentTerm: values.paymentTerm,
                lastUpdateDate: serverTimestamp() 
            });
        });

        toast({ title: 'LR Registry Updated' });
        onGenerate({});
        onClose();
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Commit Failed", description: e.message });
    }
  };

  if (loading) {
      return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="animate-spin text-blue-900" />
        </div>
      );
  }

  return (
    <>
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-[85vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-3xl bg-white rounded-3xl">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                <div className="flex items-center justify-between pr-12">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3"><FileText className="h-7 w-7" /></div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight italic">LR GENERATION NODE</DialogTitle>
                            <DialogDescription className="text-blue-300 font-bold uppercase text-[9px]">Mission Registry Synchronization</DialogDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 text-white/40 hover:text-white"><X size={24} /></Button>
                </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-10 py-8 bg-[#f8fafc] space-y-10">
                <Form {...form}>
                    <form className="space-y-10">
                        <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
                            <FormField name="lrNumber" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">LR NUMBER *</FormLabel><FormControl><Input className="h-12 font-black text-blue-900 uppercase" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField name="date" control={control} render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-400">LR DATE *</FormLabel><DatePicker date={field.value} setDate={field.onChange} className="h-12" /></FormItem>
                            )} />
                            <FormField name="from" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">FROM CITY *</FormLabel><FormControl><Input className="h-12 font-bold uppercase" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField name="to" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">TO CITY *</FormLabel><FormControl><Input className="h-12 font-bold uppercase" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField name="paymentTerm" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">PAYMENT TERM</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-xl">{PaymentTerms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                        </section>

                        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
                            <FormField name="vehicleNumber" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">VEHICLE NO *</FormLabel><FormControl><Input className="h-11 font-black uppercase" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField name="driverName" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">PILOT NAME</FormLabel><FormControl><Input className="h-11 uppercase" {...field} /></FormControl></FormItem>
                            )} />
                            <FormField name="driverMobile" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">PILOT MOBILE</FormLabel><FormControl><Input className="h-11 font-mono" {...field} maxLength={10} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </section>

                        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
                            <div className="space-y-4">
                                <FormField name="consignorName" control={control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">CONSIGNOR NODE (F4 HELP)</FormLabel><div className="flex gap-2"><FormControl><Input className="h-11 font-bold uppercase" {...field} onKeyDown={(e) => e.key === 'F4' && setHelpModal({ type: 'consignorName', title: 'Search Consignors', data: consignorRegistry })} /></FormControl><Button type="button" variant="outline" onClick={() => setHelpModal({ type: 'consignorName', title: 'Search Consignors', data: consignorRegistry })}><Search size={16}/></Button></div></FormItem>
                                )} />
                                <FormField name="consignorAddress" control={control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">CONSIGNOR ADDRESS (FULL)</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl></FormItem>
                                )} />
                            </div>
                            <div className="space-y-4">
                                <FormField name="buyerName" control={control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">CONSIGNEE NODE (F4 HELP)</FormLabel><div className="flex gap-2"><FormControl><Input className="h-11 font-bold uppercase" {...field} onKeyDown={(e) => e.key === 'F4' && setHelpModal({ type: 'buyerName', title: 'Search Consignees', data: consigneeRegistry })} /></FormControl><Button type="button" variant="outline" onClick={() => setHelpModal({ type: 'buyerName', title: 'Search Consignees', data: consigneeRegistry })}><Search size={16}/></Button></div></FormItem>
                                )} />
                                <FormField name="deliveryAddress" control={control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">DELIVERY ADDRESS (FULL)</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl></FormItem>
                                )} />
                            </div>
                        </section>

                        <section className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-4">
                                <h3 className="text-[11px] md:text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3"><Calculator className="h-5 w-5 text-blue-600" /> 3. Manifest Items Registry</h3>
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ invoiceNumber: '', ewaybillNumber: '', units: 1, unitType: 'Package', itemDescription: '' })} className="h-10 px-6 gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 bg-white shadow-md hover:bg-blue-50 transition-all rounded-xl w-full sm:w-auto"><PlusCircle size={16} /> Add Row</Button>
                            </div>
                            <div className="rounded-[2rem] border-2 border-slate-200 bg-white shadow-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[1200px]">
                                        <TableHeader className="bg-slate-900">
                                            <TableRow className="hover:bg-transparent border-none h-14">
                                                <TableHead className="text-white text-[10px] font-black uppercase px-8 w-48">INVOICE</TableHead>
                                                <TableHead className="text-white text-[10px] font-black uppercase px-4 w-48">E-WAYBILL NO.</TableHead>
                                                <TableHead className="text-white text-[10px] font-black uppercase px-4">ITEM DESCRIPTION</TableHead>
                                                <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center w-56">UNITS / UOM</TableHead>
                                                <TableHead className="w-12"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {fields.map((field, index) => (
                                                <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-none hover:bg-blue-50/10 transition-colors group">
                                                    <TableCell className="px-8"><Input {...form.register(`items.${index}.invoiceNumber`)} className="h-10 rounded-xl font-black uppercase bg-slate-50 border-slate-200" /></TableCell>
                                                    <TableCell className="px-4"><Input {...form.register(`items.${index}.ewaybillNumber`)} className="h-10 rounded-xl font-mono text-blue-600 bg-slate-50 border-slate-200 uppercase" /></TableCell>
                                                    <TableCell className="px-4"><Input {...form.register(`items.${index}.itemDescription`)} className="h-10 rounded-xl font-bold bg-slate-50 border-slate-200 uppercase" /></TableCell>
                                                    <TableCell className="px-4">
                                                        <div className="flex items-center gap-2">
                                                            <Input type="number" {...form.register(`items.${index}.units`)} className="h-10 w-20 text-center font-black text-blue-900 bg-white border-slate-200 rounded-lg shadow-inner" />
                                                            <Controller
                                                                name={`items.${index}.unitType`}
                                                                control={control}
                                                                render={({ field }) => (
                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger className="h-10 flex-1 min-w-[120px] rounded-lg border-slate-200 bg-white font-black text-[10px] uppercase shadow-sm">
                                                                                <SelectValue placeholder="TYPE" />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent className="rounded-xl">
                                                                            {LRUnitTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2 uppercase text-[10px]">{t}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="pr-6 text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 rounded-lg"><Trash2 size={18}/></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                        <TableFooter className="bg-slate-50 border-t-2 border-slate-200 h-16">
                                            <TableRow className="hover:bg-transparent border-none">
                                                <TableCell colSpan={3} className="px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">TOTAL MANIFEST REGISTRY</TableCell>
                                                <TableCell className="text-center font-black text-lg text-blue-900">{totals.units}</TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        </TableFooter>
                                    </Table>
                                </div>
                            </div>
                        </section>
                    </form>
                </Form>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex-row justify-end gap-4">
                <Button variant="ghost" onClick={onClose} className="font-black uppercase text-[10px] px-8">Discard</Button>
                <Button onClick={handleSubmit(handlePost)} className="bg-blue-900 hover:bg-black text-white px-12 h-12 rounded-xl font-black uppercase text-[10px] shadow-xl">
                    <Plus size={16} className="mr-2" /> COMMIT MISSION RECEIPT
                </Button>
            </DialogFooter>
          </DialogContent>

          {helpModal && (
              <SearchRegistryModal 
                isOpen={!!helpModal}
                onClose={() => setHelpModal(null)}
                title={helpModal.title}
                data={helpModal.data}
                onSelect={handleRegistrySelect}
              />
          )}
        </Dialog>
    </>
  );
}
