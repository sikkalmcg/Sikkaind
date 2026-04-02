
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
 * @fileOverview SIKKA LMC - Enterprise Lorry Receipt (LR) Node.
 * Optimized for A4 printing with Dynamic Carrier Header & Full Entity Addresses.
 * Registry Rule: Consignor/Consignee display full address; FROM/TO show City.
 */
export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    if (!date) return 'N/A';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return isValid(d) ? format(d, pattern) : 'N/A';
  };

  /**
   * Registry Logic: Extract Primary City Node
   * Skips plot/block numbers (e.g., C-17) to find the actual city segment.
   */
  const getCityNode = (val: string) => {
    if (!val || val === 'N/A' || val === '--') return '--';
    const parts = val.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 1 && (/\d/.test(parts[0]) || parts[0].length < 5)) {
        return parts[1].toUpperCase();
    }
    return parts[0].toUpperCase(); 
  };

  const items = lr.items || [];
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  
  const totalWeight = lr.weightSelection === 'Actual Weight' 
    ? items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)
    : (Number(lr.assignedTripWeight) || items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0));

  // Registry Scrub Node: Remove "NODE XXXX" from address strings for clean header
  const cleanRegistryAddress = (addr: string) => {
    if (!addr) return '';
    return addr.replace(/NODE\s+\d+/gi, '').replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').trim();
  };

  // MISSION IDENTITY NODE: Prioritize assigned carrier manifest
  const carrierName = lr.carrier?.name || lr.trip?.carrier || 'SIKKA INDUSTRIES & LOGISTICS';
  const carrierAddress = cleanRegistryAddress(lr.carrier?.address || lr.plant?.address || 'GHAZIABAD, UTTAR PRADESH');
  const carrierMobile = lr.carrier?.mobile || '9136688004, 9136688006';
  const carrierGstin = lr.carrier?.gstin || '--';
  const carrierTerms = lr.carrier?.terms || [];

  return (
    <div className="A4-page p-[8mm] bg-white text-black font-sans text-[9pt] leading-tight border border-slate-100 print:border-none h-[297mm] flex flex-col relative select-text box-border">
      
      {/* 1. TOP HEADER REGISTRY - CARRIER FOCUSED */}
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
              {carrierName}
            </h1>
            <p className="text-[9pt] font-bold text-slate-600 uppercase max-w-[400px]">
              {carrierAddress}
            </p>
            <div className="text-[8pt] font-black text-slate-600 flex flex-wrap gap-x-4 pt-1">
              <p>PHONE: {carrierMobile}</p>
              <p>GSTIN: <span className="font-mono">{carrierGstin}</span></p>
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
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>FROM:</span> <span>{getCityNode(lr.from)}</span></p>
                <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>TO:</span> <span>{getCityNode(lr.to)}</span></p>
            </div>
        </div>
      </div>

      {/* 2. MISSION PARTICULARS */}
      <div className="grid grid-cols-5 border-2 border-black rounded-lg overflow-hidden mb-6 bg-white divide-x-2 divide-black">
        {[
            { label: 'Vehicle Number', value: lr.vehicleNumber || lr.trip?.vehicleNumber || '--' },
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

      {/* 3. ENTITY REGISTRY - FULL ADDRESS VISIBILITY */}
      <div className="grid grid-cols-2 border-2 border-black rounded-xl overflow-hidden mb-6 divide-x-2 divide-black min-h-[120px]">
        <div className="p-4 space-y-2 flex flex-col">
            <span className="text-[8pt] font-black uppercase text-white bg-black px-2 py-0.5 inline-block rounded mb-1 w-fit">CONSIGNOR (SENDER)</span>
            <div className="text-[8.5pt] space-y-1 flex-1">
                <p className="font-black uppercase">{lr.consignorName}</p>
                <p className="text-slate-700 font-bold leading-tight italic">{lr.consignorAddress}</p>
            </div>
            <p className="font-black text-slate-900 text-[8pt]">GSTIN: <span className="font-mono">{lr.consignorGtin || '--'}</span></p>
        </div>
        <div className="p-4 space-y-2 bg-slate-50/30 flex flex-col">
            <span className="text-[8pt] font-black uppercase text-white bg-black px-2 py-0.5 inline-block rounded mb-1 w-fit">CONSIGNEE (RECEIVER)</span>
            <div className="text-[8.5pt] space-y-1 flex-1">
                <p className="font-black uppercase">{lr.buyerName}</p>
                <p className="text-slate-700 font-bold leading-tight italic">{lr.deliveryAddress}</p>
            </div>
            <p className="font-black text-slate-900 text-[8pt]">GSTIN: <span className="font-mono">{lr.buyerGtin || '--'}</span></p>
        </div>
      </div>

      {/* 4. MANIFEST TABLE */}
      <div className="border-2 border-black rounded-xl overflow-hidden mb-6 flex flex-col min-h-0">
        <table className="w-full border-collapse">
          <thead className="bg-black text-white text-[7.5pt] font-black uppercase tracking-wider">
            <tr className="h-10">
              <th className="border-r border-white/20 px-4 text-left w-48">DOCUMENT REF (INVOICE)</th>
              <th className="border-r border-white/20 px-4 text-left">DESCRIPTION OF GOODS</th>
              <th className="border-r border-white/20 px-4 text-center w-32">NO. OF PKGS</th>
              <th className="px-4 text-right w-40">WEIGHT (MT)</th>
            </tr>
          </thead>
          <tbody className="text-[9pt] font-bold text-slate-900 divide-y">
            {items.map((item, idx) => (
              <tr key={idx} className="h-10 align-middle hover:bg-slate-50 transition-colors">
                <td className="border-r border-slate-200 px-4 font-black uppercase">{item.invoiceNumber}</td>
                <td className="border-r border-slate-200 px-4 uppercase">{item.itemDescription}</td>
                <td className="border-r border-slate-200 px-4 text-center font-black">{item.units}</td>
                <td className="px-4 text-right font-black text-blue-900">{Number(item.weight).toFixed(3)}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-10 border-b border-slate-50 opacity-10">
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                <td></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-black h-12 border-t-2 border-black">
            <tr className="align-middle">
              <td className="px-4 text-[10pt] font-black uppercase">TOTAL:</td>
              <td className="border-l-2 border-black px-4"></td>
              <td className="border-l-2 border-black px-4 text-center text-[10pt] font-black">{totalUnits}</td>
              <td className="border-l-2 border-black px-4 text-right text-[10pt] font-black text-blue-900">{totalWeight.toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

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
                <span className="text-[8pt] font-black uppercase text-slate-900 border-b border-slate-200 block pb-1">FOR {carrierName}</span>
                <div className="h-24 flex flex-col justify-end items-center">
                    <div className="w-full border-t-2 border-black border-dashed mb-2" />
                    <span className="text-[8pt] font-black uppercase tracking-widest">AUTHORIZED SIGNATORY</span>
                </div>
            </div>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-200 flex flex-col items-center gap-1.5 shrink-0">
        <p className="text-[7.5pt] font-black uppercase text-blue-400/80 tracking-widest">
            Note: This Lorry Receipt was generated digitally and is to be considered as original
        </p>
        <div className="flex items-center gap-2">
            <span className="text-[7.5pt] font-black uppercase tracking-[0.5em] text-slate-500"> PAGE {pageNumber} OF {totalInSeries}</span>
        </div>
      </div>
    </div>
  );
}
