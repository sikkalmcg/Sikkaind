'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Plant, VehicleEntryExit, WithId, SubUser, Trip } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileDown, Search, History, Clock, Filter, AlertTriangle, Edit2, Trash2, Save, Minus, X, Plus, ArchiveRestore, ShieldCheck, Factory } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfDay, endOfDay, subDays, differenceInHours } from 'date-fns';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, doc, serverTimestamp, updateDoc, addDoc, Timestamp, getDoc, deleteDoc, limit, getDocs, writeBatch } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { DatePicker } from '@/components/date-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { QtyTypes } from '@/lib/constants';
import { useLoading } from '@/context/LoadingContext';
import { cn, normalizePlantId } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

const formSchema = z.object({
  plantId: z.string().min(1, 'Plant is required'),
  vehicleEntryId: z.string().min(1, 'A vehicle must be selected'),
  outType: z.enum(['Loaded', 'Empty', 'Unloaded', 'Not Unload'], { required_error: 'Out type is required' }),
  lrNumber: z.string().optional().default(''),
  invoiceNumber: z.string().optional().default(''),
  billedQty: z.coerce.number().optional().default(0),
  qtyType: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (data.outType === 'Loaded') {
    if (!data.lrNumber?.trim() && !data.invoiceNumber?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Either LR or Invoice No. is mandatory for Loaded exit.', path: ['lrNumber'] });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

function EditVehicleOutModal({ 
    isOpen, 
    onClose, 
    entry, 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    entry: WithId<VehicleEntryExit>; 
}) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();

    const editSchema = z.object({
        outType: z.enum(['Loaded', 'Empty', 'Unloaded', 'Not Unload'], { required_error: 'Out type is required' }),
        lrNumber: z.string().optional().default(''),
        documentNo: z.string().optional().default(''),
        billedQty: z.coerce.number().optional().default(0),
        qtyType: z.string().optional().default(''),
        items: z.string().optional().default(''),
    });

    const form = useForm<z.infer<typeof editSchema>>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            outType: entry.outType as any,
            lrNumber: entry.lrNumber || '',
            documentNo: entry.documentNo || '',
            billedQty: Number(entry.billedQty) || 0,
            qtyType: entry.qtyType || '',
            items: entry.items || '',
        }
    });

    const { handleSubmit, formState: { isSubmitting } } = form;

    const onUpdate = async (values: z.infer<typeof editSchema>) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const docRef = doc(firestore, 'vehicleEntries', entry.id);
            const userSnap = await getDoc(doc(firestore, "users", user.uid));
            const currentName = userSnap.exists() ? (userSnap.data() as SubUser).fullName : (user.displayName || user.email?.split('@')[0] || 'Operator');

            await updateDoc(docRef, {
                ...values,
                lastUpdated: serverTimestamp(),
                updatedBy: currentName
            });

            await addDoc(collection(firestore, "activity_logs"), {
                userId: user.uid,
                userName: currentName,
                action: 'Edit',
                tcode: 'Vehicle Entry',
                pageName: 'Exit Registry History',
                timestamp: serverTimestamp(),
                description: `Updated Exit record for ${entry.vehicleNumber}. Modified exit type/particulars.`
            });

            toast({ title: 'Exit Record Updated', description: `Registry changes for ${entry.vehicleNumber} saved.` });
            onClose();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            hideLoader();
        }
    };

    const outTypeOptions = entry.purpose === 'Loading' ? ['Loaded', 'Empty'] : ['Unloaded', 'Not Unload'];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl border-none shadow-2xl overflow-hidden p-0">
                <DialogHeader className="p-6 bg-slate-50 border-b">
                    <DialogTitle className="text-xl font-black text-blue-900 uppercase flex items-center gap-2">
                        <Edit2 className="h-5 w-5 text-blue-600" /> Edit Vehicle Exit Entry
                    </DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                        Registry Ref: {entry.id}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                        <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">IN Time</p><p className="text-xs font-bold text-slate-800">{format(new Date(entry.entryTimestamp), 'dd-MM-yyyy HH:mm')}</p></div>
                        <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Purpose</p><p className="text-xs font-black text-blue-900 uppercase">{entry.purpose}</p></div>
                        <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Exit Time</p><p className="text-xs font-bold text-slate-800">{format(new Date(entry.exitTimestamp!), 'dd-MM-yyyy HH:mm')}</p></div>
                        <div><p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Stay Time</p><p className="text-xs font-black text-emerald-600">{differenceInHours(new Date(entry.exitTimestamp!), new Date(entry.entryTimestamp))}h</p></div>
                    </div>

                    <Form {...form}>
                        <form onSubmit={handleSubmit(onUpdate)} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                <FormField control={form.control} name="outType" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Exit Type *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-bold shadow-sm border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{outTypeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField name="lrNumber" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">LR Number</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold border-slate-200" /></FormControl></FormItem>
                                )} />
                                <FormField name="documentNo" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Invoice Ref</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold border-slate-200" /></FormControl></FormItem>
                                )} />
                                <FormField name="billedQty" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Exit weight</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl font-black text-blue-900 border-slate-200" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="qtyType" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Weight Unit</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-bold shadow-sm border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{QtyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField name="items" control={form.control} render={({ field }) => (
                                    <FormItem className="md:col-span-3"><FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Items (Consignment)</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-slate-200 bg-slate-50/30" /></FormControl></FormItem>
                                )} />
                            </div>

                            <DialogFooter className="border-t pt-6 bg-slate-50 -mx-8 -mb-8 p-6">
                                <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400">Discard</Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 px-12 h-11 rounded-xl gap-2 font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Update Exit Registry
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function VehicleOutForm({ inVehicles, onVehicleOut, plants, isLoadingPlants }: { 
    inVehicles: WithId<VehicleEntryExit>[], 
    onVehicleOut: (id: string, outData: Partial<VehicleEntryExit>) => Promise<void>,
    plants: WithId<Plant>[],
    isLoadingPlants: boolean
}) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { plantId: '', vehicleEntryId: '', outType: undefined, lrNumber: '', invoiceNumber: '', billedQty: 0, qtyType: '' },
  });

  const { handleSubmit, watch, setValue, formState: { isSubmitting }, register } = form;
  const outType = watch('outType');
  const vehicleEntryId = watch('vehicleEntryId');
  const selectedPlantId = watch('plantId');

  useEffect(() => {
    if (!firestore || !user || isLoadingPlants || !plants) return;

    const syncAuth = async () => {
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
                authIds = isRoot ? plants.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdminSession) {
                authIds = plants.map(p => p.id);
            }

            const filtered = plants.filter(p => authIds.includes(p.id));
            setAuthorizedPlants(filtered);
            
            if (filtered.length > 0) {
                const defaultId = filtered[0].id;
                setValue('plantId', defaultId);
            }
            setIsAuthLoading(false);
        } catch (e) {
            console.error("Auth sync error:", e);
            setIsAuthLoading(false);
        }
    };
    syncAuth();
  }, [firestore, user, plants, isLoadingPlants, isAdminSession, setValue]);

  const selectedVehicle = useMemo(() => inVehicles?.find(v => v.id === vehicleEntryId), [inVehicles, vehicleEntryId]);
  const plantVehicles = useMemo(() => inVehicles.filter(v => normalizePlantId(v.plantId) === normalizePlantId(selectedPlantId)), [inVehicles, selectedPlantId]);

  const outTypeOptions = useMemo(() => {
    if (!selectedVehicle) return [];
    return selectedVehicle.purpose === 'Loading' ? ['Loaded', 'Empty'] : ['Unloaded', 'Not Unload'];
  }, [selectedVehicle]);

  useEffect(() => {
    const fetchTrip = async () => {
        if (outType === 'Loaded' && selectedVehicle?.tripId && firestore) {
            const tripRef = doc(firestore, `plants/${selectedVehicle.plantId}/trips`, selectedVehicle.tripId);
            const tripSnap = await getDoc(tripRef);
            if (tripSnap.exists()) {
                const data = tripSnap.data();
                if (data.lrNumber) setValue('lrNumber', data.lrNumber);
            }
        }
    };
    fetchTrip();
  }, [outType, selectedVehicle, firestore, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!selectedVehicle) return;

    const isAssigned = !!selectedVehicle.tripId;
    const isLoadedExit = values.outType === 'Loaded';

    /**
     * MANDATORY REGISTRY GATE: Supervisor Task Completion
     * Rule: Supervisor Task must be completed before Vehicle OUT for assigned trips.
     */
    if (isAssigned && isLoadedExit && !selectedVehicle.isTaskCompleted) {
        toast({ 
            variant: 'destructive', 
            title: 'Exit Authorization Denied', 
            description: 'Mission Registry Violation: Loading tasks must be verified by a Supervisor before a loaded vehicle can exit the gate.' 
        });
        return;
    }

    if (selectedVehicle.purpose === 'Loading' && values.outType === 'Loaded' && !values.lrNumber?.trim()) {
        toast({
            variant: 'destructive',
            title: 'Registry Violation',
            description: 'Departure blocked. LR (Lorry Receipt) must be generated and assigned before vehicle OUT for loaded cargo.'
        });
        return;
    }

    const outData: Partial<VehicleEntryExit> = {
        outType: values.outType,
        lrNumber: values.lrNumber,
        documentNo: values.invoiceNumber || values.lrNumber,
        billedQty: values.billedQty,
        qtyType: values.qtyType,
    };
    await onVehicleOut(values.vehicleEntryId, outData);
    form.reset({
        plantId: authorizedPlants[0]?.id || '',
        vehicleEntryId: '',
        outType: undefined,
        lrNumber: '',
        invoiceNumber: '',
        billedQty: 0,
        qtyType: ''
    });
  };

  const isReadOnlyPlant = !isAdminSession && authorizedPlants.length === 1;

  return (
    <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
      <CardHeader className="bg-slate-50 border-b p-6">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><Plus className="h-5 w-5" /></div>
            <div>
                <CardTitle className="text-xl font-black text-blue-900 uppercase">Finalize Gate Exit (OUT)</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest text-slate-400">Record gate departure and mission status</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="pt-8 px-8 pb-8">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
              <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-inner flex flex-col justify-center h-full">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Exit Timestamp</label>
                <p className="text-sm font-black text-blue-900 font-mono tracking-tight">{currentDate ? format(currentDate, 'dd-MM-yyyy HH:mm') : '...'}</p>
              </div>

              {isAuthLoading ? (
                  <div className="h-11 w-full bg-slate-50 rounded-xl animate-pulse" />
              ) : isReadOnlyPlant ? (
                  <div className="grid gap-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Factory className="h-2.5 w-2.5" /> Plant Node Registry
                      </label>
                      <div className="h-11 px-4 flex items-center bg-blue-50/50 border border-blue-100 rounded-xl text-blue-900 font-black text-xs shadow-sm uppercase tracking-tighter w-full">
                          <ShieldCheck className="h-3.5 w-3.5 mr-2 text-blue-600" /> {authorizedPlants[0].name}
                      </div>
                      <input type="hidden" {...register('plantId')} value={authorizedPlants[0].id} />
                  </div>
              ) : (
                <FormField control={form.control} name="plantId" render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Plant Node *</FormLabel>
                    <Select onValueChange={(val) => { field.onChange(val); setValue('vehicleEntryId', ''); }} value={field.value}>
                        <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-bold border-slate-200 shadow-sm"><SelectValue placeholder="Select Node" /></SelectTrigger></FormControl>
                        <SelectContent>{authorizedPlants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    </FormItem>
                )} />
              )}

              <FormField control={form.control} name="vehicleEntryId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vehicles currently IN *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPlantId}>
                    <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-black text-blue-900 border-slate-200 shadow-sm"><SelectValue placeholder="Pick vehicle" /></SelectTrigger></FormControl>
                    <SelectContent>{plantVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} ({v.purpose})</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="outType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Exit Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!vehicleEntryId}>
                    <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-bold border-slate-200 shadow-sm"><SelectValue placeholder="Pick Status" /></SelectTrigger></FormControl>
                    <SelectContent>{outTypeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            {outType === 'Loaded' && (
                <div className="p-8 bg-blue-50/30 rounded-3xl border border-blue-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-top-4 duration-500 shadow-inner">
                    <FormField name="lrNumber" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">LR Registry Number</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input {...field} className="h-11 rounded-xl border-blue-200 bg-white font-black text-blue-900 pr-10" />
                                    {selectedVehicle?.purpose === 'Loading' && !field.value && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <AlertTriangle className="absolute right-3 top-3 h-4 w-4 text-red-500 cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-slate-900 text-white font-black text-[10px] uppercase">LR must be generated before exit.</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField name="invoiceNumber" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Outbound Invoice No</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-blue-200 bg-white font-black text-blue-900" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField name="billedQty" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Exit Weight</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl border-blue-200 bg-white font-black text-blue-900" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField name="qtyType" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Weight Unit</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-11 rounded-xl bg-white border-blue-200 font-bold"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                <SelectContent>{QtyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>
            )}

            <div className="flex gap-4 pt-6 border-t border-slate-100 justify-end">
              <Button type="button" variant="ghost" onClick={() => form.reset()} className="h-12 px-10 font-black uppercase text-[11px] tracking-widest text-slate-400 hover:text-slate-900 transition-all">Discard Entry</Button>
              <Button type="submit" disabled={isSubmitting || !vehicleEntryId || !outType} className="bg-blue-900 hover:bg-slate-900 px-16 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-200 transition-all active:scale-95 border-none">
                {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : null}
                Finalize System OUT
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function VehicleOutHistory() {
    const db = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();
    const [history, setHistory] = useState<WithId<VehicleEntryExit>[]>([]);
    const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 7));
    const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [editingItem, setEditingItem] = useState<WithId<VehicleEntryExit> | null>(null);

    const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    const plantsQuery = useMemoFirebase(() => db ? query(collection(db, "logistics_plants")) : null, [db]);
    const { data: plants } = useCollection<Plant>(plantsQuery);

    useEffect(() => {
        if (!db || !user) return;
        const start = fromDate ? startOfDay(fromDate) : startOfDay(subDays(new Date(), 7));
        const end = toDate ? endOfDay(toDate) : endOfDay(new Date());

        const q = query(collection(db, "vehicleEntries"), where("status", "==", "OUT"), limit(500));
        const unsub = onSnapshot(q, (snap) => {
            const entries = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                entryTimestamp: d.data().entryTimestamp instanceof Timestamp ? d.data().entryTimestamp.toDate() : new Date(d.data().entryTimestamp),
                exitTimestamp: d.data().exitTimestamp instanceof Timestamp ? d.data().exitTimestamp.toDate() : new Date(d.data().exitTimestamp)
            } as any))
            .filter(e => e.exitTimestamp >= start && e.exitTimestamp <= end);
            
            entries.sort((a, b) => b.exitTimestamp.getTime() - a.exitTimestamp.getTime());
            setHistory(entries);
            setIsLoading(false);
        });
        return () => unsub();
    }, [db, user, fromDate, toDate]);

    const filtered = useMemo(() => history.filter(e => 
        e.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (plants?.find(p => p.id === e.plantId)?.name || e.plantId).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.driverName && e.driverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.lrNumber && e.lrNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.documentNo && e.documentNo.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [history, searchTerm, plants]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleExport = () => {
        const dataToExport = filtered.map(e => ({
            'Plant': plants?.find(p => p.id === e.plantId)?.name || e.plantId,
            'IN Date/Time': format(e.entryTimestamp, 'dd-MM-yyyy HH:mm'),
            'OUT Date/Time': format(e.exitTimestamp, 'dd-MM-yyyy HH:mm'),
            'Vehicle No': e.vehicleNumber,
            'Driver': e.driverName || 'N/A',
            'Purpose': e.purpose,
            'Exit Type': e.outType,
            'Qty': `${e.billedQty || 0} ${e.qtyType || 'MT'}`,
            'LR No': e.lrNumber || 'N/A',
            'Invoice No': e.documentNo || 'N/A'
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Exit History Registry");
        XLSX.writeFile(workbook, `Gate_Exit_History_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    const handleDelete = async (id: string) => {
        if (!db || !user) return;
        showLoader();
        try {
            const docRef = doc(db, "vehicleEntries", id);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) return;
            const data = docSnap.data();

            const currentName = (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') 
                ? 'AJAY SOMRA' 
                : (user.displayName || user.email?.split('@')[0] || 'Operator');
            
            // Move to Recycle Bin before Purge
            await addDoc(collection(db, "recycle_bin"), {
                pageName: "Vehicle Entry (Gate OUT)",
                userName: currentName,
                deletedAt: serverTimestamp(),
                data: { ...data, id: id, type: 'VehicleEntry' }
            });

            await addDoc(collection(db, "activity_logs"), {
                userId: user.uid,
                userName: currentName,
                action: 'Delete',
                tcode: 'Vehicle Entry',
                pageName: 'Gate Register History',
                timestamp: serverTimestamp(),
                description: `Permanently purged vehicle exit entry.`
            });

            await deleteDoc(docRef);
            toast({ title: 'Record Removed', description: 'Exit entry archived in recycle bin and purged from gate history.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            hideLoader();
        }
    };

    const getOutTypeBadgeStyle = (type?: string) => {
        switch(type) {
            case 'Loaded': return 'bg-emerald-600 text-white';
            case 'Empty': return 'bg-slate-500 text-white';
            case 'Unloaded': return 'bg-blue-600 text-white';
            case 'Not Unload': return 'bg-red-600 text-white';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    return (
        <>
        <div className="mt-12 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
                <div className="flex flex-wrap items-end gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 text-white rounded-lg shadow-lg"><ArchiveRestore className="h-5 w-5" /></div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Gate Exit History</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Permanent record of departures</p>
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400">Date Range Registry</label>
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                            <DatePicker date={fromDate} setDate={setFromDate} className="border-none shadow-none h-8 min-w-[140px]" />
                            <Minus className="h-3 w-3 text-slate-300" />
                            <DatePicker date={toDate} setDate={setTodayDate} className="border-none shadow-none h-8 min-w-[140px]" />
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400">Registry Search</label>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                            <Input placeholder="Vehicle, LR, Invoice..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 w-[280px] h-10 rounded-xl bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900" />
                        </div>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="h-10 px-5 gap-2 font-black text-[11px] uppercase border-slate-300 text-blue-900 hover:bg-white shadow-sm" onClick={handleExport} disabled={filtered.length === 0}>
                    <FileDown className="h-4 w-4" /> Export History
                </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 shadow-xl bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="hover:bg-transparent border-b border-slate-200">
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Plant</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-center">IN Date/Time</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Vehicle Number</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Driver Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Purpose</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-center">Exit Date/Time</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-center">Exit Type</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">LR No</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Invoice No</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-right">Qty (Type)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({length: 5}).map((_, i) => (<TableRow key={i}><TableCell colSpan={11} className="py-4"><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
                            ) : paginated.length === 0 ? (
                                <TableRow><TableCell colSpan={11} className="h-48 text-center text-slate-400 italic font-medium">No records matching selected criteria.</TableCell></TableRow>
                            ) : (
                                paginated.map(e => (
                                    <TableRow key={e.id} className="hover:bg-slate-50 transition-colors h-14 border-b border-slate-100 group">
                                        <TableCell className="px-4 font-bold text-slate-600 whitespace-nowrap">{plants?.find(p => p.id === e.plantId)?.name || e.plantId}</TableCell>
                                        <TableCell className="px-4 text-center whitespace-nowrap text-slate-500 font-mono text-[11px]">{format(e.entryTimestamp, 'dd-MM-yyyy HH:mm')}</TableCell>
                                        <TableCell className="px-4 font-black text-slate-900 tracking-tighter uppercase whitespace-nowrap">{e.vehicleNumber}</TableCell>
                                        <TableCell className="px-4 whitespace-nowrap truncate max-w-[120px] font-medium text-slate-600">{e.driverName || '--'}</TableCell>
                                        <TableCell className="px-4">
                                            <Badge variant="outline" className={cn("text-[9px] uppercase font-black px-2 py-0.5", e.purpose === 'Loading' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-orange-200 text-orange-700 bg-orange-50')}>
                                                {e.purpose}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 text-center whitespace-nowrap text-blue-700 font-black font-mono text-[11px]">{format(e.exitTimestamp!, 'dd-MM-yyyy HH:mm')}</TableCell>
                                        <TableCell className="px-4 text-center">
                                            <Badge className={cn("text-[9px] uppercase font-black px-2 py-0.5 border-none shadow-sm", getOutTypeBadgeStyle(e.outType))}>
                                                {e.outType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 text-[11px] font-bold text-slate-800">{e.lrNumber || '--'}</TableCell>
                                        <TableCell className="px-4 text-[11px] font-bold text-slate-800">{e.documentNo || '--'}</TableCell>
                                        <TableCell className="px-4 text-right font-black text-blue-900 whitespace-nowrap">
                                            {e.billedQty ? `${e.billedQty} ${e.qtyType || 'MT'}` : '--'}
                                        </TableCell>
                                        <TableCell className="px-4 text-right">
                                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isAdminSession && (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => setEditingItem(e)}><Edit2 className="h-4 w-4" /></Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                            <AlertDialogContent className="border-none shadow-2xl p-0 overflow-hidden">
                                                                <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                                                    <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><AlertTriangle className="h-6 w-6" /></div>
                                                                    <div>
                                                                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Purge Exit Entry?</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-sm font-medium">This will permanently erase the departure record for <span className="font-bold text-slate-900">{e.vehicleNumber}</span>. This action is irreversible.</AlertDialogDescription>
                                                                    </div>
                                                                </div>
                                                                <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-lg">
                                                                    <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(e.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8">Confirm Purge</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-2 shadow-sm flex items-center justify-between mt-4">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filtered.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
            </div>
        </div>
        {editingItem && (
            <EditVehicleOutModal 
                isOpen={!!editingItem} 
                onClose={() => setEditingItem(null)} 
                entry={editingItem} 
            />
        )}
        </>
    );
}

export default function VehicleOut() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();
    const [inVehicles, setInVehicles] = useState<WithId<VehicleEntryExit>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
    const { data: plants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

    useEffect(() => {
        if (!firestore || !user) return;
        const q = query(collection(firestore, "vehicleEntries"), where("status", "==", "IN"));
        const unsubscribe = onSnapshot(q, (snap) => {
            setInVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, user]);

    const handleVehicleOut = async (vehicleEntryId: string, outData: Partial<VehicleEntryExit>) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const entryRef = doc(firestore, 'vehicleEntries', vehicleEntryId);
            const entrySnap = await getDoc(entryRef);
            if (!entrySnap.exists()) return;
            const entry = entrySnap.data() as VehicleEntryExit;

            const userSnap = await getDoc(doc(firestore, "users", user.uid));
            const currentName = userSnap.exists() ? (userSnap.data() as SubUser).fullName : (user.displayName || user.email?.split('@')[0] || 'Operator');

            const batch = writeBatch(firestore);
            batch.update(entryRef, { 
                ...outData, 
                status: 'OUT', 
                exitTimestamp: serverTimestamp(),
                lastUpdated: serverTimestamp(),
                updatedBy: currentName
            });

            const masterQ = query(collection(firestore, "vehicles"), where("vehicleNumber", "==", entry.vehicleNumber));
            const masterS = await getDocs(masterQ);
            
            if (!masterS.empty) {
                batch.update(doc(firestore, "vehicles", masterS.docs[0].id), { 
                    status: outData.outType === 'Loaded' ? 'in-transit' : 'available' 
                });
            }

            if (entry.tripId) {
                const tripRef = doc(firestore, `plants/${entry.plantId}/trips`, entry.tripId);
                const globalTripRef = doc(firestore, 'trips', entry.tripId);
                
                const tripUpdate = { 
                    tripStatus: 'In-Transit', 
                    currentStatusId: 'in-transit',
                    outDate: serverTimestamp(), 
                    lastUpdated: serverTimestamp() 
                };
                batch.update(tripRef, tripUpdate);
                batch.update(globalTripRef, tripUpdate);
            }

            batch.set(doc(collection(firestore, "activity_logs")), {
                userId: user.uid,
                userName: currentName,
                action: 'Edit',
                tcode: 'Vehicle Entry',
                pageName: 'Vehicle Exit',
                timestamp: serverTimestamp(),
                description: `Vehicle OUT Processed: ${entry.vehicleNumber} marked as ${outData.outType}. Status synchronized to In-Transit.`
            });

            await batch.commit();
            toast({ title: "Departure Verified", description: `Vehicle ${entry.vehicleNumber} successfully cleared from gate registry.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            hideLoader();
        }
    };

    return (
        <div className="space-y-12 pb-12">
            <VehicleOutForm inVehicles={inVehicles} onVehicleOut={handleVehicleOut} plants={plants || []} isLoadingPlants={isLoadingPlants} />
            <VehicleOutHistory />
        </div>
    );
}
