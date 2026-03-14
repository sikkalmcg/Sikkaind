'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Printer, FileDown, ShieldCheck, Landmark, CheckCircle2, User, History } from 'lucide-react';
import type { VendorInvoice, WithId, Plant, Party } from '@/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn, normalizePlantId } from '@/lib/utils';

/**
 * @fileOverview F110 - Printable Payment Voucher Node.
 * Cross-references MIRO invoice data with XD01 Master Registry for Vendor particulars.
 * Implements Top-Center Title architecture with symmetrical Meta/Firm nodes.
 * Includes full Previous Payment History Ledger.
 */

export default function PrintReceiptModal({ isOpen, onClose, invoice }: { isOpen: boolean; onClose: () => void; invoice: WithId<VendorInvoice> }) {
    const firestore = useFirestore();
    const contentRef = useRef<HTMLDivElement>(null);
    
    // 1. Fetch Accounts Plants for Firm branding
    const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "accounts_plants")) : null, [firestore]);
    const { data: plants } = useCollection<Plant>(plantsQuery);
    
    // 2. Fetch Parties from XD01 for accurate Vendor details
    const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "parties")) : null, [firestore]);
    const { data: parties } = useCollection<Party>(partiesQuery);

    const firm = useMemo(() => {
        if (!plants) return null;
        return plants.find(p => normalizePlantId(p.id) === normalizePlantId(invoice.plantId));
    }, [plants, invoice.plantId]);

    const vendorMasterData = useMemo(() => {
        if (!parties) return null;
        return parties.find(p => p.id === invoice.vendorId);
    }, [parties, invoice.vendorId]);

    const handlePrint = () => {
        if (typeof window === 'undefined') return;
        const originalTitle = document.title;
        document.title = `Payment_Voucher_${invoice.invoiceNo}`;
        window.print();
        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
    };

    const taxableValue = Number(invoice.taxableAmount || invoice.taxable || 0);
    const grossAmount = Number(invoice.grossAmount || invoice.payableAmount || taxableValue || 0);
    
    const payments = invoice.payments || [];
    const totalPaid = payments.reduce((sum, p) => sum + (p.paidAmount || 0) + (p.tdsAmount || 0) + (p.deductionAmount || 0), 0);
    const balance = Math.max(0, grossAmount - totalPaid);
    const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
    const previousPayments = payments.length > 1 ? payments.slice(0, -1) : [];

    // Preference: XD01 Registry (Master Data) > MIRO Snapshot (Transactional Data)
    const displayVendorName = vendorMasterData?.name || invoice.vendorName;
    const displayVendorGstin = vendorMasterData?.gstin || invoice.vendorGstin;
    const displayVendorPan = vendorMasterData?.pan || invoice.vendorPan;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0 border-none shadow-3xl bg-slate-50 overflow-hidden">
                <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-12 print:hidden">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                                <Printer className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Print Payment Manifest</DialogTitle>
                                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">Registry Extraction Node</DialogDescription>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="h-10 bg-white/10 border-white/20 text-white font-black text-[10px] uppercase tracking-widest px-6" onClick={handlePrint}>
                                <FileDown className="h-4 w-4 mr-2" /> Download PDF
                            </Button>
                            <Button className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-8 border-none shadow-lg" onClick={handlePrint}>
                                <Printer className="h-4 w-4 mr-2" /> Print Document
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-12 bg-white m-8 rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col items-center print:m-0 print:p-0 print:border-none print:shadow-none">
                    <div ref={contentRef} id="printable-area" className="w-full max-w-[210mm] p-[15mm] bg-white text-black font-sans text-[10pt] leading-snug print:p-0">
                        
                        {/* 1. TOP CENTER TITLE */}
                        <div className="flex justify-center mb-6">
                            <div className="border-4 border-black px-10 py-2.5">
                                <span className="text-[14pt] font-black uppercase tracking-[0.4em] leading-none">PAYMENT VOUCHER</span>
                            </div>
                        </div>

                        {/* 2. HEADER NODE: FIRM (LEFT) & META (RIGHT) */}
                        <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-8">
                            <div className="space-y-1.5 flex-1">
                                <h1 className="text-[18pt] font-black uppercase leading-none tracking-tighter text-slate-900">{firm?.name || invoice.firmName}</h1>
                                <p className="text-[9pt] font-bold text-slate-600 italic max-w-[320px]">{firm?.address || 'Registry Address Pending'}</p>
                                <div className="text-[9pt] font-black pt-3 flex flex-col gap-0.5">
                                    <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">GSTIN:</span> <span className="font-mono">{firm?.gstin || '--'}</span></p>
                                    <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">PAN:</span> <span className="font-mono">{firm?.pan || '--'}</span></p>
                                </div>
                            </div>
                            
                            <div className="text-right flex flex-col items-end gap-1.5 min-w-[240px]">
                                <div className="text-[9pt] font-bold text-slate-500 uppercase space-y-1">
                                    <p className="flex justify-between gap-4"><span>Voucher Number:</span> <span className="font-black text-blue-900 font-mono tracking-tighter">{lastPayment?.id?.slice(-8).toUpperCase() || 'PENDING'}</span></p>
                                    <p className="flex justify-between gap-4"><span>Voucher Date:</span> <span className="font-black text-black">{format(new Date(), 'dd MMM yyyy')}</span></p>
                                    <p className="flex justify-between gap-4 pt-1 border-t border-slate-100"><span>Invoice Ref:</span> <span className="font-black text-black">{invoice.invoiceNo}</span></p>
                                    <p className="flex justify-between gap-4"><span>Invoice Date:</span> <span className="font-black text-black">{invoice.invoiceDate ? format(new Date(invoice.invoiceDate), 'dd.MM.yyyy') : '--'}</span></p>
                                </div>
                            </div>
                        </div>

                        {/* 3. VENDOR CONTEXT - CROSS REFERENCED FROM XD01 REGISTRY */}
                        <div className="grid grid-cols-2 gap-12 mb-10">
                            <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-200">
                                <span className="text-[8pt] font-black uppercase text-slate-400 block mb-2 tracking-widest">Payee Registry Node (XD01 Sync)</span>
                                <p className="text-[12pt] font-black uppercase text-slate-900 tracking-tight">{displayVendorName}</p>
                                <div className="mt-4 pt-4 border-t border-slate-200 space-y-1 font-bold text-[9pt]">
                                    <p>GSTIN: <span className="font-mono">{displayVendorGstin || '--'}</span></p>
                                    <p>PAN: <span className="font-mono">{displayVendorPan || '--'}</span></p>
                                    <p className="uppercase text-slate-500">{invoice.vendorState} ({invoice.vendorStateCode})</p>
                                </div>
                            </div>
                            <div className="p-6 bg-white rounded-2xl border-2 border-black space-y-4">
                                <span className="text-[8pt] font-black uppercase text-slate-400 block mb-2 tracking-widest">Beneficiary Banking Hub</span>
                                <div className="space-y-2 font-black text-[9pt]">
                                    <p className="flex justify-between"><span>BANK:</span> <span>{vendorMasterData?.bankName || 'N/A'}</span></p>
                                    <p className="flex justify-between font-mono"><span>A/C:</span> <span>{vendorMasterData?.accountNumber || 'N/A'}</span></p>
                                    <p className="flex justify-between font-mono"><span>UTR:</span> <span className="text-blue-700">{lastPayment?.paymentRefNo || '--'}</span></p>
                                </div>
                            </div>
                        </div>

                        {/* 4. SETTLEMENT TABLE (Current Payment) */}
                        <div className="mb-10">
                            <table className="w-full border-collapse border-4 border-black">
                                <thead className="bg-slate-900 text-white">
                                    <tr className="h-12">
                                        <th className="px-6 text-[9pt] font-black uppercase text-left border-r border-white/20">Financial Metric Description</th>
                                        <th className="px-6 text-[9pt] font-black uppercase text-right w-48">Current Registry Value (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="h-10 border-b-2 border-slate-200">
                                        <td className="px-6 font-bold text-slate-600 italic">Total Taxable Value (Inbound Manifest)</td>
                                        <td className="px-6 text-right font-bold">₹ {taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr className="h-10 border-b-2 border-slate-200">
                                        <td className="px-6 font-bold text-slate-600 italic">Aggregate GST Component Node</td>
                                        <td className="px-6 text-right font-bold">₹ {(invoice.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr className="h-10 bg-slate-50 border-b-4 border-black">
                                        <td className="px-6 font-black uppercase tracking-wider text-slate-900">GROSS INVOICE AMOUNT</td>
                                        <td className="px-6 text-right font-black text-slate-900">₹ {grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    
                                    <tr className="h-10 border-b-2 border-slate-200">
                                        <td className="px-6 font-black text-blue-700 uppercase text-[8pt]">Current: Pay Amount</td>
                                        <td className="px-6 text-right font-black">₹ {(lastPayment?.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr className="h-10 border-b-2 border-slate-200">
                                        <td className="px-6 font-black text-orange-600 uppercase text-[8pt]">Current: TDS Amount</td>
                                        <td className="px-6 text-right font-black">₹ {(lastPayment?.tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr className="h-10 border-b-2 border-slate-200">
                                        <td className="px-6 font-black text-red-600 uppercase text-[8pt]">Current: Deduction</td>
                                        <td className="px-6 text-right font-black">₹ {(lastPayment?.deductionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    
                                    {lastPayment?.deductionRemark && (
                                        <tr className="h-10 bg-red-50/30 border-b-2 border-red-100">
                                            <td colSpan={2} className="px-6 py-2">
                                                <span className="text-[7pt] font-black uppercase text-red-400 block tracking-widest">Deduction Remark:</span>
                                                <span className="text-[8.5pt] font-bold text-red-900 italic">"{lastPayment.deductionRemark}"</span>
                                            </td>
                                        </tr>
                                    )}
                                    
                                    <tr className="h-12 border-b-4 border-black">
                                        <td className="px-6 font-bold text-emerald-700 italic">Total Liquidated this run (Actual Pay + TDS + Ded)</td>
                                        <td className="px-6 text-right font-black text-emerald-700">₹ {((lastPayment?.paidAmount || 0) + (lastPayment?.tdsAmount || 0) + (lastPayment?.deductionAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    
                                    <tr className="h-14 bg-slate-900 text-white">
                                        <td className="px-6 font-black uppercase tracking-[0.2em] text-[11pt]">Closing Balance after this run</td>
                                        <td className="px-6 text-right font-black text-[16pt] tracking-tighter text-blue-400">₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 5. PREVIOUS PAYMENT LEDGER NODE */}
                        {previousPayments.length > 0 && (
                            <div className="mb-10 space-y-3">
                                <div className="flex items-center gap-2 border-b-2 border-black pb-1">
                                    <History className="h-4 w-4" />
                                    <h3 className="text-[10pt] font-black uppercase tracking-widest">PREVIOUS SETTLEMENT REGISTRY</h3>
                                </div>
                                <table className="w-full border-collapse border-2 border-black">
                                    <thead className="bg-slate-100">
                                        <tr className="h-8">
                                            <th className="px-4 text-[8pt] font-black uppercase text-left border-r border-black">Voucher ID</th>
                                            <th className="px-4 text-[8pt] font-black uppercase text-center border-r border-black">Date</th>
                                            <th className="px-4 text-[8pt] font-black uppercase text-left border-r border-black">Bank Ref (UTR)</th>
                                            <th className="px-4 text-[8pt] font-black uppercase text-right">Aggregate (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previousPayments.map((p, i) => {
                                            const agg = (p.paidAmount || 0) + (p.tdsAmount || 0) + (p.deductionAmount || 0);
                                            return (
                                                <tr key={i} className="h-8 border-b border-black last:border-b-0">
                                                    <td className="px-4 font-mono text-[8pt] border-r border-black">{p.id.slice(-8).toUpperCase()}</td>
                                                    <td className="px-4 text-center text-[8pt] border-r border-black">{format(new Date(p.paymentDate), 'dd.MM.yyyy')}</td>
                                                    <td className="px-4 font-mono text-[8pt] border-r border-black uppercase text-slate-600">{p.paymentRefNo || '--'}</td>
                                                    <td className="px-4 text-right font-bold text-[9pt]">₹ {agg.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* 6. SIGNATURES */}
                        <div className="mt-auto pt-16 grid grid-cols-2 gap-20">
                            <div className="text-center">
                                <div className="border-t-2 border-black border-dashed pt-2">
                                    <p className="font-black uppercase tracking-widest text-[9pt]">Receiver Authentication</p>
                                    <span className="text-[7pt] text-slate-400 font-bold uppercase">(Stamp & Signatory)</span>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="border-t-2 border-black border-dashed pt-2">
                                    <p className="font-black uppercase tracking-widest text-[9pt]">Certified Accountant</p>
                                    <span className="text-[7pt] text-slate-400 font-bold uppercase">(Mission Control Approval)</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 flex flex-col items-center gap-2 opacity-30">
                            <ShieldCheck className="h-10 w-10" />
                            <p className="text-[7pt] font-black uppercase tracking-[0.5em]">Digitally Verified Payment Settlement Registry</p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t shrink-0 print:hidden">
                    <Button variant="outline" onClick={onClose} className="font-black text-slate-500 uppercase text-[10px] tracking-widest px-8 h-11 rounded-xl">Discard Preview</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
