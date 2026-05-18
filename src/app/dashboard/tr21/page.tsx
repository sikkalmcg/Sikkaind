'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ChevronLeft, ChevronRight, X, Download, 
  Plus, Trash, Edit3, Radar, Truck, MapPin, Package, ShoppingCart, CheckCircle, RefreshCw, Loader2,
  Calendar, CheckSquare, AlertTriangle, Edit, Upload, FileText, Search, Filter, Check, FileCheck, ArrowLeft, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import placeholderData from '@/app/lib/placeholder-images.json';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 25;

export default function TR21Page() {
  const router = useRouter();
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

  // Portals
  const [showAssign, setShowAssign] = React.useState(false);
  const [showCNPortal, setShowCNPortal] = React.useState(false);
  const [showOutPortal, setShowOutPortal] = React.useState(false);
  const [showPODPortal, setShowPODPortal] = React.useState(false);
  const [showUnassignWarning, setShowUnassignWarning] = React.useState(false);
  const [showTrackPortal, setShowTrackPortal] = React.useState(false);
  const [showVehiclePortal, setShowVehiclePortal] = React.useState(false);
  const [showPrintView, setShowPrintView] = React.useState(false);
  const [showArrivePortal, setShowArrivePortal] = React.useState(false);
  const [showUnloadPortal, setShowUnloadPortal] = React.useState(false);
  const [showRejectPortal, setShowRejectPortal] = React.useState(false);

  const [assignData, setAssignData] = React.useState<any>({});
  const [cnData, setCnData] = React.useState<any>({});
  const [cnItems, setCnItems] = React.useState<any[]>([]);
  const [podData, setPodData] = React.useState({ receivedBy: '', receivedDate: format(new Date(), 'yyyy-MM-dd'), remarks: '', podFile: null as string | null });
  const [outData, setOutData] = React.useState({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  const [actionData, setActionData] = React.useState({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  const [vehicleEdit, setVehicleEdit] = React.useState({ vehicleNo: '', mobile: '' });

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
    } finally {
      setIsGpsLoading(false);
    }
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
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: plants } = useCollection(plantsQuery);

  const counts = React.useMemo(() => {
    if (!orders || !trips) return { open: 0, loading: 0, transit: 0, arrived: 0, pod: 0, reject: 0, closed: 0 };
    
    const seenOrders = new Set();
    const seenTrips = new Set();

    return {
      open: orders.filter(o => o.status === 'Open').filter(o => {
        if (seenOrders.has(o.orderNo)) return false;
        seenOrders.add(o.orderNo);
        if (!o.plantCode || !o.orderNo || !o.orderDate || !o.consignorName || !o.from || 
            !o.consigneeName || !o.shipToParty || !o.destination || !o.quantity) return false;

        const dispatched = trips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        return (parseFloat(o.quantity) || 0) - dispatched > 0.001;
      }).length,
      loading: trips.filter(t => t.status === 'LOADING' && !seenTrips.has(t.tripNo) && seenTrips.add(t.tripNo)).length,
      transit: trips.filter(t => t.status === 'IN-TRANSIT' && !seenTrips.has(t.tripNo) && seenTrips.add(t.tripNo)).length,
      arrived: trips.filter(t => t.status === 'ARRIVED' && !seenTrips.has(t.tripNo) && seenTrips.add(t.tripNo)).length,
      reject: trips.filter(t => t.status === 'REJECTION' && !seenTrips.has(t.tripNo) && seenTrips.add(t.tripNo)).length,
      pod: trips.filter(t => t.status === 'POD' && !seenTrips.has(t.tripNo) && seenTrips.add(t.tripNo)).length,
      closed: trips.filter(t => t.status === 'CLOSED' && !seenTrips.has(t.tripNo) && seenTrips.add(t.tripNo)).length
    };
  }, [orders, trips]);

  const TABS = [
    { label: 'Open Orders', count: counts.open },
    { label: 'Loading', count: counts.loading },
    { label: 'In-Transit', count: counts.transit },
    { label: 'Arrived', count: counts.arrived },
    { label: 'Reject', count: counts.reject },
    { label: 'POD Verify', count: counts.pod },
    { label: 'Closed', count: counts.closed }
  ];

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      return format(new Date(cleanDate), 'dd-MMM-yyyy');
    } catch(e) { return '-'; }
  };

  const filteredData = React.useMemo(() => {
    if (!orders || !trips || !mounted) return [];
    
    let baseData: any[] = [];
    const seenNos = new Set();

    if (activeTab === 'Open Orders') {
      baseData = orders.filter(o => o.status === 'Open').filter(o => {
        if (seenNos.has(o.orderNo)) return false;
        seenNos.add(o.orderNo);
        return o.plantCode && o.orderNo && o.orderDate && o.consignorName && o.from && 
               o.consigneeName && o.shipToParty && o.destination && o.quantity;
      }).map(o => {
        const dispatched = trips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const weight = parseFloat(o.quantity) || 0;
        const balance = weight - dispatched;
        return { ...o, dispatched, balance };
      }).filter(o => o.balance > 0.001);
    } else {
      const statusMap: any = { 
        'Loading': 'LOADING', 
        'In-Transit': 'IN-TRANSIT', 
        'Arrived': 'ARRIVED', 
        'Reject': 'REJECTION', 
        'POD Verify': 'POD', 
        'Closed': 'CLOSED' 
      };

      baseData = trips.filter(t => t.status === statusMap[activeTab]).filter(t => {
        if (seenNos.has(t.tripNo)) return false;
        seenNos.add(t.tripNo);
        return true;
      }).map(t => ({
        ...t,
        invoiceDisplay: (t.items || []).map((it: any) => it.invoiceNo).filter(Boolean).join(', ') || '-',
        ewaybillDisplay: (t.items || []).map((it: any) => it.ewaybillNo).filter(Boolean).join(', ') || '-'
      }));
    }

    if (plantFilter !== 'ALL') baseData = baseData.filter(d => d.plantCode === plantFilter);
    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      baseData = baseData.filter(d => (d.orderNo || '').toUpperCase().includes(query) || (d.tripNo || '').toUpperCase().includes(query) || (d.vehicleNo || '').toUpperCase().includes(query));
    }

    return baseData;
  }, [orders, trips, activeTab, mounted, plantFilter, searchQuery]);

  const generateUniqueTripId = React.useCallback((): string => {
    const id = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    if (trips?.some(t => t.tripNo === id)) return generateUniqueTripId();
    return id;
  }, [trips]);

  const handlePostAssignment = () => {
    if (!assignData.vehicleNo || !assignData.assignWeight) return alert('Mandatory fields missing');
    const assignWgt = parseFloat(assignData.assignWeight) || 0;
    const balanceWgt = parseFloat(selectedOrder.balance) || 0;
    
    if (assignWgt > balanceWgt) {
      alert(`Assigned weight (${assignWgt}) cannot exceed Balance.`);
      return;
    }

    const tripId = generateUniqueTripId();
    const now = new Date().toISOString();
    const newTrip = {
      id: crypto.randomUUID(),
      tripNo: tripId,
      orderNo: selectedOrder.orderNo || '',
      plantCode: selectedOrder.plantCode || '',
      consigneeName: selectedOrder.consigneeName || '',
      shipToParty: selectedOrder.shipToParty || '',
      destination: selectedOrder.destination || '',
      vehicleNo: assignData.vehicleNo.toUpperCase(),
      driverMobile: assignData.driverMobile || '',
      assignWeight: assignData.assignWeight || '',
      fleetType: assignData.fleetType || 'Own Vehicle',
      transporterName: assignData.vendorName || '',
      carrierPan: assignData.vendorPan || '',
      arrangeBy: assignData.arrangeBy || '',
      status: 'LOADING',
      createdAt: now,
      updatedAt: now,
      consignorName: selectedOrder.consignorName || '',
      consignorCode: selectedOrder.consignorCode || '',
      consigneeCode: selectedOrder.consigneeCode || '',
      shipToPartyCode: selectedOrder.shipToPartyCode || '',
      from: selectedOrder.from || '',
      materialName: selectedOrder.materialName || '',
      paymentTerms: assignData.paymentTerms || 'TO PAY'
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', newTrip.id), newTrip, { merge: true });
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
              <div className="space-y-1"><span className="text-slate-400 text-[8px]">CN NO</span><p>{trip?.cnNumber || '-'}</p></div>
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
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden text-[#333]">
      <div className="bg-white border-b border-slate-300 px-8 py-3 shadow-sm flex justify-between items-center z-30 shrink-0">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD</h2>
        <div className="flex gap-4 items-center">
           <div className="flex items-center gap-6 bg-[#f8fafc] border border-slate-200 p-1 px-4 shadow-inner">
             <div className="flex items-center gap-2">
               <Filter className="h-3.5 w-3.5 text-slate-400" />
               <select value={plantFilter} onChange={e => setPlantFilter(e.target.value)} className="h-7 bg-transparent text-[10px] font-black uppercase outline-none focus:text-blue-600">
                 <option value="ALL">All Plants</option>
                 {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
               </select>
             </div>
             <div className="w-[1px] h-4 bg-slate-300" />
             <div className="flex items-center gap-2">
               <Search className="h-3.5 w-3.5 text-slate-400" />
               <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-7 w-48 bg-transparent text-[10px] font-black uppercase outline-none focus:w-64 transition-all" placeholder="SEARCH..." />
             </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-8 transition-opacity duration-300">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.label} onClick={() => { setActiveTab(t.label); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0 flex items-center gap-2", activeTab === t.label ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              {t.label} <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold", activeTab === t.label ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500")}>({t.count})</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col bg-white border border-slate-300 shadow-inner green-scrollbar">
          <div className="min-w-[1550px] flex flex-col flex-1 overflow-y-auto green-scrollbar">
            <div className="flex bg-[#f8fafc] border-b border-slate-300 text-[9px] font-black uppercase text-slate-500 sticky top-0 z-20">
               {activeTab === 'Open Orders' ? (
                 <>
                   <div className="p-3 w-[4%] border-r text-center text-black font-black">Plant</div>
                   <div className="p-3 w-[15%] border-r text-black font-black">Order Details</div>
                   <div className="p-3 w-[12%] border-r text-black font-black">Consignor</div>
                   <div className="p-3 w-[12%] border-r text-black font-black">Consignee</div>
                   <div className="p-3 w-[12%] border-r text-black font-black">Ship to Party</div>
                   <div className="p-3 w-[10%] border-r text-black font-black">Route</div>
                   <div className="p-3 w-[8%] border-r text-right text-black font-black">Qty (MT)</div>
                   <div className="p-3 w-[8%] border-r text-right text-emerald-600 font-black">Balance</div>
                   <div className="p-3 flex-1 text-center">Action</div>
                 </>
               ) : (
                 <>
                   <div className="p-3 w-[3%] border-r text-center text-black">Plant</div>
                   <div className="p-3 w-[12%] border-r text-black font-black">Order Details</div>
                   <div className="p-3 w-[7%] border-r text-blue-700">Trip ID</div>
                   <div className="p-3 w-[11%] border-r text-black font-black">Consignee</div>
                   <div className="p-3 w-[9%] border-r text-black font-black">Ship To Party</div>
                   <div className="p-3 w-[7%] border-r">Route</div>
                   <div className="p-3 w-[9%] border-r text-black font-black">Fleet / Vehicle</div>
                   <div className="p-3 w-[4%] border-r text-center">Qty</div>
                   <div className="p-3 w-[11%] border-r text-black font-black">Transporter / Vendor</div>
                   <div className="p-3 w-[8%] border-r text-black font-black">CN No / Date</div>
                   <div className="p-3 flex-1 text-center">Action</div>
                 </>
               )}
            </div>

            {filteredData.map((item: any) => {
              const liveNode = gpsLive.find(n => n.vehicleNumber?.trim() === item.vehicleNo?.trim());
              return (
                <div key={item.id} className="flex flex-col border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
                  <div className="flex items-center text-[10px] font-bold uppercase min-h-[85px] text-left">
                    {activeTab === 'Open Orders' ? (
                      <>
                        <div className="p-3 w-[4%] border-r text-center text-black font-black text-[11px]">{item.plantCode}</div>
                        <div className="p-3 w-[15%] border-r flex flex-col gap-0.5">
                           <span className="font-black text-blue-700 text-[11px]">Order: {item.orderNo}</span>
                           <span className="text-[10px] text-slate-500 font-bold">Date: {formatDateDisplay(item.orderDate)}</span>
                        </div>
                        <div className="p-3 w-[12%] border-r truncate text-black font-black" title={item.consignorName}>{item.consignorName}</div>
                        <div className="p-3 w-[12%] border-r truncate text-black font-black" title={item.consigneeName}>{item.consigneeName}</div>
                        <div className="p-3 w-[12%] border-r truncate text-black font-black" title={item.shipToParty}>{item.shipToParty}</div>
                        <div className="p-3 w-[10%] border-r italic text-slate-500 text-[9px]">{item.from} → {item.destination}</div>
                        <div className="p-3 w-[8%] border-r text-right font-black text-black">{item.quantity}</div>
                        <div className="p-3 w-[8%] border-r text-right font-black text-emerald-600">{item.balance?.toFixed(3)}</div>
                        <div className="p-3 flex-1 flex justify-center">
                           <Button onClick={() => { setSelectedOrder(item); setAssignData({assignWeight: item.balance.toFixed(3), paymentTerms: 'TO PAY'}); setShowAssign(true); }} className="h-7 text-[9px] font-black uppercase bg-[#1e3a8a] text-white rounded-none px-6 shadow-sm">Assign</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 w-[3%] border-r text-center text-black font-black text-[11px]">{item.plantCode}</div>
                        <div className="p-3 w-[12%] border-r flex flex-col gap-0.5">
                           <span className="text-black font-black text-[11px]">Order: {item.orderNo}</span>
                           <span className="text-[10px] text-slate-400 font-bold italic">Date: {formatDateDisplay(item.orderDate)}</span>
                        </div>
                        <div className="p-3 w-[7%] border-r text-blue-700 font-black text-[11px]">{item.tripNo}</div>
                        <div className="p-3 w-[11%] border-r truncate text-black font-black" title={item.consigneeName}>{item.consigneeName}</div>
                        <div className="p-3 w-[9%] border-r truncate text-black font-black" title={item.shipToParty}>{item.shipToParty}</div>
                        <div className="p-3 w-[7%] border-r italic text-slate-500 text-[9px]">{item.from} → {item.destination}</div>
                        <div className="p-3 w-[9%] border-r flex flex-col text-black font-black">
                           <span className="text-[11px]">{item.vehicleNo}</span>
                           <span className="text-[10px] text-slate-400">{item.driverMobile || '-'}</span>
                        </div>
                        <div className="p-3 w-[4%] border-r text-center font-black text-blue-600 text-[11px]">{item.assignWeight}</div>
                        <div className="p-3 w-[11%] border-r truncate text-black font-black" title={item.transporterName}>{item.transporterName || 'OWN FLEET'}</div>
                        <div className="p-3 w-[8%] border-r text-black font-black flex flex-col">
                           <span className="text-[11px]">{item.cnNumber || '-'}</span>
                           <span className="text-[9px] text-slate-400">{item.cnDate ? formatDateDisplay(item.cnDate) : '-'}</span>
                        </div>
                        <div className="p-3 flex-1 flex justify-center items-center gap-2">
                           {activeTab === 'Loading' && (
                             <Button onClick={() => { setSelectedTrip(item); setOutData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowOutPortal(true); }} className="h-7 text-[9px] font-black bg-[#1e3a8a] text-white rounded-none px-4">OUT</Button>
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
