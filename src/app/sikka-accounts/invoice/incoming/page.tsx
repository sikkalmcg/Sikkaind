
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { useToast } from '@/hooks/use-toast';
import { QtyTypes } from '@/lib/constants';
import type { Customer, Plant, WithId, VendorInvoice, VendorInvoiceItem, Party, SubUser } from '@/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Loader2, 
    Trash2, 
    PlusCircle, 
    Search, 
    X, 
    CheckCircle2, 
    ShieldCheck, 
    Factory, 
    Wallet, 
    AlertCircle, 
    UserCircle, 
    Calculator, 
    Landmark, 
    MapPin,
    Upload,
    FileText,
    Plus,
    Save,
    ArrowUpDown,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn, normalizePlantId } from '@/lib/utils';
import { format, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, addDoc, serverTimestamp, getDoc, doc, getDocs, limit } from 'firebase/firestore';
import { useLoading } from '@/context/LoadingContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

const formSchema = z.object({
  invoiceNo: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.date({ required_error: "Invoice Date is required" }),
  poNumber: z.string().optional(),
  vendorId: z.string().min(1, 'Vendor selection is required'),
  plantId: z.string().min(1, 'Plant ID is required'),
  firmDocId: z.string().min(1, 'Firm selection is required'),
  isGstApplicable: z.boolean().default(true),
  gstRate: z.coerce.number().default(18),
  docCustomValues: z.record(z.any()).optional(),
  invoiceFileUrl: z.string().optional(),
  items: z.array(z.object({
    itemDescription: z.string().min(1, "Description is required"),
    hsnSac: z.string().optional(),
    qty: z.coerce.number().positive(),
    qtyType: z.enum(QtyTypes),
    rate: z.coerce.number().positive(),
    amount: z.coerce.number(),
  })).min(1, "At least one item is required."),
  invoiceFile: z.any().optional()
    .refine((files) => !files || files?.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 2MB.`)
    .refine((files) => !files || files?.length === 0 || ACCEPTED_FILE_TYPES.includes(files?.[0]?.type), "Only PDF, JPG, PNG are supported."),
});

type FormValues = z.infer<typeof formSchema>;

function VendorAutocomplete({ 
    value, 
    onChange, 
    vendors,
    onVendorSelect 
}: { 
    value: string; 
    onChange: (val: string) => void; 
    vendors: WithId<Party>[];
    onVendorSelect: (vendor: WithId<Party>) => void;
}) {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'id' | 'gstin', direction: 'asc' | 'desc' } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        const s = inputValue.toLowerCase().trim();
        let result = vendors;
        
        if (s !== '') {
            result = vendors.filter(v => 
                v.name.toLowerCase().includes(s) || 
                v.gstin?.toLowerCase().includes(s) ||
                v.pan?.toLowerCase().includes(s) ||
                v.address?.toLowerCase().includes(s) || 
                v.id.toLowerCase().includes(s) ||
                v.state?.toLowerCase().includes(s)
            );
        }

        if (sortConfig) {
            result = [...result].sort((a, b) => {
                const aVal = (a[sortConfig.key] || '').toLowerCase();
                const bVal = (b[sortConfig.key] || '').toLowerCase();
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result.slice(0, 50);
    }, [inputValue, vendors, sortConfig]);

    useEffect(() => {
        const vendor = vendors.find(v => v.id === value);
        if (vendor) setInputValue(vendor.name);
    }, [value, vendors]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [filtered.length]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true);
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filtered[selectedIndex]) {
                    confirmSelection(filtered[selectedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const confirmSelection = (vendor: WithId<Party>) => {
        onChange(vendor.id);
        onVendorSelect(vendor);
        setIsOpen(false);
        setSelectedIndex(0);
    };

    const handleSort = (key: 'name' | 'id' | 'gstin') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                <Input 
                    value={inputValue}
                    onChange={(e) => { setInputValue(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search Name, GSTIN, PAN, PIN Code or State (F4 help)..."
                    className={cn(
                        "pl-10 h-11 rounded-xl bg-white border-slate-200 font-bold transition-all shadow-sm focus-visible:ring-blue-900",
                        isOpen && "bg-blue-50 text-black border-blue-400"
                    )}
                />
            </div>
            
            {isOpen && (
                <div className="absolute z-50 w-full md:w-[600px] mt-2 bg-white border border-slate-200 rounded-2xl shadow-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Search className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Vendor Search Handbook Node</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{filtered.length} Matches</span>
                    </div>

                    <div className="border-b bg-slate-50 flex items-center">
                        <button onClick={() => handleSort('name')} className="flex-1 px-4 py-2 text-[9px] font-black uppercase text-slate-500 hover:bg-slate-100 flex items-center gap-1 border-r">
                            Vendor Name <ArrowUpDown className="h-2.5 w-2.5" />
                        </button>
                        <button onClick={() => handleSort('id')} className="w-24 px-4 py-2 text-[9px] font-black uppercase text-slate-500 hover:bg-slate-100 flex items-center gap-1 border-r">
                            Code <ArrowUpDown className="h-2.5 w-2.5" />
                        </button>
                        <button onClick={() => handleSort('gstin')} className="w-32 px-4 py-2 text-[9px] font-black uppercase text-slate-500 hover:bg-slate-100 flex items-center gap-1">
                            GSTIN <ArrowUpDown className="h-2.5 w-2.5" />
                        </button>
                    </div>

                    <div className="max-h-80 overflow-auto" ref={scrollRef}>
                        {filtered.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] text-[10px]">No records found matching criteria.</div>
                        ) : (
                            filtered.map((vendor, idx) => {
                                const isSelected = selectedIndex === idx;
                                return (
                                    <div 
                                        key={vendor.id}
                                        className={cn(
                                            "flex items-center transition-colors border-b border-slate-50 cursor-pointer",
                                            isSelected ? "bg-blue-100 text-black border-blue-200" : "hover:bg-blue-50 text-slate-600"
                                        )}
                                        onClick={() => setSelectedIndex(idx)}
                                        onDoubleClick={() => confirmSelection(vendor)}
                                    >
                                        <div className="flex-1 px-4 py-3 min-w-0">
                                            <p className="text-xs font-black uppercase truncate">{vendor.name}</p>
                                            <p className="text-[9px] font-medium text-slate-400 truncate mt-0.5">{vendor.address || 'N/A'}</p>
                                        </div>
                                        <div className="w-24 px-4 font-mono text-[10px] font-black text-blue-900 border-l border-slate-50/50">
                                            {vendor.id.slice(-6).toUpperCase()}
                                        </div>
                                        <div className="w-32 px-4 font-mono text-[10px] font-bold text-slate-500 border-l border-slate-50/50">
                                            {vendor.gstin || '--'}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    
                    <div className="p-3 bg-slate-50 border-t flex items-center justify-between shrink-0">
                        <div className="flex gap-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                            <span className="flex items-center gap-1.5"><Badge className="h-4 px-1 rounded-sm text-[8px] bg-white border border-slate-300 text-slate-600">Enter</Badge> Confirm</span>
                            <span className="flex items-center gap-1.5"><Badge className="h-4 px-1 rounded-sm text-[8px] bg-white border border-slate-300 text-slate-600">Esc</Badge> Close</span>
                        </div>
                        {filtered.length > 0 && (
                            <Button 
                                size="sm" 
                                className="h-7 bg-blue-900 text-white font-black uppercase text-[9px] tracking-widest"
                                onClick={() => confirmSelection(filtered[selectedIndex])}
                            >
                                Select Entry
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function IncomingInvoicePage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { showLoader, hideLoader } = useLoading();
    const { setSaveAction, setCancelAction, setStatusBar } = useSikkaAccountsPage();
    
    const [selectedVendor, setSelectedVendor] = useState<WithId<Party> | null>(null);
    const [selectedFirm, setSelectedFirm] = useState<WithId<Plant> | null>(null);
    const [docColumns, setDocColumns] = useState<string[]>([]);
    const [isAddDocColOpen, setIsAddDocColOpen] = useState(false);
    const [newColTitle, setNewColTitle] = useState('');

    // ACCOUNTS REGISTRY HANDSHAKE
    const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_parties"), where("isDeleted", "==", false)) : null, [firestore]);
    const { data: allParties } = useCollection<Party>(partiesQuery);
    const vendors = useMemo(() => (allParties || []), [allParties]);

    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants"), orderBy("createdAt", "desc")) : null, [firestore]);
    const { data: allAccountFirms } = useCollection<Plant>(plantsQuery);

    const plantIds = useMemo(() => {
        if (!allAccountFirms) return [];
        return Array.from(new Set(allAccountFirms.map(f => f.id))).sort();
    }, [allAccountFirms]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            invoiceNo: '',
            invoiceDate: new Date(),
            items: [{ itemDescription: '', hsnSac: '', qty: 1, qtyType: 'MT', rate: 0, amount: 0 }],
            isGstApplicable: true,
            gstRate: 18,
            docCustomValues: {},
            invoiceFileUrl: ''
        },
    });

    const { control, setValue, handleSubmit, reset, watch } = form;
    
    const watchedItems = useWatch({ control, name: 'items' }) || [];
    const watchedPlantId = useWatch({ control, name: 'plantId' });
    const watchedIsGstApplicable = useWatch({ control, name: 'isGstApplicable' });
    const watchedGstRate = useWatch({ control, name: 'gstRate' });
    const watchedInvoiceFileUrl = useWatch({ control, name: 'invoiceFileUrl' });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });

    const availableFirms = useMemo(() => {
        if (!watchedPlantId || !allAccountFirms) return [];
        return allAccountFirms.filter(f => f.id === watchedPlantId);
    }, [watchedPlantId, allAccountFirms]);

    useEffect(() => {
        if (availableFirms.length === 1) {
            setValue('firmDocId', availableFirms[0].id);
            setSelectedFirm(availableFirms[0]);
        } else {
            setValue('firmDocId', '');
            setSelectedFirm(null);
        }
    }, [availableFirms, setValue]);

    const isIntraState = useMemo(() => {
        if (!selectedVendor || !selectedFirm) return true;
        return selectedVendor.stateCode === selectedFirm.stateCode;
    }, [selectedVendor, selectedFirm]);

    // Financial calculations synchronized with F110 naming convention
    const financials = useMemo(() => {
        const taxableAmount = watchedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

        if (watchedIsGstApplicable && taxableAmount > 0 && selectedVendor && selectedFirm) {
            const totalGst = (taxableAmount * watchedGstRate) / 100;

            if (isIntraState) {
                cgstAmount = Number((totalGst / 2).toFixed(2));
                sgstAmount = Number((totalGst / 2).toFixed(2));
            } else {
                igstAmount = Number(totalGst.toFixed(2));
            }
        }

        const grossAmount = Number((taxableAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2));
        return { taxableAmount, cgstAmount, sgstAmount, igstAmount, grossAmount, gstAmount: Number((cgstAmount + sgstAmount + igstAmount).toFixed(2)) };
    }, [watchedItems, watchedIsGstApplicable, watchedGstRate, selectedVendor, selectedFirm, isIntraState]);

    useEffect(() => {
        const subscription = watch((value, { name }) => {
            if (name?.startsWith('items.')) {
                const parts = name.split('.');
                const index = parseInt(parts[1], 10);
                const field = parts[2];
                if (field === 'qty' || field === 'rate') {
                    const item = value.items?.[index];
                    if (item) {
                        const amt = Number((Number(item.qty || 0) * Number(item.rate || 0)).toFixed(2));
                        setValue(`items.${index}.amount`, amt);
                    }
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [watch, setValue]);

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleAddDocColumn = () => {
        if (newColTitle.trim()) {
            setDocColumns(prev => [...prev, newColTitle]);
            setValue(`docCustomValues.${newColTitle}`, "");
            setNewColTitle('');
            setIsAddDocColOpen(false);
        }
    };

    const handleRemoveFile = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setValue('invoiceFile', undefined);
        setValue('invoiceFileUrl', '');
        toast({ title: 'Registry Purged', description: 'Document attachment removed from manifest.' });
    };

    const onSubmit = useCallback(async (data: FormValues) => {
        if (!firestore) return;
        showLoader();
        try {
            let fileUrl = data.invoiceFileUrl || '';
            if (data.invoiceFile && data.invoiceFile.length > 0) {
                fileUrl = await convertFileToBase64(data.invoiceFile[0]);
            }

            const payload: any = {
                ...data,
                ...financials,
                isIntraState,
                vendorName: selectedVendor?.name,
                vendorGstin: selectedVendor?.gstin || '',
                vendorPan: selectedVendor?.pan || '',
                vendorState: selectedVendor?.state || '',
                vendorStateCode: selectedVendor?.stateCode || '',
                firmName: selectedFirm?.name,
                invoiceFileUrl: fileUrl,
                docColumns,
                createdAt: serverTimestamp(),
                paymentStatus: 'Open'
            };

            const sanitize = (obj: any): any => {
                if (Array.isArray(obj)) return obj.map(sanitize);
                if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && obj.constructor?.name !== 'FieldValue') {
                    return Object.fromEntries(
                        Object.entries(obj).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, sanitize(v)])
                    );
                }
                return obj;
            };

            const cleanedPayload = sanitize(payload);
            delete cleanedPayload.invoiceFile;

            const colRef = collection(firestore, "vendor_invoices");
            addDoc(colRef, cleanedPayload)
                .then(() => {
                    toast({ title: "Registry Updated", description: `Incoming invoice ${data.invoiceNo} recorded (MIRO).` });
                    reset();
                    setSelectedVendor(null);
                    setSelectedFirm(null);
                    setDocColumns([]);
                })
                .catch(async (error) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: colRef.path,
                        operation: 'create',
                        requestResourceData: cleanedPayload
                    } satisfies SecurityRuleContext));
                })
                .finally(() => hideLoader());
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Commit Error", description: e.message });
            hideLoader();
        }
    }, [firestore, financials, isIntraState, selectedVendor, selectedFirm, docColumns, reset, toast, showLoader, hideLoader]);

    const onCancelAction = useCallback(() => {
        reset();
        setSelectedVendor(null);
        setSelectedFirm(null);
        setDocColumns([]);
        setStatusBar({ message: "Form registry cleared.", type: 'warning' });
    }, [reset, setStatusBar]);

    useEffect(() => {
        setSaveAction(form.handleSubmit(onSubmit));
        setCancelAction(() => onCancelAction);
        return () => {
            setSaveAction(null);
            setCancelAction(null);
        };
    }, [setSaveAction, setCancelAction, handleSubmit, onSubmit, onCancelAction, form]);

    return (
      <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 border-b pb-6">
            <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                <Wallet className="h-8 w-8" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">MIRO – Enter Incoming Invoice</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Vendor Liability Registry & Tax Handshake</p>
            </div>
        </div>

        <Form {...form}>
            <form className="space-y-10" onSubmit={handleSubmit(onSubmit)}>
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden">
                    <CardHeader className="bg-white/5 border-b border-white/5 p-6 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-lg"><ShieldCheck className="h-4 w-4" /></div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight">Registry Particulars</CardTitle>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 text-[9px] font-black h-6 uppercase tracking-widest">MIRO Standard Node</Badge>
                            <Button type="button" variant="outline" onClick={() => setIsAddDocColOpen(true)} className="h-8 rounded-xl bg-white/10 border-white/20 text-white font-black uppercase text-[9px] tracking-widest px-4">Add Registry Column</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-end">
                        <FormField name="vendorId" control={control} render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vendor Search Handbook *</FormLabel>
                                <VendorAutocomplete 
                                    value={field.value} 
                                    onChange={field.onChange} 
                                    vendors={vendors} 
                                    onVendorSelect={setSelectedVendor} 
                                />
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField name="plantId" control={control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plant ID Registry *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 bg-white/5 border-white/10 font-black uppercase shadow-sm"><SelectValue placeholder="Pick Node" /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">
                                        {plantIds.map(id => <SelectItem key={id} value={id} className="font-black">{id}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />

                        <FormField name="firmDocId" control={control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Firm Handbook Node *</FormLabel>
                                <Select onValueChange={(val) => { field.onChange(val); setSelectedFirm(availableFirms.find(f => f.id === val) || null); }} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 bg-white/5 border-white/10 font-bold shadow-sm"><SelectValue placeholder="Select Firm" /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">
                                        {availableFirms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField name="invoiceNo" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Vendor Invoice # *</FormLabel><FormControl><Input {...field} value={field.value ?? ""} className="h-11 bg-white/5 border-white/10 font-black uppercase text-blue-400 shadow-inner" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField name="invoiceDate" control={control} render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Invoice Date *</FormLabel>
                                <DatePicker 
                                    date={field.value} 
                                    setDate={field.onChange} 
                                    className="h-11 bg-white/5 border-white/10" 
                                    calendarProps={{ disabled: { after: new Date() } }}
                                />
                            </FormItem>
                        )} />
                        
                        <div className="flex flex-wrap items-end gap-6 bg-white/5 p-4 rounded-xl border border-white/5">
                            <FormField name="isGstApplicable" control={control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">GST Applicable</FormLabel>
                                    <div className="flex gap-1 bg-white/10 p-1 rounded-lg mt-1">
                                        <Button type="button" size="sm" variant={field.value ? 'default' : 'ghost'} className={cn("h-7 px-4 text-[9px] font-black uppercase", field.value && "bg-emerald-600")} onClick={() => field.onChange(true)}>YES</Button>
                                        <Button type="button" size="sm" variant={!field.value ? 'destructive' : 'ghost'} className="h-7 px-4 text-[9px] font-black uppercase" onClick={() => field.onChange(false)}>NO</Button>
                                    </div>
                                </FormItem>
                            )} />
                            {watchedIsGstApplicable && (
                                <FormField name="gstRate" control={control} render={({ field }) => (
                                    <FormItem className="flex-1 min-w-[80px]">
                                        <FormLabel className="text-[10px] font-black uppercase text-emerald-400">Rate %</FormLabel>
                                        <FormControl><Input type="number" {...field} value={field.value ?? ""} className="h-9 bg-white/5 border-emerald-500/30 text-emerald-400 font-black shadow-inner" /></FormControl>
                                    </FormItem>
                                )} />
                            )}
                        </div>

                        {docColumns.map((col, idx) => (
                            <FormField key={idx} name={`docCustomValues.${col}`} control={control} render={({ field: cField }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-400">{col} *</FormLabel><FormControl><Input {...cField} value={cField.value ?? ""} className="h-11 bg-white/5 border-white/10 text-white shadow-inner" /></FormControl></FormItem>
                            )} />
                        ))}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden flex flex-col">
                        <CardHeader className="bg-slate-50 border-b p-6 flex items-center gap-3">
                            <UserCircle className="h-4 w-4 text-blue-900" />
                            <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-widest">Vendor Registry Footprint</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-4">
                            {!selectedVendor ? (
                                <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-2">
                                    <Search className="h-10 w-10" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-center">Awaiting Selection Node</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-[10px] font-bold text-slate-500 uppercase animate-in fade-in duration-300">
                                    <div className="col-span-2 space-y-1.5 mb-2">
                                        <span className="text-[8px] font-black text-blue-400 uppercase">Vendor Name</span>
                                        <p className="text-slate-900 font-black text-xs uppercase leading-tight">{selectedVendor.name}</p>
                                    </div>
                                    <div className="col-span-2 p-3 bg-blue-50/50 rounded-xl border border-dashed border-blue-200">
                                        <span className="text-[8px] font-black text-blue-400 block mb-1 uppercase">Physical Registry Address</span>
                                        <p className="text-slate-800 font-bold italic leading-tight">"{selectedVendor.address}"</p>
                                    </div>
                                    <div><span className="text-slate-400 font-black block uppercase">GSTIN Registry</span> <span className="font-mono text-blue-900 text-[11px]">{selectedVendor.gstin || '--'}</span></div>
                                    <div><span className="text-slate-400 font-black block uppercase">PAN Registry</span> <span className="font-mono text-slate-900 font-bold">{selectedVendor.pan || '--'}</span></div>
                                    <div><span className="text-slate-400 font-black block uppercase">State Node</span> <span>{selectedVendor.state || '--'}</span></div>
                                    <div><span className="text-slate-400 font-black block uppercase">State Code</span> <span className="font-black text-slate-900">{selectedVendor.stateCode || '--'}</span></div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden flex flex-col">
                        <CardHeader className="bg-slate-50 border-b p-6 flex items-center gap-3">
                            <Factory className="h-4 w-4 text-emerald-700" />
                            <CardTitle className="text-[11px] font-black uppercase text-slate-700 tracking-widest">Plant Node Registry</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-4">
                            {!selectedFirm ? (
                                <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-2">
                                    <AlertCircle className="h-10 w-10" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-center">Awaiting Firm Resolve</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-[10px] font-bold text-slate-500 uppercase animate-in fade-in duration-300">
                                    <div className="col-span-2 space-y-1.5 mb-2">
                                        <span className="text-[8px] font-black text-emerald-400 uppercase">Firm Name</span>
                                        <p className="text-slate-900 font-black text-xs uppercase leading-tight">{selectedFirm.name}</p>
                                    </div>
                                    <div className="col-span-2 p-3 bg-emerald-50/50 rounded-xl border border-dashed border-emerald-200">
                                        <span className="text-[8px] font-black text-emerald-400 block mb-1 uppercase">Billing Address Node</span>
                                        <p className="text-slate-800 font-bold italic leading-tight">"{selectedFirm.address}"</p>
                                    </div>
                                    <div><span className="text-slate-400 font-black block uppercase">GSTIN Registry</span> <span className="font-mono text-emerald-700 text-[11px]">{selectedFirm.gstin || '--'}</span></div>
                                    <div><span className="text-slate-400 font-black block uppercase">PAN Registry</span> <span className="font-mono text-slate-900 font-bold">{selectedFirm.pan || '--'}</span></div>
                                    <div><span className="text-slate-400 font-black block uppercase">State Node</span> <span>{selectedFirm.state || '--'}</span></div>
                                    <div><span className="text-slate-400 font-black block uppercase">State Code</span> <span className="font-black text-slate-900">{selectedFirm.stateCode || '--'}</span></div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader className="bg-slate-900 border-b p-6 flex flex-row items-center justify-between text-white">
                        <div className="flex items-center gap-3"><ListTree className="h-5 w-5 text-blue-400" /><CardTitle className="text-sm font-black uppercase">Consignment Item Manifest</CardTitle></div>
                        <Button type="button" size="sm" onClick={() => append({ itemDescription: '', hsnSac: '', qty: 1, qtyType: 'MT', rate: 0, amount: 0 })} className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-xl px-6 h-9 shadow-lg">
                            <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add New Row
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader className="bg-slate-50 border-b">
                                    <TableRow className="h-14">
                                        <TableHead className="w-16 text-center text-[10px] font-black uppercase text-slate-400">Sr</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-slate-400 px-6">Description of Goods *</TableHead>
                                        <TableHead className="w-32 text-[10px] font-black uppercase text-slate-400 text-center">HSN/SAC</TableHead>
                                        <TableHead className="w-48 text-[10px] font-black uppercase text-slate-400 text-center">Qty *</TableHead>
                                        <TableHead className="w-32 text-[10px] font-black uppercase text-slate-400 text-center">Unit</TableHead>
                                        <TableHead className="w-48 text-[10px] font-black uppercase text-slate-400 text-right">Rate *</TableHead>
                                        <TableHead className="w-64 text-[10px] font-black uppercase text-slate-400 text-right bg-blue-50/50 pr-8">Taxable Amt</TableHead>
                                        <TableHead className="w-16"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id} className="h-16 border-b group">
                                            <TableCell className="text-center font-black text-slate-300 text-xs">{index + 1}</TableCell>
                                            <TableCell className="px-6">
                                                <FormField name={`items.${index}.itemDescription`} control={control} render={({ field: itm }) => (
                                                    <FormControl><Input placeholder="Registry Particulars..." className="h-10 border-none font-bold bg-transparent shadow-none" {...itm} value={itm.value ?? ""} /></FormControl>
                                                )} />
                                            </TableCell>
                                            <TableCell className="px-2">
                                                <FormField name={`items.${index}.hsnSac`} control={control} render={({ field: itm }) => (<FormControl><Input className="h-9 font-mono text-center text-[11px]" {...itm} value={itm.value ?? ""} /></FormControl>)} />
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <FormField name={`items.${index}.qty`} control={control} render={({ field: itm }) => (
                                                    <FormControl><Input type="number" {...itm} value={itm.value ?? 0} className="h-10 border-slate-200 font-black text-blue-900 text-center rounded-xl shadow-inner" /></FormControl>
                                                )} />
                                            </TableCell>
                                            <TableCell className="px-2">
                                                <FormField name={`items.${index}.qtyType`} control={control} render={({ field: itm }) => (
                                                    <Select onValueChange={itm.onChange} value={itm.value}>
                                                        <FormControl><SelectTrigger className="h-9 border-none bg-transparent shadow-none text-center font-bold text-[11px]"><SelectValue placeholder="Pick" /></SelectTrigger></FormControl>
                                                        <SelectContent>{QtyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                )} />
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <FormField name={`items.${index}.rate`} control={control} render={({ field: itm }) => (
                                                    <FormControl><Input type="number" {...itm} value={itm.value ?? 0} className="h-10 border-slate-200 font-black text-slate-900 text-right rounded-xl shadow-inner" /></FormControl>
                                                )} />
                                            </TableCell>
                                            <TableCell className="text-right pr-8 font-black text-blue-900 bg-blue-50/30 text-sm">
                                                ₹ {(watchedItems[index]?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                <Button type="button" variant="ghost" size="icon" className="text-slate-200 group-hover:text-red-600 transition-colors" onClick={() => remove(index)} disabled={fields.length === 1}><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <div className="bg-slate-900 text-white p-12 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-12 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-1000"><Calculator className="h-64 w-64" /></div>
                    <div className="space-y-10 text-center md:text-left z-10 flex-1">
                        <p className="text-[10px] font-black uppercase text-blue-300 tracking-[0.5em]">Aggregated Financial Liability Manifest</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                            <div className="space-y-1.5 min-w-max">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">TOTAL TAXABLE AMOUNT</span>
                                <span className="text-3xl font-black text-white tracking-tighter">₹ {financials.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            
                            {watchedIsGstApplicable && !isIntraState && (
                                <div className="space-y-1.5 min-w-max"><span className="text-[10px] font-black text-orange-500 uppercase tracking-widest block">IGST {watchedGstRate}%</span><span className="text-3xl font-black text-orange-400 tracking-tighter">₹ {financials.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                            )}
                            
                            {watchedIsGstApplicable && isIntraState && (
                                <>
                                    <div className="space-y-1.5 min-w-max"><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">CGST {(watchedGstRate/2)}%</span><span className="text-3xl font-black text-emerald-400 tracking-tighter">₹ {financials.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                    <div className="space-y-1.5 min-w-max"><span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">SGST {(watchedGstRate/2)}%</span><span className="text-3xl font-black text-emerald-400 tracking-tighter">₹ {financials.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="text-center md:text-right z-10 pr-4 flex flex-col items-center md:items-end w-fit">
                        <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">GROSS INVOICE AMOUNT</p>
                        <span className="text-6xl md:text-8xl font-black tracking-tighter text-shadow-2xl text-blue-400 block mb-4 transition-transform duration-500 group-hover:scale-105 whitespace-nowrap">₹ {financials.grossAmount.toLocaleString('en-IN')}</span>
                        <Badge className="bg-emerald-600 text-white font-black uppercase tracking-widest text-[11px] px-8 py-2.5 border-none shadow-xl rounded-full">VERIFIED REGISTRY TOTAL</Badge>
                    </div>
                </div>

                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-900" />
                        <CardTitle className="text-sm font-black uppercase">Document Attachments</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <FormField name="invoiceFile" control={control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Upload Invoice (PDF/JPG/PNG, Max 2MB) *</FormLabel>
                                <FormControl>
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all gap-2 group">
                                        <Upload className={cn("h-8 w-8 transition-colors", !!watchedInvoiceFileUrl ? "text-emerald-500" : "text-slate-300 group-hover:text-blue-500")} />
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-bold text-slate-500">
                                                {field.value?.[0]?.name || (!!watchedInvoiceFileUrl ? "Document Captured" : "Pick mission document")}
                                            </span>
                                            <span className="text-[9px] font-black text-slate-300 uppercase">Format: PDF, JPG, PNG (Max 2MB)</span>
                                        </div>
                                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                if (file.size > MAX_FILE_SIZE) {
                                                    toast({ variant: 'destructive', title: "Registry Violation", description: "File exceeds 2MB limit." });
                                                    return;
                                                }
                                                field.onChange(e.target.files);
                                                const reader = new FileReader();
                                                reader.onload = (event) => setValue('invoiceFileUrl', event.target?.result as string);
                                                reader.readAsDataURL(file);
                                            }
                                        }} />
                                    </label>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {watchedInvoiceFileUrl && (
                            <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-3xl border border-slate-200 animate-in zoom-in-95 duration-300 relative group/preview">
                                <div className="h-24 w-24 relative overflow-hidden rounded-xl border border-white shadow-md bg-white flex items-center justify-center">
                                    {watchedInvoiceFileUrl.startsWith('data:application/pdf') ? (
                                        <FileText className="h-12 w-12 text-blue-600" />
                                    ) : (
                                        <img src={watchedInvoiceFileUrl} alt="Invoice Preview" className="object-contain h-full w-full" />
                                    )}
                                </div>
                                <Button 
                                    variant="destructive" 
                                    size="icon" 
                                    onClick={handleRemoveFile}
                                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover/preview:opacity-100 transition-opacity"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Live Registry Synced</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
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
      </div>
    );
}

const ListTree = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12h-8"/><path d="M21 6H8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/></svg>
);
