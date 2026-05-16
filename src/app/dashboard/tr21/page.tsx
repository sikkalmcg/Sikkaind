
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ChevronLeft, ChevronRight, X, Download, 
  Plus, Trash, Edit3, Radar, Truck, MapPin, Package, ShoppingCart, CheckCircle, RefreshCw, Loader2,
  Calendar, CheckSquare, AlertTriangle, Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

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
  const [showPODPortal, setShowPODPortal] = React.useState(false);
  const [showUnassignWarning, setShowUnassignWarning] = React.useState(false);
  const [showTrackPortal, setShowTrackPortal] = React.useState(false);
  const [showVehiclePortal, setShowVehiclePortal] = React.useState(false);
  const [showPrintView, setShowPrintView] = React.useState(false);

  // Form States
  const [assignData, setAssignData] = React.useState<any>({});
  const [cnData, setCnData] = React.useState<any>({});
  const [cnItems, setCnItems] = React.useState<any[]>([]);
  const [podData, setPodData] = React.useState({ receivedBy: '', receivedDate: '', remarks: '' });
  const [outData, setOutData] = React.useState({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  const [trackData, setTrackData] = React.useState({ mode: 'GPS', location: 'FETCHING LIVE GATEWAY...' });
  const [vehicleEdit, setVehicleEdit] = React.useState({ vehicleNo: '', mobile: '' });
  const [previousCN, setPreviousCN] = React.useState('');

  React.useEffect(() => { setMounted(true); }, []);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const gpsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'gps_tracking'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: gpsNodes } = useCollection(gpsQuery);

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];

  const filteredData = React.useMemo(() => {
    if (!orders || !trips || !mounted) return [];
    if (activeTab === 'Open Orders') {
      return orders.filter(o => o.status === 'Open').map(o => {
        const dispatched = trips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const weight = parseFloat(o.quantity) || 0;
        const balance = weight - dispatched;
        return { ...o, dispatched, balance };
      }).filter(o => o.balance > 0.001);
    }
    const statusMap: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
    return trips.filter(t => t.status === statusMap[activeTab]);
  }, [orders, trips, activeTab, mounted]);

  const handlePostAssignment = () => {
    if (!assignData.vehicleNo || !assignData.assignWeight) return alert('Mandatory fields missing');
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    const newTrip = {
      id: crypto.randomUUID(),
      tripNo: tripId,
      orderNo: selectedOrder.orderNo,
      plantCode: selectedOrder.plantCode || '',
      consigneeName: selectedOrder.consigneeName || '',
      shipToParty: selectedOrder.shipToParty || '',
      destination: selectedOrder.destination || '',
      vehicleNo: assignData.vehicleNo.toUpperCase(),
      driverMobile: assignData.driverMobile || '',
      assignWeight: assignData.assignWeight,
      fleetType: assignData.fleetType || 'Own Vehicle',
      transporterName: assignData.vendorName || '',
      carrierPan: assignData.vendorPan || '',
      status: 'LOADING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      consignorName: selectedOrder.consignorName || '',
      consignorCode: selectedOrder.consignorCode || '',
      consigneeCode: selectedOrder.consigneeCode || '',
      shipToPartyCode: selectedOrder.shipToPartyCode || '',
      from: selectedOrder.from || ''
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', newTrip.id), newTrip, { merge: true });
    setShowAssign(false);
  };

  const fetchPreviousCN = async (plant: string, vehicle: string) => {
    const qSnap = await getDocs(query(collection(db, 'users', SHARED_HUB_ID, 'trip_board'), 
      where('plantCode', '==', plant),
      where('vehicleNo', '==', vehicle),
      orderBy('createdAt', 'desc'),
      limit(2)
    ));
    if (qSnap.docs.length > 1) {
      const prev = qSnap.docs[1].data();
      setPreviousCN(prev.cnNumber || 'N/A');
    } else setPreviousCN('FIRST TRIP');
  };

  const handleUnassign = () => {
    deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id));
    setShowUnassignWarning(false);
    alert('Registry Node Reversed: Order Reopened');
  };

  const handlePostCN = () => {
    if (!cnData.cnNo) return alert('CN No Mandatory');
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      cnNumber: cnData.cnNo.toUpperCase(),
      cnDate: cnData.cnDate || format(new Date(), 'yyyy-MM-dd'),
      mode: cnData.mode || 'Road',
      paymentTerms: cnData.paymentTerms || '',
      ratePoint: cnData.ratePoint || '',
      items: cnItems,
      totalPackages: cnItems.reduce((acc, it) => acc + (parseInt(it.package) || 0), 0),
      updatedAt: new Date().toISOString()
    });
    setShowCNPortal(false);
  };

  const handleGateOut = () => {
    if (!selectedTrip.cnNumber) return alert('ERROR: CN Number registry required before Gate-Out');
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      status: 'IN-TRANSIT',
      dispatchDate: `${outData.date}T${outData.time}`,
      updatedAt: new Date().toISOString()
    });
    setShowOutPortal(false);
  };

  const handleSelectTrack = (trip: any) => {
    const node = gpsNodes?.find(n => n.vehicleNumber === trip.vehicleNo);
    setTrackData({
      mode: 'GPS',
      location: node ? `${node.lastLocation || 'COORDINATE LOCK ACQUIRED'}` : 'OFFLINE: NO SATELLITE HANDSHAKE'
    });
    setSelectedTrip(trip);
    setShowTrackPortal(true);
  };

  const handleUpdateVehicle = () => {
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), {
      vehicleNo: vehicleEdit.vehicleNo.toUpperCase(),
      driverMobile: vehicleEdit.mobile,
      updatedAt: new Date().toISOString()
    });
    setShowVehiclePortal(false);
  };

  const getPartyData = (id: string) => customers?.find(c => c.customerCode === id || c.id === id) || {};

  const CNPrintView = ({ trip }: { trip: any }) => {
    const consignor = getPartyData(trip.consignorCode);
    const consignee = getPartyData(trip.consigneeCode);
    const shipTo = getPartyData(trip.shipToPartyCode);
    const matList = trip.items?.map((it: any) => it.goodsDescription).filter(Boolean) || [];
    const materialHeader = matList.length === 1 ? matList[0] : matList.length === 2 ? `${matList[0]}, ${matList[1]}` : trip.materialName || 'VARIOUS';
    const invoiceList = trip.items?.map((it: any) => it.invoiceNo).filter(Boolean).join(', ') || '-';
    const ewaybillList = trip.items?.map((it: any) => it.ewaybillNo).filter(Boolean).join(', ') || '-';

    const Copy = ({ title }: { title: string }) => (
      <div className="cn-print-page p-10 font-mono text-[10px] uppercase border border-black mb-10">
        <div className="flex justify-between border-b-2 border-black pb-4 mb-4">
           <div className="flex flex-col">
              <h1 className="text-xl font-black italic text-blue-900 leading-none">SIKKA INDUSTRIES</h1>
              <span className="text-[8px] font-bold text-slate-500 tracking-widest">& LOGISTICS • DIGITAL HUB</span>
           </div>
           <div className="text-right flex flex-col items-end">
              <span className="bg-black text-white px-4 py-1 font-black text-[9px] mb-1">{title}</span>
              <span className="font-black text-xs">CN: {trip.cnNumber}</span>
           </div>
        </div>
        <div className="grid grid-cols-2 gap-0 border border-black mb-4">
           <div className="p-3 border-r border-black space-y-2">
              <p className="text-[8px] font-black text-slate-400">CONSIGNOR (FROM: {trip.from})</p>
              <p className="font-black">{trip.consignorName}</p>
              <p className="text-[9px] leading-tight">{consignor.address || consignor.billingAddress}</p>
              <p className="text-[9px]">GSTIN: {consignor.gstNo || '-'} | MOB: {consignor.mobile || '-'}</p>
           </div>
           <div className="p-3 space-y-2">
              <p className="text-[8px] font-black text-slate-400">CONSIGNEE (TO: {trip.destination})</p>
              <p className="font-black">{trip.consigneeName}</p>
              <p className="text-[9px] leading-tight">{consignee.address || consignee.billingAddress}</p>
              <p className="text-[9px]">GSTIN: {consignee.gstNo || '-'} | MOB: {consignee.mobile || '-'}</p>
           </div>
        </div>
        <div className="grid grid-cols-3 gap-0 border border-black mb-4 h-16">
           <div className="p-2 border-r border-black flex flex-col"><span className="text-[7px] text-slate-400">VEHICLE NO</span><span className="font-black mt-auto">{trip.vehicleNo}</span></div>
           <div className="p-2 border-r border-black flex flex-col"><span className="text-[7px] text-slate-400">MODE</span><span className="font-black mt-auto">{trip.mode || 'ROAD'}</span></div>
           <div className="p-2 flex flex-col"><span className="text-[7px] text-slate-400">DATE</span><span className="font-black mt-auto">{trip.cnDate}</span></div>
        </div>
        <table className="w-full border-collapse border-l border-r border-black mb-4">
           <thead className="bg-slate-50 border-t border-b border-black">
              <tr className="text-[8px] font-black">
                 <th className="p-2 border-r border-black w-32">INVOICE NO</th>
                 <th className="p-2 border-r border-black">DESCRIPTION OF GOODS</th>
                 <th className="p-2 border-r border-black w-24 text-center">PKG</th>
                 <th className="p-2 w-24 text-right">WEIGHT (MT)</th>
              </tr>
           </thead>
           <tbody className="min-h-[200px]">
              {trip.items?.map((it: any, i: number) => (
                <tr key={i} className="border-b border-dotted border-slate-300">
                  <td className="p-2 border-r border-black font-bold">{it.invoiceNo}</td>
                  <td className="p-2 border-r border-black">{it.goodsDescription}</td>
                  <td className="p-2 border-r border-black text-center">{it.package} {it.packageUom}</td>
                  <td className="p-2 text-right font-black">{parseFloat(it.weight || 0).toFixed(3)}</td>
                </tr>
              ))}
              {[...Array(Math.max(0, 5 - (trip.items?.length || 0)))].map((_, i) => (
                 <tr key={`empty-${i}`} className="h-6 border-b border-slate-100"><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td></tr>
              ))}
           </tbody>
           <tfoot className="border-t border-black font-black bg-slate-50">
              <tr>
                 <td colSpan={2} className="p-2 border-r border-black text-right">TOTAL REGISTRY</td>
                 <td className="p-2 border-r border-black text-center">{trip.totalPackages || '-'}</td>
                 <td className="p-2 text-right">{trip.assignWeight}</td>
              </tr>
           </tfoot>
        </table>
        <div className="border border-black p-3 mb-6 bg-slate-50/50">
           <p className="text-[7px] text-slate-400 mb-1">DELIVERY ADDRESS (SOURCE: XD03 MASTER)</p>
           <p className="font-bold text-[9px]">{shipTo.address || shipTo.shippingAddress || 'SEE CONSIGNEE NODE'}</p>
        </div>
        <div className="flex justify-between items-end mt-auto pt-10">
           <div className="text-[7px] text-slate-400 space-y-1">
              <p>CARRIER PAN: {trip.carrierPan || '-'}</p>
              <p className="italic">“This Consignment Note was generated digitally and is to be considered as original.”</p>
           </div>
           <div className="text-center w-40 border-t border-black pt-2">
              <span className="text-[8px] font-black">AUTHORIZED SIGNATORY</span>
           </div>
        </div>
      </div>
    );

    return (
      <div id="printable-area" className="bg-slate-100 p-10 overflow-y-auto h-full">
         <div className="max-w-[800px] mx-auto">
            <Copy title="CONSIGNOR COPY" />
            <div className="page-break-after: always" />
            <Copy title="CONSIGNEE COPY" />
            <div className="page-break-after: always" />
            <Copy title="CARRIER COPY" />
         </div>
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 shadow-sm flex justify-between items-center">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD CONTROL HUB</h2>
        {showPrintView && <Button onClick={() => window.print()} className="h-8 bg-emerald-600 rounded-none text-[10px] font-black uppercase px-6"><Printer className="h-3.5 w-3.5 mr-2" /> PRINT ALL PAGES (CTRL+P)</Button>}
      </div>

      <div className={cn("flex-1 flex flex-col p-8", showPrintView ? "hidden" : "flex")}>
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0", activeTab === t ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300">
              <tr className="text-[9px] font-black uppercase text-slate-500">
                <th className="p-3 border-r">Plant</th>
                <th className="p-3 border-r">Order No</th>
                {activeTab === 'Open Orders' ? (
                  <>
                    <th className="p-3 border-r">Consignee</th>
                    <th className="p-3 border-r text-center">Order Qty</th>
                    <th className="p-3 border-r text-center">Balance</th>
                  </>
                ) : (
                  <>
                    <th className="p-3 border-r">Trip ID</th>
                    <th className="p-3 border-r">Vehicle No</th>
                    <th className="p-3 border-r">CN No</th>
                    <th className="p-3 border-r text-center">Assign Qty</th>
                  </>
                )}
                <th className="p-3">Action Hub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold uppercase text-[11px]">
              {filteredData.map((item: any) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-3 border-r">{item.plantCode}</td>
                  <td className="p-3 border-r text-[#0056d2] font-black">{item.orderNo}</td>
                  {activeTab === 'Open Orders' ? (
                    <>
                      <td className="p-3 border-r">{item.consigneeName}</td>
                      <td className="p-3 border-r text-center">{item.quantity}</td>
                      <td className="p-3 border-r text-center text-emerald-600 font-black">{item.balance.toFixed(3)}</td>
                      <td className="p-3">
                         <Button onClick={() => { setSelectedOrder(item); setAssignData({assignWeight: item.balance}); setShowAssign(true); }} size="sm" className="h-7 text-[9px] font-black uppercase bg-[#0056d2] rounded-none">Assign</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 border-r text-[#1e3a8a]">{item.tripNo}</td>
                      <td className="p-3 border-r hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedTrip(item); setVehicleEdit({vehicleNo: item.vehicleNo, mobile: item.driverMobile}); setShowVehiclePortal(true); }}>
                        <div className="flex items-center justify-between"><span>{item.vehicleNo}</span><Edit className="h-3 w-3 text-slate-300" /></div>
                      </td>
                      <td className="p-3 border-r">
                         <button onClick={() => { setSelectedTrip(item); if(item.cnNumber) { setShowPrintView(true); } else { setCnData({mode: 'Road'}); setCnItems([{invoiceNo: '', goodsDescription: '', weight: item.assignWeight, package: '', packageUom: 'Bag'}]); fetchPreviousCN(item.plantCode, item.vehicleNo); setShowCNPortal(true); } }} className="flex items-center gap-2 hover:text-[#0056d2] transition-colors">
                            {item.cnNumber ? <><Printer className="h-3.5 w-3.5" /> {item.cnNumber}</> : <><Plus className="h-3 w-3" /> REGISTRY</>}
                         </button>
                      </td>
                      <td className="p-3 border-r text-center">{item.assignWeight}</td>
                      <td className="p-3 flex gap-2">
                        {activeTab === 'Loading' && (
                          <>
                            <Button onClick={() => { setSelectedTrip(item); setOutData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowOutPortal(true); }} size="sm" className="h-7 text-[9px] font-black bg-[#1e3a8a] rounded-none">OUT</Button>
                            <Button onClick={() => { setSelectedTrip(item); setShowUnassignWarning(true); }} size="sm" variant="ghost" className="h-7 text-[9px] font-black text-red-500 hover:bg-red-50 rounded-none">UNASSIGN</Button>
                            <Button onClick={() => handleSelectTrack(item)} size="sm" variant="outline" className="h-7 text-[9px] font-black border-slate-300 text-slate-500"><Radar className="h-3 w-3" /></Button>
                          </>
                        )}
                        {activeTab === 'In-Transit' && (
                           <>
                             <Button onClick={() => handleArrival(item.id)} size="sm" className="h-7 text-[9px] font-black bg-emerald-600 rounded-none">ARRIVED</Button>
                             <Button onClick={() => handleSelectTrack(item)} size="sm" variant="outline" className="h-7 text-[9px] font-black border-slate-300 text-slate-500"><Radar className="h-3 w-3" /></Button>
                           </>
                        )}
                        {activeTab === 'Arrived' && <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} size="sm" className="h-7 text-[9px] font-black bg-purple-600 rounded-none">POD REG</Button>}
                        {activeTab === 'POD Verify' && <Button onClick={() => handleCloseTrip(item.id)} size="sm" className="h-7 text-[9px] font-black bg-slate-800 rounded-none">CLOSE</Button>}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPrintView && selectedTrip && (
        <div className="flex-1 overflow-hidden relative">
           <button onClick={() => setShowPrintView(false)} className="absolute top-4 right-4 z-[100] bg-white border border-slate-300 p-2 shadow-lg rounded-full hover:bg-red-50 transition-all"><X className="h-5 w-5 text-red-500" /></button>
           <CNPrintView trip={selectedTrip} />
        </div>
      )}

      {/* CN Entry Portal */}
      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-[900px] max-h-[95vh] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col">
           <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
              <DialogTitle className="text-sm font-black uppercase text-[#0056d2]">CN Registry: {selectedTrip?.tripNo}</DialogTitle>
              <div className="grid grid-cols-4 gap-4 mt-4 text-[9px] font-black uppercase text-slate-400">
                 <span>PLANT: {selectedTrip?.plantCode}</span>
                 <span className="truncate">SHIP TO: {selectedTrip?.shipToParty}</span>
                 <span className="truncate">ROUTE: {selectedTrip?.from} - {selectedTrip?.destination}</span>
                 <span>VEHICLE: {selectedTrip?.vehicleNo}</span>
              </div>
           </DialogHeader>
           <div className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Previous CN (Auto-Fetch)</label><input readOnly value={previousCN} className="h-8 w-full border border-slate-200 bg-slate-50 px-2 text-[10px] outline-none" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">CN Number *</label><input autoFocus value={cnData.cnNo || ''} onChange={e => setCnData({...cnData, cnNo: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-[11px] font-black outline-none focus:bg-yellow-50" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">CN Date</label><input type="date" value={cnData.cnDate || format(new Date(), 'yyyy-MM-dd')} onChange={e => setCnData({...cnData, cnDate: e.target.value})} className="h-8 w-full border border-slate-400 px-2 outline-none" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Payment Terms</label><input value={cnData.paymentTerms || ''} onChange={e => setCnData({...cnData, paymentTerms: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 outline-none" /></div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Mode</label>
                    <select value={cnData.mode} onChange={e => setCnData({...cnData, mode: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 text-[11px] font-black">
                       <option value="Road">Road</option>
                       <option value="Road from Rail">Road from Rail</option>
                    </select>
                 </div>
                 {cnData.mode === 'Road from Rail' && <div className="space-y-1 animate-fade-in"><label className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Rate Point</label><input value={cnData.ratePoint || ''} onChange={e => setCnData({...cnData, ratePoint: e.target.value.toUpperCase()})} className="h-8 w-full border border-blue-400 px-2 outline-none" /></div>}
              </div>
              <div className="space-y-3">
                 <h4 className="text-[10px] font-black uppercase text-slate-500 border-b pb-2 flex justify-between items-center">
                    <span>Material Invoice Registry</span>
                    <Button onClick={() => setCnItems([...cnItems, {invoiceNo: '', goodsDescription: '', weight: '', package: '', packageUom: 'Bag'}])} variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-[#0056d2]"><Plus className="h-3 w-3 mr-1" /> Add Invoice Row</Button>
                 </h4>
                 <table className="w-full border border-slate-200 text-[10px]">
                    <thead className="bg-slate-50">
                       <tr className="font-black uppercase text-slate-400">
                          <th className="p-2 border-r border-b">Invoice No</th>
                          <th className="p-2 border-r border-b">E-Waybill No</th>
                          <th className="p-2 border-r border-b">Goods Description</th>
                          <th className="p-2 border-r border-b text-center">Qty</th>
                          <th className="p-2 border-r border-b text-center w-24">UOM</th>
                          <th className="p-2 border-b text-right w-24">Weight</th>
                       </tr>
                    </thead>
                    <tbody>
                       {cnItems.map((it, idx) => (
                         <tr key={idx} className="hover:bg-slate-50">
                           <td className="border-r border-b"><input value={it.invoiceNo} onChange={e => { const n = [...cnItems]; n[idx].invoiceNo = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 px-2 outline-none focus:bg-yellow-50" /></td>
                           <td className="border-r border-b"><input value={it.ewaybillNo} onChange={e => { const n = [...cnItems]; n[idx].ewaybillNo = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 px-2 outline-none focus:bg-yellow-50" /></td>
                           <td className="border-r border-b"><input value={it.goodsDescription} onChange={e => { const n = [...cnItems]; n[idx].goodsDescription = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-7 px-2 outline-none focus:bg-yellow-50" /></td>
                           <td className="border-r border-b text-center"><input type="number" value={it.package} onChange={e => { const n = [...cnItems]; n[idx].package = e.target.value; setCnItems(n); }} className="w-full h-7 text-center outline-none" /></td>
                           <td className="border-r border-b">
                              <select value={it.packageUom} onChange={e => { const n = [...cnItems]; n[idx].packageUom = e.target.value; setCnItems(n); }} className="w-full h-7 bg-transparent px-1 font-bold outline-none">
                                 <option value="Bag">Bag</option><option value="Box">Box</option><option value="Pieces">Pieces</option>
                              </select>
                           </td>
                           <td className="border-b text-right"><input type="number" step="0.001" value={it.weight} onChange={e => { const n = [...cnItems]; n[idx].weight = e.target.value; setCnItems(n); }} className="w-full h-7 text-right px-2 outline-none" /></td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
           <DialogFooter className="bg-slate-50 p-6 border-t flex justify-between items-center shrink-0">
              <div className="flex gap-4 text-[10px] font-black uppercase text-[#1e3a8a]">
                 <span>TOTAL WEIGHT: {cnItems.reduce((acc, it) => acc + (parseFloat(it.weight) || 0), 0).toFixed(3)} MT</span>
                 <span>PKG TOTAL: {Object.entries(cnItems.reduce((acc: any, it) => { if(!it.packageUom) return acc; acc[it.packageUom] = (acc[it.packageUom] || 0) + (parseInt(it.package) || 0); return acc; }, {})).map(([u, v]) => `${v} ${u}`).join(', ')}</span>
              </div>
              <div className="flex gap-3">
                 <Button onClick={handlePostCN} className="bg-[#0056d2] text-white rounded-none h-9 uppercase text-[10px] font-black px-12">Post CN Registry</Button>
                 <Button onClick={() => setShowCNPortal(false)} variant="outline" className="rounded-none h-9 uppercase text-[10px] font-black border-slate-300">Cancel</Button>
              </div>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Warning */}
      <Dialog open={showUnassignWarning} onOpenChange={setShowUnassignWarning}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-red-600 font-mono">
           <DialogHeader>
             <DialogTitle className="text-red-600 flex items-center gap-2 font-black uppercase italic"><AlertTriangle className="h-5 w-5" /> REVERSAL WARNING</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-4">
              <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase">Are you sure you want to unassign Vehicle <span className="font-black text-red-600">{selectedTrip?.vehicleNo}</span> from order <span className="font-black">{selectedTrip?.orderNo}</span>?</p>
              <p className="text-[10px] text-slate-400 uppercase italic">Action will reverse the dispatch lifecycle and reopen the order node.</p>
           </div>
           <DialogFooter className="gap-2">
              <Button onClick={handleUnassign} className="bg-red-600 text-white h-9 rounded-none text-[10px] font-black uppercase px-8">Confirm Reversal</Button>
              <Button onClick={() => setShowUnassignWarning(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300">Exit ❌</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gate Out Portal */}
      <Dialog open={showOutPortal} onOpenChange={setShowOutPortal}>
        <DialogContent className="max-w-sm rounded-none border-[3px] border-[#1e3a8a] font-mono">
           <DialogHeader>
             <DialogTitle className="text-sm font-black uppercase text-[#1e3a8a]">Confirm Gate-Out Hub</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-[9px] font-black text-slate-400 uppercase">
                 <div className="space-y-1"><span>VEHICLE</span><p className="text-slate-800 text-[11px]">{selectedTrip?.vehicleNo}</p></div>
                 <div className="space-y-1"><span>ROUTE</span><p className="text-slate-800 text-[11px]">{selectedTrip?.from}-{selectedTrip?.destination}</p></div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Dispatch Date</label><input type="date" value={outData.date} onChange={e => setOutData({...outData, date: e.target.value})} className="h-8 w-full border border-slate-300 px-2 outline-none focus:bg-yellow-50" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Dispatch Time</label><input type="time" value={outData.time} onChange={e => setOutData({...outData, time: e.target.value})} className="h-8 w-full border border-slate-300 px-2 outline-none focus:bg-yellow-50" /></div>
              </div>
           </div>
           <DialogFooter><Button onClick={handleGateOut} className="bg-[#1e3a8a] text-white rounded-none h-9 uppercase text-[10px] font-black w-full">Post and Exit Hub</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Track Portal */}
      <Dialog open={showTrackPortal} onOpenChange={setShowTrackPortal}>
        <DialogContent className="max-w-[500px] rounded-none border-[3px] border-emerald-600 font-mono">
           <DialogHeader>
             <DialogTitle className="text-sm font-black uppercase text-emerald-600 italic">Satellite Tracking Hub: {selectedTrip?.vehicleNo}</DialogTitle>
           </DialogHeader>
           <div className="py-8 grid grid-cols-1 gap-8">
              <div className="bg-slate-900 p-6 space-y-4 text-white">
                 <div className="flex items-center gap-3"><Radar className="h-5 w-5 text-emerald-400 animate-pulse" /><span className="text-[9px] font-black uppercase tracking-[0.3em]">Live Node Feedback</span></div>
                 <p className="text-xs font-bold leading-relaxed">{trackData.location}</p>
                 <div className="h-[1px] bg-white/10 w-full" />
                 <div className="flex justify-between text-[8px] font-black opacity-60"><span>VEHICLE: {selectedTrip?.vehicleNo}</span><span>DRIVER: {selectedTrip?.driverMobile}</span></div>
              </div>
              <div className="space-y-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Track Mode</label>
                   <select value={trackData.mode} onChange={e => setTrackData({...trackData, mode: e.target.value})} className="h-8 w-full border border-slate-400 bg-white px-2 font-black text-[11px]">
                      <option value="GPS">GPS SATELLITE</option><option value="SIM">SIM TRIANGULATION</option>
                   </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase italic">Vehicle</label><input readOnly value={selectedTrip?.vehicleNo} className="h-8 w-full border border-slate-200 bg-slate-50 px-2 text-[11px] font-black outline-none" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase italic">Driver Mobile</label><input readOnly value={selectedTrip?.driverMobile} className="h-8 w-full border border-slate-200 bg-slate-50 px-2 text-[11px] outline-none" /></div>
                 </div>
              </div>
           </div>
           <DialogFooter><Button onClick={() => setShowTrackPortal(false)} className="bg-emerald-600 text-white rounded-none h-9 uppercase text-[10px] font-black w-full">Post and Exit Hub</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Info Portal */}
      <Dialog open={showVehiclePortal} onOpenChange={setShowVehiclePortal}>
        <DialogContent className="max-w-sm rounded-none border-[3px] border-[#1e3a8a] font-mono">
           <DialogHeader>
             <DialogTitle className="text-[11px] font-black uppercase text-slate-400 border-b pb-2">SHIP TO: {selectedTrip?.shipToParty} | ROUTE: {selectedTrip?.from}-{selectedTrip?.destination}</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-600 uppercase">Vehicle Number</label><input value={vehicleEdit.vehicleNo} onChange={e => setVehicleEdit({...vehicleEdit, vehicleNo: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-xs font-black outline-none focus:bg-yellow-50" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-600 uppercase">Mobile Number</label><input value={vehicleEdit.mobile} onChange={e => setVehicleEdit({...vehicleEdit, mobile: e.target.value})} className="h-8 w-full border border-slate-400 px-2 text-xs outline-none focus:bg-yellow-50" /></div>
           </div>
           <DialogFooter className="gap-2">
              <Button onClick={handleUpdateVehicle} className="bg-[#1e3a8a] text-white h-9 rounded-none text-[10px] font-black uppercase px-8">Update Hub</Button>
              <Button onClick={() => setShowVehiclePortal(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300 px-8">Cancel</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function handleArrival(tripId: string) { /* Helper placeholder to keep it in same context if needed */ }
function handleCloseTrip(tripId: string) { /* Helper placeholder to keep it in same context if needed */ }
