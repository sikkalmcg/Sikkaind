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
 * @fileOverview SIKKA LMC - Professional Lorry Receipt (LR) A4 Layout.
 * Designed for dot-matrix and laser printing standards in the Indian logistics sector.
 */
export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any) => {
    if (!date) return '--';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return isValid(d) ? format(d, 'dd-MMM-yyyy') : '--';
  };

  const totalUnits = lr.items?.reduce((sum, item) => sum + (Number(item.units) || 0), 0) || 0;
  const totalWeight = lr.weightSelection === 'Assigned Weight' 
    ? lr.assignedTripWeight 
    : (lr.items?.reduce((sum, item) => sum + (Number(item.weight) || 0), 0) || 0);

  return (
    <div className="A4-page p-[15mm] bg-white text-black font-sans text-[10pt] leading-tight border border-slate-100 print:border-none">
      {/* Header Section */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div className="space-y-1 max-w-[60%]">
          <h1 className="text-[18pt] font-black uppercase tracking-tight leading-none text-slate-900">
            {lr.carrier?.name || 'SIKKA INDUSTRIES & LOGISTICS'}
          </h1>
          <p className="text-[8pt] font-bold text-slate-600 italic">
            {lr.carrier?.address || 'Corporate Hub, Uttar Pradesh'}
          </p>
          <div className="flex gap-4 text-[8pt] font-black pt-1">
            <p>GSTIN: <span className="font-mono">{lr.carrier?.gstin || '09AABCU9567L1Z5'}</span></p>
            <p>PAN: <span className="font-mono">{lr.carrier?.pan || 'AABCU9567L'}</span></p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <div className="inline-flex items-center rounded-full border px-4 py-1 text-[8pt] font-black uppercase border-black">
            {copyType}
          </div>
          <div className="text-[9pt] font-bold text-slate-500 uppercase">
            <p>LR No: <span className="font-black text-slate-900 text-lg">#{lr.lrNumber}</span></p>
            <p>Date: <span className="font-black text-slate-900">{formatDate(lr.date)}</span></p>
          </div>
        </div>
      </div>

      {/* Origin/Destination Grid */}
      <div className="grid grid-cols-2 border-2 border-black mb-6 divide-x-2 divide-black">
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <span className="text-[7pt] font-black uppercase text-slate-400 block tracking-widest">Consignor Node</span>
            <p className="font-black uppercase text-sm">{lr.consignorName}</p>
            <p className="text-[8pt] font-bold text-slate-600 leading-snug">{lr.from}</p>
            <p className="text-[8pt] font-black">GSTIN: <span className="font-mono">{lr.consignorGtin || '--'}</span></p>
          </div>
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <span className="text-[7pt] font-black uppercase text-slate-400 block tracking-widest">Lifting Node (Origin)</span>
            <p className="text-[9pt] font-bold uppercase">{lr.plant?.name || lr.originPlantId}</p>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <span className="text-[7pt] font-black uppercase text-slate-400 block tracking-widest">Consignee Node</span>
            <p className="font-black uppercase text-sm">{lr.buyerName}</p>
            <p className="text-[8pt] font-bold text-slate-600 leading-snug">{lr.shipToParty}</p>
            <p className="text-[8pt] font-black">GSTIN: <span className="font-mono">{lr.buyerGtin || '--'}</span></p>
          </div>
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <span className="text-[7pt] font-black uppercase text-slate-400 block tracking-widest">Delivery Node (Destination)</span>
            <p className="text-[9pt] font-bold uppercase">{lr.to}</p>
          </div>
        </div>
      </div>

      {/* Vehicle/Transport Info */}
      <div className="grid grid-cols-4 border-2 border-black mb-6 divide-x-2 divide-black bg-slate-50/50">
        <div className="p-2">
          <span className="text-[7pt] font-black uppercase text-slate-400 block">Vehicle No</span>
          <p className="font-black uppercase text-sm">{lr.vehicleNumber}</p>
        </div>
        <div className="p-2">
          <span className="text-[7pt] font-black uppercase text-slate-400 block">Trip ID</span>
          <p className="font-mono font-bold text-sm uppercase">{lr.tripId}</p>
        </div>
        <div className="p-2">
          <span className="text-[7pt] font-black uppercase text-slate-400 block">Carrier Agent</span>
          <p className="font-bold text-[9pt] uppercase">{lr.carrier?.name || '--'}</p>
        </div>
        <div className="p-2">
          <span className="text-[7pt] font-black uppercase text-slate-400 block">Payment Term</span>
          <p className="font-black text-blue-900 uppercase text-sm">{lr.paymentTerm}</p>
        </div>
      </div>

      {/* Item Table */}
      <div className="border-2 border-black mb-6 overflow-hidden flex-1 min-h-[300px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white h-10 text-[8pt] font-black uppercase tracking-widest">
              <th className="border-r border-white/10 px-4 text-left">Doc / Invoice No.</th>
              <th className="border-r border-white/10 px-4 text-left">Item Description</th>
              <th className="border-r border-white/10 px-4 text-center w-24">Pkg</th>
              <th className="px-4 text-right w-32">Weight (MT)</th>
            </tr>
          </thead>
          <tbody className="text-[9pt]">
            {lr.items?.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200 h-10">
                <td className="border-r border-black px-4 font-bold uppercase">{item.invoiceNumber}</td>
                <td className="border-r border-black px-4 font-medium uppercase">{item.itemDescription}</td>
                <td className="border-r border-black px-4 text-center font-black">{item.units}</td>
                <td className="px-4 text-right font-black text-blue-900">{Number(item.weight).toFixed(3)}</td>
              </tr>
            ))}
            {/* Fill empty rows to maintain height */}
            {Array.from({ length: Math.max(0, 8 - (lr.items?.length || 0)) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-10 border-b border-slate-100 last:border-0 opacity-20">
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-black bg-slate-50 font-black">
            <tr className="h-12">
              <td colSpan={2} className="px-4 text-right uppercase text-[8pt]">Aggregate Manifest Totals:</td>
              <td className="border-l border-black px-4 text-center text-lg">{totalUnits}</td>
              <td className="border-l border-black px-4 text-right text-lg text-blue-900">{totalWeight.toFixed(3)} MT</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer / Signatures */}
      <div className="grid grid-cols-3 gap-10 pt-12">
        <div className="text-center space-y-16">
          <div className="border-t border-black pt-2">
            <p className="font-black uppercase text-[8pt]">Consignor Signature</p>
          </div>
        </div>
        <div className="text-center space-y-16">
          <div className="border-t border-black pt-2">
            <p className="font-black uppercase text-[8pt]">Driver / Pilot Signature</p>
          </div>
        </div>
        <div className="text-center space-y-16">
          <div className="border-t-2 border-black pt-2 bg-slate-50">
            <p className="font-black uppercase text-[9pt] text-slate-900">For {lr.carrier?.name || 'Sikka Logistics'}</p>
            <p className="text-[7pt] font-bold uppercase text-slate-400 mt-1">Authorized Node</p>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center opacity-30 flex flex-col items-center gap-2">
        <ShieldCheck className="h-8 w-8 text-slate-900" />
        <p className="text-[7pt] font-black uppercase tracking-[0.5em]">Verified Registry Node Handshake - Page {pageNumber}/{totalInSeries}</p>
      </div>
    </div>
  );
}