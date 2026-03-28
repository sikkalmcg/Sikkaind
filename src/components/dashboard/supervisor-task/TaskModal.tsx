
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
    ShieldCheck, 
    Truck, 
    Smartphone, 
    Factory, 
    MapPin, 
    FileText, 
    Save, 
    Plus, 
    Trash2, 
    History,
    X,
    ClipboardList,
    Calculator,
    Loader2,
    UserCircle
} from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { doc, serverTimestamp, collection, runTransaction } from "firebase/firestore";
import { useLoading } from '@/context/LoadingContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LRUnitTypes } from '@/lib/constants';

const itemSchema = z.object({
    deliveryNo: z.string().optional(),
    invoiceNo: z.string().optional(),
    itemDescription: z.string().min(1, "Required"),
    deliveryUnit: z.coerce.number().min(0),
    loadUnit: z.coerce.number().min(0),
    uom: z.string().default('Bag'),
});

const formSchema = z.object({
    items: z.array(itemSchema).min(1, "Manifest node requires at least one row.")
});

type FormValues = z.infer<typeof formSchema>;

export default function TaskModal({ isOpen, onClose, task, onSuccess }: { isOpen: boolean; onClose: () => void; task: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        items: []
    }
  });

  const { control, handleSubmit, reset, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" }) || [];

  useEffect(() => {
    if (isOpen && task && fields.length === 0) {
        const initialItems = (task.shipmentItems || []).map((i: any) => ({
            deliveryNo: 'DEL-',
            invoiceNo: i.invoiceNumber ? `INV-${i.invoiceNumber}` : 'INV-',
            itemDescription: i.itemDescription || i.description || 'Goods particulars',
            deliveryUnit: Number(i.units) || 0,
            loadUnit: 0,
            uom: i.unitType || 'Bag'
        }));

        if (initialItems.length > 0) {
            reset({ items: initialItems });
        } else {
            append({ deliveryNo: 'DEL-', invoiceNo: 'INV-', itemDescription: 'Goods particulars', deliveryUnit: 0, loadUnit: 0, uom: 'Bag' });
        }
    }
  }, [isOpen, task, fields.length, append, reset]);

  const totals = useMemo(() => {
    return watchedItems.reduce((acc, curr) => {
        const d = Number(curr?.deliveryUnit) || 0;
        const l = Number(curr?.loadUnit) || 0;
        return {
            delivery: acc.delivery + d,
            load: acc.load + l,
            balance: acc.balance + (d - l)
        };
    }, { delivery: 0, load: 0, balance: 0 });
  }, [watchedItems]);

  const handleCommit = async (values: FormValues) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const plantId = task.plantId;
            const historyRef = doc(collection(firestore, `plants/${plantId}/supervisor_tasks`));
            
            if (task.entryData?.id) {
                const entryRef = doc(firestore, 'vehicleEntries', task.entryData.id);
                transaction.update(entryRef, { 
                    isTaskCompleted: true, 
                    verifiedItems: values.items,
                    taskCompletedAt: serverTimestamp(),
                    taskCompletedBy: user.displayName || user.email
                });
            }

            const tripRef = doc(firestore, `plants/${plantId}/trips`, task.realTripId);
            const globalTripRef = doc(firestore, 'trips', task.realTripId);
            const tripUpdate = {
                tripStatus: 'Loaded',
                loadingVerified: true,
                lastUpdated: serverTimestamp()
            };
            transaction.update(tripRef, tripUpdate);
            transaction.update(globalTripRef, tripUpdate);

            transaction.set(historyRef, {
                tripId: task.tripId,
                vehicleNumber: task.vehicleNumber,
                purpose: task.purpose,
                assignedQty: task.assignedQty,
                manifestTotals: totals,
                items: values.items,
                timestamp: serverTimestamp(),
                supervisor: user.displayName || user.email,
                originPlantId: plantId
            });
        });

        toast({ title: 'Task Verified', description: 'Yard loading manifest synchronized with registry.' });
        onSuccess();
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Registry Error', description: e.message });
    } finally {
        hideLoader();
    }
  };

  const manifestHeaderNodes = [
    { label: 'Vehicle Number', value: task.vehicleNumber, icon: Truck },
    { label: 'Pilot Detail', value: task.driverMobile, icon: Smartphone, color: 'text-blue-600' },
    { label: 'Dispatch From', value: task.from, icon: Factory },
    { label: 'Ship To Party', value: task.shipTo, icon: UserCircle },
    { label: 'Destination', value: task.destination, icon: MapPin },
    { label: 'Assigned Weight', value: `${task.assignedQty} MT`, icon: FileText, bold: true, color: 'text-blue-900' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-3xl">
        <DialogHeader className="p-8 bg-blue-900 text-white shrink-0 pr-12">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-5">
                <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
                    <Truck className="h-8 w-8 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-3xl font-black uppercase tracking-tight italic leading-none">LOADING DETAILS</DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-[0.2em] mt-2">
                        OPERATOR: {(user?.displayName || user?.email || 'SIKKAIND.ADMIN').toUpperCase()} | REGISTRY HANDSHAKE
                    </DialogDescription>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Badge variant="outline" className="bg-white/10 border-white/10 text-white font-black uppercase text-[10px] px-6 h-10 border-none rounded-full">VERIFIED MISSION NODE</Badge>
                <button onClick={onClose} className="h-10 w-10 bg-white p-0 text-red-600 hover:bg-red-50 transition-all rounded-xl shadow-lg flex items-center justify-center border-none">
                    <X className="h-6 w-6 stroke-[3]" />
                </button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-10 py-6 border-b bg-white shrink-0">
            <div className="grid grid-cols-6 gap-8">
                {manifestHeaderNodes.map((node, i) => (
                    <div key={i} className="space-y-1.5">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <node.icon className="h-3 w-3" /> {node.label}
                        </span>
                        <p className={cn(
                            "text-[11px] uppercase leading-tight truncate",
                            node.bold ? "font-black text-slate-900" : "font-black text-slate-700",
                            node.color
                        )}>{node.value}</p>
                    </div>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-10 bg-[#f8fafc]">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-blue-600" /> 1. LOADING DETAILS REGISTRY
                </h3>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => append({ deliveryNo: 'DEL-', invoiceNo: 'INV-', itemDescription: 'Goods particulars', deliveryUnit: 0, loadUnit: 0, uom: 'Bag' })}
                    className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-blue-200 text-blue-700 bg-white shadow-md hover:bg-blue-50 transition-all active:scale-95"
                >
                    <Plus className="h-4 w-4" /> ADD ROW
                </Button>
            </div>

            <div className="rounded-3xl border-2 border-slate-200 bg-white shadow-2xl overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-900">
                        <TableRow className="hover:bg-transparent border-none h-14">
                            <TableHead className="text-white text-[10px] font-black uppercase px-8 w-48">DELIVERY NO</TableHead>
                            <TableHead className="text-white text-[10px] font-black uppercase px-4 w-48">INVOICE NO (OPT)</TableHead>
                            <TableHead className="text-white text-[10px] font-black uppercase px-4">ITEM DESCRIPTION *</TableHead>
                            <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center w-36">DELIVERY UNIT *</TableHead>
                            <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center w-36">LOAD UNIT *</TableHead>
                            <TableHead className="text-white text-[10px] font-black uppercase px-4 text-center w-32">UOM *</TableHead>
                            <TableHead className="text-white text-[10px] font-black uppercase px-8 text-right w-40">BALANCE UNIT</TableHead>
                            <TableHead className="w-16"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => {
                            const dUnit = Number(watchedItems[index]?.deliveryUnit) || 0;
                            const lUnit = Number(watchedItems[index]?.loadUnit) || 0;
                            const balance = dUnit - lUnit;

                            return (
                                <TableRow key={field.id} className="h-16 border-b border-slate-100 last:border-0 hover:bg-blue-50/10 transition-colors group">
                                    <TableCell className="px-8 py-3">
                                        <Input {...form.register(`items.${index}.deliveryNo`)} className="h-11 bg-slate-50 border-slate-200 rounded-xl font-bold uppercase text-xs" />
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-center">
                                        <Input {...form.register(`items.${index}.invoiceNo`)} className="h-11 bg-transparent border-none shadow-none focus-visible:ring-0 text-slate-400 font-bold uppercase text-center text-xs" />
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <Input {...form.register(`items.${index}.itemDescription`)} className="h-11 bg-slate-50 border-slate-200 rounded-xl font-bold italic text-slate-500 text-xs" />
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <Input type="number" {...form.register(`items.${index}.deliveryUnit`)} className="h-11 text-center font-black text-slate-900 bg-slate-50 border-slate-200 rounded-xl text-lg" />
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <Input type="number" {...form.register(`items.${index}.loadUnit`)} className="h-11 text-center font-black text-blue-900 bg-white border-blue-900/20 rounded-xl text-lg shadow-inner focus-visible:ring-blue-900" />
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <Select onValueChange={(val) => setValue(`items.${index}.uom`, val)} defaultValue={watchedItems[index]?.uom || 'Bag'}>
                                            <SelectTrigger className="h-11 bg-transparent border-none shadow-none focus:ring-0 font-bold text-xs uppercase">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {LRUnitTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="px-8 py-3 text-right">
                                        <span className={cn(
                                            "font-black text-lg tracking-tighter",
                                            Math.abs(balance) > 0.001 ? "text-red-600" : "text-emerald-600"
                                        )}>
                                            {balance.toFixed(3)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="pr-6">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1} className="h-8 w-8 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter className="bg-slate-50 border-t-2 border-slate-200 h-16">
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={3} className="px-8 text-[10px] font-black uppercase text-slate-400 tracking-widest">TOTAL LOADING MANIFEST REGISTRY</TableCell>
                            <TableCell className="text-center font-black text-lg text-slate-900">{totals.delivery.toFixed(3)}</TableCell>
                            <TableCell className="text-center font-black text-lg text-blue-900">{totals.load.toFixed(3)}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right px-8 font-black text-xl text-red-600 tracking-tighter">{totals.balance.toFixed(3)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </div>

        <DialogFooter className="p-10 bg-slate-950 shrink-0 flex flex-col md:flex-row items-center justify-between sm:justify-between border-t border-white/5">
            <div className="flex items-center gap-6 px-8 py-4 bg-white/5 rounded-3xl border border-white/10 shadow-2xl">
                <div className="p-3 bg-blue-600/20 rounded-2xl"><Calculator className="h-6 w-6 text-blue-400" /></div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">MANIFEST NODE PROCESSING</span>
                    <span className="text-3xl font-black text-white tracking-tighter leading-none">{totals.load.toFixed(3)} Units</span>
                </div>
            </div>

            <div className="flex gap-10 items-center">
                <button onClick={onClose} className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-all">DISCARD</button>
                <Button 
                    onClick={form.handleSubmit(handleCommit)} 
                    disabled={form.formState.isSubmitting} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-20 h-16 rounded-[1.5rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95 border-none"
                >
                    {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <Save className="h-5 w-5 mr-3" />}
                    POST TASK REGISTRY
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
