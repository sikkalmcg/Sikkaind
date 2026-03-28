'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isValid } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Table, 
  TableBody, 
  TableCell, TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, 
    ShieldCheck, 
    Truck, 
    Save,
    MapPin,
    Factory,
    Calculator,
    UserCircle,
    Lock,
    ArrowRightLeft,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    PlusCircle,
    IndianRupee,
    User
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Shipment, Vehicle, WithId, Trip, Carrier, VehicleEntryExit, Plant, SubUser } from '@/types';
import { VehicleTypes } from '@/lib/constants';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  Timestamp,
} from "firebase/firestore";
import { normalizePlantId, generateRandomTripId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { useJsApiLoader } from '@react-google-maps/api';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Separator } from '@/components/ui/separator';

interface VehicleAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: WithId<Shipment>;
  trip?: WithId<Trip> | null;
  onAssignmentComplete: () => void;
  carriers: WithId<Carrier>[];
}

const vehicleNumberRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;
const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";

const formSchema = z.object({
    isNewVehicle: z.boolean().default(false),
    vehicleId: z.string().optional(),
    vehicleNumber: z.string().min(1, "Vehicle number is mandatory.").transform(v => v.toUpperCase().replace(/\s/g, '')).refine(val => vehicleNumberRegex.test(val), {
        message: 'Invalid Format (e.g. MH12AB1234)'
    }),
    driverName: z.string().optional().default(''),
    driverMobile: z.string().min(1, "Driver mobile is required.").refine(val => /^\d{10}$/.test(val), {
        message: 'Mobile must be 10 digits.'
    }),
    vehicleType: z.enum(VehicleTypes, { required_error: 'Vehicle type is required' }),
    carrierId: z.string().min(1, 'Carrier is required'),
    assignQty: z.coerce.number().positive('Assign quantity must be positive'),
    transporterName: z.string().optional().default(''),
    transporterMobile: z.string().optional().default(''),
    ownerName: z.string().optional().default(''),
    ownerPan: z.string().optional().default(''),
    freightRate: z.coerce.number().min(0).optional().default(0),
    freightAmount: z.coerce.number().optional().default(0),
    distance: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.vehicleType === 'Market Vehicle') {
        if (!data.transporterName?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Transporter name is mandatory.', path: ['transporterName'] });
        }
        if (!data.transporterMobile?.trim() || !/^\d{10}$/.test(data.transporterMobile)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid 10-digit mobile required.', path: ['transporterMobile'] });
        }
        if (!data.ownerName?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Owner name is mandatory.', path: ['ownerName'] });
        }
        if (!data.freightRate || data.freightRate <= 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Freight rate is required.', path: ['freightRate'] });
        }
    }
});

type FormValues = z.infer<typeof formSchema>;

