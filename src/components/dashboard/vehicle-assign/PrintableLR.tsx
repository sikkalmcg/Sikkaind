'use client';

import React, { useMemo } from 'react';
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

const REGISTRY_TERMS = [
    "Goods carried at Owner’s Risk as per Carriers Act 2007 unless insured.",
    "Consignor responsible for proper packing, correct declaration & documents (including GST/E-way bill as per Goods and Services Tax (GST) Act). Carrier not liable for issues arising from the same.",
    "Freight & all charges payable as agreed. Carrier has full lien rights on goods until payment.",
    "Claims must be reported within 24 hours with proof; otherwise not accepted. Liability limited to invoice value or as per law.",
    "Transit insurance is consignor’s responsibility unless arranged in writing by carrier.",
    "All disputes subject to Ghaziabad jurisdiction only."
];

export default function PrintableLR({ lr, copyType, pageNumber, totalInSeries }: PrintableLRProps) {
  const formatDate = (date: any, pattern: string = 'dd MMM yyyy') => {
    const d = parseSafeDate(date);
    return d && isValid(d) ? format(d, pattern).toUpperCase() : '--';
  };

  const buyerAddress = lr.buyerAddress || lr.deliveryAddress || lr.to;
  const shipToAddress = lr.deliveryAddress || buyerAddress || lr.to;

  const totalWeightFinal = useMemo(() => {
    const parseWeight = (val: any) => {
        if (val === undefined || val === null || val === '') return 0;
        const num = parseFloat(String(val));
        return isNaN(num) ? 0 : num;
    };

    // 1. Check LR Document Node
    let weight = 
      parseWeight(lr.assignedTripWeight) || 
      parseWeight(lr.totalWeight) || 
      parseWeight((lr as any).quantity);
    if (weight > 0) return weight;

    // 2. Fallback to Trip Registry Node
    const tripNode = lr.trip || {};
    weight = 
      parseWeight(tripNode.assignedQtyInTrip) ||
      parseWeight(tripNode.assignedTripWeight) ||
      parseWeight((tripNode as any).dispatchedQty) ||
      parseWeight((tripNode as any).quantity) ||
      parseWeight((tripNode as any).weight);
    if (weight > 0) return weight;

    // 3. Fallback to Shipment/Order Node
    const shipNode = lr.shipment || {};
    weight = 
      parseWeight(shipNode.quantity) ||
      parseWeight(shipNode.assignedQty) ||
      parseWeight((shipNode as any).totalWeight) ||
      parseWeight((shipNode as any).weight);
    if (weight > 0) return weight;

    // 4. Fallback to aggregate of items manifest
    const weightFromItems = (lr.items || []).reduce((sum, item) => {
      const itemWeight = parseWeight(item.weight) || parseWeight(item.quantity);
      return sum + (item.weightUnit === 'KG' ? itemWeight / 1000 : itemWeight);
    }, 0);
    
    return weightFromItems;
  }, [lr]);

  const totalUnitsFinal = useMemo(() => {
    const unitsFromItems = (lr.items || []).reduce((sum, item) => sum + (Number(item.units) || 0), 0);
    return unitsFromItems > 0 ? unitsFromItems : (Number(lr.totalUnits) || 0);
  }, [lr.items, lr.totalUnits]);

  const displayItems = useMemo(() => {
    const items = lr.items || [];
    const units = totalUnitsFinal > 0 ? totalUnitsFinal : '--';
    const singleItem = items.length > 0 ? items[0] : {};
    const description = items.length > 1 ? 'VARIOUS ITEMS AS PER INVOICE' : (singleItem.itemDescription || singleItem.description || 'GENERAL CARGO').toUpperCase();
    const invoiceNumbers = Array.from(new Set((items || []).map(i => i.invoiceNumber || i.invoiceNo).filter(Boolean))).join(', ') || lr.invoiceNumber || '--';
    const ewaybillNumbers = Array.from(new Set((items || []).map(i => i.ewaybillNumber || i.ewaybillNo).filter(Boolean))).join(', ') || lr.ewaybillNumber || '--';

    return [{
      invoiceNumber: invoiceNumbers,
      ewaybillNumber: ewaybillNumbers,
      itemDescription: description,
      units: units,
      weight: totalWeightFinal,
    }];
  }, [lr, totalUnitsFinal, totalWeightFinal]);

  const renderPairedValues = (valueString: string) => {
    const items = (valueString || '').split(',').map(p => p.trim()).filter(Boolean).filter(v => v !== '--');
    if (items.length === 0) return <span className="text-slate-200">--</span>;
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
        const pair = items.slice(i, i + 2).join(', ');
        rows.push(<div key={i} className="text-[9pt] font-normal text-slate-900 leading-tight mb-0.5 last:mb-0 uppercase text-center">{pair}</div>);
    }
    return <div className="flex flex-col py-1 items-center justify-center h-full">{rows}</div>;
  };

  const vehicleNumber = lr.vehicleNumber || lr.trip?.vehicleNumber || '--';
  const driverMobile = lr.driverMobile || lr.trip?.driverMobile || '--';
  const paymentTerm = lr.paymentTerm || lr.trip?.paymentTerm || 'PAID';
  const tripIdDisplay = lr.tripId || lr.trip?.tripId || '--';

  const carrier = lr.carrier || {};

  return (
    <div className="A4-page p-[6mm] bg-white text-black font-sans text-[8.5pt] leading-tight flex flex-col relative box-border h-[297mm] w-[210mm] overflow-hidden select-text border-none mx-auto">
      <div className="flex justify-end mb-1 shrink-0">
        <div className="border-2 border-black px-4 py-0.5 bg-slate-50 shadow-sm">
            <span className="text-[8pt] font-black uppercase tracking-widest text-slate-900 leading-none">{copyType}</span>
        </div>
      </div>

      <div className="flex justify-between items-start mb-5 shrink-0 border-b-4 border-black pb-4">
        <div className="flex gap-4 flex-1 pr-4">
          <div className="h-16 w-18 bg-white border border-black rounded-lg flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-sm">
            <img src="https://image2url.com/r2/default/images/1774853131451-83a2a90c-6707-43fc-9b92-c364ad369d96.jpeg" alt="Registry Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="space-y-0.5 text-left">
            <h1 className="text-[16pt] font-black uppercase tracking-tight leading-none text-slate-900">{carrier.name || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
            <p className="text-[7.5pt] font-bold text-slate-600 uppercase max-w-[500px] leading-tight">{carrier.address || 'GHAZIABAD, UTTAR PRADESH'}</p>
            
            <div className="text-[8pt] font-black text-slate-400 flex flex-wrap gap-x-5 gap-y-2 pt-2 uppercase leading-none">
              <p className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold uppercase text-[7.5pt]">GSTIN:</span> 
                <span className="font-mono text-slate-950 text-[13pt] tracking-tighter">{carrier.gstin || '--'}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold uppercase text-[7.5pt]">PAN:</span> 
                <span className="font-mono text-slate-950 text-[10pt] tracking-tighter">{carrier.pan || '--'}</span>
              </p>
            </div>

            <div className="text-[7pt] font-black text-slate-400 flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5 uppercase leading-none">
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">PHONE:</span> <span className="text-slate-900 font-mono font-black">{carrier.mobile || carrier.phone || '--'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">EMAIL:</span> <span className="text-blue-700 lowercase font-black">{carrier.email || '--'}</span></p>
              <p className="flex items-center gap-1.5"><span className="text-slate-400 font-bold uppercase text-[6.5pt]">WEB:</span> <span className="text-blue-700 lowercase font-black">{carrier.website || '--'}</span></p>
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

      <div className="grid grid-cols-4 border-2 border-black rounded-xl overflow-hidden mb-5 bg-white divide-x-2 divide-black divide-y-2 shadow-sm shrink-0">
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

      <div className="grid grid-cols-3 gap-6 mb-6 shrink-0">
        {[
            { title: 'CONSIGNOR (SENDER)', name: lr.consignorName, addr: lr.consignorAddress || lr.from, gstin: lr.consignorGtin, mobile: (lr as any).consignorMobile },
            { title: 'CONSIGNEE (RECEIVER)', name: lr.buyerName || lr.shipToParty, addr: buyerAddress, gstin: lr.buyerGtin, mobile: (lr as any).buyerMobile },
            { title: 'SHIP TO PARTY', name: lr.shipToParty || lr.buyerName, addr: shipToAddress, gstin: lr.shipToGtin, mobile: (lr as any).shipToMobile }
        ].map((node, idx) => (
            <div key={idx} className="border-2 border-black rounded-[1.25rem] p-4 pt-5 relative min-h-[125px] flex flex-col justify-center bg-white shadow-md text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-5 py-1 rounded-full text-[6.5pt] font-black uppercase tracking-widest shadow-xl whitespace-nowrap">{node.title}</div>
                <div className="space-y-1 mt-1 flex-1 flex flex-col justify-center">
                    <p className="text-[9pt] font-black uppercase text-slate-900 leading-tight line-clamp-2">{node.name}</p>
                    <p className="text-[7.5pt] font-bold text-slate-500 leading-snug italic uppercase line-clamp-3">{node.addr}</p>
                    <div className="pt-1.5 border-t border-slate-100 mt-auto space-y-1">
                        {node.mobile && (
                           <p className="font-black text-slate-900 text-[7.5pt]">MOB: <span className="font-mono uppercase">{node.mobile}</span></p>
                        )}
                        <p className="font-black text-slate-950 text-[11pt] tracking-tighter leading-none">GSTIN: <span className="font-mono uppercase text-[11pt]">{node.gstin || 'N/A'}</span></p>
                    </div>
                </div>
            </div>
        ))}
      </div>

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
                    <td className="border-r-2 border-slate-100 px-1 py-1 font-normal uppercase align-middle">{renderPairedValues(item.invoiceNumber)}</td>
                    <td className="border-r-2 border-slate-100 px-1 py-1 font-normal uppercase align-middle text-blue-800">{renderPairedValues(item.ewaybillNumber)}</td>
                    <td className="border-r-2 border-slate-100 px-4 py-1 uppercase italic font-black text-slate-700 leading-tight tracking-tighter text-center">{item.itemDescription}</td>
                    <td className="border-r-2 border-slate-100 px-1 text-center font-black text-[12pt] text-slate-900">{item.units}</td>
                    <td className="px-4 text-center font-black text-[12pt] text-slate-900 tracking-tighter">{item.weight > 0 ? item.weight.toFixed(3) : '--'}</td>
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

      <div className="grid grid-cols-2 gap-12 mb-2 shrink-0 px-4 mt-auto border-t-2 border-slate-100 pt-6">
        <div className="space-y-3">
            <span className="text-[8.5pt] font-bold uppercase text-slate-900 border-b border-black inline-block pb-0.5 tracking-widest italic">TERMS & CONDITIONS</span>
            <div className="space-y-1 pt-0.5">
                {REGISTRY_TERMS.map((term, i) => (
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

      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col items-center gap-1.5 shrink-0">
          <p className="text-[7.5pt] font-black text-slate-400 uppercase tracking-tighter text-center max-w-[600px]">
              Note: This Lorry Receipt was generated digitally and is to be considered as original.
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