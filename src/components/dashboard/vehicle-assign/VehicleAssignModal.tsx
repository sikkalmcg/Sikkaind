'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isValid } from 'date-fns';
import { Loader2, Truck, ShieldCheck, Factory, MapPin, UserCircle, IndianRupee, AlertCircle, Lock, Calculator } from 'lucide-react';

// Components & UI
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';

// Firebase & Utils
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { collection, doc, runTransaction, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { normalizePlantId, generateRandomTripId, cn } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { useToast } from '@/hooks/use-toast';
import { useJsApiLoader } from '@react-google-maps/api';
import { VehicleTypes, PaymentTerms } from '@/lib/constants';

// Types
import type { Shipment, Vehicle, WithId, Trip, Carrier, VehicleEntryExit, Plant, SubUser } from '@/types';

// --- Constants & Schema ---
const VEHICLE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;
const MAPS_JS_KEY = "AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU";

const formSchema = z.object({
    isNewVehicle: z.boolean().default(false),
    vehicleId: z.string().optional(),
    vehicleNumber: z.string().min(1, "Required").transform(v => v.toUpperCase().replace(/\s/g, '')).refine(val => VEHICLE_REGEX.test(val), "Invalid Format"),
    driverName: z.string().default(''),
    driverMobile: z.string().length(10, "10 digits required"),
    vehicleType: z.enum(VehicleTypes),
    carrierId: z.string().min(1, 'Required'),
    assignQty: z.coerce.number().positive(),
    paymentTerm: z.enum(PaymentTerms).default('Paid'),
    transporterName: z.string().optional(),
    transporterMobile: z.string().optional(),
    ownerName: z.string().optional(),
    ownerPan: z.string().optional(),
    freightRate: z.coerce.number().min(0).optional().default(0),
    freightAmount: z.coerce.number().optional().default(0),
    distance: z.coerce.number().default(0),
}).superRefine((data, ctx) => {
    if (data.vehicleType === 'Market Vehicle') {
        if (!data.transporterName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['transporterName'] });
        if (!data.ownerName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Owner name required.', path: ['ownerName'] });
        if (!data.transporterMobile || !/^\d{10}$/.test(data.transporterMobile)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: '10-digit mobile required.', path: ['transporterMobile'] });
        if (!data.freightRate || data.freightRate <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rate required.', path: ['freightRate'] });
    }
});

type FormValues = z.infer<typeof formSchema>;

// --- Helper Hook: Google Maps Distance ---
function useDistanceCalc(isLoaded: boolean, isOpen: boolean, origin?: string, destination?: string) {
    const [dist, setDist] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isLoaded || !isOpen || !origin || !destination) return;
        setLoading(true);
        const service = new google.maps.DirectionsService();
        service.route({ origin, destination, travelMode: google.maps.TravelMode.DRIVING }, (res, status) => {
            if (status === 'OK' && res) {
                setDist(Number(((res.routes[0].legs[0].distance?.value || 0) / 1000).toFixed(2)));
            }
            setLoading(false);
        });
    }, [isLoaded, isOpen, origin, destination]);

    return { dist, loading };
}

