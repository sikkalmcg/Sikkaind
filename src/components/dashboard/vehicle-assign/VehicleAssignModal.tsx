
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
  limit
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

const vehicleNumberRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;
const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";

const formSchema = z.object({
    isNewVehicle: z.boolean().default(false),
    vehicleId: z.string().optional(),
    vehicleNumber: z.string().min(1, "Vehicle number required.").transform(v => v.toUpperCase().replace(/\s/g, '')).refine(val => vehicleNumberRegex.test(val), {
        message: 'Invalid Format (e.g. MH12AB1234)'
    }),
    driverName: z.string().optional().default(''),
    driverMobile: z.string().min(1, "Driver mobile required.").refine(val => /^\d{10}$/.test(val), {
        message: 'Must be 10 digits.'
    }),
    vehicleType: z.enum(VehicleTypes),
    carrierId: z.string().min(1, 'Carrier required'),
    assignQty: z.coerce.number().positive('Qty must be positive'),
    transporterName: z.string().optional().default(''),
    transporterMobile: z.string().optional().default(''),
    ownerName: z.string().optional().default(''),
    ownerPan: z.string().optional().default(''),
    freightRate: z.coerce.number().min(0).optional().default(0),
    freightAmount: z.coerce.number().optional().default(0),
    distance: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.vehicleType === 'Market Vehicle') {
        if (!data.transporterName?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required for Market.', path: ['transporterName'] });
        if (!data.ownerName?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Owner name required.', path: ['ownerName'] });
        if (!data.freightRate || data.freightRate <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rate required.', path: ['freightRate'] });
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { assignQty: 0, freightRate: 0, freightAmount: 0, vehicleType: 'Own Vehicle' },
  });
  const { watch, setValue, handleSubmit, reset, control, formState: { isSubmitting } } = form;

  useEffect(() => {
    if (isOpen) {
        reset({
            isNewVehicle: false,
            vehicleId: trip?.vehicleId || '',
            vehicleNumber: trip?.vehicleNumber || '',
            driverName: trip?.driverName || '',
            driverMobile: trip?.driverMobile || '',
            vehicleType: (trip?.vehicleType as any) || 'Own Vehicle',
            carrierId: trip?.carrierId || shipment.carrierId || (carriers[0]?.id || ''),
            assignQty: trip?.assignedQtyInTrip ?? Number(shipment.balanceQty.toFixed(3)),
            transporterName: trip?.transporterName || '',
            transporterMobile: (trip as any)?.transporterMobile || '',
            ownerName: trip?.ownerName || '',
            ownerPan: trip?.ownerPan || '',
            freightRate: trip?.freightRate || 0,
            freightAmount: trip?.freightAmount || 0,
            distance: trip?.distance || 0
        });
    }
  }, [isOpen, trip, shipment, reset, carriers]);

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
    return shipment.destination || shipment.unloadingPoint?.split(',')[0].trim() || '--';
  }, [shipment.destination, shipment.unloadingPoint]);

  const { isNewVehicle, vehicleId, assignQty, vehicleNumber, vehicleType, freightRate } = useWatch({ control });

  useEffect(() => {
    setValue('freightAmount', Number(((assignQty || 0) * (freightRate || 0)).toFixed(2)));
  }, [assignQty, freightRate, setValue]);

  useEffect(() => {
    if (!isOpen || !firestore || !shipment.originPlantId) return;
    const fetchGateData = async () => {
        setIsDataLoading(true);
        try {
            const q = query(collection(firestore, 'vehicleEntries'), where('plantId', '==', normalizePlantId(shipment.originPlantId)), where('status', '==', 'IN'));
            const snap = await getDocs(q);
            setVehiclesAtGate(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } finally { setIsDataLoading(false); }
    };
    fetchGateData();
  }, [isOpen, firestore, shipment.originPlantId]);

  const handleVehicleLookup = useCallback(async (vNo: string) => {
    if (!firestore || vNo.length < 6) { setRegistryMatch(null); return; }
    const q = query(collection(firestore, "vehicles"), where("vehicleNumber", "==", vNo), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const v = { id: snap.docs[0].id, ...snap.docs[0].data() } as WithId<Vehicle>;
        setRegistryMatch(v);
        setValue('vehicleType', (v.vehicleType as any) || 'Own Vehicle');
        if (v.driverName) setValue('driverName', v.driverName);
        if (v.driverMobile) setValue('driverMobile', v.driverMobile);
    } else { setRegistryMatch(null); }
  }, [firestore, setValue]);

  useEffect(() => {
    const v = vehicleNumber?.toUpperCase().replace(/\s/g, '');
    if (v && v !== registryMatch?.vehicleNumber) {
        const h = setTimeout(() => handleVehicleLookup(v), 800);
        return () => clearTimeout(h);
    }
  }, [vehicleNumber, registryMatch, handleVehicleLookup]);

  const balanceQty = useMemo(() => {
    const total = isEditing ? (shipment.balanceQty + (trip.assignedQtyInTrip || 0)) : shipment.balanceQty;
    const balance = total - (assignQty || 0);
    return Number(Math.max(0, balance).toFixed(3));
  }, [shipment.balanceQty, assignQty, isEditing, trip]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        await runTransaction(firestore, async (tx) => {
            const plantId = normalizePlantId(shipment.originPlantId);
            const ts = serverTimestamp();
            const currentName = userProfile?.fullName || user.displayName || user.email?.split('@')[0] || 'System';

            const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipment.id);
            const shipSnap = await tx.get(shipmentRef);
            if (!shipSnap.exists()) throw new Error("Registry Error");
            const sData = shipSnap.data() as Shipment;

            const docId = isEditing ? trip!.id : doc(collection(firestore, 'trips')).id;
            const tripRef = doc(firestore, `plants/${plantId}/trips`, docId);
            const globalTripRef = doc(firestore, 'trips', docId);
            
            const tripData: any = {
                tripId: isEditing ? trip!.tripId : generateRandomTripId(),
                vehicleId: registryMatch?.id || null,
                vehicleNumber: values.vehicleNumber, 
                driverName: values.driverName || '', 
                driverMobile: values.driverMobile || '',
                vehicleType: values.vehicleType, 
                carrierId: values.carrierId, 
                assignedQtyInTrip: values.assignQty,
                originPlantId: plantId, 
                destination: shipment.unloadingPoint || 'N/A', 
                shipmentIds: [shipment.id],
                tripStatus: 'Assigned', 
                startDate: isEditing ? trip!.startDate : new Date(),
                lastUpdated: ts, 
                userName: currentName, 
                userId: user.uid, 
                shipToParty: shipment.shipToParty || '',
                freightRate: values.freightRate, 
                freightAmount: values.freightAmount,
                transporterName: values.transporterName,
                ownerName: values.ownerName,
                ownerPan: values.ownerPan,
                distance: values.distance || 0
            };

            const diff = isEditing ? values.assignQty - trip!.assignedQtyInTrip : values.assignQty;
            const newAssignedTotal = (currentShipmentData.assignedQty || 0) + diff;
            
            tx.update(shipmentRef, { 
                assignedQty: newAssignedTotal, 
                balanceQty: sData.quantity - newAssignedTotal, 
                currentStatusId: (sData.quantity - newAssignedTotal) > 0 ? 'Partly Vehicle Assigned' : 'Assigned',
                lastUpdateDate: ts
            });
            
            tx.set(tripRef, tripData);
            tx.set(globalTripRef, tripData);
        });
        toast({ title: 'Success', description: 'Allocation Committed.' });
        onAssignmentComplete();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Registry Error', description: e.message }); }
    finally { hideLoader(); }
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
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Terminal: Assign Fleet</DialogDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-white/5 border-white/10 text-blue-400 font-mono text-sm px-4 py-1">{format(currentTime, 'HH:mm:ss')}</Badge>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          <Card className="p-8 border-none shadow-xl rounded-[2.5rem] bg-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110"><Factory size={160} /></div>
            <div className="flex items-center gap-4 mb-8">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100"><ShieldCheck className="h-5 w-5" /></div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Mission Context Handshake</h3>
                <Badge className="bg-blue-900 text-white font-black text-[10px] px-4 h-6">{shipment.shipmentId}</Badge>
            </div>
            <div className="grid grid-cols-6 gap-x-10 gap-y-8 text-xs relative z-10">
                <div className="flex flex-col gap-1"><span className="font-black text-slate-400 text-[10px] uppercase flex items-center gap-2"><Factory size={12}/>Plant</span><span className="font-bold uppercase">{plantNameDisplay}</span></div>
                <div className="flex flex-col gap-1"><span className="font-black text-slate-400 text-[10px] uppercase flex items-center gap-2"><UserCircle size={12}/>Consignor</span><span className="font-bold uppercase">{shipment.consignor}</span></div>
                <div className="flex flex-col gap-1"><span className="font-black text-slate-400 text-[10px] uppercase flex items-center gap-2"><MapPin size={12}/>Lifting Site</span><span className="font-bold uppercase">{shipment.loadingPoint}</span></div>
                <div className="flex flex-col gap-1"><span className="font-black text-slate-400 text-[10px] uppercase flex items-center gap-2"><UserCircle size={12}/>Consignee</span><span className="font-bold uppercase">{shipment.billToParty}</span></div>
                <div className="flex flex-col gap-1 col-span-2"><span className="font-black text-slate-400 text-[10px] uppercase flex items-center gap-2"><Truck size={12}/>Drop Point (TO)</span><span className="font-bold uppercase text-blue-900">{destinationCityDisplay}</span></div>
            </div>
          </Card>

          <Form {...form}>
            <form className="space-y-10" onSubmit={handleSubmit(onSubmit)}>
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="bg-slate-50 border-b p-8 flex items-center justify-between">
                        <div className="flex items-center gap-4"><div className="p-2 bg-white rounded-lg shadow-sm border"><Truck className="h-5 w-5 text-blue-900"/></div><h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Fleet Allocation Registry</h3></div>
                        <RadioGroup className="flex bg-white p-1.5 rounded-2xl border shadow-inner" value={isNewVehicle ? 'new' : 'existing'} onValueChange={v => setValue('isNewVehicle', v === 'new')}>
                            <div className={cn("flex items-center space-x-2 px-4 py-2 rounded-xl transition-all", !isNewVehicle ? "bg-blue-900 text-white" : "text-slate-400")}><RadioGroupItem value="existing" id="r1" /><label htmlFor="r1" className="font-black text-[10px] uppercase tracking-widest cursor-pointer">From Gate</label></div>
                            <div className={cn("flex items-center space-x-2 px-4 py-2 rounded-xl transition-all", isNewVehicle ? "bg-blue-900 text-white" : "text-slate-400")}><RadioGroupItem value="new" id="r2" /><label htmlFor="r2" className="font-black text-[10px] uppercase tracking-widest cursor-pointer">Direct Entry</label></div>
                        </RadioGroup>
                    </div>
                    <div className="p-10 space-y-10">
                        <Table>
                            <TableHeader><TableRow><TableHead className="w-[250px]">Vehicle No</TableHead><TableHead>Pilot Name</TableHead><TableHead>Mobile</TableHead><TableHead className="w-[250px]">Carrier</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Weight (MT)</TableHead></TableRow></TableHeader>
                            <TableBody><TableRow className="align-top">
                                <TableCell className="py-4">{isNewVehicle ? <FormField control={control} name="vehicleNumber" render={({ field }) => (<Input {...field} placeholder="XX00XX0000" className="h-11 font-black text-blue-900 uppercase" />)} /> : <FormField control={control} name="vehicleId" render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 font-black"><SelectValue placeholder="Pick Vehicle" /></SelectTrigger></FormControl><SelectContent>{isDataLoading ? <div className="p-4"><Loader2 className="animate-spin h-4 w-4 mx-auto"/></div> : vehiclesAtGate.map(v => <SelectItem key={v.id} value={v.id} className="font-black">{v.vehicleNumber}</SelectItem>)}</SelectContent></Select>)} /></TableCell>
                                <TableCell className="py-4"><FormField control={control} name="driverName" render={({ field }) => (<Input {...field} className="h-11 font-bold" />)} /></TableCell>
                                <TableCell className="py-4"><FormField control={control} name="driverMobile" render={({ field }) => (<Input {...field} maxLength={10} className="h-11 font-mono font-black" />)} /></TableCell>
                                <TableCell><FormField control={control} name="carrierId" render={({ field }) => (<SearchableSelect options={carrierOptions} onChange={field.onChange} value={field.value} className="h-11" />)} /></TableCell>
                                <TableCell>
                                    <FormField control={control} name="vehicleType" render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!!registryMatch}>
                                            <FormControl><SelectTrigger className="relative"><SelectValue placeholder="Select Type"/>{!!registryMatch && <Lock size={12} className="absolute right-2 top-1/2 -translate-y-1/2"/>}</SelectTrigger></FormControl>
                                            <SelectContent>{VehicleTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )} />
                                </TableCell>
                                <TableCell className="py-4"><FormField control={control} name="assignQty" render={({ field }) => (<Input type="number" step="0.001" className="h-11 font-black text-right text-blue-900" {...field} />)} /></TableCell>
                            </TableRow></TableBody>
                        </Table>
                        {vehicleType === 'Market Vehicle' && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 p-8 bg-blue-50/30 rounded-[2rem] border border-blue-100 animate-in slide-in-from-top-4">
                                <FormField name="transporterName" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase">Transporter *</FormLabel><Input {...field} className="h-11 bg-white font-bold" /></FormItem>)} />
                                <FormField name="ownerName" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase">Owner *</FormLabel><Input {...field} className="h-11 bg-white font-bold" /></FormItem>)} />
                                <FormField name="ownerPan" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase">Owner PAN</FormLabel><Input {...field} className="h-11 bg-white font-mono uppercase" /></FormItem>)} />
                                <FormField name="freightRate" control={control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-emerald-600">Freight Rate *</FormLabel><div className="relative"><Input type="number" {...field} className="h-11 bg-white font-black text-emerald-700 pl-8" /><IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400" /></div></FormItem>)} />
                            </div>
                        )}
                    </div>
                </Card>
                
                <Card className="p-8 border-none shadow-xl rounded-[2.5rem] bg-white group">
                    <div className="flex items-center gap-10">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Distance Node</span>
                            <div className="flex items-center gap-3">
                                <h4 className="text-5xl font-black text-blue-900 tracking-tighter">
                                    {calculatingDistance ? <Loader2 className="animate-spin" /> : (form.getValues('distance') || '--')}
                                </h4>
                                <span className="text-xl font-black text-slate-300">KM</span>
                            </div>
                        </div>
                        <div className="h-16 w-px bg-slate-100 hidden md:block" />
                        <div className="max-w-md p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                            <AlertCircle className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-slate-500 uppercase leading-normal">Distance node synchronized with Google Maps routing protocol.</p>
                        </div>
                    </div>
                </Card>
            </form>
          </Form>
        </div>

        <DialogFooter className="p-8 bg-slate-900 text-white shrink-0 flex items-center justify-between border-t border-white/5 rounded-b-3xl">
            <div className="flex items-center gap-8">
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Order Balance</span>
                    <div className="flex items-center gap-3">
                        <Calculator size={20} className="text-blue-400"/>
                        <span className={cn("text-3xl font-black tracking-tighter", balanceQty > 0 ? 'text-orange-400' : 'text-emerald-400')}>
                            {balanceQty.toFixed(3)} MT
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex gap-4">
                <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-black text-slate-400 hover:text-white uppercase text-[11px] tracking-widest px-8">Discard</Button>
                <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting || calculatingDistance} className="bg-blue-600 hover:bg-blue-700 text-white px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl border-none transition-all active:scale-95">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Establish mission node
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
