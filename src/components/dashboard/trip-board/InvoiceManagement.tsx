'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, ShieldCheck, Factory, MapPin, Truck, Save, ArrowLeft, FileText, Package } from 'lucide-react';
import { LRUnitTypes } from '@/lib/constants';
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useLoading } from '@/context/LoadingContext';
import { cn, normalizePlantId, getCityOnly } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';

const itemSchema = z.object({
    invoiceNumber: z.string().min(1, "Invoice number required."),
    ewaybillNumber: z.string().optional(),
    itemDescription: z.string().min(1, "Description required"),
    units: z.coerce.number().min(1, "Units required"),
    unitType: z.string().default('Package'),
    weight: z.coerce.number().min(0.001, "Weight required"),
});

const formSchema = z.object({
    items: z.array(itemSchema).min(1, "At least one invoice row is required.")
});

type FormValues = z.infer<typeof formSchema>;

export default function InvoiceManagement({ trip, onClose }: { trip: any; onClose: () => void }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            items: trip.items?.length > 0 ? trip.items : [{ invoiceNumber: '', ewaybillNumber: '', itemDescription: '', units: 1, unitType: 'Package', weight: trip.dispatchedQty || 0 }]
        }
    });

    const { control, handleSubmit, formState: { isSubmitting } } = form;
    const { fields, append, remove } = useFieldArray({ control, name: "items" });

    const handlePost = async (values: FormValues) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const plantId = normalizePlantId(trip.originPlantId);
            const tripRef = doc(firestore, `plants/${plantId}/trips`, trip.id);
            const globalTripRef = doc(firestore, 'trips', trip.id);
            const ts = serverTimestamp();

            const updateData = {
                items: values.items,
                lastUpdated: ts
            };

            await updateDoc(tripRef, updateData);
            await updateDoc(globalTripRef, updateData);

            toast({ title: 'Invoice Registry Updated' });
            onClose();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            hideLoader();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 animate-in fade-in duration-500 overflow-hidden">
            <header className="bg-slate-900 text-white p-6 md:p-8 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
                <div className="flex items-center gap-5">
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 h-12 w-12 rounded-xl"><ArrowLeft /></Button>
                    <div className="p-3 bg-blue-600 rounded-2xl rotate-3 shadow-xl"><FileText className="h-7 w-7" /></div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight leading-none">Invoice Manifest Terminal</h1>
                        <p className="text-blue-300 font-bold uppercase text-[10px] tracking-widest mt-2">Registry Handshake Node: {trip.tripId}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10 shadow-inner">
                    <ContextIcon label="Plant" value={trip.plantName} icon={Factory} />
                    <Separator orientation="vertical" className="h-10 bg-white/10" />
                    <ContextIcon label="Vehicle" value={trip.vehicleNumber} icon={Truck} />
                    <Separator orientation="vertical" className="h-10 bg-white/10" />
                    <ContextIcon label="Route" value={`${getCityOnly(trip.loadingPoint)} → ${getCityOnly(trip.unloadingPoint)}`} icon={MapPin} />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10">
                <div className="max-w-7xl mx-auto space-y-10">
                    <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                        <div className="p-8 bg-slate-50 border-b flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Package className="h-5 w-5 text-blue-900" />
                                <h3 className="font-black text-sm uppercase tracking-widest text-slate-700">Detailed Mission Manifest</h3>
                            </div>
                            <Button type="button" onClick={() => append({ invoiceNumber: '', ewaybillNumber: '', itemDescription: '', units: 1, unitType: 'Package', weight: 0 })} className="bg-blue-900 hover:bg-black text-white h-10 px-6 rounded-xl font-black uppercase text-[10px] gap-2 transition-all active:scale-95 border-none shadow-lg">
                                <Plus size={16} /> Add Document row
                            </Button>
                        </div>
                        <CardContent className="p-0">
                            <Form {...form}>
                                <form onSubmit={handleSubmit(handlePost)}>
                                    <Table>
                                        <TableHeader className="bg-slate-900">
                                            <TableRow className="hover:bg-transparent border-none h-14">
                                                <TableHead className="text-white text-[10px] font-black uppercase px-8 w-48">Invoice No. *</TableHead>
                                                <TableHead className="text-white text-[10px] font-black uppercase px-4 w-48">E-Waybill No.</TableHead>
                                                <TableHead className="text-white text-[10px] font-black uppercase px-4">Product description *</TableHead>
                                                <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center w-36">Units *</TableHead>
                                                <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center w-32">UOM</TableHead>
                                                <TableHead className="text-white text-[10px] font-black uppercase px-8 text-right w-40">Weight (MT) *</TableHead>
                                                <TableHead className="w-16"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {fields.map((field, index) => (
                                                <TableRow key={field.id} className="h-16 border-b border-slate-100 hover:bg-blue-50/10 transition-colors group">
                                                    <TableCell className="px-8"><Input {...form.register(`items.${index}.invoiceNumber`)} className="h-10 rounded-xl font-black uppercase bg-slate-50 border-slate-200" /></TableCell>
                                                    <TableCell className="px-4"><Input {...form.register(`items.${index}.ewaybillNumber`)} className="h-10 rounded-xl font-mono text-blue-600 bg-slate-50 border-slate-200 uppercase" /></TableCell>
                                                    <TableCell className="px-4"><Input {...form.register(`items.${index}.itemDescription`)} className="h-10 rounded-xl font-bold bg-slate-50 border-slate-200 uppercase" /></TableCell>
                                                    <TableCell className="px-4"><Input type="number" {...form.register(`items.${index}.units`)} className="h-10 text-center font-black text-blue-900" /></TableCell>
                                                    <TableCell className="px-4">
                                                        <Controller name={`items.${index}.unitType`} control={control} render={({field: uField}) => (
                                                            <Select onValueChange={uField.onChange} value={uField.value}>
                                                                <SelectTrigger className="h-10 rounded-xl font-bold border-slate-200"><SelectValue /></SelectTrigger>
                                                                <SelectContent className="rounded-xl">{LRUnitTypes.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                                            </Select>
                                                        )}/>
                                                    </TableCell>
                                                    <TableCell className="px-8 text-right"><Input type="number" step="0.001" {...form.register(`items.${index}.weight`)} className="h-10 text-right font-black text-blue-900" /></TableCell>
                                                    <TableCell className="pr-6"><Button variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <div className="p-8 bg-slate-50 border-t flex justify-end gap-4">
                                        <Button type="button" variant="ghost" onClick={onClose} className="px-8 font-black uppercase text-[11px] tracking-widest text-slate-400">Discard</Button>
                                        <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-16 h-12 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                                            {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                                            Commit Invoice Registry
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function ContextIcon({ label, value, icon: Icon }: any) {
    return (
        <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><Icon size={10} /> {label}</span>
            <span className="text-[11px] font-black text-white uppercase truncate max-w-[150px]">{value}</span>
        </div>
    );
}
