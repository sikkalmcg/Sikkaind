'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { format } from 'date-fns';
import Image from 'next/image';
import { Loader2, Printer, X } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const SHARED_HUB_ID = 'Sikkaind';

/**
 * @fileOverview CNPrintPage - High-fidelity A4 Consignment Note Printing Protocol.
 * Refined with reduced font sizes and consolidated detail tables.
 */
export default function CNPrintPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const id = params.id as string;
  const isAuto = searchParams.get('auto') === 'true';

  const [generating, setGenerating] = React.useState(false);

  const tripRef = useMemoFirebase(() => {
    if (!id) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'trip_board', id);
  }, [db, id]);
  const { data: trip, isLoading: isTripLoading } = useDoc(tripRef);

  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const { data: companies } = useCollection(companiesQuery);
  
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const { data: customers } = useCollection(customersQuery);

  const carrier = React.useMemo(() => {
    if (!trip || !companies) return null;
    return companies.find(c => c.companyName === trip.carrierName) || companies.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(trip.plantCode)) || companies[0];
  }, [trip, companies]);

  const consignor = React.useMemo(() => customers?.find(c => c.customerCode === trip?.consignorCode), [customers, trip]);
  const consignee = React.useMemo(() => customers?.find(c => c.customerCode === trip?.consigneeCode), [customers, trip]);
  const shipToParty = React.useMemo(() => customers?.find(c => c.customerCode === trip?.shipToPartyCode), [customers, trip]);

  const generateAndDownload = React.useCallback(async () => {
    if (!trip || generating) return;
    
    const images = document.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));

    await new Promise(r => setTimeout(r, 1500));
    setGenerating(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const elements = document.querySelectorAll('.cn-page');
      
      for (let i = 0; i < elements.length; i++) {
        const canvas = await html2canvas(elements[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      pdf.save(`CN-${trip.cnNumber || 'DRAFT'}.pdf`);
      const url = URL.createObjectURL(pdf.output('blob'));
      window.location.replace(url);
    } catch (err) {
      console.error('PDF Protocol Failure:', err);
      setGenerating(false);
    }
  }, [trip, generating]);

  React.useEffect(() => {
    if (isAuto && trip && !isTripLoading && !generating) {
      generateAndDownload();
    }
  }, [isAuto, trip, isTripLoading, generating, generateAndDownload]);

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
  const copies = ['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'];
  
  const packageSummary = (() => {
    if (!trip.invoices || trip.invoices.length === 0) return "0 PKG";
    const groups: Record<string, number> = {};
    trip.invoices.forEach((inv: any) => {
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
    const defaultTerms = '1. THE CARRIER HOLDS NO LIABILITY FOR SHORTAGE NOT REPORTED AT ARRIVAL.\n2. ALL DISPUTES FALL UNDER CORPORATE HQ JURISDICTION.\n3. WEIGHT BASED ON PARTY DECLARATIONS.';
    const termsString = typeof rawTerms === 'string' && rawTerms.trim() ? rawTerms : defaultTerms;
    return termsString.split('\n').filter(t => t.trim());
  })();

  return (
    <div className="min-h-screen bg-slate-200 p-0 md:p-8 font-sans text-black overflow-y-auto print:bg-white print:p-0 text-left">
      {generating && (
        <div className="fixed inset-0 bg-[#323639] z-[200] flex flex-col items-center justify-center gap-6 text-white font-mono">
          <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
          <div className="text-center space-y-2">
            <p className="text-[12px] font-normal uppercase tracking-[0.4em]">Protocol Execution: PDF Generation</p>
            <p className="text-[9px] font-normal text-slate-400 uppercase italic tracking-widest">Generating CN-{trip.cnNumber}. Do not close this tab.</p>
          </div>
        </div>
      )}

      {!generating && !isAuto && (
        <div className="max-w-[850px] mx-auto bg-white shadow-2xl no-print mb-8 rounded-sm border border-slate-300 sticky top-0 z-[100]">
           <div className="p-4 flex justify-between items-center bg-slate-50 text-black">
              <div className="flex flex-col text-left">
                 <span className="text-[11px] font-normal uppercase italic text-blue-900 tracking-tighter">Sikka Logistics Management Protocol</span>
                 <span className="text-[9px] font-normal text-slate-400 uppercase">A4 Multi-Copy Matrix</span>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => window.print()} className="h-9 bg-blue-700 hover:bg-blue-800 text-white px-8 text-[11px] font-normal uppercase rounded-none transition-all flex items-center gap-2 shadow-md active:scale-95"><Printer className="h-4 w-4" /> Print Protocol</button>
                 <button onClick={() => window.close()} className="h-9 bg-white border border-slate-300 text-slate-600 px-8 text-[11px] font-normal uppercase rounded-none hover:bg-slate-100 transition-all flex items-center gap-2 active:scale-95"><X className="h-4 w-4" /> Exit</button>
              </div>
           </div>
        </div>
      )}

      <div id="printable-area" className="flex flex-col gap-0 bg-white shadow-inner mx-auto w-fit print:shadow-none print:w-full text-black">
        {copies.map((copyLabel, index) => (
          <div key={index} className="cn-page relative p-10 bg-white border-b-2 border-black last:border-b-0 print:border-none print:m-0 print:page-break-after-always overflow-hidden text-left flex flex-col text-black">
            <div className="flex justify-between items-start mb-6">
              <div className="flex gap-4 items-start">
                {(carrier?.logoUrl || logoFallback?.url) && (
                  <div className="relative w-[90px] h-[42px] shrink-0">
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
                  <h1 className="text-[15px] font-black uppercase italic tracking-tighter leading-none text-black">{carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                  <p className="text-[8px] uppercase max-w-[400px] leading-tight text-black font-bold">{carrier?.address}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[8px] font-black uppercase text-black pt-1">
                    <span>GSTIN: {carrier?.gstNo || 'UNREGISTERED'}</span>
                    {carrier?.panNo && <span>PAN: {carrier.panNo}</span>}
                    <span>MOB: {carrier?.mobile}</span>
                    <span>EMAIL: {carrier?.email}</span>
                    {carrier?.website && <span>WEB: {carrier.website}</span>}
                  </div>
                </div>
              </div>
              <div className="border border-black px-5 py-2 text-[10px] font-normal uppercase italic bg-white tracking-widest shrink-0 text-black">{copyLabel}</div>
            </div>

            <div className="mb-4 text-black">
               <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                     <tr className="bg-white uppercase text-[8px] font-normal text-black border-b border-black">
                        <th className="p-2 border-r border-black text-center font-normal">CN Number</th>
                        <th className="p-2 border-r border-black text-center font-normal">Date</th>
                        <th className="p-2 border-r border-black text-center font-normal">From</th>
                        <th className="p-2 border-r border-black text-center font-normal">Via</th>
                        <th className="p-2 text-center font-normal">To</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr className="uppercase font-normal text-black">
                        <td className="p-2 border-r border-black text-center font-black">{trip.cnNumber || 'DRAFT'}</td>
                        <td className="p-2 border-r border-black text-center">{trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : '-'}</td>
                        <td className="p-2 border-r border-black text-center">{trip.from}</td>
                        <td className="p-2 border-r border-black text-center">{trip.via || '-'}</td>
                        <td className="p-2 text-center">{trip.destination}</td>
                     </tr>
                  </tbody>
               </table>
            </div>

            <div className="mb-6 text-black">
               <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                     <tr className="bg-white uppercase text-[8px] font-normal text-black border-b border-black">
                        <th className="p-2 border-r border-black w-1/5 text-center font-normal">Vehicle Number</th>
                        <th className="p-2 border-r border-black w-1/5 text-center font-normal">Driver Mobile</th>
                        <th className="p-2 border-r border-black w-1/5 text-center font-normal">Payment Term</th>
                        <th className="p-2 border-r border-black w-1/5 text-center font-normal">Mode</th>
                        <th className="p-2 w-1/5 text-center font-normal">Trip ID</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr className="uppercase font-normal text-black">
                        <td className="p-2 border-r border-black text-center">{trip.vehicleNo}</td>
                        <td className="p-2 border-r border-black text-center">{trip.driverMobile || '-'}</td>
                        <td className="p-2 border-r border-black text-center">{trip.paymentTerms}</td>
                        <td className="p-2 border-r border-black text-center">{trip.mode}</td>
                        <td className="p-2 text-center">{trip.tripNo}</td>
                     </tr>
                  </tbody>
               </table>
            </div>

            <div className="grid grid-cols-3 gap-0 mb-6 border-none text-black">
               <div className="border-r border-black p-4 space-y-4 min-h-[160px]">
                  <h4 className="text-[9px] font-normal uppercase text-black italic mb-2 tracking-widest">Consignor</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1.5 text-black">
                     <p className="text-[11px] font-black">{trip.consignorName}</p>
                     <p className="leading-relaxed text-black whitespace-pre-wrap">{consignor?.address}</p>
                     <p>MOB: {consignor?.mobile}</p>
                     <p className="text-[8px] pt-1 text-black font-mono">GSTIN: {consignor?.gstNo || consignor?.gstin}</p>
                  </div>
               </div>
               <div className="border-r border-black p-4 space-y-4 min-h-[160px]">
                  <h4 className="text-[9px] font-normal uppercase text-black italic mb-2 tracking-widest">Consignee</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1.5 text-black">
                     <p className="text-[11px] font-black">{trip.consigneeName}</p>
                     <p className="leading-relaxed text-black whitespace-pre-wrap">{consignee?.address}</p>
                     <p className="text-[8px] pt-1 text-black font-mono">GSTIN: {consignee?.gstNo || consignee?.gstin}</p>
                  </div>
               </div>
               <div className="p-4 space-y-4 min-h-[160px] bg-white text-black">
                  <h4 className="text-[9px] font-normal uppercase text-black italic mb-2 tracking-widest">Ship To Party</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1.5 text-black">
                     <p className="text-[11px] font-black">{trip.shipToParty}</p>
                     <p className="leading-relaxed text-black whitespace-pre-wrap">{shipToParty?.address}</p>
                     <p>MOB: {shipToParty?.mobile}</p>
                     <p className="text-[8px] pt-1 text-black font-mono">GSTIN: {shipToParty?.gstNo || shipToParty?.gstin}</p>
                  </div>
               </div>
            </div>

            <div className="mb-6 text-black">
               <table className="w-full border-collapse border border-black text-[10px]">
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
                     {trip.invoices?.map((inv: any, i: number) => (
                        <tr key={i} className="border-b border-black last:border-b-0 uppercase font-normal text-black">
                           <td className="p-3 border-r border-black">{inv.invNo}</td>
                           <td className="p-3 border-r border-black">{inv.ewaybillNo}</td>
                           <td className="p-3 border-r border-black leading-snug">{inv.desc}</td>
                           <td className="p-3 border-r border-black text-center">{inv.pkg} {inv.uom}</td>
                           <td className="p-3 text-right">{i === 0 ? parseFloat(trip.assignWeight || 0).toFixed(3) : '-'}</td>
                        </tr>
                     ))}
                  </tbody>
                  <tfoot>
                     <tr className="bg-white font-normal text-[9px] uppercase border-t border-black text-black">
                        <td colSpan={3} className="p-4 text-right text-black italic">Gross Total:</td>
                        <td className="p-4 text-center border-none font-black">{packageSummary}</td>
                        <td className="p-4 text-right border-none font-black">{parseFloat(trip.assignWeight || 0).toFixed(3)} MT</td>
                   </tr>
                </tfoot>
             </table>
          </div>

          <div className="mt-auto space-y-10 text-black">
             <div className="flex justify-between items-end text-black">
                <div className="space-y-4 max-w-[60%]">
                   <h5 className="text-[8px] font-normal uppercase text-black tracking-widest italic border-b border-black w-fit pb-1">Terms & Conditions</h5>
                   <div className="space-y-1 text-black">
                      {termsList.map((term, i) => (
                        <p key={i} className="text-[8px] leading-relaxed text-justify text-black uppercase font-normal">
                          {term.trim()}
                        </p>
                      ))}
                   </div>
                </div>
                <div className="text-right space-y-12 pr-4 text-black">
                   <div className="h-14"></div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-normal uppercase italic tracking-tighter text-black">Authorized Signature</p>
                   </div>
                </div>
             </div>
             <div className="text-center pt-6 border-t border-black">
                <p className="text-[10px] font-normal uppercase tracking-tighter italic text-black">
                   This Consignment Note was generated digitally and is to be considered as original.
                </p>
             </div>
          </div>
        </div>
      ))}
    </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background-color: white !important; color: black !important; }
          .no-print { display: none !important; }
          .cn-page { width: 210mm; height: 297mm; margin: 0 auto; border: none !important; padding: 20mm !important; page-break-after: always; box-shadow: none !important; color: black !important; }
          .cn-page * { color: black !important; border-color: black !important; }
        }
        .cn-page { width: 210mm; min-height: 297mm; box-sizing: border-box; background-color: white; }
      `}</style>
    </div>
  );
}
