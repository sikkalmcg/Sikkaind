'use client';

import React from 'react';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import type { LR, Trip, Shipment, Carrier, Plant } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { ShieldCheck } from 'lucide-react';
import Image from 'next/image';

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
 * High-fidelity layout synchronized with the mission registry template.
 * Logic: Signature nodes removed as per user requirement.
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
  const totalValue = items.reduce((sum, item) => sum + (Number((item as any).goodsValue) || 0), 0);

  return (
    <div className="A4-page p-[10mm] bg-white text-black font-sans text-[9pt] leading-tight border border-slate-100 print:border-none min-h-[297mm] flex flex-col relative select-text">
      
      {/* 1. TOP HEADER REGISTRY */}
      <div className="text-center mb-4">
        <span className="text-[10pt] font-black uppercase tracking-[0.4em] text-slate-400">{copyType}</span>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4 flex-1">
          <div className="h-16 w-16 bg-slate-100 rounded-xl flex items-center justify-center border shrink-0">
            {lr.carrier?.logoUrl ? (
                <img src={lr.carrier.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
                <div className="text-[8px] font-black text-slate-300 uppercase text-center">SIKKA<br/>LOGISTICS</div>
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-[13pt] font-black uppercase tracking-tight leading-none text-slate-900">
              {lr.carrier?.name || 'SIKKA INDUSTRIES & LOGISTICS'}
            </h1>
            <p className="text-[7.5pt] font-bold text-slate-600 max-w-[350px] leading-snug">
              {lr.carrier?.address || 'C - 17, South Side Of GT Road UPSIDC, Ghaziabad - 201009'}
            </p>
            <div className="text-[7.5pt] font-medium text-slate-500 pt-1">
              <p><span className="font-black text-slate-400">Email ID:</span> {lr.carrier?.email || 'sil@sikkaenterprises.com'}</p>
              <p><span className="font-black text-slate-400">Phone:</span> {lr.carrier?.mobile || '+91 8860091900'}</p>
              <p><span className="font-black text-slate-400">GSTIN:</span> <span className="font-mono">{lr.carrier?.gstin || '09AYQPS6936B1ZV'}</span></p>
              <p><span className="font-black text-slate-400">Pan No.:</span> <span className="font-mono">{lr.carrier?.pan || 'AYQPS6936B'}</span></p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-6">
            <div className="h-20 w-20 border-2 border-slate-900 p-1 bg-white">
                {/* Registry QR Node Placeholder */}
                <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                    <div className="w-14 h-14 border border-slate-300 relative">
                        <div className="absolute top-0 left-0 w-4 h-4 bg-slate-900" />
                        <div className="absolute top-0 right-0 w-4 h-4 bg-slate-900" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 bg-slate-900" />
                    </div>
                </div>
            </div>
            <div className="text-right space-y-3">
                <div className="border-2 border-slate-900 px-4 py-2 bg-white min-w-[180px]">
                    <p className="text-[11pt] font-black uppercase text-slate-900 flex justify-between gap-4">
                        <span>CN No |</span> <span>{lr.lrNumber}</span>
                    </p>
                </div>
                <div className="text-[8pt] font-bold text-slate-600 uppercase space-y-0.5">
                    <p className="flex justify-between gap-4"><span>Date:</span> <span className="text-black font-black">{formatDate(lr.date)}</span></p>
                    <p className="flex justify-between gap-4"><span>From:</span> <span className="text-black font-black">{lr.from || lr.plant?.name}</span></p>
                    <p className="flex justify-between gap-4"><span>To:</span> <span className="text-black font-black">{lr.to || 'N/A'}</span></p>
                </div>
            </div>
        </div>
      </div>

      {/* 2. MISSION PARTICULARS BAR */}
      <div className="grid grid-cols-6 border-2 border-slate-900 rounded-xl overflow-hidden mb-6 bg-white divide-x-2 divide-slate-900">
        {[
            { label: 'Vehicle Number', value: lr.vehicleNumber },
            { label: 'Driver Number', value: lr.driverMobile || lr.trip?.driverMobile || 'N/A' },
            { label: 'Vehicle Type', value: lr.trip?.vehicleType || 'Truck' },
            { label: 'Transport Mode', value: lr.transportMode || 'ROAD' },
            { label: 'Payment Term', value: lr.paymentTerm || 'Paid' },
            { label: 'Dispatch Date & Time', value: formatDate(lr.trip?.startDate, 'dd MMM yyyy HH:mm') }
        ].map((node, i) => (
            <div key={i} className="p-2 text-center flex flex-col justify-center">
                <span className="text-[6.5pt] font-black uppercase text-slate-400 block mb-1">{node.label}</span>
                <p className="text-[8pt] font-black uppercase truncate">{node.value}</p>
            </div>
        ))}
      </div>

      {/* 3. PARTY REGISTRY GRID */}
      <div className="grid grid-cols-3 border-2 border-slate-900 rounded-xl overflow-hidden mb-6 divide-x-2 divide-slate-900">
        <div className="p-4 space-y-3">
            <span className="text-[8pt] font-black uppercase text-slate-900 border-b-2 border-slate-900 pb-1 block">Consignor</span>
            <div className="text-[8pt] space-y-1">
                <p className="font-black uppercase">{lr.consignorName}</p>
                <p className="text-slate-600 font-bold leading-tight">{lr.from}</p>
                <p className="pt-1"><span className="text-slate-400 font-black">Phone:</span> {lr.consignorMobile || 'N/A'}</p>
                <p><span className="text-slate-400 font-black">GSTIN:</span> <span className="font-mono">{lr.consignorGtin || '--'}</span></p>
            </div>
        </div>
        <div className="p-4 space-y-3">
            <span className="text-[8pt] font-black uppercase text-slate-900 border-b-2 border-slate-900 pb-1 block">Consignee/ Bill To Party</span>
            <div className="text-[8pt] space-y-1">
                <p className="font-black uppercase">{lr.buyerName}</p>
                <p className="text-slate-600 font-bold leading-tight truncate">{lr.buyerName}</p>
                <p className="pt-1"><span className="text-slate-400 font-black">Phone:</span> {lr.buyerMobile || 'N/A'}</p>
                <p><span className="text-slate-400 font-black">GSTIN:</span> <span className="font-mono">{lr.buyerGtin || '--'}</span></p>
            </div>
        </div>
        <div className="p-4 space-y-3">
            <span className="text-[8pt] font-black uppercase text-slate-900 border-b-2 border-slate-900 pb-1 block">Ship to Party</span>
            <div className="text-[8pt] space-y-1">
                <p className="font-black uppercase">{lr.shipToParty}</p>
                <p className="text-slate-600 font-bold leading-tight">{lr.to}</p>
                <p className="pt-1"><span className="text-slate-400 font-black">Phone:</span> {lr.shipToMobile || 'N/A'}</p>
                <p><span className="text-slate-400 font-black">GSTIN:</span> <span className="font-mono">{lr.shipToGtin || '--'}</span></p>
            </div>
        </div>
      </div>

      {/* 4. ITEM MANIFEST TABLE */}
      <div className="border-2 border-slate-900 rounded-xl overflow-hidden mb-6 flex-1 flex flex-col">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-900 h-10 text-[7.5pt] font-black uppercase border-b-2 border-slate-900">
              <th className="border-r-2 border-slate-900 px-3 text-left">Invoice No.</th>
              <th className="border-r-2 border-slate-900 px-2 text-left">E-Invoice No.</th>
              <th className="border-r-2 border-slate-900 px-2 text-left">Invoice Date</th>
              <th className="border-r-2 border-slate-900 px-3 text-left">Product Name</th>
              <th className="border-r-2 border-slate-900 px-2 text-center">No. of Units</th>
              <th className="border-r-2 border-slate-900 px-2 text-right">Weight (MT)</th>
              <th className="border-r-2 border-slate-900 px-2 text-right">Goods value (₹)</th>
              <th className="border-r-2 border-slate-900 px-2 text-left">E-WayBill No.</th>
              <th className="px-2 text-left">E-WayBill Date</th>
            </tr>
          </thead>
          <tbody className="text-[8.5pt]">
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200 h-10 align-middle">
                <td className="border-r-2 border-slate-900 px-3 font-black uppercase">{item.invoiceNumber}</td>
                <td className="border-r-2 border-slate-900 px-2 font-mono text-[7pt] truncate max-w-[80px]">{item.invoiceNumber?.slice(0, 10)}...</td>
                <td className="border-r-2 border-slate-900 px-2 whitespace-nowrap">{formatDate(lr.date, 'dd MMM')}</td>
                <td className="border-r-2 border-slate-900 px-3 font-bold uppercase">{item.itemDescription}</td>
                <td className="border-r-2 border-slate-900 px-2 text-center font-black">{item.units} {item.unitType ? `(${item.unitType})` : ''}</td>
                <td className="border-r-2 border-slate-900 px-2 text-right font-black">{Number(item.weight).toFixed(3)}</td>
                <td className="border-r-2 border-slate-900 px-2 text-right font-bold">{(Number((item as any).goodsValue) || 0).toLocaleString()}</td>
                <td className="border-r-2 border-slate-900 px-2 font-mono text-[7.5pt]">{item.ewaybillNumber || '--'}</td>
                <td className="px-2 whitespace-nowrap">{item.ewaybillNumber ? formatDate(lr.date, 'dd MMM') : '--'}</td>
              </tr>
            ))}
            {/* Maintenance rows to push footer down */}
            {Array.from({ length: Math.max(0, 12 - items.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-10 border-b border-slate-50 opacity-10">
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-900 bg-slate-50 font-black h-12">
            <tr className="align-middle">
              <td colSpan={4} className="px-4 text-[8pt] uppercase">Total Registry Manifest:</td>
              <td className="border-l-2 border-slate-900 px-2 text-center text-[10pt]">{totalUnits}</td>
              <td className="border-l-2 border-slate-900 px-2 text-right text-[10pt] text-blue-900">{totalWeight.toFixed(3)}</td>
              <td className="border-l-2 border-slate-900 px-2 text-right text-[10pt]">{totalValue > 0 ? totalValue.toLocaleString() : '--'}</td>
              <td colSpan={2} className="border-l-2 border-slate-900"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 5. REMARKS & TERMS SECTION */}
      <div className="mb-10 space-y-4">
        <div className="flex gap-4">
            <div className="flex-1 space-y-2">
                <span className="text-[7.5pt] font-black uppercase text-slate-400 tracking-widest px-1">Remarks:</span>
                <div className="p-4 border-2 border-slate-900 rounded-xl min-h-[60px] bg-slate-50/30">
                    <p className="text-[8pt] font-bold uppercase leading-relaxed text-slate-700">
                        {lr.deliveryAddress || 'N/A'}
                    </p>
                </div>
            </div>
            <div className="w-[30%] space-y-2">
                <span className="text-[7.5pt] font-black uppercase text-slate-400 tracking-widest px-1 text-right block">Terms & Conditions:</span>
                <div className="text-[6.5pt] font-medium text-slate-500 text-right leading-tight italic">
                    {lr.carrier?.terms && lr.carrier.terms.length > 0 ? (
                        lr.carrier.terms.slice(0, 3).map((term, i) => <p key={i}>• {term}</p>)
                    ) : (
                        <>
                            <p>• Subject to Ghaziabad Jurisdiction</p>
                            <p>• Goods carried at owner's risk</p>
                            <p>• Not responsible for leakage/damage</p>
                        </>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* 6. SIGNATURE NODE REMOVED AS PER USER REQUEST */}
      {/* Visual spacer to maintain balance */}
      <div className="flex-1" />

      {/* 7. FOOTER COMPLIANCE */}
      <div className="mt-auto pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
        <div className="text-center space-y-1">
            <p className="text-[8pt] font-bold text-slate-600">
                Note: This Lorry Receipt was generated digitally and is to be considered as original
            </p>
            <p className="text-[7pt] font-black uppercase text-slate-400 tracking-[0.2em]">
                Page {pageNumber} of {totalInSeries}
            </p>
        </div>
        
        <div className="opacity-20 flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-slate-900" />
            <span className="text-[6pt] font-black uppercase tracking-[0.5em]">Verified Registry Node Handshake</span>
        </div>
      </div>
    </div>
  );
}
