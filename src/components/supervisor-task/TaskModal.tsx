'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Loader2, 
    Plus, 
    Trash2, 
    ShieldCheck, 
    Calculator, 
    AlertTriangle, 
    PlusCircle, 
    CheckCircle2, 
    MinusCircle, 
    History, 
    Save, 
    User, 
    Truck, 
    Factory, 
    MapPin, 
    AlertCircle, 
    FileText 
} from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, addDoc, serverTimestamp, updateDoc, runTransaction } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';

const UOM_OPTIONS = ['Bag', 'Box', 'Drum', 'MT', 'LTR', 'PCS', 'Pallet', 'Roll', 'Others'] as const;

const loadingItemSchema = z.object({
    slipNo: z.string().min(1, "Delivery No required."),
    invoiceNo: z.string().optional(),
    description: z.string().min(1, "Description required."),
    deliveryUnit: z.coerce.number().min(0.001, "Qty required."),
    loadUnit: z.coerce.number().min(0.001, "Qty required."),
    uom: z.string().min(1, "UOM required."),
    balanceUnit: z.coerce.number().default(0),
});

const formSchema = z.object({
    loadingItems: z.array(loadingItemSchema).optional(),
    unloadQty: z.coerce.number().min(0).optional(),
    remarks: z.string().optional(),
}).superRefine((data, ctx) => {
    const totalBalance = data.loadingItems?.reduce((s, i) => s + (Number(i.deliveryUnit) - Number(i.loadUnit)), 0) || 0;
    if (totalBalance > 0.001 && !data.remarks?.trim()) {
        ctx.addIssue({ code: 'custom', message: "Mandatory remark for balance qty.", path: ['remarks'] });
    }
});

