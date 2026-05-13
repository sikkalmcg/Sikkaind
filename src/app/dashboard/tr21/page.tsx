
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Printer, Save, ChevronLeft, ChevronRight, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

const formatWeight = (val: any) => {
  const num = parseFloat(val);
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export default function TR21Page() {
  const router = useRouter();
  const db = useFirestore();
  const [activeTab, setActiveTab] = React.useState('Open Orders');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedItem, setSelectedItem] = React.useState<any>(null);
  const [showAssign, setShowAssign] = React.useState(false);
  const [showCnPreview, setShowCnPreview] = React.useState(false);
  const [cnData, setCnData] = React.useState<any>({});

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: plants } = useCollection(plantsQuery);
  const { data: customers } = useCollection(customersQuery);

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];

  const filteredData = React.useMemo(() => {
    if (!orders || !trips) return [];
    if (activeTab === 'Open Orders') {
      return orders.filter(o => o.status !== 'Short closed').map(o => {
        const ass = trips.filter(t => t.saleOrderId === o.id).reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        return { ...o, ass, bal: (parseFloat(o.weight) || 0) - ass };
      }).filter(o => o.bal > 0);
    }
    const statusMap: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
    return trips.filter(t => t.status === statusMap[activeTab]);
  }, [orders, trips, activeTab]);

  const paginated = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  const handleAssign = (data: any) => {
    const tripId = `T${Date.now().toString().slice(-8)}`;
    const newTrip = {
      ...data,
      id: crypto.randomUUID(),
      tripId,
      saleOrderId: selectedItem.id,
      saleOrderNumber: selectedItem.saleOrder,
      plantCode: selectedItem.plantCode,
      shipToParty: selectedItem.shipToParty,
      status: 'LOADING',
      createdAt: new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', newTrip.id), newTrip, { merge: true });
    setShowAssign(false);
  };

  const generateCn = (trip: any) => {
    const consignor = customers?.find(c => c.customerCode === trip.consignorId || c.customerName === trip.consignor);
    const shipTo = customers?.find(c => c.customerCode === trip.shipToPartyId || c.customerName === trip.shipToParty);
    const consignee = customers?.find(c => c.customerCode === trip.consigneeId || c.customerName === trip.consignee);
    
    setCnData({
      ...trip,
      consignorData: consignor,
      shipToData: shipTo,
      consigneeData: consignee,
      copies: ['CONSIGNEE COPY', 'CONSIGNOR COPY', 'DRIVER COPY']
    });
    setShowCnPreview(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 flex items-center justify-between shadow-sm">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">TR21 – TRIP BOARD CONTROL HUB</h2>
      </div>

      <div className="flex-1 flex flex-col p-8 overflow-hidden">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0 transition-all", activeTab === t ? "bg-white text-[#0056d2] shadow-sm" : "text-slate-500 hover:bg-white/50")}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300">
              <tr className="text-[9px] font-black uppercase text-slate-500">
                <th className="p-3 border-r">Plant</th>
                <th className="p-3 border-r">Identifier</th>
                <th className="p-3 border-r">Fleet Type</th>
                <th className="p-3 border-r">Destination</th>
                <th className="p-3 border-r">Vehicle No</th>
                <th className="p-3 border-r">Weight</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold uppercase text-[11px]">
              {paginated.map((item: any) => (
                <tr key={item.id} className="hover:bg-blue-50/30">
                  <td className="p-3 border-r">{item.plantCode}</td>
                  <td className="p-3 border-r text-[#0056d2] font-black">{item.tripId || item.saleOrder}</td>
                  <td className="p-3 border-r">{item.vehicleType || '-'}</td>
                  <td className="p-3 border-r truncate max-w-[200px]">{item.destination || item.shipToParty}</td>
                  <td className="p-3 border-r">{item.vehicleNumber || 'PENDING'}</td>
                  <td className="p-3 border-r text-emerald-600">{formatWeight(item.assignWeight || item.weight)}</td>
                  <td className="p-3">
                    {activeTab === 'Open Orders' ? (
                      <Button onClick={() => { setSelectedItem(item); setShowAssign(true); }} size="sm" className="h-7 text-[9px] font-black uppercase bg-[#0056d2] rounded-none">Assign</Button>
                    ) : (
                      <div className="flex gap-2">
                        {['POD Verify', 'Closed'].includes(activeTab) && <Button onClick={() => generateCn(item)} variant="outline" className="h-7 px-3 text-[9px] font-black rounded-none uppercase"><Printer className="h-3 w-3 mr-1" /> CN</Button>}
                        <Button variant="ghost" className="h-7 text-[9px] font-black border border-slate-200 uppercase rounded-none">Process</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 bg-white border border-slate-300 p-2 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex gap-2 items-center">
            <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
            <input type="number" min="1" max={totalPages} value={currentPage} onChange={e => setCurrentPage(Number(e.target.value))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black" />
            <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400">Registry Page {currentPage} of {totalPages || 1}</span>
        </div>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-2xl rounded-none border-[4px] border-[#0056d2] font-mono">
           <DialogHeader><DialogTitle className="text-sm font-black uppercase italic">Logistics Node Assignment: {selectedItem?.saleOrder}</DialogTitle></DialogHeader>
           <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number *</label><input id="vno" className="h-9 w-full border border-slate-400 px-3 text-xs font-black uppercase" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Fleet Type *</label><select id="ftype" className="h-9 w-full border border-slate-400 px-2 text-xs font-black uppercase"><option value="OWN FLEET">OWN FLEET</option><option value="CONTRACT">CONTRACT</option><option value="MARKET VEHICLE">MARKET VEHICLE</option></select></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Assign Weight ({selectedItem?.weightUom}) *</label><input id="qty" type="number" defaultValue={selectedItem?.bal} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Mode *</label><select id="mode" className="h-9 w-full border border-slate-400 px-2 text-xs font-black uppercase"><option value="ROAD">ROAD</option><option value="RAIL">RAIL</option><option value="AIR">AIR</option><option value="SHIP">SHIP</option></select></div>
              </div>
              <Button onClick={() => {
                const data = {
                  vehicleNumber: (document.getElementById('vno') as any).value.toUpperCase(),
                  vehicleType: (document.getElementById('ftype') as any).value,
                  assignWeight: (document.getElementById('qty') as any).value,
                  mode: (document.getElementById('mode') as any).value
                };
                if (!data.vehicleNumber || !data.assignWeight) return alert('Mandatory fields missing');
                if (parseFloat(data.assignWeight) > selectedItem.bal) return alert('Exceeds balance quantity');
                handleAssign(data);
              }} className="w-full h-10 bg-[#0056d2] text-white rounded-none font-black uppercase text-[11px] shadow-lg">Synchronize Node</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* CN Preview Dialog */}
      <Dialog open={showCnPreview} onOpenChange={setShowCnPreview}>
        <DialogContent className="max-w-[1000px] max-h-[90vh] overflow-y-auto rounded-none p-0 border-none font-mono">
           <div className="bg-slate-800 p-4 sticky top-0 z-50 flex justify-between items-center print:hidden">
              <h2 className="text-white text-xs font-black uppercase tracking-widest">Document Node Preview: Consignment Note</h2>
              <div className="flex gap-4">
                <Button onClick={() => window.print()} className="h-8 bg-emerald-600 rounded-none text-[10px] font-black uppercase px-6"><Printer className="h-3.5 w-3.5 mr-2" /> Print A4 (F10)</Button>
                <Button onClick={() => setShowCnPreview(false)} className="h-8 bg-white/10 text-white rounded-none text-[10px] font-black uppercase px-4"><X className="h-3.5 w-3.5" /></Button>
              </div>
           </div>

           <div id="printable-area" className="bg-white p-10 space-y-12">
              {(cnData.copies || []).map((copy: string) => (
                <div key={copy} className="cn-print-page border-2 border-black p-8 flex flex-col relative min-h-[1100px] mb-20 last:mb-0">
                  <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                     <div className="space-y-1">
                        <h1 className="text-2xl font-black text-[#1e3a8a] italic uppercase tracking-tighter">Sikka Industries & Logistics</h1>
                        <p className="text-[10px] font-black uppercase text-slate-500">Logistics Node Control • ISO 9001:2015 Certified</p>
                     </div>
                     <div className="text-right">
                        <Badge className="bg-black text-white rounded-none text-[10px] font-black px-4 py-1 mb-2">{copy}</Badge>
                        <p className="text-[10px] font-black uppercase">CN NO: <span className="text-red-600">{cnData.cnNumber || 'DRAFT'}</span></p>
                        <p className="text-[10px] font-black uppercase">DATE: {format(new Date(), 'dd-MM-yyyy')}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-black border border-black mb-8">
                     <div className="bg-white p-4 space-y-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 block pb-1">Consignor (From)</span>
                        <p className="text-[12px] font-black uppercase">{cnData.consignor}</p>
                        <p className="text-[10px] font-bold uppercase text-slate-600 leading-tight">{cnData.consignorData?.address || 'AS PER REGISTRY'}</p>
                        <p className="text-[10px] font-black uppercase">GSTIN: {cnData.consignorData?.gstin || '-'}</p>
                     </div>
                     <div className="bg-white p-4 space-y-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 block pb-1">Consignee (To)</span>
                        <p className="text-[12px] font-black uppercase">{cnData.consignee}</p>
                        <p className="text-[10px] font-bold uppercase text-slate-600 leading-tight">{cnData.consigneeData?.address || 'AS PER REGISTRY'}</p>
                        <p className="text-[10px] font-black uppercase">GSTIN: {cnData.consigneeData?.gstin || '-'}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 gap-px bg-black border border-black mb-8 text-[11px] font-black uppercase">
                     <div className="bg-slate-50 p-3 text-center">Vehicle: {cnData.vehicleNumber}</div>
                     <div className="bg-slate-50 p-3 text-center">Type: {cnData.vehicleType}</div>
                     <div className="bg-slate-50 p-3 text-center">Mode: {cnData.mode || 'ROAD'}</div>
                  </div>

                  <table className="w-full border-collapse border border-black mb-10">
                     <thead className="bg-slate-100 text-[10px] font-black uppercase">
                        <tr>
                           <th className="border border-black p-3 w-32">Invoice No</th>
                           <th className="border border-black p-3">Description of Goods</th>
                           <th className="border border-black p-3 w-32">Pkg / UOM</th>
                           <th className="border border-black p-3 w-32">Weight (MT)</th>
                        </tr>
                     </thead>
                     <tbody className="text-[11px] font-bold uppercase">
                        <tr className="h-40 align-top">
                           <td className="border border-black p-3 text-center">{cnData.invoiceNo || '-'}</td>
                           <td className="border border-black p-3">
                              <p className="font-black mb-2">{cnData.product || 'CARGO ITEMS'}</p>
                              <p className="text-[9px] text-slate-500 normal-case italic">Sale Order: {cnData.saleOrderNumber}</p>
                           </td>
                           <td className="border border-black p-3 text-center">1 {cnData.weightUom || 'MT'}</td>
                           <td className="border border-black p-3 text-center font-black text-blue-700">{formatWeight(cnData.assignWeight)}</td>
                        </tr>
                     </tbody>
                  </table>

                  <div className="flex-1" />
                  <div className="flex justify-between items-end border-t-2 border-black pt-10">
                     <div className="w-1/2 text-[9px] font-bold text-slate-500 uppercase italic">
                        * All goods are carried at owner's risk.<br />
                        * Subject to Ghaziabad jurisdiction only.
                     </div>
                     <div className="text-center w-64 space-y-16">
                        <div className="h-px bg-slate-200" />
                        <span className="text-[10px] font-black uppercase block">Authorized Signatory</span>
                     </div>
                  </div>
                </div>
              ))}
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
