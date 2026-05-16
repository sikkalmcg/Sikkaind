
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
      from: selectedOrder.from || '',
      materialName: selectedOrder.materialName || ''
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

  const handleArrival = (tripId: string) => {
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), { 
      status: 'ARRIVED',
      arrivalDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  const handleCloseTrip = (tripId: string) => {
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), { 
      status: 'CLOSED',
      closedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
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

    const Copy = ({ title }: { title: string }) => (
      <div className="cn-print-page p-10 font-mono text-[10px] uppercase border border-black mb-10 bg-white shadow-sm">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-6">
           <div className="flex flex-col">
              <h1 className="text-2xl font-black italic text-blue-900 leading-none tracking-tighter">SIKKA INDUSTRIES</h1>
              <span className="text-[9px] font-bold text-slate-500 tracking-[0.2em] mt-1">& LOGISTICS • DIGITAL HUB</span>
           </div>
           <div className="flex flex-col items-end">
              <div className="bg-black text-white px-6 py-1.5 font-black text-[10px] mb-2">{title}</div>
              <span className="font-black text-sm tracking-widest">CN: {trip.cnNumber}</span>
           </div>
        </div>

        {/* Parties Section */}
        <div className="grid grid-cols-2 border-2 border-black mb-4">
           <div className="p-4 border-r-2 border-black min-h-[120px] flex flex-col">
              <span className="text-[8px] font-black text-slate-400 mb-2">CONSIGNOR (FROM: {trip.from})</span>
              <p className="font-black text-sm mb-1">{trip.consignorName}</p>
              <p className="text-[10px] leading-tight flex-1">{consignor.address || consignor.billingAddress || '-'}</p>
              <div className="mt-3 flex gap-4 text-[9px] font-bold">
                 <span>GSTIN: <span className="font-black">{consignor.gstNo || '-'}</span></span>
                 <span>MOB: <span className="font-black">{consignor.mobile || '-'}</span></span>
              </div>
           </div>
           <div className="p-4 min-h-[120px] flex flex-col">
              <span className="text-[8px] font-black text-slate-400 mb-2">CONSIGNEE (TO: {trip.destination})</span>
              <p className="font-black text-sm mb-1">{trip.consigneeName}</p>
              <p className="text-[10px] leading-tight flex-1">{consignee.address || consignee.billingAddress || '-'}</p>
              <div className="mt-3 flex gap-4 text-[9px] font-bold">
                 <span>GSTIN: <span className="font-black">{consignee.gstNo || '-'}</span></span>
                 <span>MOB: <span className="font-black">{consignee.mobile || '-'}</span></span>
              </div>
           </div>
        </div>

        {/* Vehicle / Mode / Date Section */}
        <div className="grid grid-cols-3 border-2 border-black mb-4 h-20">
           <div className="p-3 border-r-2 border-black flex flex-col">
              <span className="text-[8px] font-black text-slate-400 mb-2 uppercase tracking-tighter">Vehicle Number</span>
              <span className="font-black text-base mt-auto">{trip.vehicleNo}</span>
           </div>
           <div className="p-3 border-r-2 border-black flex flex-col">
              <span className="text-[8px] font-black text-slate-400 mb-2 uppercase tracking-tighter">Mode</span>
              <span className="font-black text-base mt-auto">{trip.mode || 'ROAD'}</span>
           </div>
           <div className="p-3 flex flex-col">
              <span className="text-[8px] font-black text-slate-400 mb-2 uppercase tracking-tighter">CN Date</span>
              <span className="font-black text-base mt-auto">{trip.cnDate}</span>
           </div>
        </div>

        {/* Table Section */}
        <table className="w-full border-collapse border-2 border-black mb-6">
           <thead className="bg-slate-50 border-b-2 border-black">
              <tr className="text-[9px] font-black">
                 <th className="p-3 border-r-2 border-black w-32 text-left">INVOICE NO</th>
                 <th className="p-3 border-r-2 border-black text-left">DESCRIPTION OF GOODS</th>
                 <th className="p-3 border-r-2 border-black w-32 text-center">PKG</th>
                 <th className="p-3 w-32 text-right">WEIGHT (MT)</th>
              </tr>
           </thead>
           <tbody>
              {trip.items?.map((it: any, i: number) => (
                <tr key={i} className="border-b border-black">
                  <td className="p-3 border-r-2 border-black font-bold text-xs">{it.invoiceNo}</td>
                  <td className="p-3 border-r-2 border-black font-bold text-xs">{it.goodsDescription}</td>
                  <td className="p-3 border-r-2 border-black text-center font-bold text-xs">{it.package} {it.packageUom}</td>
                  <td className="p-3 text-right font-black text-xs">{parseFloat(it.weight || 0).toFixed(3)}</td>
                </tr>
              ))}
           </tbody>
           <tfoot className="border-t-2 border-black font-black bg-slate-50">
              <tr>
                 <td colSpan={2} className="p-3 border-r-2 border-black text-right text-[10px]">TOTAL CONSIGNMENT REGISTRY</td>
                 <td className="p-3 border-r-2 border-black text-center text-xs">{trip.totalPackages || '-'} UNITS</td>
                 <td className="p-3 text-right text-xs text-blue-700 underline underline-offset-4">{trip.assignWeight} MT</td>
              </tr>
           </tfoot>
        </table>

        {/* Delivery Address Section */}
        <div className="border-2 border-black p-4 mb-10 bg-slate-50/50">
           <div className="flex justify-between items-start mb-2">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Delivery Address Hub (Source: XD03 Master)</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ship to: {trip.shipToParty}</span>
           </div>
           <p className="font-bold text-[11px] leading-relaxed italic">{shipTo.address || shipTo.shippingAddress || 'SEE CONSIGNEE NODE'}</p>
        </div>

        {/* Footer Section */}
        <div className="flex justify-between items-end mt-auto pt-16">
           <div className="space-y-2">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">CARRIER PAN: <span className="text-black ml-2 font-black">{trip.carrierPan || '-'}</span></p>
              <p className="text-[9px] font-black italic text-slate-600">“This Consignment Note was generated digitally and is to be considered as original.”</p>
           </div>
           <div className="text-center w-52">
              <div className="border-b-2 border-black w-full mb-2 h-12" />
              <span className="text-[9px] font-black uppercase tracking-tighter">AUTHORIZED SIGNATORY</span>
           </div>
        </div>
      </div>
    );

    return (
      <div id="printable-area" className="bg-slate-100 p-10 overflow-y-auto h-full custom-scrollbar print:p-0">
         <div className="max-w-[800px] mx-auto print:max-w-none">
            <Copy title="CONSIGNOR COPY" />
            <div className="print:page-break-after-always" />
            <Copy title="CONSIGNEE COPY" />
            <div className="print:page-break-after-always" />
            <Copy title="CARRIER COPY" />
         </div>
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 shadow-sm flex justify-between items-center z-30 shrink-0">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD CONTROL HUB</h2>
        {showPrintView && (
          <div className="flex gap-4">
             <Button onClick={() => window.print()} className="h-8 bg-emerald-600 rounded-none text-[10px] font-black uppercase px-6"><Printer className="h-3.5 w-3.5 mr-2" /> Print All (F8)</Button>
             <Button onClick={() => setShowPrintView(false)} variant="outline" className="h-8 border-red-500 text-red-500 rounded-none text-[10px] font-black uppercase px-6">Exit Preview</Button>
          </div>
        )}
      </div>

      <div className={cn("flex-1 flex flex-col p-8 transition-opacity duration-300", showPrintView ? "opacity-0 pointer-events-none" : "opacity-100")}>
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0", activeTab === t ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner green-scrollbar">
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
                         <button onClick={() => { setSelectedTrip(item); if(item.cnNumber) { setShowPrintView(true); } else { setCnData({mode: 'Road'}); setCnItems([{invoiceNo: '', goodsDescription: item.materialName || '', weight: item.assignWeight, package: '', packageUom: 'Bag'}]); fetchPreviousCN(item.plantCode, item.vehicleNo); setShowCNPortal(true); } }} className="flex items-center gap-2 hover:text-[#0056d2] transition-colors group">
                            {item.cnNumber ? <><Printer className="h-3.5 w-3.5" /> {item.cnNumber}</> : <><Plus className="h-3 w-3" /> REGISTRY</>}
                            {item.cnNumber && <div onClick={(e) => { e.stopPropagation(); setCnData({cnNo: item.cnNumber, cnDate: item.cnDate, mode: item.mode, paymentTerms: item.paymentTerms, ratePoint: item.ratePoint}); setCnItems(item.items || []); setShowCNPortal(true); }} className="p-1 hover:bg-blue-100 rounded ml-auto opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 className="h-3 w-3 text-blue-500" /></div>}
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
        <div className="fixed inset-0 top-[48px] z-50 overflow-hidden bg-slate-100 flex flex-col">
           <CNPrintView trip={selectedTrip} />
        </div>
      )}

      {/* CN Entry Portal */}
      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-[950px] max-h-[95vh] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col">
           <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
              <DialogTitle className="text-sm font-black uppercase text-[#0056d2]">Consignment Note Registry Hub: {selectedTrip?.tripNo}</DialogTitle>
              <div className="grid grid-cols-4 gap-6 mt-4 text-[10px] font-black uppercase text-slate-400">
                 <div className="space-y-0.5"><span className="text-slate-300">PLANT</span><p className="text-slate-800">{selectedTrip?.plantCode}</p></div>
                 <div className="space-y-0.5 truncate"><span className="text-slate-300">SHIP TO PARTY</span><p className="text-slate-800">{selectedTrip?.shipToParty}</p></div>
                 <div className="space-y-0.5 truncate"><span className="text-slate-300">ROUTE</span><p className="text-slate-800">{selectedTrip?.from} → {selectedTrip?.destination}</p></div>
                 <div className="space-y-0.5"><span className="text-slate-300">VEHICLE</span><p className="text-slate-800">{selectedTrip?.vehicleNo}</p></div>
              </div>
           </DialogHeader>
           <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-8">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">Previous CN (Registry Match)</label><input readOnly value={previousCN} className="h-9 w-full border border-slate-200 bg-slate-50 px-3 text-[11px] font-black outline-none" /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-[#0056d2] uppercase tracking-tighter">CN Number *</label><input autoFocus value={cnData.cnNo || ''} onChange={e => setCnData({...cnData, cnNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50 shadow-sm" /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">CN Date</label><input type="date" value={cnData.cnDate || format(new Date(), 'yyyy-MM-dd')} onChange={e => setCnData({...cnData, cnDate: e.target.value})} className="h-9 w-full border border-slate-400 px-3 outline-none" /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Payment Terms</label><input value={cnData.paymentTerms || ''} onChange={e => setCnData({...cnData, paymentTerms: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 outline-none" placeholder="E.G. TO BE BILLED" /></div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Transport Mode</label>
                    <select value={cnData.mode} onChange={e => setCnData({...cnData, mode: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-[11px] font-black">
                       <option value="Road">Road</option>
                       <option value="Road from Rail">Road from Rail</option>
                    </select>
                 </div>
                 {cnData.mode === 'Road from Rail' && <div className="space-y-1.5 animate-fade-in"><label className="text-[10px] font-black text-blue-600 uppercase tracking-tighter italic underline underline-offset-4">Rate Point Location</label><input value={cnData.ratePoint || ''} onChange={e => setCnData({...cnData, ratePoint: e.target.value.toUpperCase()})} className="h-9 w-full border border-blue-400 px-3 text-[11px] font-black outline-none focus:bg-blue-50 shadow-inner" /></div>}
              </div>
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase text-slate-500 border-b-2 border-slate-100 pb-3 flex justify-between items-center">
                    <span>Material Invoice Registry Node</span>
                    <Button onClick={() => setCnItems([...cnItems, {invoiceNo: '', goodsDescription: selectedTrip?.materialName || '', weight: '', package: '', packageUom: 'Bag'}])} variant="ghost" size="sm" className="h-7 text-[9px] font-black uppercase text-[#0056d2] border border-blue-100 px-4 hover:bg-blue-50 transition-all"><Plus className="h-3.5 w-3.5 mr-1" /> Add Invoice Item</Button>
                 </h4>
                 <div className="border border-slate-200 shadow-inner bg-slate-50/30 overflow-hidden">
                    <table className="w-full text-[10px]">
                       <thead className="bg-[#f8fafc] border-b border-slate-200 font-black uppercase text-slate-400">
                          <tr>
                             <th className="p-3 border-r text-left w-36">Invoice No</th>
                             <th className="p-3 border-r text-left w-36">E-Waybill No</th>
                             <th className="p-3 border-r text-left">Description of Goods</th>
                             <th className="p-3 border-r text-center w-20">PKG</th>
                             <th className="p-3 border-r text-center w-24">UOM</th>
                             <th className="p-3 text-right w-24">Weight</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {cnItems.map((it, idx) => (
                            <tr key={idx} className="bg-white hover:bg-blue-50/50 transition-colors">
                              <td className="border-r"><input value={it.invoiceNo} onChange={e => { const n = [...cnItems]; n[idx].invoiceNo = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-9 px-3 outline-none focus:bg-yellow-50 text-[11px] font-bold" placeholder="INV-..." /></td>
                              <td className="border-r"><input value={it.ewaybillNo || ''} onChange={e => { const n = [...cnItems]; n[idx].ewaybillNo = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-9 px-3 outline-none focus:bg-yellow-50 text-[11px]" /></td>
                              <td className="border-r"><input value={it.goodsDescription} onChange={e => { const n = [...cnItems]; n[idx].goodsDescription = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-9 px-3 outline-none focus:bg-yellow-50 text-[11px]" /></td>
                              <td className="border-r text-center"><input type="number" value={it.package} onChange={e => { const n = [...cnItems]; n[idx].package = e.target.value; setCnItems(n); }} className="w-full h-9 text-center outline-none font-bold" /></td>
                              <td className="border-r">
                                 <select value={it.packageUom} onChange={e => { const n = [...cnItems]; n[idx].packageUom = e.target.value; setCnItems(n); }} className="w-full h-9 bg-transparent px-2 font-black uppercase text-[9px] outline-none">
                                    <option value="Bag">Bag</option><option value="Box">Box</option><option value="Pieces">Pieces</option>
                                 </select>
                              </td>
                              <td className="text-right"><input type="number" step="0.001" value={it.weight} onChange={e => { const n = [...cnItems]; n[idx].weight = e.target.value; setCnItems(n); }} className="w-full h-9 text-right px-3 outline-none font-black text-blue-600" /></td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
           <DialogFooter className="bg-slate-50 p-6 border-t-2 border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex flex-col gap-1 text-[10px] font-black uppercase text-[#1e3a8a]">
                 <span>TOTAL REGISTRY WEIGHT: {cnItems.reduce((acc, it) => acc + (parseFloat(it.weight) || 0), 0).toFixed(3)} MT</span>
                 <span className="text-slate-400">PKGS: {Object.entries(cnItems.reduce((acc: any, it) => { if(!it.packageUom || !it.package) return acc; acc[it.packageUom] = (acc[it.packageUom] || 0) + (parseInt(it.package) || 0); return acc; }, {})).map(([u, v]) => `${v} ${u}`).join(' | ')}</span>
              </div>
              <div className="flex gap-4">
                 <Button onClick={() => setShowCNPortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black border-slate-300 px-8 transition-all hover:bg-slate-100">Cancel</Button>
                 <Button onClick={handlePostCN} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-16 shadow-lg active:scale-95 transition-all">Post Registry Node</Button>
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
              <p className="text-[10px] text-slate-400 uppercase italic leading-tight">This action will permanently reverse the dispatch lifecycle and reopen the sale order for new vehicle assignment.</p>
           </div>
           <DialogFooter className="gap-2">
              <Button onClick={handleUnassign} className="bg-red-600 text-white h-9 rounded-none text-[10px] font-black uppercase px-8 shadow-md">Confirm Reversal</Button>
              <Button onClick={() => setShowUnassignWarning(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300 px-8">Exit ❌</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-[800px] max-h-[95vh] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 shrink-0">
             <DialogTitle className="sr-only">Vehicle Assignment</DialogTitle>
             <div className="flex justify-between items-center text-[11px] font-black uppercase text-[#1e3a8a]">
                <div className="flex gap-4">
                   <span>ROUTE: {selectedOrder?.from} → {selectedOrder?.destination}</span>
                   <span className="text-slate-300">|</span>
                   <span>BALANCE: {selectedOrder?.balance?.toFixed(3)} MT</span>
                </div>
                <div className="text-slate-400 italic">TRANS: {selectedOrder?.orderNo}</div>
             </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number *</label><input autoFocus value={assignData.vehicleNo || ''} onChange={e => setAssignData({...assignData, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Driver Mobile</label><input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs outline-none focus:bg-yellow-50" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase italic">Assign Date Time (SYSTEM DEFAULT)</label><input type="datetime-local" value={assignData.assignDate || format(new Date(), "yyyy-MM-dd'T'HH:mm")} onChange={e => setAssignData({...assignData, assignDate: e.target.value})} className="h-9 w-full border border-slate-300 bg-slate-50 px-3 text-[11px] outline-none" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-[#0056d2] uppercase">Assign Qty (MT) *</label><input type="number" step="0.001" max={selectedOrder?.balance} value={assignData.assignWeight || ''} onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} className="h-9 w-full border border-blue-400 px-3 text-xs font-black outline-none focus:bg-blue-50 text-blue-700" /></div>
             </div>

             <div className="space-y-6 bg-slate-50/50 p-6 border border-slate-200">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-500 uppercase">Fleet Type Strategy</label>
                   <select value={assignData.fleetType || 'Own Vehicle'} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-9 w-64 border border-slate-400 bg-white px-3 text-[11px] font-bold">
                      <option value="Own Vehicle">Own Vehicle Node</option>
                      <option value="Contract Vehicle">Contract Vehicle Node</option>
                      <option value="Market Vehicle">Market Vehicle Strategy</option>
                   </select>
                </div>

                {assignData.fleetType === 'Market Vehicle' && (
                  <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200 animate-fade-in">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-blue-600 uppercase italic underline underline-offset-2">Vendor Registry Lookup (XK03)</label>
                        <select value={assignData.vendorId || ''} onChange={e => {
                          const v = vendors?.find(vend => vend.id === e.target.value);
                          setAssignData({...assignData, vendorId: e.target.value, vendorName: v?.vendorName || '', vendorPan: v?.panNo || '', vendorMobile: v?.mobile || ''});
                        }} className="h-9 w-full border border-blue-400 bg-white px-3 text-[11px] font-black shadow-inner">
                           <option value="">SELECT MASTER VENDOR...</option>
                           {vendors?.map(v => <option key={v.id} value={v.id}>{v.vendorName} ({v.vendorCode})</option>)}
                        </select>
                     </div>
                     <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Arrange By</label><input value={assignData.arrangeBy || ''} onChange={e => setAssignData({...assignData, arrangeBy: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-[11px]" /></div>
                     
                     <div className="space-y-1.5">
                        <div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-400 uppercase">Rate (Per MT)</label><div className="flex items-center gap-2 px-2 bg-slate-200/50"><Checkbox id="fix-rate" checked={assignData.isFixRate} onCheckedChange={(c) => setAssignData({...assignData, isFixRate: !!c})} className="h-3 w-3 rounded-none" /><label htmlFor="fix-rate" className="text-[8px] font-black text-slate-600 uppercase cursor-pointer">Fix Rate</label></div></div>
                        <input type="number" disabled={assignData.isFixRate} value={assignData.rate || ''} onChange={e => { const r = parseFloat(e.target.value) || 0; setAssignData({...assignData, rate: e.target.value, freight: (r * (parseFloat(assignData.assignWeight) || 0)).toFixed(2)}); }} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none disabled:bg-slate-100 disabled:text-slate-300" />
                     </div>
                     <div className="space-y-1.5"><label className="text-[10px] font-black text-emerald-600 uppercase">Total Freight Amount</label><input type="number" value={assignData.freight || ''} onChange={e => setAssignData({...assignData, freight: e.target.value})} className="h-9 w-full border border-emerald-400 bg-emerald-50 px-3 text-xs font-black outline-none text-emerald-700" readOnly={!assignData.isFixRate} /></div>
                  </div>
                )}
             </div>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 shrink-0">
             <div className="flex gap-4">
                <Button onClick={() => setShowAssign(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black border-slate-300 px-10 transition-all hover:bg-red-50 hover:text-red-500">Exit ❌</Button>
                <Button onClick={handlePostAssignment} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-20 shadow-lg active:scale-95 transition-all">Post Registry and Exit Hub</Button>
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
