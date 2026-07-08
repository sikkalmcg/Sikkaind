'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMongoStore, useDoc, useMemoMongo, useCollection } from '@/mongodb';
import { doc, collection } from '@/lib/mongo-store';
import { format } from 'date-fns';
import Image from 'next/image';
import { Loader2, Printer, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import placeholderData from '@/app/lib/placeholder-images.json';

const SHARED_HUB_ID = 'Sikkaind';

/**
 * @fileOverview CNPrintPage - Multi-copy Sequential CN Protocol.
 * Generates Consignee, Driver, and Consignor copies in high-fidelity ERP format.
 */
export default function CNPrintPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useMongoStore();
  const id = params.id as string;
  const isAuto = searchParams.get('auto') === 'true';

  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const tripRef = useMemoMongo(() => {
    if (!id) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'trip_board', id);
  }, [db, id]);
  const { data: trip, isLoading: isTripLoading } = useDoc(tripRef);

  const companiesQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const { data: companies } = useCollection(companiesQuery);
  
  const customersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const { data: customers } = useCollection(customersQuery);

  React.useEffect(() => {
    if (isAuto && trip && !isTripLoading) {
      setTimeout(() => window.print(), 1500);
    }
  }, [isAuto, trip, isTripLoading]);

  if (isTripLoading || !trip) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 font-mono text-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          <span className="text-[10px] font-normal uppercase tracking-[0.4em]">Synchronizing Print Protocol...</span>
        </div>
      </div>
    );
  }

  const logoFallback = placeholderData.placeholderImages.find(p => p.id === 'logo-old');
  const carrier = companies?.find(c => c.companyName === trip.carrierName) || companies?.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(trip.plantCode)) || companies?.[0];
  const consignor = customers?.find(c => c.customerCode === trip.consignorCode);
  const consignee = customers?.find(c => c.customerCode === trip.consigneeCode);
  const shipToParty = customers?.find(c => c.customerCode === trip.shipToPartyCode);

  const copies = ['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'];
  
  const packageSummary = (() => {
    const invoices = trip.invoices || [];
    if (invoices.length === 0) return "0 PKG";
    const groups: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      const uom = (inv.uom || "PKG").toUpperCase();
      const qty = parseInt(inv.pkg) || 0;
      groups[uom] = (groups[uom] || 0) + qty;
    });
    return Object.entries(groups)
          .map(([uom, sum]) => `${sum} ${uom}`)
          .join(", ");
  })();

  const termsList = (() => {
    const rawTerms = carrier?.termsAndConditions;
    const defaultTerms = '1. AGENCY IS NOT RESPONSIBLE FOR RAIN OR ANY NATURAL CALAMITY.\n2. ANY DISCREPANCY REGARDING MATERIAL HAS TO BE INTIMATED WITHIN 24 HOURS OF THE RECEIPT MATERIAL.\n3. AGENCY IS NOT RESPONSIBLE FOR THE GOODS AFTER LIFTING GOODS.\n4. OWNER OF THE VEHICLE (TRUCK) IS RESPONSIBLE FOR THE GOODS AFTER LIFTING THE GOODS.\n5. AGENCY HAS THE RIGHT TO HOLD THE MATERIAL UPON SHORTAGE OF VEHICLE.\n6. TRADERS IS RESPONSIBLE FOR CONTRABAND GOODS OR GOODS WHICH ARE NOT AUTHORISED.\n7. AGENCY HOLDS NO RESPONSIBILITY AFTER GOODS HAVE BEEN DELIVERED.\n8. ALL DISPUTES SUBJECT TO GHAZIABAD JURISDICTION.';
    const termsString = typeof rawTerms === 'string' && rawTerms.trim() ? rawTerms : defaultTerms;
    return termsString.split('\n').filter(t => t.trim());
  })();

  return (
    <div className="min-h-screen bg-slate-200 font-sans text-black overflow-y-auto print:bg-white print:p-0 text-left font-normal no-scrollbar overflow-x-hidden print:overflow-visible">
      <div className="max-w-[210mm] mx-auto bg-white shadow-2xl no-print mb-8 rounded-none border-b-4 border-blue-600 sticky top-0 z-[100]">
         <div className="p-4 flex justify-between items-center bg-slate-50 text-black">
            <div className="flex flex-col text-left">
               <span className="text-[11px] font-normal uppercase italic text-blue-900 tracking-tighter">Sikka Logistics Management Protocol</span>
               <span className="text-[9px] font-normal text-slate-400 uppercase">A4 Multi-Copy Matrix System (All Copies Active)</span>
            </div>
            <div className="flex gap-3">
               <button onClick={() => window.print()} className="h-9 bg-blue-700 hover:bg-blue-800 text-white px-8 text-[11px] font-normal uppercase rounded-none transition-all flex items-center gap-2 shadow-md active:scale-95"><Printer className="h-4 w-4" /> Print Protocol</button>
               <button onClick={() => window.close()} className="h-9 bg-white border border-slate-300 text-slate-600 px-8 text-[11px] font-normal uppercase rounded-none hover:bg-slate-100 transition-all flex items-center gap-2 active:scale-95"><X className="h-4 w-4" /> Close</button>
            </div>
         </div>
      </div>

      <div id="printable-area" className="flex flex-col gap-0 bg-white mx-auto w-[210mm] print:w-full text-black font-normal shadow-xl print:shadow-none print:block print:overflow-visible">
        {copies.map((copyLabel, index) => (
          <div key={index} className="cn-page bg-white text-black font-normal p-[15mm] min-h-[297mm] flex flex-col relative overflow-hidden print:overflow-visible print:border-none">
            {/* Header branding section */}
            <div className="flex justify-between items-center mb-4 shrink-0">
              
              {/* Left Side: Logo and Company Details */}
              <div className="flex gap-4 items-start">
                {(carrier?.logoUrl || logoFallback?.url) && (
                  <div className="relative w-[90px] h-[45px] shrink-0 mt-0.5">
                    <Image 
                      src={carrier?.logoUrl || logoFallback?.url || ''} 
                      alt="Carrier Logo" 
                      fill 
                      className="object-contain grayscale" 
                      unoptimized 
                    />
                  </div>
                )}
                <div className="space-y-0.5">
                  <h1 className="text-[17px] font-normal uppercase italic tracking-tighter leading-none text-black">{carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                  <p className="text-[10px] uppercase max-w-[450px] leading-tight text-black font-normal">{carrier?.address}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-normal uppercase text-black pt-1">
                    <span>GSTIN: {carrier?.gstNo || 'UNREGISTERED'}</span>
                    {carrier?.panNo && <span>PAN: {carrier.panNo}</span>}
                    <span>MOB: {carrier?.mobile}</span>
                    <span>EMAIL: {carrier?.email}</span>
                  </div>
                </div>
              </div>

              {/* Right Side: QR Code and Copy Label Box */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center justify-center h-[64px]">
                  <QRCodeSVG
                    value={`${origin || 'http://localhost:3000'}/dashboard/tr21/print/${id}`}
                    size={64}
                    level="M"
                  />
                </div>
                <div className="border border-black px-4 py-1.5 text-[10px] font-normal uppercase italic bg-white tracking-widest text-black whitespace-nowrap">
                  {copyLabel}
                </div>
              </div>

            </div>

            {/* Protocol Header Table */}
            <div className="mb-4 text-black shrink-0">
               <table className="w-full border-collapse border border-black text-[12px]">
                  <thead>
                     <tr className="bg-white uppercase border-b border-black text-[8px] font-normal text-black">
                        <th className="p-1 border-r border-black text-center font-normal text-[10px]">CN Number</th>
                        <th className="p-1 border-r border-black text-center font-normal">Date</th>
                        <th className="p-1 border-r border-black text-center font-normal">From</th>
                        <th className="p-1 border-r border-black text-center font-normal">Via</th>
                        <th className="p-1 text-center font-normal">To</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr className="uppercase font-normal text-black text-[12px]">
                        <td className="p-2 border-r border-black text-center whitespace-nowrap text-[14px] font-medium">{trip.cnNumber || 'DRAFT'}</td>
                        <td className="p-2 border-r border-black text-center">{trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : '-'}</td>
                        <td className="p-2 border-r border-black text-center text-[10px]">{trip.from}</td>
                        <td className="p-2 border-r border-black text-center text-[10px]">{trip.via || '-'}</td>
                        <td className="p-2 text-center text-[10px]">{trip.destination}</td>
                     </tr>
                  </tbody>
               </table>
            </div>

            {/* Vehicle Detail Table */}
            <div className="mb-4 text-black shrink-0">
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
            <div className="grid grid-cols-3 gap-0 mb-4 border border-black text-black shrink-0">
               <div className="border-r border-black p-3 space-y-3 min-h-[140px]">
                  <h4 className="text-[10px] font-normal uppercase text-black italic mb-1 tracking-widest border-b border-black/10 w-fit">Consignor</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1 text-black">
                     <p className="text-[10px] font-normal leading-tight">{trip.consignorName}</p>
                     <p className="leading-tight text-black whitespace-pre-wrap">{consignor?.address}</p>
                     <p className="text-[10px] pt-1">GSTIN: {consignor?.gstNo || consignor?.gstin || '-'}</p>
                     <p className="text-[10px]">MOBILE: {consignor?.mobile || '-'}</p>
                  </div>
               </div>
               <div className="border-r border-black p-3 space-y-3 min-h-[140px]">
                  <h4 className="text-[10px] font-normal uppercase text-black italic mb-1 tracking-widest border-b border-black/10 w-fit">Consignee</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1 text-black">
                     <p className="text-[10px] font-normal leading-tight">{trip.consigneeName}</p>
                     <p className="leading-tight text-black whitespace-pre-wrap">{consignee?.address}</p>
                     <p className="text-[10px] pt-1">GSTIN: {consignee?.gstNo || consignee?.gstin || '-'}</p>
                     <p className="text-[10px]">MOBILE: {consignee?.mobile || '-'}</p>
                  </div>
               </div>
               <div className="p-3 space-y-3 min-h-[140px] bg-white text-black">
                  <h4 className="text-[10px] font-normal uppercase text-black italic mb-1 tracking-widest border-b border-black/10 w-fit">Ship To Party</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1 text-black">
                     <p className="text-[10px] font-normal leading-tight">{trip.shipToParty}</p>
                     <p className="leading-tight text-black whitespace-pre-wrap">{shipToParty?.address}</p>
                     <p className="text-[10px] pt-1">GSTIN: {shipToParty?.gstNo || shipToParty?.gstin || '-'}</p>
                     <p className="text-[10px]">MOBILE: {shipToParty?.mobile || '-'}</p>
                  </div>
               </div>
            </div>

            {/* Items and Weights Table */}
            <div className="mb-4 text-black shrink-0">
               <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                     <tr className="bg-white uppercase text-[8px] font-normal text-black border-b border-black">
                        <th className="p-2 border-r border-black w-[140px] text-left font-normal">Invoice No</th>
                        <th className="p-2 border-r border-black w-[170px] text-left font-normal">E-Waybill No</th>
                        <th className="p-2 border-r border-black text-left font-normal">Description</th>
                        <th className="p-2 border-r border-black w-[110px] text-center font-normal">Package</th>
                        <th className="p-2 w-[110px] text-right font-normal">Weight (MT)</th>
                     </tr>
                  </thead>
                  <tbody>
                     {(trip.invoices || []).filter((inv: any) => inv.invNo).map((inv: any, i: number) => {
                        const invList = inv.invNo ? inv.invNo.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
                        const ewayList = inv.ewaybillNo ? inv.ewaybillNo.split(',').map((x: string) => x.trim()).filter(Boolean) : [];

                        {/* FIXED: Removed 'font-medium' and 'font-mono' weightings to make it non-bold */}
                        const invFontClass = invList.length === 1 ? 'text-[13px] tracking-normal' : 'text-[9px] tracking-tight break-all';
                        const ewayFontClass = ewayList.length === 1 ? 'text-[13px] tracking-normal' : 'text-[9px] tracking-tight break-all';

                        return (
                           <tr key={i} className="border-b border-black last:border-b-0 uppercase font-normal text-black text-[11px]">
                              {/* Invoice No Layout Block */}
                              <td className="p-2 border-r border-black align-top">
                                 <div className="flex flex-wrap gap-1 max-w-[130px]">
                                    {invList.map((num: string, idx: number) => (
                                       <span key={idx} className={invFontClass}>
                                          {num}
                                       </span>
                                    ))}
                                 </div>
                              </td>

                              {/* E-Waybill No Layout Block */}
                              <td className="p-2 border-r border-black align-top">
                                 <div className="flex flex-wrap gap-1 max-w-[160px]">
                                    {ewayList.map((num: string, idx: number) => (
                                       <span key={idx} className={ewayFontClass}>
                                          {num}
                                       </span>
                                    ))}
                                 </div>
                              </td>

                              <td className="p-2 border-r border-black leading-snug text-[11px] align-top">{inv.desc}</td>
                              <td className="p-2 border-r border-black text-center align-top">{inv.pkg} {inv.uom}</td>
                              <td className="p-2 text-right align-top">{i === 0 ? parseFloat(trip.assignWeight || 0).toFixed(3) : '-'}</td>
                           </tr>
                        );
                     })}
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