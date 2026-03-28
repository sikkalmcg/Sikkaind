'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, ShieldCheck, Loader2, PlayCircle, MapPin, UserCircle, Calculator, Smartphone, History, Factory } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, updateDoc, serverTimestamp, getDocs, limit, Timestamp } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { cn, normalizePlantId } from '@/lib/utils';
import type { VehicleEntryExit, Trip, SubUser, Plant } from '@/types';
import { useLoading } from '@/context/LoadingContext';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const formSchema = z.object({
  entryId: z.string().min(1, "Select an active vehicle node."),
  outType: z.enum(['Loaded', 'Empty']).default('Loaded'),
  remarks: z.string().optional(),
  documentNo: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function VehicleOut() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();

  const [activeEntries, setActiveEntries] = useState<WithId<VehicleEntryExit>[]>([]);
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Authorization Handshake
  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchActiveIn = async () => {
        setIsLoading(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            if (!userQSnap.empty) userDocSnap = userQSnap.docs[0];

            let authPlantIds: string[] = [];
            const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdmin;
                authPlantIds = isRoot ? (plants || []).map(p => p.id) : (userData.plantIds || []);
            } else if (isAdmin) {
                authPlantIds = (plants || []).map(p => p.id);
            }

            if (authPlantIds.length === 0) {
                setIsLoading(false);
                return;
            }

            const qIn = query(collection(firestore, "vehicleEntries"), where("status", "==", "IN"));
            const entriesSnap = await getDocs(qIn);
            const inVehicles = entriesSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as WithId<VehicleEntryExit>))
                .filter(d => authPlantIds.some(aid => normalizePlantId(aid) === normalizePlantId(d.plantId)));
            
            setActiveEntries(inVehicles);

            // Fetch trips associated with these entries
            const tripIds = inVehicles.map(e => e.tripId).filter(Boolean);
            if (tripIds.length > 0) {
                const qTrips = query(collection(firestore, "trips"), where("__name__", "in", tripIds));
                const tripSnap = await getDocs(qTrips);
                setTrips(tripSnap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Trip>)));
            }
        } catch (e) {
            console.error("Registry Sync Failure:", e);
        } finally {
            setIsLoading(false);
        }
    };

    fetchActiveIn();
  }, [firestore, user, plants]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { entryId: '', outType: 'Loaded', remarks: '' },
  });

  const { watch, handleSubmit, reset, formState: { isSubmitting } } = form;
  const selectedEntryId = watch('entryId');
  const selectedEntry = useMemo(() => activeEntries.find(e => e.id === selectedEntryId), [activeEntries, selectedId]);
  const linkedTrip = useMemo(() => trips.find(t => t.id === selectedEntry?.tripId), [trips, selectedEntry]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user || !selectedEntry) return;
    showLoader();
    try {
        const ts = serverTimestamp();
        const entryRef = doc(firestore, "vehicleEntries", values.entryId);
        
        await updateDoc(entryRef, {
            status: 'OUT',
            outType: values.outType,
            exitTimestamp: ts,
            exitRemarks: values.remarks || '',
            documentNo: values.documentNo || '',
            lastUpdated: ts
        });

        // Update linked trip if Loaded exit
        if (linkedTrip && values.outType === 'Loaded') {
            const plantId = linkedTrip.originPlantId;
            const tripRef = doc(firestore, `plants/${plantId}/trips`, linkedTrip.id);
            const globalTripRef = doc(firestore, 'trips', linkedTrip.id);
            
            const update = {
                tripStatus: 'In Transit',
                outDate: ts,
                lastUpdated: ts
            };
            
            await updateDoc(tripRef, update);
            await updateDoc(globalTripRef, update);
        }

        toast({ title: 'Departure Registered', description: `Vehicle ${selectedEntry.vehicleNumber} marked as OUT.` });
        reset();
        setActiveEntries(prev => prev.filter(e => e.id !== values.entryId));
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        hideLoader();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <Card className="lg:col-span-7 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8">
                <div className="flex items-center gap-4">
                    <Truck className="h-8 w-8" />
                    <div>
                        <CardTitle className="text-xl font-black uppercase italic tracking-tight">Out-Gate Registry</CardTitle>
                        <CardDescription className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mt-1">Finalize Departure & Sync Mission</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-10">
                <Form {...form}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField name="entryId" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">In-Yard Asset Node *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-12 font-black text-blue-900"><SelectValue placeholder={isLoading ? "Establishing Sync..." : "Select Vehicle"} /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">
                                            {activeEntries.map(e => <SelectItem key={e.id} value={e.id} className="font-bold">{e.vehicleNumber} | {e.driverName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="outType" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Departure Nature</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="Loaded" className="font-bold">LOADED MISSION</SelectItem>
                                            <SelectItem value="Empty" className="font-bold">EMPTY EXIT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="documentNo" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Doc / Gate Pass Ref</FormLabel>
                                    <FormControl><Input {...field} className="h-12 rounded-xl font-bold uppercase shadow-inner" /></FormControl>
                                </FormItem>
                            )} />
                            <FormField name="remarks" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Registry Remark</FormLabel>
                                    <FormControl><Input {...field} placeholder="Optional mission note" className="h-12 rounded-xl border-slate-200" /></FormControl>
                                </FormItem>
                            )} />
                        </div>

                        <div className="flex justify-end pt-8 border-t">
                            <Button type="submit" disabled={isSubmitting || !selectedEntryId} className="bg-blue-900 hover:bg-black text-white px-20 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl transition-all active:scale-95">
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-3" /> : <ShieldCheck className="h-4 w-4 mr-3" />}
                                Finalize Departure
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>

        <div className="lg:col-span-5 space-y-8">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] px-4">Selection manifest</h4>
            <div className="p-8 bg-slate-900 text-white rounded-[3rem] shadow-2xl relative overflow-hidden group min-h-[400px] flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 transition-transform duration-1000 group-hover:scale-110"><Truck size={200} /></div>
                
                {!selectedEntry ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-30 grayscale text-center">
                        <ShieldCheck className="h-16 w-16" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Awaiting Asset Selection</p>
                    </div>
                ) : (
                    <div className="space-y-10 relative z-10 animate-in fade-in zoom-in-95">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest">Asset Identified</span>
                                <h3 className="text-4xl font-black tracking-tighter uppercase leading-none">{selectedEntry.vehicleNumber}</h3>
                            </div>
                            <Badge className="bg-blue-600 text-white font-black uppercase text-[10px] px-4 h-6 border-none shadow-lg">In Yard</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-10">
                            <div className="space-y-1.5">
                                <span className="text-[8px] font-black uppercase text-slate-500 flex items-center gap-2"><UserCircle size={10}/> Pilot</span>
                                <p className="text-xs font-bold text-blue-100 uppercase">{selectedEntry.driverName}</p>
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-[8px] font-black uppercase text-slate-500 flex items-center gap-2"><History size={10}/> Stay</span>
                                <p className="text-xs font-bold text-white uppercase">{format(selectedEntry.entryTimestamp.toDate ? selectedEntry.entryTimestamp.toDate() : new Date(selectedEntry.entryTimestamp), 'HH:mm | dd MMM')}</p>
                            </div>
                        </div>

                        <Separator className="bg-white/10" />

                        {linkedTrip ? (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 text-blue-400">
                                    <PlayCircle className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Active Mission Node</span>
                                </div>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-1.5"><span className="text-[8px] font-black uppercase text-slate-500">Trip ID</span><p className="text-xs font-black text-blue-400 font-mono tracking-tighter">{linkedTrip.tripId}</p></div>
                                    <div className="space-y-1.5"><span className="text-[8px] font-black uppercase text-slate-500">Weight</span><p className="text-xs font-black text-emerald-400">{linkedTrip.assignedQtyInTrip} MT</p></div>
                                    <div className="col-span-2 space-y-1.5"><span className="text-[8px] font-black uppercase text-slate-500">Destination Hub</span><p className="text-xs font-bold text-white uppercase truncate">{linkedTrip.unloadingPoint}</p></div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                                <AlertTriangle className="h-4 w-4 text-orange-400" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase">No active mission linked to this gate entry.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
