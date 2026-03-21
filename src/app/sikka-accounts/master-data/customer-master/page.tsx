'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, setDoc, orderBy, writeBatch, onSnapshot, where, getDocs, limit } from "firebase/firestore";
import type { WithId, Plant, SubUser, Party, MasterUnitType, MasterInvoiceType, MasterChargeType } from '@/types';
import PartyRegisterTab from '@/components/sikka-accounts/customer-master/CustomerRegisterTab';
import { 
    Loader2, 
    WifiOff, 
    Building2, 
    Tag, 
    Settings2, 
    Users, 
    Save, 
    Edit2, 
    ShieldCheck, 
    MapPin, 
    History, 
    Trash2, 
    Upload, 
    FileText, 
    Wallet,
    Factory,
    Search,
    Plus
} from "lucide-react";
import { useSearchParams, useRouter } from 'next/navigation';
import { cn, normalizePlantId } from '@/lib/utils';
import { statesAndUTs } from '@/lib/states';
import { useLoading } from '@/context/LoadingContext';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';

const ITEMS_PER_PAGE = 10;

const plantSchema = z.object({
  id: z.string().min(1, 'Plant ID is mandatory.').transform(v => v.toUpperCase().replace(/\s+/g, '')),
});

function CustomerMasterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultTab = searchParams.get('tab') || 'create-plant';

  const handleTabChange = (val: string) => { 
    const params = new URLSearchParams(searchParams.toString()); 
    params.set('tab', val); 
    router.replace(`/sikka-accounts/master-data/customer-master?${params.toString()}`); 
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-slate-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><Settings2 className="h-6 w-6" /></div>
            <div>
                <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tight italic">Accounts Node Registry</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">XD01 – Master Identity Configuration Module</p>
            </div>
        </div>
      </div>
      <Tabs value={defaultTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-transparent border-b h-12 rounded-none gap-10 p-0 mb-10 overflow-x-auto justify-start">
          <TabsTrigger value="create-plant" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2 italic"><Building2 className="h-4 w-4" /> Account ERP Plant</TabsTrigger>
          <TabsTrigger value="create-firm" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2 italic"><ShieldCheck className="h-4 w-4" /> Create Firm</TabsTrigger>
          <TabsTrigger value="vendor-register" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2 italic"><Users className="h-4 w-4" /> Vendor Register</TabsTrigger>
          <TabsTrigger value="invoice-type" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2 italic"><FileText className="h-4 w-4" /> Invoice Type</TabsTrigger>
          <TabsTrigger value="charge-type" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2 italic"><Wallet className="h-4 w-4" /> Charge Type</TabsTrigger>
          <TabsTrigger value="create-uom-type" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 rounded-none px-0 text-xs font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2 italic"><Settings2 className="h-4 w-4" /> UOM Types</TabsTrigger>
        </TabsList>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <TabsContent value="create-plant"><CreatePlantSection isActive={defaultTab === 'create-plant'} /></TabsContent>
            <TabsContent value="create-firm"><CreateFirmSection isActive={defaultTab === 'create-firm'} /></TabsContent>
            <TabsContent value="vendor-register"><PartyRegisterTab isActive={defaultTab === 'vendor-register'} /></TabsContent>
            <TabsContent value="invoice-type"><MasterTypeRegistrySection title="Invoice Type" description="Standard document classification" collectionName="master_invoice_types" icon={FileText} isActive={defaultTab === 'invoice-type'} /></TabsContent>
            <TabsContent value="charge-type"><MasterTypeRegistrySection title="Charge Type" description="Revenue categorization" collectionName="master_charge_types" icon={Wallet} isActive={defaultTab === 'charge-type'} /></TabsContent>
            <TabsContent value="create-uom-type"><MasterTypeRegistrySection title="UOM Type" description="Standard measurement units" collectionName="master_unit_types" icon={Tag} isActive={defaultTab === 'create-uom-type'} /></TabsContent>
        </div>
      </Tabs>
    </main>
  );
}

