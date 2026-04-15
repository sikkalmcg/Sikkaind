
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isValid } from 'date-fns';
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
import { Label } from '@/components/ui/label';
import type { Plant, Shipment, WithId, SubUser, Party, MasterQtyType, Carrier } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Search, Truck, Calculator, Trash2, Plus, PlusCircle, Loader2, Factory, UserCircle, MapPin, FileText, Lock, Sparkles, X, Save, FileDown, Upload, History, AlertCircle } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, runTransaction, where, serverTimestamp, orderBy, getDoc, getDocs, limit, Timestamp } from "firebase/firestore";
import { cn, normalizePlantId, formatSequenceId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { PaymentTerms } from '@/lib/constants';

const formSchema = z.object({
  originPlantId: z.string().min(1, 'Plant selection is required.'),
  consignor: z.string().min(1, 'Consignor is mandatory.'),
  consignorGtin: z.string().optional(),
  consignorAddress: z.string().optional().default(''),
  customerCode: z.string().optional(),
  loadingPoint: z.string().min(1, 'Lifting city is required.'),
  billToParty: z.string().min(1, 'Consignee is mandatory.'),
  billToGtin: z.string().optional(),
  isSameAsBillTo: z.boolean().default(false),
  shipToParty: z.string().min(1, 'Ship To Plant is mandatory.'),
  shipToGtin: z.string().optional(),
  unloadingPoint: z.string().min(1, 'Destination city is mandatory.'),
  quantity: z.coerce.number(),
  materialTypeId: z.string().min(1, 'UOM is required.'),
  lrNumber: z.string().optional().or(z.literal('')).transform(v => v?.toUpperCase().trim()),
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
    hsnSac: z.string().optional(),
  })).optional().default([]),
  carrierName: z.string().optional(),
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
                        <div className="absolute z-50 w-full mt-2 bg-white border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                            {filteredSuggestions.map((suggestion) => (
                                <div key={suggestion.id} onMouseDown={() => { if(onSelect) onSelect(suggestion); else onChange(suggestion.name); setIsOpen(false); }} className="px-5 py-3 cursor-pointer hover:bg-blue-50 border-b last:border-0 group">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase tracking-tight text-slate-700 group-hover:text-blue-900">{suggestion.name}</span>
                                        <span className="text-[9px] font-bold uppercase text-slate-400">{suggestion.city} | {suggestion.customerCode || 'NO CODE'}</span>
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
            item.customerCode?.toLowerCase().includes(s) || 
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
                        Select a verified Plant from the mission registry
                    </DialogDescription>
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
                                        <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-400 italic">No Plants matching search.</TableCell></TableRow>
                                    ) : (
                                        filtered.map(item => (
                                            <TableRow key={item.id} className="cursor-pointer h-12 transition-all group hover:bg-blue-50" onClick={() => onSelect(item)}>
                                                <TableCell className="px-4 font-black text-slate-800 uppercase text-xs">{item.name}</TableCell>
                                                <TableCell className="px-4 text-center font-mono text-[10px] text-blue-700 font-black">{item.customerCode || '--'}</TableCell>
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
  const [lastUsedLr, setLastUsedLr] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        originPlantId: '', consignor: '', consignorAddress: '', billToParty: '', shipToParty: '', loadingPoint: '', unloadingPoint: '',
        materialTypeId: 'METRIC TON', quantity: 0, lrNumber: '', carrierId: '', paymentTerm: 'Paid',
        isSameAsBillTo: false, lrDate: null, items: [], carrierName: ''
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
    }), { units: 0 });
  }, [watchedItems]);

  const isFtl = useMemo(() => watchedUom?.toUpperCase() === 'FTL', [watchedUom]);

  useEffect(() => {
    if (isFtl) {
        setValue('quantity', 0, { shouldValidate: true });
    }
  }, [isFtl, setValue]);

  const { data: qtyTypes } = useCollection<MasterQtyType>(useMemoFirebase(() => firestore ? query(collection(firestore, "material_types")) : null, [firestore]));
  const { data: parties } = useCollection<Party>(useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, [firestore]));
  
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

  const selectedPlantName = useMemo(() => {
    return authorizedPlants.find(p => p.id === originPlantId)?.name || '';
  }, [originPlantId, authorizedPlants]);

  useEffect(() => {
    if (!firestore || !originPlantId) {
        setLastUsedLr(null);
        return;
    }
    const fetchLastLr = async () => {
        try {
            const pId = normalizePlantId(originPlantId);
            const q = query(
                collection(firestore, `plants/${pId}/shipments`),
                orderBy("creationDate", "desc"),
                limit(10) 
            );
            const snap = await getDocs(q);
            const lastShipmentWithLr = snap.docs.find(d => d.data().lrNumber && d.data().lrNumber !== '');
            if (lastShipmentWithLr) {
                setLastUsedLr(lastShipmentWithLr.data().lrNumber);
            } else {
                setLastUsedLr(null);
            }
        } catch (e) {
            console.error("LR Registry Fetch Failure:", e);
        }
    };
    fetchLastLr();
  }, [originPlantId, firestore]);

  useEffect(() => {
    if (originPlantId && authorizedPlants.length > 0) {
        const plant = authorizedPlants.find(p => p.id === originPlantId);
        if (plant) {
            const addrParts = (plant.address || '').split(',').map(p => p.trim()).filter(Boolean);
            let resolvedCity = plant.city && plant.city !== 'N/A' ? plant.city : '';
            
            if (!resolvedCity && addrParts.length > 0) {
                if ((/\d/.test(addrParts[0]) || addrParts[0].length < 5) && addrParts.length > 1) {
                    resolvedCity = addrParts[1];
                } else {
                    resolvedCity = addrParts[0];
                }
            }
            
            const cityNode = (resolvedCity || plant.name).toUpperCase();
            setValue('loadingPoint', cityNode, { shouldValidate: true });
            
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
        if(party.address) setValue('consignorAddress', party.address, { shouldValidate: true });
        if(party.city) setValue('loadingPoint', party.city.toUpperCase(), { shouldValidate: true });
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
        const plantId = normalizePlantId(values.originPlantId);

        if (values.lrNumber && values.lrNumber !== '') {
            const dupQuery = query(
                collection(firestore, `plants/${plantId}/shipments`),
                where("lrNumber", "==", values.lrNumber.trim().toUpperCase()),
                limit(1)
            );
            const dupSnap = await getDocs(dupQuery);
            if (!dupSnap.empty) {
                toast({ 
                    variant: 'destructive', 
                    title: "Registry Conflict", 
                    description: `LR Number ${values.lrNumber} already exists in plant ${plantId} registry.` 
                });
                hideLoader();
                return;
            }
        }

        await runTransaction(firestore, async (tx) => {
            const countSnap = await tx.get(doc(firestore, "counters", "shipments"));
            const newCount = (countSnap.exists() ? countSnap.data().count : 0) + 1;
            const shipmentId = formatSequenceId("S", newCount);
            const shipRef = doc(collection(firestore, `plants/${plantId}/shipments`));

            let manifestItems = values.items || [];
            if (manifestItems.length === 0) {
                manifestItems = [{
                    invoiceNumber: 'INITIAL-PLAN',
                    ewaybillNumber: '',
                    units: isFtl ? 1 : 0,
                    unitType: 'Package',
                    itemDescription: 'AUTO-GEN MISSION PAYLOAD',
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
        "Plant ID", "Consignor Name", "Consignor GSTIN", "From (City)", "Consignee Name", "Consignee GSTIN", "Ship To Name", "Ship To Party Code", "Ship To GSTIN", 
        "Destination Point", "UOM", "Quantity", "Invoice Number", "E-Waybill Number", "LR Number", "LR Date", "Payment Term", "Delivery Address", "Item Description", "Units", "Carrier Name"
    ];
    const sample = [
        ["1426", "TATA CHEMICALS", "27AABCU9567L1Z5", "MUMBAI", "BIGMART RETAIL", "07AABCD1234E1Z3", "BIGMART WH", "CUST001", "07AABCD1234E1Z3", "GHAZIABAD", "MT", "25.000", "INV-9988", "EWB-123456", "LR123", "01-04-2026", "Paid", "C-17 UPSIDC GZB", "TATA SALT 50KG BAGS", "500", "Sikka LMC"]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Order Plan Template");
    XLSX.writeFile(wb, "Order_Plan_Bulk_Template.xlsx");
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const uiPlantId = form.getValues('originPlantId');

    if (!file || !firestore || !user) return;

    if (!uiPlantId) {
        toast({ variant: 'destructive', title: "Lifting Plant Required", description: "Please select a Plant Node in the UI before performing bulk upload. This determines the carrier registry handshake." });
        event.target.value = '';
        return;
    }

    setIsBulkUploading(true);
    showLoader();
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

            const getVal = (row: any, keys: string[]) => {
                const foundKey = Object.keys(row).find(k => keys.some(search => k.toLowerCase().replace(/\s+/g, '') === search.toLowerCase().replace(/\s+/g, '')));
                return foundKey ? row[foundKey]?.toString().trim() : '';
            };

            const getDateVal = (row: any, keys: string[]) => {
                const foundKey = Object.keys(row).find(k => keys.some(search => k.toLowerCase().replace(/\s+/g, '') === search.toLowerCase().replace(/\s+/g, '')));
                if (!foundKey) return null;
                const raw = row[foundKey];
                if (!raw) return null;
                if (raw instanceof Date) return raw;
                if (typeof raw === 'number') {
                    return new Date(Math.round((raw - 25569) * 86400 * 1000));
                }
                const d = new Date(raw);
                return isValid(d) ? d : null;
            };

            const orderGroups: Record<string, any> = {};

            // CARRIER HANDSHAKE LOGIC Plant
            let autoCarrierId = '';
            let autoCarrierName = '';
            const normUiPlantId = normalizePlantId(uiPlantId);

            if (normUiPlantId === '1426' || normUiPlantId === 'ID20') {
                autoCarrierId = 'ID20';
                autoCarrierName = 'SIKKA LMC (DELHI)';
            } else if (normUiPlantId === '1214' || normUiPlantId === 'ID23') {
                autoCarrierId = 'ID21';
                autoCarrierName = 'SIKKA LMC (GHAZIABAD)';
            }

            jsonData.forEach(row => {
                const consignee = getVal(row, ["Consignee Name", "Consignee"]);
                const lr = getVal(row, ["LR Number", "LR No"]);
                
                if (!consignee) return;

                const groupKey = `${uiPlantId}_${consignee}_${lr}`;
                
                if (!orderGroups[groupKey]) {
                    const termRaw = getVal(row, ["Payment Term", "Term"]) || 'Paid';
                    const term = termRaw.toLowerCase().includes('to pay') ? 'To Pay' : 'Paid';

                    // REGISTRY HANDSHAKE: Resolve Ship To Details from Code
                    const shipToCode = getVal(row, ["Ship To Party Code", "Ship To Code", "Code"])?.toUpperCase();
                    let resolvedShipToName = getVal(row, ["Ship To Name", "Ship To"]);
                    let resolvedShipToGtin = getVal(row, ["Ship To GSTIN", "Ship To Gst"]);
                    let resolvedDeliveryAddress = getVal(row, ["Delivery Address", "Address"]);
                    let resolvedDestination = getVal(row, ["Destination Point", "To"]);

                    if (shipToCode) {
                        const partyMatch = activeParties.find(p => p.customerCode?.toUpperCase() === shipToCode);
                        if (partyMatch) {
                            resolvedShipToName = partyMatch.name;
                            resolvedShipToGtin = partyMatch.gstin || '';
                            resolvedDeliveryAddress = partyMatch.address || partyMatch.city || '';
                            resolvedDestination = partyMatch.city || '';
                        }
                    }

                    orderGroups[groupKey] = {
                        originPlantId: uiPlantId,
                        consignor: getVal(row, ["Consignor Name", "Consignor"]),
                        consignorGtin: getVal(row, ["Consignor GSTIN", "Consignor Gst"]),
                        consignorAddress: getVal(row, ["Consignor Address", "Consignor Site"]),
                        loadingPoint: getVal(row, ["From", "From (City)", "Lifting Plant"]),
                        billToParty: consignee,
                        billToGtin: getVal(row, ["Consignee GSTIN", "Consignee Gst"]),
                        shipToParty: resolvedShipToName,
                        shipToGtin: resolvedShipToGtin,
                        unloadingPoint: resolvedDestination,
                        materialTypeId: (getVal(row, ["UOM", "Unit"]) || 'METRIC TON').toUpperCase(),
                        quantity: 0,
                        lrNumber: lr,
                        lrDate: getDateVal(row, ["LR Date", "LRDate", "Date"]),
                        paymentTerm: term,
                        deliveryAddress: resolvedDeliveryAddress,
                        carrierId: autoCarrierId,
                        carrierName: autoCarrierName || getVal(row, ["Carrier Name", "Carrier"]),
                        rawItems: []
                    };
                }
                
                const itemQty = Number(getVal(row, ["Quantity", "Qty"])) || 0;
                orderGroups[groupKey].quantity += itemQty;
                orderGroups[groupKey].rawItems.push({
                    invoiceNumber: getVal(row, ["Invoice Number", "Invoice No"]) || 'NA',
                    ewaybillNumber: getVal(row, ["E-Waybill Number", "Ewaybill No", "EWB No"]),
                    units: Number(getVal(row, ["Units", "Packages"])) || 1,
                    unitType: 'Package',
                    itemDescription: getVal(row, ["Item Description", "Description"]) || 'BULK UPLOAD MISSION',
                });
            });

            const groups = Object.values(orderGroups);
            let successCount = 0;

            await runTransaction(firestore, async (tx) => {
                const countSnap = await tx.get(doc(firestore, "counters", "shipments"));
                let currentCount = countSnap.exists() ? countSnap.data().count : 0;

                for (const g of groups) {
                    let finalItems = g.rawItems;
                    if (g.rawItems.length > 4) {
                        const aggMap: Record<string, any> = {};
                        g.rawItems.forEach((item: any) => {
                            const descRaw = item.itemDescription.toUpperCase().trim();
                            const words = descRaw.split(/\s+/);
                            const firstWord = words[0] || '';
                            const categories = ['SALT', 'TEA', 'RICE', 'SUGAR', 'DAL', 'OIL', 'FLOUR', 'ATTA', 'MAIDA', 'BESAN', 'MASALA', 'SPICE', 'CEMENT', 'CHEMICAL', 'FERTILIZER', 'IRON', 'STEEL', 'METAL'];
                            const category = words.find(w => categories.includes(w)) || words[1] || '';
                            const descKey = `${firstWord} ${category}`.trim();

                            if (!aggMap[descKey]) {
                                aggMap[descKey] = { 
                                    ...item, 
                                    itemDescription: descKey,
                                    invoiceNumbers: new Set([item.invoiceNumber]),
                                    ewaybillNumbers: new Set([item.ewaybillNumber].filter(Boolean))
                                };
                            } else {
                                aggMap[descKey].units += item.units;
                                aggMap[descKey].invoiceNumbers.add(item.invoiceNumber);
                                if (item.ewaybillNumber) aggMap[descKey].ewaybillNumbers.add(item.ewaybillNumber);
                            }
                        });
                        finalItems = Object.values(aggMap).map(agg => {
                            const { invoiceNumbers, ewaybillNumbers, ...rest } = agg;
                            return {
                                ...rest,
                                invoiceNumber: Array.from(invoiceNumbers).join(', '),
                                ewaybillNumber: Array.from(ewaybillNumbers).join(', ')
                            };
                        });
                    }
                    delete g.rawItems;
                    g.items = finalItems;

                    currentCount++;
                    const shipmentId = formatSequenceId("S", currentCount);
                    const shipRef = doc(collection(firestore, `plants/${g.originPlantId}/shipments`));

                    const dataToSave = {
                        ...g,
                        shipmentId,
                        assignedQty: 0,
                        balanceQty: g.quantity,
                        currentStatusId: 'pending',
                        creationDate: serverTimestamp(),
                        userId: user.uid
                    };

                    tx.set(shipRef, dataToSave);
                    successCount++;
                }

                tx.set(doc(firestore, "counters", "shipments"), { count: currentCount }, { merge: true });
            });

            toast({ title: 'Bulk Sync Complete', description: `Established ${successCount} mission plants for Plant ${uiPlantId}.` });
            onShipmentCreated({ id: 'bulk' } as any);
        } catch (err: any) {
            console.error("Bulk upload error:", err);
            toast({ variant: 'destructive', title: 'Upload Failed', description: err.message || 'Registry sync error.' });
        } finally {
            setIsBulkUploading(false);
            hideLoader();
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="w-full space-y-6 md:space-y-10">
      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/80 p-6 md:p-10 border-b">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="p-3 md:p-4 bg-blue-900 rounded-2xl text-white shadow-xl rotate-3 shrink-0"><ShieldCheck className="h-6 w-6 md:h-8 md:w-8" /></div>
                    <div>
                        <CardTitle className="text-xl md:text-3xl font-black text-blue-900 tracking-tight uppercase italic leading-none text-wrap">Order Plan Registry</CardTitle>
                        <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Secure Mission Asset Deployment Terminal</CardDescription>
                    </div>
                </div>
                
                <div className="flex flex-col items-center gap-4 md:gap-6 w-full md:w-auto">
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-3 rounded-2xl border-2 border-slate-200 shadow-inner w-full md:w-auto">
                        <div className="flex flex-col gap-1 w-full md:w-auto">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                                <Factory className="h-3 w-3" /> Select Bulk Plant *
                            </Label>
                            <FormField control={control} name="originPlantId" render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="h-11 w-full md:w-[220px] bg-slate-50 rounded-xl font-black text-blue-900 border-none shadow-sm focus:ring-blue-900">
                                        <SelectValue placeholder="Pick plant" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic text-black">{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div className="hidden md:block h-10 w-px bg-slate-100" />
                        <div className="flex gap-2 w-full md:w-auto">
                            <Button 
                                variant="outline" 
                                onClick={handleExportTemplate} 
                                disabled={!originPlantId}
                                className="flex-1 md:flex-none h-11 px-4 md:px-6 rounded-xl font-black border-slate-200 text-blue-900 bg-white hover:bg-slate-50 shadow-sm uppercase text-[10px] tracking-widest gap-2 disabled:opacity-30"
                            >
                                <FileDown size={16} /> Template
                            </Button>
                            <Button 
                                variant="outline" 
                                asChild 
                                disabled={!originPlantId || isBulkUploading}
                                className={cn(
                                    "flex-1 md:flex-none h-11 px-4 md:px-6 rounded-xl font-black border-slate-200 text-blue-900 bg-white hover:bg-slate-50 shadow-sm uppercase text-[10px] tracking-widest gap-2 cursor-pointer transition-all",
                                    !originPlantId && "opacity-30 cursor-not-allowed pointer-events-none"
                                )}
                            >
                                <label>
                                    {isBulkUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                                    Bulk Upload
                                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} disabled={isBulkUploading || !originPlantId} />
                                </label>
                            </Button>
                        </div>
                    </div>

                    <Button onClick={handleSubmit(handlePost)} className="w-full md:w-auto h-14 px-12 md:px-20 bg-blue-900 hover:bg-slate-900 rounded-2xl font-black shadow-xl transition-all active:scale-95 text-white border-none uppercase text-xs tracking-widest">
                        Commit Plan (F8)
                    </Button>
                </div>
            </div>
        </CardHeader>

        <CardContent className="p-6 md:p-12">
          <Form {...form}>
            <form className="space-y-10 md:space-y-16">
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Registry Timestamp</label>
                    <div className="h-14 bg-white border rounded-xl flex items-center px-5 font-mono text-blue-900 font-bold shadow-sm">{format(currentTime, 'dd-MM-yyyy HH:mm:ss')}</div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Active Plant Context</label>
                    <div className="h-14 bg-blue-50 border-2 border-blue-100 text-blue-900 rounded-xl flex items-center px-5 font-black uppercase tracking-tighter shadow-sm overflow-hidden truncate">
                        {selectedPlantName || '-- NOT SELECTED --'}
                    </div>
                  </div>

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

               <div className="p-6 md:p-10 rounded-[2.5rem] border-2 border-dashed border-blue-100 bg-blue-50/10 space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-blue-100 pb-4 gap-4">
                    <div className="flex items-center gap-3 text-blue-900 font-black text-sm uppercase tracking-tighter"><Truck size={20}/> 2. Optional LR Registry Section</div>
                    {lastUsedLr && (
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-blue-200 rounded-full shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
                            <History size={12} className="text-blue-600" />
                            <span className="text-[9px] font-black uppercase text-slate-400">Previous LR Plant:</span>
                            <span className="text-[10px] font-black text-blue-900 font-mono">{lastUsedLr}</span>
                        </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                      <FormField control={control} name="lrNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-bold text-slate-400 uppercase">LR Number</FormLabel>
                            <FormControl>
                                <Input 
                                    {...field} 
                                    placeholder="ENTER LR" 
                                    className="h-14 bg-white rounded-xl font-black uppercase tracking-widest border-slate-200 shadow-inner focus-visible:ring-blue-900" 
                                />
                            </FormControl>
                        </FormItem>
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

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12">
                  <div className="space-y-8 p-6 md:p-10 rounded-[3rem] border-2 border-slate-100 bg-white shadow-xl relative overflow-hidden">
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
                      <FormField control={control} name="consignorAddress" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-slate-400 px-1">From *</FormLabel>
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

                  <div className="space-y-8 p-6 md:p-10 rounded-[3rem] border-2 border-slate-100 bg-white shadow-xl relative overflow-hidden">
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
                            placeholder="Search drop plant..." 
                            value={watchedShipTo} 
                            onChange={v => setValue('shipToParty', v)} 
                            suggestions={consigneeRegistry} 
                            onSearchClick={() => setHelpModal({type: 'shipToParty', title: 'Ship To Plant Registry', data: consigneeRegistry})} 
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-4">
                        <h3 className="text-[11px] md:text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                            <Calculator className="h-5 w-5 text-blue-600" /> 3. Manifest Items Registry
                        </h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ invoiceNumber: '', ewaybillNumber: '', units: 1, unitType: 'Package', itemDescription: '' })} className="h-10 px-6 gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 bg-white shadow-md hover:bg-blue-50 transition-all rounded-xl w-full sm:w-auto">
                            <Plus size={16} /> Add Document row
                        </Button>
                    </div>
                    <div className="rounded-[2rem] md:rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table className="min-w-[1000px]">
                                <TableHeader className="bg-slate-900">
                                    <TableRow className="hover:bg-transparent border-none h-14">
                                        <TableHead className="text-white text-[10px] font-black uppercase px-8 w-48">INVOICE #</TableHead>
                                        <TableHead className="text-white text-[10px] font-black uppercase px-4 w-48">E-Waybill No.</TableHead>
                                        <TableHead className="text-white text-[10px] font-black uppercase px-4">Item description</TableHead>
                                        <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center w-36">Units</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-400 italic border-none uppercase tracking-widest opacity-40">No detailed items added. Registry will auto-generate from header.</TableCell></TableRow>
                                    ) : (
                                        fields.map((field, index) => (
                                            <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-none hover:bg-blue-50/10 transition-colors group">
                                                <TableCell className="px-8"><Input {...form.register(`items.${index}.invoiceNumber`)} className="h-10 rounded-xl font-black uppercase bg-slate-50 border-slate-200" /></TableCell>
                                                <TableCell className="px-4"><Input {...form.register(`items.${index}.ewaybillNumber`)} className="h-10 rounded-xl font-mono text-blue-600 bg-slate-50 border-slate-200 uppercase" /></TableCell>
                                                <TableCell className="px-4"><Input {...form.register(`items.${index}.itemDescription`)} className="h-10 rounded-xl font-bold bg-slate-50 border-slate-200 uppercase" /></TableCell>
                                                <TableCell className="px-4"><Input type="number" {...form.register(`items.${index}.units`)} className="h-10 text-center font-black text-blue-900 bg-transparent border-none shadow-none focus-visible:ring-0" /></TableCell>
                                                <TableCell className="pr-6 text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 rounded-lg"><Trash2 size={18}/></Button></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                                <TableFooter className="bg-slate-50 border-t-2 border-slate-200 h-16">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableCell colSpan={3} className="px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">TOTAL MANIFEST REGISTRY</TableCell>
                                        <TableCell className="text-center font-black text-lg text-blue-900">{totals.units.toFixed(0)}</TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </div>
               </section>

               <section className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                        <MapPin className="h-4 w-4 text-blue-600"/> 4. Delivery Address Registry
                    </h3>
                    <FormField control={control} name="deliveryAddress" render={({ field }) => (
                        <FormItem><FormControl><Textarea rows={3} placeholder="Provide verified delivery address particulars..." className="resize-none bg-white border-slate-200 rounded-[2rem] md:rounded-3xl p-6 md:p-8 font-bold shadow-sm focus-visible:ring-blue-900 transition-all text-sm" {...field} /></FormControl><FormMessage /></FormItem>
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
