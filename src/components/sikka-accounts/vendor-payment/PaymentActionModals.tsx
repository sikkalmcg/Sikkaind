'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
    Loader2, 
    Save, 
    CreditCard, 
    ShieldCheck, 
    History, 
    Calculator,
    AlertCircle,
    CheckCircle2,
    Edit2,
    Lock,
    Trash2,
    AlertTriangle,
    Truck,
    X as XIcon
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VendorInvoice, WithId, Party } from '@/types';
import { VendorPaymentModes } from '@/lib/constants';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useLoading } from '@/context/LoadingContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const formSchema = z.object({
  payAmount: z.coerce.number().positive("Pay amount must be positive."),
  tdsAmount: z.coerce.number().min(0).default(0),
  deductionAmount: z.coerce.number().min(0).default(0),
  deductionRemark: z.string().optional().refine(v => {
    if (!v) return true;
    const words = v.trim().split(/\s+/).filter(Boolean);
    return words.length <= 30;
  }, "Maximum 30 words allowed."),
  payDate: z.date({ required_error: "Payment date is required." }),
  bankRef: z.string().min(1, "Bank Reference (UTR) is mandatory."),
  paymentMode: z.enum(VendorPaymentModes, { required_error: "Payment mode is mandatory." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function PaymentActionModals({ 
    isOpen, 
    onClose, 
    type, 
    invoice,
    vendors
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    type: 'Pay' | 'Edit'; 
    invoice: WithId<VendorInvoice>;
    vendors: Party[];
}) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();
    
    const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
    
    const vendorNode = vendors.find(v => v.id === invoice.vendorId);
    
    // RESILIENT REGISTRY NODE: Use fallback hierarchy for gross liability
    const taxableValue = Number(invoice.taxableAmount || invoice.taxable || 0);
    const grossAmount = Number(invoice.grossAmount || invoice.payableAmount || taxableValue || 0);
    
    const totalPaidAlready = (invoice.payments || []).reduce((sum, p) => sum + (p.paidAmount || 0) + (p.tdsAmount || 0) + (p.deductionAmount || 0), 0);
    const currentBalance = grossAmount - totalPaidAlready;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            payAmount: 0,
            tdsAmount: 0,
            deductionAmount: 0,
            deductionRemark: '',
            payDate: new Date(),
            bankRef: '',
            paymentMode: 'Banking'
        }
    });

    const { watch, handleSubmit, reset, setValue, formState: { isSubmitting, errors } } = form;
    const { payAmount, tdsAmount, deductionAmount } = watch();
    
    const currentEntryTotal = (Number(payAmount) || 0) + (Number(tdsAmount) || 0) + (Number(deductionAmount) || 0);

    const isAdminSession = useMemo(() => {
        return user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
    }, [user]);

    // Handle initial state and mode switching
    useEffect(() => {
        if (isOpen) {
            setSelectedPaymentId(null);
            if (type === 'Pay') {
                reset({
                    payAmount: currentBalance > 0 ? Number(currentBalance.toFixed(2)) : 0,
                    tdsAmount: 0,
                    deductionAmount: 0,
                    deductionRemark: '',
                    payDate: new Date(),
                    bankRef: '',
                    paymentMode: 'Banking'
                });
            } else {
                reset({
                    payAmount: 0,
                    tdsAmount: 0,
                    deductionAmount: 0,
                    deductionRemark: '',
                    payDate: new Date(),
                    bankRef: '',
                    paymentMode: 'Banking'
                });
            }
        }
    }, [isOpen, type, currentBalance, reset]);

    // Handle selection of a specific payment node for correction
    useEffect(() => {
        if (type === 'Edit' && selectedPaymentId && invoice.payments) {
            const p = invoice.payments.find(x => x.id === selectedPaymentId);
            if (p) {
                setValue('payAmount', p.paidAmount || 0);
                setValue('tdsAmount', p.tdsAmount || 0);
                setValue('deductionAmount', p.deductionAmount || 0);
                setValue('deductionRemark', p.deductionReason || p.deductionRemark || '');
                setValue('payDate', p.paymentDate instanceof Date ? p.paymentDate : (p.paymentDate as any).toDate());
                setValue('bankRef', p.paymentRefNo || '');
                setValue('paymentMode', p.paymentMode as any || 'Banking');
            }
        }
    }, [selectedPaymentId, type, invoice.payments, setValue]);

    const finalBalance = useMemo(() => {
        if (type === 'Pay') {
            return currentBalance - currentEntryTotal;
        } else {
            if (!selectedPaymentId) return currentBalance;
            const p = invoice.payments.find(x => x.id === selectedPaymentId);
            const oldVal = (p?.paidAmount || 0) + (p?.tdsAmount || 0) + (p?.deductionAmount || 0);
            const poolAvailable = currentBalance + oldVal;
            return poolAvailable - currentEntryTotal;
        }
    }, [type, currentBalance, currentEntryTotal, invoice.payments, selectedPaymentId]);

    const handleDeletePayment = async (pId: string) => {
        if (!firestore || !user) return;
        showLoader();
        
        try {
            const updatedPayments = (invoice.payments || []).filter(p => p.id !== pId);
            const totalPaidNew = updatedPayments.reduce((s, p) => s + (p.paidAmount || 0) + (p.tdsAmount || 0) + (p.deductionAmount || 0), 0);
            const statusNew = totalPaidNew >= (grossAmount - 0.01) ? 'Closed' : (totalPaidNew > 0 ? 'Partially Paid' : 'Open');
            
            const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
            const docRef = doc(firestore, "vendor_invoices", invoice.id);
            
            const updateData = {
                payments: updatedPayments,
                paymentStatus: statusNew,
                lastUpdatedAt: serverTimestamp(),
                updatedBy: currentName
            };

            updateDoc(docRef, updateData)
                .then(() => {
                    toast({ title: "Registry Purged", description: `Transaction record removed from database.` });
                    if (selectedPaymentId === pId) {
                        setSelectedPaymentId(null);
                        reset();
                    }
                })
                .catch(async (error) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: docRef.path,
                        operation: 'update',
                        requestResourceData: updateData
                    } satisfies SecurityRuleContext));
                })
                .finally(() => hideLoader());
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Purge Failed", description: error.message });
            hideLoader();
        }
    };

    const onSubmit = (values: FormValues) => {
        if (!firestore || !user) return;

        if (finalBalance < -0.01) {
            toast({ 
                variant: 'destructive', 
                title: "Over-payment Blocked", 
                description: `Proposed total exceeds gross invoice liability by ₹${Math.abs(finalBalance).toLocaleString()}.` 
            });
            return;
        }

        const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
        const docRef = doc(firestore, "vendor_invoices", invoice.id);
        let updateData: any = {};

        if (type === 'Pay') {
            const paymentEntry = {
                id: `vpay-${Date.now()}`,
                invoiceId: invoice.id,
                paidAmount: values.payAmount,
                tdsAmount: values.tdsAmount,
                deductionAmount: values.deductionAmount,
                deductionRemark: values.deductionRemark || '',
                paymentMode: values.paymentMode,
                paymentRefNo: values.bankRef,
                paymentDate: values.payDate,
                createdBy: currentName,
                createdAt: new Date(),
                balanceAfterPayment: finalBalance
            };

            updateData = {
                payments: arrayUnion(paymentEntry),
                paymentStatus: finalBalance <= 0.01 ? 'Closed' : 'Partially Paid',
                lastUpdatedAt: serverTimestamp()
            };
        } else {
            if (!selectedPaymentId) return;

            const updatedPayments = (invoice.payments || []).map(p => {
                if (p.id === selectedPaymentId) {
                    return {
                        ...p,
                        paidAmount: values.payAmount,
                        tdsAmount: values.tdsAmount,
                        deductionAmount: values.deductionAmount,
                        deductionRemark: values.deductionRemark || '',
                        paymentMode: values.paymentMode,
                        paymentRefNo: values.bankRef,
                        paymentDate: values.payDate,
                        updatedBy: currentName,
                        lastModifiedAt: new Date(),
                        balanceAfterPayment: finalBalance
                    };
                }
                return p;
            });

            const totalPaidNew = updatedPayments.reduce((s, p) => s + (p.paidAmount || 0) + (p.tdsAmount || 0) + (p.deductionAmount || 0), 0);
            const statusNew = totalPaidNew >= (grossAmount - 0.01) ? 'Closed' : (totalPaidNew > 0 ? 'Partially Paid' : 'Open');

            updateData = {
                payments: updatedPayments,
                paymentStatus: statusNew,
                lastUpdatedAt: serverTimestamp(),
                updatedBy: currentName
            };
        }

        showLoader();
        updateDoc(docRef, updateData)
            .then(() => {
                toast({ title: "Registry Handshake OK", description: `Transaction committed to cloud.` });
                onClose();
            })
            .catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: updateData
                } satisfies SecurityRuleContext));
            })
            .finally(() => hideLoader());
    };

    // F-Key Registry Listener: F8 Execute
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F8') {
                e.preventDefault();
                handleSubmit(onSubmit)();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSubmit, onSubmit]);

    const infoNodes = [
        { label: 'Invoice Number', value: invoice.invoiceNo, mono: true, bold: true, color: 'text-blue-700' },
        { label: 'Invoice Date', value: invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'dd.MM.yyyy') : '--' },
        { label: 'Vendor Registry', value: invoice.vendorName },
        { label: 'GSTIN Registry', value: invoice.vendorGstin || '--', mono: true },
        { label: 'GROSS INVOICE AMOUNT', value: `₹ ${grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, highlight: true },
        { label: 'Invoice current Balance', value: `₹ ${currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, red: currentBalance > 0.01 },
        { label: 'Bank Name', value: vendorNode?.bankName || '--' },
        { label: 'A/C Number', value: vendorNode?.accountNumber || '--', mono: true },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[75vw] w-[1200px] h-[90vh] flex flex-col p-0 border-none shadow-3xl overflow-hidden bg-white">
                <DialogHeader className={cn("p-6 text-white shrink-0", type === 'Pay' ? "bg-blue-900" : "bg-slate-900")}>
                    <div className="flex justify-between items-center pr-12">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                <CreditCard className="h-7 w-7 text-blue-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">
                                    {type === 'Pay' ? "F110 – RECORD VENDOR PAYMENT" : "F110 – CORRECT PAYMENT REGISTRY"}
                                </DialogTitle>
                                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                                    Financial Liquidation Handshake Node
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-white/10 text-white border-white/20 font-black px-4 py-1.5 uppercase text-[10px] tracking-[0.2em]">
                            Registry Security: {invoice.invoiceNo}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc] space-y-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-8 bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {infoNodes.map((node, i) => (
                            <div key={i} className={cn("flex flex-col gap-1.5", node.highlight && "col-span-1")}>
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{node.label}</span>
                                <span className={cn(
                                    "text-sm font-bold truncate",
                                    node.mono && "font-mono tracking-tighter",
                                    node.bold && "font-black",
                                    node.color,
                                    node.highlight && "text-blue-900 font-black",
                                    node.red && "text-red-600 font-black"
                                )}>{node.value}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                            <History className="h-4 w-4 text-blue-600" /> Paid History change
                        </h3>
                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow className="hover:bg-transparent text-[10px] font-black uppercase text-slate-400 h-12">
                                        <TableHead className="px-6">Date</TableHead>
                                        <TableHead className="px-4">Bank Ref (UTR)</TableHead>
                                        <TableHead className="px-4">Mode</TableHead>
                                        <TableHead className="px-4 text-right">Receipt (₹)</TableHead>
                                        <TableHead className="px-4 text-right">TDS (₹)</TableHead>
                                        <TableHead className="px-4 text-right text-red-600">Deduction (₹)</TableHead>
                                        <TableHead className="px-6 text-right">Aggregate</TableHead>
                                        <TableHead className="w-24 text-center px-4">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(invoice.payments || []).length === 0 ? (
                                        <TableRow><TableCell colSpan={8} className="h-20 text-center text-slate-400 italic text-xs">No prior payments detected in registry.</TableCell></TableRow>
                                    ) : (
                                        invoice.payments.map((p, i) => (
                                            <TableRow 
                                                key={i} 
                                                onClick={() => type === 'Edit' && setSelectedPaymentId(p.id)}
                                                className={cn(
                                                    "h-12 border-b border-slate-50 last:border-0 font-medium text-slate-600 transition-colors cursor-pointer",
                                                    selectedPaymentId === p.id ? "bg-blue-100 text-blue-900 font-black" : "hover:bg-slate-50"
                                                )}
                                            >
                                                <TableCell className="px-6">{format(new Date(p.paymentDate), 'dd.MM.yyyy')}</TableCell>
                                                <TableCell className="px-4 font-mono text-[10px] font-bold text-blue-700">{p.paymentRefNo}</TableCell>
                                                <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400">{p.paymentMode}</TableCell>
                                                <TableCell className="px-4 text-right font-bold text-slate-900">₹ {(p.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="px-4 text-right font-bold text-orange-600">₹ {(p.tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="px-4 text-right font-bold text-red-600">₹ {(p.deductionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="px-6 text-right font-black text-blue-900">₹ {((p.paidAmount || 0) + (p.tdsAmount || 0) + (p.deductionAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="px-4 text-center">
                                                    <div className="flex justify-center items-center gap-2">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-8 w-8 text-blue-600 hover:bg-blue-100"
                                                                        onClick={(e) => { e.stopPropagation(); type === 'Edit' && setSelectedPaymentId(p.id); }}
                                                                    >
                                                                        <Edit2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-slate-900 text-white text-[10px] font-black uppercase">Select for Correction</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        {isAdminSession && (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="border-none shadow-2xl p-0 overflow-hidden">
                                                                    <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                                                        <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><AlertTriangle className="h-6 w-6" /></div>
                                                                        <div>
                                                                            <AlertDialogTitle className="text-xl font-black uppercase text-red-900 tracking-tight">Purge Registry Node?</AlertDialogTitle>
                                                                            <AlertDialogDescription className="text-red-700 font-bold text-[9px] uppercase tracking-widest mt-1">Authorized Deletion Override</AlertDialogDescription>
                                                                        </div>
                                                                    </div>
                                                                    <div className="p-8">
                                                                        <p className="text-sm font-medium text-slate-600 leading-relaxed">
                                                                            You are about to permanently erase this transaction from the history. This record will be removed from the database registry immediately. This action is irreversible.
                                                                        </p>
                                                                    </div>
                                                                    <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                                                                        <AlertDialogCancel className="font-bold border-slate-200 px-8 rounded-xl m-0">Abort</AlertDialogCancel>
                                                                        <AlertDialogAction 
                                                                            onClick={() => handleDeletePayment(p.id)} 
                                                                            className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-10 rounded-xl shadow-lg border-none"
                                                                        >
                                                                            Confirm Purge
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {(type === 'Pay' || (type === 'Edit' && selectedPaymentId)) && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                {type === 'Pay' ? <Save className="h-4 w-4 text-blue-600" /> : <Edit2 className="h-4 w-4 text-emerald-600" />}
                                {type === 'Pay' ? "NEW TRANSACTION ENTRY" : "REGISTRY CORRECTION ENTRY"}
                            </h3>
                            <Form {...form}>
                                <form className="space-y-8 p-10 bg-white rounded-[2.5rem] border-2 border-blue-100 shadow-xl relative overflow-visible">
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8 items-end">
                                        <FormField name="payAmount" control={form.control} render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-blue-900 tracking-wider">Pay Amount (₹) *</FormLabel>
                                                <FormControl><Input type="number" {...field} className="h-12 rounded-xl font-black text-lg text-blue-900 border-blue-200 shadow-inner focus-visible:ring-blue-900" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField name="tdsAmount" control={form.control} render={({ field }) => (
                                            <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">TDS Amt</FormLabel><FormControl><Input type="number" {...field} className="h-12 rounded-xl font-bold" /></FormControl></FormItem>
                                        )} />
                                        <FormField name="deductionAmount" control={form.control} render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-red-600 tracking-widest">Deduction</FormLabel>
                                                <FormControl><Input type="number" {...field} className="h-12 rounded-xl font-bold border-red-100 focus-visible:ring-red-600" /></FormControl>
                                            </FormItem>
                                        )} />
                                        <FormField name="paymentMode" control={form.control} render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Mode</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-12 rounded-xl font-bold border-slate-200"><SelectValue placeholder="Pick Mode" /></SelectTrigger></FormControl>
                                                    <SelectContent className="rounded-xl">
                                                        {VendorPaymentModes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField name="bankRef" control={form.control} render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Bank Ref (UTR) *</FormLabel>
                                                <FormControl><Input placeholder="Mandatory" {...field} className="h-12 rounded-xl font-bold border-slate-200" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField name="payDate" control={form.control} render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400">Post Date *</FormLabel>
                                                <FormControl>
                                                    <DatePicker 
                                                        date={field.value} 
                                                        setDate={field.onChange} 
                                                        className="h-12 rounded-xl border-slate-200 bg-white w-full" 
                                                        calendarProps={{ disabled: { after: new Date() } }}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    {deductionAmount > 0 && (
                                        <FormField name="deductionRemark" control={form.control} render={({ field }) => (
                                            <FormItem className="animate-in slide-in-from-left-4 duration-500">
                                                <FormLabel className="text-[10px] font-black uppercase text-red-600 tracking-[0.2em] flex items-center gap-2">
                                                    <AlertCircle className="h-3 w-3" /> Deduction Remark (Max 30 words) *
                                                </FormLabel>
                                                <FormControl>
                                                    <Textarea 
                                                        {...field} 
                                                        placeholder="Provide mandatory justification for the financial deduction..." 
                                                        className="min-h-[80px] rounded-2xl border-red-100 bg-red-50/10 font-medium focus-visible:ring-red-600"
                                                    />
                                                </FormControl>
                                                <div className="flex justify-end">
                                                    <span className={cn(
                                                        "text-[9px] font-bold uppercase",
                                                        (field.value?.split(/\s+/).filter(Boolean).length || 0) > 30 ? "text-red-600" : "text-slate-400"
                                                    )}>
                                                        Word Count: {field.value?.split(/\s+/).filter(Boolean).length || 0} / 30
                                                    </span>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                </form>
                            </Form>
                        </div>
                    )}

                    {type === 'Edit' && !selectedPaymentId && (
                        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 opacity-50">
                            <Truck className="h-12 w-12 text-slate-300 mb-4" />
                            <p className="text-sm font-black uppercase tracking-widest text-slate-400">Select a payment node from history to correct</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-8 bg-slate-900 text-white shrink-0 flex flex-col md:flex-row items-center justify-between sm:justify-between border-t border-white/5">
                    <div className="flex gap-16 items-center">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Liquidating Registry Total</span>
                            <p className="text-3xl font-black tracking-tighter text-blue-400">₹ {currentEntryTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="w-px h-10 bg-white/10" />
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Closing Balance</span>
                            <p className={cn(
                                "text-3xl font-black tracking-tighter transition-all duration-500", 
                                finalBalance < -0.01 ? "text-red-500 underline decoration-red-500 underline-offset-8" : 
                                finalBalance <= 0.01 ? "text-emerald-400" : 
                                "text-amber-400"
                            )}>
                                ₹ {finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4">
                        <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="text-slate-400 hover:text-white font-black uppercase text-[11px] tracking-widest px-8">
                            Discard Entry
                        </Button>
                        <Button 
                            onClick={handleSubmit(onSubmit)} 
                            disabled={isSubmitting || (type === 'Edit' && !selectedPaymentId)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-900/50 border-none transition-all active:scale-95 border-none disabled:opacity-30"
                        >
                            {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                            {type === 'Pay' ? "Commit Settlement (F8)" : "Commit Correction (F8)"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
