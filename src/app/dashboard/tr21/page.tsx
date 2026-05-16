
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ChevronLeft, ChevronRight, X, Download, 
  Plus, Trash, Edit3, Radar, Truck, MapPin, Package, ShoppingCart, CheckCircle, RefreshCw, Loader2,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  const [customDeliveryAddress, setCustomDeliveryAddress] = React.useState('');

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
    
    const vGps = gpsData.find(g => g.vehicleNumber === (trip.vehicleNo || trip.vehicleNumber));
    if (vGps) {
      reverseGeocode(parseFloat(vGps.latitude), parseFloat(vGps.longitude));
    } else {
      setLiveLocation('NODE OFFLINE / OUT OF RANGE');
    }
  };

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: plants } = useCollection(plantsQuery);
  const { data: companies } = useCollection(companiesQuery);
  const { data: allCustomers } = useCollection(customersQuery);

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
        const dispatched = trips.filter(t => (t.orderNo === o.orderNo || t.saleOrderId === o.id) && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const weight = parseFloat(o.weight || o.quantity) || 0;
        const balance = weight - dispatched;
        return { ...o, dispatched, balance, weight };
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
    const label = uoms.size > 1 ? 'MIXED' : (Array.from(uoms)[0] || 'PKG');
    return `${total} ${label}`;
  };

  const calculateWeightTotal = (trip: any) => {
    return `${formatWeight(trip?.assignWeight)} MT`;
  };

  const generateTripId = () => {
    const digits = Math.floor(100000000 + Math.random() * 900000000);
    return `T${digits}`;
  };

  const handlePostAssignment = () => {
    if (!assignData.vehicleNumber || !assignData.assignQty) return alert('Mandatory fields missing');
    if (parseFloat(assignData.assignQty) > selectedOrder.balance + 0.001) return alert('Assign Qty exceeds balance');
    
    const tripId = generateTripId();
    const selectedVendor = vendors?.find(v => v.id === assignData.vendorId);
    
    const newTrip = {
      id: crypto.randomUUID(),
      tripNo: tripId,
      tripId,
      orderNo: selectedOrder.orderNo || selectedOrder.saleOrder,
      saleOrderId: selectedOrder.id,
      saleOrderNumber: selectedOrder.saleOrder || selectedOrder.orderNo,
      plantCode: selectedOrder.plantCode,
      consignor: selectedOrder.consignor,
      consignorId: selectedOrder.consignorId,
      consignee: selectedOrder.consignee,
      consigneeId: selectedOrder.consigneeId,
      shipToParty: selectedOrder.shipToParty,
      shipToPartyId: selectedOrder.shipToPartyId,
      destination: selectedOrder.destination,
      from: selectedOrder.from,
      vehicleNo: assignData.vehicleNumber.toUpperCase(),
      vehicleNumber: assignData.vehicleNumber.toUpperCase(),
      driverMobile: assignData.driverMobile || '',
      assignDateTime: assignData.assignDateTime,
      fleetType: assignData.fleetType || 'Own Vehicle',
      assignWeight: assignData.assignQty,
      transporterName: selectedVendor?.vendorName || assignData.vendorName || '',
      vendorName: selectedVendor?.vendorName || assignData.vendorName || '',
      vendorMobile: selectedVendor?.mobile || assignData.vendorMobile || '',
      arrangeBy: assignData.arrangeBy || '',
      rate: assignData.rate || 0,
      freightAmount: assignData.freightAmount || 0,
      isFixRate: assignData.isFixRate || false,
      status: 'LOADING',
      loadingStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', newTrip.id), newTrip, { merge: true });
    setShowAssign(false);
    alert(`Success: Trip ${tripId} registered in node.`);
  };

  const handlePostCN = () => {
    if (!cnData.cnNo) return alert('CN Number Mandatory');
    if (trips?.some(t => t.cnNumber === cnData.cnNo.toUpperCase() && t.id !== selectedTrip.id)) {
      return alert('Registry Error: Duplicate CN Number detected in system.');
    }
    
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      cnNumber: cnData.cnNo.toUpperCase(),
      cnDate: cnData.cnDate,
      paymentTerms: cnData.paymentTerms,
      mode: cnData.mode,
      rakePoint: cnData.rakePoint || '',
      items: cnItems,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowCNPortal(false);
  };

  const handleUpdateVehicle = () => {
    if (!vehicleData.vehicleNumber) return alert('Vehicle Number Mandatory');
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), {
      vehicleNo: vehicleData.vehicleNumber.toUpperCase(),
      vehicleNumber: vehicleData.vehicleNumber.toUpperCase(),
      driverMobile: vehicleData.driverMobile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowVehiclePortal(false);
  };

  const handlePostGateOut = () => {
    if (!selectedTrip.cnNumber) return alert('CN Registry Required before Gate-Out');
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      status: 'IN-TRANSIT',
      transitStatus: 'ACTIVE',
      outDate: `${outData.date}T${outData.time}`,
      dispatchDate: `${outData.date}T${outData.time}`,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setShowOutPortal(false);
  };

  const findPreviousCN = (plant: string) => {
    const plantTrips = trips?.filter(t => t.plantCode === plant && t.cnNumber).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return plantTrips?.[0]?.cnNumber || 'FIRST ENTRY';
  };

  if (!mounted) return <div className="flex-1 bg-[#f2f2f2]" />;

  const carrier = companies?.find(c => c.plantCodes?.includes(selectedTrip?.plantCode)) || companies?.[0];
  const consignorProfile = allCustomers?.find(c => c.customerCode === selectedTrip?.consignorId);
  const consigneeProfile = allCustomers?.find(c => c.customerCode === selectedTrip?.consigneeId);
  const shipToProfile = allCustomers?.find(c => c.customerCode === selectedTrip?.shipToPartyId);

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
                    <th className="p-3 border-r w-[160px]">Sale Order</th>
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
                    <th className="p-3 border-r w-[160px]">Sale Order/ Order Date time</th>
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
                      <td className="p-3 border-r text-[#0056d2] font-black">{item.orderNo || item.saleOrder}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.consignor}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.consignee}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{item.shipToParty}</td>
                      <td className="p-3 border-r truncate max-w-[200px]">{getRoute(item)}</td>
                      <td className="p-3 border-r text-center">{formatWeight(item.weight || item.quantity)}</td>
                      <td className="p-3 border-r text-center text-blue-600">{formatWeight(item.dispatched)}</td>
                      <td className="p-3 border-r text-center text-emerald-600 font-black">{formatWeight(item.balance)}</td>
                      <td className="p-3">
                         <Button onClick={() => { 
                           setSelectedOrder(item); 
                           setAssignData({
                             assignQty: item.balance, 
                             fleetType: 'Own Vehicle',
                             assignDateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                             rate: 0,
                             freightAmount: 0,
                             isFixRate: false
                           }); 
                           setShowAssign(true); 
                         }} size="sm" className="h-7 text-[9px] font-black uppercase bg-[#0056d2] rounded-none px-6">Assign</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 border-r">{item.plantCode}</td>
                      <td className="p-3 border-r">
                         <div className="flex flex-col">
                           <span className="text-[#0056d2] font-black">{item.orderNo || item.saleOrderNumber}</span>
                           <span className="text-[9px] text-slate-400">{item.saleOrderDate || item.orderDate ? format(new Date(item.saleOrderDate || item.orderDate), 'dd-MM HH:mm') : '-'}</span>
                         </div>
                      </td>
                      <td className="p-3 border-r">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-700">{item.tripNo || item.tripId}</span>
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
                         <div onClick={() => { setSelectedTrip(item); setVehicleData({vehicleNumber: item.vehicleNo || item.vehicleNumber, driverMobile: item.driverMobile}); setShowVehiclePortal(true); }} className="flex flex-col cursor-pointer hover:bg-slate-50 p-1">
                           <span className="font-black text-[#0056d2]">{item.vehicleNo || item.vehicleNumber}</span>
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
                               <span onClick={() => { setSelectedTrip(item); setCustomDeliveryAddress(item.destinationAddress || shipToProfile?.address || item.destination); setShowCNPreview(true); }} className="text-[#1e3a8a] font-black cursor-pointer hover:underline">{item.cnNumber}</span>
                               <button onClick={() => { 
                                 setSelectedTrip(item); 
                                 setCnData({cnNo: item.cnNumber, cnDate: item.cnDate, paymentTerms: item.paymentTerms || 'PAID', mode: item.mode || 'Road', rakePoint: item.rakePoint || ''}); 
                                 setCnItems(item.items || []); 
                                 setPrevCN(findPreviousCN(item.plantCode));
                                 setShowCNPortal(true); 
                               }} className="p-1 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5 text-slate-300" /></button>
                            </div>
                          ) : (
                            <button onClick={() => { 
                              setSelectedTrip(item); 
                              setCnData({cnDate: format(new Date(), 'yyyy-MM-dd'), paymentTerms: 'PAID', mode: 'Road'}); 
                              setCnItems([{invoiceNo: '', ewaybillNo: '', goodsDescription: '', package: '0', packageUom: 'Bag', weight: '0.000'}]); 
                              setPrevCN(findPreviousCN(item.plantCode));
                              setShowCNPortal(true); 
                            }} className="p-1.5 bg-blue-50 hover:bg-blue-100 transition-colors"><Plus className="h-4 w-4 text-[#0056d2]" /></button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-r text-center font-black">{formatWeight(item.assignWeight)}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-2 min-w-[260px]">
                          <div className="flex justify-end items-center gap-2">
                            {activeTab === 'Loading' && (
                              <Button 
                                disabled={!item.cnNumber}
                                onClick={() => { setSelectedTrip(item); setOutData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowOutPortal(true); }} 
                                size="sm" 
                                className="h-7 text-[9px] font-black uppercase bg-[#1e3a8a] rounded-none px-4"
                              >Out</Button>
                            )}
                            <Button 
                              onClick={() => { if(confirm('SATELLITE WARNING: Unassign this trip registry?')) deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', item.id)); }} 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-[9px] font-black text-red-600 border-red-200 hover:bg-red-50 rounded-none px-4"
                            >Unassign</Button>
                          </div>
                          
                          {(activeTab === 'Loading' || activeTab === 'In-Transit' || activeTab === 'Arrived') && (
                            <div className="flex items-center gap-2">
                               <div className="flex-1 text-[8.5px] font-bold text-slate-400 uppercase italic truncate text-right">
                                  {(() => {
                                    const vGps = gpsData.find(g => g.vehicleNumber === (item.vehicleNo || item.vehicleNumber));
                                    const locationText = vGps?.lastLocation || 'NODE OFFLINE';
                                    const mapsUrl = vGps ? `https://www.google.com/maps?q=${vGps.latitude},${vGps.longitude}` : null;
                                    
                                    if (mapsUrl) {
                                      return (
                                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline transition-all">
                                          {locationText}
                                        </a>
                                      );
                                    }
                                    return <span>{locationText}</span>;
                                  })()}
                               </div>
                               <Button onClick={() => handleTrackClick(item)} size="sm" variant="outline" className="h-7 text-[9px] font-black uppercase rounded-none border-[#0056d2] text-[#0056d2] px-4">Track</Button>
                            </div>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Enhanced Assign Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-[700px] rounded-none border-[3px] border-[#0056d2] font-mono p-0">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
            <DialogTitle className="text-sm font-black uppercase italic text-[#0056d2]">Vehicle Assignment Hub</DialogTitle>
            {selectedOrder && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-[10px] font-bold uppercase text-slate-500">
                <div className="flex justify-between border-b border-slate-100 pb-1"><span>Consignee:</span><span className="text-slate-800">{selectedOrder.consignee}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-1"><span>Ship To:</span><span className="text-slate-800">{selectedOrder.shipToParty}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-1"><span>Route:</span><span className="text-slate-800">{getRoute(selectedOrder)}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-1"><span>Order Qty:</span><span className="text-blue-600 font-black">{formatWeight(selectedOrder.weight || selectedOrder.quantity)} MT</span></div>
              </div>
            )}
          </DialogHeader>

          <div className="p-8 space-y-6">
             <div className="grid grid-cols-2 gap-8">
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400">Vehicle Number *</label>
                 <input 
                   autoFocus
                   value={assignData.vehicleNumber || ''} 
                   onChange={e => setAssignData({...assignData, vehicleNumber: e.target.value.toUpperCase()})} 
                   className="h-8 w-full border border-slate-400 px-3 text-xs font-black uppercase outline-none focus:bg-yellow-50" 
                   placeholder="UP14CT1234" 
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400">Driver Mobile</label>
                 <input 
                   value={assignData.driverMobile || ''} 
                   onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} 
                   className="h-8 w-full border border-slate-400 px-3 text-xs font-black outline-none" 
                   placeholder="9876543210" 
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400">Assign Date Time</label>
                 <input 
                   type="datetime-local"
                   value={assignData.assignDateTime || ''} 
                   onChange={e => setAssignData({...assignData, assignDateTime: e.target.value})} 
                   className="h-8 w-full border border-slate-400 px-3 text-xs font-black outline-none" 
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400">Fleet Type</label>
                 <select 
                   value={assignData.fleetType} 
                   onChange={e => setAssignData({...assignData, fleetType: e.target.value})} 
                   className="h-8 w-full border border-slate-400 bg-white px-2 text-[11px] font-black uppercase"
                 >
                   <option value="Own Vehicle">Own Vehicle</option>
                   <option value="Contract Vehicle">Contract Vehicle</option>
                   <option value="Market Vehicle">Market Vehicle</option>
                 </select>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400">Assign Qty (MT) *</label>
                 <input 
                   type="number" 
                   step="0.001" 
                   value={assignData.assignQty || ''} 
                   onChange={e => {
                     const qty = e.target.value;
                     const amount = !assignData.isFixRate ? (parseFloat(qty) * (assignData.rate || 0)) : assignData.freightAmount;
                     setAssignData({...assignData, assignQty: qty, freightAmount: amount});
                   }} 
                   className="h-8 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" 
                 />
               </div>
             </div>

             {/* Market Vehicle Conditional Fields */}
             {assignData.fleetType === 'Market Vehicle' && (
               <div className="bg-blue-50/50 border border-blue-100 p-6 space-y-6 animate-fade-in">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-blue-800">Vendor Name (XK03 Lookup)</label>
                      <select 
                        value={assignData.vendorId || ''} 
                        onChange={e => {
                          const v = vendors?.find(vend => vend.id === e.target.value);
                          setAssignData({...assignData, vendorId: e.target.value, vendorName: v?.vendorName, vendorMobile: v?.mobile});
                        }} 
                        className="h-8 w-full border border-blue-200 bg-white px-2 text-[11px] font-black uppercase outline-none"
                      >
                        <option value="">SELECT TRANSPORTER...</option>
                        {vendors?.map(v => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-blue-800">Vendor Mobile</label>
                      <input 
                        value={assignData.vendorMobile || ''} 
                        readOnly 
                        className="h-8 w-full border border-blue-100 bg-slate-50 px-3 text-xs font-bold text-slate-400" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-blue-800">Arrange By</label>
                      <input 
                        value={assignData.arrangeBy || ''} 
                        onChange={e => setAssignData({...assignData, arrangeBy: e.target.value.toUpperCase()})} 
                        className="h-8 w-full border border-blue-200 px-3 text-xs font-black uppercase outline-none" 
                        placeholder="NAME..." 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-blue-800">Rate (PMT)</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="number" 
                          disabled={assignData.isFixRate}
                          value={assignData.rate || ''} 
                          onChange={e => {
                            const r = e.target.value;
                            setAssignData({...assignData, rate: r, freightAmount: parseFloat(r) * (parseFloat(assignData.assignQty) || 0)});
                          }} 
                          className="h-8 flex-1 border border-blue-200 px-3 text-xs font-black outline-none disabled:bg-slate-100" 
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                           <Checkbox 
                             id="fix-rate" 
                             checked={assignData.isFixRate} 
                             onCheckedChange={(checked) => setAssignData({...assignData, isFixRate: checked, rate: checked ? 0 : assignData.rate})} 
                           />
                           <label htmlFor="fix-rate" className="text-[9px] font-black uppercase text-slate-500 cursor-pointer">Fix Rate</label>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-black uppercase text-blue-800">Freight Amount</label>
                      <input 
                        type="number" 
                        readOnly={!assignData.isFixRate}
                        value={assignData.freightAmount || ''} 
                        onChange={e => setAssignData({...assignData, freightAmount: e.target.value})} 
                        className={cn(
                          "h-10 w-full border border-blue-300 px-4 text-sm font-black outline-none",
                          !assignData.isFixRate ? "bg-blue-100/50 text-blue-900" : "bg-white text-emerald-600"
                        )} 
                      />
                    </div>
                  </div>
               </div>
             )}
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-3">
            <Button onClick={() => setShowAssign(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase px-8 border-slate-300">Exit (F3)</Button>
            <Button onClick={handlePostAssignment} className="h-9 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase px-12 shadow-lg active:scale-95 transition-all">Post Registry (F8)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. CN Entry Portal */}
      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-[1100px] rounded-none border-[4px] border-[#0056d2] font-mono p-0 max-h-[90vh] overflow-y-auto">
           <DialogHeader className="bg-[#f8fafc] p-6 border-b border-slate-200 sticky top-0 z-30">
              <DialogTitle className="text-lg font-black uppercase italic tracking-tighter text-[#0056d2]">Consignment Note Registry</DialogTitle>
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
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-slate-600">Rake Point</label>
                     <input value={cnData.rakePoint || ''} onChange={e => setCnData({...cnData, rakePoint: e.target.value.toUpperCase()})} className="h-8 w-full border border-slate-400 px-2 text-[12px] font-black outline-none" />
                   </div>
                 )}
              </div>

              <div className="space-y-3">
                 <h4 className="text-[10px] font-black uppercase text-slate-500 italic">Material Registry</h4>
                 <table className="w-full text-left border border-slate-300">
                   <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-500">
                     <tr>
                       <th className="p-2 border-r border-b">Invoice No.</th>
                       <th className="p-2 border-r border-b">E-waybill No.</th>
                       <th className="p-2 border-r border-b">Description</th>
                       <th className="p-2 border-r border-b w-24">Package</th>
                       <th className="p-2 border-r border-b w-24">UOM</th>
                       <th className="p-2 border-r border-b w-24">Weight</th>
                       <th className="p-2 border-b w-10"></th>
                     </tr>
                   </thead>
                   <tbody>
                     {cnItems.map((item, idx) => (
                       <tr key={idx}>
                         <td className="border-r border-b"><input value={item.invoiceNo} onChange={e => { const ni = [...cnItems]; ni[idx].invoiceNo = e.target.value.toUpperCase(); setCnItems(ni); }} className="w-full h-8 px-2 outline-none" /></td>
                         <td className="border-r border-b"><input value={item.ewaybillNo} onChange={e => { const ni = [...cnItems]; ni[idx].ewaybillNo = e.target.value.toUpperCase(); setCnItems(ni); }} className="w-full h-8 px-2 outline-none" /></td>
                         <td className="border-r border-b"><input value={item.goodsDescription} onChange={e => { const ni = [...cnItems]; ni[idx].goodsDescription = e.target.value.toUpperCase(); setCnItems(ni); }} className="w-full h-8 px-2 outline-none" /></td>
                         <td className="border-r border-b"><input type="number" value={item.package} onChange={e => { const ni = [...cnItems]; ni[idx].package = e.target.value; setCnItems(ni); }} className="w-full h-8 px-2 outline-none" /></td>
                         <td className="border-r border-b">
                           <select value={item.packageUom} onChange={e => { const ni = [...cnItems]; ni[idx].packageUom = e.target.value; setCnItems(ni); }} className="w-full h-8 px-2 bg-white outline-none">
                             <option value="Bag">Bag</option><option value="Box">Box</option><option value="pieces">pieces</option>
                           </select>
                         </td>
                         <td className="border-r border-b"><input type="number" step="0.001" value={item.weight} onChange={e => { const ni = [...cnItems]; ni[idx].weight = e.target.value; setCnItems(ni); }} className="w-full h-8 px-2 outline-none" /></td>
                         <td className="border-b text-center"><button onClick={() => setCnItems(cnItems.filter((_, i) => i !== idx))} className="text-red-400"><Trash className="h-3.5 w-3.5" /></button></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 <Button onClick={() => setCnItems([...cnItems, {invoiceNo: '', ewaybillNo: '', goodsDescription: '', package: '0', packageUom: 'Bag', weight: '0.000'}])} variant="outline" className="h-7 text-[8px] font-black uppercase"><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
              </div>

              <div className="flex justify-end gap-4">
                 <Button onClick={() => setShowCNPortal(false)} variant="outline" className="h-10 px-12 rounded-none uppercase text-[10px] font-black">Cancel</Button>
                 <Button onClick={handlePostCN} className="h-10 px-16 bg-[#0056d2] text-white rounded-none uppercase text-[10px] font-black">Post Registry</Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* 3. CN 3-Copy Print Preview */}
      <Dialog open={showCNPreview} onOpenChange={setShowCNPreview}>
        <DialogContent className="max-w-[1000px] p-0 rounded-none border-none bg-white h-[95vh] overflow-y-auto font-mono no-scrollbar shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>CN Print Preview: {selectedTrip?.cnNumber}</DialogTitle>
          </DialogHeader>
          <div className="sticky top-0 bg-slate-50 border-b p-4 flex justify-between items-center z-[100] print:hidden">
            <h3 className="text-xs font-black uppercase italic text-slate-500">Official Document Preview: {selectedTrip?.cnNumber}</h3>
            <div className="flex gap-2">
               <Button onClick={() => window.print()} className="bg-blue-600 text-white rounded-none h-8 text-[10px] font-black uppercase px-6"><Printer className="h-3.5 w-3.5 mr-2" /> Print Official Copies</Button>
               <Button onClick={() => setShowCNPreview(false)} variant="ghost" className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          
          <div id="printable-area" className="flex flex-col gap-10 p-10 bg-slate-100 print:bg-white items-center">
            {['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'].map((copy, idx) => (
              <div key={copy} className="cn-print-page bg-white p-[15mm] relative border border-slate-300 print:border-none print:shadow-none shadow-xl w-[210mm] min-h-[297mm]">
                <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-black">
                   <div className="flex gap-4 items-start max-w-[60%]">
                      {carrier?.logoUrl && <img src={carrier.logoUrl} alt="Logo" className="w-20 h-20 object-contain grayscale" />}
                      <div className="space-y-1">
                         <h2 className="text-xl font-black uppercase leading-none">{carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h2>
                         <p className="text-[9px] font-bold text-slate-700 uppercase leading-tight whitespace-pre-line">{carrier?.address || 'GHAZIABAD - 201009, UP'}</p>
                         <div className="text-[9px] font-black text-slate-800 space-y-0.5">
                            <p>GSTIN: {carrier?.gstNo || '-'} • PAN: {carrier?.panNo || '-'}</p>
                            <p>MOB: {carrier?.mobile || '-'} • EMAIL: {carrier?.email}</p>
                         </div>
                      </div>
                   </div>
                   <div className="text-right flex flex-col items-end gap-3">
                      <div className="border-2 border-black px-4 py-1 font-black text-[12px]">{copy}</div>
                      <div className="space-y-0.5">
                         <p className="text-[14px] font-black">CN NO: {selectedTrip?.cnNumber}</p>
                         <p className="text-[10px] font-bold">DATE: {selectedTrip?.cnDate ? format(new Date(selectedTrip.cnDate), 'dd/MM/yyyy') : '-'}</p>
                      </div>
                   </div>
                </div>

                <table className="w-full border-collapse border border-black mb-6 text-center text-[10px]">
                   <thead>
                      <tr className="bg-slate-50 border-b border-black font-black uppercase">
                         <th className="p-2 border-r border-black">Vehicle Number</th>
                         <th className="p-2 border-r border-black">Driver Mobile</th>
                         <th className="p-2 border-r border-black">Mode</th>
                         <th className="p-2 border-r border-black">Payment Term</th>
                         <th className="p-2">Trip ID</th>
                      </tr>
                   </thead>
                   <tbody className="font-bold">
                      <tr>
                         <td className="p-2 border-r border-black">{selectedTrip?.vehicleNo || selectedTrip?.vehicleNumber}</td>
                         <td className="p-2 border-r border-black">{selectedTrip?.driverMobile}</td>
                         <td className="p-2 border-r border-black">{selectedTrip?.mode}</td>
                         <td className="p-2 border-r border-black">{selectedTrip?.paymentTerms}</td>
                         <td className="p-2">{selectedTrip?.tripNo || selectedTrip?.tripId}</td>
                      </tr>
                   </tbody>
                </table>

                <div className="grid grid-cols-3 border border-black mb-6 text-[10px] divide-x divide-black">
                   <div className="p-3 space-y-2">
                      <h4 className="font-black border-b border-black pb-1 mb-2 uppercase">Consignor</h4>
                      <p className="font-black text-[11px]">{selectedTrip?.consignor}</p>
                      <p className="text-slate-600 leading-tight min-h-[40px] uppercase italic">{consignorProfile?.address || consignorProfile?.billingAddress}</p>
                      <p className="font-bold">GSTIN: {consignorProfile?.gstNo}</p>
                   </div>
                   <div className="p-3 space-y-2">
                      <h4 className="font-black border-b border-black pb-1 mb-2 uppercase">Consignee</h4>
                      <p className="font-black text-[11px]">{selectedTrip?.consignee}</p>
                      <p className="text-slate-600 leading-tight min-h-[40px] uppercase italic">{consigneeProfile?.address || consigneeProfile?.billingAddress}</p>
                      <p className="font-bold">GSTIN: {consigneeProfile?.gstNo}</p>
                   </div>
                   <div className="p-3 space-y-2">
                      <h4 className="font-black border-b border-black pb-1 mb-2 uppercase">Ship To Party</h4>
                      <p className="font-black text-[11px]">{selectedTrip?.shipToParty}</p>
                      <p className="text-slate-600 leading-tight min-h-[40px] uppercase italic">{shipToProfile?.address || shipToProfile?.shippingAddress}</p>
                      <p className="font-bold">GSTIN: {shipToProfile?.gstNo}</p>
                   </div>
                </div>

                <table className="w-full border-collapse border border-black mb-6 text-[11px]">
                   <thead>
                      <tr className="bg-slate-50 border-b border-black font-black uppercase text-[9px]">
                         <th className="p-2 border-r border-black w-24">Invoice No.</th>
                         <th className="p-2 border-r border-black w-32">E-waybill No.</th>
                         <th className="p-2 border-r border-black">Description</th>
                         <th className="p-2 border-r border-black text-center w-24">Package</th>
                         <th className="p-2 text-center w-24">Weight</th>
                      </tr>
                   </thead>
                   <tbody className="font-bold">
                      {(selectedTrip?.items || []).map((item: any, i: number) => (
                        <tr key={i} className="border-b border-black/10 last:border-b-0">
                           <td className="p-2 border-r border-black uppercase">{item.invoiceNo}</td>
                           <td className="p-2 border-r border-black uppercase">{item.ewaybillNo}</td>
                           <td className="p-2 border-r border-black uppercase italic leading-tight">{item.goodsDescription}</td>
                           <td className="p-2 border-r border-black text-center">{item.package} {item.packageUom}</td>
                           <td className="p-2 text-center">{formatWeight(selectedTrip?.assignWeight)} MT</td>
                        </tr>
                      ))}
                   </tbody>
                   <tfoot className="border-t border-black bg-slate-50 font-black uppercase text-[10px]">
                      <tr>
                         <td colSpan={3} className="p-2 text-right border-r border-black">Total Quantity:</td>
                         <td className="p-2 text-center border-r border-black">{calculatePackageTotal(selectedTrip?.items)}</td>
                         <td className="p-2 text-center">{calculateWeightTotal(selectedTrip)}</td>
                      </tr>
                   </tfoot>
                </table>

                <div className="border border-black mb-6 min-h-[100px]">
                   <h4 className="bg-slate-50 border-b border-black p-2 font-black text-[10px] uppercase">Delivery Address:</h4>
                   <div className="p-3">
                      <textarea 
                        value={customDeliveryAddress || shipToProfile?.address || shipToProfile?.shippingAddress || ''} 
                        onChange={e => setCustomDeliveryAddress(e.target.value.toUpperCase())}
                        className="w-full h-12 text-[10px] font-bold uppercase resize-none outline-none border-none print:h-auto overflow-hidden" 
                      />
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="text-[7px] text-slate-500 uppercase italic leading-relaxed text-justify px-2">
                      {carrier?.termsAndConditions?.join(' ') || 'Standard transport terms apply.'}
                   </div>
                   <div className="flex justify-between items-end pt-4">
                      <div className="flex-1">
                         <p className="text-[10px] font-black uppercase">Note: "This Consignment Note was generated digitally and is to be considered as original."</p>
                      </div>
                      <div className="text-center w-48 border-t border-black pt-2 font-black text-[10px] uppercase">Authorized Signatory</div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Gate-Out Dialog */}
      <Dialog open={showOutPortal} onOpenChange={setShowOutPortal}>
        <DialogContent className="max-w-sm rounded-none border-[3px] border-[#1e3a8a] font-mono">
           <DialogHeader>
              <DialogTitle className="text-sm font-black uppercase italic text-[#1e3a8a]">Confirm Gate-Out Hub</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dispatch Date</label>
                 <input type="date" value={outData.date} onChange={e => setOutData({...outData, date: e.target.value})} className="w-full h-9 border border-slate-300 px-3 text-xs font-black outline-none" />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dispatch Time</label>
                 <input type="time" value={outData.time} onChange={e => setOutData({...outData, time: e.target.value})} className="w-full h-9 border border-slate-300 px-3 text-xs font-black outline-none" />
              </div>
           </div>
           <DialogFooter>
              <Button onClick={handlePostGateOut} className="w-full h-10 bg-[#1e3a8a] text-white rounded-none uppercase text-[10px] font-black shadow-lg">Confirm Dispatch (F8)</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Vehicle Update Dialog */}
      <Dialog open={showVehiclePortal} onOpenChange={setShowVehiclePortal}>
        <DialogContent className="max-w-sm rounded-none border-[3px] border-[#0056d2] font-mono">
           <DialogHeader>
              <DialogTitle className="text-sm font-black uppercase italic text-[#0056d2]">Modify Vehicle Node</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vehicle Number *</label>
                 <input value={vehicleData.vehicleNumber} onChange={e => setVehicleData({...vehicleData, vehicleNumber: e.target.value.toUpperCase()})} className="w-full h-9 border border-slate-300 px-3 text-xs font-black outline-none focus:bg-yellow-50" />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Driver Mobile</label>
                 <input value={vehicleData.driverMobile} onChange={e => setVehicleData({...vehicleData, driverMobile: e.target.value})} className="w-full h-9 border border-slate-300 px-3 text-xs font-bold outline-none" />
              </div>
           </div>
           <DialogFooter>
              <Button onClick={handleUpdateVehicle} className="w-full h-10 bg-[#0056d2] text-white rounded-none uppercase text-[10px] font-black shadow-lg">Update Registry</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Track Portal Dialog */}
      <Dialog open={showTrackPortal} onOpenChange={setShowTrackPortal}>
        <DialogContent className="max-w-4xl rounded-none border-[4px] border-[#1e3a8a] font-mono p-0">
           <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-black uppercase italic tracking-tighter">Live Satellite Monitoring</DialogTitle>
                <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-1">Vehicle: {selectedTrip?.vehicleNo || selectedTrip?.vehicleNumber} • Trip: {selectedTrip?.tripNo || selectedTrip?.tripId}</p>
              </div>
              <Badge className="bg-emerald-500 rounded-none h-6 px-4 font-black">ACTIVE LINK</Badge>
           </DialogHeader>
           <div className="p-10 space-y-8 bg-slate-50">
              <div className="grid grid-cols-2 gap-8">
                 <div className="bg-white border border-slate-200 p-6 space-y-6 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 border-b pb-2">Operational Node</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Current Status:</span><span className="text-xs font-black uppercase text-blue-600">{selectedTrip?.status}</span></div>
                       <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Transporter:</span><span className="text-xs font-black uppercase truncate max-w-[200px]">{selectedTrip?.transporterName || 'OWN FLEET'}</span></div>
                       <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Assigned Qty:</span><span className="text-xs font-black uppercase">{formatWeight(selectedTrip?.assignWeight)} MT</span></div>
                    </div>
                 </div>
                 <div className="bg-white border border-slate-200 p-6 space-y-6 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 border-b pb-2">Satellite Data</h4>
                    <div className="space-y-4">
                       <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Live Address Node:</span>
                          <span className="text-[11px] font-black uppercase text-slate-800 leading-tight italic">{liveLocation}</span>
                       </div>
                       <div className="flex justify-between items-center pt-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase italic">Synchronization:</span>
                          <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> VERIFIED</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="flex justify-center pt-4">
                 {(() => {
                    const vGps = gpsData.find(g => g.vehicleNumber === (selectedTrip?.vehicleNo || selectedTrip?.vehicleNumber));
                    const mapsUrl = vGps ? `https://www.google.com/maps?q=${vGps.latitude},${vGps.longitude}` : null;
                    
                    return mapsUrl ? (
                      <Button asChild className="h-12 px-12 bg-[#0056d2] text-white rounded-none text-[11px] font-black uppercase shadow-xl hover:scale-105 transition-all">
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                          <MapPin className="h-4 w-4 mr-2" /> Open In Google Maps Hub
                        </a>
                      </Button>
                    ) : (
                      <div className="h-12 px-12 bg-slate-200 text-slate-400 border border-slate-300 flex items-center gap-2 text-[10px] font-black uppercase">
                         <Radar className="h-4 w-4" /> Vehicle Hub Offline
                      </div>
                    );
                 })()}
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
