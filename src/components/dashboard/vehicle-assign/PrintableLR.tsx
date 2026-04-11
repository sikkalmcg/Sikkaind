'use client';

import React from 'react';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate } from '@/lib/utils';
import type { LR, Trip, Shipment, Carrier, Plant, LRProduct } from '@/types';

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
 * @fileOverview SIKKA LMC - Specialized Lorry Receipt (LR) Manifest.
 * Implements advanced summarization logic:
 * - Groups by Item Name.
 * - If > 3 unique items, summarizes as "Various Items As Per Invoice".
 * - Displays Invoices and E-Waybills in pairs (2 per line).
 */
export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    const d = parseSafeDate(date);
    return d && isValid(d) ? format(d, pattern) : '--';
  };

  const buyerAddress = lr.buyerAddress || lr.deliveryAddress || lr.to;
  const shipToAddress = lr.deliveryAddress || buyerAddress || lr.to;

  // 1. MANIFEST SUMMARIZATION LOGIC Node
  const allItems = lr.items || [];
  
  // Group by Description first to handle "items with same name"
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
    // MISSION RULE: If more than 3 unique items, collapse to "Various Items"
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
    // Keep individual groups
    displayItems = uniqueDescArray.map(group => ({
        ...group,
        invoiceNumber: Array.from(group.invoices).join(', '),
        ewaybillNumber: Array.from(group.ewaybills).join(', ')
    }));
  }

  const totalUnitsFinal = allItems.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  const totalWeightFinal = Number(lr.assignedTripWeight) || allItems.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  // 2. REGISTRY PAIRING LOGIC Node (Show 2 items per line)
  const renderPairedValues = (valueString: string) => {
    const items = (valueString || '').split(',').map(p => p.trim()).filter(Boolean).filter(v => v !== '--');
    if (items.length === 0) return <span className="text-slate-300">--</span>;
    
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
        const pair = items.slice(i, i + 2).join(', ');
        rows.push(<div key={i} className="text-[7.5pt] font-black text-slate-900 leading-tight mb-1 last:mb-0 uppercase">{pair}</div>);
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
    <div className="A4-page p-[10mm] bg-white text-black font-sans text-[9pt] leading-tight flex flex-col relative box-border h-[297mm] overflow-hidden">
      
      {/* COPY INDICATOR */}
      <div className="text-center mb-4 border-b-2 border-black pb-1">
        <span className="text-[11pt] font-black uppercase tracking-[0.6em] text-slate-900">{copyType}</span>
      </div>

      {/* HEADER NODE: Carrier fetched by Plant Node particulars */}
      <div className="flex justify-between items-start mb-8 pt-2">
        <div className="flex gap-6 flex-1 pr-6">
          <div className="h-20 w-20 bg-white border-2 border-black rounded-xl flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-sm">
            <img src={lr.carrier?.logoUrl || "https://image2url.com/r2/default/images/1774853131451-83a2a90c-6707-43fc-9b92-c364ad369d96.jpeg"} alt="Carrier Registry" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="space-y-1">
            <h1 className="text-[18pt] font-black uppercase tracking-tighter leading-none">{lr.carrier?.name || 'SIKKA LMC'}</h1>
            <p className="text-[8pt] font-black text-slate-600 uppercase max-w-[450px] leading-snug">{lr.carrier?.address || '--'}</p>
            <div className="text-[8pt] font-black text-slate-500 flex flex-wrap gap-x-6 pt-1 uppercase">
              <p>PHONE: <span className="text-slate-900">{lr.carrier?.mobile}</span></p>
              <p>GSTIN: <span className="font-mono text-slate-900">{lr.carrier?.gstin}</span></p>
              <p>PAN NO: <span className="font-mono text-slate-900">{lr.carrier?.pan}</span></p>
              <p>EMAIL: <span className="text-slate-900 lowercase">{lr.carrier?.email}</span></p>
            </div>
          </div>
        </div>

        <div className="min-w-[240px] space-y-3">
          <div className="border-4 border-black p-3 bg-white text-center rounded-lg shadow-sm">
            <p className="text-[14pt] font-black uppercase flex justify-between items-center gap-4 leading-none">
              <span>CN NO |</span>
              <span className="font-mono text-blue-900">{lr.lrNumber}</span>
            </p>
          </div>
          <div className="text-[10pt] font-black uppercase space-y-1.5 px-2">
            <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>DATE:</span> <span>{formatDate(lr.date)}</span></p>
            <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>FROM:</span> <span className="truncate max-w-[140px] text-blue-900">{lr.from?.toUpperCase() || '--'}</span></p>
            <p className="flex justify-between gap-4 border-b border-dotted border-slate-300 pb-1"><span>TO:</span> <span className="truncate max-w-[140px] text-emerald-700">{lr.to?.toUpperCase() || '--'}</span></p>
          </div>
        </div>
      </div>

      {/* TRIP METRICS NODE - Refined padding and height to prevent clipping */}
      <div className="grid grid-cols-5 border-2 border-black rounded-2xl overflow-hidden mb-8 bg-slate-50 divide-x-2 divide-black shadow-inner">
        {[
          { label: 'VEHICLE REGISTRY', value: vehicleNumber, bold: true },
          { label: 'PILOT CONTACT', value: driverMobile, mono: true },
          { label: 'FLEET CATEGORY', value: vehicleType },
          { label: 'PAYMENT TERM', value: paymentTerm },
          { label: 'DISPATCH NODE', value: dispatchTime, mono: true }
        ].map((node, i) => (
          <div key={i} className="py-4 px-2 text-center flex flex-col justify-center gap-1.5">
            <span className="text-[7pt] font-black uppercase text-slate-400 block leading-tight tracking-widest">{node.label}</span>
            <p className={cn(
                "text-[10pt] uppercase leading-tight", 
                node.bold ? "font-black text-slate-900" : "font-bold text-slate-700", 
                node.mono && "font-mono tracking-tighter"
            )}>
                {node.value || 'N/A'}
            </p>
          </div>
        ))}
      </div>

      {/* PARTY REGISTRY NODES */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="border-2 border-black rounded-[2rem] p-6 relative min-h-[140px] flex flex-col justify-center bg-white shadow-sm">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-1.5 rounded-full text-[8pt] font-black uppercase tracking-widest shadow-lg whitespace-nowrap text-center">CONSIGNOR (SENDER)</div>
          <div className="space-y-1.5 text-center mt-2">
            <p className="text-[10pt] font-black uppercase text-slate-900 leading-tight">{lr.consignorName}</p>
            <p className="text-[8pt] font-bold text-slate-600 leading-snug italic uppercase">{lr.consignorAddress || lr.from}</p>
            <p className="font-black text-slate-900 text-[8pt] pt-1">GSTIN: <span className="font-mono uppercase">{lr.consignorGtin || '--'}</span></p>
          </div>
        </div>
        <div className="border-2 border-black rounded-[2rem] p-6 relative min-h-[140px] flex flex-col justify-center bg-white shadow-sm">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-1.5 rounded-full text-[8pt] font-black uppercase tracking-widest shadow-lg whitespace-nowrap text-center">CONSIGNEE (RECEIVER)</div>
          <div className="space-y-1.5 text-center mt-2">
            <p className="text-[10pt] font-black uppercase text-slate-900 leading-tight">{lr.buyerName || lr.shipToParty || '--'}</p>
            <p className="text-[8pt] font-bold text-slate-600 leading-snug italic uppercase">{buyerAddress || '--'}</p>
            <p className="font-black text-slate-900 text-[8pt] pt-1">GSTIN: <span className="font-mono uppercase">{lr.buyerGtin || '--'}</span></p>
          </div>
        </div>
        <div className="border-2 border-black rounded-[2rem] p-6 relative min-h-[140px] flex flex-col justify-center bg-white shadow-sm">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-1.5 rounded-full text-[8pt] font-black uppercase tracking-widest shadow-lg whitespace-nowrap text-center text-blue-100 bg-blue-900">SHIP TO PARTY</div>
          <div className="space-y-1.5 text-center mt-2">
            <p className="text-[10pt] font-black uppercase text-blue-900 leading-tight">{lr.shipToParty || lr.buyerName}</p>
            <p className="text-[8pt] font-bold text-slate-600 leading-snug italic uppercase">{shipToAddress || '--'}</p>
            <p className="font-black text-slate-900 text-[8pt] pt-1">GSTIN: <span className="font-mono uppercase">{lr.shipToGtin || '--'}</span></p>
          </div>
        </div>
      </div>

      {/* MANIFEST ITEMS TABLE */}
      <div className="border-2 border-black rounded-[2rem] overflow-hidden mb-10 flex flex-col shadow-md shrink-0 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-black text-white text-[8.5pt] font-black uppercase tracking-widest">
            <tr className="h-12">
              <th className="border-r-2 border-white/20 px-6 text-left w-56">INVOICE REGISTRY</th>
              <th className="border-r-2 border-white/20 px-6 text-left w-56">E-WAYBILL NODE</th>
              <th className="border-r-2 border-white/20 px-6 text-left">DESCRIPTION OF GOODS</th>
              <th className="border-r-2 border-white/20 px-4 text-center w-28">NO. OF PKGS</th>
              <th className="px-6 text-right w-36">WEIGHT (MT)</th>
            </tr>
          </thead>
          <tbody className="text-[9.5pt] font-black text-slate-900">
            {displayItems.map((item, idx) => (
              <tr key={idx} className="align-middle border-b border-slate-200 last:border-b-0 hover:bg-slate-50 transition-colors">
                <td className="border-r-2 border-slate-200 px-6 font-black uppercase leading-tight">
                  {renderPairedValues(item.invoiceNumber)}
                </td>
                <td className="border-r-2 border-slate-200 px-6 font-black uppercase leading-tight">
                  {renderPairedValues(item.ewaybillNumber)}
                </td>
                <td className="border-r-2 border-slate-200 px-6 uppercase py-4 italic text-slate-600 leading-snug">
                    {item.itemDescription}
                </td>
                <td className="border-r-2 border-slate-200 px-4 text-center font-mono">{item.units}</td>
                <td className="px-6 text-right font-mono text-blue-900">{Number(item.weight).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-900 font-black h-14 border-t-2 border-black text-[11pt] text-white">
            <tr>
              <td colSpan={2} className="px-6 uppercase border-r-2 border-white/10 tracking-[0.2em]">MANIFEST TOTALS:</td>
              <td className="border-r-2 border-white/10"></td>
              <td className="border-r-2 border-white/10 text-center font-mono">{totalUnitsFinal}</td>
              <td className="text-right px-6 font-mono text-emerald-400">{totalWeightFinal.toFixed(3)} MT</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* FOOTER SECTION: Terms & Signature Node */}
      <div className="grid grid-cols-2 gap-16 mb-10 mt-auto shrink-0 px-4">
        <div className="space-y-4">
          <span className="text-[9pt] font-black uppercase text-slate-900 border-b-2 border-black inline-block pb-1 tracking-[0.2em]">TERMS & CONDITIONS</span>
          <div className="space-y-1.5 pt-1">
            {lr.carrier?.terms?.length > 0 ? (
                lr.carrier.terms.map((term, i) => <p key={i} className="text-[7.5pt] font-bold text-slate-500 leading-tight uppercase">{i + 1}. {term}</p>)
            ) : (
                [
                    "1. Agency is not responsible for rain or any natural calamity.",
                    "2. Discrepancies must be intimated within 24 Hours of receipt node.",
                    "3. Vehicle owner is responsible for goods after yard departure.",
                    "4. Agency has the right to hold material upon mission shortage.",
                    "5. Sikka Logistics holds no responsibility after final drop node.",
                    "6. All disputes subject to Ghaziabad Jurisdiction."
                ].map((term, i) => <p key={i} className="text-[7.5pt] font-bold text-slate-500 leading-tight uppercase">{term}</p>)
            )}
          </div>
        </div>
        <div className="flex flex-col justify-end text-center pt-4">
          <div className="w-full border-t-2 border-black border-dashed mb-3" />
          <span className="text-[10pt] font-black uppercase tracking-[0.4em] text-slate-900 italic">AUTHORIZED SIGNATORY</span>
          <span className="text-[7pt] font-bold text-slate-400 uppercase mt-1">LMC REGISTRY VERIFIED NODE</span>
        </div>
      </div>

      {/* PERMANENT FOOTER STRIP */}
      <div className="mt-4 pt-4 border-t-2 border-black flex flex-col items-center gap-2 shrink-0">
        <p className="text-[8pt] font-black uppercase text-slate-400 tracking-0.3em text-center">NOTE: THIS LORRY RECEIPT WAS GENERATED DIGITALLY AND IS VALID WITHOUT PHYSICAL SEAL</p>
        <div className="flex items-center gap-10">
            <span className="text-[9pt] font-black uppercase tracking-[0.5em] text-slate-900">PAGE {pageNumber} OF {totalInSeries}</span>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-[8pt] font-black text-blue-900/40 tracking-widest uppercase italic">SIKKA LMC MISSION REGISTRY v2.5</span>
        </div>
      </div>
    </div>
  );
}
