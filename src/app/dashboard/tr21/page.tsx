'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ChevronLeft, ChevronRight, X, Download, AlertTriangle, 
  CheckCircle, Search, Edit3, Trash2, MapPin, Truck, RefreshCw, LogOut, Radar, Plus, Trash
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
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Open Orders');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);
  const [showAssign, setShowAssign] = React.useState(false);
  const [showCNPortal, setShowCNPortal] = React.useState(false);
  const [showOutPortal, setShowOutPortal] = React.useState(false);
  
  // Assign Portal State
  const [assignData, setAssignData] = React.useState<any>({
    vehicleNumber: '',
    driverMobile: '',
    fleetType: 'Own Vehicle',
    assignQty: 0,
    assignDate: '',
    mode: 'ROAD',
    via: '',
    vendorId: '',
    rate: 0,
    freightAmount: 0,
    isFixRate: false
  });

  // CN Portal State
  const [cnData, setCnData] = React.useState<any>({ cnNumber: '', cnDate: '', paymentTerms: 'Paid' });
  const [cnItems, setCnItems] = React.useState<any[]>([]);
  
  // Gate-Out Portal State
  const [outData, setOutData] = React.useState({ date: '', time: '' });

  React.useEffect(() => {
    setMounted(true);
    setAssignData(prev => ({ ...prev, assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") }));
  }, []);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: plants } = useCollection(plantsQuery);

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];

  const getRoute = (item: any) => {
    if (!item) return '-';
    const pCity = plants?.find(p => p.plantCode === item.plantCode)?.city || item.plantCode;
    return `${pCity} - ${item.destination || '-'}`;
  };

  const filteredData = React.useMemo(() => {
    if (!orders || !trips || !mounted) return [];
    if (activeTab === 'Open Orders') {
      return orders.filter(o => o.status !== 'Short closed').map(o => {
        const dispatched = trips.filter(t => t.saleOrderId === o.id && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const balance = (parseFloat(o.weight) || 0) - dispatched;
        return { ...o, dispatched, balance };
      }).filter(o => o.balance > 0);
    }
    const statusMap: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
    return trips.filter(t => t.status === statusMap[activeTab]).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [orders, trips, activeTab, mounted]);

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
    if (assignData.assignQty > selectedOrder.balance) return alert('Assignment exceeds available balance registry');
    
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    const selectedVendor = vendors?.find(v => v.id === assignData.vendorId);

    const newTrip = {
      id: crypto.randomUUID(),
      tripId,
      saleOrderId: selectedOrder.id,
      saleOrderNumber: selectedOrder.saleOrder,
      saleOrderDate: selectedOrder.saleOrderDate || '',
      plantCode: selectedOrder.plantCode,
      consignor: selectedOrder.consignor,
      consignorId: selectedOrder.consignorId,
      consignee: selectedOrder.consignee,
      consigneeId: selectedOrder.consigneeId,
      shipToParty: selectedOrder.shipToParty,
      shipToPartyId: selectedOrder.shipToPartyId,
      destination: selectedOrder.destination,
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
      updatedAt: new Date().toISOString(),
      cnNumber: '',
      cnDate: '',
      paymentTerms: 'Paid',
      items: []
    };

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', newTrip.id), newTrip, { merge: true });
    setShowAssign(false);
  };

  const handleOpenCNPortal = (trip: any) => {
    setSelectedTrip(trip);
    setCnData({
      cnNumber: trip.cnNumber || '',
      cnDate: trip.cnDate || format(new Date(), "yyyy-MM-dd"),
      paymentTerms: trip.paymentTerms || 'Paid'
    });
    setCnItems(trip.items?.length ? [...trip.items] : [{ invoice: '', ewaybill: '', material: '', package: '', packageUom: 'BAG' }]);
    setShowCNPortal(true);
  };

  const handlePostCN = () => {
    if (!cnData.cnNumber || !cnData.cnDate) return alert('Mandatory CN registry nodes missing (CN No/Date)');
    if (trips?.some(t => t.cnNumber === cnData.cnNumber.toUpperCase() && t.id !== selectedTrip.id)) {
      return alert(`Duplicate Registry Error: CN Number ${cnData.cnNumber} is already allocated.`);
    }

    const updates = {
      cnNumber: cnData.cnNumber.toUpperCase(),
      cnDate: cnData.cnDate,
      paymentTerms: cnData.paymentTerms,
      items: cnItems,
      updatedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), updates, { merge: true });
    setShowCNPortal(false);
  };

  const handleOpenOutPortal = (trip: any) => {
    if (!trip.cnNumber) return alert('Gate-Out Locked: CN Number registration is mandatory for vehicle release.');
    setSelectedTrip(trip);
    setOutData({
      date: format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm")
    });
    setShowOutPortal(true);
  };

  const handlePostGateOut = () => {
    const updates = {
      status: 'IN-TRANSIT',
      outDate: `${outData.date}T${outData.time}`,
      updatedAt: new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), updates, { merge: true });
    setShowOutPortal(false);
  };

  const handleUnassign = (tripId: string) => {
    if (confirm('SATELLITE LOGISTICS WARNING: ARE YOU SURE YOU WANT TO UNASSIGN THIS NODE?')) {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', tripId));
    }
  };

  const totalPackagesDisplay = React.useMemo(() => {
    const sum = cnItems.reduce((acc, r) => acc + (parseInt(r.package) || 0), 0);
    const uoms = Array.from(new Set(cnItems.filter(r => r.package && r.packageUom).map(r => r.packageUom)));
    const uom = uoms.length > 1 ? 'MIX' : (uoms[0] || '');
    return `${sum} ${uom}`;
  }, [cnItems]);

  if (!mounted) return <div className="flex-1 bg-[#f2f2f2]" />;

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
          <table className="w-full text-left border-collapse min-w-[2000px]">
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
                    <th className="p-3 border-r text-center text-blue-600">Dispatched Qty</th>
                    <th className="p-3 border-r text-center text-emerald-600">Balance Qty</th>
                    <th className="p-3">Action</th>
                  </>
                ) : activeTab === 'Loading' ? (
                  <>
                    <th className="p-3 border-r">Plant</th>
                    <th className="p-3 border-r">Sale Order/ Order Date time</th>
                    <th className="p-3 border-r">Trip ID/ Date time</th>
                    <th className="p-3 border-r">Material</th>
                    <th className="p-3 border-r">Consignee</th>
                    <th className="p-3 border-r">Ship to Party</th>
                    <th className="p-3 border-r">Route</th>
                    <th className="p-3 border-r">Vehicle/Driver Mobile</th>
                    <th className="p-3 border-r">Invoice/Ewaybill</th>
                    <th className="p-3 border-r">CN Number/Date</th>
                    <th className="p-3 border-r text-center">Assign Qty</th>
                    <th className="p-3">Action</th>
                  </>
                ) : (
                  <>
                    <th className="p-3 border-r">Plant</th>
                    <th className="p-3 border-r">Trip ID</th>
                    <th className="p-3 border-r">Fleet Type</th>
                    <th className="p-3 border-r">Consignor</th>
                    <th className="p-3 border-r">Consignee</th>
                    <th className="p-3 border-r">Route</th>
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
                      <td className="p-3 border-r truncate max-w-[200px]">{getRoute(item)}</td>
                      <td className="p-3 border-r text-center">{formatWeight(item.weight)}</td>
                      <td className="p-3 border-r text-center text-blue-600">{formatWeight(item.dispatched)}</td>
                      <td className="p-3 border-r text-center text-emerald-600 font-black">{formatWeight(item.balance)}</td>
                      <td className="p-3">
                         <Button onClick={() => handleOpenAssign(item)} size="sm" className="h-7 text-[9px] font-black uppercase bg-[#0056d2] rounded-none">Assign</Button>
                      </td>
                    </>
                  ) : activeTab === 'Loading' ? (
                    <>
                      <td className="p-3 border-r">{item.plantCode}</td>
                      <td className="p-3 border-r">
                        <div className="flex flex-col">
                          <span className="text-[#0056d2] font-black">{item.saleOrderNumber}</span>
                          <span className="text-[9px] text-slate-400">{item.saleOrderDate ? format(new Date(item.saleOrderDate), 'dd-MM-yy HH:mm') : '-'}</span>
                        </div>
                      </td>
                      <td className="p-3 border-r">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-700">{item.tripId}</span>
                          <span className="text-[9px] text-slate-400">{item.createdAt ? format(new Date(item.createdAt), 'dd-MM-yy HH:mm') : '-'}</span>
                        </div>
                      </td>
                      <td className="p-3 border-r text-[10px] truncate max-w-[150px]">{item.goodsDescription || 'GENERAL MATERIAL'}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.consignee}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.shipToParty}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{getRoute(item)}</td>
                      <td className="p-3 border-r">
                        <div className="flex flex-col">
                          <span className="font-black">{item.vehicleNumber}</span>
                          <span className="text-[9px] text-slate-400">{item.driverMobile || '-'}</span>
                        </div>
                      </td>
                      <td className="p-3 border-r">
                        <div className="flex flex-col">
                          <span className="text-[10px]">{item.invoiceNo || '-'}</span>
                          <span className="text-[9px] text-slate-400">{item.ewaybillNo || '-'}</span>
                        </div>
                      </td>
                      <td className="p-3 border-r">
                        <div className="flex flex-col gap-1">
                          {item.cnNumber ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[#1e3a8a] font-black">{item.cnNumber}</span>
                              <button onClick={() => handleOpenCNPortal(item)} className="p-1 hover:bg-slate-100 transition-colors"><Edit3 className="h-3.5 w-3.5 text-slate-400" /></button>
                            </div>
                          ) : (
                            <button onClick={() => handleOpenCNPortal(item)} className="p-1 w-fit bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-sm" title="Add CN Registry">
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                          <span className="text-[9px] text-slate-400">{item.cnDate ? format(new Date(item.cnDate), 'dd-MM-yy') : '-'}</span>
                        </div>
                      </td>
                      <td className="p-3 border-r text-center font-black">{formatWeight(item.assignWeight)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                           <Button onClick={() => handleOpenOutPortal(item)} size="sm" className="h-7 text-[8px] font-black uppercase bg-[#1e3a8a] rounded-none shadow-sm transition-all active:scale-95">Out</Button>
                           <Button onClick={() => router.push(`/dashboard/tr24?q=${item.saleOrderNumber}`)} size="sm" variant="outline" className="h-7 text-[8px] font-black uppercase rounded-none px-2"><Radar className="h-3 w-3" /></Button>
                           <Button onClick={() => handleUnassign(item.id)} size="sm" variant="ghost" className="h-7 text-[8px] font-black uppercase rounded-none text-red-600 hover:bg-red-50">Unassign</Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 border-r">{item.plantCode}</td>
                      <td className="p-3 border-r text-[#0056d2] font-black">{item.tripId}</td>
                      <td className="p-3 border-r">{item.vehicleType || 'OWN'}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.consignor}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.consignee}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{getRoute(item)}</td>
                      <td className="p-3 border-r font-black">{item.vehicleNumber}</td>
                      <td className="p-3 border-r text-center font-black">{formatWeight(item.assignWeight)}</td>
                      <td className="p-3">
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
            <input 
              type="number" 
              min="1" 
              max={totalPages} 
              value={currentPage} 
              onChange={e => setCurrentPage(Math.max(1, Math.min(totalPages, Number(e.target.value))))} 
              className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black outline-none focus:ring-1" 
            />
            <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Registry Page {currentPage} of {totalPages || 1}</span>
        </div>
      </div>

      {/* Assign Vehicle Portal */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-4xl rounded-none border-[4px] border-[#0056d2] font-mono p-0 overflow-hidden">
           <DialogHeader className="bg-slate-50 p-4 border-b border-slate-200">
             <DialogTitle className="text-sm font-black uppercase italic tracking-tighter flex justify-between items-center">
                <span>Vehicle Node Assignment Portal</span>
                <span className="text-[#0056d2] text-xs">Order: {selectedOrder?.saleOrder}</span>
             </DialogTitle>
           </DialogHeader>
           
           <div className="p-8 space-y-10 bg-white">
              <div className="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 shadow-sm">
                 <div className="bg-slate-50 p-4 space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Ship To Party</span>
                    <p className="text-[11px] font-black truncate">{selectedOrder?.shipToParty}</p>
                 </div>
                 <div className="bg-slate-50 p-4 space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Route</span>
                    <p className="text-[11px] font-black truncate">{getRoute(selectedOrder)}</p>
                 </div>
                 <div className="bg-slate-50 p-4 space-y-1 text-right">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Total Order Qty</span>
                    <p className="text-[11px] font-black text-[#0056d2]">{formatWeight(selectedOrder?.weight)} MT</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-x-16 gap-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Vehicle Number *</label>
                    <input value={assignData.vehicleNumber} onChange={e => setAssignData({...assignData, vehicleNumber: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black uppercase outline-none focus:bg-yellow-50 focus:ring-1 transition-all" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Driver Mobile</label>
                    <input value={assignData.driverMobile} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black outline-none focus:bg-yellow-50" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Fleet Type *</label>
                    <select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-[12px] font-black uppercase outline-none">
                       <option value="Own Vehicle">Own Vehicle</option>
                       <option value="Contract Vehicle">Contract Vehicle</option>
                       <option value="Market Vehicle">Market Vehicle</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Assign Qty (MT) *</label>
                    <input type="number" step="0.001" value={assignData.assignQty} onChange={e => setAssignData({...assignData, assignQty: parseFloat(e.target.value)})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black outline-none focus:bg-yellow-50" />
                 </div>
                 
                 {assignData.fleetType === 'Market Vehicle' && (
                   <>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Vendor Name *</label>
                        <select value={assignData.vendorId} onChange={e => setAssignData({...assignData, vendorId: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-[12px] font-black uppercase outline-none">
                           <option value="">Select Vendor Registry...</option>
                           {vendors?.map(v => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
                        </select>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Rate (Per MT)</label>
                        <input disabled={assignData.isFixRate} type="number" value={assignData.rate} onChange={e => setAssignData({...assignData, rate: parseFloat(e.target.value), freightAmount: (parseFloat(e.target.value) || 0) * assignData.assignQty})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black outline-none disabled:bg-slate-100 disabled:text-slate-400" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Freight Amount</label>
                        <div className="flex gap-2 items-center">
                           <input disabled={!assignData.isFixRate} type="number" value={assignData.freightAmount} onChange={e => setAssignData({...assignData, freightAmount: parseFloat(e.target.value)})} className="h-8 flex-1 border border-slate-400 px-2 text-[12px] font-black outline-none disabled:bg-slate-50" />
                           <div className="flex items-center gap-2 shrink-0 px-2 py-1 bg-slate-100 border border-slate-200">
                              <Checkbox checked={assignData.isFixRate} onCheckedChange={checked => setAssignData({...assignData, isFixRate: !!checked})} className="rounded-none h-4 w-4" />
                              <span className="text-[9px] font-black uppercase">Fix</span>
                           </div>
                        </div>
                     </div>
                   </>
                 )}
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
                 <Button onClick={() => setShowAssign(false)} variant="outline" className="h-10 px-8 rounded-none text-[10px] font-black uppercase text-red-600 border-red-200 hover:bg-red-50 transition-all">Cancel Execution</Button>
                 <Button onClick={handlePostAssignment} className="h-10 px-12 rounded-none bg-[#0056d2] text-white text-[10px] font-black uppercase shadow-xl transition-all active:scale-95">Post Assignment (F8)</Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* Consignment Note Interface */}
      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-6xl rounded-none border-[4px] border-[#1e3a8a] font-mono p-0">
          <DialogHeader className="bg-slate-900 text-white p-4">
            <DialogTitle className="text-sm font-black uppercase italic tracking-tighter flex justify-between items-center">
              <span>Consignment Note Interface – CN Entry Registry</span>
              <span className="text-blue-400 text-xs">Trip ID: {selectedTrip?.tripId}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-8 bg-white">
            <div className="grid grid-cols-4 gap-4 bg-slate-100 p-4 border border-slate-200 shadow-sm">
               <div className="space-y-1"><span className="text-[8px] font-black text-slate-400 uppercase">Ship To Party</span><p className="text-[10px] font-black truncate">{selectedTrip?.shipToParty}</p></div>
               <div className="space-y-1"><span className="text-[8px] font-black text-slate-400 uppercase">Vehicle Number</span><p className="text-[10px] font-black">{selectedTrip?.vehicleNumber}</p></div>
               <div className="space-y-1"><span className="text-[8px] font-black text-slate-400 uppercase">Route</span><p className="text-[10px] font-black truncate">{getRoute(selectedTrip)}</p></div>
               <div className="space-y-1 text-right"><span className="text-[8px] font-black text-slate-400 uppercase">Assign Qty</span><p className="text-[10px] font-black">{formatWeight(selectedTrip?.assignWeight)} MT</p></div>
            </div>

            <div className="grid grid-cols-3 gap-6">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CN Number *</label>
                  <input value={cnData.cnNumber} onChange={e => setCnData({...cnData, cnNumber: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black outline-none focus:bg-yellow-50" placeholder="ENTER CN NO..." />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CN Date *</label>
                  <input type="date" value={cnData.cnDate} onChange={e => setCnData({...cnData, cnDate: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Payment Terms</label>
                  <select value={cnData.paymentTerms} onChange={e => setCnData({...cnData, paymentTerms: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-[12px] font-black outline-none">
                     <option value="Paid">Paid</option>
                     <option value="To Pay">To Pay</option>
                  </select>
               </div>
            </div>

            <div className="space-y-3">
               <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Material Node Items</h4>
                  <Button onClick={() => setCnItems([...cnItems, { invoice: '', ewaybill: '', material: '', package: '', packageUom: 'BAG' }])} size="sm" variant="outline" className="h-6 rounded-none text-[8px] font-black uppercase bg-slate-50 border-slate-300"><Plus className="h-3 w-3 mr-1" /> Add Node</Button>
               </div>
               <div className="border border-slate-300 shadow-inner max-h-[300px] overflow-y-auto green-scrollbar">
                  <table className="w-full text-left border-collapse">
                     <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                        <tr className="text-[8px] font-black uppercase text-slate-500">
                           <th className="p-2 border-r">Invoice No</th>
                           <th className="p-2 border-r">E-Waybill No</th>
                           <th className="p-2 border-r">Material Description</th>
                           <th className="p-2 border-r w-24 text-center">Package Qty</th>
                           <th className="p-2 border-r w-24 text-center">UOM</th>
                           <th className="p-2 w-10"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {cnItems.map((row, idx) => (
                           <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-1 border-r"><input value={row.invoice} onChange={e => { const n = [...cnItems]; n[idx].invoice = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 border-none bg-transparent px-2 text-[10px] font-black outline-none focus:bg-yellow-50" /></td>
                              <td className="p-1 border-r"><input value={row.ewaybill} onChange={e => { const n = [...cnItems]; n[idx].ewaybill = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 border-none bg-transparent px-2 text-[10px] font-black outline-none focus:bg-yellow-50" /></td>
                              <td className="p-1 border-r"><input value={row.material} onChange={e => { const n = [...cnItems]; n[idx].material = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 border-none bg-transparent px-2 text-[10px] font-black outline-none focus:bg-yellow-50" /></td>
                              <td className="p-1 border-r"><input type="number" value={row.package} onChange={e => { const n = [...cnItems]; n[idx].package = e.target.value; setCnItems(n); }} className="w-full h-7 border-none bg-transparent px-2 text-[10px] font-black text-center outline-none focus:bg-yellow-50" /></td>
                              <td className="p-1 border-r">
                                 <select value={row.packageUom} onChange={e => { const n = [...cnItems]; n[idx].packageUom = e.target.value; setCnItems(n); }} className="w-full h-7 border-none bg-transparent px-2 text-[9px] font-black outline-none">
                                    <option value="BAG">BAG</option>
                                    <option value="BOX">BOX</option>
                                    <option value="DRUM">DRUM</option>
                                    <option value="MIX">MIX</option>
                                 </select>
                              </td>
                              <td className="p-1 text-center">
                                 <button onClick={() => setCnItems(cnItems.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash className="h-3.5 w-3.5" /></button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               <div className="bg-slate-900 text-white p-3 flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-4">
                  <span>Grand Total Node Items:</span>
                  <span>{totalPackagesDisplay}</span>
               </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
               <Button onClick={() => setShowCNPortal(false)} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase text-slate-500">Cancel</Button>
               <Button onClick={handlePostCN} className="h-9 px-12 rounded-none bg-[#1e3a8a] text-white text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Post CN Registry (F8)</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gate-Out Control */}
      <Dialog open={showOutPortal} onOpenChange={setShowOutPortal}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-[#0f172a] font-mono p-0">
           <DialogHeader className="bg-slate-900 text-white p-4">
              <DialogTitle className="text-sm font-black uppercase italic tracking-tighter">Gate-Out Control Node</DialogTitle>
           </DialogHeader>
           <div className="p-8 space-y-8 bg-white">
              <div className="space-y-4 border-b border-slate-100 pb-6">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase"><span className="text-slate-400">Vehicle No:</span><span className="text-slate-800">{selectedTrip?.vehicleNumber}</span></div>
                 <div className="flex justify-between items-center text-[10px] font-black uppercase"><span className="text-slate-400">Route Node:</span><span className="text-slate-800">{getRoute(selectedTrip)}</span></div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Out Date *</label>
                    <input type="date" value={outData.date} onChange={e => setOutData({...outData, date: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black outline-none focus:bg-yellow-50" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Out Time *</label>
                    <input type="time" value={outData.time} onChange={e => setOutData({...outData, time: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black outline-none focus:bg-yellow-50" />
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <Button onClick={() => setShowOutPortal(false)} variant="outline" className="flex-1 h-10 rounded-none text-[10px] font-black uppercase text-red-600 border-red-200">Cancel</Button>
                 <Button onClick={handlePostGateOut} className="flex-1 h-10 rounded-none bg-[#0f172a] text-white text-[10px] font-black uppercase shadow-lg">Confirm Out (F8)</Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
