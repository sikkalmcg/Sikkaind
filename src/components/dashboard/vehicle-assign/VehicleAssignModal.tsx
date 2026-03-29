
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
    AlertCircle,
    X,
    IndianRupee,
    TrendingUp,
    Weight
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

const formSchema = z.object({
    isNewVehicle: z.boolean().default(false),
    vehicleId: z.string().optional(),
    vehicleNumber: z.string().min(1, "Vehicle number is mandatory.").transform(v => v.toUpperCase().replace(/\s/g, '')).refine(val => VEHICLE_REGEX.test(val), {
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
    distance: z.coerce.number().optional().default(0),
    freightRate: z.coerce.number().optional().default(0),
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

export default function VehicleAssignModal({ isOpen, onClose, shipment, trip, onAssignmentComplete, carriers }: VehicleAssignModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const userProfileRef = useMemo(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<SubUser>(userProfileRef);
  
  const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: MAPS_JS_KEY, libraries: ['places'] });

  const [vehiclesAtGate, setVehiclesAtGate] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const isEditing = !!trip;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { assignQty: Number(shipment.balanceQty || 0) },
  });
  const { watch, setValue, handleSubmit, reset, control, formState: { isSubmitting, errors } } = form;

  const { isNewVehicle, vehicleId, assignQty, vehicleNumber, vehicleType, freightRate, distance: currentDistance } = useWatch({ control });

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

  useEffect(() => {
    if (isOpen) {
        const safeBalance = shipment.balanceQty !== undefined ? Number(Number(shipment.balanceQty).toFixed(3)) : 0;
        const defaultValues = {
            isNewVehicle: false,
            vehicleId: trip?.vehicleId || '',
            vehicleNumber: trip?.vehicleNumber || '',
            driverName: trip?.driverName || '',
            driverMobile: trip?.driverMobile || '',
            vehicleType: trip?.vehicleType || 'Own Vehicle',
            carrierId: trip?.carrierId || shipment.carrierId || (carriers.length > 0 ? carriers[0].id : ''),
            assignQty: trip?.assignedQtyInTrip ?? safeBalance,
            transporterName: trip?.transporterName || '',
            transporterMobile: (trip as any)?.transporterMobile || '',
            distance: trip?.distance || 0,
            freightRate: trip?.freightRate || 0
        };
        reset(defaultValues as any);
    }
  }, [isOpen, trip, shipment, carriers, reset]);

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
      const timeout = setTimeout(() => setCalculatingDistance(false), 5000);
      service.route({
          origin: shipment.loadingPoint!,
          destination: shipment.unloadingPoint!,
          travelMode: google.maps.TravelMode.DRIVING,
      }, (response, status) => {
          clearTimeout(timeout);
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

  const onInvalid = () => {
      const firstError = Object.values(errors)[0];
      if (firstError) {
          toast({ variant: 'destructive', title: "Validation Error", description: (firstError.message as string) || "Invalid field detected." });
      }
  };

  const carrierOptions = useMemo(() => carriers.map(c => ({ value: c.id, label: c.name })), [carriers]);
  const calculatedFreight = (Number(assignQty) || 0) * (Number(freightRate) || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-2xl bg-slate-50 rounded-[3rem]">
        <DialogHeader className="bg-slate-900 text-white p-6 shrink-0 flex flex-row items-center justify-between pr-12">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl rotate-3"><Truck className="h-7 w-7" /></div>
            <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none">SIKKA LMC | ALLOCATION BOARD</DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-2">Registry Terminal Node</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-white/5 border-white/10 text-white font-mono h-10 px-6 rounded-xl flex items-center">{format(currentTime, 'HH:mm:ss')}</Badge>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 text-white/40 hover:text-white"><X size={24} /></Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-10 space-y-10">
          <Card className="p-10 border-2 border-slate-100 shadow-xl rounded-[2.5rem] bg-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-900" />
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm"><ShieldCheck className="h-6 w-6 text-blue-600" /></div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Order Manifest</h3>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{shipment.shipmentId}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
                <ContextNode label="Lifting Node" value={plantNameDisplay} icon={Factory} />
                <ContextNode label="Consignor" value={shipment.consignor} icon={UserCircle} />
                <ContextNode label="Site point" value={shipment.loadingPoint} icon={MapPin} />
                <ContextNode label="Consignee" value={shipment.billToParty} icon={UserCircle} />
                <ContextNode label="Drop node" value={shipment.unloadingPoint} icon={MapPin} className="col-span-2 text-blue-900" bold />
            </div>
          </Card>

          <Form {...form}>
            <form className="space-y-10">
                <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="p-8 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <h3 className="font-black text-xs uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3"><Truck className="h-5 w-5 text-blue-600"/> Fleet Entry Control</h3>
                        <div className="bg-white p-1 rounded-xl border-2 border-slate-200 shadow-inner flex items-center gap-1">
                            <button type="button" onClick={() => setValue('isNewVehicle', false)} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", !isNewVehicle ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600")}>At Gate Registry</button>
                            <button type="button" onClick={() => setValue('isNewVehicle', true)} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", isNewVehicle ? "bg-slate-900 text-white shadow-xl" : "text-slate-400 hover:text-slate-600")}>Direct Manual Entry</button>
                        </div>
                    </div>
                    <div className="p-10">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="h-12 border-b-2 hover:bg-transparent">
                                    <TableHead className="text-[10px] font-black uppercase px-4 w-64">Vehicle Number *</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4">Pilot Name</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4">Pilot Mobile *</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 w-64">Carrier Agent *</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 w-48">Fleet Type</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-right">Assign Qty (MT) *</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="align-top h-20 hover:bg-transparent">
                                    <TableCell className="px-4 py-6">
                                        {isNewVehicle ? (
                                            <FormField name="vehicleNumber" control={control} render={({field}) => <FormItem><FormControl><div className="relative"><Input placeholder="XX00XX0000" className="h-12 rounded-xl font-black uppercase text-lg border-blue-200 focus-visible:ring-blue-900" {...field} /></div></FormControl><FormMessage /></FormItem>} />
                                        ) : (
                                            <FormField name="vehicleId" control={control} render={({field}) => (
                                                <FormItem>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-12 rounded-xl font-black text-blue-900"><SelectValue placeholder={isDataLoading ? "Syncing Gate..." : "Resolve from Gate"} /></SelectTrigger></FormControl>
                                                    <SelectContent className="rounded-xl">{vehiclesAtGate.map(v => <SelectItem key={v.id} value={v.id} className="font-bold py-3 uppercase italic">{v.vehicleNumber} ({v.driverName})</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                                </FormItem>
                                            )} />
                                        )}
                                    </TableCell>
                                    <TableCell className="px-4 py-6"><FormField name="driverName" control={control} render={({field}) => <FormItem><FormControl><Input placeholder="Pilot Name" className="h-12 rounded-xl font-bold" {...field} /></FormControl><FormMessage /></FormItem>} /></TableCell>
                                    <TableCell className="px-4 py-6"><FormField name="driverMobile" control={control} render={({field}) => <FormItem><FormControl><Input {...field} maxLength={10} placeholder="10 Digits" className="h-12 rounded-xl font-mono font-black" /></FormControl><FormMessage /></FormItem>} /></TableCell>
                                    <TableCell className="px-4 py-6">
                                        <FormField name="carrierId" control={control} render={({ field }) => (
                                            <FormItem>
                                            <SearchableSelect 
                                                options={carrierOptions} 
                                                onChange={field.onChange} 
                                                value={field.value} 
                                                placeholder="Pick Agent"
                                                className="h-12"
                                            />
                                            <FormMessage />
                                            </FormItem>
                                        )} />
                                    </TableCell>
                                    <TableCell className="px-4 py-6">
                                        <FormField name="vehicleType" control={control} render={({ field }) => (
                                            <FormItem>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Select Type"/></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">{VehicleTypes.map(t => <SelectItem key={t} value={t} className="font-bold py-2.5">{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                            </FormItem>
                                        )} />
                                    </TableCell>
                                    <TableCell className="px-4 py-6">
                                        <FormField name="assignQty" control={control} render={({field}) => (
                                            <FormItem>
                                            <FormControl><Input {...field} value={field.value ?? ''} type="number" step="0.001" className="h-12 rounded-xl text-right font-black text-xl text-blue-900 shadow-inner" /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )} />
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <Card className={cn("p-10 transition-all duration-500 rounded-[2.5rem] shadow-xl", vehicleType === 'Market Vehicle' ? "bg-blue-50/30 border-2 border-blue-100 opacity-100" : "opacity-40 grayscale pointer-events-none border-slate-100")}>
                        <div className="flex items-center gap-3 mb-8 px-2">
                            <IndianRupee className="h-5 w-5 text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Financial Particulars (Market Node)</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                            <FormField name="transporterName" control={control} render={({field}) => <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Transporter Name *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-white border-slate-200 font-bold" /></FormControl><FormMessage /></FormItem>} />
                            <FormField name="ownerName" control={control} render={({field}) => <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Fleet Owner *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-white border-slate-200 font-bold" /></FormControl><FormMessage /></FormItem>} />
                            <FormField name="freightRate" control={control} render={({field}) => <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">Freight Rate (MT) *</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-12 rounded-xl bg-white border-blue-200 font-black text-blue-900 text-lg shadow-inner" /></FormControl><FormMessage /></FormItem>} />
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-black uppercase text-slate-400">Calculated Freight</span>
                                <div className="h-12 px-5 flex items-center bg-blue-900 rounded-xl text-white font-black text-xl shadow-lg">₹ {calculatedFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-xl flex items-center gap-8 relative overflow-hidden group">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Routing Distance Node</span>
                            <div className="flex items-center gap-3">
                                <h4 className="text-5xl font-black text-blue-900 tracking-tighter">
                                    {calculatingDistance ? <Loader2 className="h-10 w-10 animate-spin" /> : (currentDistance || '--')}
                                </h4>
                                <span className="text-xl font-black text-slate-300">KM</span>
                            </div>
                        </div>
                        <div className="h-16 w-px bg-slate-100 mx-2" />
                        <div className="flex items-start gap-4">
                            <AlertCircle className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                            <p className="text-[9px] font-bold text-slate-500 uppercase leading-normal max-w-[200px]">Distance synchronized with Google Maps mission routing protocol.</p>
                        </div>
                    </Card>
                </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="p-10 bg-slate-900 flex flex-col md:flex-row justify-between items-center shrink-0 gap-8">
            <div className="flex items-center gap-10">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"><Calculator className="h-3 w-3" /> Balance remaining</span>
                    <span className={cn("text-3xl font-black tracking-tighter transition-all duration-500", balanceQty > 0.001 ? "text-orange-400" : "text-emerald-400")}>
                        {balanceQty.toFixed(3)} MT
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <button onClick={onClose} className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-white transition-all">ABORT ALLOCATION</button>
                <Button 
                    onClick={handleSubmit(onSubmit, onInvalid)} 
                    disabled={isSubmitting || calculatingDistance} 
                    className="h-16 px-16 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95 border-none"
                >
                    {isSubmitting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />} {isEditing ? 'Update Node' : 'Establish Mission Node'}
                </Button>
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
            <p className={cn("text-xs leading-tight truncate", bold ? "font-black" : "font-bold text-slate-700")}>{value || '--'}</p>
        </div>
    );
}
