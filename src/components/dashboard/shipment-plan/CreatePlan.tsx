
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/date-picker';
import { Separator } from '@/components/ui/separator';
import type { Plant, Shipment, WithId, SubUser, Party, MasterQtyType, Carrier } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Search, Truck, Calculator, Trash2, PlusCircle, Loader2, Factory, UserCircle, MapPin, FileText, Lock, Sparkles, X, Save, FileDown, Upload } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, runTransaction, where, serverTimestamp, orderBy, getDoc, getDocs, limit, Timestamp } from "firebase/firestore";
import { cn, normalizePlantId, formatSequenceId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { PaymentTerms } from '@/lib/constants';

const formSchema = z.object({
  originPlantId: z.string().min(1, 'Plant node selection is required.'),
  consignor: z.string().min(1, 'Consignor is mandatory.'),
  consignorGtin: z.string().optional(),
  consignorAddress: z.string().optional().default(''),
  loadingPoint: z.string().min(1, 'Lifting city is required.'),
  billToParty: z.string().min(1, 'Consignee is mandatory.'),
  billToGtin: z.string().optional(),
  isSameAsBillTo: z.boolean().default(false),
  shipToParty: z.string().min(1, 'Ship To Node is mandatory.'),
  shipToGtin: z.string().optional(),
  unloadingPoint: z.string().min(1, 'Destination city is mandatory.'),
  quantity: z.coerce.number(),
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
}).superRefine((data, ctx) => {
    if (data.materialTypeId.toUpperCase() !== 'FTL' && data.quantity <= 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Total quantity must be a positive value.",
            path: ['quantity']
        });
    }
});

