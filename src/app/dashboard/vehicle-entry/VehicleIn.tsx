'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  useForm, 
  useFieldArray, 
  Controller,
  useWatch
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
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/date-picker';
import { 
  Truck, 
  ClipboardList, 
  PlusCircle, 
  Trash2, 
  User, 
  Weight, 
  ChevronDown, 
  Anchor, 
  Warehouse, 
  Save, 
  FileText, 
  AlertTriangle, 
  ChevronsUpDown
} from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
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
import { cn, normalizePlantId, formatSequenceId, generateRandomTripId } from '@/lib/utils';
import type { Plant, WithId, Trip, Shipment, Vehicle, Carrier } from '@/types';
import { useLoading } from '@/context/LoadingContext';

interface VehicleInProps {
  plantId: string;
  onTripCreated: (trip: WithId<Trip>) => void;
}

const shipmentItemSchema = z.object({
  shipmentId: z.string().min(1, "Shipment ID is required"),
  orderId: z.string(),
  balanceQty: z.number(),
  assignedQty: z.coerce.number().min(0.001, "Qty must be > 0").max(z.number().optional().default(Infinity), "Cannot exceed balance"),
});

const formSchema = z.object({
  vehicleType: z.enum(['Own', 'Market']).default('Market'),
  vehicleNumber: z.string().optional(),
  driverName: z.string().min(3, "Pilot name required (min 3 chars)"),
  driverMobile: z.string().regex(/^\d{10}$/, "Must be 10 digits"),
  carrierId: z.string().min(1, "Carrier Agent is mandatory."),
  registryWeight: z.coerce.number().min(1, "Registry weight is required"),
  transporterName: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPan: z.string().optional(),
  freightAmount: z.coerce.number().optional(),
  shipments: z.array(shipmentItemSchema).min(1, "At least one shipment must be linked."),
}).superRefine((data, ctx) => {
  const totalAssigned = data.shipments.reduce((sum, s) => sum + s.assignedQty, 0);
  if (totalAssigned > data.registryWeight) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Total assigned quantity cannot exceed the vehicle's registry weight.",
      path: ['registryWeight'],
    });
  }
  data.shipments.forEach((shipment, index) => {
    if (shipment.assignedQty > shipment.balanceQty) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Cannot exceed available balance qty for ${shipment.orderId}`,
            path: [`shipments`, index, `assignedQty`]
        });
    }
  });
  if (data.vehicleType === 'Own' && !data.vehicleNumber) {
      ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Vehicle selection is mandatory for own fleet.",
          path: ['vehicleNumber']
      });
  }
  if (data.vehicleType === 'Market') {
      if (!data.transporterName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Transporter name is mandatory for market vehicles.", path: ['transporterName'] });
      if (!data.ownerName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Owner name is mandatory.", path: ['ownerName'] });
      if (!data.freightAmount || data.freightAmount <= 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Freight amount is required for market vehicles.",
            path: ['freightAmount']
        });
      }
  }
});

export default function VehicleIn({ plantId, onTripCreated }: VehicleInProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();

  const [availableShipments, setAvailableShipments] = useState<WithId<Shipment>[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleType: 'Market',
      driverName: '',
      driverMobile: '',
      carrierId: '',
      registryWeight: 0,
      transporterName: '',
      ownerName: '',
      ownerPan: '',
      freightAmount: 0,
      shipments: [],
    },
  });

  const { control, handleSubmit, setValue, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "shipments" });

  const vehicleType = watch('vehicleType');
  const selectedShipments = watch('shipments');

  const plantNode = useMemo(() => normalizePlantId(plantId), [plantId]);

  const vehiclesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, `plants/${plantNode}/vehicles`), where('isDeleted', '==', false)) : null,
    [firestore, plantNode]
  );
  const { data: vehicles } = useCollection<Vehicle>(vehiclesQuery);

  const carriersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "carriers"), where('isDeleted', '==', false)) : null,
    [firestore]
  );
  const { data: carriers } = useCollection<Carrier>(carriersQuery);

  useEffect(() => {
    if (!firestore) return;
    setIsLoadingShipments(true);
    const shipQuery = query(
      collection(firestore, `plants/${plantNode}/shipments`),
      where('currentStatusId', 'in', ['Planned', 'Partial']),
      where('isDeleted', '==', false)
    );
    getDocs(shipQuery)
      .then(snap => {
        const ships = snap.docs.map(d => ({ ...d.data(), id: d.id } as WithId<Shipment>));
        setAvailableShipments(ships);
      })
      .catch(e => {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load available shipments.' });
      })
      .finally(() => setIsLoadingShipments(false));
  }, [firestore, plantNode, toast]);

  const unselectedShipments = useMemo(() => {
    const selectedIds = new Set(selectedShipments.map(s => s.shipmentId));
    return availableShipments.filter(s => !selectedIds.has(s.id));
  }, [availableShipments, selectedShipments]);

  const handleAddShipment = (shipment: WithId<Shipment>) => {
    const balance = shipment.balanceQty ?? (shipment.quantity - (shipment.assignedQty || 0));
    append({ 
      shipmentId: shipment.id, 
      orderId: shipment.shipmentId,
      balanceQty: balance,
      assignedQty: balance // Default to assigning the full balance
    });
  };
  
  const handlePost = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !user) return;
    showLoader();

    try {
        const batch = writeBatch(firestore);
        const tripId = generateRandomTripId();
        const tripDocRef = doc(firestore, `plants/${plantNode}/trips`, tripId);
        const globalTripRef = doc(firestore, 'trips', tripId);

        const ts = serverTimestamp();

        const totalAssignedQty = values.shipments.reduce((acc, s) => acc + s.assignedQty, 0);

        const tripData: Omit<Trip, 'id'> = {
            tripId: tripId,
            vehicleId: values.vehicleNumber || null,
            vehicleNumber: values.vehicleNumber ? 
              vehicles?.find(v => v.id === values.vehicleNumber)?.registrationNumber || 'N/A' 
              : 'Market Vehicle',
            driverName: values.driverName,
            driverMobile: values.driverMobile,
            vehicleType: values.vehicleType,
            carrierId: values.carrierId,
            assignedTripWeight: values.registryWeight,
            assignedQtyInTrip: totalAssignedQty,
            originPlantId: plantNode,
            destination: 'Multiple', // Or determine from shipments if single destination
            shipmentIds: values.shipments.map(s => s.shipmentId),
            tripStatus: 'Loaded',
            podStatus: 'Missing',
            freightStatus: 'Unpaid',
            vehicleStatus: 'In Transit',
            currentStatusId: 'Loaded',
            startDate: ts,
            lastUpdated: ts,
            userName: user.displayName || user.email,
            userId: user.uid,
            ownerName: values.ownerName,
            ownerPan: values.ownerPan,
            transporterName: values.transporterName,
            freightAmount: values.freightAmount,
        };
        
        batch.set(tripDocRef, tripData);
        batch.set(globalTripRef, tripData);

        for (const item of values.shipments) {
            const shipRef = doc(firestore, `plants/${plantNode}/shipments`, item.shipmentId);
            const shipSnap = await getDoc(shipRef);
            if (!shipSnap.exists()) throw new Error(`Shipment ${item.orderId} not found!`);
            
            const shipData = shipSnap.data() as Shipment;
            const currentAssigned = shipData.assignedQty || 0;
            const newAssigned = currentAssigned + item.assignedQty;
            const balance = shipData.quantity - newAssigned;
            
            batch.update(shipRef, {
                assignedQty: newAssigned,
                balanceQty: balance,
                currentStatusId: balance > 0 ? 'Partial' : 'Assigned',
                lastUpdateDate: ts,
            });
        }

        await batch.commit();

        toast({ title: 'Success', description: `Trip ${tripId} created successfully.` });
        onTripCreated({ ...tripData, id: tripId, startDate: Timestamp.now(), lastUpdated: Timestamp.now() }); 
        form.reset();
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Transaction Failed', description: e.message });
    } finally {
        hideLoader();
    }

  }

  return (
    <Card className="w-full max-w-7xl mx-auto my-8 border-none shadow-2xl overflow-hidden bg-white rounded-[2.5rem]">
      <CardHeader className="bg-slate-900 text-white p-8">
        <div className="flex items-center justify-between">
            <div className='flex items-center gap-4'>
                <Truck className="h-8 w-8" />
                <div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight italic">Vehicle In-Gate Registry</CardTitle>
                    <CardDescription className="text-blue-200 font-bold uppercase text-[9px] mt-1 tracking-widest">Assign Shipments & Create Trip</CardDescription>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">Plant Node</span>
                <span className='font-black text-xl'>{plantId}</span>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-10">
        <Form {...form}>
          <form onSubmit={handleSubmit(handlePost)} className="space-y-12">
            {/* Vehicle Details Section */}
            <section className='p-8 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner'>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
                    <FormField control={control} name="vehicleType" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vehicle Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className='h-12 bg-white'><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="Own">OWN</SelectItem><SelectItem value="Market">MARKET</SelectItem></SelectContent>
                            </Select>
                        </FormItem>
                    )} />

                    {vehicleType === 'Own' ? (
                        <FormField control={control} name="vehicleNumber" render={({ field }) => (
                            <FormItem className='w-full'>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Vehicle Number *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <FormControl><SelectTrigger className='h-12 bg-white'><SelectValue placeholder="Sync from Gate" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {vehicles?.map(v => <SelectItem key={v.id} value={v.id}>{v.registrationNumber}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    ) : (
                        <FormField control={control} name="transporterName" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Transporter Name *</FormLabel>
                                <FormControl><Input {...field} placeholder="Transporter legal name" className='h-12 bg-white' /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    )}

                    <FormField control={control} name="driverName" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Pilot Detail *</FormLabel>
                            <FormControl><Input {...field} placeholder="Pilot Name" className='h-12 bg-white' /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={control} name="driverMobile" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">&nbsp;</FormLabel>
                            <FormControl><Input {...field} placeholder="10 Digits" className='h-12 bg-white' /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={control} name="registryWeight" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Registry Weight *</FormLabel>
                            <FormControl><Input type="number" {...field} className='h-12 bg-white font-black text-xl text-center' /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                
                {vehicleType === 'Market' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-slate-200">
                         <FormField control={control} name="carrierId" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Carrier Agent *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className='h-12 bg-white'><SelectValue placeholder="Select Carrier" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {carriers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={control} name="ownerName" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vehicle Owner Name</FormLabel>
                                <FormControl><Input {...field} placeholder="As per RC" className='h-12 bg-white' /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={control} name="ownerPan" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Owner PAN</FormLabel>
                                <FormControl><Input {...field} placeholder="Optional PAN number" className='h-12 bg-white' /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={control} name="freightAmount" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Freight Amount *</FormLabel>
                                <FormControl><Input type="number" {...field} placeholder="0.00" className='h-12 bg-white font-black text-lg' /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                )}
            </section>

            {/* Shipment Linking Section */}
            <section className="p-8 bg-white rounded-3xl border border-slate-200 shadow-2xl">
                 <div className="flex items-center justify-between mb-6">
                    <div className='flex items-center gap-3'>
                        <ClipboardList className="h-6 w-6 text-blue-600" />
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-700">Shipment Linker</h3>
                    </div>
                    <div className="relative">
                        <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <select 
                            onChange={(e) => {
                                const shipId = e.target.value;
                                const ship = availableShipments.find(s => s.id === shipId);
                                if (ship) handleAddShipment(ship);
                                e.target.value = ''; // Reset select
                            }}
                            className='h-10 rounded-lg pl-4 pr-8 appearance-none bg-slate-50 border border-slate-200 text-sm font-bold cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none'
                            disabled={isLoadingShipments}
                        >
                            <option value="" disabled selected>{isLoadingShipments ? 'Loading...' : 'Add Shipment to Trip'}</option>
                            {unselectedShipments.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.shipmentId} - {s.billToParty} ({s.balanceQty ?? (s.quantity - (s.assignedQty || 0))} MT)
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden min-h-[100px]">
                <Table>
                    <TableHeader className='bg-slate-900'>
                    <TableRow className='hover:bg-transparent'>
                        <TableHead className="text-white w-1/3">Order ID</TableHead>
                        <TableHead className="text-white text-center">Balance</TableHead>
                        <TableHead className="text-white text-center">Assign Qty</TableHead>
                        <TableHead className="text-white"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {fields.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="h-24 text-center text-slate-400 italic">No shipments linked.</TableCell></TableRow>
                    ) : (
                        fields.map((field, index) => (
                        <TableRow key={field.id}>
                            <TableCell className='font-bold'>{field.orderId}</TableCell>
                            <TableCell className='text-center font-mono'>{field.balanceQty} MT</TableCell>
                            <TableCell className='w-48'>
                            <FormField
                                control={control}
                                name={`shipments.${index}.assignedQty`}
                                render={({ field: f }) => (
                                    <FormItem>
                                    <FormControl><Input type="number" {...f} className="text-center font-black text-lg text-blue-800 bg-blue-50/50" /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                            </TableCell>
                            <TableCell className='text-right'>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                    </TableBody>
                </Table>
                </div>
            </section>

            <div className="flex justify-end pt-8 border-t border-slate-200">
              <Button type="submit" className="bg-blue-900 hover:bg-black text-white px-20 h-16 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.3em] shadow-2xl shadow-blue-900/30 transition-all active:scale-95 border-none">
                Commit Vehicle In-Gate
              </Button>
            </div>

          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
