'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isValid } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
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
  TableCell, 
  TableHead, 
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
    Sparkles,
    ArrowRightLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Shipment, Vehicle, WithId, Trip, Carrier, Plant, SubUser, VehicleEntry } from '@/types';
import { VehicleTypes } from '@/lib/constants';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  Timestamp,
  getDoc,
  limit,
  orderBy
} from "firebase/firestore";
import { normalizePlantId, generateRandomTripId, getPlantScopedCarriers, resolvePlantCarrier } from '@/lib/utils';
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
    ownerName: z.string().optional().default(''),
    ownerMobile: z.string().optional().default(''),
    ownerPan: z.string().optional(),
    freightRate: z.coerce.number().optional(),
    freightAmount: z.coerce.number().optional(),
    isRateFixed: z.boolean().default(false),
    lrNumber: z.string().optional(),
    lrDate: z.date().nullable().optional(),
    paymentTerm: z.string().optional(),
    distance: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.vehicleType === 'Market Vehicle') {
        if (!data.transporterName?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required for Market vehicle.', path: ['transporterName'] });
        }
        if (!data.transporterMobile?.trim() || !/^\d{10}$/.test(data.transporterMobile)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid 10-digit mobile required.', path: ['transporterMobile'] });
        }
        if (!data.freightAmount || data.freightAmount <= 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Freight amount is required.', path: ['freightAmount'] });
        }
    }
});

type FormValues = z.infer<typeof formSchema>;

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

