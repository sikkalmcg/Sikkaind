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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Plus, Factory, FileText, Weight } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, orderBy, doc, where, getDocs, limit } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useLoading } from '@/context/LoadingContext';
import type { Plant, SubUser } from '@/types';
import { normalizePlantId } from '@/lib/utils';

const formSchema = z.object({
  plantId: z.string().min(1, "Plant node is required."),
  vehicleNumber: z.string().min(6, "Valid vehicle number required.").transform(v => v.toUpperCase().replace(/\s/g, '')),
  purpose: z.enum(['Loading', 'Unloading'], { required_error: "Purpose is mandatory." }),
  driverName: z.string().min(3, "Pilot name required (min 3 chars)."),
  driverMobile: z.string().regex(/^\d{10}$/, "10-digit mobile required."),
  licenseNumber: z.string().min(5, "DL number required."),
  lrNumber: z.string().optional(),
  documentNo: z.string().optional(),
  items: z.string().optional(),
  billedQty: z.coerce.number().optional(),
  qtyType: z.string().optional().default('MT'),
}).superRefine((data, ctx) => {
    if (data.purpose === 'Unloading') {
        if (!data.lrNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "LR Number is mandatory for unloading.", path: ["lrNumber"] });
        if (!data.documentNo) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invoice Number is mandatory.", path: ["documentNo"] });
        if (!data.items) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Product details are required.", path: ["items"] });
        if (!data.billedQty || data.billedQty <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid quantity is required.", path: ["billedQty"] });
    }
});

type FormValues = z.infer<typeof formSchema>;

