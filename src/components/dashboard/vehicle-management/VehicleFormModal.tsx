'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, 
    ShieldCheck, 
    Truck, 
    User, 
    Smartphone, 
    IdCard, 
    Save, 
    X,
    FileText,
    ShieldAlert
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import type { Vehicle, WithId, Plant } from '@/types';
import { DatePicker } from '@/components/date-picker';
import { cn } from '@/lib/utils';

const vehicleNumberRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{0,3}[0-9]{4}$/;

const formSchema = z.object({
  vehicleNumber: z.string().min(1, "Required").transform(v => v.toUpperCase().replace(/\s/g, '')).refine(val => vehicleNumberRegex.test(val), {
    message: 'Invalid Format (e.g. MH12AB1234)'
  }),
  driverName: z.string().min(3, "Pilot name required."),
  driverMobile: z.string().regex(/^\d{10}$/, "10 digit mobile required."),
  licenseNumber: z.string().optional().default(''),
  plantId: z.string().min(1, "Base plant node required."),
  // Category specifics
  ownerName: z.string().optional(),
  ownerMobile: z.string().optional(),
  transporterName: z.string().optional(),
  pan: z.string().optional(),
  pollutionCertValidity: z.date().optional().nullable(),
  fitnessCertValidity: z.date().optional().nullable(),
  permitCertValidity: z.date().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function VehicleFormModal({ isOpen, onClose, vehicle, type, plants }: { isOpen: boolean; onClose: () => void; vehicle: WithId<Vehicle> | null; type: string; plants: Plant[] }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isEditing = !!vehicle;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleNumber: vehicle?.vehicleNumber || '',
      driverName: vehicle?.driverName || '',
      driverMobile: vehicle?.driverMobile || '',
      licenseNumber: (vehicle as any)?.licenseNumber || '',
      plantId: vehicle?.plantId || '',
      ownerName: (vehicle as any)?.ownerName || '',
      ownerMobile: (vehicle as any)?.ownerMobile || '',
      transporterName: (vehicle as any)?.transporterName || '',
      pan: (vehicle as any)?.pan || '',
      pollutionCertValidity: (vehicle as any)?.pollutionCertValidity?.toDate ? (vehicle as any).pollutionCertValidity.toDate() : null,
      fitnessCertValidity: (vehicle as any)?.fitnessCertValidity?.toDate ? (vehicle as any).fitnessCertValidity.toDate() : null,
      permitCertValidity: (vehicle as any)?.permitCertValidity?.toDate ? (vehicle as any).permitCertValidity.toDate() : null,
    }
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: FormValues) => {
    if (!firestore) return;
    try {
        const dataToSave = {
            ...values,
            vehicleType: type,
            status: vehicle?.status || 'Available',
            isDeleted: false,
            updatedAt: serverTimestamp(),
            createdAt: vehicle?.id ? undefined : serverTimestamp(),
        };

        if (isEditing) {
            await updateDoc(doc(firestore, "vehicles", vehicle.id), dataToSave);
            toast({ title: "Registry Updated", description: `Asset ${values.vehicleNumber} profile corrected.` });
        } else {
            await addDoc(collection(firestore, "vehicles"), dataToSave);
            toast({ title: "Node Provisioned", description: `New vehicle ${values.vehicleNumber} added to ${type} registry.` });
        }
        onClose();
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Commit Failed", description: e.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2.5rem]">
        <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center pr-12">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                    <Truck className="h-7 w-7 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight italic">{isEditing ? 'Modify' : 'Provision'} {type} Node</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Handshake & Asset Logging</DialogDescription>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 text-white/40 hover:text-white"><X size={24} /></Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                    <section className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                            <ShieldCheck className="h-4 w-4 text-blue-600" /> 1. Core Asset Identity
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl">
                            <FormField name="vehicleNumber" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Vehicle Registry *</FormLabel>
                                    <FormControl><Input placeholder="XX00XX0000" {...field} className="h-12 rounded-xl font-black text-blue-900 uppercase text-lg shadow-inner" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="plantId" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Primary Plant Node *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="Pick Base" /></SelectTrigger></FormControl>
                                        <SelectContent className="rounded-xl">
                                            {plants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="driverName" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Assigned Pilot *</FormLabel>
                                    <FormControl><Input placeholder="Full Name" {...field} className="h-12 rounded-xl font-bold" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="driverMobile" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">Pilot Mobile *</FormLabel>
                                    <FormControl><Input placeholder="10 Digits" {...field} maxLength={10} className="h-12 rounded-xl font-mono font-black" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="licenseNumber" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500">License Node (DL)</FormLabel>
                                    <FormControl><Input placeholder="Registry DL #" {...field} className="h-12 rounded-xl font-mono uppercase" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </section>

                    {type === 'Own Vehicle' && (
                        <section className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                <FileText className="h-4 w-4 text-emerald-600" /> 2. Compliance Registry (Validity)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl">
                                <FormField name="pollutionCertValidity" control={form.control} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Pollution Expiry</FormLabel>
                                        <FormControl><DatePicker date={field.value || undefined} setDate={field.onChange} className="h-12" /></FormControl>
                                    </FormItem>
                                )} />
                                <FormField name="fitnessCertValidity" control={form.control} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Fitness Expiry</FormLabel>
                                        <FormControl><DatePicker date={field.value || undefined} setDate={field.onChange} className="h-12" /></FormControl>
                                    </FormItem>
                                )} />
                                <FormField name="permitCertValidity" control={form.control} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">Permit Expiry</FormLabel>
                                        <FormControl><DatePicker date={field.value || undefined} setDate={field.onChange} className="h-12" /></FormControl>
                                    </FormItem>
                                )} />
                            </div>
                        </section>
                    )}

                    {(type === 'Contract Vehicle' || type === 'Market Vehicle') && (
                        <section className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                <ShieldAlert className="h-4 w-4 text-orange-600" /> 2. {type === 'Contract Vehicle' ? 'Owner' : 'Transporter'} Registry particulars
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl">
                                <FormField name={type === 'Contract Vehicle' ? 'ownerName' : 'transporterName'} control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">{type === 'Contract Vehicle' ? 'Owner Name' : 'Transporter Name'} *</FormLabel>
                                        <FormControl><Input {...field} className="h-12 rounded-xl font-bold uppercase" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="pan" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-500">PAN Registry</FormLabel>
                                        <FormControl><Input placeholder="ABCDE1234F" {...field} className="h-12 rounded-xl font-mono uppercase font-black" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                {type === 'Contract Vehicle' && (
                                    <FormField name="ownerMobile" control={form.control} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-500">Owner Mobile</FormLabel>
                                            <FormControl><Input {...field} maxLength={10} className="h-12 rounded-xl font-mono font-bold" /></FormControl>
                                        </FormItem>
                                    )} />
                                )}
                            </div>
                        </section>
                    )}

                    <DialogFooter className="pt-10 border-t flex-row justify-end gap-4">
                        <Button type="button" variant="ghost" onClick={onClose} className="font-black text-slate-400 uppercase text-[11px] tracking-widest px-10 h-12 rounded-xl">Discard</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-16 h-12 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-900/30 transition-all active:scale-95 border-none">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Sync Registry
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
