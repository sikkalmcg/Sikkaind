'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useMongoStore, useDoc, useMemoMongo } from '@/mongodb';
import { doc } from '@/lib/mongo-store';
import { format } from 'date-fns';
import Image from 'next/image';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';

const SHARED_HUB_ID = 'Sikkaind';

/**
 * @fileOverview Secure Public CN Preview Protocol.
 * Generates identical multi-copy sequential documentation for public tracking stakeholders.
 */
export default function PublicCNPreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const db = useMongoStore();
  const id = params.id as string;
  const isAuto = searchParams.get('auto') === 'true';

  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  const tripRef = useMemoMongo(() => {
    if (!id) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'trip_board', id);
  }, [db, id]);
  const { data: trip, isLoading: isTripLoading } = useDoc(tripRef);

  React.useEffect(() => {
    if (isAuto && trip && !isTripLoading) {
      setTimeout(() => window.print(), 1000);
    }
  }, [isAuto, trip, isTripLoading]);

  if (isTripLoading || !trip) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#525659] font-mono text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
          <span className="text-[10px] font-normal uppercase tracking-[0.4em]">Establishing Secure Link...</span>
        </div>
      </div>
    );
  }

  const logoFallback = placeholderData.placeholderImages.find(p => p.id === 'logo-old');
  const copies = ['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'];
  
  const validInvoices = (trip.invoices || []).filter((inv: any) => inv.invNo);

  const chunkArray = (arr: any[], size: number) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size)
    );
  };

  const packageSummary = (() => {
    if (validInvoices.length === 0) return "0 PKG";
    const groups: Record<string, number> = {};
    validInvoices.forEach((inv: any) => {
      const uom = (inv.uom || "PKG").toUpperCase();
      const qty = parseInt(inv.pkg) || 0;
      groups[uom] = (groups[uom] || 0) + qty;
    });
    return Object.entries(groups)
      .map(([uom, sum]) => `${sum} ${uom}`)
      .join(", ");
  })();

  const termsList = (() => {
    const rawTerms = trip.carrier?.termsAndConditions || trip.carrierTerms;
    const defaultTerms = '1. AGENCY IS NOT RESPONSIBLE FOR RAIN OR ANY NATURAL CALAMITY.\n2. ANY DISCREPANCY REGARDING MATERIAL HAS TO BE INTIMATED WITHIN 24 HOURS OF THE RECEIPT MATERIAL.\n3. AGENCY IS NOT RESPONSIBLE FOR THE GOODS AFTER LIFTING GOODS.\n4. OWNER OF THE VEHICLE (TRUCK) IS RESPONSIBLE FOR THE GOODS AFTER LIFTING THE GOODS.\n5. AGENCY HAS THE RIGHT TO HOLD THE MATERIAL UPON SHORTAGE OF VEHICLE.\n6. TRADERS IS RESPONSIBLE FOR CONTRABAND GOODS OR GOODS WHICH ARE NOT AUTHORISED.\n7. AGENCY HOLDS NO RESPONSIBILITY AFTER GOODS HAVE BEEN DELIVERED.\n8. ALL DISPUTES SUBJECT TO GHAZIABAD JURISDICTION.';
    const termsString = typeof rawTerms === 'string' && rawTerms.trim() ? rawTerms : defaultTerms;
    return termsString.split('\n').filter((t: string) => t.trim());
  })();

  return (
    <div className="min-h-screen bg-[#525659] font-sans text-black overflow-y-auto select-none text-left font-normal no-scrollbar print:overflow-visible print:bg-white">
      {!isAuto && (
        <div className="max-w-[210mm] mx-auto bg-[#323639] h-12 flex items-center justify-between px-6 shadow-md mb-1 rounded-t-sm sticky top-0 z-50 text-white no-print">
          <div className="flex items-center gap-3 text-white/90">
            <FileText className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] truncate max-w-[300px]">
              DOCUMENT_{trip.cnNumber || 'PREVIEW'}_{trip.tripNo}.pdf
            </span>
          </div>
          <div className="flex gap-4">
             <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 px-4 py-1 text-[10px] font-normal uppercase rounded-none transition-all">Print Protocol</button>
             <div className="flex items-center gap-2 text-[9px] font-normal text-white/40 uppercase tracking-widest italic">
               <AlertCircle className="h-3 w-3" /> Secure Preview Active
             </div>
          </div>
        </div>
      )}

      <div id="printable-area" className="flex flex-col gap-0 mx-auto w-[210mm] print:w-full shadow-2xl text-black font-normal bg-white print:block print:overflow-visible">
        {copies.map((copyLabel, index) => (
          <div key={index} className="cn-page bg-white text-black font-normal p-[15mm] min-h-[297mm] flex flex-col relative print:overflow-visible print:border-none">
            {/* Header branding section */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-1.5 items-start">
                {(trip.carrier?.logoUrl || logoFallback?.url) && (
                  <div className="relative w-[90px] h-[45px] shrink-0">
                    <Image 
                      src={trip.carrier?.logoUrl || logoFallback?.url || ''} 
                      alt="Carrier Logo" 
                      fill 
                      className="object-contain grayscale" 
                      unoptimized 
                    />
                  </div>
                )}
                <div className="space-y-0.5">
                  <h1 className="text-[17px] font-normal uppercase italic tracking-tighter leading-none text-black">{trip.carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                  <p className="text-[10px] uppercase max-w-[450px] leading-tight text-black font-normal">{trip.carrier?.address}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-normal uppercase text-black pt-1">
                    <span>GSTIN: {trip.carrier?.gstNo}</span>
                    {trip.carrier?.panNo && <span>PAN: {trip.carrier.panNo}</span>}
                    <span>MOB: {trip.carrier?.mobile}</span>
                    <span>EMAIL: {trip.carrier?.email}</span>
                  </div>
                </div>
              </div>
              <div className="border border-black px-4 py-1.5 text-[10px] font-normal uppercase italic bg-white tracking-widest shrink-0 text-black">{copyLabel}</div>
            </div>

            {/* Protocol Header Table */}
            <div className="mb-4">
               <table className="w-full border-collapse border border-black text-[12px]">
                  <thead>
                     <tr className="bg-white uppercase text-[8px] font-normal text-black border-b border-black">
                        <th className="p-1 border-r border-black text-center font-normal">CN Number</th>
                        <th className="p-1 border-r border-black text-center font-normal">Date</th>
                        <th className="p-1 border-r border-black text-center font-normal">From</th>
                        {trip.mode === 'Rail to Road' && <th className="p-1 border-r border-black text-center font-normal">Via</th>}
                        <th className="p-1 text-center font-normal">To</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr className="uppercase font-normal text-black text-[12px]">
                        <td className="p-2 border-r border-black text-center whitespace-nowrap">CN NO: {trip.cnNumber || 'DRAFT'}</td>
                        <td className="p-2 border-r border-black text-center">{trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : '-'}</td>
                        <td className="p-2 border-r border-black text-center text-[10px]">{trip.from}</td>
                        {trip.mode === 'Rail to Road' && <td className="p-2 border-r border-black text-center text-[10px]">{trip.via || '-'}</td>}
                        <td className="p-2 text-center text-[10px]">{trip.destination}</td>
                     </tr>
                  </tbody>
               </table>
            </div>

            {/* Vehicle Detail Table */}
            <div className="mb-4">
               <table className="w-full border-collapse border border-black text-[12px]">
                  <thead>
                     <tr className="bg-white uppercase text-[8px] font-normal text-black border-b border-black">
                        <th className="p-1 border-r border-black w-1/5 text-center font-normal">Vehicle Number</th>
                        <th className="p-1 border-r border-black w-1/5 text-center font-normal">Driver Mobile</th>
                        <th className="p-1 border-r border-black w-1/5 text-center font-normal">Payment Term</th>
                        <th className="p-1 border-r border-black w-1/5 text-center font-normal">Mode</th>
                        <th className="p-1 w-1/5 text-center font-normal">Trip ID</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr className="uppercase font-normal text-black text-[12px]">
                        <td className="p-2 border-r border-black text-center">{trip.vehicleNo}</td>
                        <td className="p-2 border-r border-black text-center">{trip.driverMobile || '-'}</td>
                        <td className="p-2 border-r border-black text-center text-[10px]">{trip.paymentTerms}</td>
                        <td className="p-2 border-r border-black text-center text-[10px]">{trip.mode}</td>
                        <td className="p-2 text-center text-[10px]">{trip.tripNo}</td>
                     </tr>
                  </tbody>
               </table>
            </div>

            {/* Consignor/Consignee Info Blocks */}
            <div className="grid grid-cols-3 gap-0 mb-4 border border-black text-black">
               <div className="border-r border-black p-3 space-y-3 min-h-[140px]">
                  <h4 className="text-[10px] font-normal uppercase text-black italic mb-1 tracking-widest border-b border-black/10 w-fit">Consignor</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1 text-black">
                     <p className="text-[10px] font-normal leading-tight">{trip.consignorName}</p>
                     <p className="leading-tight text-black whitespace-pre-wrap">{trip.consignor?.address}</p>
                     <p className="text-[10px] pt-1 text-black font-normal">GSTIN: {trip.consignor?.gstNo}</p>
                  </div>
               </div>
               <div className="border-r border-black p-3 space-y-3 min-h-[140px]">
                  <h4 className="text-[10px] font-normal uppercase text-black italic mb-1 tracking-widest border-b border-black/10 w-fit">Consignee</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1 text-black">
                     <p className="text-[10px] font-normal leading-tight">{trip.consigneeName}</p>
                     <p className="leading-tight text-black whitespace-pre-wrap">{trip.consignee?.address}</p>
                     <p className="text-[10px] pt-1 text-black font-normal">GSTIN: {trip.consignee?.gstNo}</p>
                  </div>
               </div>
               <div className="p-3 space-y-3 min-h-[140px] bg-white text-black">
                  <h4 className="text-[10px] font-normal uppercase text-black italic mb-1 tracking-widest border-b border-black/10 w-fit">Ship To Party</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1 text-black">
                     <p className="text-[10px] font-normal leading-tight">{trip.shipToParty}</p>
                     <p className="leading-tight text-black whitespace-pre-wrap">{trip.shipToPartyData?.address}</p>
                     <p className="text-[10px] pt-1 text-black font-normal">GSTIN: {trip.shipToPartyData?.gstNo}</p>
                  </div>
               </div>
            </div>

            {/* Items and Weights Table */}
            <div className="mb-4 text-black">
               <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                     <tr className="bg-white uppercase text-[8px] font-normal text-black border-b border-black">
                        <th className="p-2 border-r border-black w-[130px] text-left font-normal">Invoice No</th>
                        <th className="p-2 border-r border-black w-[160px] text-left font-normal">E-Waybill No</th>
                        <th className="p-2 border-r border-black text-left font-normal">Description</th>
                        <th className="p-2 border-r border-black w-[110px] text-center font-normal">Package</th>
                        <th className="p-2 w-[110px] text-right font-normal">Weight (MT)</th>
                     </tr>
                  </thead>
                  <tbody>
                 {validInvoices.length > 3 ? (
                    <tr className="border-b border-black last:border-b-0 uppercase font-normal text-black text-[11px]">
                       <td className="p-2 border-r border-black align-top">
                          {(() => {
                             const uniqueInv = Array.from(new Set(validInvoices.map((inv: any) => inv.invNo).filter(Boolean)));
                             return chunkArray(uniqueInv, 2).map((chunk, idx) => (
                                <div key={idx}>{chunk.join(', ')}</div>
                             ));
                          })()}
                       </td>
                       <td className="p-2 border-r border-black align-top">
                          {(() => {
                             const uniqueEway = Array.from(new Set(validInvoices.map((inv: any) => inv?.ewaybillEnteredAtCN ? inv.ewaybillNo : '').filter(Boolean)));
                             if (uniqueEway.length === 0) return '-';
                             return chunkArray(uniqueEway, 2).map((chunk, idx) => (
                                <div key={idx}>{chunk.join(', ')}</div>
                             ));
                          })()}
                       </td>
                       <td className="p-2 border-r border-black leading-snug text-[11px] align-top">
                          {(() => {
                             const uniqueDesc = Array.from(new Set(validInvoices.map((inv: any) => {
                                const d = inv.desc || '';
                                const prefix = d.match(/^[^0-9]+/);
                                return prefix ? prefix[0].trim() : d.trim();
                             }).filter(Boolean)));
                             return uniqueDesc.join(', ');
                          })()}
                       </td>
                       <td className="p-2 border-r border-black text-center align-top">{packageSummary}</td>
                       <td className="p-2 text-right align-top">{parseFloat(trip.assignWeight || 0).toFixed(3)}</td>
                    </tr>
                 ) : (
                    validInvoices.map((inv: any, i: number) => (
                       <tr key={i} className="border-b border-black last:border-b-0 uppercase font-normal text-black text-[11px]">
                          <td className="p-2 border-r border-black align-top">{inv.invNo}</td>
                          <td className="p-2 border-r border-black align-top">{inv?.ewaybillEnteredAtCN ? inv.ewaybillNo : '-'}</td>
                          <td className="p-2 border-r border-black leading-snug text-[11px] align-top">{inv.desc}</td>
                          <td className="p-2 border-r border-black text-center align-top">{inv.pkg} {inv.uom}</td>
                          <td className="p-2 text-right align-top">{i === 0 ? parseFloat(trip.assignWeight || 0).toFixed(3) : '-'}</td>
                       </tr>
                    ))
                 )}
                  </tbody>
                  <tfoot>
                     <tr className="bg-white font-normal text-[15px] uppercase border-t border-black text-black">
                        <td colSpan={3} className="p-3 text-right text-black italic border-r border-black uppercase">Gross Total:</td>
                        <td className="p-3 text-center border-r border-black font-normal">{packageSummary}</td>
                        <td className="p-3 text-right border-none font-normal">{parseFloat(trip.assignWeight || 0).toFixed(3)} MT</td>
                     </tr>
                  </tfoot>
               </table>
            </div>

            {/* Legal and Signatures - pushed to bottom */}
            <div className="mt-auto space-y-8 text-black pt-8 shrink-0">
               <div className="flex justify-between items-end text-black">
                  <div className="space-y-3 max-w-[70%] text-black">
                     <h5 className="text-[8px] font-normal uppercase text-black tracking-widest italic border-b border-black w-fit pb-0.5">Terms & Conditions</h5>
                     <div className="space-y-0.5 text-black font-normal">
                        {termsList.map((term: string, i: number) => (
                           <p key={i} className="text-[8px] font-normal leading-relaxed text-justify text-black uppercase">
                              {term.trim()}
                           </p>
                        ))}
                     </div>
                  </div>
                  <div className="text-right space-y-10 pr-4 text-black font-normal min-w-[150px]">
                     <div className="h-10 text-black"></div>
                     <div className="space-y-0.5 text-black">
                        <p className="text-[10px] font-normal uppercase italic tracking-tighter text-black">Authorized Signature</p>
                     </div>
                  </div>
               </div>
               <div className="text-center pt-4 border-t border-black">
                  <p className="text-[10px] font-normal uppercase tracking-tighter italic text-black opacity-60">
                     This Consignment Note was generated digitally and is to be considered as original.
                  </p>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
