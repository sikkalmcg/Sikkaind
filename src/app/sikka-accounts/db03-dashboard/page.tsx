'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, DollarSign, Receipt, Landmark, ShieldCheck, Factory, AlertTriangle, ArrowRightLeft, CreditCard, MinusCircle, Wallet, FileX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Invoice, Plant, Party, SubUser, VendorInvoice } from '@/types';
import SearchHelpModal from '@/components/sikka-accounts/invoice-report/SearchHelpModal';
import InvoiceDetailModal from '@/components/sikka-accounts/dashboard/InvoiceDetailModal';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn, normalizePlantId } from '@/lib/utils';

/**
 * @fileOverview MB52 – Financial Dashboard Control Hub.
 * Dual-Registry reporting for Inward (A/R) and Outward (A/P) flows.
 * Synchronizes VF01, VF02, MIRO, MIGO, and F110 nodes.
 */

const formSchema = z.object({
  reportType: z.enum(['Inward', 'Outward'], { required_error: 'Report selection is mandatory.' }),
  plantId: z.string().min(1, 'Plant is a mandatory field.'),
  fromDate: z.date({ required_error: 'From Date is a mandatory field.' }),
  toDate: z.date({ required_error: 'To Date is a mandatory field.' }),
}).refine(data => data.fromDate <= data.toDate, {
  message: 'From Date cannot be after To Date.',
  path: ['fromDate'],
});

type SelectionCriteria = z.infer<typeof formSchema>;

function getCurrentFinancialYear() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let fromDate, toDate;
    if (currentMonth >= 3) { 
        fromDate = new Date(currentYear, 3, 1);
        toDate = new Date(currentYear + 1, 2, 31);
    } else { 
        fromDate = new Date(currentYear - 1, 3, 1);
        toDate = new Date(currentYear, 2, 31);
    }
    return { fromDate, toDate };
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export type GroupedData = {
    plantId: string;
    plantName: string;
    partyId: string;
    partyName: string;
    records: any[];
    // Inward Metrics (A/R)
    totalNetPayable: number;
    totalReceipt: number;
    totalBalance: number;
    totalUnpaidAmount: number;
    unpaidRecords: any[];
    // Outward Metrics (A/P)
    totalTaxable: number;
    totalGst: number;
    totalInvoiceAmount: number;
    totalPayAmount: number;
    totalTds: number;
    totalDeduction: number;
    closingAmount: number;
};

export type ModalState = {
    type: 'invoice' | 'paid' | 'balance' | 'outward-invoice' | 'outward-pay' | 'unpaid';
    data: any[];
    title: string;
} | null;