export default function VehicleAssignModal({ isOpen, onClose, shipment, trip, onAssignmentComplete, carriers }: VehicleAssignModalProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();
    const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: MAPS_JS_KEY, libraries: ['places'] });

    const [vehiclesAtGate, setVehiclesAtGate] = useState<any[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [registryMatch, setRegistryMatch] = useState<WithId<Vehicle> | null>(null);

    const userProfileRef = useMemo(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<SubUser>(userProfileRef);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { assignQty: shipment.balanceQty, vehicleType: 'Own Vehicle', paymentTerm: 'Paid' }
    });

    const { setValue, handleSubmit, reset, control, watch } = form;
    const watchedFields = useWatch({ control });

    // --- Distance Sync ---
    const { dist, loading: distLoading } = useDistanceCalc(isLoaded, isOpen, shipment.loadingPoint, shipment.unloadingPoint);
    useEffect(() => { if (dist > 0) setValue('distance', dist); }, [dist, setValue]);

    // --- Auto Calculate Freight ---
    useEffect(() => {
        const amt = (watchedFields.assignQty || 0) * (watchedFields.freightRate || 0);
        setValue('freightAmount', Number(amt.toFixed(2)));
    }, [watchedFields.assignQty, watchedFields.freightRate, setValue]);

    // --- Initial Reset ---
    useEffect(() => {
        if (isOpen) {
            const isEditing = !!trip;
            const defaultValues = {
                isNewVehicle: false,
                vehicleId: trip?.vehicleId || '',
                vehicleNumber: trip?.vehicleNumber || '',
                driverName: trip?.driverName || '',
                driverMobile: trip?.driverMobile || '',
                vehicleType: (trip?.vehicleType as any) || 'Own Vehicle',
                carrierId: trip?.carrierId || shipment.carrierId || (carriers && carriers.length > 0 ? carriers[0].id : ''),
                assignQty: trip?.assignedQtyInTrip ?? Number(Number(shipment.balanceQty).toFixed(3)),
                paymentTerm: (trip as any)?.paymentTerm || 'Paid',
                transporterName: trip?.transporterName || '',
                transporterMobile: trip?.transporterMobile || '',
                ownerName: trip?.ownerName || '',
                ownerPan: trip?.ownerPan || '',
                freightRate: trip?.freightRate || 0,
                freightAmount: trip?.freightAmount || 0,
                distance: trip?.distance || 0
            };
            reset(defaultValues);
        }
    }, [isOpen, trip, shipment, carriers, reset]);

    // --- Fetch Gate Vehicles ---
    useEffect(() => {
        if (!isOpen || !firestore) return;
        const fetchGate = async () => {
            setIsDataLoading(true);
            const plantId = normalizePlantId(shipment.originPlantId);
            const q = query(collection(firestore, 'vehicleEntries'), where('plantId', '==', plantId), where('status', '==', 'IN'));
            const snap = await getDocs(q);
            setVehiclesAtGate(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsDataLoading(false);
        };
        fetchGate();
    }, [isOpen, firestore, shipment.originPlantId]);

    // --- Form Submission Logic ---
    const onSubmit = async (values: FormValues) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            await runTransaction(firestore, async (transaction) => {
                const plantId = normalizePlantId(shipment.originPlantId);
                const docId = trip?.id || doc(collection(firestore, 'trips')).id;
                const isEditing = !!trip;
                const currentName = userProfile?.fullName || user.displayName || user.email?.split('@')[0] || 'System Operator';

                const tripData = {
                    ...values,
                    tripId: trip?.tripId || generateRandomTripId(),
                    originPlantId: plantId,
                    lastUpdated: serverTimestamp(),
                    userId: user.uid,
                    userName: currentName,
                    tripStatus: 'Assigned'
                };

                // Update Shipment Balance
                const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipment.id);
                const shipSnap = await transaction.get(shipmentRef);
                if (!shipSnap.exists()) throw new Error("Shipment registry error.");
                const currentShipmentData = shipSnap.data() as Shipment;

                const diff = isEditing ? values.assignQty - trip!.assignedQtyInTrip : values.assignQty;
                const newAssignedTotal = (currentShipmentData.assignedQty || 0) + diff;
                
                transaction.update(shipmentRef, { 
                    assignedQty: newAssignedTotal, 
                    balanceQty: currentShipmentData.quantity - newAssignedTotal, 
                    currentStatusId: (currentShipmentData.quantity - newAssignedTotal) > 0 ? 'Partly Vehicle Assigned' : 'Assigned',
                    lastUpdateDate: serverTimestamp()
                });

                // Set Trip Data
                transaction.set(doc(firestore, `plants/${plantId}/trips`, docId), tripData);
                transaction.set(doc(firestore, 'trips', docId), tripData);
            });
            toast({ title: 'Success', description: 'Mission Allocation Finalized.' });
            onAssignmentComplete();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            hideLoader();
        }
    };

    const carrierOptions = useMemo(() => (carriers || []).map((c: any) => ({ value: c.id, label: c.name })), [carriers]);

    const balanceQty = useMemo(() => {
        const total = trip ? (shipment.balanceQty + (trip.assignedQtyInTrip || 0)) : shipment.balanceQty;
        return Number(Math.max(0, total - (watchedFields.assignQty || 0)).toFixed(3));
    }, [shipment.balanceQty, watchedFields.assignQty, trip]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[1400px] w-[95vw] h-[90vh] flex flex-col p-0 border-none bg-slate-50 rounded-3xl overflow-hidden shadow-2xl">
                {/* Header Section */}
                <div className="bg-slate-900 text-white p-6 flex justify-between items-center rounded-t-3xl">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-600 rounded-xl"><Truck className="h-6 w-6" /></div>
                        <div>
                            <DialogTitle className="text-xl font-black italic uppercase">SIKKA LMC | ALLOCATION</DialogTitle>
                            <DialogDescription className="text-blue-300 text-[10px] uppercase tracking-widest">Registry Terminal</DialogDescription>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-blue-400 font-mono">{format(new Date(), 'HH:mm:ss')}</Badge>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Shipment Context Card */}
                    <Card className="p-6 grid grid-cols-6 gap-6 bg-white border-none shadow-sm rounded-2xl">
                        <ContextItem icon={<Factory size={14}/>} label="Plant" value={shipment.originPlantId} />
                        <ContextItem icon={<UserCircle size={14}/>} label="Consignor" value={shipment.consignor} />
                        <ContextItem icon={<MapPin size={14}/>} label="Site" value={shipment.loadingPoint} />
                        <ContextItem icon={<UserCircle size={14}/>} label="Consignee" value={shipment.billToParty} />
                        <ContextItem icon={<Truck size={14}/>} label="Destination" value={shipment.destination} className="col-span-2 text-blue-800" />
                    </Card>

                    {/* Main Form */}
                    <Form {...form}>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                            <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
                                <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">Fleet Allocation Registry</h3>
                                    <VehicleToggle control={control} setValue={setValue} isNew={watchedFields.isNewVehicle} />
                                </div>
                                <div className="p-6">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Vehicle No</TableHead>
                                                <TableHead>Pilot Name</TableHead>
                                                <TableHead>Mobile</TableHead>
                                                <TableHead>Carrier</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">Qty (MT)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow className="align-top">
                                                <TableCell>
                                                    {watchedFields.isNewVehicle ? (
                                                        <FormField name="vehicleNumber" control={control} render={({field}) => <Input {...field} className="h-10 uppercase font-black" />} />
                                                    ) : (
                                                        <FormField name="vehicleId" control={control} render={({field}) => (
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <SelectTrigger className="h-10"><SelectValue placeholder="Select Vehicle" /></SelectTrigger>
                                                                <SelectContent>{vehiclesAtGate.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}</SelectContent>
                                                            </Select>
                                                        )} />
                                                    )}
                                                </TableCell>
                                                <TableCell><FormField name="driverName" control={control} render={({field}) => <Input {...field} className="h-10" />} /></TableCell>
                                                <TableCell><FormField name="driverMobile" control={control} render={({field}) => <Input {...field} maxLength={10} className="h-10 font-mono" />} /></TableCell>
                                                <TableCell>
                                                    <FormField name="carrierId" control={control} render={({field}) => (
                                                        <SearchableSelect options={carrierOptions} value={field.value} onChange={field.onChange} />
                                                    )} />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField name="vehicleType" control={control} render={({field}) => (
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                                            <SelectContent>{VehicleTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    )} />
                                                </TableCell>
                                                <TableCell><FormField name="assignQty" control={control} render={({field}) => <Input {...field} type="number" className="h-10 text-right font-black" />} /></TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>

                            {/* Market Vehicle Fields */}
                            {watchedFields.vehicleType === 'Market Vehicle' && (
                                <MarketFields control={control} freightAmount={watchedFields.freightAmount} />
                            )}

                            <Card className="p-8 border-none shadow-sm rounded-[2.5rem] bg-white group">
                                <div className="flex items-center gap-10">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black uppercase text-slate-400">Distance Node</span>
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-5xl font-black text-blue-900 tracking-tighter">
                                                {distLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : (watchedFields.distance || '--')}
                                            </h4>
                                            <span className="text-xl font-black text-slate-300">KM</span>
                                        </div>
                                    </div>
                                    <div className="h-16 w-px bg-slate-100 hidden md:block" />
                                    <div className="max-w-md p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                                        <AlertCircle className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                                        <p className="text-[9px] font-bold text-slate-500 uppercase leading-normal">Distance node synchronized with Google Maps routing protocol.</p>
                                    </div>
                                </div>
                            </Card>
                        </form>
                    </Form>
                </div>

                {/* Footer Section */}
                <DialogFooter className="p-8 bg-slate-900 flex justify-between items-center rounded-b-3xl shrink-0">
                    <div className="flex items-center gap-4">
                        <Calculator className="text-blue-400" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-black">Balance Remaining</span>
                            <span className="text-2xl font-black text-orange-400">{balanceQty.toFixed(3)} MT</span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <Button variant="ghost" onClick={onClose} className="text-slate-400 font-bold uppercase">Cancel</Button>
                        <Button onClick={handleSubmit(onSubmit)} className="bg-blue-600 hover:bg-blue-700 px-12 h-12 rounded-xl font-black uppercase shadow-lg transition-all active:scale-95">Establish Mission Node</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Sub-Components ---

function ContextItem({ icon, label, value, className }: any) {
    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">{icon} {label}</span>
            <span className="text-xs font-bold uppercase truncate">{value || '--'}</span>
        </div>
    );
}

function VehicleToggle({ control, setValue, isNew }: any) {
    return (
        <RadioGroup value={isNew ? 'new' : 'gate'} onValueChange={(v) => setValue('isNewVehicle', v === 'new')} className="flex bg-white border p-1 rounded-xl">
            <div className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", !isNew ? "bg-slate-900 text-white" : "text-slate-400")}>
                <RadioGroupItem value="gate" id="gate" className="sr-only" /><label htmlFor="gate">At Gate</label>
            </div>
            <div className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", isNew ? "bg-slate-900 text-white" : "text-slate-400")}>
                <RadioGroupItem value="new" id="new" className="sr-only" /><label htmlFor="new">Direct</label>
            </div>
        </RadioGroup>
    );
}

function MarketFields({ control, freightAmount }: any) {
    return (
        <Card className="p-6 bg-blue-50/50 border-blue-100 rounded-2xl grid grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-2">
            <FormField name="transporterName" control={control} render={({field}) => <FormItem><FormLabel className="text-[10px] font-black uppercase">Transporter</FormLabel><Input {...field} className="bg-white h-10 font-bold" /></FormItem>} />
            <FormField name="ownerName" control={control} render={({field}) => <FormItem><FormLabel className="text-[10px] font-black uppercase">Owner Name</FormLabel><Input {...field} className="bg-white h-10 font-bold" /></FormItem>} />
            <FormField name="freightRate" control={control} render={({field}) => <FormItem><FormLabel className="text-[10px] font-black uppercase">Rate (MT)</FormLabel><div className="relative"><Input {...field} type="number" className="bg-white h-10 pl-8 font-black" /><IndianRupee className="absolute left-2.5 top-3 h-4 w-4 text-slate-400"/></div></FormItem>} />
            <div className="flex flex-col justify-end">
                <span className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Freight</span>
                <div className="h-10 bg-white border rounded-lg flex items-center px-4 font-black text-blue-900">₹ {Number(freightAmount || 0).toLocaleString()}</div>
            </div>
        </Card>
    );
}
