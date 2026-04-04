'use client';

import React from 'react';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate } from '@/lib/utils';
import type { LR, Trip, Shipment, Carrier, Plant } from '@/types';

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
 * @fileOverview SIKKA LMC - Enterprise Lorry Receipt (LR) Manifest.
 * Precise A4 restoration matching the requested design registry.
 * Establish triple-copy logic: Consignor, Consignee, and Driver.
 */
export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    const d = parseSafeDate(date);
    return d && isValid(d) ? format(d, pattern) : '--';
  };

  const items = lr.items || [];
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  const totalWeight = Number(lr.assignedTripWeight) || items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  // MISSION CRITICAL: Hardened Value Lookup Node
  // Prioritizes Top-Level LR fields with Trip-Registry fallbacks
  const vehicleNumber = lr.vehicleNumber || lr.trip?.vehicleNumber || '--';
  const driverMobile = lr.driverMobile || lr.trip?.driverMobile || 'N/A';
  const vehicleType = lr.trip?.vehicleType || 'OWN VEHICLE';
  const paymentTerm = lr.paymentTerm || lr.trip?.paymentTerm || 'PAID';
  const dispatchTime = lr.trip?.startDate ? format(parseSafeDate(lr.trip.startDate)!, 'HH:mm') : 'N/A';

  const terms = [
    "Agency is not responsible for rain or any natural calamity.",
    "Any discrepancy regarding material has to be intimated within 24 Hours of the receipt material with remark in POD section.",
    "Owner of the vehicle (truck) is responsible for the goods after lifting the goods.",
    "Agency has the right to hold the material upon shortage of vehicle.",
    "Traders is responsible for contraband goods or goods which are not authorized.",
    "Agency holds no responsibility after goods have been delivered.",
    "All disputes subject to Ghaziabad Jurisdiction."
  ];

  return (
    <div className="A4-page p-[10mm] bg-white text-black font-sans text-[9pt] leading-tight flex flex-col relative select-text box-border h-[297mm]">
      
      {/* 1. TOP CENTER COPY INDICATOR */}
      <div className="text-center mb-4">
        <span className="text-[11pt] font-black uppercase tracking-[0.6em] text-slate-900 border-b-2 border-black pb-1">{copyType}</span>
      </div>

      {/* 2. HEADER NODE: LOGO & COMPANY | CN BOX */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex gap-5 flex-1 pr-10">
          <div className="h-20 w-20 bg-white border-2 border-black rounded-xl flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-sm">
            <img 
                src="https://image2url.com/r2/default/images/1774853131451-83a2a90c-6707-43fc-9b92-c364ad369d96.jpeg" 
                alt="SIL Logo" 
                className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-[18pt] font-black uppercase tracking-tighter leading-none text-slate-900">SIKKA LMC</h1>
            <p className="text-[8pt] font-black text-slate-600 uppercase max-w-[450px] leading-tight">
                20KM. STONE, NEAR TIVOLI GRAND RESORT, KHASRA NO. -3,G.T.KARNAL ROAD, JINDPUR, DELHI - 110036
            </p>
            <div className="text-[8pt] font-black text-slate-500 flex flex-wrap gap-x-6 pt-1">
              <p>PHONE: 9136688004, 9136688006, 9136688009</p>
              <p>GSTIN: <span className="font-mono text-blue-900">09AYQPS6936B1ZV</span></p>
            </div>
          </div>
        </div>

        <div className="min-w-[220px] space-y-2">
            <div className="border-4 border-black p-3 bg-white text-center">
                <p className="text-[13pt] font-black uppercase text-slate-900 flex justify-between items-center gap-4">
                    <span>CN NO |</span> 
                    <span className="font-mono text-blue-900">{lr.lrNumber}</span>
                </p>
            </div>
            <div className="text-[9.5pt] font-black text-slate-900 uppercase space-y-1.5 px-1">
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1">
                    <span>DATE:</span> <span>{formatDate(lr.date)}</span>
                </p>
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1">
                    <span>FROM:</span> <span>{lr.from?.toUpperCase() || '--'}</span>
                </p>
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1">
                    <span>TO:</span> <span>{lr.to?.toUpperCase() || '--'}</span>
                </p>
            </div>
        </div>
      </div>

      {/* 3. ASSET NODE STRIP (5 COLUMNS) */}
      <div className="grid grid-cols-5 border-2 border-black rounded-2xl overflow-hidden mb-8 bg-slate-50 divide-x-2 divide-black">
        {[
            { label: 'VEHICLE NUMBER', value: vehicleNumber, bold: true },
            { label: 'PILOT CONTACT', value: driverMobile },
            { label: 'VEHICLE TYPE', value: vehicleType },
            { label: 'PAYMENT TERM', value: paymentTerm },
            { label: 'DISPATCH', value: dispatchTime }
        ].map((node, i) => (
            <div key={i} className="p-3 text-center flex flex-col justify-center gap-1">
                <span className="text-[7pt] font-black uppercase text-slate-400 block leading-none tracking-widest">{node.label}</span>
                <p className={cn("text-[9.5pt] uppercase leading-none truncate", node.bold ? "font-black text-slate-900" : "font-bold text-slate-700")}>{node.value || '--'}</p>
            </div>
        ))}
      </div>

      {/* 4. ENTITY HANDBOOK BOXES */}
      <div className="grid grid-cols-2 border-2 border-black rounded-[2.5rem] overflow-hidden mb-8 divide-x-2 divide-black min-h-[140px] shadow-sm">
        <div className="p-6 space-y-3">
            <span className="text-[8.5pt] font-black uppercase text-white bg-black px-3 py-1 rounded-full inline-block tracking-widest">CONSIGNOR (SENDER)</span>
            <div className="space-y-1 flex-1">
                <p className="text-[10.5pt] font-black uppercase text-slate-900 leading-tight">{lr.consignorName}</p>
                <p className="text-[9pt] font-bold text-slate-600 leading-snug italic max-w-[350px] uppercase">{lr.consignorAddress || lr.from}</p>
            </div>
            <p className="font-black text-slate-900 text-[9pt] pt-2">GSTIN: <span className="font-mono uppercase">{lr.consignorGtin || '--'}</span></p>
        </div>
        <div className="p-6 space-y-3 bg-slate-50/20">
            <span className="text-[8.5pt] font-black uppercase text-white bg-black px-3 py-1 rounded-full inline-block tracking-widest">CONSIGNEE (RECEIVER)</span>
            <div className="space-y-1 flex-1">
                <p className="text-[10.5pt] font-black uppercase text-slate-900 leading-tight">{lr.buyerName}</p>
                <p className="text-[9pt] font-bold text-slate-600 leading-snug italic max-w-[350px] uppercase">{lr.deliveryAddress || lr.to}</p>
            </div>
            <p className="font-black text-slate-900 text-[9pt] pt-2">GSTIN: <span className="font-mono uppercase">{lr.buyerGtin || '--'}</span></p>
        </div>
      </div>

      {/* 5. MANIFEST AUDIT TABLE */}
      <div className="border-2 border-black rounded-[2.5rem] overflow-hidden mb-10 flex flex-col min-h-0 shadow-lg flex-1">
        <table className="w-full border-collapse">
          <thead className="bg-black text-white text-[8.5pt] font-black uppercase tracking-[0.1em]">
            <tr className="h-12">
              <th className="border-r border-white/20 px-6 text-left w-56">DOCUMENT REF (INVOICE)</th>
              <th className="border-r border-white/20 px-6 text-left">DESCRIPTION OF GOODS</th>
              <th className="border-r border-white/20 px-6 text-center w-36">NO. OF PKGS</th>
              <th className="px-6 text-right w-40">WEIGHT (MT)</th>
            </tr>
          </thead>
          <tbody className="text-[10pt] font-bold text-slate-900 divide-y-2 divide-slate-100">
            {items.map((item, idx) => (
              <tr key={idx} className="h-14 align-middle bg-white">
                <td className="border-r-2 border-black px-6 font-black uppercase">
                    {(item as any).invoiceNumber || (item as any).invoiceNo || (item as any).deliveryNumber || (item as any).deliveryNo || 'NA'}
                </td>
                <td className="border-r-2 border-black px-6 uppercase tracking-tight">{item.itemDescription}</td>
                <td className="border-r-2 border-black px-6 text-center font-black text-blue-900">{item.units}</td>
                <td className="px-6 text-right font-black text-blue-900">{Number(item.weight).toFixed(3)}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-14 border-b border-slate-50 opacity-10">
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td className="border-r-2 border-black"></td>
                <td></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-black h-14 border-t-4 border-black">
            <tr className="align-middle text-[11pt]">
              <td className="px-6 uppercase">TOTAL:</td>
              <td className="border-l-2 border-black"></td>
              <td className="border-l-2 border-black text-center font-black">{totalUnits}</td>
              <td className="border-l-2 border-black text-right px-6 font-black text-blue-900">{totalWeight.toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 6. COMPLIANCE & SIGNATURE NODES */}
      <div className="grid grid-cols-2 gap-20 mb-12 shrink-0">
        <div className="space-y-4">
            <span className="text-[9pt] font-black uppercase text-slate-900 border-b-2 border-black block pb-1 tracking-widest italic">TERMS & CONDITIONS</span>
            <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                <ul className="space-y-1.5">
                    {terms.map((term, i) => (
                        <li key={i} className="text-[7.2pt] font-bold text-slate-600 flex gap-2">
                            <span className="shrink-0">{i + 1}.</span>
                            <span className="leading-tight">{term}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>

        <div className="flex flex-col justify-between pt-2">
            <div className="text-center space-y-4">
                <span className="text-[9pt] font-black uppercase text-slate-900 border-b-2 border-black block pb-1 tracking-widest uppercase">FOR SIKKA LMC</span>
                <div className="h-32 flex flex-col justify-end items-center">
                    <div className="w-full border-t-2 border-black border-dashed mb-3" />
                    <span className="text-[10pt] font-black uppercase tracking-[0.3em] text-slate-900 italic">AUTHORIZED SIGNATORY</span>
                </div>
            </div>
        </div>
      </div>

      {/* 7. REGISTRY FOOTER */}
      <div className="mt-auto pt-6 border-t-2 border-slate-900 flex flex-col items-center gap-2 shrink-0">
        <p className="text-[8pt] font-black uppercase text-blue-600 tracking-[0.3em] italic">
            NOTE: THIS LORRY RECEIPT WAS GENERATED DIGITALLY AND IS TO BE CONSIDERED AS ORIGINAL
        </p>
        <div className="flex items-center gap-4">
            <span className="text-[9pt] font-black uppercase tracking-[0.5em] text-slate-900"> PAGE {pageNumber} OF {totalInSeries} </span>
        </div>
      </div>
    </div>
  );
}
