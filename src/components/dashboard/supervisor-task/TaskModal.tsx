'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
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
    X, 
    ClipboardList, 
    Calculator, 
    Loader2, 
    UserCircle,
    MessageSquare,
    AlertTriangle,
    Package
} from 'lucide-react';
import { useFirestore, useUser } from "@/firebase";
import { doc, serverTimestamp, collection, runTransaction } from "firebase/firestore";
import { useLoading } from '@/context/LoadingContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LRUnitTypes } from '@/lib/constants';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';

const itemSchema = z.object({
    deliveryNo: z.string().min(1, "Delivery number is mandatory."),
    invoiceNo: z.string().optional().default(''),
    itemDescription: z.string().min(1, "Required"),
    plannedUnit: z.coerce.number().default(0),
    loadUnit: z.coerce.number().min(0, "Must be positive"),
    uom: z.string().min(1, "UOM selection is mandatory."),
});

const formSchema = z.object({
    remarks: z.string().optional().default(''),
    items: z.array(itemSchema).min(1, "Manifest node requires at least one row.")
});

type FormValues = z.infer<typeof formSchema>;

export default function TaskModal({ isOpen, onClose, task, onSuccess }: { isOpen: boolean; onClose: () => void; task: any; onSuccess: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const [initializedTaskId, setInitializedTaskId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
        remarks: '',
        items: []
    }
  });

  const { control, handleSubmit, reset, setValue, formState: { isSubmitting, isValid } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" }) || [];

  // STABLE REGISTRY INITIALIZATION Node
  useEffect(() => {
    if (isOpen && task && initializedTaskId !== task.id) {
        setInitializedTaskId(task.id);
        
        if (task.isHistoryEdit) {
            reset({
                remarks: task.remarks || '',
                items: task.items || []
            });
        } else {
            const initialItems = (task.shipmentItems || []).map((i: any) => ({
                deliveryNo: '',
                invoiceNo: i.invoiceNumber || '',
                itemDescription: i.itemDescription || i.description || task.itemDescription || 'Goods particulars',
                plannedUnit: Number(i.units) || Number(task.plannedUnits) || 0,
                loadUnit: Number(i.units) || Number(task.plannedUnits) || 0,
                uom: i.unitType || 'Package'
            }));

            if (initialItems.length > 0) {
                reset({ remarks: '', items: initialItems });
            } else {
                reset({ remarks: '', items: [] });
                append({ 
                    deliveryNo: '', 
                    invoiceNo: '', 
                    itemDescription: 'Goods particulars', 
                    plannedUnit: Number(task.plannedUnits) || 0, 
                    loadUnit: Number(task.plannedUnits) || 0, 
                    uom: 'Package' 
                });
            }
        }
    } else if (!isOpen) {
        setInitializedTaskId(null);
    }
  }, [isOpen, task, initializedTaskId, reset, append]);

  const totals = useMemo(() => {
    return watchedItems.reduce((acc, curr) => ({
        load: acc.load + (Number(curr?.loadUnit) || 0),
    }), { load: 0 });
  }, [watchedItems]);

  const unitMismatch = totals.load - task.plannedUnits;

  const handleCommit = async (values: FormValues) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const plantId = task.plantId || task.originPlantId;
            const historyId = task.isHistoryEdit ? task.id : doc(collection(firestore, `plants/${plantId}/supervisor_tasks`)).id;
            const historyRef = doc(firestore, `plants/${plantId}/supervisor_tasks`, historyId);
            
            if (!task.isHistoryEdit && task.entryData?.id) {
                const entryRef = doc(firestore, 'vehicleEntries', task.entryData.id);
                transaction.update(entryRef, { 
                    isTaskCompleted: true, 
                    verifiedItems: values.items,
                    taskCompletedAt: serverTimestamp(),
                    taskCompletedBy: user.displayName || user.email
                });
            }

            const realTripId = task.isHistoryEdit ? (task.realTripId || task.tripDocId) : task.realTripId;
            if (realTripId) {
                const tripRef = doc(firestore, `plants/${plantId}/trips`, realTripId);
                const globalTripRef = doc(firestore, 'trips', realTripId);
                const tripUpdate = {
                    tripStatus: 'Loaded',
                    loadingVerified: true,
                    lastUpdated: serverTimestamp()
                };
                transaction.update(tripRef, tripUpdate);
                transaction.update(globalTripRef, tripUpdate);
            }

            const currentName = user.displayName || user.email;
            const historyData: any = {
                tripId: task.tripId,
                vehicleNumber: task.vehicleNumber,
                purpose: task.purpose,
                assignedQty: task.assignedQty,
                plannedUnits: task.plannedUnits,
                manifestTotals: totals,
                items: values.items,
                remarks: values.remarks || '',
                timestamp: task.isHistoryEdit ? task.timestamp : serverTimestamp(),
                lastModified: serverTimestamp(),
                supervisor: task.isHistoryEdit ? task.supervisor : currentName,
                modifiedBy: currentName,
                originPlantId: plantId,
                consignor: task.consignor || task.from || '--',
                shipTo: task.shipTo || '--',
                realTripId: realTripId || null
            };

            transaction.set(historyRef, historyData, { merge: true });
        });

        toast({ title: task.isHistoryEdit ? 'Registry Corrected' : 'Task Verified', description: 'Manifest synchronized with mission registry.' });
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
    { label: 'Dispatch From', value: task.from || task.consignor, icon: Factory },
    { label: 'Ship To Party', value: task.shipTo, icon: UserCircle },
    { label: 'Destination', value: task.destination || task.shipTo, icon: MapPin },
    { label: 'Planned Units', value: `${task.plannedUnits} Units`, icon: ClipboardList, bold: true, color: 'text-blue-900' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] md:h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2rem] md:rounded-3xl">
        <DialogHeader className="p-4 md:p-5 bg-slate-900 text-white shrink-0 pr-12">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 md:gap-4">
                <div className="p-2 md:p-2.5 bg-white/10 rounded-xl border border-white/20">
                    <Truck className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <div>
                    <DialogTitle className="text-lg md:text-2xl font-black uppercase tracking-tight italic leading-none">
                        {task.isHistoryEdit ? "CORRECT MANIFEST" : "VERIFY MANIFEST"}
                    </DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[7px] md:text-[8px] tracking-[0.2em] mt-1">
                        REGISTRY HANDSHAKE NODE
                    </DialogDescription>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Badge variant="outline" className="hidden sm:flex bg-white/10 border-white/10 text-emerald-400 font-black uppercase text-[9px] px-4 h-8 border-none rounded-full">
                    {task.isHistoryEdit ? "ADMIN OVERRIDE" : "VERIFIED NODE"}
                </Badge>
                <button onClick={onClose} className="h-8 w-8 bg-white p-0 text-red-600 hover:bg-red-50 transition-all rounded-lg shadow-lg flex items-center justify-center border-none">
                    <X className="h-5 w-5 stroke-[3]" />
                </button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 md:px-10 py-2 md:py-3 border-b bg-white shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-8">
                {manifestHeaderNodes.map((node, i) => (
                    <div key={i} className="space-y-0.5">
                        <span className="text-[7px] md:text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 leading-none">
                            {node.icon && <node.icon className="h-2 w-2" />} {node.label}
                        </span>
                        <p className={cn(
                            "text-[10px] md:text-[11px] uppercase leading-tight truncate",
                            node.bold ? "font-black text-slate-900" : "font-black text-slate-700",
                            node.color
                        )}>{node.value}</p>
                    </div>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-8 bg-[#f8fafc]">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                    <ClipboardList className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-600" /> PHYSICAL LOADING MANIFEST
                </h3>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => append({ deliveryNo: '', invoiceNo: '', itemDescription: 'Goods particulars', plannedUnit: 0, loadUnit: 0, uom: 'Package' })}
                    className="h-8 md:h-9 px-3 md:px-5 gap-2 font-black text-[8px] md:text-[10px] uppercase border-blue-200 text-blue-700 bg-white hover:bg-blue-50 shadow-md transition-all active:scale-95"
                >
                    <Plus className="h-3 w-3" /> ADD ROW
                </Button>
            </div>

            {/* HIGH-FIDELITY TABLE VIEW */}
            <div className="hidden md:block rounded-2xl border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-900">
                        <TableRow className="hover:bg-transparent border-none h-12">
                            <TableHead className="text-white text-[9px] font-black uppercase px-8 w-48">DELIVERY NO *</TableHead>
                            <TableHead className="text-white text-[9px] font-black uppercase px-4 w-48">INVOICE NO</TableHead>
                            <TableHead className="text-white text-[9px] font-black uppercase px-4">ITEM DESCRIPTION *</TableHead>
                            <TableHead className="text-white text-[9px] font-black uppercase px-4 text-center w-32">LOAD UNIT *</TableHead>
                            <TableHead className="text-white text-[9px] font-black uppercase px-4 text-center w-28">UOM *</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => (
                            <TableRow key={field.id} className="h-14 border-b border-slate-100 last:border-0 hover:bg-blue-50/10 transition-colors group">
                                <TableCell className="px-8 py-2">
                                    <Controller
                                        name={`items.${index}.deliveryNo`}
                                        control={control}
                                        render={({ field }) => (
                                            <Input {...field} placeholder="Delivery#" className="h-9 bg-slate-50 border-slate-200 rounded-lg font-bold uppercase text-[11px]" />
                                        )}
                                    />
                                </TableCell>
                                <TableCell className="px-4 py-2">
                                    <Controller
                                        name={`items.${index}.invoiceNo`}
                                        control={control}
                                        render={({ field }) => (
                                            <Input {...field} placeholder="Invoice#" className="h-9 bg-slate-50 border-slate-200 rounded-lg font-bold uppercase text-[11px]" />
                                        )}
                                    />
                                </TableCell>
                                <TableCell className="px-4 py-2">
                                    <Controller
                                        name={`items.${index}.itemDescription`}
                                        control={control}
                                        render={({ field }) => (
                                            <Input {...field} className="h-9 bg-slate-50 border-slate-200 rounded-lg font-bold italic text-slate-500 text-[11px]" />
                                        )}
                                    />
                                </TableCell>
                                <TableCell className="px-4 py-2">
                                    <Controller
                                        name={`items.${index}.loadUnit`}
                                        control={control}
                                        render={({ field }) => (
                                            <Input type="number" {...field} className="h-9 text-center font-black text-blue-900 bg-white border-blue-900/20 rounded-lg text-sm shadow-inner focus-visible:ring-blue-900" />
                                        )}
                                    />
                                </TableCell>
                                <TableCell className="px-4 py-2">
                                    <Controller
                                        name={`items.${index}.uom`}
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="h-9 bg-transparent border-none shadow-none focus:ring-0 font-black text-[10px] uppercase text-center">
                                                    <SelectValue placeholder="SELECT" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {LRUnitTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </TableCell>
                                <TableCell className="pr-4 text-right">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1} className="h-7 w-7 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter className="bg-slate-50 border-t-2 border-slate-200 h-12">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableCell colSpan={3} className="px-8 text-[9px] font-black uppercase text-slate-400 tracking-widest">TOTAL MANIFEST REGISTRY</TableCell>
                            <TableCell className="text-center font-black text-sm text-blue-900">{totals.load.toFixed(0)} Units</TableCell>
                            <TableCell colSpan={2}></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>

            {/* MOBILE CARD VIEW */}
            <div className="md:hidden space-y-4">
                {fields.map((field, index) => (
                    <Card key={field.id} className="p-5 rounded-[1.5rem] border-2 border-slate-100 shadow-lg bg-white relative group">
                        <div className="flex items-center justify-between mb-4">
                            <Badge className="bg-slate-900 text-white font-black uppercase text-[9px] px-3 h-5">ITEM {index + 1}</Badge>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1} className="h-7 w-7 text-red-400 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[8px] font-black uppercase text-slate-400">Delivery No *</Label>
                                <Controller name={`items.${index}.deliveryNo`} control={control} render={({field}) => <Input {...field} className="h-10 rounded-lg bg-slate-50 border-slate-200 font-bold text-[11px]" />} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[8px] font-black uppercase text-slate-400">Invoice No</Label>
                                <Controller name={`items.${index}.invoiceNo`} control={control} render={({field}) => <Input {...field} className="h-10 rounded-lg bg-slate-50 border-slate-200 font-bold text-[11px]" />} />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[8px] font-black uppercase text-slate-400">Item Description *</Label>
                                <Controller name={`items.${index}.itemDescription`} control={control} render={({field}) => <Input {...field} className="h-10 rounded-lg bg-slate-50 border-slate-200 font-bold text-[11px]" />} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[8px] font-black uppercase text-blue-600">Load Unit *</Label>
                                <Controller name={`items.${index}.loadUnit`} control={control} render={({field}) => <Input type="number" {...field} className="h-10 text-center font-black text-blue-900 bg-blue-50 border-blue-100 rounded-lg text-sm shadow-inner" />} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[8px] font-black uppercase text-slate-400">UOM *</Label>
                                <Controller name={`items.${index}.uom`} control={control} render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="h-10 rounded-lg font-bold text-[11px]">
                                            <SelectValue placeholder="SELECT" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            {LRUnitTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )} />
                            </div>
                        </div>
                    </Card>
                ))}
                
                <div className="p-4 bg-blue-900 rounded-2xl text-white flex items-center justify-between shadow-xl">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Aggregate Units</span>
                    <span className="text-xl font-black tracking-tighter">{totals.load.toFixed(0)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <Card className="p-5 md:p-6 border-2 border-slate-100 shadow-xl rounded-2xl bg-white space-y-3">
                    <div className="flex items-center gap-3 px-1 border-b pb-2">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                        <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Audit Ledger Remarks</h4>
                    </div>
                    <Textarea 
                        {...form.register('remarks')}
                        placeholder="Provide mission context or variance justification..." 
                        className="min-h-[80px] md:min-h-[100px] rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 italic text-[13px]"
                    />
                </Card>
            </div>
        </div>

        {unitMismatch !== 0 && (
            <div className={cn(
                "px-6 md:px-10 py-3 border-t border-b flex items-center justify-center md:justify-end animate-in slide-in-from-bottom-2 duration-300 shrink-0",
                unitMismatch > 0 ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"
            )}>
                <div className="flex items-center gap-3 text-center md:text-left">
                    <AlertTriangle className={cn("h-4 w-4 md:h-5 md:w-5", unitMismatch > 0 ? "text-amber-600" : "text-red-600 animate-pulse")} />
                    <div className="flex flex-col">
                        <span className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]", unitMismatch > 0 ? "text-amber-900" : "text-red-900")}>
                            {unitMismatch > 0 ? "OVER-LOADING DETECTED" : "UNDER-LOADING DETECTED"}
                        </span>
                        <p className={cn("text-[8px] md:text-[9px] font-bold uppercase opacity-70 mt-0.5", unitMismatch > 0 ? "text-amber-800" : "text-red-800")}>
                            Variance: {unitMismatch > 0 ? `+${unitMismatch}` : unitMismatch} Units from Planned manifest.
                        </p>
                    </div>
                </div>
            </div>
        )}

        <DialogFooter className="p-4 md:p-5 bg-slate-950 shrink-0 flex flex-col md:flex-row items-center justify-between sm:justify-between border-t border-white/5 gap-4 md:gap-0">
            <div className="flex items-center gap-4 px-4 md:px-6 py-2 md:py-3 bg-white/5 rounded-2xl border border-white/10 shadow-2xl w-full md:w-auto">
                <div className="p-1.5 md:p-2 bg-blue-600/20 rounded-xl"><Calculator className="h-4 w-4 md:h-5 md:w-5 text-blue-400" /></div>
                <div className="flex flex-col">
                    <span className="text-[7px] md:text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mb-0.5">MANIFEST PROCESSING</span>
                    <span className="text-lg md:text-2xl font-black text-white tracking-tighter leading-none">{totals.load.toFixed(0)} Units</span>
                </div>
            </div>

            <div className="flex gap-6 md:gap-8 items-center w-full md:w-auto justify-center md:justify-end">
                <button onClick={onClose} className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-all">DISCARD</button>
                <Button 
                    onClick={handleSubmit(handleCommit)} 
                    disabled={isSubmitting || !isValid} 
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1 md:flex-none px-8 md:px-12 h-11 md:h-12 rounded-xl md:rounded-[1rem] font-black uppercase text-[9px] md:text-xs tracking-[0.2em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95 border-none disabled:opacity-20 disabled:grayscale"
                >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />}
                    {task.isHistoryEdit ? 'UPDATE AUDIT' : 'POST REGISTRY'}
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
