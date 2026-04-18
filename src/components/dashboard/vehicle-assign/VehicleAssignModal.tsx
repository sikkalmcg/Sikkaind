
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
    Smartphone,
    User,
    Package,
    ClipboardList,
    Lock,
    Sparkles
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { Shipment, Vehicle, WithId, Trip, Carrier, VehicleEntryExit, Plant, SubUser, FuelPump } from '@/types';
import { VehicleTypes, PaymentTerms } from '@/lib/constants';
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
  
  const [vehiclesAtGate, setVehiclesAtGate] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
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
        carrierName: ''
    },
  });
  const { watch, setValue, handleSubmit, reset, control, formState: { isSubmitting } } = form;

  const { isNewVehicle, vehicleId, assignQty, vehicleType, freightRate, isFixRate, fixedAmount } = watch();

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: plants } = useCollection<Plant>(plantsQuery);

  const vendorQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "fuel_pumps")) : null, [firestore]);
  const { data: vendors } = useCollection<FuelPump>(vendorQuery);

  const primaryShipment = shipments?.[0];

  const vendorOptions = useMemo(() => {
    return (vendors || [])
      .map(v => ({ value: v.id, label: v.name }));
  }, [vendors]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isOpen && primaryShipment) {
        // REGISTRY HANDSHAKE: Resolve Carrier from Shipment manifest (Immutable Node)
        let carrierId = trip?.carrierId || primaryShipment.carrierId || '';
        let carrierName = trip?.carrierName || primaryShipment.carrierName || '';

        // Registry Resolution Handshake: Resolve missing carrier from plant identity for specific nodes
        if (!carrierName && primaryShipment.originPlantId) {
            const pId = normalizePlantId(primaryShipment.originPlantId);
            if (pId === '1426' || pId === 'ID20') {
                carrierId = 'ID20';
                carrierName = 'SIKKA LMC';
            } else if (pId === '1214' || pId === 'ID23') {
                carrierId = 'ID21';
                carrierName = 'SIKKA LMC';
            }
        }

        reset({
            isNewVehicle: false,
            vehicleId: trip?.vehicleId || '',
            vehicleNumber: trip?.vehicleNumber || '',
            driverName: trip?.driverName || '',
            driverMobile: trip?.driverMobile || '',
            vehicleType: (trip?.vehicleType as any) || 'Own Vehicle',
            carrierId: carrierId,
            carrierName: carrierName || 'UNASSIGNED',
            assignQty: trip?.assignedQtyInTrip ?? Number(totalBalanceQty.toFixed(3)),
            transporterName: trip?.transporterName || '',
            transporterMobile: (trip as any)?.transporterMobile || '',
            ownerName: trip?.ownerName || '',
            ownerMobile: (trip as any)?.ownerMobile || '',
            distance: trip?.distance || 0,
            freightRate: trip?.freightRate || 0,
            isFixRate: trip?.isFixRate || false,
            fixedAmount: trip?.fixedAmount || 0,
            paymentTerm: (trip?.paymentTerm as any) || primaryShipment.paymentTerm || 'Paid'
        });
    }
  }, [isOpen, trip, primaryShipment, reset, totalBalanceQty]);

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
        
        if (vendor.isFixRate !== undefined) {
            setValue('isFixRate', vendor.isFixRate);
        }
        
        if (vendor.defaultRate) {
            if (vendor.isFixRate) {
                setValue('fixedAmount', vendor.defaultRate);
                setValue('freightRate', 0);
            } else {
                setValue('freightRate', vendor.defaultRate);
                setValue('fixedAmount', 0);
            }
        }
    }
  };

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
            
            let aggregateItems: any[] = [];
            const shipmentIds: string[] = [];

            for (const s of shipments) {
                const sRef = doc(firestore, `plants/${plantId}/shipments`, s.id);
                const sSnap = await transaction.get(sRef);
                if (!sSnap.exists()) continue;
                
                const sData = sSnap.data() as Shipment;
                shipmentIds.push(s.id);
                aggregateItems = [...aggregateItems, ...(sData.items || [])];

                const sAssigned = sData.assignedQty + sData.balanceQty;
                transaction.update(sRef, {
                    assignedQty: sAssigned,
                    balanceQty: 0,
                    currentStatusId: 'Assigned',
                    lastUpdateDate: timestamp
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
                billToParty: primaryShipment.billToParty,
                shipToParty: primaryShipment.shipToParty || primaryShipment.billToParty, 
                loadingPoint: primaryShipment.loadingPoint,
                unloadingPoint: primaryShipment.unloadingPoint, 
                deliveryAddress: primaryShipment.deliveryAddress || primaryShipment.unloadingPoint,
                materialTypeId: primaryShipment.materialTypeId,
                items: aggregateItems,
                lrNumber: primaryShipment.lrNumber || '', 
                lrDate: primaryShipment.lrDate || null,   
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
        toast({ title: 'Mission Established', description: `Registry synced for ${shipments.length} orders.` });
        onAssignmentComplete();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Registry Error', description: e.message });
    } finally {
        hideLoader();
    }
  };

  const calculatedFreight = isFixRate ? (Number(fixedAmount) || 0) : ((Number(assignQty) || 0) * (Number(freightRate) || 0));

  if (!primaryShipment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-2xl bg-slate-50 rounded-[2rem] md:rounded-[3rem]">
        <DialogHeader className="bg-slate-900 text-white p-4 md:p-6 shrink-0 flex flex-row items-center justify-between pr-10 md:pr-12">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-blue-600 rounded-xl shadow-lg rotate-3"><Truck className="h-5 w-5 md:h-7 md:w-7 text-white" /></div>
            <div>
                <DialogTitle className="text-lg md:text-2xl font-black uppercase tracking-tight italic leading-none text-white">SIKKA LMC | ALLOCATION BOARD</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[8px] md:text-[9px] tracking-widest mt-1 md:mt-2">Registry Terminal Node | {shipments.length > 1 ? 'BULK CONSOLIDATION' : 'SINGLE MISSION'}</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-white/5 border-white/10 text-white font-mono h-8 md:h-10 px-4 md:px-6 rounded-xl flex items-center hidden sm:flex">{format(currentTime, 'HH:mm:ss')}</Badge>
            <button onClick={onClose} className="h-8 w-8 md:h-10 md:w-10 bg-white p-0 text-red-600 hover:bg-red-50 transition-all rounded-xl shadow-lg flex items-center justify-center border-none">
                <X size={20} className="stroke-[3]" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 md:space-y-12">
          <Card className="p-6 md:p-10 border-2 border-slate-100 shadow-xl rounded-[2.5rem] bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-900" />
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm"><ShieldCheck className="h-7 w-7 text-blue-600" /></div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 leading-none">Mission Summary</h3>
                        <p className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase mt-2">
                            {shipments.length > 1 ? `CONSOLIDATED MANIFEST (${shipments.length})` : primaryShipment.shipmentId}
                        </p>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end bg-slate-50 p-4 rounded-2xl border shadow-inner">
                    <span className="text-[10px] font-black uppercase text-slate-500">Aggregate Registry Weight</span>
                    <p className="text-2xl md:text-4xl font-black text-blue-900 tracking-tighter">{totalBalanceQty.toFixed(3)} <span className="text-sm font-bold text-slate-400 ml-1">MT</span></p>
                </div>
            </div>

            <Separator className="my-8 opacity-50" />

            <div className="space-y-8">
                <h3 className="text-[11px] font-black uppercase text-blue-900 tracking-[0.3em] flex items-center gap-3">
                    <Package className="h-4 w-4" /> Order Registry Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {shipments.map((s) => {
                        const sPlant = plants?.find(p => p.id === s.originPlantId || normalizePlantId(p.id).toLowerCase() === normalizePlantId(s.originPlantId).toLowerCase());
                        const sPlantName = sPlant?.name || s.originPlantId;
                        const sPlantAddr = sPlant?.address || s.loadingPoint;
                        
                        return (
                            <Card key={s.id} className="border border-slate-100 bg-slate-50/50 rounded-[2rem] p-6 hover:border-blue-200 transition-all shadow-sm hover:shadow-lg relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-[0.03] rotate-12 transition-transform duration-700 group-hover:scale-110">
                                    <ClipboardList size={120} />
                                </div>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <Badge className="bg-blue-900 text-white font-black uppercase text-[10px] px-3 h-6 border-none shadow-md">{s.shipmentId}</Badge>
                                    </div>
                                    <Badge variant="outline" className="bg-white border-blue-200 text-blue-900 font-black uppercase text-[10px] px-3 h-6">
                                        {s.balanceQty.toFixed(3)} MT
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-y-6 gap-x-4 relative z-10">
                                    <ContextNode label="Lifting Plant" value={sPlantName} icon={Factory} />
                                    <ContextNode label="Consignor" value={s.consignor} icon={UserCircle} />
                                    <ContextNode label="Site Point" value={sPlantAddr} icon={MapPin} className="col-span-2" />
                                    <ContextNode label="Consignee" value={s.billToParty} icon={UserCircle} />
                                    <ContextNode label="Drop Plant" value={s.deliveryAddress || s.unloadingPoint} icon={MapPin} bold className="text-blue-900" />
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
          </Card>

          <Form {...form}>
            <form className="space-y-10" onSubmit={handleSubmit(onSubmit)}>
                <Card className="border-none shadow-2xl rounded-[2rem] md:rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="p-6 md:p-8 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <h3 className="font-black text-xs uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3"><Truck className="h-5 w-5 text-blue-600"/> Fleet Entry Control</h3>
                        <div className="bg-white p-1 rounded-xl border-2 border-slate-200 shadow-inner flex items-center gap-1">
                            <button type="button" onClick={() => setValue('isNewVehicle', false)} className={cn("px-4 md:px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", !isNewVehicle ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600")}>At Gate Registry</button>
                            <button type="button" onClick={() => setValue('isNewVehicle', true)} className={cn("px-4 md:px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", isNewVehicle ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600")}>Direct Manual Entry</button>
                        </div>
                    </div>
                    <div className="p-8 md:p-10 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Vehicle Number *</label>
                                {isNewVehicle ? (
                                    <FormField name="vehicleNumber" control={control} render={({field}) => <FormItem><FormControl><div className="relative"><Input placeholder="XX00XX0000" className="h-12 rounded-xl font-black text-blue-900 uppercase text-lg shadow-inner border-slate-200 focus-visible:ring-blue-900" {...field} /></div></FormControl><FormMessage /></FormItem>} />
                                ) : (
                                    <FormField name="vehicleId" control={control} render={({field}) => (
                                        <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-12 rounded-xl font-black text-blue-900 shadow-sm border-slate-200"><SelectValue placeholder={isDataLoading ? "Syncing Gate..." : "Resolve from Gate"} /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">{vehiclesAtGate.map(v => <SelectItem key={v.id} value={v.id} className="font-bold py-3 uppercase italic text-black">{v.vehicleNumber} ({v.driverName})</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Pilot Name</label>
                                <FormField name="driverName" control={control} render={({field}) => <FormItem><FormControl><Input placeholder="Pilot Name" className="h-12 rounded-xl font-bold uppercase border-slate-200" {...field} /></FormControl><FormMessage /></FormItem>} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Pilot Mobile</label>
                                <FormField name="driverMobile" control={control} render={({field}) => <FormItem><FormControl><Input {...field} maxLength={10} placeholder="10 Digits" className="h-12 rounded-xl font-mono font-bold border-slate-200" /></FormControl><FormMessage /></FormItem>} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-blue-900 tracking-widest px-1 flex items-center gap-2">
                                    <ShieldCheck className="h-3.5 w-3.5" /> Carrier Agent (Lifting Node Locked)
                                </label>
                                <FormField name="carrierName" control={control} render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <div className="relative group">
                                                <Input 
                                                    readOnly 
                                                    {...field} 
                                                    className="h-12 rounded-xl font-black uppercase text-blue-900 bg-slate-100 border-none shadow-inner pl-10" 
                                                />
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Fleet Type *</label>
                                <FormField name="vehicleType" control={control} render={({ field }) => (
                                    <FormItem>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl font-bold border-slate-200"><SelectValue placeholder="Select Type"/></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">{VehicleTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2.5">{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Assign Qty (MT) *</label>
                                <FormField name="assignQty" control={control} render={({field}) => (
                                    <FormItem>
                                    <FormControl><Input {...field} value={field.value ?? ''} type="number" step="0.001" className="h-12 rounded-xl text-right font-black text-xl text-blue-900 shadow-inner border-blue-900/20" /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-10">
                    <Card className={cn("p-8 md:p-10 transition-all duration-500 rounded-[2.5rem] shadow-xl", vehicleType === 'Market Vehicle' ? "bg-blue-50/30 border-2 border-blue-100 opacity-100" : "opacity-40 grayscale pointer-events-none border-slate-100")}>
                        <div className="flex items-center gap-3 mb-8 px-2">
                            <IndianRupee className="h-5 w-5 text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Financial Particulars (Market Node)</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                            <FormField name="transporterName" control={control} render={({field}) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Transporter Name *</FormLabel>
                                    <SearchableSelect 
                                        options={vendorOptions} 
                                        onChange={(vId) => handleTransporterSelect(vId)} 
                                        value={vendors?.find(v => v.name === field.value)?.id || ''} 
                                        placeholder="Resolve from Registry"
                                        className="h-12"
                                    />
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <FormField name="transporterMobile" control={control} render={({field}) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Transporter Mobile</FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                            <Input placeholder="Registry Linked" {...field} maxLength={10} className="h-12 rounded-xl bg-white border-slate-200 font-mono pl-10" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="isFixRate" control={control} render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4 border rounded-xl bg-white shadow-sm col-span-1 md:col-span-2">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-6 w-6 rounded-lg data-[state=checked]:bg-blue-900 shadow-md" />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest cursor-pointer">Fixed Rate Mission</FormLabel>
                                    </div>
                                </FormItem>
                            )} />

                            <FormField name="ownerName" control={control} render={({field}) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Vehicle Owner Name</FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                            <Input placeholder="Enter owner name" {...field} className="h-12 rounded-xl bg-white border-slate-200 font-bold pl-10 uppercase" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="ownerMobile" control={control} render={({field}) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">Owner Mobile Number</FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                            <Input placeholder="Optional" {...field} maxLength={10} className="h-12 rounded-xl bg-white border-slate-200 font-mono pl-10" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="freightRate" control={control} render={({field}) => (
                                <FormItem>
                                    <FormLabel className={cn("text-[10px] font-black uppercase", isFixRate ? "text-slate-300" : "text-blue-600")}>Freight Rate (MT) *</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} disabled={isFixRate} className="h-12 rounded-xl bg-white border-blue-200 font-black text-blue-900 text-lg shadow-inner disabled:bg-slate-50 disabled:text-slate-300" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="fixedAmount" control={control} render={({field}) => (
                                <FormItem>
                                    <FormLabel className={cn("text-[10px] font-black uppercase", !isFixRate ? "text-slate-300" : "text-emerald-600")}>Fixed Total Amount *</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} disabled={!isFixRate} className="h-12 rounded-xl bg-white border-emerald-200 font-black text-emerald-900 text-lg shadow-inner disabled:bg-slate-50 disabled:text-slate-300" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <div className="flex flex-col gap-1.5 md:col-span-2">
                                <span className="text-[10px] font-black uppercase text-slate-400">
                                    {isFixRate ? 'Fixed Mission Total' : 'Calculated Freight'}
                                </span>
                                <div className="h-14 px-6 flex items-center bg-blue-900 rounded-xl text-white font-black text-2xl shadow-xl">
                                    {isFixRate ? 'FIX RATE: ' : ''}₹ {calculatedFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="flex flex-col md:flex-row justify-end pt-10 border-t border-white/5 gap-6">
                    <button type="button" onClick={onClose} className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-blue-900 transition-all py-2">ABORT ALLOCATION</button>
                    <Button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="h-16 px-16 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95 border-none p-0 flex items-center justify-center"
                    >
                        {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />} {isEditing ? 'Update Registry' : 'Establish Mission Node'}
                    </Button>
                </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="p-4 md:p-6 bg-slate-900 flex flex-col md:flex-row justify-between items-center shrink-0 gap-4 md:gap-8">
            <div className="flex items-center gap-6">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5 md:gap-2 leading-none"><Calculator className="h-3 md:h-3.5 w-3 md:h-3.5" /> Balance remaining</span>
                    <span className={cn("text-xl md:text-2xl font-black tracking-tighter transition-all duration-500 leading-none", balanceQty > 0.001 ? "text-orange-400" : "text-emerald-400")}>
                        {balanceQty.toFixed(3)} MT
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest italic hidden sm:inline">Authorized Registry Handshake Node</span>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContextNode({ label, value, icon: Icon, className, bold }: any) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest leading-none">
                {Icon && <Icon className="h-2.5 w-2.5 md:h-3 md:w-3" />} {label}
            </span>
            <p className={cn("text-xs leading-tight wrap", bold ? "font-black" : "font-bold text-slate-700")}>{value || '--'}</p>
        </div>
    );
}
