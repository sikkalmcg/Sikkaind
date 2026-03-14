'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ListTree, Wallet, FileText, CheckCircle2, User, Landmark, Calculator, Receipt, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

export type ModalState = {
    type: 'outward' | 'inward';
    data: any[];
    title: string;
} | null;

const formatSafeDate = (date: any, pattern: string) => {
    if (!date) return '--';
    try {
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        return isValid(d) ? format(d, pattern) : '--';
    } catch (e) {
        return '--';
    }
};

export function MovementDetailModals({ modalState, onClose }: { modalState: NonNullable<ModalState>; onClose: () => void }) {
    const [migoDrillDown, setMigoDrillDown] = useState<any | null>(null);

    const isOutward = modalState.type === 'outward';

    const outwardTotals = modalState.data.reduce((acc, item) => {
        if (isOutward) {
            return {
                taxable: acc.taxable + (item.totals?.taxableAmount || item.totals?.taxable || 0),
                cgst: acc.cgst + (item.totals?.cgst || 0),
                sgst: acc.sgst + (item.totals?.sgst || 0),
                igst: acc.igst + (item.totals?.igst || 0),
                net: acc.net + (item.totals?.grandTotal || item.totals?.grand || 0)
            };
        }
        return acc;
    }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, net: 0 });

    const inwardTotalReceipt = modalState.data.reduce((acc, item) => {
        if (!isOutward) return acc + (item.receiptAmount || 0);
        return acc;
    }, 0);

    return (
        <>
            <Dialog open={!!modalState} onOpenChange={onClose}>
                <DialogContent className="max-w-[90vw] w-[1400px] h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden bg-white">
                    <DialogHeader className={cn("p-6 text-white shrink-0", isOutward ? "bg-blue-900" : "bg-emerald-900")}>
                        <div className="flex items-center justify-between pr-12">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                    {isOutward ? <FileText className="h-7 w-7 text-blue-400" /> : <Receipt className="h-7 w-7 text-emerald-400" />}
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">
                                        {isOutward ? "Outward Document Manifest (VF01)" : "Inward Payment Registry (MIGO)"}
                                    </DialogTitle>
                                    <DialogDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest mt-1">
                                        Party Node Registry: {modalState.title}
                                    </DialogDescription>
                                </div>
                            </div>
                            <Badge variant="outline" className="bg-white/10 text-white border-white/20 font-black px-4 py-1.5 uppercase text-[10px] tracking-[0.2em]">
                                Verified Registry Extraction
                            </Badge>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
                        <div className="rounded-[2rem] border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
                            <Table className="border-collapse">
                                <TableHeader className="bg-slate-100">
                                    <TableRow className="h-14 border-b border-slate-200 hover:bg-transparent">
                                        {isOutward ? (
                                            <>
                                                <TableHead className="text-[10px] font-black uppercase px-6 text-slate-500">Invoice No.</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Date</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4">Charge Type</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 text-right">Taxable (₹)</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 text-right">CGST</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 text-right">SGST</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 text-right text-orange-600">IGST</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-8 text-right text-blue-900 bg-blue-50/50">Net Payable</TableHead>
                                            </>
                                        ) : (
                                            <>
                                                <TableHead className="text-[10px] font-black uppercase px-6 text-emerald-700">MIGO Number</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Receipt Date</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4">Invoice Ref</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 text-right">Inv Total (₹)</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 text-right text-emerald-700">Receipt Amt</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 text-right text-orange-600">TDS Amt</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-8 text-left">Bank UTR Registry</TableHead>
                                            </>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {modalState.data.map((item, idx) => (
                                        <TableRow key={idx} className="h-16 border-b border-slate-50 last:border-0 hover:bg-blue-50/20 transition-colors">
                                            {isOutward ? (
                                                <>
                                                    <TableCell className="px-6 font-black text-blue-700 text-xs tracking-tighter">{item.invoiceNo}</TableCell>
                                                    <TableCell className="px-4 text-center text-xs font-bold text-slate-500">{formatSafeDate(item.invoiceDate, 'dd.MM.yy')}</TableCell>
                                                    <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400 italic truncate max-w-[150px]">{item.chargeTypeName || item.chargeType}</TableCell>
                                                    <TableCell className="px-4 text-right font-black text-slate-700">₹ {(item.totals?.taxableAmount ?? item.totals?.taxable ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="px-4 text-right text-emerald-600 font-bold">₹ {(item.totals?.cgst ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="px-4 text-right text-emerald-600 font-bold">₹ {(item.totals?.sgst ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="px-4 text-right text-orange-600 font-bold">₹ {(item.totals?.igst ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="px-8 text-right font-black text-blue-900 bg-blue-50/30 text-sm">₹ {(item.totals?.grandTotal ?? item.totals?.grand ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell className="px-6">
                                                        <Button variant="link" onClick={() => setMigoDrillDown(item)} className="h-auto p-0 font-black text-emerald-700 text-sm tracking-widest hover:underline decoration-2">
                                                            {item.migoNumber}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="px-4 text-center text-xs font-bold text-slate-500">{formatSafeDate(item.paymentDate, 'dd.MM.yy')}</TableCell>
                                                    <TableCell className="px-4 font-black text-blue-700 text-xs tracking-tighter">{item.invoiceNo}</TableCell>
                                                    <TableCell className="px-4 text-right font-bold text-slate-400">₹ {(item.totalNetPayable ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="px-4 text-right font-black text-emerald-700">₹ {(item.receiptAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="px-4 text-right font-black text-orange-600">₹ {(item.tdsAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                    <TableCell className="px-8 font-mono text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{item.bankingRef}</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className={cn("text-white", isOutward ? "bg-slate-900" : "bg-emerald-900")}>
                                    <TableRow className="hover:bg-transparent border-none font-black text-[11px] uppercase tracking-[0.1em] h-16">
                                        {isOutward ? (
                                            <>
                                                <TableCell colSpan={3} className="px-8">Aggregate Manifest Totals</TableCell>
                                                <TableCell className="text-right">₹ {outwardTotals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="text-right text-emerald-400">₹ {outwardTotals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="text-right text-emerald-400">₹ {outwardTotals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="text-right text-orange-400">₹ {outwardTotals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell className="text-right text-blue-400 text-lg tracking-tighter px-8">₹ {outwardTotals.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                            </>
                                        ) : (
                                            <>
                                                <TableCell colSpan={4} className="px-8">Total Liquidated Receipt Manifest</TableCell>
                                                <TableCell className="text-right text-lg text-emerald-400 tracking-tighter">₹ {inwardTotalReceipt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                <TableCell colSpan={2}></TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-slate-50 border-t shrink-0 flex-row justify-end items-center gap-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-auto">Records extracted from mission registry</p>
                        <Button variant="outline" onClick={onClose} className="font-bold uppercase text-[10px] tracking-widest px-8 h-11 rounded-xl">Back to Ledger</Button>
                        <Button onClick={onClose} className="bg-slate-900 hover:bg-black text-white px-12 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 border-none">Close Manifest</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MIGO REGISTRY DRILL-DOWN MODAL */}
            <Dialog open={!!migoDrillDown} onOpenChange={() => setMigoDrillDown(null)}>
                <DialogContent className="max-w-2xl border-none shadow-3xl p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-8 bg-emerald-900 text-white flex flex-row items-center gap-6 space-y-0">
                        <div className="p-4 bg-white/10 rounded-[1.5rem] backdrop-blur-md border border-white/20 shadow-inner">
                            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">MIGO Registry Drill-Down</DialogTitle>
                            <DialogDescription className="text-emerald-200 font-bold uppercase text-[10px] tracking-widest mt-1">
                                Liquidation Node: {migoDrillDown?.migoNumber}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    {migoDrillDown && (
                        <div className="p-10 space-y-10">
                            <div className="grid grid-cols-2 gap-y-8 gap-x-12 p-8 bg-slate-50 rounded-[2rem] border border-slate-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
                                    <Landmark className="h-48 w-48" />
                                </div>
                                
                                {[
                                    { label: 'Receipt Date', value: formatSafeDate(migoDrillDown.paymentDate, 'PPpp') },
                                    { label: 'Bank UTR Registry', value: migoDrillDown.bankingRef, mono: true, bold: true, color: 'text-blue-700' },
                                    { label: 'Receipt Amount (Actual)', value: `₹ ${(migoDrillDown.actualReceipt ?? migoDrillDown.receiptAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'text-emerald-700', highlight: true },
                                    { label: 'TDS Amount Node', value: `₹ ${(migoDrillDown.tdsAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'text-orange-600' },
                                    { label: 'Round-off Node', value: `₹ ${(migoDrillDown.roundOff ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, italic: true },
                                    { label: 'Interest Amount', value: `₹ ${(migoDrillDown.interestAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: 'text-indigo-600' },
                                    { label: 'Payment Advise', value: migoDrillDown.paymentAdvise || '--' },
                                    { label: 'Operator Identity', value: migoDrillDown.createdBy, uppercase: true, icon: User },
                                ].map((item, i) => (
                                    <div key={i} className={cn("flex flex-col gap-1.5", item.highlight && "col-span-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100 mb-2")}>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                                            {item.icon && <item.icon className="h-2.5 w-2.5" />} {item.label}
                                        </span>
                                        <span className={cn(
                                            "text-sm font-bold text-slate-800",
                                            item.mono && "font-mono tracking-tighter",
                                            item.bold && "font-black",
                                            item.color,
                                            item.uppercase && "uppercase",
                                            item.italic && "italic",
                                            item.highlight && "text-2xl"
                                        )}>{item.value}</span>
                                    </div>
                                ))}
                                
                                {migoDrillDown.remark && (
                                    <div className="col-span-2 pt-6 border-t border-slate-200">
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                                            <Calculator className="h-2.5 w-2.5" /> Registry Adjustment Remark
                                        </span>
                                        <p className="text-sm font-bold text-slate-600 italic mt-2 p-4 bg-white rounded-xl border border-slate-100 shadow-inner leading-relaxed">
                                            "{migoDrillDown.remark}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-auto flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3" /> Audit Node Persistent
                        </p>
                        <Button variant="ghost" onClick={() => setMigoDrillDown(null)} className="font-black uppercase text-[10px] tracking-widest text-slate-500 hover:text-slate-900 transition-all">Return to Manifest</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}