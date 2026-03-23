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
    ArrowRightLeft
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
    distance: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.vehicleType === 'Market Vehicle') {
        if (!data.transporterName?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required for Market vehicle.', path: ['transporterName'] });
        }
        if (!data.transporterMobile?.trim() || !/^\d{10}$/.test(data.transporterMobile)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid 10-digit mobile required.', path: ['transporterMobile'] });
        }
    }
});

type FormValues = z.infer<typeof formSchema>;

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (date instanceof Timestamp) return date.toDate();
    if (date instanceof Date && isValid(date)) return date;
    return null;
};

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
    defaultValues: { assignQty: 0 },
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
            vehicleType: trip?.vehicleType || 'Own Vehicle',
            carrierId: trip?.carrierId || shipment.carrierId || (carriers.length > 0 ? carriers[0].id : ''),
            assignQty: trip?.assignedQtyInTrip ?? Number(Number(shipment.balanceQty).toFixed(3)),
            transporterName: trip?.transporterName || '',
            transporterMobile: (trip as any)?.transporterMobile || '',
            distance: trip?.distance || 0
        };
        reset(defaultValues);
        hasCalculatedDistance.current = !!trip?.distance;
    } else {
        reset({ assignQty: 0 });
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

  const { isNewVehicle, vehicleId, assignQty, vehicleNumber } = useWatch({ control });

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
            } else {
                toast({ variant: 'destructive', title: "API Error", description: "Google Maps route calculation failed." });
            }
        });
      } catch (e) {
        setCalculatingDistance(false);
        toast({ variant: 'destructive', title: "API Error", description: "Could not initialize Google Maps service." });
      }
    };

    calculate();
  }, [isLoaded, isOpen, shipment.loadingPoint, shipment.unloadingPoint, setValue, toast]);

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
            setValue('vehicleType', vData.vehicleType || 'Own Vehicle', { shouldValidate: true });
            if (vData.driverName) setValue('driverName', vData.driverName, { shouldValidate: true });
            if (vData.driverMobile) setValue('driverMobile', vData.driverMobile, { shouldValidate: true });
            toast({ title: 'Registry Link Established', description: `${vData.vehicleNumber} identified in fleet registry.` });
        } else {
            setRegistryMatch(null);
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'Cloud Sync Error', description: 'Failed to perform vehicle lookup.' });
    }
  }, [firestore, setValue, toast]);

  useEffect(() => {
    if (!isOpen) return;
    const vNumber = vehicleNumber?.toUpperCase().replace(/\s/g, '') || '';
    if (vNumber.length < 6) {
        if (registryMatch) setRegistryMatch(null);
        return;
    }
    const handler = setTimeout(() => performVehicleLookup(vNumber), 500);
    return () => clearTimeout(handler);
  }, [isOpen, vehicleNumber, registryMatch, performVehicleLookup]);

  useEffect(() => {
    if (!isOpen || isNewVehicle || !vehicleId) return;
    const found = vehiclesAtGate.find(v => v.id === vehicleId);
    if (found && found.vehicleNumber !== vehicleNumber) {
        setValue('vehicleNumber', found.vehicleNumber, { shouldValidate: true });
        setValue('driverName', found.driverName || '', { shouldValidate: true });
        setValue('driverMobile', found.driverMobile || '', { shouldValidate: true });
    }
  }, [isOpen, isNewVehicle, vehicleId, vehiclesAtGate, setValue, vehicleNumber]);

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
                transaction.set(newVehRef, { vehicleNumber: values.vehicleNumber, driverName: values.driverName, driverMobile: values.driverMobile, plantId, vehicleType: values.vehicleType, createdAt: timestamp });
                vehicleRegId = newVehRef.id;
            }
            
            const docId = isEditing ? trip!.id : doc(collection(firestore, 'trips')).id;
            const tripRef = doc(firestore, `plants/${plantId}/trips`, docId);
            const globalTripRef = doc(firestore, 'trips', docId);
            
            const tripData: Omit<Trip, 'id'> = {
                tripId: isEditing ? trip!.tripId : generateRandomTripId(),
                vehicleId: vehicleRegId || null,
                vehicleNumber: values.vehicleNumber, driverName: values.driverName || '', driverMobile: values.driverMobile || '',
                vehicleType: values.vehicleType, carrierId: values.carrierId, assignedQtyInTrip: values.assignQty,
                originPlantId: plantId, destination: shipment.unloadingPoint || 'N/A', shipmentIds: [shipment.id],
                tripStatus: 'Assigned', startDate: isEditing ? trip!.startDate : new Date(),
                lastUpdated: timestamp, userName: currentName, userId: user.uid, shipToParty: shipment.shipToParty || ''
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
                currentStatusId: (currentShipmentData.quantity - newAssignedTotal) > 0 ? 'Partly Vehicle Assigned' : 'Assigned' 
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-2xl bg-slate-50">
        <DialogHeader className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between pr-12">
          <DialogTitle className="font-black uppercase tracking-tight">SIKKA LMC | Allocation Board</DialogTitle>
          <div className="text-right"><p className="text-xs font-mono">{format(currentTime, 'HH:mm:ss')}</p></div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Card className="p-6 border-slate-200 shadow-sm rounded-2xl">
            <div className="flex items-center gap-4 mb-4">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><ShieldCheck className="h-5 w-5" /></div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Mission Context</h3>
                <Badge className="bg-blue-50 border-blue-200 text-blue-600 font-bold text-xs px-3 py-1">{shipment.shipmentId}</Badge>
            </div>
            <div className="grid grid-cols-6 gap-x-8 gap-y-4 text-xs">
                <div className="flex flex-col gap-1"><span className="font-bold text-slate-400 text-[10px] uppercase flex items-center gap-2"><Factory size={12}/>Plant</span><span className="font-bold uppercase">{plantNameDisplay}</span></div>
                <div className="flex flex-col gap-1"><span className="font-bold text-slate-400 text-[10px] uppercase flex items-center gap-2"><UserCircle size={12}/>Consignor</span><span className="font-bold uppercase">{shipment.consignor}</span></div>
                <div className="flex flex-col gap-1"><span className="font-bold text-slate-400 text-[10px] uppercase flex items-center gap-2"><MapPin size={12}/>Lifting Site</span><span className="font-bold uppercase">{shipment.loadingPoint}</span></div>
                <div className="flex flex-col gap-1"><span className="font-bold text-slate-400 text-[10px] uppercase flex items-center gap-2"><UserCircle size={12}/>Consignee</span><span className="font-bold uppercase">{shipment.billToParty}</span></div>
                <div className="flex flex-col gap-1 col-span-2"><span className="font-bold text-slate-400 text-[10px] uppercase flex items-center gap-2"><Truck size={12}/>Drop Point</span><span className="font-bold uppercase">{shipment.unloadingPoint}</span></div>
            </div>
          </Card>

          <Form {...form}>
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <Card className="border-slate-200 shadow-sm rounded-2xl">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-3"><Truck className="h-5 w-5 text-blue-600"/>Allocation Details</h3>
                            <RadioGroup className="flex items-center gap-6" value={isNewVehicle ? 'new' : 'existing'} onValueChange={v => setValue('isNewVehicle', v === 'new')}>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="existing" id="r1" /><label htmlFor="r1" className="font-bold text-xs uppercase">From Gate</label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="new" id="r2" /><label htmlFor="r2" className="font-bold text-xs uppercase">Direct Entry</label></div>
                            </RadioGroup>
                        </div>
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead className="w-[25%]">Vehicle Number</TableHead>
                                <TableHead>Pilot Name</TableHead>
                                <TableHead>Pilot Mobile</TableHead>
                                <TableHead>Carrier</TableHead>
                                <TableHead>Vehicle Type</TableHead>
                                <TableHead className="text-right">Assign Qty (MT)</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                <TableRow className="align-top">
                                    <TableCell className="font-medium">
                                        {isNewVehicle ? (
                                            <FormField control={control} name="vehicleNumber" render={({ field }) => (
                                                <FormControl><div className="relative">
                                                    <Input placeholder="e.g. HR55AC1234" className="font-bold uppercase" {...field} />
                                                    {registryMatch && <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Registry Linked" />}</div>
                                                </FormControl>
                                            )} />
                                        ) : (
                                            <FormField control={control} name="vehicleId" render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select from Gate Registry" /></SelectTrigger></FormControl>
                                                    <SelectContent>{isDataLoading ? <p>Loading...</p> : vehiclesAtGate.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}</SelectContent>
                                                </Select>
                                            )} />
                                        )}
                                    </TableCell>
                                    <TableCell><FormField control={control} name="driverName" render={({ field }) => (<Input placeholder="Driver Name" {...field} />)} /></TableCell>
                                    <TableCell><FormField control={control} name="driverMobile" render={({ field }) => (<Input placeholder="Driver Mobile" {...field} />)} /></TableCell>
                                    <TableCell>
                                        <FormField control={control} name="carrierId" render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Carrier" /></SelectTrigger></FormControl>
                                                <SelectContent>{carriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        )} />
                                    </TableCell>
                                    <TableCell>
                                        <FormField control={control} name="vehicleType" render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value} disabled={!!registryMatch}>
                                                <FormControl><SelectTrigger className="relative"><SelectValue placeholder="Select Type"/>{!!registryMatch && <Lock size={12} className="absolute right-2 top-1/2 -translate-y-1/2"/>}</SelectTrigger></FormControl>
                                                <SelectContent>{VehicleTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                        )} />
                                    </TableCell>
                                    <TableCell><FormField control={control} name="assignQty" render={({ field }) => (<Input type="number" step="0.001" className="font-bold text-right" {...field} />)} /></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                         {isNewVehicle && vehicleType === 'Market Vehicle' && (
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <FormField control={control} name="transporterName" render={({ field }) => (<FormItem><FormLabel>Transporter Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)} />
                                <FormField control={control} name="transporterMobile" render={({ field }) => (<FormItem><FormLabel>Transporter Mobile *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>)} />
                            </div>
                        )}
                    </div>
                </Card>
                
                <Card className="p-6 border-slate-200 shadow-sm rounded-2xl">
                     <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-3"><ArrowRightLeft className="h-5 w-5 text-blue-600"/>Distance & Route</h3>
                     <div className="flex items-center gap-4">
                        <div className="text-3xl font-black text-blue-900">{calculatingDistance ? <Loader2 className="h-8 w-8 animate-spin" /> : `${currentDistance || '--'}`}</div>
                        <span className="text-lg font-bold text-slate-400">KM</span>
                        <p className="text-xs text-slate-500 italic">* As per Google Maps standard routing. Final distance may vary.</p>
                     </div>
                </Card>
            </form>
          </Form>
        </div>

        <DialogFooter className="bg-slate-200 p-4 shrink-0 flex items-center justify-between border-t">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><Calculator size={18}/><span className="text-xs font-bold">Balance Qty:</span><span className={cn("font-bold text-sm", balanceQty > 0 ? 'text-orange-600' : 'text-green-600')}>{balanceQty.toFixed(3)} MT</span></div>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting || calculatingDistance} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isEditing ? 'Update Allocation' : 'Confirm Allocation'}
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
