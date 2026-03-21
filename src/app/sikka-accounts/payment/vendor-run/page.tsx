
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, onSnapshot } from 'firebase/firestore';
import { Loader2, Search, FileDown, WifiOff, Wallet, Landmark, ShieldCheck, Filter, ArrowRightLeft } from 'lucide-react';
import type { VendorInvoice, Plant, Party, SubUser, WithId } from '@/types';
import VendorPaymentTable from '@/components/sikka-accounts/vendor-payment/VendorPaymentTable';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * @fileOverview F110 - Vendor Payment Run Module.
 * Synchronizes with MIRO registry to manage vendor settlements with strict temporal gating.
 */

export default function VendorPaymentRunPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { setStatusBar } = useSikkaAccountsPage();

    const [invoices, setInvoices] = useState<WithId<VendorInvoice>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState(false);
    
    // Filter State
    const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants")) : null, [firestore]);
    const { data: plants } = useCollection<Plant>(plantsQuery);

    // ACCOUNTS REGISTRY HANDSHAKE
    const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_parties")) : null, [firestore]);
    const { data: vendors } = useCollection<Party>(partiesQuery);

    useEffect(() => {
        if (!firestore || !user) return;

        setIsLoading(true);
        const invRef = collection(firestore, "vendor_invoices");
        const q = query(invRef, orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    invoiceDate: data.invoiceDate instanceof Timestamp ? data.invoiceDate.toDate() : new Date(data.invoiceDate),
                    payments: (data.payments || []).map((p: any) => ({
                        ...p,
                        paymentDate: p.paymentDate instanceof Timestamp ? p.paymentDate.toDate() : new Date(p.paymentDate)
                    }))
                } as WithId<VendorInvoice>;
            });
            setInvoices(fetched);
            setIsLoading(false);
        }, async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: invRef.path,
                operation: 'list',
            } satisfies SecurityRuleContext));
            setDbError(true);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user]);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const invDate = inv.invoiceDate;
            if (fromDate && invDate < startOfDay(fromDate)) return false;
            if (toDate && invDate > endOfDay(toDate)) return false;

            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                return (
                    inv.invoiceNo.toLowerCase().includes(s) ||
                    inv.vendorName.toLowerCase().includes(s) ||
                    (inv.vendorGstin || '').toLowerCase().includes(s) ||
                    inv.paymentStatus.toLowerCase().includes(s)
                );
            }
            return true;
        });
    }, [invoices, fromDate, toDate, searchTerm]);

    const handleExport = () => {
        const dataToExport = filteredInvoices.map(inv => {
            const totalPaid = (inv.payments || []).reduce((sum, p) => sum + (p.paidAmount || 0) + (p.tdsAmount || 0) + (p.deductionAmount || 0), 0);
            return {
                'Firm Name': inv.firmName,
                'Invoice No': inv.invoiceNo,
                'Date': format(inv.invoiceDate, 'dd-MM-yyyy'),
                'Vendor': inv.vendorName,
                'GSTIN': inv.vendorGstin || '--',
                'Gross Amt': inv.grossAmount || 0,
                'Total Paid': totalPaid,
                'Balance': (inv.grossAmount || 0) - totalPaid,
                'Status': inv.paymentStatus
            };
        });
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "F110_Registry");
        XLSX.writeFile(wb, `F110_VendorPayment_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    return (
        <main className="p-8 space-y-10 animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                        <Landmark className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">F110 – Vendor Payment Run</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">LMC Registry Settlement & Liquidation Node</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {dbError && (
                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold border border-orange-200 uppercase tracking-wider">
                            <WifiOff className="h-3 w-3" /> <span>Registry Unstable</span>
                        </div>
                    )}
                    <Button variant="outline" onClick={handleExport} className="h-11 rounded-xl font-black uppercase text-[11px] tracking-widest border-slate-200 text-blue-900 gap-2 shadow-sm hover:bg-slate-50 transition-all active:scale-95 border-none">
                        <FileDown className="h-4 w-4" /> Export Ledger
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="flex flex-wrap items-end gap-6">
                        <div className="grid gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Period From</label>
                            <DatePicker 
                                date={fromDate} 
                                setDate={setFromDate} 
                                className="h-11 rounded-xl border-slate-200 bg-white"
                                calendarProps={{ disabled: { after: new Date() } }}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Period To</label>
                            <DatePicker 
                                date={toDate} 
                                setDate={setToDate} 
                                className="h-11 rounded-xl border-slate-200 bg-white"
                                calendarProps={{ disabled: { after: new Date() } }}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Registry Search</label>
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900" />
                                <Input 
                                    placeholder="Vendor, Invoice, GSTIN or Status..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="pl-10 w-[350px] h-11 rounded-xl border-slate-200 bg-white font-bold" 
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border shadow-sm"><Filter className="h-4 w-4 text-slate-400" /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400">Total Entries</p>
                            <p className="text-sm font-black text-blue-900">{filteredInvoices.length}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-40">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Payment Ledger...</p>
                        </div>
                    ) : (
                        <VendorPaymentTable 
                            data={filteredInvoices} 
                            vendors={vendors || []}
                        />
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
