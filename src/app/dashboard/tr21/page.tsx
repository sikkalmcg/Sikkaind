'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ChevronLeft, ChevronRight, X, Download, AlertTriangle, 
  CheckCircle, Search, Edit3, Trash2, MapPin, Truck, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, onSnapshot } from 'firebase/firestore';
import { format, isBefore, parseISO } from 'date-fns';
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
  const [showStatusUpdate, setShowStatusUpdate] = React.useState(false);
  const [nextStatus, setNextStatus] = React.useState('');
  const [statusDate, setStatusDate] = React.useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [showCnPreview, setShowCnPreview] = React.useState(false);
  const [cnData, setCnData] = React.useState<any>({});
  const [showVehicleEdit, setShowVehicleEdit] = React.useState(false);
  const [showCnEdit, setShowCnEdit] = React.useState(false);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const companyQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: companies } = useCollection(companyQuery);

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
    return trips.filter(t => t.status === statusMap[activeTab]).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [orders, trips, activeTab]);

  const paginated = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  const handleAssign = (data: any) => {
    const tripId = `T${Date.now().toString().slice(-9)}`;
    const newTrip = {
      ...data,
      id: crypto.randomUUID(),
      tripId,
      saleOrderId: selectedItem.id,
      saleOrderNumber: selectedItem.saleOrder,
      plantCode: selectedItem.plantCode,
      shipToParty: selectedItem.shipToParty,
      shipToPartyId: selectedItem.shipToPartyId,
      consignor: selectedItem.consignor,
      consignorId: selectedItem.consignorId,
      consignee: selectedItem.consignee,
      consigneeId: selectedItem.consigneeId,
      status: 'LOADING',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', newTrip.id), newTrip, { merge: true });
    setShowAssign(false);
  };

  const validateSequence = (trip: any, targetStatus: string, targetDate: string) => {
    const targetTime = new Date(targetDate).getTime();
    if (targetStatus === 'IN-TRANSIT') {
      if (targetTime < new Date(trip.createdAt).getTime()) {
        alert('Gate-Out time cannot be before Assignment time.');
        return false;
      }
    }
    if (targetStatus === 'ARRIVED') {
      if (targetTime < new Date(trip.outDate || trip.createdAt).getTime()) {
        alert('Arrival time cannot be before Departure/Assignment time.');
        return false;
      }
    }
    if (['POD', 'REJECTION'].includes(targetStatus)) {
      if (targetTime < new Date(trip.arrivedDate || trip.outDate || trip.createdAt).getTime()) {
        alert('Unload/Reject time cannot be before Arrival time.');
        return false;
      }
    }
    return true;
  };

  const updateStatus = (trip: any, status: string, date: string, remark?: string) => {
    if (!validateSequence(trip, status, date)) return;
    const updates: any = { status, updatedAt: new Date().toISOString() };
    if (status === 'IN-TRANSIT') updates.outDate = date;
    if (status === 'ARRIVED') updates.arrivedDate = date;
    if (status === 'CLOSED') updates.closedDate = date;
    if (remark) updates.remark = remark;

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', trip.id), updates, { merge: true });
    setShowStatusUpdate(false);
  };

  const handleGenerateCnPreview = (trip: any) => {
    const consignorMaster = customers?.find(c => c.customerCode === trip.consignorId);
    const consigneeMaster = customers?.find(c => c.customerCode === trip.consigneeId);
    const shipToMaster = customers?.find(c => c.customerCode === trip.shipToPartyId);
    const carrier = companies?.[0];

    setCnData({
      ...trip,
      consignorMaster,
      consigneeMaster,
      shipToMaster,
      carrier,
      copies: ['CONSIGNEE COPY', 'CONSIGNOR COPY', 'DRIVER COPY']
    });
    setShowCnPreview(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const fileName = `${cnData.cnNumber || 'CN'}.pdf`;
    // Trigger standard print which browser handles as PDF save
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 flex items-center justify-between shadow-sm">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD CONTROL HUB</h2>
        <div className="flex items-center gap-4">
           <Badge variant="outline" className="rounded-none border-slate-300 text-[10px] font-black uppercase">{activeTab} Registry</Badge>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-8 overflow-hidden">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0", activeTab === t ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner">
          <table className="w-full text-left border-collapse min-w-[1600px]">
            <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300">
              <tr className="text-[9px] font-black uppercase text-slate-500">
                <th className="p-3 border-r">Plant</th>
                <th className="p-3 border-r">Identifier</th>
                <th className="p-3 border-r">Fleet type</th>
                <th className="p-3 border-r">Consignor ID</th>
                <th className="p-3 border-r">Consignee ID</th>
                <th className="p-3 border-r">Destination</th>
                <th className="p-3 border-r">Vehicle No</th>
                <th className="p-3 border-r">Weight (MT)</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold uppercase text-[11px]">
              {paginated.map((item: any) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-3 border-r">{item.plantCode}</td>
                  <td className="p-3 border-r text-[#0056d2] font-black">{item.tripId || item.saleOrder}</td>
                  <td className="p-3 border-r">{item.vehicleType || '-'}</td>
                  <td className="p-3 border-r text-slate-400">{item.consignorId}</td>
                  <td className="p-3 border-r text-slate-400">{item.consigneeId}</td>
                  <td className="p-3 border-r truncate max-w-[200px]">{item.destination || item.shipToParty}</td>
                  <td className="p-3 border-r font-black cursor-pointer hover:text-blue-600" onClick={() => { if(activeTab !== 'Open Orders') { setSelectedItem(item); setShowVehicleEdit(true); } }}>{item.vehicleNumber || 'PENDING'}</td>
                  <td className="p-3 border-r text-emerald-600 font-black">{formatWeight(item.assignWeight || item.weight)}</td>
                  <td className="p-3">
                    {activeTab === 'Open Orders' ? (
                      <Button onClick={() => { setSelectedItem(item); setShowAssign(true); }} size="sm" className="h-7 text-[9px] font-black uppercase bg-[#0056d2] rounded-none">Assign Node</Button>
                    ) : (
                      <div className="flex gap-2">
                        {['Arrived', 'POD Verify', 'Closed'].includes(activeTab) && (
                          <Button onClick={() => handleGenerateCnPreview(item)} variant="outline" className="h-7 px-3 text-[9px] font-black rounded-none uppercase border-slate-300 hover:bg-slate-50"><Printer className="h-3.5 w-3.5 mr-1" /> LR Document</Button>
                        )}
                        {activeTab === 'Loading' && (
                          <div className="flex gap-2">
                             <Button onClick={() => { setSelectedItem(item); setNextStatus('IN-TRANSIT'); setShowStatusUpdate(true); }} className="h-7 text-[9px] font-black uppercase bg-emerald-600 rounded-none shadow-sm">Gate-Out</Button>
                             <Button onClick={() => { if(confirm('Cancel Assignment and revert order to pool?')) { deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', item.id)); } }} variant="ghost" className="h-7 text-[9px] font-black uppercase text-red-600 rounded-none border border-red-100 hover:bg-red-50">Unassign</Button>
                          </div>
                        )}
                        {activeTab === 'In-Transit' && (
                          <Button onClick={() => { setSelectedItem(item); setNextStatus('ARRIVED'); setShowStatusUpdate(true); }} className="h-7 text-[9px] font-black uppercase bg-blue-600 rounded-none shadow-sm">Arrival</Button>
                        )}
                        {activeTab === 'Arrived' && (
                          <div className="flex gap-2">
                            <Button onClick={() => { setSelectedItem(item); setNextStatus('POD'); setShowStatusUpdate(true); }} className="h-7 text-[9px] font-black uppercase bg-emerald-600 rounded-none shadow-sm">Unload</Button>
                            <Button onClick={() => { setSelectedItem(item); setNextStatus('REJECTION'); setShowStatusUpdate(true); }} className="h-7 text-[9px] font-black uppercase bg-red-600 rounded-none shadow-sm">Reject</Button>
                          </div>
                        )}
                        {activeTab !== 'Closed' && <Button variant="ghost" className="h-7 w-7 p-0" onClick={() => { setSelectedItem(item); setShowCnEdit(true); }}><Edit3 className="h-3.5 w-3.5" /></Button>}
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
            <input type="number" min="1" max={totalPages} value={currentPage} onChange={e => setCurrentPage(Math.max(1, Math.min(totalPages, Number(e.target.value))))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black" />
            <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Registry Page {currentPage} of {totalPages || 1}</span>
        </div>
      </div>

      {/* Assignment Portal */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-3xl rounded-none border-[4px] border-[#0056d2] font-mono">
           <DialogHeader><DialogTitle className="text-sm font-black uppercase italic tracking-tighter">Logistics Node Assignment: {selectedItem?.saleOrder}</DialogTitle></DialogHeader>
           <div className="p-6 space-y-8">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number *</label><input id="vno" className="h-9 w-full border border-slate-400 px-3 text-xs font-black uppercase outline-none focus:bg-yellow-50" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Fleet type *</label><select id="ftype" className="h-9 w-full border border-slate-400 px-2 text-xs font-black uppercase"><option value="OWN FLEET">OWN FLEET</option><option value="CONTRACT">CONTRACT</option><option value="MARKET VEHICLE">MARKET VEHICLE</option></select></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Assign Qty ({selectedItem?.weightUom}) *</label><input id="qty" type="number" step="0.001" defaultValue={selectedItem?.bal} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Mode *</label><select id="mode" className="h-9 w-full border border-slate-400 px-2 text-xs font-black uppercase" onChange={e => {
                   const viaField = document.getElementById('via') as HTMLInputElement;
                   if (viaField) viaField.disabled = e.target.value === 'ROAD';
                 }}><option value="ROAD">ROAD</option><option value="RAIL">RAIL</option><option value="AIR">AIR</option><option value="SHIP">SHIP</option></select></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">VIA (Mandatory if not Road)</label><input id="via" disabled className="h-9 w-full border border-slate-400 px-3 text-xs font-black uppercase disabled:bg-slate-50" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Assign Date Time *</label><input id="adate" type="datetime-local" defaultValue={format(new Date(), "yyyy-MM-dd'T'HH:mm")} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" /></div>
              </div>
              <Button onClick={() => {
                const mode = (document.getElementById('mode') as any).value;
                const via = (document.getElementById('via') as any).value;
                const data = {
                  vehicleNumber: (document.getElementById('vno') as any).value.toUpperCase(),
                  vehicleType: (document.getElementById('ftype') as any).value,
                  assignWeight: parseFloat((document.getElementById('qty') as any).value),
                  createdAt: (document.getElementById('adate') as any).value,
                  mode,
                  via
                };
                if (!data.vehicleNumber || !data.assignWeight) return alert('Mandatory data node missing');
                if (mode !== 'ROAD' && !via) return alert('VIA path mandatory');
                if (data.assignWeight > selectedItem.bal) return alert('Assignment exceeds balance registry');
                handleAssign(data);
              }} className="w-full h-11 bg-[#0056d2] text-white rounded-none font-black uppercase text-[11px] shadow-lg">Commit Node Assignment</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Lifecycle Status Portal */}
      <Dialog open={showStatusUpdate} onOpenChange={setShowStatusUpdate}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-slate-800 font-mono">
           <DialogHeader><DialogTitle className="text-sm font-black uppercase italic tracking-tighter">Life-cycle Status Synchronization</DialogTitle></DialogHeader>
           <div className="p-6 space-y-6">
              <div className="space-y-4">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Event Date Time *</label><input type="datetime-local" value={statusDate} onChange={e => setStatusDate(e.target.value)} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" /></div>
                 {nextStatus === 'REJECTION' && (
                   <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Rejection Reason</label><textarea id="rej_reason" className="w-full border border-slate-400 p-2 text-xs font-bold uppercase h-20" /></div>
                 )}
              </div>
              <Button onClick={() => {
                const remark = (document.getElementById('rej_reason') as HTMLTextAreaElement)?.value;
                updateStatus(selectedItem, nextStatus, statusDate, remark);
              }} className="w-full h-11 bg-slate-900 text-white rounded-none font-black uppercase text-[11px] hover:bg-black">Synchronize Stage</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Consignment Note A4 Preview */}
      <Dialog open={showCnPreview} onOpenChange={setShowCnPreview}>
        <DialogContent className="max-w-[950px] max-h-[95vh] overflow-y-auto rounded-none p-0 border-none font-mono no-scrollbar">
           <div className="bg-slate-900 p-4 sticky top-0 z-[100] flex justify-between items-center print:hidden shadow-2xl">
              <h2 className="text-white text-[11px] font-black uppercase tracking-[0.2em]">Consignment Note Registry Node</h2>
              <div className="flex gap-4">
                <Button onClick={handlePrint} className="h-9 bg-emerald-600 hover:bg-emerald-700 rounded-none text-[10px] font-black uppercase px-6 shadow-xl"><Printer className="h-3.5 w-3.5 mr-2" /> Print 3-Copy A4</Button>
                <Button onClick={() => setShowCnPreview(false)} className="h-9 bg-white/10 text-white rounded-none px-4 hover:bg-red-600"><X className="h-4 w-4" /></Button>
              </div>
           </div>

           <div id="printable-area" className="bg-[#525659] py-8 print:p-0 print:bg-white">
              {(cnData.copies || []).map((copy: string) => (
                <div key={copy} className="cn-print-page bg-white mx-auto shadow-2xl relative mb-8 print:mb-0 print:shadow-none" style={{ width: '210mm', minHeight: '297mm', padding: '15mm' }}>
                  <div className="border-[2px] border-black h-full flex flex-col p-6 relative">
                    <div className="flex justify-between items-start border-b-[2px] border-black pb-4 mb-6">
                       <div className="space-y-1">
                          <h1 className="text-2xl font-black text-[#1e3a8a] italic uppercase tracking-tighter leading-none">Sikka Industries & Logistics</h1>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Digital Registry Hub • ISO 9001 Node</p>
                          <div className="text-[8px] font-black text-slate-400 uppercase">GSTIN: {cnData.carrier?.gstin || '09SIKKA7845L1Z0'}</div>
                       </div>
                       <div className="text-right flex flex-col items-end gap-2">
                          <Badge className="bg-black text-white rounded-none text-[10px] font-black px-4 py-1">{copy}</Badge>
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-black uppercase text-red-600">LR NO: {cnData.cnNumber || 'PENDING'}</p>
                            <p className="text-[9px] font-black uppercase">DATE: {cnData.cnDate ? format(new Date(cnData.cnDate), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy')}</p>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-4 gap-px bg-black border border-black mb-6 text-[9px] font-black uppercase">
                       <div className="bg-slate-50 p-2 text-center border-r border-black">VEHICLE: {cnData.vehicleNumber}</div>
                       <div className="bg-slate-50 p-2 text-center border-r border-black">MODE: {cnData.mode}</div>
                       <div className="bg-slate-50 p-2 text-center border-r border-black">PAYMENT: {cnData.paymentTerms || 'PAID'}</div>
                       <div className="bg-slate-50 p-2 text-center">TRIP ID: {cnData.tripId}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-px bg-black border border-black mb-6">
                       <div className="bg-white p-4 space-y-2 min-h-[120px]">
                          <span className="text-[8px] font-black uppercase text-blue-600 border-b border-blue-50 block pb-1">Consignor</span>
                          <p className="text-[11px] font-black uppercase text-slate-900 leading-tight">{cnData.consignor}</p>
                          <p className="text-[9px] font-bold uppercase text-slate-500 leading-relaxed italic">{cnData.consignorMaster?.address || 'REGISTRY DATA PENDING'}</p>
                          <p className="text-[9px] font-black text-slate-800 pt-1">GSTIN: {cnData.consignorMaster?.gstin || '-'}</p>
                       </div>
                       <div className="bg-white p-4 space-y-2 min-h-[120px]">
                          <span className="text-[8px] font-black uppercase text-emerald-600 border-b border-emerald-50 block pb-1">Consignee</span>
                          <p className="text-[11px] font-black uppercase text-slate-900 leading-tight">{cnData.consignee}</p>
                          <p className="text-[9px] font-bold uppercase text-slate-500 leading-relaxed italic">{cnData.consigneeMaster?.address || 'REGISTRY DATA PENDING'}</p>
                          <p className="text-[9px] font-black text-slate-800 pt-1">GSTIN: {cnData.consigneeMaster?.gstin || '-'}</p>
                       </div>
                       <div className="bg-white p-4 space-y-2 min-h-[120px]">
                          <span className="text-[8px] font-black uppercase text-purple-600 border-b border-purple-50 block pb-1">Ship To Party</span>
                          <p className="text-[11px] font-black uppercase text-slate-900 leading-tight">{cnData.shipToParty}</p>
                          <p className="text-[9px] font-bold uppercase text-slate-500 leading-relaxed italic">{cnData.shipToMaster?.address || 'REGISTRY DATA PENDING'}</p>
                          <p className="text-[9px] font-black text-slate-800 pt-1">CITY: {cnData.shipToMaster?.city || '-'}</p>
                       </div>
                    </div>

                    <table className="w-full border-collapse border border-black mb-8 shadow-sm">
                       <thead className="bg-slate-100 text-[9px] font-black uppercase border-b border-black">
                          <tr>
                             <th className="border-r border-black p-2">Invoice No</th>
                             <th className="border-r border-black p-2">Goods Description</th>
                             <th className="border-r border-black p-2 text-center w-24">Pkg Node</th>
                             <th className="p-2 text-center w-24">Weight (MT)</th>
                          </tr>
                       </thead>
                       <tbody className="text-[10px] font-bold uppercase h-[180px] align-top">
                          <tr>
                             <td className="border-r border-black p-3 text-center">{cnData.invoiceNo || '-'}</td>
                             <td className="border-r border-black p-3 font-black text-[#1e3a8a]">{cnData.goodsDescription || 'CARGO CONSIGNMENT'}</td>
                             <td className="border-r border-black p-3 text-center">{cnData.packageCount || '1'} {cnData.packageUom || 'UNIT'}</td>
                             <td className="p-3 text-center font-black text-emerald-700">{formatWeight(cnData.assignWeight)}</td>
                          </tr>
                       </tbody>
                       <tfoot className="bg-slate-50 border-t border-black font-black text-[10px]">
                          <tr>
                             <td colSpan={3} className="p-2 text-right border-r border-black uppercase italic tracking-tighter">Grand Total Registry:</td>
                             <td className="p-2 text-center">{formatWeight(cnData.assignWeight)} MT</td>
                          </tr>
                       </tfoot>
                    </table>

                    <div className="flex-1" />
                    <div className="flex justify-between items-end border-t border-black pt-8">
                       <div className="w-1/2 space-y-4">
                          <div className="space-y-1">
                             <span className="text-[8px] font-black uppercase underline">Terms & Conditions:</span>
                             <p className="text-[7px] font-bold uppercase text-slate-400 italic max-w-sm leading-loose">
                                * All goods carried at owner's risk profile.<br />
                                * Subject to Ghaziabad jurisdictional control.<br />
                                * Registry verified by Sikka Satellite Gateway.
                             </p>
                          </div>
                          <div className="text-[8px] font-black uppercase text-slate-300">
                             "This Consignment Note was generated digitally and is to be considered as original."
                          </div>
                       </div>
                       <div className="text-center w-56 space-y-12">
                          <div className="h-px bg-slate-200" />
                          <div className="flex flex-col gap-0.5">
                             <span className="text-[10px] font-black uppercase text-[#1e3a8a] italic">Authorized Signature</span>
                             <span className="text-[8px] font-bold uppercase text-slate-400">For Sikka Industries & Logistics</span>
                          </div>
                       </div>
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
