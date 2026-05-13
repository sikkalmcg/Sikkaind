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
import { collection, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [selectedItem, setSelectedOrder] = React.useState<any>(null);
  const [showAssign, setShowAssign] = React.useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = React.useState(false);
  const [nextStatus, setNextStatus] = React.useState('');
  const [statusDate, setStatusDate] = React.useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [showCnPreview, setShowCnPreview] = React.useState(false);
  const [cnData, setCnData] = React.useState<any>({});
  
  // Assign Portal State
  const [assignData, setAssignData] = React.useState<any>({
    vehicleNumber: '',
    driverMobile: '',
    fleetType: 'Own Vehicle',
    assignQty: 0,
    assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    mode: 'ROAD',
    via: '',
    vendorId: '',
    rate: 0,
    freightAmount: 0,
    isFixRate: false
  });

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: companies } = useCollection(companiesQuery);

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];

  const filteredData = React.useMemo(() => {
    if (!orders || !trips) return [];
    if (activeTab === 'Open Orders') {
      return orders.filter(o => o.status !== 'Short closed').map(o => {
        const dispatched = trips.filter(t => t.saleOrderId === o.id && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const balance = (parseFloat(o.weight) || 0) - dispatched;
        return { ...o, dispatched, balance };
      }).filter(o => o.balance > 0);
    }
    const statusMap: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
    return trips.filter(t => t.status === statusMap[activeTab]).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [orders, trips, activeTab]);

  const paginated = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  const handleOpenAssign = (order: any) => {
    setSelectedOrder(order);
    setAssignData({
      vehicleNumber: '',
      driverMobile: '',
      fleetType: 'Own Vehicle',
      assignQty: order.balance,
      assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      mode: 'ROAD',
      via: '',
      vendorId: '',
      rate: 0,
      freightAmount: 0,
      isFixRate: false
    });
    setShowAssign(true);
  };

  const handlePostAssignment = () => {
    if (!assignData.vehicleNumber || !assignData.assignQty) return alert('Mandatory registry nodes missing');
    if (assignData.assignQty > selectedItem.balance) return alert('Assignment exceeds available balance registry');
    if (assignData.mode !== 'ROAD' && !assignData.via) return alert('Multimodal VIA path mandatory');

    // Trip ID: Prefix T + 9 unique digits
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    // Check for duplicate Trip ID (local check for UX)
    if (trips?.some(t => t.tripId === tripId)) {
       handlePostAssignment(); // Retry once
       return;
    }

    const selectedVendor = vendors?.find(v => v.id === assignData.vendorId);

    const newTrip = {
      id: crypto.randomUUID(),
      tripId,
      saleOrderId: selectedItem.id,
      saleOrderNumber: selectedItem.saleOrder,
      plantCode: selectedItem.plantCode,
      consignor: selectedItem.consignor,
      consignorId: selectedItem.consignorId,
      consignee: selectedItem.consignee,
      consigneeId: selectedItem.consigneeId,
      shipToParty: selectedItem.shipToParty,
      shipToPartyId: selectedItem.shipToPartyId,
      destination: selectedItem.destination,
      vehicleNumber: assignData.vehicleNumber.toUpperCase(),
      driverMobile: assignData.driverMobile,
      vehicleType: assignData.fleetType,
      assignWeight: assignData.assignQty,
      mode: assignData.mode,
      via: assignData.via,
      vendorName: selectedVendor?.vendorName || '',
      vendorId: selectedVendor?.vendorCode || '',
      rate: assignData.rate,
      freightAmount: assignData.freightAmount,
      status: 'LOADING',
      createdAt: assignData.assignDate,
      updatedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', newTrip.id), newTrip, { merge: true });
    setShowAssign(false);
  };

  const handleRateChange = (rate: number) => {
    setAssignData(prev => ({ 
      ...prev, 
      rate, 
      freightAmount: prev.isFixRate ? prev.freightAmount : rate * prev.assignQty 
    }));
  };

  const handleQtyChange = (qty: number) => {
    setAssignData(prev => ({ 
      ...prev, 
      assignQty: qty, 
      freightAmount: prev.isFixRate ? prev.freightAmount : prev.rate * qty 
    }));
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
          <table className="w-full text-left border-collapse min-w-[1800px]">
            <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300">
              <tr className="text-[9px] font-black uppercase text-slate-500">
                {activeTab === 'Open Orders' ? (
                  <>
                    <th className="p-3 border-r">Plant</th>
                    <th className="p-3 border-r">Sale Order</th>
                    <th className="p-3 border-r">Consignor</th>
                    <th className="p-3 border-r">Consignee</th>
                    <th className="p-3 border-r">Ship to Party</th>
                    <th className="p-3 border-r">Route</th>
                    <th className="p-3 border-r text-center">Order Qty</th>
                    <th className="p-3 border-r text-center text-blue-600">Dispatched</th>
                    <th className="p-3 border-r text-center text-emerald-600">Balance</th>
                    <th className="p-3">Action</th>
                  </>
                ) : (
                  <>
                    <th className="p-3 border-r">Plant</th>
                    <th className="p-3 border-r">Trip ID</th>
                    <th className="p-3 border-r">Fleet Type</th>
                    <th className="p-3 border-r">Consignor</th>
                    <th className="p-3 border-r">Consignee</th>
                    <th className="p-3 border-r">Destination</th>
                    <th className="p-3 border-r">Vehicle No</th>
                    <th className="p-3 border-r text-center">Weight (MT)</th>
                    <th className="p-3">Action</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold uppercase text-[11px]">
              {paginated.map((item: any) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                  {activeTab === 'Open Orders' ? (
                    <>
                      <td className="p-3 border-r">{item.plantCode}</td>
                      <td className="p-3 border-r text-[#0056d2] font-black">{item.saleOrder}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.consignor}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.consignee}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.shipToParty}</td>
                      <td className="p-3 border-r truncate max-w-[150px]">{item.destination || '-'}</td>
                      <td className="p-3 border-r text-center">{formatWeight(item.weight)}</td>
                      <td className="p-3 border-r text-center text-blue-600">{formatWeight(item.dispatched)}</td>
                      <td className="p-3 border-r text-center text-emerald-600 font-black">{formatWeight(item.balance)}</td>
                      <td className="p-3">
                         <Button onClick={() => handleOpenAssign(item)} size="sm" className="h-7 text-[9px] font-black uppercase bg-[#0056d2] rounded-none">Assign</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 border-r">{item.plantCode}</td>
                      <td className="p-3 border-r text-[#0056d2] font-black">{item.tripId}</td>
                      <td className="p-3 border-r">{item.vehicleType || 'OWN'}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.consignor}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.consignee}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.destination}</td>
                      <td className="p-3 border-r font-black">{item.vehicleNumber}</td>
                      <td className="p-3 border-r text-center font-black">{formatWeight(item.assignWeight)}</td>
                      <td className="p-3">
                         {/* Status specific actions (Arrived, Unload etc) would go here */}
                         <Button variant="outline" className="h-7 text-[9px] font-black rounded-none uppercase">Manage</Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 bg-white border border-slate-300 p-2 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex gap-2 items-center">
            <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
            <input type="number" min="1" max={totalPages} value={currentPage} onChange={e => setCurrentPage(Math.max(1, Math.min(totalPages, Number(e.target.value))))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black outline-none" />
            <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Registry Page {currentPage} of {totalPages || 1}</span>
        </div>
      </div>

      {/* Assign Vehicle Portal */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-4xl rounded-none border-[4px] border-[#0056d2] font-mono">
           <DialogHeader>
             <DialogTitle className="text-sm font-black uppercase italic tracking-tighter border-b pb-2 flex justify-between items-center">
                <span>Vehicle Node Assignment</span>
                <span className="text-[#0056d2]">Order: {selectedItem?.saleOrder}</span>
             </DialogTitle>
           </DialogHeader>
           
           <div className="p-4 space-y-8">
              {/* Top Summary Header */}
              <div className="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 shadow-sm">
                 <div className="bg-slate-50 p-3 space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Ship To Party</span>
                    <p className="text-[10px] font-black truncate">{selectedItem?.shipToParty}</p>
                 </div>
                 <div className="bg-slate-50 p-3 space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Route (From - To)</span>
                    <p className="text-[10px] font-black truncate">{selectedItem?.plantCode} - {selectedItem?.destination}</p>
                 </div>
                 <div className="bg-slate-50 p-3 space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Order Registry Qty</span>
                    <p className="text-[10px] font-black">{formatWeight(selectedItem?.weight)} MT</p>
                 </div>
              </div>

              {/* Assignment Form */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Vehicle Number *</label>
                    <input value={assignData.vehicleNumber} onChange={e => setAssignData({...assignData, vehicleNumber: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-xs font-black uppercase outline-none focus:bg-yellow-50" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Driver Mobile</label>
                    <input value={assignData.driverMobile} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-xs font-black outline-none focus:bg-yellow-50" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Fleet Type *</label>
                    <select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-xs font-black uppercase">
                       <option value="Own Vehicle">Own Vehicle</option>
                       <option value="Contract Vehicle">Contract Vehicle</option>
                       <option value="Market Vehicle">Market Vehicle</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Assign Weight (MT) *</label>
                    <input type="number" step="0.001" value={assignData.assignQty} onChange={e => handleQtyChange(parseFloat(e.target.value))} className="h-8 w-full border border-slate-400 px-2 text-xs font-black outline-none focus:bg-yellow-50" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Mode *</label>
                    <select value={assignData.mode} onChange={e => setAssignData({...assignData, mode: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-xs font-black uppercase">
                       <option value="ROAD">ROAD</option>
                       <option value="ROAD FROM RAIL">ROAD FROM RAIL</option>
                       <option value="ROAD FROM SHIP">ROAD FROM SHIP</option>
                       <option value="ROAD FROM AIR">ROAD FROM AIR</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className={cn("text-[10px] font-black uppercase", assignData.mode === 'ROAD' ? "text-slate-200" : "text-slate-500")}>VIA Registry (Mandatory)</label>
                    <input disabled={assignData.mode === 'ROAD'} value={assignData.via} onChange={e => setAssignData({...assignData, via: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-xs font-black uppercase outline-none disabled:bg-slate-100" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Assign Date Time *</label>
                    <input type="datetime-local" value={assignData.assignDate} onChange={e => setAssignData({...assignData, assignDate: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-xs font-black outline-none" />
                 </div>

                 {/* Market Vehicle Section */}
                 {assignData.fleetType === 'Market Vehicle' && (
                   <>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Vendor Name *</label>
                        <select value={assignData.vendorId} onChange={e => setAssignData({...assignData, vendorId: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-xs font-black uppercase">
                           <option value="">Select Vendor...</option>
                           {vendors?.map(v => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Rate (Per MT)</label>
                        <input disabled={assignData.isFixRate} type="number" value={assignData.rate} onChange={e => handleRateChange(parseFloat(e.target.value))} className="h-8 w-full border border-slate-400 px-2 text-xs font-black outline-none disabled:bg-slate-100" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Freight Amount</label>
                        <div className="flex gap-2 items-center">
                           <input disabled={!assignData.isFixRate} type="number" value={assignData.freightAmount} onChange={e => setAssignData({...assignData, freightAmount: parseFloat(e.target.value)})} className="h-8 flex-1 border border-slate-400 px-2 text-xs font-black outline-none disabled:bg-slate-50" />
                           <div className="flex items-center gap-2 shrink-0">
                              <Checkbox checked={assignData.isFixRate} onCheckedChange={checked => setAssignData({...assignData, isFixRate: !!checked})} className="rounded-none h-4 w-4" />
                              <span className="text-[9px] font-black uppercase">Fix</span>
                           </div>
                        </div>
                     </div>
                   </>
                 )}
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
                 <Button onClick={() => setShowAssign(false)} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase text-red-600 border-red-200 hover:bg-red-50">Cancel (Esc)</Button>
                 <Button onClick={handlePostAssignment} className="h-9 px-12 rounded-none bg-[#0056d2] text-white text-[10px] font-black uppercase shadow-lg">Post Assignment (F8)</Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
