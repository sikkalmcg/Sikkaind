
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useForm, useWatch, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
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
  SelectContent, SelectItem, SelectTrigger, SelectValue 
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
    X,
    IndianRupee,
    Weight,
    Smartphone,
    User,
    Package,
    ClipboardList,
    Lock,
    Sparkles,
    AlertCircle,
    FileText,
    PlusCircle,
    Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { DatePicker } from '@/components/date-picker';
import type { Shipment, Vehicle, WithId, Trip, Carrier, VehicleEntryExit, Plant, SubUser, FuelPump } from '@/types';
import { VehicleTypes, PaymentTerms, LRUnitTypes } from '@/lib/constants';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  limit,
} from "firebase/firestore";
import { normalizePlantId, generateRandomTripId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { useJsApiLoader } from '@react-google-maps/api';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface VehicleAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: WithId<Shipment>[];
  trip?: WithId<Trip> | null;
  onAssignmentComplete: () => void;
  carriers: WithId<Carrier>[];
}

const VEHICLE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;
const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";
const MAP_LIBRARIES: ("places")[] = ['places'];

const itemSchema = z.object({
  invoiceNumber: z.string().optional().or(z.literal('')),
  ewaybillNumber: z.string().optional().or(z.literal('')),
  units: z.coerce.number().min(1, "Units required"),
  unitType: z.string().default('Package'),
  itemDescription: z.string().min(1, "Item desc required"),
  hsnSac: z.string().optional(),
});

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
    carrierName: z.string().optional().default(''),
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
    isFixRate: z.boolean().default(false),
    fixedAmount: z.coerce.number().optional().default(0),
    paymentTerm: z.enum(PaymentTerms).optional().default('Paid'),
    // NEW UNIQUE MANIFEST FIELDS
    lrNumber: z.string().min(1, "Unique LR Number is mandatory per vehicle assignment."),
    lrDate: z.date({ required_error: "LR date is required." }),
    items: z.array(itemSchema).min(1, "Trip manifest requires at least one item."),
}).superRefine((data, ctx) => {
    if (data.vehicleType === 'Market Vehicle') {
        if (!data.transporterName?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required for Market vehicle.', path: ['transporterName'] });
        }
    }
});

type FormValues = z.infer<typeof formSchema>;

