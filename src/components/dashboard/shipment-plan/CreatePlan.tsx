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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/date-picker';
import { Textarea } from '@/components/ui/textarea';
import type { Plant, Shipment, WithId, SubUser, Party, MasterQtyType, Carrier } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ShieldCheck, 
  Factory, 
  AlertTriangle, 
  User, 
  MapPin, 
  Search, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  Globe, 
  AlertCircle, 
  Sparkles, 
  Save, 
  Calculator, 
  Package, 
  FileDown, 
  Upload, 
  FileText,
  Truck,
  UserCircle,
  PlusCircle,
  Plus,
  History,
  ListTree,
  Trash2,
  Phone,
  Layers
} from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, doc, runTransaction, where, getDocs, limit, serverTimestamp, orderBy, getDoc, writeBatch } from "firebase/firestore";
import { cn, normalizePlantId, formatSequenceId, generateRandomTripId, incrementSerial } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import * as XLSX from 'xlsx';
import { PaymentTerms } from '@/lib/constants';

interface CreatePlanProps {
  onShipmentCreated: (shipment: WithId<Shipment>) => void;
}

const itemSchema = z.object({
    invoiceNumber: z.string().min(1, "Doc ref required."),
    ewaybillNumber: z.string().optional(),
    itemDescription: z.string().min(1, "Item description is mandatory."),
    units: z.coerce.number().min(1, "Qty required."),
    weight: z.coerce.number().optional().default(0),
});

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
  quantity: z.coerce.number().optional().default(0),
  materialTypeId: z.string().min(1, 'UOM is required.'),
  lrNumber: z.string().optional().or(z.literal('')),
  lrDate: z.date().optional().nullable(),
  carrierId: z.string().optional().or(z.literal('')),
  paymentTerm: z.enum(PaymentTerms).optional(),
  items: z.array(itemSchema).optional().default([]),
  deliveryAddress: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
    if (data.materialTypeId !== 'FTL') {
        if (!data.quantity || data.quantity <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Numeric quantity is mandatory for selected UOM.',
                path: ['quantity']
            });
        }
    }
    if (data.lrNumber?.trim()) {
        if (!data.lrDate) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'LR Date mandatory.', path: ['lrDate'] });
        }
        if (!data.carrierId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Carrier mandatory.', path: ['carrierId'] });
        }
        if (!data.paymentTerm) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Payment Term mandatory.', path: ['paymentTerm'] });
        }
        if (!data.items || data.items.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Item Description manifest required for LR.', path: ['items'] });
        }
        if (!data.deliveryAddress?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Delivery Address required for LR.', path: ['deliveryAddress'] });
        }
    }
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