type FormValues = z.infer<typeof formSchema>;

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
        <div className="space-y-2 relative" ref={wrapperRef}>
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">{label}</label>
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Input 
                        placeholder={placeholder} 
                        value={value} 
                        onChange={(e) => { onChange(e.target.value); setIsOpen(true); }} 
                        onFocus={() => setIsOpen(true)} 
                        className="h-14 rounded-2xl font-black text-slate-900 border-slate-200 bg-slate-50/30 focus-visible:ring-blue-900 shadow-inner" 
                        disabled={disabled} 
                    />
                    {isOpen && filteredSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                            {filteredSuggestions.map((suggestion) => (
                                <div key={suggestion.id} onMouseDown={() => { if(onSelect) onSelect(suggestion); else onChange(suggestion.name); setIsOpen(false); }} className="px-5 py-3 cursor-pointer hover:bg-blue-50 border-b last:border-0 group">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase tracking-tight text-slate-700 group-hover:text-blue-900">{suggestion.name}</span>
                                        <span className="text-[9px] font-bold uppercase text-slate-400">{suggestion.city} | {suggestion.gstin || 'No GSTIN'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <Button type="button" variant="outline" size="icon" disabled={disabled} className="h-14 w-14 rounded-2xl shrink-0 shadow-lg hover:bg-blue-50 transition-all active:scale-95" onClick={onSearchClick}>
                    <Search className="h-6 w-6 text-blue-600" />
                </Button>
            </div>
            {error && <p className="text-[10px] font-bold text-red-600 mt-1">{error}</p>}
        </div>
    );
}

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
        return data.filter(item => 
            item.name?.toLowerCase().includes(s) || 
            item.gstin?.toLowerCase().includes(s) || 
            item.city?.toLowerCase().includes(s)
        );
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
                            placeholder="Search by Name, GSTIN, or City..." 
                            value={search} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-200 font-bold focus-visible:ring-blue-900 shadow-inner"
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
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400 uppercase text-[10px]">Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function CreatePlan({ onShipmentCreated, authorizedPlants }: { onShipmentCreated: (shipment: any) => void, authorizedPlants: WithId<Plant>[] }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [helpModal, setHelpModal] = useState<{ type: string; title: string; data: any[] } | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        originPlantId: '', consignor: '', consignorAddress: '', billToParty: '', shipToParty: '', loadingPoint: '', unloadingPoint: '',
        materialTypeId: 'METRIC TON', quantity: 0, lrNumber: '', carrierId: '', paymentTerm: 'Paid',
        isSameAsBillTo: false, lrDate: null, items: []
    },
  });

  const { setValue, control, handleSubmit, reset } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  
  const watchedUom = useWatch({ control, name: 'materialTypeId' });
  const originPlantId = useWatch({ control, name: 'originPlantId' });
  const isSameAsBillTo = useWatch({ control, name: 'isSameAsBillTo' });
  const billToParty = useWatch({ control, name: 'billToParty' });
  const watchedConsignor = useWatch({ control, name: 'consignor' });
  const watchedShipTo = useWatch({ control, name: 'shipToParty' });
  const watchedItems = useWatch({ control, name: "items" }) || [];

  const totals = useMemo(() => {
    return (watchedItems || []).reduce((acc, item) => ({
        units: acc.units + (Number(item?.units) || 0),
        weight: acc.weight + (Number(item?.weight) || 0)
    }), { units: 0, weight: 0 });
  }, [watchedItems]);

  const isFtl = useMemo(() => watchedUom?.toUpperCase() === 'FTL', [watchedUom]);

  useEffect(() => {
    if (isFtl) {
        setValue('quantity', 0, { shouldValidate: true });
    }
  }, [isFtl, setValue]);

  const { data: qtyTypes } = useCollection<MasterQtyType>(useMemoFirebase(() => firestore ? query(collection(firestore, "material_types")) : null, [firestore]));
  const { data: parties } = useCollection<Party>(useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_parties")) : null, [firestore]));
  
  const { data: carriers } = useCollection<Carrier>(useMemoFirebase(() => {
    if (!firestore || !originPlantId) return null;
    return query(collection(firestore, "carriers"), where("plantId", "==", originPlantId));
  }, [firestore, originPlantId]));

  const activeParties = useMemo(() => (parties || []).filter(p => p.isDeleted === false || p.isDeleted === undefined), [parties]);
  
  const consignorRegistry = useMemo(() => activeParties.filter(p => p.type?.toLowerCase() === 'consignor'), [activeParties]);
  
  const consigneeRegistry = useMemo(() => activeParties.filter(p => {
    const type = p.type?.toLowerCase() || '';
    return type.includes('consignee') || type.includes('buyer') || type.includes('ship to');
  }), [activeParties]);

  useEffect(() => {
    if (originPlantId && authorizedPlants.length > 0) {
        const plant = authorizedPlants.find(p => p.id === originPlantId);
        if (plant) {
            // Registry Logic: Resolve City Name for Loading Point Handshake
            const cityNode = (plant.city && plant.city !== 'N/A' ? plant.city : (plant.address && plant.address !== 'N/A' ? plant.address.split(',')[0] : plant.name)).toUpperCase();
            setValue('loadingPoint', cityNode, { shouldValidate: true });
            
            // Registry Sync: Initialize Consignor Address with full Plant Address manifest
            const fullAddress = plant.address && plant.address !== 'N/A' ? plant.address : (plant.city || plant.name);
            setValue('consignorAddress', fullAddress, { shouldValidate: true });
        }
    }
  }, [originPlantId, authorizedPlants, setValue]);

  useEffect(() => {
    if (isSameAsBillTo && billToParty) {
        setValue('shipToParty', billToParty, { shouldValidate: true });
        const match = consigneeRegistry.find(p => p.name === billToParty);
        if (match) {
            setValue('shipToGtin', match.gstin || '', { shouldValidate: true });
            const city = match.city && match.city !== 'N/A' ? match.city : (match.address && match.address !== 'N/A' ? match.address : 'N/A');
            if (city) setValue('unloadingPoint', city, { shouldValidate: true });
            if (match.address) setValue('deliveryAddress', match.address, { shouldValidate: true });
        }
    }
  }, [isSameAsBillTo, billToParty, setValue, consigneeRegistry]);

  const selectPartyNode = useCallback((party: Party, type: string) => {
    setValue(type as any, party.name, { shouldValidate: true });
    
    if (type === 'consignor') {
        setValue('consignorGtin', party.gstin || '', { shouldValidate: true });
        // REGISTRY SYNC: When selecting consignor, keep loading city but use party address if specific
        const city = party.city && party.city !== 'N/A' ? party.city : (party.address && party.address !== 'N/A' ? party.address : 'N/A');
        if(city) setValue('loadingPoint', city, { shouldValidate: true });
        if(party.address) setValue('consignorAddress', party.address, { shouldValidate: true });
    } else if (type === 'billToParty') {
        setValue('billToGtin', party.gstin || '', { shouldValidate: true });
        if(isSameAsBillTo) {
            setValue('shipToParty', party.name, { shouldValidate: true });
            setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
            const city = party.city && party.city !== 'N/A' ? party.city : (party.address && party.address !== 'N/A' ? party.address : 'N/A');
            if (city) {
                setValue('unloadingPoint', city, { shouldValidate: true });
                setValue('deliveryAddress', party.address || '', { shouldValidate: true });
            }
        }
    } else if (type === 'shipToParty') {
        setValue('shipToGtin', party.gstin || '', { shouldValidate: true });
        const city = party.city && party.city !== 'N/A' ? party.city : (party.address && party.address !== 'N/A' ? party.address : 'N/A');
        if (city) {
            setValue('unloadingPoint', city, { shouldValidate: true });
            setValue('deliveryAddress', party.address || '', { shouldValidate: true });
        }
    }
  }, [setValue, isSameAsBillTo]);

  const handleRegistrySelect = useCallback((party: Party) => {
    if (!helpModal) return;
    selectPartyNode(party, helpModal.type);
    setHelpModal(null);
  }, [helpModal, selectPartyNode]);

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

            let manifestItems = values.items || [];
            if (manifestItems.length === 0) {
                manifestItems = [{
                    invoiceNumber: 'INITIAL-PLAN',
                    ewaybillNumber: '',
                    units: isFtl ? 1 : 0,
                    unitType: 'Package',
                    itemDescription: 'AUTO-GEN MISSION PAYLOAD',
                    weight: values.quantity,
                    hsnSac: ''
                }];
            }

            const dataToSave = {
                ...values,
                shipmentId,
                items: manifestItems,
                currentStatusId: 'pending',
                creationDate: serverTimestamp(),
                assignedQty: 0,
                balanceQty: values.quantity,
                userId: user.uid
            };

            tx.set(doc(firestore, "counters", "shipments"), { count: newCount }, { merge: true });
            tx.set(shipRef, dataToSave);
        });
        toast({ title: 'Plan Committed Successfully' });
        reset();
        onShipmentCreated({ id: 'new' } as any);
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally { hideLoader(); }
  };

  const handleExportTemplate = () => {
    const headers = [
        "Plant ID", "Consignor Name", "Consignor GSTIN", "Lifting Point", "Consignee Name", "Consignee GSTIN", "Ship To Name", "Ship To GSTIN", 
        "Destination Point", "UOM", "Quantity", "Invoice Number", "LR Number", "Payment Term", "Delivery Address", "Item Description", "Units"
    ];
    const sample = [
        ["1426", "TATA CHEMICALS", "27AABCU9567L1Z5", "MUMBAI", "BIGMART RETAIL", "07AABCD1234E1Z3", "BIGMART WH", "07AABCD1234E1Z3", "GHAZIABAD", "MT", "25.000", "INV-9988", "LR123", "Paid", "C-17 UPSIDC GZB", "TATA SALT 50KG BAGS", "500"]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Order Plan Template");
    XLSX.writeFile(wb, "Order_Plan_Bulk_Template.xlsx");
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore || !user) return;

    setIsBulkUploading(true);
    showLoader();
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

            let successCount = 0;

            const getVal = (row: any, keys: string[]) => {
                const foundKey = Object.keys(row).find(k => keys.some(search => k.toLowerCase().replace(/\s/g, '') === search.toLowerCase().replace(/\s/g, '')));
                return foundKey ? row[foundKey]?.toString().trim() : '';
            };

            for (const row of jsonData) {
                try {
                    const plantId = normalizePlantId(getVal(row, ["Plant ID", "Plant"]));
                    if (!plantId) continue;

                    await runTransaction(firestore, async (tx) => {
                        const countSnap = await tx.get(doc(firestore, "counters", "shipments"));
                        const newCount = (countSnap.exists() ? countSnap.data().count : 0) + 1;
                        const shipmentId = formatSequenceId("S", newCount);
                        const shipRef = doc(collection(firestore, `plants/${plantId}/shipments`));

                        const qty = Number(getVal(row, ["Quantity", "Qty"])) || 0;
                        const uom = (getVal(row, ["UOM", "Unit"]) || 'METRIC TON').toUpperCase();
                        const invoiceNo = getVal(row, ["Invoice Number", "Invoice No"]) || 'NA';
                        const itemDesc = getVal(row, ["Item Description", "Description"]) || 'BULK UPLOAD MISSION';
                        const unitCount = Number(getVal(row, ["Units", "Packages"])) || 1;

                        const dataToSave = {
                            originPlantId: plantId,
                            shipmentId,
                            consignor: getVal(row, ["Consignor Name", "Consignor"]),
                            consignorGtin: getVal(row, ["Consignor GSTIN", "Consignor Gst"]),
                            consignorAddress: getVal(row, ["Consignor Address", "Consignor Site"]),
                            loadingPoint: getVal(row, ["Lifting Point", "From"]),
                            billToParty: getVal(row, ["Consignee Name", "Consignee"]),
                            billToGtin: getVal(row, ["Consignee GSTIN", "Consignee Gst"]),
                            shipToParty: getVal(row, ["Ship To Name", "Ship To"]),
                            shipToGtin: getVal(row, ["Ship To GSTIN", "Ship To Gst"]),
                            unloadingPoint: getVal(row, ["Destination Point", "To"]),
                            materialTypeId: uom,
                            quantity: qty,
                            assignedQty: 0,
                            balanceQty: qty,
                            lrNumber: getVal(row, ["LR Number", "LR No"]),
                            paymentTerm: getVal(row, ["Payment Term", "Term"]) || 'Paid',
                            deliveryAddress: getVal(row, ["Delivery Address", "Address"]),
                            currentStatusId: 'pending',
                            creationDate: serverTimestamp(),
                            lrDate: serverTimestamp(), 
                            userId: user.uid,
                            items: [{
                                invoiceNumber: invoiceNo,
                                units: unitCount,
                                unitType: 'Package',
                                itemDescription: itemDesc,
                                weight: qty
                            }]
                        };

                        tx.set(doc(firestore, "counters", "shipments"), { count: newCount }, { merge: true });
                        tx.set(shipRef, dataToSave);
                    });
                    successCount++;
                } catch (err) { console.error("Row fail", err); }
            }

            toast({ title: 'Bulk Sync Complete', description: `Established ${successCount} mission nodes.` });
            onShipmentCreated({ id: 'bulk' } as any);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: 'Registry file error.' });
        } finally {
            setIsBulkUploading(false);
            hideLoader();
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="w-full space-y-10">
      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/80 p-10 border-b">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-blue-900 rounded-2xl text-white shadow-xl rotate-3"><ShieldCheck size={32} /></div>
                    <div>
                        <CardTitle className="text-3xl font-black text-blue-900 tracking-tight uppercase italic leading-none">Order Plan Registry</CardTitle>
                        <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Secure Mission Asset Deployment Terminal</CardDescription>
                    </div>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                    <Button variant="outline" onClick={handleExportTemplate} className="h-14 px-8 rounded-2xl font-black border-slate-200 text-blue-900 bg-white hover:bg-slate-50 shadow-sm uppercase text-xs tracking-widest gap-2">
                        <FileDown size={18} /> Export Excel
                    </Button>
                    <Button variant="outline" asChild className="h-14 px-8 rounded-2xl font-black border-slate-200 text-blue-900 bg-white hover:bg-slate-50 shadow-sm uppercase text-xs tracking-widest gap-2 cursor-pointer">
                        <label>
                            {isBulkUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                            Bulk Upload
                            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} disabled={isBulkUploading} />
                        </label>
                    </Button>
                    <Button onClick={handleSubmit(handlePost)} className="h-14 px-12 bg-blue-900 hover:bg-slate-900 rounded-2xl font-black shadow-xl transition-all active:scale-95 text-white border-none uppercase text-xs tracking-widest">
                        Commit Plan (F8)
                    </Button>
                </div>
            </div>
        </CardHeader>

        <CardContent className="p-12">
          <Form {...form}>
            <form className="space-y-16">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Registry Timestamp</label>
                    <div className="h-14 bg-white border rounded-xl flex items-center px-5 font-mono text-blue-900 font-bold shadow-sm">{format(currentTime, 'dd-MM-yyyy HH:mm:ss')}</div>
                  </div>
                  
                  <FormField control={control} name="originPlantId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Plant Node Registry *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger className="h-14 bg-white rounded-xl font-black text-slate-700 shadow-sm border-slate-200">
                                    <SelectValue placeholder="Select Node" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">{authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic text-black">{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                  )} />

                  <FormField control={control} name="materialTypeId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">UOM (Unit) *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-14 bg-white rounded-xl font-bold border-slate-200 shadow-sm"><SelectValue placeholder="UOM" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">
                                {qtyTypes?.filter(t => t.name.toUpperCase() !== 'FTL').map(t => (
                                    <SelectItem key={t.id} value={t.name} className="font-bold py-2.5 uppercase">{t.name}</SelectItem>
                                ))}
                                <SelectItem value="FTL" className="font-bold py-2.5 uppercase text-blue-600">FTL (Full Truck Load)</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                  )} />

                  <FormField control={control} name="quantity" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 flex justify-between items-center">
                            Total Quantity *
                            {isFtl && <Lock className="h-3 w-3 text-blue-600" />}
                        </FormLabel>
                        <FormControl>
                            <div className="relative group">
                                <Input 
                                    type={isFtl ? "text" : "number"}
                                    step="0.001" 
                                    {...field} 
                                    value={isFtl ? "" : field.value}
                                    disabled={isFtl}
                                    className={cn(
                                        "h-14 rounded-xl font-black text-xl text-center transition-all",
                                        isFtl ? "bg-blue-50 border-blue-100 text-blue-900 opacity-100 cursor-not-allowed shadow-none" : "bg-white border-slate-200 shadow-inner"
                                    )} 
                                    placeholder={isFtl ? "" : "0.000"}
                                />
                                {isFtl && (
                                    <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-900 text-white font-black text-[8px] uppercase px-2 h-4 border-none shadow-sm">
                                        LOCKED FOR FTL
                                    </Badge>
                                )}
                            </div>
                        </FormControl>
                    </FormItem>
                  )} />
               </div>

               <div className="p-10 rounded-[2.5rem] border-2 border-dashed border-blue-100 bg-blue-50/10 space-y-8">
                  <div className="flex items-center gap-3 text-blue-900 font-black text-sm uppercase tracking-tighter border-b border-blue-100 pb-4"><Truck size={20}/> 2. Optional LR Registry Section</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                      <FormField control={control} name="lrNumber" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-bold text-slate-400 uppercase">LR Number</FormLabel><FormControl><Input {...field} placeholder="Enter LR" className="h-14 bg-white rounded-xl font-black uppercase tracking-widest border-slate-200" /></FormControl></FormItem>
                      )} />

                      <FormField control={control} name="lrDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-bold text-slate-400 uppercase">LR Date</FormLabel><DatePicker date={field.value || undefined} setDate={field.onChange} className="h-14 bg-white" /><FormMessage /></FormItem>
                      )} />

                      <FormField control={control} name="carrierId" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-bold text-blue-600 uppercase">Carrier Agent *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-14 border-blue-200 bg-white rounded-xl font-bold"><SelectValue placeholder="Select Carrier" /></SelectTrigger></FormControl>
                                <SelectContent className="rounded-xl">
                                    {carriers?.map(c => <SelectItem key={c.id} value={c.id} className="font-bold py-3 uppercase italic text-black">{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </FormItem>
                      )} />

                      <FormField control={control} name="paymentTerm" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-bold text-slate-400 uppercase">Payment Term</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-14 bg-white rounded-xl font-bold border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent className="rounded-xl">{PaymentTerms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                      )} />
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8 p-10 rounded-[3rem] border-2 border-slate-100 bg-white shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
                      <AutocompleteInput 
                        label="Consignor Entity *" 
                        placeholder="Search consignor registry..." 
                        value={watchedConsignor} 
                        onChange={v => setValue('consignor', v)} 
                        suggestions={consignorRegistry} 
                        onSearchClick={() => setHelpModal({type: 'consignor', title: 'Consignor Handbook', data: consignorRegistry})} 
                        onSelect={(party) => selectPartyNode(party, 'consignor')}
                      />
                      <FormField control={control} name="loadingPoint" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-400 px-1">Lifting City (Point) *</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-400 opacity-20" />
                                    <Input 
                                        {...field} 
                                        disabled
                                        className="h-14 pl-12 rounded-2xl font-black text-slate-900 border-slate-200 bg-slate-100 uppercase cursor-not-allowed" 
                                    />
                                </div>
                            </FormControl>
                        </FormItem>
                      )} />
                  </div>

                  <div className="space-y-8 p-10 rounded-[3rem] border-2 border-slate-100 bg-white shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600" />
                      <AutocompleteInput 
                        label="Consignee / Bill To *" 
                        placeholder="Search buyer registry..." 
                        value={billToParty} 
                        onChange={v => setValue('billToParty', v)} 
                        suggestions={consigneeRegistry} 
                        onSearchClick={() => setHelpModal({type: 'billToParty', title: 'Buyer Registry', data: consigneeRegistry})} 
                        onSelect={(party) => selectPartyNode(party, 'billToParty')}
                      />
                      
                      <div className="flex items-center justify-between px-2">
                        <FormField control={control} name="isSameAsBillTo" render={({ field }) => (
                            <div className="flex items-center gap-3"><Checkbox checked={field.value} onCheckedChange={field.onChange} id="sameAs" className="h-6 w-6 rounded-lg data-[state=checked]:bg-emerald-600 shadow-md" /><label htmlFor="sameAs" className="text-[11px] font-black uppercase text-slate-400 cursor-pointer tracking-widest">Ship to is same as Consignee</label></div>
                        )} />
                      </div>

                      <div className={cn("space-y-8 transition-all duration-500", isSameAsBillTo && "opacity-40 grayscale pointer-events-none")}>
                        <AutocompleteInput 
                            label="Ship To Party *" 
                            placeholder="Search drop node..." 
                            value={watchedShipTo} 
                            onChange={v => setValue('shipToParty', v)} 
                            suggestions={consigneeRegistry} 
                            onSearchClick={() => setHelpModal({type: 'shipToParty', title: 'Ship To Node Registry', data: consigneeRegistry})} 
                            onSelect={(party) => selectPartyNode(party, 'shipToParty')}
                        />
                      </div>

                      <FormField control={control} name="unloadingPoint" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-400 px-1">Destination City *</FormLabel>
                            <FormControl><div className="relative group"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400 opacity-20" /><Input {...field} className="h-14 pl-12 rounded-2xl font-bold bg-slate-50/30 border-slate-200 uppercase" /></div></FormControl>
                        </FormItem>
                      )} />
                  </div>
               </div>

               <section className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                            <Calculator className="h-5 w-5 text-blue-600" /> 3. Manifest Items Registry
                        </h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ invoiceNumber: '', ewaybillNumber: '', units: 1, unitType: 'Package', itemDescription: '', weight: 0.001 })} className="h-10 px-6 gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 bg-white shadow-md hover:bg-blue-50 transition-all rounded-xl">
                            <PlusCircle size={16} /> Add Document row
                        </Button>
                    </div>
                    <div className="rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-2xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-900">
                                <TableRow className="hover:bg-transparent border-none h-14">
                                    <TableHead className="text-white text-[10px] font-black uppercase px-8 w-48">INVOICE #</TableHead>
                                    <TableHead className="text-white text-[10px] font-black uppercase px-4 w-48">E-Waybill No.</TableHead>
                                    <TableHead className="text-white text-[10px] font-black uppercase px-4">Item description</TableHead>
                                    <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center w-36">Units</TableHead>
                                    <TableHead className="text-white text-[10px] font-black uppercase px-8 text-right w-40">Weight (MT)</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400 italic border-none uppercase tracking-widest opacity-40">No detailed items added. Registry will auto-generate from header.</TableCell></TableRow>
                                ) : (
                                    fields.map((field, index) => (
                                        <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-none hover:bg-blue-50/10 transition-colors group">
                                            <TableCell className="px-8"><Input {...form.register(`items.${index}.invoiceNumber`)} className="h-10 rounded-xl font-black uppercase bg-slate-50 border-slate-200" /></TableCell>
                                            <TableCell className="px-4"><Input {...form.register(`items.${index}.ewaybillNumber`)} className="h-10 rounded-xl font-mono text-blue-600 bg-slate-50 border-slate-200 uppercase" /></TableCell>
                                            <TableCell className="px-4"><Input {...form.register(`items.${index}.itemDescription`)} className="h-10 rounded-xl font-bold bg-slate-50 border-slate-200 uppercase" /></TableCell>
                                            <TableCell className="px-4"><Input type="number" {...form.register(`items.${index}.units`)} className="h-10 text-center font-black text-blue-900 bg-transparent border-none shadow-none focus-visible:ring-0" /></TableCell>
                                            <TableCell className="px-8 text-right"><Input type="number" step="0.001" {...form.register(`items.${index}.weight`)} className="h-10 text-right font-black text-blue-900 bg-transparent border-none shadow-none focus-visible:ring-0" /></TableCell>
                                            <TableCell className="pr-6 text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 rounded-lg"><Trash2 size={18}/></Button></TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                            <TableFooter className="bg-slate-50 border-t-2 border-slate-200 h-16">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableCell colSpan={3} className="px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">TOTAL MANIFEST REGISTRY</TableCell>
                                    <TableCell className="text-center font-black text-lg text-blue-900">{totals.units.toFixed(0)}</TableCell>
                                    <TableCell colSpan={1}></TableCell>
                                    <TableCell className="text-right px-8 font-black text-xl text-blue-900 tracking-tighter">
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
        </CardContent>
      </Card>

      {helpModal && (
          <SearchRegistryModal 
            isOpen={!!helpModal}
            onClose={() => setHelpModal(null)}
            title={helpModal.title}
            data={helpModal.data}
            onSelect={handleRegistrySelect}
          />
      )}
    </div>
  );
}