export default function VehicleIn({ upcomingVehicleData, onFinished }: { upcomingVehicleData?: any | null; onFinished?: () => void }) {
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

  const searchEmail = useMemo(() => user?.email || '', [user]);
  const userProfileRef = useMemo(() => (firestore && searchEmail) ? doc(firestore, "users", searchEmail) : null, [firestore, searchEmail]);
  const { data: profile } = useDoc<SubUser>(userProfileRef);

  const authorizedPlants = useMemo(() => {
    if (!allPlants) return [];
    const isAdmin = searchEmail === 'sikkaind.admin@sikka.com' || searchEmail === 'sikkalmcg@gmail.com';
    if (isAdmin) return allPlants;
    const authIds = profile?.plantIds || [];
    return (allPlants || []).filter(p => authIds.some(aid => normalizePlantId(aid) === normalizePlantId(p.id)));
  }, [allPlants, profile, searchEmail]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantId: '',
      vehicleNumber: '',
      purpose: 'Loading',
      driverName: '',
      driverMobile: '',
      licenseNumber: '',
      lrNumber: '',
      documentNo: '',
      items: '',
      billedQty: 0,
      qtyType: 'MT'
    },
  });

  const { handleSubmit, setValue, reset, watch, formState: { isSubmitting } } = form;
  const purpose = watch('purpose');

  useEffect(() => {
    if (upcomingVehicleData) {
        setValue('plantId', upcomingVehicleData.originPlantId, { shouldValidate: true });
        setValue('vehicleNumber', upcomingVehicleData.vehicleNumber, { shouldValidate: true });
        setValue('driverName', upcomingVehicleData.driverName, { shouldValidate: true });
        setValue('driverMobile', upcomingVehicleData.driverMobile, { shouldValidate: true });
        setValue('purpose', 'Loading', { shouldValidate: true });
    }
  }, [upcomingVehicleData, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        const ts = serverTimestamp();
        const currentOperator = profile?.fullName || user.displayName || user.email?.split('@')[0] || 'System';

        await addDoc(collection(firestore, "vehicleEntries"), {
            ...values,
            status: 'IN',
            entryTimestamp: ts,
            userName: currentOperator,
            userId: user.uid,
            tripId: upcomingVehicleData?.id || null
        });

        toast({ title: 'Registry Sync: OK', description: `Vehicle ${values.vehicleNumber} logged IN yard.` });
        reset();
        if (onFinished) onFinished();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Registry Error', description: e.message });
    } finally {
        hideLoader();
    }
  };

  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardHeader className="p-8 pb-0">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-900 text-white rounded-xl shadow-lg">
                <Plus className="h-6 w-6" />
            </div>
            <div>
                <CardTitle className="text-xl font-black uppercase text-blue-900 italic">INITIALIZE GATE ENTRY (IN)</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mt-1">CAPTURE ARRIVAL PARTICULARS FOR GATE REGISTRY</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                <div className="p-6 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2 shadow-inner">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">REGISTRY TIMESTAMP</p>
                    <p className="text-sm font-black text-blue-900 font-mono tracking-tighter">
                        {format(currentTime, 'dd-MM-yyyy HH:mm')}
                    </p>
                </div>

                <FormField name="plantId" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">PLANT NODE *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger className="h-12 bg-white rounded-xl font-black text-slate-700 shadow-sm border-slate-200">
                                    <SelectValue placeholder="Pick node" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                                {authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic">{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField name="vehicleNumber" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">VEHICLE REGISTRY *</FormLabel>
                        <FormControl>
                            <Input placeholder="XX00XX0000" {...field} className="h-12 rounded-xl font-black text-blue-900 uppercase text-lg shadow-inner border-slate-200 focus-visible:ring-blue-900" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField name="purpose" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">PURPOSE *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger className="h-12 bg-white rounded-xl font-black text-slate-700 shadow-sm border-slate-200">
                                    <SelectValue placeholder="Pick Purpose" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="Loading" className="font-bold py-3 uppercase">LOADING MISSION</SelectItem>
                                <SelectItem value="Unloading" className="font-bold py-3 uppercase">UNLOADING MISSION</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <FormField name="driverName" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">PILOT NAME *</FormLabel>
                        <FormControl><Input placeholder="Full Name" {...field} className="h-12 rounded-xl font-bold bg-white border-slate-200" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField name="driverMobile" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">CONTACT NUMBER *</FormLabel>
                        <FormControl><Input placeholder="10 Digit Node" {...field} maxLength={10} className="h-12 rounded-xl font-mono font-bold bg-white border-slate-200" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField name="licenseNumber" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">PILOT DL NUMBER *</FormLabel>
                        <FormControl><Input placeholder="Registry ID" {...field} className="h-12 rounded-xl font-mono font-bold uppercase bg-white border-slate-200" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            {purpose === 'Unloading' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <Separator />
                    <div className="flex items-center gap-3 px-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-700">Unloading Manifest Details</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-8 bg-blue-50/20 rounded-[2rem] border border-blue-100 shadow-sm items-end">
                        <FormField name="lrNumber" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">LR Number *</FormLabel>
                                <FormControl><Input placeholder="Registry LR #" {...field} className="h-11 bg-white rounded-xl font-bold uppercase border-blue-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField name="documentNo" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Invoice Number *</FormLabel>
                                <FormControl><Input placeholder="Doc Ref #" {...field} className="h-11 bg-white rounded-xl font-bold uppercase border-blue-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField name="items" control={form.control} render={({ field }) => (
                            <FormItem className="lg:col-span-2">
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Product Details *</FormLabel>
                                <FormControl><Input placeholder="e.g. TATA SALT 50KG BAGS" {...field} className="h-11 bg-white rounded-xl font-bold border-blue-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField name="billedQty" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Quantity *</FormLabel>
                                <FormControl><Input type="number" step="0.001" {...field} className="h-11 bg-white rounded-xl font-black text-blue-900 border-blue-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField name="qtyType" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">UOM</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-11 bg-white rounded-xl font-bold border-blue-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="MT" className="font-bold">Metric Ton (MT)</SelectItem>
                                        <SelectItem value="Bags" className="font-bold">Bags</SelectItem>
                                        <SelectItem value="PCS" className="font-bold">PCS</SelectItem>
                                        <SelectItem value="Kg" className="font-bold">KG</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-8 pt-4">
                <button type="button" onClick={() => { reset(); }} className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all">
                    DISCARD ENTRY
                </button>
                <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="bg-blue-900 hover:bg-black text-white px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 border-none"
                >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <ShieldCheck className="h-5 w-5 mr-3" />}
                    FINALIZE IN-GATE NODE
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
