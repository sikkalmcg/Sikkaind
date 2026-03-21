'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, isBefore, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, FileDown, Factory, Users, Wallet, TrendingUp } from 'lucide-react';
import type { WithId, Invoice, Party, InvoicePayment, MasterChargeType } from '@/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { MB5BCriteria } from './page';
import { MovementDetailModals, type ModalState } from './MovementDetailModals';
import { normalizePlantId } from '@/lib/utils';

/**
 * @fileOverview Result List for MB5B - Plant Movement Ledger.
 * Calculates net opening liability and periodic flow with strict nomenclature.
 */

export default function ResultList({ criteria, onBack }: { criteria: MB5BCriteria; onBack: () => void }) {
    const firestore = useFirestore();
    const [loading, setLoading] = useState(true);
    const [modalState, setModalState] = useState<ModalState>(null);

    const invoicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "invoices"), where("plantId", "==", criteria.plantId)) : null, 
        [firestore, criteria.plantId]
    );
    const { data: allInvoices } = useCollection<Invoice>(invoicesQuery);

    const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "parties")) : null, [firestore]);
    const { data: parties } = useCollection<Party>(partiesQuery);

    const ctQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_charge_types")) : null, [firestore]);
    const { data: chargeTypes } = useCollection<MasterChargeType>(ctQuery);

    const reportData = useMemo(() => {
        if (!allInvoices) return [];

        const start = startOfDay(criteria.fromDate);
        const end = endOfDay(criteria.toDate);

        const grouped: Record<string, {
            consigneeId: string;
            consigneeName: string;
            opening: number;
            outward: number;
            inward: number;
            outwardList: any[];
            inwardList: any[];
        }> = {};

        allInvoices.forEach(inv => {
            const invDate = inv.invoiceDate instanceof Timestamp ? inv.invoiceDate.toDate() : new Date(inv.invoiceDate);
            const cid = inv.consigneeId;
            const consignee = parties?.find(p => p.id === cid);

            if (!grouped[cid]) {
                grouped[cid] = {
                    consigneeId: cid,
                    consigneeName: consignee?.name || cid,
                    opening: 0,
                    outward: 0,
                    inward: 0,
                    outwardList: [],
                    inwardList: []
                };
            }

            const g = grouped[cid];
            const invValue = inv.totals?.grandTotal || inv.totals?.grand || 0;
            const resolvedChargeType = chargeTypes?.find(ct => ct.id === inv.chargeType)?.name || inv.chargeType;

            if (isBefore(invDate, start)) {
                g.opening += invValue;
            } else if (invDate >= start && invDate <= end) {
                g.outward += invValue;
                g.outwardList.push({ ...inv, chargeTypeName: resolvedChargeType });
            }

            (inv.payments || []).forEach((p: InvoicePayment) => {
                const payDate = p.paymentDate instanceof Timestamp ? p.paymentDate.toDate() : new Date(p.paymentDate);
                const payValue = (p.receiptAmount || 0) + (p.tdsAmount || 0);

                if (isBefore(payDate, start)) {
                    g.opening -= payValue;
                } else if (payDate >= start && payDate <= end) {
                    g.inward += payValue;
                    g.inwardList.push({ ...p, invoiceNo: inv.invoiceNo, invoiceDate: invDate, totalNetPayable: invValue });
                }
            });
        });

        return Object.values(grouped).sort((a, b) => a.consigneeName.localeCompare(b.consigneeName));
    }, [allInvoices, criteria, parties, chargeTypes]);

    useEffect(() => {
        if (allInvoices) setLoading(false);
    }, [allInvoices]);

    const handleExport = () => {
        const exportData = reportData.map(r => ({
            'Plant ID': criteria.plantId,
            'Consignee Name': r.consigneeName,
            'Opening Amount': r.opening,
            'Outward': r.outward,
            'Inward': r.inward,
            'Closing Balance': r.opening + r.outward - r.inward
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MB5B_Movement");
        XLSX.writeFile(wb, `MB5B_${criteria.plantId}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
            <div className="sticky top-0 z-30 bg-white border-b px-8 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <Button onClick={onBack} variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100"><ArrowLeft className="h-5 w-5 text-slate-400"/></Button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight italic">MB5B – Plant Movement Ledger</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Node: {criteria.plantId} | Registry Extraction</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 flex items-center gap-2 mr-4">
                        <TrendingUp className="h-3 w-3 text-blue-600" />
                        <span className="text-[10px] font-black uppercase text-blue-900 tracking-widest">
                            {format(criteria.fromDate, 'dd/MM/yyyy')} – {format(criteria.toDate, 'dd/MM/yyyy')}
                        </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExport} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-emerald-700 bg-white shadow-sm hover:bg-emerald-50">
                        <FileDown className="h-4 w-4" /> Export Registry
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto">
                <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-96 gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Mission Movement...</p>
                            </div>
                        ) : (
                            <Table className="border-collapse">
                                <TableHeader className="bg-slate-100">
                                    <TableRow className="h-14 border-b border-slate-200 hover:bg-transparent">
                                        <TableHead className="text-[10px] font-black uppercase px-8 text-slate-500"><div className="flex items-center gap-2"><Factory className="h-3 w-3" /> Plant Node</div></TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-500"><div className="flex items-center gap-2"><Users className="h-3 w-3" /> Consignee Registry</div></TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-500">Opening Amount</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-right bg-blue-50/50 text-blue-900">Outward</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-right bg-emerald-50/50 text-emerald-900">Inward</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-900"><div className="flex items-center justify-end gap-2"><Wallet className="h-3 w-3" /> Closing Balance</div></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map((row, idx) => {
                                        const balance = row.opening + row.outward - row.inward;
                                        return (
                                            <TableRow key={idx} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors group">
                                                <TableCell className="px-8 font-black text-slate-400 text-[11px] uppercase group-hover:text-blue-900 transition-colors">{criteria.plantId}</TableCell>
                                                <TableCell className="px-4 font-black text-slate-900 uppercase text-[11px] tracking-tight">{row.consigneeName}</TableCell>
                                                <TableCell className="px-4 text-right font-black text-slate-500 text-sm">₹ {row.opening.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="px-4 text-right bg-blue-50/30 group-hover:bg-blue-50/50 transition-colors">
                                                    <Button variant="link" onClick={() => setModalState({ type: 'outward', data: row.outwardList, title: row.consigneeName })} className="h-auto p-0 font-black text-blue-700 text-sm decoration-2 hover:underline">
                                                        ₹ {row.outward.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="px-4 text-right bg-emerald-50/30 group-hover:bg-emerald-50/50 transition-colors">
                                                    <Button variant="link" onClick={() => setModalState({ type: 'inward', data: row.inwardList, title: row.consigneeName })} className="h-auto p-0 font-black text-emerald-700 text-sm decoration-2 hover:underline">
                                                        ₹ {row.inward.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="px-8 text-right font-black text-slate-900 text-lg tracking-tighter">
                                                    ₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {reportData.length === 0 && (
                                        <TableRow><TableCell colSpan={6} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No movement detected in registry scope.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {modalState && <MovementDetailModals modalState={modalState} onClose={() => setModalState(null)} />}
        </div>
    );
}
