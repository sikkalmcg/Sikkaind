'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { useToast } from '@/hooks/use-toast';
import type { Plant, WithId, Invoice, Party, SubUser, MasterDataItem, MasterInvoiceType, MasterChargeType, MasterUnitType } from '@/types';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Trash2, 
    Loader2, 
    Lock, 
    ShieldCheck, 
    Save, 
    Clock, 
    UserCircle, 
    ListTree,
    Factory,
    MapPin,
    Calculator,
    ClipboardPaste,
    X,
    Maximize2,
    Plus,
    PlusCircle,
    History,
    Sparkles,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, serverTimestamp, query, collection, where, limit, getDocs, Timestamp } from 'firebase/firestore';
import { differenceInHours, format, differenceInSeconds, isValid, startOfDay } from 'date-fns';
import { cn, normalizePlantId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { numberToWords } from '@/lib/number-to-words';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import Image from 'next/image';

const formSchema = z.object({
  invoiceType: z.string().min(1, "Invoice type is required."),
  invoiceNo: z.string().min(1, "Invoice Number is required"),
  invoiceDate: z.date(),
  billMonth: z.string().min(1, "Bill Month is required"),
  ackNo: z.string().optional().or(z.literal('')).refine(v => !v || /^\d+$/.test(v), "ACK number must be numeric."),
  ackDate: z.date().optional(),
  irn: z.string().optional().or(z.literal('')),
  irnGeneratedAt: z.any().optional(),
  qrCodeDataUrl: z.string().optional().or(z.literal('')),
  consignorId: z.string().min(1, "Consignor is required"),
  consigneeId: z.string().min(1, "Consignee is required"),
  plantId: z.string().min(1, "Plant is required"),
  chargeType: z.string().min(1, "Charge type is required."),
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
  })).min(1, "At least one item is required."),
  gstRate: z.coerce.number().default(0),
});

type FormValues = z.infer<typeof formSchema>;

function IRNCountdown({ generatedAt, onExpire }: { generatedAt: Date; onExpire: () => void }) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const expiry = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000);
            const diff = differenceInSeconds(expiry, now);

            if (diff <= 0) {
                setTimeLeft('00:00:00');
                setIsExpired(true);
                onExpire();
                return;
            }

            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };

        const timer = setInterval(updateTimer, 1000);
        updateTimer();
        return () => clearInterval(timer);
    }, [generatedAt, onExpire]);

    return (
        <div className={cn(
            "flex flex-col items-end gap-1 px-4 py-2 rounded-2xl border-2 transition-all shadow-lg",
            isExpired ? "bg-red-50 border-red-200 text-red-600" : "bg-slate-900 border-blue-500/30 text-white"
        )}>
            <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", isExpired ? "text-red-400" : "text-blue-400")}>
                IRN Edit Lock Countdown
            </span>
            <div className="flex items-center gap-2">
                <Clock className={cn("h-4 w-4", !isExpired && "animate-pulse")} />
                <span className="text-xl font-black font-mono tracking-tighter">{timeLeft}</span>
            </div>
        </div>
    );
}

