'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { cn, normalizePlantId } from '@/lib/utils';
import { QtyTypes } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, History, Search, Clock, Trash2, Edit2, Plus, AlertTriangle, Save, ShieldCheck, Factory } from 'lucide-react';
import { format, differenceInHours, startOfDay, endOfDay, isValid } from 'date-fns';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, onSnapshot, getDocs, Timestamp, getDoc, deleteDoc, limit } from 'firebase/firestore';
import type { Plant, VehicleEntryExit, WithId, SubUser } from '@/types';
import { UpcomingVehicleData } from '@/app/dashboard/vehicle-entry/page';
import { useLoading } from '@/context/LoadingContext';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/date-picker';

const HISTORY_ITEMS_PER_PAGE = 10;
const vehicleNumberRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;

const formSchema = z.object({
  plantId: z.string().min(1, 'Plant selection is mandatory.'),
  vehicleNumber: z.string()
    .min(1, 'Vehicle number is required.')
    .transform(val => val.toUpperCase().replace(/\s/g, ''))
    .refine(val => vehicleNumberRegex.test(val), {
      message: 'Invalid Format (Example: MH12AB1234)'
    }),
  driverName: z.string().optional().default(''),
  driverMobile: z.string().optional().default('').refine(val => !val || val === '' || /^\d{10}$/.test(val), {
    message: 'Valid 10-digit mobile required.'
  }),
  licenseNumber: z.string().optional().default(''),
  purpose: z.enum(['Loading', 'Unloading'], { required_error: 'Registry purpose is mandatory.' }),
  from: z.string().optional().default(''),
  lrNumber: z.string().optional().default(''),
  lrDate: z.date().nullable().optional(),
  totalUnits: z.coerce.number().optional().default(0),
  documentNo: z.string().optional().default(''), 
  billedQty: z.coerce.number().optional().default(0),
  qtyType: z.string().optional().default(''),
  items: z.string().optional().default(''),
  isUpcoming: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.purpose === 'Unloading') {
    if (!data.from?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Lifting Site mandatory for Unloading.', path: ['from'] });
    }
    if (!data.lrNumber?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'LR Number mandatory for Unloading.', path: ['lrNumber'] });
    }
    if (!data.documentNo || data.documentNo.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invoice Ref mandatory for Unloading.', path: ['documentNo'] });
    }
    if (data.billedQty === undefined || data.billedQty <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid Quantity required for Unloading.', path: ['billedQty'] });
    }
    if (!data.qtyType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unit required.', path: ['qtyType'] });
    }
    if (!data.items?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Goods description mandatory.', path: ['items'] });
    }
  }
});

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    try {
        if (date instanceof Timestamp) return date.toDate();
        if (date instanceof Date) return isValid(date) ? date : null;
        if (typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000);
        }
        const d = new Date(date);
        return isValid(d) ? d : null;
    } catch (e) {
        return null;
    }
};

interface VehicleInProps {
  upcomingVehicleData?: UpcomingVehicleData | null;
}

