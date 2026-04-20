
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

export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    const d = parseSafeDate(date);
    return d && isValid(d) ? format(d, pattern).toUpperCase() : '--';
  };

  const buyerAddress = lr.buyerAddress || lr.deliveryAddress || lr.to;
  const shipToAddress = lr.deliveryAddress || buyerAddress || lr.to;

  const allItems = lr.items || [];
  
  const groupedByDesc = allItems.reduce((acc, item) => {
    const desc = (item.itemDescription || item.description || 'GENERAL CARGO').toUpperCase().trim();
    if (!acc[desc]) {
        acc[desc] = { 
            itemDescription: desc, 
            units: 0, 
            weight: 0, 
            invoices: new Set<string>(), 
            ewaybills: new Set<string>() 
        };
    }
    acc[desc].units += Number(item.units) || 0;
    acc[desc].weight += Number(item.weight) || 0;
    
    if (item.invoiceNumber) {
        item.invoiceNumber.split(',').forEach((inv: string) => {
            const trimmed = inv.trim();
            if (trimmed && trimmed !== '--') acc[desc].invoices.add(trimmed);
        });
    }

    if (item.ewaybillNumber) {
        item.ewaybillNumber.split(',').forEach((ewb: string) => {
            const trimmed = ewb.trim();
            if (trimmed && trimmed !== '--') acc[desc].ewaybills.add(trimmed);
        });
    }
    return acc;
  }, {} as Record<string, any>);

  const uniqueDescArray = Object.values(groupedByDesc);
  let displayItems = uniqueDescArray.map(group => ({
      ...group,
      invoiceNumber: Array.from(group.invoices).join(', '),
      ewaybillNumber: Array.from(group.ewaybills).join(', ')
  }));

  const totalUnitsFinal = allItems.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  const totalWeightFinal = Number(lr.assignedTripWeight) || 0;

  const renderPairedValues = (valueString: string) => {
    const items = (valueString || '').split(',').map(p => p.trim()).filter(Boolean).filter(v => v !== '--');
    if (items.length === 0) return <span className="text-slate-200">--</span>;
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
        const pair = items.slice(i, i + 2).join(', ');
        rows.push(<div key={i} className="text-[7pt] font-black text-slate-900 leading-tight mb-0.5 last:mb-0 uppercase text-center">{pair}</div>);
    }
    return <div className="flex flex-col py-1 items-center justify-center h-full">{rows}</div>;
  };

  const vehicleNumber = lr.vehicleNumber || lr.trip?.vehicleNumber || '--';
  const driverMobile = lr.driverMobile || lr.trip?.driverMobile || '--';
  const paymentTerm = lr.paymentTerm || lr.trip?.paymentTerm || 'PAID';

  // CARRIER PROFILE HANDSHAKE node: Resolve from provided carrier object
  const carrier = lr.carrier || {};
  
  // Mission Logic Node: Resolve dynamic terms from carrier registry
  const registryTerms = (carrier.terms && Array.isArray(carrier.terms) && carrier.terms.length > 0) 
    ? carrier.terms 
    : [
        "AGENCY NOT RESPONSIBLE FOR RAIN OR CALAMITY.",
        "DISCREPANCIES MUST BE INTIMATED WITHIN 24 HOURS.",
        "VEHICLE OWNER RESPONSIBLE AFTER YARD DEPARTURE.",
        "ALL DISPUTES SUBJECT TO GHAZIABAD JURISDICTION."
      ];

  return (
    <div className="A4-page p-[12mm] bg-white text-black font-sans text-[8.5pt] leading-tight flex flex-col relative box-border h-[297mm] w-[210mm] overflow-hidden select-text border-none mx-auto">
      {/* 1. TOP HEADER Terminal */}
      <div className="flex justify-end mb-4 shrink-0">
        <div className="border-2 border-black px-4 py-1 bg-slate-50 shadow-sm">
            <span className="text-[9pt] font-black uppercase tracking-widest text-slate-900 leading-none">{copyType}</span>
        </div>
      </div>

      <div className="flex justify-between items-start mb-6 shrink-0">
        <div className="flex gap-5 flex-1 pr-4">
          <div className="h-16 w-18 bg-white border border-black rounded-lg flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-sm">
            <img src="https://image2url.com/r2/default/images/1774853131451-83a2a90c-6707-43fc-9b92-c364ad369d96.jpeg" alt="Registry Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="space-y-1">
            <h1 className="text-[16pt] font-black uppercase tracking-tight leading-none text-slate-900">{carrier.name || 'SIKKA LMC'}</h1>
            <p className="text-[7pt] font-bold text-slate-600 uppercase max-w-[450px] leading-tight">{carrier.address || 'B-11, BULANDSHAHR ROAD GZB'}</p>
            <div className="text-[7pt] font-black text-slate-400 flex flex-wrap gap-x-4 pt-1 uppercase leading-snug">
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[7pt]">PHONE:</span> <span className="text-slate-900 font-mono">{carrier.mobile || '9136688004'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[7pt]">GSTIN:</span> <span className="font-mono text-slate-900">{carrier.gstin || '--'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[7pt]">PAN:</span> <span className="font-mono text-slate-900">{carrier.pan || '--'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[7pt]">STATE:</span> <span className="text-slate-900">{carrier.stateName || '--'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[7pt]">CODE:</span> <span className="text-slate-900">{carrier.stateCode || '--'}</span></p>
              {carrier.email && <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[7pt]">E-MAIL:</span> <span className="text-slate-900 lowercase font-bold">{carrier.email}</span></p>}
              {carrier.website && <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[7pt]">WEB:</span> <span className="text-slate-900 lowercase font-bold">{carrier.website}</span></p>}
            </div>
          </div>
        </div>
        <div className="min-w-[240px] space-y-3">
          <div className="border-2 border-black p-2 bg-white text-center rounded-xl shadow-sm flex items-center justify-between px-4">
            <span className="text-[8pt] font-black text-slate-400 uppercase tracking-widest">CN NO |</span>
            <span className="text-[14pt] font-black font-mono text-slate-900 tracking-tight">{lr.lrNumber}</span>
          </div>
          <div className="text-[9pt] font-black uppercase space-y-1.5 px-2">
            <p className="flex justify-between gap-6"><span>DATE:</span> <span className="text-slate-900">{formatDate(lr.date)}</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 border-2 border-black rounded-xl overflow-hidden mb-6 bg-white divide-x-2 divide-black shadow-sm shrink-0">
        {[
          { label: 'VEHICLE REGISTRY', value: vehicleNumber, bold: true },
          { label: 'PILOT CONTACT', value: driverMobile, mono: true },
          { label: 'PAYMENT TERM', value: paymentTerm, bold: true },
        ].map((node, i) => (
          <div className="py-2.5 px-1 text-center flex flex-col justify-center gap-1" key={i}>
            <span className="text-[6.5pt] font-black uppercase text-slate-400 block leading-tight tracking-[0.1em]">{node.label}</span>
            <p className={cn("text-[9pt] uppercase leading-none", node.bold ? "font-black text-slate-900" : "font-black text-slate-700", node.mono && "font-mono tracking-tighter text-blue-700", node.color)}>{node.value || '--'}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8 shrink-0">
        {[
            { title: 'CONSIGNOR (SENDER)', name: lr.consignorName, addr: lr.consignorAddress || lr.from, gstin: lr.consignorGtin },
            { title: 'CONSIGNEE (RECEIVER)', name: lr.buyerName || lr.shipToParty, addr: buyerAddress, gstin: lr.buyerGtin },
            { title: 'SHIP TO PARTY', name: lr.shipToParty || lr.buyerName, addr: shipToAddress, gstin: lr.shipToGtin }
        ].map((node, idx) => (
            <div key={idx} className="border-2 border-black rounded-[1.5rem] p-4 pt-6 relative min-h-[140px] flex flex-col justify-center bg-white shadow-md text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-5 py-1 rounded-full text-[6.5pt] font-black uppercase tracking-widest shadow-xl whitespace-nowrap">{node.title}</div>
                <div className="space-y-1.5 mt-1">
                    <p className="text-[9pt] font-black uppercase text-slate-900 leading-tight line-clamp-2">{node.name}</p>
                    <p className="text-[7.5pt] font-bold text-slate-500 leading-snug italic uppercase line-clamp-2">{node.addr}</p>
                    <p className="font-black text-slate-900 text-[7.5pt] pt-1.5 border-t border-slate-100 mt-1.5">GSTIN: <span className="font-mono uppercase">{node.gstin || 'N/A'}</span></p>
                </div>
            </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col mb-10 min-h-0">
        <div className="border-2 border-black rounded-[1.5rem] overflow-hidden flex flex-col shadow-lg bg-white">
            <table className="w-full border-collapse table-fixed">
            <thead className="bg-[#0a0c10] text-white text-[8pt] font-black uppercase tracking-[0.1em]">
                <tr className="h-12">
                <th className="border-r border-white/10 px-2 text-center w-28 leading-tight">Invoice No.</th>
                <th className="border-r border-white/10 px-2 text-center w-32 leading-tight">E-Waybill No.</th>
                <th className="border-r border-white/10 px-4 text-center leading-tight">DESCRIPTION OF GOODS</th>
                <th className="border-r border-white/10 px-1 text-center w-20 leading-tight">NO. OF PKGS</th>
                <th className="px-4 text-center w-32 leading-tight">WEIGHT (MT)</th>
                </tr>
            </thead>
            <tbody className="text-[9pt]">
                {displayItems.map((item, idx) => (
                <tr key={idx} className="align-middle border-b-2 border-slate-100 last:border-b-0">
                    <td className="border-r-2 border-slate-100 px-1 py-1 font-black uppercase align-middle">{renderPairedValues(item.invoiceNumber)}</td>
                    <td className="border-r-2 border-slate-100 px-1 py-1 font-black uppercase align-middle text-blue-800">{renderPairedValues(item.ewaybillNumber)}</td>
                    <td className="border-r-2 border-slate-100 px-4 py-1 uppercase italic font-black text-slate-700 leading-tight tracking-tighter text-center">{item.itemDescription}</td>
                    <td className="border-r-2 border-slate-100 px-1 text-center font-black text-[12pt] text-slate-900">{item.units}</td>
                    <td className="px-4 text-center font-black text-[12pt] text-slate-900 tracking-tighter">{idx === 0 ? totalWeightFinal.toFixed(3) : '--'}</td>
                </tr>
                ))}
            </tbody>
            <tfoot className="bg-[#1a1d24] font-black h-12 border-t-2 border-black text-[10pt] text-white">
                <tr>
                <td colSpan={3} className="px-8 uppercase border-r border-white/10 tracking-[0.8em]">MANIFEST TOTALS:</td>
                <td className="border-r border-white/10 text-center font-black">{totalUnitsFinal}</td>
                <td className="text-center px-4 font-black text-slate-400 tracking-tighter text-[13pt]">{totalWeightFinal.toFixed(3)} MT</td>
                </tr>
            </tfoot>
            </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-12 mb-8 shrink-0 px-4 mt-auto border-t-2 border-slate-100 pt-8">
        <div className="space-y-4">
            <span className="text-[9.5pt] font-black uppercase text-slate-900 border-b-2 border-black inline-block pb-1 tracking-widest italic">TERMS & CONDITIONS</span>
            <div className="space-y-1.5 pt-1">
                {registryTerms.map((term: string, i: number) => (
                    <p key={i} className="text-[7.5pt] font-black text-slate-600 leading-tight uppercase tracking-tight">
                        {i + 1}. {term}
                    </p>
                ))}
            </div>
        </div>
        <div className="flex flex-col justify-end text-center">
            <div className="w-full border-t-2 border-black border-dashed mb-3 opacity-40" />
            <span className="text-[12pt] font-black uppercase tracking-[0.4em] text-slate-900 italic leading-none">AUTHORIZED SIGNATURE</span>
        </div>
      </div>
    </div>
  );
}
