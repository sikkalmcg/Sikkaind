
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  Filter, Search, MapPin, Truck, Radar, 
  X, Trash2, Plus, FileText, ChevronLeft, ChevronRight, Printer,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useUser } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import placeholderData from '@/app/lib/placeholder-images.json';

const SHARED_HUB_ID = 'Sikkaind';

/**
 * @fileOverview TR21 – TRIP BOARD.
 * Centralized logistics execution dashboard managing orders from assignment to closure.
 * Includes a high-fidelity CN Preview Popup Protocol with dynamic Carrier Logo and PAN integration.
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

  const [showAssign, setShowAssign] = React.useState(false);
  const [showCNPortal, setShowCNPortal] = React.useState(false);
  const [showVehiclePortal, setShowVehiclePortal] = React.useState(false);
  const [showOutPortal, setShowOutPortal] = React.useState(false);
  const [showArrivePortal, setShowArrivePortal] = React.useState(false);
  const [showMapPortal, setShowMapPortal] = React.useState(false);
  const [showCNPreview, setShowCNPreview] = React.useState(false);
  
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

  React.useEffect(() => { setMounted(true); }, []);

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

  const companiesQuery = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'companies');
  }, [db, user, isAuthLoading]);

  const customersQuery = useMemoFirebase(() => {
    if (isAuthLoading || !user) return null;
    return collection(db, 'users', SHARED_HUB_ID, 'customers');
  }, [db, user, isAuthLoading]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: plants } = useCollection(plantsQuery);
  const { data: companies } = useCollection(companiesQuery);
  const { data: customers } = useCollection(customersQuery);

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

  const handlePostCN = () => {
    if (!cnData.cnNumber) return alert('CN Number Mandatory');
    
    const cnr = customers?.find(c => c.customerCode === selectedTrip.consignorCode);
    const cne = customers?.find(c => c.customerCode === selectedTrip.consigneeCode);
    const stp = customers?.find(c => c.customerCode === selectedTrip.shipToPartyCode);
    const carrier = companies?.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(selectedTrip.plantCode)) || companies?.[0];

    const publicContext = {
      ...selectedTrip,
      ...cnData,
      carrier: carrier ? {
        companyName: carrier.companyName,
        address: carrier.address,
        mobile: carrier.mobile,
        email: carrier.email,
        gstNo: carrier.gstNo,
        panNo: carrier.panNo,
        website: carrier.website || '',
        logoUrl: carrier.logoUrl,
        termsAndConditions: carrier.termsAndConditions || ''
      } : null,
      consignor: cnr ? { name: cnr.customerName, address: cnr.address, mobile: cnr.mobile, gstNo: cnr.gstNo || cnr.gstin } : null,
      consignee: cne ? { name: cne.customerName, address: cne.address, mobile: cne.mobile, gstNo: cne.gstNo || cne.gstin } : null,
      shipToPartyData: stp ? { name: stp.customerName, address: stp.address, mobile: stp.mobile, gstNo: stp.gstNo || stp.gstin } : null,
      updatedAt: new Date().toISOString()
    };

    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      ...cnData, 
      carrierName: carrier?.companyName || '',
      updatedAt: new Date().toISOString() 
    });

    setDocumentNonBlocking(doc(db, 'public_trips', selectedTrip.id), publicContext, { merge: true });
    setShowCNPortal(false);
    alert('Documentation Synchronized');
  };

  const currentCarrier = React.useMemo(() => {
    if (!selectedTrip || !companies) return null;
    return companies.find(c => c.companyName === selectedTrip.carrierName) || companies.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(selectedTrip.plantCode)) || companies[0];
  }, [selectedTrip, companies]);

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
                {activeTab !== 'Open Orders' && <th className="p-3 border-r w-[120px]">Trip ID</th>}
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
                  {activeTab !== 'Open Orders' && (
                    <td className="p-3 border-r leading-tight flex flex-col justify-center min-h-[60px]">
                      <span className="font-black text-blue-700">{item.tripNo || '-'}</span>
                      <span className="text-[9px] text-slate-400">{item.createdAt ? format(new Date(item.createdAt), 'dd-MMM-yyyy') : '-'}</span>
                    </td>
                  )}
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
                         <button onClick={() => { setSelectedTrip(item); setShowCNPreview(true); }} className="text-left group">
                            <span className="font-black text-emerald-700 group-hover:underline flex items-center gap-1.5"><FileText className="h-3 w-3" /> {item.cnNumber}</span>
                            <span className="text-[9px] text-slate-400">{item.cnDate ? format(new Date(item.cnDate), 'dd-MMM-yyyy') : '-'}</span>
                         </button>
                       ) : <span className="text-slate-300 italic text-[9px]">PENDING</span>}
                    </td>
                  )}
                  <td className="p-3 border-r text-right font-black text-blue-600">{parseFloat(item.assignWeight || item.quantity || 0).toFixed(3)}</td>
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

      {/* CN Preview Portal */}
      <Dialog open={showCNPreview} onOpenChange={setShowCNPreview}>
        <DialogContent className="max-w-[1000px] h-[90vh] rounded-none border-[3px] border-blue-900 font-sans p-0 overflow-hidden flex flex-col">
          <DialogHeader className="bg-slate-50 p-4 border-b border-slate-200 flex flex-row items-center justify-between shrink-0 no-print">
             <div className="flex flex-col text-left">
                <DialogTitle className="text-sm font-black uppercase italic text-blue-900">Consignment Note Preview</DialogTitle>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocol Matrix: 3-Copy A4 System</span>
             </div>
             <div className="flex gap-2">
                <Button onClick={() => window.print()} className="h-9 bg-blue-700 hover:bg-blue-800 text-white rounded-none text-[10px] font-black uppercase px-8 flex items-center gap-2 shadow-md">
                   <Printer className="h-4 w-4" /> Print Protocol
                </Button>
                <Button onClick={() => setShowCNPreview(false)} variant="outline" className="h-9 border-slate-300 text-slate-600 rounded-none text-[10px] font-black uppercase px-8 flex items-center gap-2">
                   <X className="h-4 w-4" /> Exit
                </Button>
             </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-slate-200 p-8 custom-scrollbar print:bg-white print:p-0">
             {selectedTrip && (
               <div id="printable-area" className="mx-auto w-fit print:w-full">
                  <CNPreviewContent trip={selectedTrip} carrier={currentCarrier} customers={customers} />
               </div>
             )}
          </div>
        </DialogContent>
      </Dialog>

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
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowAssign(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black px-10">Exit</Button>
             <Button onClick={handlePostAssignment} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-24">Post Protocol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">CN Number *</label><input value={cnData.cnNumber || ''} onChange={e => setCNData({...cnData, cnNumber: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black" /></div>
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
                </table>
             </div>
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowCNPortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black px-10">Cancel</Button>
             <Button onClick={handlePostCN} className="bg-emerald-600 text-white rounded-none h-10 uppercase text-[10px] font-black px-24">Post Protocol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVehiclePortal} onOpenChange={setShowVehiclePortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-blue-900 font-mono p-0 overflow-hidden text-left">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
             <DialogTitle className="text-[12px] font-black uppercase text-blue-900 italic mb-4">Vehicle Data Handshake</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
             <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Update Vehicle No *</label><input autoFocus value={vehicleData.vehicleNo} onChange={e => setVehicleData({...vehicleData, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black uppercase" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Update Driver Mobile</label><input value={vehicleData.driverMobile} onChange={e => setVehicleData({...vehicleData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-bold" /></div>
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowVehiclePortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black px-10">Cancel</Button>
             <Button onClick={() => { updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { vehicleNo: vehicleData.vehicleNo.toUpperCase(), driverMobile: vehicleData.driverMobile, updatedAt: new Date().toISOString() }); setShowVehiclePortal(false); }} className="bg-blue-900 text-white rounded-none h-10 uppercase text-[10px] font-black px-16">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CNPreviewContent({ trip, carrier, customers }: { trip: any, carrier: any, customers: any[] | null }) {
  const logoFallback = placeholderData.placeholderImages.find(p => p.id === 'logo-old');
  const copies = ['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'];
  
  // Calculate Intelligent Package Summary
  const packageSummary = React.useMemo(() => {
    if (!trip.invoices || trip.invoices.length === 0) return "0 PKG";
    const groups: Record<string, number> = {};
    trip.invoices.forEach((inv: any) => {
      const uom = (inv.uom || "PKG").toUpperCase();
      const qty = parseInt(inv.pkg) || 0;
      groups[uom] = (groups[uom] || 0) + qty;
    });
    return Object.entries(groups)
      .map(([uom, sum]) => `${sum} ${uom}`)
      .join(", ");
  }, [trip.invoices]);

  const consignor = customers?.find(c => c.customerCode === trip.consignorCode);
  const consignee = customers?.find(c => c.customerCode === trip.consigneeCode);
  const shipToParty = customers?.find(c => c.customerCode === trip.shipToPartyCode);

  return (
    <div className="flex flex-col gap-0 bg-white">
      {copies.map((copyLabel, index) => (
        <div key={index} className="relative p-10 bg-white border-b-2 border-dashed border-slate-300 last:border-b-0 print:border-none print:p-10 print:page-break-after-always overflow-hidden text-left w-[210mm] min-h-[297mm] mx-auto box-border flex flex-col">
          <div className="flex justify-between items-start mb-8">
            <div className="flex gap-6 items-start">
              {(carrier?.logoUrl || logoFallback?.url) && (
                <div className="relative w-[90px] h-[42px] shrink-0">
                  <Image 
                    src={carrier?.logoUrl || logoFallback?.url || ''} 
                    alt="Carrier Logo" 
                    fill 
                    className="object-contain" 
                    unoptimized 
                  />
                </div>
              )}
              <div className="space-y-0.5">
                <h1 className="text-[16px] font-black uppercase italic tracking-tighter leading-none">{carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                <p className="text-[9px] uppercase max-w-[400px] leading-tight text-slate-600 font-bold">{carrier?.address}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[9px] font-black uppercase text-slate-500 pt-1">
                  <span>GSTIN: {carrier?.gstNo || 'UNREGISTERED'}</span>
                  {carrier?.panNo && <span>PAN: {carrier.panNo}</span>}
                  <span>MOB: {carrier?.mobile}</span>
                  <span>EMAIL: {carrier?.email}</span>
                  {carrier?.website && <span>WEB: {carrier.website}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-6 text-right">
              <div className="border border-black px-5 py-2 text-[11px] font-normal uppercase italic bg-slate-50 tracking-widest">{copyLabel}</div>
              <div className="space-y-1.5">
                <p className="text-[16px] font-normal tracking-tighter">CN NO: {trip.cnNumber || 'DRAFT'}</p>
                <p className="text-[11px] font-normal">DATE: {trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : '-'}</p>
                <div className="pt-3 text-[10px] font-normal uppercase space-y-1 text-slate-600">
                  <p>FROM: <span className="text-black">{trip.from}</span></p>
                  {trip.mode === 'Road from Rail' && <p>VIA: <span className="text-blue-700">{trip.via}</span></p>}
                  <p>TO: <span className="text-black">{trip.destination}</span></p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
             <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                   <tr className="bg-slate-50 uppercase text-[9px] font-normal text-slate-500 border-b border-black">
                      <th className="p-2 border-r border-black w-1/5 text-center font-normal">Vehicle Number</th>
                      <th className="p-2 border-r border-black w-1/5 text-center font-normal">Driver Mobile</th>
                      <th className="p-2 border-r border-black w-1/5 text-center font-normal">Payment Term</th>
                      <th className="p-2 border-r border-black w-1/5 text-center font-normal">Mode</th>
                      <th className="p-2 w-1/5 text-center font-normal">Trip ID</th>
                   </tr>
                </thead>
                <tbody>
                   <tr className="uppercase font-normal">
                      <td className="p-3 border-r border-black text-center">{trip.vehicleNo}</td>
                      <td className="p-3 border-r border-black text-center">{trip.driverMobile || '-'}</td>
                      <td className="p-3 border-r border-black text-center">{trip.paymentTerms}</td>
                      <td className="p-3 border-r border-black text-center">{trip.mode}</td>
                      <td className="p-3 text-center">{trip.tripNo}</td>
                   </tr>
                </tbody>
             </table>
          </div>

          <div className="grid grid-cols-3 gap-0 mb-8 border border-black">
             <div className="border-r border-black p-5 space-y-4 min-h-[180px]">
                <h4 className="text-[10px] font-normal uppercase text-slate-400 italic mb-2 tracking-widest">Consignor</h4>
                <div className="text-[11px] uppercase font-normal space-y-1.5">
                   <p className="text-[12px]">{trip.consignorName}</p>
                   <p className="leading-relaxed text-slate-600 whitespace-pre-wrap">{consignor?.address}</p>
                   <p>MOB: {consignor?.mobile}</p>
                   <p className="text-[9px] pt-1 text-slate-500 font-mono">GSTIN: {consignor?.gstNo || consignor?.gstin}</p>
                </div>
             </div>
             <div className="border-r border-black p-5 space-y-4 min-h-[180px]">
                <h4 className="text-[10px] font-normal uppercase text-slate-400 italic mb-2 tracking-widest">Consignee</h4>
                <div className="text-[11px] uppercase font-normal space-y-1.5">
                   <p className="text-[12px]">{trip.consigneeName}</p>
                   <p className="leading-relaxed text-slate-600 whitespace-pre-wrap">{consignee?.address}</p>
                   <p className="text-[9px] pt-1 text-slate-500 font-mono">GSTIN: {consignee?.gstNo || consignee?.gstin}</p>
                </div>
             </div>
             <div className="p-5 space-y-4 min-h-[180px] bg-slate-50/20">
                <h4 className="text-[10px] font-normal uppercase text-slate-400 italic mb-2 tracking-widest">Ship To Party</h4>
                <div className="text-[11px] uppercase font-normal space-y-1.5">
                   <p className="text-[12px]">{trip.shipToParty}</p>
                   <p className="leading-relaxed text-slate-600 whitespace-pre-wrap">{shipToParty?.address}</p>
                   <p>MOB: {shipToParty?.mobile}</p>
                   <p className="text-[9px] pt-1 text-slate-500 font-mono">GSTIN: {shipToParty?.gstNo || shipToParty?.gstin}</p>
                </div>
             </div>
          </div>

          <div className="mb-8">
             <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                   <tr className="bg-slate-50 uppercase text-[9px] font-normal text-slate-500 border-b border-black">
                      <th className="p-2 border-r border-black w-[130px] text-left font-normal">Invoice No</th>
                      <th className="p-2 border-r border-black w-[160px] text-left font-normal">E-Waybill No</th>
                      <th className="p-2 border-r border-black text-left font-normal">Description</th>
                      <th className="p-2 border-r border-black w-[110px] text-center font-normal">Package</th>
                      <th className="p-2 w-[110px] text-right font-normal">Weight (MT)</th>
                   </tr>
                </thead>
                <tbody>
                   {trip.invoices?.map((inv: any, i: number) => (
                      <tr key={i} className="border-b border-black last:border-b-0 uppercase font-normal">
                         <td className="p-3 border-r border-black">{inv.invNo}</td>
                         <td className="p-3 border-r border-black">{inv.ewaybillNo}</td>
                         <td className="p-3 border-r border-black leading-snug">{inv.desc}</td>
                         <td className="p-3 border-r border-black text-center">{inv.pkg} {inv.uom}</td>
                         <td className="p-3 text-right">{i === 0 ? parseFloat(trip.assignWeight || 0).toFixed(3) : '-'}</td>
                      </tr>
                   ))}
                   {/* 4 Line Blank Space for manual notes/receiving */}
                   {[1, 2, 3, 4].map(n => (
                     <tr key={`blank-${n}`} className="border-b border-black last:border-b-0 h-10">
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black"></td>
                        <td></td>
                     </tr>
                   ))}
                </tbody>
                <tfoot>
                   <tr className="bg-slate-50 font-normal text-[10px] uppercase">
                      <td colSpan={3} className="p-4 text-right text-slate-400 italic border-t border-black">Gross Total:</td>
                      <td className="p-4 text-center text-blue-900 border-t border-black">{packageSummary}</td>
                      <td className="p-4 text-right text-blue-900 border-t border-black">{parseFloat(trip.assignWeight || 0).toFixed(3)} MT</td>
                   </tr>
                </tfoot>
             </table>
          </div>

          <div className="mt-auto space-y-10">
             <div className="flex justify-between items-end">
                <div className="space-y-4 max-w-[60%]">
                   <h5 className="text-[9px] font-normal uppercase text-slate-400 tracking-widest italic border-b border-slate-100 w-fit pb-1">Terms & Conditions</h5>
                   <div className="space-y-1">
                      {(carrier?.termsAndConditions || '1. THE CARRIER HOLDS NO LIABILITY FOR SHORTAGE NOT REPORTED AT ARRIVAL.\n2. ALL DISPUTES FALL UNDER CORPORATE HQ JURISDICTION.\n3. WEIGHT BASED ON PARTY DECLARATIONS.').split('\n').map((term: string, i: number) => (
                        <p key={i} className="text-[9px] leading-relaxed text-justify text-slate-500 uppercase font-normal">
                          {term.trim()}
                        </p>
                      ))}
                   </div>
                </div>
                <div className="text-right space-y-12 pr-4">
                   <div className="h-14"></div>
                   <div className="space-y-1">
                      <p className="text-[11px] font-normal uppercase italic tracking-tighter">Authorized Signature</p>
                   </div>
                </div>
             </div>
             <div className="text-center pt-6 border-t border-slate-100">
                <p className="text-[11px] font-normal uppercase tracking-tighter italic text-slate-400">
                   This Consignment Note was generated digitally and is to be considered as original.
                </p>
             </div>
          </div>
        </div>
      ))}
    </div>
  );
}
