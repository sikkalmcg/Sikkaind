'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ChevronLeft, ChevronRight, X, Download, 
  Plus, Trash, Edit3, Radar, Truck, MapPin, Package, ShoppingCart, CheckCircle, RefreshCw
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
  
  // Dialog States
  const [showAssign, setShowAssign] = React.useState(false);
  const [showCNPortal, setShowCNPortal] = React.useState(false);
  const [showOutPortal, setShowOutPortal] = React.useState(false);
  const [showVehiclePortal, setShowVehiclePortal] = React.useState(false);
  const [showCNPreview, setShowCNPreview] = React.useState(false);
  const [showTrackPortal, setShowTrackPortal] = React.useState(false);
  
  // Form States
  const [assignData, setAssignData] = React.useState<any>({});
  const [cnData, setCnData] = React.useState<any>({});
  const [cnItems, setCnItems] = React.useState<any[]>([]);
  const [vehicleData, setVehicleData] = React.useState({ vehicleNumber: '', driverMobile: '' });
  const [outData, setOutData] = React.useState({ date: '', time: '' });
  const [prevCN, setPrevCN] = React.useState('');
  const [trackMode, setTrackMode] = React.useState('GPS');
  const [gpsData, setGpsData] = React.useState<any[]>([]);
  const [liveLocation, setLiveLocation] = React.useState('SYNCING SATELLITE...');

  React.useEffect(() => {
    setMounted(true);
    fetchGps();
  }, []);

  const fetchGps = async () => {
    try {
      const res = await fetch('/api/gps');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.list) setGpsData(json.data.list);
      }
    } catch (e) {}
  };

  const reverseGeocode = React.useCallback((lat: number, lng: number) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]) {
        const components = results[0].address_components;
        const street = components.find((c: any) => c.types.includes('route'))?.long_name || '';
        const city = components.find((c: any) => c.types.includes('locality'))?.long_name || '';
        setLiveLocation(`${street}${street && city ? ', ' : ''}${city}` || 'LOCATION RESOLVED');
      } else {
        setLiveLocation('COORDINATE LOCK ACTIVE');
      }
    });
  }, []);

  const handleTrackClick = (trip: any) => {
    setSelectedTrip(trip);
    setLiveLocation('FETCHING NODE...');
    setShowTrackPortal(true);
    
    const vGps = gpsData.find(g => g.vehicleNumber === trip.vehicleNumber);
    if (vGps) {
      reverseGeocode(parseFloat(vGps.latitude), parseFloat(vGps.longitude));
    } else {
      setLiveLocation('NODE OFFLINE / OUT OF RANGE');
    }
  };

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

  const getMaterialDisplay = (items: any[]) => {
    if (!items || items.length === 0) return 'PENDING CN...';
    const names = Array.from(new Set(items.map(i => i.material || i.goodsDescription))).filter(Boolean);
    if (names.length <= 2) return names.join(', ');
    return 'MULTIPLE PRODUCTS';
  };

  const getInvoiceDisplay = (items: any[]) => {
    if (!items) return '-';
    return items.map(i => i.invoice || i.invoiceNo).filter(Boolean).join(', ');
  };

  const getEwaybillDisplay = (items: any[]) => {
    if (!items) return '-';
    return items.map(i => i.ewaybill || i.ewaybillNo).filter(Boolean).join(', ');
  };

  const filteredData = React.useMemo(() => {
    if (!orders || !trips || !mounted) return [];
    if (activeTab === 'Open Orders') {
      return orders.filter(o => o.status !== 'Short closed').map(o => {
        const dispatched = trips.filter(t => t.saleOrderId === o.id && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const balance = (parseFloat(o.weight) || 0) - dispatched;
        return { ...o, dispatched, balance };
      }).filter(o => o.balance > 0.001);
    }
    const statusMap: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
    return trips.filter(t => t.status === statusMap[activeTab]).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [orders, trips, activeTab, mounted]);

  const paginated = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  const calculatePackageTotal = (items: any[]) => {
    if (!items || !items.length) return '0';
    const total = items.reduce((acc, curr) => acc + (parseInt(curr.package) || 0), 0);
    const uoms = new Set(items.map(i => i.uom || i.packageUom));
    const label = uoms.size > 1 ? 'COMBINED' : (Array.from(uoms)[0] || 'PKG');
    return `${total} ${label}`;
  };

  const handlePostAssignment = () => {
    if (!assignData.vehicleNumber || !assignData.assignQty) return alert('Mandatory fields missing');
    if (parseFloat(assignData.assignQty) > selectedOrder.balance + 0.001) return alert('Assign Qty exceeds balance');
    
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
    if (!cnData.cnNo) return alert('CN Number Mandatory');
    if (activeTab === 'Loading' && trips?.some(t => t.cnNumber === cnData.cnNo.toUpperCase() && t.id !== selectedTrip.id)) {
      return alert('Registry Error: Duplicate CN Number detected.');
    }
    
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), { 
      cnNumber: cnData.cnNo.toUpperCase(),
      cnDate: cnData.cnDate,
      paymentTerms: cnData.paymentTerms,
      mode: cnData.mode,
      ratePoint: cnData.ratePoint || '',
      items: cnItems,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowCNPortal(false);
  };

  const handleUpdateVehicle = () => {
    if (!vehicleData.vehicleNumber) return alert('Vehicle Number Mandatory');
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTrip.id), {
      vehicleNumber: vehicleData.vehicleNumber.toUpperCase(),
      driverMobile: vehicleData.driverMobile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowVehiclePortal(false);
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

  const findPreviousCN = (plant: string) => {
    const plantTrips = trips?.filter(t => t.plantCode === plant && t.cnNumber).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return plantTrips?.[0]?.cnNumber || 'FIRST ENTRY';
  };

  if (!mounted) return <div className="flex-1 bg-[#f2f2f2]" />;

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 flex items-center justify-between shadow-sm">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic tracking-tighter leading-none">TR21 – TRIP BOARD CONTROL HUB</h2>
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
          <table className="w-full text-left border-collapse min-w-[2200px]">
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
                      <td className="p-3 border-r max-w-[200px] truncate text-slate-500">
                        {getMaterialDisplay(item.items)}
                      </td>
                      <td className="p-3 border-r truncate max-w-[150px]">{item.consignee}</td>
                      <td className="p-3 border-r truncate max-w-[150px]">{item.shipToParty}</td>
                      <td className="p-3 border-r truncate max-w-[150px]">{getRoute(item)}</td>
                      <td className="p-3 border-r">
                         <div onClick={() => { setSelectedTrip(item); setVehicleData({vehicleNumber: item.vehicleNumber, driverMobile: item.driverMobile}); setShowVehiclePortal(true); }} className="flex flex-col cursor-pointer hover:bg-slate-50 p-1">
                           <span className="font-black text-[#0056d2]">{item.vehicleNumber}</span>
                           <span className="text-[9px] text-slate-400">{item.driverMobile || 'NO MOBILE'}</span>
                         </div>
                      </td>
                      <td className="p-3 border-r max-w-[250px] truncate">
                         <div className="flex flex-col">
                           <span className="font-black">{getInvoiceDisplay(item.items)}</span>
                           <span className="text-[9px] text-slate-400">{getEwaybillDisplay(item.items)}</span>
                         </div>
                      </td>
                      <td className="p-3 border-r">
                        <div className="flex items-center gap-2">
                          {item.cnNumber ? (
                            <div className="flex items-center gap-2">
                               <span onClick={() => { setSelectedTrip(item); setShowCNPreview(true); }} className="text-[#1e3a8a] font-black cursor-pointer hover:underline">{item.cnNumber}</span>
                               <button onClick={() => { 
                                 setSelectedTrip(item); 
                                 setCnData({cnNo: item.cnNumber, cnDate: item.cnDate, paymentTerms: item.paymentTerms || 'PAID', mode: item.mode || 'Road', ratePoint: item.ratePoint || ''}); 
                                 setCnItems(item.items || []); 
                                 setPrevCN(findPreviousCN(item.plantCode));
                                 setShowCNPortal(true); 
                               }} className="p-1 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5 text-slate-300" /></button>
                            </div>
                          ) : (
                            <button onClick={() => { 
                              setSelectedTrip(item); 
                              setCnData({cnDate: format(new Date(), 'yyyy-MM-dd'), paymentTerms: 'PAID', mode: 'Road'}); 
                              setCnItems([{invoiceNo: '', ewaybillNo: '', goodsDescription: '', package: '0', packageUom: 'Bag'}]); 
                              setPrevCN(findPreviousCN(item.plantCode));
                              setShowCNPortal(true); 
                            }} className="p-1.5 bg-blue-50 hover:bg-blue-100 transition-colors"><Plus className="h-4 w-4 text-[#0056d2]" /></button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-r text-center font-black">{formatWeight(item.assignWeight)}</td>
                      <td className="p-3">
                         <div className="flex gap-2">
                           {activeTab === 'Loading' && (
                             <Button 
                               disabled={!item.cnNumber}
                               onClick={() => { setSelectedTrip(item); setOutData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowOutPortal(true); }} 
                               size="sm" 
                               className="h-7 text-[8px] font-black uppercase bg-[#1e3a8a] rounded-none disabled:opacity-30"
                             >Out</Button>
                           )}
                           <Button onClick={() => handleTrackClick(item)} size="sm" variant="outline" className="h-7 text-[8px] font-black uppercase rounded-none border-[#0056d2] text-[#0056d2] hover:bg-[#0056d2] hover:text-white">Track</Button>
                           <Button onClick={() => { if(confirm('SATELLITE WARNING: Unassign this trip registry and return to open orders?')) deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', item.id)); }} size="sm" variant="ghost" className="h-7 text-[8px] font-black text-red-600 rounded-none hover:bg-red-50">Unassign</Button>
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
      
      {/* 1. Track Portal */}
      <Dialog open={showTrackPortal} onOpenChange={setShowTrackPortal}>
        <DialogContent className="max-w-xl rounded-none border-[4px] border-[#0056d2] font-mono p-0 shadow-2xl">
           <DialogHeader className="bg-[#f8fafc] p-6 border-b border-slate-200">
              <DialogTitle className="text-sm font-black uppercase italic tracking-tighter text-[#0056d2]">Shipment Tracking Gateway</DialogTitle>
              <div className="flex gap-4 mt-2 text-[10px] font-black text-slate-500 uppercase">
                <span>Trip ID: {selectedTrip?.tripId}</span>
                <span className="text-slate-200">|</span>
                <span>Vehicle: {selectedTrip?.vehicleNumber}</span>
              </div>
           </DialogHeader>
           <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Track Mode</label>
                   <select value={trackMode} onChange={e => setTrackMode(e.target.value)} className="h-9 w-full border border-slate-400 bg-white px-3 text-[12px] font-black focus:bg-yellow-50 outline-none">
                     <option value="GPS">GPS Satellite</option>
                     <option value="SIM">SIM Triangulation</option>
                   </select>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-slate-400">Vehicle Number</label>
                     <input value={selectedTrip?.vehicleNumber || ''} readOnly className="h-9 w-full border border-slate-200 bg-slate-50 px-3 text-[12px] font-black text-slate-500" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-slate-400">Driver Mobile</label>
                     <input value={selectedTrip?.driverMobile || ''} readOnly className="h-9 w-full border border-slate-200 bg-slate-50 px-3 text-[12px] font-black text-slate-500" />
                   </div>
                 </div>
              </div>

              <div className="flex items-center justify-between pt-10 border-t border-slate-100">
                 <div className="flex-1 pr-8">
                    <p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">Live Node Location:</p>
                    <p className="text-[11px] font-black text-blue-800 uppercase italic leading-tight truncate max-w-[300px]">
                       <MapPin className="h-2.5 w-2.5 inline mr-1 text-red-500" /> {liveLocation}
                    </p>
                 </div>
                 <div className="flex gap-2">
                    <Button onClick={() => setShowTrackPortal(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase tracking-widest">Exit</Button>
                    <Button onClick={() => setShowTrackPortal(false)} className="h-9 px-8 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase tracking-widest shadow-lg">Post</Button>
                 </div>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* 2. Vehicle Node Edit Popup */}
      <Dialog open={showVehiclePortal} onOpenChange={setShowVehiclePortal}>
        <DialogContent className="max-w-xl rounded-none border-[4px] border-[#1e3a8a] font-mono p-0">
           <DialogHeader className="bg-slate-50 p-4 border-b border-slate-200">
              <DialogTitle className="text-sm font-black uppercase italic tracking-tighter">Vehicle Node Update</DialogTitle>
              <div className="flex gap-4 mt-2 text-[10px] font-black text-slate-500 uppercase">
                <span>Ship to: {selectedTrip?.shipToParty}</span>
                <span className="text-slate-300">|</span>
                <span>Route: {getRoute(selectedTrip)}</span>
              </div>
           </DialogHeader>
           <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Vehicle Number</label>
                   <input value={vehicleData.vehicleNumber} onChange={e => setVehicleData({...vehicleData, vehicleNumber: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-[12px] font-black focus:bg-yellow-50" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Mobile Number</label>
                   <input value={vehicleData.driverMobile} onChange={e => setVehicleData({...vehicleData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[12px] font-black focus:bg-yellow-50" />
                 </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                 <Button onClick={() => setShowVehiclePortal(false)} variant="outline" className="h-10 px-8 rounded-none text-[10px] font-black uppercase">Cancel</Button>
                 <Button onClick={handleUpdateVehicle} className="h-10 px-10 bg-[#1e3a8a] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Update Registry (F8)</Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* 3. CN Entry Portal */}
      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-[1100px] rounded-none border-[4px] border-[#0056d2] font-mono p-0 max-h-[90vh] overflow-y-auto">
           <DialogHeader className="bg-[#f8fafc] p-6 border-b border-slate-200 sticky top-0 z-30">
              <DialogTitle className="text-lg font-black uppercase italic tracking-tighter text-[#0056d2]">Consignment Note Registry</DialogTitle>
              <div className="grid grid-cols-4 gap-8 mt-4">
                 <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Plant</span><span className="text-xs font-black">{selectedTrip?.plantCode}</span></div>
                 <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Ship to Party</span><span className="text-xs font-black truncate">{selectedTrip?.shipToParty}</span></div>
                 <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Route</span><span className="text-xs font-black truncate">{getRoute(selectedTrip)}</span></div>
                 <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Vehicle</span><span className="text-xs font-black">{selectedTrip?.vehicleNumber}</span></div>
              </div>
           </DialogHeader>
           
           <div className="p-8 space-y-10">
              <div className="grid grid-cols-3 gap-x-12 gap-y-6">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Previous CN</label>
                   <input value={prevCN} readOnly className="h-8 w-full border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-400" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-600">CN Number *</label>
                   <input value={cnData.cnNo || ''} onChange={e => setCnData({...cnData, cnNo: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black outline-none focus:bg-yellow-50" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-600">CN Date *</label>
                   <input type="date" value={cnData.cnDate || ''} onChange={e => setCnData({...cnData, cnDate: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-600">Payment Terms</label>
                   <select value={cnData.paymentTerms} onChange={e => setCnData({...cnData, paymentTerms: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-[11px] font-black">
                     <option value="PAID">PAID</option>
                     <option value="TO PAY">TO PAY</option>
                   </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-600">Mode</label>
                   <select value={cnData.mode} onChange={e => setCnData({...cnData, mode: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-[11px] font-black">
                     <option value="Road">Road</option>
                     <option value="Road from Rail">Road from Rail</option>
                   </select>
                 </div>
                 {cnData.mode === 'Road from Rail' && (
                   <div className="space-y-1 animate-fade-in">
                     <label className="text-[10px] font-black uppercase text-slate-600">Rake Point</label>
                     <input value={cnData.ratePoint || ''} onChange={e => setCnData({...cnData, ratePoint: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black focus:bg-yellow-50" placeholder="E.G. TKD DEPOT" />
                   </div>
                 )}
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                   <h4 className="text-[10px] font-black uppercase text-slate-500 italic">Material Node Registry</h4>
                   <Button onClick={() => setCnItems([...cnItems, {invoiceNo: '', ewaybillNo: '', goodsDescription: '', package: '0', packageUom: 'Bag'}])} variant="outline" className="h-7 px-4 rounded-none text-[8px] font-black uppercase"><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
                 </div>
                 <table className="w-full text-left border border-slate-300">
                   <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-500">
                     <tr>
                       <th className="p-2 border-r border-b">Invoice No.</th>
                       <th className="p-2 border-r border-b">E-waybill No.</th>
                       <th className="p-2 border-r border-b">Goods Description</th>
                       <th className="p-2 border-r border-b w-32">Package</th>
                       <th className="p-2 border-r border-b w-32">UOM</th>
                       <th className="p-2 border-b w-10"></th>
                     </tr>
                   </thead>
                   <tbody className="text-[11px] font-bold">
                     {cnItems.map((item, idx) => (
                       <tr key={idx}>
                         <td className="border-r border-b"><input value={item.invoiceNo} onChange={e => { const ni = [...cnItems]; ni[idx].invoiceNo = e.target.value.toUpperCase(); setCnItems(ni); }} className="w-full h-8 px-2 outline-none" /></td>
                         <td className="border-r border-b"><input value={item.ewaybillNo} onChange={e => { const ni = [...cnItems]; ni[idx].ewaybillNo = e.target.value.toUpperCase(); setCnItems(ni); }} className="w-full h-8 px-2 outline-none" /></td>
                         <td className="border-r border-b"><input value={item.goodsDescription} onChange={e => { const ni = [...cnItems]; ni[idx].goodsDescription = e.target.value.toUpperCase(); setCnItems(ni); }} className="w-full h-8 px-2 outline-none" /></td>
                         <td className="border-r border-b"><input type="number" value={item.package} onChange={e => { const ni = [...cnItems]; ni[idx].package = e.target.value; setCnItems(ni); }} className="w-full h-8 px-2 outline-none" /></td>
                         <td className="border-r border-b">
                           <select value={item.packageUom} onChange={e => { const ni = [...cnItems]; ni[idx].packageUom = e.target.value; setCnItems(ni); }} className="w-full h-8 px-2 bg-white outline-none">
                             <option value="Bag">Bag</option>
                             <option value="Box">Box</option>
                             <option value="pieces">pieces</option>
                             <option value="Drum">Drum</option>
                           </select>
                         </td>
                         <td className="border-b text-center"><button onClick={() => setCnItems(cnItems.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash className="h-3.5 w-3.5" /></button></td>
                       </tr>
                     ))}
                   </tbody>
                   <tfoot className="bg-[#f8fafc] text-[10px] font-black uppercase">
                     <tr>
                       <td colSpan={3} className="p-3 text-right border-r">Combined Total Packages:</td>
                       <td className="p-3 text-[#0056d2]">{calculatePackageTotal(cnItems)}</td>
                       <td colSpan={2}></td>
                     </tr>
                   </tfoot>
                 </table>
              </div>

              <div className="flex justify-end gap-4">
                 <Button onClick={() => setShowCNPortal(false)} variant="outline" className="h-10 px-12 rounded-none text-[10px] font-black uppercase">Cancel</Button>
                 <Button onClick={handlePostCN} className="h-10 px-16 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-xl">Post Registry (F8)</Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* 4. Gate Out Portal */}
      <Dialog open={showOutPortal} onOpenChange={setShowOutPortal}>
        <DialogContent className="max-lg rounded-none border-[4px] border-[#1e3a8a] font-mono p-0">
           <DialogHeader className="bg-slate-50 p-4 border-b border-slate-200">
              <DialogTitle className="text-sm font-black uppercase italic text-[#1e3a8a]">Operational Node: Gate Out</DialogTitle>
              <div className="flex gap-4 mt-2 text-[10px] font-black text-slate-500 uppercase">
                <span>Vehicle: {selectedTrip?.vehicleNumber}</span>
                <span>Route: {getRoute(selectedTrip)}</span>
              </div>
           </DialogHeader>
           <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Out Date</label>
                   <input type="date" value={outData.date} onChange={e => setOutData({...outData, date: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[12px] font-black" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-400">Out Time</label>
                   <input type="time" value={outData.time} onChange={e => setOutData({...outData, time: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[12px] font-black" />
                 </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                 <Button onClick={() => setShowOutPortal(false)} variant="outline" className="h-10 px-8 rounded-none text-[10px] font-black uppercase tracking-widest">Exit</Button>
                 <Button onClick={handlePostGateOut} className="h-10 px-12 bg-[#1e3a8a] text-white rounded-none text-[10px] font-black uppercase shadow-lg tracking-widest">Post</Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* 5. CN 3-Copy Preview Portal */}
      <Dialog open={showCNPreview} onOpenChange={setShowCNPreview}>
        <DialogContent className="max-w-[1000px] p-0 rounded-none border-none bg-slate-900/50 backdrop-blur-sm h-[95vh] overflow-y-auto font-mono no-scrollbar">
          <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-50 shadow-md">
            <h3 className="text-xs font-black uppercase italic text-slate-500">Document Node Preview: {selectedTrip?.cnNumber}</h3>
            <div className="flex gap-2">
               <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white rounded-none h-8 text-[10px] font-black uppercase"><Printer className="h-3.5 w-3.5 mr-2" /> Print Official Copies</Button>
               <Button onClick={() => setShowCNPreview(false)} variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          
          <div id="printable-area" className="flex flex-col gap-8 p-12 bg-slate-200/30 items-center">
            {['CONSIGNEE COPY', 'CONSIGNOR COPY', 'DRIVER COPY'].map((copy, idx) => (
              <div key={copy} className="cn-print-page bg-white shadow-2xl p-[15mm] relative border border-slate-300">
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                   <div className="space-y-1">
                      <h2 className="text-2xl font-black italic tracking-tighter text-blue-900 leading-none">SIKKA INDUSTRIES & LOGISTICS</h2>
                      <p className="text-[9px] font-bold text-slate-500 max-w-[300px]">Regd Off: Ghaziabad – 201009, Uttar Pradesh, India • queries@sikkaenterprises.com</p>
                   </div>
                   <div className="text-right flex flex-col items-end gap-2">
                      <Badge className="bg-black text-white rounded-none h-6 px-4 text-[10px] font-black mb-1">{copy}</Badge>
                      <div className="text-[10px] font-black flex flex-col gap-0.5">
                         <span>CN NO: <span className="text-blue-700">{selectedTrip?.cnNumber}</span></span>
                         <span>DATE: {selectedTrip?.cnDate ? format(new Date(selectedTrip.cnDate), 'dd/MM/yyyy') : '-'}</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8 text-[10px] leading-snug">
                   <div className="space-y-3 p-4 border border-slate-200">
                      <h4 className="text-[9px] font-black text-slate-400 uppercase border-b pb-1">Consignor Details</h4>
                      <p className="font-black text-slate-800">{selectedTrip?.consignor}</p>
                      <p className="text-slate-500 italic">Origin Node: {selectedTrip?.plantCode}</p>
                   </div>
                   <div className="space-y-3 p-4 border border-slate-200">
                      <h4 className="text-[9px] font-black text-slate-400 uppercase border-b pb-1">Consignee Details</h4>
                      <p className="font-black text-slate-800">{selectedTrip?.consignee}</p>
                      <p className="text-slate-500 italic">Destination: {selectedTrip?.destination}</p>
                   </div>
                </div>

                <div className="border border-black overflow-hidden mb-6">
                   <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-slate-50 border-b border-black font-black uppercase text-[9px]">
                         <tr>
                           <th className="p-3 border-r border-black">Invoice</th>
                           <th className="p-3 border-r border-black">Material Description</th>
                           <th className="p-3 border-r border-black text-center">Pkg</th>
                           <th className="p-3 text-center">UOM</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-black font-bold">
                         {(selectedTrip?.items || []).map((item: any, i: number) => (
                           <tr key={i}>
                             <td className="p-3 border-r border-black uppercase">{item.invoiceNo || '-'}</td>
                             <td className="p-3 border-r border-black uppercase italic">{item.goodsDescription}</td>
                             <td className="p-3 border-r border-black text-center">{item.package}</td>
                             <td className="p-3 text-center uppercase">{item.packageUom}</td>
                           </tr>
                         ))}
                         {Array.from({length: Math.max(0, 5 - (selectedTrip?.items?.length || 0))}).map((_, i) => (
                           <tr key={`empty-${i}`}><td className="p-3 border-r border-black h-8"></td><td className="p-3 border-r border-black h-8"></td><td className="p-3 border-r border-black h-8"></td><td className="p-3 h-8"></td></tr>
                         ))}
                      </tbody>
                      <tfoot className="border-t border-black bg-slate-50 font-black uppercase text-[10px]">
                         <tr>
                           <td colSpan={2} className="p-3 text-right border-r border-black italic">Total Declared Quantity:</td>
                           <td colSpan={2} className="p-3 text-center text-blue-900">{calculatePackageTotal(selectedTrip?.items)}</td>
                         </tr>
                      </tfoot>
                   </table>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-12 mb-20 text-[10px] font-black uppercase text-slate-400">
                   <div className="space-y-8 pt-8 border-t border-dashed border-slate-300"><span>Consignor Signature</span></div>
                   <div className="space-y-8 pt-8 border-t border-dashed border-slate-300 text-right"><span>Authorized Signatory</span></div>
                </div>

                <div className="absolute bottom-6 left-[15mm] right-[15mm] border-t-2 border-blue-900 pt-3 flex justify-between items-center text-[8px] font-black text-blue-900 uppercase italic tracking-widest">
                   <span>Sikka Operational Gateway Sync: {format(new Date(), 'dd-MM-yyyy HH:mm')}</span>
                   <span>CN NODE: {selectedTrip?.id?.substring(0, 8)}</span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
