'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { WithId, Trip, VehicleEntryExit, ShipmentStatusMaster } from '@/types';
import { format } from 'date-fns';
import { 
    Loader2, 
    Truck, 
    CheckCircle2, 
    History, 
    RotateCcw, 
    ShieldCheck, 
    Clock, 
    Activity,
    XCircle,
    Search,
    MessageSquare,
    Lock,
    Settings2,
    AlertTriangle,
    MapPin,
    ArrowRightLeft,
    Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  id: z.string().min(1, 'Trip selection is mandatory.'),
  newStatus: z.string().min(1, 'Target status selection is mandatory.'),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface UpdateStatusFormProps {
  activeTrips: WithId<Trip>[];
  availableVehicles: WithId<VehicleEntryExit>[];
  onStatusUpdate: (id: string, newStatus: string, location: string, remarks?: string, isTripUpdate?: boolean) => void;
}

export default function UpdateStatusForm({ activeTrips = [], availableVehicles = [], onStatusUpdate }: UpdateStatusFormProps) {
  const firestore = useFirestore();
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  // Fetch Custom Statuses from Status Master Registry
  const statusMasterQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "shipment_status_masters"), orderBy("name")) : null, 
    [firestore]
  );
  const { data: customStatuses } = useCollection<ShipmentStatusMaster>(statusMasterQuery);

  useEffect(() => {
    setCurrentDate(new Date());
    const interval = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { id: '', newStatus: '', remarks: '' },
  });

  const { watch, formState: { isSubmitting, errors }, setValue, reset, handleSubmit } = form;

  const selectedId = watch('id');
  
  const selectedRecord = useMemo(() => {
    return activeTrips?.find(t => t.id === selectedId);
  }, [selectedId, activeTrips]);
  
  const currentStatus = useMemo(() => {
    if (!selectedRecord) return '';
    return (selectedRecord as Trip).currentStatusId || (selectedRecord as Trip).tripStatus;
  }, [selectedRecord]);

  const isVehicleInYard = useMemo(() => {
    if (!selectedRecord || !availableVehicles) return false;
    const vNo = (selectedRecord as Trip).vehicleNumber?.toUpperCase().replace(/\s/g, '');
    return availableVehicles.some(v => v.vehicleNumber?.toUpperCase().replace(/\s/g, '') === vNo);
  }, [selectedRecord, availableVehicles]);

  const isAssigned = currentStatus === 'Assigned' || currentStatus === 'Vehicle Assigned';

  useEffect(() => {
    if (isAssigned) {
        if (!isVehicleInYard) {
            setValue('newStatus', 'In-Transit');
        } else {
            setValue('newStatus', ''); 
        }
    } else {
        setValue('newStatus', '');
    }
  }, [isAssigned, isVehicleInYard, setValue]);

  const isDelivered = currentStatus?.toLowerCase() === 'delivered';
  const isException = ['Under Maintenance', 'Break-down', 'Pilot Not Available'].includes(currentStatus);

  const statusOptions = useMemo(() => {
    if (!selectedRecord) return [];
    const registryOptions = (customStatuses || [])
        .map(s => s.name)
        .filter(name => name !== currentStatus);
    return registryOptions;
  }, [selectedRecord, currentStatus, customStatuses]);

  const onSubmit = (values: FormValues) => {
    onStatusUpdate(values.id, values.newStatus, '', values.remarks, true);
    reset({ id: '', newStatus: '', remarks: '' });
  };

  const groupedTrips = useMemo(() => {
    const groups: { [vehicleNumber: string]: WithId<Trip>[] } = {};
    activeTrips?.forEach(trip => {
        const key = trip.vehicleNumber || 'Unknown Vehicle';
        if (!groups[key]) groups[key] = [];
        groups[key].push(trip);
    });
    return Object.entries(groups).sort(([vehicleA], [vehicleB]) => vehicleA.localeCompare(vehicleB));
  }, [activeTrips]);

  const feedback = useMemo(() => {
    if (errors.id) return { text: errors.id.message, type: 'error' };
    if (errors.newStatus) return { text: errors.newStatus.message, type: 'error' };
    if (selectedId && isAssigned && isVehicleInYard) return { text: "GATE EXIT REQUIRED: VEHICLE IS STILL IN YARD. MARK OUT AT GATE TO ENABLE TRANSIT.", type: 'warning' };
    if (isDelivered) return { text: "TRIP ALREADY DELIVERED. STATUS CLOSED AUTOMATICALLY.", type: 'info' };
    if (isSubmitting) return { text: "COMMITTING STATUS TO MISSION REGISTRY...", type: 'info' };
    if (selectedId) return { text: `VALIDATED: READY TO TRANSITION FROM ${currentStatus.toUpperCase()}.`, type: 'success' };
    return { text: `SYSTEM IDLE: SELECT AN ACTIVE TRIP TO BEGIN.`, type: 'success' };
  }, [errors, isDelivered, isSubmitting, selectedId, currentStatus, isAssigned, isVehicleInYard]);

  return (
    <div className="space-y-10 max-w-6xl mx-auto animate-in fade-in duration-700">
      <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                        <Activity className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-black uppercase text-blue-900 italic tracking-tight">Manual Transition node</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Configure mission status particulars</CardDescription>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Registry Timestamp</span>
                    <Badge variant="outline" className="bg-white border-blue-200 text-blue-900 font-mono font-black text-sm py-1.5 px-4 shadow-sm">
                        {currentDate ? format(currentDate, 'dd-MM-yy | HH:mm') : '--:--'}
                    </Badge>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-10">
            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        <FormField name="id" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[11px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                                    <Truck className="h-3.5 w-3.5" /> Vehicle Number *
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-14 rounded-2xl font-black text-blue-900 border-slate-200 bg-slate-50/30 focus:ring-blue-900 shadow-inner">
                                            <SelectValue placeholder="Resolve Registry..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="max-h-80 rounded-2xl shadow-2xl">
                                        {groupedTrips.map(([vehicleNumber, trips]) => (
                                            <SelectGroup key={vehicleNumber}>
                                                <SelectLabel className="bg-slate-50 font-black text-[10px] uppercase tracking-widest text-slate-400 py-3 px-5 border-b">{vehicleNumber}</SelectLabel>
                                                {trips.map(trip => (
                                                    <SelectItem key={trip.id} value={trip.id} className="font-bold py-4 pl-10">
                                                        {trip.tripId} &ndash; {trip.unloadingPoint}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="space-y-3">
                            <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                                <History className="h-3.5 w-3.5" /> Latest Registry Status
                            </label>
                            <div className="h-14 px-6 flex items-center bg-blue-50/50 rounded-2xl border-2 border-blue-100 text-blue-900 font-black text-sm shadow-sm uppercase tracking-tighter">
                                {currentStatus || 'Awaiting Selection...'}
                            </div>
                        </div>

                        <FormField name="newStatus" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[11px] font-black uppercase text-blue-600 tracking-widest px-1 flex items-center gap-2">
                                    <ArrowRightLeft className="h-3.5 w-3.5" /> Target status node *
                                </FormLabel>
                                {isAssigned ? (
                                    <div className={cn(
                                        "h-14 px-6 flex items-center justify-between rounded-2xl border-2 transition-all shadow-inner relative group overflow-hidden",
                                        isVehicleInYard 
                                            ? "bg-red-50 border-red-200 text-red-600" 
                                            : "bg-emerald-50 border-emerald-200 text-emerald-700 font-black text-sm"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            {isVehicleInYard ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                            <span className="font-black uppercase tracking-tighter">{isVehicleInYard ? 'WAITING FOR GATE OUT' : 'In-Transit'}</span>
                                        </div>
                                        {isVehicleInYard && <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />}
                                    </div>
                                ) : (
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedId || isDelivered}>
                                        <FormControl>
                                            <SelectTrigger className="h-14 rounded-2xl font-black text-slate-900 border-slate-200 bg-white shadow-sm focus:ring-blue-900">
                                                <SelectValue placeholder="Transition Node" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-2xl shadow-2xl">
                                            {isException && (selectedRecord as Trip)?.previousOperationalStatus && (
                                                <SelectItem value={(selectedRecord as Trip).previousOperationalStatus!} className="bg-emerald-50 text-emerald-700 font-black py-4">
                                                    <div className="flex items-center gap-2">
                                                        <RotateCcw className="h-4 w-4" />
                                                        RESTORE TO ACTIVE: {(selectedRecord as Trip).previousOperationalStatus}
                                                    </div>
                                                </SelectItem>
                                            )}
                                            <SelectGroup>
                                                <SelectLabel className="text-[10px] font-black text-blue-600 uppercase tracking-widest pt-2 border-t flex items-center gap-2">
                                                    <Settings2 className="h-3 w-3" /> Master Registry Statuses
                                                </SelectLabel>
                                                {statusOptions.map((option, idx) => (
                                                    <SelectItem key={idx} value={option} className="font-bold py-4 text-slate-700">
                                                        {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                )}
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField name="remarks" control={form.control} render={({ field }) => (
                            <FormItem className="lg:col-span-3">
                                <FormLabel className="text-[11px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                                    <MessageSquare className="h-3.5 w-3.5" /> Administrative Remarks
                                </FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="Provide justification or context for this transition..." 
                                        className="h-14 rounded-2xl bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900 font-bold"
                                        {...field} 
                                        disabled={!selectedId || isDelivered} 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-slate-100">
                        <div className={cn(
                            "flex items-center gap-4 px-8 py-4 rounded-3xl border transition-all duration-500 shadow-lg",
                            feedback.type === 'error' ? "bg-red-50 text-red-700 border-red-100" :
                            feedback.type === 'warning' ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" :
                            feedback.type === 'info' ? "bg-blue-50 text-blue-700 border-blue-100" :
                            "bg-emerald-50 text-emerald-700 border-emerald-100 font-bold"
                        )}>
                            {feedback.type === 'error' ? <XCircle className="h-6 w-6" /> : 
                             feedback.type === 'warning' ? <AlertTriangle className="h-6 w-6" /> :
                             feedback.type === 'info' ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                             <CheckCircle2 className="h-6 w-6" />}
                            <span className="text-[11px] font-black uppercase tracking-[0.1em] leading-tight max-w-md">{feedback.text}</span>
                        </div>

                        <div className="flex gap-6">
                            <Button type="button" variant="ghost" onClick={() => reset()} className="h-16 px-10 font-black uppercase text-[11px] tracking-widest text-slate-400 hover:text-slate-900 transition-all rounded-[1.5rem]">
                                Clear Board
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSubmitting || !selectedId || isDelivered || (isAssigned && isVehicleInYard)} 
                                className="bg-blue-900 hover:bg-black text-white px-20 h-16 rounded-[1.5rem] shadow-2xl shadow-blue-900/30 font-black uppercase text-[11px] tracking-[0.3em] transition-all active:scale-95 border-none disabled:opacity-30 disabled:grayscale"
                            >
                                {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                                Commit Registry Update
                            </Button>
                        </div>
                    </div>
                </form>
            </Form>
        </CardContent>
      </Card>
    </div>
  );
}
