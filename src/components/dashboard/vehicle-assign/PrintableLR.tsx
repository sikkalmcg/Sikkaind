'use client';

import React from 'react';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import type { LR, Trip, Shipment, Carrier, Plant } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { ShieldCheck } from 'lucide-react';

export type EnrichedLR = LR & {
  trip: Trip;
  carrier: Carrier;
  shipment: Shipment;
  plant: Plant;
};

interface PrintableLRProps {
  lr: EnrichedLR;
  copyType: string;
  pageNumber: number;
  totalInSeries: number;
}

/**
 * @fileOverview SIKKA LMC - Simplified Enterprise Lorry Receipt (LR) Node.
 * Optimized for A4 printing. Removes E-waybill, QR, and Goods Value.
 * Displays City-only routing for From/To.
 * Replaced Consignee Signature with Carrier Terms & Conditions.
 */
export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    if (!date) return 'N/A';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return isValid(d) ? format(d, pattern) : 'N/A';
  };

  const items = lr.items || [];
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  const totalWeight = lr.assignedTripWeight || items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  // Registry Logic: Extract City only from From/To strings
  const getCity = (str: string) => {
    if (!str) return 'N/A';
    return str.split(',')[0].trim().toUpperCase();
  };

  const carrierTerms = lr.carrier?.terms || [];

  return (
    <div className="A4-page p-[8mm] bg-white text-black font-sans text-[9pt] leading-tight border border-slate-100 print:border-none h-[297mm] flex flex-col relative select-text box-border">
      
      {/* 1. TOP HEADER REGISTRY */}
      <div className="text-center mb-4 border-b border-black pb-2">
        <span className="text-[10pt] font-black uppercase tracking-[0.5em] text-slate-900">{copyType}</span>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4 flex-1">
          <div className="h-16 w-16 bg-slate-100 rounded-lg flex items-center justify-center border-2 border-black shrink-0">
            {lr.carrier?.logoUrl ? (
                <img src={lr.carrier.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
                <div className="text-[8px] font-black text-slate-400 uppercase text-center leading-none">SIKKA<br/>LOGISTICS</div>
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-[14pt] font-black uppercase tracking-tight leading-none text-slate-900">
              {lr.carrier?.name || 'SIKKA INDUSTRIES & LOGISTICS'}
            </h1>
            <p className="text-[8pt] font-bold text-slate-700 max-w-[400px] leading-snug">
              {lr.carrier?.address || 'C - 17, South Side Of GT Road UPSIDC, Ghaziabad - 201009'}
            </p>
            <div className="text-[8pt] font-black text-slate-600 flex flex-wrap gap-x-4">
              <p>PHONE: {lr.carrier?.mobile || 'N/A'}</p>
              <p>GSTIN: <span className="font-mono">{lr.carrier?.gstin || '--'}</span></p>
            </div>
          </div>
        </div>

        <div className="text-right space-y-3">
            <div className="border-[3px] border-black px-4 py-2 bg-white min-w-[180px]">
                <p className="text-[12pt] font-black uppercase text-slate-900 flex justify-between gap-4">
                    <span>CN NO |</span> <span>{lr.lrNumber}</span>
                </p>
            </div>
            <div className="text-[8.5pt] font-black text-slate-900 uppercase space-y-1">
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>DATE:</span> <span>{formatDate(lr.date)}</span></p>
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>FROM:</span> <span>{getCity(lr.from)}</span></p>
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>TO:</span> <span>{getCity(lr.to)}</span></p>
            </div>
        </div>
      </div>

      {/* 2. MISSION PARTICULARS */}
      <div className="grid grid-cols-5 border-2 border-black rounded-lg overflow-hidden mb-6 bg-white divide-x-2 divide-black">
        {[
            { label: 'Vehicle Number', value: lr.vehicleNumber },
            { label: 'Pilot Contact', value: lr.driverMobile || lr.trip?.driverMobile || 'N/A' },
            { label: 'Vehicle Type', value: lr.trip?.vehicleType || 'Truck' },
            { label: 'Payment Term', value: lr.paymentTerm || 'Paid' },
            { label: 'Dispatch', value: formatDate(lr.trip?.startDate, 'dd/MM/yy HH:mm') }
        ].map((node, i) => (
            <div key={i} className="p-2 text-center flex flex-col justify-center">
                <span className="text-[6.5pt] font-black uppercase text-slate-400 block mb-1 leading-none">{node.label}</span>
                <p className="text-[8.5pt] font-black uppercase truncate leading-none">{node.value}</p>
            </div>
        ))}
      </div>

      {/* 3. ENTITY REGISTRY */}
      <div className="grid grid-cols-2 border-2 border-black rounded-xl overflow-hidden mb-6 divide-x-2 divide-black">
        <div className="p-4 space-y-2">
            <span className="text-[8pt] font-black uppercase text-white bg-black px-2 py-0.5 inline-block rounded mb-1">CONSIGNOR (SENDER)</span>
            <div className="text-[8.5pt] space-y-1">
                <p className="font-black uppercase">{lr.consignorName}</p>
                <p className="text-slate-700 font-bold leading-tight">{lr.consignorAddress || lr.from}</p>
                <p className="font-black text-slate-900 mt-2">GSTIN: <span className="font-mono">{lr.consignorGtin || '--'}</span></p>
            </div>
        </div>
        <div className="p-4 space-y-2 bg-slate-50/30">
            <span className="text-[8pt] font-black uppercase text-white bg-black px-2 py-0.5 inline-block rounded mb-1">CONSIGNEE (RECEIVER)</span>
            <div className="text-[8.5pt] space-y-1">
                <p className="font-black uppercase">{lr.buyerName}</p>
                <p className="text-slate-700 font-bold leading-tight">{lr.deliveryAddress || lr.to}</p>
                <p className="font-black text-slate-900 mt-2">GSTIN: <span className="font-mono">{lr.buyerGtin || '--'}</span></p>
            </div>
        </div>
      </div>

      {/* 4. MANIFEST TABLE (Adjustable height) */}
      <div className="border-2 border-black rounded-xl overflow-hidden mb-6 flex-1 flex flex-col min-h-0">
        <table className="w-full border-collapse">
          <thead className="bg-black text-white text-[7.5pt] font-black uppercase tracking-wider">
            <tr className="h-10">
              <th className="border-r border-white/20 px-4 text-left w-48">Document Ref (Invoice)</th>
              <th className="border-r border-white/20 px-4 text-left">Description of Goods</th>
              <th className="border-r border-white/20 px-4 text-center w-32">No. of Pkgs</th>
              <th className="px-4 text-right w-40">Weight (MT)</th>
            </tr>
          </thead>
          <tbody className="text-[9pt] font-bold text-slate-900 divide-y border-b border-black">
            {items.map((item, idx) => (
              <tr key={idx} className="h-10 align-middle hover:bg-slate-50 transition-colors">
                <td className="border-r border-slate-200 px-4 font-black uppercase">{item.invoiceNumber}</td>
                <td className="border-r border-slate-200 px-4 uppercase">{item.itemDescription}</td>
                <td className="border-r border-slate-200 px-4 text-center font-black">{item.units}</td>
                <td className="px-4 text-right font-black text-blue-900">{Number(item.weight).toFixed(3)}</td>
              </tr>
            ))}
            {/* Logic: Grow with whitespace if items are few */}
            {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-10 border-b border-slate-50 opacity-10">
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                <td></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-black h-12">
            <tr className="align-middle">
              <td colSpan={2} className="px-6 text-[9pt] uppercase tracking-widest">MANIFEST REGISTRY TOTALS:</td>
              <td className="border-l-2 border-black px-4 text-center text-[10pt]">{totalUnits} PKGS</td>
              <td className="border-l-2 border-black px-4 text-right text-[10pt] text-blue-900">{totalWeight.toFixed(3)} MT</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 5. TERMS & SIGNATURE */}
      <div className="mt-4 mb-8">
        <div className="grid grid-cols-2 gap-16">
            <div className="space-y-3">
                <span className="text-[8pt] font-black uppercase text-slate-900 border-b border-slate-200 block pb-1">TERMS & CONDITIONS</span>
                <div className="min-h-[100px] w-full bg-slate-50/30 p-2 rounded-lg border border-slate-100 text-[7pt] text-slate-600 space-y-1">
                    {carrierTerms.length > 0 ? (
                        <ul className="list-decimal pl-4 space-y-0.5">
                            {carrierTerms.map((term, i) => (
                                <li key={i} className="font-medium">{term}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="italic text-slate-400">Standard transport terms apply.</p>
                    )}
                </div>
            </div>

            <div className="space-y-3 text-center">
                <span className="text-[8pt] font-black uppercase text-slate-900 border-b border-slate-200 block pb-1">FOR {lr.carrier?.name || 'SIKKA LOGISTICS'}</span>
                <div className="h-24 flex flex-col justify-end items-center">
                    <div className="w-full border-t-2 border-black border-dashed mb-2" />
                    <span className="text-[8pt] font-black uppercase tracking-widest">AUTHORIZED SIGNATORY</span>
                </div>
            </div>
        </div>
      </div>

      {/* 6. FOOTER NODE - Synchronized with Image Manifest */}
      <div className="mt-auto pt-4 border-t border-slate-200 flex flex-col items-center gap-1.5 shrink-0">
        <p className="text-[7.5pt] font-black uppercase text-blue-400/80 tracking-widest">
            REGISTRY HANDSHAKE PAGE {pageNumber} OF {totalInSeries} | CERTIFIED NODE SYNC
        </p>
        <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[7.5pt] font-black uppercase tracking-[0.5em] text-slate-500">VERIFIED SIKKA LMC REGISTRY DOCUMENT</span>
        </div>
      </div>
    </div>
  );
}
