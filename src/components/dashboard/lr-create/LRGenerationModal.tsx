
'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, ShieldCheck, FileText, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import type { WithId, Trip, Carrier, Shipment, LR, Party } from '@/types';
import { PaymentTerms, LRUnitTypes } from '@/lib/constants';
import { DatePicker } from '@/components/date-picker';
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, serverTimestamp, doc, getDoc, getDocs, limit, runTransaction, where, Timestamp } from "firebase/firestore";
import { cn, normalizePlantId, parseSafeDate } from '@/lib/utils';

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
  items: z.array(z.object({
    invoiceNumber: z.string().min(1, "Invoice number required."),
    units: z.coerce.number().positive("Unit count mandatory."),
    unitType: z.string().optional(),
    itemDescription: z.string().min(1, "Required"),
    weight: z.coerce.number().positive("Weight must be positive."),
    hsnSac: z.string().optional(),
  })).min(1, "At least one row is required."),
  deliveryAddress: z.string().min(1, "Delivery Address is mandatory."),
  consignorName: z.string().min(1, "Consignor node required."),
  consignorAddress: z.string().optional().default(''),
  consignorGtin: z.string().optional(),
  consignorMobile: z.string().optional(),
  buyerName: z.string().min(1, "Consignee node required."),
  buyerGtin: z.string().optional(),
  buyerMobile: z.string().optional(),
  shipToParty: z.string().min(1, "Drop node required."),
  shipToGtin: z.string().optional(),
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
            item.gstin?.toLowerCase().includes(s) ||
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
                            placeholder="Search by Name, GSTIN, or City..." 
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
                                                <TableCell className="px-4 text-center font-mono text-[10px] text-slate-500">{item.gstin || '--'}</TableCell>
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
  trip: WithId<Trip>;
  carrier: WithId<Carrier>;
  lrToEdit?: WithId<LR> | null;
  onGenerate: (lrData: any) => void;
}

