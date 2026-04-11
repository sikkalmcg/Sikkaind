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
 * @fileOverview SIKKA LMC - Standardized Lorry Receipt (LR) Manifest.
 * Fixed CSS architecture to match office standard reference image.
 * - Precision-aligned header registry
 * - Pill-style party node headers
 * - Rounded-header high-contrast items table
 * - Paired document reference logic
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
  
  // Group by Description to handle item uniqueness and prevent list overflow
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

  if (uniqueDescArray.length > 4) {
    // MISSION RULE: Collapse to consolidated node if too many unique items detected for single page
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

  // 2. REGISTRY PAIRING Node (Renders items in rows of two per standard)
  const renderPairedValues = (valueString: string) => {
    const items = (valueString || '').split(',').map(p => p.trim()).filter(Boolean).filter(v => v !== '--');
    if (items.length === 0) return <span className="text-slate-200">--</span>;
    
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
        const pair = items.slice(i, i + 2).join(', ');
        rows.push(<div key={i} className="text-[8.5pt] font-black text-slate-900 leading-tight mb-1 last:mb-0 uppercase text-center">{pair}</div>);
    }
    return <div className="flex flex-col py-2 items-center justify-center h-full">{rows}</div>;
  };

  const vehicleNumber = lr.vehicleNumber || lr.trip?.vehicleNumber || '--';
  const driverMobile = lr.driverMobile || lr.trip?.driverMobile || '--';
  const vehicleType = lr.trip?.vehicleType || 'MT';
  const paymentTerm = lr.paymentTerm || lr.trip?.paymentTerm || 'PAID';
  const dispatchDateRaw = lr.trip?.startDate || lr.date;
  const dispatchTime = dispatchDateRaw ? format(parseSafeDate(dispatchDateRaw)!, 'HH:mm') : '11:35';

  return (
    <div className="A4-page p-[10mm] bg-white text-black font-sans text-[9.5pt] leading-tight flex flex-col relative box-border h-[297mm] overflow-hidden select-text print:m-0 print:p-0">
      
      {/* COPY INDICATOR */}
      <div className="text-center mb-6 border-b-2 border-black pb-1">
        <span className="text-[12pt] font-black uppercase tracking-[0.6em] text-slate-900">{copyType}</span>
      </div>

      {/* HEADER: CARRIER & CN INFO */}
      <div className="flex justify-between items-start mb-8 pt-2 shrink-0">
        <div className="flex gap-6 flex-1 pr-6">
          <div className="h-24 w-24 bg-white border-2 border-black rounded-2xl flex items-center justify-center p-2 shrink-0 overflow-hidden shadow-sm">
            <img 
                src={lr.carrier?.logoUrl || "https://image2url.com/r2/default/images/1774853131451-83a2a90c-6707-43fc-9b92-c364ad369d96.jpeg"} 
                alt="Logo" 
                className="max-h-full max-w-full object-contain" 
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-[24pt] font-black uppercase tracking-tighter leading-none">{lr.carrier?.name || 'SIKKA LMC'}</h1>
            <p className="text-[8.5pt] font-bold text-slate-600 uppercase max-w-[450px] leading-snug">
                {lr.carrier?.address || 'B-11, BULANDSHAHR ROAD INDLAREA, GHAZIABAD, UTTAR PRADESH, 201009'}
            </p>
            <div className="text-[8.5pt] font-black text-slate-500 flex flex-wrap gap-x-8 pt-2 uppercase">
              <p>PHONE: <span className="text-slate-900 font-mono">9136688004</span></p>
              <p>GSTIN: <span className="font-mono text-slate-900">09AYQPS6936B1ZV</span></p>
              <p>PAN: <span className="font-mono text-slate-900">AYQPS6936B</span></p>
            </div>
          </div>
        </div>

        <div className="min-w-[280px] space-y-4">
          <div className="border-[3px] border-black p-4 bg-white text-center rounded-[1.2rem] shadow-md flex items-center justify-between gap-4">
            <span className="text-[10pt] font-black text-slate-400 uppercase">CN NO |</span>
            <span className="text-[18pt] font-black font-mono text-blue-900 tracking-tight">{lr.lrNumber}</span>
          </div>
          <div className="text-[10.5pt] font-black uppercase space-y-2 px-2">
            <p className="flex justify-between gap-4"><span>DATE:</span> <span className="text-slate-900">{formatDate(lr.date)}</span></p>
            <p className="flex justify-between gap-4"><span>FROM:</span> <span className="text-blue-900">{lr.from?.split(',')[0].toUpperCase() || 'GHAZIABAD'}</span></p>
            <p className="flex justify-between gap-4"><span>TO:</span> <span className="text-emerald-700">{lr.to?.split(',')[0].toUpperCase() || 'HAPUR'}</span></p>
          </div>
        </div>
      </div>

      {/* TRIP METRICS GRID */}
      <div className="grid grid-cols-5 border-2 border-black rounded-[1.5rem] overflow-hidden mb-8 bg-white divide-x-2 divide-black shadow-sm shrink-0">
        {[
          { label: 'VEHICLE REGISTRY', value: vehicleNumber, bold: true },
          { label: 'PILOT CONTACT', value: driverMobile, mono: true },
          { label: 'FLEET CATEGORY', value: vehicleType },
          { label: 'PAYMENT TERM', value: paymentTerm },
          { label: 'DISPATCH NODE', value: dispatchTime, mono: true }
        ].map((node, i) => (
          <div key={i} className="py-4 px-2 text-center flex flex-col justify-center gap-1.5 border-none">
            <span className="text-[7.5pt] font-black uppercase text-slate-400 block leading-tight tracking-[0.1em]">{node.label}</span>
            <p className={cn(
                "text-[10pt] uppercase leading-none", 
                node.bold ? "font-black text-slate-900" : "font-black text-slate-600", 
                node.mono && "font-mono tracking-tighter"
            )}>
                {node.value || '--'}
            </p>
          </div>
        ))}
      </div>

      {/* PARTY REGISTRY NODES */}
      <div className="grid grid-cols-3 gap-6 mb-10 shrink-0">
        {[
            { title: 'CONSIGNOR (SENDER)', name: lr.consignorName, addr: lr.consignorAddress || lr.from, gstin: lr.consignorGtin, theme: 'black' },
            { title: 'CONSIGNEE (RECEIVER)', name: lr.buyerName || lr.shipToParty, addr: buyerAddress, gstin: lr.buyerGtin, theme: 'black' },
            { title: 'SHIP TO PARTY', name: lr.shipToParty || lr.buyerName, addr: shipToAddress, gstin: lr.shipToGtin, theme: 'blue' }
        ].map((node, idx) => (
            <div key={idx} className="border-2 border-black rounded-[2rem] p-6 pt-8 relative min-h-[160px] flex flex-col justify-center bg-white shadow-sm text-center">
                <div className={cn(
                    "absolute -top-4 left-1/2 -translate-x-1/2 text-white px-8 py-2 rounded-full text-[8.5pt] font-black uppercase tracking-widest shadow-xl whitespace-nowrap",
                    node.theme === 'blue' ? 'bg-blue-900' : 'bg-black'
                )}>{node.title}</div>
                <div className="space-y-2 mt-2">
                    <p className="text-[11pt] font-black uppercase text-slate-900 leading-tight">{node.name}</p>
                    <p className="text-[8.5pt] font-bold text-slate-500 leading-snug italic uppercase line-clamp-2">{node.addr}</p>
                    <p className="font-black text-slate-900 text-[9pt] pt-2">GSTIN: <span className="font-mono uppercase">{node.gstin || '--'}</span></p>
                </div>
            </div>
        ))}
      </div>

      {/* ITEMS TABLE */}
      <div className="border-[3px] border-black rounded-[2.5rem] overflow-hidden mb-10 flex flex-col shadow-xl shrink-0 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-[#0a0c10] text-white text-[9.5pt] font-black uppercase tracking-[0.1em]">
            <tr className="h-16">
              <th className="border-r border-white/10 px-6 text-center w-56 leading-tight">INVOICE<br/>REGISTRY</th>
              <th className="border-r border-white/10 px-6 text-center w-56 leading-tight">E-WAYBILL<br/>NODE</th>
              <th className="border-r border-white/10 px-8 text-center leading-tight">DESCRIPTION<br/>OF GOODS</th>
              <th className="border-r border-white/10 px-4 text-center w-28 leading-tight">NO.<br/>OF PKGS</th>
              <th className="px-8 text-center w-40 leading-tight">WEIGHT<br/>(MT)</th>
            </tr>
          </thead>
          <tbody className="text-[11pt]">
            {displayItems.map((item, idx) => (
              <tr key={idx} className="align-middle border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                <td className="border-r border-slate-200 px-4 font-black uppercase align-middle">
                  {renderPairedValues(item.invoiceNumber)}
                </td>
                <td className="border-r border-slate-200 px-4 font-black uppercase align-middle">
                  {renderPairedValues(item.ewaybillNumber)}
                </td>
                <td className="border-r border-slate-200 px-8 py-8 uppercase italic font-black text-slate-700 leading-snug tracking-tighter text-center">
                    {item.itemDescription}
                </td>
                <td className="border-r border-slate-200 px-4 text-center font-black text-[14pt] text-slate-900">{item.units}</td>
                <td className="px-8 text-center font-black text-[14pt] text-blue-900 tracking-tighter">
                    {Number(item.weight).toFixed(3)}
                </td>
              </tr>
            ))}
            {/* Pad table rows to maintain height consistency */}
            {displayItems.length < 2 && Array.from({length: 2 - displayItems.length}).map((_, i) => (
                <tr key={`pad-${i}`} className="h-24 border-b border-slate-100 last:border-0"><td colSpan={5}></td></tr>
            ))}
          </tbody>
          <tfoot className="bg-[#1a1d24] font-black h-20 border-t-2 border-black text-[13pt] text-white">
            <tr>
              <td colSpan={3} className="px-10 uppercase border-r border-white/10 tracking-[0.4em]">MANIFEST TOTALS:</td>
              <td className="border-r border-white/10 text-center font-black">{totalUnitsFinal}</td>
              <td className="text-center px-8 font-black text-[#10b981] tracking-tighter text-[15pt]">{totalWeightFinal.toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* TERMS & SIGNATURE */}
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
            ]).slice(0, 6).map((term, i) => (
                <p key={i} className="text-[8.5pt] font-bold text-slate-500 leading-snug uppercase">{i + 1}. {term}</p>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-end text-center pt-10">
          <div className="w-full border-t-2 border-black border-dashed mb-6 opacity-30" />
          <span className="text-[13pt] font-black uppercase tracking-[0.5em] text-slate-900 italic">AUTHORIZED SIGNATORY</span>
          <span className="text-[9pt] font-bold text-slate-400 uppercase mt-2 tracking-widest">LMC REGISTRY VERIFIED IDENTITY NODE</span>
        </div>
      </div>

      {/* PERMANENT FOOTER STRIP */}
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