function EditInvoiceForm({ invoice }: { invoice: WithId<Invoice> }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();
    const { setSaveAction, setStatusBar } = useSikkaAccountsPage();
    const qrPasteRef = useRef<HTMLDivElement>(null);
    
    const [docColumns, setDocColumns] = useState<string[]>(invoice.docColumns || []);
    const [itemColumns, setItemColumns] = useState<string[]>(invoice.itemColumns || []);
    const [isAddDocColOpen, setIsAddDocColOpen] = useState(false);
    const [isAddItemColOpen, setIsAddItemColOpen] = useState(false);
    const [newColTitle, setNewColTitle] = useState('');
    const [isQrEnlarged, setIsQrEnlarged] = useState(false);
    const [showPasteButton, setShowPasteButton] = useState(false);
    const [isTimeLocked, setIsTimeLocked] = useState(false);

    const itQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_invoice_types")) : null, [firestore]);
    const ctQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_charge_types")) : null, [firestore]);
    const utQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_unit_types")) : null, [firestore]);
    const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_parties")) : null, [firestore]);
    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants")) : null, [firestore]);
    const itemsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_items")) : null, [firestore]);

    const { data: dbInvoiceTypes } = useCollection<MasterInvoiceType>(itQuery);
    const { data: dbChargeTypes } = useCollection<MasterChargeType>(ctQuery);
    const { data: allUnitTypes } = useCollection<MasterUnitType>(utQuery);
    const { data: dbParties } = useCollection<Party>(partiesQuery);
    const { data: dbPlants } = useCollection<Plant>(plantsQuery);
    const { data: dbMasterItems } = useCollection<MasterDataItem>(itemsQuery);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            invoiceType: invoice.invoiceType,
            invoiceNo: invoice.invoiceNo,
            invoiceDate: invoice.invoiceDate instanceof Timestamp ? invoice.invoiceDate.toDate() : new Date(invoice.invoiceDate),
            billMonth: invoice.billMonth,
            ackNo: invoice.ackNo || '',
            ackDate: invoice.ackDate ? (invoice.ackDate instanceof Timestamp ? invoice.ackDate.toDate() : new Date(invoice.ackDate)) : undefined,
            irn: invoice.irn || '',
            irnGeneratedAt: invoice.irnGeneratedAt || null,
            qrCodeDataUrl: invoice.qrCodeDataUrl || '',
            consignorId: invoice.consignorId,
            consigneeId: invoice.consigneeId,
            plantId: invoice.plantId,
            chargeType: invoice.chargeType,
            isShipToSame: invoice.isShipToSame || false,
            shipToId: invoice.shipToId || '',
            otaApplicable: !!invoice.otaApplicable,
            otaDate: invoice.otaDate ? (invoice.otaDate instanceof Timestamp ? invoice.otaDate.toDate() : new Date(invoice.otaDate)) : undefined,
            docCustomValues: invoice.docCustomValues || {},
            items: invoice.items.map(item => ({
                masterItemId: item.masterItemId,
                itemDescription: item.itemDescription || item.description || '',
                hsnSac: item.hsnSac || '',
                qty: item.qty || 0,
                uom: item.uom || '',
                rate: item.rate || 0,
                amount: item.amount || 0,
                itemCustomValues: item.itemCustomValues || {}
            })),
            gstRate: invoice.gstRate || 12
        }
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
    const { handleSubmit, setValue, watch, formState: { errors } } = form;
    
    const watchedItems = useWatch({ control, name: 'items' }) || [];
    const watchedValues = watch();
    
    const { irn, irnGeneratedAt, ackNo, plantId, consignorId, consigneeId, gstRate, isShipToSame, shipToId, invoiceType, chargeType, otaApplicable, otaDate, qrCodeDataUrl } = watchedValues;
    
    const selectedConsignor = useMemo(() => dbPlants?.find(p => p.id === consignorId), [dbPlants, consignorId]);
    const selectedConsignee = useMemo(() => dbParties?.find(p => p.id === consigneeId), [dbParties, consigneeId]);
    const selectedShipTo = useMemo(() => isShipToSame ? selectedConsignee : dbParties?.find(p => p.id === shipToId), [isShipToSame, selectedConsignee, dbParties, shipToId]);

    const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    const resolvedIrnDate = useMemo(() => {
        if (!irnGeneratedAt) return null;
        return irnGeneratedAt instanceof Timestamp ? irnGeneratedAt.toDate() : new Date(irnGeneratedAt);
    }, [irnGeneratedAt]);

    const isFullyLocked = useMemo(() => {
        if (isAdminSession) return false;
        if (invoice.paymentStatus?.includes('Cancelled')) return true;
        return isTimeLocked;
    }, [isAdminSession, invoice.paymentStatus, isTimeLocked]);

    const supplyChainContext = useMemo(() => {
        const consignor = dbPlants?.find(p => p.id === plantId);
        const consignee = dbParties?.find(p => p.id === consigneeId);
        if (!consignor || !consignee) return { isInterState: false };
        return { isInterState: consignor.stateCode !== consignee.stateCode };
    }, [dbPlants, dbParties, plantId, consigneeId]);

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

    const filteredMasterItems = useMemo(() => {
        if (!dbMasterItems || !plantId || !invoiceType || !chargeType) return [];
        const normalizedTarget = normalizePlantId(plantId).toLowerCase();
        
        return dbMasterItems.filter(item => {
            const plantMatch = normalizePlantId(item.plantId).toLowerCase() === normalizedTarget;
            const itMatch = item.invoiceTypeId === invoiceType;
            const ctMatch = item.chargeTypeId === chargeType;
            if (!plantMatch || !itMatch || !ctMatch) return false;

            if (otaApplicable) {
                if (!otaDate || !item.ota || !item.validityDate) return false;
                const itemDate = (item.validityDate as any).toDate ? (item.validityDate as any).toDate() : new Date(item.validityDate);
                return format(itemDate, 'yyyyMMdd') === format(otaDate, 'yyyyMMdd');
            } else {
                if (item.ota) return false;
                const start = item.validFrom ? ((item.validFrom as any).toDate ? (item.validFrom as any).toDate() : new Date(item.validFrom)) : null;
                const end = item.validTo ? ((item.validTo as any).toDate ? (item.validTo as any).toDate() : new Date(item.validTo)) : null;
                if (!start || !end) return false;
                return watchedValues.invoiceDate >= start && watchedValues.invoiceDate <= end;
            }
        });
    }, [dbMasterItems, plantId, invoiceType, chargeType, otaApplicable, otaDate, watchedValues.invoiceDate]);

    const handleItemSelect = useCallback((index: number, masterId: string) => {
        const master = filteredMasterItems.find(m => m.id === masterId);
        if (master) {
            setValue(`items.${index}.itemDescription`, master.itemDescription);
            setValue(`items.${index}.hsnSac`, master.hsnSac);
            setValue(`items.${index}.rate`, master.rate);
            const uomLabel = allUnitTypes?.find(ut => ut.id === master.unitTypeId)?.name || 'MT';
            setValue(`items.${index}.uom`, uomLabel);
            const currentQty = watchedItems[index]?.qty || 0;
            setValue(`items.${index}.amount`, Number((currentQty * master.rate).toFixed(2)));
            setValue('gstRate', master.isGstApplicable ? (master.gstRate || 12) : 0);
        }
    }, [filteredMasterItems, allUnitTypes, setValue, watchedItems]);

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (isFullyLocked && !isAdminSession) return;
            const items = event.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (!file) continue;
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        setValue('qrCodeDataUrl', e.target?.result as string, { shouldValidate: true });
                        toast({ title: 'QR Node Captured', description: 'Registry Handshake OK.' });
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
    }, [isFullyLocked, isAdminSession, setValue, toast]);

    const handlePasteAreaClick = () => {
        if ((!isFullyLocked || isAdminSession) && !qrCodeDataUrl) {
            setShowPasteButton(true);
            qrPasteRef.current?.focus();
        }
    };

    const handleClipboardPaste = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFullyLocked && !isAdminSession) return;
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

    const onSubmit = useCallback(async (data: FormValues) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
            const finalTotals = { 
                taxableAmount: totals.taxable, 
                cgst: totals.cgst, 
                sgst: totals.sgst, 
                igst: totals.igst, 
                grandTotal: totals.grand, 
                amountInWords: totals.words, 
                roundOff: totals.roundOff, 
                isInterState: supplyChainContext.isInterState 
            };

            const payload: any = { 
                ...data, 
                totals: finalTotals, 
                docColumns, 
                itemColumns, 
                lastUpdatedAt: serverTimestamp(), 
                updatedBy: currentName 
            };

            if (data.irn?.trim() && !data.irnGeneratedAt) {
                payload.irnGeneratedAt = serverTimestamp();
            }

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

            const cleanedPayload = sanitize(payload);
            await updateDoc(doc(firestore, "invoices", invoice.id), cleanedPayload);
            
            setStatusBar({ message: `Registry Entry ${invoice.invoiceNo} corrected successfully.`, type: 'success' });
            toast({ title: "Registry Corrected", description: "All changes committed." });
        } catch (e: any) {
            setStatusBar({ message: e.message, type: 'error' });
        } finally { hideLoader(); }
    }, [firestore, user, invoice.id, invoice.invoiceNo, totals, supplyChainContext.isInterState, docColumns, itemColumns, isAdminSession, setStatusBar, showLoader, hideLoader, toast]);

    useEffect(() => {
        if (!isFullyLocked || isAdminSession) setSaveAction(() => handleSubmit(onSubmit)());
        return () => setSaveAction(null);
    }, [isFullyLocked, isAdminSession, setSaveAction, handleSubmit, onSubmit]);

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            {isFullyLocked && !isAdminSession && (
                <Alert variant="destructive" className="rounded-[2rem] bg-red-50 border-red-100 flex items-center gap-6 py-8 px-10 shadow-2xl">
                    <Lock className="h-10 w-10 text-red-600" />
                    <div>
                        <AlertTitle className="text-2xl font-black uppercase text-red-900 tracking-tight">MISSION REGISTRY LOCKED</AlertTitle>
                        <AlertDescription className="text-[11px] font-bold text-red-700 uppercase tracking-[0.2em] mt-2">
                            Invoice locked due to IRN time expiry. Standard sub-user node access is restricted for historical IRN records.
                        </AlertDescription>
                    </div>
                </Alert>
            )}

            <Form {...form}>
                <form className="space-y-12">
                    <Card className={cn("border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden transition-all", (isFullyLocked && !isAdminSession) && "opacity-80")}>
                        <CardHeader className="bg-white/5 border-b border-white/5 p-6 flex flex-row items-center justify-between pr-12">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-600 p-3 rounded-2xl shadow-lg"><ShieldCheck className="h-6 w-6" /></div>
                                <h2 className="text-xl font-black uppercase tracking-tight italic">VF02 – Change Billing Document</h2>
                            </div>
                            <div className="flex items-center gap-6">
                                {resolvedIrnDate && (
                                    <IRNCountdown generatedAt={resolvedIrnDate} onExpire={() => setIsTimeLocked(true)} />
                                )}
                                {(!isFullyLocked || isAdminSession) && (
                                    <Button type="button" variant="outline" onClick={() => setIsAddDocColOpen(true)} className="h-10 rounded-xl bg-white/10 border-white/20 text-white font-black uppercase text-[10px] tracking-widest px-6">Add Registry Column</Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-10 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 items-end">
                            <FormField name="plantId" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">PLANT ID *</FormLabel><FormControl><Input {...field} value={field.value ?? ""} readOnly className="h-11 bg-white/5 border-white/10 text-slate-400 font-black uppercase" /></FormControl></FormItem>)} />
                            
                            <FormField name="invoiceType" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Invoice Type *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={isFullyLocked && !isAdminSession}>
                                        <FormControl><SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{dbInvoiceTypes?.filter(it => it.plantId === plantId).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="chargeType" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Charge Type *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={isFullyLocked && !isAdminSession}>
                                        <FormControl><SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{dbChargeTypes?.filter(ct => ct.plantId === plantId).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />

                            <FormField name="invoiceNo" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Invoice No *</FormLabel><FormControl><Input readOnly {...field} value={field.value ?? ""} className="h-11 bg-white/5 border-white/10 text-blue-400 font-black" /></FormControl></FormItem>)} />
                            <FormField name="invoiceDate" control={control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Date *</FormLabel>
                                    <FormControl>
                                        <div className="h-11 bg-white/5 border border-white/10 rounded-xl px-3 flex items-center">
                                            <DatePicker 
                                                date={field.value} 
                                                setDate={field.onChange} 
                                                disabled={isFullyLocked && !isAdminSession} 
                                                className="w-full border-none bg-transparent p-0 h-10 text-white" 
                                                calendarProps={{ disabled: { after: new Date() } }}
                                            />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            
                            <FormField name="billMonth" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Bill Month *</FormLabel><FormControl><Input placeholder="MM/YYYY" {...field} value={field.value ?? ''} className="h-11 bg-white/5 border-white/10 uppercase" disabled={isFullyLocked && !isAdminSession} /></FormControl></FormItem>)} />
                            <FormField name="irn" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">IRN Number</FormLabel><FormControl><Input readOnly={isFullyLocked && !isAdminSession} {...field} value={field.value ?? ''} className="h-11 bg-white/5 border-white/10 text-emerald-400 font-mono text-xs uppercase" /></FormControl></FormItem>)} />
                            <FormField name="ackNo" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">ACK Number</FormLabel><FormControl><Input readOnly={isFullyLocked && !isAdminSession} {...field} value={field.value ?? ''} className="h-11 bg-white/5 border-white/10" /></FormControl></FormItem>)} />
                            <FormField name="ackDate" control={control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">ACK Date</FormLabel>
                                    <FormControl>
                                        <div className="h-11 bg-white/5 border border-white/10 rounded-xl px-3 flex items-center">
                                            <DatePicker 
                                                date={field.value} 
                                                setDate={field.onChange} 
                                                disabled={isFullyLocked && !isAdminSession} 
                                                className="w-full border-none bg-transparent p-0 h-10 text-white" 
                                                calendarProps={{ disabled: { after: new Date() } }}
                                            />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            
                            <FormField name="qrCodeDataUrl" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-blue-400 flex justify-between">
                                        QR Code 
                                        <span className={cn("lowercase font-bold", (irn?.trim() && ackNo?.trim()) ? "text-red-500" : "text-emerald-500")}>
                                            ({(irn?.trim() && ackNo?.trim()) ? "mandatory" : "optional"})
                                        </span>
                                    </FormLabel>
                                    <FormControl>
                                        <div 
                                            ref={qrPasteRef} 
                                            tabIndex={(isFullyLocked && !isAdminSession) ? -1 : 0}
                                            onClick={handlePasteAreaClick}
                                            className={cn(
                                                "relative h-24 w-full flex items-center justify-center bg-white border-2 border-dashed rounded-xl transition-all outline-none focus:ring-2 focus:ring-primary overflow-hidden", 
                                                (isFullyLocked && !isAdminSession) ? "opacity-50 cursor-not-allowed border-slate-300" : "cursor-pointer hover:bg-slate-50 border-slate-300", 
                                                errors.qrCodeDataUrl ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]" : ""
                                            )} 
                                        >
                                            {field.value ? (
                                                <div className="relative group/qr h-full w-full flex items-center justify-center p-2">
                                                    <Image src={field.value} alt="QR Node" fill className="object-contain" unoptimized />
                                                    {(!isFullyLocked || isAdminSession) && (
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/qr:opacity-100 flex items-center justify-center transition-opacity gap-2">
                                                            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsQrEnlarged(true); }} className="text-white hover:bg-white/20">
                                                                <Maximize2 className="h-5 w-5" />
                                                            </Button>
                                                            <Button type="button" variant="destructive" size="icon" onClick={(e) => { e.stopPropagation(); setValue('qrCodeDataUrl', '', { shouldValidate: true }); }} className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700">
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : showPasteButton && (!isFullyLocked || isAdminSession) ? (
                                                <Button 
                                                    type="button" 
                                                    onClick={handleClipboardPaste}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-6 h-9 rounded-lg"
                                                >
                                                    PASTE
                                                </Button>
                                            ) : (
                                                <div className="flex flex-col items-center text-center px-4">
                                                    <ClipboardPaste className="w-6 h-6 mb-1 text-muted-foreground" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{(isFullyLocked && !isAdminSession) ? "Locked" : "Click to Paste QR"}</span>
                                                </div>
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="flex flex-wrap items-end gap-6 col-span-2 bg-white/5 p-4 rounded-xl border border-white/5">
                                <FormField control={form.control} name="otaApplicable" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">One-Time (OTA)</FormLabel>
                                        <Button type="button" variant="outline" size="icon" onClick={() => !isFullyLocked && field.onChange(!field.value)} disabled={isFullyLocked && !isAdminSession} className={cn("mt-2 rounded-xl h-11 w-11 bg-white/5 border-white/10", field.value ? "text-emerald-400" : "text-white/20")}>
                                            {field.value ? <ToggleRight className="h-6 w-6"/> : <ToggleLeft className="h-6 w-6"/>}
                                        </Button>
                                    </FormItem>
                                )} />
                                {otaApplicable && (
                                    <FormField control={form.control} name="otaDate" render={({ field }) => (
                                        <FormItem className="flex flex-col flex-1 animate-in fade-in slide-in-from-left-2 duration-300">
                                            <FormLabel className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">OTA Validity Node *</FormLabel>
                                            <FormControl>
                                                <div className="h-11 bg-white/5 border border-emerald-400/20 rounded-xl px-3 flex items-center">
                                                    <DatePicker 
                                                        date={field.value} 
                                                        setDate={field.onChange} 
                                                        disabled={isFullyLocked && !isAdminSession} 
                                                        className="w-full border-none bg-transparent p-0 h-10 text-white" 
                                                        calendarProps={{ disabled: { after: new Date() } }}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>

                            {docColumns.map((col, idx) => (
                                <FormField key={idx} name={`docCustomValues.${col}`} control={control} render={({ field: cField }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-400">{col}</FormLabel><FormControl><Input readOnly={isFullyLocked && !isAdminSession} {...cField} value={cField.value ?? ""} className="h-11 bg-white/5 border-white/10" /></FormControl></FormItem>
                                )} />
                            ))}
                        </CardContent>
                        <CardFooter className="bg-white/5 px-10 py-3 flex items-center gap-4 text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">
                            <History className="h-3 w-3" />
                            <span>Last Sync Registry: {invoice.lastUpdatedAt ? format(invoice.lastUpdatedAt instanceof Timestamp ? invoice.lastUpdatedAt.toDate() : new Date(invoice.lastUpdatedAt), 'dd-MM-yyyy HH:mm:ss') : 'Initial Commit'}</span>
                            <Separator orientation="vertical" className="h-3 bg-white/10" />
                            <span>Modified By: {invoice.updatedBy || invoice.userName || 'System'}</span>
                        </CardFooter>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <Card className="lg:col-span-4 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
                            <CardHeader className="bg-slate-50 border-b p-6 flex items-center gap-3">
                                <div className="p-2 bg-blue-900 text-white rounded-lg"><ShieldCheck className="h-4 w-4" /></div>
                                <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-[0.2em]">Consignor</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 flex-1 flex flex-col">
                                <FormField name="consignorId" control={control} render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Node Registry</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={isFullyLocked && !isAdminSession}>
                                            <FormControl><SelectTrigger className="h-11 bg-white font-bold border-slate-200 shadow-sm"><SelectValue placeholder="Select Consignor" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                {dbPlants?.filter(p => normalizePlantId(p.id).toLowerCase() === normalizePlantId(plantId).toLowerCase()).map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5 uppercase">{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
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
                            <CardHeader className="bg-slate-50 border-b p-6 flex items-center gap-3">
                                <div className="p-2 bg-emerald-600 text-white rounded-lg"><UserCircle className="h-4 w-4" /></div>
                                <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-[0.2em]">Consignee</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 flex-1 flex flex-col">
                                <FormField name="consigneeId" control={control} render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Buyer Registry</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={isFullyLocked && !isAdminSession}>
                                            <FormControl><SelectTrigger className="h-11 bg-white font-bold border-slate-200 shadow-sm"><SelectValue placeholder="Select Consignee" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                {dbParties?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name}</SelectItem>)}
                                            </SelectContent>
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

                        <Card className={cn("lg:col-span-4 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden transition-all flex flex-col", isShipToSame && "opacity-50")}>
                            <CardHeader className="bg-slate-50 border-b p-6 flex items-center gap-3">
                                <div className="p-2 bg-indigo-600 text-white rounded-lg"><MapPin className="h-4 w-4" /></div>
                                <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-[0.2em]">Ship to</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 flex-1 flex flex-col">
                                <FormField name="shipToId" control={control} render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Drop Registry</FormLabel>
                                        <Select onValueChange={field.onChange} value={isShipToSame ? consigneeId : (field.value ?? '')} disabled={isFullyLocked && !isAdminSession || isShipToSame}>
                                            <FormControl><SelectTrigger className="h-11 bg-white font-bold border-slate-200 shadow-sm"><SelectValue placeholder="Select drop party" /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                {dbParties?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name}</SelectItem>)}
                                            </SelectContent>
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
                        <CardHeader className="bg-slate-900 border-b p-6 flex flex-row items-center justify-between text-white">
                            <div className="flex items-center gap-3"><ListTree className="h-5 w-5 text-blue-400" /><CardTitle className="text-sm font-black uppercase">Consignment Item Manifest</CardTitle></div>
                            {(!isFullyLocked || isAdminSession) && (
                                <div className="flex gap-3">
                                    <Button type="button" size="sm" onClick={() => setIsAddItemColOpen(true)} className="bg-white/10 text-white font-black text-[10px] rounded-xl px-6 h-9 hover:bg-white/20">Add Header Node</Button>
                                    <Button type="button" size="sm" onClick={() => append({ masterItemId: '', itemDescription: '', hsnSac: '', qty: 1, rate: 0, amount: 0, itemCustomValues: {} })} className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-xl px-6 h-9 shadow-lg">
                                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add New Row
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table className="w-full min-w-[1200px]">
                                    <TableHeader className="bg-slate-50 border-b">
                                        <TableRow className="h-14">
                                            <TableHead className="w-16 text-center text-[10px] font-black uppercase text-slate-400">Sr</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-slate-400 px-6">Description of Goods</TableHead>
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
                                                    <FormField name={`items.${index}.masterItemId`} control={control} render={({ field: itm }) => (
                                                        <Select onValueChange={(val) => { itm.onChange(val); handleItemSelect(index, val); }} value={itm.value ?? ''} disabled={isFullyLocked && !isAdminSession}>
                                                            <FormControl><SelectTrigger className="border-none font-black text-blue-900 text-[11px] bg-transparent shadow-none h-10"><SelectValue placeholder="Registry Fetch..." /></SelectTrigger></FormControl>
                                                            <SelectContent className="rounded-xl">{filteredMasterItems.map(m => <SelectItem key={m.id} value={m.id} className="font-bold py-3 uppercase italic">{m.itemDescription}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    )} />
                                                </TableCell>
                                                {itemColumns.map((col, cIdx) => (
                                                    <TableCell key={cIdx} className="px-4">
                                                        <FormField name={`items.${index}.itemCustomValues.${col}`} control={control} render={({ field: cField }) => (
                                                            <FormControl><Input readOnly={isFullyLocked && !isAdminSession} {...cField} value={cField.value ?? ""} className="h-9 border border-slate-100 bg-slate-50/50 text-[11px] font-black uppercase" placeholder={col} /></FormControl>
                                                        )} />
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-center"><FormField name={`items.${index}.hsnSac`} control={control} render={({ field: itm }) => (<Input readOnly {...itm} value={itm.value ?? ""} className="border-none bg-transparent text-center font-mono text-[11px] font-bold shadow-none" />)} /></TableCell>
                                                <TableCell className="px-4">
                                                    <FormField name={`items.${index}.qty`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input readOnly={isFullyLocked && !isAdminSession} type="number" {...itm} value={itm.value ?? 0} onChange={e => { itm.onChange(e); const currentRate = form.getValues(`items.${index}.rate`) || 0; setValue(`items.${index}.amount`, Number((Number(e.target.value) * currentRate).toFixed(2))); }} className="border-slate-200 h-10 font-black text-blue-900 text-center rounded-xl shadow-inner text-base" /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-2"><FormField name={`items.${index}.uom`} control={control} render={({ field: itm }) => (<FormControl><Input readOnly className="border-none bg-transparent text-center font-black text-[10px] uppercase text-slate-400 shadow-none" {...itm} value={itm.value ?? ""} /></FormControl>)} /></TableCell>
                                                <TableCell className="px-2">
                                                    <FormField name={`items.${index}.rate`} control={control} render={({ field: itm }) => (
                                                        <FormControl><Input readOnly={isFullyLocked && !isAdminSession} type="number" {...itm} value={itm.value ?? 0} onChange={e => { itm.onChange(e); const currentQty = form.getValues(`items.${index}.qty`) || 0; setValue(`items.${index}.amount`, Number((Number(e.target.value) * currentQty).toFixed(2))); }} className="border-slate-200 h-10 font-black text-slate-900 text-right rounded-xl shadow-inner" /></FormControl>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="text-right pr-8 font-black text-blue-900 bg-blue-50/30 text-[12px]">₹ {(watchedItems[index]?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell><Button type="button" variant="ghost" size="icon" className="text-slate-200 group-hover:text-red-600 transition-colors" onClick={() => remove(index)} disabled={fields.length === 1 || (isFullyLocked && !isAdminSession)}><Trash2 className="h-4 w-4" /></Button></TableCell>
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

function EditInvoicePageContent() {
    const searchParams = useSearchParams();
    const invoiceId = searchParams.get('invoiceId');
    const firestore = useFirestore();
    const [invoice, setInvoice] = useState<WithId<Invoice> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!invoiceId || !firestore) return;
        const fetchInvoice = async () => {
            setLoading(true);
            const docRef = doc(firestore, "invoices", invoiceId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                setInvoice({ id: snap.id, ...snap.data() } as WithId<Invoice>);
            }
            setLoading(false);
        };
        fetchInvoice();
    }, [invoiceId, firestore]);

    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-blue-900" /></div>;
    if (!invoice) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400 font-black uppercase">Document Node Not Found</div>;

    return <EditInvoiceForm invoice={invoice} />;
}

export default function EditInvoicePage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-blue-900" /></div>}>
            <div className="p-8">
                <EditInvoicePageContent />
            </div>
        </Suspense>
    );
}