function CreatePlantSection({ isActive }: { isActive: boolean }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { showLoader, hideLoader } = useLoading();
    const { setSaveAction, setCancelAction, setStatusBar } = useSikkaAccountsPage();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [editingPlant, setEditingPlant] = useState<WithId<Plant> | null>(null);
    
    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "accounts_plants"), orderBy("createdAt", "desc")) : null, 
        [firestore]
    );
    const { data: plants, isLoading } = useCollection<Plant>(plantsQuery);

    const form = useForm<z.infer<typeof plantSchema>>({ 
        resolver: zodResolver(plantSchema), 
        defaultValues: { id: '' } 
    });

    const onPlantSubmit = useCallback(async (values: z.infer<typeof plantSchema>) => {
        if (!firestore) return;
        showLoader();
        try {
            await setDoc(doc(firestore, "accounts_plants", values.id), { id: values.id, name: values.id, createdAt: serverTimestamp() }, { merge: true });
            setStatusBar({ message: `Registry Node ${values.id} established.`, type: 'success' });
            form.reset();
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Registry Error', description: error.message }); 
        } finally { hideLoader(); }
    }, [firestore, setStatusBar, form, toast, showLoader, hideLoader]);

    const onCancel = useCallback(() => { 
        form.reset(); 
        setStatusBar({ message: 'Form discarded.', type: 'warning' }); 
    }, [form, setStatusBar]);

    useEffect(() => { 
        if (isActive) { 
            setSaveAction(() => form.handleSubmit(onPlantSubmit)()); 
            setCancelAction(onCancel); 
        } 
        return () => { 
            if (isActive) { 
                setSaveAction(null); 
                setCancelAction(null); 
            } 
        }; 
    }, [isActive, onPlantSubmit, onCancel, setSaveAction, setCancelAction, form]);

    const handlePlantDelete = async (id: string) => {
        if (!firestore) return;
        showLoader();
        try { 
            await deleteDoc(doc(firestore, "accounts_plants", id)); 
            toast({ title: 'Record Purged', description: 'Plant ID removed from registry.' }); 
        } catch (e: any) { 
            toast({ variant: 'destructive', title: 'Error', description: e.message }); 
        } finally { hideLoader(); }
    };

    const handlePlantUpdate = async (oldId: string, newId: string) => {
        if (!firestore || oldId === newId) return;
        showLoader();
        try {
            const batch = writeBatch(firestore);
            const oldRef = doc(firestore, "accounts_plants", oldId);
            const newRef = doc(firestore, "accounts_plants", newId);
            const snap = await getDoc(oldRef);
            if (snap.exists()) {
                batch.set(newRef, { ...snap.data(), id: newId, updatedAt: serverTimestamp() });
                batch.delete(oldRef);
                await batch.commit();
                toast({ title: 'Registry Updated', description: 'Plant ID migrated successfully.' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally { hideLoader(); }
    };

    const filteredPlants = useMemo(() => (plants || []).filter(p => p.id.toLowerCase().includes(searchTerm.toLowerCase())), [plants, searchTerm]);
    const totalPages = Math.ceil(filteredPlants.length / ITEMS_PER_PAGE);
    const paginated = filteredPlants.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b p-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-900 text-white rounded-lg"><Factory className="h-5 w-5" /></div>
                        <div>
                            <CardTitle className="text-xl font-black uppercase text-blue-900 tracking-tighter italic">CONFIGURE ACCOUNTS ERP PLANT</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Initialize unique billing node identifier</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-10">
                    <Form {...form}>
                        <form className="max-w-md space-y-8" onSubmit={form.handleSubmit(onPlantSubmit)}>
                            <FormField control={form.control} name="id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PLANT ID *</FormLabel>
                                    <FormControl><Input {...field} placeholder="e.g. ID23" className="h-12 rounded-xl font-black text-blue-900 shadow-inner uppercase focus-visible:ring-blue-900" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-12 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-100 transition-all active:scale-95 border-none">
                                {form.formState.isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                                Commit Node
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3"><div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div><div><CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900 italic">PLANT ID REGISTRY</CardTitle><CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Master node identifiers</CardDescription></div></div>
                    <div className="relative group"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" /><Input placeholder="Search Plant ID..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm font-bold" /></div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="h-14 hover:bg-transparent border-b">
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Plant ID</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={2} className="p-8"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                            ) : paginated.length === 0 ? (
                                <TableRow><TableCell colSpan={2} className="h-48 text-center text-slate-400 italic font-medium">No Plant IDs registered.</TableCell></TableRow>
                            ) : (
                                paginated.map((p) => (
                                    <TableRow key={p.id} className="h-16 hover:bg-blue-50/20 border-b group">
                                        <TableCell className="px-8 font-mono font-bold text-blue-700 uppercase tracking-tighter text-sm">{p.id}</TableCell>
                                        <TableCell className="px-8 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50" onClick={() => setEditingPlant(p)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent className="border-none shadow-2xl">
                                                        <AlertDialogHeader><AlertDialogTitle>Purge Plant ID?</AlertDialogTitle><AlertDialogDescription>This will permanently erase the node identifier **{p.id}** from the registry.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Abort</AlertDialogCancel><AlertDialogAction onClick={() => handlePlantDelete(p.id)} className="bg-red-600">Confirm Purge</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <div className="p-6 bg-slate-50 border-t flex items-center justify-between"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filteredPlants.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} /></div>
                </CardContent>
            </Card>
            {editingPlant && <EditPlantModal isOpen={!!editingPlant} onClose={() => setEditingPlant(null)} plant={editingPlant} onSave={handlePlantUpdate} />}
        </div>
    );
}

function CreateFirmSection({ isActive }: { isActive: boolean }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { showLoader, hideLoader } = useLoading();
    const { setSaveAction, setCancelAction, setStatusBar } = useSikkaAccountsPage();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [editingPlant, setEditingPlant] = useState<WithId<Plant> | null>(null);
    
    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants"), orderBy("createdAt", "desc")) : null, [firestore]);
    const { data: plants, isLoading } = useCollection<Plant>(plantsQuery);
    
    const form = useForm<z.infer<typeof firmSchema>>({ 
        resolver: zodResolver(firmSchema), 
        defaultValues: { plantId: '', name: '', address: '', gstin: '', pan: '', state: '', stateCode: '' } 
    });

    const gstin = form.watch('gstin');
    useEffect(() => {
        if (gstin && gstin.length === 15) {
            const code = gstin.substring(0, 2);
            const stateInfo = statesAndUTs.find(s => s.code === code);
            if (stateInfo) { 
                form.setValue('state', stateInfo.name, { shouldValidate: true }); 
                form.setValue('stateCode', stateInfo.code, { shouldValidate: true }); 
            }
            form.setValue('pan', gstin.substring(2, 12).toUpperCase(), { shouldValidate: true });
        }
    }, [gstin, form]);

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const onFirmSubmit = useCallback(async (values: z.infer<typeof firmSchema>) => {
        if (!firestore) return;
        showLoader();
        try {
            let logoUrl = '';
            if (values.logo && values.logo[0]) {
                logoUrl = await convertFileToBase64(values.logo[0]);
            }

            const { logo, ...rest } = values;
            await setDoc(doc(firestore, "accounts_plants", values.plantId), { ...rest, logoUrl, updatedAt: serverTimestamp() }, { merge: true });
            setStatusBar({ message: `Firm Registry Updated: ${values.name} synchronized.`, type: 'success' });
            form.reset();
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Registry Error', description: error.message }); 
        } finally { hideLoader(); }
    }, [firestore, setStatusBar, form, toast, showLoader, hideLoader]);

    const onCancel = useCallback(() => { 
        form.reset(); 
        setStatusBar({ message: 'Firm form cleared.', type: 'warning' }); 
    }, [form, setStatusBar]);

    useEffect(() => { 
        if (isActive) { 
            setSaveAction(() => form.handleSubmit(onFirmSubmit)()); 
            setCancelAction(onCancel); 
        } 
        return () => { 
            if (isActive) { 
                setSaveAction(null); 
                setCancelAction(null); 
            } 
        }; 
    }, [isActive, onFirmSubmit, onCancel, setSaveAction, setCancelAction, form]);

    const filteredPlants = useMemo(() => (plants || []).filter(p => p.id.toLowerCase().includes(searchTerm.toLowerCase()) || (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase()))), [plants, searchTerm]);
    const totalPages = Math.ceil(filteredPlants.length / ITEMS_PER_PAGE);
    const paginatedItems = filteredPlants.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8">
                    <div className="flex items-center gap-3"><div className="p-2 bg-blue-900 text-white rounded-lg"><Building2 className="h-5 w-5" /></div><div><CardTitle className="text-xl font-black uppercase text-blue-900 italic">CREATE FIRM PARTICULARS</CardTitle><CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Enterprise identity registry</CardDescription></div></div>
                </CardHeader>
                <CardContent className="p-10">
                    <Form {...form}>
                        <form className="space-y-10" onSubmit={form.handleSubmit(onFirmSubmit)}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                                <FormField control={form.control} name="plantId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PLANT ID *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 rounded-xl font-black text-blue-900 shadow-sm uppercase">
                                                    <SelectValue placeholder="Pick ID" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl">
                                                {plants?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3">{p.id}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem className="lg:col-span-2"><FormLabel className="text-[10px] font-black uppercase text-slate-400">Firm Name *</FormLabel><FormControl><Input placeholder="Legal Name" {...field} className="h-12 rounded-xl font-bold border-slate-200" /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="logo" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Upload className="h-3 w-3" /> Logo (Max 1MB)</FormLabel><FormControl><Input type="file" accept="image/*" onChange={e => field.onChange(e.target.files)} className="h-12 rounded-xl pt-3 text-xs" /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="gstin" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">GSTIN Registry *</FormLabel><FormControl><Input placeholder="00AAAAA0000A0Z0" {...field} className="h-12 rounded-xl uppercase font-black tracking-widest text-blue-900 border-blue-900/20 bg-blue-50/10" /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="pan" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">PAN Number *</FormLabel><FormControl><Input placeholder="ABCDE1234F" {...field} className="h-12 rounded-xl uppercase font-black" /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="state" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">State Node</FormLabel><FormControl><Input readOnly {...field} className="h-12 rounded-xl bg-slate-50 font-bold text-slate-500" /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="stateCode" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">State Code</FormLabel><FormControl><Input readOnly {...field} className="h-12 rounded-xl bg-slate-50 font-black text-center text-slate-500" /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="address" render={({ field }) => (
                                    <FormItem className="lg:col-span-4"><FormLabel className="text-[10px] font-black uppercase text-slate-400">Physical Billing Address *</FormLabel><FormControl><Input placeholder="Complete registered address for invoicing" {...field} className="h-12 rounded-xl font-medium border-slate-200" /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-12 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-100 transition-all active:scale-95 border-none">
                                {form.formState.isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                                Commit Firm
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900 italic">FIRM HISTORY REGISTRY</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Audit registry of firm identities</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" /><Input placeholder="Search firm..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm font-bold" /></div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="h-14 hover:bg-transparent border-b">
                                    <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">PLANT ID</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Firm Name</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">GSTIN Registry</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">State</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="p-8"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                ) : paginatedItems.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center text-slate-400 italic font-medium">No firm records found.</TableCell></TableRow>
                                ) : (
                                    paginatedItems.map((firm) => (
                                        <TableRow key={firm.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b last:border-0 group">
                                            <TableCell className="px-8 font-mono font-bold text-blue-700 uppercase text-xs">{firm.plantId}</TableCell>
                                            <TableCell className="px-4 font-black text-slate-900 uppercase text-xs">{firm.name || '--'}</TableCell>
                                            <TableCell className="px-4 text-center font-black text-slate-600 uppercase tracking-widest">{firm.gstin || '--'}</TableCell>
                                            <TableCell className="px-4 text-center"><Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase text-[9px] px-3">{firm.state || '--'}</Badge></TableCell>
                                            <TableCell className="px-8 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50" onClick={() => setEditingPlant(firm)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent className="border-none shadow-2xl">
                                                            <AlertDialogHeader><AlertDialogTitle>Revoke Firm?</AlertDialogTitle><AlertDialogDescription>This will permanently erase **{firm.name || firm.id}** from the registry.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Abort</AlertDialogCancel><AlertDialogAction onClick={async () => { 
                                                                if(!firestore) return;
                                                                showLoader(); 
                                                                await deleteDoc(doc(firestore, "accounts_plants", firm.id)); 
                                                                hideLoader(); 
                                                                toast({ title: 'Success', description: 'Entry purged.' }); 
                                                            }} className="bg-red-600">Confirm</AlertDialogAction></AlertDialogFooter>
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
                    <div className="p-6 bg-slate-50 border-t flex items-center justify-between"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filteredPlants.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} /></div>
                </CardContent>
            </Card>
            {editingPlant && <EditFirmModal isOpen={!!editingPlant} onClose={() => setEditingPlant(null)} plant={editingPlant} onSave={async (id, data) => { 
                if(!firestore) return;
                showLoader(); 
                const cleaned = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
                await updateDoc(doc(firestore, "accounts_plants", id), { ...cleaned, updatedAt: serverTimestamp() }); 
                hideLoader(); 
                toast({ title: 'Registry Updated', description: 'Firm particulars modified.' });
            }} />}
        </div>
    );
}

function MasterTypeRegistrySection({ title, description, collectionName, icon: Icon, isActive }: { title: string, description: string, collectionName: string, icon: any, isActive: boolean }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { showLoader, hideLoader } = useLoading();
    const { setSaveAction, setCancelAction, setStatusBar } = useSikkaAccountsPage();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    
    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants"), orderBy("createdAt", "desc")) : null, [firestore]);
    const { data: plants } = useCollection<Plant>(plantsQuery);
    
    const dataQuery = useMemoFirebase(() => firestore ? query(collection(firestore, collectionName), orderBy("createdAt", "desc")) : null, [firestore, collectionName]);
    const { data: items, isLoading } = useCollection<any>(dataQuery);
    
    const form = useForm<z.infer<typeof masterTypeSchema>>({ resolver: zodResolver(masterTypeSchema), defaultValues: { plantId: '', name: '' } });

    const onSubmit = useCallback(async (values: any) => {
        if (!firestore) return;
        showLoader();
        try {
            const cleaned = Object.fromEntries(Object.entries(values).filter(([_, v]) => v !== undefined));
            await addDoc(collection(firestore, collectionName), { ...cleaned, createdAt: serverTimestamp() });
            setStatusBar({ message: `${title} record committed.`, type: 'success' });
            form.reset({ plantId: values.plantId, name: '' });
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Error', description: error.message }); 
        } finally { hideLoader(); }
    }, [firestore, collectionName, setStatusBar, form, toast, title, showLoader, hideLoader]);

    const onCancel = useCallback(() => { 
        form.reset(); 
        setStatusBar({ message: `${title} form cleared.`, type: 'warning' }); 
    }, [form, setStatusBar, title]);

    useEffect(() => { 
        if (isActive) { 
            setSaveAction(() => form.handleSubmit(onSubmit)()); 
            setCancelAction(onCancel); 
        } 
        return () => { 
            if (isActive) {
                setSaveAction(null); 
                setCancelAction(null); 
            }
        }; 
    }, [isActive, onSubmit, onCancel, setSaveAction, setCancelAction, form]);

    const filteredItems = useMemo(() => (items || []).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.plantId && item.plantId.toLowerCase().includes(searchTerm.toLowerCase()))), [items, searchTerm]);
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const registryTitle = `${title.toUpperCase()} REGISTRY MONITOR`;

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b p-8">
                    <div className="flex items-center gap-3"><div className="p-2 bg-blue-900 text-white rounded-lg"><Icon className="h-5 w-5" /></div>
                        <div><CardTitle className="text-xl font-black uppercase text-blue-900 italic">CONFIGURE {title.toUpperCase()}</CardTitle><CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{description}</CardDescription></div>
                    </div>
                </CardHeader>
                <CardContent className="p-10">
                    <Form {...form}>
                        <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
                            <div className="flex flex-wrap items-end gap-10">
                                <FormField control={form.control} name="plantId" render={({ field }) => (
                                    <FormItem className="min-w-[240px]">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PLANT ID *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 border-slate-200 shadow-sm focus:ring-blue-900">
                                                    <SelectValue placeholder="Pick Node" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl">
                                                {plants?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3">{p.id}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem className="flex-1 min-w-[300px]">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest">{title} Name *</FormLabel>
                                        <FormControl><Input placeholder={`Enter ${title} node name...`} {...field} className="h-12 rounded-xl font-black text-slate-900 focus:ring-blue-900" /></FormControl>
                                    </FormItem>
                                )} />
                            </div>
                            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-12 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-100 transition-all active:scale-95 border-none">
                                {form.formState.isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                                Commit {title}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <History className="h-5 w-5 text-blue-900" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 italic">{registryTitle}</h3>
                    </div>
                    <div className="relative group"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" /><Input placeholder="Search registry..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm font-bold" /></div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="h-14 hover:bg-transparent border-b">
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">PLANT ID</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">{title} Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (<TableRow><TableCell colSpan={3} className="p-8"><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : paginatedItems.length === 0 ? (<TableRow><TableCell colSpan={3} className="h-64 text-center text-slate-400 italic font-medium">No records found.</TableCell></TableRow>) : (
                                paginatedItems.map(item => (
                                    <TableRow key={item.id} className="h-16 hover:bg-blue-50/50 transition-colors border-b last:border-0 group">
                                        <TableCell className="px-8 font-black text-blue-700 uppercase tracking-tighter text-xs">{item.plantId}</TableCell>
                                        <TableCell className="px-4 font-bold text-slate-900 uppercase text-xs">{item.name}</TableCell>
                                        <TableCell className="px-8 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50" onClick={() => setEditingItem(item)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="border-none shadow-2xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="font-black uppercase text-red-900">Purge Record?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-sm font-medium">This will permanently erase **{item.name}** from the registry.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 flex-row justify-end gap-3 border-t">
                                                            <AlertDialogCancel className="font-bold border-slate-200">Abort</AlertDialogCancel>
                                                            <AlertDialogAction onClick={async () => { 
                                                                if(!firestore) return;
                                                                showLoader(); 
                                                                await deleteDoc(doc(firestore, collectionName, item.id)); 
                                                                hideLoader(); 
                                                                toast({ title: 'Success', description: 'Record purged.' }); 
                                                            }} className="bg-red-600 hover:bg-red-700 text-white border-none font-black uppercase text-[10px] tracking-widest px-8">Confirm Purge</AlertDialogAction>
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
                    <div className="p-6 bg-slate-50 border-t flex items-center justify-between"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filteredItems.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} /></div>
                </CardContent>
            </Card>
            {editingItem && (
                <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
                    <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
                        <DialogHeader className="p-6 bg-slate-900 text-white">
                            <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Edit {title} Node</DialogTitle>
                        </DialogHeader>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PLANT ID</Label>
                                <Select value={editingItem.plantId} onValueChange={(v) => setEditingItem({...editingItem, plantId: v})}>
                                    <SelectTrigger className="h-11 rounded-xl font-bold border-slate-200"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {plants?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.id}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{title} Name</Label>
                                <Input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="h-11 rounded-xl font-bold border-slate-200" />
                            </div>
                        </div>
                        <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                            <Button variant="ghost" onClick={() => setEditingItem(null)} className="font-bold text-slate-400">Cancel</Button>
                            <Button onClick={async () => { 
                                if(!firestore) return;
                                showLoader(); 
                                await updateDoc(doc(firestore, collectionName, editingItem.id), { name: editingItem.name, plantId: editingItem.plantId }); 
                                hideLoader(); 
                                setEditingItem(null); 
                                toast({ title: 'Success', description: 'Registry updated.' }); 
                            }} className="bg-blue-900 hover:bg-slate-900 text-white px-10 h-11 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg border-none">Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

const firmSchema = z.object({
  plantId: z.string().min(1, 'PLANT ID selection is required.'),
  name: z.string().min(1, 'Firm name is required'),
  logo: z.any().optional(),
  address: z.string().min(1, 'Address is mandatory'),
  gstin: z.string().min(15, 'GSTIN must be 15 characters').max(15),
  pan: z.string().min(10, 'PAN must be 10 characters').max(10),
  state: z.string().min(1, 'State is required'),
  stateCode: z.string().min(1, 'State Code is required'),
});

const masterTypeSchema = z.object({
    plantId: z.string().min(1, 'PLANT ID is required.'),
    name: z.string().min(1, 'Name is required.'),
});

function EditPlantModal({ isOpen, onClose, plant, onSave }: { isOpen: boolean; onClose: () => void; plant: WithId<Plant>; onSave: (id: string, newId: string) => Promise<void>; }) {
    const form = useForm<z.infer<typeof plantSchema>>({
        resolver: zodResolver(plantSchema),
        defaultValues: { id: plant.id }
    });
    const onSubmit = async (values: { id: string }) => { 
        await onSave(plant.id, values.id); 
        onClose(); 
    };
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md border-none shadow-2xl">
                <DialogHeader className="bg-slate-900 -m-6 p-6 mb-4 rounded-t-lg text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Edit PLANT ID Registry</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] mt-1">Modify unique billing node identifier</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <FormField control={form.control} name="id" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">New Plant ID *</FormLabel>
                                <FormControl><Input {...field} className="h-12 rounded-xl font-black uppercase text-blue-900 border-slate-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 border-t flex-row justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400">Cancel</Button>
                            <Button type="submit" className="bg-blue-900 hover:bg-slate-900 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] shadow-lg">Commit Change</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function EditFirmModal({ isOpen, onClose, plant, onSave }: { isOpen: boolean; onClose: () => void; plant: WithId<Plant>; onSave: (id: string, data: any) => Promise<void>; }) {
    const form = useForm<z.infer<typeof firmSchema>>({
        resolver: zodResolver(firmSchema),
        defaultValues: {
            plantId: plant.id,
            name: plant.name || '',
            address: plant.address || '',
            gstin: plant.gstin || '',
            pan: plant.pan || '',
            state: plant.state || '',
            stateCode: plant.stateCode || '',
        }
    });

    const gstin = form.watch('gstin');
    const [logoPreview, setLogoPreview] = useState<string | null>(plant.logoUrl || null);

    useEffect(() => {
        if (gstin && gstin.length === 15) {
            const code = gstin.substring(0, 2);
            const stateInfo = statesAndUTs.find(s => s.code === code);
            if (stateInfo) {
                form.setValue('state', stateInfo.name);
                form.setValue('stateCode', stateInfo.code);
            }
            form.setValue('pan', gstin.substring(2, 12).toUpperCase());
        }
    }, [gstin, form]);

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const onSubmit = async (values: any) => {
        let logoUrl = plant.logoUrl;
        if (values.logo && values.logo[0]) {
            logoUrl = await convertFileToBase64(values.logo[0]);
        }
        
        const { logo, ...rest } = values;
        await onSave(plant.id, { ...rest, logoUrl });
        onClose();
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            form.setValue('logo', e.target.files);
            const reader = new FileReader();
            reader.onload = (event) => setLogoPreview(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl border-none shadow-2xl p-0 overflow-hidden bg-white">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Modify ERP Firm Identity</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Ref: {plant.id}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-8">
                        <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="relative h-20 w-20 rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden flex items-center justify-center shrink-0 group">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Preview" className="h-full w-full object-contain" />
                                ) : (
                                    <Building2 className="h-8 w-8 text-slate-300" />
                                )}
                                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                    <Upload className="h-5 w-5 text-white" />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                                </label>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-slate-400">Firm Branding</p>
                                <p className="text-xs font-bold text-slate-600">Upload high-resolution logo for document generation (A4 Print Node).</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <FormField control={form.control} name="plantId" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">PLANT ID *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-black text-blue-900 shadow-inner" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem className="lg:col-span-2"><FormLabel className="text-[10px] font-black uppercase text-slate-400">Firm Name *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="gstin" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">GSTIN Registry *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl uppercase font-black text-blue-900 tracking-widest" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="pan" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">PAN Number *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl uppercase font-black" placeholder="ABCDE1234F" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">State</FormLabel><FormControl><Input {...field} readOnly className="h-11 rounded-xl bg-slate-50 font-bold" /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="stateCode" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Code</FormLabel><FormControl><Input {...field} readOnly className="h-11 rounded-xl bg-slate-50 font-black text-center" /></FormControl></FormItem>)} />
                            </div>
                            <FormField control={form.control} name="address" render={({ field }) => (
                                <FormItem className="col-span-full"><FormLabel className="text-[10px] font-black uppercase text-slate-400">Physical Billing Address *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-medium" /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <DialogFooter className="bg-slate-50 -mx-8 -mb-8 p-6 border-t flex-row justify-end gap-3">
                            <Button type="button" variant="outline" onClick={onClose} className="font-bold text-slate-400">Discard</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-900 hover:bg-slate-900 px-12 h-11 rounded-xl gap-2 font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95 border-none">
                                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Commit Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default function CustomerMasterPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <CustomerMasterContent />
        </Suspense>
    );
}