function EditVehicleInModal({ 
    isOpen, 
    onClose, 
    entry, 
    plants 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    entry: WithId<VehicleEntryExit>; 
    plants: WithId<Plant>[];
}) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            plantId: entry.plantId,
            vehicleNumber: entry.vehicleNumber,
            driverName: entry.driverName || '',
            driverMobile: entry.driverMobile || '',
            licenseNumber: entry.licenseNumber || '',
            purpose: entry.purpose,
            from: entry.from || '',
            lrNumber: entry.lrNumber || '',
            lrDate: getSafeDate(entry.lrDate),
            totalUnits: entry.totalUnits || 0,
            documentNo: entry.documentNo || '',
            billedQty: Number(entry.billedQty) || 0,
            qtyType: entry.qtyType || '',
            items: entry.items || '',
            isUpcoming: !!entry.tripId,
        }
    });

    const { watch, setValue, handleSubmit, formState: { isSubmitting } } = form;
    const purpose = watch('purpose');

    useEffect(() => {
        if (purpose === 'Loading') {
            setValue('from', '');
            setValue('lrNumber', '');
            setValue('lrDate', null);
            setValue('totalUnits', 0);
            setValue('documentNo', '');
            setValue('billedQty', 0);
            setValue('qtyType', '');
            setValue('items', '');
        }
    }, [purpose, setValue]);

    const onUpdate = async (values: z.infer<typeof formSchema>) => {
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
                pageName: 'Gate Entry',
                timestamp: serverTimestamp(),
                description: `Corrected gate entry for ${entry.vehicleNumber}.`
            });

            toast({ title: 'Record Committed', description: `Changes for ${entry.vehicleNumber} successfully updated.` });
            onClose();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Registry Error', description: error.message });
        } finally {
            hideLoader();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-none shadow-2xl p-0">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                        <Edit2 className="h-5 w-5 text-blue-400" /> Correct Registry Entry
                    </DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                        MISSION Registry Sync Ref: {entry.id}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-8">
                    <Form {...form}>
                        <form onSubmit={handleSubmit(onUpdate)} className="space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                <FormField control={form.control} name="plantId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plant Node</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-white font-bold border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{plants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />

                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle Registry</FormLabel>
                                    <Input disabled value={entry.vehicleNumber} className="h-11 bg-slate-50 font-black text-slate-400 border-slate-200" />
                                </FormItem>

                                <FormField control={form.control} name="purpose" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Purpose</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-bold border-slate-200"><SelectValue placeholder="Pick Purpose" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Loading">LOADING (Outward)</SelectItem>
                                                <SelectItem value="Unloading">UNLOADING (Inward)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="driverName" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilot Name</FormLabel><FormControl><Input {...field} className="h-11 font-bold border-slate-200" /></FormControl></FormItem>
                                )} />
                            </div>

                            {purpose === 'Unloading' && (
                                <div className="p-8 bg-blue-50/30 rounded-3xl border border-blue-100 space-y-8 animate-in fade-in slide-in-from-top-4">
                                    <div className="flex items-center gap-2 border-b border-blue-100 pb-3">
                                        <Badge className="bg-blue-900 font-black uppercase text-[10px] tracking-widest px-4 py-1">Registry Correction</Badge>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                        <FormField control={form.control} name="from" render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">From (Lifting Site) *</FormLabel>
                                                <FormControl><Input {...field} className="h-11 bg-white font-bold border-blue-200" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="lrNumber" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">LR / CN No *</FormLabel><FormControl><Input {...field} className="h-11 bg-white font-bold border-blue-200" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="documentNo" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">Inbound Invoice *</FormLabel><FormControl><Input {...field} className="h-11 bg-white font-black text-blue-900 border-blue-200" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="billedQty" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">Quantity *</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-11 bg-white font-black text-blue-900 border-blue-200" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="qtyType" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-blue-600">Unit *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-11 bg-white font-bold border-blue-200"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>{QtyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                    <FormField control={form.control} name="items" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">Goods Description *</FormLabel><FormControl><Input {...field} className="h-11 bg-white font-medium border-blue-200" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            )}

                            <DialogFooter className="border-t pt-6 bg-slate-50 -mx-8 -mb-8 p-6">
                                <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400">Cancel Edit</Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 px-10 h-11 rounded-xl gap-2 font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95">
                                    <Save className="h-4 w-4 mr-2" />
                                    Commit Registry Changes
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function VehicleInForm({ upcomingVehicleData }: VehicleInProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: allPlants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    setCurrentDate(new Date());
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantId: upcomingVehicleData?.originPlantId || '',
      vehicleNumber: upcomingVehicleData?.vehicleNumber || '',
      driverName: upcomingVehicleData?.driverName || '',
      driverMobile: upcomingVehicleData?.driverMobile || '',
      licenseNumber: '',
      purpose: upcomingVehicleData ? 'Loading' : undefined,
      from: '',
      lrNumber: upcomingVehicleData?.lrNumber || '',
      lrDate: getSafeDate(upcomingVehicleData?.lrDate),
      totalUnits: upcomingVehicleData?.totalUnits || 0,
      documentNo: '',
      billedQty: 0,
      qtyType: '',
      items: '',
      isUpcoming: !!upcomingVehicleData,
    },
  });

  const { watch, handleSubmit, setValue, reset, formState: { isSubmitting }, register } = form;
  const purpose = watch('purpose');

  useEffect(() => {
    if (isLoadingPlants || !user || !firestore || !allPlants) return;

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
                authIds = isRoot ? allPlants.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdminSession) {
                authIds = allPlants.map(p => p.id);
            }

            const filtered = allPlants.filter(p => authIds.includes(p.id));
            setAuthorizedPlants(filtered);
            
            if (filtered.length > 0) {
                const defaultId = upcomingVehicleData?.originPlantId || filtered[0].id;
                setValue('plantId', defaultId);
            }
            setIsAuthLoading(false);
        } catch (e) {
            console.error("Auth sync error:", e);
            setIsAuthLoading(false);
        }
    };
    syncAuth();
  }, [isLoadingPlants, allPlants, user, isAdminSession, upcomingVehicleData, setValue, firestore]);

  useEffect(() => {
    if (purpose === 'Loading') {
        setValue('from', '');
        setValue('lrNumber', '');
        setValue('lrDate', null);
        setValue('totalUnits', 0);
        setValue('documentNo', '');
        setValue('billedQty', 0);
        setValue('qtyType', '');
        setValue('items', '');
    }
  }, [purpose, setValue]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        const entryRef = collection(firestore, 'vehicleEntries');
        const activeInQuery = query(entryRef, where("status", "==", "IN"), where("vehicleNumber", "==", values.vehicleNumber));
        const activeInSnap = await getDocs(activeInQuery);

        if (!activeInSnap.empty) {
            toast({ variant: 'destructive', title: 'Data Conflict', description: `Vehicle ${values.vehicleNumber} is already logged as present at gate.` });
            hideLoader();
            return;
        }

        const userSnap = await getDoc(doc(firestore, "users", user.uid));
        const currentName = userSnap.exists() ? (userSnap.data() as SubUser).fullName : (user.displayName || user.email?.split('@')[0] || 'System Operator');

        const dataToSave: any = {
            ...values,
            status: 'IN',
            remarks: values.purpose === 'Unloading' ? 'In Process' : (upcomingVehicleData ? 'Assigned' : 'Available'),
            entryTimestamp: serverTimestamp(),
            statusUpdatedAt: serverTimestamp(),
            statusUpdatedBy: currentName,
            tripId: upcomingVehicleData?.id || null,
            createdBy: currentName,
            userId: user.uid,
            createdAt: serverTimestamp()
        };

        delete (dataToSave as any).isUpcoming;

        await addDoc(entryRef, dataToSave);

        await addDoc(collection(firestore, "activity_logs"), {
            userId: user.uid,
            userName: currentName,
            action: 'Create',
            tcode: 'Vehicle Entry',
            pageName: 'Gate Entry',
            timestamp: serverTimestamp(),
            description: `Gate Entry (IN) created for ${values.vehicleNumber}. Purpose: ${values.purpose}.`
        });

        toast({ title: 'System IN Logged', description: `Vehicle ${values.vehicleNumber} successfully added to gate registry.` });
        reset({
            plantId: authorizedPlants[0]?.id || '',
            vehicleNumber: '',
            driverName: '',
            driverMobile: '',
            licenseNumber: '',
            purpose: undefined,
            from: '',
            lrNumber: '',
            lrDate: null,
            totalUnits: 0,
            documentNo: '',
            billedQty: 0,
            qtyType: '',
            items: '',
            isUpcoming: false
        });
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Database Error", description: error.message });
    } finally {
        hideLoader();
    }
  };

  const isReadOnlyPlant = !isAdminSession && authorizedPlants.length === 1;

  return (
    <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
      <CardHeader className="bg-slate-50 border-b p-6">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><ShieldCheck className="h-5 w-5" /></div>
            <div>
                <CardTitle className="text-xl font-black text-blue-900 uppercase">Create Gate Entry (IN)</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest text-slate-400">Capture arrival particulars for gate registry</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="pt-8 px-8 pb-8">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
              <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-inner flex flex-col justify-center h-full">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Registry Timestamp</label>
                <p className="text-sm font-black text-blue-900 font-mono tracking-tight">{currentDate ? format(currentDate, 'dd-MM-yyyy HH:mm') : '...'}</p>
              </div>

              {isReadOnlyPlant ? (
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingPlants || isAuthLoading}>
                        <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-bold shadow-sm border-slate-200"><SelectValue placeholder="Select node" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {authorizedPlants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )} />
              )}

              <FormField control={form.control} name="vehicleNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vehicle Registry *</FormLabel>
                  <FormControl><Input placeholder="XX00XX0000" {...field} className="h-11 rounded-xl font-mono font-black text-blue-900 uppercase bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="purpose" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Purpose *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-bold border-slate-200"><SelectValue placeholder="Pick Purpose" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Loading">LOADING (Outward)</SelectItem>
                      <SelectItem value="Unloading">UNLOADING (Inward)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="driverName" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pilot Name</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold bg-white border-slate-200" /></FormControl></FormItem>
              )} />

              <FormField control={form.control} name="driverMobile" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Contact Number</FormLabel><FormControl><Input type="tel" {...field} className="h-11 rounded-xl font-mono bg-white border-slate-200" /></FormControl><FormMessage /></FormItem>)} />

              <FormField control={form.control} name="licenseNumber" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pilot DL Number</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl uppercase font-mono bg-white border-slate-200" /></FormControl></FormItem>
              )} />
            </div>

            {purpose === 'Unloading' && (
                <div className="p-8 bg-blue-50/30 rounded-3xl border border-blue-100 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 shadow-inner">
                    <div className="flex items-center gap-2 border-b border-blue-100 pb-3">
                        <Badge className="bg-blue-900 font-black uppercase text-[10px] tracking-widest px-4 py-1">Inbound Particulars</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <FormField control={form.control} name="from" render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">From (Location / Plant) *</FormLabel>
                                <FormControl><Input {...field} className="h-11 rounded-xl border-blue-200 bg-white font-bold" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="lrNumber" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Inbound LR Number *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-blue-200 bg-white font-black text-blue-900" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="documentNo" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Inbound Invoice *</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl border-blue-200 bg-white font-black text-blue-900" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="billedQty" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Billed Quantity</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-11 rounded-xl border-blue-200 bg-white font-black text-blue-900" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="qtyType" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Quantity Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 rounded-xl bg-white border-blue-200 font-bold"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                    <SelectContent>{QtyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <FormField control={form.control} name="items" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Goods Description *</FormLabel>
                            <FormControl>
                                <Input placeholder="Item particulars separated by comma..." {...field} className="h-11 rounded-xl border-blue-200 bg-white font-medium" />
                            </FormControl>
                        </FormItem>
                    )} />
                </div>
            )}

            <div className="flex gap-4 pt-6 border-t border-slate-100 justify-end">
              <Button type="button" variant="ghost" onClick={() => form.reset()} className="h-12 px-10 font-black uppercase text-[11px] tracking-widest text-slate-400 hover:text-slate-900 transition-all">Reset Entry</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 px-16 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-200 transition-all active:scale-95 border-none">
                {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : null}
                Finalize System IN
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function VehicleInHistory() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoading();
  const [history, setHistory] = useState<WithId<VehicleEntryExit>[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingItem, setEditingItem] = useState<WithId<VehicleEntryExit> | null>(null);

  const plantsQuery = useMemoFirebase(() => db ? query(collection(db, "logistics_plants")) : null, [db]);
  const { data: plants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!db || !user) return;
    const q = query(collection(db, "vehicleEntries"), where("status", "==", "IN"));
    const unsub = onSnapshot(q, async (snap) => {
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(db, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            if (!userQSnap.empty) {
                userDocSnap = userQSnap.docs[0];
            } else {
                const uidSnap = await getDoc(doc(db, "users", user.uid));
                if (uidSnap.exists()) userDocSnap = uidSnap;
            }

            let authPlantIds: string[] = [];
            const isRoot = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isUserRoot = userData.username?.toLowerCase() === 'sikkaind' || isRoot;
                authPlantIds = isUserRoot && plants ? plants.map(p => p.id) : (userData.plantIds || []);
            } else if (isRoot && plants) {
                authPlantIds = plants.map(p => p.id);
            }

            const entries = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                entryTimestamp: d.data().entryTimestamp instanceof Timestamp ? d.data().entryTimestamp.toDate() : new Date(d.data().entryTimestamp)
            } as any)).filter(e => isRoot || authPlantIds.includes(e.plantId));
            
            entries.sort((a, b) => b.entryTimestamp.getTime() - a.entryTimestamp.getTime());
            setHistory(entries);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    });
    return () => unsub();
  }, [db, user, plants]);

  const filteredHistory = useMemo(() => history.filter(e =>
    e.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.driverName && e.driverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.items && e.items.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [history, searchTerm]);

  const totalPages = Math.ceil(filteredHistory.length / HISTORY_ITEMS_PER_PAGE);
  const paginated = filteredHistory.slice((currentPage - 1) * HISTORY_ITEMS_PER_PAGE, currentPage * HISTORY_ITEMS_PER_PAGE);

  const handleDelete = async (id: string) => {
    if (!db || !user) return;
    showLoader();
    try {
        const docRef = doc(db, "vehicleEntries", id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return;
        const entryData = docSnap.data();

        const currentName = (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') 
            ? 'AJAY SOMRA' 
            : (user.displayName || user.email?.split('@')[0] || 'System Operator');

        // Move to Recycle Bin Registry before Purge
        await addDoc(collection(db, "recycle_bin"), {
            pageName: "Vehicle Entry (Gate IN)",
            userName: currentName,
            deletedAt: serverTimestamp(),
            data: { ...entryData, id: id, type: 'VehicleEntry' }
        });

        await addDoc(collection(db, "activity_logs"), {
            userId: user.uid,
            userName: currentName,
            action: 'Delete',
            tcode: 'Vehicle Entry',
            pageName: 'Gate Registry',
            timestamp: serverTimestamp(),
            description: `Permanently purged registry entry for Vehicle ${entryData.vehicleNumber}.`
        });

        await deleteDoc(docRef);
        toast({ title: 'Record Purged', description: 'Entry archived in recycle bin and removed from active gate history.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    } finally {
        hideLoader();
    }
  };

  const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  return (
    <>
    <div className="mt-12 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-lg shadow-lg"><History className="h-5 w-5" /></div>
            <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Active Gate Registry</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Real-time status of vehicles within plant nodes</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                <Input placeholder="Filter registry data..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 w-[280px] h-10 rounded-xl bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900" />
            </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 shadow-xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
            <Table>
            <TableHeader className="bg-slate-50">
                <TableRow className="hover:bg-transparent border-b border-slate-200">
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Plant Node</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-center">IN Time</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Vehicle Number</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Purpose</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">LR No.</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Invoice Ref</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-right">Quantity</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Goods Manifest</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-center">Status</TableHead>
                <TableHead className="text-[10px) font-black uppercase tracking-wider h-12 px-4 text-center">Stay</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-right">Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({length: 5}).map((_, i) => (<TableRow key={i}><TableCell colSpan={11} className="py-4"><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
                ) : filteredHistory.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center h-48 text-slate-400 italic font-medium text-sm">No vehicles detected in active gate registry.</TableCell></TableRow>
                ) : (
                paginated.map(entry => {
                    const stayHours = differenceInHours(new Date(), entry.entryTimestamp);
                    const plantName = plants?.find(p => normalizePlantId(p.id).toLowerCase() === normalizePlantId(entry.plantId).toLowerCase())?.name || entry.plantId;
                    return (
                        <TableRow key={entry.id} className="hover:bg-slate-50 transition-colors h-14 border-b border-slate-100 group">
                            <TableCell className="px-4 font-black text-slate-600 uppercase whitespace-nowrap">{plantName}</TableCell>
                            <TableCell className="px-4 text-center whitespace-nowrap text-slate-500 font-mono text-[11px] font-bold">{format(entry.entryTimestamp, 'dd-MM-yyyy HH:mm')}</TableCell>
                            <TableCell className="px-4 font-black text-slate-900 tracking-tighter uppercase whitespace-nowrap">{entry.vehicleNumber}</TableCell>
                            <TableCell className="px-4">
                                <Badge variant="outline" className={cn("text-[9px] uppercase font-black px-2 py-0.5", entry.purpose === 'Loading' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-orange-200 text-orange-700 bg-orange-50')}>
                                    {entry.purpose}
                                </Badge>
                            </TableCell>
                            <TableCell className="px-4 text-[11px] font-bold text-slate-800">{entry.lrNumber || '--'}</TableCell>
                            <TableCell className="px-4 text-[11px] font-bold text-slate-800">{entry.documentNo || '--'}</TableCell>
                            <TableCell className="px-4 text-right font-black text-blue-900 whitespace-nowrap">
                                {entry.billedQty ? `${entry.billedQty} ${entry.qtyType || 'MT'}` : '--'}
                            </TableCell>
                            <TableCell className="px-4">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="text-[11px] font-bold text-slate-500 truncate max-w-[120px] block cursor-help">{entry.items || '--'}</span>
                                        </TooltipTrigger>
                                        {entry.items && <TooltipContent className="max-w-xs p-3 font-black text-[10px] uppercase bg-slate-900 text-white border-none shadow-2xl"><p>{entry.items}</p></TooltipContent>}
                                    </Tooltip>
                                </TooltipProvider>
                            </TableCell>
                            <TableCell className="px-4 text-center">
                                <Badge className={cn(
                                    "text-[9px] uppercase font-black px-2 py-0.5 border-none shadow-sm",
                                    entry.remarks === 'Available' ? 'bg-emerald-600 text-white' : 
                                    (entry.remarks === 'Assigned' || entry.remarks === 'In Process' || entry.remarks === 'Under Process' || entry.remarks === 'Loading Completed') ? 'bg-blue-600 text-white' :
                                    'bg-slate-400 text-white'
                                )}>
                                    {entry.remarks || 'IN'}
                                </Badge>
                            </TableCell>
                            <TableCell className="px-4 text-center">
                                <div className="flex flex-col items-center">
                                    <span className={cn("font-black text-xs", stayHours > 24 ? "text-red-600" : stayHours > 12 ? "text-amber-600" : "text-emerald-600")}>
                                        {stayHours}h
                                    </span>
                                    <Clock className="h-3 w-3 text-slate-300 mt-0.5" />
                                </div>
                            </TableCell>
                            <TableCell className="px-4 text-right">
                                <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isAdminSession && (
                                        <>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => setEditingItem(entry)}><Edit2 className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent className="border-none shadow-2xl p-0 overflow-hidden bg-white">
                                                    <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                                        <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><AlertTriangle className="h-6 w-6" /></div>
                                                        <div>
                                                            <AlertDialogTitle className="text-xl font-black text-red-900 uppercase tracking-tight">Security Purge</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-red-700 font-bold text-[9px] uppercase tracking-widest mt-1">Authorized Deletion Override</AlertDialogDescription>
                                                        </div>
                                                    </div>
                                                    <div className="p-8">
                                                        <p className="text-sm font-medium text-slate-600 leading-relaxed">
                                                            You are about to permanently purge the entry record for <span className="font-black text-slate-900 underline decoration-red-200 underline-offset-4">{entry.vehicleNumber}</span>. This action erases the mission particulars from the live registry and is irreversible.
                                                        </p>
                                                    </div>
                                                    <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                                                        <AlertDialogCancel className="font-bold border-slate-200 rounded-xl px-8 h-10 m-0">Abort</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(entry.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[11px] tracking-widest px-10 h-10 rounded-xl shadow-lg shadow-red-100 border-none">Execute Purge</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                })
                )}
            </TableBody>
            </Table>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-2 shadow-sm flex items-center justify-between mt-4">
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filteredHistory.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
      </div>
    </div>
    {editingItem && (
        <EditVehicleInModal 
            isOpen={!!editingItem} 
            onClose={() => setEditingItem(null)} 
            entry={editingItem} 
            plants={plants || []} 
        />
    )}
    </>
  );
}

export default function VehicleIn({ upcomingVehicleData }: VehicleInProps) {
  return (
    <div className="space-y-12 pb-12 animate-in fade-in duration-500">
        <VehicleInForm upcomingVehicleData={upcomingVehicleData} />
        <VehicleInHistory />
    </div>
  );
}