export default function DashboardViewPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
    const [searchHelpState, setSearchHelpState] = useState<any>(null);
    const [groupedData, setGroupedData] = useState<GroupedData[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalState, setModalState] = useState<ModalState>(null);

    const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "parties")) : null, [firestore]);
    const { data: dbParties } = useCollection<Party>(partiesQuery);

    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants")) : null, [firestore]);
    const { data: allPlants } = useCollection<Plant>(plantsQuery);

    const itQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_invoice_types")) : null, [firestore]);
    const ctQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_charge_types")) : null, [firestore]);
    const { data: chargeTypes } = useCollection<any>(ctQuery);

    const { fromDate: defaultFrom, toDate: defaultTo } = getCurrentFinancialYear();

    const form = useForm<SelectionCriteria>({
        resolver: zodResolver(formSchema),
        defaultValues: { reportType: 'Inward', plantId: '', fromDate: defaultFrom, toDate: defaultTo },
    });
    
    const { watch, control, setValue, handleSubmit } = form;
    const reportType = watch('reportType');

    const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    useEffect(() => {
        if (!allPlants || !user || !firestore) return;
        const syncAuth = async () => {
            const userDoc = await getDoc(doc(firestore, "users", user.uid));
            let authIds: string[] = [];
            if (userDoc.exists()) {
                const data = userDoc.data() as SubUser;
                authIds = (data.username === 'sikkaind' || isAdminSession) ? allPlants.map(p => p.id) : (data.accounts_plant_ids || []);
            } else if (isAdminSession) {
                authIds = allPlants.map(p => p.id);
            }
            setAuthorizedPlants(allPlants.filter(p => authIds.includes(p.id)));
        };
        syncAuth();
    }, [allPlants, user, isAdminSession, firestore]);

    const onSubmit = async (criteria: SelectionCriteria) => {
        if (!firestore) return;
        setLoading(true);
        setGroupedData([]);
        
        try {
            const start = criteria.fromDate;
            const end = new Date(criteria.toDate);
            end.setHours(23, 59, 59, 999);
            
            const selectedPlantTokens = criteria.plantId.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
            const selectedPlantIds = authorizedPlants.filter(p => selectedPlantTokens.includes(p.id.toUpperCase())).map(p => p.id);

            if (selectedPlantIds.length === 0) {
                toast({ variant: 'destructive', title: 'Registry Conflict', description: 'Selected Plant ID not recognized in authorized Accounts nodes.' });
                setLoading(false);
                return;
            }

            const collectionName = criteria.reportType === 'Inward' ? 'invoices' : 'vendor_invoices';
            const recordsRef = collection(firestore, collectionName);
            const q = query(recordsRef, where("plantId", "in", selectedPlantIds.slice(0, 10)));
            const snapshot = await getDocs(q);

            const filteredRecords: any[] = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const invDate = data.invoiceDate instanceof Timestamp ? data.invoiceDate.toDate() : new Date(data.invoiceDate);

                if (invDate >= start && invDate <= end) {
                    const resolvedFirmName = authorizedPlants.find(p => p.id === data.plantId)?.name || data.plantId;
                    const resolvedChargeType = chargeTypes?.find(ct => ct.id === data.chargeType)?.name || data.chargeType;

                    if (criteria.reportType === 'Inward') {
                        if (!data.irn?.trim()) return;
                        const buyer = dbParties?.find(p => p.id === data.consigneeId);
                        
                        const payments = data.payments || [];
                        const totalActualReceipt = payments.reduce((s: number, p: any) => s + (p.actualReceipt ?? (p.receiptAmount || 0)), 0);
                        const totalTds = payments.reduce((s: number, p: any) => s + (p.tdsAmount || 0), 0);
                        const totalRoundOff = payments.reduce((s: number, p: any) => s + (p.roundOff || 0), 0);
                        
                        const lastP = payments.length > 0 ? payments[payments.length - 1] : null;
                        const pDate = lastP?.paymentDate;

                        const grandTotal = data.totals?.grandTotal ?? (data.totals as any)?.grand ?? 0;
                        const taxableAmount = data.totals?.taxableAmount || (data.totals as any)?.taxable || 0;
                        const gstAmount = (data.totals?.cgst || 0) + (data.totals?.sgst || 0) + (data.totals?.igst || 0);

                        // REGISTRY LOGIC: Accurate Balance Handshake
                        const balance = grandTotal - (totalActualReceipt + totalTds + totalRoundOff);

                        filteredRecords.push({ 
                            ...data, 
                            id: docSnap.id, 
                            firmName: resolvedFirmName,
                            chargeTypeName: resolvedChargeType,
                            buyerName: buyer?.name || data.consigneeId, 
                            totalActualReceipt,
                            totalTds,
                            paymentDate: pDate,
                            balance: balance <= 0.01 ? 0 : balance, 
                            grandTotal,
                            taxableAmount,
                            gstAmount
                        });
                    } else {
                        const vendor = dbParties?.find(p => p.id === data.vendorId);
                        const taxable = Number(data.taxableAmount || data.taxable || 0);
                        const gst = Number(data.gstAmount || 0);
                        const gross = Number(data.grossAmount || data.payableAmount || (taxable + gst));
                        
                        const pList = data.payments || [];
                        const payAmt = pList.reduce((s: number, p: any) => s + (p.paidAmount || 0), 0);
                        const tdsAmt = pList.reduce((s: number, p: any) => s + (p.tdsAmount || 0), 0);
                        const dedAmt = pList.reduce((s: number, p: any) => s + (p.deductionAmount || 0), 0);
                        
                        filteredRecords.push({ 
                            ...data, 
                            id: docSnap.id, 
                            firmName: resolvedFirmName,
                            chargeTypeName: resolvedChargeType,
                            vendorName: vendor?.name || data.vendorName || data.vendorId,
                            taxable, gst, gross, payAmt, tdsAmt, dedAmt, 
                            closing: gross - (payAmt + tdsAmt + dedAmt) 
                        });
                    }
                }
            });
            
            const groups = filteredRecords.reduce<Record<string, GroupedData>>((acc, rec) => {
                const partyId = criteria.reportType === 'Inward' ? rec.consigneeId : rec.vendorId;
                const key = `${rec.plantId}-${partyId}`;
                if (!acc[key]) {
                    acc[key] = {
                        plantId: rec.plantId,
                        plantName: rec.firmName,
                        partyId: partyId || 'unknown',
                        partyName: criteria.reportType === 'Inward' ? rec.buyerName : rec.vendorName,
                        records: [],
                        totalNetPayable: 0, totalReceipt: 0, totalBalance: 0, totalUnpaidAmount: 0, unpaidRecords: [],
                        totalTaxable: 0, totalGst: 0, totalInvoiceAmount: 0, totalPayAmount: 0, totalTds: 0, totalDeduction: 0, closingAmount: 0
                    };
                }
                const g = acc[key];
                g.records.push(rec);
                
                if (criteria.reportType === 'Inward') {
                    g.totalNetPayable += rec.grandTotal;
                    g.totalReceipt += rec.totalActualReceipt;
                    g.totalBalance += rec.balance;
                    
                    // UNPAID LOGIC: Use the calculated balance node for accuracy
                    if (rec.balance > 0.01) {
                        g.totalUnpaidAmount += rec.balance;
                        g.unpaidRecords.push(rec);
                    }
                } else {
                    g.totalTaxable += rec.taxable;
                    g.totalGst += rec.gst;
                    g.totalInvoiceAmount += rec.gross;
                    g.totalPayAmount += rec.payAmt;
                    g.totalTds += rec.tdsAmt;
                    g.totalDeduction += rec.dedAmt;
                    g.closingAmount += rec.closing;
                }
                return acc;
            }, {});

            setGroupedData(Object.values(groups));
            if(Object.keys(groups).length === 0) toast({title: "Registry Empty", description: "No records found for the selected criteria."});
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Search Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleF4 = (e: React.KeyboardEvent) => {
        if (e.key === 'F4') {
            e.preventDefault();
            setSearchHelpState({ type: 'plant', data: authorizedPlants, title: 'Select PLANT ID Node' });
        }
    };

    return (
        <main className="p-4 md:p-8 space-y-10 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 border-b pb-6">
                <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                    <Landmark className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">FINANCIAL DASHBOARD (MB52)</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">MISSION REGISTRY SNAPSHOT: A/R & A/P HANDBOOK</p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="p-8 border rounded-[3rem] bg-white shadow-2xl flex flex-wrap items-end gap-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12"><ShieldCheck className="h-48 w-48" /></div>

                    <FormField name="reportType" control={control} render={({ field }) => (
                        <FormItem className="min-w-[220px]">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><ArrowRightLeft className="h-3 w-3" /> Report Title *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-12 rounded-xl font-black text-blue-900 shadow-sm border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="Inward" className="font-bold py-3 uppercase">Inward Payment (A/R)</SelectItem>
                                    <SelectItem value="Outward" className="font-bold py-3 uppercase">Outward Payment (A/P)</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />

                    <FormField name="plantId" control={control} render={({ field }) => (
                        <FormItem className="min-w-[240px]">
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Factory className="h-3 w-3" /> PLANT ID REGISTRY *</FormLabel>
                            <div className="flex gap-2">
                                <FormControl><Input {...field} placeholder="F4 for Help" onKeyDown={handleF4} className="h-12 rounded-xl font-black text-blue-900 uppercase shadow-inner bg-slate-50 border-slate-200 focus-visible:ring-blue-900" /></FormControl>
                                <Button type="button" variant="outline" size="icon" onClick={() => setSearchHelpState({ type: 'plant', data: authorizedPlants, title: 'Select PLANT ID Node' })} className="h-12 w-12 rounded-xl border-slate-200 bg-white"><Search className="h-4 w-4 text-blue-600" /></Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-6">
                        <FormField name="fromDate" control={control} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-400">From Date</FormLabel><DatePicker date={field.value} setDate={field.onChange} className="h-12 rounded-xl border-slate-200" /><FormMessage /></FormItem>)} />
                        <FormField name="toDate" control={control} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-400">To Date</FormLabel><DatePicker date={field.value} setDate={field.onChange} className="h-12 rounded-xl border-slate-200" /><FormMessage /></FormItem>)} />
                    </div>

                    <Button type="submit" disabled={loading} className="bg-blue-900 hover:bg-slate-900 px-12 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] transition-all shadow-xl shadow-blue-100 border-none active:scale-95">
                        {loading ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Search className="mr-3 h-4 w-4" />}
                        Execute Dashboard
                    </Button>
                </form>
            </Form>
            
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-40">
                    <Loader2 className="h-16 w-16 animate-spin text-blue-900" />
                    <p className="text-sm font-black uppercase tracking-[0.5em] text-slate-400">Synchronizing Compliant Registry Manifest...</p>
                </div>
            ) : groupedData.length > 0 && (
                 <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {groupedData.map(group => (
                        <Card key={`${group.plantId}-${group.partyId}`} className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden group/main">
                            <CardHeader className="bg-slate-900 border-b border-white/5 p-8 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/10 rounded-[1.5rem] backdrop-blur-md border border-white/20">
                                        <Factory className="h-6 w-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-black uppercase tracking-widest text-white leading-none">Node: {group.plantName}</CardTitle>
                                        <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-2 flex items-center gap-2">
                                            <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 text-[8px] font-black h-5 uppercase">Verified {reportType} Flow</Badge>
                                            {reportType === 'Inward' ? 'Consignee' : 'Vendor'}: {group.partyName}
                                        </p>
                                    </div>
                                </div>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            </CardHeader>
                            <CardContent className="p-10 bg-slate-50/30">
                                {reportType === 'Inward' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                        <Card className="cursor-pointer hover:bg-white transition-all border-2 border-slate-100 shadow-md rounded-[2rem] group/card hover:border-blue-600/30" onClick={() => setModalState({ type: 'invoice', data: group.records, title: group.partyName })}>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                                                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-tight">Total Net Payable Amount (VF01/VF02)</CardTitle>
                                                <DollarSign className="h-5 w-5 text-blue-600 group-hover/card:rotate-12 transition-transform" />
                                            </CardHeader>
                                            <CardContent><div className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(group.totalNetPayable)}</div></CardContent>
                                        </Card>
                                        
                                        <Card className="cursor-pointer hover:bg-white transition-all border-2 border-slate-100 shadow-md rounded-[2rem] group/card hover:border-red-600/30" onClick={() => setModalState({ type: 'unpaid', data: group.unpaidRecords, title: group.partyName })}>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                                                <CardTitle className="text-[10px] font-black uppercase text-red-900 tracking-widest leading-tight">Unpaid Invoice Amount</CardTitle>
                                                <FileX className="h-5 w-5 text-red-600 group-hover/card:scale-110 transition-transform" />
                                            </CardHeader>
                                            <CardContent><div className="text-2xl font-black text-red-700 tracking-tighter">{formatCurrency(group.totalUnpaidAmount)}</div></CardContent>
                                        </Card>

                                        <Card className="cursor-pointer hover:bg-white transition-all border-2 border-slate-100 shadow-md rounded-[2rem] group/card hover:border-emerald-600/30" onClick={() => setModalState({ type: 'paid', data: group.records, title: group.partyName })}>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                                                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-tight">Total Receipt Amount (MIGO)</CardTitle>
                                                <Receipt className="h-5 w-5 text-emerald-600 group-hover/card:scale-110 transition-transform" />
                                            </CardHeader>
                                            <CardContent><div className="text-2xl font-black text-emerald-700 tracking-tighter">{formatCurrency(group.totalReceipt)}</div></CardContent>
                                        </Card>
                                        
                                        <Card className="border-2 border-slate-100 shadow-md rounded-[2rem] bg-white group/card">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                                                <CardTitle className="text-[10px] font-black uppercase text-slate-900 tracking-widest leading-tight">Closing Balance Registry</CardTitle>
                                                <AlertTriangle className="h-5 w-5 text-slate-400 group-hover/card:animate-pulse transition-all" />
                                            </CardHeader>
                                            <CardContent><div className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(group.totalBalance)}</div></CardContent>
                                        </Card>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <Card className="border-2 border-slate-100 shadow-md rounded-2xl bg-white/50">
                                                <CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total Taxable Amount</CardTitle></CardHeader>
                                                <CardContent><div className="text-xl font-black text-slate-700 tracking-tighter">{formatCurrency(group.totalTaxable)}</div></CardContent>
                                            </Card>
                                            <Card className="border-2 border-slate-100 shadow-md rounded-2xl bg-white/50">
                                                <CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">Total GST Amount</CardTitle></CardHeader>
                                                <CardContent><div className="text-xl font-black text-emerald-700 tracking-tighter">{formatCurrency(group.totalGst)}</div></CardContent>
                                            </Card>
                                            <Card className="cursor-pointer border-2 border-blue-100 shadow-xl rounded-2xl bg-blue-50/20 hover:bg-blue-50 transition-all group/it" onClick={() => setModalState({ type: 'outward-invoice', data: group.records, title: group.partyName })}>
                                                <CardHeader className="pb-2 flex flex-row justify-between items-center"><CardTitle className="text-[9px] font-black uppercase text-blue-900 tracking-widest">Total Invoice Amount (MIRO)</CardTitle><Maximize2 className="h-3 w-3 text-blue-400 group-hover/it:scale-125 transition-transform" /></CardHeader>
                                                <CardContent><div className="text-2xl font-black text-blue-900 tracking-tighter">{formatCurrency(group.totalInvoiceAmount)}</div></CardContent>
                                            </Card>
                                            <Card className="cursor-pointer border-2 border-emerald-100 shadow-xl rounded-2xl bg-emerald-50/20 hover:bg-emerald-50 transition-all group/pay" onClick={() => setModalState({ type: 'outward-pay', data: group.records, title: group.partyName })}>
                                                <CardHeader className="pb-2 flex flex-row justify-between items-center"><CardTitle className="text-[9px] font-black uppercase text-emerald-900 tracking-widest">Total Pay Amount (F110)</CardTitle><CreditCard className="h-3 w-3 text-emerald-400 group-hover/pay:scale-125 transition-transform" /></CardHeader>
                                                <CardContent><div className="text-2xl font-black text-emerald-900 tracking-tighter">{formatCurrency(group.totalPayAmount)}</div></CardContent>
                                            </Card>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <Card className="border-2 border-slate-100 shadow-md rounded-2xl bg-white/50">
                                                <CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total TDS Amount</CardTitle></CardHeader>
                                                <CardContent><div className="text-xl font-black text-orange-600 tracking-tighter">{formatCurrency(group.totalTds)}</div></CardContent>
                                            </Card>
                                            <Card className="border-2 border-slate-100 shadow-md rounded-2xl bg-white/50">
                                                <CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Total Deduction Amount</CardTitle></CardHeader>
                                                <CardContent><div className="text-xl font-black text-red-600 tracking-tighter">{formatCurrency(group.totalDeduction)}</div></CardContent>
                                            </Card>
                                            <Card className="border-4 border-slate-900 shadow-2xl rounded-[2rem] bg-slate-900 text-white">
                                                <CardHeader className="pb-2 flex flex-row justify-between items-center"><CardTitle className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em]">Closing Amount</CardTitle><Wallet className="h-4 w-4 text-white animate-pulse" /></CardHeader>
                                                <CardContent><div className="text-3xl font-black tracking-tighter text-white">{formatCurrency(group.closingAmount)}</div></CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                 </div>
            )}

            {searchHelpState && (
                <SearchHelpModal 
                    isOpen={!!searchHelpState} 
                    onClose={() => setSearchHelpState(null)} 
                    title={searchHelpState.title} 
                    data={searchHelpState.data} 
                    onSelect={(id) => { setValue('plantId', id, { shouldValidate: true }); setSearchHelpState(null); }} 
                />
            )}
            
            {modalState && (
                <InvoiceDetailModal 
                    isOpen={!!modalState} 
                    onClose={() => setModalState(null)} 
                    modalState={modalState} 
                />
            )}
        </main>
    );
}

const Maximize2 = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="m15 15 6 6"/><path d="m9 9-6-6"/></svg>
);
