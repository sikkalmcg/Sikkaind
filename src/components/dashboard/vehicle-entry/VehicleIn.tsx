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
import { ShieldCheck, Loader2, Clock, Truck } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, getDocs, orderBy } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useLoading } from '@/context/LoadingContext';
import type { Plant } from '@/types';

const formSchema = z.object({
  plantId: z.string().min(1, "Plant node is required."),
  vehicleNumber: z.string().min(6, "Valid vehicle number required.").transform(v => v.toUpperCase().replace(/\s/g, '')),
  purpose: z.string().min(1, "Purpose is mandatory."),
  driverName: z.string().min(3, "Pilot name required (min 3 chars)."),
  driverMobile: z.string().regex(/^\d{10}$/, "10-digit mobile required."),
  licenseNumber: z.string().min(5, "DL number required."),
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
  const { data: plants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantId: '',
      vehicleNumber: '',
      purpose: 'Loading',
      driverName: '',
      driverMobile: '',
      licenseNumber: '',
    },
  });

  const { handleSubmit, setValue, reset, formState: { isSubmitting } } = form;

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
        const currentOperator = user.displayName || user.email?.split('@')[0] || 'System';

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
    <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden transition-all duration-500">
      <CardHeader className="bg-slate-50 border-b p-8">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-900 text-white rounded-2xl shadow-xl">
                <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
                <CardTitle className="text-xl font-black uppercase text-blue-900 italic tracking-tight">Create Gate Entry (IN)</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mt-1">Capture arrival particulars for gate registry</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-10">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Registry Timestamp Display */}
                <div className="p-6 bg-[#f1f5f9]/50 rounded-2xl border border-slate-100 space-y-2.5 shadow-inner">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] px-1">Registry Timestamp</p>
                    <p className="text-sm font-black text-blue-900 font-mono tracking-tighter">
                        {format(currentTime, 'dd-MM-yyyy HH:mm')}
                    </p>
                </div>

                <FormField name="plantId" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Plant Node *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 border-slate-200 shadow-sm focus:ring-blue-900">
                                    <SelectValue placeholder="Select node" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl shadow-2xl">
                                {plants?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic">{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField name="vehicleNumber" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Vehicle Registry *</FormLabel>
                        <FormControl>
                            <Input placeholder="XX00XX0000" {...field} className="h-12 rounded-xl font-black text-blue-900 uppercase text-lg shadow-inner border-slate-200" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField name="purpose" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Purpose *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 border-slate-200">
                                    <SelectValue placeholder="Pick Purpose" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="Loading" className="font-bold">LOADING MISSION</SelectItem>
                                <SelectItem value="Unloading" className="font-bold">UNLOADING MISSION</SelectItem>
                                <SelectItem value="Maintenance" className="font-bold">MAINTENANCE / YARD</SelectItem>
                                <SelectItem value="Other" className="font-bold">OTHERS</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField name="driverName" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Pilot Name</FormLabel>
                        <FormControl><Input placeholder="Full Name" {...field} className="h-12 rounded-xl font-bold border-slate-200 shadow-sm" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField name="driverMobile" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Contact Number</FormLabel>
                        <FormControl><Input placeholder="10 Digit Node" {...field} maxLength={10} className="h-12 rounded-xl font-mono font-bold border-slate-200" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField name="licenseNumber" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Pilot DL Number</FormLabel>
                        <FormControl><Input placeholder="Registry ID" {...field} className="h-12 rounded-xl font-mono font-bold uppercase border-slate-200" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <div className="flex flex-col md:flex-row items-center justify-end gap-6 pt-10 border-t border-slate-50">
                <Button type="button" variant="ghost" onClick={() => reset()} className="font-black text-slate-400 hover:text-blue-900 uppercase text-[11px] tracking-[0.2em] px-10 transition-all h-14 rounded-2xl">
                    Reset Entry
                </Button>
                <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="bg-blue-900 hover:bg-black text-white px-20 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl shadow-blue-900/30 transition-all active:scale-95 border-none"
                >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : null}
                    Finalize System IN
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
