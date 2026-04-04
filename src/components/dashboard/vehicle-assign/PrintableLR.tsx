'use client';

import React from 'react';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate } from '@/lib/utils';
import type { LR, Trip, Shipment, Carrier, Plant } from '@/types';
import { Timestamp } from 'firebase/firestore';

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
 * Precise A4 Boxed Restoration matching high-fidelity rounded table design.
 * Hardened for 100% data accuracy across Vehicle, Pilot, and Carrier nodes.
 */
export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    const d = parseSafeDate(date);
    return d && isValid(d) ? format(d, pattern) : '--';
  };

  const items = lr.items || [];
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  const totalWeight = Number(lr.assignedTripWeight) || items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  // REGISTRY HANDSHAKE: Resilient property mapping from Trip or LR document
  const vehicleNumber = lr.vehicleNumber || lr.trip?.vehicleNumber || (lr.trip as any)?.vehicleNo || '--';
  const driverName = lr.driverName || lr.trip?.driverName || (lr.trip as any)?.pilotName || 'N/A';
  const driverMobile = lr.driverMobile || lr.trip?.driverMobile || (lr.trip as any)?.pilotMobile || '--';
  const vehicleType = lr.trip?.vehicleType || (lr.trip as any)?.fleetType || 'OWN VEHICLE';
  const paymentTerm = lr.paymentTerm || lr.trip?.paymentTerm || (lr.trip as any)?.term || 'PAID';
  const dispatchDateRaw = lr.trip?.startDate || (lr.trip as any)?.assignedDateTime || (lr.trip as any)?.creationDate;
  const dispatchTime = dispatchDateRaw ? format(parseSafeDate(dispatchDateRaw)!, 'HH:mm') : 'N/A';

  const terms = [
    "1. Agency is not responsible for rain or any natural calamity.",
    "2. Any discrepancy regarding material has to be intimated within 24 Hours of the receipt material with remark in POD section.",
    "3. Owner of the vehicle (truck) is responsible for the goods after lifting the goods.",
    "4. Agency has the right to hold the material upon shortage of vehicle.",
    "5. Traders is responsible for contraband goods or goods which are not authorized.",
    "6. Agency holds no responsibility after goods have been delivered.",
    "7. All disputes subject to Ghaziabad Jurisdiction."
  ];

  /**
   * MISSION LOGIC: Chunk invoice numbers into pairs of two.
   * Stacks them vertically to prevent horizontal overflow in the boxed layout.
   */
  const renderInvoices = (val: string) => {
    if (!val || val === 'NA' || val === '--') return '--';
    const parts = val.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 2) return val;

    const pairs = [];
    for (let i = 0; i < parts.length; i += 2) {
        pairs.push(parts.slice(i, i + 2).join(', '));
    }
    
    return (
        <div className="flex flex-col gap-0.5 py-1.5">
            {pairs.map((pair, idx) => (
                <div key={idx} className="whitespace-nowrap">{pair}</div>
            ))}
        </div>
    );
  };

  return (
    <div className="A4-page p-[8mm] bg-white text-black font-sans text-[9pt] leading-tight flex flex-col relative select-text box-border h-[297mm] overflow-hidden border-[1px] border-slate-200">
      
      {/* 1. TOP COPY INDICATOR */}
      <div className="text-center mb-2 border-b-2 border-black pb-1">
        <span className="text-[10pt] font-black uppercase tracking-[0.6em] text-slate-900">{copyType}</span>
      </div>

      {/* 2. HEADER NODE: COMPANY | CN BOX */}
      <div className="flex justify-between items-start mb-6 pt-2">
        <div className="flex gap-4 flex-1 pr-6">
          <div className="h-16 w-16 bg-white border-2 border-black rounded-lg flex items-center justify-center p-1 shrink-0 overflow-hidden">
            <img 
                src="https://image2url.com/r2/default/images/1774853131451-83a2a90c-6707-43fc-9b92-c364ad369d96.jpeg" 
                alt="SIL Logo" 
                className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-[16pt] font-black uppercase tracking-tighter leading-none">SIKKA LMC</h1>
            <p className="text-[7.5pt] font-black text-slate-600 uppercase max-w-[400px] leading-tight">
                20KM. STONE, NEAR TIVOLI GRAND RESORT, KHASRA NO. -3, G.T. KARNAL ROAD, JINDPUR, DELHI - 110036
            </p>
            <div className="text-[7.5pt] font-black text-slate-500 flex flex-wrap gap-x-4 pt-0.5">
              <p>PHONE: 9136688004, 9136688006, 9136688009</p>
              <p>GSTIN: <span className="font-mono text-slate-900">09AYQPS6936B1ZV</span></p>
            </div>
          </div>
        </div>

        <div className="min-w-[200px] space-y-2">
            <div className="border-4 border-black p-2 bg-white text-center">
                <p className="text-[12pt] font-black uppercase flex justify-between items-center gap-4">
                    <span>CN NO |</span> 
                    <span className="font-mono text-blue-900">{lr.lrNumber}</span>
                </p>
            </div>
            <div className="text-[9pt] font-black uppercase space-y-1 px-1">
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-0.5">
                    <span>DATE:</span> <span>{formatDate(lr.date)}</span>
                </p>
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-0.5">
                    <span>FROM:</span> <span className="truncate max-w-[120px]">{lr.from?.toUpperCase() || '--'}</span>
                </p>
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-0.5">
                    <span>TO:</span> <span className="truncate max-w-[120px]">{lr.to?.toUpperCase() || '--'}</span>
                </p>
            </div>
        </div>
      </div>

      {/* 3. ASSET OPERATIONAL STRIP */}
      <div className="grid grid-cols-5 border-2 border-black rounded-xl overflow-hidden mb-6 bg-slate-50 divide-x-2 divide-black">
        {[
            { label: 'VEHICLE NUMBER', value: vehicleNumber, bold: true },
            { label: 'PILOT CONTACT', value: driverMobile, mono: true },
            { label: 'VEHICLE TYPE', value: vehicleType },
            { label: 'PAYMENT TERM', value: paymentTerm },
            { label: 'DISPATCH', value: dispatchTime, mono: true }
        ].map((node, i) => (
            <div key={i} className="p-2 text-center flex flex-col justify-center gap-0.5">
                <span className="text-[6.5pt] font-black uppercase text-slate-400 block leading-none tracking-widest">{node.label}</span>
                <p className={cn("text-[9pt] uppercase leading-none truncate", node.bold ? "font-black text-slate-900" : "font-bold text-slate-700", node.mono && "font-mono tracking-tighter")}>{node.value || 'N/A'}</p>
            </div>
        ))}
      </div>

      {/* 4. ENTITY HANDBOOK */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border-2 border-black rounded-[1.5rem] p-5 relative min-h-[120px]">
            <div className="absolute -top-3 left-6 bg-black text-white px-4 py-1 rounded-full text-[7.5pt] font-black uppercase tracking-widest shadow-lg">CONSIGNOR (SENDER)</div>
            <div className="mt-2 space-y-1">
                <p className="text-[10pt] font-black uppercase text-slate-900 leading-tight">{lr.consignorName}</p>
                <p className="text-[8.5pt] font-bold text-slate-600 leading-snug italic uppercase">{lr.consignorAddress || lr.from}</p>
                <p className="font-black text-slate-900 text-[8.5pt] pt-1">GSTIN: <span className="font-mono uppercase">{lr.consignorGtin || '--'}</span></p>
            </div>
        </div>
        <div className="border-2 border-black rounded-[1.5rem] p-5 relative min-h-[120px]">
            <div className="absolute -top-3 left-6 bg-black text-white px-4 py-1 rounded-full text-[7.5pt] font-black uppercase tracking-widest shadow-lg">CONSIGNEE (RECEIVER)</div>
            <div className="mt-2 space-y-1">
                <p className="text-[10pt] font-black uppercase text-slate-900 leading-tight">{lr.buyerName}</p>
                <p className="text-[8.5pt] font-bold text-slate-600 leading-snug italic uppercase">{lr.deliveryAddress || lr.to}</p>
                <p className="font-black text-slate-900 text-[8.5pt] pt-1">GSTIN: <span className="font-mono uppercase">{lr.buyerGtin || '--'}</span></p>
            </div>
        </div>
      </div>

      {/* 5. AUDIT MANIFEST TABLE */}
      <div className="border-2 border-black rounded-[1.5rem] overflow-hidden mb-8 flex flex-col shadow-sm shrink-0">
        <table className="w-full border-collapse">
          <thead className="bg-black text-white text-[8pt] font-black uppercase tracking-widest">
            <tr className="h-10">
              <th className="border-r-2 border-black px-4 text-left w-52">DOCUMENT REF (INVOICE)</th>
              <th className="border-r-2 border-black px-4 text-left">DESCRIPTION OF GOODS</th>
              <th className="border-r-2 border-black px-4 text-center w-32">NO. OF PKGS</th>
              <th className="px-4 text-right w-36">WEIGHT (MT)</th>
            </tr>
          </thead>
          <tbody className="text-[9pt] font-black text-slate-900">
            {items.map((item, idx) => (
              <tr key={idx} className="align-middle border-b border-slate-200 last:border-b-0">
                <td className="border-r-2 border-black px-4 font-black uppercase">
                    {renderInvoices((item as any).invoiceNumber || (item as any).invoiceNo || (item as any).deliveryNo || 'NA')}
                </td>
                <td className="border-r-2 border-black px-4 uppercase truncate">{item.itemDescription}</td>
                <td className="border-r-2 border-black px-4 text-center">{item.units}</td>
                <td className="px-4 text-right">{Number(item.weight).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-black h-12 border-t-2 border-black text-[10pt] text-black">
            <tr>
              <td className="px-4 uppercase border-r-2 border-black">TOTAL:</td>
              <td className="border-r-2 border-black"></td>
              <td className="border-r-2 border-black text-center">{totalUnits}</td>
              <td className="text-right px-4">{totalWeight.toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 6. T&C and SIGNATORY */}
      <div className="grid grid-cols-2 gap-12 mb-8 mt-auto shrink-0">
        <div className="space-y-3">
            <span className="text-[8.5pt] font-black uppercase text-slate-900 border-b border-black inline-block pb-0.5 tracking-widest">TERMS & CONDITIONS</span>
            <div className="space-y-1 pt-1">
                {terms.map((term, i) => (
                    <p key={i} className="text-[6.8pt] font-bold text-slate-500 leading-tight">{term}</p>
                ))}
            </div>
        </div>

        <div className="flex flex-col justify-between text-center pt-2">
            <div className="h-24 flex flex-col justify-end items-center">
                <div className="w-full border-t-2 border-black border-dashed mb-2" />
                <span className="text-[9pt] font-black uppercase tracking-[0.3em] text-slate-900 italic">AUTHORIZED SIGNATORY</span>
            </div>
        </div>
      </div>

      {/* 7. FOOTER REGISTRY */}
      <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col items-center gap-1.5 shrink-0">
        <p className="text-[7.5pt] font-black uppercase text-slate-400 tracking-[0.3em] text-center">
            NOTE: THIS LORRY RECEIPT WAS GENERATED DIGITALLY AND IS TO BE CONSIDERED AS ORIGINAL
        </p>
        <div className="flex items-center gap-4">
            <span className="text-[8.5pt] font-black uppercase tracking-[0.5em] text-slate-900"> PAGE {pageNumber} OF {totalInSeries} </span>
        </div>
      </div>
    </div>
  );
}
