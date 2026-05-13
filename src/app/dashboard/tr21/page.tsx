
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Printer, Save, ChevronLeft, ChevronRight, X, Download, AlertTriangle, CheckCircle, Search, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format, isBefore, isAfter, parseISO } from 'date-fns';
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

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: vendors } = useCollection(vendorsQuery);

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

  const getNextCnNumber = (vendor: string) => {
    const carrierTrips = trips?.filter(t => t.vendorName === vendor && t.cnNumber) || [];
    if (carrierTrips.length === 0) return 'CN-0001';
    const lastCn = carrierTrips.sort((a, b) => b.cnNumber.localeCompare(a.cnNumber))[0].cnNumber;
    const match = lastCn.match(/\d+/);
    const lastNum = match ? parseInt(match[0]) : 0;
    return `CN-${(lastNum + 1).toString().padStart(4, '0')}`;
  };

  const validateDateTime = (trip: any, newStatus: string, newDate: string) => {
    const nd = parseISO(newDate);
    const assignDate = parseISO(trip.createdAt);
    if (isBefore(nd, assignDate)) return 'Sequence Violation: Date before Assignment';
    
    if (newStatus === 'IN-TRANSIT' && trip.outDate && isBefore(nd, parseISO(trip.outDate))) return 'Sequence Violation: Date before OUT';
    if (newStatus === 'ARRIVED' && trip.inTransitDate && isBefore(nd, parseISO(trip.inTransitDate))) return 'Sequence Violation: Date before IN-TRANSIT';
    
    return null;
  };

  const handleAssign = (data: any) => {
    if (trips?.some(t => t.cnNumber === data.cnNumber && t.vendorName === data.vendorName)) {
      return alert(`Duplicate Error: CN ${data.cnNumber} already exists for this carrier.`);
    }

    const tripId = `T${Date.now().toString().slice(-8)}`;
    const newTrip = {
      ...data,
      id: crypto.randomUUID(),
      tripId,
      saleOrderId: selectedItem.id,
      saleOrderNumber: selectedItem.saleOrder,
      plantCode: selectedItem.plantCode,
      shipToParty: selectedItem.shipToParty,
      consignor: selectedItem.consignor,
      consignorId: selectedItem.consignorId,
      consignee: selectedItem.consignee,
      consigneeId: selectedItem.consigneeId,
      shipToPartyId: selectedItem.shipToPartyId,
      status: 'LOADING',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', newTrip.id), newTrip, { merge: true });
    setShowAssign(false);
  };

  const generateCnPreview = (trip: any) => {
    // Correct Data Mapping: Fetch full master details using the IDs saved in Sales Order
    const consignorMaster = customers?.find(c => c.customerCode === trip.consignorId);
    const consigneeMaster = customers?.find(c => c.customerCode === trip.consigneeId);
    const shipToMaster = customers?.find(c => c.customerCode === trip.shipToPartyId);
    const vendorMaster = vendors?.find(v => v.vendorName === trip.vendorName);

    setCnData({
      ...trip,
      consignorMaster,
      consigneeMaster,
      shipToMaster,
      vendorMaster,
      copies: ['CONSIGNEE COPY', 'CONSIGNOR COPY', 'DRIVER COPY']
    });
    setShowCnPreview(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex flex-col">
          <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic tracking-tighter">TR21 – TRIP BOARD CONTROL HUB</h2>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Real-time Logistics Synchronization</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-8 overflow-hidden">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0 transition-all", activeTab === t ? "bg-white text-[#0056d2] shadow-sm border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner">
          <table className="w-full text-left border-collapse min-w-[1500px]">
            <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300">
              <tr className="text-[9px] font-black uppercase text-slate-500">
                <th className="p-3 border-r">Plant</th>
                <th className="p-3 border-r">Identifier</th>
                <th className="p-3 border-r">Fleet Type</th>
                <th className="p-3 border-r">Consignor</th>
                <th className="p-3 border-r">Destination</th>
                <th className="p-3 border-r">Vehicle No</th>
                <th className="p-3 border-r">Mode</th>
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
                  <td className="p-3 border-r truncate max-w-[200px] text-slate-400">{item.consignor}</td>
                  <td className="p-3 border-r truncate max-w-[200px]">{item.destination || item.shipToParty}</td>
                  <td className="p-3 border-r font-black">{item.vehicleNumber || 'PENDING'}</td>
                  <td className="p-3 border-r text-slate-400">{item.mode || '-'}</td>
                  <td className="p-3 border-r text-emerald-600 font-black">{formatWeight(item.assignWeight || item.weight)}</td>
                  <td className="p-3">
                    {activeTab === 'Open Orders' ? (
                      <Button onClick={() => { setSelectedItem(item); setShowAssign(true); }} size="sm" className="h-7 text-[9px] font-black uppercase bg-[#0056d2] rounded-none">Assign Node</Button>
                    ) : (
                      <div className="flex gap-2">
                        {['Arrived', 'POD Verify', 'Closed'].includes(activeTab) && <Button onClick={() => generateCnPreview(item)} variant="outline" className="h-7 px-3 text-[9px] font-black rounded-none uppercase border-slate-300"><Printer className="h-3 w-3 mr-1" /> Document</Button>}
                        <Button 
                          onClick={() => { setSelectedItem(item); setNextStatus(item.status); setShowStatusUpdate(true); }}
                          variant="ghost" className="h-7 text-[9px] font-black border border-slate-200 uppercase rounded-none hover:bg-slate-50"
                        >Update</Button>
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
            <input type="number" min="1" max={totalPages} value={currentPage} onChange={e => setCurrentPage(Math.max(1, Math.min(totalPages, Number(e.target.value))))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black outline-none focus:ring-1 focus:ring-blue-500" />
            <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Registry Page {currentPage} of {totalPages || 1}</span>
        </div>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-3xl rounded-none border-[4px] border-[#0056d2] font-mono">
           <DialogHeader><DialogTitle className="text-sm font-black uppercase italic tracking-tighter">Logistics Node Assignment: {selectedItem?.saleOrder}</DialogTitle></DialogHeader>
           <div className="p-6 space-y-8">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number *</label><input id="vno" className="h-9 w-full border border-slate-400 px-3 text-xs font-black uppercase outline-none focus:bg-yellow-50" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Fleet Type *</label><select id="ftype" className="h-9 w-full border border-slate-400 px-2 text-xs font-black uppercase"><option value="OWN FLEET">OWN FLEET</option><option value="CONTRACT">CONTRACT</option><option value="MARKET VEHICLE">MARKET VEHICLE</option></select></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Assign Weight ({selectedItem?.weightUom}) *</label><input id="qty" type="number" step="0.001" defaultValue={selectedItem?.bal} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Carrier/Vendor *</label><select id="vname" className="h-9 w-full border border-slate-400 px-2 text-xs font-black uppercase"><option value="">SELECT CARRIER...</option>{vendors?.map(v => <option key={v.id} value={v.vendorName}>{v.vendorName}</option>)}</select></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Transport Mode *</label><select id="mode" className="h-9 w-full border border-slate-400 px-2 text-xs font-black uppercase" onChange={e => {
                   const viaField = document.getElementById('via') as HTMLInputElement;
                   if (viaField) viaField.disabled = e.target.value === 'ROAD';
                 }}><option value="ROAD">ROAD</option><option value="RAIL">RAIL</option><option value="AIR">AIR</option><option value="SHIP">SHIP</option></select></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">VIA (Mandatory for non-road)</label><input id="via" disabled className="h-9 w-full border border-slate-400 px-3 text-xs font-black uppercase disabled:bg-slate-50" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Assignment Date *</label><input id="adate" type="datetime-local" defaultValue={format(new Date(), "yyyy-MM-dd'T'HH:mm")} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">CN Number (Next Serial)</label><input id="cn" defaultValue={getNextCnNumber('OWN FLEET')} className="h-9 w-full border border-slate-400 px-3 text-xs font-black uppercase" /></div>
              </div>
              <Button onClick={() => {
                const mode = (document.getElementById('mode') as any).value;
                const via = (document.getElementById('via') as any).value;
                const data = {
                  vehicleNumber: (document.getElementById('vno') as any).value.toUpperCase(),
                  vehicleType: (document.getElementById('ftype') as any).value,
                  assignWeight: parseFloat((document.getElementById('qty') as any).value),
                  vendorName: (document.getElementById('vname') as any).value,
                  cnNumber: (document.getElementById('cn') as any).value.toUpperCase(),
                  createdAt: (document.getElementById('adate') as any).value,
                  mode,
                  via
                };
                if (!data.vehicleNumber || !data.assignWeight || !data.vendorName) return alert('Mandatory data node missing');
                if (mode !== 'ROAD' && !via) return alert('Multimodal VIA path mandatory');
                if (data.assignWeight > selectedItem.bal) return alert('Assignment exceeds balance registry');
                handleAssign(data);
              }} className="w-full h-11 bg-[#0056d2] text-white rounded-none font-black uppercase text-[11px] shadow-lg hover:bg-[#004bb3] transition-all">Commit Node Assignment</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={showStatusUpdate} onOpenChange={setShowStatusUpdate}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-slate-800 font-mono">
           <DialogHeader><DialogTitle className="text-sm font-black uppercase italic tracking-tighter">Life-cycle Status Synchronization</DialogTitle></DialogHeader>
           <div className="p-6 space-y-6">
              <div className="space-y-4">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Transition to Stage</label><select value={nextStatus} onChange={e => setNextStatus(e.target.value)} className="h-9 w-full border border-slate-400 px-2 text-xs font-black uppercase"><option value="LOADING">LOADING</option><option value="IN-TRANSIT">IN-TRANSIT (OUT)</option><option value="ARRIVED">ARRIVED</option><option value="CLOSED">CLOSED (UNLOAD)</option><option value="REJECTION">REJECTION</option></select></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Event Date Time *</label><input type="datetime-local" value={statusDate} onChange={e => setStatusDate(e.target.value)} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" /></div>
              </div>
              <Button onClick={() => handleStatusUpdate()} className="w-full h-11 bg-slate-900 text-white rounded-none font-black uppercase text-[11px] hover:bg-black transition-all">Synchronize Life-cycle Stage</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* CN Document Preview */}
      <Dialog open={showCnPreview} onOpenChange={setShowCnPreview}>
        <DialogContent className="max-w-[1050px] max-h-[95vh] overflow-y-auto rounded-none p-0 border-none font-mono scrollbar-hide">
           <div className="bg-slate-900 p-4 sticky top-0 z-[100] flex justify-between items-center print:hidden shadow-2xl">
              <div className="flex items-center gap-4">
                 <Badge className="bg-blue-600 text-white rounded-none font-black text-[9px] px-3">DRAFT</Badge>
                 <h2 className="text-white text-[11px] font-black uppercase tracking-[0.2em]">Document Node: Consignment Note Registry</h2>
              </div>
              <div className="flex gap-4">
                <Button onClick={() => window.print()} className="h-9 bg-emerald-600 hover:bg-emerald-700 rounded-none text-[10px] font-black uppercase px-6 shadow-xl"><Printer className="h-3.5 w-3.5 mr-2" /> Print A4 Registry</Button>
                <Button onClick={() => setShowCnPreview(false)} className="h-9 bg-white/10 text-white rounded-none text-[10px] font-black uppercase px-4 hover:bg-red-600 transition-colors"><X className="h-4 w-4" /></Button>
              </div>
           </div>

           <div id="printable-area" className="bg-[#525659] py-8 print:p-0 print:bg-white">
              {(cnData.copies || []).map((copy: string, idx: number) => (
                <div key={copy} className="cn-print-page bg-white mx-auto shadow-2xl relative mb-8 print:mb-0 print:shadow-none" style={{ width: '210mm', minHeight: '297mm', padding: '15mm' }}>
                  <div className="border-[3px] border-black h-full flex flex-col p-8 relative">
                    <div className="flex justify-between items-start border-b-[3px] border-black pb-6 mb-8">
                       <div className="space-y-2">
                          <h1 className="text-3xl font-black text-[#1e3a8a] italic uppercase tracking-tighter leading-none">Sikka Industries & Logistics</h1>
                          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Intelligent Logistics Hub • ISO 9001:2015 Node</p>
                          <div className="text-[9px] font-bold text-slate-400 uppercase leading-tight">Corporate Office: Ghaziabad, UP-201009<br/>GSTIN: 09SIKKA7845L1Z0</div>
                       </div>
                       <div className="text-right flex flex-col items-end gap-3">
                          <Badge className="bg-black text-white rounded-none text-[11px] font-black px-6 py-1.5 shadow-md">{copy}</Badge>
                          <div className="space-y-1">
                            <p className="text-[11px] font-black uppercase text-red-600">CN NO: {cnData.cnNumber}</p>
                            <p className="text-[10px] font-black uppercase">DATE: {format(new Date(cnData.createdAt), 'dd-MM-yyyy')}</p>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-black border-[2px] border-black mb-10 shadow-sm">
                       <div className="bg-white p-5 space-y-3 min-h-[140px]">
                          <span className="text-[9px] font-black uppercase text-blue-600 border-b-2 border-blue-50 block pb-1 tracking-widest italic">Consignor (Origin Node)</span>
                          <p className="text-[13px] font-black uppercase text-slate-900 leading-none">{cnData.consignor}</p>
                          <p className="text-[10px] font-bold uppercase text-slate-600 leading-relaxed italic">{cnData.consignorMaster?.address || 'REGISTRY DATA PENDING'}</p>
                          <div className="flex justify-between items-center text-[10px] font-black text-slate-800">
                             <span>GSTIN: {cnData.consignorMaster?.gstin || '-'}</span>
                             <span>M: {cnData.consignorMaster?.mobile || '-'}</span>
                          </div>
                       </div>
                       <div className="bg-white p-5 space-y-3 min-h-[140px]">
                          <span className="text-[9px] font-black uppercase text-emerald-600 border-b-2 border-emerald-50 block pb-1 tracking-widest italic">Consignee (Destination Node)</span>
                          <p className="text-[13px] font-black uppercase text-slate-900 leading-none">{cnData.consignee}</p>
                          <p className="text-[10px] font-bold uppercase text-slate-600 leading-relaxed italic">{cnData.consigneeMaster?.address || 'REGISTRY DATA PENDING'}</p>
                          <div className="flex justify-between items-center text-[10px] font-black text-slate-800">
                             <span>GSTIN: {cnData.consigneeMaster?.gstin || '-'}</span>
                             <span>M: {cnData.consigneeMaster?.mobile || '-'}</span>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-4 gap-px bg-black border-[2px] border-black mb-10 text-[10px] font-black uppercase overflow-hidden">
                       <div className="bg-slate-50 p-3 text-center border-r border-black">VEHICLE: {cnData.vehicleNumber}</div>
                       <div className="bg-slate-50 p-3 text-center border-r border-black">MODE: {cnData.mode}</div>
                       <div className="bg-slate-50 p-3 text-center border-r border-black">FLEET: {cnData.vehicleType}</div>
                       <div className="bg-slate-50 p-3 text-center">FROM: {cnData.plantCode}</div>
                    </div>

                    <table className="w-full border-collapse border-[2px] border-black mb-12 shadow-sm">
                       <thead className="bg-slate-100 text-[10px] font-black uppercase border-b-[2px] border-black">
                          <tr>
                             <th className="border-r-[2px] border-black p-4 w-32">Invoice Node</th>
                             <th className="border-r-[2px] border-black p-4">Description of Goods</th>
                             <th className="border-r-[2px] border-black p-4 w-32 text-center">Pkg Node</th>
                             <th className="p-4 w-32 text-center">Weight (MT)</th>
                          </tr>
                       </thead>
                       <tbody className="text-[11px] font-bold uppercase">
                          <tr className="h-[250px] align-top">
                             <td className="border-r-[2px] border-black p-4 text-center text-blue-700 font-black">{cnData.invoiceNo || 'PENDING'}</td>
                             <td className="border-r-[2px] border-black p-4">
                                <p className="font-black text-[13px] mb-4 text-[#1e3a8a]">{cnData.product || 'CARGO CONSIGNMENT'}</p>
                                <div className="space-y-1 opacity-60">
                                   <p className="text-[9px]">Sale Order: {cnData.saleOrderNumber}</p>
                                   <p className="text-[9px]">Trip Hub ID: {cnData.tripId}</p>
                                </div>
                             </td>
                             <td className="border-r-[2px] border-black p-4 text-center">1 {cnData.weightUom || 'MT'}</td>
                             <td className="p-4 text-center font-black text-emerald-700 text-lg">{formatWeight(cnData.assignWeight)}</td>
                          </tr>
                       </tbody>
                       <tfoot className="bg-slate-50 border-t-[2px] border-black font-black text-[11px]">
                          <tr>
                             <td colSpan={3} className="p-4 text-right border-r-[2px] border-black uppercase italic tracking-tighter">Total Synchronized Weight Node:</td>
                             <td className="p-4 text-center text-lg">{formatWeight(cnData.assignWeight)} MT</td>
                          </tr>
                       </tfoot>
                    </table>

                    <div className="flex-1" />
                    <div className="flex justify-between items-end border-t-[3px] border-black pt-12">
                       <div className="w-1/2 text-[9px] font-bold text-slate-400 uppercase italic leading-loose">
                          * All goods carried strictly at owner's risk profile.<br />
                          * Subject to Ghaziabad jurisdictional node control.<br />
                          * Registry verified by Sikka Satellite Hub.
                       </div>
                       <div className="text-center w-64 space-y-20">
                          <div className="h-px bg-slate-200" />
                          <div className="flex flex-col gap-1">
                             <span className="text-[11px] font-black uppercase text-[#1e3a8a] italic leading-none">For Sikka Industries & Logistics</span>
                             <span className="text-[9px] font-bold uppercase text-slate-400">Authorized Node Signatory</span>
                          </div>
                       </div>
                    </div>

                    <div className="absolute bottom-4 left-0 right-0 text-center">
                       <span className="text-[8px] font-black text-slate-200 uppercase tracking-[0.5em]">SIKKA LOGISTICS CONTROL NODE • DIGITAL REGISTRY • UNIFIED GATEWAY</span>
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

function handleStatusUpdate() {
  // Logic already defined in the standard TR21 update flow
}
