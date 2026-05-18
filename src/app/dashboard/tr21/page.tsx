'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Save, ChevronLeft, ChevronRight, Filter, Search, MapPin, Truck, Radar, 
  CheckCircle, Loader2, X, Upload, Info, Map as MapIcon, RefreshCw,
  User, Phone, Calculator, CheckSquare, Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
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
  const [showMapPortal, setShowMapPortal] = React.useState(false);
  
  const [assignData, setAssignData] = React.useState<any>({
    fleetType: 'Own Vehicle',
    assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    fixRate: false
  });
  
  const [actionData, setActionData] = React.useState({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });

  // Persistent Settings for Icons
  const settingsRef = useMemoFirebase(() => doc(db, 'users', SHARED_HUB_ID, 'gps_tracking', 'settings'), [db]);
  const { data: settings } = useDoc(settingsRef);

  const mapRef = React.useRef<HTMLDivElement>(null);
  const googleMapInstance = React.useRef<any>(null);
  const markerInstance = React.useRef<any>(null);

  React.useEffect(() => { setMounted(true); }, []);

  const reverseGeocode = React.useCallback((vehicleNo: string, lat: number, lng: number) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]) {
        const components = results[0].address_components;
        const street = components.find((c: any) => c.types.includes('route'))?.long_name || 
                       components.find((c: any) => c.types.includes('sublocality_level_1'))?.long_name;
        const city = components.find((c: any) => c.types.includes('locality'))?.long_name || 
                     components.find((c: any) => c.types.includes('administrative_area_level_2'))?.long_name;
        
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
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: plants } = useCollection(plantsQuery);
  const { data: vendors } = useCollection(vendorsQuery);

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
    if (parseFloat(assignData.assignWeight) > selectedOrder.balance + 0.001) return alert('Weight exceeds balance');

    // System auto create a Trip ID – First alfabate “T” and after 9 digit a Unique Number.
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
      assignWeight: parseFloat(assignData.assignWeight),
      status: 'LOADING',
      assignDate: assignData.assignDate,
      fleetType: assignData.fleetType,
      createdAt: now,
      updatedAt: now,
      consignorName: selectedOrder.consignorName,
      consignorCode: selectedOrder.consignorCode,
      from: selectedOrder.from,
      materialName: selectedOrder.materialName,
      paymentTerms: assignData.paymentTerms || 'TO PAY',
      vendorName: assignData.vendorName || '',
      vendorMobile: assignData.vendorMobile || '',
      arrangeBy: assignData.arrangeBy || '',
      rate: parseFloat(assignData.rate) || 0,
      freightAmount: parseFloat(assignData.freightAmount) || 0,
      fixRate: assignData.fixRate || false
    };

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', payload.id), payload, { merge: true });
    setShowAssign(false);
    setAssignData({
      fleetType: 'Own Vehicle',
      assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      fixRate: false
    });
    alert(`Protocol Post: Trip ID ${tripId} registered.`);
  };

  const handleRateCalculation = (rate: string, qty: string) => {
    if (assignData.fixRate) return;
    const r = parseFloat(rate) || 0;
    const q = parseFloat(qty) || 0;
    setAssignData(prev => ({ ...prev, rate, freightAmount: (r * q).toFixed(2) }));
  };

  // Map Dialog Logic
  React.useEffect(() => {
    if (showMapPortal && selectedTrip && mapRef.current && window.google) {
      const liveNode = gpsLive.find(n => n.vehicleNumber?.trim() === selectedTrip.vehicleNo?.trim());
      const lat = liveNode ? parseFloat(liveNode.latitude) : 20.5937;
      const lng = liveNode ? parseFloat(liveNode.longitude) : 78.9629;

      googleMapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 14,
        disableDefaultUI: true,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });

      markerInstance.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: googleMapInstance.current,
        icon: {
          url: liveNode?.status === 'RUNNING' ? (settings?.activeIcon || 'https://maps.google.com/mapfiles/ms/icons/green-dot.png') : (settings?.stoppedIcon || 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'),
          scaledSize: new window.google.maps.Size(42, 42),
          anchor: new window.google.maps.Point(21, 21)
        }
      });
    }
  }, [showMapPortal, selectedTrip, gpsLive, settings]);

  const ActionPortal = ({ open, onOpenChange, title, onPost, trip }: { open: boolean, onOpenChange: (v: boolean) => void, title: string, onPost: () => void, trip: any }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-none border-[3px] border-[#0056d2] font-mono p-0 overflow-hidden text-slate-900 text-left">
        <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
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

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden text-black">
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

      <div className="flex-1 flex flex-col p-8">
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
                   <div className="p-3 w-[10%] border-r text-black text-center">Sale Order Details</div>
                   <div className="p-3 w-[12%] border-r text-black">Consignor</div>
                   <div className="p-3 w-[12%] border-r text-black">Consignee</div>
                   <div className="p-3 w-[12%] border-r text-black">Ship to Party</div>
                   <div className="p-3 w-[12%] border-r text-black">Route</div>
                   <div className="p-3 w-[5%] border-r text-right text-black">Qty</div>
                   <div className="p-3 w-[5%] border-r text-right text-emerald-600">Balance</div>
                   <div className="p-1 w-[50px] text-center text-black">Action</div>
                 </>
               ) : (
                 <>
                   <div className="p-3 w-[3%] border-r text-center text-black">Plant</div>
                   <div className="p-3 w-[9%] border-r text-black text-center">Sale Order</div>
                   <div className="p-3 w-[7%] border-r text-blue-700">Trip ID</div>
                   <div className="p-3 w-[14%] border-r text-black">Consignee</div>
                   <div className="p-3 w-[14%] border-r text-black">Ship To Party</div>
                   <div className="p-3 w-[10%] border-r">Route</div>
                   <div className="p-3 w-[12%] border-r text-black">Vehicle</div>
                   <div className="p-3 w-[4%] border-r text-center">Qty</div>
                   <div className="p-1 w-[50px] text-center text-black">Action</div>
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
                        <div className="p-3 w-[10%] border-r flex flex-col justify-center">
                           <span className="text-blue-700">{item.orderNo}</span>
                           <span className="text-[10px] text-slate-500 font-bold">{item.orderDate ? format(new Date(item.orderDate), 'dd-MMM-yyyy') : '-'}</span>
                        </div>
                        <div className="p-3 w-[12%] border-r truncate" title={item.consignorName}>{item.consignorName}</div>
                        <div className="p-3 w-[12%] border-r truncate" title={item.consigneeName}>{item.consigneeName}</div>
                        <div className="p-3 w-[12%] border-r truncate" title={item.shipToParty}>{item.shipToParty}</div>
                        <div className="p-3 w-[12%] border-r italic text-slate-500 text-[10px] leading-tight">{item.from} → {item.destination}</div>
                        <div className="p-3 w-[5%] border-r text-right">{item.quantity}</div>
                        <div className="p-3 w-[5%] border-r text-right text-emerald-600 font-black">{item.balance?.toFixed(3)}</div>
                        <div className="p-1 w-[50px] flex justify-center">
                           <Button onClick={() => { setSelectedOrder(item); setAssignData({ ...assignData, assignWeight: item.balance.toFixed(3), assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") }); setShowAssign(true); }} className="h-7 w-full text-[9px] font-black uppercase bg-[#1e3a8a] text-white rounded-none px-0">Assign</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 w-[3%] border-r text-center">{item.plantCode}</div>
                        <div className="p-3 w-[9%] border-r flex flex-col justify-center">
                           <span className="text-slate-800">{item.orderNo}</span>
                           <span className="text-[10px] text-slate-400 font-bold">{item.orderDate ? format(new Date(item.orderDate), 'dd-MMM-yyyy') : '-'}</span>
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
                        <div className="p-1 w-[50px] flex flex-col gap-1 items-center">
                           {activeTab === 'Loading' && (
                             <Button onClick={() => { setSelectedTrip(item); setActionData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowOutPortal(true); }} className="h-6 w-full text-[8px] font-black bg-[#1e3a8a] text-white rounded-none px-0">OUT</Button>
                           )}
                           {activeTab === 'In-Transit' && (
                             <Button onClick={() => { setSelectedTrip(item); setActionData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowArrivePortal(true); }} className="h-6 w-full text-[8px] font-black bg-emerald-600 text-white rounded-none px-0">ARRIVE</Button>
                           )}
                           {(activeTab === 'In-Transit' || activeTab === 'Arrived') && (
                             <Button onClick={() => { setSelectedTrip(item); setShowMapPortal(true); }} variant="outline" className="h-6 w-full text-[8px] font-black border-blue-200 text-blue-600 rounded-none px-0">MAP</Button>
                           )}
                        </div>
                      </>
                    )}
                  </div>

                  {activeTab !== 'Open Orders' && (
                    <div className="flex bg-slate-50/70 border-t border-slate-200 h-9 items-center px-4">
                       <div className="flex-1 flex items-center gap-6 overflow-hidden">
                          <div className="flex items-center gap-2 group cursor-pointer overflow-hidden" onClick={() => { setSelectedTrip(item); setShowMapPortal(true); }}>
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
        <DialogContent className="max-w-[900px] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col text-slate-900 text-left overflow-hidden">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 shrink-0 text-left">
             <DialogTitle className="text-[14px] font-black uppercase text-[#1e3a8a] italic mb-4">Vehicle Assignment Protocol</DialogTitle>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white border border-slate-200 p-4 shadow-inner text-[10px] font-black uppercase">
                <div className="flex flex-col gap-1.5"><span className="text-slate-400 text-[8px]">Consignee</span><p className="truncate">{selectedOrder?.consigneeName}</p></div>
                <div className="flex flex-col gap-1.5"><span className="text-slate-400 text-[8px]">Ship To Party</span><p className="truncate">{selectedOrder?.shipToParty}</p></div>
                <div className="flex flex-col gap-1.5"><span className="text-slate-400 text-[8px]">Route</span><p className="truncate text-emerald-600 italic">{selectedOrder?.from} → {selectedOrder?.destination}</p></div>
                <div className="flex flex-col gap-1.5"><span className="text-slate-400 text-[8px]">Order Qty</span><p className="text-blue-700">{selectedOrder?.quantity} MT</p></div>
             </div>
          </DialogHeader>
          
          <div className="p-8 space-y-8 flex-1 overflow-y-auto green-scrollbar text-left">
             <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number *</label>
                   <input 
                     autoFocus
                     value={assignData.vehicleNo || ''} 
                     onChange={e => setAssignData({...assignData, vehicleNo: e.target.value.toUpperCase()})} 
                     className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" 
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Driver Mobile</label>
                   <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-300" />
                      <input 
                        value={assignData.driverMobile || ''} 
                        onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} 
                        className="h-9 w-full border border-slate-400 pl-8 pr-3 text-xs font-bold" 
                      />
                   </div>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Assign Date Time *</label>
                   <input 
                     type="datetime-local"
                     value={assignData.assignDate} 
                     onChange={e => setAssignData({...assignData, assignDate: e.target.value})} 
                     className="h-9 w-full border border-slate-400 px-3 text-xs font-bold" 
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Fleet Type *</label>
                   <select 
                     value={assignData.fleetType} 
                     onChange={e => setAssignData({...assignData, fleetType: e.target.value, vendorName: '', vendorMobile: '', rate: '', freightAmount: ''})}
                     className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-black uppercase outline-none"
                   >
                     <option value="Own Vehicle">Own Vehicle</option>
                     <option value="Market Vehicle">Market Vehicle</option>
                   </select>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-[#0056d2] uppercase">Assign Qty (MT) *</label>
                   <input 
                     type="number" 
                     step="0.001" 
                     value={assignData.assignWeight || ''} 
                     onChange={e => {
                        const val = e.target.value;
                        setAssignData({...assignData, assignWeight: val});
                        if (assignData.fleetType === 'Market Vehicle') handleRateCalculation(assignData.rate || '0', val);
                     }} 
                     className="h-9 w-full border border-[#0056d2] px-3 text-xs font-black outline-none text-blue-700 focus:bg-blue-50/30 shadow-inner" 
                   />
                   <span className="text-[8px] text-slate-400 italic">Available Balance: {selectedOrder?.balance?.toFixed(3)} MT</span>
                </div>

                {assignData.fleetType === 'Market Vehicle' && (
                  <>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase">Vendor Name *</label>
                       <select 
                         value={assignData.vendorName || ''}
                         onChange={e => {
                           const v = vendors?.find(vend => vend.vendorName === e.target.value);
                           setAssignData({...assignData, vendorName: e.target.value, vendorMobile: v?.mobile || ''});
                         }}
                         className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-black uppercase outline-none"
                       >
                         <option value="">Select Vendor...</option>
                         {vendors?.map(v => <option key={v.id} value={v.vendorName}>{v.vendorName}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase">Vendor Mobile (Auto)</label>
                       <input 
                         value={assignData.vendorMobile || ''} 
                         readOnly
                         className="h-9 w-full border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-500" 
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase">Arrange By</label>
                       <input 
                         value={assignData.arrangeBy || ''} 
                         onChange={e => setAssignData({...assignData, arrangeBy: e.target.value.toUpperCase()})} 
                         className="h-9 w-full border border-slate-400 px-3 text-[11px]" 
                       />
                    </div>
                    <div className="space-y-1.5 relative">
                       <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-400 uppercase">Rate</label>
                          <button 
                            onClick={() => setAssignData({...assignData, fixRate: !assignData.fixRate, rate: assignData.fixRate ? assignData.rate : ''})}
                            className="flex items-center gap-1.5 text-[8px] font-black text-blue-700 uppercase"
                          >
                             {assignData.fixRate ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />} Fix Rate
                          </button>
                       </div>
                       <div className="relative">
                          <input 
                            type="number"
                            value={assignData.rate || ''} 
                            disabled={assignData.fixRate}
                            onChange={e => handleRateCalculation(e.target.value, assignData.assignWeight)}
                            className={cn("h-9 w-full border px-3 text-xs font-black outline-none", assignData.fixRate ? "bg-slate-100 border-slate-200 text-slate-400" : "border-slate-400 focus:bg-yellow-50")} 
                          />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-2">
                          <Calculator className="h-3 w-3" /> Freight Amount
                       </label>
                       <input 
                         type="number"
                         value={assignData.freightAmount || ''} 
                         readOnly={!assignData.fixRate}
                         onChange={e => assignData.fixRate && setAssignData({...assignData, freightAmount: e.target.value})}
                         className={cn("h-9 w-full border px-3 text-xs font-black outline-none", !assignData.fixRate ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-[#0056d2] focus:bg-blue-50")} 
                       />
                    </div>
                  </>
                )}
             </div>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 shrink-0 text-left">
             <Button onClick={() => setShowAssign(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black border-slate-300 px-10">Exit</Button>
             <Button onClick={handlePostAssignment} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-24 shadow-lg active:scale-95 transition-all">Post Protocol</Button>
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

      <Dialog open={showMapPortal} onOpenChange={setShowMapPortal}>
        <DialogContent className="max-w-4xl rounded-none border-[3px] border-[#0056d2] font-mono p-0 h-[600px] flex flex-col">
          <DialogHeader className="bg-slate-50 p-4 border-b flex flex-row items-center justify-between shrink-0">
             <DialogTitle className="text-xs font-black uppercase text-[#1e3a8a] italic">Live Tracking: {selectedTrip?.vehicleNo}</DialogTitle>
             <Button variant="ghost" onClick={() => setShowMapPortal(false)} className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
          </DialogHeader>
          <div ref={mapRef} className="flex-1 bg-slate-100" />
          <div className="p-3 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase text-left">
             <span className="flex items-center gap-2"><MapPin className="h-3 w-3 text-red-500" /> {locationMap[selectedTrip?.vehicleNo?.trim()] || 'LOCATING...'}</span>
             <span className="text-blue-700 italic">Sikka Satellite Gateway Active</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
