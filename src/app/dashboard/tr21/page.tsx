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
import Image from 'next/image';
import placeholderData from '@/app/lib/placeholder-images.json';

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
  const [showArrivalPortal, setShowArrivalPortal] = React.useState(false);
  const [showUnloadPortal, setShowUnloadPortal] = React.useState(false);
  const [showRejectPortal, setShowRejectPortal] = React.useState(false);
  const [showSRNPortal, setShowSRNPortal] = React.useState(false);
  const [showPODPortal, setShowPODPortal] = React.useState(false);
  const [showCNPreview, setShowCNPreview] = React.useState(false);
  const [showEditVehicle, setShowEditVehicle] = React.useState(false);
  
  // Forms
  const [assignData, setAssignData] = React.useState<any>({});
  const [cnData, setCnData] = React.useState<any>({});
  const [cnItems, setCnItems] = React.useState<any[]>([]);
  const [outData, setOutData] = React.useState({ date: '', time: '' });
  const [arrivalData, setArrivalData] = React.useState({ date: '', time: '' });
  const [unloadData, setUnloadData] = React.useState({ date: '', time: '' });
  const [rejectData, setRejectData] = React.useState({ date: '', time: '', reason: '' });
  const [srnData, setSrnData] = React.useState({ number: '', date: '' });
  const [podFile, setPodFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: plants } = useCollection(plantsQuery);
  const { data: customers } = useCollection(customersQuery);

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

  const calculatePackageTotal = (items: any[]) => {
    if (!items.length) return '0';
    const total = items.reduce((acc, curr) => acc + (parseInt(curr.package) || 0), 0);
    const uoms = new Set(items.map(i => i.uom));
    const label = uoms.size > 1 ? 'MIX' : (Array.from(uoms)[0] || 'PKG');
    return `${total} ${label}`;
  };

  const generateTripId = () => {
    const digits = Math.floor(100000000 + Math.random() * 900000000);
    return `T${digits}`;
  };

  const handlePostAssignment = () => {
    if (!assignData.vehicleNumber || !assignData.assignQty) return alert('Mandatory fields missing');
    if (parseFloat(assignData.assignQty) > selectedOrder.balance) return alert('Assign Qty exceeds balance');
    
    const tripId = generateTripId();
    if (trips?.some(t => t.tripId === tripId)) return handlePostAssignment(); // Recurse on conflict

    const selectedVendor = vendors?.find(v => v.id === assignData.vendorId);
    
    const newTrip = {
      id: crypto.randomUUID(),
      tripId,
      saleOrderId: selectedOrder.id,
      saleOrderNumber: selectedOrder.saleOrder,
      plantCode: selectedOrder.plantCode,
      consignor: selectedOrder.consignor,
      consignee: selectedOrder.consignee,
      shipToParty: selectedOrder.shipToParty,
      destination: selectedOrder.destination,
      vehicleNumber: assignData.vehicleNumber.toUpperCase(),
      driverMobile: assignData.driverMobile || '',
      fleetType: assignData.fleetType,
      assignWeight: assignData.assignQty,
      vendorName: selectedVendor?.vendorName || '',
      vendorMobile: selectedVendor?.mobile || '',
      rate: assignData.rate || 0,
      freightAmount: assignData.freightAmount || 0,
      status: 'LOADING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', newTrip.id), newTrip, { merge: true });
    setShowAssign(false);
  };

  const handlePostCN = () => {
    if (!cnData.cnNumber) return alert('CN Number Mandatory');
    if (trips?.some(t => t.cnNumber === cnData.cnNumber.toUpperCase() && t.id !== selectedTrip.id)) {
      return alert('Duplicate CN Number Found');
    }

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), { 
      cnNumber: cnData.cnNumber.toUpperCase(),
      cnDate: cnData.cnDate,
      paymentTerms: cnData.paymentTerms || 'PAID',
      items: cnItems,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowCNPortal(false);
  };

  const handlePostGateOut = () => {
    if (!selectedTrip.cnNumber) return alert('CN Registry Required before Gate-Out');
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), { 
      status: 'IN-TRANSIT',
      outDate: `${outData.date}T${outData.time}`,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowOutPortal(false);
  };

  const handlePostArrival = () => {
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), { 
      status: 'ARRIVED',
      arrivedDate: `${arrivalData.date}T${arrivalData.time}`,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowArrivalPortal(false);
  };

  const handlePostUnload = () => {
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), { 
      status: 'POD',
      unloadDate: `${unloadData.date}T${unloadData.time}`,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowUnloadPortal(false);
  };

  const handlePostReject = () => {
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), { 
      status: 'REJECTION',
      rejectDate: `${rejectData.date}T${rejectData.time}`,
      rejectReason: rejectData.reason,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowRejectPortal(false);
  };

  const handlePostPOD = () => {
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), { 
      status: 'CLOSED',
      podStatus: 'VERIFIED',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowPODPortal(false);
  };

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
                ) : (
                  <>
                    <th className="p-3 border-r">Plant</th>
                    <th className="p-3 border-r">Sale Order/ Date time</th>
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
                         <Button onClick={() => { setSelectedOrder(item); setAssignData({assignQty: item.balance, fleetType: 'Own Vehicle'}); setShowAssign(true); }} size="sm" className="h-7 text-[9px] font-black uppercase bg-[#0056d2] rounded-none">Assign</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 border-r">{item.plantCode}</td>
                      <td className="p-3 border-r">
                         <div className="flex flex-col">
                           <span className="text-[#0056d2] font-black">{item.saleOrderNumber}</span>
                           <span className="text-[9px] text-slate-400">{item.saleOrderDate ? format(new Date(item.saleOrderDate), 'dd-MM HH:mm') : '-'}</span>
                         </div>
                      </td>
                      <td className="p-3 border-r">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-700">{item.tripId}</span>
                          <span className="text-[9px] text-slate-400">{item.createdAt ? format(new Date(item.createdAt), 'dd-MM HH:mm') : '-'}</span>
                        </div>
                      </td>
                      <td className="p-3 border-r italic text-slate-400">
                        {item.items?.[0]?.material || 'PENDING CN...'}
                      </td>
                      <td className="p-3 border-r truncate max-w-[150px]">{item.consignee}</td>
                      <td className="p-3 border-r truncate max-w-[150px]">{item.shipToParty}</td>
                      <td className="p-3 border-r truncate max-w-[150px]">{getRoute(item)}</td>
                      <td className="p-3 border-r">
                         <div className="flex flex-col">
                           <span className="font-black">{item.vehicleNumber}</span>
                           <span className="text-[9px] text-slate-400">{item.driverMobile || '-'}</span>
                         </div>
                      </td>
                      <td className="p-3 border-r">
                         <div className="flex flex-col">
                           <span className="font-black">{item.items?.[0]?.invoice || '-'}</span>
                           <span className="text-[9px] text-slate-400">{item.items?.[0]?.ewaybill || '-'}</span>
                         </div>
                      </td>
                      <td className="p-3 border-r">
                        <div className="flex items-center gap-2">
                          {item.cnNumber ? (
                            <div className="flex items-center gap-2">
                               <span onClick={() => { setSelectedTrip(item); setShowCNPreview(true); }} className="text-[#1e3a8a] font-black cursor-pointer hover:underline">{item.cnNumber}</span>
                               <button onClick={() => { setSelectedTrip(item); setCnData({cnNumber: item.cnNumber, cnDate: item.cnDate, paymentTerms: item.paymentTerms}); setCnItems(item.items || []); setShowCNPortal(true); }} className="p-1 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5 text-slate-300" /></button>
                            </div>
                          ) : (
                            <button onClick={() => { setSelectedTrip(item); setCnData({cnDate: format(new Date(), 'yyyy-MM-dd'), paymentTerms: 'PAID'}); setCnItems([{material: 'GENERAL CARGO', package: '0', uom: 'Bag', invoice: '', ewaybill: ''}]); setShowCNPortal(true); }} className="p-1.5 bg-blue-50 hover:bg-blue-100 transition-colors"><Plus className="h-4 w-4 text-[#0056d2]" /></button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-r text-center font-black">{formatWeight(item.assignWeight)}</td>
                      <td className="p-3">
                         <div className="flex gap-2">
                           {activeTab === 'Loading' && <Button onClick={() => { setSelectedTrip(item); setOutData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowOutPortal(true); }} size="sm" className="h-7 text-[8px] font-black uppercase bg-[#1e3a8a] rounded-none">Out</Button>}
                           {activeTab === 'In-Transit' && <Button onClick={() => { setSelectedTrip(item); setArrivalData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowArrivalPortal(true); }} size="sm" className="h-7 text-[8px] font-black uppercase bg-emerald-600 rounded-none">Arrived</Button>}
                           {activeTab === 'Arrived' && (
                             <>
                               <Button onClick={() => { setSelectedTrip(item); setUnloadData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowUnloadPortal(true); }} size="sm" className="h-7 text-[8px] font-black uppercase bg-emerald-600 rounded-none">Unload</Button>
                               <Button onClick={() => { setSelectedTrip(item); setRejectData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), reason: ''}); setShowRejectPortal(true); }} size="sm" className="h-7 text-[8px] font-black uppercase bg-red-600 rounded-none">Reject</Button>
                             </>
                           )}
                           {activeTab === 'POD Verify' && <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} size="sm" className="h-7 text-[8px] font-black uppercase bg-blue-600 rounded-none">Verify POD</Button>}
                           <Button onClick={() => { if(confirm('Unassign Trip Registry?')) deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', item.id)); }} size="sm" variant="ghost" className="h-7 text-[8px] font-black text-red-600 rounded-none">Unassign</Button>
                         </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 bg-white border border-slate-300 p-2 flex items-center justify-between shadow-sm">
          <div className="flex gap-2 items-center">
            <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
            <input type="number" value={currentPage} onChange={e => setCurrentPage(Math.max(1, Math.min(totalPages, Number(e.target.value))))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black" />
            <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Registry Page {currentPage} of {totalPages || 1}</span>
        </div>
      </div>

      {/* Portals */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-4xl rounded-none border-[4px] border-[#0056d2] font-mono p-0">
           <DialogHeader className="bg-slate-50 p-4 border-b border-slate-200">
              <DialogTitle className="text-sm font-black uppercase italic tracking-tighter">Vehicle Node Assignment</DialogTitle>
           </DialogHeader>
           <div className="p-8 space-y-6">
              <div className="bg-blue-50 p-4 border border-blue-100 grid grid-cols-3 gap-4">
                 <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400">Ship to Party</span><span className="text-xs font-black truncate">{selectedOrder?.shipToParty}</span></div>
                 <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400">Route</span><span className="text-xs font-black truncate">{getRoute(selectedOrder)}</span></div>
                 <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400">Order Balance</span><span className="text-xs font-black">{formatWeight(selectedOrder?.balance)} MT</span></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Vehicle Number</label><input value={assignData.vehicleNumber || ''} onChange={e => setAssignData({...assignData, vehicleNumber: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black focus:bg-yellow-50" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Driver Mobile</label><input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Fleet Type</label>
                   <select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black bg-white"><option value="Own Vehicle">Own Vehicle</option><option value="Contract Vehicle">Contract Vehicle</option><option value="Market Vehicle">Market Vehicle</option></select>
                 </div>
                 <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Assign Qty (MT)</label><input type="number" step="0.001" value={assignData.assignQty} onChange={e => setAssignData({...assignData, assignQty: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black" /></div>
              </div>

              {assignData.fleetType === 'Market Vehicle' && (
                <div className="grid grid-cols-2 gap-6 p-6 border-2 border-dashed border-slate-200 bg-slate-50/50 animate-fade-in">
                   <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Vendor Name</label>
                      <select value={assignData.vendorId} onChange={e => { const v = vendors?.find(vend => vend.id === e.target.value); setAssignData({...assignData, vendorId: e.target.value, vendorMobile: v?.mobile || ''}); }} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black bg-white"><option value="">SELECT VENDOR...</option>{vendors?.map(v => <option key={v.id} value={v.id}>{v.vendorName}</option>)}</select>
                   </div>
                   <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Vendor Mobile</label><input value={assignData.vendorMobile || ''} readOnly className="h-8 w-full border border-slate-200 bg-slate-100 px-2 text-[12px] font-bold" /></div>
                   <div className="space-y-1 flex flex-col justify-end">
                      <div className="flex items-center gap-2 mb-2"><Checkbox id="fix" checked={assignData.fixRate} onCheckedChange={v => setAssignData({...assignData, fixRate: !!v})} /><label htmlFor="fix" className="text-[9px] font-black uppercase cursor-pointer">Fix Freight Charge</label></div>
                      {!assignData.fixRate && <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Rate (per MT)</label><input type="number" value={assignData.rate || ''} onChange={e => setAssignData({...assignData, rate: e.target.value, freightAmount: (parseFloat(e.target.value) || 0) * (parseFloat(assignData.assignQty) || 0)})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black" /></div>}
                   </div>
                   <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Freight Amount</label><input type="number" value={assignData.freightAmount || ''} readOnly={!assignData.fixRate} onChange={e => setAssignData({...assignData, freightAmount: e.target.value})} className={cn("h-8 w-full border border-slate-400 px-2 text-[12px] font-black", !assignData.fixRate && "bg-slate-100")} /></div>
                </div>
              )}

              <div className="flex justify-end gap-4 pt-4"><Button onClick={() => setShowAssign(false)} variant="outline" className="h-10 rounded-none uppercase text-[10px] font-black px-10">Cancel</Button><Button onClick={handlePostAssignment} className="h-10 px-12 rounded-none bg-[#0056d2] text-white text-[10px] font-black uppercase shadow-lg">Post Assignment (F8)</Button></div>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-5xl rounded-none border-[4px] border-[#1e3a8a] font-mono p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="bg-slate-900 text-white p-4 shrink-0"><DialogTitle className="text-sm font-black uppercase italic tracking-tighter">Consignment Note Registry</DialogTitle></DialogHeader>
          <div className="p-8 space-y-6 overflow-y-auto green-scrollbar">
             <div className="bg-blue-50 p-4 border border-blue-100 grid grid-cols-4 gap-4">
                <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400">Vehicle</span><span className="text-xs font-black">{selectedTrip?.vehicleNumber}</span></div>
                <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400">Route</span><span className="text-xs font-black truncate">{getRoute(selectedTrip)}</span></div>
                <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400">Assign Qty</span><span className="text-xs font-black">{formatWeight(selectedTrip?.assignWeight)} MT</span></div>
                <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400">Consignee</span><span className="text-xs font-black truncate">{selectedTrip?.consignee}</span></div>
             </div>
             <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">CN Number *</label><input value={cnData.cnNumber || ''} onChange={e => setCnData({...cnData, cnNumber: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black focus:bg-yellow-50" placeholder="E.G. CN-4829" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">CN Date</label><input type="date" value={cnData.cnDate} onChange={e => setCnData({...cnData, cnDate: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Payment Terms</label><select value={cnData.paymentTerms} onChange={e => setCnData({...cnData, paymentTerms: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black bg-white"><option value="PAID">PAID</option><option value="TO PAY">TO PAY</option></select></div>
             </div>

             <div className="border border-slate-300">
                <div className="bg-slate-50 border-b border-slate-300 p-2 flex justify-between items-center"><h4 className="text-[10px] font-black uppercase text-slate-500">Material Items Node</h4><Button onClick={() => setCnItems([...cnItems, {material: '', package: '0', uom: 'Bag', invoice: '', ewaybill: ''}])} size="sm" variant="outline" className="h-6 rounded-none text-[8px] font-black uppercase"><Plus className="h-3 w-3 mr-1" /> Add Row</Button></div>
                <table className="w-full text-[10px]">
                   <thead className="border-b border-slate-200">
                      <tr className="font-black uppercase text-slate-400">
                        <th className="p-2 border-r">Invoice</th>
                        <th className="p-2 border-r">E-Waybill</th>
                        <th className="p-2 border-r">Material</th>
                        <th className="p-2 border-r w-24">Pkg Qty</th>
                        <th className="p-2 border-r w-24">UOM</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                   </thead>
                   <tbody>{cnItems.map((item, i) => (
                     <tr key={i} className="border-b border-slate-100">
                        <td className="p-1 border-r"><input value={item.invoice} onChange={e => { const n = [...cnItems]; n[i].invoice = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 px-1 outline-none font-bold" /></td>
                        <td className="p-1 border-r"><input value={item.ewaybill} onChange={e => { const n = [...cnItems]; n[i].ewaybill = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 px-1 outline-none font-bold" /></td>
                        <td className="p-1 border-r"><input value={item.material} onChange={e => { const n = [...cnItems]; n[i].material = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 px-1 outline-none font-bold" /></td>
                        <td className="p-1 border-r"><input type="number" value={item.package} onChange={e => { const n = [...cnItems]; n[i].package = e.target.value; setCnItems(n); }} className="w-full h-7 px-1 outline-none font-bold text-center" /></td>
                        <td className="p-1 border-r"><select value={item.uom} onChange={e => { const n = [...cnItems]; n[i].uom = e.target.value; setCnItems(n); }} className="w-full h-7 px-1 outline-none font-bold bg-white"><option value="Bag">Bag</option><option value="Box">Box</option><option value="Drum">Drum</option></select></td>
                        <td className="p-1 text-center"><button onClick={() => setCnItems(cnItems.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash className="h-3.5 w-3.5" /></button></td>
                     </tr>
                   ))}</tbody>
                </table>
                <div className="bg-slate-50 p-2 text-right"><span className="text-[9px] font-black uppercase text-slate-400">Total Package Registry: </span><span className="text-[11px] font-black text-[#1e3a8a]">{calculatePackageTotal(cnItems)}</span></div>
             </div>

             <div className="flex justify-end gap-4 pt-4"><Button onClick={() => setShowCNPortal(false)} variant="outline" className="h-10 px-10 rounded-none text-[10px] font-black uppercase text-slate-500">Cancel</Button><Button onClick={handlePostCN} className="h-10 px-12 rounded-none bg-[#1e3a8a] text-white text-[10px] font-black uppercase shadow-lg">Post CN Registry (F8)</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOutPortal} onOpenChange={setShowOutPortal}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-[#0f172a] font-mono p-0">
           <DialogHeader className="bg-slate-900 text-white p-4"><DialogTitle className="text-sm font-black uppercase italic">Gate-Out Control Node</DialogTitle></DialogHeader>
           <div className="p-8 space-y-6">
              <div className="bg-slate-50 p-4 border border-slate-200 grid grid-cols-2 gap-4">
                 <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400">Vehicle</span><span className="text-xs font-black">{selectedTrip?.vehicleNumber}</span></div>
                 <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-slate-400">CN Number</span><span className="text-xs font-black">{selectedTrip?.cnNumber}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Out Date</label><input type="date" value={outData.date} onChange={e => setOutData({...outData, date: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black focus:bg-yellow-50" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Out Time</label><input type="time" value={outData.time} onChange={e => setOutData({...outData, time: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black focus:bg-yellow-50" /></div>
              </div>
              <div className="flex gap-4 pt-4"><Button onClick={() => setShowOutPortal(false)} variant="outline" className="flex-1 h-10 rounded-none text-[10px] font-black uppercase text-red-600 border-red-200">Cancel</Button><Button onClick={handlePostGateOut} className="flex-1 h-10 rounded-none bg-[#0f172a] text-white text-[10px] font-black uppercase shadow-lg">Confirm Out (F8)</Button></div>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showArrivalPortal} onOpenChange={setShowArrivalPortal}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-emerald-600 font-mono p-0">
           <DialogHeader className="bg-emerald-600 text-white p-4"><DialogTitle className="text-sm font-black uppercase italic">Destination Arrival Node</DialogTitle></DialogHeader>
           <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Arrival Date</label><input type="date" value={arrivalData.date} onChange={e => setArrivalData({...arrivalData, date: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Arrival Time</label><input type="time" value={arrivalData.time} onChange={e => setArrivalData({...arrivalData, time: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black" /></div>
              </div>
              <div className="flex gap-4 pt-4"><Button onClick={() => setShowArrivalPortal(false)} variant="outline" className="flex-1 h-10 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handlePostArrival} className="flex-1 h-10 rounded-none bg-emerald-600 text-white text-[10px] font-black uppercase">Post Arrival (F8)</Button></div>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUnloadPortal} onOpenChange={setShowUnloadPortal}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-blue-600 font-mono p-0">
           <DialogHeader className="bg-blue-600 text-white p-4"><DialogTitle className="text-sm font-black uppercase italic">Unloading registry node</DialogTitle></DialogHeader>
           <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Unload Date</label><input type="date" value={unloadData.date} onChange={e => setUnloadData({...unloadData, date: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Unload Time</label><input type="time" value={unloadData.time} onChange={e => setUnloadData({...unloadData, time: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black" /></div>
              </div>
              <div className="flex gap-4 pt-4"><Button onClick={() => setShowUnloadPortal(false)} variant="outline" className="flex-1 h-10 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handlePostUnload} className="flex-1 h-10 rounded-none bg-blue-600 text-white text-[10px] font-black uppercase">Post Unload (F8)</Button></div>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectPortal} onOpenChange={setShowRejectPortal}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-red-600 font-mono p-0">
           <DialogHeader className="bg-red-600 text-white p-4"><DialogTitle className="text-sm font-black uppercase italic">Trip Rejection Node</DialogTitle></DialogHeader>
           <div className="p-8 space-y-6">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase">Reject Reason *</label><textarea value={rejectData.reason} onChange={e => setRejectData({...rejectData, reason: e.target.value.toUpperCase()})} className="w-full h-24 border border-slate-400 p-2 text-[12px] font-black resize-none" placeholder="ENTER VALID REASON..." /></div>
              <div className="flex gap-4 pt-4"><Button onClick={() => setShowRejectPortal(false)} variant="outline" className="flex-1 h-10 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handlePostReject} className="flex-1 h-10 rounded-none bg-red-600 text-white text-[10px] font-black uppercase">Confirm Rejection</Button></div>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPODPortal} onOpenChange={setShowPODPortal}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-blue-900 font-mono p-0">
           <DialogHeader className="bg-blue-900 text-white p-4"><DialogTitle className="text-sm font-black uppercase italic">POD Verification Gateway</DialogTitle></DialogHeader>
           <div className="p-8 space-y-6">
              <div className="border-2 border-dashed border-slate-200 p-10 text-center rounded-sm bg-slate-50 flex flex-col items-center gap-4">
                 <input type="file" id="pod-up" className="hidden" onChange={e => setPodFile(e.target.files?.[0] || null)} />
                 <label htmlFor="pod-up" className="cursor-pointer group flex flex-col items-center gap-2">
                    <Download className="h-8 w-8 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    <span className="text-[10px] font-black text-slate-400 uppercase group-hover:text-blue-900">{podFile ? podFile.name : 'Click to Upload POD Registry'}</span>
                 </label>
              </div>
              <div className="flex gap-4"><Button onClick={() => setShowPODPortal(false)} variant="outline" className="flex-1 h-10 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handlePostPOD} className="flex-1 h-10 rounded-none bg-blue-900 text-white text-[10px] font-black uppercase">Verify & Close Trip</Button></div>
           </div>
        </DialogContent>
      </Dialog>

      {/* CN Preview Portal (3 Copy System) */}
      <Dialog open={showCNPreview} onOpenChange={setShowCNPreview}>
        <DialogContent className="max-w-[210mm] h-[90vh] overflow-y-auto rounded-none border-0 p-0 bg-slate-500/50 backdrop-blur-sm scrollbar-hide">
           <div id="printable-area" className="flex flex-col gap-8 p-10 bg-white">
              {['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'].map(label => (
                <div key={label} className="cn-print-page bg-white p-8 relative min-h-[297mm] shadow-2xl mb-8 flex flex-col border border-black">
                   <div className="flex justify-between items-start mb-8">
                      <div className="flex items-start gap-4">
                        <div className="relative w-16 h-16">
                           <Image src={placeholderData.placeholderImages.find(p => p.id === 'slmc-logo')?.url || ''} alt="Logo" fill className="object-contain" unoptimized />
                        </div>
                        <div className="space-y-1">
                           <h1 className="text-lg font-black text-[#1e3a8a] uppercase leading-none">SIKKA INDUSTRIES & LOGISTICS</h1>
                           <p className="text-[8px] font-bold text-slate-500 leading-tight">ISO 9001:2015 CERTIFIED | GATEWAY HUB: GHAZIABAD - 201009</p>
                           <p className="text-[8px] font-black uppercase">GSTIN: 09AAACS4117B1Z1 | PAN: AAACS4117B</p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="border border-black px-4 py-1 text-[10px] font-black inline-block">{label}</div>
                        <p className="text-xs font-black pt-2">CN NO: {selectedTrip?.cnNumber || 'PENDING'}</p>
                        <p className="text-[9px] font-bold">DATE: {selectedTrip?.cnDate || format(new Date(), 'dd-MM-yyyy')}</p>
                      </div>
                   </div>

                   <table className="w-full border-collapse border border-black mb-6">
                      <tr className="text-[8px] font-black uppercase bg-slate-100">
                         <th className="border border-black p-2 w-1/4">Vehicle Number</th>
                         <th className="border border-black p-2 w-1/4">Driver Mobile</th>
                         <th className="border border-black p-2 w-1/4">Payment Term</th>
                         <th className="border border-black p-2 w-1/4">Trip ID</th>
                      </tr>
                      <tr className="text-[10px] font-black text-center uppercase">
                         <td className="border border-black p-2">{selectedTrip?.vehicleNumber}</td>
                         <td className="border border-black p-2">{selectedTrip?.driverMobile || '-'}</td>
                         <td className="border border-black p-2">{selectedTrip?.paymentTerms || 'PAID'}</td>
                         <td className="border border-black p-2">{selectedTrip?.tripId}</td>
                      </tr>
                   </table>

                   <div className="grid grid-cols-3 gap-0 border border-black mb-6">
                      <div className="border-r border-black p-3 min-h-[120px]">
                         <h4 className="text-[9px] font-black border-b border-black pb-1 mb-2">CONSIGNOR</h4>
                         <p className="text-[10px] font-black leading-tight mb-2">{selectedTrip?.consignor}</p>
                         <p className="text-[8px] text-slate-600 uppercase leading-relaxed italic">
                           {customers?.find(c => c.customerName === selectedTrip?.consignor)?.address || 'MITHAPUR, GUJARAT'}
                         </p>
                      </div>
                      <div className="border-r border-black p-3 min-h-[120px]">
                         <h4 className="text-[9px] font-black border-b border-black pb-1 mb-2">CONSIGNEE</h4>
                         <p className="text-[10px] font-black leading-tight mb-2">{selectedTrip?.consignee}</p>
                         <p className="text-[8px] text-slate-600 uppercase leading-relaxed italic">
                           {customers?.find(c => c.customerName === selectedTrip?.consignee)?.address || 'GHAZIABAD HUB'}
                         </p>
                      </div>
                      <div className="p-3 min-h-[120px]">
                         <h4 className="text-[9px] font-black border-b border-black pb-1 mb-2">SHIP TO PARTY</h4>
                         <p className="text-[10px] font-black leading-tight mb-2">{selectedTrip?.shipToParty}</p>
                         <p className="text-[8px] text-slate-600 uppercase leading-relaxed italic">
                           {customers?.find(c => c.customerName === selectedTrip?.shipToParty)?.address || selectedTrip?.destination}
                         </p>
                      </div>
                   </div>

                   <table className="w-full border-collapse border border-black flex-1 mb-6">
                      <thead className="bg-slate-100 text-[8px] font-black uppercase">
                         <tr>
                            <th className="border border-black p-2">Invoice No</th>
                            <th className="border border-black p-2">E-Waybill No</th>
                            <th className="border border-black p-2 text-left">Product Description</th>
                            <th className="border border-black p-2 w-16">Unit</th>
                            <th className="border border-black p-2 w-24">Weight (MT)</th>
                         </tr>
                      </thead>
                      <tbody className="text-[10px] font-black uppercase">
                         {(selectedTrip?.items || [{material: 'GENERAL CARGO', package: '0', invoice: '-', ewaybill: '-'} ]).map((row: any, i: number) => (
                           <tr key={i}>
                              <td className="border border-black p-2 text-center">{row.invoice}</td>
                              <td className="border border-black p-2 text-center">{row.ewaybill}</td>
                              <td className="border border-black p-2">{row.material}</td>
                              <td className="border border-black p-2 text-center">{row.package}</td>
                              <td className="border border-black p-2 text-center">{formatWeight(selectedTrip?.assignWeight / (selectedTrip?.items?.length || 1))}</td>
                           </tr>
                         ))}
                         <tr className="bg-slate-50">
                            <td colSpan={3} className="border border-black p-2 text-right font-black text-[9px]">TOTAL LOGISTICS NODE:</td>
                            <td className="border border-black p-2 text-center font-black">{selectedTrip?.items?.reduce((a: any, b: any) => a + (parseInt(b.package) || 0), 0)}</td>
                            <td className="border border-black p-2 text-center font-black">{formatWeight(selectedTrip?.assignWeight)}</td>
                         </tr>
                      </tbody>
                   </table>

                   <div className="space-y-6">
                      <div className="border border-black p-2">
                        <p className="text-[8px] font-black uppercase bg-slate-100 px-2 py-1 mb-2 border-b border-black">Delivery Address:</p>
                        <p className="text-[9px] font-bold min-h-[30px] px-2 italic">{selectedTrip?.destination}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-0 border border-black">
                        <div className="p-2 border-r border-black">
                           <p className="text-[8px] font-black uppercase mb-4">Consignee Acknowledgement:</p>
                           <div className="h-12" />
                        </div>
                        <div className="p-2 text-right relative">
                           <p className="text-[8px] font-black uppercase mb-4">Authorized Signature:</p>
                           <div className="h-12" />
                           <p className="text-[7px] font-bold text-slate-400 absolute bottom-1 right-2">Digitally Verified Node</p>
                        </div>
                      </div>
                      <div className="text-[7px] leading-relaxed italic text-slate-500">
                        <p className="font-black mb-1 uppercase text-[8px] text-slate-900">Terms & Conditions:</p>
                        1. This Consignment Note is subject to the conditions of carriage for the time being in force. 2. The carrier is not responsible for loss/damage due to nature of goods. 3. Dispute if any will be subject to Ghaziabad jurisdiction. 4. POD must be returned within 48 hours of delivery.
                      </div>
                      <p className="text-[8px] font-black text-center pt-4 border-t border-slate-100 uppercase tracking-widest">
                        "This Lorry Receipt was generated digitally and is to be considered as original."
                      </p>
                   </div>
                </div>
              ))}
           </div>
           <div className="sticky bottom-0 bg-slate-900 p-4 flex justify-center gap-4 z-[100] border-t border-slate-700">
              <Button onClick={() => window.print()} className="bg-emerald-600 rounded-none h-10 px-10 uppercase text-[10px] font-black shadow-xl"><Printer className="h-4 w-4 mr-2" /> Print Nodes (A4)</Button>
              <Button onClick={() => setShowCNPreview(false)} className="bg-red-600 rounded-none h-10 px-10 uppercase text-[10px] font-black shadow-xl"><X className="h-4 w-4 mr-2" /> Exit Preview</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
