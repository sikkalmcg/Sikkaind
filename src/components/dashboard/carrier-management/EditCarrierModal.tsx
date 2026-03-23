'use client';
import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Trash2, ShieldCheck, Save, Upload } from 'lucide-react';
import type { Carrier, Plant, WithId } from '@/types';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const mobileRegex = /^(\s*\d{10}\s*)(,\s*\d{10}\s*)*$/;

const formSchema = z.object({
  plantId: z.string().min(1, 'Plant is required'),
  logo: z.any().optional(),
  name: z.string().min(1, 'Carrier Name is required'),
  address: z.string().min(1, 'Address is required'),
  gstin: z.string().min(15, 'GSTIN must be 15 characters').max(15),
  pan: z.string().min(10, 'PAN must be 10 characters').max(10),
  stateName: z.string().min(1, 'State Name is required'),
  stateCode: z.string().min(1, 'State Code is required'),
  email: z.string().email('Invalid email address'),
  mobile: z.string().regex(mobileRegex, 'Enter valid 10-digit mobile numbers, separated by commas.'),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  terms: z.array(z.object({ value: z.string().min(1, "Term cannot be empty.") })),
});

type FormValues = z.infer<typeof formSchema>;

interface EditCarrierModalProps {
  isOpen: boolean;
  onClose: () => void;
  carrier: WithId<Carrier>;
  onCarrierUpdated: (carrierId: string, data: Partial<Omit<Carrier, 'id'>>) => void;
}

export default function EditCarrierModal({ isOpen, onClose, carrier, onCarrierUpdated }: EditCarrierModalProps) {
  const firestore = useFirestore();

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantId: carrier.plantId || '',
      name: carrier.name || '',
      address: carrier.address || '',
      gstin: carrier.gstin || '',
      pan: carrier.pan || '',
      stateName: carrier.stateName || '',
      stateCode: carrier.stateCode || '',
      email: carrier.email || '',
      mobile: carrier.mobile || '',
      website: carrier.website || '',
      terms: Array.isArray(carrier.terms) ? carrier.terms.map(t => ({ value: t })) : [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'terms'
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({
            plantId: carrier.plantId || '',
            name: carrier.name || '',
            address: carrier.address || '',
            gstin: carrier.gstin || '',
            pan: carrier.pan || '',
            stateName: carrier.stateName || '',
            stateCode: carrier.stateCode || '',
            email: carrier.email || '',
            mobile: carrier.mobile || '',
            website: carrier.website || '',
            terms: Array.isArray(carrier.terms) ? carrier.terms.map(t => ({ value: t })) : [],
        });
    }
  }, [carrier, isOpen, form]);


  const { isSubmitting } = form.formState;

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onSubmit = async (values: FormValues) => {
    let logoUrl = carrier.logoUrl;
    if (values.logo?.[0]) {
      logoUrl = await convertFileToBase64(values.logo[0]);
    }

    const updatedData: Partial<Omit<Carrier, 'id'>> = {
      ...values,
      logoUrl,
      terms: values.terms.map(t => t.value),
    };
    
    delete (updatedData as any).logo;
    onCarrierUpdated(carrier.id, updatedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden bg-[#f8fafc]">
             <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg"><ShieldCheck className="h-6 w-6" /></div>
                    <div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Carrier Profile Correction</DialogTitle>
                        <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                            Registry Modification Node: {carrier.name}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-8">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <FormField control={form.control} name="plantId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lifting Node Context</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 font-bold">
                                                <SelectValue placeholder={isLoadingPlants ? "Loading..." : "Select Plant"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            {plants?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="logo" render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logo (Max 2MB)</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-4">
                                            <Input type="file" accept="image/*" onChange={e => field.onChange(e.target.files)} className="h-11 pt-2.5" />
                                            <Upload className="h-5 w-5 text-slate-300" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carrier Registry Name</FormLabel>
                                    <FormControl><Input {...field} className="h-11 rounded-xl font-black text-blue-900 shadow-inner" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="address" render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Physical Business Address</FormLabel>
                                    <FormControl><Input {...field} className="h-11 rounded-xl font-medium" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="gstin" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">GSTIN Registry</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-mono uppercase font-bold" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="pan" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">PAN Registry</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-mono uppercase font-bold" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="stateName" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">State Name</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-bold" /></FormControl><FormMessage /></FormItem>
                            )} />
                            
                            <FormField control={form.control} name="stateCode" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">State Code</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl font-black text-center" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Email</FormLabel><FormControl><Input type="email" {...field} className="h-11 rounded-xl font-bold" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="mobile" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mobile Number(s)</FormLabel>
                                    <FormControl><Input placeholder="e.g. 9876543210, 8877665544" {...field} className="h-11 rounded-xl font-mono" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="website" render={({ field }) => (
                                <FormItem className="md:col-span-3">
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400">Website</FormLabel>
                                    <FormControl><Input {...field} className="h-11 rounded-xl font-medium" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 border-b pb-3">
                                <PlusCircle className="h-4 w-4 text-blue-600" /> Operational Terms & Conditions
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {fields.map((field, index) => (
                                    <FormField key={field.id} control={form.control} name={`terms.${index}.value`} render={({ field }) => (
                                        <div className="flex items-start gap-3 group">
                                            <div className="h-10 w-10 shrink-0 bg-slate-100 rounded-xl flex items-center justify-center font-black text-xs text-slate-400">{index + 1}</div>
                                            <FormControl className="flex-1"><Textarea {...field} className="min-h-[80px] rounded-2xl bg-slate-50 border-slate-200 font-medium" /></FormControl>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-slate-300 hover:text-red-600">
                                                <Trash2 className.tsx="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )} />
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ value: "" })} className="w-fit gap-2 font-black uppercase text-[10px] tracking-widest border-slate-200 h-10 px-6 rounded-xl">
                                    <PlusCircle className="h-4 w-4" /> Add Provision
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </div>
            
            <DialogFooter className="bg-slate-50 border-t p-6 shrink-0 flex-row justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="font-bold border-slate-300 rounded-xl h-11 px-8">Discard</Button>
                <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 text-white px-12 h-11 rounded-xl gap-2 font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95 border-none">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Commit Profile Changes
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
