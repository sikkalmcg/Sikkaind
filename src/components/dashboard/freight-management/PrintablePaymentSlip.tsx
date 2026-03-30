'use client';

import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { ShieldCheck, History, Landmark, Calculator, Receipt, User, Truck, MapPin } from 'lucide-react';
import type { EnrichedFreight } from '@/app/dashboard/freight-management/page';
import { Separator } from '@/components/ui/separator';
import { Timestamp } from 'firebase/firestore';

/**
 * @fileOverview SIKKA LMC - Printable Payment Slip Node.
 * Professional A4 Layout with Top-Center Title architecture.
 * Synchronized with Detailed Liquidation Ledger.
 */

export default function PrintablePaymentSlip({ freight, payment }: { freight: EnrichedFreight, payment: any }) {
    const { trip, plant, shipment } = freight;
    
    // Carrier Logic Node
    const carrier = (typeof trip.carrier === 'string' ? { name: trip.carrier, address: 'N/A', gstin: 'N/A', stateName: 'N/A' } : (trip as any).carrierObj) || {};

    const formatDate = (date: any, pattern: string = 'dd-MMM-yyyy') => {
        if (!date) return '--';
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        return isValid(d) ? format(d, pattern) : '--';
    };

    // Financial Calculation Registry Nodes
    const totalFreight = Number(freight.totalFreightAmount || 0);
    const advanceAmt = Number(freight.advanceAmount || 0);
    const allPayments = freight.payments || [];
    
    const cashPayments = allPayments.filter((p: any) => p.mode === 'Cash');
    const bankingPayments = allPayments.filter((p: any) => p.mode !== 'Cash');
    
    const totalCash = cashPayments.reduce((s: number, p: any) => s + (Number(p.paidAmount || p.amount) || 0), 0);
    const totalBanking = bankingPayments.reduce((s: number, p: any) => s + (Number(p.paidAmount || p.amount) || 0), 0) + advanceAmt;
    
    const totalTds = allPayments.reduce((s: number, p: any) => s + (Number(p.tdsAmount) || 0), 0);
    const totalDeduction = allPayments.reduce((s: number, p: any) => s + (Number(p.deductionAmount) || 0), 0);
    
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
        { label: 'Vehicle Number', value: trip.vehicleNumber, bold: true },
        { label: 'Pilot Contact', value: trip.driverMobile, mono: true },
        { label: 'Transporter', value: trip.transporterName || 'Self' },
        { label: 'Lifting Node', value: plant.name },
        { label: 'Drop Node', value: trip.unloadingPoint },
        { label: 'Quantity (MT)', value: trip.assignedQtyInTrip, bold: true },
        { label: 'Freight Rate', value: trip.freightRate ? `₹ ${trip.freightRate}` : '--' },
        { label: 'Total Mission Freight', value: `₹ ${Number(freight.totalFreightAmount).toLocaleString('en-IN')}`, bold: true, color: 'text-blue-900' },
        { label: 'POD Status', value: trip.podReceived ? 'Received' : 'Pending', uppercase: true },
    ];

    // CONSOLIDATED LEDGER MANIFEST
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
            details: trip.bankName ? `${trip.bankName} | ${trip.accountNumber}` : 'Registry'
        });
    }
    
    allPayments.forEach((p: any) => {
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
            details: account ? `${account.bankName} | ${account.accountNumber}` : (isCash ? 'CASH' : '--')
        });
    });

    return (
        <div id="printable-area" className="A4-page flex flex-col h-full bg-white text-black font-sans box-border select-text print:m-0 print:p-0">
            
            {/* 1. TOP CENTER TITLE */}
            <div className="flex justify-center mb-8 shrink-0">
                <div className="border-4 border-black px-12 py-3 bg-white">
                    <span className="text-[16pt] font-black uppercase tracking-[0.5em] leading-none">PAYMENT SLIP</span>
                </div>
            </div>

            {/* 2. HEADER: CARRIER & META */}
            <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-8 shrink-0">
                <div className="space-y-1.5 flex-1 pr-10">
                    <h1 className="text-[16pt] font-black uppercase leading-none tracking-tight text-slate-900">{carrier.name || 'Sikka Logistics'}</h1>
                    <p className="text-[9pt] font-bold text-slate-600 italic max-w-[350px]">{carrier.address || 'N/A'}</p>
                    <div className="text-[9pt] font-black pt-2 flex flex-col gap-0.5">
                        <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">GSTIN:</span> <span className="font-mono">{carrier.gstin || '--'}</span></p>
                        <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">STATE:</span> <span className="uppercase">{carrier.stateName || '--'}</span></p>
                    </div>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1.5 min-w-[260px]">
                    <div className="text-[9.5pt] font-bold text-slate-500 uppercase space-y-1.5 w-full">
                        <p className="flex justify-between gap-4"><span>Slip Number:</span> <span className="font-black text-emerald-700 font-mono tracking-tighter text-base">#{payment.slipNumber || 'PENDING'}</span></p>
                        <p className="flex justify-between gap-4"><span>Slip Date:</span> <span className="font-black text-black">{formatDate(payment.paymentDate, 'dd MMM yyyy')}</span></p>
                        <Separator className="my-1 bg-slate-200" />
                        <p className="flex justify-between gap-4"><span>Trip ID:</span> <span className="font-black text-blue-900">{trip.tripId}</span></p>
                    </div>
                </div>
            </div>

            {/* 3. TRIP PARTICULARS GRID */}
            <div className="mb-8 space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <Truck className="h-4 w-4 text-blue-600" />
                    <h3 className="text-[9pt] font-black uppercase tracking-widest">MISSION TRIP REGISTRY</h3>
                </div>
                <div className="border-2 border-black grid grid-cols-3 divide-x-2 divide-black divide-y-2 rounded-xl overflow-hidden shadow-sm">
                    {tripGrid.map((item, i) => (
                        <div key={i} className="p-3 bg-white">
                            <span className="text-[7pt] font-black uppercase text-slate-400 block mb-1 tracking-wider">{item.label}</span>
                            <p className={cn(
                                "text-[9.5pt] leading-none",
                                item.bold ? "font-black text-slate-900" : "font-bold text-slate-700",
                                item.mono && "font-mono tracking-tighter text-blue-700",
                                item.uppercase && "uppercase",
                                item.label === 'POD Status' && (item.value === 'Received' ? 'text-emerald-600' : 'text-red-600')
                            )}>{item.value || '--'}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. LIQUIDATION SUMMARY */}
            <div className="mb-8 space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    <h3 className="text-[9pt] font-black uppercase tracking-widest">LIQUIDATION SUMMARY</h3>
                </div>
                <div className="border-2 border-black rounded-[2rem] p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 bg-slate-50/50">
                    {summaryNodes.map((node, i) => (
                        <div key={i} className={cn("flex flex-col gap-1.5", node.highlight && "lg:col-span-1 bg-slate-900 p-3 -m-3 rounded-2xl text-white shadow-xl")}>
                            <span className={cn("text-[7.5pt] font-black uppercase tracking-wider", node.highlight ? "text-blue-400" : "text-slate-400")}>{node.label}</span>
                            <p className={cn(
                                "text-[11pt] font-black tracking-tighter leading-none whitespace-nowrap",
                                node.color || (node.highlight ? "text-white" : "text-slate-900")
                            )}>₹ {Number(node.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 5. DETAILED LEDGER */}
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
                                <th className="px-3 text-left">Bank Ref (UTR)</th>
                            </tr>
                        </thead>
                        <tbody className="text-[8pt] font-medium text-slate-700">
                            {ledgerItems.map((p, i) => (
                                <tr key={i} className="h-10 border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                                    <td className="px-3 font-black text-slate-900 border-r border-slate-200 uppercase truncate max-w-[150px]">{p.name}</td>
                                    <td className="px-2 text-right border-r border-slate-200 font-bold">{p.cash > 0 ? `₹${p.cash.toLocaleString()}` : '--'}</td>
                                    <td className="px-2 text-right border-r border-slate-200 font-black text-blue-700">{p.banking > 0 ? `₹${p.banking.toLocaleString()}` : '--'}</td>
                                    <td className="px-2 text-right border-r border-slate-200 font-bold text-orange-600">{p.tds > 0 ? `₹${p.tds.toLocaleString()}` : '--'}</td>
                                    <td className="px-2 text-right border-r border-slate-200 font-bold text-red-600">{p.ded > 0 ? `₹${p.ded.toLocaleString()}` : '--'}</td>
                                    <td className="px-2 text-center border-r border-slate-200 whitespace-nowrap">{formatDate(p.date, 'dd.MM.yy')}</td>
                                    <td className="px-3 font-mono text-[7pt] uppercase truncate max-w-[120px]">{p.ref}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 6. FOOTER SIGNATURES */}
            <div className="mt-auto pt-16 grid grid-cols-2 gap-20 shrink-0">
                <div className="text-center">
                    <div className="border-t-2 border-black border-dashed pt-2">
                        <p className="font-black uppercase tracking-widest text-[9pt]">Receiver / Authorized Signatory</p>
                        <span className="text-[7pt] text-slate-400 font-bold uppercase">(Mission Context Acceptance)</span>
                    </div>
                </div>
                <div className="text-center">
                    <div className="border-t-2 border-black border-dashed pt-2">
                        <p className="font-black uppercase tracking-widest text-[9pt]">Certified Accountant</p>
                        <span className="text-[7pt] text-slate-400 font-bold uppercase">(Control Node Approved)</span>
                    </div>
                </div>
            </div>

            {/* FOOTER NODE - Standardized Registry Footer */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col items-center gap-2 shrink-0">
                <p className="text-[7pt] font-bold text-slate-400 uppercase tracking-widest">
                    Financial Registry Handshake | Certified Node Sync
                </p>
                <div className="opacity-40 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-900" />
                    <span className="text-[6pt] font-black uppercase tracking-[0.5em]">Verified SIKKA LMC Registry Document</span>
                </div>
            </div>
        </div>
    );
}