export default function LRGenerationModal({ isOpen, onClose, trip: providedTrip, carrier: providedCarrier, lrToEdit, onGenerate }: LRGenerationModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [shipment, setShipment] = useState<WithId<Shipment> | null>(null);
  const [activeTrip, setActiveTrip] = useState<WithId<Trip> | null>(providedTrip || null);
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
            const shipId = activeTrip?.shipmentIds?.[0];
            if (!shipId) { setLoading(false); return; }

            const shipmentSnap = await getDoc(doc(firestore, `plants/${activeTrip!.originPlantId}/shipments`, shipId));
            if (shipmentSnap.exists()) {
                const sData = shipmentSnap.data() as Shipment;
                setShipment({ id: shipmentSnap.id, ...sData } as WithId<Shipment>);

                let initialItems = (sData.items || []).map(i => ({
                    invoiceNumber: i.invoiceNumber || (i as any).deliveryNumber || '',
                    units: i.units || 1,
                    unitType: i.unitType || 'Package',
                    itemDescription: i.itemDescription || i.description || sData.material || '',
                    weight: Number(i.weight || 0.001),
                    hsnSac: i.hsnSac || ''
                }));

                if (initialItems.length === 0) {
                    initialItems = [{ 
                        invoiceNumber: sData.invoiceNumber || 'NA', 
                        units: Number(sData.totalUnits) || 1, 
                        unitType: 'Package', 
                        itemDescription: sData.itemDescription || sData.material || 'GENERAL CARGO', 
                        weight: Number(activeTrip!.assignedQtyInTrip || 0.001), 
                        hsnSac: '' 
                    }];
                }

                const pTerm = sData.paymentTerm?.toLowerCase().includes('to pay') ? 'To Pay' : 'Paid';

                reset({
                    lrNumber: sData.lrNumber || '',
                    date: sData.lrDate?.toDate ? sData.lrDate.toDate() : new Date(),
                    from: sData.loadingPoint || '',
                    to: sData.unloadingPoint || '',
                    vehicleNumber: activeTrip!.vehicleNumber,
                    driverName: activeTrip!.driverName,
                    driverMobile: activeTrip!.driverMobile,
                    paymentTerm: pTerm as any,
                    weightSelection: 'Assigned Weight',
                    consignorName: sData.consignor || '',
                    consignorAddress: sData.consignorAddress || sData.loadingPoint || '', 
                    consignorGtin: sData.consignorGtin || '',
                    buyerName: sData.billToParty || '',
                    buyerGtin: sData.billToGtin || '',
                    shipToParty: sData.shipToParty || '',
                    shipToGtin: sData.shipToGtin || '',
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
        setValue('consignorAddress', party.address || party.city || '', { shouldValidate: true });
        setValue('from', party.city || '', { shouldValidate: true });
    } else if (type === 'buyerName') {
        setValue('buyerGtin', party.gstin || '', { shouldValidate: true });
        setValue('shipToParty', party.name, { shouldValidate: true });
        setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
        setValue('deliveryAddress', party.address || party.city || '', { shouldValidate: true });
        setValue('to', party.city || '', { shouldValidate: true });
    } else if (type === 'shipToParty') {
        setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
        setValue('deliveryAddress', party.address || party.city || '', { shouldValidate: true });
        setValue('to', party.city || '', { shouldValidate: true });
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
        weight: acc.weight + (Number(item?.weight) || 0)
    }), { units: 0, weight: 0 });
  }, [watchedItems]);

  const handlePost = async (values: FormValues) => {
    if (!firestore || !shipment || !activeTrip || !user) return;

    try {
        await runTransaction(firestore, async (transaction) => {
            const plantId = normalizePlantId(activeTrip.originPlantId);
            const lrId = lrToEdit?.id || `lr-${Date.now()}`;
            const lrRef = doc(firestore, `plants/${plantId}/lrs`, lrId);
            const tripRef = doc(firestore, `plants/${plantId}/trips`, activeTrip.id);
            const globalTripRef = doc(firestore, 'trips', activeTrip.id);
            const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipment.id);

            const finalWeight = values.weightSelection === 'Actual Weight' ? totals.weight : activeTrip.assignedQtyInTrip;

            const lrData = {
                ...values,
                tripDocId: activeTrip.id,
                tripId: activeTrip.tripId, 
                carrierId: activeCarrier!.id,
                originPlantId: plantId,
                assignedTripWeight: finalWeight,
                updatedAt: serverTimestamp(),
                userName: user.displayName || user.email,
                userId: user.uid
            };

            transaction.set(lrRef, lrData, { merge: true });
            transaction.update(tripRef, { 
                lrGenerated: true, 
                lrNumber: values.lrNumber, 
                lrDate: values.date, 
                assignedQtyInTrip: finalWeight, 
                vehicleNumber: values.vehicleNumber,
                items: values.items,
                paymentTerm: values.paymentTerm
            });
            transaction.update(globalTripRef, { 
                lrGenerated: true, 
                lrNumber: values.lrNumber, 
                lrDate: values.date, 
                assignedQtyInTrip: finalWeight, 
                vehicleNumber: values.vehicleNumber,
                items: values.items,
                paymentTerm: values.paymentTerm
            });
            transaction.update(shipmentRef, { lastUpdateDate: serverTimestamp() });
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
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">CONSIGNOR NODE (F4 HELP)</FormLabel><div className="flex gap-2"><FormControl><Input className="h-11 font-bold uppercase" {...field} onKeyDown={(e) => e.key === 'F4' && setHelpModal({ type: 'consignor', title: 'Search Consignors', data: consignorRegistry })} /></FormControl><Button type="button" variant="outline" onClick={() => setHelpModal({ type: 'consignorName', title: 'Search Consignors', data: consignorRegistry })}><Search size={16}/></Button></div></FormItem>
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

                        <section className="rounded-3xl border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-900">
                                    <TableRow className="hover:bg-transparent border-none h-14">
                                        <TableHead className="text-white px-6">INVOICE NO *</TableHead>
                                        <TableHead className="text-white px-4">ITEM DESCRIPTION *</TableHead>
                                        <TableHead className="text-white px-4 text-center">PKGS</TableHead>
                                        <TableHead className="text-white px-8 text-right">WEIGHT (MT)</TableHead>
                                        <TableHead className="w-16"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id} className="h-16 border-b border-slate-100 hover:bg-blue-50/10 transition-colors group">
                                            <TableCell className="px-6"><Input {...form.register(`items.${index}.invoiceNumber`)} className="h-9 font-bold" /></TableCell>
                                            <TableCell className="px-4"><Input {...form.register(`items.${index}.itemDescription`)} className="h-9 font-bold uppercase" /></TableCell>
                                            <TableCell className="px-4 text-center"><Input type="number" {...form.register(`items.${index}.units`)} className="h-9 text-center font-black" /></TableCell>
                                            <TableCell className="px-8 text-right"><Input type="number" step="0.001" {...form.register(`items.${index}.weight`)} className="h-9 text-right font-black" /></TableCell>
                                            <TableCell className="pr-6"><Button variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1} className="text-red-400"><Trash2 size={16}/></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className="bg-slate-50 h-14 border-t-2">
                                    <TableRow className="hover:bg-transparent font-black">
                                        <TableCell colSpan={2} className="px-6 text-[10px] uppercase text-slate-400">REGISTRY TOTALS</TableCell>
                                        <TableCell className="text-center text-blue-900">{totals.units}</TableCell>
                                        <TableCell className="text-right px-8 text-blue-900">{totals.weight.toFixed(3)} MT</TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </section>
                    </form>
                </Form>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t flex-row justify-end gap-4">
                <Button variant="ghost" onClick={onClose} className="font-black uppercase text-[10px] px-8">Discard</Button>
                <Button onClick={handleSubmit(handlePost)} className="bg-blue-900 hover:bg-black text-white px-12 h-12 rounded-xl font-black uppercase text-[10px] shadow-xl">
                    COMMIT MISSION RECEIPT
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
