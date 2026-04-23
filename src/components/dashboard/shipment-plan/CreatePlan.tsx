
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from '@/components/ui/label';
import type { Plant, Shipment, WithId, Party, Carrier, SubUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldCheck, 
  Search, 
  Truck, 
  Calculator, 
  Trash2, 
  Plus, 
  PlusCircle, 
  Loader2, 
  Factory, 
  UserCircle, 
  MapPin, 
  FileText, 
  Lock, 
  Sparkles, 
  X, 
  Save, 
  FileDown, 
  Upload, 
  History, 
  Fingerprint, 
  Weight, 
  ClipboardList 
} from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { collection, query, doc, runTransaction, where, serverTimestamp, orderBy, getDocs, limit } from "firebase/firestore";
import { cn, normalizePlantId, generateRandomTripId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { PaymentTerms, LRUnitTypes } from '@/lib/constants';

const formSchema = z.object({
  originPlantId: z.string().min(1, 'Plant selection is required.'),
  shipmentId: z.string().min(1, 'Sales Order No. is mandatory.').toUpperCase().transform(v => v.trim()),
  consignor: z.string().min(1, 'Consignor is mandatory.'),
  consignorGtin: z.string().optional(),
  consignorAddress: z.string().optional().default(''),
  customerCode: z.string().optional(),
  loadingPoint: z.string().min(1, 'Lifting city is required.'),
  billToParty: z.string().min(1, 'Consignee is mandatory.'),
  billToGtin: z.string().optional(),
  billToCode: z.string().optional(),
  isSameAsBillTo: z.boolean().default(false),
  shipToParty: z.string().min(1, 'Ship To Plant is mandatory.'),
  shipToGtin: z.string().optional(),
  shipToCode: z.string().optional(),
  unloadingPoint: z.string().min(1, 'Destination city is mandatory.'),
  quantity: z.coerce.number().positive('Total quantity must be a positive value.'),
  materialTypeId: z.string().default('MT'),
  lrNumber: z.string().optional().or(z.literal('')).transform(v => v?.toUpperCase().trim()),
  lrDate: z.date().optional().nullable(),
  carrierId: z.string().optional().or(z.literal('')),
  carrierName: z.string().optional().or(z.literal('')),
  paymentTerm: z.enum(PaymentTerms).optional(),
  deliveryAddress: z.string().optional().or(z.literal('')),
  items: z.array(z.object({
    invoiceNumber: z.string().optional().or(z.literal('')),
    ewaybillNumber: z.string().optional(),
    units: z.coerce.number().min(1, "Units required"),
    unitType: z.string().default('Package'),
    itemDescription: z.string().min(1, "Item desc required"),
    hsnSac: z.string().optional(),
  })).optional().default([]),
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
                            onChange={(e) => setSearchTerm(e.target.value)}
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
  
  const profileRef = useMemo(() => (firestore && user) ? doc(firestore, "users", user.email || user.uid) : null, [firestore, user]);
  const { data: operatorProfile } = useDoc<SubUser>(profileRef);

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
        originPlantId: '', shipmentId: '', consignor: '', consignorAddress: '', billToParty: '', shipToParty: '', loadingPoint: '', unloadingPoint: '',
        materialTypeId: 'MT', quantity: 0, lrNumber: '', carrierId: '', carrierName: '', paymentTerm: 'Paid',
        isSameAsBillTo: false, lrDate: null, items: []
    },
  });

  const { setValue, control, handleSubmit, reset } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  
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
    if (carriers && carriers.length > 0) {
        setValue('carrierId', carriers[0].id);
        setValue('carrierName', carriers[0].name, { shouldValidate: true });
    } else {
        setValue('carrierId', '');
        setValue('carrierName', 'NOT REGISTERED', { shouldValidate: true });
    }
  }, [carriers, setValue]);

  useEffect(() => {
    if (originPlantId && authorizedPlants.length > 0) {
        const plant = authorizedPlants.find(p => p.id === originPlantId);
        if (plant) {
            const resolvedCity = (plant.city && plant.city !== 'N/A' ? plant.city : '').toUpperCase();
            setValue('loadingPoint', resolvedCity || plant.name.toUpperCase(), { shouldValidate: true });
            setValue('consignorAddress', plant.address && plant.address !== 'N/A' ? plant.address : (plant.city || plant.name), { shouldValidate: true });
        }
    }
  }, [originPlantId, authorizedPlants, setValue]);

  useEffect(() => {
    if (fields.length === 0) {
        append({ invoiceNumber: '', ewaybillNumber: '', units: 1, unitType: 'Package', itemDescription: '' });
    }
  }, [fields.length, append]);

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

        const dupQuery = query(collection(firestore, `plants/${plantId}/shipments`), where("shipmentId", "==", values.shipmentId), limit(1));
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) {
            toast({ variant: 'destructive', title: "Registry Conflict", description: `Sales Order No ${values.shipmentId} already exists.` });
            hideLoader();
            return;
        }

        await runTransaction(firestore, async (tx) => {
            const shipRef = doc(collection(firestore, `plants/${plantId}/shipments`));

            const manifestItems = values.items && values.items.length > 0 
                ? values.items.filter(i => i.itemDescription || i.invoiceNumber) 
                : [];

            const currentOperator = operatorProfile?.fullName || operatorProfile?.username || user.displayName || user.email?.split('@')[0] || 'System';

            const dataToSave = {
                ...values,
                items: manifestItems,
                currentStatusId: 'pending',
                creationDate: serverTimestamp(),
                assignedQty: 0,
                balanceQty: values.quantity,
                userId: user.uid,
                userName: currentOperator,
                materialTypeId: 'MT'
            };

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
        "Plant ID", "SALES ORDER NO", "Consignor Name", "Consignor GSTIN", "From (City)", "Consignee Name", "Consignee GSTIN", "Ship To Name", "Ship To GSTIN", 
        "Destination Point", "Quantity (MT)", "Invoice Number", "E-Waybill Number", "LR Number", "LR Date", "Payment Term", "Delivery Address", "Item Description", "Units", "Unit Type", 
        "Vehicle Number", "Pilot Name", "Pilot Mobile", "Transporter Name", "Carrier Name"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Order Plan Template");
    XLSX.writeFile(wb, "Order_Plan_Bulk_Template.xlsx");
  };

  const excelDateToJSDate = (serial: number) => {
    if (!serial) return null;
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const uiPlantId = form.getValues('originPlantId');

    if (!file || !firestore || !user) return;

    if (!uiPlantId) {
        toast({ variant: 'destructive', title: "Plant Required", description: "Select Plant Node before upload." });
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
                const foundKey = Object.keys(row).find(k => keys.some(search => k.toLowerCase().replace(/[\s/_-]+/g, '') === search.toLowerCase().replace(/[\s/_-]+/g, '')));
                return foundKey ? row[foundKey]?.toString().trim() : '';
            };

            const getDateVal = (row: any, keys: string[]) => {
                const foundKey = Object.keys(row).find(k => keys.some(search => k.toLowerCase().replace(/[\s/_-]+/g, '') === search.toLowerCase().replace(/[\s/_-]+/g, '')));
                if (!foundKey) return null;
                const raw = row[foundKey];
                if (!raw) return null;
                if (typeof raw === 'number') return excelDateToJSDate(raw);
                if (raw instanceof Date) return raw;
                const d = new Date(raw);
                return isValid(d) ? d : null;
            };

            const orderGroups: Record<string, any> = {};
            const normUiPlantId = normalizePlantId(uiPlantId);
            const currentOperator = operatorProfile?.fullName || operatorProfile?.username || user.displayName || user.email?.split('@')[0] || 'System';

            jsonData.forEach(row => {
                const salesOrderNo = getVal(row, ["SALES ORDER NO", "Sales Order", "SO No", "Order ID"]);
                if (!salesOrderNo) return;

                const groupKey = `${normUiPlantId}_${salesOrderNo}`;
                
                if (!orderGroups[groupKey]) {
                    orderGroups[groupKey] = {
                        originPlantId: uiPlantId,
                        shipmentId: salesOrderNo.toUpperCase(),
                        consignor: getVal(row, ["Consignor Name", "Consignor"]),
                        consignorGtin: getVal(row, ["Consignor GSTIN", "Consignor Gst"]),
                        consignorAddress: getVal(row, ["Consignor Address", "Consignor Site"]),
                        loadingPoint: getVal(row, ["From", "From (City)"]),
                        billToParty: getVal(row, ["Consignee Name", "Consignee"]),
                        billToGtin: getVal(row, ["Consignee Gst"]),
                        shipToParty: getVal(row, ["Ship To Name", "Ship To"]),
                        shipToGtin: getVal(row, ["Ship To Gst"]),
                        unloadingPoint: getVal(row, ["Destination Point", "To"]),
                        materialTypeId: 'MT',
                        quantity: 0,
                        lrNumber: getVal(row, ["LR Number", "LR No"]),
                        lrDate: getDateVal(row, ["LR Date", "Date"]),
                        paymentTerm: getVal(row, ["Payment Term", "Term"]) || 'Paid',
                        deliveryAddress: getVal(row, ["Delivery Address", "Address"]),
                        vehicleNumber: getVal(row, ["Vehicle Number", "Vehicle Registry"]),
                        driverName: getVal(row, ["Pilot Name", "Driver Name"]),
                        driverMobile: getVal(row, ["Pilot Mobile", "Mobile"]),
                        transporterName: getVal(row, ["Transporter Name", "Transporter"]),
                        rawItems: []
                    };
                }
                
                const itemQty = Number(getVal(row, ["Quantity (MT)", "Quantity", "Qty"])) || 0;
                orderGroups[groupKey].quantity += itemQty;
                orderGroups[groupKey].rawItems.push({
                    invoiceNumber: getVal(row, ["Invoice Number", "Invoice No"]) || '',
                    ewaybillNumber: getVal(row, ["E-Waybill Number", "Ewaybill No"]),
                    units: Number(getVal(row, ["Units", "Packages"])) || 1,
                    unitType: getVal(row, ["Unit Type", "UOM"]) || 'Package',
                    itemDescription: getVal(row, ["Item Description", "Description"]) || 'BULK UPLOAD MISSION',
                });
            });

            const groups = Object.values(orderGroups);
            let successCount = 0;

            await runTransaction(firestore, async (tx) => {
                for (const g of groups) {
                    const finalItems = g.rawItems;
                    delete g.rawItems;
                    g.items = finalItems;
                    
                    const shipId = doc(collection(firestore, 'shipments')).id;
                    const shipRef = doc(firestore, `plants/${g.originPlantId}/shipments`, shipId);
                    
                    const hasVehicle = !!g.vehicleNumber;
                    const status = hasVehicle ? 'Assigned' : 'pending';
                    const assignedQty = hasVehicle ? g.quantity : 0;
                    
                    tx.set(shipRef, { 
                        ...g, 
                        assignedQty: assignedQty, 
                        balanceQty: g.quantity - assignedQty, 
                        currentStatusId: status, 
                        creationDate: serverTimestamp(), 
                        userId: user.uid, 
                        userName: currentOperator 
                    });

                    if (hasVehicle) {
                        const tripId = doc(collection(firestore, 'trips')).id;
                        const tripHumanId = generateRandomTripId();
                        const tripData = {
                            ...g,
                            id: tripId,
                            tripId: tripHumanId,
                            shipmentIds: [shipId],
                            assignedQtyInTrip: g.quantity,
                            tripStatus: 'Assigned',
                            currentStatusId: 'assigned',
                            startDate: serverTimestamp(),
                            lastUpdated: serverTimestamp(),
                            userName: currentOperator,
                            userId: user.uid,
                            vehicleType: 'Market Vehicle'
                        };
                        tx.set(doc(firestore, `plants/${g.originPlantId}/trips`, tripId), tripData);
                        tx.set(doc(firestore, 'trips', tripId), tripData);
                    }
                    
                    successCount++;
                }
            });

            toast({ title: 'Bulk Sync Complete', description: `Established ${successCount} mission nodes.` });
            onShipmentCreated({ id: 'bulk' } as any);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: err.message });
        } finally {
            setIsBulkUploading(false);
            hideLoader();
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <Form {...form}>
      <div className="w-full space-y-6 md:space-y-10">
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/80 p-4 md:p-6 border-b">
              <div className="flex flex-col lg:flex-row justify-between items-center gap-6 w-full">
                  <div className="flex items-center gap-4 shrink-0 w-full lg:w-auto">
                      <div className="p-2 md:p-2.5 bg-blue-900 rounded-xl text-white shadow-lg rotate-3 shrink-0"><ShieldCheck className="h-5 w-5 md:h-6 md:w-6" /></div>
                      <CardTitle className="text-lg md:text-xl font-black text-blue-900 tracking-tight uppercase italic leading-none">Order Plan</CardTitle>
                  </div>
                  
                  <div className="flex-1 flex justify-center w-full">
                      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-2 rounded-xl border-2 border-slate-200 shadow-inner w-full md:w-auto">
                          <div className="flex flex-col gap-0.5 w-full md:w-auto">
                              <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-1.5">
                                  <Factory className="h-3 w-3" /> Select Bulk Plant *
                              </Label>
                              <FormField control={control} name="originPlantId" render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                          <SelectTrigger className="h-9 w-full md:w-[180px] bg-slate-50 rounded-lg font-black text-blue-900 border-none shadow-sm focus:ring-blue-900 text-[10px]">
                                              <SelectValue placeholder="Pick plant" />
                                          </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="rounded-xl">
                                          {authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2 uppercase italic text-black text-[10px]">{p.name}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                              )} />
                          </div>
                          <div className="hidden md:block h-8 w-px bg-slate-100 mx-2" />
                          <div className="flex gap-1.5 w-full md:w-auto">
                              <Button variant="outline" onClick={handleExportTemplate} disabled={!originPlantId} className="flex-1 md:flex-none h-9 px-3 rounded-lg font-black border-slate-200 text-blue-900 bg-white hover:bg-slate-50 shadow-sm uppercase text-[9px] tracking-widest gap-1.5 disabled:opacity-30"><FileDown size={14} /><span>Template</span></Button>
                              <Button variant="outline" asChild className={cn("flex-1 md:flex-none h-9 px-3 rounded-lg font-black border-slate-200 text-blue-900 bg-white hover:bg-slate-50 shadow-sm uppercase text-[9px] tracking-widest gap-1.5 cursor-pointer transition-all", (!originPlantId || isBulkUploading) && "opacity-30 cursor-not-allowed pointer-events-none")}>
                                  <label className="flex items-center justify-center gap-1.5">{isBulkUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}<span>Bulk Upload</span><input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} disabled={isBulkUploading || !originPlantId} /></label>
                              </Button>
                          </div>
                      </div>
                  </div>

                  <div className="shrink-0 w-full lg:w-auto">
                      <Button onClick={handleSubmit(handlePost)} className="w-full lg:w-auto h-10 px-10 bg-blue-900 hover:bg-slate-900 rounded-xl font-black shadow-xl transition-all active:scale-95 text-white border-none uppercase text-[10px] tracking-widest">Commit Plan (F8)</Button>
                  </div>
              </div>
          </CardHeader>

          <CardContent className="p-6 md:p-12">
              <form className="space-y-10 md:space-y-16">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Registry Timestamp</label>
                      <div className="h-14 bg-white border rounded-xl flex items-center px-5 font-mono text-blue-900 font-bold shadow-sm">{format(currentTime, 'dd-MM-yyyy HH:mm:ss')}</div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Active Plant Context</label>
                      <div className="h-14 bg-blue-50 border-2 border-blue-100 text-blue-900 rounded-xl flex items-center px-5 font-black uppercase tracking-tighter shadow-sm overflow-hidden truncate">{selectedPlantName || '-- NOT SELECTED --'}</div>
                    </div>

                    <FormField control={control} name="shipmentId" render={({ field }) => (
                      <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-2">SALES ORDER NO. * <Fingerprint className="h-3 w-3 opacity-40"/></FormLabel>
                          <FormControl><Input placeholder="ENTER NO." {...field} className="h-14 rounded-xl font-black text-blue-900 uppercase shadow-inner border-slate-200 focus-visible:ring-blue-900" /></FormControl>
                          <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={control} name="quantity" render={({ field }) => (
                      <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">TOTAL QUANTITY (MT) *</FormLabel>
                          <FormControl><div className="relative group"><Weight className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-400 opacity-20" /><Input type="number" step="0.001" {...field} className="h-14 pl-12 rounded-xl font-black text-xl text-blue-900 border-slate-200 shadow-inner focus-visible:ring-blue-900" /></div></FormControl>
                          <FormMessage />
                      </FormItem>
                    )} />
                 </div>

                 <div className="p-6 md:p-10 rounded-[2.5rem] border-2 border-dashed border-blue-100 bg-blue-50/10 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-blue-100 pb-4 gap-4">
                      <div className="flex items-center gap-3 text-blue-900 font-black text-sm uppercase tracking-tighter"><Truck size={20}/> 2. Optional LR Registry Section</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                        <FormField control={control} name="lrNumber" render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold text-slate-400 uppercase">LR Number</FormLabel><FormControl><Input {...field} placeholder="ENTER LR" className="h-14 bg-white rounded-xl font-black uppercase tracking-widest border-slate-200 shadow-inner" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="lrDate" render={({ field }) => (
                          <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-bold text-slate-400 uppercase">LR Date</FormLabel><DatePicker date={field.value || undefined} setDate={field.onChange} className="h-14 bg-white" /><FormMessage /></FormItem>
                        )} />
                        <FormField control={control} name="carrierName" render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Carrier Agent</FormLabel>
                              <FormControl>
                                  <div className="relative group">
                                      <Input 
                                          readOnly 
                                          {...field} 
                                          placeholder="Awaiting Registry" 
                                          className="h-14 bg-slate-100 rounded-xl font-black uppercase text-blue-900 border-none shadow-inner pl-10" 
                                      />
                                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                  </div>
                              </FormControl>
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
                        <AutocompleteInput label="Consignor Entity *" placeholder="Search registry..." value={watchedConsignor} onChange={v => setValue('consignor', v)} suggestions={consignorRegistry} onSearchClick={() => setHelpModal({type: 'consignor', title: 'Consignor Handbook', data: consignorRegistry})} onSelect={(p) => selectPartyNode(p, 'consignor')} />
                        <FormField control={control} name="loadingPoint" render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold uppercase text-slate-400 px-1">From *</FormLabel><FormControl><div className="relative group"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-400 opacity-20" /><Input {...field} disabled className="h-14 pl-12 rounded-2xl font-black text-slate-900 border-slate-200 bg-slate-100 uppercase cursor-not-allowed" /></div></FormControl></FormItem>
                        )} />
                    </div>

                    <div className="space-y-8 p-6 md:p-10 rounded-[3rem] border-2 border-slate-100 bg-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600" />
                        <AutocompleteInput label="Consignee / Bill To *" placeholder="Search registry..." value={billToParty} onChange={v => setValue('billToParty', v)} suggestions={consigneeRegistry} onSearchClick={() => setHelpModal({type: 'billToParty', title: 'Buyer Registry', data: consigneeRegistry})} onSelect={(p) => selectPartyNode(p, 'billToParty')} />
                        <FormField control={control} name="isSameAsBillTo" render={({ field }) => (
                            <div className="flex items-center gap-3 px-2"><Checkbox checked={field.value} onCheckedChange={field.onChange} id="sameAs" className="h-6 w-6 rounded-lg data-[state=checked]:bg-emerald-600 shadow-md" /><label htmlFor="sameAs" className="text-[11px] font-black uppercase text-slate-400 cursor-pointer tracking-widest">Ship to is same as Consignee</label></div>
                        )} />
                        <div className={cn("space-y-8 transition-all duration-500", isSameAsBillTo && "opacity-40 grayscale pointer-events-none")}>
                          <AutocompleteInput label="Ship To Party *" placeholder="Search drop plant..." value={watchedShipTo} onChange={v => setValue('shipToParty', v)} suggestions={consigneeRegistry} onSearchClick={() => setHelpModal({type: 'shipToParty', title: 'Ship To Plant Registry', data: consigneeRegistry})} onSelect={(p) => selectPartyNode(p, 'shipToParty')} />
                        </div>
                        <FormField control={control} name="unloadingPoint" render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] font-bold uppercase text-slate-400 px-1">Destination City *</FormLabel><FormControl><div className="relative group"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400 opacity-20" /><Input {...field} className="h-14 pl-12 rounded-2xl font-bold bg-slate-50/30 border-slate-200 uppercase" /></div></FormControl></FormItem>
                        )} />
                    </div>
                 </div>

                 <section className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-4">
                          <h3 className="text-[11px] md:text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3"><Calculator className="h-5 w-5 text-blue-600" /> 3. Manifest Items Registry</h3>
                          <Button type="button" variant="outline" size="sm" onClick={() => append({ invoiceNumber: '', ewaybillNumber: '', units: 1, unitType: 'Package', itemDescription: '' })} className="h-10 px-6 gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 bg-white shadow-md hover:bg-blue-50 transition-all rounded-xl w-full sm:w-auto"><Plus size={16} /> Add Row</Button>
                      </div>
                      <div className="rounded-[2rem] border-2 border-slate-200 bg-white shadow-2xl overflow-hidden">
                          <div className="overflow-x-auto">
                              <Table className="min-w-[1200px]">
                                <TableHeader className="bg-slate-900">
                                    <TableRow className="hover:bg-transparent border-none h-14">
                                        <TableHead className="text-white text-[10px] font-black uppercase px-8 w-48">Invoice</TableHead>
                                        <TableHead className="text-white text-[10px] font-black uppercase px-4 w-48">E-Waybill No.</TableHead>
                                        <TableHead className="text-white text-[10px] font-black uppercase px-4">Item description</TableHead>
                                        <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center w-56">Units / UOM</TableHead>
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

                 <section className="space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1"><MapPin className="h-4 w-4 text-blue-600"/> 4. Delivery Address Registry</h3>
                      <FormField control={control} name="deliveryAddress" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea rows={3} placeholder="Provide verified delivery address particulars..." className="resize-none bg-white border-slate-200 rounded-[2rem] md:rounded-3xl p-6 md:p-8 font-bold shadow-sm focus-visible:ring-blue-900 transition-all text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                 </section>
              </form>
          </CardContent>
        </Card>
        {helpModal && <SearchRegistryModal isOpen={!!helpModal} onClose={() => setHelpModal(null)} title={helpModal.title} data={helpModal.data} onSelect={handleRegistrySelect} />}
      </div>
    </Form>
  );
}
