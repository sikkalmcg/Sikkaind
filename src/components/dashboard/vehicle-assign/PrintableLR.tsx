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
 * - Rounded-header high-contrast items table (Narrow Rows)
 * - Terms & Signatory pushed to footer area
 */
export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    const d = parseSafeDate(date);
    return d && isValid(d) ? format(d, pattern).toUpperCase() : '--';
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
  let displayItems: any[] = [];

  // MISSION RULE: If more than 3 distinct items or high complexity -> Consolidate
  if (uniqueDescArray.length > 3) {
    const totalUnits = allItems.reduce((sum, i) => sum + (Number(i.units) || 0), 0);
    const totalWeight = Number(lr.assignedTripWeight) || allItems.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
    
    const allInvoices = new Set<string>();
    const allEwaybills = new Set<string>();
    allItems.forEach(i => {
        if (i.invoiceNumber) i.invoiceNumber.split(',').forEach((inv: string) => {
            const t = inv.trim();
            if(t && t !== '--') allInvoices.add(t);
        });
        if (i.ewaybillNumber) i.ewaybillNumber.split(',').forEach((ewb: string) => {
            const t = ewb.trim();
            if(t && t !== '--') allEwaybills.add(t);
        });
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
        rows.push(<div key={i} className="text-[7.5pt] font-black text-slate-900 leading-tight mb-0.5 last:mb-0 uppercase text-center">{pair}</div>);
    }
    return <div className="flex flex-col py-1 items-center justify-center h-full">{rows}</div>;
  };

  const vehicleNumber = lr.vehicleNumber || lr.trip?.vehicleNumber || '--';
  const driverMobile = lr.driverMobile || lr.trip?.driverMobile || '--';
  const vehicleType = lr.trip?.vehicleType || 'MT';
  const paymentTerm = lr.paymentTerm || lr.trip?.paymentTerm || 'PAID';
  const dispatchDateRaw = lr.trip?.startDate || lr.date;
  const dispatchTime = dispatchDateRaw ? format(parseSafeDate(dispatchDateRaw)!, 'HH:mm') : '11:35';

  return (
    <div id="printable-area" className="A4-page p-[12mm] bg-white text-black font-sans text-[8.5pt] leading-tight flex flex-col relative box-border h-[297mm] overflow-hidden select-text print:m-0">
      
      {/* COPY INDICATOR */}
      <div className="text-center mb-3 border-b border-black pb-1 shrink-0">
        <span className="text-[10pt] font-black uppercase tracking-[0.6em] text-slate-900">{copyType}</span>
      </div>

      {/* HEADER: CARRIER & CN INFO */}
      <div className="flex justify-between items-start mb-4 pt-1 shrink-0">
        <div className="flex gap-4 flex-1 pr-6">
          <div className="h-16 w-20 bg-white border-2 border-black rounded-xl flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-sm">
            <img 
                src="https://image2url.com/r2/default/images/1774853131451-83a2a90c-6707-43fc-9b92-c364ad369d96.jpeg" 
                alt="Logo" 
                className="max-h-full max-w-full object-contain" 
            />
          </div>
          <div className="space-y-0">
            <h1 className="text-[18pt] font-black uppercase tracking-tighter leading-none">{lr.carrier?.name || 'SIKKA LMC'}</h1>
            <p className="text-[7.5pt] font-bold text-slate-600 uppercase max-w-[380px] leading-tight mt-1">
                {lr.carrier?.address || 'B-11, BULANDSHAHR ROAD INDLAREA, GHAZIABAD, UTTAR PRADESH, 201009'}
            </p>
            <div className="text-[7.5pt] font-black text-slate-500 flex flex-wrap gap-x-4 pt-1 uppercase">
              <p>PHONE: <span className="text-slate-900 font-mono">9136688004</span></p>
              <p>GSTIN: <span className="font-mono text-slate-900">09AYQPS6936B1ZV</span></p>
              <p>PAN: <span className="font-mono text-slate-900">AYQPS6936B</span></p>
            </div>
          </div>
        </div>

        <div className="min-w-[240px] space-y-2">
          <div className="border-[2px] border-black p-2 bg-white text-center rounded-lg shadow-sm flex items-center justify-between gap-3">
            <span className="text-[8pt] font-black text-slate-400 uppercase">CN NO |</span>
            <span className="text-[14pt] font-black font-mono text-slate-900 tracking-tight">{lr.lrNumber}</span>
          </div>
          <div className="text-[8.5pt] font-black uppercase space-y-1 px-1">
            <p className="flex justify-between gap-4"><span>DATE:</span> <span className="text-slate-900">{formatDate(lr.date)}</span></p>
            <p className="flex justify-between gap-4"><span>FROM:</span> <span className="text-slate-900">{lr.from?.split(',')[0].toUpperCase() || 'GHAZIABAD'}</span></p>
            <p className="flex justify-between gap-4"><span>TO:</span> <span className="text-slate-900">{lr.to?.split(',')[0].toUpperCase() || 'HAPUR'}</span></p>
          </div>
        </div>
      </div>

      {/* TRIP METRICS GRID */}
      <div className="grid grid-cols-5 border-2 border-black rounded-lg overflow-hidden mb-4 bg-white divide-x-2 divide-black shadow-sm shrink-0">
        {[
          { label: 'VEHICLE REGISTRY', value: vehicleNumber, bold: true },
          { label: 'PILOT CONTACT', value: driverMobile, mono: true },
          { label: 'FLEET CATEGORY', value: vehicleType },
          { label: 'PAYMENT TERM', value: paymentTerm },
          { label: 'DISPATCH NODE', value: dispatchTime, mono: true }
        ].map((node, i) => (
          <div key={i} className="py-2 px-1 text-center flex flex-col justify-center gap-0.5">
            <span className="text-[6.5pt] font-black uppercase text-slate-400 block leading-tight tracking-[0.1em]">{node.label}</span>
            <p className={cn(
                "text-[8.5pt] uppercase leading-none", 
                node.bold ? "font-black text-slate-900" : "font-bold text-slate-600", 
                node.mono && "font-mono tracking-tighter"
            )}>
                {node.value || '--'}
            </p>
          </div>
        ))}
      </div>

      {/* PARTY REGISTRY NODES */}
      <div className="grid grid-cols-3 gap-4 mb-6 shrink-0">
        {[
            { title: 'CONSIGNOR (SENDER)', name: lr.consignorName, addr: lr.consignorAddress || lr.from, gstin: lr.consignorGtin },
            { title: 'CONSIGNEE (RECEIVER)', name: lr.buyerName || lr.shipToParty, addr: buyerAddress, gstin: lr.buyerGtin },
            { title: 'SHIP TO PARTY', name: lr.shipToParty || lr.buyerName, addr: shipToAddress, gstin: lr.shipToGtin }
        ].map((node, idx) => (
            <div key={idx} className="border-2 border-black rounded-[1.5rem] p-4 pt-6 relative min-h-[120px] flex flex-col justify-center bg-white shadow-sm text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-5 py-1 rounded-full text-[7pt] font-black uppercase tracking-widest shadow-md whitespace-nowrap">
                    {node.title}
                </div>
                <div className="space-y-1 mt-1">
                    <p className="text-[9pt] font-black uppercase text-slate-900 leading-tight line-clamp-2">{node.name}</p>
                    <p className="text-[7.5pt] font-bold text-slate-500 leading-snug italic uppercase line-clamp-2">{node.addr}</p>
                    <p className="font-black text-slate-900 text-[8pt] pt-0.5">GSTIN: <span className="font-mono uppercase">{node.gstin || '--'}</span></p>
                </div>
            </div>
        ))}
      </div>

      {/* ITEMS TABLE - grow to fill space */}
      <div className="flex-1 flex flex-col mb-6">
        <div className="border-[2px] border-black rounded-[1.5rem] overflow-hidden flex flex-col shadow-md bg-white">
            <table className="w-full border-collapse">
            <thead className="bg-[#0a0c10] text-white text-[8pt] font-black uppercase tracking-[0.1em]">
                <tr className="h-12">
                <th className="border-r border-white/10 px-3 text-center w-40 leading-tight">INVOICE<br/>REGISTRY</th>
                <th className="border-r border-white/10 px-3 text-center w-40 leading-tight">E-WAYBILL<br/>NODE</th>
                <th className="border-r border-white/10 px-5 text-center leading-tight">DESCRIPTION<br/>OF GOODS</th>
                <th className="border-r border-white/10 px-2 text-center w-20 leading-tight">NO.<br/>OF PKGS</th>
                <th className="px-5 text-center w-32 leading-tight">WEIGHT<br/>(MT)</th>
                </tr>
            </thead>
            <tbody className="text-[9pt]">
                {displayItems.map((item, idx) => (
                <tr key={idx} className="align-middle border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                    <td className="border-r border-slate-200 px-2 py-1 font-black uppercase align-middle">
                    {renderPairedValues(item.invoiceNumber)}
                    </td>
                    <td className="border-r border-slate-200 px-2 py-1 font-black uppercase align-middle">
                    {renderPairedValues(item.ewaybillNumber)}
                    </td>
                    <td className="border-r border-slate-200 px-5 py-2 uppercase italic font-black text-slate-700 leading-snug tracking-tighter text-center">
                        {item.itemDescription}
                    </td>
                    <td className="border-r border-slate-200 px-2 text-center font-black text-[12pt] text-slate-900">{item.units}</td>
                    <td className="px-5 text-center font-black text-[12pt] text-slate-900 tracking-tighter">
                        {Number(item.weight).toFixed(3)}
                    </td>
                </tr>
                ))}
            </tbody>
            <tfoot className="bg-[#1a1d24] font-black h-12 border-t-2 border-black text-[10pt] text-white">
                <tr>
                <td colSpan={3} className="px-6 uppercase border-r border-white/10 tracking-[0.8em]">MANIFEST TOTALS:</td>
                <td className="border-r border-white/10 text-center font-black">{totalUnitsFinal}</td>
                <td className="text-center px-5 font-black text-slate-400 tracking-tighter text-[12pt]">
                    {totalWeightFinal.toFixed(3)}
                </td>
                </tr>
            </tfoot>
            </table>
        </div>
      </div>

      {/* TERMS & SIGNATURE - Pushed to bottom */}
      <div className="grid grid-cols-2 gap-12 mb-6 shrink-0 px-4">
        <div className="space-y-3">
          <span className="text-[8.5pt] font-black uppercase text-slate-900 border-b border-black inline-block pb-0.5 tracking-[0.1em]">TERMS & CONDITIONS</span>
          <div className="space-y-1 pt-0.5">
            {(lr.carrier?.terms?.length > 0 ? lr.carrier.terms : [
                "Agency is not responsible for rain or any natural calamity.",
                "Discrepancies must be intimated within 24 Hours of receipt node.",
                "Vehicle owner is responsible for goods after yard departure.",
                "Agency has the right to hold material upon mission shortage.",
                "Sikka Logistics holds no responsibility after final drop node.",
                "All disputes subject to Ghaziabad Jurisdiction."
            ]).slice(0, 6).map((term, i) => (
                <p key={i} className="text-[7.5pt] font-bold text-slate-500 leading-tight uppercase">{i + 1}. {term}</p>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-end text-center pt-6">
          <div className="w-full border-t border-black border-dashed mb-3 opacity-20" />
          <span className="text-[11pt] font-black uppercase tracking-[0.4em] text-slate-900 italic">AUTHORIZED SIGNATORY</span>
          <span className="text-[7.5pt] font-bold text-slate-400 uppercase mt-1 tracking-widest">LMC REGISTRY VERIFIED IDENTITY NODE</span>
        </div>
      </div>

      {/* PERMANENT FOOTER STRIP */}
      <div className="pt-3 border-t border-black flex flex-col items-center gap-2 shrink-0">
        <p className="text-[7pt] font-black uppercase text-slate-400 tracking-[0.1em] text-center max-w-[90%] leading-tight">
            NOTICE: THIS IS A COMPUTER GENERATED MANIFEST AUTHORIZED BY SIKKA INDUSTRIES. <br/>
            AUTHENTICITY CAN BE VERIFIED VIA MISSION REGISTRY HUB USING CN NO.
        </p>
        <div className="flex items-center gap-8">
            <span className="text-[9pt] font-black uppercase tracking-[0.5em] text-slate-900">PAGE {pageNumber} OF {totalInSeries}</span>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-[8pt] font-black text-blue-900/30 tracking-widest uppercase italic">SIKKA LMC ENTERPRISE v2.5</span>
        </div>
      </div>
    </div>
  );
}
