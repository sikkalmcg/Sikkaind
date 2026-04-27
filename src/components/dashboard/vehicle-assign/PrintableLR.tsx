'use client';

import React, { useMemo } from 'react';
import { format, isValid } from 'date-fns';
import { cn, parseSafeDate } from '@/lib/utils';
import type { LR, Trip, Shipment, Carrier, Plant } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { ShieldCheck, Mail, Globe, Phone } from 'lucide-react';

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
 * @fileOverview SIKKA LMC - Printable Lorry Receipt Node.
 * Optimized Header: Carrier info moved higher, left-aligned, with Email and Website pulse.
 * Hardened: Plant-specific identity resolution.
 */
export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    const d = parseSafeDate(date);
    return d && isValid(d) ? format(d, pattern).toUpperCase() : '--';
  };

  const buyerAddress = lr.buyerAddress || lr.deliveryAddress || lr.to;
  const shipToAddress = lr.deliveryAddress || buyerAddress || lr.to;

  const allItems = lr.items || [];
  
  const displayItems = useMemo(() => {
    const invGroups = allItems.reduce((acc, item) => {
        const inv = (item.invoiceNumber || 'NA').trim();
        if (!acc[inv]) acc[inv] = [];
        acc[inv].push(item);
        return acc;
    }, {} as Record<string, any[]>);

    let rows: any[] = [];

    Object.entries(invGroups).forEach(([inv, invItems]) => {
        const uniqueDescs = Array.from(new Set(invItems.map(i => (i.itemDescription || i.description || 'GENERAL CARGO').toUpperCase().trim())));
        
        if (invItems.length > 2) {
            const totalUnits = invItems.reduce((s, i) => s + (Number(i.units) || 0), 0);
            const ewaybills = Array.from(new Set(invItems.map(i => i.ewaybillNumber).filter(Boolean))).join(', ');
            
            rows.push({
                invoiceNumber: inv === 'NA' ? '--' : inv,
                ewaybillNumber: ewaybills || '--',
                itemDescription: uniqueDescs.length === 1 ? uniqueDescs[0] : `VARIOUS ITEMS AS PER INVOICE`,
                units: totalUnits,
                weight: 0 
            });
        } else {
            invItems.forEach(i => {
                rows.push({
                    invoiceNumber: inv === 'NA' ? '--' : inv,
                    ewaybillNumber: i.ewaybillNumber || '--',
                    itemDescription: (i.itemDescription || i.description || 'GENERAL CARGO').toUpperCase(),
                    units: Number(i.units) || 0,
                    weight: 0
                });
            });
        }
    });

    if (rows.length === 0) {
        rows.push({ invoiceNumber: '--', ewaybillNumber: '--', itemDescription: 'GENERAL CARGO', units: 0, weight: 0 });
    }

    return rows;
  }, [allItems]);

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
  const tripIdDisplay = lr.tripId || lr.trip?.tripId || '--';

  const carrier = lr.carrier || {};
  const registryTerms = (carrier.terms && Array.isArray(carrier.terms) && carrier.terms.length > 0) 
    ? carrier.terms 
    : [
        "AGENCY NOT RESPONSIBLE FOR RAIN OR CALAMITY.",
        "DISCREPANCIES MUST BE INTIMATED WITHIN 24 HOURS.",
        "VEHICLE OWNER RESPONSIBLE AFTER YARD DEPARTURE.",
        "ALL DISPUTES SUBJECT TO GHAZIABAD JURISDICTION."
      ];

  return (
    <div className="A4-page p-[6mm] bg-white text-black font-sans text-[8.5pt] leading-tight flex flex-col relative box-border h-[297mm] w-[210mm] overflow-hidden select-text border-none mx-auto">
      
      {/* 1. TOP MANIFEST INDICATOR */}
      <div className="flex justify-end mb-1 shrink-0">
        <div className="border-2 border-black px-4 py-0.5 bg-slate-50 shadow-sm">
            <span className="text-[8pt] font-black uppercase tracking-widest text-slate-900 leading-none">{copyType}</span>
        </div>
      </div>

      {/* 2. CARRIER HEADER NODE: Higher & Left Aligned */}
      <div className="flex justify-between items-start mb-5 shrink-0 border-b-4 border-black pb-4">
        <div className="flex gap-4 flex-1 pr-4">
          <div className="h-16 w-18 bg-white border border-black rounded-lg flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-sm">
            <img src="https://image2url.com/r2/default/images/1774853131451-83a2a90c-6707-43fc-9b92-c364ad369d96.jpeg" alt="Registry Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-[16pt] font-black uppercase tracking-tight leading-none text-slate-900">{carrier.name || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
            <p className="text-[7.5pt] font-bold text-slate-600 uppercase max-w-[500px] leading-tight">{carrier.address || 'GHAZIABAD, UTTAR PRADESH'}</p>
            
            <div className="text-[7pt] font-black text-slate-400 flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5 uppercase leading-none">
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">PHONE:</span> <span className="text-slate-900 font-mono">{carrier.mobile || '9136688004'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">EMAIL:</span> <span className="text-blue-700 lowercase font-bold">{carrier.email || 'sil@sikkaenterprises.com'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">WEB:</span> <span className="text-blue-700 lowercase font-bold">{carrier.website || 'www.sikkaind.com'}</span></p>
            </div>
            
            <div className="text-[7pt] font-black text-slate-400 flex flex-wrap gap-x-4 gap-y-1.5 pt-1 uppercase leading-none">
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">GSTIN:</span> <span className="font-mono text-slate-900">{carrier.gstin || '--'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">PAN:</span> <span className="font-mono text-slate-900">{carrier.pan || '--'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">STATE:</span> <span className="text-slate-900">{carrier.stateName || '--'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">CODE:</span> <span className="text-slate-900">{carrier.stateCode || '--'}</span></p>
            </div>
          </div>
        </div>

        <div className="min-w-[220px] space-y-2">
          <div className="border-2 border-black p-1.5 bg-white text-center rounded-xl shadow-sm flex items-center justify-between px-3">
            <span className="text-[7pt] font-black text-slate-400 uppercase tracking-widest">CN NO |</span>
            <span className="text-[13pt] font-black font-mono text-slate-900 tracking-tight">{lr.lrNumber}</span>
          </div>
          <div className="text-[8.5pt] font-black uppercase space-y-1 px-2">
            <p className="flex justify-between gap-6"><span>DATE:</span> <span className="text-slate-900">{formatDate(lr.date)}</span></p>
            <p className="flex justify-between gap-6"><span>FROM:</span> <span className="text-slate-900">{lr.from || '--'}</span></p>
            <p className="flex justify-between gap-6"><span>TO:</span> <span className="text-slate-900">{lr.to || '--'}</span></p>
          </div>
        </div>
      </div>

      {/* 3. TRIP PARTICULARS GRID */}
      <div className="grid grid-cols-4 border-2 border-black rounded-xl overflow-hidden mb-5 bg-white divide-x-2 divide-black shadow-sm shrink-0">
        {[
          { label: 'TRIP ID NODE', value: tripIdDisplay, mono: true, bold: true, color: 'text-blue-900' },
          { label: 'VEHICLE REGISTRY', value: vehicleNumber, bold: true },
          { label: 'PILOT CONTACT', value: driverMobile, mono: true },
          { label: 'PAYMENT TERM', value: paymentTerm, bold: true },
        ].map((node, i) => (
          <div className="py-2.5 px-1 text-center flex flex-col justify-center gap-0.5" key={i}>
            <span className="text-[6.5pt] font-black uppercase text-slate-400 block leading-tight tracking-[0.1em]">{node.label}</span>
            <p className={cn("text-[9pt] uppercase leading-none", node.bold ? "font-black text-slate-900" : "font-black text-slate-700", node.mono && "font-mono tracking-tighter text-blue-700", node.color)}>{node.value || '--'}</p>
          </div>
        ))}
      </div>

      {/* 4. ENTITY HANDSHAKE GRID */}
      <div className="grid grid-cols-3 gap-6 mb-6 shrink-0">
        {[
            { title: 'CONSIGNOR (SENDER)', name: lr.consignorName, addr: lr.consignorAddress || lr.from, gstin: lr.consignorGtin },
            { title: 'CONSIGNEE (RECEIVER)', name: lr.buyerName || lr.shipToParty, addr: buyerAddress, gstin: lr.buyerGtin },
            { title: 'SHIP TO PARTY', name: lr.shipToParty || lr.buyerName, addr: shipToAddress, gstin: lr.shipToGtin }
        ].map((node, idx) => (
            <div key={idx} className="border-2 border-black rounded-[1.25rem] p-4 pt-5 relative min-h-[125px] flex flex-col justify-center bg-white shadow-md text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-5 py-1 rounded-full text-[6.5pt] font-black uppercase tracking-widest shadow-xl whitespace-nowrap">{node.title}</div>
                <div className="space-y-1 mt-1">
                    <p className="text-[9pt] font-black uppercase text-slate-900 leading-tight line-clamp-2">{node.name}</p>
                    <p className="text-[7.5pt] font-bold text-slate-500 leading-snug italic uppercase line-clamp-2">{node.addr}</p>
                    <p className="font-black text-slate-900 text-[7pt] pt-1.5 border-t border-slate-100 mt-1">GSTIN: <span className="font-mono uppercase">{node.gstin || 'N/A'}</span></p>
                </div>
            </div>
        ))}
      </div>

      {/* 5. MANIFEST TABLE */}
      <div className="flex-1 flex flex-col mb-6 min-h-0">
        <div className="border-2 border-black rounded-[1.25rem] overflow-hidden flex flex-col shadow-lg bg-white">
            <table className="w-full border-collapse table-fixed">
            <thead className="bg-white text-black border-b-2 border-black text-[8pt] font-black uppercase tracking-[0.1em]">
                <tr className="h-11">
                <th className="border-r-2 border-black/10 px-2 text-center w-28 leading-tight">Invoice No.</th>
                <th className="border-r-2 border-black/10 px-2 text-center w-32 leading-tight">E-Waybill No.</th>
                <th className="border-r-2 border-black/10 px-4 text-center leading-tight">DESCRIPTION OF GOODS</th>
                <th className="border-r-2 border-black/10 px-1 text-center w-20 leading-tight">NO. OF PKGS</th>
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
            <tfoot className="bg-slate-50 font-black h-11 border-t-2 border-black text-[9.5pt] text-black">
                <tr>
                <td colSpan={3} className="px-8 uppercase border-r-2 border-black/10 tracking-[0.8em]">MANIFEST TOTALS:</td>
                <td className="border-r-2 border-black/10 text-center font-black">{totalUnitsFinal}</td>
                <td className="text-center px-4 font-black text-slate-900 tracking-tighter text-[13pt]">{totalWeightFinal.toFixed(3)} MT</td>
                </tr>
            </tfoot>
            </table>
        </div>
      </div>

      {/* 6. TERMS & SIGNATURES */}
      <div className="grid grid-cols-2 gap-12 mb-2 shrink-0 px-4 mt-auto border-t-2 border-slate-100 pt-6">
        <div className="space-y-3">
            <span className="text-[8.5pt] font-bold uppercase text-slate-900 border-b border-black inline-block pb-0.5 tracking-widest italic">TERMS & CONDITIONS</span>
            <div className="space-y-1 pt-0.5">
                {registryTerms.map((term: string, i: number) => (
                    <p key={i} className="text-[7pt] font-normal text-slate-600 leading-tight uppercase tracking-tight">
                        {i + 1}. {term}
                    </p>
                ))}
            </div>
        </div>
        <div className="flex flex-col justify-end text-center">
            <div className="w-full border-t-2 border-black border-dashed mb-2 opacity-40" />
            <span className="text-[12pt] font-black uppercase tracking-[0.4em] text-slate-900 italic leading-none">AUTHORIZED SIGNATURE</span>
        </div>
      </div>

      {/* 7. FOOTER CONTROL NODE */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col items-center gap-1.5 shrink-0">
          <p className="text-[7.5pt] font-black text-slate-400 uppercase tracking-tighter text-center max-w-[600px]">
              Note: This Lorry Receipt was generated digitally and is to be considered as original mission document.
          </p>
          <div className="flex flex-col items-center gap-0.5">
              <span className="text-[8.5pt] font-black text-slate-900 tracking-widest">
                  PAGE {pageNumber} OF {totalInSeries}
              </span>
          </div>
      </div>
    </div>
  );
}