
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
    AlertCircle,
    X,
    IndianRupee,
    Weight,
    Smartphone,
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

interface VehicleAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: WithId<Shipment>;
  trip?: WithId<Trip> | null;
  onAssignmentComplete: () => void;
  carriers: WithId<Carrier>[];
}

const VEHICLE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;
const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const MAP_LIBRARIES: ("places")[] = ['places'];

const formSchema = z.object({
    isNewVehicle: z.boolean().default(false),
    vehicleId: z.string().optional(),
    vehicleNumber: z.string().min(1, "Vehicle number is mandatory.").transform(v => v.toUpperCase().replace(/\s/g, '')).refine(val => VEHICLE_REGEX.test(val), {
        message: 'Invalid Format (e.g. MH12AB1234)'
    }),
    driverName: z.string().optional().default(''),
    driverMobile: z.string().optional().or(z.literal('')).refine(val => !val || /^\d{10}$/.test(val), {
        message: 'Mobile must be 10 digits if provided.'
    }),
    vehicleType: z.enum(VehicleTypes, { required_error: 'Vehicle type is required' }),
    carrierId: z.string().min(1, 'Carrier is required'),
    assignQty: z.coerce.number().positive('Assign quantity must be positive'),
    transporterName: z.string().optional().default(''),
    transporterMobile: z.string().optional().or(z.literal('')).refine(val => !val || /^\d{10}$/.test(val), {
        message: 'Mobile must be 10 digits if provided.'
    }),
    ownerName: z.string().optional().default(''),
    ownerMobile: z.string().optional().or(z.literal('')).refine(val => !val || /^\d{10}$/.test(val), {
        message: 'Mobile must be 10 digits if provided.'
    }),
    distance: z.coerce.number().optional().default(0),
    freightRate: z.coerce.number().optional().default(0),
}).superRefine((data, ctx) => {
    if (data.vehicleType === 'Market Vehicle') {
        if (!data.transporterName?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required for Market vehicle.', path: ['transporterName'] });
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
  
  const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: MAPS_JS_KEY, libraries: MAP_LIBRARIES });

  const [vehiclesAtGate, setVehiclesAtGate] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const isEditing = !!trip;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        assignQty: shipment.balanceQty !== undefined ? Number(Number(shipment.balanceQty).toFixed(3)) : 0,
        vehicleType: 'Own Vehicle'
    },
  });
  const { watch, setValue, handleSubmit, reset, control, formState: { isSubmitting, errors } } = form;

  const { isNewVehicle, vehicleId, assignQty, vehicleNumber, vehicleType, freightRate, distance: currentDistance } = watch();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const selectedPlant = useMemo(() => {
    if (!plants) return null;
    return plants.find(p => normalizePlantId(p.id).toLowerCase() === normalizePlantId(shipment.originPlantId).toLowerCase());
  }, [plants, shipment.originPlantId]);

  const plantNameDisplay = selectedPlant?.name || shipment.originPlantId;
  const plantAddressDisplay = selectedPlant?.address || shipment.loadingPoint;

  const carrierOptions = useMemo(() => {
    return (carriers || [])
      .map(c => ({ value: c.id, label: c.name }));
  }, [carriers]);

  useEffect(() => {
    if (isOpen) {
        const safeBalance = shipment.balanceQty !== undefined ? Number(Number(shipment.balanceQty).toFixed(3)) : 0;
        let initialCarrierId = trip?.carrierId || shipment.carrierId || '';
        
        if (initialCarrierId && !carrierOptions.find(o => o.value === initialCarrierId)) {
            initialCarrierId = carrierOptions.length > 0 ? carrierOptions[0].value : '';
        } else if (!initialCarrierId && carrierOptions.length > 0) {
            initialCarrierId = carrierOptions[0].value;
        }

        reset({
            isNewVehicle: false,
            vehicleId: trip?.vehicleId || '',
            vehicleNumber: trip?.vehicleNumber || '',
            driverName: trip?.driverName || '',
            driverMobile: trip?.driverMobile || '',
            vehicleType: (trip?.vehicleType as any) || 'Own Vehicle',
            carrierId: initialCarrierId,
            assignQty: trip?.assignedQtyInTrip ?? safeBalance,
            transporterName: trip?.transporterName || '',
            transporterMobile: (trip as any)?.transporterMobile || '',
            ownerName: trip?.ownerName || '',
            ownerMobile: (trip as any)?.ownerMobile || '',
            distance: trip?.distance || 0,
            freightRate: trip?.freightRate || 0
        });
    }
  }, [isOpen, trip, shipment, carrierOptions, reset]);

  useEffect(() => {
    if (!isOpen || isNewVehicle || !vehicleId) return;
    const found = vehiclesAtGate.find(v => v.id === vehicleId);
    if (found) {
        setValue('vehicleNumber', found.vehicleNumber, { shouldValidate: true });
        setValue('driverName', found.driverName || '', { shouldValidate: true });
        setValue('driverMobile', found.driverMobile || '', { shouldValidate: true });
    }
  }, [isOpen, isNewVehicle, vehicleId, vehiclesAtGate, setValue]);

  useEffect(() => {
    if (!isOpen || !firestore || !shipment.originPlantId) return;
    const fetchRegistryData = async () => {
        setIsDataLoading(true);
        try {
            const targetPlantId = normalizePlantId(shipment.originPlantId);
            const qVeh = query(collection(firestore, 'vehicleEntries'), where('plantId', '==', targetPlantId), where('status', '==', 'IN'));
            const vehSnap = await getDocs(qVeh);
            const entries = vehSnap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<VehicleEntryExit>));
            setVehiclesAtGate(entries.filter(e => e.purpose === 'Loading'));
        } catch (error) {
            console.error("Registry Fetch Error:", error);
        } finally {
            setIsDataLoading(false);
        }
    };
    fetchRegistryData();
  }, [isOpen, firestore, shipment.originPlantId]);

  useEffect(() => {
    if (!isLoaded || !isOpen || !shipment.loadingPoint || !shipment.unloadingPoint || isEditing) return;
    const calculate = () => {
      setCalculatingDistance(true);
      const service = new google.maps.DirectionsService();
      service.route({
          origin: shipment.loadingPoint!,
          destination: shipment.unloadingPoint!,
          travelMode: google.maps.TravelMode.DRIVING,
      }, (response, status) => {
          setCalculatingDistance(false);
          if (status === 'OK' && response) {
              const distKm = (response.routes[0].legs[0].distance?.value || 0) / 1000;
              setValue('distance', Number(distKm.toFixed(2)));
          }
      });
    };
    calculate();
  }, [isLoaded, isOpen, shipment.loadingPoint, shipment.unloadingPoint, setValue, isEditing]);

  const balanceQty = useMemo(() => {
    const currentPool = isEditing ? (shipment.balanceQty + (trip?.assignedQtyInTrip || 0)) : shipment.balanceQty;
    const remaining = currentPool - (Number(assignQty) || 0);
    return Number(Math.max(0, remaining).toFixed(3));
  }, [shipment.balanceQty, assignQty, isEditing, trip]);

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
            if (!shipmentSnap.exists()) throw new Error("Order registry node error.");
            const sData = shipmentSnap.data() as Shipment;
            const docId = trip?.id || doc(collection(firestore, 'trips')).id;
            const tripId = trip?.tripId || generateRandomTripId();
            
            const tripData: any = {
                ...values,
                tripId,
                originPlantId: plantId,
                shipmentIds: [shipment.id],
                assignedQtyInTrip: values.assignQty, 
                consignor: shipment.consignor, 
                billToParty: shipment.billToParty,
                shipToParty: shipment.shipToParty || shipment.billToParty, 
                loadingPoint: shipment.loadingPoint,
                unloadingPoint: shipment.unloadingPoint, 
                deliveryAddress: shipment.deliveryAddress || shipment.unloadingPoint,
                materialTypeId: shipment.materialTypeId,
                items: shipment.items || [],
                lrNumber: shipment.lrNumber || '', 
                lrDate: shipment.lrDate || null,   
                lastUpdated: timestamp,
                userName: currentName,
                userId: user.uid,
                tripStatus: 'Assigned',
                currentStatusId: 'assigned',
                podStatus: 'Missing',
                freightStatus: 'Unpaid'
            };

            const diff = isEditing ? values.assignQty - trip!.assignedQtyInTrip : values.assignQty;
            const newAssignedTotal = (sData.assignedQty || 0) + diff;
            
            transaction.update(shipmentRef, { 
                assignedQty: newAssignedTotal, 
                balanceQty: sData.quantity - newAssignedTotal, 
                currentStatusId: (sData.quantity - newAssignedTotal) > 0 ? 'Partly Vehicle Assigned' : 'Assigned',
                lastUpdateDate: timestamp
            });
            
            transaction.set(doc(firestore, `plants/${plantId}/trips`, docId), tripData);
            transaction.set(doc(firestore, 'trips', docId), tripData);
        });
        toast({ title: 'Mission Established', description: 'Registry node synchronized successfully.' });
        onAssignmentComplete();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Registry Error', description: e.message });
    } finally {
        hideLoader();
    }
  };

  const calculatedFreight = (Number(assignQty) || 0) * (Number(freightRate) || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[95vh] md:h-[90vh] flex flex-col p-0 border-none shadow-2xl bg-slate-50 rounded-[2rem] md:rounded-[3rem]">
        <DialogHeader className="bg-slate-900 text-white p-4 md:p-6 shrink-0 flex flex-row items-center justify-between pr-10 md:pr-12">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-blue-600 rounded-xl shadow-lg rotate-3"><Truck className="h-5 w-5 md:h-7 md:w-7 text-white" /></div>
            <div>
                <DialogTitle className="text-lg md:text-2xl font-black uppercase tracking-tight italic leading-none">SIKKA LMC | ALLOCATION BOARD</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[8px] md:text-[9px] tracking-widest mt-1 md:mt-2">Registry Terminal Node</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-white/5 border-white/10 text-white font-mono h-8 md:h-10 px-4 md:px-6 rounded-xl flex items-center hidden sm:flex">{format(currentTime, 'HH:mm:ss')}</Badge>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 md:h-10 md:w-10 text-white/40 hover:text-white"><X size={20} /></Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10">
          <Card className="p-5 md:p-10 border-2 border-slate-100 shadow-xl rounded-[1.5rem] md:rounded-[2.5rem] bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 md:w-2 h-full bg-blue-900" />
            <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="p-2 md:p-3 bg-blue-50 rounded-xl border border-blue-100 shadow-sm"><ShieldCheck className="h-5 w-5 md:h-6 md:w-6 text-blue-600" /></div>
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Manifest</h3>
                    <p className="text-lg md:text-2xl font-black text-slate-900 tracking-tighter uppercase">{shipment.shipmentId}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 md:gap-10">
                <ContextNode label="Lifting Plant" value={plantNameDisplay} icon={Factory} />
                <ContextNode label="Consignor" value={shipment.consignor} icon={UserCircle} />
                <ContextNode label="Site point" value={plantAddressDisplay} icon={MapPin} />
                <ContextNode label="Consignee" value={shipment.billToParty} icon={UserCircle} />
                <ContextNode label="Drop plant" value={shipment.deliveryAddress || shipment.unloadingPoint} icon={MapPin} className="col-span-2 text-blue-900" bold />
            </div>
          </Card>

          <Form {...form}>
            <form className="space-y-6 md:space-y-10" onSubmit={handleSubmit(onSubmit)}>
                <Card className="border-none shadow-2xl rounded-[1.5rem] md:rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="p-5 md:p-8 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                        <h3 className="font-black text-[10px] md:text-xs uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2 md:gap-3"><Truck className="h-4 w-4 md:h-5 md:w-5 text-blue-600"/> Fleet Entry Control</h3>
                        <div className="bg-white p-1 rounded-xl border-2 border-slate-200 shadow-inner flex items-center gap-1">
                            <button type="button" onClick={() => setValue('isNewVehicle', false)} className={cn("px-3 md:px-6 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[10px] font-black uppercase transition-all", !isNewVehicle ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600")}>At Gate Registry</button>
                            <button type="button" onClick={() => setValue('isNewVehicle', true)} className={cn("px-3 md:px-6 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[10px] font-black uppercase transition-all", isNewVehicle ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600")}>Direct Manual Entry</button>
                        </div>
                    </div>
                    <div className="p-6 md:p-10 space-y-6 md:space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            <div className="space-y-1.5 md:space-y-2">
                                <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Vehicle Number *</label>
                                {isNewVehicle ? (
                                    <FormField name="vehicleNumber" control={control} render={({field}) => <FormItem><FormControl><div className="relative"><Input placeholder="XX00XX0000" className="h-11 md:h-12 rounded-xl font-black text-blue-900 uppercase text-lg shadow-inner border-slate-200 focus-visible:ring-blue-900" {...field} /></div></FormControl><FormMessage /></FormItem>} />
                                ) : (
                                    <FormField name="vehicleId" control={control} render={({field}) => (
                                        <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 md:h-12 rounded-xl font-black text-blue-900"><SelectValue placeholder={isDataLoading ? "Syncing Gate..." : "Resolve from Gate"} /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">{vehiclesAtGate.map(v => <SelectItem key={v.id} value={v.id} className="font-bold py-3 uppercase italic text-black">{v.vehicleNumber} ({v.driverName})</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>

                            <div className="space-y-1.5 md:space-y-2">
                                <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Pilot Name</label>
                                <FormField name="driverName" control={control} render={({field}) => <FormItem><FormControl><Input placeholder="Pilot Name" className="h-11 md:h-12 rounded-xl font-bold uppercase" {...field} /></FormControl><FormMessage /></FormItem>} />
                            </div>

                            <div className="space-y-1.5 md:space-y-2">
                                <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Pilot Mobile</label>
                                <FormField name="driverMobile" control={control} render={({field}) => <FormItem><FormControl><Input {...field} maxLength={10} placeholder="10 Digits" className="h-11 md:h-12 rounded-xl font-mono font-black" /></FormControl><FormMessage /></FormItem>} />
                            </div>

                            <div className="space-y-1.5 md:space-y-2">
                                <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Carrier Agent *</label>
                                <FormField name="carrierId" control={control} render={({ field }) => (
                                    <FormItem>
                                    <SearchableSelect 
                                        options={carrierOptions} 
                                        onChange={field.onChange} 
                                        value={field.value} 
                                        placeholder={carrierOptions.length === 0 ? "No carriers for this plant" : "Pick Agent"}
                                        className="h-11 md:h-12"
                                        disabled={carrierOptions.length === 0}
                                    />
                                    <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <div className="space-y-1.5 md:space-y-2">
                                <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Fleet Type *</label>
                                <FormField name="vehicleType" control={control} render={({ field }) => (
                                    <FormItem>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-11 md:h-12 rounded-xl font-bold"><SelectValue placeholder="Select Type"/></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{VehicleTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2.5">{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <div className="space-y-1.5 md:space-y-2">
                                <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Assign Qty (MT) *</label>
                                <FormField name="assignQty" control={control} render={({field}) => (
                                    <FormItem>
                                    <FormControl><Input {...field} value={field.value ?? ''} type="number" step="0.001" className="h-11 md:h-12 rounded-xl text-right font-black text-xl text-blue-900 shadow-inner" /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
                    <Card className={cn("p-6 md:p-10 transition-all duration-500 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl", vehicleType === 'Market Vehicle' ? "bg-blue-50/30 border-2 border-blue-100 opacity-100" : "opacity-40 grayscale pointer-events-none border-slate-100")}>
                        <div className="flex items-center gap-3 mb-6 md:mb-8 px-2">
                            <IndianRupee className="h-5 w-5 text-blue-600" />
                            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-700">Financial Particulars (Market node)</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-end">
                            <FormField name="transporterName" control={control} render={({field}) => <FormItem><FormLabel className="text-[9px] md:text-[10px] font-black uppercase text-slate-400">Transporter Name *</FormLabel><FormControl><Input {...field} className="h-11 md:h-12 rounded-xl bg-white border-slate-200 font-bold" /></FormControl><FormMessage /></FormItem>} />
                            
                            <FormField name="transporterMobile" control={control} render={({field}) => (
                                <FormItem>
                                    <FormLabel className="text-[9px] md:text-[10px] font-black uppercase text-slate-400">Transporter Mobile</FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                            <Input placeholder="Optional" {...field} maxLength={10} className="h-11 md:h-12 rounded-xl bg-white border-slate-200 font-mono pl-10" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="ownerName" control={control} render={({field}) => (
                                <FormItem>
                                    <FormLabel className="text-[9px] md:text-[10px] font-black uppercase text-slate-400">Vehicle Owner Name</FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                            <Input placeholder="Enter owner name" {...field} className="h-11 md:h-12 rounded-xl bg-white border-slate-200 font-bold pl-10 uppercase" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="ownerMobile" control={control} render={({field}) => (
                                <FormItem>
                                    <FormLabel className="text-[9px] md:text-[10px] font-black uppercase text-slate-400">Owner Mobile Number</FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                            <Input placeholder="Optional" {...field} maxLength={10} className="h-11 md:h-12 rounded-xl bg-white border-slate-200 font-mono pl-10" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="freightRate" control={control} render={({field}) => <FormItem><FormLabel className="text-[9px] md:text-[10px] font-black uppercase text-blue-600">Freight Rate (MT) *</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-11 md:h-12 rounded-xl bg-white border-blue-200 font-black text-blue-900 text-lg shadow-inner" /></FormControl><FormMessage /></FormItem>} />
                            
                            <div className="flex flex-col gap-1 md:gap-1.5">
                                <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-400">Calculated Freight</span>
                                <div className="h-11 md:h-12 px-4 md:px-5 flex items-center bg-blue-900 rounded-xl text-white font-black text-lg md:text-xl shadow-lg">₹ {calculatedFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-xl flex items-center gap-6 md:gap-8 relative overflow-hidden group">
                        <div className="flex flex-col gap-0.5 md:gap-1">
                            <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Routing Distance node</span>
                            <div className="flex items-center gap-2 md:gap-3">
                                <h4 className="text-3xl md:text-5xl font-black text-blue-900 tracking-tighter">
                                    {calculatingDistance ? <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin" /> : (currentDistance || '--')}
                                </h4>
                                <span className="text-base md:text-xl font-black text-slate-300">KM</span>
                            </div>
                        </div>
                        <div className="h-12 md:h-16 w-px bg-slate-100 mx-1 md:mx-2" />
                        <div className="flex items-start gap-3 md:gap-4">
                            <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-blue-600 shrink-0 mt-0.5 md:mt-1 hidden sm:block" />
                            <p className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase leading-normal max-w-[150px] md:max-w-[200px]">Distance synchronized with Google Maps mission routing protocol.</p>
                        </div>
                    </Card>
                </div>

                <div className="flex flex-col md:flex-row justify-end pt-8 md:pt-10 border-t border-white/5 gap-4 md:gap-6">
                    <button type="button" onClick={onClose} className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-blue-900 transition-all py-2">ABORT ALLOCATION</button>
                    <Button 
                        type="submit" 
                        disabled={isSubmitting || calculatingDistance} 
                        className="h-14 md:h-16 px-12 md:px-20 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl md:rounded-3xl font-black uppercase text-[11px] md:text-xs tracking-[0.2em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95 border-none"
                    >
                        {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />} {isEditing ? 'Update plant' : 'Establish Mission plant'}
                    </Button>
                </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="p-4 md:p-6 bg-slate-900 flex flex-row justify-between items-center shrink-0 gap-4">
            <div className="flex items-center gap-6">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5 md:gap-2"><Calculator className="h-3 w-3" /> Balance remaining</span>
                    <span className={cn("text-xl md:text-2xl font-black tracking-tighter transition-all duration-500", balanceQty > 0.001 ? "text-orange-400" : "text-emerald-400")}>
                        {balanceQty.toFixed(3)} MT
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
                <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest italic hidden sm:inline">Authorized Registry Handshake node</span>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContextNode({ label, value, icon: Icon, className, bold }: any) {
    return (
        <div className={cn("space-y-1 md:space-y-1.5", className)}>
            <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5 md:gap-2 tracking-widest leading-none">
                {Icon && <Icon className="h-2.5 w-2.5 md:h-3 md:w-3" />} {label}
            </span>
            <p className={cn("text-[11px] md:text-xs leading-tight wrap", bold ? "font-black" : "font-bold text-slate-700")}>{value || '--'}</p>
        </div>
    );
}
