'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ChevronLeft, ChevronRight, X, Download, 
  Plus, Trash, Edit3, Radar, Truck, MapPin, Package, ShoppingCart, CheckCircle, RefreshCw, Loader2,
  Calendar, CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

export default function TR21Page() {
  const router = useRouter();
  const db = useFirestore();
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Open Orders');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);
  
  // Dialog States
  const [showAssign, setShowAssign] = React.useState(false);
  const [showCNPortal, setShowCNPortal] = React.useState(false);
  const [showOutPortal, setShowOutPortal] = React.useState(false);
  const [showPODPortal, setShowPODPortal] = React.useState(false);
  
  // Form States
  const [assignData, setAssignData] = React.useState<any>({});
  const [cnData, setCnData] = React.useState<any>({});
  const [cnItems, setCnItems] = React.useState<any[]>([]);
  const [podData, setPodData] = React.useState({ receivedBy: '', receivedDate: '', remarks: '' });
  const [outData, setOutData] = React.useState({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });

  React.useEffect(() => { setMounted(true); }, []);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: vendors } = useCollection(vendorsQuery);

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];

  const filteredData = React.useMemo(() => {
    if (!orders || !trips || !mounted) return [];
    if (activeTab === 'Open Orders') {
      return orders.filter(o => o.status === 'Open').map(o => {
        const dispatched = trips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const weight = parseFloat(o.quantity) || 0;
        const balance = weight - dispatched;
        return { ...o, dispatched, balance };
      }).filter(o => o.balance > 0.001);
    }
    const statusMap: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
    return trips.filter(t => t.status === statusMap[activeTab]);
  }, [orders, trips, activeTab, mounted]);

  const handlePostAssignment = () => {
    if (!assignData.vehicleNo || !assignData.assignWeight) return alert('Mandatory fields missing');
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    const newTrip = {
      id: crypto.randomUUID(),
      tripNo: tripId,
      orderNo: selectedOrder.orderNo,
      plantCode: selectedOrder.plantCode,
      consigneeName: selectedOrder.consigneeName,
      shipToParty: selectedOrder.shipToParty,
      destination: selectedOrder.destination,
      vehicleNo: assignData.vehicleNo.toUpperCase(),
      driverMobile: assignData.driverMobile || '',
      assignWeight: assignData.assignWeight,
      fleetType: assignData.fleetType || 'Own Vehicle',
      transporterName: assignData.vendorName || '',
      status: 'LOADING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', newTrip.id), newTrip, { merge: true });
    setShowAssign(false);
  };

  const handlePostCN = () => {
    if (!cnData.cnNo) return alert('CN No Mandatory');
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      cnNumber: cnData.cnNo.toUpperCase(),
      cnDate: cnData.cnDate || format(new Date(), 'yyyy-MM-dd'),
      items: cnItems,
      updatedAt: new Date().toISOString()
    });
    setShowCNPortal(false);
  };

  const handleGateOut = () => {
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      status: 'IN-TRANSIT',
      dispatchDate: `${outData.date}T${outData.time}`,
      updatedAt: new Date().toISOString()
    });
    setShowOutPortal(false);
  };

  const handleArrival = (tripId: string) => {
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), { 
      status: 'ARRIVED',
      arrivalStatus: 'SUCCESS',
      updatedAt: new Date().toISOString()
    });
  };

  const handlePostPOD = () => {
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      status: 'POD',
      podDetails: podData,
      updatedAt: new Date().toISOString()
    });
    setShowPODPortal(false);
  };

  const handleCloseTrip = (tripId: string) => {
    if(confirm('Verify and Close this trip registry?')) {
      updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), { 
        status: 'CLOSED',
        updatedAt: new Date().toISOString()
      });
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 shadow-sm">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD CONTROL HUB</h2>
      </div>

      <div className="flex-1 flex flex-col p-8">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0", activeTab === t ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300">
              <tr className="text-[9px] font-black uppercase text-slate-500">
                <th className="p-3 border-r">Plant</th>
                <th className="p-3 border-r">Order No</th>
                {activeTab === 'Open Orders' ? (
                  <>
                    <th className="p-3 border-r">Consignee</th>
                    <th className="p-3 border-r text-center">Order Qty</th>
                    <th className="p-3 border-r text-center">Balance</th>
                  </>
                ) : (
                  <>
                    <th className="p-3 border-r">Trip ID</th>
                    <th className="p-3 border-r">Vehicle No</th>
                    <th className="p-3 border-r">CN No</th>
                    <th className="p-3 border-r text-center">Assign Qty</th>
                  </>
                )}
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold uppercase text-[11px]">
              {filteredData.map((item: any) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-3 border-r">{item.plantCode}</td>
                  <td className="p-3 border-r text-[#0056d2] font-black">{item.orderNo}</td>
                  {activeTab === 'Open Orders' ? (
                    <>
                      <td className="p-3 border-r">{item.consigneeName}</td>
                      <td className="p-3 border-r text-center">{item.quantity}</td>
                      <td className="p-3 border-r text-center text-emerald-600 font-black">{item.balance.toFixed(3)}</td>
                      <td className="p-3">
                         <Button onClick={() => { setSelectedOrder(item); setAssignData({assignWeight: item.balance}); setShowAssign(true); }} size="sm" className="h-7 text-[9px] font-black uppercase bg-[#0056d2] rounded-none">Assign</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 border-r">{item.tripNo}</td>
                      <td className="p-3 border-r">{item.vehicleNo}</td>
                      <td className="p-3 border-r">{item.cnNumber || '-'}</td>
                      <td className="p-3 border-r text-center">{item.assignWeight}</td>
                      <td className="p-3 flex gap-2">
                        {activeTab === 'Loading' && (
                          <>
                            <Button onClick={() => { setSelectedTrip(item); setShowCNPortal(true); }} size="sm" variant="outline" className="h-7 text-[9px] font-black border-[#0056d2] text-[#0056d2]">CN REG</Button>
                            {item.cnNumber && <Button onClick={() => { setSelectedTrip(item); setShowOutPortal(true); }} size="sm" className="h-7 text-[9px] font-black bg-[#1e3a8a] rounded-none">OUT</Button>}
                          </>
                        )}
                        {activeTab === 'In-Transit' && <Button onClick={() => handleArrival(item.id)} size="sm" className="h-7 text-[9px] font-black bg-emerald-600 rounded-none">ARRIVED</Button>}
                        {activeTab === 'Arrived' && <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} size="sm" className="h-7 text-[9px] font-black bg-purple-600 rounded-none">POD REG</Button>}
                        {activeTab === 'POD Verify' && <Button onClick={() => handleCloseTrip(item.id)} size="sm" className="h-7 text-[9px] font-black bg-slate-800 rounded-none">CLOSE</Button>}
                        <button onClick={() => deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', item.id))} className="text-red-300 hover:text-red-500"><X className="h-4 w-4" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Popup */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-[600px] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col">
           <DialogHeader className="bg-slate-50 px-8 py-4 border-b border-slate-200">
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                 <span>ROUTE: {selectedOrder?.from} - {selectedOrder?.destination}</span>
                 <span>BAL: {selectedOrder?.balance?.toFixed(3)} MT</span>
              </div>
           </DialogHeader>
           <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Vehicle No *</label>
                   <input value={assignData.vehicleNo || ''} onChange={e => setAssignData({...assignData, vehicleNo: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-xs font-black outline-none focus:bg-yellow-50" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Driver Mobile</label>
                   <input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-xs outline-none" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Fleet Type</label>
                    <select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-[11px] font-black">
                       <option value="Own Vehicle">Own Vehicle</option>
                       <option value="Market Vehicle">Market Vehicle</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Assign Weight *</label>
                   <input type="number" step="0.001" value={assignData.assignWeight || ''} onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-xs font-black outline-none" />
                 </div>
              </div>
              {assignData.fleetType === 'Market Vehicle' && (
                <div className="bg-blue-50/50 p-4 border border-blue-100 grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-blue-600">Vendor</label>
                     <select value={assignData.vendorId} onChange={e => { const v = vendors?.find(vend => vend.id === e.target.value); setAssignData({...assignData, vendorId: e.target.value, vendorName: v?.vendorName}); }} className="h-7 w-full border border-blue-200 bg-white px-2 text-[10px] font-black">
                        <option value="">SELECT...</option>
                        {vendors?.map(v => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
                     </select>
                   </div>
                </div>
              )}
           </div>
           <DialogFooter className="bg-slate-50 p-6 border-t gap-3">
              <Button onClick={() => setShowAssign(false)} variant="outline" className="rounded-none h-9 uppercase text-[10px] font-black">Cancel</Button>
              <Button onClick={handlePostAssignment} className="bg-[#0056d2] text-white rounded-none h-9 uppercase text-[10px] font-black px-10">Post Registry</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CN Entry */}
      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-[800px] rounded-none border-[3px] border-[#0056d2] font-mono">
           <DialogHeader><DialogTitle className="text-sm font-black uppercase text-[#0056d2]">Consignment Note Registry</DialogTitle></DialogHeader>
           <div className="py-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">CN Number *</label><input value={cnData.cnNo || ''} onChange={e => setCnData({...cnData, cnNo: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 outline-none" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">CN Date</label><input type="date" value={cnData.cnDate || ''} onChange={e => setCnData({...cnData, cnDate: e.target.value})} className="h-8 w-full border border-slate-400 px-2 outline-none" /></div>
              </div>
              <div className="space-y-3">
                 <h4 className="text-[10px] font-black uppercase text-slate-500">Material Items</h4>
                 <table className="w-full border border-slate-200 text-[10px]">
                    <thead className="bg-slate-50"><tr><th className="p-2 border-r border-b">Invoice</th><th className="p-2 border-r border-b">Description</th><th className="p-2 border-b">Weight</th></tr></thead>
                    <tbody>
                       {cnItems.map((it, idx) => (
                         <tr key={idx}>
                           <td className="border-r border-b"><input value={it.invoiceNo} onChange={e => { const n = [...cnItems]; n[idx].invoiceNo = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 px-2 outline-none" /></td>
                           <td className="border-r border-b"><input value={it.goodsDescription} onChange={e => { const n = [...cnItems]; n[idx].goodsDescription = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 px-2 outline-none" /></td>
                           <td className="border-b"><input type="number" value={it.weight} onChange={e => { const n = [...cnItems]; n[idx].weight = e.target.value; setCnItems(n); }} className="w-full h-7 px-2 outline-none" /></td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
                 <Button onClick={() => setCnItems([...cnItems, {invoiceNo: '', goodsDescription: '', weight: '0'}])} variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-[#0056d2]"><Plus className="h-3 w-3 mr-1" /> Add Material</Button>
              </div>
           </div>
           <DialogFooter><Button onClick={handlePostCN} className="bg-[#0056d2] text-white rounded-none h-9 uppercase text-[10px] font-black w-full">Save Registry</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gate Out */}
      <Dialog open={showOutPortal} onOpenChange={setShowOutPortal}>
        <DialogContent className="max-w-sm rounded-none border-[3px] border-[#1e3a8a] font-mono">
           <DialogHeader><DialogTitle className="text-sm font-black uppercase text-[#1e3a8a]">Confirm Gate-Out</DialogTitle></DialogHeader>
           <div className="py-6 space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">Date</label><input type="date" value={outData.date} onChange={e => setOutData({...outData, date: e.target.value})} className="h-8 w-full border border-slate-300 px-2 outline-none" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">Time</label><input type="time" value={outData.time} onChange={e => setOutData({...outData, time: e.target.value})} className="h-8 w-full border border-slate-300 px-2 outline-none" /></div>
           </div>
           <DialogFooter><Button onClick={handleGateOut} className="bg-[#1e3a8a] text-white rounded-none h-9 uppercase text-[10px] font-black w-full">Confirm Dispatch</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POD Entry */}
      <Dialog open={showPODPortal} onOpenChange={setShowPODPortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-purple-600 font-mono">
           <DialogHeader><DialogTitle className="text-sm font-black uppercase text-purple-600">Proof of Delivery Registry</DialogTitle></DialogHeader>
           <div className="py-6 space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Received By</label><input value={podData.receivedBy} onChange={e => setPodData({...podData, receivedBy: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-300 px-2 outline-none" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Received Date</label><input type="date" value={podData.receivedDate} onChange={e => setPodData({...podData, receivedDate: e.target.value})} className="h-8 w-full border border-slate-300 px-2 outline-none" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Remarks</label><textarea value={podData.remarks} onChange={e => setPodData({...podData, remarks: e.target.value.toUpperCase()})} className="h-16 w-full border border-slate-300 p-2 outline-none resize-none" /></div>
           </div>
           <DialogFooter><Button onClick={handlePostPOD} className="bg-purple-600 text-white rounded-none h-9 uppercase text-[10px] font-black w-full">Post POD</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