function AutocompleteInput({ 
    value, 
    onChange, 
    onSearchClick, 
    suggestions, 
    placeholder, 
    label, 
    error,
    disabled = false,
    onSelect
}: { 
    value: string; 
    onChange: (val: string) => void; 
    onSearchClick: () => void; 
    suggestions: Party[]; 
    placeholder: string; 
    label: string;
    error?: string;
    disabled?: boolean;
    onSelect?: (party: Party) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filteredSuggestions = useMemo(() => {
        if (!value) return [];
        return suggestions.filter(s => s.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
    }, [value, suggestions]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (filteredSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
            setFocusedIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (isOpen && focusedIndex >= 0) {
                const selected = filteredSuggestions[focusedIndex];
                if (onSelect) {
                    onSelect(selected);
                } else {
                    onChange(selected.name);
                }
                setIsOpen(false);
                setFocusedIndex(-1);
                if (e.key === 'Enter') e.preventDefault();
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <FormItem className="relative" ref={wrapperRef}>
            <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 flex items-center gap-2">
                {label}
            </FormLabel>
            <div className="flex gap-3">
                <FormControl>
                    <div className="relative flex-1">
                        <Input 
                            placeholder={placeholder}
                            value={value}
                            onChange={(e) => {
                                onChange(e.target.value);
                                setIsOpen(true);
                                setFocusedIndex(-1);
                            }}
                            onFocus={() => setIsOpen(true)}
                            onKeyDown={handleKeyDown}
                            className="h-14 rounded-2xl font-black text-slate-900 border-slate-200 bg-slate-50/30 focus-visible:ring-blue-900"
                            disabled={disabled}
                        />
                        {isOpen && filteredSuggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {filteredSuggestions.map((suggestion, idx) => (
                                    <div 
                                        key={suggestion.id}
                                        onClick={() => {
                                            if (onSelect) onSelect(suggestion);
                                            else onChange(suggestion.name);
                                            setIsOpen(false);
                                        }}
                                        className={cn(
                                            "px-5 py-3 cursor-pointer transition-colors border-b last:border-0",
                                            focusedIndex === idx ? "bg-blue-900 text-white" : "hover:bg-blue-50 text-slate-700"
                                        )}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black uppercase tracking-tight">{suggestion.name}</span>
                                            <span className={cn("text-[9px] font-bold uppercase opacity-60", focusedIndex === idx ? "text-blue-100" : "text-slate-400")}>
                                                {suggestion.city} | {suggestion.gstin || 'No GSTIN'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </FormControl>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    disabled={disabled}
                    className="h-14 w-14 rounded-2xl shrink-0 shadow-lg hover:bg-blue-50 transition-all active:scale-95" 
                    onClick={onSearchClick}
                >
                    <Search className="h-6 w-6 text-blue-600" />
                </Button>
            </div>
            {error && <p className="text-[10px] font-bold text-red-600 mt-1">{error}</p>}
        </FormItem>
    );
}

export default function CreatePlan({ onShipmentCreated }: CreatePlanProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [helpModal, setHelpModal] = useState<{ type: 'consignor' | 'billToParty' | 'shipToParty'; title: string; data: any[] } | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: allPlants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

  const carriersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "carriers")) : null, 
    [firestore]
  );
  const { data: carriers } = useCollection<Carrier>(carriersQuery);

  const qtyTypesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "material_types")) : null, 
    [firestore]
  );
  const { data: qtyTypes } = useCollection<MasterQtyType>(qtyTypesQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        originPlantId: '', 
        consignor: '', 
        consignorGtin: '',
        loadingPoint: '', 
        billToParty: '', 
        billToGtin: '',
        isSameAsBillTo: false, 
        shipToParty: '', 
        shipToGtin: '',
        unloadingPoint: '', 
        quantity: 0, 
        materialTypeId: 'MT', 
        lrNumber: '',
        lrDate: null,
        carrierId: '',
        paymentTerm: 'Paid',
        items: [],
        deliveryAddress: '',
    },
  });

  const { watch, setValue, control, handleSubmit, register, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  
  const isSameAsBillTo = watch('isSameAsBillTo');
  const consignor = watch('consignor');
  const billToParty = watch('billToParty');
  const billToGtin = watch('billToGtin');
  const shipToParty = watch('shipToParty');
  const originPlantId = watch('originPlantId');
  const carrierId = watch('carrierId');
  const materialTypeId = watch('materialTypeId');
  const quantity = watch('quantity');
  const lrNumberValue = watch('lrNumber');

  const showLrSection = useMemo(() => lrNumberValue && lrNumberValue.trim() !== '', [lrNumberValue]);

  useEffect(() => {
    if (materialTypeId === 'FTL') {
        setValue('quantity', 0);
    }
  }, [materialTypeId, setValue]);

  const fetchAuthorizedPlants = useCallback(async () => {
    if (!firestore || !user || isLoadingPlants || !allPlants) return;
    setIsAuthLoading(true);
    try {
        const lastIdentity = localStorage.getItem('slmc_last_identity');
        const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
        
        let userDocSnap = null;
        const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            userDocSnap = qSnap.docs[0];
        } else {
            const uidSnap = await getDoc(doc(firestore, "users", user.uid));
            if (uidSnap.exists()) userDocSnap = uidSnap;
        }

        let authIds: string[] = [];
        if (userDocSnap) {
            const userData = userDocSnap.data() as SubUser;
            const isRoot = userData.jobRole === 'System Administrator' || userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
            authIds = isRoot ? allPlants.map(p => p.id) : (userData.plantIds || []);
        } else if (isAdminSession) {
            authIds = allPlants.map(p => p.id);
        }

        const filtered = allPlants.filter(p => authIds.includes(p.id));
        setAuthorizedPlants(filtered);
        if (filtered.length > 0 && !originPlantId) setValue('originPlantId', filtered[0].id);
    } catch (e) {
        console.error("Authorized Plants Sync Error:", e);
    } finally {
        setIsAuthLoading(false);
    }
  }, [firestore, user, allPlants, isLoadingPlants, isAdminSession, setValue, originPlantId]);

  useEffect(() => { fetchAuthorizedPlants(); }, [fetchAuthorizedPlants]);

  const partiesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, 
    [firestore]
  );
  const { data: parties } = useCollection<Party>(partiesQuery);

  const consignorRegistry = useMemo(() => {
    return (parties || []).filter(p => p.type === 'Consignor');
  }, [parties]);

  const consigneeRegistry = useMemo(() => {
    return (parties || []).filter(p => p.type === 'Consignee & Ship to');
  }, [parties]);

  const availableConsignors = useMemo(() => {
    if (!parties || !originPlantId) return [];
    const targetPlantId = normalizePlantId(originPlantId).toLowerCase();
    return (parties || []).filter(p => 
        p.type === 'Consignor' && 
        !p.isDeleted &&
        normalizePlantId(p.plantId).toLowerCase() === targetPlantId
    );
  }, [parties, originPlantId]);

  const availableCarriers = useMemo(() => {
    if (!carriers || !originPlantId) return [];
    const targetPlantId = normalizePlantId(originPlantId).toLowerCase();
    return carriers.filter(c => normalizePlantId(c.plantId).toLowerCase() === targetPlantId);
  }, [carriers, originPlantId]);

  const selectedCarrier = useMemo(() => {
    if (!carrierId || !carriers) return null;
    return carriers.find(c => c.id === carrierId);
  }, [carrierId, carriers]);

  useEffect(() => {
    if (availableCarriers.length > 0) {
      setValue('carrierId', availableCarriers[0].id);
    } else {
      setValue('carrierId', '');
    }
  }, [availableCarriers, setValue]);

  const handleConsignorSelect = useCallback((p: Party) => {
    setValue('consignor', p.name, { shouldValidate: true });
    setValue('consignorGtin', p.gstin || '', { shouldValidate: true });
    if (p.address && p.address !== 'N/A') {
        setValue('loadingPoint', p.address, { shouldValidate: true });
    } else if (p.city && p.city !== 'N/A') {
        setValue('loadingPoint', p.city, { shouldValidate: true });
    }
  }, [setValue]);

  const handleShipToSelect = useCallback((p: Party) => {
    setValue('shipToParty', p.name, { shouldValidate: true });
    setValue('shipToGtin', p.gstin || '', { shouldValidate: true });
    if (p.address && p.address !== 'N/A') {
        setValue('unloadingPoint', p.address, { shouldValidate: true });
        if (lrNumberValue && lrNumberValue.trim()) {
            setValue('deliveryAddress', p.address, { shouldValidate: true });
        }
    } else if (p.city && p.city !== 'N/A') {
        setValue('unloadingPoint', p.city, { shouldValidate: true });
        if (lrNumberValue && lrNumberValue.trim()) {
            setValue('deliveryAddress', p.city, { shouldValidate: true });
        }
    }
  }, [setValue, lrNumberValue]);

  useEffect(() => {
    if (originPlantId && authorizedPlants.length > 0) {
        const plant = authorizedPlants.find(p => p.id === originPlantId);
        if (plant?.address && plant.address !== 'N/A' && !watch('consignor')) {
            setValue('loadingPoint', plant.address, { shouldValidate: true });
        }
    }
  }, [originPlantId, authorizedPlants, setValue, watch]);

  useEffect(() => {
    if (availableConsignors.length === 1) {
        handleConsignorSelect(availableConsignors[0]);
    }
  }, [availableConsignors, handleConsignorSelect]);

  const handleRegistrySelect = useCallback((party: Party) => {
    if (!helpModal) return;
    const type = helpModal.type;
    
    if (type === 'consignor') {
        handleConsignorSelect(party);
    } else if (type === 'billToParty') {
        setValue('billToParty', party.name, { shouldValidate: true });
        setValue('billToGtin', party.gstin || '', { shouldValidate: true });
        if (isSameAsBillTo) handleShipToSelect(party);
    } else if (type === 'shipToParty') {
        handleShipToSelect(party);
    }

    setHelpModal(null);
  }, [helpModal, handleConsignorSelect, handleShipToSelect, isSameAsBillTo, setValue]);

  useEffect(() => { 
    if (isSameAsBillTo) {
        setValue('shipToParty', billToParty); 
        setValue('shipToGtin', billToGtin);
        const party = consigneeRegistry.find(p => p.name === billToParty);
        if (party) {
            handleShipToSelect(party);
        }
    }
  }, [isSameAsBillTo, billToParty, billToGtin, setValue, consigneeRegistry, handleShipToSelect]);

  const parseRegistryDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    const str = String(val).trim();
    const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const year = parseInt(match[3], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
    }
    const dFallback = new Date(val);
    return isNaN(dFallback.getTime()) ? new Date() : dFallback;
  };

  const handlePost = async (values: FormValues) => {
    if (!firestore || !user) return;

    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const counterRef = doc(firestore, "counters", "shipments");
            const counterSnap = await transaction.get(counterRef);
            const currentCount = counterSnap.exists() ? counterSnap.data().count : 0;
            const newCount = currentCount + 1;
            const shipmentId = formatSequenceId("S", newCount);
            
            const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);

            transaction.set(counterRef, { count: newCount }, { merge: true });

            const plantId = normalizePlantId(values.originPlantId);
            const shipmentDocId = `ship-${Date.now()}`;
            const shipRef = doc(firestore, `plants/${plantId}/shipments`, shipmentDocId);

            const groupedInvoices = new Map<string, any>();
            values.items.forEach(item => {
                const invKey = item.invoiceNumber.trim().toUpperCase();
                if (!groupedInvoices.has(invKey)) {
                    groupedInvoices.set(invKey, {
                        invoiceNumber: item.invoiceNumber,
                        ewaybillNumber: item.ewaybillNumber || '',
                        units: 0,
                        weight: 0,
                        descriptions: new Set<string>()
                    });
                }
                const g = groupedInvoices.get(invKey);
                g.units += Number(item.units) || 0;
                g.weight += Number(item.weight) || 0;
                g.descriptions.add(item.itemDescription);
            });

            const finalItemsManifest = Array.from(groupedInvoices.values()).map(g => ({
                invoiceNumber: g.invoiceNumber,
                ewaybillNumber: g.ewaybillNumber,
                units: g.units,
                weight: g.weight,
                itemDescription: groupDescriptions(Array.from(g.descriptions))
            }));

            // REGISTRY RULE: Orders created here are always 'pending' until a vehicle is assigned via Open Order node.
            const docData: any = {
                ...values,
                items: finalItemsManifest,
                shipmentId,
                currentStatusId: 'pending', 
                creationDate: serverTimestamp(),
                assignedQty: 0, 
                balanceQty: values.quantity,
                userName: currentName,
                userId: user.uid,
            };

            transaction.set(shipRef, docData);
        });

        toast({ title: 'Plan Committed', description: `Sale Order committed to lifting node registry.` });
        form.reset();
        setShowConfirmModal(false);
        onShipmentCreated({ id: 'new' } as any);
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Commit Failed", description: e.message });
    } finally {
        hideLoader();
    }
  };

  const handleTemplateDownload = () => {
    const headers = [
        "Plant ID", "Consignor", "Loading Point (Address)", "Consignee", "Ship To", 
        "Unloading Point (Address)", "Quantity", "UOM", "Invoice Number", 
        "E-Waybill Number", "Item Description", "Package", "Delivery Address",
        "LR Number", "LR Date (DD/MM/YYYY)", "Carrier ID", "Payment Term"
    ];
    const sample = [
        "1426", "Consignor Name", "C-17, UPSIDC SOUTH SIDE, G.T. ROAD, GHAZIABAD", "Consignee Name", "Ship To Name",
        "Dest Address", "25", "MT", "INV-001", "EWB-001", "Salt Bags", "500", "Warehouse 14, Plot 22, Mumbai",
        "LR-1001", "20/05/2024", "carrier-123", "Paid"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Order Plan Template");
    XLSX.writeFile(wb, "SIKKA_OrderPlan_Bulk_Template.xlsx");
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
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

            if (jsonData.length === 0) throw new Error("Manifest is empty.");

            const batch = writeBatch(firestore);
            const counterRef = doc(firestore, "counters", "shipments");
            const counterSnap = await getDoc(counterRef);
            let currentCount = counterSnap.exists() ? counterSnap.data().count : 0;

            const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
            
            const registryGroups = new Map<string, any>();
            const validationErrors: string[] = [];

            jsonData.forEach((row, i) => {
                const rowNum = i + 2;
                const lrNo = row["LR Number"]?.toString().trim() || "NA";
                const invNo = row["Invoice Number"]?.toString().trim();
                const plantId = row["Plant ID"]?.toString().trim();
                
                if (!invNo || !plantId) {
                    validationErrors.push(`Row ${rowNum}: Missing Invoice or Plant ID.`);
                    return;
                }

                const lrKey = lrNo.toUpperCase();
                const invKey = invNo.toUpperCase();
                
                const headerData = {
                    originPlantId: normalizePlantId(plantId),
                    consignor: row["Consignor"]?.toString().trim(),
                    loadingPoint: row["Loading Point (Address)"]?.toString().trim(),
                    billToParty: row["Consignee"]?.toString().trim(),
                    shipToParty: row["Ship To"]?.toString().trim() || row["Consignee"]?.toString().trim(),
                    unloadingPoint: row["Unloading Point (Address)"]?.toString().trim(),
                    deliveryAddress: row["Delivery Address"]?.toString().trim() || row["Unloading Point (Address)"]?.toString().trim(),
                    carrierId: row["Carrier ID"]?.toString().trim(),
                    lrDate: row["LR Date (DD/MM/YYYY)"] ? parseRegistryDate(row["LR Date (DD/MM/YYYY)"]) : null,
                    paymentTerm: row["Payment Term"] || 'Paid'
                };

                if (registryGroups.has(invKey)) {
                    // Logic: Group items by Invoice Number
                } else {
                    registryGroups.set(invKey, { header: headerData, lrNo: lrNo === "NA" ? "" : lrNo, items: new Map() });
                }

                const group = registryGroups.get(invKey);
                const desc = row["Item Description"]?.toString().trim() || 'GENERAL CARGO';
                const units = Number(row["Package"] || row["Total Units"] || 0);
                const weight = Number(row["Quantity"]) || 0;

                group.items.set(`${desc}-${units}`, {
                    invoiceNumber: invKey,
                    ewaybillNumber: row["E-Waybill Number"]?.toString().trim() || '',
                    itemDescription: desc,
                    units,
                    weight
                });
            });

            if (validationErrors.length > 0) {
                toast({ variant: 'destructive', title: "Registry Conflict", description: validationErrors[0] });
                hideLoader();
                setIsBulkUploading(false);
                return;
            }

            let successCount = 0;
            for (const [invNo, group] of Array.from(registryGroups.entries())) {
                const { header, lrNo, items } = group;
                
                currentCount++;
                const shipmentId = formatSequenceId("S", currentCount);
                const shipmentDocId = `ship-${Date.now()}-${successCount}`;
                const shipRef = doc(firestore, `plants/${header.originPlantId}/shipments`, shipmentDocId);

                const finalItemsManifest = Array.from(items.values());
                const totalWeight = finalItemsManifest.reduce((s, i: any) => s + i.weight, 0);

                const shipmentData = {
                    ...header,
                    shipmentId,
                    currentStatusId: 'pending', // ALWAYS PENDING AT CREATION
                    creationDate: new Date(),
                    assignedQty: 0,
                    balanceQty: totalWeight,
                    quantity: totalWeight,
                    materialTypeId: 'MT',
                    userName: currentName,
                    userId: user.uid,
                    lrNumber: lrNo,
                    items: finalItemsManifest
                };

                batch.set(shipRef, shipmentData);
                successCount++;
            }

            if (successCount > 0) {
                batch.set(counterRef, { count: currentCount }, { merge: true });
                await batch.commit();
                toast({ title: "Bulk Upload Complete", description: `${successCount} order(s) established in registry.` });
                onShipmentCreated({ id: 'new' } as any);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Bulk Error", description: error.message });
        } finally {
            hideLoader();
            setIsBulkUploading(false);
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSearchHelpClick = (type: 'consignor' | 'billToParty' | 'shipToParty') => {
    const registryData = type === 'consignor' ? consignorRegistry : consigneeRegistry;
    const registryTitle = type === 'consignor' ? 'Select Consignor Node' : 'Select Party Node';
    setHelpModal({ type, title: registryTitle, data: registryData });
  };

  const isReadOnlyPlant = !isAdminSession && authorizedPlants.length === 1;

  return (
    <div className="w-full space-y-10">
        <div className="flex justify-end gap-4 px-2">
            <Button variant="outline" className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest border-slate-200" onClick={handleTemplateDownload}>
                <FileDown className="h-4 w-4 mr-2" /> Download Bulk Template
            </Button>
            <Button variant="outline" asChild className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest border-slate-200 cursor-pointer">
                <label>
                    <Upload className="h-4 w-4 mr-2" /> Bulk Registry Upload
                    <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleBulkUpload} disabled={isBulkUploading} />
                </label>
            </Button>
        </div>

        <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2.5rem]">
            <CardHeader className="bg-slate-50 border-b pb-8 px-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-4xl font-black text-blue-900 tracking-tight leading-none italic uppercase">Create Order</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Lifting Node Registry Partition</CardDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-10 bg-white/50 backdrop-blur-md px-10 py-4 rounded-[2rem] border-2 border-slate-100 shadow-xl shadow-blue-900/5">
                        <div className="flex flex-col gap-1 text-center">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Aggregate Quantity</span>
                            <span className="text-xl font-black text-blue-900 leading-none">
                                {materialTypeId === 'FTL' ? 'FTL' : `${quantity || '0.00'} ${materialTypeId}`}
                            </span>
                        </div>
                        <Separator orientation="vertical" className="h-10 bg-slate-200" />
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Status Node</span>
                            <Badge className="bg-orange-50 text-orange-700 font-black uppercase text-[10px] border-none shadow-sm h-6 px-4 justify-center">PENDING</Badge>
                        </div>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="pt-12 px-10 pb-12 space-y-16">
                <Form {...form}>
                <form className="space-y-16">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start bg-slate-50/50 p-10 rounded-[3rem] border border-slate-100 shadow-inner">
                        <div className="md:col-span-3 space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Registry Timestamp</label>
                            <div className="h-14 px-6 flex items-center bg-white rounded-2xl border border-slate-200 text-blue-900 font-black text-lg italic font-mono shadow-sm">
                                {format(currentDate, 'dd-MM-yyyy HH:mm:ss')}
                            </div>
                        </div>

                        <div className="md:col-span-3">
                            <FormField control={control} name="originPlantId" render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Plant Node Registry *</FormLabel>
                                {isReadOnlyPlant ? (
                                    <div className="h-14 px-6 flex items-center bg-white border border-slate-200 rounded-2xl font-black text-blue-900 uppercase text-sm shadow-sm">
                                        <ShieldCheck className="h-4 w-4 mr-2 text-blue-600" /> {authorizedPlants[0]?.name || 'Authorized Node'}
                                    </div>
                                ) : (
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isAuthLoading}>
                                        <FormControl><SelectTrigger className="bg-white h-14 rounded-2xl font-black text-blue-900 shadow-sm border-slate-200"><SelectValue placeholder={isAuthLoading ? "Syncing..." : "Select Plant"} /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic">{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}
                                </FormItem>
                            )} />
                        </div>

                        <div className="md:col-span-3">
                            <FormField control={control} name="materialTypeId" render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">UOM (Unit of Measurement) *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-14 bg-white rounded-2xl font-black text-slate-700 shadow-sm border-slate-200">
                                            <SelectValue placeholder="Select UOM" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl">
                                        {qtyTypes && qtyTypes.length > 0 ? (
                                            qtyTypes.map((t, i) => <SelectItem key={t.id || i} value={t.name} className="font-bold py-3 uppercase italic">{t.name}</SelectItem>)
                                        ) : (
                                            <>
                                                <SelectItem key="MT" value="MT" className="font-bold py-3 uppercase italic">Metric Ton (MT)</SelectItem>
                                                <SelectItem key="BAG" value="BAG" className="font-bold py-3 uppercase italic">Bag</SelectItem>
                                                <SelectItem key="BOX" value="BOX" className="font-bold py-3 uppercase italic">Box</SelectItem>
                                                <SelectItem key="DRUM" value="DRUM" className="font-bold py-3 uppercase italic">Drum</SelectItem>
                                                <SelectItem key="PCS" value="PCS" className="font-bold py-3 uppercase italic">PCS</SelectItem>
                                                <SelectItem key="PALLET" value="PALLET" className="font-bold py-3 uppercase italic">Pallet</SelectItem>
                                                <SelectItem key="FTL" value="FTL" className="font-bold py-3 uppercase italic">Full Truck Load (FTL)</SelectItem>
                                                <SelectItem key="Others" value="Others" className="font-bold py-3 uppercase italic">Others</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                                </FormItem>
                            )} />
                        </div>

                        <div className="md:col-span-3">
                            <FormField control={control} name="quantity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={cn("text-[10px] font-black uppercase tracking-[0.2em] px-1", materialTypeId === 'FTL' ? "text-slate-200" : "text-slate-400")}>
                                        Total Quantity {materialTypeId !== 'FTL' && '*'}
                                    </FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            {...field} 
                                            value={materialTypeId === 'FTL' ? '' : (field.value ?? '')} 
                                            disabled={materialTypeId === 'FTL'}
                                            className={cn(
                                                "h-14 rounded-2xl font-black text-blue-900 text-2xl shadow-inner focus-visible:ring-blue-900",
                                                materialTypeId === 'FTL' ? "bg-slate-100 border-slate-100" : "bg-white border-blue-900/20"
                                            )} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </div>

                    <div className="p-10 rounded-[3rem] border-2 border-blue-100 bg-white shadow-xl space-y-10">
                        <div className="flex items-center gap-3 border-b pb-4">
                            <FileText className="h-6 w-6 text-blue-600" />
                            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-700">Optional LR Registry Section</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                            <FormField control={control} name="lrNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">LR Number</FormLabel>
                                    <FormControl><Input placeholder="Enter LR Number" {...field} className="h-12 rounded-xl font-black text-blue-900 uppercase" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            {showLrSection && (
                                <>
                                    <FormField control={control} name="lrDate" render={({ field }) => (
                                        <FormItem className="flex flex-col animate-in fade-in slide-in-from-top-2 duration-300">
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">LR Date *</FormLabel>
                                            <FormControl><DatePicker date={field.value || undefined} setDate={(d) => field.onChange(d || null)} className="h-12 border-blue-200" placeholder="Select LR Date" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="carrierId" render={({ field }) => (
                                        <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">Carrier Registry *</FormLabel>
                                            <FormControl>
                                              <div className="h-12 flex items-center justify-start rounded-md border border-blue-200 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800">
                                                { selectedCarrier?.name || "-" }
                                              </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="paymentTerm" render={({ field }) => (
                                        <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600">Payment Term *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12 border-blue-200 font-bold"><SelectValue placeholder="Pick Term" /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">
                                                    {PaymentTerms.map(term => <SelectItem key={term} value={term} className="font-bold py-3">{term}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-10 p-10 rounded-[3.5rem] border border-slate-100 bg-white shadow-2xl relative overflow-hidden group/con">
                            <div className="absolute top-0 left-0 w-2 h-full bg-blue-900 transition-all duration-500 group-hover/con:w-3" />
                            
                            <AutocompleteInput 
                                label="Consignor Entity *"
                                placeholder="Type name or search handbook..."
                                value={consignor}
                                onChange={(val) => setValue('consignor', val, { shouldValidate: true })}
                                suggestions={consignorRegistry}
                                onSearchClick={() => handleSearchHelpClick('consignor')}
                                onSelect={handleConsignorSelect}
                                error={errors.consignor?.message}
                            />

                            <FormField control={control} name="loadingPoint" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 px-1 flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5" /> Lifting Address (FROM) *
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative group/map">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within/map:text-blue-600 transition-colors" />
                                            <Input {...field} placeholder="Enter verified physical lifting city..." className="pl-12 h-14 rounded-2xl font-bold border-slate-200 bg-white focus-visible:ring-blue-900 shadow-sm" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <div className="space-y-10 p-10 rounded-[3.5rem] border border-slate-100 bg-white shadow-2xl relative overflow-hidden group/cnee">
                            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-600 transition-all duration-500 group-hover/cnee:w-3" />
                            
                            <div className="space-y-8">
                                <div className="space-y-2">
                                    <AutocompleteInput 
                                        label="Consignee / Bill To *"
                                        placeholder="Type name or search buyer registry..."
                                        value={billToParty}
                                        onChange={(val) => setValue('billToParty', val, { shouldValidate: true })}
                                        suggestions={consigneeRegistry}
                                        onSearchClick={() => handleSearchHelpClick('billToParty')}
                                        onSelect={(p) => {
                                            setValue('billToParty', p.name, { shouldValidate: true });
                                            setValue('billToGtin', p.gstin || '', { shouldValidate: true });
                                            if (isSameAsBillTo) handleShipToSelect(p);
                                        }}
                                        error={errors.billToParty?.message}
                                    />
                                    <div className="flex justify-end">
                                        <FormField control={control} name="isSameAsBillTo" render={({ field }) => (
                                            <FormItem className="flex items-center space-x-4 space-y-0 bg-white p-2 px-4 rounded-xl border border-slate-100 shadow-sm w-fit">
                                                <FormControl><Checkbox id="same_as_consignee" checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 data-[state=checked]:bg-blue-900 data-[state=checked]:border-blue-900" /></FormControl>
                                                <FormLabel htmlFor="same_as_consignee" className="text-[10px] font-black uppercase cursor-pointer text-slate-400 tracking-widest !mt-0">Same as Consignee</FormLabel>
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>

                                <AutocompleteInput 
                                    label="Ship To Node *"
                                    placeholder="Target node..."
                                    value={shipToParty || ''}
                                    onChange={(val) => setValue('shipToParty', val, { shouldValidate: true })}
                                    suggestions={consigneeRegistry}
                                    onSearchClick={() => handleSearchHelpClick('shipToParty')}
                                    onSelect={handleShipToSelect}
                                    disabled={isSameAsBillTo}
                                    error={errors.shipToParty?.message}
                                />

                                <FormField control={control} name="unloadingPoint" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[11px] font-black uppercase tracking-widest text-blue-600 px-1 flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5" /> Destination (TO) *
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative group/map">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within/map:text-blue-600 transition-colors" />
                                                <Input {...field} placeholder="Final mission delivery city node..." className="pl-12 h-14 rounded-2xl font-bold border-slate-200 bg-white focus-visible:ring-blue-900 shadow-sm" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </div>

                    <section className={cn("space-y-6 transition-all duration-500", !showLrSection && "opacity-30 grayscale pointer-events-none")}>
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1">
                                <ListTree className="h-4 w-4 text-blue-600" /> 3. Item Description Manifest
                            </h3>
                            {showLrSection && (
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 bg-white hover:bg-blue-50 shadow-sm" 
                                    onClick={() => append({ invoiceNumber: '', ewaybillNumber: '', itemDescription: '', units: 1, weight: 0 })}
                                >
                                    <PlusCircle className="h-3.5 w-3.5" /> Add Row
                                </Button>
                            )}
                        </div>
                        
                        <div className="rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-900">
                                    <TableRow className="hover:bg-transparent border-none h-12">
                                        <TableHead className="text-[10px] font-black uppercase text-white px-6 w-40">Invoice Number *</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 w-40">E-Waybill No</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4">Item Description *</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 text-center">Package *</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-white px-6 text-right w-32">Weight (Opt)</TableHead>
                                        <TableHead className="w-16"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">No entries node. Click "Add Row" to initialize manifest.</TableCell></TableRow>
                                    ) : (
                                        fields.map((field, idx) => (
                                            <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-0 hover:bg-blue-50/10 group transition-colors">
                                                <TableCell className="px-6 py-2">
                                                    <FormField name={`items.${idx}.invoiceNumber`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input placeholder="Invoice #" className="h-10 border-slate-200 font-bold focus-visible:ring-blue-900" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <FormField name={`items.${idx}.ewaybillNumber`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input placeholder="EWB-" className="h-10 bg-transparent border-none shadow-none focus-visible:ring-0" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <FormField name={`items.${idx}.itemDescription`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input placeholder="Cargo particulars" className="h-10 border-slate-200 font-medium" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-4 py-2">
                                                    <FormField name={`items.${idx}.units`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input type="number" className="h-10 text-center font-black text-blue-900 bg-transparent border-none shadow-none focus-visible:ring-0" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-6 py-2">
                                                    <FormField name={`items.${idx}.weight`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input type="number" step="0.001" className="h-10 text-right font-black text-blue-900 bg-transparent border-none shadow-none focus-visible:ring-0" {...itm} /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="pr-6 py-2 text-right">
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-200 group-hover:text-red-600" onClick={() => remove(idx)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </section>

                    {showLrSection && (
                        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1">
                                <MapPin className="h-4 w-4 text-blue-600" /> 4. Delivery Address Registry
                            </h3>
                            <FormField control={control} name="deliveryAddress" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative group">
                                            <Textarea 
                                                rows={3} 
                                                placeholder="Provide verified physical delivery address for LR document..." 
                                                className="resize-none bg-white border-slate-200 rounded-3xl p-8 font-bold shadow-sm focus-visible:ring-blue-900 transition-all" 
                                                {...field} 
                                            />
                                            <MapPin className="absolute top-8 right-8 h-6 w-6 text-slate-200 group-focus-within:text-blue-600 transition-colors" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </section>
                    )}

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-slate-100">
                        <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 flex items-start gap-5 shadow-sm max-w-2xl">
                            <AlertCircle className="h-8 w-8 text-blue-600 shrink-0" />
                            <div className="space-y-1">
                                <p className="text-xs font-black text-blue-900 uppercase">Commitment Protocol Active</p>
                                <p className="text-[10px] font-bold text-blue-700 leading-normal uppercase">
                                    Submitting this form will create a persistent Sale Order node in the lifting registry. Verify all party nodes and city identifiers before final commit.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-6">
                            <Button type="button" variant="ghost" onClick={() => form.reset()} className="px-12 h-16 font-black uppercase text-[11px] tracking-[0.2em] text-slate-400 hover:text-red-600 transition-all rounded-[1.5rem]">Discard Draft</Button>
                            <Button type="button" onClick={handleSubmit(() => setShowConfirmModal(true))} className="bg-blue-900 hover:bg-black text-white px-20 h-16 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl shadow-blue-900/30 transition-all active:scale-95 border-none">
                                COMMIT MISSION PLAN (F8)
                            </Button>
                        </div>
                    </div>
                </form>
                </Form>
            </CardContent>
        </Card>

        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
            <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-3xl bg-white rounded-[2rem]">
                <DialogHeader className="p-8 bg-blue-900 text-white flex flex-row items-center gap-5 space-y-0">
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                        <ShieldCheck className="h-8 w-8 text-blue-400" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Registry Commitment</DialogTitle>
                        <DialogDescription className="text-blue-200 font-bold uppercase text-[9px] mt-1 tracking-widest">Authorized Identity Handshake Required</DialogDescription>
                    </div>
                </DialogHeader>
                <div className="p-10 space-y-8">
                    <div className="space-y-4">
                        <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                            "You are about to establish a permanent mission node in the Logistics Registry for 
                            **{materialTypeId === 'FTL' ? 'FTL' : `${quantity} ${materialTypeId}`}** cargo."
                        </p>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div className="flex flex-col"><span className="text-[8px] font-black uppercase text-slate-400">Node</span> <span className="text-xs font-black text-blue-900 uppercase">{form.watch('originPlantId')}</span></div>
                            <div className="flex flex-col"><span className="text-[8px] font-black uppercase text-slate-400">Operator</span> <span className="text-xs font-black text-slate-900 uppercase">{user?.displayName || user?.email?.split('@')[0]}</span></div>
                        </div>
                    </div>
                    <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 shadow-inner">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                            Authorized Data Capture: Verify weights and city nodes.
                        </p>
                    </div>
                </div>
                <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                    <Button variant="ghost" onClick={() => setShowConfirmModal(false)} className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-8 h-11">Back</Button>
                    <Button onClick={handleSubmit(handlePost)} className="bg-blue-900 hover:bg-black text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 border-none transition-all active:scale-95">Confirm Commit</Button>
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
                <div className="p-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                        <Input 
                            placeholder="Type to filter registry handbook..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-12 h-12 rounded-2xl bg-slate-50 border-slate-200 font-bold focus-visible:ring-blue-900 shadow-inner"
                            autoFocus
                        />
                    </div>
                    <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-xl bg-white">
                        <ScrollArea className="h-[40vh]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-slate-100 z-10 border-b">
                                    <TableRow className="hover:bg-transparent h-12">
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest px-6">Registry Node Name</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest px-4 text-center">GSTIN</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-48 text-center text-slate-400 italic uppercase tracking-[0.2em] opacity-40">No nodes matching search.</TableCell></TableRow>
                                    ) : (
                                        filtered.map(item => (
                                            <TableRow key={item.id} className="cursor-pointer h-14 transition-all group hover:bg-blue-50 border-b last:border-0" onClick={() => onSelect(item)}>
                                                <TableCell className="px-6 font-black text-slate-800 uppercase text-xs tracking-tight">{item.name}</TableCell>
                                                <TableCell className="px-4 text-center font-mono text-[10px] font-bold text-slate-500">{item.gstin || '--'}</TableCell>
                                                <TableCell className="px-6 text-right">
                                                    <Button variant="ghost" size="sm" className="h-8 rounded-lg text-blue-600 font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Select Node</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Close Window</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}