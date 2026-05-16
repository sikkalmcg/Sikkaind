
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
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
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
  
  // Filter States
  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Live GPS State
  const [gpsLive, setGpsLive] = React.useState<any[]>([]);
  const [isGpsLoading, setIsGpsLoading] = React.useState(true);

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
  const [podData, setPodData] = React.useState({ receivedBy: '', receivedDate: format(new Date(), 'yyyy-MM-dd'), remarks: '', podFile: null as string | null });
  const [outData, setOutData] = React.useState({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  const [vehicleEdit, setVehicleEdit] = React.useState({ vehicleNo: '', mobile: '' });
  const [previousCN, setPreviousCN] = React.useState('');

  React.useEffect(() => { setMounted(true); }, []);

  // Fetch Live GPS data
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
      console.error("GPS Sync Error:", e);
    } finally {
      setIsGpsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchGps();
    const interval = setInterval(fetchGps, 60000);
    return () => clearInterval(interval);
  }, [fetchGps]);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: plants } = useCollection(plantsQuery);
  const { data: companies } = useCollection(companiesQuery);

  const counts = React.useMemo(() => {
    if (!orders || !trips) return { open: 0, loading: 0, transit: 0, arrived: 0, pod: 0, reject: 0, closed: 0 };
    
    return {
      open: orders.filter(o => o.status === 'Open').filter(o => {
        const dispatched = trips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        return (parseFloat(o.quantity) || 0) - dispatched > 0.001;
      }).length,
      loading: trips.filter(t => t.status === 'LOADING').length,
      transit: trips.filter(t => t.status === 'IN-TRANSIT').length,
      arrived: trips.filter(t => t.status === 'ARRIVED').length,
      reject: trips.filter(t => t.status === 'REJECTION').length,
      pod: trips.filter(t => t.status === 'POD').length,
      closed: trips.filter(t => t.status === 'CLOSED').length
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

  const getCarrierForPlant = (plantCode: string) => {
    if (!companies || !plantCode) return 'SIKKA INDUSTRIES';
    const carrier = companies.find(c => 
      c.linkedPlantCode === plantCode || 
      (Array.isArray(c.plantCodes) && c.plantCodes.includes(plantCode))
    );
    return carrier?.companyName || 'SIKKA INDUSTRIES';
  };

  const filteredData = React.useMemo(() => {
    if (!orders || !trips || !mounted) return [];
    
    const resolveParty = (code: string, fallbackName: string) => {
      if (!code || !customers) return fallbackName || '-';
      const found = customers.find(c => c.customerCode === code || c.id === code);
      return found?.customerName || fallbackName || '-';
    };

    let baseData: any[] = [];

    if (activeTab === 'Open Orders') {
      baseData = orders.filter(o => o.status === 'Open').map(o => {
        const dispatched = trips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const weight = parseFloat(o.quantity) || 0;
        const balance = weight - dispatched;
        return { 
          ...o, 
          dispatched, 
          balance,
          consigneeName: resolveParty(o.consigneeCode, o.consigneeName),
          consignorName: resolveParty(o.consignorCode, o.consignorName)
        };
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

      baseData = trips.filter(t => t.status === statusMap[activeTab]).map(t => {
        const invoices = (t.items || []).map((it: any) => it.invoiceNo).filter(Boolean).join(', ');
        const ewaybills = (t.items || []).map((it: any) => it.ewaybillNo).filter(Boolean).join(', ');
        return {
          ...t,
          consigneeName: resolveParty(t.consigneeCode, t.consigneeName),
          consignorName: resolveParty(t.consignorCode, t.consignorName),
          invoiceDisplay: invoices || '-',
          ewaybillDisplay: ewaybills || '-',
          vehicleDetail: `${t.vehicleNo} / ${t.driverMobile || '-'}`
        };
      });
    }

    if (plantFilter !== 'ALL') baseData = baseData.filter(d => d.plantCode === plantFilter);

    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      baseData = baseData.filter(d => 
        (d.orderNo || '').toUpperCase().includes(query) ||
        (d.tripNo || '').toUpperCase().includes(query) ||
        (d.vehicleNo || '').toUpperCase().includes(query) ||
        (d.consignorName || '').toUpperCase().includes(query) ||
        (d.consigneeName || '').toUpperCase().includes(query) ||
        (d.shipToParty || '').toUpperCase().includes(query) ||
        (d.cnNumber || '').toUpperCase().includes(query)
      );
    }

    return baseData;
  }, [orders, trips, customers, activeTab, mounted, plantFilter, searchQuery]);

  const handlePostAssignment = () => {
    if (!assignData.vehicleNo || !assignData.assignWeight) return alert('Mandatory fields missing');
    const assignWgt = parseFloat(assignData.assignWeight) || 0;
    const balanceWgt = parseFloat(selectedOrder.balance) || 0;
    
    if (assignWgt > balanceWgt) {
      alert(`VALIDATION ERROR: Assigned weight (${assignWgt} MT) cannot exceed Sale Order Balance (${balanceWgt.toFixed(3)} MT).`);
      return;
    }

    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
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

  const fetchPreviousCN = React.useCallback((plant: string, vehicle: string) => {
    if (!trips) return;
    const history = [...trips]
      .filter(t => t.plantCode === plant && t.vehicleNo === vehicle)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const prev = history.find(t => t.id !== selectedTrip?.id);
    setPreviousCN(prev?.cnNumber || 'FIRST TRIP');
  }, [trips, selectedTrip?.id]);

  const handleUnassign = () => {
    deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id));
    setShowUnassignWarning(false);
  };

  const handleUpdateVehicle = () => {
    if (!vehicleEdit.vehicleNo) return alert('Vehicle Number Mandatory');
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      vehicleNo: vehicleEdit.vehicleNo.toUpperCase(),
      driverMobile: vehicleEdit.mobile,
      updatedAt: new Date().toISOString()
    });
    setShowVehiclePortal(false);
  };

  const handlePostCN = () => {
    if (!cnData.cnNo) return alert('CN No Mandatory');
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      cnNumber: cnData.cnNo.toUpperCase(),
      cnDate: cnData.cnDate || format(new Date(), 'yyyy-MM-dd'),
      mode: cnData.mode || 'Road',
      paymentTerms: cnData.paymentTerms || 'TO PAY',
      ratePoint: cnData.ratePoint || '',
      items: cnItems,
      totalPackages: cnItems.reduce((acc, it) => acc + (parseInt(it.package) || 0), 0),
      updatedAt: new Date().toISOString()
    });
    setShowCNPortal(false);
  };

  const handleGateOut = () => {
    if (!selectedTrip.cnNumber) return alert('ERROR: CN Number required before Gate-Out');
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
      arrivalStatus: 'ARRIVED',
      arrivalDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  const handleReject = (tripId: string) => {
    if (!confirm('REJECT WARNING: Move trip to Reject?')) return;
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), { 
      status: 'REJECTION',
      updatedAt: new Date().toISOString()
    });
  };

  const handleResent = (tripId: string) => {
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), { 
      status: 'LOADING',
      updatedAt: new Date().toISOString()
    });
  };

  const handleSRN = (tripId: string) => {
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), { 
      status: 'CLOSED',
      isSRN: true,
      updatedAt: new Date().toISOString()
    });
  };

  const handleUnload = (tripId: string) => {
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), { 
      status: 'POD',
      updatedAt: new Date().toISOString()
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('FILE SIZE ERROR: Maximum limit is 2MB');
    
    const reader = new FileReader();
    reader.onload = async () => {
      let dataUrl = reader.result as string;
      
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = dataUrl;
        await new Promise(resolve => img.onload = resolve);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.6); 
      }
      
      setPodData({ ...podData, podFile: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handlePostPOD = () => {
    if (!podData.receivedBy || !podData.podFile) return alert('Received By and File Mandatory');
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      status: 'CLOSED',
      podStatus: 'VERIFIED',
      receivedBy: podData.receivedBy.toUpperCase(),
      receivedDate: podData.receivedDate,
      podRemarks: podData.remarks.toUpperCase(),
      podUrl: podData.podFile,
      closedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setShowPODPortal(false);
    setPodData({ receivedBy: '', receivedDate: format(new Date(), 'yyyy-MM-dd'), remarks: '', podFile: null });
  };

  const handleGeneratePDF = () => {
    if (!selectedTrip?.cnNumber) return;
    const originalTitle = document.title;
    document.title = `${selectedTrip.cnNumber}.pdf`;
    window.print();
    document.title = originalTitle;
  };

  const getPartyData = React.useCallback((idOrCode: string) => {
    if (!customers || !idOrCode) return {};
    return customers.find(c => c.customerCode === idOrCode || c.id === idOrCode) || {};
  }, [customers]);

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden text-[#333]">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-300 px-8 py-3 shadow-sm flex justify-between items-center z-30 shrink-0">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD CONTROL</h2>
        <div className="flex gap-4 items-center">
           <div className="flex items-center gap-6 bg-[#f8fafc] border border-slate-200 p-1 px-4 shadow-inner">
             <div className="flex items-center gap-2">
               <Filter className="h-3.5 w-3.5 text-slate-400" />
               <select 
                 value={plantFilter} 
                 onChange={e => setPlantFilter(e.target.value)}
                 className="h-7 bg-transparent text-[10px] font-black uppercase outline-none focus:text-blue-600"
               >
                 <option value="ALL">All Plants</option>
                 {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
               </select>
             </div>
             <div className="w-[1px] h-4 bg-slate-300" />
             <div className="flex items-center gap-2">
               <Search className="h-3.5 w-3.5 text-slate-400" />
               <input 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="h-7 w-48 bg-transparent text-[10px] font-black uppercase outline-none focus:w-64 transition-all"
                 placeholder="SEARCH..."
               />
             </div>
           </div>
        </div>
      </div>

      <div className={cn("flex-1 flex flex-col p-8 transition-opacity duration-300", showPrintView ? "opacity-0 pointer-events-none" : "opacity-100")}>
        {/* Dynamic Tab Navigation */}
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button 
              key={t.label} 
              onClick={() => { setActiveTab(t.label); setCurrentPage(1); }} 
              className={cn(
                "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 shrink-0 flex items-center gap-2", 
                activeTab === t.label ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50"
              )}
            >
              {t.label} <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold", activeTab === t.label ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500")}>({t.count})</span>
            </button>
          ))}
        </div>

        {/* Grid Area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col bg-white border border-slate-300 shadow-inner green-scrollbar">
          <div className="min-w-[1550px] flex flex-col flex-1 overflow-y-auto green-scrollbar">
            {/* Header */}
            <div className="flex bg-[#f8fafc] border-b border-slate-300 text-[9px] font-black uppercase text-slate-500 sticky top-0 z-20">
               {activeTab === 'Open Orders' ? (
                 <>
                   <div className="p-3 w-[4%] border-r text-center">Plnt</div>
                   <div className="p-3 w-[10%] border-r">Sale Order</div>
                   <div className="p-3 w-[12%] border-r">Consignor</div>
                   <div className="p-3 w-[12%] border-r">Consignee</div>
                   <div className="p-3 w-[12%] border-r">Ship to Party</div>
                   <div className="p-3 w-[10%] border-r">Route</div>
                   <div className="p-3 w-[8%] border-r text-right">SO Qty</div>
                   <div className="p-3 w-[8%] border-r text-right">Disp Qty</div>
                   <div className="p-3 w-[8%] border-r text-right text-emerald-600">Balance Qty</div>
                   <div className="p-3 flex-1 text-center">Action</div>
                 </>
               ) : (
                 <>
                   <div className="p-3 w-[3%] border-r text-center">Plnt</div>
                   <div className="p-3 w-[8%] border-r">Sale Order</div>
                   <div className="p-3 w-[8%] border-r text-blue-700">Trip ID</div>
                   <div className="p-3 w-[12%] border-r">Consignor / Consignee</div>
                   <div className="p-3 w-[10%] border-r">Ship To Party</div>
                   <div className="p-3 w-[8%] border-r">Route</div>
                   <div className="p-3 w-[10%] border-r">Fleet / Vehicle</div>
                   <div className="p-3 w-[4%] border-r text-center">Qty</div>
                   <div className="p-3 w-[8%] border-r">Invoice / EWB</div>
                   <div className="p-3 w-[8%] border-r">Carrier/Vendor</div>
                   <div className="p-3 w-[8%] border-r">CN No</div>
                   <div className="p-3 flex-1 text-center">Action</div>
                 </>
               )}
            </div>

            {/* List Rows */}
            {filteredData.map((item: any) => {
              const liveNode = gpsLive.find(n => n.vehicleNumber === item.vehicleNo);
              const consignorData = getPartyData(item.consignorCode);
              const shipToData = getPartyData(item.shipToPartyCode);
              
              const origin = encodeURIComponent(consignorData.pincode || item.from || '');
              const destination = encodeURIComponent(shipToData.pincode || item.destination || '');
              const waypoints = liveNode ? `${liveNode.latitude},${liveNode.longitude}` : '';
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}`;

              return (
                <div key={item.id} className="flex flex-col border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
                  <div className="flex items-center text-[10px] font-bold uppercase min-h-[75px]">
                    {activeTab === 'Open Orders' ? (
                      <>
                        <div className="p-3 w-[4%] border-r text-center text-slate-400 font-black">{item.plantCode}</div>
                        <div className="p-3 w-[10%] border-r font-black text-blue-700">{item.orderNo}</div>
                        <div className="p-3 w-[12%] border-r truncate">{item.consignorName}</div>
                        <div className="p-3 w-[12%] border-r truncate">{item.consigneeName}</div>
                        <div className="p-3 w-[12%] border-r truncate font-black">{item.shipToParty}</div>
                        <div className="p-3 w-[10%] border-r italic text-slate-500 leading-tight">{item.from} → {item.destination}</div>
                        <div className="p-3 w-[8%] border-r text-right font-black">{item.quantity}</div>
                        <div className="p-3 w-[8%] border-r text-right font-black text-slate-400">{item.dispatched?.toFixed(3)}</div>
                        <div className="p-3 w-[8%] border-r text-right font-black text-emerald-600">{item.balance?.toFixed(3)}</div>
                        <div className="p-3 flex-1 flex justify-center">
                           <Button onClick={() => { setSelectedOrder(item); setAssignData({assignWeight: item.balance.toFixed(3), paymentTerms: 'TO PAY'}); setShowAssign(true); }} className="h-7 text-[9px] font-black uppercase bg-[#1e3a8a] text-white rounded-none px-6 shadow-sm hover:scale-105 transition-all">Assign</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 w-[3%] border-r text-center text-slate-400 font-black">{item.plantCode}</div>
                        <div className="p-3 w-[8%] border-r text-slate-700 font-bold">{item.orderNo}</div>
                        <div className="p-3 w-[8%] border-r font-black text-blue-700">{item.tripNo}</div>
                        <div className="p-3 w-[12%] border-r flex flex-col gap-0.5">
                           <span className="truncate">{item.consignorName}</span>
                           <span className="truncate text-slate-400 text-[8px] italic border-t border-slate-50 pt-0.5">TO: {item.consigneeName}</span>
                        </div>
                        <div className="p-3 w-[10%] border-r font-black text-slate-700 truncate">{item.shipToParty}</div>
                        <div className="p-3 w-[8%] border-r italic text-slate-500 text-[8px] leading-tight">{item.from} → {item.destination}</div>
                        
                        <div className="p-3 w-[10%] border-r flex flex-col gap-0.5 cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedTrip(item); setVehicleEdit({vehicleNo: item.vehicleNo, mobile: item.driverMobile}); setShowVehiclePortal(true); }}>
                           <span className="text-slate-400 text-[8px] font-black uppercase">{item.fleetType}</span>
                           <span className="font-black text-slate-800">{item.vehicleNo}</span>
                           <span className="text-[8px] font-bold text-slate-300">{item.driverMobile || '-'}</span>
                        </div>

                        <div className="p-3 w-[4%] border-r text-center font-black text-blue-600 text-[11px]">{item.assignWeight}</div>
                        <div className="p-3 w-[8%] border-r truncate text-slate-400 text-[8px] leading-tight">
                           INV: {item.invoiceDisplay}<br/>EWB: {item.ewaybillDisplay}
                        </div>

                        <div className="p-3 w-[8%] border-r flex flex-col gap-0.5">
                           <span className="text-[9px] font-black text-slate-800 truncate">{getCarrierForPlant(item.plantCode)}</span>
                           {item.transporterName && <span className="text-[8px] font-bold text-slate-400 italic truncate">{item.transporterName}</span>}
                           <span className="text-[7px] font-black text-slate-300 uppercase truncate">{item.arrangeBy || '-'}</span>
                        </div>

                        <div className="p-3 w-[8%] border-r">
                           <button onClick={() => { setSelectedTrip(item); if(item.cnNumber) { setShowPrintView(true); } else { setCnData({mode: 'Road', paymentTerms: item.paymentTerms || 'TO PAY'}); setCnItems([{invoiceNo: '', goodsDescription: item.materialName || '', weight: item.assignWeight, package: '', packageUom: 'Bag'}]); fetchPreviousCN(item.plantCode, item.vehicleNo); setShowCNPortal(true); } }} className="flex flex-col gap-0.5 hover:text-[#0056d2] transition-colors group w-full font-black text-left text-[10px]">
                              {item.cnNumber ? (
                                <>
                                  <div className="flex items-center gap-1 text-[#0056d2]">
                                    <Edit className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-[#0056d2]" />
                                    <span>{item.cnNumber}</span>
                                  </div>
                                  <span className="text-[8px] text-slate-300 font-bold pl-4">{item.cnDate ? format(new Date(item.cnDate), 'dd-MM-yyyy') : '-'}</span>
                                </>
                              ) : (
                                <div className="flex items-center gap-1 text-slate-300 italic">
                                  <Plus className="h-3 w-3" />
                                  <span className="text-[9px]">Entry</span>
                                </div>
                              )}
                           </button>
                        </div>
                        <div className="p-3 flex-1 flex flex-col gap-2 items-center justify-center">
                           {activeTab === 'Loading' && (
                             <div className="flex gap-2">
                                <Button onClick={() => { setSelectedTrip(item); setOutData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowOutPortal(true); }} className="h-7 text-[9px] font-black bg-[#1e3a8a] text-white rounded-none px-4">OUT</Button>
                                <Button onClick={() => { setSelectedTrip(item); setShowUnassignWarning(true); }} variant="outline" className="h-7 text-[9px] font-black text-red-500 border-red-100 rounded-none px-3">UNASSIGN</Button>
                             </div>
                           )}
                           {activeTab === 'In-Transit' && (
                             <Button onClick={() => handleArrival(item.id)} className="h-7 text-[10px] font-black bg-emerald-600 text-white rounded-none px-6">ARRIVED</Button>
                           )}
                           {activeTab === 'Arrived' && (
                             <div className="flex gap-2">
                                <Button onClick={() => handleUnload(item.id)} className="h-7 text-[10px] font-black bg-blue-600 text-white rounded-none px-6">UNLOAD</Button>
                                <Button onClick={() => handleReject(item.id)} variant="outline" className="h-7 text-[10px] font-black border-red-200 text-red-600 rounded-none px-4">REJECT</Button>
                             </div>
                           )}
                           {activeTab === 'POD Verify' && (
                             <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} className="h-7 text-[10px] font-black bg-purple-600 text-white rounded-none px-8">UPLOAD POD</Button>
                           )}
                           {activeTab === 'Reject' && (
                             <div className="flex gap-2">
                                <Button onClick={() => handleResent(item.id)} className="h-7 text-[10px] font-black bg-[#1e3a8a] text-white rounded-none px-6">RESENT</Button>
                                <Button onClick={() => handleSRN(item.id)} variant="outline" className="h-7 text-[10px] font-black border-slate-300 rounded-none px-6">SRN</Button>
                             </div>
                           )}
                           {activeTab === 'Closed' && (
                             <div className="flex gap-2">
                                <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} variant="outline" className="h-7 text-[9px] font-black border-slate-300 rounded-none px-4 text-slate-600 hover:text-blue-600">UPDATE POD</Button>
                                {item.podUrl && <Button onClick={() => window.open(item.podUrl, '_blank')} variant="ghost" className="h-7 text-blue-600 p-1"><Download className="h-4 w-4" /></Button>}
                             </div>
                           )}
                        </div>
                      </>
                    )}
                  </div>

                  {activeTab !== 'Open Orders' && (
                    <div className="flex bg-slate-50/70 border-t border-slate-200 h-9 items-center px-4">
                       <div className="w-[30%] flex items-center gap-4 text-[8px] font-black text-slate-400">
                          <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> CREATED: {item.createdAt ? format(new Date(item.createdAt), 'dd-MM HH:mm') : '-'}</span>
                          <span className="flex items-center gap-1"><RefreshCw className="h-2.5 w-2.5" /> Trip Date Time: {item.updatedAt ? format(new Date(item.updatedAt), 'dd-MM HH:mm') : '-'}</span>
                       </div>
                       <div className="flex-1 flex items-center justify-end gap-6">
                          <div className="flex items-center gap-2 group cursor-pointer overflow-hidden" onClick={() => window.open(mapsUrl, '_blank')}>
                             <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                             <span className="text-[9px] font-black text-[#0056d2] uppercase truncate group-hover:underline italic tracking-tight max-w-[400px]">
                                {liveNode?.lastLocation || 'SYNCHRONIZING...'}
                             </span>
                          </div>
                          <button onClick={() => { setSelectedTrip(item); setShowTrackPortal(true); }} className="flex items-center gap-1.5 h-6 bg-white border border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all text-[8px] font-black uppercase rounded-full px-3 shrink-0 shadow-sm">
                             <Radar className="h-2.5 w-2.5 text-blue-500" /> 
                             Track Mode
                          </button>
                       </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CN Copy Overlay */}
      {showPrintView && selectedTrip && (
        <div className="fixed inset-0 z-[100] bg-slate-100 flex flex-col overflow-hidden animate-fade-in">
           <div className="bg-white border-b border-slate-300 px-8 py-2 flex items-center justify-between shadow-sm shrink-0 z-10">
              <div className="flex flex-col">
                 <h3 className="text-xs font-black uppercase text-[#1e3a8a] italic tracking-tighter">Consignment Note Preview</h3>
                 <span className="text-[9px] font-bold text-slate-400">TRIP: {selectedTrip.tripNo} | CN: {selectedTrip.cnNumber}</span>
              </div>
              <div className="flex gap-4">
                 <Button onClick={handleGeneratePDF} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none text-[10px] font-black uppercase px-10 shadow-md">
                    <Printer className="h-4 w-4 mr-2" /> Generate PDF
                 </Button>
                 <Button onClick={() => setShowPrintView(false)} variant="outline" className="h-9 border-red-500 text-red-600 hover:bg-red-50 rounded-none text-[10px] font-black uppercase px-8">
                    <X className="h-4 w-4 mr-2" /> Close
                 </Button>
              </div>
           </div>
           <div className="flex-1 overflow-hidden">
              <CNPrintView trip={selectedTrip} />
           </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-[800px] max-h-[95vh] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col text-slate-900">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 shrink-0">
             <DialogTitle className="sr-only">Vehicle Assignment</DialogTitle>
             <div className="flex justify-between items-center text-[11px] font-black uppercase text-[#1e3a8a]">
                <div className="flex gap-4">
                   <span>ROUTE: {selectedOrder?.from} → {selectedOrder?.destination}</span>
                   <span className="text-slate-300">|</span>
                   <span>BALANCE: {selectedOrder?.balance?.toFixed(3)} MT</span>
                </div>
                <div className="text-slate-400 italic">SO: {selectedOrder?.orderNo}</div>
             </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number *</label><input autoFocus value={assignData.vehicleNo || ''} onChange={e => setAssignData({...assignData, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Driver Mobile</label><input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs outline-none focus:bg-yellow-50" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-[#0056d2] uppercase">Assign Qty (MT) *</label><input type="number" step="0.001" max={selectedOrder?.balance} value={assignData.assignWeight || ''} onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} className="h-9 w-full border border-blue-400 px-3 text-xs font-black outline-none focus:bg-blue-50 text-blue-700" /></div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Fleet Type Strategy</label>
                   <select value={assignData.fleetType || 'Own Vehicle'} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-[11px] font-bold">
                      <option value="Own Vehicle">Own Vehicle</option>
                      <option value="Contract Vehicle">Contract Vehicle</option>
                      <option value="Market Vehicle">Market Vehicle Strategy</option>
                   </select>
                </div>
             </div>
             {assignData.fleetType === 'Market Vehicle' && (
                <div className="space-y-6 bg-blue-50/30 p-6 border border-blue-100 animate-fade-in">
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-blue-600 uppercase italic underline underline-offset-2">Vendor Lookup</label>
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
                         <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase">Rate (Per MT)</label>
                            <div className="flex items-center gap-2 px-2 bg-slate-200/50">
                               <Checkbox 
                                 id="fix-rate" 
                                 checked={assignData.isFixRate} 
                                 onCheckedChange={(checked) => setAssignData({ ...assignData, isFixRate: !!checked })} 
                                 className="h-4 w-4 rounded-none border-slate-400" 
                               />
                               <label htmlFor="fix-rate" className="text-[8px] font-black text-slate-600 uppercase cursor-pointer">Fix Rate</label>
                            </div>
                         </div>
                         <input type="number" disabled={assignData.isFixRate} value={assignData.rate || ''} onChange={e => { const r = parseFloat(e.target.value) || 0; setAssignData({...assignData, rate: e.target.value, freight: (r * (parseFloat(assignData.assignWeight) || 0)).toFixed(2)}); }} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none disabled:bg-slate-100" />
                      </div>
                      <div className="space-y-1.5"><label className="text-[10px] font-black text-emerald-600 uppercase">Total Freight Amount</label><input type="number" value={assignData.freight || ''} onChange={e => setAssignData({...assignData, freight: e.target.value})} className="h-9 w-full border border-emerald-400 bg-emerald-50 px-3 text-xs font-black outline-none text-emerald-700" readOnly={!assignData.isFixRate} /></div>
                   </div>
                </div>
             )}
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 shrink-0">
             <div className="flex gap-4">
                <Button onClick={() => setShowAssign(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black border-slate-300 px-10">Exit &times;</Button>
                <Button onClick={handlePostAssignment} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-20 shadow-lg">Post</Button>
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPODPortal} onOpenChange={setShowPODPortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-purple-600 font-mono text-slate-900 shadow-2xl">
           <DialogHeader>
             <DialogTitle className="text-sm font-black uppercase italic text-purple-600">POD Upload Workflow</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-6 text-slate-800">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Received By *</label>
                 <input autoFocus value={podData.receivedBy} onChange={e => setPodData({...podData, receivedBy: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" />
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Received Date</label>
                 <input type="date" value={podData.receivedDate} onChange={e => setPodData({...podData, receivedDate: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs outline-none" />
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase flex justify-between">Upload Proof Document <span className="text-slate-300 italic">(PDF/IMG &lt; 2MB)</span></label>
                 <input type="file" id="pod-upload" className="hidden" accept="application/pdf,image/*" onChange={handleFileUpload} />
                 <div onClick={() => document.getElementById('pod-upload')?.click()} className={cn("h-32 w-full border-2 border-dashed flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 transition-all", podData.podFile ? "border-emerald-400 bg-emerald-50" : "border-slate-300")}>
                    {podData.podFile ? (
                      <div className="flex flex-col items-center text-emerald-700">
                         <CheckCircle className="h-6 w-6 mb-2" />
                         <span className="text-[9px] font-black uppercase">Synced &lt; 200KB</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                         <Upload className="h-6 w-6 mb-2" />
                         <span className="text-[9px] font-black uppercase">Click to Upload File</span>
                      </div>
                    )}
                 </div>
              </div>
           </div>
           <DialogFooter className="gap-2">
              <Button onClick={() => setShowPODPortal(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300 px-6">Exit</Button>
              <Button onClick={handlePostPOD} className="h-9 bg-purple-600 text-white rounded-none text-[10px] font-black uppercase px-10 shadow-lg">Post POD</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOutPortal} onOpenChange={setShowOutPortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-[#1e3a8a] font-mono text-slate-900">
           <DialogHeader>
             <DialogTitle className="text-sm font-black uppercase italic text-[#1e3a8a]">Gate-Out Dispatch</DialogTitle>
           </DialogHeader>
           <div className="py-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Date</label><input type="date" value={outData.date} onChange={e => setOutData({...outData, date: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[11px]" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Time</label><input type="time" value={outData.time} onChange={e => setOutData({...outData, time: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[11px]" /></div>
              </div>
           </div>
           <DialogFooter className="gap-2"><Button onClick={() => setShowOutPortal(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300 px-6">Cancel</Button><Button onClick={handleGateOut} className="h-9 bg-[#1e3a8a] text-white rounded-none text-[10px] font-black uppercase px-10 shadow-lg">Post Exit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUnassignWarning} onOpenChange={setShowUnassignWarning}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-red-600 font-mono text-slate-900">
           <DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2 font-black uppercase italic"><AlertTriangle className="h-5 w-5" /> REVERSAL WARNING</DialogTitle></DialogHeader>
           <div className="py-6 space-y-4"><p className="text-xs font-bold text-slate-700 leading-relaxed uppercase">Are you sure you want to unassign Vehicle <span className="font-black text-red-600">{selectedTrip?.vehicleNo}</span>?</p></div>
           <DialogFooter className="gap-2"><Button onClick={handleUnassign} className="bg-red-600 text-white h-9 rounded-none text-[10px] font-black uppercase px-8 shadow-md">Confirm Reversal</Button><Button onClick={() => setShowUnassignWarning(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300 px-8">Exit &times;</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVehiclePortal} onOpenChange={setShowVehiclePortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-[#1e3a8a] font-mono text-slate-900"><DialogHeader><DialogTitle className="text-sm font-black uppercase italic text-[#1e3a8a]">Vehicle Update</DialogTitle></DialogHeader><div className="py-6 space-y-6"><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number</label><input value={vehicleEdit.vehicleNo} onChange={e => setVehicleEdit({...vehicleEdit, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" /></div><div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Driver Mobile</label><input value={vehicleEdit.mobile} onChange={e => setVehicleEdit({...vehicleEdit, mobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs outline-none" /></div></div><DialogFooter className="gap-2"><Button onClick={() => setShowVehiclePortal(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300 px-6">Cancel</Button><Button onClick={handleUpdateVehicle} className="h-9 bg-[#1e3a8a] text-white rounded-none text-[10px] font-black uppercase px-10">Update</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-[950px] max-h-[95vh] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col text-slate-900">
           <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 shrink-0"><DialogTitle className="text-sm font-black uppercase text-[#0056d2]">CN Assignment</DialogTitle></DialogHeader>
           <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-8">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase italic">Previous CN</label><input readOnly value={previousCN} className="h-9 w-full border border-slate-200 bg-slate-50 px-3 text-[11px] font-black outline-none" /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-[#0056d2] uppercase">CN Number *</label><input autoFocus value={cnData.cnNo || ''} onChange={e => setCnData({...cnData, cnNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">CN Date</label><input type="date" value={cnData.cnDate || format(new Date(), 'yyyy-MM-dd')} onChange={e => setCnData({...cnData, cnDate: e.target.value})} className="h-9 w-full border border-slate-400 px-3 outline-none" /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Payment Terms</label><select value={cnData.paymentTerms} onChange={e => setCnData({...cnData, paymentTerms: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-[11px] font-bold"><option value="PAID">PAID</option><option value="TO PAY">TO PAY</option><option value="FOC">FOC</option></select></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">Transport Mode</label><select value={cnData.mode} onChange={e => setCnData({...cnData, mode: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-[11px] font-black"><option value="Road">Road</option><option value="Road from Rail">Road from Rail</option></select></div>
              </div>
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase text-slate-500 border-b-2 border-slate-100 pb-3 flex justify-between items-center"><span>Invoice Matrix</span><Button onClick={() => setCnItems([...cnItems, {invoiceNo: '', goodsDescription: selectedTrip?.materialName || '', weight: '', package: '', packageUom: 'Bag'}])} variant="ghost" size="sm" className="h-7 text-[9px] font-black text-[#0056d2] border border-blue-100 px-4 hover:bg-blue-50 transition-all"><Plus className="h-3 w-3 mr-1" /> Add</Button></h4>
                 <div className="border border-slate-200 overflow-hidden shadow-sm"><table className="w-full text-[10px]"><thead className="bg-[#f8fafc] border-b border-slate-200 font-black uppercase text-slate-400"><tr><th className="p-3 border-r text-left w-36">Invoice No</th><th className="p-3 border-r text-left">Description</th><th className="p-3 border-r text-center w-20">PKG</th><th className="p-3 border-r text-center w-24">UOM</th><th className="p-3 text-right w-24">Weight</th></tr></thead><tbody className="divide-y divide-slate-100">{cnItems.map((it, idx) => (<tr key={idx} className="bg-white hover:bg-blue-50/50 transition-colors"><td className="border-r"><input value={it.invoiceNo} onChange={e => { const n = [...cnItems]; n[idx].invoiceNo = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-9 px-3 outline-none text-[11px] font-bold" /></td><td className="border-r"><input value={it.goodsDescription} onChange={e => { const n = [...cnItems]; n[idx].goodsDescription = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-9 px-3 outline-none text-[11px]" /></td><td className="border-r text-center"><input type="number" value={it.package} onChange={e => { const n = [...cnItems]; n[idx].package = e.target.value; setCnItems(n); }} className="w-full h-9 text-center outline-none" /></td><td className="border-r"><select value={it.packageUom} onChange={e => { const n = [...cnItems]; n[idx].packageUom = e.target.value; setCnItems(n); }} className="w-full h-9 bg-transparent px-2 font-black uppercase text-[9px] outline-none"><option value="Bag">Bag</option><option value="Box">Box</option></select></td><td className="text-right"><input type="number" step="0.001" value={it.weight} onChange={e => { const n = [...cnItems]; n[idx].weight = e.target.value; setCnItems(n); }} className="w-full h-9 text-right px-3 outline-none font-black text-blue-600" /></td></tr>))}</tbody></table></div>
              </div>
           </div>
           <DialogFooter className="bg-slate-50 p-6 border-t-2 border-slate-200 flex justify-between items-center shrink-0"><div className="text-[10px] font-black uppercase text-[#1e3a8a]">Total: {cnItems.reduce((acc, it) => acc + (parseFloat(it.weight) || 0), 0).toFixed(3)} MT</div><div className="flex gap-4"><Button onClick={() => setShowCNPortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black border-slate-300 px-8">Cancel</Button><Button onClick={handlePostCN} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-16 shadow-lg">Post</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTrackPortal} onOpenChange={setShowTrackPortal}>
        <DialogContent className="max-w-[700px] rounded-none border-[3px] border-[#0056d2] font-mono text-slate-900 p-0 overflow-hidden">
           <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
             <DialogTitle className="text-sm font-black uppercase italic text-[#0056d2] flex justify-between items-center">
               <span>Tracking Mapping</span>
               <Badge className="bg-emerald-600 rounded-none font-black text-[9px] px-3 uppercase">{selectedTrip?.status}</Badge>
             </DialogTitle>
           </DialogHeader>
           <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-[11px] font-black uppercase bg-white border border-slate-100 p-6 shadow-inner">
                 <div className="flex justify-between border-b pb-1.5"><span className="text-slate-400">Vehicle No:</span><span className="text-[#1e3a8a]">{selectedTrip?.vehicleNo}</span></div>
                 <div className="flex justify-between border-b pb-1.5"><span className="text-slate-400">Driver:</span><span className="text-slate-700">{selectedTrip?.driverMobile || '-'}</span></div>
                 <div className="flex justify-between border-b pb-1.5 col-span-2"><span className="text-slate-400">Ship To:</span><span className="text-[#1e3a8a] truncate pl-4">{selectedTrip?.shipToParty}</span></div>
                 <div className="flex justify-between border-b pb-1.5 col-span-2"><span className="text-slate-400">Route:</span><span className="text-emerald-700 italic">{selectedTrip?.from} → {selectedTrip?.destination}</span></div>
              </div>
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-sm">
                 <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Live Sync Location</span>
                       <p className="text-sm font-black text-slate-800 leading-relaxed uppercase italic">
                          {gpsLive?.find(n => n.vehicleNumber === selectedTrip?.vehicleNo)?.lastLocation || 'RESOLVING ADDRESS...'}
                       </p>
                    </div>
                 </div>
              </div>
              <div className="relative flex justify-between px-4">
                 {['Booked', 'Loading', 'Transit', 'Arrived', 'Delivered'].map((step, i) => {
                    const statuses = ['LOADING', 'LOADING', 'IN-TRANSIT', 'ARRIVED', 'CLOSED'];
                    const currentIdx = statuses.indexOf(selectedTrip?.status);
                    const isActive = i <= currentIdx;
                    return (
                      <div key={step} className="flex flex-col items-center gap-3 relative z-10">
                        <div className={cn("w-10 h-10 border-2 flex items-center justify-center transition-all duration-700", isActive ? "bg-blue-50 text-blue-600 border-blue-300" : "bg-white text-slate-100 border-slate-100")}>
                          {i === 0 && <ShoppingCart className="h-4 w-4" />}
                          {i === 1 && <Package className="h-4 w-4" />}
                          {i === 2 && <Truck className="h-4 w-4" />}
                          {i === 3 && <MapPin className="h-4 w-4" />}
                          {i === 4 && <CheckCircle className="h-4 w-4" />}
                        </div>
                        <span className={cn("text-[8px] font-black uppercase tracking-widest", isActive ? "text-blue-600" : "text-slate-300")}>{step}</span>
                      </div>
                    );
                 })}
                 <div className="absolute top-5 left-[10%] right-[10%] h-[1.5px] bg-slate-100 -z-0" />
              </div>
           </div>
           <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200"><Button onClick={() => setShowTrackPortal(false)} className="h-10 bg-[#0056d2] text-white rounded-none text-[11px] font-black uppercase px-20">Exit Tracking</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CNPrintView = ({ trip }: { trip: any }) => {
  const db = useFirestore();
  
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  
  const { data: customers } = useCollection(customersQuery);
  const { data: companies } = useCollection(companiesQuery);
  
  const getPartyData = React.useCallback((idOrCode: string) => {
    if (!customers || !idOrCode) return {};
    const found = customers.find(c => c.customerCode === idOrCode || c.id === idOrCode);
    return found || {};
  }, [customers]);

  const getCompanyData = React.useCallback((plantCode: string) => {
    if (!companies || !plantCode) return {};
    const found = companies.find(c => c.linkedPlantCode === plantCode || (Array.isArray(c.plantCodes) && c.plantCodes.includes(plantCode)));
    return found || {};
  }, [companies]);

  const consignor = getPartyData(trip.consignorCode);
  const consignee = getPartyData(trip.consigneeCode);
  const shipTo = getPartyData(trip.shipToPartyCode);
  const carrier = getCompanyData(trip.plantCode);
  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');
  
  const totalPkg = (trip.items || []).reduce((acc: number, it: any) => acc + (parseInt(it.package) || 0), 0);
  const totalWgt = (trip.items || []).reduce((acc: number, it: any) => acc + (parseFloat(it.weight || 0)), 0);

  const formattedDate = trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : format(new Date(), 'dd-MMM-yyyy');

  const CopyPage = ({ label }: { label: string }) => (
    <div className="cn-print-page p-6 font-normal uppercase border border-black mb-8 bg-white relative text-black" style={{ fontFamily: 'Calibri, sans-serif' }}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-4 items-start">
          <div className="relative w-16 h-16 shrink-0">
            {carrier.logoUrl ? (
              <img src={carrier.logoUrl} alt="Logo" className="object-contain w-full h-full" />
            ) : logoAsset && (
              <Image src={logoAsset.url} alt="Logo" fill className="object-contain" unoptimized />
            )}
          </div>
          <div className="flex flex-col">
            <h1 className="text-[27px] leading-none mb-1 font-normal text-blue-900 uppercase tracking-tighter">{carrier.companyName || 'SIKKA INDUSTRIES AND LOGISTICS'}</h1>
            <p className="text-[7px] max-w-[420px] leading-tight mb-2 font-normal uppercase">{carrier.address || 'INDUSTRIAL AREA, GHAZIABAD'}</p>
            <div className="flex flex-col gap-0 text-[10px] font-normal uppercase">
              <div className="flex items-center gap-1.5">
                 <div className="flex gap-1"><span>GSTIN:</span><span>{carrier.gstNo || '-'}</span></div>
                 <div className="flex gap-1 border-l border-slate-300 pl-1.5"><span>PAN:</span><span>{carrier.panNo || '-'}</span></div>
              </div>
              <div className="flex gap-1"><span>MOBILE:</span><span>{carrier.mobile || '-'}</span></div>
              <div className="flex gap-1"><span>EMAIL:</span><span className="lowercase">{carrier.email?.toLowerCase() || '-'}</span></div>
              <div className="flex gap-1"><span>WEBSITE:</span><span className="lowercase">{carrier.website?.toLowerCase() || '-'}</span></div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className={cn(
            "border border-black px-3 py-0.5 text-[16px] mb-1 font-normal tracking-wider",
            label === 'CONSIGNEE COPY' ? "bg-white text-black" : "bg-black text-white"
          )}>{label}</div>
          <div className="text-right space-y-0 font-normal uppercase">
            <div className="flex justify-end items-center gap-1.5 text-[16px] tracking-tighter font-normal leading-tight"><span>DATE:</span><span>{formattedDate}</span></div>
            <div className="flex justify-end gap-1.5 text-[17.5px] tracking-tighter font-normal leading-tight"><span>CN:</span><span>{trip.cnNumber || 'DRAFT'}</span></div>
            <div className="flex justify-end gap-1.5 text-[16px] font-normal text-emerald-800 leading-tight"><span>FROM:</span><span>{consignor.city || trip.from}</span></div>
            <div className="flex justify-end gap-1.5 text-[16px] font-normal text-blue-800 leading-tight"><span>TO:</span><span>{shipTo.city || trip.destination}</span></div>
          </div>
        </div>
      </div>

      <div className="border-t border-black mb-3" />

      <table className="w-full border-collapse border border-black mb-3 font-normal text-[10px]">
        <thead>
          <tr className="bg-slate-50 border-b border-black text-center font-normal">
            <th className="p-2 border-r border-black font-normal uppercase">VEHICLE NUMBER</th>
            <th className="p-2 border-r border-black font-normal uppercase">DRIVER MOBILE</th>
            <th className="p-2 border-r border-black font-normal uppercase">PAYMENT TERM</th>
            <th className="p-2 font-normal uppercase">TRIP ID</th>
          </tr>
        </thead>
        <tbody className="text-center text-[11px]">
          <tr className="font-normal">
            <td className="p-2 border-r border-black font-normal">{trip.vehicleNo}</td>
            <td className="p-2 border-r border-black font-normal">{trip.driverMobile}</td>
            <td className="p-2 border-r border-black font-normal">{trip.paymentTerms || 'PAID'}</td>
            <td className="p-2 font-normal">{trip.tripNo}</td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-3 border border-black mb-3 font-normal min-h-[130px]">
        {[
          { title: 'CONSIGNOR', data: consignor, fallback: trip.consignorName, code: trip.consignorCode },
          { title: 'CONSIGNEE', data: consignee, fallback: trip.consigneeName, code: trip.consigneeCode },
          { title: 'SHIP TO PARTY', data: shipTo, fallback: trip.shipToParty, code: trip.shipToPartyCode }
        ].map((node, i) => (
          <div key={i} className={cn("p-2 flex flex-col font-normal uppercase", i < 2 && "border-r border-black")}>
            <h4 className="border-b border-black mb-1 pb-0.5 text-[14px] font-normal tracking-tight flex justify-between items-end">
               <span>{node.title}</span>
               <span className="text-[8px] font-bold opacity-50">{node.data.customerCode || node.code || '-'}</span>
            </h4>
            <p className="text-[8.5px] leading-tight mb-0.5 font-normal">{node.data.customerName || node.fallback || '-'}</p>
            <p className="text-[14px] leading-snug flex-1 italic mb-1 font-normal">{node.data.address || '-'}</p>
            <div className="mt-auto space-y-0.5 text-[10px] font-normal">
              <div className="flex gap-1"><span>MOBILE:</span><span>{node.data.mobile || '-'}</span></div>
              <div className="flex gap-1 pt-0.5 border-t border-slate-100"><span>GSTIN:</span><span>{node.data.gstNo || node.data.gstin || '-'}</span></div>
            </div>
          </div>
        ))}
      </div>

      <table className="w-full border-collapse border border-black mb-3 font-normal text-[9px]">
        <thead>
          <tr className="bg-slate-50 border-b border-black font-normal">
            <th className="p-2 border-r border-black text-left font-normal uppercase w-32">INVOICE NO</th>
            <th className="p-2 border-r border-black text-left font-normal uppercase w-32">E-WAYBILL NO</th>
            <th className="p-2 border-r border-black text-left font-normal uppercase">DESCRIPTION OF GOODS</th>
            <th className="p-2 border-r border-black text-center w-20 font-normal uppercase">PKG</th>
            <th className="p-2 text-right w-24 font-normal uppercase">WEIGHT (MT)</th>
          </tr>
        </thead>
        <tbody className="text-[10px] font-normal uppercase">
          {(trip.items?.length ? trip.items : [{invoiceNo: '-', ewaybillNo: '-', goodsDescription: trip.materialName || '-', package: '-', packageUom: '-', weight: trip.assignWeight || '0.000'}]).map((it: any, i: number) => (
            <tr key={i} className="border-b border-black last:border-b-0 font-normal">
              <td className="p-2 border-r border-black font-normal">{it.invoiceNo}</td>
              <td className="p-2 border-r border-black font-normal">{it.ewaybillNo || '-'}</td>
              <td className="p-2 border-r border-black italic break-words font-normal text-right">{it.goodsDescription}</td>
              <td className="p-2 border-r border-black text-center font-normal">{it.package} {it.packageUom || ''}</td>
              <td className="p-2 text-right font-normal">{parseFloat(it.weight || 0).toFixed(3)}</td>
            </tr>
          ))}
          <tr className="h-4 border-b border-black"><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td></tr>
          <tr className="h-4 border-b border-black"><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td></tr>
          <tr className="h-4 border-b border-black"><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td></tr>
          <tr className="h-4"><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td></tr>
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 text-[10px] border-t border-black font-normal uppercase">
            <td colSpan={3} className="p-2 border-r border-black text-right font-normal">TOTAL CONSIGNMENT</td>
            <td className="p-2 border-r border-black text-center font-normal">{totalPkg} PKG</td>
            <td className="p-2 text-right font-normal">{(totalWgt || parseFloat(trip.assignWeight || 0)).toFixed(3)} MT</td>
          </tr>
        </tfoot>
      </table>

      <div className="h-10 w-full border border-black border-t-0 mb-3 bg-slate-50/10" />

      <div className="flex justify-between items-end mt-4 font-normal uppercase">
        <div className="w-2/3 font-normal">
          <h6 className="text-[11px] mb-1 underline font-normal">TERMS & CONDITIONS:</h6>
          <p className="text-[11px] leading-relaxed italic text-justify pr-10 font-normal">
            1. THE CARRIER IS RESPONSIBLE FOR SAFE DELIVERY IN ORIGINAL CONDITION.<br/>
            2. CONSIGNOR MUST ENSURE CORRECT MATERIAL COUNT BEFORE SEALING.<br/>
            3. RATES ARE BASED ON {trip.fleetType || 'AGREED'} STRATEGY.
          </p>
        </div>
        <div className="flex flex-col items-center gap-1.5 w-56 font-normal">
          <div className="border-b border-black w-full h-8" />
          <span className="text-[12px] font-normal tracking-wide">AUTHORIZED SIGNATORY</span>
        </div>
      </div>

      <div className="mt-6 text-center w-full">
         <p className="text-[8px] font-normal text-slate-500">Note: This consignment copy was generated digitally and is to be considered as original</p>
      </div>
    </div>
  );

  return (
    <div id="printable-area" className="bg-slate-200 p-6 overflow-y-auto h-full green-scrollbar print:p-0">
      <div className="max-w-[800px] mx-auto print:max-w-none">
        <CopyPage label="CONSIGNEE COPY" />
        <div className="print:page-break-after-always" />
        <CopyPage label="DRIVER COPY" />
        <div className="print:page-break-after-always" />
        <CopyPage label="CONSIGNOR COPY" />
      </div>
    </div>
  );
};
