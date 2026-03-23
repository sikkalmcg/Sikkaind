'use client';

import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { ShieldCheck, Landmark, Truck, MapPin, Calculator, FileText, User, Receipt, History } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Timestamp } from 'firebase/firestore';

/**
 * @fileOverview SIKKA LMC - Printable Transporter Payment Voucher.
 * Synchronized with Detailed Liquidation Ledger.
 * Handshakes with Trip, Freight, and Banking registries.
 */

export default function PrintableVoucher({ trip }: { trip: any }) {
    const freight = trip.freightData || {};
    const carrier = trip.carrierObj || {};
    const payments = freight.payments || [];
    
    const formatDate = (date: any, pattern: string = 'dd-MMM-yyyy') => {
        if (!date) return '--';
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        return isValid(d) ? format(d, pattern) : '--';
    };

    // Financial Calculation Registry Nodes
    const totalFreight = Number(freight.totalFreightAmount || 0);
    const advanceAmt = Number(freight.advanceAmount || 0);
    
    // Aggregates from payments array
    const cashPayments = payments.filter((p: any) => p.mode === 'Cash');
    const bankingPayments = payments.filter((p: any) => p.mode !== 'Cash');
    
    const totalCash = cashPayments.reduce((s: number, p: any) => s + (Number(p.paidAmount || p.amount) || 0), 0);
    // User Requirement: Advance Paid should be Banking amount
    const totalBanking = bankingPayments.reduce((s: number, p: any) => s + (Number(p.paidAmount || p.amount) || 0), 0) + advanceAmt;
    
    const totalTds = payments.reduce((s: number, p: any) => s + (Number(p.tdsAmount) || 0), 0);
    const totalDeduction = payments.reduce((s: number, p: any) => s + (Number(p.deductionAmount) || 0), 0);
    
    // Balance Amount Logic: Total Freight – (Total Cash + Total Banking Transfer + TDS + Deduction)
    const balanceAmount = totalFreight - (totalCash + totalBanking + totalTds + totalDeduction);

    const summaryNodes = [
        { label: 'Total Freight', value: totalFreight, color: 'text-blue-900' },
        { label: 'Total Cash', value: totalCash },
        { label: 'Total Banking Transfer', value: totalBanking, color: 'text-indigo-600' },
        { label: 'TDS Registry', value: totalTds, color: 'text-orange-600' },
        { label: 'Deduction', value: totalDeduction, color: 'text-red-600' },
        { label: 'Balance Amount', value: balanceAmount, highlight: true },
    ];

    const tripGrid = [
        { label: 'Trip ID', value: trip.tripId, mono: true, bold: true },
        { label: 'LR Number', value: trip.lrNumber || '--', mono: true },
        { label: 'LR Date', value: formatDate(trip.lrDate) },
        { label: 'Vehicle Number', value: trip.vehicleNumber, bold: true },
        { label: 'Pilot Detail', value: `${trip.driverName || 'N/A'} (${trip.driverMobile || 'N/A'})` },
        { label: 'Transporter', value: trip.transporterName || 'Self' },
        { label: 'Dispatch FROM', value: trip.loadingPoint },
        { label: 'Ship To', value: trip.shipToParty },
        { label: 'Destination', value: trip.unloadingPoint },
    ];

    // CONSOLIDATED LEDGER MANIFEST (Include Advance as first row)
    const ledgerItems: any[] = [];
    if (advanceAmt > 0) {
        ledgerItems.push({
            name: trip.freightReceiverName || 'Initial Advance',
            cash: 0,
            banking: advanceAmt,
            tds: 0,
            ded: 0,
            date: trip.freightPostedAt || trip.startDate,
            ref: 'ADVANCE_NODE',
            details: trip.bankName ? `${trip.bankName} | A/C: ${trip.accountNumber}` : 'Lifting Node Registry'
        });
    }
    
    payments.forEach((p: any) => {
        const isCash = p.mode === 'Cash';
        const account = (trip.bankingAccounts || []).find((a: any) => a.id === p.targetAccountId);
        ledgerItems.push({
            name: account?.accountHolderName || trip.freightReceiverName || '--',
            cash: isCash ? (p.paidAmount || p.amount) : 0,
            banking: !isCash ? (p.paidAmount || p.amount) : 0,
            tds: p.tdsAmount || 0,
            ded: p.deductionAmount || 0,
            date: p.paymentDate,
            ref: p.referenceNo || p.paymentRefNo || '--',
            details: account ? `${account.bankName} | A/C: ${account.accountNumber}` : (isCash ? 'CASH SETTLEMENT' : '--')
        });
    });

    return (
        <div id="printable-area" className="A4-page flex flex-col h-full bg-white text-black font-sans text-[9.5pt] leading-tight select-text print:m-0 print:p-0">
            
            {/* 1. TOP CENTER TITLE */}
            <div className="flex justify-center mb-8 shrink-0">
                <div className="border-4 border-black px-12 py-3 bg-white">
                    <span className="text-[16pt] font-black uppercase tracking-[0.5em] leading-none">PAYMENT VOUCHER</span>
                </div>
            </div>

            {/* 2. HEADER: CARRIER & META */}
            <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-8 shrink-0">
                <div className="space-y-1.5 flex-1 pr-10">
                    <h1 className="text-[16pt] font-black uppercase leading-none tracking-tight">{carrier.name || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                    <p className="text-[8.5pt] font-bold text-slate-600 italic max-w-[400px]">{carrier.address || 'GHAZIABAD, UTTAR PRADESH'}</p>
                    <p className="text-[9pt] font-black mt-2">GSTIN: <span className="font-mono">{carrier.gstin || '09AABCU9567L1Z5'}</span></p>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1.5 min-w-[260px]">
                    <div className="text-[10pt] font-bold text-slate-500 uppercase space-y-1">
                        <p className="flex justify-between gap-4"><span>Voucher ID:</span> <span className="font-black text-blue-900 font-mono tracking-tighter text-lg">#{trip.id?.slice(-8).toUpperCase() || 'PENDING'}</span></p>
                        <p className="flex justify-between gap-4"><span>Voucher Date:</span> <span className="font-black text-black">{format(new Date(), 'dd MMM yyyy')}</span></p>
                    </div>
                </div>
            </div>

            {/* 3. MISSION TRIP REGISTRY GRID */}
            <div className="mb-8 space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <Truck className="h-4 w-4 text-blue-600" />
                    <h3 className="text-[9pt] font-black uppercase tracking-widest">MISSION TRIP REGISTRY</h3>
                </div>
                <div className="border-2 border-black grid grid-cols-3 divide-x-2 divide-black divide-y-2 rounded-xl overflow-hidden shadow-sm">
                    {tripGrid.map((item, i) => (
                        <div key={i} className="p-2.5 bg-white">
                            <span className="text-[7.5pt] font-black uppercase text-slate-400 block mb-0.5 tracking-wider">{item.label}</span>
                            <p className={cn(
                                "text-[9.5pt] leading-tight truncate uppercase",
                                item.bold ? "font-black text-slate-900" : "font-bold text-slate-700",
                                item.mono && "font-mono tracking-tighter text-blue-700"
                            )}>{item.value || '--'}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. FINANCIAL SUMMARY MANIFEST */}
            <div className="mb-10 space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    <h3 className="text-[9pt] font-black uppercase tracking-widest">LIQUIDATION SUMMARY</h3>
                </div>
                <div className="border-2 border-black rounded-[2rem] p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 bg-slate-50/50">
                    {summaryNodes.map((node, i) => (
                        <div key={i} className={cn("flex flex-col gap-1.5", node.highlight && "lg:col-span-1 bg-slate-900 p-3 -m-3 rounded-2xl text-white shadow-xl ring-4 ring-slate-100")}>
                            <span className={cn("text-[7.5pt] font-black uppercase tracking-wider", node.highlight ? "text-blue-400" : "text-slate-400")}>{node.label}</span>
                            <p className={cn(
                                "text-[11pt] font-black tracking-tighter leading-none whitespace-nowrap",
                                node.color || (node.highlight ? "text-white text-base" : "text-slate-900")
                            )}>₹ {Number(node.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 5. DETAILED LIQUIDATION LEDGER */}
            <div className="mb-10 space-y-4 flex-1">
                <div className="flex items-center gap-2 px-1">
                    <History className="h-4 w-4 text-slate-400" />
                    <h3 className="text-[9pt] font-black uppercase tracking-widest">DETAILED LIQUIDATION LEDGER</h3>
                </div>
                <div className="border-2 border-black rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-900 text-white text-[7.5pt] font-black uppercase tracking-widest border-b border-black">
                            <tr className="h-10">
                                <th className="px-3 text-left border-r border-white/10">Beneficiary Name</th>
                                <th className="px-2 text-right border-r border-white/10">Cash Payment</th>
                                <th className="px-2 text-right border-r border-white/10">Banking Transfer</th>
                                <th className="px-2 text-right border-r border-white/10">TDS</th>
                                <th className="px-2 text-right border-r border-white/10">Deduction</th>
                                <th className="px-2 text-center border-r border-white/10">Date</th>
                                <th className="px-3 text-left border-r border-white/10">Banking Ref</th>
                                <th className="px-3 text-left">A/C & IFSC Registry</th>
                            </tr>
                        </thead>
                        <tbody className="text-[8pt] font-medium text-slate-700">
                            {ledgerItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="h-20 text-center text-slate-400 italic uppercase tracking-widest">No liquidation nodes detected in registry.</td>
                                </tr>
                            ) : (
                                ledgerItems.map((p: any, i: number) => (
                                    <tr key={i} className="h-10 border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                                        <td className="px-3 font-black text-slate-900 border-r border-slate-200 uppercase truncate max-w-[120px]">{p.name}</td>
                                        <td className="px-2 text-right border-r border-slate-200 font-bold">{p.cash > 0 ? `₹${p.cash.toLocaleString()}` : '--'}</td>
                                        <td className="px-2 text-right border-r border-slate-200 font-black text-blue-700">{p.banking > 0 ? `₹${p.banking.toLocaleString()}` : '--'}</td>
                                        <td className="px-2 text-right border-r border-slate-200 font-bold text-orange-600">{p.tds > 0 ? `₹${p.tds.toLocaleString()}` : '--'}</td>
                                        <td className="px-2 text-right border-r border-slate-200 font-bold text-red-600">{p.ded > 0 ? `₹${p.ded.toLocaleString()}` : '--'}</td>
                                        <td className="px-2 text-center border-r border-slate-200 whitespace-nowrap">{formatDate(p.date, 'dd.MM.yy')}</td>
                                        <td className="px-3 font-mono text-[7pt] border-r border-slate-200 uppercase truncate max-w-[100px]">{p.ref}</td>
                                        <td className="px-3 font-mono text-[7pt] text-slate-500 leading-tight">
                                            {p.details}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 6. SIGNATURES & COMPLIANCE */}
            <div className="mt-auto flex flex-col gap-10">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                    <p className="text-[8pt] font-black text-slate-400 italic">"Note: This is a system auto-generated transporter payment voucher and does not require a physical signature for registry validation."</p>
                </div>

                <div className="grid grid-cols-2 gap-24 px-10">
                    <div className="text-center border-t-2 border-black border-dashed pt-2">
                        <p className="font-black uppercase tracking-widest text-[9.5pt] text-slate-900">Verified By Signature</p>
                        <span className="text-[7pt] text-slate-400 font-bold uppercase">(Mission Context Authentication)</span>
                    </div>
                    <div className="text-center border-t-2 border-black border-dashed pt-2">
                        <p className="font-black uppercase tracking-widest text-[9.5pt] text-slate-900">Accountant Signature</p>
                        <span className="text-[7pt] text-slate-400 font-bold uppercase">(Authorized Liquidation Node)</span>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 opacity-30 mt-4">
                    <ShieldCheck className="h-10 w-10 text-slate-900" />
                    <p className="text-[7pt] font-black uppercase tracking-[0.5em] text-center">Verified SIKKA LMC Financial Settlement Node</p>
                </div>
            </div>
        </div>
    );
}
