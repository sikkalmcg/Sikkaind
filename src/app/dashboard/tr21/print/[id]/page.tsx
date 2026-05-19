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
 * Generates a 3-copy system (Consignee, Driver, Consignor) for standard A4 portrait.
 * Includes automated PDF generation, download, and auto-open functionality.
 */
export default function CNPrintPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const id = params.id as string;
  const { user, isUserLoading: isAuthLoading } = useUser();
  const isAuto = searchParams.get('auto') === 'true';

  const [generating, setGenerating] = React.useState(false);

  // Data Fetching - Memoized to wait for authenticated user
  const tripRef = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'trip_board', id);
  }, [db, id, user, isAuthLoading]);
  const { data: trip, isLoading: isTripLoading } = useDoc(tripRef);

  const companiesQuery = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'companies');
  }, [db, user, isAuthLoading]);
  const { data: companies } = useCollection(companiesQuery);
  
  const customersQuery = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'customers');
  }, [db, user, isAuthLoading]);
  const { data: customers } = useCollection(customersQuery);

  const carrier = React.useMemo(() => {
    if (!trip || !companies) return null;
    return companies.find(c => c.companyName === trip.carrierName) || companies[0];
  }, [trip, companies]);

  const consignor = React.useMemo(() => customers?.find(c => c.customerCode === trip?.consignorCode), [customers, trip]);
  const consignee = React.useMemo(() => customers?.find(c => c.customerCode === trip?.consigneeCode), [customers, trip]);
  const shipToParty = React.useMemo(() => customers?.find(c => c.customerCode === trip?.shipToPartyCode), [customers, trip]);

  const [deliveryAddr, setDeliveryAddr] = React.useState('');

  React.useEffect(() => {
    if (shipToParty) setDeliveryAddr(shipToParty.address || '');
  }, [shipToParty]);

  const generateAndDownload = React.useCallback(async () => {
    if (!trip || generating) return;
    
    // Ensure images are fully loaded
    const images = document.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));

    // Wait for layout stability
    await new Promise(r => setTimeout(r, 1000));
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

      const fileName = `CN-${trip.cnNumber || 'DRAFT'}.pdf`;
      
      // Auto Download
      pdf.save(fileName);

      // Transform current page into PDF viewer
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
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

  if (isTripLoading || isAuthLoading || !trip) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 font-mono">
        <div className="flex flex-col items-center gap-4 text-black">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          <span className="text-[10px] font-normal uppercase tracking-[0.3em]">Synchronizing Print Protocol...</span>
        </div>
      </div>
    );
  }

  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');
  const copies = ['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'];
  const totalPkg = trip.invoices?.reduce((acc: number, inv: any) => acc + (parseInt(inv.pkg) || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-slate-200 p-0 md:p-8 font-sans text-black overflow-y-auto print:bg-white print:p-0">
      
      {generating && (
        <div className="fixed inset-0 bg-[#323639] z-[200] flex flex-col items-center justify-center gap-6 text-white font-mono">
          <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
          <div className="text-center space-y-2">
            <p className="text-[12px] font-normal uppercase tracking-[0.4em]">Protocol Execution: PDF Generation</p>
            <p className="text-[9px] font-normal text-slate-400 uppercase italic tracking-widest">Generating CN-{trip.cnNumber}. Do not close this tab.</p>
          </div>
        </div>
      )}

      {/* Interactive Toolbar */}
      {!generating && !isAuto && (
        <div className="max-w-[850px] mx-auto bg-white shadow-2xl no-print mb-8 rounded-sm border border-slate-300 sticky top-0 z-[100]">
           <div className="p-4 flex justify-between items-center bg-slate-50">
              <div className="flex flex-col text-left">
                 <span className="text-[11px] font-normal uppercase italic text-blue-900 tracking-tighter">Sikka Logistics Management Protocol</span>
                 <span className="text-[9px] font-normal text-slate-400 uppercase">A4 Multi-Copy Matrix</span>
              </div>
              <div className="flex gap-3">
                 <button 
                  onClick={() => window.print()} 
                  className="h-9 bg-blue-700 hover:bg-blue-800 text-white px-8 text-[11px] font-normal uppercase rounded-none transition-all flex items-center gap-2 shadow-md active:scale-95"
                 >
                   <Printer className="h-4 w-4" /> Print Protocol
                 </button>
                 <button 
                  onClick={() => window.close()} 
                  className="h-9 bg-white border border-slate-300 text-slate-600 px-8 text-[11px] font-normal uppercase rounded-none hover:bg-slate-100 transition-all flex items-center gap-2 active:scale-95"
                 >
                   <X className="h-4 w-4" /> Exit
                 </button>
              </div>
           </div>
        </div>
      )}

      <div id="printable-area" className="flex flex-col gap-0 bg-white shadow-inner mx-auto w-fit print:shadow-none print:w-full">
        {copies.map((copyLabel, index) => (
          <div key={index} className="cn-page relative p-10 bg-white border-b-2 border-dashed border-slate-200 last:border-b-0 print:border-none print:m-0 print:page-break-after-always overflow-hidden text-left">
            
            {/* Header Section */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex flex-col gap-5">
                {logoAsset && <Image src={logoAsset.url} alt="Logo" width={150} height={70} className="object-contain" unoptimized />}
                <div className="space-y-1">
                  <h1 className="text-xl font-normal uppercase italic tracking-tighter">{carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                  <p className="text-[10px] uppercase max-w-[350px] leading-tight text-slate-600 font-normal">{carrier?.address}</p>
                  <p className="text-[10px] uppercase font-normal pt-1">GSTIN: {carrier?.gstNo || 'UNREGISTERED'}</p>
                  <p className="text-[10px] uppercase font-normal">Contact: {carrier?.mobile} | Email: {carrier?.email}</p>
                  <p className="text-[10px] uppercase font-normal">Website: {carrier?.website || 'WWW.SIKKAENTERPRISES.COM'}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-8 text-right">
                <div className="border border-black px-5 py-2 text-[11px] font-normal uppercase italic bg-slate-50 tracking-widest">{copyLabel}</div>
                <div className="space-y-1.5">
                  <p className="text-[16px] font-normal tracking-tighter">CN NO: {trip.cnNumber || 'DRAFT'}</p>
                  <p className="text-[11px] font-normal">DATE: {trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : '-'}</p>
                  <div className="pt-3 text-[10px] font-normal uppercase space-y-1 text-slate-600">
                    <p>FROM: <span className="text-black">{trip.from}</span></p>
                    {trip.mode === 'Road from Rail' && <p>VIA: <span className="text-blue-700">{trip.via}</span></p>}
                    <p>TO: <span className="text-black">{trip.destination}</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Details Table */}
            <div className="mb-8">
               <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                     <tr className="bg-slate-50 uppercase text-[9px] font-normal text-slate-500 border-b border-black">
                        <th className="p-2 border-r border-black w-1/5 text-center font-normal">Vehicle Number</th>
                        <th className="p-2 border-r border-black w-1/5 text-center font-normal">Driver Mobile</th>
                        <th className="p-2 border-r border-black w-1/5 text-center font-normal">Payment Term</th>
                        <th className="p-2 border-r border-black w-1/5 text-center font-normal">Mode</th>
                        <th className="p-2 w-1/5 text-center font-normal">Trip ID</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr className="uppercase font-normal">
                        <td className="p-3 border-r border-black text-center">{trip.vehicleNo}</td>
                        <td className="p-3 border-r border-black text-center">{trip.driverMobile || '-'}</td>
                        <td className="p-3 border-r border-black text-center">{trip.paymentTerms}</td>
                        <td className="p-3 border-r border-black text-center">{trip.mode}</td>
                        <td className="p-3 text-center">{trip.tripNo}</td>
                     </tr>
                  </tbody>
               </table>
            </div>

            {/* Party Details Section */}
            <div className="grid grid-cols-3 gap-0 mb-8">
               <div className="border border-black border-r-0 p-5 space-y-4 min-h-[180px]">
                  <h4 className="text-[10px] font-normal uppercase text-slate-400 italic mb-2 tracking-widest">Consignor</h4>
                  <div className="text-[11px] uppercase font-normal space-y-1.5">
                     <p className="text-[12px]">{trip.consignorName}</p>
                     <p className="leading-relaxed text-slate-600 whitespace-pre-wrap">{consignor?.address}</p>
                     <p>MOB: {consignor?.mobile}</p>
                     <p className="text-[9px] pt-1 text-slate-500 font-mono">GSTIN: {consignor?.gstNo}</p>
                  </div>
               </div>
               <div className="border border-black border-r-0 p-5 space-y-4 min-h-[180px]">
                  <h4 className="text-[10px] font-normal uppercase text-slate-400 italic mb-2 tracking-widest">Consignee</h4>
                  <div className="text-[11px] uppercase font-normal space-y-1.5">
                     <p className="text-[12px]">{trip.consigneeName}</p>
                     <p className="leading-relaxed text-slate-600 whitespace-pre-wrap">{consignee?.address}</p>
                     <p className="text-[9px] pt-1 text-slate-500 font-mono">GSTIN: {consignee?.gstNo}</p>
                  </div>
               </div>
               <div className="border border-black p-5 space-y-4 min-h-[180px] bg-slate-50/20">
                  <h4 className="text-[10px) font-normal uppercase text-slate-400 italic mb-2 tracking-widest">Ship To Party</h4>
                  <div className="text-[11px] uppercase font-normal space-y-1.5">
                     <p className="text-[12px]">{trip.shipToParty}</p>
                     <p className="leading-relaxed text-slate-600 whitespace-pre-wrap">{shipToParty?.address}</p>
                     <p>MOB: {shipToParty?.mobile}</p>
                     <p className="text-[9px] pt-1 text-slate-500 font-mono">GSTIN: {shipToParty?.gstNo}</p>
                  </div>
               </div>
            </div>

            {/* Document & Items Table */}
            <div className="mb-8">
               <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                     <tr className="bg-slate-50 uppercase text-[9px] font-normal text-slate-500 border-b border-black">
                        <th className="p-2 border-r border-black w-[130px] text-left font-normal">Invoice No</th>
                        <th className="p-2 border-r border-black w-[160px] text-left font-normal">E-Waybill No</th>
                        <th className="p-2 border-r border-black text-left font-normal">Description</th>
                        <th className="p-2 border-r border-black w-[110px] text-center font-normal">Package</th>
                        <th className="p-2 w-[110px] text-right font-normal">Weight (MT)</th>
                     </tr>
                  </thead>
                  <tbody>
                     {trip.invoices?.map((inv: any, i: number) => (
                        <tr key={i} className="border-b border-black last:border-b-0 uppercase font-normal">
                           <td className="p-3 border-r border-black">{inv.invNo}</td>
                           <td className="p-3 border-r border-black">{inv.ewaybillNo}</td>
                           <td className="p-3 border-r border-black leading-snug">{inv.desc}</td>
                           <td className="p-3 border-r border-black text-center">{inv.pkg} {inv.uom}</td>
                           <td className="p-3 text-right">{i === 0 ? trip.assignWeight : '-'}</td>
                        </tr>
                     ))}
                     {(!trip.invoices || trip.invoices.length === 0) && (
                        <tr><td colSpan={5} className="p-16 text-center italic text-slate-300 uppercase tracking-widest text-[9px]">No Items Registered for this execution node</td></tr>
                     )}
                  </tbody>
                  <tfoot>
                     <tr className="bg-slate-50 border-t border-black font-normal text-[10px] uppercase">
                        <td colSpan={3} className="p-4 text-right text-slate-400 italic">Total Operational Payload:</td>
                        <td className="p-4 text-center text-blue-900 border-x border-black">{totalPkg} PACKAGES</td>
                        <td className="p-4 text-right text-blue-900">{trip.assignWeight} MT</td>
                     </tr>
                  </tfoot>
               </table>
            </div>

            {/* Acknowledgement Box */}
            <div className="border border-black mb-8">
               <div className="bg-slate-50 p-2.5 border-b border-black text-[10px] font-normal uppercase italic tracking-wider">Delivery Point Acknowledgement & Trace</div>
               <div className="p-5 grid grid-cols-2 gap-12">
                  <div className="space-y-3">
                     <label className="text-[9px] font-normal text-slate-400 uppercase tracking-widest">Authorized Delivery Point</label>
                     <textarea 
                        value={deliveryAddr} 
                        onChange={e => setDeliveryAddr(e.target.value.toUpperCase())}
                        className="w-full h-20 border-none bg-transparent text-[11px] font-normal uppercase resize-none outline-none leading-relaxed p-0 italic text-slate-700"
                        placeholder="SPECIFY EXACT DROP POINT..."
                     />
                  </div>
                  <div className="flex flex-col justify-end items-end">
                     <div className="w-56 border-t border-black pt-2 text-center">
                        <p className="text-[10px] font-normal uppercase tracking-widest">Authorized Signatory</p>
                        <p className="text-[8px] text-slate-400 italic pt-0.5">Electronically Verified Node</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Terms & Note Section */}
            <div className="space-y-8">
               <div className="space-y-2.5">
                  <h5 className="text-[9px] font-normal uppercase text-slate-400 tracking-widest italic">Standard Operational Terms</h5>
                  <p className="text-[9px] leading-relaxed text-justify text-slate-500 uppercase font-normal">
                     1. The carrier holds no liability for any undetected shortage or damage not reported at the arrival gate node.
                     2. All logistical disputes fall under the jurisdiction of the corporate headquarters registered office.
                     3. The weight registry is based strictly on party declarations and original invoice records.
                     4. Detention or storage tariffs apply if unloading is not initiated within 24 hours of documented arrival.
                     5. Transport of prohibited or hazardous items is strictly forbidden without advanced regulatory clearance.
                  </p>
               </div>
               <div className="text-center pt-6 border-t border-slate-100">
                  <p className="text-[11px] font-normal uppercase tracking-tighter italic text-slate-400">
                     Note: This document is a digital representation of the Sikka Logistical Protocol and functions as the primary original.
                  </p>
               </div>
            </div>

            {/* Footer Seal Area */}
            <div className="absolute bottom-8 left-10 text-[8px] font-normal text-slate-300 uppercase tracking-[0.5em]">
               SIKKA LMC V1.0 • SYSTEM HASH: {trip.id.substring(0, 12)}
            </div>

          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .cn-page {
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            border: none !important;
            padding: 20mm !important;
            page-break-after: always;
            box-shadow: none !important;
          }
          textarea {
            border: none !important;
            overflow: hidden !important;
            background: transparent !important;
          }
        }
        .cn-page {
           width: 210mm;
           min-height: 297mm;
           box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}