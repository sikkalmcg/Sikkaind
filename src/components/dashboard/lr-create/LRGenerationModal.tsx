
'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, ShieldCheck, Truck, FileText, MapPin, CheckCircle2, AlertTriangle, Calculator, Layers, Sparkles, Search, Phone, UserCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import type { WithId, Trip, Carrier, Shipment, LR, Party } from '@/types';
import { PaymentTerms, LRUnitTypes } from '@/lib/constants';
import { DatePicker } from '@/components/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, serverTimestamp, doc, getDoc, getDocs, limit, runTransaction, orderBy, where, Timestamp } from "firebase/firestore";
import { cn, incrementSerial, normalizePlantId } from '@/lib/utils';

const formSchema = z.object({
  lrNumber: z.string().min(1, "LR Number is mandatory."),
  date: z.date({ required_error: "Registration date is required." }),
  vehicleNumber: z.string().min(1, "Vehicle number is required."),
  driverName: z.string().optional().default(''),
  driverMobile: z.string().optional().default('').refine(val => !val || val === '' || /^\d{10}$/.test(val), {
    message: 'Valid 10-digit mobile required.'
  }),
  paymentTerm: z.enum(PaymentTerms),
  weightSelection: z.enum(['Assigned Weight', 'Actual Weight']),
  items: z.array(z.object({
    invoiceNumber: z.string().min(1, "Doc ref required."),
    ewaybillNumber: z.string().optional(),
    units: z.coerce.number().positive("Unit count mandatory."),
    unitType: z.string().optional(),
    itemDescription: z.string().min(1, "Item description required."),
    weight: z.coerce.number().positive("Weight violation: Value must be positive."),
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

const groupDescriptions = (descriptions: string[]): string => {
    const unique = Array.from(new Set(descriptions.map(d => d.trim()).filter(Boolean)));
    if (unique.length === 0) return '';
    if (unique.length === 1) return unique[0];

    let prefix = unique[0];
    for (let i = 1; i < unique.length; i++) {
        while (unique[i].toLowerCase().indexOf(prefix.toLowerCase()) !== 0 && prefix.length > 0) {
            prefix = prefix.substring(0, prefix.length - 1);
        }
    }
    prefix = prefix.trim();

    if (prefix && prefix.split(/\s+/).length > 1) {
        return prefix.toUpperCase();
    }

    const firstWord = unique[0].split(/\s+/)[0];
    const allShareFirstWord = unique.every(d => d.split(/\s+/)[0].toLowerCase() === firstWord.toLowerCase());

    if (allShareFirstWord && firstWord.length > 1) {
        const brand = firstWord.toUpperCase();
        const suffixes = unique.map(d => {
            const s = d.substring(firstWord.length).trim();
            return s.replace(/^[\s\-\–\—\:\,]+/, '').trim();
        }).filter(Boolean);
        
        if (suffixes.length > 0) {
            return `${brand} – ${suffixes.join(', ')}`;
        }
        return brand;
    }

    return unique.join(', ');
};

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    try {
        if (date instanceof Timestamp) return date.toDate();
        if (date instanceof Date) return isValid(date) ? date : null;
        if (typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000);
        }
        const d = new Date(date);
        return isValid(d) ? d : null;
    } catch (e) {
        return null;
    }
};

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
    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        return data.filter(item => item.name.toLowerCase().includes(s));
    }, [data, search]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
                        <Search className="h-5 w-5 text-blue-400" /> {title}
                    </DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                        Select a verified node from the mission registry
                    </DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Type to filter registry handbook..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-200 font-bold focus-visible:ring-blue-900 shadow-inner"
                            autoFocus
                        />
                    </div>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-white">
                        <ScrollArea className="h-[40vh]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-slate-50 z-10 border-b">
                                    <TableRow className="hover:bg-transparent h-12">
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-4">Registry Node Name</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-4 text-center">GSTIN</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-4 text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-400 italic">No nodes matching search.</TableCell></TableRow>
                                    ) : (
                                        filtered.map(item => (
                                            <TableRow key={item.id} className="cursor-pointer h-12 transition-all group hover:bg-blue-50" onClick={() => onSelect(item)}>
                                                <TableCell className="px-4 font-black text-slate-800 uppercase text-xs">{item.name}</TableCell>
                                                <TableCell className="px-4 text-center font-mono text-[10px] text-slate-500">{item.gstin || '--'}</TableCell>
                                                <TableCell className="px-4 text-right">
                                                    <Button variant="ghost" size="sm" className="h-7 text-blue-600 font-black text-[10px] uppercase">Select</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter className="p-4 bg-slate-50 border-t flex-row justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400">Cancel</Button>
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSerialLoading, setIsSerialLoading] = useState(false);
  const [helpModal, setHelpModal] = useState<{ type: 'consignorName' | 'buyerName' | 'shipToParty'; title: string; data: any[] } | null>(null);

  const isEditing = !!lrToEdit;

  const partiesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, 
    [firestore]
  );
  const { data: parties } = useCollection<Party>(partiesQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        lrNumber: '',
        date: new Date(),
        vehicleNumber: '',
        driverName: '',
        driverMobile: '',
        paymentTerm: 'Paid',
        weightSelection: 'Assigned Weight',
        items: [],
        deliveryAddress: '',
        consignorName: '',
        consignorAddress: '',
        consignorGtin: '',
        consignorMobile: '',
        buyerName: '',
        buyerGtin: '',
        buyerMobile: '',
        shipToParty: '',
        shipToGtin: '',
        shipToMobile: '',
    }
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const { handleSubmit, formState: { isSubmitting }, reset, setValue, control, watch } = form;
  
  const watchedItems = useWatch({ control, name: "items" }) || [];
  const weightSelection = watch("weightSelection");
  const vehicleNumber = watch("vehicleNumber");
  const lrNumberValue = watch("lrNumber");

  const consignorRegistry = useMemo(() => {
    const list = (parties || []).filter(p => p.type === 'Consignor');
    return Array.from(new Map(list.map(p => [p.name, p])).values());
  }, [parties]);

  const consigneeRegistry = useMemo(() => {
    const list = (parties || []).filter(p => p.type === 'Consignee & Ship to');
    return Array.from(new Map(list.map(p => [p.name, p])).values());
  }, [parties]);

  const watchedConsignorName = watch('consignorName');
  const watchedBuyerName = watch('buyerName');
  const watchedShipToParty = watch('shipToParty');

  useEffect(() => {
    if (!watchedConsignorName || !parties) return;
    const match = consignorRegistry.find(p => p.name.toUpperCase() === watchedConsignorName.toUpperCase());
    if (match) {
        setValue('consignorGtin', match.gstin || '', { shouldValidate: true });
        setValue('consignorMobile', match.mobile || '', { shouldValidate: true });
        setValue('consignorAddress', match.address || '', { shouldValidate: true });
    }
  }, [watchedConsignorName, consignorRegistry, setValue, parties]);

  useEffect(() => {
    if (!watchedBuyerName || !parties) return;
    const match = consigneeRegistry.find(p => p.name.toUpperCase() === watchedBuyerName.toUpperCase());
    if (match) {
        setValue('buyerGtin', match.gstin || '', { shouldValidate: true });
        setValue('buyerMobile', match.mobile || '', { shouldValidate: true });
    }
  }, [watchedBuyerName, consigneeRegistry, setValue, parties]);

  useEffect(() => {
    if (!watchedShipToParty || !parties) return;
    const match = consigneeRegistry.find(p => p.name.toUpperCase() === watchedShipToParty.toUpperCase());
    if (match) {
        setValue('shipToGtin', match.gstin || '', { shouldValidate: true });
        setValue('shipToMobile', match.mobile || '', { shouldValidate: true });
    }
  }, [watchedShipToParty, consigneeRegistry, setValue, parties]);

  // Registry Serial Generation
  useEffect(() => {
    if (!isOpen || !firestore || isEditing || !activeTrip || lrNumberValue) return;

    const fetchNextLrSerial = async () => {
        setIsSerialLoading(true);
        try {
            const plantId = activeTrip.originPlantId;
            const counterRef = doc(firestore, "counters", `lr-${plantId}`);
            const counterSnap = await getDoc(counterRef);
            
            if (counterSnap.exists()) {
                const lastSerial = counterSnap.data().lastSerial;
                const nextNo = incrementSerial(lastSerial);
                setValue('lrNumber', nextNo, { shouldValidate: true });
            } else {
                const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
                const q = query(lrsRef, orderBy("lrNumber", "desc"), limit(1));
                const snap = await getDocs(q);
                
                if (!snap.empty) {
                    const lastNo = snap.docs[0].data().lrNumber;
                    setValue('lrNumber', incrementSerial(lastNo), { shouldValidate: true });
                } else {
                    setValue('lrNumber', '0001', { shouldValidate: true });
                }
            }
        } catch (e) {
            console.error("LR Serial Node Error:", e);
        } finally {
            setIsSerialLoading(false);
        }
    };

    fetchNextLrSerial();
  }, [isOpen, firestore, isEditing, activeTrip, setValue, lrNumberValue]);

  // CORE DATA FETCH NODE
  useEffect(() => {
    if (!isOpen || !firestore) return;

    const fetchData = async () => {
        setLoading(true);
        try {
            let targetTrip = providedTrip;
            let targetCarrier = providedCarrier;

            if (isEditing && lrToEdit) {
                const tripId = lrToEdit.tripId;
                const plantId = lrToEdit.originPlantId;
                const tRef = doc(firestore, `plants/${plantId}/trips`, lrToEdit.tripDocId || tripId);
                const tSnap = await getDoc(tRef);
                if (tSnap.exists()) {
                    targetTrip = { id: tSnap.id, ...tSnap.data() } as WithId<Trip>;
                }
                const carrierSnap = await getDoc(doc(firestore, "carriers", lrToEdit.carrierId));
                if (carrierSnap.exists()) {
                    targetCarrier = { id: carrierSnap.id, ...carrierSnap.data() } as WithId<Carrier>;
                }
            }

            if (!targetTrip) {
                setLoading(false);
                return;
            }

            setActiveTrip(targetTrip);
            setActiveCarrier(targetCarrier);

            const shipmentId = targetTrip.shipmentIds?.[0];
            if (!shipmentId) {
                 setLoading(false);
                 return;
            }

            const shipmentRef = doc(firestore, `plants/${targetTrip.originPlantId}/shipments`, shipmentId);
            const shipmentSnap = await getDoc(shipmentRef);
            
            if (shipmentSnap.exists()) {
                const shipmentData = { id: shipmentSnap.id, ...shipmentSnap.data() } as WithId<Shipment>;
                setShipment(shipmentData);
                const baseData = isEditing && lrToEdit ? lrToEdit : null;

                let initialItems = [];
                if (baseData?.items && baseData.items.length > 0) {
                    initialItems = baseData.items;
                } else if (shipmentData.items && shipmentData.items.length > 0) {
                    initialItems = shipmentData.items.map(i => ({
                        invoiceNumber: i.invoiceNumber,
                        ewaybillNumber: i.ewaybillNumber || '',
                        units: i.units || 1,
                        unitType: i.unitType || 'Package',
                        itemDescription: i.itemDescription || i.description || '',
                        weight: Number(i.weight || 0.001),
                        hsnSac: i.hsnSac || ''
                    }));
                } else {
                    initialItems = [{ 
                        invoiceNumber: shipmentData.invoiceNumber || '', 
                        ewaybillNumber: shipmentData.ewaybillNumber || '', 
                        units: Number(shipmentData.totalUnits) || 1, 
                        unitType: 'Package', 
                        itemDescription: shipmentData.itemDescription || shipmentData.material || '', 
                        weight: Number(targetTrip.assignedQtyInTrip || 0.001), 
                        hsnSac: '' 
                    }];
                }

                const lrNo = baseData?.lrNumber || shipmentData.lrNumber || '';
                const lrDt = getSafeDate(baseData?.date || shipmentData.lrDate) || new Date();

                reset({
                    lrNumber: lrNo,
                    date: lrDt,
                    vehicleNumber: baseData?.vehicleNumber || targetTrip.vehicleNumber || '',
                    driverName: baseData?.driverName || targetTrip.driverName || '',
                    driverMobile: baseData?.driverMobile || targetTrip.driverMobile || '',
                    paymentTerm: (baseData?.paymentTerm || shipmentData.paymentTerm || 'Paid') as any,
                    weightSelection: baseData?.weightSelection || 'Assigned Weight',
                    consignorName: baseData?.consignorName || shipmentData.consignor || '',
                    consignorAddress: baseData?.consignorAddress || shipmentData.loadingPoint || '',
                    consignorGtin: baseData?.consignorGtin || shipmentData.consignorGtin || '',
                    consignorMobile: baseData?.consignorMobile || '',
                    buyerName: baseData?.buyerName || shipmentData.billToParty || '',
                    buyerGtin: baseData?.buyerGtin || shipmentData.billToGtin || '',
                    buyerMobile: baseData?.buyerMobile || '',
                    shipToParty: baseData?.shipToParty || shipmentData.shipToParty || '',
                    shipToGtin: baseData?.shipToGtin || shipmentData.shipToGtin || '',
                    shipToMobile: baseData?.shipToMobile || '',
                    deliveryAddress: baseData?.deliveryAddress || shipmentData.deliveryAddress || shipmentData.unloadingPoint || '',
                    items: initialItems
                });
            }
        } catch (error) {
            console.error("LR Modal Sync Error:", error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [isOpen, providedTrip, providedCarrier, lrToEdit, firestore, isEditing, reset]);

  const totals = useMemo(() => {
    const result = watchedItems.reduce((acc, item) => ({
        units: acc.units + (Number(item?.units) || 0),
        weight: acc.weight + (Number(item?.weight) || 0)
    }), { units: 0, weight: 0 });

    return { ...result };
  }, [watchedItems]);

  const handleRegistrySelect = useCallback((party: Party) => {
    if (!helpModal) return;
    const type = helpModal.type;
    
    setValue(type as any, party.name, { shouldValidate: true });
    
    if (type === 'consignorName') {
        setValue('consignorGtin', party.gstin || '', { shouldValidate: true });
        setValue('consignorMobile', party.mobile || '', { shouldValidate: true });
        setValue('consignorAddress', party.address || '', { shouldValidate: true });
    } else if (type === 'buyerName') {
        setValue('buyerGtin', party.gstin || '', { shouldValidate: true });
        setValue('buyerMobile', party.mobile || '', { shouldValidate: true });
    } else if (type === 'shipToParty') {
        setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
        setValue('shipToMobile', party.mobile || '', { shouldValidate: true });
        setValue('deliveryAddress', party.address || '', { shouldValidate: true });
    }

    setHelpModal(null);
  }, [helpModal, setValue]);

  const handlePost = async () => {
    if (!firestore || !shipment || !activeTrip || !activeCarrier || !user) return;
    const values = form.getValues();

    try {
        await runTransaction(firestore, async (transaction) => {
            const plantId = activeTrip.originPlantId;
            const shipmentId = shipment.id;
            const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipmentId);

            const shipSnap = await transaction.get(shipmentRef);
            if (!shipSnap.exists()) throw new Error("Sale Order registry error.");
            const sData = shipSnap.data() as Shipment;

            const lrId = isEditing ? lrToEdit!.id : `lr-${Date.now()}`;
            const lrRef = doc(firestore, `plants/${plantId}/lrs`, lrId);
            const tripRef = doc(firestore, `plants/${plantId}/trips`, activeTrip.id);
            const globalTripRef = doc(firestore, 'trips', activeTrip.id);
            const counterRef = doc(firestore, "counters", `lr-${plantId}`);

            const finalWeight = values.weightSelection === 'Actual Weight' ? totals.weight : activeTrip.assignedQtyInTrip;
            const weightDifference = finalWeight - activeTrip.assignedQtyInTrip;

            const currentName = (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') 
                ? 'AJAY SOMRA' 
                : (user.displayName || user.email?.split('@')[0] || 'System Operator');

            // CONCISE HEADER NODE LOGIC
            const consignorParty = parties?.find(p => p.name === values.consignorName);
            const shipToPartyObj = parties?.find(p => p.name === values.shipToParty);
            
            const fromHeader = consignorParty?.city || values.consignorName;
            const toHeader = shipToPartyObj?.city || shipment.destination || values.shipToParty;

            const lrData: any = {
                ...values,
                tripDocId: activeTrip.id,
                tripId: activeTrip.tripId, 
                carrierId: activeCarrier.id,
                originPlantId: plantId,
                from: fromHeader,
                to: toHeader,
                transportMode: 'Road',
                assignedTripWeight: finalWeight,
                updatedAt: serverTimestamp(),
                userName: currentName,
                userId: user.uid
            };

            if (!isEditing) lrData.createdAt = serverTimestamp();

            const newAssignedTotal = (sData.assignedQty || 0) + weightDifference;
            const newBalanceTotal = sData.quantity - newAssignedTotal;

            transaction.set(lrRef, lrData, { merge: true });

            transaction.update(tripRef, {
                lrGenerated: true,
                lrNumber: values.lrNumber,
                lrDate: values.date,
                assignedQtyInTrip: finalWeight, 
                lastUpdated: serverTimestamp()
            });

            transaction.update(globalTripRef, {
                lrGenerated: true,
                lrNumber: values.lrNumber,
                lrDate: values.date,
                assignedQtyInTrip: finalWeight, 
                lastUpdated: serverTimestamp()
            });

            transaction.update(shipmentRef, {
                assignedQty: newAssignedTotal,
                balanceQty: newBalanceTotal,
                currentStatusId: newBalanceTotal > 0 ? 'Partly Vehicle Assigned' : 'Assigned',
                lastUpdateDate: serverTimestamp()
            });

            transaction.set(counterRef, { lastSerial: values.lrNumber }, { merge: true });

            const logRef = doc(collection(firestore, "activity_logs"));
            transaction.set(logRef, {
                userId: user.uid,
                userName: currentName,
                action: isEditing ? 'Edit' : 'Create',
                tcode: 'LR Create',
                pageName: 'LR Generation',
                timestamp: serverTimestamp(),
                description: `${isEditing ? 'Updated' : 'Generated'} LR ${values.lrNumber} for Trip ${activeTrip.tripId}.`
            });
        });

        onGenerate({} as any);
        toast({ title: 'Success', description: `Lorry Receipt committed to mission database.` });
        setShowConfirmModal(false);
        onClose();
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Commit Failed", description: error.message });
    }
  };

  const handleF4 = (e: React.KeyboardEvent, type: 'consignorName' | 'buyerName' | 'shipToParty') => {
    if (e.key === 'F4') {
        e.preventDefault();
        const registryData = type === 'consignorName' ? consignorRegistry : consigneeRegistry;
        const registryTitle = type === 'consignorName' ? 'Select Consignor Node' : 'Select Party Node';
        setHelpModal({ type, title: registryTitle, data: registryData });
    }
  };

  if (loading) {
    return (
        <div className="flex h-screen flex-col items-center justify-center bg-slate-50">
            <Loader2 className="h-12 w-12 animate-spin text-blue-900 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Syncing Registry Handshake...</p>
        </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[85vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center pr-12">
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                    <ShieldCheck className="h-7 w-7 text-blue-400" /> LR Generation Board
                </DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                    Logistics Registry &gt; Trip Mission &gt; Generate Receipt
                </DialogDescription>
            </div>
            <div className="flex gap-4">
                <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Live Registry Verified</span>
                </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 bg-[#f8fafc]">
            <Form {...form}>
                <form className="space-y-10">
                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                            <Truck className="h-4 w-4 text-blue-600"/> 1. Mission Context Particulars
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-6 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-900" />
                            
                            <div className="space-y-1.5"><p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Lifting Node</p><p className="text-sm font-bold text-slate-800">{activeTrip?.originPlantId || '--'}</p></div>
                            <div className="space-y-1.5"><p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Registry Trip ID</p><p className="text-sm font-bold text-blue-700 font-mono tracking-tighter uppercase">{activeTrip?.tripId || '--'}</p></div>
                            <div className="space-y-1.5"><p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vehicle Number</p><p className="text-sm font-black text-slate-900 uppercase tracking-tighter">{vehicleNumber}</p></div>
                            <div className="space-y-1.5"><p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Carrier Service</p><p className="text-sm font-bold text-slate-800">{activeCarrier?.name || '--'}</p></div>
                            
                            <Separator className="col-span-full opacity-50" />

                            <div className="lg:col-span-1 space-y-4">
                                <FormField name="consignorName" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-wider">Consignor Entity * (F4 Help)</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl><Input className="h-10 rounded-xl font-black text-slate-900" {...field} onKeyDown={(e) => handleF4(e, 'consignorName')} /></FormControl>
                                            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setHelpModal({ type: 'consignor', title: 'Select Consignor Node', data: consignorRegistry })}>
                                                <Search className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField name="consignorGtin" control={form.control} render={({ field }) => (
                                        <FormItem><FormLabel className="text-[9px] font-black uppercase text-slate-400">GSTIN Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} readOnly className="h-9 bg-slate-50 font-mono text-[10px] font-bold" /></FormControl></FormItem>
                                    )} />
                                    <FormField name="consignorMobile" control={form.control} render={({ field }) => (
                                        <FormItem><FormLabel className="text-[9px] font-black uppercase text-slate-400">Mobile Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} readOnly className="h-9 bg-slate-50 font-mono text-[10px] font-bold" /></FormControl></FormItem>
                                    )} />
                                </div>
                            </div>

                            <div className="lg:col-span-1 space-y-4">
                                <FormField name="buyerName" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-wider">Consignee (Bill to) * (F4 Help)</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl><Input className="h-10 rounded-xl font-black text-slate-900" {...field} onKeyDown={(e) => handleF4(e, 'buyerName')} /></FormControl>
                                            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setHelpModal({ type: 'buyerName', title: 'Select Consignee Node', data: consigneeRegistry })}>
                                                <Search className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField name="buyerGtin" control={form.control} render={({ field }) => (
                                        <FormItem><FormLabel className="text-[9px] font-black uppercase text-slate-400">GSTIN Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} readOnly className="h-9 bg-slate-50 font-mono text-[10px] font-bold" /></FormControl></FormItem>
                                    )} />
                                    <FormField name="buyerMobile" control={form.control} render={({ field }) => (
                                        <FormItem><FormLabel className="text-[9px] font-black uppercase text-slate-400">Mobile Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} readOnly className="h-9 bg-slate-50 font-mono text-[10px] font-bold" /></FormControl></FormItem>
                                    )} />
                                </div>
                            </div>

                            <div className="lg:col-span-1 space-y-4">
                                <FormField name="shipToParty" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-wider">Ship to Node * (F4 Help)</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl><Input className="h-10 rounded-xl font-black text-slate-900" {...field} onKeyDown={(e) => handleF4(e, 'shipToParty')} /></FormControl>
                                            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setHelpModal({ type: 'shipToParty', title: 'Select Consignee Node', data: consigneeRegistry })}>
                                                <Search className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField name="shipToGtin" control={form.control} render={({ field }) => (
                                        <FormItem><FormLabel className="text-[9px] font-black uppercase text-slate-400">GSTIN Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} readOnly className="h-9 bg-slate-50 font-mono text-[10px] font-bold" /></FormControl></FormItem>
                                    )} />
                                    <FormField name="shipToMobile" control={form.control} render={({ field }) => (
                                        <FormItem><FormLabel className="text-[9px] font-black uppercase text-slate-400">Mobile Node</FormLabel><FormControl><Input {...field} value={field.value ?? ''} readOnly className="h-9 bg-slate-50 font-mono text-[10px] font-bold" /></FormControl></FormItem>
                                    )} />
                                </div>
                            </div>

                            <FormField name="paymentTerm" control={form.control} render={({ field }) => (
                                <FormItem className="justify-self-end w-full"><FormLabel className="text-[10px] font-black uppercase tracking-wider">Payment Term *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-10 bg-white rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{PaymentTerms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                            <FileText className="h-4 w-4 text-blue-600"/> 2. Receipt Setup & Weight Logic
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm items-end">
                            <FormField name="lrNumber" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold text-xs uppercase flex justify-between">
                                        LR / CN Serial No *
                                        {isSerialLoading && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input placeholder="Enter LR Number" className="h-11 rounded-xl font-black text-blue-900 border-blue-900/20 shadow-inner" {...field} />
                                            {!isEditing && !isSerialLoading && <Sparkles className="absolute right-3 top-3 h-4 w-4 text-blue-400 opacity-50" />}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="date" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel className="font-bold text-xs uppercase">Registration Date *</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 rounded-xl" placeholder="Select LR Date" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Weight Selection Policy</FormLabel>
                                <FormField control={form.control} name="weightSelection" render={({ field }) => (
                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-8">
                                        <div className="flex items-center space-x-2 cursor-pointer"><RadioGroupItem value="Assigned Weight" id="opt-assigned" className="border-blue-900" /><Label htmlFor="opt-assigned" className="cursor-pointer font-black text-xs uppercase tracking-tight text-slate-600">Assigned</Label></div>
                                        <div className="flex items-center space-x-2 cursor-pointer"><RadioGroupItem value="Actual Weight" id="opt-actual" className="border-blue-900" /><Label htmlFor="opt-actual" className="cursor-pointer font-black text-xs uppercase tracking-tight text-slate-600">Actual Manifest</Label></div>
                                    </RadioGroup>
                                )} />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                                <Layers className="h-4 w-4 text-blue-600" /> 3. Consignment Particulars (Grouped by Invoice)
                            </h3>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 bg-white hover:bg-blue-50 shadow-sm" 
                                onClick={() => append({ invoiceNumber: '', ewaybillNumber: '', units: 1, unitType: 'Package', itemDescription: shipment?.material || '', weight: 0.001, hsnSac: '' })}
                            >
                                <PlusCircle className="h-3.5 w-3.5" /> Add Document Row
                            </Button>
                        </div>
                        
                        <div className="rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-900">
                                    <TableRow className="hover:bg-transparent border-none h-12">
                                        <TableHead className="text-[10px] font-black uppercase text-white px-6 w-40">Invoice No *</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 w-40">E-Waybill</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 w-20 text-center">Package *</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 w-32">Package Type</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4">Item Description *</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-6 w-36 text-right">Weight (MT) *</TableHead>
                                        <TableHead className="w-16"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-0 hover:bg-blue-50/10 group transition-colors">
                                            <TableCell className="px-6 py-2">
                                                <FormField control={form.control} name={`items.${index}.invoiceNumber`} render={({ field: itm }) => (
                                                    <FormControl><Input placeholder="Invoice #" className="h-10 border-slate-200 font-bold focus-visible:ring-blue-900" {...itm} /></FormControl>
                                                )} />
                                            </TableCell>
                                            <TableCell className="px-4 py-2">
                                                <FormField control={form.control} name={`items.${index}.ewaybillNumber`} render={({ field: itm }) => (
                                                    <FormControl><Input placeholder="EWB #" className="h-10 bg-transparent border-none shadow-none focus-visible:ring-0" {...itm} /></FormControl>
                                                )} />
                                            </TableCell>
                                            <TableCell className="px-4 py-2">
                                                <FormField control={form.control} name={`items.${index}.units`} render={({ field: itm }) => (
                                                    <FormControl><Input type="number" className="h-10 text-center font-black text-blue-900 bg-transparent border-none shadow-none focus-visible:ring-0" {...itm} /></FormControl>
                                                )} />
                                            </TableCell>
                                            <TableCell className="px-4 py-2">
                                                <FormField control={form.control} name={`items.${index}.unitType`} render={({ field: itm }) => (
                                                    <Select onValueChange={itm.onChange} value={itm.value || ''}>
                                                        <FormControl><SelectTrigger className="h-10 bg-transparent border-none shadow-none focus:ring-0 font-bold"><SelectValue placeholder="Pick" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {LRUnitTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )} />
                                            </TableCell>
                                            <TableCell className="px-4 py-2">
                                                <FormField control={form.control} name={`items.${index}.itemDescription`} render={({ field: itm }) => (
                                                    <FormControl><Input placeholder="Enter item description..." className="h-10 font-bold bg-transparent border-none shadow-none focus-visible:ring-0" {...itm} /></FormControl>
                                                )} />
                                            </TableCell>
                                            <TableCell className="px-6 py-2">
                                                <FormField control={form.control} name={`items.${index}.weight`} render={({ field: itm }) => (
                                                    <FormControl><Input type="number" step="0.001" className="h-10 text-right font-black text-blue-900 bg-transparent border-none shadow-none focus-visible:ring-0" {...itm} /></FormControl>
                                                )} />
                                            </TableCell>
                                            <TableCell className="pr-6 py-2 text-right">
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-200 group-hover:text-red-600" onClick={() => remove(index)} disabled={fields.length === 1}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className="bg-slate-50 border-t-2 border-slate-200 h-14">
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={2} className="px-6 text-[10px] font-black uppercase text-slate-400">Registry Aggregate Totals</TableCell>
                                        <TableCell className="text-center font-black text-lg text-slate-900">{totals.units}</TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                        <TableCell className="text-right px-6 font-black text-xl text-blue-900 tracking-tighter">
                                            {Number(totals.weight).toFixed(3)} MT
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                            <MapPin className="h-4 w-4 text-blue-600"/> 4. Delivery Address Registry
                        </h3>
                        <FormField control={form.control} name="deliveryAddress" render={({ field }) => (
                            <FormItem><FormControl><Textarea rows={3} placeholder="Provide verified delivery address particulars..." className="resize-none bg-white border-slate-200 rounded-3xl p-8 font-bold shadow-sm focus-visible:ring-blue-900 transition-all" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </section>
                </form>
            </Form>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex-row items-center justify-between sm:justify-between shrink-0">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Manifest Finalized Weight</span>
            <div className="flex items-center gap-3">
                <span className={cn(
                    "text-2xl font-black tracking-tighter transition-colors",
                    weightSelection === 'Actual Weight' ? "text-blue-900" : "text-slate-900"
                )}>
                    {weightSelection === 'Actual Weight' ? totals.weight.toFixed(3) : (activeTrip?.assignedQtyInTrip || 0).toFixed(3)} MT
                </span>
                <Badge variant="secondary" className="text-[9px] uppercase font-bold bg-white shadow-sm border-slate-200">{weightSelection}</Badge>
            </div>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={onClose} className="font-black text-slate-500 hover:text-red-600 transition-all uppercase text-[11px] tracking-widest px-8 h-12">Discard Draft</Button>
            <Button onClick={handleSubmit(() => setShowConfirmModal(true))} className="bg-blue-900 hover:bg-slate-900 text-white px-16 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-200 transition-all active:scale-95 border-none">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "COMMIT MISSION RECEIPT"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white">
            <DialogHeader className="p-8 bg-blue-900 text-white flex flex-row items-center gap-5 space-y-0">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                    <ShieldCheck className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Post Commitment Check</DialogTitle>
                    <DialogDescription className="text-blue-200 font-bold uppercase text-[9px] mt-1 tracking-widest">Lorry Receipt Final Registry Verification</DialogDescription>
                </div>
            </DialogHeader>
            <div className="p-8 space-y-6">
                <p className="text-sm font-medium text-slate-600">You are about to commit this LR record to the **Logistics Registry**. This will update the trip and order status permanently.</p>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3 shadow-inner">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                        Authorized Data Capture: Verify weights and party nodes.
                    </p>
                </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowConfirmModal(false)}>Back</Button>
                <Button onClick={handlePost} disabled={isSubmitting} className="bg-blue-900 text-white px-8 h-10">Confirm Commit</Button>
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
    </Dialog>
  );
}
