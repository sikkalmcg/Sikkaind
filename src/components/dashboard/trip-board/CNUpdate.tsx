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
import { Loader2, Plus, Trash2, ShieldCheck, Factory, MapPin, Truck, Save, ArrowLeft, Landmark, AlertCircle } from 'lucide-react';
import { DatePicker } from '@/components/date-picker';
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit } from "firebase/firestore";
import { useLoading } from '@/context/LoadingContext';
import { cn, normalizePlantId, getCityOnly } from '@/lib/utils';

const cnSchema = z.object({
    cnNumber: z.string().min(1, "CN number required.").transform(v => v.toUpperCase().trim()),
    cnDate: z.date({ required_error: "Date required" }),
    paymentMode: z.enum(['Paid', 'To Pay']).default('Paid'),
});

const formSchema = z.object({
    cns: z.array(cnSchema).min(1, "At least one CN entry is required.")
});

type FormValues = z.infer<typeof formSchema>;

export default function CNUpdate({ trip, onClose }: { trip: any; onClose: () => void }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            cns: trip.lrNumber ? [{ cnNumber: trip.lrNumber, cnDate: trip.lrDate || new Date(), paymentMode: trip.paymentTerm || 'Paid' }] : [{ cnNumber: '', cnDate: new Date(), paymentMode: 'Paid' }]
        }
    });

    const { control, handleSubmit, formState: { isSubmitting } } = form;
    const { fields, append, remove } = useFieldArray({ control, name: "cns" });

    const handlePost = async (values: FormValues) => {
        if (!firestore || !user) return;
        
        showLoader();
        try {
            const plantId = normalizePlantId(trip.originPlantId);
            
            for (const cnNode of values.cns) {
                const q = query(collection(firestore, `plants/${plantId}/trips`), where("lrNumber", "==", cnNode.cnNumber), limit(5));
                const snap = await getDocs(q);
                const isDuplicate = snap.docs.some(d => d.id !== trip.id);
                
                if (isDuplicate) {
                    toast({ variant: 'destructive', title: 'Registry Conflict', description: `CN Number ${cnNode.cnNumber} is already registered to another trip node.` });
                    hideLoader();
                    return;
                }
            }

            const tripRef = doc(firestore, `plants/${plantId}/trips`, trip.id);
            const globalTripRef = doc(firestore, 'trips', trip.id);
            const ts = serverTimestamp();

            const primaryCN = values.cns[0];
            const updateData = {
                lrNumber: primaryCN.cnNumber,
                lrDate: primaryCN.cnDate,
                paymentTerm: primaryCN.paymentMode,
                cnRegistry: values.cns,
                lastUpdated: ts,
                lrGenerated: true
            };

            await updateDoc(tripRef, updateData);
            await updateDoc(globalTripRef, updateData);

            toast({ title: 'CN Registry Synchronized' });
            onClose();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Registry Error', description: e.message });
        } finally {
            hideLoader();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 animate-in fade-in duration-500 overflow-hidden">
            <header className="bg-slate-900 text-white p-6 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
                <div className="flex items-center gap-5">
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 h-12 w-12 rounded-xl"><ArrowLeft /></Button>
                    <div className="p-3 bg-blue-600 rounded-2xl rotate-3 shadow-xl"><ShieldCheck className="h-7 w-7" /></div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight leading-none text-white">PROVISION CN REGISTRY</h1>
                        <p className="text-blue-300 font-bold uppercase text-[10px] tracking-widest mt-2">Mission Payload Finalization</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10 shadow-inner">
                    <ContextNode label="Plant" value={trip.plantName} />
                    <ContextNode label="Vehicle" value={trip.vehicleNumber} />
                    <ContextNode label="Qty" value={`${trip.dispatchedQty} MT`} />
                    <ContextNode label="Invoice" value={trip.invoiceNumbers} />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-10">
                <div className="max-w-5xl mx-auto space-y-10">
                    <div className="p-10 bg-white rounded-[3rem] shadow-2xl border-2 border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                                <Landmark className="h-5 w-5 text-blue-600" /> CN Allocation Handbook
                            </h3>
                            <Button type="button" variant="outline" onClick={() => append({ cnNumber: '', cnDate: new Date(), paymentMode: 'Paid' })} className="h-9 px-5 gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 hover:bg-blue-50">
                                <Plus size={14} /> Add Additional CN
                            </Button>
                        </div>

                        <Form {...form}>
                            <form onSubmit={handleSubmit(handlePost)} className="space-y-10">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow className="h-12 hover:bg-transparent border-b">
                                            <TableHead className="text-[10px] font-black uppercase px-6">CN Number *</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase px-4">CN Date *</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase px-4">Payment Mode</TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => (
                                            <TableRow key={field.id} className="h-16 border-b border-slate-50 last:border-none">
                                                <TableCell className="px-6">
                                                    <Input {...form.register(`cns.${index}.cnNumber`)} className="h-11 rounded-xl font-black text-blue-900 text-lg uppercase shadow-inner border-slate-200" placeholder="LR#" />
                                                </TableCell>
                                                <TableCell className="px-4">
                                                    <Controller name={`cns.${index}.cnDate`} control={control} render={({field: dField}) => (
                                                        <DatePicker date={dField.value} setDate={dField.onChange} className="h-11 rounded-xl bg-white border-slate-200 font-bold" />
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-4">
                                                    <Controller name={`cns.${index}.paymentMode`} control={control} render={({field: pField}) => (
                                                        <Select onValueChange={pField.onChange} value={pField.value}>
                                                            <SelectTrigger className="h-11 rounded-xl font-bold bg-white border-slate-200"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                <SelectItem value="Paid" className="font-bold">PAID</SelectItem>
                                                                <SelectItem value="To Pay" className="font-bold">TO PAY</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )} />
                                                </TableCell>
                                                <TableCell className="px-2">
                                                    <Button variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1} className="text-slate-300 hover:text-red-600"><Trash2 size={18}/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                <div className="p-8 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-start gap-4 shadow-inner">
                                    <AlertCircle className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-blue-900">Registry Enforcement Rule</p>
                                        <p className="text-[10px] font-bold text-blue-700 leading-normal uppercase">
                                            CN numbers are immutable once established in the mission ledger. Ensure Number and Date match the physical manifest to avoid audit exceptions.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4">
                                    <Button type="button" variant="ghost" onClick={onClose} className="h-12 px-8 font-black uppercase text-[11px] tracking-widest text-slate-400">Discard</Button>
                                    <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-black text-white px-20 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 border-none">
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                                        POST
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ContextNode({ label, value }: any) {
    return (
        <div className="flex flex-col px-4 border-r border-white/10 last:border-none">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-0.5">{label}</span>
            <span className="text-[11px] font-black text-white uppercase truncate max-w-[120px]">{value}</span>
        </div>
    );
}
