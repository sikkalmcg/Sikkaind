'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileDown, Upload, Search, Edit2, Trash2, UserPlus, History, ShieldCheck, Save, Sparkles, Factory, ArrowUpDown, AlertCircle } from 'lucide-react';
import { PartyTypes } from '@/lib/constants';
import type { Party, WithId, PartyType, Plant, SubUser } from '@/types';
import { statesAndUTs } from '@/lib/states';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import EditPartyModal from './EditPartyModal';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, where, onSnapshot, orderBy } from "firebase/firestore";
import { Badge } from '@/components/ui/badge';
import { cn, normalizePlantId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const ITEMS_PER_PAGE = 10;

const formSchema = z.object({
  name: z.string().min(1, 'Party Name is required.'),
  type: z.enum(PartyTypes, { required_error: 'Type is required.' }),
  gstin: z.string().optional().or(z.literal('')).refine(val => !val || val.length === 15, "GSTIN must be 15 characters.").refine(val => !val || gstinRegex.test(val.toUpperCase()), {
    message: 'Invalid GSTIN Format (e.g. 09AAAAA0000A1Z0)'
  }),
  pan: z.string().optional().or(z.literal('')).refine(val => !val || panRegex.test(val.toUpperCase()), 'Invalid PAN format.'),
  mobile: z.string().optional().or(z.literal('')).refine(val => !val || /^\d{10}$/.test(val), 'Enter valid 10 digit mobile number'),
  address: z.string().min(1, 'Physical Address is mandatory.'),
  city: z.string().min(1, 'City is mandatory.'),
  state: z.string().optional().or(z.literal('')),
  stateCode: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

export default function PartyCreationTab() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [editingParty, setEditingParty] = useState<WithId<Party> | null>(null);
  const [isPanAutoFilled, setIsPanAutoFilled] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const partiesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, 
    [firestore]
  );
  const { data: parties, isLoading: isLoadingParties } = useCollection<Party>(partiesQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', type: undefined, gstin: '', pan: '', mobile: '', address: '', city: '', state: '', stateCode: '' },
  });

  const { handleSubmit, watch, reset, setValue, formState: { isSubmitting } } = form;
  const gstinValue = watch('gstin');

  useEffect(() => {
    if (gstinValue && gstinValue.length === 15) {
        const extractedPan = gstinValue.substring(2, 12).toUpperCase();
        setValue('pan', extractedPan, { shouldValidate: true });
        setIsPanAutoFilled(true);

        const code = gstinValue.substring(0, 2);
        const stateInfo = statesAndUTs.find(s => s.code === code);
        if (stateInfo) {
            setValue('state', stateInfo.name, { shouldValidate: true });
            setValue('stateCode', stateInfo.code, { shouldValidate: true });
        }
    } else if (!gstinValue) {
        setIsPanAutoFilled(false);
    }
  }, [gstinValue, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore) return;
    
    const newName = values.name.trim().toUpperCase();
    const newCity = values.city.trim().toUpperCase();
    const newState = values.state?.trim().toUpperCase() || '';
    const newAddress = values.address.trim().toUpperCase();

    const isDuplicate = (parties || []).some(p => 
        !p.isDeleted && 
        p.name.trim().toUpperCase() === newName &&
        (p.city || '').trim().toUpperCase() === newCity &&
        (p.state || '').trim().toUpperCase() === newState &&
        (p.address || '').trim().toUpperCase() === newAddress
    );

    if (isDuplicate) {
        toast({ 
            variant: 'destructive', 
            title: 'Duplicate Entry Blocked', 
            description: 'Duplicate Party Entry Not Allowed. Party Name, City, State and Physical Address already exist in the system.' 
        });
        return;
    }

    showLoader();
    try {
      await addDoc(collection(firestore, "logistics_parties"), {
        ...values,
        name: values.name.trim(),
        gstin: values.gstin?.toUpperCase() || '',
        pan: values.pan?.toUpperCase() || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });
      toast({ title: 'Success', description: 'Logistics party created successfully.' });
      form.reset({ name: '', type: undefined, gstin: '', pan: '', mobile: '', address: '', city: '', state: '', stateCode: '' });
      setIsPanAutoFilled(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        hideLoader();
    }
  };

  const handleTemplateDownload = () => {
    const headers = ["Party Name", "Type", "GSTIN", "PAN Number", "Contact Number", "Address", "City", "State"];
    const sampleData = [
        ["BigMart Retail", "Consignee & ship to", "07AABCD1234E1Z3", "AABCD1234E", "9876543210", "123 Industrial Hub", "New Delhi", "Delhi"],
        ["Tata Chemicals", "Consignor", "27AABCU9567L1Z5", "AABCU9567L", "9988776655", "Plot 42, Port Area", "Mumbai", "Maharashtra"]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logistics Party Template");
    XLSX.writeFile(wb, "Logistics_Party_Template.xlsx");
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore) return;

    setIsUploading(true);
    showLoader();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        let successCount = 0;
        let failedRecords: { row: number; error: string }[] = [];

        // Mapping Logic: Case-insensitive header handshake
        const getVal = (row: any, keys: string[]) => {
            const foundKey = Object.keys(row).find(k => keys.some(search => k.toLowerCase().replace(/\s/g, '') === search.toLowerCase().replace(/\s/g, '')));
            return foundKey ? row[foundKey]?.toString().trim() : '';
        };

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowNum = i + 2; 
          try {
            const name = getVal(row, ["Party Name", "Name", "Client Name"]);
            const type = getVal(row, ["Type", "Party Type", "Client Type"]);
            const gstin = getVal(row, ["GSTIN", "Gst No", "Gst", "GST Number"])?.toUpperCase() || '';
            const address = getVal(row, ["Address", "Location", "Full Address"]);
            const city = getVal(row, ["City", "Place"]);
            const state = getVal(row, ["State", "Province"]) || '';

            if (!name || !type || !address || !city) throw new Error("Missing Mandatory Field (Name, Type, Address, or City)");
            
            // Validate Type node with flexible mapping
            let matchedType = PartyTypes.find(t => t.toLowerCase() === type.toLowerCase());
            
            // Fallback for legacy "Consignee" label
            if (!matchedType && (type.toLowerCase() === 'consignee' || type.toLowerCase() === 'consignee & ship to')) {
                matchedType = 'Consignee & Ship to';
            }

            if (!matchedType) throw new Error(`Invalid Type: ${type}. Expected: Consignor or Consignee & Ship to`);
            
            const isDup = (parties || []).some(p => 
                !p.isDeleted && 
                p.name.trim().toUpperCase() === name.toUpperCase() &&
                (p.city || '').trim().toUpperCase() === city.toUpperCase() &&
                (p.address || '').trim().toUpperCase() === address.toUpperCase()
            );
            if (isDup) throw new Error("Duplicate Name, City, and Address combination detected.");

            // Extract State Code node from GSTIN
            let finalStateCode = getVal(row, ["State Code", "Code"]) || '';
            if (!finalStateCode && gstin.length === 15) {
                finalStateCode = gstin.substring(0, 2);
            }

            await addDoc(collection(firestore, "logistics_parties"), {
                name, 
                type: matchedType as PartyType, 
                gstin: gstin || '', 
                pan: getVal(row, ["PAN Number", "Pan No", "PAN"])?.toUpperCase() || (gstin?.length === 15 ? gstin.substring(2, 12) : ''),
                mobile: getVal(row, ["Contact Number", "Mobile", "Phone"]) || '',
                address,
                city,
                state,
                stateCode: finalStateCode,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isDeleted: false,
            });
            successCount++;
          } catch (err: any) {
            failedRecords.push({ row: rowNum, error: err.message });
          }
        }

        toast({
            variant: failedRecords.length > 0 ? 'destructive' : 'success',
            title: 'Bulk Upload Summary',
            description: `Established: ${successCount} | Errors: ${failedRecords.length}.`,
        });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Registry file read error.' });
      } finally {
        setIsUploading(false);
        hideLoader();
        event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    const dataToExport = sortedParties.map(p => ({
      'Party Name': p.name,
      'Type': p.type,
      'GSTIN': p.gstin || 'N/A',
      'PAN Number': p.pan || 'N/A',
      'Contact Number': p.mobile || 'N/A',
      'Address': p.address || 'N/A',
      'City': p.city || 'N/A',
      'State': p.state || 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "LogisticsParties");
    XLSX.writeFile(workbook, "Logistics_Party_Registry.xlsx");
  };

  const handleRemove = async (id: string) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        const partyRef = doc(firestore, "logistics_parties", id);
        const partySnap = await getDoc(partyRef);
        if (partySnap.exists()) {
            const partyData = partySnap.data();
            const currentOperator = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || "Admin");

            await addDoc(collection(firestore, "recycle_bin"), {
                pageName: "Party Management (Logistics)",
                userName: currentOperator,
                deletedAt: serverTimestamp(),
                data: { ...partyData, id: id, type: 'Party' }
            });
            await deleteDoc(partyRef);
            toast({ title: 'Moved to Bin', description: 'Party removed from Logistics Registry.' });
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        hideLoader();
    }
  };

  const handleUpdate = async (id: string, data: Partial<Party>) => {
    if (!firestore) return;
    showLoader();
    try {
        await updateDoc(doc(firestore, "logistics_parties", id), {
            ...data,
            pan: data.pan?.toUpperCase(),
            gstin: data.gstin?.toUpperCase(),
            updatedAt: serverTimestamp()
        });
        toast({ title: 'Success', description: 'Logistics party updated.' });
        setEditingParty(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
        hideLoader();
    }
  }

  const filteredParties = useMemo(() => {
    if (!parties) return [];
    return parties.filter(p => 
        !p.isDeleted && (
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.gstin && p.gstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.city && p.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.state && p.state.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    );
  }, [parties, searchTerm]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedParties = useMemo(() => {
    let sortableItems = [...filteredParties];
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            const aVal = (a as any)[sortConfig.key] || '';
            const bVal = (b as any)[sortConfig.key] || '';
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return sortableItems;
  }, [filteredParties, sortConfig]);

  const totalPages = Math.ceil(sortedParties.length / ITEMS_PER_PAGE);
  const paginatedParties = sortedParties.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <Card className="border-none shadow-md overflow-hidden bg-white">
        <CardHeader className="bg-slate-50 border-b p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                    <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <CardTitle className="text-xl font-bold italic uppercase text-blue-900">LOGISTICS PARTY CREATION</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase text-slate-400 tracking-widest">ADD NEW CONSIGNORS AND CONSIGNEES FOR THE LOGISTICS HUB.</CardDescription>
                </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTemplateDownload} className="h-9 px-4 font-black uppercase text-[10px] tracking-widest border-slate-200 shadow-sm">
                <FileDown className="mr-2 h-4 w-4" /> Bulk Template
              </Button>
              <Button variant="outline" size="sm" asChild className="h-9 px-4 font-black uppercase text-[10px] tracking-widest border-slate-200 shadow-sm">
                <label className="cursor-pointer">
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Bulk Upload
                  <input type="file" className="hidden" accept=".xls,.xlsx,.csv" onChange={handleBulkUpload} disabled={isUploading} />
                </label>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8 px-8">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Party Name *</FormLabel>
                    <FormControl><Input placeholder="Full legal name" {...field} className="bg-white h-11 font-bold border-slate-200" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-white h-11 border-slate-200"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-xl">{PartyTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2.5">{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gstin" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">GSTIN Number</FormLabel>
                    <FormControl>
                        <Input 
                            placeholder="09AAAAA0000A1Z0" 
                            {...field} 
                            value={field.value ?? ''} 
                            className="bg-white uppercase font-black tracking-widest focus-visible:ring-blue-900 border-blue-200 h-11" 
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pan" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        PAN Number 
                        {isPanAutoFilled && <Sparkles className="h-3 w-3 text-blue-600 animate-pulse" />}
                    </FormLabel>
                    <FormControl>
                        <Input 
                            placeholder="ABCDE1234F" 
                            {...field} 
                            value={field.value ?? ''} 
                            className={cn(
                                "uppercase bg-white font-black tracking-widest border-slate-200 h-11",
                                isPanAutoFilled && "border-blue-400 bg-blue-50/10 shadow-inner"
                            )} 
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="mobile" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact Number</FormLabel>
                    <FormControl><Input placeholder="10-digit mobile" {...field} value={field.value ?? ''} className="h-11 font-mono" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">City *</FormLabel>
                    <FormControl><Input placeholder="Registry City" {...field} className="h-11 font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">State Registry</FormLabel>
                    <Select onValueChange={(val) => {
                        field.onChange(val);
                        const stateInfo = statesAndUTs.find(s => s.name === val);
                        if (stateInfo) setValue('stateCode', stateInfo.code, { shouldValidate: true });
                    }} value={field.value}>
                        <FormControl><SelectTrigger className="bg-white h-11 border-slate-200"><SelectValue placeholder="Select State" /></SelectTrigger></FormControl>
                        <SelectContent className="max-h-80 rounded-xl">
                            {statesAndUTs.map(s => <SelectItem key={s.code} value={s.name} className="font-bold py-2.5">{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="lg:col-span-4">
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Physical Address Node *</FormLabel>
                    <FormControl><Input placeholder="Full registered address for mission manifests" {...field} className="bg-white h-11 font-medium border-slate-200" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex gap-3 justify-end border-t pt-8">
                <Button type="button" variant="ghost" onClick={() => { form.reset(); setIsPanAutoFilled(false); }} className="px-10 h-12 font-black uppercase text-[11px] tracking-widest text-slate-400">Discard</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-16 h-12 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-100 border-none transition-all active:scale-95 border-none">
                  {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />} Commit Registry
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
                <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900">PARTY REGISTRY HISTORY</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Consolidated master records for Logistics missions</CardDescription>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input 
                        placeholder="Search Name, City, State..." 
                        value={searchTerm} 
                        onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} 
                        className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900 font-bold" 
                    />
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-11 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white hover:bg-slate-50 shadow-sm transition-all">
                    <FileDown className="h-4 w-4" /> Export Ledger
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="px-8 h-14">
                    <Button variant="ghost" onClick={() => handleSort('name')} className="h-auto p-0 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-blue-900">
                        Party Name <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="px-4 h-14">
                    <Button variant="ghost" onClick={() => handleSort('type')} className="h-auto p-0 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-blue-900">
                        Type <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="px-4 h-14">
                    <Button variant="ghost" onClick={() => handleSort('city')} className="h-auto p-0 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-blue-900">
                        City <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="px-4 h-14">
                    <Button variant="ghost" onClick={() => handleSort('state')} className="h-auto p-0 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-blue-900">
                        State <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="px-4 h-14">
                    <Button variant="ghost" onClick={() => handleSort('gstin')} className="h-auto p-0 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-blue-900">
                        GSTIN Registry <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="px-4 h-14 text-center">
                    <Button variant="ghost" onClick={() => handleSort('pan')} className="h-auto p-0 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-blue-900">
                        PAN Registry <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="px-8 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingParties ? (
                  <TableRow><TableCell colSpan={7} className="h-48 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-900 opacity-40" /></TableCell></TableRow>
                ) : paginatedParties.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No records detected in logistics registry.</TableCell></TableRow>
                ) : (
                  paginatedParties.map((party) => (
                    <TableRow key={party.id} className="h-16 hover:bg-blue-50/20 transition-all border-b border-slate-50 last:border-0 group">
                      <TableCell className="px-8 font-black text-slate-900 uppercase text-xs tracking-tight">{party.name}</TableCell>
                      <TableCell className="px-4">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-black uppercase text-[9px] px-2.5 h-6 whitespace-nowrap">{party.type}</Badge>
                      </TableCell>
                      <TableCell className="px-4 font-bold text-slate-600 uppercase text-xs">{party.city || '--'}</TableCell>
                      <TableCell className="px-4 font-bold text-slate-600 uppercase text-xs">{party.state || '--'}</TableCell>
                      <TableCell className="px-4 font-mono text-[11px] font-black text-blue-900 tracking-widest">{party.gstin || '-'}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-[11px] font-bold text-slate-500 uppercase">{party.pan || '-'}</TableCell>
                      <TableCell className="px-8 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50" onClick={() => setEditingParty(party)}>
                                <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-none shadow-2xl p-0 overflow-hidden bg-white rounded-3xl">
                                <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                    <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><AlertCircle className="h-6 w-6" /></div>
                                    <div>
                                        <AlertDialogTitle className="text-xl font-black uppercase text-red-900 tracking-tight">Revoke Party Identity?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-red-700 font-bold text-[9px] uppercase tracking-widest mt-1">Authorized Registry Disposal</AlertDialogDescription>
                                    </div>
                                </div>
                                <div className="p-8"><p className="text-sm font-medium text-slate-600 leading-relaxed italic">"You are about to move **{party.name}** to the System Archive node. This will restrict its selection in new mission orders."</p></div>
                                <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                                    <AlertDialogCancel className="font-bold border-slate-200 px-8 h-10 rounded-xl m-0">Abort</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemove(party.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-10 h-10 rounded-xl shadow-lg border-none">Confirm Purge</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                            </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filteredParties.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
          </div>
        </CardContent>
      </Card>

      {editingParty && (
        <EditPartyModal 
            isOpen={!!editingParty} 
            onClose={() => setEditingParty(null)} 
            party={editingParty} 
            onSave={handleUpdate} 
        />
      )}
    </div>
  );
}
