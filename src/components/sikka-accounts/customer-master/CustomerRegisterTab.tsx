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
import { Loader2, FileDown, Upload, Search, Edit2, Trash2, UserPlus, History, ShieldCheck, Save, Sparkles, Factory } from 'lucide-react';
import { PartyTypes } from '@/lib/constants';
import type { Party, WithId, Plant, SubUser } from '@/types';
import { statesAndUTs } from '@/lib/states';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, where, onSnapshot, orderBy } from "firebase/firestore";
import { Badge } from '@/components/ui/badge';
import { cn, normalizePlantId } from '@/lib/utils';
import EditPartyModal from '@/components/dashboard/plant-management/EditPartyModal';
import { useLoading } from '@/context/LoadingContext';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const ITEMS_PER_PAGE = 10;

const formSchema = z.object({
  plantId: z.string().min(1, 'PLANT ID selection is required.'),
  name: z.string().min(1, 'Vendor Name is required.'),
  address: z.string().min(1, 'Physical Address is mandatory.'),
  gstin: z.string().regex(gstinRegex, 'Invalid GSTIN Format (e.g. 09AAAAA0000A1Z0)'),
  pan: z.string().regex(panRegex, 'Invalid PAN format. Example: ABCDE1234F'),
  state: z.string().min(1, 'State is required.'),
  stateCode: z.string().min(1, 'State code is required.'),
  mobile: z.string().optional().refine(val => !val || /^\d{10}$/.test(val), 'Enter valid 10 digit mobile number'),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  upiId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CustomerRegisterTab({ isActive }: { isActive: boolean }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const { setSaveAction, setCancelAction, setStatusBar } = useSikkaAccountsPage();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingParty, setEditingParty] = useState<WithId<Party> | null>(null);
  const [isPanAutoFilled, setIsPanAutoFilled] = useState(false);

  // Registry Sanitization Logic Node
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

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "accounts_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const [parties, setParties] = useState<WithId<Party>[]>([]);
  const [isLoadingParties, setIsLoadingParties] = useState(true);

  // ACCOUNTS REGISTRY HANDSHAKE
  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "accounts_parties"), where("isDeleted", "==", false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as WithId<Party>));
        setParties(results.sort((a,b) => (b.createdAt as any)?.seconds - (a.createdAt as any)?.seconds));
        setIsLoadingParties(false);
    });
    return () => unsubscribe();
  }, [firestore]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { plantId: '', name: '', address: '', gstin: '', pan: '', state: '', stateCode: '', mobile: '', bankName: '', accountNumber: '', ifsc: '', upiId: '' },
  });

  const { handleSubmit, watch, reset, setValue } = form;
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

  const onSubmit = useCallback(async (values: FormValues) => {
    if (!firestore || !user) return;
    showLoader();
    try {
      const currentOperator = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);

      const cleanedPayload = sanitize({
        ...values,
        type: 'Consignee & Ship to',
        gstin: values.gstin.toUpperCase(),
        pan: values.pan.toUpperCase(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
        createdBy: currentOperator,
        userId: user.uid
      });

      await addDoc(collection(firestore, "accounts_parties"), cleanedPayload);

      setStatusBar({ message: `Registry confirmed: Vendor ${values.name} provisioned in Accounts.`, type: 'success' });
      reset();
      setIsPanAutoFilled(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Registry Error', description: error.message });
    } finally {
        hideLoader();
    }
  }, [firestore, user, setStatusBar, reset, showLoader, hideLoader, toast]);

  const onCancel = useCallback(() => {
    reset();
    setIsPanAutoFilled(false);
    setStatusBar({ message: 'Vendor registration form cleared.', type: 'warning' });
  }, [reset, setStatusBar]);

  useEffect(() => {
    if (isActive) {
        setSaveAction(form.handleSubmit(onSubmit));
        setCancelAction(onCancel);
    }
    return () => {
        setSaveAction(null);
        setCancelAction(null);
    };
  }, [isActive, handleSubmit, onSubmit, onCancel, setSaveAction, setCancelAction, form]);

  const handleRemove = async (id: string) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        const docRef = doc(firestore, "accounts_parties", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const partyData = snap.data();
            const currentOperator = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || "Admin");

            await addDoc(collection(firestore, "recycle_bin"), {
                pageName: "Vendor Register (Accounts)",
                userName: currentOperator,
                deletedAt: serverTimestamp(),
                data: { ...partyData, id, type: 'Party' }
            });

            await updateDoc(docRef, { isDeleted: true, updatedAt: serverTimestamp() });
            toast({ title: 'Vendor Revoked', description: 'Identity moved to archive node.' });
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Revocation Failed', description: error.message });
    } finally {
        hideLoader();
    }
  };

  const handleUpdate = async (id: string, data: Partial<Party>) => {
    if (!firestore) return;
    showLoader();
    try {
        const cleanedPayload = sanitize({
            ...data,
            pan: data.pan?.toUpperCase(),
            gstin: data.gstin?.toUpperCase(),
            updatedAt: serverTimestamp()
        });
        await updateDoc(doc(firestore, "accounts_parties", id), cleanedPayload);
        toast({ title: 'Registry Updated', description: 'Vendor particulars modified.' });
        setEditingParty(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
        hideLoader();
    }
  };

  const filteredParties = useMemo(() => {
    return parties.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.gstin && p.gstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.state && p.state.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [parties, searchTerm]);

  const totalPages = Math.ceil(filteredParties.length / ITEMS_PER_PAGE);
  const paginated = filteredParties.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3"><UserPlus className="h-6 w-6" /></div>
                <div>
                    <CardTitle className="text-2xl font-black uppercase text-blue-900">Provision Accounts Vendor</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Accounts ERP Node: Permanent Vendor Registry</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-10">
          <Form {...form}>
            <form className="space-y-10" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                <FormField control={form.control} name="plantId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">PLANT ID *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 border-slate-200 shadow-sm focus:ring-blue-900"><SelectValue placeholder="Pick Node" /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-xl">
                        {plants?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3">{p.id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="lg:col-span-2">
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Vendor Name *</FormLabel>
                    <FormControl><Input placeholder="Legal Enterprise Identity" {...field} className="h-12 rounded-xl font-black text-slate-900 border-slate-200" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gstin" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">GSTIN Registry *</FormLabel>
                    <FormControl><Input placeholder="00AAAAA0000A0Z0" {...field} className="h-12 rounded-xl uppercase font-black tracking-widest text-blue-900 border-blue-900/20 bg-blue-50/10" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pan" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">PAN Number * {isPanAutoFilled && <ShieldCheck className="h-3 w-3 text-emerald-500" />}</FormLabel>
                    <FormControl><Input placeholder="ABCDE1234F" {...field} className={cn("h-12 rounded-xl uppercase font-bold", isPanAutoFilled && "bg-emerald-50/30 border-emerald-200")} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">State</FormLabel>
                    <FormControl><Input readOnly {...field} className="h-12 rounded-xl bg-slate-50 font-bold text-slate-500" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="stateCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px) font-black uppercase text-slate-400 tracking-[0.2em]">State Code</FormLabel>
                    <FormControl><Input readOnly {...field} className="h-12 rounded-xl bg-slate-50 font-black text-center text-slate-500" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="mobile" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Mobile Number</FormLabel>
                    <FormControl><Input type="tel" {...field} value={field.value || ''} className="h-12 rounded-xl font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="bankName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Bank Name</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} className="h-12 rounded-xl" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="accountNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Account Number</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} className="h-12 rounded-xl" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="ifsc" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">IFSC Code</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} className="h-12 rounded-xl uppercase" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="upiId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">UPI ID (Optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} className="h-12 rounded-xl" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="lg:col-span-4">
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Physical Billing Address *</FormLabel>
                    <FormControl><Input placeholder="Complete registered address for invoicing" {...field} className="h-12 rounded-xl font-medium border-slate-200" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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
                    <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900">Accounts Vendor Registry</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Master record of active billing entities in ERP</CardDescription>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input 
                        placeholder="Search registry..." 
                        value={searchTerm} 
                        onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} 
                        className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900 font-bold" 
                    />
                </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-8 text-slate-400">Vendor Name</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">GSTIN Registry</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">Mobile Number</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">Bank Details</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400 text-center">UPI ID</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-8 text-right text-slate-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingParties ? (
                  <TableRow><TableCell colSpan={6} className="p-8"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-64 text-center text-slate-400 italic font-medium">No vendors found in Accounts Registry.</TableCell></TableRow>
                ) : (
                  paginated.map((party) => {
                    return (
                        <TableRow key={party.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                        <TableCell className="px-8 font-black text-slate-900 uppercase text-xs tracking-tight">{party.name}</TableCell>
                        <TableCell className="px-4 font-mono text-[11px] font-black text-blue-700 tracking-widest">{party.gstin}</TableCell>
                        <TableCell className="px-4 font-bold text-slate-600">{party.mobile || '--'}</TableCell>
                        <TableCell className="px-4">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-black text-slate-900 uppercase">{party.bankName || '--'}</span>
                                <span className="text-[9px] font-bold text-slate-400">A/C: {party.accountNumber || '--'} | IFSC: {party.ifsc || '--'}</span>
                            </div>
                        </TableCell>
                        <TableCell className="px-4 text-center text-[10px] font-bold text-emerald-600 uppercase">{party.upiId || '--'}</TableCell>
                        <TableCell className="px-8 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50" onClick={() => setEditingParty(party)}>
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
                                        <AlertDialogTitle className="font-black uppercase tracking-tight text-red-900">Revoke Accounts Vendor?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-sm font-medium">This will move **{party.name}** to the System Archive node.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 flex-row justify-end gap-3 border-t">
                                    <AlertDialogCancel className="font-bold border-slate-200">Abort</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemove(party.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8 border-none shadow-lg">Confirm Revoke</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                        </TableRow>
                    );
                  })
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