export default function VehicleAssignModal({ isOpen, onClose, shipment, trip, onAssignmentComplete, carriers }: VehicleAssignModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const userProfileRef = useMemo(() => (firestore && user?.uid) ? doc(firestore, "users", user.uid) : null, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<SubUser>(userProfileRef);
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: MAPS_JS_KEY,
    libraries: ['places', 'marker']
  });

  const [vehiclesAtGate, setVehiclesAtGate] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [registryMatch, setRegistryMatch] = useState<WithId<Vehicle> | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const isEditing = !!trip;
  const hasCalculatedDistance = useRef(false);

  useEffect(() => {
    if (isOpen) {
        hasCalculatedDistance.current = false;
    } else {
        setRegistryMatch(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const plantNameDisplay = useMemo(() => {
    if (!plants) return shipment.originPlantId;
    return plants.find(p => normalizePlantId(p.id).toLowerCase() === normalizePlantId(shipment.originPlantId).toLowerCase())?.name || shipment.originPlantId;
  }, [plants, shipment.originPlantId]);

  const availableCarriers = useMemo(() => {
    return getPlantScopedCarriers(carriers, shipment.originPlantId, [plantNameDisplay]);
  }, [carriers, shipment.originPlantId, plantNameDisplay]);

  const defaultCarrier = useMemo(() => {
    return resolvePlantCarrier(carriers, shipment.originPlantId, trip?.carrierId || shipment.carrierId, [plantNameDisplay]);
  }, [carriers, shipment.originPlantId, trip?.carrierId, shipment.carrierId, plantNameDisplay]);

  useEffect(() => {
    if (!isOpen || !firestore || !shipment.originPlantId) return;
    
    const fetchRegistryData = async () => {
        setIsDataLoading(true);
        try {
            const targetPlantId = normalizePlantId(shipment.originPlantId);
            const qVeh = query(collection(firestore, 'vehicleEntries'), where('status', '==', 'IN'));
            const vehSnap = await getDocs(qVeh);
            const entries = vehSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as WithId<VehicleEntry>))
                .filter(e => normalizePlantId(e.plantId) === targetPlantId);
            
            const available = entries
                .filter(e => {
                    const status = e.remarks || 'IN';
                    const isCurrentVehicle = isEditing && e.vehicleNumber === trip?.vehicleNumber;
                    return isCurrentVehicle || (e.purpose === 'Loading' && ['Available', 'IN', 'Assigned', 'Under Process'].includes(status));
                })
                .map(e => ({
                    id: e.id,
                    vehicleNumber: e.vehicleNumber,
                    driverName: e.driverName,
                    driverMobile: e.driverMobile || '',
                    masterVehicleId: e.vehicleId,
                    vehicleType: (e as any).vehicleType
                }));

            setVehiclesAtGate(available);

        } catch (error) {
            console.error("Registry Fetch Error:", error);
            toast({ variant: 'destructive', title: "Cloud Sync Error", description: "Failed to fetch gate registry. Please check console." });
        } finally {
            setIsDataLoading(false);
        }
    };
    fetchRegistryData();
  }, [isOpen, firestore, shipment.originPlantId, isEditing, trip?.vehicleNumber, toast]);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      isNewVehicle: false,
      vehicleId: '',
      vehicleNumber: trip?.vehicleNumber || '',
      driverName: trip?.driverName || '',
      driverMobile: trip?.driverMobile || '',
      vehicleType: trip?.vehicleType || 'Own Vehicle',
      carrierId: defaultCarrier?.id || '',
      assignQty: trip?.assignedQtyInTrip ?? Number(Number(shipment.balanceQty).toFixed(3)),
      transporterName: trip?.transporterName || '',
      transporterMobile: (trip as any)?.transporterMobile || '',
      ownerName: (trip as any)?.ownerName || '',
      ownerMobile: (trip as any)?.ownerMobile || '',
      ownerPan: (trip as any)?.ownerPan || '',
      freightRate: trip?.freightRate || 0,
      freightAmount: trip?.freightAmount || 0,
      isRateFixed: trip?.isRateFixed || false,
      lrNumber: trip?.lrNumber || shipment.lrNumber || '',
      lrDate: getSafeDate(trip?.lrDate || shipment.lrDate),
      paymentTerm: trip?.paymentTerm || shipment.paymentTerm || 'Paid',
      distance: trip?.distance || 0
    },
  });

  const { watch, setValue, handleSubmit, control, formState: { isSubmitting } } = form;
  const isNewVehicle = watch('isNewVehicle');
  const vehicleId = watch('vehicleId');
  const vehicleType = watch('vehicleType');
  const assignQty = watch('assignQty');
  const vehicleNumber = watch('vehicleNumber');
  const currentDistance = watch('distance');
  const selectedCarrierId = watch('carrierId');
  const freightRate = watch('freightRate');
  const freightAmount = watch('freightAmount');
  const isRateFixed = watch('isRateFixed');

  useEffect(() => {
    if (vehicleType !== 'Market Vehicle') return;
    if (isRateFixed) return;

    const computedFreight = Number(((Number(freightRate) || 0) * (Number(assignQty) || 0)).toFixed(2));
    setValue('freightAmount', computedFreight, { shouldValidate: false });
  }, [assignQty, freightRate, isRateFixed, setValue, vehicleType]);

  useEffect(() => {
    if (!isOpen) return;

    const nextCarrierId = defaultCarrier?.id || '';
    if (nextCarrierId && selectedCarrierId !== nextCarrierId) {
      setValue('carrierId', nextCarrierId, { shouldValidate: true });
    } else if (!nextCarrierId && selectedCarrierId) {
      setValue('carrierId', '', { shouldValidate: true });
    }
  }, [defaultCarrier?.id, isOpen, selectedCarrierId, setValue]);

  useEffect(() => {
    if (vehicleType === 'Market Vehicle') {
      if (!registryMatch) {
        setValue('driverName', '');
        setValue('driverMobile', '');
      }
    } else if (vehicleType === 'Own Vehicle') {
      if (registryMatch) {
        setValue('driverName', registryMatch.driverName || '');
        setValue('driverMobile', registryMatch.driverMobile || '');
      } else {
        setValue('driverName', '');
        setValue('driverMobile', '');
      }
    }
  }, [vehicleType, registryMatch, setValue]);
  
  useEffect(() => {
    if (!isLoaded || !isOpen || hasCalculatedDistance.current || !shipment.loadingPoint || !shipment.unloadingPoint) return;

    const calculateDistance = async () => {
        setCalculatingDistance(true);
        try {
            const directionsService = new google.maps.DirectionsService();
            directionsService.route({
                origin: shipment.loadingPoint,
                destination: shipment.unloadingPoint,
                travelMode: google.maps.TravelMode.DRIVING,
            }, (response, status) => {
                if (status === 'OK' && response && response.routes.length > 0) {
                    const distKm = (response.routes[0].legs[0].distance?.value || 0) / 1000;
                    setValue('distance', Number(distKm.toFixed(2)));
                    hasCalculatedDistance.current = true;
                } else {
                    toast({ variant: 'destructive', title: "API Error", description: "Google Maps route calculation failed." });
                }
                setCalculatingDistance(false);
            });
        } catch (e) {
            setCalculatingDistance(false);
            toast({ variant: 'destructive', title: "API Error", description: "Could not initialize Google Maps service." });
        }
    };

    calculateDistance();
  }, [isLoaded, isOpen, shipment.loadingPoint, shipment.unloadingPoint, setValue, toast]);

  const balanceQty = useMemo(() => {
    const shipmentBalance = isEditing && trip ? (shipment.balanceQty + trip.assignedQtyInTrip) : shipment.balanceQty;
    const val = Math.max(0, shipmentBalance - (assignQty || 0));
    return Number(val.toFixed(3));
  }, [shipment.balanceQty, assignQty, isEditing, trip]);

  useEffect(() => {
    if (!isOpen) return;

    const handler = setTimeout(async () => {
        if (!firestore || !vehicleNumber || vehicleNumber.length < 6) {
            if (registryMatch) setRegistryMatch(null);
            return;
        }

        try {
            const q = query(collection(firestore, "vehicles"), where("vehicleNumber", "==", vehicleNumber.toUpperCase().replace(/\s/g, '')));
            const snap = await getDocs(q);

            if (!snap.empty) {
                const vData = { id: snap.docs[0].id, ...snap.docs[0].data() } as WithId<Vehicle>;
                
                setRegistryMatch(prevMatch => {
                    if (prevMatch?.id !== vData.id) {
                        toast({ title: 'Registry Link Established', description: `${vData.vehicleNumber} identified in fleet registry.` });
                    }
                    return vData;
                });

                setValue('vehicleType', vData.vehicleType || 'Own Vehicle', { shouldValidate: true });
                if (vData.driverName) setValue('driverName', vData.driverName, { shouldValidate: true });
                if (vData.driverMobile) setValue('driverMobile', vData.driverMobile, { shouldValidate: true });
            } else {
                if (registryMatch) setRegistryMatch(null);
                if (isNewVehicle && !isEditing) {
                    setValue('vehicleType', 'Market Vehicle', { shouldValidate: true });
                }
            }
        } catch(e) {
            toast({ variant: 'destructive', title: 'Cloud Sync Error', description: 'Failed to perform vehicle lookup.' });
        }
    }, 500);

    return () => clearTimeout(handler);
  }, [isOpen, vehicleNumber, firestore, setValue, isNewVehicle, isEditing, toast, registryMatch]);

  useEffect(() => {
    if (!isOpen) return;

    if (!isNewVehicle && vehicleId) {
        const found = vehiclesAtGate.find(v => v.id === vehicleId);
        if (found) {
            setValue('vehicleNumber', found.vehicleNumber, { shouldValidate: true });
            setValue('driverName', found.driverName, { shouldValidate: true });
            setValue('driverMobile', found.driverMobile, { shouldValidate: true });
        }
    }
  }, [isOpen, vehicleId, isNewVehicle, vehiclesAtGate, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;

    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const rawPlantId = shipment.originPlantId;
            const plantId = normalizePlantId(rawPlantId);
            const timestamp = serverTimestamp();
            const isAdminSession = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
            const currentName = isAdminSession ? 'AJAY SOMRA' : (userProfile?.fullName || user.displayName || user.email?.split('@')[0] || 'System Operator');

            const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipment.id);
            const vRef = registryMatch ? doc(firestore, 'vehicles', registryMatch.id) : null;
            const entryRef = (values.vehicleId && !isNewVehicle) ? doc(firestore, 'vehicleEntries', values.vehicleId) : null;

            const [shipmentSnap, vehicleSnap, entrySnap] = await Promise.all([
                transaction.get(shipmentRef),
                vRef ? transaction.get(vRef) : Promise.resolve(null),
                entryRef ? transaction.get(entryRef) : Promise.resolve(null)
            ]);

            if (!shipmentSnap.exists()) throw new Error("Shipment registry error.");
            const currentShipmentData = shipmentSnap.data() as Shipment;
            
            const generatedTripId = generateRandomTripId();

            let finalVehicleId = values.vehicleId;

            if (isNewVehicle && !registryMatch) {
                finalVehicleId = `new-veh-${Date.now()}`;
                const newVehRef = doc(firestore, 'vehicles', finalVehicleId);
                transaction.set(newVehRef, {
                    vehicleNumber: values.vehicleNumber,
                    driverName: values.driverName,
                    driverMobile: values.driverMobile,
                    plantId,
                    vehicleType: values.vehicleType,
                    status: 'Under Process',
                    createdAt: timestamp
                });
            } else if (vRef && vehicleSnap?.exists()) {
                finalVehicleId = registryMatch!.id;
                transaction.update(vRef, { status: 'Under Process' });
            }

            const docId = isEditing ? trip!.id : `trip-${Date.now()}`;
            const tripRef = doc(firestore, `plants/${plantId}/trips`, docId);
            const globalTripRef = doc(firestore, 'trips', docId);
            
            const hasLR = values.lrNumber && values.lrNumber.trim() !== "";

            const tripData: Partial<Trip> = {
                tripId: isEditing ? trip!.tripId : generatedTripId,
                vehicleId: finalVehicleId || null,
                vehicleNumber: values.vehicleNumber,
                driverName: values.driverName || '',
                driverMobile: values.driverMobile || '',
                vehicleType: values.vehicleType,
                carrierId: values.carrierId,
                assignedTripWeight: values.assignQty,
                assignedQtyInTrip: values.assignQty,
                originPlantId: plantId,
                destination: shipment.unloadingPoint || 'N/A',
                shipmentIds: [shipment.id],
                tripStatus: 'Assigned',
                podStatus: 'Missing',
                freightStatus: 'Unpaid',
                vehicleStatus: 'Under Process',
                currentStatusId: 'Assigned',
                startDate: isEditing ? (trip!.startDate as any) : new Date(),
                lastUpdated: timestamp as any,
                userName: currentName,
                userId: user.uid,
                shipToParty: shipment.shipToParty || shipment.billToParty || '',
                unloadingPoint: shipment.unloadingPoint || '',
                lrGenerated: hasLR,
                lrNumber: values.lrNumber || '',
                lrDate: values.lrDate || null,
                paymentTerm: values.paymentTerm,
                transporterName: values.transporterName,
                transporterMobile: values.transporterMobile,
                ownerName: values.ownerName,
                ownerMobile: values.ownerMobile,
                ownerPan: values.ownerPan,
                podReceived: isEditing ? trip!.podReceived : false,
                isFreightPosted: isEditing ? trip!.isFreightPosted : false, // This was missing freight fields
                freightRate: values.freightRate,
                freightAmount: values.freightAmount,
                isRateFixed: values.isRateFixed,
                distance: values.distance || 0,
            };

            if (entryRef && entrySnap?.exists()) {
                transaction.update(entryRef, { 
                    remarks: 'Under Process', 
                    tripId: docId,
                    statusUpdatedAt: timestamp, 
                    statusUpdatedBy: currentName 
                });
            }

            const diff = isEditing ? values.assignQty - trip!.assignedQtyInTrip : values.assignQty;
            const newAssignedTotal = (currentShipmentData.assignedQty || 0) + diff;
            const newBalanceTotal = currentShipmentData.quantity - newAssignedTotal;
            
            transaction.update(shipmentRef, {
                assignedQty: newAssignedTotal,
                balanceQty: newBalanceTotal,
                currentStatusId: newBalanceTotal > 0 ? 'Partly Vehicle Assigned' : 'Assigned',
                lastUpdateDate: timestamp
            });

            if (isEditing) {
                transaction.update(tripRef, tripData);
                transaction.update(globalTripRef, tripData);
            } else {
                transaction.set(tripRef, tripData as Trip);
                transaction.set(globalTripRef, tripData as Trip);
            }
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
        <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-[#f8fafc]">
            <DialogHeader className="bg-slate-900 text-white p-4 shrink-0 flex flex-row items-center justify-between pr-16">
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">SIKKA LMC Allocation Board</DialogTitle>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-blue-400">System Time</p>
                    <p className="text-sm font-black font-mono">{format(currentTime, 'HH:mm:ss')}</p>
                </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
                <section className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm overflow-hidden group">
                    <div className="bg-slate-50 px-8 py-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><ShieldCheck className="h-5 w-5" /></div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Mission Order Context</h3>
                        </div>
                        <Badge className="bg-white border-blue-200 text-blue-700 font-black uppercase text-[10px] px-4 py-1 tracking-widest">
                            ID: {shipment.shipmentId}
                        </Badge>
                    </div>
                    <div className="p-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-10 gap-x-12">
                        {[
                            { label: 'Plant Node', value: plantNameDisplay, icon: Factory },
                            { label: 'Consignor', value: shipment.consignor, icon: UserCircle },
                            { label: 'Lifting Site', value: shipment.loadingPoint, icon: MapPin },
                            { label: 'Consignee', value: shipment.billToParty, icon: UserCircle },
                            { label: 'Ship To', value: shipment.shipToParty, icon: Truck },
                            { label: 'Drop Point', value: shipment.unloadingPoint, icon: MapPin },
                        ].map((item) => (
                            <div key={item.label} className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-3">
                                    <item.icon className="h-3 w-3" /> {item.label}
                                </span>
                                <span className="text-xs font-bold text-slate-800 uppercase leading-tight">{item.value || '--'}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                            <Truck className="h-4 w-4 text-blue-900" /> Allocation Ledger Node
                        </h3>
                        <div className="flex items-center gap-6 bg-white p-3 rounded-2xl border shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Registry Source:</span>
                            <RadioGroup 
                                className="flex gap-8" 
                                value={isNewVehicle ? 'new' : 'existing'} 
                                onValueChange={(val) => {
                                    const isNew = val === 'new';
                                    setValue('isNewVehicle', isNew);
                                    if (isNew) {
                                        setValue('vehicleId', '');
                                        if (!isEditing) {
                                            setValue('vehicleNumber', '');
                                            setValue('driverName', '');
                                            setValue('driverMobile', '');
                                            setValue('vehicleType', 'Market Vehicle');
                                        }
                                    }
                                }}
                            >
                                <div className="flex items-center space-x-2 cursor-pointer group">
                                    <RadioGroupItem value="existing" id="existing" className="border-blue-900 text-blue-900" />
                                    <label htmlFor="existing" className="text-xs font-black uppercase tracking-tight text-slate-600 cursor-pointer group-hover:text-blue-900">Gate IN Registry</label>
                                </div>
                                <div className="flex items-center space-x-2 cursor-pointer group">
                                    <RadioGroupItem value="new" id="new" className="border-blue-900 text-blue-900" />
                                    <label htmlFor="new" className="text-xs font-black uppercase tracking-tight text-slate-600 cursor-pointer group-hover:text-blue-900">Direct Entry</label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    <div className="rounded-[2.5rem] border-2 border-slate-200 bg-white shadow-2xl overflow-hidden relative">
                        <Form {...form}>
                            <form className="space-y-0" onSubmit={handleSubmit(onSubmit)}>
                                <Table>
                                    <TableHeader className="bg-slate-900">
                                        <TableRow className="hover:bg-transparent border-none h-14">
                                            <TableHead className="text-[10px] font-black uppercase text-white px-8">Vehicle Number *</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-white px-4">Pilot Detail *</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-white px-4">Carrier Agent *</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-white px-4 text-right">Registry weight *</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-white px-8">Vehicle Type</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="h-28 hover:bg-transparent border-b">
                                            <TableCell className="px-8 w-[280px]">
                                                {isNewVehicle ? (
                                                    <FormField control={form.control} name="vehicleNumber" render={({ field }) => (
                                                        <FormControl>
                                                            <div className="relative group/input">
                                                                <Input placeholder="XX00XX0000" className="h-12 font-black uppercase border-blue-900/20 focus-visible:ring-blue-900 text-lg tracking-tighter shadow-inner" {...field} />
                                                                {registryMatch && <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Registry Linked" />}
                                                            </div>
                                                        </FormControl>
                                                    )} />
                                                ) : (
                                                    <FormField control={form.control} name="vehicleId" render={({ field }) => (
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger className="h-12 font-black uppercase border-blue-900/20 text-blue-900"><SelectValue placeholder="Sync from Gate" /></SelectTrigger></FormControl>
                                                            <SelectContent className="rounded-xl">
                                                                {vehiclesAtGate.map(v => <SelectItem key={v.id} value={v.id} className="font-black py-2.5">{v.vehicleNumber}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    )} />
                                                )}
                                            </TableCell>
                                            <TableCell className="min-w-[320px] px-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <FormField control={form.control} name="driverName" render={({ field }) => (<Input {...field} placeholder="Pilot Name" className="h-11 text-xs font-bold uppercase" disabled={vehicleType === 'Own Vehicle'} />)} />
                                                    <FormField control={form.control} name="driverMobile" render={({ field }) => (<Input {...field} placeholder="10 Digits" className="h-11 text-xs font-mono font-black text-blue-900" disabled={vehicleType === 'Own Vehicle'} />)} />
                                                </div>
                                            </TableCell>
                                            <TableCell className="min-w-[240px] px-4">
                                                <FormField
                                                    control={control}
                                                    name="carrierId"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-11 font-bold text-xs">
                                                                        <SelectValue placeholder="Pick Carrier" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent className="rounded-xl">
                                                                    {availableCarriers.map(c => <SelectItem key={c.id} value={c.id} className="font-bold py-3">{c.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell className="min-w-[220px] px-4">
                                                <FormField control={form.control} name="assignQty" render={({ field }) => (<Input type="number" step="0.001" {...field} className="h-11 text-right text-base font-black text-blue-900 border-blue-900/20 shadow-inner rounded-xl" />)} />
                                            </TableCell>
                                            <TableCell className="px-8">
                                                <FormField control={form.control} name="vehicleType" render={({ field }) => (
                                                    <Select 
                                                        onValueChange={field.onChange} 
                                                        value={field.value}
                                                        disabled={!!registryMatch} 
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 font-black uppercase text-[10px] relative">
                                                                <SelectValue />
                                                                {!!registryMatch && <Lock className="absolute right-8 top-3 h-3 w-3 text-slate-300" />}
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="rounded-xl">{VehicleTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                )} />
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                                {vehicleType === 'Market Vehicle' && (
                                    <div className="p-8 border-t border-slate-200 animate-in fade-in duration-300">
                                        <div className="flex items-center gap-3 mb-6">
                                            <Sparkles className="h-5 w-5 text-amber-500" />
                                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                                                Market Vehicle Particulars
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <FormField
                                                control={control}
                                                name="transporterName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transporter / Broker Name *</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="Enter name" className="h-11 font-bold" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={control}
                                                name="transporterMobile"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Mobile *</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="10 Digits" className="h-11 font-mono font-bold" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={control}
                                                name="ownerName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle Owner Name</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="Enter Owner's Name" className="h-11 font-bold" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={control}
                                                name="ownerPan"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owner PAN</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="ABCDE1234F" className="h-11 font-mono font-bold uppercase" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={control}
                                                name="freightRate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Freight Rate / MT</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" step="0.01" {...field} value={field.value ?? 0} placeholder="0.00" className="h-11 font-bold text-right" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={control}
                                                name="isRateFixed"
                                                render={({ field }) => (
                                                    <FormItem className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-row items-center justify-between">
                                                        <div className="space-y-1">
                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fixed Amount</FormLabel>
                                                            <p className="text-[10px] font-bold text-slate-500">Enable manual freight entry</p>
                                                        </div>
                                                        <FormControl>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!field.value}
                                                                onChange={(e) => field.onChange(e.target.checked)}
                                                                className="h-4 w-4"
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={control}
                                                name="freightAmount"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Freight *</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                {...field}
                                                                value={field.value ?? 0}
                                                                disabled={!isRateFixed}
                                                                placeholder="0.00"
                                                                className="h-11 font-bold text-right"
                                                            />
                                                        </FormControl>
                                                        {!isRateFixed && (
                                                            <p className="text-[10px] font-bold text-slate-400">Auto = Rate x Registry Weight ({Number(assignQty || 0).toFixed(3)})</p>
                                                        )}
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4 flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Freight Capture Node</p>
                                                <p className="text-[11px] font-bold text-slate-600">This market trip will flow into Freight Process for payment tracking.</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payable Freight</p>
                                                <p className="text-2xl font-black text-emerald-700">₹ {Number(freightAmount || 0).toLocaleString('en-IN')}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </Form>
                    </div>
                </section>

                <section className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1">
                        <Calculator className="h-4 w-4 text-blue-900" /> Intelligence Nodes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <Card className="p-8 border-2 border-blue-100 shadow-xl rounded-[2.5rem] bg-white relative overflow-hidden group/dist">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover/dist:scale-110 transition-transform duration-1000"><MapPin className="h-32 w-32" /></div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><ArrowRightLeft className="h-6 w-6" /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Google Map Distance Node</span>
                            </div>
                            <div className="flex items-end gap-4">
                                <div className="text-5xl font-black tracking-tighter text-blue-900">
                                    {calculatingDistance ? <Loader2 className="h-10 w-10 animate-spin text-blue-400" /> : `${currentDistance || '0.00'}`}
                                </div>
                                <span className="text-xl font-black text-slate-300 mb-1.5 uppercase">KM</span>
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-4 italic">Estimated road distance based on latest routing logic.</p>
                        </Card>
                    </div>
                </section>
            </div>

            <div className="shrink-0 bg-slate-900 text-white p-6 border-t border-white/5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 max-w-[1200px] mx-auto">
                    <div className="flex gap-12 items-center">
                        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 min-w-[220px]">
                            <Calculator className="h-6 w-6 text-blue-400" />
                            <div>
                                <span className="text-[9px] font-black uppercase text-slate-500 block leading-none mb-1">Post Allocation Balance</span>
                                <p className={cn("text-2xl font-black tracking-tighter leading-none", balanceQty > 0.001 ? "text-amber-400" : "text-emerald-400")}>{balanceQty.toFixed(3)} MT</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase text-[11px] tracking-widest px-8">Discard</Button>
                        <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting || calculatingDistance} className="bg-blue-900 hover:bg-slate-900 text-white px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-900/50 border-none transition-all active:scale-95">
                            {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Finalize Allocation (F8)
                        </Button>
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
  );
}
