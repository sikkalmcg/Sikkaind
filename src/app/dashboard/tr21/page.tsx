'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ChevronLeft, ChevronRight, X, Download, 
  Plus, Trash, Edit3, Radar, Truck, MapPin, Package, ShoppingCart, CheckCircle
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
  const [showPODPortal, setShowPODPortal] = React.useState(false);
  const [showCNPreview, setShowCNPreview] = React.useState(false);
  
  // Forms
  const [assignData, setAssignData] = React.useState<any>({});
  const [cnData, setCnData] = React.useState<any>({});
  const [cnItems, setCnItems] = React.useState<any[]>([]);
  const [outData, setOutData] = React.useState({ date: '', time: '' });
  const [arrivalData, setArrivalData] = React.useState({ date: '', time: '' });
  const [unloadData, setUnloadData] = React.useState({ date: '', time: '' });
  const [rejectData, setRejectData] = React.useState({ date: '', time: '', reason: '' });
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

  const handlePostAssignment = () => {
    if (!assignData.vehicleNumber || !assignData.assignQty) return alert('Mandatory fields missing');
    if (parseFloat(assignData.assignQty) > selectedOrder.balance) return alert('Assign Qty exceeds balance');
    
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
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

  if (!mounted) return <div className="flex-1 bg-[#f2f2f2]" />;

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 flex items-center justify-between shadow-sm">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic tracking-tighter">TR21 – TRIP BOARD CONTROL HUB</h2>
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
                           <Button onClick={() => { if(confirm('System Command: Unassign Trip Registry?')) deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', item.id)); }} size="sm" variant="ghost" className="h-7 text-[8px] font-black text-red-600 rounded-none">Unassign</Button>
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

      {/* Popups */}
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
    </div>
  );
}
