'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Filter, Search, MapPin, Truck, Radar, 
  X, Trash2, Plus, FileText, ChevronLeft, ChevronRight, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useUser } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const SHARED_HUB_ID = 'Sikkaind';

/**
 * @fileOverview TR21 – TRIP BOARD.
 * Centralized logistics execution dashboard managing orders from assignment to closure.
 */
export default function TR21Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Open Orders');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);
  
  const [currentPage, setCurrentPage] = React.useState(1);
  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  const [gpsLive, setGpsLive] = React.useState<any[]>([]);
  const [locationMap, setLocationMap] = React.useState<Record<string, string>>({});

  const [showAssign, setShowAssign] = React.useState(false);
  const [showCNPortal, setShowCNPortal] = React.useState(false);
  const [showVehiclePortal, setShowVehiclePortal] = React.useState(false);
  const [showOutPortal, setShowOutPortal] = React.useState(false);
  const [showArrivePortal, setShowArrivePortal] = React.useState(false);
  const [showMapPortal, setShowMapPortal] = React.useState(false);
  
  const [assignData, setAssignData] = React.useState<any>({
    fleetType: 'Own Vehicle',
    assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    mode: 'Road',
    via: '',
    fixRate: false,
    paymentTerms: 'PAID'
  });

  const [cnData, setCNData] = React.useState<any>({
    cnNumber: '',
    cnDate: format(new Date(), 'yyyy-MM-dd'),
    paymentTerms: 'PAID',
    invoices: [{ id: '1', invNo: '', ewaybillNo: '', desc: '', pkg: '', uom: 'Bag' }]
  });

  const [vehicleData, setVehicleData] = React.useState({ vehicleNo: '', driverMobile: '' });

  const settingsRef = useMemoFirebase(() => {
    return doc(db, 'users', SHARED_HUB_ID, 'gps_tracking', 'settings');
  }, [db]);
  const { data: settings } = useDoc(settingsRef);

  const mapRef = React.useRef<HTMLDivElement>(null);

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
        let formatted = (street && city) ? `${street}, ${city}` : (city || results[0].formatted_address.split(',')[0]);
        setLocationMap(prev => ({ ...prev, [vehicleNo.trim()]: formatted }));
      }
    });
  }, []);

  const fetchGps = React.useCallback(async () => {
    try {
      const res = await fetch('/api/gps');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.list) setGpsLive(json.data.list);
      }
    } catch (e) { console.error(e); }
  }, []);

  React.useEffect(() => {
    fetchGps();
    const interval = setInterval(fetchGps, 900000);
    return () => clearInterval(interval);
  }, [fetchGps]);

  React.useEffect(() => {
    gpsLive.forEach(node => {
      const vNo = node.vehicleNumber?.trim();
      if (vNo && node.latitude && node.longitude) reverseGeocode(vNo, parseFloat(node.latitude), parseFloat(node.longitude));
    });
  }, [gpsLive, reverseGeocode]);

  const ordersQuery = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'sales_orders');
  }, [db, user, isAuthLoading]);

  const tripsQuery = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'trip_board');
  }, [db, user, isAuthLoading]);

  const plantsQuery = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'plants');
  }, [db, user, isAuthLoading]);

  const vendorsQuery = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'vendors');
  }, [db, user, isAuthLoading]);

  const companiesQuery = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'companies');
  }, [db, user, isAuthLoading]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: plants } = useCollection(plantsQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: companies } = useCollection(companiesQuery);

  const currentCarrier = React.useMemo(() => {
    if (!selectedTrip || !companies) return null;
    return companies.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(selectedTrip.plantCode)) || companies[0];
  }, [selectedTrip, companies]);

  const lastCarrierCN = React.useMemo(() => {
    if (!currentCarrier || !trips) return '-';
    const carrierTrips = trips.filter(t => (t.carrierName === currentCarrier.companyName) && t.cnNumber);
    if (carrierTrips.length === 0) return '-';
    const sorted = [...carrierTrips].sort((a, b) => {
       const da = new Date(a.updatedAt).getTime() || 0;
       const db = new Date(b.updatedAt).getTime() || 0;
       return db - da;
    });
    return sorted[0].cnNumber;
  }, [currentCarrier, trips]);

  const filteredData = React.useMemo(() => {
    if (!orders || !trips || !mounted) return [];
    let baseData: any[] = [];

    if (activeTab === 'Open Orders') {
      baseData = orders.filter(o => o.status === 'Open').map(o => {
        const dispatched = trips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const weight = parseFloat(o.quantity) || 0;
        return { ...o, dispatched, balance: weight - dispatched };
      }).filter(o => o.balance > 0.001);
    } else {
      const statusMap: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
      baseData = trips.filter(t => t.status === statusMap[activeTab]);
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
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    const now = new Date().toISOString();
    const payload = {
      id: crypto.randomUUID(), tripNo: tripId, orderNo: selectedOrder.orderNo, plantCode: selectedOrder.plantCode,
      consigneeName: selectedOrder.consigneeName, consigneeCode: selectedOrder.consigneeCode,
      shipToParty: selectedOrder.shipToParty, shipToPartyCode: selectedOrder.shipToPartyCode,
      destination: selectedOrder.destination, vehicleNo: assignData.vehicleNo.toUpperCase(),
      driverMobile: assignData.driverMobile || '', assignWeight: parseFloat(assignData.assignWeight),
      status: 'LOADING', assignDate: assignData.assignDate, mode: assignData.mode || 'Road',
      via: assignData.via || '', fleetType: assignData.fleetType, createdAt: now, updatedAt: now,
      consignorName: selectedOrder.consignorName, consignorCode: selectedOrder.consignorCode,
      from: selectedOrder.from, materialName: selectedOrder.materialName,
      paymentTerms: assignData.paymentTerms || 'PAID', vendorName: assignData.vendorName || '',
      vendorMobile: assignData.vendorMobile || '', arrangeBy: assignData.arrangeBy || '',
      rate: parseFloat(assignData.rate) || 0, freightAmount: parseFloat(assignData.freightAmount) || 0,
      fixRate: assignData.fixRate || false
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', payload.id), payload, { merge: true });
    setShowAssign(false);
    alert(`Protocol Post: Trip ID ${tripId} registered.`);
  };

  const handleUpdateVehicle = () => {
    if (!vehicleData.vehicleNo) return;
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      vehicleNo: vehicleData.vehicleNo.toUpperCase(), 
      driverMobile: vehicleData.driverMobile,
      updatedAt: new Date().toISOString()
    });
    setShowVehiclePortal(false);
  };

  const handlePostCN = () => {
    if (!cnData.cnNumber) return alert('CN Number Mandatory');
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      ...cnData, 
      carrierName: currentCarrier?.companyName || '',
      updatedAt: new Date().toISOString() 
    });
    setShowCNPortal(false);
    alert('Documentation Synchronized');
  };

  const totalPackages = cnData.invoices?.reduce((acc: number, row: any) => acc + (parseInt(row.pkg) || 0), 0) || 0;

  React.useEffect(() => {
    if (showMapPortal && selectedTrip && mapRef.current && window.google) {
      const liveNode = gpsLive.find(n => n.vehicleNumber?.trim() === selectedTrip.vehicleNo?.trim());
      const lat = liveNode ? parseFloat(liveNode.latitude) : 20.5937;
      const lng = liveNode ? parseFloat(liveNode.longitude) : 78.9629;
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat, lng }, zoom: 14, disableDefaultUI: true,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
      new window.google.maps.Marker({
        position: { lat, lng }, map,
        icon: { url: liveNode?.status === 'RUNNING' ? (settings?.activeIcon || '') : (settings?.stoppedIcon || ''), scaledSize: new window.google.maps.Size(42, 42), anchor: new window.google.maps.Point(21, 21) }
      });
    }
  }, [showMapPortal, selectedTrip, gpsLive, settings]);

  const handleOpenPrint = (tripId: string) => {
    window.open(`/print/cn/${tripId}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 shadow-sm flex justify-between items-center z-30 shrink-0">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD</h2>
        <div className="flex gap-4 bg-[#f8fafc] border border-slate-200 p-1 px-4 shadow-inner">
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

      <div className="flex-1 flex flex-col p-8 overflow-hidden">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'].map(l => (
            <button key={l} onClick={() => { setActiveTab(l); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0", activeTab === l ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1500px] text-[11px]">
            <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300 font-black uppercase text-slate-500">
              <tr>
                <th className="p-3 border-r w-[60px] text-center">Plant</th>
                <th className="p-3 border-r w-[150px]">Sale Order Details</th>
                {activeTab !== 'Open Orders' && <th className="p-3 border-r w-[100px] text-blue-700">Trip ID</th>}
                <th className="p-3 border-r w-[150px]">Ship to Party</th>
                <th className="p-3 border-r w-[150px]">Route (From → To)</th>
                <th className="p-3 border-r w-[140px]">Vehicle / Mobile</th>
                {activeTab !== 'Open Orders' && <th className="p-3 border-r w-[120px]">CN Number/Date</th>}
                <th className="p-3 border-r w-[80px] text-right">Qty (MT)</th>
                <th className="p-3 w-[100px] shrink-0 text-center text-[10px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item: any) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors group">
                  <td className="p-3 border-r text-center font-black">{item.plantCode}</td>
                  <td className="p-3 border-r leading-tight flex flex-col justify-center min-h-[60px]">
                    <span className="font-black text-slate-800">{item.orderNo}</span>
                    <span className="text-[9px] text-slate-400">{item.orderDate ? format(new Date(item.orderDate), 'dd-MMM-yyyy') : '-'}</span>
                  </td>
                  {activeTab !== 'Open Orders' && <td className="p-3 border-r font-black text-blue-700">{item.tripNo || '-'}</td>}
                  <td className="p-3 border-r truncate font-bold uppercase" title={item.shipToParty}>{item.shipToParty}</td>
                  <td className="p-3 border-r italic text-[10px] leading-tight flex flex-col justify-center min-h-[60px]">
                    <span className="uppercase">{item.from} → {item.destination}</span>
                    {item.via && <span className="text-[8px] font-black text-blue-600 not-italic uppercase">VIA: {item.via}</span>}
                  </td>
                  <td className="p-3 border-r min-h-[60px]">
                     <button onClick={() => { setSelectedTrip(item); setVehicleData({vehicleNo: item.vehicleNo, driverMobile: item.driverMobile}); setShowVehiclePortal(true); }} className="flex flex-col text-left hover:underline group">
                        <span className="font-black text-blue-800 group-hover:text-blue-600 uppercase">{item.vehicleNo || 'ADD VEHICLE'}</span>
                        <span className="text-[9px] text-slate-400 font-bold">{item.driverMobile || '-'}</span>
                     </button>
                  </td>
                  {activeTab !== 'Open Orders' && (
                    <td className="p-3 border-r leading-tight flex flex-col justify-center min-h-[60px]">
                       {item.cnNumber ? (
                         <button onClick={() => handleOpenPrint(item.id)} className="text-left group">
                            <span className="font-black text-emerald-700 group-hover:underline flex items-center gap-1.5"><FileText className="h-3 w-3" /> {item.cnNumber}</span>
                            <span className="text-[9px] text-slate-400">{item.cnDate ? format(new Date(item.cnDate), 'dd-MMM-yyyy') : '-'}</span>
                         </button>
                       ) : <span className="text-slate-300 italic text-[9px]">PENDING</span>}
                    </td>
                  )}
                  <td className="p-3 border-r text-right font-black text-blue-600">{item.assignWeight || item.quantity}</td>
                  <td className="p-3 text-center flex flex-col gap-1 items-center justify-center w-[100px] shrink-0">
                    {activeTab === 'Open Orders' ? (
                      <Button onClick={() => { setSelectedOrder(item); setAssignData({ ...assignData, assignWeight: item.balance.toFixed(3), paymentTerms: 'PAID' }); setShowAssign(true); }} className="h-7 w-[80px] text-[9px] font-black bg-[#1e3a8a] rounded-none">Assign</Button>
                    ) : (
                      <>
                        <Button onClick={() => { 
                          setSelectedTrip(item); 
                          setCNData(item.cnNumber ? item : { ...cnData, invoices: item.invoices || [{ id: '1', invNo: '', ewaybillNo: '', desc: '', pkg: '', uom: 'Bag' }] }); 
                          setShowCNPortal(true); 
                        }} className="h-6 w-[80px] text-[8px] font-black bg-blue-600 text-white rounded-none">{item.cnNumber ? 'Edit CN' : 'CN Entry'}</Button>
                        {activeTab === 'Loading' && <Button onClick={() => { setSelectedTrip(item); setShowOutPortal(true); }} className="h-6 w-[80px] text-[8px] font-black bg-[#1e3a8a] text-white rounded-none">OUT</Button>}
                        {activeTab === 'In-Transit' && (
                          <div className="flex flex-col gap-1">
                            <Button onClick={() => { setSelectedTrip(item); setShowArrivePortal(true); }} className="h-6 w-[80px] text-[8px] font-black bg-emerald-600 text-white rounded-none">ARRIVE</Button>
                            <Button onClick={() => { setSelectedTrip(item); setShowMapPortal(true); }} className="h-6 w-[80px] text-[8px] font-black bg-black text-white rounded-none">MAP</Button>
                          </div>
                        )}
                        {(activeTab === 'Arrived' || activeTab === 'POD Verify') && <Button onClick={() => { setSelectedTrip(item); setShowMapPortal(true); }} className="h-6 w-[80px] text-[8px] font-black bg-black text-white rounded-none">MAP</Button>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Portal */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-[900px] rounded-none border-[3px] border-[#0056d2] font-mono p-0 overflow-hidden">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
             <DialogTitle className="text-[14px] font-black uppercase text-[#1e3a8a] italic mb-4">Vehicle Assignment Protocol</DialogTitle>
             <div className="grid grid-cols-4 gap-6 bg-white border border-slate-200 p-4 shadow-inner text-[10px] font-black uppercase">
                <div><span className="text-slate-400 text-[8px]">Consignee</span><p className="truncate">{selectedOrder?.consigneeName}</p></div>
                <div><span className="text-slate-400 text-[8px]">Ship To Party</span><p className="truncate">{selectedOrder?.shipToParty}</p></div>
                <div><span className="text-slate-400 text-[8px]">Route</span><p className="truncate text-emerald-600 italic">{selectedOrder?.from} → {selectedOrder?.destination}</p></div>
                <div><span className="text-slate-400 text-[8px]">Registry Qty</span><p className="text-blue-700">{selectedOrder?.quantity} MT</p></div>
             </div>
          </DialogHeader>
          <div className="p-8 grid grid-cols-2 gap-x-10 gap-y-6 text-left">
             <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number *</label><input value={assignData.vehicleNo || ''} onChange={e => setAssignData({...assignData, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Driver Mobile</label><input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-bold" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Fleet Type</label><select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-black uppercase outline-none"><option value="Own Vehicle">Own Vehicle</option><option value="Market Vehicle">Market Vehicle</option></select></div>
             <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Transport Mode</label><select value={assignData.mode} onChange={e => setAssignData({...assignData, mode: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-black uppercase outline-none"><option value="Road">Road</option><option value="Road from Rail">Road from Rail</option></select></div>
             {assignData.mode === 'Road from Rail' && <div className="space-y-1.5"><label className="text-[10px] font-black text-[#0056d2] uppercase">Via (Trans-shipment Point) *</label><input value={assignData.via || ''} onChange={e => setAssignData({...assignData, via: e.target.value.toUpperCase()})} className="h-9 w-full border border-[#0056d2] px-3 text-xs font-black" /></div>}
             <div className="space-y-1.5"><label className="text-[10px] font-black text-[#0056d2] uppercase">Assign Qty (MT) *</label><input type="number" step="0.001" value={assignData.assignWeight || ''} onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} className="h-9 w-full border border-[#0056d2] px-3 text-xs font-black outline-none" /></div>

             {assignData.fleetType === 'Market Vehicle' && (
                <div className="col-span-2 grid grid-cols-2 gap-x-10 gap-y-6 pt-4 border-t border-slate-100">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Vendor Name</label>
                      <select value={assignData.vendorName || ''} onChange={e => {
                        const v = vendors?.find(vend => vend.vendorName === e.target.value);
                        setAssignData({...assignData, vendorName: e.target.value, vendorMobile: v?.mobile || ''});
                      }} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-black uppercase outline-none">
                        <option value="">Select Vendor...</option>
                        {vendors?.map(v => <option key={v.id} value={v.vendorName}>{v.vendorName}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Vendor Mobile</label><input readOnly value={assignData.vendorMobile || ''} className="h-9 w-full border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-500" /></div>
                   <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Payment Terms</label><select value={assignData.paymentTerms} onChange={e => setAssignData({...assignData, paymentTerms: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-black uppercase outline-none"><option value="PAID">PAID</option><option value="TO PAY">TO PAY</option></select></div>
                   <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Rate (per MT)</label><input type="number" disabled={assignData.fixRate} value={assignData.rate || ''} onChange={e => setAssignData({...assignData, rate: e.target.value, freightAmount: (parseFloat(e.target.value) * (parseFloat(assignData.assignWeight) || 0)).toFixed(2)})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none" /></div>
                   <div className="space-y-1.5 col-span-2">
                      <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase">Freight Amount</label><div className="flex items-center gap-1.5"><input type="checkbox" id="fixRate" checked={assignData.fixRate} onChange={e => setAssignData({...assignData, fixRate: e.target.checked})} className="h-3 w-3" /><label htmlFor="fixRate" className="text-[8px] font-black uppercase text-slate-500 cursor-pointer">Fix Rate</label></div></div>
                      <input type="number" value={assignData.freightAmount || ''} onChange={e => setAssignData({...assignData, freightAmount: e.target.value})} readOnly={!assignData.fixRate} className={cn("h-9 w-full border px-3 text-xs font-black outline-none", assignData.fixRate ? "border-blue-600 bg-white" : "border-slate-200 bg-slate-50 text-slate-500")} />
                   </div>
                </div>
             )}
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowAssign(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black px-10">Exit</Button>
             <Button onClick={handlePostAssignment} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-24">Post Protocol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CN Entry Portal */}
      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-[1000px] rounded-none border-[3px] border-emerald-600 font-mono p-0 overflow-hidden text-left">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
             <DialogTitle className="text-[14px] font-black uppercase text-emerald-700 italic mb-4">Documentation Execution: Consignment Note</DialogTitle>
             <div className="grid grid-cols-5 gap-6 bg-white border border-slate-200 p-4 text-[10px] font-black uppercase">
                <div><span className="text-slate-400 text-[8px]">Plant</span><p>{selectedTrip?.plantCode}</p></div>
                <div><span className="text-slate-400 text-[8px]">Ship To Party</span><p className="truncate">{selectedTrip?.shipToParty}</p></div>
                <div><span className="text-slate-400 text-[8px]">Route</span><p className="italic">{selectedTrip?.from} → {selectedTrip?.destination}</p></div>
                <div><span className="text-slate-400 text-[8px]">Vehicle</span><p className="text-blue-700">{selectedTrip?.vehicleNo}</p></div>
                <div><span className="text-slate-400 text-[8px]">Carrier</span><p className="text-[#0056d2] truncate">{currentCarrier?.companyName || 'N/A'}</p></div>
             </div>
          </DialogHeader>
          <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto green-scrollbar">
             <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1.5">
                   <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase">CN Number *</label>
                      <div className="bg-slate-800 text-white px-2 py-0.5 text-[8px] font-black uppercase">PREV: {lastCarrierCN}</div>
                   </div>
                   <input value={cnData.cnNumber || ''} onChange={e => setCNData({...cnData, cnNumber: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" />
                </div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">CN Date *</label><input type="date" value={cnData.cnDate} onChange={e => setCNData({...cnData, cnDate: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Payment Terms</label><select value={cnData.paymentTerms} onChange={e => setCNData({...cnData, paymentTerms: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-black uppercase outline-none"><option value="PAID">PAID</option><option value="TO PAY">TO PAY</option></select></div>
             </div>

             <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-slate-200 pb-2">
                   <h4 className="text-[10px] font-black uppercase italic text-slate-600 border-b-2 border-blue-100 w-fit pb-1">Invoice Registry</h4>
                   <Button onClick={() => setCNData({...cnData, invoices: [...cnData.invoices, { id: Math.random().toString(), invNo: '', ewaybillNo: '', desc: '', pkg: '', uom: 'Bag' }]})} variant="outline" className="h-7 text-[8px] uppercase font-black px-4 rounded-none"><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
                </div>
                <table className="w-full text-left text-[10px]">
                   <thead><tr className="bg-slate-50 font-black uppercase text-slate-400 border-b border-slate-200"><th className="p-2">Invoice No</th><th className="p-2">E-waybill No</th><th className="p-2">Goods Desc</th><th className="p-2 w-[100px]">Package</th><th className="p-2 w-[120px]">UOM</th><th className="p-2 w-[40px]"></th></tr></thead>
                   <tbody>
                      {cnData.invoices.map((row: any, idx: number) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="p-2"><input value={row.invNo} onChange={e => { const r = [...cnData.invoices]; r[idx].invNo = e.target.value.toUpperCase(); setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-bold" /></td>
                          <td className="p-2"><input value={row.ewaybillNo} onChange={e => { const r = [...cnData.invoices]; r[idx].ewaybillNo = e.target.value; setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-bold" /></td>
                          <td className="p-2"><input value={row.desc} onChange={e => { const r = [...cnData.invoices]; r[idx].desc = e.target.value.toUpperCase(); setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-bold" /></td>
                          <td className="p-2"><input type="number" value={row.pkg} onChange={e => { const r = [...cnData.invoices]; r[idx].pkg = e.target.value; setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-black" /></td>
                          <td className="p-2"><select value={row.uom} onChange={e => { const r = [...cnData.invoices]; r[idx].uom = e.target.value; setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none bg-transparent font-bold uppercase"><option value="Bag">Bag</option><option value="Box">Box</option><option value="Pieces">Pieces</option><option value="Mix">Mix</option></select></td>
                          <td className="p-2"><button onClick={() => setCNData({...cnData, invoices: cnData.invoices.filter((_: any, i: number) => i !== idx)})} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button></td>
                        </tr>
                      ))}
                   </tbody>
                   <tfoot className="bg-slate-50 font-black text-[9px] uppercase"><tr className="border-t border-slate-200"><td colSpan={3} className="p-3 text-right text-slate-400">Total Packages Registered:</td><td className="p-3 text-emerald-700">{totalPackages}</td><td colSpan={2}></td></tr></tfoot>
                </table>
             </div>
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowCNPortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black px-10">Cancel</Button>
             <Button onClick={handlePostCN} className="bg-emerald-600 text-white rounded-none h-10 uppercase text-[10px] font-black px-24">Post Protocol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Quick Portal */}
      <Dialog open={showVehiclePortal} onOpenChange={setShowVehiclePortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-blue-900 font-mono p-0 overflow-hidden text-left">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
             <DialogTitle className="text-[12px] font-black uppercase text-blue-900 italic mb-4">Vehicle Data Handshake</DialogTitle>
             <div className="space-y-1 text-[10px] font-black uppercase bg-white border border-slate-200 p-4 shadow-inner">
                <div><span className="text-slate-400 text-[8px]">Ship To Party</span><p className="truncate">{selectedTrip?.shipToParty}</p></div>
                <div className="pt-2"><span className="text-slate-400 text-[8px]">Route</span><p className="italic text-emerald-600">{selectedTrip?.from} → {selectedTrip?.destination}</p></div>
             </div>
          </DialogHeader>
          <div className="p-8 space-y-6">
             <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Update Vehicle No *</label><input autoFocus value={vehicleData.vehicleNo} onChange={e => setVehicleData({...vehicleData, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black uppercase" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Update Driver Mobile</label><input value={vehicleData.driverMobile} onChange={e => setVehicleData({...vehicleData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-bold" /></div>
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowVehiclePortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black px-10">Cancel</Button>
             <Button onClick={handleUpdateVehicle} className="bg-blue-900 text-white rounded-none h-10 uppercase text-[10px] font-black px-16">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Portals (Out / Arrive) */}
      <ActionPortal open={showOutPortal} onOpenChange={setShowOutPortal} title="Dispatch Synchronization (OUT)" trip={selectedTrip} onPost={(d, t) => {
          const ts = `${d}T${t}:00`;
          updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { status: 'IN-TRANSIT', dispatchDate: ts, updatedAt: new Date().toISOString() });
          setShowOutPortal(false);
      }} />
      <ActionPortal open={showArrivePortal} onOpenChange={setShowArrivePortal} title="Arrival Synchronization" trip={selectedTrip} onPost={(d, t) => {
          const ts = `${d}T${t}:00`;
          updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { status: 'ARRIVED', arrivalDate: ts, updatedAt: new Date().toISOString() });
          setShowArrivePortal(false);
      }} />

      {/* Map Portal */}
      <Dialog open={showMapPortal} onOpenChange={setShowMapPortal}>
        <DialogContent className="max-w-4xl rounded-none border-[3px] border-[#0056d2] font-mono p-0 h-[600px] flex flex-col text-left">
          <DialogHeader className="bg-slate-50 p-4 border-b flex flex-row items-center justify-between shrink-0">
             <DialogTitle className="text-xs font-black uppercase text-[#1e3a8a] italic">Live Tracking: {selectedTrip?.vehicleNo}</DialogTitle>
             <Button variant="ghost" onClick={() => setShowMapPortal(false)} className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
          </DialogHeader>
          <div ref={mapRef} className="flex-1 bg-slate-100" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionPortal({ open, onOpenChange, title, onPost, trip }: { open: boolean, onOpenChange: (v: boolean) => void, title: string, onPost: (d: string, t: string) => void, trip: any }) {
  const [data, setData] = React.useState({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-none border-[3px] border-[#0056d2] font-mono p-0 overflow-hidden text-left">
        <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
           <DialogTitle className="text-sm font-black uppercase italic text-[#0056d2] mb-4">{title}</DialogTitle>
           <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase bg-white border border-slate-200 p-4">
              <div><span className="text-slate-400 text-[8px]">VEHICLE</span><p className="text-blue-700">{trip?.vehicleNo}</p></div>
              <div><span className="text-slate-400 text-[8px]">TRIP ID</span><p>{trip?.tripNo}</p></div>
           </div>
        </DialogHeader>
        <div className="p-8 grid grid-cols-2 gap-6">
           <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Date</label><input type="date" value={data.date} onChange={e => setData({...data, date: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[11px] font-bold" /></div>
           <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Time</label><input type="time" value={data.time} onChange={e => setData({...data, time: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[11px] font-bold" /></div>
        </div>
        <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
           <Button onClick={() => onOpenChange(false)} variant="outline" className="h-10 rounded-none text-[10px] font-black uppercase px-8">Exit</Button>
           <Button onClick={() => onPost(data.date, data.time)} className="h-10 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase px-16">Post</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
