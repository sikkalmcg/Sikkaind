'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Save, ChevronLeft, ChevronRight, Filter, Search, MapPin, Truck, Radar, 
  CheckCircle, Loader2, X, Upload, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 25;

export default function TR21Page() {
  const db = useFirestore();
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Open Orders');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);
  
  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  const [gpsLive, setGpsLive] = React.useState<any[]>([]);
  const [locationMap, setLocationMap] = React.useState<Record<string, string>>({});
  const [isGpsLoading, setIsGpsLoading] = React.useState(true);

  const [showAssign, setShowAssign] = React.useState(false);
  const [showOutPortal, setShowOutPortal] = React.useState(false);
  const [showArrivePortal, setShowArrivePortal] = React.useState(false);
  const [assignData, setAssignData] = React.useState<any>({});
  const [actionData, setActionData] = React.useState({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });

  React.useEffect(() => { setMounted(true); }, []);

  const reverseGeocode = React.useCallback((vehicleNo: string, lat: number, lng: number) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const components = results[0].address_components;
        const street = components.find(c => c.types.includes('route'))?.long_name || 
                       components.find(c => c.types.includes('sublocality_level_1'))?.long_name;
        const city = components.find(c => c.types.includes('locality'))?.long_name || 
                     components.find(c => c.types.includes('administrative_area_level_2'))?.long_name;
        
        let formatted = '';
        if (street && city) formatted = `${street}, ${city}`;
        else if (city) formatted = city;
        else formatted = results[0].formatted_address.split(',')[0];

        setLocationMap(prev => ({ ...prev, [vehicleNo.trim()]: formatted }));
      } else {
        setLocationMap(prev => ({ ...prev, [vehicleNo.trim()]: 'Location unavailable' }));
      }
    });
  }, []);

  const fetchGps = React.useCallback(async () => {
    try {
      const res = await fetch('/api/gps');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.list) {
          setGpsLive(json.data.list);
        }
      }
    } catch (e) {
      console.error("GPS Sync Failure:", e);
    } finally { setIsGpsLoading(false); }
  }, []);

  React.useEffect(() => {
    fetchGps();
    const interval = setInterval(fetchGps, 900000);
    return () => clearInterval(interval);
  }, [fetchGps]);

  React.useEffect(() => {
    gpsLive.forEach(node => {
      const vNo = node.vehicleNumber?.trim();
      if (vNo && node.latitude && node.longitude) {
        reverseGeocode(vNo, parseFloat(node.latitude), parseFloat(node.longitude));
      }
    });
  }, [gpsLive, reverseGeocode]);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: plants } = useCollection(plantsQuery);

  const filteredData = React.useMemo(() => {
    if (!orders || !trips || !mounted) return [];
    
    let baseData: any[] = [];
    const seenNos = new Set();

    if (activeTab === 'Open Orders') {
      baseData = orders.filter(o => o.status === 'Open').filter(o => {
        const isValid = o.plantCode && o.orderNo && o.orderDate && o.consignorCode && o.consigneeCode && o.shipToPartyCode && o.quantity;
        if (!isValid) return false;
        
        if (seenNos.has(o.orderNo)) return false;
        seenNos.add(o.orderNo);
        return true;
      }).map(o => {
        const dispatched = trips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const weight = parseFloat(o.quantity) || 0;
        return { ...o, dispatched, balance: weight - dispatched };
      }).filter(o => o.balance > 0.001);
    } else {
      const statusMap: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
      baseData = trips.filter(t => t.status === statusMap[activeTab]).filter(t => {
        if (seenNos.has(t.tripNo)) return false;
        seenNos.add(t.tripNo);
        return true;
      });
    }

    if (plantFilter !== 'ALL') baseData = baseData.filter(d => d.plantCode === plantFilter);
    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      baseData = baseData.filter(d => (d.orderNo || '').includes(query) || (d.tripNo || '').includes(query) || (d.vehicleNo || '').includes(query));
    }

    return baseData;
  }, [orders, trips, activeTab, mounted, plantFilter, searchQuery]);

  const handlePostAssignment = () => {
    if (!assignData.vehicleNo || !assignData.assignWeight) return alert('Mandatory fields missing');
    if (parseFloat(assignData.assignWeight) > selectedOrder.balance) return alert('Weight exceeds balance');

    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    const now = new Date().toISOString();
    const payload = {
      id: crypto.randomUUID(),
      tripNo: tripId,
      orderNo: selectedOrder.orderNo,
      plantCode: selectedOrder.plantCode,
      consigneeName: selectedOrder.consigneeName,
      consigneeCode: selectedOrder.consigneeCode,
      shipToParty: selectedOrder.shipToParty,
      shipToPartyCode: selectedOrder.shipToPartyCode,
      destination: selectedOrder.destination,
      vehicleNo: assignData.vehicleNo.toUpperCase(),
      driverMobile: assignData.driverMobile || '',
      assignWeight: assignData.assignWeight,
      status: 'LOADING',
      createdAt: now,
      updatedAt: now,
      consignorName: selectedOrder.consignorName,
      consignorCode: selectedOrder.consignorCode,
      from: selectedOrder.from,
      materialName: selectedOrder.materialName,
      paymentTerms: assignData.paymentTerms || 'TO PAY'
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', payload.id), payload, { merge: true });
    setShowAssign(false);
    setAssignData({});
  };

  const ActionPortal = ({ open, onOpenChange, title, onPost, trip }: { open: boolean, onOpenChange: (v: boolean) => void, title: string, onPost: () => void, trip: any }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-none border-[3px] border-[#0056d2] font-mono p-0 overflow-hidden text-slate-900 text-left">
        <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
           <DialogTitle className="text-sm font-black uppercase italic text-[#0056d2] mb-4">{title}</DialogTitle>
           <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase bg-white border border-slate-200 p-4 shadow-inner">
              <div className="space-y-1"><span className="text-slate-400 text-[8px]">SHIP TO PARTY</span><p className="truncate">{trip?.shipToParty}</p></div>
              <div className="space-y-1"><span className="text-slate-400 text-[8px]">VEHICLE NUMBER</span><p className="text-blue-700">{trip?.vehicleNo}</p></div>
              <div className="space-y-1"><span className="text-slate-400 text-[8px]">ROUTE</span><p className="truncate italic text-emerald-700">{trip?.from} → {trip?.destination}</p></div>
              <div className="space-y-1"><span className="text-slate-400 text-[8px]">TRIP ID</span><p>{trip?.tripNo || '-'}</p></div>
           </div>
        </DialogHeader>
        <div className="p-8 space-y-6 text-left">
           <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Date</label><input type="date" value={actionData.date} onChange={e => setActionData({...actionData, date: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[11px] font-bold" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Time</label><input type="time" value={actionData.time} onChange={e => setActionData({...actionData, time: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[11px] font-bold" /></div>
           </div>
        </div>
        <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
           <Button onClick={() => onOpenChange(false)} variant="outline" className="h-10 rounded-none text-[10px] font-black uppercase px-8 border-slate-300">Exit</Button>
           <Button onClick={onPost} className="h-10 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase px-16 shadow-lg">Post</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!mounted) return null;

  const formatDate = (val: any) => val ? format(new Date(val), 'dd-MMM HH:mm') : '-';

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden text-[#333]">
      <div className="bg-white border-b border-slate-300 px-8 py-3 shadow-sm flex justify-between items-center z-30 shrink-0">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD</h2>
        <div className="flex gap-4 items-center">
           <div className="flex items-center gap-6 bg-[#f8fafc] border border-slate-200 p-1 px-4 shadow-inner">
             <div className="flex items-center gap-2">
               <Filter className="h-3.5 w-3.5 text-slate-400" />
               <select value={plantFilter} onChange={e => setPlantFilter(e.target.value)} className="h-7 bg-transparent text-[10px] font-black uppercase outline-none">
                 <option value="ALL">All Plants</option>
                 {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
               </select>
             </div>
             <div className="w-[1px] h-4 bg-slate-300" />
             <div className="flex items-center gap-2">
               <Search className="h-3.5 w-3.5 text-slate-400" />
               <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-7 w-48 bg-transparent text-[10px] font-black uppercase outline-none" placeholder="SEARCH..." />
             </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-8 transition-opacity duration-300">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'].map(l => (
            <button key={l} onClick={() => { setActiveTab(l); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0", activeTab === l ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col bg-white border border-slate-300 shadow-inner">
          <div className="min-w-[1550px] flex flex-col flex-1 overflow-y-auto green-scrollbar">
            <div className="flex bg-[#f8fafc] border-b border-slate-300 text-[9px] font-black uppercase text-slate-500 sticky top-0 z-20">
               {activeTab === 'Open Orders' ? (
                 <>
                   <div className="p-3 w-[4%] border-r text-center text-black">Plant</div>
                   <div className="p-3 w-[20%] border-r text-black text-center">Sale Order Details</div>
                   <div className="p-3 w-[12%] border-r text-black">Consignor</div>
                   <div className="p-3 w-[12%] border-r text-black">Consignee</div>
                   <div className="p-3 w-[12%] border-r text-black">Ship to Party</div>
                   <div className="p-3 w-[12%] border-r text-black">Route</div>
                   <div className="p-3 w-[5%] border-r text-right text-black">Qty</div>
                   <div className="p-3 w-[5%] border-r text-right text-emerald-600">Balance</div>
                   <div className="p-3 w-[100px] text-center text-black">Action</div>
                 </>
               ) : activeTab === 'Reject' ? (
                <>
                   <div className="p-3 w-[3%] border-r text-center text-black">Plant</div>
                   <div className="p-3 w-[15%] border-r text-black text-center">Sale Order</div>
                   <div className="p-3 w-[7%] border-r text-blue-700">Trip ID</div>
                   <div className="p-3 w-[9%] border-r text-black">Vehicle</div>
                   <div className="p-3 w-[11%] border-r text-black">Out Date time</div>
                   <div className="p-3 w-[11%] border-r text-black">Arrived Date time</div>
                   <div className="p-3 w-[11%] border-r text-red-600">Reject Date time</div>
                   <div className="p-3 w-[15%] border-r text-black">Consignee</div>
                   <div className="p-3 w-[100px] text-center text-black">Action</div>
                </>
               ) : (activeTab === 'POD Verify' || activeTab === 'Closed') ? (
                <>
                   <div className="p-3 w-[3%] border-r text-center text-black">Plant</div>
                   <div className="p-3 w-[15%] border-r text-black text-center">Sale Order</div>
                   <div className="p-3 w-[7%] border-r text-blue-700">Trip ID</div>
                   <div className="p-3 w-[9%] border-r text-black">Vehicle</div>
                   <div className="p-3 w-[11%] border-r text-black">Out Date time</div>
                   <div className="p-3 w-[11%] border-r text-black">Arrived Date time</div>
                   <div className="p-3 w-[11%] border-r text-emerald-600">Unload Date time</div>
                   <div className="p-3 w-[15%] border-r text-black">Consignee</div>
                   <div className="p-3 w-[100px] text-center text-black">Action</div>
                </>
               ) : (
                 <>
                   <div className="p-3 w-[3%] border-r text-center text-black">Plant</div>
                   <div className="p-3 w-[18%] border-r text-black text-center">Sale Order</div>
                   <div className="p-3 w-[7%] border-r text-blue-700">Trip ID</div>
                   <div className="p-3 w-[14%] border-r text-black">Consignee</div>
                   <div className="p-3 w-[14%] border-r text-black">Ship To Party</div>
                   <div className="p-3 w-[10%] border-r">Route</div>
                   <div className="p-3 w-[12%] border-r text-black">Vehicle</div>
                   <div className="p-3 w-[4%] border-r text-center">Qty</div>
                   <div className="p-3 w-[100px] text-center text-black">Action</div>
                 </>
               )}
            </div>

            {filteredData.map((item: any) => {
              const liveNode = gpsLive.find(n => n.vehicleNumber?.trim() === item.vehicleNo?.trim());
              return (
                <div key={item.id} className="flex flex-col border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
                  <div className="flex items-center text-[12px] font-black uppercase min-h-[70px] text-black">
                    {activeTab === 'Open Orders' ? (
                      <>
                        <div className="p-3 w-[4%] border-r text-center">{item.plantCode}</div>
                        <div className="p-3 w-[20%] border-r flex items-center justify-center gap-4">
                           <span className="text-blue-700 whitespace-nowrap">Order: {item.orderNo}</span>
                           <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Order Date: {item.orderDate ? format(new Date(item.orderDate), 'dd-MMM-yyyy') : '-'}</span>
                        </div>
                        <div className="p-3 w-[12%] border-r truncate" title={item.consignorName}>{item.consignorName}</div>
                        <div className="p-3 w-[12%] border-r truncate" title={item.consigneeName}>{item.consigneeName}</div>
                        <div className="p-3 w-[12%] border-r truncate" title={item.shipToParty}>{item.shipToParty}</div>
                        <div className="p-3 w-[12%] border-r italic text-slate-500 text-[10px] leading-tight">{item.from} → {item.destination}</div>
                        <div className="p-3 w-[5%] border-r text-right">{item.quantity}</div>
                        <div className="p-3 w-[5%] border-r text-right text-emerald-600 font-black">{item.balance?.toFixed(3)}</div>
                        <div className="p-3 w-[100px] flex justify-center">
                           <Button onClick={() => { setSelectedOrder(item); setAssignData({assignWeight: item.balance.toFixed(3), paymentTerms: 'TO PAY'}); setShowAssign(true); }} className="h-7 text-[9px] font-black uppercase bg-[#1e3a8a] text-white rounded-none px-6">Assign</Button>
                        </div>
                      </>
                    ) : activeTab === 'Reject' ? (
                        <>
                            <div className="p-3 w-[3%] border-r text-center">{item.plantCode}</div>
                            <div className="p-3 w-[15%] border-r text-center text-slate-500">Order: {item.orderNo}</div>
                            <div className="p-3 w-[7%] border-r text-blue-700 font-black">{item.tripNo}</div>
                            <div className="p-3 w-[9%] border-r">{item.vehicleNo}</div>
                            <div className="p-3 w-[11%] border-r text-slate-400 font-bold">{formatDate(item.dispatchDate)}</div>
                            <div className="p-3 w-[11%] border-r text-slate-400 font-bold">{formatDate(item.arrivalDate)}</div>
                            <div className="p-3 w-[11%] border-r text-red-600 font-black">{formatDate(item.rejectDate)}</div>
                            <div className="p-3 w-[15%] border-r truncate" title={item.consigneeName}>{item.consigneeName}</div>
                            <div className="p-3 w-[100px] flex justify-center">
                                <Badge variant="outline" className="text-[8px] rounded-none border-red-200 text-red-500">REJECTED</Badge>
                            </div>
                        </>
                    ) : (activeTab === 'POD Verify' || activeTab === 'Closed') ? (
                        <>
                            <div className="p-3 w-[3%] border-r text-center">{item.plantCode}</div>
                            <div className="p-3 w-[15%] border-r text-center text-slate-500">Order: {item.orderNo}</div>
                            <div className="p-3 w-[7%] border-r text-blue-700 font-black">{item.tripNo}</div>
                            <div className="p-3 w-[9%] border-r">{item.vehicleNo}</div>
                            <div className="p-3 w-[11%] border-r text-slate-400 font-bold">{formatDate(item.dispatchDate)}</div>
                            <div className="p-3 w-[11%] border-r text-slate-400 font-bold">{formatDate(item.arrivalDate)}</div>
                            <div className="p-3 w-[11%] border-r text-emerald-600 font-black">{formatDate(item.unloadDate)}</div>
                            <div className="p-3 w-[15%] border-r truncate" title={item.consigneeName}>{item.consigneeName}</div>
                            <div className="p-3 w-[100px] flex justify-center">
                                <Badge variant="outline" className="text-[8px] rounded-none border-blue-200 text-blue-500">{activeTab}</Badge>
                            </div>
                        </>
                    ) : (
                      <>
                        <div className="p-3 w-[3%] border-r text-center">{item.plantCode}</div>
                        <div className="p-3 w-[18%] border-r flex items-center justify-center gap-3">
                           <span className="text-slate-800">Order: {item.orderNo}</span>
                           <span className="text-[10px] text-slate-400 font-bold">Dt: {item.orderDate ? format(new Date(item.orderDate), 'dd-MMM-yyyy') : '-'}</span>
                        </div>
                        <div className="p-3 w-[7%] border-r text-blue-700 font-black">{item.tripNo}</div>
                        <div className="p-3 w-[14%] border-r truncate" title={item.consigneeName}>{item.consigneeName}</div>
                        <div className="p-3 w-[14%] border-r truncate" title={item.shipToParty}>{item.shipToParty}</div>
                        <div className="p-3 w-[10%] border-r italic text-slate-500 text-[10px]">{item.from} → {item.destination}</div>
                        <div className="p-3 w-[12%] border-r flex flex-col">
                           <span className="font-black text-blue-800">{item.vehicleNo}</span>
                           <span className="text-[10px] text-slate-500 font-bold">{item.driverMobile || '-'}</span>
                        </div>
                        <div className="p-3 w-[4%] border-r text-center text-blue-600 font-black">{item.assignWeight}</div>
                        <div className="p-3 w-[100px] flex justify-center gap-2">
                           {activeTab === 'Loading' && (
                             <Button onClick={() => { setSelectedTrip(item); setActionData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowOutPortal(true); }} className="h-7 text-[9px] font-black bg-[#1e3a8a] text-white rounded-none px-4">OUT</Button>
                           )}
                           {activeTab === 'In-Transit' && (
                             <Button onClick={() => { setSelectedTrip(item); setActionData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowArrivePortal(true); }} className="h-7 text-[10px] font-black bg-emerald-600 text-white rounded-none px-6">ARRIVE</Button>
                           )}
                        </div>
                      </>
                    )}
                  </div>

                  {activeTab !== 'Open Orders' && (
                    <div className="flex bg-slate-50/70 border-t border-slate-200 h-9 items-center px-4">
                       <div className="flex-1 flex items-center gap-6 overflow-hidden">
                          <div className="flex items-center gap-2 group cursor-pointer overflow-hidden" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${liveNode?.latitude},${liveNode?.longitude}`, '_blank')}>
                             <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                             <span className="text-[11px] font-black text-black uppercase truncate group-hover:underline italic tracking-tight">
                                {locationMap[item.vehicleNo?.trim()] || 'SYNCHRONIZING LOCATION...'}
                             </span>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-[800px] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col text-slate-900 text-left">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 shrink-0">
             <DialogTitle className="text-sm font-black uppercase text-[#1e3a8a] italic">Vehicle Assignment Protocol</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-8 text-left">
             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number *</label><input value={assignData.vehicleNo || ''} onChange={e => setAssignData({...assignData, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Driver Mobile</label><input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-[#0056d2] uppercase">Assign Qty (MT) *</label><input type="number" step="0.001" value={assignData.assignWeight || ''} onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} className="h-9 w-full border border-[#0056d2] px-3 text-xs font-black outline-none text-blue-700" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Arrange By</label><input value={assignData.arrangeBy || ''} onChange={e => setAssignData({...assignData, arrangeBy: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-[11px]" /></div>
             </div>
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 shrink-0">
             <Button onClick={() => setShowAssign(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black border-slate-300 px-10">Exit</Button>
             <Button onClick={handlePostAssignment} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-20 shadow-lg">Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActionPortal open={showOutPortal} onOpenChange={setShowOutPortal} title="Dispatch Synchronization (OUT)" trip={selectedTrip} onPost={() => {
          const ts = `${actionData.date}T${actionData.time}:00`;
          updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { status: 'IN-TRANSIT', dispatchDate: ts, updatedAt: new Date().toISOString() });
          setShowOutPortal(false);
      }} />
      <ActionPortal open={showArrivePortal} onOpenChange={setShowArrivePortal} title="Arrival Synchronization" trip={selectedTrip} onPost={() => {
          const ts = `${actionData.date}T${actionData.time}:00`;
          updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { status: 'ARRIVED', arrivalDate: ts, updatedAt: new Date().toISOString() });
          setShowArrivePortal(false);
      }} />
    </div>
  );
}