export default function VehicleAssignModal({ isOpen, onClose, shipments, trip, onAssignmentComplete, carriers }: VehicleAssignModalProps) {
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

  const totalBalanceQty = useMemo(() => {
    return (shipments || []).reduce((sum, s) => sum + (Number(s.balanceQty) || 0), 0);
  }, [shipments]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        assignQty: Number(totalBalanceQty.toFixed(3)),
        vehicleType: 'Own Vehicle',
        isFixRate: false,
        fixedAmount: 0,
        paymentTerm: 'Paid',
        carrierId: '',
        carrierName: '',
        items: []
    },
  });
  const { watch, setValue, handleSubmit, reset, control, formState: { isSubmitting, errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const { isNewVehicle, vehicleId, assignQty, vehicleType, freightRate, isFixRate, fixedAmount, distance: currentDistance, items: watchedItems } = watch();

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const vendorQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "fuel_pumps")) : null, [firestore]);
  const { data: vendors } = useCollection<FuelPump>(vendorQuery);

  const primaryShipment = shipments?.[0];

  const vendorOptions = useMemo(() => {
    return (vendors || [])
      .map(v => ({ value: v.id, label: v.name }));
  }, [vendors]);

  const carrierOptions = useMemo(() => {
    return (carriers || [])
      .map(c => ({ value: c.id, label: c.name }));
  }, [carriers]);

  const selectedPlant = useMemo(() => {
    if (!plants || !primaryShipment) return null;
    return plants.find(p => normalizePlantId(p.id).toLowerCase() === normalizePlantId(primaryShipment.originPlantId).toLowerCase());
  }, [plants, primaryShipment]);

  const plantNameDisplay = selectedPlant?.name || primaryShipment?.originPlantId;
  const plantAddressDisplay = selectedPlant?.address || primaryShipment?.loadingPoint;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (vehicleType === 'ARRANGE BY PARTY') {
      setValue('carrierId', 'ARRANGE_BY_PARTY', { shouldValidate: true });
      setValue('carrierName', 'ARRANGE BY PARTY', { shouldValidate: true });
    }
  }, [vehicleType, setValue]);

  useEffect(() => {
    if (isOpen && primaryShipment) {
        let cid = trip?.carrierId || primaryShipment.carrierId || '';
        let cname = trip?.carrierName || primaryShipment.carrierName || '';

        if (!cid && carriers.length > 0) {
            const plantCarrier = carriers.find(c => normalizePlantId(c.plantId) === normalizePlantId(primaryShipment.originPlantId));
            if (plantCarrier) {
                cid = plantCarrier.id;
                cname = plantCarrier.name;
            }
        }

        // MISSION UNIQUE NODE: Prepare unique items manifest for this trip
        let initialItems = trip?.items || primaryShipment.items || [];
        if (initialItems.length === 0) {
            initialItems = [{ invoiceNumber: '', ewaybillNumber: '', units: 1, unitType: 'Package', itemDescription: primaryShipment.material || 'GENERAL CARGO' }];
        }

        reset({
            isNewVehicle: false,
            vehicleId: trip?.vehicleId || '',
            vehicleNumber: trip?.vehicleNumber || '',
            driverName: trip?.driverName || '',
            driverMobile: trip?.driverMobile || '',
            vehicleType: (trip?.vehicleType as any) || 'Own Vehicle',
            carrierId: cid,
            carrierName: cname || 'UNASSIGNED',
            assignQty: trip?.assignedQtyInTrip ?? Number(totalBalanceQty.toFixed(3)),
            transporterName: trip?.transporterName || '',
            transporterMobile: (trip as any)?.transporterMobile || '',
            ownerName: trip?.ownerName || '',
            ownerMobile: (trip as any)?.ownerMobile || '',
            distance: trip?.distance || 0,
            freightRate: trip?.freightRate || 0,
            isFixRate: !!trip?.isFixRate,
            fixedAmount: trip?.fixedAmount || 0,
            paymentTerm: (trip?.paymentTerm as any) || primaryShipment.paymentTerm || 'Paid',
            lrNumber: trip?.lrNumber || '',
            lrDate: parseSafeDate(trip?.lrDate || new Date()),
            items: initialItems
        });
    }
  }, [isOpen, trip, primaryShipment, reset, totalBalanceQty, carriers]);

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
    if (!isOpen || !firestore || !primaryShipment?.originPlantId) return;
    const fetchRegistryData = async () => {
        setIsDataLoading(true);
        try {
            const targetPlantId = normalizePlantId(primaryShipment.originPlantId);
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
  }, [isOpen, firestore, primaryShipment?.originPlantId]);

  useEffect(() => {
    if (!isLoaded || !isOpen || !primaryShipment?.loadingPoint || !primaryShipment?.unloadingPoint || isEditing) return;
    const calculate = () => {
      setCalculatingDistance(true);
      const service = new google.maps.DirectionsService();
      service.route({
          origin: primaryShipment.loadingPoint!,
          destination: primaryShipment.unloadingPoint!,
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
  }, [isLoaded, isOpen, primaryShipment?.loadingPoint, primaryShipment?.unloadingPoint, setValue, isEditing]);

  const balanceQty = useMemo(() => {
    const currentPool = isEditing ? (totalBalanceQty + (trip?.assignedQtyInTrip || 0)) : totalBalanceQty;
    const remaining = currentPool - (Number(assignQty) || 0);
    return Number(Math.max(0, remaining).toFixed(3));
  }, [totalBalanceQty, assignQty, isEditing, trip]);

  const handleTransporterSelect = (vendorId: string) => {
    const vendor = vendors?.find(v => v.id === vendorId);
    if (vendor) {
        setValue('transporterName', vendor.name, { shouldValidate: true });
        setValue('transporterMobile', vendor.mobile || '', { shouldValidate: true });
        if (vendor.isFixRate !== undefined) setValue('isFixRate', vendor.isFixRate);
        if (vendor.defaultRate) {
            if (vendor.isFixRate) { setValue('fixedAmount', vendor.defaultRate); setValue('freightRate', 0); }
            else { setValue('freightRate', vendor.defaultRate); setValue('fixedAmount', 0); }
        }
    }
  };

  const totals = useMemo(() => {
    return (watchedItems || []).reduce((acc, item) => ({
        units: acc.units + (Number(item?.units) || 0),
    }), { units: 0 });
  }, [watchedItems]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user || shipments.length === 0) return;
    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const plantId = normalizePlantId(primaryShipment.originPlantId);
            const timestamp = serverTimestamp();
            const currentName = userProfile?.fullName || user.displayName || user.email?.split('@')[0] || 'System Operator';
            const docId = trip?.id || doc(collection(firestore, 'trips')).id;
            const tripId = trip?.tripId || generateRandomTripId();
            
            const shipmentSnapshots = [];
            for (const s of shipments) {
                const sRef = doc(firestore, `plants/${plantId}/shipments`, s.id);
                const sSnap = await transaction.get(sRef);
                if (sSnap.exists()) shipmentSnapshots.push({ ref: sRef, snap: sSnap });
            }

            const shipmentIds: string[] = [];
            for (const item of shipmentSnapshots) {
                const { ref: sRef, snap: sSnap } = item;
                const sData = sSnap.data() as Shipment;
                shipmentIds.push(sSnap.id);
                const shipmentAssignedQty = shipments.length === 1 ? values.assignQty : sData.balanceQty;
                const newTotalAssigned = (sData.assignedQty || 0) + shipmentAssignedQty;
                const newBalance = sData.quantity - newTotalAssigned;

                transaction.update(sRef, {
                    assignedQty: newTotalAssigned,
                    balanceQty: Math.max(0, newBalance),
                    currentStatusId: newBalance > 0.001 ? 'Partly Vehicle Assigned' : 'Assigned',
                    lastUpdateDate: timestamp,
                    // SYNC SHIPMENT Registry: Update latest LR node if this is the only assignment or update
                    lrNumber: values.lrNumber,
                    lrDate: values.lrDate
                });
            }

            const tripData: any = {
                ...values,
                tripId,
                shipmentId: primaryShipment.shipmentId, 
                originPlantId: plantId,
                shipmentIds,
                assignedQtyInTrip: values.assignQty, 
                consignor: primaryShipment.consignor, 
                consignorGtin: primaryShipment.consignorGtin || '',
                billToParty: primaryShipment.billToParty,
                billToGtin: primaryShipment.billToGtin || '',
                shipToParty: primaryShipment.shipToParty || primaryShipment.billToParty, 
                shipToGtin: primaryShipment.shipToGtin || primaryShipment.billToGtin || '',
                loadingPoint: primaryShipment.loadingPoint,
                unloadingPoint: primaryShipment.unloadingPoint, 
                deliveryAddress: primaryShipment.deliveryAddress || primaryShipment.unloadingPoint,
                materialTypeId: primaryShipment.materialTypeId,
                lastUpdated: timestamp,
                userName: currentName,
                userId: user.uid,
                tripStatus: 'Assigned',
                currentStatusId: 'assigned',
                podStatus: 'Missing',
                freightStatus: 'Unpaid'
            };

            transaction.set(doc(firestore, `plants/${plantId}/trips`, docId), tripData);
            transaction.set(doc(firestore, 'trips', docId), tripData);
        });
        toast({ title: 'Mission Established', description: `Registry synced for ${shipments.length} orders with unique LR Node.` });
        onAssignmentComplete();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Registry Error', description: e.message });
    } finally {
        hideLoader();
    }
  };

  const calculatedFreight = isFixRate ? (Number(fixedAmount) || 0) : ((Number(assignQty) || 0) * (Number(freightRate) || 0));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1500px] h-[95vh] flex flex-col p-0 border-none shadow-3xl bg-[#f1f5f9] rounded-[3rem]">
        <DialogHeader className="bg-slate-900 text-white p-6 shrink-0 flex flex-row items-center justify-between pr-12">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3"><Truck className="h-8 w-8" /></div>
            <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none">SIKKA LMC | MISSION ALLOCATION TERMINAL</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-2">Node Registry | Unique LR & Manifest Handler</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-white/5 border-white/10 text-white font-mono h-10 px-6 rounded-xl flex items-center hidden sm:flex">{format(currentTime, 'HH:mm:ss')}</Badge>
            <button onClick={onClose} className="h-10 w-10 bg-white p-0 text-red-600 hover:bg-red-50 transition-all rounded-xl shadow-lg flex items-center justify-center border-none"><X size={24} className="stroke-[3]" /></button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10">
          {/* TOP SECTION: MISSION CONTEXT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <Card className="lg:col-span-8 p-8 border-2 border-slate-100 shadow-xl rounded-[2.5rem] bg-white relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-900" />
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100"><ShieldCheck className="h-7 w-7 text-blue-600" /></div>
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Shipment Context</h3>
                            <p className="text-2xl font-black text-slate-900 uppercase">
                                {shipments.length > 1 ? `CONSOLIDATED MANIFEST (${shipments.length})` : primaryShipment.shipmentId}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-slate-400">Lifting Plant Node</span>
                        <p className="text-sm font-black text-blue-900 uppercase">{plantNameDisplay}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <ContextNode label="Consignor" value={primaryShipment.consignor} icon={UserCircle} />
                    <ContextNode label="From Hub" value={primaryShipment.loadingPoint} icon={MapPin} />
                    <ContextNode label="Consignee" value={primaryShipment.billToParty} icon={UserCircle} />
                    <ContextNode label="Drop Point" value={primaryShipment.unloadingPoint} icon={MapPin} bold />
                    <div className="bg-slate-50 p-3 rounded-2xl border shadow-inner flex flex-col items-center justify-center">
                        <span className="text-[9px] font-black uppercase text-slate-500">Registry Weight</span>
                        <p className="text-2xl font-black text-blue-900 tracking-tighter">{totalBalanceQty.toFixed(3)} MT</p>
                    </div>
                </div>
              </Card>

              <Card className="lg:col-span-4 p-8 bg-blue-900 text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group h-full flex flex-col justify-center">
                <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-1000"><Truck size={140} /></div>
                <div className="relative z-10 space-y-4">
                    <h4 className="text-xl font-black uppercase italic leading-tight">Identity Handshake</h4>
                    <p className="text-[10px] font-bold text-blue-100 leading-relaxed uppercase opacity-80">Every mission allocation establishes a unique document registry. Ensure individual LR and Invoice nodes are finalized for audit compliance.</p>
                    <div className="pt-4 flex justify-between items-end border-t border-white/10">
                        <div>
                            <span className="text-[8px] font-black uppercase text-blue-300 tracking-widest">Active Operator</span>
                            <p className="text-sm font-black uppercase">@{userProfile?.username || 'SYSTEM'}</p>
                        </div>
                        <ShieldCheck className="h-8 w-8 text-emerald-400" />
                    </div>
                </div>
              </Card>
          </div>

          <Form {...form}>
            <form className="space-y-12" onSubmit={handleSubmit(onSubmit)}>
                {/* MISSION FLEET NODE */}
                <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <h3 className="font-black text-xs uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3"><Truck className="h-5 w-5 text-blue-600"/> 1. FLEET ALLOCATION NODE</h3>
                        <div className="bg-white p-1 rounded-xl border-2 border-slate-200 shadow-inner flex items-center gap-1">
                            <button type="button" onClick={() => setValue('isNewVehicle', false)} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", !isNewVehicle ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600")}>At Gate Registry</button>
                            <button type="button" onClick={() => setValue('isNewVehicle', true)} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", isNewVehicle ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600")}>Direct Manual Entry</button>
                        </div>
                    </div>
                    <div className="p-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Vehicle Number *</label>
                                {isNewVehicle ? (
                                    <FormField name="vehicleNumber" control={control} render={({field}) => <FormItem><FormControl><Input placeholder="XX00XX0000" className="h-12 rounded-xl font-black text-blue-900 uppercase text-lg shadow-inner" {...field} /></FormControl><FormMessage /></FormItem>} />
                                ) : (
                                    <FormField name="vehicleId" control={control} render={({field}) => (
                                        <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-12 rounded-xl font-black text-blue-900"><SelectValue placeholder={isDataLoading ? "Syncing Gate..." : "Resolve from Gate"} /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">{vehiclesAtGate.map(v => <SelectItem key={v.id} value={v.id} className="font-bold py-3 uppercase italic text-black">{v.vehicleNumber} ({v.driverName})</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>
                            <FormField name="vehicleType" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 px-1">Fleet Category *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-xl">{VehicleTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2.5">{t}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField name="assignQty" control={control} render={({field}) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 px-1">Assign Quantity (MT) *</FormLabel><FormControl><Input {...field} value={field.value ?? ''} type="number" step="0.001" className="h-12 rounded-xl text-right font-black text-xl text-blue-900 shadow-inner" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField name="carrierId" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-900 px-1">Carrier Agent *</FormLabel><SearchableSelect options={carrierOptions} onChange={field.onChange} value={field.value} className="h-12" disabled={carrierOptions.length === 0 || vehicleType === 'ARRANGE BY PARTY'} /><FormMessage /></FormItem>
                            )} />
                            <FormField name="driverName" control={control} render={({field}) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 px-1">Pilot Name</FormLabel><FormControl><Input placeholder="Full Name" className="h-11 rounded-xl font-bold uppercase" {...field} /></FormControl></FormItem>
                            )} />
                            <FormField name="driverMobile" control={control} render={({field}) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 px-1">Pilot Mobile</FormLabel><FormControl><Input {...field} maxLength={10} placeholder="10 Digits" className="h-11 rounded-xl font-mono font-black" /></FormControl></FormItem>
                            )} />
                             <FormField name="paymentTerm" control={control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 px-1">Mission Payment Term</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-11 rounded-xl font-bold border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{PaymentTerms.map(t => <SelectItem key={t} value={t} className="font-bold py-2.5 uppercase">{t.toUpperCase()}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                    </div>
                </Card>

                {/* UNIQUE MANIFEST NODE */}
                <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                    <div className="p-6 bg-blue-900 text-white border-b flex items-center justify-between">
                        <h3 className="font-black text-xs uppercase tracking-[0.3em] flex items-center gap-3"><FileText className="h-5 w-5 text-blue-300"/> 2. MISSION MANIFEST REGISTRY (LR & INVOICE)</h3>
                        <Badge variant="outline" className="bg-white/10 border-white/20 text-white font-black uppercase text-[10px] px-6 h-8 border-none">Unique Node Per Vehicle</Badge>
                    </div>
                    <div className="p-10 space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <FormField name="lrNumber" control={control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-blue-900 tracking-widest px-1">UNIQUE LR NUMBER *</FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-600" />
                                            <Input placeholder="ENTER LR#" {...field} className="pl-12 h-14 rounded-2xl font-black text-blue-900 text-xl uppercase shadow-inner border-blue-900/20" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="lrDate" control={control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">LR REGISTRATION DATE *</FormLabel>
                                    <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-14 rounded-2xl" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <Separator className="opacity-50" />

                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Calculator className="h-4 w-4" /> Item & Invoice Ledger</h4>
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ invoiceNumber: '', ewaybillNumber: '', units: 1, unitType: 'Package', itemDescription: primaryShipment.material || 'GENERAL CARGO' })} className="h-9 px-6 gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 bg-white rounded-xl shadow-sm"><PlusCircle size={14} /> Add Manifest Row</Button>
                            </div>
                            <div className="rounded-[2.5rem] border-2 border-slate-100 bg-slate-50/30 overflow-hidden shadow-inner">
                                <Table>
                                    <TableHeader className="bg-slate-900">
                                        <TableRow className="hover:bg-transparent border-none h-12">
                                            <TableHead className="text-white text-[9px] font-black uppercase px-8 w-48">INVOICE NUMBER</TableHead>
                                            <TableHead className="text-white text-[9px] font-black uppercase px-4 w-48">E-WAYBILL NO.</TableHead>
                                            <TableHead className="text-white text-[9px] font-black uppercase px-4">ITEM DESCRIPTION *</TableHead>
                                            <TableHead className="text-white text-[9px] font-black uppercase px-4 text-center w-56">UNITS / UOM</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => (
                                            <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-none hover:bg-blue-50/10 transition-colors group">
                                                <TableCell className="px-8"><Input {...form.register(`items.${index}.invoiceNumber`)} className="h-10 rounded-xl font-black uppercase bg-white border-slate-200" /></TableCell>
                                                <TableCell className="px-4"><Input {...form.register(`items.${index}.ewaybillNumber`)} className="h-10 rounded-xl font-mono text-blue-600 bg-white border-slate-200 uppercase" /></TableCell>
                                                <TableCell className="px-4"><Input {...form.register(`items.${index}.itemDescription`)} className="h-10 rounded-xl font-bold bg-white border-slate-200 uppercase" /></TableCell>
                                                <TableCell className="px-4">
                                                    <div className="flex items-center gap-2">
                                                        <Input type="number" {...form.register(`items.${index}.units`)} className="h-10 w-20 text-center font-black text-blue-900 bg-white border-slate-200 rounded-lg shadow-inner" />
                                                        <Controller name={`items.${index}.unitType`} control={control} render={({ field }) => (
                                                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10 flex-1 min-w-[120px] rounded-lg border-slate-200 bg-white font-black text-[10px] uppercase shadow-sm"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-xl">{LRUnitTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2 uppercase text-[10px]">{t}</SelectItem>)}</SelectContent></Select>
                                                        )}/>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="pr-6 text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-red-400 hover:text-red-600 rounded-lg"><Trash2 size={18}/></Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter className="bg-slate-100 border-t-2 border-slate-200 h-14">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell colSpan={3} className="px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">TOTAL MANIFEST REGISTRY</TableCell>
                                            <TableCell className="text-center font-black text-lg text-blue-900">{totals.units} Units</TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* FINANCIAL & ROUTE NODE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <Card className={cn("p-10 transition-all duration-500 rounded-[3rem] shadow-xl", (vehicleType === 'Market Vehicle' || vehicleType === 'Contract Vehicle') ? "bg-blue-50/30 border-2 border-blue-100" : "opacity-40 grayscale pointer-events-none")}>
                        <div className="flex items-center gap-3 mb-8 px-2"><IndianRupee className="h-5 w-5 text-blue-600" /><h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Financial Particulars (Settlement Node)</h3></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Transporter Identity *</label>
                                <SearchableSelect options={vendorOptions} onChange={(vId) => handleTransporterSelect(vId)} value={vendors?.find(v => v.name === watch('transporterName'))?.id || ''} placeholder="Resolve Transporter" className="h-12" disabled={vehicleType === 'ARRANGE BY PARTY'} />
                            </div>
                            <FormField name="transporterMobile" control={control} render={({field}) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Transporter Mobile</FormLabel><FormControl><Input {...field} maxLength={10} className="h-12 rounded-xl bg-white border-slate-200 font-mono pl-6" disabled={vehicleType === 'ARRANGE BY PARTY'} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField name="isFixRate" control={control} render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4 border rounded-xl bg-white shadow-sm md:col-span-2">
                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-6 w-6 rounded-lg data-[state=checked]:bg-blue-900 shadow-md" /></FormControl>
                                    <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest cursor-pointer">Fixed Mission Rate Node</FormLabel>
                                </FormItem>
                            )} />
                            <FormField name="freightRate" control={control} render={({field}) => (
                                <FormItem><FormLabel className={cn("text-[10px] font-black uppercase", isFixRate ? "text-slate-300" : "text-blue-600")}>Freight Rate (MT) *</FormLabel><FormControl><Input type="number" step="0.01" {...field} disabled={isFixRate} className="h-12 rounded-xl bg-white font-black text-blue-900 text-lg shadow-inner" /></FormControl></FormItem>
                            )} />
                            <FormField name="fixedAmount" control={control} render={({field}) => (
                                <FormItem><FormLabel className={cn("text-[10px] font-black uppercase", !isFixRate ? "text-slate-300" : "text-emerald-600")}>Fixed Total *</FormLabel><FormControl><Input type="number" step="0.01" {...field} disabled={!isFixRate} className="h-12 rounded-xl bg-white font-black text-emerald-900 text-lg shadow-inner" /></FormControl></FormItem>
                            )} />
                            <div className="flex flex-col gap-1.5 md:col-span-2">
                                <span className="text-[10px] font-black uppercase text-slate-400">Total Calculated Freight</span>
                                <div className="h-14 px-6 flex items-center bg-blue-900 rounded-xl text-white font-black text-2xl shadow-xl">₹ {calculatedFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-10 rounded-[3rem] bg-white border-2 border-slate-100 shadow-xl flex flex-col justify-center gap-10 relative overflow-hidden group">
                        <div className="space-y-4">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 leading-none"><MapPin className="h-4 w-4 text-blue-600" /> Routing Distance Node</span>
                            <div className="flex items-center gap-4">
                                <h4 className="text-6xl font-black text-blue-900 tracking-tighter">{calculatingDistance ? <Loader2 className="h-12 w-12 animate-spin" /> : (currentDistance || '--')}</h4>
                                <span className="text-2xl font-black text-slate-200 uppercase">Kilometers</span>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-start gap-4">
                            <AlertCircle className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed">Route synchronized with satellite registry protocol. Distance used for mileage & detention logic.</p>
                        </div>
                    </Card>
                </div>

                <div className="flex flex-col md:flex-row justify-end pt-10 border-t border-white/5 gap-6">
                    <button type="button" onClick={onClose} className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-red-600 transition-all py-2 px-6">ABORT ALLOCATION</button>
                    <Button type="submit" disabled={isSubmitting || calculatingDistance} className="h-16 px-20 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95 border-none p-0 flex items-center justify-center min-w-[350px]">
                        {isSubmitting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />} 
                        {isEditing ? 'UPDATE MISSION HANDBOOK' : 'ESTABLISH MISSION NODE'}
                    </Button>
                </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="p-8 bg-slate-900 flex flex-col md:flex-row justify-between items-center shrink-0 gap-8">
            <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 leading-none"><Calculator className="h-3 w-3" /> Balance remaining</span>
                <span className={cn("text-3xl font-black tracking-tighter transition-all duration-500 leading-none", balanceQty > 0.001 ? "text-orange-400" : "text-emerald-400")}>
                    {balanceQty.toFixed(3)} MT
                </span>
            </div>
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Authorized Registry Handshake Node</span>
                </div>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContextNode({ label, value, icon: Icon, className, bold }: any) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest leading-none">
                {Icon && <Icon className="h-3 w-3" />} {label}
            </span>
            <p className={cn("text-xs leading-tight font-bold uppercase", bold ? "font-black text-slate-900" : "text-slate-700")}>{value || '--'}</p>
        </div>
    );
}

