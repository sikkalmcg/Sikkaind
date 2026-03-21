
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { useToast } from '@/hooks/use-toast';
import type { Plant, WithId, Party, SubUser, MasterDataItem, MasterInvoiceType, MasterChargeType, MasterUnitType, Invoice, MasterQtyType } from '@/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
    X, 
    ShieldCheck, 
    Calculator, 
    Trash2, 
    ListTree, 
    Loader2, 
    PlusCircle, 
    MapPin, 
    CheckCircle2, 
    Factory, 
    ClipboardPaste,
    Search,
    Maximize2,
    UserCircle,
    AlertCircle,
    Plus,
    History,
    Sparkles,
    Lock
} from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { numberToWords } from '@/lib/number-to-words';
import { DatePicker } from '@/components/date-picker';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, normalizePlantId, incrementSerial } from '@/lib/utils';
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, getDoc, doc, orderBy, getDocs, limit, runTransaction } from 'firebase/firestore';
import { useLoading } from '@/context/LoadingContext';
import { subMonths, format, startOfDay } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const formSchema = z.object({
  plantId: z.string().min(1, "Plant ID is required"),
  invoiceType: z.string().min(1, "Invoice Type is required"),
  chargeType: z.string().min(1, "Charge type is required"),
  invoiceNo: z.string().min(1, "Invoice Number is required"),
  invoiceDate: z.date({ required_error: "Invoice Date is required" }),
  billMonth: z.string().min(1, "Bill Month is required"),
  irn: z.string().optional().or(z.literal('')),
  ackNo: z.string().optional().or(z.literal('')).refine(v => !v || /^\d+$/.test(v), "ACK number must be numeric."),
  ackDate: z.date().optional(),
  qrCodeDataUrl: z.string().optional().or(z.literal('')),
  consignorId: z.string().min(1, "Consignor is required"),
  consigneeId: z.string().min(1, "Consignee is required"),
  isShipToSame: z.boolean().default(false),
  shipToId: z.string().optional(),
  otaApplicable: z.boolean().default(false),
  otaDate: z.date().optional(),
  docCustomValues: z.record(z.any()).optional(),
  items: z.array(z.object({
    masterItemId: z.string().min(1, "Material selection is required"),
    itemDescription: z.string().default(''),
    hsnSac: z.string().default(''),
    qty: z.coerce.number().min(0.001, "Quantity required"),
    uom: z.string().default(''),
    rate: z.coerce.number().min(0.01, "Rate required"),
    amount: z.coerce.number().default(0),
    itemCustomValues: z.record(z.any()).optional(),
  })).min(1, "At least one row is required."),
  gstRate: z.coerce.number().default(0),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateInvoicePage() {
    const router = useRouter();
    const { setSaveAction, setStatusBar } = useSikkaAccountsPage();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();
    const qrPasteRef = useRef<HTMLDivElement>(null);
    
    const [docColumns, setDocColumns] = useState<string[]>([]);
    const [itemColumns, setItemColumns] = useState<string[]>([]);
    const [isAddDocColOpen, setIsAddDocColOpen] = useState(false);
    const [isAddItemColOpen, setIsAddItemColOpen] = useState(false);
    const [newColTitle, setNewColTitle] = useState('');
    const [isQrEnlarged, setIsQrEnlarged] = useState(false);
    const [showPasteButton, setShowPasteButton] = useState(false);
    const [isSerialLoading, setIsSerialLoading] = useState(false);

    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants"), orderBy("createdAt", "desc")) : null, [firestore]);
    
    // ACCOUNTS REGISTRY HANDSHAKE
    const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_parties"), where("isDeleted", "==", false)) : null, [firestore]);
    
    const itemsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_items")) : null, [firestore]);
    const itQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_invoice_types")) : null, [firestore]);
    const ctQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_charge_types")) : null, [firestore]);
    const utQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_unit_types")) : null, [firestore]);
    const qtyTypesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "material_types")) : null, [firestore]);

    const { data: dbPlants } = useCollection<Plant>(plantsQuery);
    const { data: dbParties } = useCollection<Party>(partiesQuery);
    const { data: dbMasterItems } = useCollection<MasterDataItem>(itemsQuery);
    const { data: dbInvoiceTypes } = useCollection<MasterInvoiceType>(itQuery);
    const { data: dbChargeTypes } = useCollection<MasterChargeType>(ctQuery);
    const { data: allUnitTypes } = useCollection<MasterUnitType>(utQuery);
    const { data: allQtyTypes } = useCollection<MasterQtyType>(qtyTypesQuery);

    const defaultBillMonth = useMemo(() => {
        const prevMonth = subMonths(new Date(), 1);
        return format(prevMonth, 'MM/yyyy').toUpperCase();
    }, []);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { 
            plantId: '',
            invoiceType: '',
            chargeType: '',
            consignorId: '',
            consigneeId: '',
            shipToId: '',
            invoiceNo: '', 
            invoiceDate: new Date(), 
            billMonth: defaultBillMonth,
            ackDate: new Date(),
            isShipToSame: false, 
            gstRate: 12,
            otaApplicable: false,
            items: [{ masterItemId: '', itemDescription: '', hsnSac: '', qty: 0, uom: '', rate: 0, amount: 0, itemCustomValues: {} }],
            docCustomValues: {},
            qrCodeDataUrl: ''
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
    const { watch, setValue, handleSubmit, reset, control, formState: { errors } } = form;

    const watchedItems = useWatch({ control, name: 'items' }) || [];
    const selectedPlantId = watch('plantId');
    const selectedInvoiceType = watch('invoiceType');
    const selectedChargeType = watch('chargeType');
    const consignorId = watch('consignorId');
    const consigneeId = watch('consigneeId');
    const shipToId = watch('shipToId');
    const isShipToSame = watch('isShipToSame');
    const gstRate = watch('gstRate');
    const otaApplicable = watch('otaApplicable');
    const otaDate = watch('otaDate');
    const invoiceDate = watch('invoiceDate');
    const irn = watch('irn');
    const ackNo = watch('ackNo');
    const qrCodeDataUrl = watch('qrCodeDataUrl');

    const selectedConsignor = useMemo(() => dbPlants?.find(p => p.id === consignorId), [dbPlants, consignorId]);
    const selectedConsignee = useMemo(() => dbParties?.find(p => p.id === consigneeId), [dbParties, consigneeId]);
    const selectedShipTo = useMemo(() => isShipToSame ? selectedConsignee : dbParties?.find(p => p.id === shipToId), [isShipToSame, selectedConsignee, dbParties, shipToId]);

    useEffect(() => {
        if (!selectedPlantId || !firestore) return;

        const fetchNextSerial = async () => {
            setIsSerialLoading(true);
            try {
                const invRef = collection(firestore, "invoices");
                const q = query(invRef, where("plantId", "==", selectedPlantId), orderBy("invoiceNo", "desc"), limit(1));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const lastInvoiceNo = snap.docs[0].data().invoiceNo;
                    const nextNo = incrementSerial(lastInvoiceNo);
                    setValue('invoiceNo', nextNo, { shouldValidate: true });
                    setStatusBar({ message: `System Handshake: Next serial generated for ${selectedPlantId}.`, type: 'info' });
                } else {
                    setValue('invoiceNo', '0001', { shouldValidate: true });
                }
            } catch (e) {
                console.error("Serial Fetch Error:", e);
                setStatusBar({ message: "Unable to fetch last invoice serial for selected Plant.", type: 'error' });
            } finally {
                setIsSerialLoading(false);
            }
        };

        fetchNextSerial();
    }, [selectedPlantId, firestore, setValue, setStatusBar]);

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (!file) continue;
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        setValue('qrCodeDataUrl', e.target?.result as string, { shouldValidate: true });
                        toast({ title: 'QR Node Captured', description: 'Handshake successful.' });
                        setShowPasteButton(false);
                    };
                    reader.readAsDataURL(file);
                    event.preventDefault();
                    break;
                }
            }
        };
        const pasteArea = qrPasteRef.current;
        pasteArea?.addEventListener('paste', handlePaste);
        return () => pasteArea?.removeEventListener('paste', handlePaste);
    }, [setValue, toast]);

    const handlePasteAreaClick = () => {
        if (!qrCodeDataUrl) {
            setShowPasteButton(true);
            qrPasteRef.current?.focus();
        }
    };

    const handleClipboardPaste = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            setValue('qrCodeDataUrl', event.target?.result as string, { shouldValidate: true });
                            setShowPasteButton(false);
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
            toast({ variant: 'destructive', title: "No Image", description: "Clipboard does not contain image data." });
        } catch (err) {
            toast({ title: "Focus Required", description: "Click the box and press Ctrl+V." });
        }
    };

    const handleAddDocColumn = () => {
        if (newColTitle.trim()) {
            setDocColumns(prev => [...prev, newColTitle]);
            setValue(`docCustomValues.${newColTitle}`, "");
            setNewColTitle('');
            setIsAddDocColOpen(false);
        }
    };

    const handleAddItemColumn = () => {
        if (newColTitle.trim()) {
            setItemColumns(prev => [...prev, newColTitle]);
            watchedItems.forEach((_, idx) => {
                setValue(`items.${idx}.itemCustomValues.${newColTitle}`, "");
            });
            setNewColTitle('');
            setIsAddItemColOpen(false);
        }
    };

    const availableFirms = useMemo(() => {
        if (!dbPlants || !selectedPlantId) return [];
        const normalizedTarget = normalizePlantId(selectedPlantId).toLowerCase();
        return dbPlants.filter(p => normalizePlantId(p.id).toLowerCase() === normalizedTarget);
    }, [dbPlants, selectedPlantId]);

    const filteredMasterItems = useMemo(() => {
        if (!dbMasterItems || !selectedPlantId || !selectedInvoiceType || !selectedChargeType) return [];
        const normalizedTarget = normalizePlantId(selectedPlantId).toLowerCase();
        
        return dbMasterItems.filter(item => {
            const plantMatch = normalizePlantId(item.plantId).toLowerCase() === normalizedTarget;
            const itMatch = item.invoiceTypeId === selectedInvoiceType;
            const ctMatch = item.chargeTypeId === selectedChargeType;
            
            if (!plantMatch || !itMatch || !ctMatch) return false;

            if (otaApplicable) {
                if (!otaDate || !item.ota || !item.validityDate) return false;
                const itemDate = (item.validityDate as any).toDate ? (item.validityDate as any).toDate() : new Date(item.validityDate);
                return startOfDay(itemDate).getTime() === startOfDay(otaDate).getTime();
            } else {
                if (item.ota) return false;
                const start = item.validFrom ? ((item.validFrom as any).toDate ? (item.validFrom as any).toDate() : new Date(item.validFrom)) : null;
                const end = item.validTo ? ((item.validTo as any).toDate ? (item.validTo as any).toDate() : new Date(item.validTo)) : null;
                if (!start || !end) return false;
                return invoiceDate >= start && invoiceDate <= end;
            }
        });
    }, [dbMasterItems, selectedPlantId, selectedInvoiceType, selectedChargeType, otaApplicable, otaDate, invoiceDate]);

    const supplyChainContext = useMemo(() => {
        const consignor = availableFirms.find(p => p.id === watch('consignorId'));
        const consignee = dbParties?.find(p => p.id === consigneeId);
        if (!consignor || !consignee) return { isInterState: false };
        return { isInterState: consignor.stateCode !== consignee.stateCode };
    }, [availableFirms, dbParties, watch('consignorId'), consigneeId]);

    const totals = useMemo(() => {
        const taxable = watchedItems.reduce((acc, item) => acc + (Number(item?.amount) || 0), 0);
        let cgst = 0, sgst = 0, igst = 0;
        
        if (supplyChainContext.isInterState) {
            igst = Number(((taxable * gstRate) / 100).toFixed(2));
        } else {
            cgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2));
            sgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2));
        }
        
        const rawTotal = taxable + cgst + sgst + igst;
        const grand = Math.round(rawTotal);
        const roundOff = Number((grand - rawTotal).toFixed(2));
        
        return { taxable, cgst, sgst, igst, grand, roundOff, words: numberToWords(grand).toUpperCase() };
    }, [watchedItems, gstRate, supplyChainContext.isInterState]);

    const handleItemSelect = useCallback((index: number, masterId: string) => {
        const master = filteredMasterItems.find(m => m.id === masterId);
        if (master) {
            setValue(`items.${index}.itemDescription`, master.itemDescription);
            setValue(`items.${index}.hsnSac`, master.hsnSac);
            setValue(`items.${index}.rate`, master.rate);
            const uomLabel = allUnitTypes?.find(ut => ut.id === master.unitTypeId)?.name || 'MT';
            setValue(`items.${index}.uom`, uomLabel);
            const currentQty = form.getValues(`items.${index}.qty`) || 0;
            setValue(`items.${index}.amount`, Number((currentQty * master.rate).toFixed(2)));
            setValue('gstRate', master.isGstApplicable ? (master.gstRate || 12) : 0);
        }
    }, [filteredMasterItems, allUnitTypes, setValue, form]);

    const onSubmitAction = useCallback(async (data: FormValues) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const duplicateQuery = query(collection(firestore, "invoices"), where("invoiceNo", "==", data.invoiceNo.trim()), where("plantId", "==", data.plantId), limit(1));
            const duplicateSnap = await getDocs(duplicateQuery);
            if (!duplicateSnap.empty) {
                toast({ variant: 'destructive', title: "Registry Conflict", description: `Invoice number ${data.invoiceNo} already exists for this node.` });
                hideLoader();
                return;
            }

            const currentName = (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
            
            const invoiceData: any = { 
                ...data, 
                totals: { ...totals, isInterState: supplyChainContext.isInterState }, 
                docColumns, 
                itemColumns, 
                userName: currentName, 
                userId: user.uid, 
                createdAt: serverTimestamp(), 
                paymentStatus: 'Unpaid'
            };

            // REGISTRY SANITIZATION NODE
            const sanitize = (obj: any): any => {
                if (Array.isArray(obj)) return obj.map(sanitize);
                if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && obj.constructor?.name !== 'FieldValue') {
                    return Object.fromEntries(
                        Object.entries(obj)
                            .filter(([_, v]) => v !== undefined)
                            .map(([k, v]) => [k, sanitize(v)])
                    );
                }
                return obj;
            };

            const cleanedPayload = sanitize(invoiceData);
            await addDoc(collection(firestore, "invoices"), cleanedPayload);
            
            toast({ title: "Document Registered", description: `Billing manifest ${data.invoiceNo} committed.` });
            reset();
            router.push(`/sikka-accounts/invoice/print?invoiceNo=${data.invoiceNo}`);
        } catch (e: any) { 
            toast({ variant: 'destructive', title: "Commit Error", description: e.message }); 
        } finally { hideLoader(); }
    }, [firestore, user, totals, supplyChainContext.isInterState, docColumns, itemColumns, reset, router, showLoader, hideLoader, toast]);

    useEffect(() => {
        setSaveAction(() => form.handleSubmit(onSubmitAction)());
        return () => setSaveAction(null);
    }, [setSaveAction, form, onSubmitAction]);

    return (
        <div className="p-8 space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {Object.keys(errors).length > 0 && (
                <Card className="border-red-200 bg-red-50/50 shadow-xl rounded-2xl overflow-hidden animate-in shake-in duration-300">
                    <CardHeader className="bg-red-600 text-white py-3 px-6 flex flex-row items-center gap-3">
                        <AlertCircle className="h-5 w-5" />
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Registry Validation Errors</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-2">
                            {Object.entries(errors).map(([key, err]) => (
                                <li key={key} className="flex items-center gap-2 text-[11px] font-black text-red-700 uppercase">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                                    <span className="opacity-60">{key}:</span> {String((err as any).message)}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            <Form {...form}>
                <form className="space-y-12 pb-20">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden">
                        <CardHeader className="bg-white/5 border-b border-white/5 p-6 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-600 p-3 rounded-2xl shadow-lg"><ShieldCheck className="h-6 w-6" /></div>
                                <h2 className="text-xl font-black uppercase tracking-tight italic">VF01 – Create Billing Document</h2>
                            </div>
                            <Button type="button" variant="outline" onClick={() => setIsAddDocColOpen(true)} className="h-10 rounded-xl bg-white/10 border-white/20 text-white font-black uppercase text-[10px] tracking-widest px-6">Add Registry Column</Button>
                        </CardHeader>
                        <CardContent className="p-10 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 items-end">
                            <FormField name="plantId" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">PLANT ID *</FormLabel>
                                    <Select onValueChange={(v) => { field.onChange(v); setValue('invoiceType', ''); setValue('chargeType', ''); }} value={field.value ?? ''}>
                                        <FormControl><SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl font-black text-blue-400 uppercase"><SelectValue placeholder="Node" /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{Array.from(new Set(dbPlants?.map(p => p.id))).map(id => <SelectItem key={id} value={id}>{id}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="invoiceType" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Invoice Type *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!selectedPlantId}>
                                        <FormControl><SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{dbInvoiceTypes?.filter(it => it.plantId === selectedPlantId).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="chargeType" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Charge Type *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!selectedPlantId}>
                                        <FormControl><SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{dbChargeTypes?.filter(ct => ct.plantId === selectedPlantId).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="invoiceNo" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-between">
                                        Invoice # *
                                        {isSerialLoading && <Loader2 className="h-2 w-2 animate-spin" />}
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input {...field} value={field.value ?? ''} className="h-11 bg-white/5 border-white/10 text-blue-400 font-black uppercase pr-8" />
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Sparkles className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-blue-400 opacity-50" /></TooltipTrigger>
                                                    <TooltipContent className="bg-slate-900 text-white text-[9px] font-black uppercase">Auto-generated based on Plant ID. You may edit before save.</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField name="invoiceDate" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Date *</FormLabel>
                                    <FormControl>
                                        <div className="h-11 bg-white/5 border border-white/10 rounded-xl px-3 flex items-center">
                                            <DatePicker 
                                                date={field.value} 
                                                setDate={field.onChange} 
                                                className="w-full border-none bg-transparent p-0 h-10 text-white" 
                                                calendarProps={{ disabled: { after: new Date() } }}
                                            />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            
                            <FormField name="billMonth" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Bill Month *</FormLabel><FormControl><Input placeholder="MM/YYYY" {...field} value={field.value ?? ''} className="h-11 bg-white/5 border-white/10 uppercase" /></FormControl></FormItem>)} />
                            <FormField name="irn" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">IRN Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 bg-white/5 border-white/10 text-emerald-400 font-mono text-xs uppercase" /></FormControl></FormItem>)} />
                            <FormField name="ackNo" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">ACK Number</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 bg-white/5 border-white/10" /></FormControl></FormItem>)} />
                            <FormField name="ackDate" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">ACK Date</FormLabel>
                                    <FormControl>
                                        <div className="h-11 bg-white/5 border border-white/10 rounded-xl px-3 flex items-center">
                                            <DatePicker 
                                                date={field.value} 
                                                setDate={field.onChange} 
                                                className="w-full border-none bg-transparent p-0 h-10 text-white" 
                                                calendarProps={{ disabled: { after: new Date() } }}
                                            />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            
                            <FormField name="qrCodeDataUrl" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-blue-400 flex items-center justify-between">
                                        QR Code
                                        <span className={cn("lowercase font-black", (irn?.trim() && ackNo?.trim()) ? "text-red-500 underline" : "text-emerald-500")}>
                                            ({(irn?.trim() && ackNo?.trim()) ? "mandatory" : "optional"})
                                        </span>
                                    </FormLabel>
                                    <FormControl>
                                        <div 
                                            ref={qrPasteRef}
                                            tabIndex={0}
                                            onClick={handlePasteAreaClick}
                                            className={cn(
                                                "relative h-24 w-full flex items-center justify-center bg-white border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-all outline-none focus:ring-2 focus:ring-primary overflow-hidden",
                                                errors.qrCodeDataUrl ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "border-slate-300"
                                            )}
                                        >
                                            {field.value ? (
                                                <div className="relative group/qr h-full w-full flex items-center justify-center p-2">
                                                    <Image src={field.value} alt="QR Code" fill className="object-contain" unoptimized />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/qr:opacity-100 flex items-center justify-center transition-opacity gap-2">
                                                        <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsQrEnlarged(true); }} className="text-white hover:bg-white/20">
                                                            <Maximize2 className="h-5 w-5" />
                                                        </Button>
                                                        <Button type="button" variant="destructive" size="icon" onClick={(e) => { e.stopPropagation(); setValue('qrCodeDataUrl', '', { shouldValidate: true }); }} className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700">
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : showPasteButton ? (
                                                <Button 
                                                    type="button" 
                                                    onClick={handleClipboardPaste}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-6 h-9 rounded-lg animate-in zoom-in-95 duration-200"
                                                >
                                                    PASTE
                                                </Button>
                                            ) : (
                                                <div className="flex flex-col items-center text-center px-4">
                                                    <ClipboardPaste className="w-6 h-6 mb-1 text-muted-foreground" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight">Click & Paste QR</span>
                                                </div>
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormMessage className="text-[9px] font-black uppercase" />
                                </FormItem>
                            )} />

                            {docColumns.map((col, idx) => (
                                <FormField key={idx} name={`docCustomValues.${col}`} control={form.control} render={({ field: cField }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-400">{col} *</FormLabel><FormControl><Input {...cField} value={cField.value ?? ""} className="h-11 bg-white/5 border-white/10 text-white" /></FormControl></FormItem>
                                )} />
                            ))}
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <Card className="lg:col-span-4 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
                            <CardHeader className="bg-slate-50 border-b p-6 flex items-center gap-3">
                                <div className="bg-blue-900 p-2 rounded-lg text-white"><ShieldCheck className="h-4 w-4" /></div>
                                <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-[0.2em]">Consignor</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 flex-1 flex flex-col">
                                <FormField name="consignorId" control={form.control} render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Node selection *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!selectedPlantId}>
                                            <FormControl><SelectTrigger className="h-11 rounded-xl font-bold border-slate-200"><SelectValue placeholder="Select Consignor" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                {availableFirms.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase">{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                {selectedConsignor && (
                                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-1 gap-1 text-[10px] font-bold text-slate-500 uppercase">
                                            <p className="font-black text-slate-900 leading-tight mb-1">{selectedConsignor.name}</p>
                                            <p className="truncate leading-tight"><span className="text-slate-400 font-black">ADR:</span> {selectedConsignor.address}</p>
                                            <div className="flex justify-between"><span><span className="text-slate-400 font-black">GST:</span> {selectedConsignor.gstin}</span> <span><span className="text-slate-400 font-black">PAN:</span> {selectedConsignor.pan}</span></div>
                                            <p><span className="text-slate-400 font-black">ST:</span> {selectedConsignor.state} ({selectedConsignor.stateCode})</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-4 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
                            <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-600 p-2 rounded-lg text-white"><UserCircle className="h-4 w-4" /></div>
                                    <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-[0.2em]">Consignee</CardTitle>
                                </div>
                                <FormField name="isShipToSame" control={form.control} render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="text-[10px] font-black uppercase text-blue-600 cursor-pointer">Ship To Same</FormLabel>
                                    </FormItem>
                                )} />
                            </CardHeader>
                            <CardContent className="p-8 flex-1 flex flex-col">
                                <FormField name="consigneeId" control={form.control} render={({ field }) => (
                                    <FormItem className="flex-1"><FormLabel className="text-[10px] font-black uppercase text-slate-400">Buyer Node *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!selectedPlantId}>
                                            <FormControl><SelectTrigger className="h-11 rounded-xl font-bold border-slate-200"><SelectValue placeholder="Select Consignee" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">{dbParties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                {selectedConsignee && (
                                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-1 gap-1 text-[10px] font-bold text-slate-500 uppercase">
                                            <p className="font-black text-slate-900 leading-tight mb-1">{selectedConsignee.name}</p>
                                            <p className="truncate leading-tight"><span className="text-slate-400 font-black">ADR:</span> {selectedConsignee.address}</p>
                                            <div className="flex justify-between"><span><span className="text-slate-400 font-black">GST:</span> {selectedConsignee.gstin}</span> <span><span className="text-slate-400 font-black">PAN:</span> {selectedConsignee.pan}</span></div>
                                            <p><span className="text-slate-400 font-black">ST:</span> {selectedConsignee.state} ({selectedConsignee.stateCode})</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className={cn("lg:col-span-4 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden transition-all flex flex-col", isShipToSame && "opacity-50 pointer-events-none")}>
                            <CardHeader className="bg-slate-50 border-b p-6 flex items-center gap-3">
                                <div className="bg-indigo-600 p-2 rounded-lg text-white"><MapPin className="h-4 w-4" /></div>
                                <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-[0.2em]">Ship to</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 flex-1 flex flex-col">
                                <FormField name="shipToId" control={form.control} render={({ field }) => (
                                    <FormItem className="flex-1"><FormLabel className="text-[10px] font-black uppercase text-slate-400">Destination *</FormLabel>
                                        <Select onValueChange={field.onChange} value={isShipToSame ? consigneeId : (field.value ?? '')} disabled={!selectedPlantId || isShipToSame}>
                                            <FormControl><SelectTrigger className="h-11 rounded-xl font-bold border-slate-200"><SelectValue placeholder="Select drop party" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">{dbParties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                {selectedShipTo && (
                                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-1 gap-1 text-[10px] font-bold text-slate-500 uppercase">
                                            <p className="font-black text-slate-900 leading-tight mb-1">{selectedShipTo.name}</p>
                                            <p className="truncate leading-tight"><span className="text-slate-400 font-black">ADR:</span> {selectedShipTo.address}</p>
                                            <div className="flex justify-between"><span><span className="text-slate-400 font-black">GST:</span> {selectedShipTo.gstin}</span> <span><span className="text-slate-400 font-black">PAN:</span> {selectedShipTo.pan}</span></div>
                                            <p><span className="text-slate-400 font-black">ST:</span> {selectedShipTo.state} ({selectedShipTo.stateCode})</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                        <CardHeader className="bg-slate-900 border-b p-6 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3 text-white"><ListTree className="h-5 w-5 text-blue-400" /><CardTitle className="text-sm font-black uppercase">Consignment Item Manifest</CardTitle></div>
                            <div className="flex gap-3">
                                <Button type="button" size="sm" onClick={() => setIsAddItemColOpen(true)} className="bg-white/10 text-white font-black text-[10px] rounded-xl px-6 h-9 hover:bg-white/20">Add Header Node</Button>
                                <Button type="button" size="sm" onClick={() => append({ masterItemId: '', itemDescription: '', hsnSac: '', qty: 0, uom: '', rate: 0, amount: 0, itemCustomValues: {} })} className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-xl px-6 h-9 shadow-lg">
                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add New Row
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table className="w-full min-w-[1200px]">
                                    <TableHeader className="bg-slate-50 border-b">
                                        <TableRow className="h-14">
                                            <TableHead className="w-16 text-center text-[10px] font-black uppercase text-slate-400">Sr</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-6">Description of Goods *</TableHead>
                                            {itemColumns.map((col, idx) => (
                                                <TableHead key={idx} className="text-[10px] font-black uppercase text-blue-600 italic px-4">{col}</TableHead>
                                            ))}
                                            <TableHead className="w-32 text-[10px] font-black uppercase text-slate-400 text-center">HSN/SAC</TableHead>
                                            <TableHead className="w-80 text-[10px] font-black uppercase text-slate-400 text-center">Qty *</TableHead>
                                            <TableHead className="w-20 text-[10px] font-black uppercase text-slate-400 text-center">UOM</TableHead>
                                            <TableHead className="w-32 text-[10px] font-black uppercase text-slate-400 text-right">Rate *</TableHead>
                                            <TableHead className="w-64 text-[10px] font-black uppercase text-slate-400 text-right bg-blue-50/50 pr-8">Taxable Amt</TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => (
                                            <TableRow key={field.id} className="h-16 border-b group">
                                                <TableCell className="text-center font-black text-slate-300 text-xs">{index + 1}</TableCell>
                                                <TableCell className="px-6">
                                                    <FormField name={`items.${index}.masterItemId`} control={form.control} render={({ field: itm }) => (
                                                        <Select onValueChange={(val) => { itm.onChange(val); handleItemSelect(index, val); }} value={itm.value ?? ''} disabled={!selectedPlantId || !selectedInvoiceType || !selectedChargeType || (otaApplicable && !otaDate)}>
                                                            <FormControl><SelectTrigger className="border-none font-black text-blue-900 text-[11px] bg-transparent shadow-none h-10"><SelectValue placeholder="Registry Fetch..." /></SelectTrigger></FormControl>
                                                            <SelectContent className="rounded-xl">{filteredMasterItems.map(m => <SelectItem key={m.id} value={m.id} className="font-bold py-3 uppercase italic">{m.itemDescription}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    )} />
                                                </TableCell>
                                                {itemColumns.map((col, cIdx) => (
                                                    <TableCell key={cIdx} className="px-4">
                                                        <FormField name={`items.${index}.itemCustomValues.${col}`} control={form.control} render={({ field: cField }) => (
                                                            <FormControl><Input {...cField} value={cField.value ?? ""} className="h-9 border border-slate-100 bg-slate-50/50 text-[11px] font-black uppercase" placeholder={col} /></FormControl>
                                                        )} />
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-center"><FormField name={`items.${index}.hsnSac`} control={form.control} render={({ field: itm }) => (<Input {...itm} value={itm.value ?? ""} readOnly className="border-none bg-transparent text-center font-mono text-[11px] font-bold shadow-none" />)} /></TableCell>
                                                <TableCell className="px-4">
                                                    <FormField name={`items.${index}.qty`} control={form.control} render={({ field: itm }) => (
                                                        <FormControl><Input type="number" {...itm} value={itm.value ?? 0} onChange={e => { itm.onChange(e); const currentRate = form.getValues(`items.${index}.rate`) || 0; setValue(`items.${index}.amount`, Number((Number(e.target.value) * currentRate).toFixed(2))); }} className="border-slate-200 h-10 font-black text-blue-900 text-center rounded-xl shadow-inner text-base" /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-2"><FormField name={`items.${index}.uom`} control={form.control} render={({ field: itm }) => (<FormControl><Input {...itm} value={itm.value ?? ""} readOnly className="border-none bg-transparent text-center font-black text-[10px] uppercase text-slate-400 shadow-none" /></FormControl>)} /></TableCell>
                                                <TableCell className="px-2">
                                                    <FormField name={`items.${index}.rate`} control={form.control} render={({ field: itm }) => (
                                                        <FormControl><Input type="number" {...itm} value={itm.value ?? 0} onChange={e => { itm.onChange(e); const currentQty = form.getValues(`items.${index}.qty`) || 0; setValue(`items.${index}.amount`, Number((Number(e.target.value) * currentQty).toFixed(2))); }} className="border-slate-200 h-10 font-black text-slate-900 text-right rounded-xl shadow-inner" /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="text-right pr-8 font-black text-blue-900 bg-blue-50/30 text-[12px]">₹ {(watchedItems[index]?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell><Button type="button" variant="ghost" size="icon" className="text-slate-200 group-hover:text-red-600 transition-colors" onClick={() => remove(index)} disabled={fields.length === 1}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-slate-900 text-white p-12 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-12 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 transition-transform duration-1000 group-hover:scale-110"><Calculator className="h-64 w-64" /></div>
                        <div className="space-y-8 text-center md:text-left z-10 flex-1 w-full">
                            <p className="text-[10px] font-black uppercase text-blue-300 tracking-[0.5em] text-center md:text-left">AGGREGATED FINANCIAL LIABILITY MANIFEST</p>
                            <div className="flex flex-wrap gap-12 justify-center md:justify-start">
                                <div className="space-y-1.5 min-w-max"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">TAXABLE AMOUNT</span><span className="text-3xl font-black text-white tracking-tighter">₹ {totals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                {!supplyChainContext.isInterState ? (
                                    <>
                                        <div className="space-y-1.5 min-w-max"><span className="text-[10px] font-black text-orange-500 uppercase tracking-widest block">CGST {(gstRate/2)}%</span><span className="text-3xl font-black text-orange-400 tracking-tighter">₹ {totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                        <div className="space-y-1.5 min-w-max"><span className="text-[10px] font-black text-orange-500 uppercase tracking-widest block">SGST {(gstRate/2)}%</span><span className="text-3xl font-black text-orange-400 tracking-tighter">₹ {totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                    </>
                                ) : (
                                    <div className="space-y-1.5 min-w-max"><span className="text-[10px] font-black text-orange-500 uppercase tracking-widest block">IGST {gstRate}%</span><span className="text-3xl font-black text-orange-400 tracking-tighter">₹ {totals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                )}
                                <div className="space-y-1.5 min-w-max"><span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">AUTO ROUND-OFF</span><span className="text-3xl font-black text-amber-400 tracking-tighter">₹ {totals.roundOff.toFixed(2)}</span></div>
                            </div>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">NET AMOUNT IN WORDS (PERSISTENT NODE)</p>
                                <p className="text-sm font-bold text-blue-200 italic">"{totals.words} ONLY"</p>
                            </div>
                        </div>
                        <div className="text-center md:text-right z-10 pr-4 flex flex-col items-center md:items-end w-fit">
                            <span className="text-6xl md:text-8xl font-black tracking-tighter text-shadow-2xl text-blue-400 block mb-4 transition-transform duration-500 group-hover:scale-105 whitespace-nowrap">₹ {totals.grand.toLocaleString('en-IN')}</span>
                            <Badge className="bg-emerald-600 text-white font-black uppercase tracking-widest text-[11px] px-8 py-2.5 border-none shadow-xl rounded-full">VERIFIED REGISTRY TOTAL</Badge>
                        </div>
                    </div>
                </form>
            </Form>

            <Dialog open={isAddDocColOpen} onOpenChange={setIsAddDocColOpen}>
                <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-slate-900 text-white">
                        <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3 italic"><PlusCircle className="h-5 w-5 text-blue-400" /> Header Column Node</DialogTitle>
                    </DialogHeader>
                    <div className="p-8">
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block px-1">Column Identifier *</label>
                        <Input value={newColTitle} onChange={(e) => setNewColTitle(e.target.value)} placeholder="e.g. Consignment Ref" className="h-12 rounded-xl font-black text-blue-900 shadow-inner" />
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => { setIsAddDocColOpen(false); setNewColTitle(''); }} className="font-bold text-slate-400 uppercase text-[10px]">Discard</Button>
                        <Button onClick={handleAddDocColumn} className="bg-blue-900 hover:bg-slate-900 text-white rounded-xl px-10 font-black uppercase text-[10px] h-11 shadow-lg shadow-blue-100 border-none transition-all active:scale-95">Add Node</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddItemColOpen} onOpenChange={setIsAddItemColOpen}>
                <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-slate-900 text-white">
                        <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3 italic"><ListTree className="h-5 w-5 text-blue-400" /> Table Header Node</DialogTitle>
                    </DialogHeader>
                    <div className="p-8">
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block px-1">Header Title (Grid Logic) *</label>
                        <Input value={newColTitle} onChange={(e) => setNewColTitle(e.target.value)} placeholder="e.g. Batch Code" className="h-12 rounded-xl font-black text-blue-900 shadow-inner" />
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setIsAddItemColOpen(false)} className="font-bold text-slate-400 uppercase text-[10px]">Discard</Button>
                        <Button onClick={handleAddItemColumn} className="bg-blue-900 hover:bg-slate-900 text-white rounded-xl px-10 font-black uppercase text-[10px] h-11 shadow-lg shadow-blue-100 border-none transition-all active:scale-95">Add Row Node</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isQrEnlarged} onOpenChange={setIsQrEnlarged}>
                <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden border-none shadow-3xl">
                    <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center justify-between">
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Security Node Verification</DialogTitle>
                        <Button variant="ghost" size="icon" onClick={() => setIsQrEnlarged(false)} className="text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
                    </DialogHeader>
                    <div className="p-10 flex items-center justify-center bg-slate-100">
                        {qrCodeDataUrl ? (
                            <Image src={qrCodeDataUrl} alt="Enlarged QR" width={400} height={400} className="max-w-full h-auto shadow-2xl rounded-lg" unoptimized />
                        ) : null}
                    </div>
                    <DialogFooter className="p-4 bg-slate-50 border-t">
                        <Button onClick={() => setIsQrEnlarged(false)} className="bg-blue-900 font-black uppercase text-[10px] tracking-widest px-8">Close Preview</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
