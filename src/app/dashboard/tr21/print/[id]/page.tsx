
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { format } from 'date-fns';
import Image from 'next/image';
import { Loader2, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import placeholderData from '@/app/lib/placeholder-images.json';

const SHARED_HUB_ID = 'Sikkaind';

export default function CNPrintPage() {
  const params = useParams();
  const router = useRouter();
  const db = useFirestore();
  const id = params.id as string;

  const tripRef = useMemoFirebase(() => doc(db, 'users', SHARED_HUB_ID, 'trip_board', id), [db, id]);
  const { data: trip, isLoading: isTripLoading } = useDoc(tripRef);

  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const { data: companies } = useCollection(companiesQuery);
  const carrier = companies?.[0]; // Default to first registered company/carrier

  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const { data: customers } = useCollection(customersQuery);

  const consignor = React.useMemo(() => customers?.find(c => c.customerCode === trip?.consignorCode), [customers, trip]);
  const consignee = React.useMemo(() => customers?.find(c => c.customerCode === trip?.consigneeCode), [customers, trip]);
  const shipToParty = React.useMemo(() => customers?.find(c => c.customerCode === trip?.shipToPartyCode), [customers, trip]);

  const [deliveryAddr, setDeliveryAddr] = React.useState('');

  React.useEffect(() => {
    if (shipToParty) {
      setDeliveryAddr(shipToParty.address || '');
    }
  }, [shipToParty]);

  if (isTripLoading || !trip) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 font-mono">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Synchronizing Print Protocol...</span>
        </div>
      </div>
    );
  }

  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');

  const copies = ['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'];

  const totalPkg = trip.invoices?.reduce((acc: number, inv: any) => acc + (parseInt(inv.pkg) || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-slate-200 p-0 md:p-8 font-sans text-black overflow-y-auto print:bg-white print:p-0">
      <div className="max-w-[800px] mx-auto bg-white shadow-2xl no-print mb-8 rounded-sm border border-slate-300">
         <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase italic text-blue-900 tracking-tighter">Sikka Logistics Control Gateway</span>
               <span className="text-[8px] font-bold text-slate-400 uppercase">3-Copy A4 Print Matrix</span>
            </div>
            <div className="flex gap-2">
               <button onClick={() => window.print()} className="h-8 bg-blue-700 hover:bg-blue-800 text-white px-6 text-[10px] font-bold uppercase rounded-none transition-all flex items-center gap-2 shadow-lg"><Printer className="h-3.5 w-3.5" /> Print All</button>
               <button onClick={() => window.close()} className="h-8 bg-white border border-slate-300 text-slate-600 px-6 text-[10px] font-bold uppercase rounded-none hover:bg-slate-100 transition-all flex items-center gap-2"><X className="h-3.5 w-3.5" /> Close Tab</button>
            </div>
         </div>
      </div>

      <div id="printable-area" className="flex flex-col gap-0 bg-white">
        {copies.map((copyLabel, index) => (
          <div key={index} className="cn-page relative p-10 bg-white border-b-2 border-dashed border-slate-200 last:border-b-0 print:border-none print:m-0 print:page-break-after-always">
            
            {/* Header Section */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex flex-col gap-4">
                {logoAsset && <Image src={logoAsset.url} alt="Logo" width={140} height={60} className="object-contain" unoptimized />}
                <div className="space-y-0.5">
                  <h1 className="text-xl font-black uppercase italic tracking-tighter no-bold">{carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                  <p className="text-[9px] uppercase max-w-[300px] leading-tight text-slate-500 font-medium">{carrier?.address}</p>
                  <p className="text-[9px] uppercase font-medium">GSTIN: {carrier?.gstNo || 'UNREGISTERED'}</p>
                  <p className="text-[9px] uppercase font-medium">Contact: {carrier?.mobile} | Email: {carrier?.email}</p>
                  <p className="text-[9px] uppercase font-medium">Website: {carrier?.website || 'WWW.SIKKAENTERPRISES.COM'}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-6 text-right">
                <div className="border border-black px-4 py-1.5 text-[10px] font-black uppercase italic no-bold bg-slate-50">{copyLabel}</div>
                <div className="space-y-1">
                  <p className="text-[14px] font-black no-bold tracking-tighter">CN NO: {trip.cnNumber || 'DRAFT'}</p>
                  <p className="text-[10px] font-medium">DATE: {trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : '-'}</p>
                  <div className="pt-2 text-[9px] font-medium uppercase space-y-0.5 text-slate-500">
                    <p>FROM: <span className="text-black">{trip.from}</span></p>
                    {trip.mode === 'Road from Rail' && <p>VIA: <span className="text-blue-700">{trip.via}</span></p>}
                    <p>TO: <span className="text-black">{trip.destination}</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Details Table */}
            <div className="mb-6">
               <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                     <tr className="bg-slate-50 uppercase text-[8px] font-black text-slate-400 border-b border-black">
                        <th className="p-2 border-r border-black w-1/5 text-center font-medium">Vehicle Number</th>
                        <th className="p-2 border-r border-black w-1/5 text-center font-medium">Driver Mobile</th>
                        <th className="p-2 border-r border-black w-1/5 text-center font-medium">Payment Term</th>
                        <th className="p-2 border-r border-black w-1/5 text-center font-medium">Mode</th>
                        <th className="p-2 w-1/5 text-center font-medium">Trip ID</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr className="uppercase font-medium">
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
            <div className="grid grid-cols-3 gap-0 mb-6">
               <div className="border border-black border-r-0 p-4 space-y-3 min-h-[160px]">
                  <h4 className="text-[9px] font-black uppercase text-slate-400 italic mb-2 no-bold">Consignor</h4>
                  <div className="text-[10px] uppercase font-medium space-y-1">
                     <p className="font-black text-[11px] no-bold">{trip.consignorName}</p>
                     <p className="leading-tight text-slate-500 whitespace-pre-wrap">{consignor?.address}</p>
                     <p>MOB: {consignor?.mobile}</p>
                     <p className="text-[8px] pt-1">GSTIN: {consignor?.gstNo}</p>
                  </div>
               </div>
               <div className="border border-black border-r-0 p-4 space-y-3 min-h-[160px]">
                  <h4 className="text-[9px] font-black uppercase text-slate-400 italic mb-2 no-bold">Consignee</h4>
                  <div className="text-[10px] uppercase font-medium space-y-1">
                     <p className="font-black text-[11px] no-bold">{trip.consigneeName}</p>
                     <p className="leading-tight text-slate-500 whitespace-pre-wrap">{consignee?.address}</p>
                     <p className="text-[8px] pt-1">GSTIN: {consignee?.gstNo}</p>
                  </div>
               </div>
               <div className="border border-black p-4 space-y-3 min-h-[160px] bg-slate-50/30">
                  <h4 className="text-[9px] font-black uppercase text-slate-400 italic mb-2 no-bold">Ship To Party</h4>
                  <div className="text-[10px] uppercase font-medium space-y-1">
                     <p className="font-black text-[11px] no-bold">{trip.shipToParty}</p>
                     <p className="leading-tight text-slate-500 whitespace-pre-wrap">{shipToParty?.address}</p>
                     <p>MOB: {shipToParty?.mobile}</p>
                     <p className="text-[8px] pt-1">GSTIN: {shipToParty?.gstNo}</p>
                  </div>
               </div>
            </div>

            {/* Document & Items Table */}
            <div className="mb-6">
               <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                     <tr className="bg-slate-50 uppercase text-[8px] font-black text-slate-400 border-b border-black">
                        <th className="p-2 border-r border-black w-[120px] font-medium">Invoice No</th>
                        <th className="p-2 border-r border-black w-[150px] font-medium">E-Waybill No</th>
                        <th className="p-2 border-r border-black font-medium">Description</th>
                        <th className="p-2 border-r border-black w-[100px] text-center font-medium">Package</th>
                        <th className="p-2 w-[100px] text-right font-medium">Weight (MT)</th>
                     </tr>
                  </thead>
                  <tbody>
                     {trip.invoices?.map((inv: any, i: number) => (
                        <tr key={i} className="border-b border-black last:border-b-0 uppercase font-medium">
                           <td className="p-3 border-r border-black">{inv.invNo}</td>
                           <td className="p-3 border-r border-black">{inv.ewaybillNo}</td>
                           <td className="p-3 border-r border-black leading-tight">{inv.desc}</td>
                           <td className="p-3 border-r border-black text-center">{inv.pkg} {inv.uom}</td>
                           <td className="p-3 text-right">{i === 0 ? trip.assignWeight : '-'}</td>
                        </tr>
                     ))}
                     {(!trip.invoices || trip.invoices.length === 0) && (
                        <tr><td colSpan={5} className="p-10 text-center italic text-slate-300">No Items Registered</td></tr>
                     )}
                  </tbody>
                  <tfoot>
                     <tr className="bg-slate-50 border-t border-black font-medium text-[9px] uppercase">
                        <td colSpan={3} className="p-3 text-right text-slate-400">Total Registered Payload:</td>
                        <td className="p-3 text-center text-blue-900">{totalPkg} PACKAGES</td>
                        <td className="p-3 text-right text-blue-900">{trip.assignWeight} MT</td>
                     </tr>
                  </tfoot>
               </table>
            </div>

            {/* Acknowledgement Box */}
            <div className="border border-black mb-6">
               <div className="bg-slate-50 p-2 border-b border-black text-[9px] font-black uppercase italic no-bold">Delivery Address Acknowledgement</div>
               <div className="p-4 grid grid-cols-2 gap-10">
                  <div className="space-y-2">
                     <label className="text-[8px] font-black text-slate-400 uppercase no-bold">Delivery Point Details</label>
                     <textarea 
                        value={deliveryAddr} 
                        onChange={e => setDeliveryAddr(e.target.value.toUpperCase())}
                        className="w-full h-16 border-none bg-transparent text-[10px] font-medium uppercase resize-none outline-none leading-relaxed p-0"
                     />
                  </div>
                  <div className="flex flex-col justify-end items-end">
                     <div className="w-48 border-t border-black pt-1.5 text-center">
                        <p className="text-[9px] font-black uppercase tracking-tighter no-bold">Authorized Signatory</p>
                        <p className="text-[7px] text-slate-400 italic">Electronic Protocol Approved</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Terms & Note Section */}
            <div className="space-y-6">
               <div className="space-y-2">
                  <h5 className="text-[8px] font-black uppercase text-slate-400 no-bold">Terms & Conditions</h5>
                  <p className="text-[8px] leading-relaxed text-justify text-slate-500 uppercase font-medium">
                     1. The carrier is not responsible for any loss or damage to the goods if not informed at the time of delivery.
                     2. All disputes are subject to the jurisdiction of the registered corporate office location only.
                     3. The weight mentioned is as per the party declaration.
                     4. Demurrage and storage charges as applicable if delivery not taken within 24 hours of arrival.
                     5. No illegal or hazardous goods allowed without prior declaration and documentation.
                  </p>
               </div>
               <div className="text-center pt-4">
                  <p className="text-[10px] font-black uppercase tracking-tight no-bold italic">
                     Note: This Consignment Note was generated digitally and is to be considered as original.
                  </p>
               </div>
            </div>

            {/* Footer Seal Area */}
            <div className="absolute bottom-6 left-10 text-[7px] font-black text-slate-300 uppercase tracking-widest no-bold">
               SLMC V1.0 • SYSTEM TRACE ID: {trip.id}
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
            padding: 15mm !important;
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