export default function TaskModal({ isOpen, onClose, task, onSuccess }: { isOpen: boolean; onClose: () => void; task: any; onSuccess: () => void }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();
    
    const isOutward = task.purpose === 'Loading';

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            loadingItems: isOutward ? [{ slipNo: '', invoiceNo: '', description: '', deliveryUnit: 0, loadUnit: 0, uom: 'MT', balanceUnit: 0 }] : [],
            unloadQty: !isOutward ? Number(task.billedQty) : 0,
            remarks: ''
        }
    });

    const { control, handleSubmit, setValue, watch, formState: { errors } } = form;
    const { fields, append, remove } = useFieldArray({ control, name: "loadingItems" });
    const watchedLoadingItems = useWatch({ control, name: "loadingItems" }) || [];
    const unloadQtyValue = watch('unloadQty') || 0;

    // Loading Logic Node: Auto-calc row balance
    useEffect(() => {
        if (isOutward) {
            watchedLoadingItems.forEach((item, idx) => {
                const bal = Number((Number(item.deliveryUnit) - Number(item.loadUnit)).toFixed(3));
                if (item.balanceUnit !== bal) {
                    setValue(`loadingItems.${idx}.balanceUnit`, bal);
                }
            });
        }
    }, [watchedLoadingItems, isOutward, setValue]);

    const totals = useMemo(() => {
        if (isOutward) {
            return watchedLoadingItems.reduce((acc, curr) => ({
                delivery: acc.delivery + (Number(curr.deliveryUnit) || 0),
                load: acc.load + (Number(curr.loadUnit) || 0),
                balance: acc.balance + (Number(curr.balanceUnit) || 0),
            }), { delivery: 0, load: 0, balance: 0 });
        }
        const diff = Number((Number(task.billedQty) - unloadQtyValue).toFixed(3));
        return { diff, isExcess: diff < 0 };
    }, [isOutward, watchedLoadingItems, unloadQtyValue, task.billedQty]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const ts = serverTimestamp();
            const currentName = user.displayName || user.email?.split('@')[0] || 'Supervisor';
            
            const payload: any = {
                plantId: task.plantId,
                vehicleNumber: task.vehicleNumber,
                driverMobile: task.driverMobile,
                purpose: task.purpose,
                from: task.from,
                shipTo: task.shipTo,
                destination: task.destination,
                assignedQty: task.assignedQty,
                billedQty: task.billedQty,
                remarks: values.remarks || '',
                supervisor: currentName,
                userId: user.uid,
                timestamp: ts,
                createdAt: ts
            };

            if (isOutward) {
                payload.loadingSlips = values.loadingItems?.map(i => ({ ...i, timestamp: new Date().toISOString() }));
                payload.totalDeliveryUnit = totals.delivery;
                payload.totalLoadUnit = totals.load;
                payload.totalBalanceUnit = totals.balance;
            } else {
                payload.unloadQty = values.unloadQty;
                payload.shortExcess = totals.diff;
            }

            await addDoc(collection(firestore, `plants/${task.plantId}/supervisor_tasks`), payload);
            
            const entryRef = doc(firestore, 'vehicleEntries', task.id);
            const tripId = task.tripId;
            const updateObj: any = {
                remarks: isOutward ? 'Loading Completed' : 'Unloading Completed',
                isTaskCompleted: true,
                isReadyForOut: true,
                statusUpdatedAt: ts,
                statusUpdatedBy: currentName
            };

            await updateDoc(entryRef, updateObj);

            // ERP Status Synchronization: Trip Status -> Loaded
            if (tripId) {
                const tripRef = doc(firestore, `plants/${task.plantId}/trips`, tripId);
                const globalTripRef = doc(firestore, 'trips', tripId);
                const tripUpdate = {
                    tripStatus: isOutward ? 'Loaded' : 'Delivered',
                    lastUpdated: ts
                };
                await updateDoc(tripRef, tripUpdate);
                await updateDoc(globalTripRef, tripUpdate);
            }

            await addDoc(collection(firestore, "activity_logs"), {
                userId: user.uid,
                userName: currentName,
                action: 'Create',
                tcode: 'Supervisor Task',
                pageName: 'Task Node',
                timestamp: ts,
                description: `Supervisor Task finalized for ${task.vehicleNumber}. Gate status updated: ${isOutward ? 'Loading Completed' : 'Unloading Completed'}.`
            });

            toast({ title: "Registry Handshake OK", description: "Task finalized. Vehicle marked as Ready for OUT." });
            onSuccess();
        } catch (e: any) {
            console.error("Task Commitment Error:", e);
            toast({ variant: 'destructive', title: "Commit Failed", description: e.message });
        } finally {
            hideLoader();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
                <DialogHeader className={cn("p-6 text-white shrink-0", isOutward ? "bg-blue-900" : "bg-orange-900")}>
                    <div className="flex justify-between items-center pr-12">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                {isOutward ? <Truck className="h-7 w-7 text-blue-400" /> : <LayersIcon className="h-7 w-7 text-orange-400" />}
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">
                                    {isOutward ? "Loading Details" : "Unloading Details"}
                                </DialogTitle>
                                <DialogDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest mt-1">
                                    Operator: {user?.email?.split('@')[0]} | Registry Handshake
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge className="bg-white/10 text-white border-white/20 font-black uppercase tracking-[0.2em] text-[10px] px-6 py-2 border shadow-lg">
                            Verified Mission Node
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col bg-[#f8fafc]">
                    <div className="p-8 bg-white border-b shadow-sm shrink-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                            {[
                                { label: 'Vehicle Number', value: task.vehicleNumber, icon: Truck, bold: true },
                                { label: 'Pilot Detail', value: task.driverMobile, icon: PhoneIcon, mono: true },
                                { label: 'Dispatch FROM', value: task.from, icon: Factory },
                                ...(isOutward ? [
                                    { label: 'Ship To Party', value: task.shipTo, icon: User },
                                    { label: 'Destination', value: task.destination, icon: MapPin },
                                    { label: 'Assigned Weight', value: `${task.assignedQty} MT`, icon: Calculator, color: 'text-blue-700', bold: true },
                                ] : [
                                    { label: 'Billed Quantity', value: `${task.billedQty} ${task.qtyType || 'MT'}`, icon: Calculator, color: 'text-orange-700', bold: true },
                                    { label: 'Inbound LR', value: task.lrNumber, icon: FileText, mono: true },
                                    { label: 'Inbound Invoice', value: task.invoiceNo, icon: FileText, mono: true },
                                    { label: 'Manifest Goods', value: task.goodsDesc, icon: InfoIcon },
                                ])
                            ].map((node, i) => (
                                <div key={i} className="flex flex-col gap-1.5">
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                        <node.icon className="h-2.5 w-2.5" /> {node.label}
                                    </span>
                                    <span className={cn(
                                        "text-[11px] font-bold truncate leading-tight uppercase",
                                        node.bold && "font-black text-slate-900",
                                        node.mono && "font-mono tracking-tighter text-blue-700",
                                        node.color
                                    )}>{node.value || '--'}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <Form {...form}>
                            <form className="p-10 space-y-10">
                                {isOutward ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between px-1">
                                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1">
                                                <Calculator className="h-4 w-4 text-blue-600" /> 1. Loading Details Registry
                                            </h3>
                                            <Button type="button" variant="outline" size="sm" onClick={() => append({ slipNo: '', invoiceNo: '', description: '', deliveryUnit: 0, loadUnit: 0, uom: 'MT', balanceUnit: 0 })} className="h-9 px-4 gap-2 font-black text-[10px] uppercase border-blue-200 text-blue-700 bg-white hover:bg-blue-50">
                                                <PlusCircle className="h-3.5 w-3.5" /> Add Row
                                            </Button>
                                        </div>
                                        <div className="rounded-3xl border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-slate-900">
                                                    <TableRow className="hover:bg-transparent border-none h-12">
                                                        <TableHead className="text-[10px] font-black uppercase text-white px-6">Delivery No</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase text-white px-4">Invoice No (Opt)</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase text-white px-4">Item Manifest *</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 text-center">Delivery Unit *</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 text-center">Load Unit *</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase text-white px-4 text-center">UOM *</TableHead>
                                                        <TableHead className="text-[10px] font-black uppercase text-white px-6 text-right">Balance Unit</TableHead>
                                                        <TableHead className="w-16"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {fields.map((field, idx) => (
                                                        <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-0 hover:bg-blue-50/10 group transition-colors">
                                                            <TableCell className="px-6 py-2">
                                                                <FormField name={`loadingItems.${idx}.slipNo`} control={control} render={({ field: itm }) => (
                                                                    <FormControl><Input placeholder="DEL-" className="h-10 border-slate-200 font-bold focus-visible:ring-blue-900" {...itm} /></FormControl>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="px-4 py-2">
                                                                <FormField name={`loadingItems.${idx}.invoiceNo`} control={control} render={({ field: itm }) => (
                                                                    <FormControl><Input placeholder="INV-" className="h-10 bg-transparent border-none shadow-none focus-visible:ring-0" {...itm} /></FormControl>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="px-4 py-2">
                                                                <FormField name={`loadingItems.${idx}.description`} control={control} render={({ field: itm }) => (
                                                                    <FormControl><Input placeholder="Goods particulars" className="h-10 border-slate-200 font-medium" {...itm} /></FormControl>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="px-4 py-2">
                                                                <FormField name={`loadingItems.${idx}.deliveryUnit`} control={control} render={({ field: itm }) => (
                                                                    <FormControl><Input type="number" step="0.001" className="h-10 border-slate-200 font-black text-center" {...itm} /></FormControl>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="px-4 py-2">
                                                                <FormField name={`loadingItems.${idx}.loadUnit`} control={control} render={({ field: itm }) => (
                                                                    <FormControl><Input type="number" step="0.001" className="h-10 border-slate-200 font-black text-center text-blue-900" {...itm} /></FormControl>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="px-4 py-2">
                                                                <FormField name={`loadingItems.${idx}.uom`} control={control} render={({ field: itm }) => (
                                                                    <Select onValueChange={itm.onChange} value={itm.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger className="h-10 border-slate-200 font-bold">
                                                                                <SelectValue placeholder="Unit" />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            {UOM_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="px-6 py-2 text-right">
                                                                <span className={cn("text-xs font-black", Number(watchedLoadingItems[idx]?.balanceUnit) > 0 ? "text-red-600" : "text-emerald-600")}>
                                                                    {Number(watchedLoadingItems[idx]?.balanceUnit || 0).toFixed(3)}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="pr-6">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-200 group-hover:text-red-600" onClick={() => remove(idx)} disabled={fields.length === 1}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                                <TableFooter className="bg-slate-50 border-t-2 border-slate-200 h-14">
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableCell colSpan={3} className="px-6 text-[10px] font-black uppercase text-slate-400">Total Loading Manifest Registry</TableCell>
                                                        <TableCell className="text-center font-black text-slate-900">{totals.delivery.toFixed(3)}</TableCell>
                                                        <TableCell className="text-center font-black text-blue-900">{totals.load.toFixed(3)}</TableCell>
                                                        <TableCell colSpan={1}></TableCell>
                                                        <TableCell className="text-right px-6 font-black text-red-600">{totals.balance.toFixed(3)}</TableCell>
                                                        <TableCell></TableCell>
                                                    </TableRow>
                                                </TableFooter>
                                            </Table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2 px-1">
                                            <Calculator className="h-4 w-4 text-orange-600" /> 1. Unloading Registry Audit
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 p-10 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl items-end relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12"><Calculator className="h-48 w-48" /></div>
                                            
                                            <FormField name="unloadQty" control={control} render={({ field }) => (
                                                <FormItem className="relative z-10">
                                                    <FormLabel className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Actual Unload Quantity ({task.qtyType || 'MT'}) *</FormLabel>
                                                    <FormControl><Input type="number" step="0.001" {...field} className="h-14 rounded-2xl font-black text-blue-900 text-2xl shadow-inner border-blue-900/20 focus-visible:ring-blue-900" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <div className="flex flex-col gap-2 relative z-10">
                                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Registry variance Result</span>
                                                <div className={cn(
                                                    "h-14 rounded-2xl flex items-center justify-between px-6 border-2 transition-all shadow-sm",
                                                    totals.diff === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : 
                                                    totals.isExcess ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-red-50 border-red-200 text-red-700"
                                                )}>
                                                    <span className="text-sm font-black uppercase tracking-tighter">
                                                        {totals.diff === 0 ? "MATCHED" : totals.isExcess ? "EXCESS (+)" : "SHORTAGE (-)"}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        {totals.diff === 0 ? <CheckCircle2 className="h-6 w-6" /> : 
                                                         totals.isExcess ? <PlusCircle className="h-6 w-6" /> : <MinusCircle className="h-6 w-6" />}
                                                        <span className="text-2xl font-black font-mono tracking-tighter">{Math.abs(totals.diff).toFixed(3)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(isOutward ? totals.balance > 0.001 : (totals as any).diff !== 0) && (
                                    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-red-600 flex items-center gap-2 px-1">
                                            <AlertTriangle className="h-4 w-4" /> 2. Mandatory Discrepancy Justification
                                        </h3>
                                        <FormField name="remarks" control={control} render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative group">
                                                        <Textarea 
                                                            {...field} 
                                                            placeholder="Describe reasons for quantity variance..."
                                                            className="min-h-[120px] rounded-[2rem] border-2 border-red-100 bg-red-50/30 p-8 font-medium focus-visible:ring-red-600 focus-visible:bg-white transition-all shadow-inner"
                                                        />
                                                        <div className="absolute top-4 right-6 text-red-300 group-focus-within:text-red-600 transition-colors">
                                                            <AlertCircle className="h-6 w-6" />
                                                        </div>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                )}
                            </form>
                        </Form>
                    </div>
                </div>

                <DialogFooter className="p-8 bg-slate-900 text-white shrink-0 flex flex-col md:flex-row items-center justify-between sm:justify-between border-t border-white/5">
                    <div className="flex items-center gap-10">
                        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 min-w-[220px]">
                            <History className="h-6 w-6 text-blue-400" />
                            <div>
                                <span className="text-[9px] font-black uppercase text-slate-500 block leading-none mb-1">Manifest Node Processing</span>
                                <p className="text-2xl font-black tracking-tighter leading-none">
                                    {isOutward ? `${totals.load.toFixed(3)} Units` : `${unloadQtyValue.toFixed(3)} ${task.qtyType || 'MT'}`}
                                </p>
                            </div>
                        </div>
                        {errors.remarks && (
                            <div className="flex items-center gap-2 text-red-400 animate-pulse bg-red-400/10 px-4 py-2 rounded-xl border border-red-400/20">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{errors.remarks.message}</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-4">
                        <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase text-[11px] tracking-widest px-8">Discard</Button>
                        <Button 
                            onClick={handleSubmit(onSubmit)} 
                            disabled={isSubmitting} 
                            className={cn(
                                "px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 border-none",
                                isOutward ? "bg-blue-600 hover:bg-blue-700 shadow-blue-900/50" : "bg-orange-600 hover:bg-orange-700 shadow-orange-900/50"
                            )}
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Post Task Registry
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const PhoneIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.79 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);

const LayersIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m2.2 17.62 8.97 4.07a2 2 0 0 0 1.66 0l8.97-4.07"/><path d="m2.2 12.62 8.97 4.07a2 2 0 0 0 1.66 0l8.97-4.07"/></svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
);
