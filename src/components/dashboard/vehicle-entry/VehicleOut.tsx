
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Plus, 
    ShieldCheck, 
    Loader2, 
    ArrowRightLeft,
    FileText,
    Weight,
    Sparkles
} from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, doc, updateDoc, serverTimestamp, onSnapshot, getDoc, orderBy } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useLoading } from '@/context/LoadingContext';
import type { Plant, SubUser, Trip, Shipment } from '@/types';
import { normalizePlantId } from '@/lib/utils';

const formSchema = z.object({
  plantId: z.string().min(1, "Select Plant Node."),
  entryId: z.string().min(1, "Pick an active vehicle node."),
  exitStatus: z.enum(['Loaded', 'Empty'], { required_error: "Pick Status" }),
  lrNumber: z.string().optional().or(z.literal('')),
  invoiceNumber: z.string().optional().or(z.literal('')),
  exitWeight: z.coerce.number().optional(),
  weightUnit: z.string().optional().default('MT'),
});

type FormValues = z.infer<typeof formSchema>;

export default function VehicleOut() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: allPlants } = useCollection<Plant>(plantsQuery);

  const userProfileRef = useMemo(() => (firestore && user?.email) ? doc(firestore, "users", user.email) : null, [firestore, user]);
  const { data: profile } = useDoc<SubUser>(userProfileRef);

  const authorizedPlants = useMemo(() => {
    if (!allPlants) return [];
    const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
    if (isAdmin) return allPlants;
    const authIds = profile?.plantIds || [];
    return allPlants.filter(p => authIds.some(aid => normalizePlantId(aid) === normalizePlantId(p.id)));
  }, [allPlants, profile, user]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { plantId: '', entryId: '', exitStatus: 'Loaded', lrNumber: '', invoiceNumber: '', exitWeight: 0, weightUnit: 'MT' },
  });

  const { watch, handleSubmit, reset, setValue } = form;
  const selectedPlantId = watch('plantId');
  const selectedEntryId = watch('entryId');
  const exitStatus = watch('exitStatus');

  const [activeEntries, setActiveEntries] = useState<any[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  useEffect(() => {
    if (!firestore || !selectedPlantId) {
        setActiveEntries([]);
        return;
    }
    
    setIsLoadingEntries(true);
    const q = query(
        collection(firestore, "vehicleEntries"), 
        where("plantId", "==", normalizePlantId(selectedPlantId)),
        where("status", "==", "IN")
    );

    const unsub = onSnapshot(q, (snap) => {
        setActiveEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setIsLoadingEntries(false);
    });

    return () => unsub();
  }, [firestore, selectedPlantId]);

  useEffect(() => {
    if (!selectedEntryId || !firestore || exitStatus !== 'Loaded') return;
    
    const entry = activeEntries.find(e => e.id === selectedEntryId);
    if (!entry) return;

    const fetchMissionData = async () => {
        try {
            const plantId = normalizePlantId(entry.plantId);
            if (entry.tripId) {
                const tripRef = doc(firestore, `plants/${plantId}/trips`, entry.tripId);
                const tripSnap = await getDoc(tripRef);
                if (tripSnap.exists()) {
                    const tripData = tripSnap.data() as Trip;
                    setValue('lrNumber', tripData.lrNumber || '', { shouldValidate: true });
                    setValue('exitWeight', tripData.assignedQtyInTrip || 0, { shouldValidate: true });
                    if (tripData.shipmentIds && tripData.shipmentIds.length > 0) {
                        const shipRef = doc(firestore, `plants/${plantId}/shipments`, tripData.shipmentIds[0]);
                        const shipSnap = await getDoc(shipRef);
                        if (shipSnap.exists()) {
                            setValue('invoiceNumber', (shipSnap.data() as Shipment).invoiceNumber || '', { shouldValidate: true });
                        }
                    }
                }
            } else if (entry.purpose === 'Unloading') {
                setValue('lrNumber', entry.lrNumber || '', { shouldValidate: true });
                setValue('invoiceNumber', entry.documentNo || '', { shouldValidate: true });
                setValue('exitWeight', entry.billedQty || 0, { shouldValidate: true });
            }
        } catch (e) {
            console.error("Registry lookup failure:", e);
        }
    };
    fetchMissionData();
  }, [selectedEntryId, activeEntries, exitStatus, firestore, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;
    const entry = activeEntries.find(e => e.id === values.entryId);
    if (!entry) return;

    showLoader();
    try {
        const ts = serverTimestamp();
        const entryRef = doc(firestore, "vehicleEntries", values.entryId);
        await updateDoc(entryRef, {
            status: 'OUT',
            outType: values.exitStatus,
            exitTimestamp: ts,
            lastUpdated: ts,
            exitLrNumber: values.lrNumber,
            exitInvoiceNumber: values.invoiceNumber,
            exitWeight: values.exitWeight,
            weightUnit: values.weightUnit
        });

        if (entry.tripId) {
            const globalTripRef = doc(firestore, 'trips', entry.tripId);
            const plantTripRef = doc(firestore, `plants/${entry.plantId}/trips`, entry.tripId);
            const tripUpdate = { tripStatus: 'In Transit', outDate: ts, lastUpdated: ts };
            await updateDoc(globalTripRef, tripUpdate);
            try { await updateDoc(plantTripRef, tripUpdate); } catch(e) {}
        }

        toast({ title: 'Success', description: `Vehicle ${entry.vehicleNumber} marked as OUT.` });
        reset({ plantId: values.plantId, entryId: '', exitStatus: 'Loaded', lrNumber: '', invoiceNumber: '', exitWeight: 0, weightUnit: 'MT' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        hideLoader();
    }
  };

  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white animate-in fade-in duration-500">
        <CardHeader className="p-8 pb-4">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-900 text-white rounded-xl shadow-lg rotate-3"><ArrowRightLeft className="h-6 w-6" /></div>
                <div>
                    <CardTitle className="text-xl font-black uppercase text-blue-900 italic">GATE EXIT REGISTRY (OUT)</CardTitle>
                    <CardDescription className="text-[10px] font-bold text-slate-400 tracking-widest">Finalize mission node and yard departure</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                        <div className="p-6 bg-slate-50/80 rounded-[1.5rem] border border-slate-100 space-y-2 shadow-inner">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">EXIT TIMESTAMP</p>
                            <p className="text-sm font-black text-blue-900 font-mono tracking-tighter">{format(currentTime, 'dd-MM-yyyy HH:mm')}</p>
                        </div>
                        <FormField name="plantId" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">PLANT NODE *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-12 bg-white rounded-xl font-black text-slate-700 shadow-sm border-slate-200"><SelectValue placeholder="Pick node" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl">{authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic">{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField name="entryId" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">VEHICLES CURRENTLY IN *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPlantId || isLoadingEntries}>
                                    <FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 shadow-sm border-slate-200 overflow-hidden"><SelectValue placeholder={isLoadingEntries ? "Syncing..." : "Pick vehicle"} /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">{activeEntries.map(e => <SelectItem key={e.id} value={e.id} className="font-bold py-3 uppercase">{e.vehicleNumber} ({e.purpose})</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField name="exitStatus" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">EXIT STATUS *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-black text-slate-700 shadow-sm border-slate-200"><SelectValue placeholder="Pick Status" /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl"><SelectItem value="Loaded" className="font-bold py-3 uppercase">LOADED</SelectItem><SelectItem value="Empty" className="font-bold py-3 uppercase">EMPTY</SelectItem></SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    </div>
                    {exitStatus === 'Loaded' && (
                        <div className="p-10 bg-blue-50/20 rounded-[2.5rem] border border-blue-100 animate-in slide-in-from-top-4 duration-500 shadow-xl space-y-8">
                            <div className="flex items-center gap-3 border-b border-blue-100 pb-4"><FileText className="h-5 w-5 text-blue-600" /><h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-900">Mission Manifest Data</h3></div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                                <FormField name="lrNumber" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest px-1">LR REGISTRY NUMBER</FormLabel><FormControl><div className="relative group"><Input {...field} placeholder="Auto-populated" className="h-12 bg-white rounded-xl font-black uppercase border-blue-200 shadow-inner group-focus-within:ring-2 ring-blue-900" />{!field.value && <Sparkles className="absolute right-3 top-3 h-4 w-4 text-blue-300 animate-pulse" />}</div></FormControl></FormItem>
                                )} />
                                <FormField name="invoiceNumber" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest px-1">OUTBOUND INVOICE NO</FormLabel><FormControl><Input {...field} placeholder="Auto-populated" className="h-12 bg-white rounded-xl font-black uppercase border-blue-200 shadow-inner" /></FormControl></FormItem>
                                )} />
                                <FormField name="exitWeight" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest px-1">EXIT WEIGHT</FormLabel><FormControl><div className="relative group"><Weight className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" /><Input type="number" step="0.001" {...field} className="h-12 pl-10 bg-white rounded-xl font-black text-blue-900 border-blue-200 shadow-inner" /></div></FormControl></FormItem>
                                )} />
                                <FormField name="weightUnit" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest px-1">WEIGHT UNIT</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-bold border-blue-200 shadow-sm"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-xl"><SelectItem value="MT" className="font-bold">Metric Ton (MT)</SelectItem><SelectItem value="KG" className="font-bold">Kilogram (KG)</SelectItem><SelectItem value="Bags" className="font-bold">Bags</SelectItem></SelectContent></Select></FormItem>
                                )} />
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-end gap-8 pt-4"><button type="button" onClick={() => reset()} className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all">DISCARD ENTRY</button><Button type="submit" disabled={isSubmitting || !selectedEntryId} className="bg-blue-900 hover:bg-black text-white px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 border-none">{isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <ShieldCheck className="h-5 w-5 mr-3" />}FINALIZE SYSTEM OUT</Button></div>
                </form>
            </Form>
        </CardContent>
    </Card>
  );
}
