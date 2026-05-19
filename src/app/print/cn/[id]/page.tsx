'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { format } from 'date-fns';
import Image from 'next/image';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * @fileOverview Secure Public CN Preview Protocol.
 * Refined with reduced font sizes and consolidated detail tables.
 */
export default function PublicCNPreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const id = params.id as string;
  const isAuto = searchParams.get('auto') === 'true';

  const [generating, setGenerating] = React.useState(false);

  // Interaction Lockdown
  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  const tripRef = useMemoFirebase(() => {
    if (!id) return null;
    return doc(db, 'public_trips', id);
  }, [db, id]);
  const { data: trip, isLoading: isTripLoading } = useDoc(tripRef);

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

    await new Promise(r => setTimeout(r, 1000));
    setGenerating(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = document.querySelectorAll('.cn-page');
      
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i] as HTMLElement, {
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
      console.error('Public PDF Protocol Failure:', err);
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
    const rawTerms = trip.carrier?.termsAndConditions;
    const defaultTerms = '1. THE CARRIER HOLDS NO LIABILITY FOR SHORTAGE NOT REPORTED AT ARRIVAL.\n2. ALL DISPUTES FALL UNDER CORPORATE HQ JURISDICTION.\n3. WEIGHT BASED ON PARTY DECLARATIONS.';
    const termsString = typeof rawTerms === 'string' && rawTerms.trim() ? rawTerms : defaultTerms;
    return termsString.split('\n').filter((t: string) => t.trim());
  })();

  return (
    <div className="min-h-screen bg-[#525659] p-4 md:p-8 font-sans text-black overflow-y-auto select-none text-left font-normal">
      {generating && (
        <div className="fixed inset-0 bg-[#323639] z-[200] flex flex-col items-center justify-center gap-6 text-white font-mono">
          <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
          <div className="text-center space-y-2">
            <p className="text-[12px] font-normal uppercase tracking-[0.4em]">Secure Execution: PDF Generation</p>
            <p className="text-[9px] font-normal text-slate-400 uppercase italic tracking-widest">Processing Secure Preview. Do not close tab.</p>
          </div>
        </div>
      )}

      {!generating && !isAuto && (
        <div className="max-w-[210mm] mx-auto bg-[#323639] h-12 flex items-center justify-between px-6 shadow-md mb-1 rounded-t-sm sticky top-0 z-50 text-white">
          <div className="flex items-center gap-3 text-white/90">
            <FileText className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] truncate max-w-[300px]">
              DOCUMENT_{trip.cnNumber || 'PREVIEW'}_{trip.tripNo}.pdf
            </span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-normal text-white/40 uppercase tracking-widest italic">
            <AlertCircle className="h-3 w-3" /> Secure Preview Only
          </div>
        </div>
      )}

      <div id="printable-area" className="flex flex-col gap-4 mx-auto w-fit shadow-2xl text-black font-normal">
        {copies.map((copyLabel, index) => (
          <div key={index} className="cn-page relative p-10 bg-white border-b border-black last:border-b-0 print:border-none print:m-0 print:page-break-after-always overflow-hidden text-left flex flex-col text-black font-normal">
            <div className="flex justify-between items-start mb-6">
              <div className="flex gap-4 items-start">
                {(trip.carrier?.logoUrl || logoFallback?.url) && (
                  <div className="relative w-[90px] h-[42px] shrink-0">
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
                  <p className="text-[10px] uppercase max-w-[400px] leading-tight text-black font-normal">{trip.carrier?.address}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-normal uppercase text-black pt-1">
                    <span>GSTIN: {trip.carrier?.gstNo}</span>
                    {trip.carrier?.panNo && <span>PAN: {trip.carrier.panNo}</span>}
                    <span>MOB: {trip.carrier?.mobile}</span>
                    <span>EMAIL: {trip.carrier?.email}</span>
                    {trip.carrier?.website && <span>WEB: {trip.carrier.website}</span>}
                  </div>
                </div>
              </div>
              <div className="border border-black px-5 py-2 text-[9px] font-normal uppercase italic bg-white tracking-widest shrink-0 text-black">{copyLabel}</div>
            </div>

            <div className="mb-4">
               <table className="w-full border-collapse border border-black text-[12px]">
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
                        <td className="p-2 border-r border-black text-center">{trip.cnNumber || 'DRAFT'}</td>
                        <td className="p-2 border-r border-black text-center">{trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : '-'}</td>
                        <td className="p-2 border-r border-black text-center text-[10px]">{trip.from}</td>
                        <td className="p-2 border-r border-black text-center text-[10px]">{trip.via || trip.ratePoint || '-'}</td>
                        <td className="p-2 text-center text-[10px]">{trip.destination}</td>
                     </tr>
                  </tbody>
               </table>
            </div>

            <div className="mb-6">
               <table className="w-full border-collapse border border-black text-[12px]">
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
                        <td className="p-2 border-r border-black text-center text-[10px]">{trip.paymentTerms}</td>
                        <td className="p-2 border-r border-black text-center text-[10px]">{trip.mode}</td>
                        <td className="p-2 text-center text-[10px]">{trip.tripNo}</td>
                     </tr>
                  </tbody>
               </table>
            </div>

            <div className="grid grid-cols-3 gap-0 mb-6 border-none text-black">
               <div className="border-r border-black p-4 space-y-4 min-h-[160px]">
                  <h4 className="text-[9px] font-normal uppercase text-black italic mb-2 tracking-widest">Consignor</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1.5 text-black">
                     <p className="text-[11px] font-normal">{trip.consignor?.name || trip.consignorName}</p>
                     <p className="leading-relaxed text-black whitespace-pre-wrap">{trip.consignor?.address}</p>
                     <p>MOB: {trip.consignor?.mobile}</p>
                     <p className="text-[10px] pt-1 text-black font-normal">GSTIN: {trip.consignor?.gstNo}</p>
                  </div>
               </div>
               <div className="border-r border-black p-4 space-y-4 min-h-[160px]">
                  <h4 className="text-[9px] font-normal uppercase text-black italic mb-2 tracking-widest">Consignee</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1.5 text-black">
                     <p className="text-[11px] font-normal">{trip.consignee?.name || trip.consigneeName}</p>
                     <p className="leading-relaxed text-black whitespace-pre-wrap">{trip.consignee?.address}</p>
                     <p className="text-[10px] pt-1 text-black font-normal">GSTIN: {trip.consignee?.gstNo}</p>
                  </div>
               </div>
               <div className="p-4 space-y-4 min-h-[160px] bg-white text-black">
                  <h4 className="text-[9px] font-normal uppercase text-black italic mb-2 tracking-widest">Ship To Party</h4>
                  <div className="text-[10px] uppercase font-normal space-y-1.5 text-black">
                     <p className="text-[11px] font-normal">{trip.shipToPartyData?.name || trip.shipToParty}</p>
                     <p className="leading-relaxed text-black whitespace-pre-wrap">{trip.shipToPartyData?.address}</p>
                     <p>MOB: {trip.shipToPartyData?.mobile}</p>
                     <p className="text-[10px] pt-1 text-black font-normal">GSTIN: {trip.shipToPartyData?.gstNo}</p>
                  </div>
               </div>
            </div>

            <div className="mb-6 text-black">
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
                     {trip.invoices?.map((inv: any, i: number) => (
                        <tr key={i} className="border-b border-black last:border-b-0 uppercase font-normal text-black">
                           <td className="p-3 border-r border-black">{inv.invNo}</td>
                           <td className="p-3 border-r border-black">{inv.ewaybillNo}</td>
                           <td className="p-3 border-r border-black leading-snug text-[10px]">{inv.desc}</td>
                           <td className="p-3 border-r border-black text-center">{inv.pkg} {inv.uom}</td>
                           <td className="p-3 text-right">{i === 0 ? parseFloat(trip.assignWeight || 0).toFixed(3) : '-'}</td>
                        </tr>
                     ))}
                  </tbody>
                  <tfoot>
                     <tr className="bg-white font-normal text-[9px] uppercase border-t border-black text-black">
                        <td colSpan={3} className="p-4 text-right text-black italic border-none">Gross Total:</td>
                        <td className="p-4 text-center border-none font-normal">{packageSummary}</td>
                        <td className="p-4 text-right border-none font-normal">{parseFloat(trip.assignWeight || 0).toFixed(3)} MT</td>
                     </tr>
                  </tfoot>
               </table>
            </div>

            <div className="mt-auto space-y-10 text-black">
               <div className="flex justify-between items-end text-black">
                  <div className="space-y-4 max-w-[60%] text-black">
                     <h5 className="text-[8px] font-normal uppercase text-black tracking-widest italic border-b border-black w-fit pb-1">Terms & Conditions</h5>
                     <div className="space-y-1 text-black font-normal">
                        {termsList.map((term: string, i: number) => (
                           <p key={i} className="text-[8px] font-normal leading-relaxed text-justify text-black uppercase">
                              {term.trim()}
                           </p>
                        ))}
                     </div>
                  </div>
                  <div className="text-right space-y-12 pr-4 text-black font-normal">
                     <div className="h-14 text-black"></div>
                     <div className="space-y-1 text-black">
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
        .cn-page {
           width: 210mm;
           min-height: 297mm;
           box-sizing: border-box;
           background-color: white;
           color: black;
           font-weight: normal;
        }
        .cn-page * {
           color: black !important;
           border-color: black !important;
           font-weight: normal !important;
        }
      `}</style>
    </div>
  );
}