export default function VehicleAssignModal({ isOpen, onClose, shipment, trip, onAssignmentComplete, carriers }: VehicleAssignModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const userProfileRef = useMemo(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<SubUser>(userProfileRef);
  
  const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: MAPS_JS_KEY, libraries: ['places'] });

  const [vehiclesAtGate, setVehiclesAtGate] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [registryMatch, setRegistryMatch] = useState<WithId<Vehicle> | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const isEditing = !!trip;
  const hasCalculatedDistance = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        assignQty: 0,
        freightRate: 0,
        freightAmount: 0
    },
  });
  const { watch, setValue, handleSubmit, reset, control, formState: { isSubmitting } } = form;

  useEffect(() => {
    if (isOpen) {
        const defaultValues = {
            isNewVehicle: false,
            vehicleId: trip?.vehicleId || '',
            vehicleNumber: trip?.vehicleNumber || '',
            driverName: trip?.driverName || '',
            driverMobile: trip?.driverMobile || '',
            vehicleType: (trip?.vehicleType as any) || 'Own Vehicle',
            carrierId: trip?.carrierId || shipment.carrierId || (carriers.length > 0 ? carriers[0].id : ''),
            assignQty: trip?.assignedQtyInTrip ?? Number(Number(shipment.balanceQty).toFixed(3)),
            transporterName: trip?.transporterName || '',
            transporterMobile: (trip as any)?.transporterMobile || '',
            ownerName: trip?.ownerName || '',
            ownerPan: trip?.ownerPan || '',
            freightRate: trip?.freightRate || 0,
            freightAmount: trip?.freightAmount || 0,
            distance: trip?.distance || 0
        };
        reset(defaultValues);
        hasCalculatedDistance.current = !!trip?.distance;
    } else {
        reset({ assignQty: 0, freightRate: 0, freightAmount: 0 });
        setRegistryMatch(null);
    }
  }, [isOpen, trip, shipment, carriers, reset]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const plantNameDisplay = useMemo(() => {
    if (!plants) return shipment.originPlantId;
    return plants.find(p => normalizePlantId(p.id).toLowerCase() === normalizePlantId(shipment.originPlantId).toLowerCase())?.name || shipment.originPlantId;
  }, [plants, shipment.originPlantId]);

  const destinationCityDisplay = useMemo(() => {
    return shipment.destination || shipment.unloadingPoint?.split(',')[0] || '--';
  }, [shipment.destination, shipment.unloadingPoint]);

  const { isNewVehicle, vehicleId, assignQty, vehicleNumber, vehicleType, freightRate } = useWatch({ control });

  useEffect(() => {
    const total = (Number(assignQty) || 0) * (Number(freightRate) || 0);
    setValue('freightAmount', Number(total.toFixed(2)));
  }, [assignQty, freightRate, setValue]);

  useEffect(() => {
    if (!isOpen || !firestore || !shipment.originPlantId) return;
    
    const fetchRegistryData = async () => {
        setIsDataLoading(true);
        try {
            const targetPlantId = normalizePlantId(shipment.originPlantId);
            const qVeh = query(collection(firestore, 'vehicleEntries'), where('plantId', '==', targetPlantId), where('status', '==', 'IN'));
            const vehSnap = await getDocs(qVeh);
            const entries = vehSnap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<VehicleEntryExit>));
            
            const available = entries.filter(e => {
                return (isEditing && e.vehicleNumber === trip?.vehicleNumber) || 
                       (e.purpose === 'Loading' && ['Available', 'IN', 'Assigned'].includes(e.remarks || 'IN'));
            });

            setVehiclesAtGate(available);
        } catch (error) {
            console.error("Registry Fetch Error:", error);
            toast({ variant: 'destructive', title: "Cloud Sync Error", description: "Failed to fetch gate registry." });
        } finally {
            setIsDataLoading(false);
        }
    };
    fetchRegistryData();
  }, [isOpen, firestore, shipment.originPlantId, isEditing, trip?.vehicleNumber, toast]);

  const currentDistance = watch('distance');

  useEffect(() => {
    if (!isLoaded || !isOpen || hasCalculatedDistance.current || !shipment.loadingPoint || !shipment.unloadingPoint) return;

    const calculate = () => {
      setCalculatingDistance(true);
      try {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route({
            origin: shipment.loadingPoint!,
            destination: shipment.unloadingPoint!,
            travelMode: google.maps.TravelMode.DRIVING,
        }, (response, status) => {
            setCalculatingDistance(false);
            if (status === 'OK' && response) {
                const distKm = (response.routes[0].legs[0].distance?.value || 0) / 1000;
                setValue('distance', Number(distKm.toFixed(2)));
                hasCalculatedDistance.current = true;
            }
        });
      } catch (e) {
        setCalculatingDistance(false);
      }
    };

    calculate();
  }, [isLoaded, isOpen, shipment.loadingPoint, shipment.unloadingPoint, setValue]);

  const balanceQty = useMemo(() => {
    const total = isEditing ? (shipment.balanceQty + (trip.assignedQtyInTrip || 0)) : shipment.balanceQty;
    const balance = total - (assignQty || 0);
    return Number(Math.max(0, balance).toFixed(3));
  }, [shipment.balanceQty, assignQty, isEditing, trip]);

  const performVehicleLookup = useCallback(async (vNumber: string) => {
    if (!firestore) return;
    try {
        const q = query(collection(firestore, "vehicles"), where("vehicleNumber", "==", vNumber));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const vData = { id: snap.docs[0].id, ...snap.docs[0].data() } as WithId<Vehicle>;
            setRegistryMatch(vData);
            setValue('vehicleType', (vData.vehicleType as any) || 'Own Vehicle', { shouldValidate: true });
            if (vData.driverName) setValue('driverName', vData.driverName, { shouldValidate: true });
            if (vData.driverMobile) setValue('driverMobile', vData.driverMobile, { shouldValidate: true });
            toast({ title: 'Registry Link Established', description: `${vData.vehicleNumber} identified in fleet registry.` });
        } else {
            setRegistryMatch(null);
        }
    } catch (e) {
        console.error(e);
    }
  }, [firestore, setValue, toast]);

  useEffect(() => {
    if (!isOpen) return;
    const vNumber = vehicleNumber?.toUpperCase().replace(/\s/g, '') || '';
    if (vNumber.length < 6) {
        if (registryMatch) setRegistryMatch(null);
        return;
    }
    
    if (registryMatch?.vehicleNumber === vNumber) return;

    const handler = setTimeout(() => performVehicleLookup(vNumber), 1000);
    return () => clearTimeout(handler);
  }, [isOpen, vehicleNumber, registryMatch, performVehicleLookup]);

  useEffect(() => {
    if (!isOpen || isNewVehicle || !vehicleId) return;
    const found = vehiclesAtGate.find(v => v.id === vehicleId);
    if (found) {
        setValue('vehicleNumber', found.vehicleNumber, { shouldValidate: true });
        setValue('driverName', found.driverName || '', { shouldValidate: true });
        setValue('driverMobile', found.driverMobile || '', { shouldValidate: true });
    }
  }, [isOpen, isNewVehicle, vehicleId, vehiclesAtGate, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;

    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const plantId = normalizePlantId(shipment.originPlantId);
            const timestamp = serverTimestamp();
            const currentName = userProfile?.fullName || user.displayName || user.email?.split('@')[0] || 'System Operator';

            const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipment.id);
            const shipmentSnap = await transaction.get(shipmentRef);
            if (!shipmentSnap.exists()) throw new Error("Shipment registry error.");
            const currentShipmentData = shipmentSnap.data() as Shipment;

            let vehicleRegId = registryMatch?.id;
            if (values.isNewVehicle && !registryMatch) {
                const newVehRef = doc(collection(firestore, 'vehicles'));
                transaction.set(newVehRef, { vehicleNumber: values.vehicleNumber, driverName: values.driverName, driverMobile: values.driverMobile, plantId, vehicleType: values.vehicleType, createdAt: timestamp, status: 'Assigned' });
                vehicleRegId = newVehRef.id;
            }
            
            const docId = isEditing ? trip!.id : doc(collection(firestore, 'trips')).id;
            const tripRef = doc(firestore, `plants/${plantId}/trips`, docId);
            const globalTripRef = doc(firestore, 'trips', docId);
            
            const tripData: any = {
                tripId: isEditing ? trip!.tripId : generateRandomTripId(),
                vehicleId: vehicleRegId || null,
                vehicleNumber: values.vehicleNumber, driverName: values.driverName || '', driverMobile: values.driverMobile || '',
                vehicleType: values.vehicleType, carrierId: values.carrierId, assignedQtyInTrip: values.assignQty,
                originPlantId: plantId, destination: shipment.unloadingPoint || 'N/A', shipmentIds: [shipment.id],
                tripStatus: 'Assigned', startDate: isEditing ? trip!.startDate : new Date(),
                lastUpdated: timestamp, userName: currentName, userId: user.uid, shipToParty: shipment.shipToParty || '',
                distance: values.distance || 0, transporterName: values.transporterName, transporterMobile: values.transporterMobile,
                ownerName: values.ownerName, ownerPan: values.ownerPan, freightRate: values.freightRate, freightAmount: values.freightAmount
            };

            if(values.vehicleId && !values.isNewVehicle) {
                const entryRef = doc(firestore, 'vehicleEntries', values.vehicleId);
                transaction.update(entryRef, { remarks: 'Under Process', tripId: docId });
            }

            const diff = isEditing ? values.assignQty - trip!.assignedQtyInTrip : values.assignQty;
            const newAssignedTotal = (currentShipmentData.assignedQty || 0) + diff;
            
            transaction.update(shipmentRef, { 
                assignedQty: newAssignedTotal, 
                balanceQty: currentShipmentData.quantity - newAssignedTotal, 
                currentStatusId: (currentShipmentData.quantity - newAssignedTotal) > 0 ? 'Partly Vehicle Assigned' : 'Assigned',
                lastUpdateDate: timestamp
            });
            
            transaction.set(tripRef, tripData);
            transaction.set(globalTripRef, tripData);
        });

        toast({ title: 'Success', description: 'Mission Allocation Finalized.' });
        onAssignmentComplete();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Registry Error', description: e.message || 'An unexpected error occurred.' });
    } finally {
        hideLoader();
    }
  };
  
  const carrierOptions = useMemo(() => carriers.map(c => ({ value: c.id, label: c.name })), [carriers]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-2xl bg-slate-50 rounded-3xl">
        <DialogHeader className="bg-slate-900 text-white p-6 shrink-0 flex flex-row items-center justify-between pr-12 rounded-t-3xl">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg"><Truck className="h-6 w-6" /></div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">SIKKA LMC | Allocation Board</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Lifting Node Registry Assignment Terminal</DialogDescription>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <Badge variant="outline" className="bg-white/5 border-white/10 text-blue-400 font-mono text-sm px-4 py-1 mb-1">{format(currentTime, 'HH:mm:ss')}</Badge>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Synchronized Node</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          <Card className="p-8 border-none shadow-xl rounded-[2.5rem] bg-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110"><Factory size={160} /></div>
            <div className="flex items-center gap-4 mb-8">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100"><ShieldCheck className="h-5 w-5" /></div>
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-700">Mission Context Handshake</h3>
                <Badge className="bg-blue-900 text-white font-black text-[10px] px-4 h-6 tracking-widest">{shipment.shipmentId}</Badge>
            </div>
            <div className="grid grid-cols-6 gap-x-10 gap-y-8 text-xs relative z-10">
                {[
                    { label: 'Plant', value: plantNameDisplay, icon: Factory },
                    { label: 'Consignor', value: shipment.consignor, icon: UserCircle },
                    { label: 'Lifting Site', value: shipment.loadingPoint, icon: MapPin },
                    { label: 'Consignee', value: shipment.billToParty, icon: UserCircle },
                    { label: 'Drop Point (TO)', value: destinationCityDisplay, icon: Truck, span: 2 },
                ].map((item, i) => (
                    <div key={i} className={cn("flex flex-col gap-1.5", item.span && `col-span-${item.span}`)}>
                        <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2">
                            <item.icon size={12} className="text-blue-600" /> {item.label}
                        </span>
                        <span className="font-bold uppercase text-slate-900 leading-tight">{item.value || '--'}</span>
                    </div>
                ))}
            </div>
          </Card>

          <Form {...form}>
            <form className="space-y-10" onSubmit={handleSubmit(onSubmit)}>
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-lg shadow-sm border"><Truck className="h-5 w-5 text-blue-900"/></div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Fleet Allocation Registry</h3>
                        </div>
                        <div className="bg-white p-1.5 rounded-2xl border shadow-inner">
                            <RadioGroup className="flex items-center gap-2" value={isNewVehicle ? 'new' : 'existing'} onValueChange={v => setValue('isNewVehicle', v === 'new')}>
                                <div className={cn("flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer", !isNewVehicle ? "bg-blue-900 text-white shadow-lg" : "hover:bg-slate-50 text-slate-400")}>
                                    <RadioGroupItem value="existing" id="r1" className="border-current" /><label htmlFor="r1" className="font-black text-[10px] uppercase tracking-widest cursor-pointer">From Gate Registry</label>
                                </div>
                                <div className={cn("flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer", isNewVehicle ? "bg-blue-900 text-white shadow-lg" : "hover:bg-slate-50 text-slate-400")}>
                                    <RadioGroupItem value="new" id="r2" className="border-current" /><label htmlFor="r2" className="font-black text-[10px] uppercase tracking-widest cursor-pointer">Direct Node Entry</label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                    
                    <div className="p-10 space-y-10">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="h-12 hover:bg-transparent border-b">
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 w-[250px]">Vehicle Number</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4">Pilot Name</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4">Pilot Mobile</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 w-[250px]">Carrier Registry</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4">Category</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 px-4 text-right">Assign Weight</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="align-top h-20 hover:bg-transparent">
                                    <TableCell className="px-4 py-4">
                                        {isNewVehicle ? (
                                            <FormField control={control} name="vehicleNumber" render={({ field }) => (
                                                <FormControl><div className="relative">
                                                    <Input placeholder="MH12AB1234" className="h-11 rounded-xl font-black text-blue-900 uppercase shadow-inner border-slate-200" {...field} />
                                                    {registryMatch && <div className="absolute right-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Registry Linked" />}</div>
                                                </FormControl>
                                            )} />
                                        ) : (
                                            <FormField control={control} name="vehicleId" render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-11 rounded-xl font-black text-slate-900 border-slate-200"><SelectValue placeholder={isDataLoading ? "Syncing Gate..." : "Pick Vehicle"} /></SelectTrigger></FormControl>
                                                    <SelectContent className="rounded-xl">{isDataLoading ? <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto"/></div> : vehiclesAtGate.map(v => <SelectItem key={v.id} value={v.id} className="font-black py-2.5">{v.vehicleNumber}</SelectItem>)}</SelectContent>
                                                </Select>
                                            )} />
                                        )}
                                    </TableCell>
                                    <TableCell className="px-4 py-4"><FormField control={control} name="driverName" render={({ field }) => (<Input placeholder="Driver Name" className="h-11 rounded-xl font-bold" {...field} />)} /></TableCell>
                                    <TableCell className="px-4 py-4"><FormField control={control} name="driverMobile" render={({ field }) => (<Input placeholder="10 Digits" className="h-11 rounded-xl font-mono font-black" maxLength={10} {...field} />)} /></TableCell>
                                    <TableCell>
                                        <FormField control={control} name="carrierId" render={({ field }) => (
                                            <SearchableSelect 
                                                options={carrierOptions} 
                                                onChange={field.onChange} 
                                                value={field.value} 
                                                placeholder="Select Carrier"
                                                className="h-11"
                                            />
                                        )} />
                                    </TableCell>
                                    <TableCell>
                                        <FormField control={control} name="vehicleType" render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value} disabled={!!registryMatch}>
                                                <FormControl><SelectTrigger className="h-11 rounded-xl font-bold bg-slate-50/50 border-slate-200"><SelectValue placeholder="Select Type"/>{!!registryMatch && <Lock size={12} className="ml-2 text-slate-400"/>}</SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">{VehicleTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2.5">{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                        )} />
                                    </TableCell>
                                    <TableCell className="px-4 py-4">
                                        <FormField control={control} name="assignQty" render={({ field }) => (
                                            <div className="relative">
                                                <Input type="number" step="0.001" className="h-11 rounded-xl font-black text-right pr-10 text-blue-900 shadow-inner" {...field} />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">MT</span>
                                            </div>
                                        )} />
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>

                        {vehicleType === 'Market Vehicle' && (
                            <div className="space-y-8 animate-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center gap-3 px-2">
                                    <User className="h-4 w-4 text-blue-600" />
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Transporter & Owner Registry</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-8 bg-blue-50/30 rounded-[2rem] border border-blue-100">
                                    <FormField control={control} name="transporterName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Transporter Name *</FormLabel>
                                            <FormControl><Input placeholder="Legal name" className="h-11 rounded-xl font-bold uppercase" {...field} /></FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="transporterMobile" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Transporter Mobile *</FormLabel>
                                            <FormControl><Input placeholder="10 Digits" className="h-11 rounded-xl font-mono font-bold" maxLength={10} {...field} /></FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="ownerName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Owner Name *</FormLabel>
                                            <FormControl><Input placeholder="As per RC" className="h-11 rounded-xl font-bold uppercase" {...field} /></FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="ownerPan" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Owner PAN</FormLabel>
                                            <FormControl><Input placeholder="ABCDE1234F" className="h-11 rounded-xl font-mono font-bold uppercase" maxLength={10} {...field} /></FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )} />
                                </div>

                                <div className="flex items-center gap-3 px-2 pt-4">
                                    <IndianRupee className="h-4 w-4 text-emerald-600" />
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Financial Liquidation Node</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-emerald-50/20 rounded-[2rem] border border-emerald-100 items-end">
                                    <FormField control={control} name="freightRate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Freight Rate (per MT) *</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input type="number" step="0.01" className="h-12 rounded-xl font-black text-emerald-900 shadow-inner border-emerald-200" {...field} />
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                                                </div>
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )} />
                                    <div className="flex flex-col gap-1.5 bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Automated Freight Calculation</span>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 italic">{assignQty} MT × ₹{freightRate}</span>
                                            <span className="text-lg font-black text-emerald-600">₹ {(watch('freightAmount') || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-emerald-600 rounded-2xl text-white shadow-xl flex items-center gap-4">
                                        <Calculator className="h-6 w-6 opacity-50" />
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-emerald-200 tracking-widest">Mission Net Freight</span>
                                            <span className="text-xl font-black tracking-tighter">₹ {(watch('freightAmount') || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
                
                <Card className="p-8 border-none shadow-xl rounded-[2.5rem] bg-white group">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 group-hover:bg-blue-900 group-hover:text-white transition-all duration-500"><ArrowRightLeft className="h-5 w-5"/></div>
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-700">Mission Route Node</h3>
                     </div>
                     <div className="flex items-center gap-10">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Computed Distance</span>
                            <div className="flex items-center gap-3">
                                <h4 className="text-5xl font-black text-blue-900 tracking-tighter">
                                    {calculatingDistance ? <Loader2 className="h-10 w-10 animate-spin text-slate-200" /> : `${currentDistance || '--'}`}
                                </h4>
                                <span className="text-xl font-black text-slate-300">KM</span>
                            </div>
                        </div>
                        <div className="h-16 w-px bg-slate-100 hidden md:block" />
                        <div className="max-w-md p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner flex items-start gap-4">
                            <AlertCircle className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-bold text-slate-500 leading-normal uppercase">
                                Distance node synchronized with Google Maps standard routing protocols. Final mission payload logic may vary based on pilot route selection.
                            </p>
                        </div>
                     </div>
                </Card>
            </form>
          </Form>
        </div>

        <DialogFooter className="bg-slate-900 text-white p-8 shrink-0 flex flex-col md:flex-row items-center justify-between sm:justify-between border-t border-white/5 rounded-b-3xl">
            <div className="flex items-center gap-12">
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Order Balance Post-Commit</span>
                    <div className="flex items-center gap-3">
                        <Calculator size={20} className="text-blue-400" />
                        <span className={cn(
                            "text-3xl font-black tracking-tighter transition-all duration-500", 
                            balanceQty > 0.01 ? 'text-orange-400' : 'text-emerald-400'
                        )}>
                            {balanceQty.toFixed(3)} MT
                        </span>
                    </div>
                </div>
                {balanceQty <= 0.01 && balanceQty >= -0.01 && (
                    <div className="bg-emerald-600/20 text-emerald-400 px-6 py-2 rounded-2xl border border-emerald-500/30 flex items-center gap-3 animate-in zoom-in duration-500">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Registry Full Allocation</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-black text-slate-400 hover:text-white uppercase text-[11px] tracking-widest px-8 h-12">Discard</Button>
                <Button 
                    onClick={handleSubmit(onSubmit)} 
                    disabled={isSubmitting || calculatingDistance || !assignQty} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-900/50 border-none transition-all active:scale-95 border-none disabled:opacity-30 disabled:grayscale"
                >
                    {isSubmitting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />} 
                    {isEditing ? 'Sync Allocation' : 'Establish mission node'}
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
