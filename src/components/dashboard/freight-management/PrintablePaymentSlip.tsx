'use client';

import { format, isValid } from 'date-fns';
import { cn, parseSafeDate } from '@/lib/utils';
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
    
    // Carrier Logic Node: Re-resolve full profile for the header
    const carrier = (trip as any).carrierObj || (typeof trip.carrier === 'object' ? { name: trip.carrier, address: 'N/A', gstin: 'N/A', stateName: 'N/A' } : trip.carrier) || {};

    const formatDate = (date: any, pattern: string = 'dd-MMM-yyyy') => {
        const d = parseSafeDate(date);
        return d && isValid(d) ? format(d, pattern).toUpperCase() : '--';
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
        { label: 'Drop Point (TO)', value: trip.unloadingPoint },
        { label: 'Quantity (MT)', value: trip.assignedQtyInTrip, bold: true },
        { label: 'Freight Rate', value: trip.freightRate ? `₹ ${trip.freightRate}` : '--' },
        { label: 'Total Mission Freight', value: `₹ ${Number(freight.totalFreightAmount).toLocaleString('en-IN')}`, bold: true, color: 'text-blue-900' },
        { label: 'POD Status', value: trip.podReceived ? 'Received' : 'Pending', uppercase: true },
    ];

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
                    <h1 className="text-[16pt] font-black uppercase leading-none tracking-tight text-slate-900">{carrier.name || 'SIKKA LMC'}</h1>
                    <p className="text-[8.5pt] font-bold text-slate-600 uppercase max-w-[450px] leading-tight">{carrier.address || 'GHAZIABAD, UTTAR PRADESH'}</p>
                    <div className="text-[8pt] font-black pt-2 flex flex-wrap gap-x-4 gap-y-1 uppercase leading-snug">
                        <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">PHONE:</span> <span className="text-slate-900 font-mono">{carrier.mobile || '9136688004'}</span></p>
                        <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">GSTIN:</span> <span className="font-mono text-slate-900">{carrier.gstin || '--'}</span></p>
                        <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">PAN:</span> <span className="font-mono text-slate-900">{carrier.pan || '--'}</span></p>
                        <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">STATE:</span> <span className="text-slate-900">{carrier.stateName || '--'}</span></p>
                        <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">CODE:</span> <span className="text-slate-900">{carrier.stateCode || '--'}</span></p>
                        {carrier.email && <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">E-MAIL:</span> <span className="text-slate-900 lowercase font-bold">{carrier.email}</span></p>}
                        {carrier.website && <p className="flex items-center gap-2"><span className="text-slate-400 font-bold uppercase text-[7pt]">WEB:</span> <span className="text-slate-900 lowercase font-bold">{carrier.website}</span></p>}
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

            {/* 6. STANDARDIZED TERMS & SIGNATURES */}
            <div className="mt-auto pt-8 border-t-2 border-slate-100 grid grid-cols-2 gap-12 shrink-0">
                <div className="space-y-4">
                    <span className="text-[9pt] font-bold uppercase text-slate-900 border-b border-black inline-block pb-1 tracking-widest italic">TERMS & CONDITIONS</span>
                    <div className="space-y-1.5 pt-1">
                        {[
                            "AGENCY NOT RESPONSIBLE FOR RAIN OR CALAMITY.",
                            "DISCREPANCIES MUST BE INTIMATED WITHIN 24 HOURS.",
                            "VEHICLE OWNER RESPONSIBLE AFTER YARD DEPARTURE.",
                            "ALL DISPUTES SUBJECT TO GHAZIABAD JURISDICTION."
                        ].map((term, i) => (
                            <p key={i} className="text-[7pt] font-normal text-slate-600 leading-tight uppercase tracking-tight">
                                {i + 1}. {term}
                            </p>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col justify-end text-center">
                    <div className="border-t-2 border-black border-dashed pt-4">
                        <p className="font-black uppercase tracking-widest text-[9.5pt] text-slate-900 italic">AUTHORIZED SIGNATURE</p>
                        <span className="text-[7pt] text-slate-400 font-bold uppercase">(Control Node Approved)</span>
                    </div>
                </div>
            </div>

            {/* FOOTER NODE */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[7.5pt] font-black uppercase tracking-[0.5em] text-slate-500">VERIFIED SIKKA LMC REGISTRY DOCUMENT</span>
                </div>
            </div>
        </div>
    );
}
