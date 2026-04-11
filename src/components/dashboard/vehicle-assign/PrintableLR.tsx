
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
 * @fileOverview SIKKA LMC - Official Lorry Receipt (LR) Manifest.
 * Implements high-fidelity office standard layout matching reference image:
 * - Table Headers: INVOICE REGISTRY, E-WAYBILL NODE, DESCRIPTION OF GOODS, NO. OF PKGS, WEIGHT (MT).
 * - Styling: Black headers/footers, rounded corners, teal-colored totals.
 * - Pairing Logic: Invoices and E-Waybills displayed in pairs (2 per line).
 */
export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    const d = parseSafeDate(date);
    return d && isValid(d) ? format(d, pattern) : '--';
  };

  const buyerAddress = lr.buyerAddress || lr.deliveryAddress || lr.to;
  const shipToAddress = lr.deliveryAddress || buyerAddress || lr.to;

  // 1. MANIFEST REGISTRY SUMMARIZATION Node
  const allItems = lr.items || [];
  
  // Group by Description to handle item uniqueness
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
    
    if (item.invoiceNumber) item.invoiceNumber.split(',').forEach((inv: string) => acc[desc].invoices.add(inv.trim()));
    if (item.ewaybillNumber) item.ewaybillNumber.split(',').forEach((ewb: string) => acc[desc].ewaybills.add(ewb.trim()));
    
    return acc;
  }, {} as Record<string, any>);

  const uniqueDescArray = Object.values(groupedByDesc);
  let displayItems: any[] = [];

  if (uniqueDescArray.length > 3) {
    // MISSION RULE: Collapse to consolidated node if > 3 unique items detected
    const totalUnits = allItems.reduce((sum, i) => sum + (Number(i.units) || 0), 0);
    const totalWeight = Number(lr.assignedTripWeight) || allItems.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
    
    const allInvoices = new Set<string>();
    const allEwaybills = new Set<string>();
    allItems.forEach(i => {
        if (i.invoiceNumber) i.invoiceNumber.split(',').forEach((inv: string) => allInvoices.add(inv.trim()));
        if (i.ewaybillNumber) i.ewaybillNumber.split(',').forEach((ewb: string) => allEwaybills.add(ewb.trim()));
    });

    displayItems = [{
        itemDescription: 'VARIOUS ITEMS AS PER INVOICE',
        units: totalUnits,
        weight: totalWeight,
        invoiceNumber: Array.from(allInvoices).join(', '),
        ewaybillNumber: Array.from(allEwaybills).join(', ')
    }];
  } else {
    displayItems = uniqueDescArray.map(group => ({
        ...group,
        invoiceNumber: Array.from(group.invoices).join(', '),
        ewaybillNumber: Array.from(group.ewaybills).join(', ')
    }));
  }

  const totalUnitsFinal = allItems.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  const totalWeightFinal = Number(lr.assignedTripWeight) || allItems.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);

  // 2. REGISTRY PAIRING Node (Renders items in rows of two)
  const renderPairedValues = (valueString: string) => {
    const items = (valueString || '').split(',').map(p => p.trim()).filter(Boolean).filter(v => v !== '--');
    if (items.length === 0) return <span className="text-slate-200">--</span>;
    
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
        const pair = items.slice(i, i + 2).join(', ');
        rows.push(<div key={i} className="text-[8.5pt] font-black text-slate-900 leading-tight mb-1 last:mb-0 uppercase">{pair}</div>);
    }
    return <div className="flex flex-col py-2">{rows}</div>;
  };

  const vehicleNumber = lr.vehicleNumber || lr.trip?.vehicleNumber || '--';
  const driverMobile = lr.driverMobile || lr.trip?.driverMobile || '--';
  const vehicleType = lr.trip?.vehicleType || 'OWN VEHICLE';
  const paymentTerm = lr.paymentTerm || lr.trip?.paymentTerm || 'PAID';
  const dispatchDateRaw = lr.trip?.startDate || lr.date;
  const dispatchTime = dispatchDateRaw ? format(parseSafeDate(dispatchDateRaw)!, 'HH:mm') : 'N/A';

  return (
    <div className="A4-page p-[10mm] bg-white text-black font-sans text-[9.5pt] leading-tight flex flex-col relative box-border h-[297mm] overflow-hidden select-text print:m-0 print:p-0">
      
      {/* 1. COPY INDICATOR node */}
      <div className="text-center mb-6 border-b-2 border-black pb-1">
        <span className="text-[12pt] font-black uppercase tracking-[0.6em] text-slate-900">{copyType}</span>
      </div>

      {/* 2. CARRIER HEADER node */}
      <div className="flex justify-between items-start mb-8 pt-2 shrink-0">
        <div className="flex gap-6 flex-1 pr-6">
          <div className="h-24 w-24 bg-white border-2 border-black rounded-2xl flex items-center justify-center p-2 shrink-0 overflow-hidden shadow-sm">
            <img src={lr.carrier?.logoUrl || "https://image2url.com/r2/default/images/1774853131451-83a2a90c-6707-43fc-9b92-c364ad369d96.jpeg"} alt="Carrier Node" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-[22pt] font-black uppercase tracking-tighter leading-none">{lr.carrier?.name || 'SIKKA LMC'}</h1>
            <p className="text-[9pt] font-black text-slate-600 uppercase max-w-[480px] leading-snug">{lr.carrier?.address || '--'}</p>
            <div className="text-[9pt] font-black text-slate-500 flex flex-wrap gap-x-10 pt-3 uppercase">
              <p>PHONE: <span className="text-slate-900">{lr.carrier?.mobile}</span></p>
              <p>GSTIN: <span className="font-mono text-slate-900">{lr.carrier?.gstin}</span></p>
              <p>PAN: <span className="font-mono text-slate-900">{lr.carrier?.pan}</span></p>
            </div>
          </div>
        </div>

        <div className="min-w-[280px] space-y-4">
          <div className="border-[3.5px] border-black p-4 bg-white text-center rounded-2xl shadow-md">
            <p className="text-[16pt] font-black uppercase flex justify-between items-center gap-4 leading-none">
              <span className="opacity-30 text-[10pt]">CN NO |</span>
              <span className="font-mono text-blue-900">{lr.lrNumber}</span>
            </p>
          </div>
          <div className="text-[10.5pt] font-black uppercase space-y-2.5 px-2">
            <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>DATE:</span> <span className="text-slate-900">{formatDate(lr.date)}</span></p>
            <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>FROM:</span> <span className="text-blue-900">{lr.from?.split(',')[0].toUpperCase() || '--'}</span></p>
            <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>TO:</span> <span className="text-emerald-700">{lr.to?.split(',')[0].toUpperCase() || '--'}</span></p>
          </div>
        </div>
      </div>

      {/* 3. TRIP METRICS node */}
      <div className="grid grid-cols-5 border-2 border-black rounded-[1.5rem] overflow-hidden mb-8 bg-slate-50 divide-x-2 divide-black shadow-inner shrink-0">
        {[
          { label: 'VEHICLE REGISTRY', value: vehicleNumber, bold: true },
          { label: 'PILOT CONTACT', value: driverMobile, mono: true },
          { label: 'FLEET CATEGORY', value: vehicleType },
          { label: 'PAYMENT TERM', value: paymentTerm },
          { label: 'DISPATCH NODE', value: dispatchTime, mono: true }
        ].map((node, i) => (
          <div key={i} className="py-6 px-2 text-center flex flex-col justify-center gap-1.5 min-h-[80px]">
            <span className="text-[7.5pt] font-black uppercase text-slate-400 block leading-tight tracking-[0.2em]">{node.label}</span>
            <p className={cn(
                "text-[10pt] uppercase leading-none", 
                node.bold ? "font-black text-slate-900" : "font-bold text-slate-700", 
                node.mono && "font-mono tracking-tighter"
            )}>
                {node.value || 'N/A'}
            </p>
          </div>
        ))}
      </div>

      {/* 4. PARTY REGISTRY NODES */}
      <div className="grid grid-cols-3 gap-6 mb-8 shrink-0">
        <div className="border-2 border-black rounded-[2rem] p-6 relative min-h-[160px] flex flex-col justify-center bg-white shadow-sm">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-2 rounded-full text-[9pt] font-black uppercase tracking-widest shadow-lg whitespace-nowrap">CONSIGNOR (SENDER)</div>
          <div className="space-y-2 text-center mt-4">
            <p className="text-[11pt] font-black uppercase text-slate-900 leading-tight">{lr.consignorName}</p>
            <p className="text-[9pt] font-bold text-slate-500 leading-snug italic uppercase line-clamp-2">{lr.consignorAddress || lr.from}</p>
            <p className="font-black text-slate-900 text-[9pt] pt-2">GSTIN: <span className="font-mono uppercase">{lr.consignorGtin || '--'}</span></p>
          </div>
        </div>
        <div className="border-2 border-black rounded-[2rem] p-6 relative min-h-[160px] flex flex-col justify-center bg-white shadow-sm">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-2 rounded-full text-[9pt] font-black uppercase tracking-widest shadow-lg whitespace-nowrap">CONSIGNEE (RECEIVER)</div>
          <div className="space-y-2 text-center mt-4">
            <p className="text-[11pt] font-black uppercase text-slate-900 leading-tight">{lr.buyerName || lr.shipToParty || '--'}</p>
            <p className="text-[9pt] font-bold text-slate-500 leading-snug italic uppercase line-clamp-2">{buyerAddress || '--'}</p>
            <p className="font-black text-slate-900 text-[9pt] pt-2">GSTIN: <span className="font-mono uppercase">{lr.buyerGtin || '--'}</span></p>
          </div>
        </div>
        <div className="border-2 border-black rounded-[2rem] p-6 relative min-h-[160px] flex flex-col justify-center bg-white shadow-sm">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-900 text-white px-6 py-2 rounded-full text-[9pt] font-black uppercase tracking-widest shadow-lg whitespace-nowrap">SHIP TO PARTY</div>
          <div className="space-y-2 text-center mt-4">
            <p className="text-[11pt] font-black uppercase text-blue-900 leading-tight">{lr.shipToParty || lr.buyerName}</p>
            <p className="text-[9pt] font-bold text-slate-500 leading-snug italic uppercase line-clamp-2">{shipToAddress || '--'}</p>
            <p className="font-black text-slate-900 text-[9pt] pt-2">GSTIN: <span className="font-mono uppercase">{lr.shipToGtin || '--'}</span></p>
          </div>
        </div>
      </div>

      {/* 5. MANIFEST ITEMS TABLE node - UPDATED TO MATCH IMAGE */}
      <div className="border-[3px] border-black rounded-[2.5rem] overflow-hidden mb-10 flex flex-col shadow-xl shrink-0 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-[#0a0c10] text-white text-[10pt] font-black uppercase tracking-[0.1em]">
            <tr className="h-16">
              <th className="border-r border-white/10 px-8 text-left w-64 leading-tight">INVOICE<br/>REGISTRY</th>
              <th className="border-r border-white/10 px-8 text-left w-64 leading-tight">E-WAYBILL<br/>NODE</th>
              <th className="border-r border-white/10 px-8 text-left leading-tight">DESCRIPTION<br/>OF GOODS</th>
              <th className="border-r border-white/10 px-4 text-center w-32 leading-tight">NO. OF<br/>PKGS</th>
              <th className="px-8 text-right w-40 leading-tight">WEIGHT<br/>(MT)</th>
            </tr>
          </thead>
          <tbody className="text-[11pt]">
            {displayItems.map((item, idx) => (
              <tr key={idx} className="align-middle border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                <td className="border-r border-slate-200 px-8 font-black uppercase text-center md:text-left">
                  {renderPairedValues(item.invoiceNumber)}
                </td>
                <td className="border-r border-slate-200 px-8 font-black uppercase text-center md:text-left">
                  {renderPairedValues(item.ewaybillNumber)}
                </td>
                <td className="border-r border-slate-200 px-8 uppercase py-8 italic font-black text-slate-700 leading-snug tracking-tighter">
                    {item.itemDescription}
                </td>
                <td className="border-r border-slate-200 px-4 text-center font-black text-[13pt] text-slate-900">{item.units}</td>
                <td className="px-8 text-right font-black text-[13pt] text-blue-900 tracking-tighter">
                    {Number(item.weight).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[#1a1d24] font-black h-20 border-t-2 border-black text-[13pt] text-white">
            <tr>
              <td colSpan={3} className="px-10 uppercase border-r border-white/10 tracking-[0.4em]">MANIFEST TOTALS:</td>
              <td className="border-r border-white/10 text-center font-black">{totalUnitsFinal}</td>
              <td className="text-right px-8 font-black text-[#10b981] tracking-tighter">{totalWeightFinal.toFixed(3)} MT</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 6. TERMS & SIGNATURE node */}
      <div className="grid grid-cols-2 gap-24 mb-12 mt-auto shrink-0 px-8">
        <div className="space-y-6">
          <span className="text-[10pt] font-black uppercase text-slate-900 border-b-2 border-black inline-block pb-1 tracking-[0.2em]">TERMS & CONDITIONS</span>
          <div className="space-y-2.5 pt-1">
            {(lr.carrier?.terms?.length > 0 ? lr.carrier.terms : [
                "Agency is not responsible for rain or any natural calamity.",
                "Discrepancies must be intimated within 24 Hours of receipt node.",
                "Vehicle owner is responsible for goods after yard departure.",
                "Agency has the right to hold material upon mission shortage.",
                "Sikka Logistics holds no responsibility after final drop node.",
                "All disputes subject to Ghaziabad Jurisdiction."
            ]).map((term, i) => (
                <p key={i} className="text-[8.5pt] font-bold text-slate-500 leading-snug uppercase">{i + 1}. {term}</p>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-end text-center pt-10">
          <div className="w-full border-t-2 border-black border-dashed mb-6" />
          <span className="text-[13pt] font-black uppercase tracking-[0.5em] text-slate-900 italic">AUTHORIZED SIGNATORY</span>
          <span className="text-[9pt] font-bold text-slate-400 uppercase mt-2 tracking-widest">LMC REGISTRY VERIFIED IDENTITY NODE</span>
        </div>
      </div>

      {/* 7. PERMANENT FOOTER STRIP node */}
      <div className="mt-6 pt-6 border-t-2 border-black flex flex-col items-center gap-4 shrink-0">
        <p className="text-[8.5pt] font-black uppercase text-slate-400 tracking-[0.2em] text-center max-w-[85%] leading-relaxed">
            NOTICE: THIS IS A COMPUTER GENERATED MANIFEST AUTHORIZED BY SIKKA INDUSTRIES. <br/>
            AUTHENTICITY CAN BE VERIFIED VIA MISSION REGISTRY HUB USING CN NO.
        </p>
        <div className="flex items-center gap-16">
            <span className="text-[11pt] font-black uppercase tracking-[0.6em] text-slate-900">PAGE {pageNumber} OF {totalInSeries}</span>
            <div className="h-6 w-px bg-slate-300" />
            <span className="text-[10pt] font-black text-blue-900/40 tracking-widest uppercase italic">SIKKA LMC ENTERPRISE v2.5</span>
        </div>
      </div>
    </div>
  );
}
