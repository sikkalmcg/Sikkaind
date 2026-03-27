'use client';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, Factory, Calendar, MapPin, Weight, IndianRupee, FileText } from 'lucide-react';
import { mockFuelPumps, mockVehicles, mockPlants } from '@/lib/mock-data';
import type { FuelPump, Vehicle, WithId, FuelEntry, Plant, SubUser } from '@/types';
import { FuelTypes, VehicleTypes } from '@/lib/constants';
import { cn, normalizePlantId } from '@/lib/utils';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, query, where, limit } from "firebase/firestore";

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
  plantId: z.string().min(1, "Plant context required."),
  slipNo: z.string().min(1, "Fuel Slip No. is required"),
  date: z.date({ required_error: "Date is required" }),
  fuelType: z.enum(FuelTypes),
  pumpId: z.string().min(1, "Pump is required"),
  vehicleType: z.enum(VehicleTypes),
  // Own Vehicle
  vehicleId: z.string().optional(),
  currentReading: z.coerce.number().optional(),
  // Contract/Market Vehicle
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  ownerName: z.string().optional(),
  tripDetails: z.string().optional(),
  // Market Vehicle Extended Particulars
  tripDate: z.date().optional(),
  tripDestination: z.string().optional(),
  weight: z.coerce.number().optional(),
  freight: z.coerce.number().optional(),
  lrNumber: z.string().optional(),
  lrDate: z.date().optional(),
  // Common
  fuelLiters: z.coerce.number().positive(),
  fuelRate: z.coerce.number().positive(),
  fuelSlipImage: z.any().optional()
    .refine((files) => !files || files?.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max image size is 500KB.`)
    .refine(
      (files) => !files || files?.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
}).superRefine((data, ctx) => {
  if (data.vehicleType === 'Own Vehicle') {
    if (!data.vehicleId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Vehicle Number is required.", path: ["vehicleId"] });
  } else { // Contract or Market
    if (!data.vehicleNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Vehicle Number is required.", path: ["vehicleNumber"] });
    if (data.vehicleType === 'Contract Vehicle') {
      if (!data.ownerName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Owner Name is required.", path: ["ownerName"] });
      if (!data.tripDetails) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Trip Details are required.", path: ["tripDetails"] });
    }
    if (data.vehicleType === 'Market Vehicle') {
        if (!data.tripDate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Trip Date required.", path: ["tripDate"] });
        if (!data.tripDestination) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Destination required.", path: ["tripDestination"] });
        if (!data.weight) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Weight required.", path: ["weight"] });
        if (!data.freight) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Freight required.", path: ["freight"] });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

interface FuelEntryFormProps {
  onSave: (data: Omit<FuelEntry, 'id'>) => void;
}

export default function FuelEntryForm({ onSave }: FuelEntryFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [pumps, setPumps] = useState<WithId<FuelPump>[]>([]);
  const [vehicles, setVehicles] = useState<WithId<Vehicle>[]>([]);
  const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantId: '',
      slipNo: '',
      date: new Date(),
      fuelType: 'Diesel',
      pumpId: '',
      vehicleType: 'Own Vehicle',
      vehicleId: '',
      currentReading: 0,
      vehicleNumber: '',
      driverName: '',
      ownerName: '',
      tripDetails: '',
      fuelLiters: 0,
      fuelRate: 0,
      fuelSlipImage: undefined,
      lrNumber: '',
    },
  });

  const { watch, setValue, handleSubmit, reset } = form;
  const { isSubmitting } = form.formState;

  const vehicleType = watch('vehicleType');
  const selectedVehicleId = watch('vehicleId');
  const currentReading = watch('currentReading');
  const fuelLiters = watch('fuelLiters');
  const fuelRate = watch('fuelRate');

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchMeta = async () => {
        setIsAuthLoading(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                userDocSnap = qSnap.docs[0];
            } else {
                const uidSnap = await getDoc(doc(firestore, "users", user.uid));
                if (uidSnap.exists()) userDocSnap = uidSnap;
            }

            const baseList = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : mockPlants;
            let authIds: string[] = [];
            const isAdminSession = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
                authIds = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdminSession) {
                authIds = baseList.map(p => p.id);
            }

            const filtered = baseList.filter(p => authIds.includes(p.id));
            setAuthorizedPlants(filtered);
            if (filtered.length > 0) {
                setValue('plantId', filtered[0].id);
            }

            const pumpSnap = await getDocs(collection(firestore, "fuel_pumps"));
            const pumpList = pumpSnap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<FuelPump>));
            setPumps(pumpList.length > 0 ? pumpList : mockFuelPumps);

            const vehicleSnap = await getDocs(collection(firestore, "vehicles"));
            const vehicleList = vehicleSnap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Vehicle>));
            setVehicles(vehicleList.length > 0 ? vehicleList : mockVehicles);

        } catch (error) {
            console.error("Meta fetch error:", error);
        } finally {
            setIsAuthLoading(false);
            setIsLoadingMeta(false);
        }
    }
    fetchMeta();
  }, [firestore, user, allMasterPlants, setValue]);

  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId), [vehicles, selectedVehicleId]);
  const previousReading = selectedVehicle?.lastOdometerReading || 0;
  const distance = currentReading && previousReading ? currentReading - previousReading : 0;
  const average = distance > 0 && fuelLiters > 0 ? distance / fuelLiters : 0;
  const fuelAmount = fuelLiters > 0 && fuelRate > 0 ? fuelLiters * fuelRate : 0;

  useEffect(() => {
    if (vehicleType !== 'Own Vehicle') {
      setValue('vehicleId', '');
      setValue('currentReading', 0);
    }
     if (vehicleType === 'Own Vehicle') {
        setValue('vehicleNumber', '');
        setValue('driverName', '');
        setValue('ownerName', '');
        setValue('tripDetails', '');
        setValue('tripDate', undefined);
        setValue('tripDestination', '');
        setValue('weight', undefined);
        setValue('freight', undefined);
        setValue('lrNumber', '');
        setValue('lrDate', undefined);
    }
  }, [vehicleType, setValue]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;

    try {
        const plantId = values.plantId;
        const fuelEntriesRef = collection(firestore, `plants/${plantId}/fuel_entries`);
        
        let b64Image = '';
        if (values.fuelSlipImage && values.fuelSlipImage.length > 0) {
            b64Image = await convertFileToBase64(values.fuelSlipImage[0]);
        }

        const userSnap = await getDoc(doc(firestore, "users", user.uid));
        const currentName = userSnap.exists() ? (userSnap.data() as SubUser).fullName : (user.displayName || user.email?.split('@')[0] || 'System');

        const entryData: any = {
            ...values,
            fuelAmount,
            fuelSlipImageUrl: b64Image,
            distance: values.vehicleType === 'Own Vehicle' ? distance : 0,
            average: values.vehicleType === 'Own Vehicle' ? average : 0,
            previousReading: values.vehicleType === 'Own Vehicle' ? previousReading : 0,
            driverName: values.vehicleType === 'Own Vehicle' ? selectedVehicle?.driverName : values.driverName,
            paidAmount: 0,
            balanceAmount: fuelAmount,
            paymentStatus: 'Unpaid',
            payments: [],
            userName: currentName,
            createdAt: serverTimestamp(),
        };

        delete (entryData as any).fuelSlipImage;
        Object.keys(entryData).forEach(key => entryData[key] === undefined && delete entryData[key]);

        await addDoc(fuelEntriesRef, entryData);
        
        toast({ title: 'Success', description: `Fuel entry #${values.slipNo} saved successfully.` });
        reset();
        onSave(entryData);
    } catch (error: any) {
        console.error("Save fuel error:", error);
        toast({ variant: 'destructive', title: 'Database Error', description: error.message });
    }
  };

  return (
    <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
      <CardHeader className="bg-slate-50 border-b p-6">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><ShieldCheck className="h-5 w-5" /></div>
            <div>
                <CardTitle className="text-xl font-black text-blue-900 uppercase">New Fuel Entry</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Capture fuel consumption node particulars</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
              <FormField name="slipNo" control={form.control} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Fuel Slip No. *</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} className="h-11 rounded-xl font-black text-blue-900 shadow-inner" /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField name="date" control={form.control} render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Transaction Date *</FormLabel>
                    <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 w-full" /></FormControl>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField name="fuelType" control={form.control} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Fuel Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl><SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">{FuelTypes.map(ft => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField name="pumpId" control={form.control} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Pump Node *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={isLoadingMeta}>
                        <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-bold"><SelectValue placeholder={isLoadingMeta ? "Syncing..." : "Select Pump"} /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">{pumps.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
              )} />
              <FormField name="vehicleType" control={form.control} render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Vehicle Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl><SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">{VehicleTypes.map(vt => <SelectItem key={vt} value={vt}>{vt}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
              )} />
            </div>
            
            <div className={cn("space-y-10 animate-in fade-in slide-in-from-top-4 duration-500", !vehicleType && "hidden")}>
                <Separator />
                {vehicleType === 'Own Vehicle' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 items-end bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                        <FormField name="vehicleId" control={form.control} render={({ field }) => (
                            <FormItem className="lg:col-span-2">
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Vehicle Registry Number *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={isLoadingMeta}>
                                    <FormControl><SelectTrigger className="h-11 bg-white rounded-xl font-black text-blue-900"><SelectValue placeholder="Pick Vehicle" /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl">{vehicles.map(v => <SelectItem key={v.id} value={v.id} className="font-black">{v.vehicleNumber}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Pilot Name</p>
                            <Input disabled value={selectedVehicle?.driverName || ''} className="h-11 bg-white/50 font-bold border-slate-200" />
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Last Reading</p>
                            <Input disabled value={previousReading.toLocaleString()} className="h-11 bg-white/50 font-mono" />
                        </div>
                        <FormField name="currentReading" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600">Current ODO *</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-11 bg-white font-mono font-bold border-blue-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Trip Distance</p>
                            <div className="h-11 px-4 flex items-center bg-slate-100 rounded-xl font-black text-slate-600 font-mono">{distance.toLocaleString()} KM</div>
                        </div>
                        <FormField name="fuelLiters" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600">Fuel Liters *</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-11 bg-white font-black text-blue-900 border-blue-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField name="fuelRate" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-blue-600">Rate (INR) *</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} className="h-11 bg-white font-black text-blue-900 border-blue-200" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Net Amount</p>
                            <div className="h-11 px-4 flex items-center bg-emerald-50 rounded-xl font-black text-emerald-700">₹ {fuelAmount.toFixed(2)}</div>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Mileage</p>
                            <div className="h-11 px-4 flex items-center bg-blue-50 rounded-xl font-black text-blue-700 font-mono">{average.toFixed(2)} KM/L</div>
                        </div>
                    </div>
                )}

                {(vehicleType === 'Contract Vehicle' || vehicleType === 'Market Vehicle') && (
                    <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 items-end bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                            <FormField name="vehicleNumber" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-blue-600">Vehicle Registry *</FormLabel>
                                    <FormControl><Input {...field} value={field.value ?? ''} placeholder="XX00XX0000" className="h-11 bg-white font-black uppercase tracking-tighter" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="driverName" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Pilot Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 bg-white font-bold" /></FormControl><FormMessage /></FormItem>
                            )} />
                            
                            <FormField name="lrNumber" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">LR Number</FormLabel>
                                    <FormControl><Input {...field} value={field.value ?? ''} className="h-11 bg-white font-bold" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="lrDate" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">LR Date</FormLabel>
                                    <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 bg-white" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {vehicleType === 'Contract Vehicle' && (
                                <>
                                    <FormField name="ownerName" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Fleet Owner *</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 bg-white font-bold" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField name="tripDetails" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Mission Registry Ref</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 bg-white font-medium" /></FormControl><FormMessage /></FormItem>)} />
                                </>
                            )}
                            {vehicleType === 'Market Vehicle' && (
                                <>
                                    <FormField name="ownerName" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Transporter Name *</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-11 bg-white font-bold" /></FormControl><FormMessage /></FormItem>)} />
                                </>
                            )}
                            <FormField name="fuelLiters" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">Fuel Liters *</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-11 bg-white font-black text-blue-900 border-blue-200" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField name="fuelRate" control={form.control} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">Rate (INR) *</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} className="h-11 bg-white font-black text-blue-900 border-blue-200" /></FormControl><FormMessage /></FormItem>)} />
                            <div className="space-y-1.5">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Net Amount</p>
                                <div className="h-11 px-4 flex items-center bg-emerald-50 rounded-xl font-black text-emerald-700">₹ {fuelAmount.toFixed(2)}</div>
                            </div>
                        </div>

                        {vehicleType === 'Market Vehicle' && (
                            <div className="space-y-6 animate-in slide-in-from-top-2 duration-500">
                                <div className="flex items-center gap-3 px-2">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Trip Performance Particulars</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-end bg-blue-50/20 p-8 rounded-[2.5rem] border border-blue-100 shadow-sm">
                                    <FormField name="tripDate" control={form.control} render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2"><Calendar className="h-3 w-3" /> Trip Date *</FormLabel>
                                            <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 bg-white border-blue-200" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField name="tripDestination" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2"><MapPin className="h-3 w-3" /> Trip Destination *</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ''} className="h-11 bg-white font-bold border-blue-200" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField name="weight" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2"><Weight className="h-3 w-3" /> Weight (MT) *</FormLabel>
                                            <FormControl><Input type="number" step="0.001" {...field} value={field.value ?? ''} className="h-11 bg-white font-black text-blue-900 border-blue-200 text-center" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField name="freight" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2"><IndianRupee className="h-3 w-3" /> Freight (₹) *</FormLabel>
                                            <FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-11 bg-white font-black text-blue-900 border-blue-200 text-right" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-10">
                    <FormField name="fuelSlipImage" control={form.control} render={({ field }) => (
                        <FormItem className="flex-1 max-w-md">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Upload Slip Document (Max 500KB) *</FormLabel>
                            <FormControl><Input type="file" accept="image/*" onChange={e => field.onChange(e.target.files)} className="h-11 rounded-xl pt-3 text-xs" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <div className="flex-1 text-right">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-black uppercase text-[10px] px-6 py-2 tracking-widest">
                            Authorized Registry Commitment Node
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 pt-8 border-t border-slate-100 justify-end">
              <Button type="button" variant="ghost" onClick={() => form.reset()} className="h-12 px-10 font-black uppercase text-[11px] tracking-widest text-slate-400 hover:text-slate-900">Discard Entry</Button>
              <Button type="submit" disabled={isSubmitting || !vehicleType} className="bg-blue-900 hover:bg-slate-900 px-16 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-200 transition-all active:scale-95 border-none">
                {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : null}
                Finalize Registry IN
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
