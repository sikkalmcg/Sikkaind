'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/date-picker';
import { Loader2, Search, Ban, AlertTriangle, FileText, CheckCircle2, ShieldCheck, Calculator, Landmark, Factory } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, addDoc, limit, Timestamp, getDoc } from 'firebase/firestore';
import { differenceInHours, format, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useLoading } from '@/context/LoadingContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  invoiceNo: z.string().min(1, "Original Invoice Number is mandatory."),
  cancelReason: z.string().min(5, "Minimum 5 characters required for justification."),
  postingDate: z.date({ required_error: "Cancellation posting date is required." }),
});

const creditNoteSchema = z.object({
    cnNumber: z.string().min(1, "Credit Note Number is mandatory."),
    cnDate: z.date({ required_error: "Date is required." }),
});

export default function V11CancelInvoicePage() {
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();
    const firestore = useFirestore();
    const { user } = useUser();

    const [foundInvoice, setFoundInvoice] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showCnModal, setShowCnModal] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { invoiceNo: '', cancelReason: '', postingDate: new Date() },
    });

    const cnForm = useForm<z.infer<typeof creditNoteSchema>>({
        resolver: zodResolver(creditNoteSchema),
        defaultValues: { cnNumber: '', cnDate: new Date() },
    });

    const handleSearch = async () => {
        const invNo = form.getValues('invoiceNo').trim();
        if (!invNo || !firestore) return;

        setIsSearching(true);
        setFoundInvoice(null);
        try {
            const q = query(collection(firestore, "invoices"), where("invoiceNo", "==", invNo), limit(1));
            const snap = await getDocs(q);
            if (snap.empty) {
                toast({ variant: 'destructive', title: "Not Found", description: `Invoice ${invNo} does not exist in registry.` });
            } else {
                const docSnap = snap.docs[0];
                const data = docSnap.data();
                
                // HIGH-FIDELITY REGISTRY LOOKUP: Resolve IDs to human readable names
                const [itSnap, ctSnap, conSnap, cneeSnap] = await Promise.all([
                    data.invoiceType ? getDoc(doc(firestore, "master_invoice_types", data.invoiceType)) : null,
                    data.chargeType ? getDoc(doc(firestore, "master_charge_types", data.chargeType)) : null,
                    getDoc(doc(firestore, "accounts_plants", data.consignorId || data.plantId)),
                    data.consigneeId ? getDoc(doc(firestore, "parties", data.consigneeId)) : null
                ]);

                // REGISTRY HANDSHAKE: Convert Firestore Timestamps to JS Dates for UI stability
                const processedData = {
                    ...data,
                    id: docSnap.id,
                    invoiceDate: data.invoiceDate instanceof Timestamp ? data.invoiceDate.toDate() : new Date(data.invoiceDate),
                    ackDate: data.ackDate instanceof Timestamp ? data.ackDate.toDate() : (data.ackDate ? new Date(data.ackDate) : undefined),
                    irnGeneratedAt: data.irnGeneratedAt instanceof Timestamp ? data.irnGeneratedAt.toDate() : (data.irnGeneratedAt ? new Date(data.irnGeneratedAt) : undefined),
                    // Resolved Display Names from Master Registries
                    invoiceTypeName: itSnap?.exists() ? itSnap.data().name : data.invoiceType,
                    chargeTypeName: ctSnap?.exists() ? ctSnap.data().name : data.chargeType,
                    consignorName: conSnap?.exists() ? conSnap.data().name : (data.consignorId || data.plantId),
                    consigneeName: cneeSnap?.exists() ? cneeSnap.data().name : data.consigneeId
                };
                
                setFoundInvoice(processedData);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Search Error", description: e.message });
        } finally {
            setIsSearching(false);
        }
    };

    const handleCancelDirect = async () => {
        if (!firestore || !foundInvoice || !user) return;

        // RULE 1: If IRN exists, Direct Cancel is forbidden
        if (foundInvoice.irn) {
            toast({ 
                variant: 'destructive', 
                title: "Action Forbidden", 
                description: "Invoice cannot be cancelled after IRN generation. Please wait for the 24-hour Credit Note window." 
            });
            return;
        }

        showLoader();
        try {
            const currentName = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
            const invRef = doc(firestore, "invoices", foundInvoice.id);
            
            await updateDoc(invRef, {
                paymentStatus: 'Cancelled',
                cancelReason: form.getValues('cancelReason'),
                cancelledAt: serverTimestamp(),
                cancelledBy: currentName,
                lastUpdatedAt: serverTimestamp()
            });

            toast({ title: "Registry Updated", description: `Invoice ${foundInvoice.invoiceNo} successfully revoked.` });
            form.reset();
            setFoundInvoice(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Revocation Failed", description: e.message });
        } finally {
            hideLoader();
        }
    };

    const handleCreditNoteSubmit = async (values: z.infer<typeof creditNoteSchema>) => {
        if (!firestore || !foundInvoice || !user) return;
        showLoader();
        try {
            const currentName = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
            
            // 1. Generate Credit Note Document
            const cnData = {
                ...foundInvoice,
                invoiceType: 'Credit Note',
                invoiceNo: values.cnNumber,
                invoiceDate: values.cnDate,
                originalInvoiceRef: foundInvoice.invoiceNo,
                cancelReason: form.getValues('cancelReason'),
                paymentStatus: 'Posted',
                createdAt: serverTimestamp(),
                userName: currentName,
                userId: user.uid
            };
            delete cnData.id;

            await addDoc(collection(firestore, "invoices"), cnData);

            // 2. Update Original Invoice Status
            await updateDoc(doc(firestore, "invoices", foundInvoice.id), {
                paymentStatus: 'Cancelled via Credit Note',
                cancelledAt: serverTimestamp(),
                cancelledBy: currentName,
                lastUpdatedAt: serverTimestamp()
            });

            toast({ title: "Credit Note Generated", description: `Financial adjustment confirmed for ${foundInvoice.invoiceNo}.` });
            setShowCnModal(false);
            form.reset();
            setFoundInvoice(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Post Failed", description: e.message });
        } finally {
            hideLoader();
        }
    };

    const processCancellation = () => {
        if (!foundInvoice) return;

        // Logic check: IRN and 24 hours
        if (foundInvoice.irn) {
            const irnTime = foundInvoice.irnGeneratedAt || foundInvoice.invoiceDate;
            const hours = differenceInHours(new Date(), irnTime);

            if (hours >= 24) {
                setShowCnModal(true);
            } else {
                toast({ 
                    variant: 'destructive', 
                    title: "IRN Restriction", 
                    description: "User NOT allowed to cancel invoice directly after IRN generation within 24 hours." 
                });
            }
        } else {
            handleCancelDirect();
        }
    };

    // Financial calculations synchronized with registry key hierarchy
    const totals = foundInvoice?.totals || {};
    const taxableAmount = totals.taxableAmount || totals.taxable || 0;
    const grandTotal = totals.grandTotal || totals.grand || 0;
    const gstAmount = (totals.cgst || 0) + (totals.sgst || 0) + (totals.igst || 0);

    return (
        <main className="p-8 space-y-10 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-red-50 border-b border-red-100 p-8 flex flex-row items-center gap-5 space-y-0">
                    <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl rotate-3">
                        <Ban className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black text-red-900 uppercase italic">VF11 – Revoke Billing Document</CardTitle>
                        <CardDescription className="text-red-700 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Correction & Credit Note Module</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-10 space-y-10">
                    <div className="flex items-end gap-4 max-w-md p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner">
                        <div className="grid w-full gap-2">
                            <Label htmlFor="search-inv" className="text-[10px] font-black uppercase text-slate-400 px-1">Lookup Invoice No. *</Label>
                            <Input 
                                id="search-inv"
                                placeholder="Enter Original #" 
                                className="h-12 rounded-xl font-black text-blue-900 shadow-sm focus-visible:ring-red-600" 
                                value={form.watch('invoiceNo')}
                                onChange={e => form.setValue('invoiceNo', e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={isSearching} className="h-12 w-12 rounded-xl bg-blue-900 hover:bg-slate-900 shrink-0 shadow-lg">
                            {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                        </Button>
                    </div>

                    {foundInvoice && (
                        <div className="space-y-10 animate-in slide-in-from-top-4 duration-500">
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                    <ShieldCheck className="h-4 w-4 text-blue-600"/> Registry Snapshot manifest
                                </h3>
                                <div className="p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110">
                                        <Calculator className="h-48 w-48" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-8 relative z-10">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400">Invoice Number</span>
                                            <p className="text-sm font-black text-blue-900 tracking-tighter">{foundInvoice.invoiceNo}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400">Invoice Date</span>
                                            <p className="text-sm font-bold text-slate-800">{format(foundInvoice.invoiceDate, 'dd.MM.yyyy')}</p>
                                        </div>
                                        <div className="space-y-1 col-span-1 lg:col-span-2">
                                            <span className="text-[9px] font-black uppercase text-slate-400">IRN Number</span>
                                            <p className={cn("text-[10px] font-mono break-all font-bold", foundInvoice.irn ? "text-emerald-600" : "text-slate-300")}>
                                                {foundInvoice.irn || 'NOT APPLICABLE'}
                                            </p>
                                        </div>
                                        
                                        <Separator className="col-span-full opacity-50" />

                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400">Invoice Type</span>
                                            <p className="text-sm font-bold text-slate-700 uppercase">{foundInvoice.invoiceTypeName || foundInvoice.invoiceType}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400">Charge Type</span>
                                            <p className="text-sm font-bold text-slate-700 uppercase">{foundInvoice.chargeTypeName || foundInvoice.chargeType}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400">Consignor</span>
                                            <p className="text-sm font-bold text-slate-800 truncate uppercase">{foundInvoice.consignorName}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400">Consignee</span>
                                            <p className="text-sm font-bold text-slate-800 truncate uppercase">{foundInvoice.consigneeName}</p>
                                        </div>

                                        <Separator className="col-span-full opacity-50" />

                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400">Taxable Amount</span>
                                            <p className="text-lg font-black text-slate-900">₹ {taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-emerald-600">GST Amount</span>
                                            <p className="text-lg font-black text-emerald-600">₹ {gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-blue-600">Net Payable Amount</span>
                                            <p className="text-2xl font-black text-blue-900 tracking-tighter">₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase text-slate-400">Status</span>
                                            <div><Badge className={cn("uppercase font-black text-[9px] px-3", foundInvoice.paymentStatus?.includes('Cancelled') ? 'bg-red-600' : 'bg-blue-600')}>{foundInvoice.paymentStatus}</Badge></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
                                <Form {...form}>
                                    <form className="space-y-6">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                            <AlertTriangle className="h-4 w-4 text-red-600"/> Revocation Details
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-red-50/30 rounded-[2.5rem] border border-red-100">
                                            <FormField name="postingDate" control={form.control} render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel className="text-[10px] font-black uppercase text-red-900 tracking-widest">Cancellation Posting Date *</FormLabel>
                                                    <FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-12 bg-white border-red-200 rounded-xl font-bold" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField name="cancelReason" control={form.control} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase text-red-900 tracking-widest">Cancellation Reason *</FormLabel>
                                                    <FormControl><Textarea {...field} placeholder="Specific justification for audit trail..." className="bg-white border-red-200 rounded-2xl h-24 resize-none font-medium p-4" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    </form>
                                </Form>
                            </div>

                            <div className="pt-10 border-t flex justify-end gap-4">
                                <Button variant="ghost" onClick={() => setFoundInvoice(null)} className="font-black text-slate-400 uppercase tracking-widest px-8 h-14 rounded-2xl">Reset Lookup</Button>
                                <Button 
                                    onClick={form.handleSubmit(processCancellation)} 
                                    className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[11px] tracking-[0.2em] px-16 h-14 rounded-2xl shadow-2xl shadow-red-100 transition-all active:scale-95 border-none"
                                >
                                    Execute Registry Revocation
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* CREDIT NOTE MODAL */}
            <Dialog open={showCnModal} onOpenChange={setShowCnModal}>
                <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white">
                    <DialogHeader className="p-8 bg-blue-900 text-white">
                        <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                            <Landmark className="h-6 w-6 text-blue-400" /> Generate Credit Note
                        </DialogTitle>
                        <DialogDescription className="text-blue-200 font-bold uppercase text-[9px] mt-1 tracking-widest">
                            Mandatory adjustment node (&gt;24h since IRN)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-8 space-y-8">
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                            <p className="text-[10px] font-bold text-blue-800 leading-normal uppercase">
                                System auto-fetch successful. All party nodes and financial manifest from Invoice {foundInvoice?.invoiceNo} will be linked to this Credit Note registry.
                            </p>
                        </div>

                        <Form {...cnForm}>
                            <form className="space-y-6">
                                <FormField name="cnNumber" control={cnForm.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Credit Note Number *</FormLabel>
                                        <FormControl><Input placeholder="e.g. CN/24-25/001" className="h-12 rounded-xl font-black text-blue-900 border-slate-200 shadow-inner" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="cnDate" control={cnForm.control} render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Post Date *</FormLabel>
                                        <FormControl>
                                            <DatePicker 
                                                date={field.value} 
                                                setDate={field.onChange} 
                                                className="h-12 border-slate-200 rounded-xl"
                                                calendarProps={{ disabled: { after: new Date() } }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </form>
                        </Form>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                        <Button variant="ghost" onClick={() => setShowCnModal(false)} className="font-bold text-slate-400">Back</Button>
                        <Button onClick={cnForm.handleSubmit(handleCreditNoteSubmit)} className="bg-blue-900 text-white px-10 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-none shadow-lg">Confirm Generation</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
