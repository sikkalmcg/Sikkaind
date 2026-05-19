'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { format } from 'date-fns';
import Image from 'next/image';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';

const SHARED_HUB_ID = 'Sikkaind';

/**
 * @fileOverview Secure Public CN Preview Protocol.
 * Mimics a PDF viewer interface. Strictly read-only.
 * Disables text selection and context menu to satisfy "no download/edit" conditions.
 */
export default function PublicCNPreviewPage() {
  const params = useParams();
  const db = useFirestore();
  const id = params.id as string;

  // Interaction Lockdown: Prevent right-click and selection
  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  const tripRef = useMemoFirebase(() => {
    if (!id) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'trip_board', id);
  }, [db, id]);
  const { data: trip, isLoading: isTripLoading } = useDoc(tripRef);

  const companiesQuery = useMemoFirebase(() => {
    return collection(db, 'users', SHARED_HUB_ID, 'companies');
  }, [db]);
  const { data: companies } = useCollection(companiesQuery);
  
  const customersQuery = useMemoFirebase(() => {
    return collection(db, 'users', SHARED_HUB_ID, 'customers');
  }, [db]);
  const { data: customers } = useCollection(customersQuery);

  const carrier = React.useMemo(() => {
    if (!trip || !companies) return null;
    return companies.find(c => c.companyName === trip.carrierName) || companies[0];
  }, [trip, companies]);

  const consignor = React.useMemo(() => customers?.find(c => c.customerCode === trip?.consignorCode), [customers, trip]);
  const consignee = React.useMemo(() => customers?.find(c => c.customerCode === trip?.consigneeCode), [customers, trip]);
  const shipToParty = React.useMemo(() => customers?.find(c => c.customerCode === trip?.shipToPartyCode), [customers, trip]);

  if (isTripLoading || !trip) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#525659] font-mono">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
          <span className="text-[10px] font-normal uppercase tracking-[0.4em]">Establishing Secure Link...</span>
        </div>
      </div>
    );
  }

  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');
  const copies = ['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'];
  const totalPkg = trip.invoices?.reduce((acc: number, inv: any) => acc + (parseInt(inv.pkg) || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-[#525659] p-4 md:p-8 font-sans text-black overflow-y-auto select-none">
      {/* Simulation of PDF Viewer Chrome */}
      <div className="max-w-[210mm] mx-auto bg-[#323639] h-12 flex items-center justify-between px-6 shadow-md mb-1 rounded-t-sm sticky top-0 z-50">
        <div className="flex items-center gap-3 text-white/90">
          <FileText className="h-4 w-4 text-blue-400" />
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] truncate max-w-[300px]">
            DOCUMENT_{trip.cnNumber || 'PREVIEW'}_{trip.tripNo}.pdf
          </span>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-black text-white/40 uppercase tracking-widest italic">
          <AlertCircle className="h-3 w-3" /> Secure Preview Only
        </div>
      </div>

      <div id="printable-area" className="flex flex-col gap-4 mx-auto w-fit shadow-2xl">
        {copies.map((copyLabel, index) => (
          <div key={index} className="cn-page relative p-10 bg-white border-b border-slate-100 last:border-b-0 print:border-none print:m-0 print:page-break-after-always overflow-hidden">
            
            {/* Header Section */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex flex-col gap-5">
                {logoAsset && <Image src={logoAsset.url} alt="Logo" width={150} height={70} className="object-contain grayscale" unoptimized />}
                <div className="space-y-1">
                  <h1 className="text-xl font-normal uppercase italic tracking-tighter">{carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                  <p className="text-[10px] uppercase max-w-[350px] leading-tight text-slate-600 font-normal">{carrier?.address}</p>
                  <p className="text-[10px] uppercase font-normal pt-1">GSTIN: {carrier?.gstNo || 'UNREGISTERED'}</p>
                  <p className="text-[10px] uppercase font-normal">Contact: {carrier?.mobile} | Email: {carrier?.email}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-8 text-right">
                <div className="border border-black px-5 py-2 text-[11px] font-normal uppercase italic bg-slate-50 tracking-widest">{copyLabel}</div>
                <div className="space-y-1.5">
                  <p className="text-[16px] font-normal tracking-tighter">CN NO: {trip.cnNumber || 'DRAFT'}</p>
                  <p className="text-[11px] font-normal">DATE: {trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : '-'}</p>
                  <div className="pt-3 text-[10px] font-normal uppercase space-y-1 text-slate-600">
                    <p>FROM: <span className="text-black">{trip.from}</span></p>
                    {trip.mode === 'Road from Rail' && <p>VIA: <span className="text-blue-700">{trip.via || trip.ratePoint}</span></p>}
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
                  <h4 className="text-[10px] font-normal uppercase text-slate-400 italic mb-2 tracking-widest">Ship To Party</h4>
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
                  </tbody>
                  <tfoot>
                     <tr className="bg-slate-50 border-t border-black font-normal text-[10px] uppercase">
                        <td colSpan={3} className="p-4 text-right text-slate-400 italic">Total Operational Payload:</td>
                        <td className="p-4 text-center border-x border-black">{totalPkg} PACKAGES</td>
                        <td className="p-4 text-right">{trip.assignWeight} MT</td>
                     </tr>
                  </tfoot>
               </table>
            </div>

            {/* Acknowledgement Box */}
            <div className="border border-black mb-8">
               <div className="bg-slate-50 p-2.5 border-b border-black text-[10px] font-normal uppercase italic tracking-wider">Delivery Point Reference</div>
               <div className="p-5 min-h-[100px]">
                  <p className="text-[11px] font-normal uppercase italic leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {shipToParty?.address || 'AS PER DOCUMENTATION'}
                  </p>
               </div>
            </div>

            {/* Terms & Note Section */}
            <div className="space-y-8">
               <div className="space-y-2.5">
                  <p className="text-[9px] leading-relaxed text-justify text-slate-500 uppercase font-normal">
                     1. The carrier holds no liability for shortage not reported at arrival. 2. All disputes fall under corporate HQ jurisdiction. 3. Weight based on party declarations.
                  </p>
               </div>
               <div className="text-center pt-6 border-t border-slate-100">
                  <p className="text-[11px] font-normal uppercase tracking-tighter italic text-slate-400">
                     Note: This Consignment Note was generated digitally and is to be considered as original.
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
        }
      `}</style>
    </div>
  );
}
