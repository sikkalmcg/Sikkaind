'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  useForm, 
  useFieldArray, 
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Truck, 
  ClipboardList, 
  Trash2, 
  ShieldCheck, 
  ChevronsUpDown,
  Loader2
} from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { 
  collection,
  query,
  where,
  doc,
  writeBatch,
  serverTimestamp,
  getDoc,
  getDocs,
  Timestamp 
} from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { normalizePlantId, generateRandomTripId } from '@/lib/utils';
import type { Trip, Shipment, Vehicle, Carrier, WithId } from '@/types';
import { useLoading } from '@/context/LoadingContext';

interface VehicleInProps {
  upcomingVehicleData?: any | null;
}

const shipmentItemSchema = z.object({
  shipmentId: z.string().min(1, "Shipment ID is required"),
  orderId: z.string(),
  balanceQty: z.number(),
  assignedQty: z.coerce.number().min(0.001, "Qty must be > 0").max(z.number().optional().default(Infinity), "Cannot exceed balance"),
});

const formSchema = z.object({
  plantId: z.string().min(1, "Plant node is required."),
  vehicleType: z.enum(['Own Vehicle', 'Market Vehicle']).default('Market Vehicle'),
  vehicleNumber: z.string().min(1, "Vehicle number required."),
  driverName: z.string().min(3, "Pilot name required."),
  driverMobile: z.string().regex(/^\d{10}$/, "Must be 10 digits"),
  carrierId: z.string().min(1, "Carrier mandatory."),
  shipments: z.array(shipmentItemSchema).min(1, "At least one shipment required."),
});

type FormValues = z.infer<typeof formSchema>;

export default function VehicleIn({ upcomingVehicleData }: VehicleInProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();

  const [availableShipments, setAvailableShipments] = useState<WithId<Shipment>[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantId: '',
      vehicleType: 'Market Vehicle',
      vehicleNumber: '',
      driverName: '',
      driverMobile: '',
      carrierId: '',
      shipments: [],
    },
  });

  const { control, handleSubmit, setValue, watch, reset } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "shipments" });

  const plantId = watch('plantId');
  const selectedShipments = watch('shipments');

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<any>(plantsQuery);

  const carriersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "carriers")) : null, 
    [firestore]
  );
  const { data: carriers } = useCollection<Carrier>(carriersQuery);

  useEffect(() => {
    if (upcomingVehicleData) {
        setValue('plantId', upcomingVehicleData.originPlantId);
        setValue('vehicleNumber', upcomingVehicleData.vehicleNumber);
        setValue('driverName', upcomingVehicleData.driverName);
        setValue('driverMobile', upcomingVehicleData.driverMobile);
        setValue('vehicleType', upcomingVehicleData.vehicleType);
        setValue('carrierId', upcomingVehicleData.carrierId);
    }
  }, [upcomingVehicleData, setValue]);

  useEffect(() => {
    if (!firestore || !plantId) return;
    setIsLoadingShipments(true);
    const shipQuery = query(
      collection(firestore, `plants/${plantId}/shipments`),
      where('currentStatusId', 'in', ['pending', 'Partly Vehicle Assigned'])
    );
    getDocs(shipQuery)
      .then(snap => {
        setAvailableShipments(snap.docs.map(d => ({ ...d.data(), id: d.id } as WithId<Shipment>)));
      })
      .finally(() => setIsLoadingShipments(false));
  }, [firestore, plantId]);

  const handleAddShipment = (shipment: WithId<Shipment>) => {
    append({ 
      shipmentId: shipment.id, 
      orderId: shipment.shipmentId,
      balanceQty: shipment.balanceQty,
      assignedQty: shipment.balanceQty
    });
  };

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        const batch = writeBatch(firestore);
        const entryId = `entry-${Date.now()}`;
        const entryRef = doc(firestore, "vehicleEntries", entryId);

        batch.set(entryRef, {
            ...values,
            status: 'IN',
            purpose: 'Loading',
            entryTimestamp: serverTimestamp(),
            userName: user.displayName || user.email,
            userId: user.uid
        });

        await batch.commit();
        toast({ title: 'Gate Entry Recorded', description: `Vehicle ${values.vehicleNumber} is now IN.` });
        reset();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        hideLoader();
    }
  };

  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardHeader className="bg-slate-900 text-white p-8">
        <div className="flex items-center gap-4">
            <Truck className="h-8 w-8" />
            <div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight">In-Gate Registry</CardTitle>
                <CardDescription className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mt-1">Lifting Node Cargo Assignment</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-10 space-y-10">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8 p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                <FormField name="plantId" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Plant Node *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-12 bg-white font-bold"><SelectValue placeholder="Select Node" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">
                                {plants?.map((p: any) => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <FormField name="vehicleNumber" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-blue-600">Vehicle No *</FormLabel>
                        <FormControl><Input {...field} className="h-12 bg-white font-black uppercase tracking-tighter" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField name="driverName" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Pilot Name *</FormLabel>
                        <FormControl><Input {...field} className="h-12 bg-white font-bold" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField name="driverMobile" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Pilot Mobile *</FormLabel>
                        <FormControl><Input {...field} maxLength={10} className="h-12 bg-white font-mono font-black" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <section className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-blue-600"/> Shipment Linker
                    </h3>
                    <select 
                        onChange={(e) => {
                            const ship = availableShipments.find(s => s.id === e.target.value);
                            if (ship) handleAddShipment(ship);
                            e.target.value = '';
                        }}
                        className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-xs font-black uppercase cursor-pointer"
                        disabled={!plantId || isLoadingShipments}
                    >
                        <option value="">{isLoadingShipments ? 'Syncing...' : 'Add Order Node'}</option>
                        {availableShipments.filter(s => !selectedShipments.some(x => x.shipmentId === s.id)).map(s => (
                            <option key={s.id} value={s.id}>{s.shipmentId} | {s.consignor}</option>
                        ))}
                    </select>
                </div>

                <div className="rounded-[2rem] border-2 border-slate-100 bg-white shadow-xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-900">
                            <TableRow className="h-12 hover:bg-transparent border-none">
                                <TableHead className="text-white text-[10px] font-black uppercase px-8">Order ID</TableHead>
                                <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center">Balance Node</TableHead>
                                <TableHead className="text-white text-[10px] font-black uppercase px-4 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.length === 0 ? (
                                <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-400 italic">No shipments linked to entry.</TableCell></TableRow>
                            ) : (
                                fields.map((field, idx) => (
                                    <TableRow key={field.id} className="h-14 border-b last:border-0 hover:bg-blue-50/10 transition-colors">
                                        <TableCell className="px-8 font-black text-blue-700 font-mono">{field.orderId}</TableCell>
                                        <TableCell className="px-4 text-center font-bold text-slate-500">{field.balanceQty} MT</TableCell>
                                        <TableCell className="px-4 text-right">
                                            <Button variant="ghost" size="icon" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>

            <div className="flex justify-end pt-8 border-t">
                <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-20 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl transition-all active:scale-95 border-none">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-3" /> : <ShieldCheck className="h-4 w-4 mr-3" />}
                    Finalize In-Gate Node
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
