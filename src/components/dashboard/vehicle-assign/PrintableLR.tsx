
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
 * @fileOverview SIKKA LMC - Enterprise Lorry Receipt (LR) A4 Node.
 * High-fidelity layout optimized for perfect A4 fitting.
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

  const hasEwayBill = items.some(i => i.ewaybillNumber && i.ewaybillNumber.trim() !== '');

  return (
    <div className="A4-page p-[8mm] bg-white text-black font-sans text-[8.5pt] leading-tight border border-slate-100 print:border-none h-[297mm] flex flex-col relative select-text box-border">
      
      {/* 1. TOP HEADER REGISTRY */}
      <div className="text-center mb-2">
        <span className="text-[9pt] font-black uppercase tracking-[0.4em] text-slate-400">{copyType}</span>
      </div>

      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3 flex-1">
          <div className="h-14 w-14 bg-slate-100 rounded-lg flex items-center justify-center border shrink-0">
            {lr.carrier?.logoUrl ? (
                <img src={lr.carrier.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
                <div className="text-[7px] font-black text-slate-300 uppercase text-center leading-none">SIKKA<br/>LOGISTICS</div>
            )}
          </div>
          <div className="space-y-0.5">
            <h1 className="text-[12pt] font-black uppercase tracking-tight leading-none text-slate-900">
              {lr.carrier?.name || 'SIKKA INDUSTRIES & LOGISTICS'}
            </h1>
            <p className="text-[7pt] font-bold text-slate-600 max-w-[320px] leading-tight">
              {lr.carrier?.address || 'C - 17, South Side Of GT Road UPSIDC, Ghaziabad - 201009'}
            </p>
            <div className="text-[7pt] font-medium text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
              <p><span className="font-black text-slate-400">Email:</span> {lr.carrier?.email || 'sil@sikka.com'}</p>
              <p><span className="font-black text-slate-400">Phone:</span> {lr.carrier?.mobile || 'N/A'}</p>
              <p><span className="font-black text-slate-400">GSTIN:</span> <span className="font-mono">{lr.carrier?.gstin || '--'}</span></p>
              <p><span className="font-black text-slate-400">Pan:</span> <span className="font-mono">{lr.carrier?.pan || '--'}</span></p>
            </div>
          </div>
        </div>

        <div className="text-right space-y-2">
            <div className="border-2 border-slate-900 px-3 py-1.5 bg-white min-w-[160px]">
                <p className="text-[10pt] font-black uppercase text-slate-900 flex justify-between gap-3">
                    <span>CN No |</span> <span>{lr.lrNumber}</span>
                </p>
            </div>
            <div className="text-[7.5pt] font-bold text-slate-600 uppercase space-y-0.5">
                <p className="flex justify-between gap-3"><span>DATE:</span> <span className="text-black font-black">{formatDate(lr.date)}</span></p>
                <p className="flex justify-between gap-3"><span>FROM:</span> <span className="text-black font-black">{lr.from || 'N/A'}</span></p>
                <p className="flex justify-between gap-3"><span>TO:</span> <span className="text-black font-black">{lr.to || 'N/A'}</span></p>
            </div>
        </div>
      </div>

      {/* 2. MISSION PARTICULARS BAR */}
      <div className="grid grid-cols-6 border-2 border-slate-900 rounded-lg overflow-hidden mb-4 bg-white divide-x-2 divide-slate-900">
        {[
            { label: 'Vehicle Number', value: lr.vehicleNumber },
            { label: 'Driver Number', value: lr.driverMobile || lr.trip?.driverMobile || 'N/A' },
            { label: 'Vehicle Type', value: lr.trip?.vehicleType || 'Truck' },
            { label: 'Transport Mode', value: lr.transportMode || 'ROAD' },
            { label: 'Payment Term', value: lr.paymentTerm || 'Paid' },
            { label: 'Dispatch', value: formatDate(lr.trip?.startDate, 'dd/MM/yy HH:mm') }
        ].map((node, i) => (
            <div key={i} className="p-1.5 text-center flex flex-col justify-center">
                <span className="text-[6pt] font-black uppercase text-slate-400 block mb-0.5 leading-none">{node.label}</span>
                <p className="text-[7.5pt] font-black uppercase truncate leading-none">{node.value}</p>
            </div>
        ))}
      </div>

      {/* 3. PARTY REGISTRY GRID */}
      <div className="grid grid-cols-3 border-2 border-slate-900 rounded-lg overflow-hidden mb-4 divide-x-2 divide-slate-900">
        <div className="p-3 space-y-2">
            <span className="text-[7.5pt] font-black uppercase text-slate-900 border-b border-slate-900 pb-0.5 block">CONSIGNOR</span>
            <div className="text-[7.5pt] space-y-0.5">
                <p className="font-black uppercase truncate">{lr.consignorName}</p>
                <p className="text-slate-600 font-bold leading-tight line-clamp-2 min-h-[2em]">{lr.consignorAddress || lr.from}</p>
                <p><span className="text-slate-400 font-black">Phone:</span> {lr.consignorMobile || 'N/A'}</p>
                <p><span className="text-slate-400 font-black">GSTIN:</span> <span className="font-mono">{lr.consignorGtin || '--'}</span></p>
            </div>
        </div>
        <div className="p-3 space-y-2">
            <span className="text-[7.5pt] font-black uppercase text-slate-900 border-b border-slate-900 pb-0.5 block">BILL TO PARTY</span>
            <div className="text-[7.5pt] space-y-0.5">
                <p className="font-black uppercase truncate">{lr.buyerName}</p>
                <p className="text-slate-600 font-bold leading-tight line-clamp-2 min-h-[2em]">{lr.buyerName}</p>
                <p><span className="text-slate-400 font-black">Phone:</span> {lr.buyerMobile || 'N/A'}</p>
                <p><span className="text-slate-400 font-black">GSTIN:</span> <span className="font-mono">{lr.buyerGtin || '--'}</span></p>
            </div>
        </div>
        <div className="p-3 space-y-2">
            <span className="text-[7.5pt] font-black uppercase text-slate-900 border-b border-slate-900 pb-0.5 block">SHIP TO PARTY</span>
            <div className="text-[7.5pt] space-y-0.5">
                <p className="font-black uppercase truncate">{lr.shipToParty}</p>
                <p className="text-slate-600 font-bold leading-tight line-clamp-2 min-h-[2em]">{lr.deliveryAddress}</p>
                <p><span className="text-slate-400 font-black">Phone:</span> {lr.shipToMobile || 'N/A'}</p>
                <p><span className="text-slate-400 font-black">GSTIN:</span> <span className="font-mono">{lr.shipToGtin || '--'}</span></p>
            </div>
        </div>
      </div>

      {/* 4. ITEM MANIFEST TABLE */}
      <div className="border-2 border-slate-900 rounded-lg overflow-hidden mb-4 flex-1 flex flex-col">
        <table className="w-full border-collapse table-auto">
          <thead>
            <tr className="bg-slate-50 text-slate-900 h-8 text-[6.5pt] font-black uppercase border-b border-slate-900">
              <th className="border-r border-slate-900 px-2 text-left whitespace-nowrap">Invoice</th>
              <th className="border-r border-slate-900 px-2 text-left whitespace-nowrap">Date</th>
              <th className="border-r border-slate-900 px-2 text-left w-full">Description</th>
              <th className="border-r border-slate-900 px-2 text-center whitespace-nowrap">Units</th>
              <th className="border-r border-slate-900 px-2 text-right whitespace-nowrap">Weight</th>
              {hasEwayBill && (
                <>
                    <th className="border-r border-slate-900 px-2 text-left whitespace-nowrap">E-WayBill</th>
                    <th className="px-2 text-left whitespace-nowrap">E-W Date</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="text-[7.5pt]">
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200 h-8 align-middle">
                <td className="border-r border-slate-900 px-2 font-black uppercase whitespace-nowrap">{item.invoiceNumber}</td>
                <td className="border-r border-slate-900 px-2 whitespace-nowrap">{formatDate(lr.date, 'dd MMM')}</td>
                <td className="border-r border-slate-900 px-2 font-bold uppercase truncate max-w-[200px]">{item.itemDescription}</td>
                <td className="border-r border-slate-900 px-2 text-center font-black whitespace-nowrap">{item.units}</td>
                <td className="border-r border-slate-900 px-2 text-right font-black whitespace-nowrap">{Number(item.weight).toFixed(3)}</td>
                {hasEwayBill && (
                    <>
                        <td className="border-r border-slate-900 px-2 font-mono text-[6pt] whitespace-nowrap">{item.ewaybillNumber || '--'}</td>
                        <td className="px-2 whitespace-nowrap">{item.ewaybillNumber ? formatDate(lr.date, 'dd MMM') : '--'}</td>
                    </>
                )}
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-8 border-b border-slate-50 opacity-10">
                <td className="border-r border-slate-900"></td>
                <td className="border-r border-slate-900"></td>
                <td className="border-r border-slate-900"></td>
                <td className="border-r border-slate-900"></td>
                <td className="border-r border-slate-900"></td>
                {hasEwayBill && (
                    <>
                        <td className="border-r border-slate-900"></td>
                        <td></td>
                    </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-900 bg-slate-50 font-black h-10">
            <tr className="align-middle">
              <td colSpan={3} className="px-3 text-[7.5pt] uppercase">Manifest Total:</td>
              <td className="border-l border-slate-900 px-2 text-center text-[8.5pt] whitespace-nowrap">{totalUnits}</td>
              <td className="border-l border-slate-900 px-2 text-right text-[8.5pt] text-blue-900 whitespace-nowrap">{totalWeight.toFixed(3)} MT</td>
              {hasEwayBill && <td colSpan={2} className="border-l border-slate-900"></td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 5. TERMS & SIGNATURE SECTION */}
      <div className="mb-4 mt-2">
        <div className="flex justify-between items-start gap-10">
            <div className="flex-1 space-y-2">
                <span className="text-[7.5pt] font-black uppercase tracking-widest text-slate-900 border-b border-slate-200 block pb-0.5">TERMS & CONDITIONS:</span>
                <div className="text-[6.5pt] font-medium text-slate-600 leading-tight space-y-1">
                    {lr.carrier?.terms && lr.carrier.terms.length > 0 ? (
                        lr.carrier.terms.map((term, i) => <p key={i} className="flex gap-1.5"><span>•</span> <span>{term}</span></p>)
                    ) : (
                        <>
                            <p className="flex gap-1.5"><span>•</span> <span>Subject to Ghaziabad Jurisdiction</span></p>
                            <p className="flex gap-1.5"><span>•</span> <span>Goods carried at owner's risk</span></p>
                            <p className="flex gap-1.5"><span>•</span> <span>Not responsible for leakage/damage</span></p>
                        </>
                    )}
                </div>
            </div>

            <div className="w-[280px] pt-2 space-y-12">
                <div className="text-center">
                    <p className="text-[8pt] font-black uppercase tracking-tight leading-none">FOR {lr.carrier?.name || 'SIKKA INDUSTRIES & LOGISTICS'}</p>
                </div>
                
                <div className="text-center space-y-1.5">
                    <div className="border-t-2 border-slate-900 border-dashed pt-1 w-full mx-auto" />
                    <p className="text-[8pt] font-black uppercase tracking-widest text-slate-900">AUTHORIZED SIGNATORY</p>
                </div>
            </div>
        </div>
      </div>

      {/* 6. FOOTER REGISTRY */}
      <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col items-center gap-2 shrink-0">
        <div className="text-center space-y-0.5">
            <p className="text-[7pt] font-bold text-slate-400 italic">
                Note: This document is generated digitally from the Sikka LMC Registry
            </p>
            <p className="text-[6.5pt] font-black uppercase text-slate-300 tracking-[0.2em]">
                Page {pageNumber} of {totalInSeries}
            </p>
        </div>
        
        <div className="opacity-20 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-900" />
            <span className="text-[5.5pt] font-black uppercase tracking-[0.5em]">Verified SIKKA LMC Registry Node</span>
        </div>
      </div>
    </div>
  );
}
