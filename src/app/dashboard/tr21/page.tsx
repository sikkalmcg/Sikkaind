'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ChevronLeft, ChevronRight, X, Download, 
  Plus, Trash, Edit3, Radar, Truck, MapPin, Package, ShoppingCart, CheckCircle, RefreshCw, Loader2,
  Calendar, CheckSquare, AlertTriangle, Edit, Upload, FileText, Search, Filter, Check, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
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
  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: vendors } = useCollection(vendorsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: companies } = useCollection(companiesQuery);
  const { data: plants } = useCollection(plantsQuery);

  const getPartyData = React.useCallback((idOrCode: string) => {
    if (!customers || !idOrCode) return {};
    return customers.find(c => c.customerCode === idOrCode || c.id === idOrCode) || {};
  }, [customers]);

  const getCompanyData = React.useCallback((plantCode: string) => {
    if (!companies || !plantCode) return {};
    return companies.find(c => c.linkedPlantCode === plantCode || (Array.isArray(c.plantCodes) && c.plantCodes.includes(plantCode))) || {};
  }, [companies]);

  // Tab Calculation Logic
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
      status: 'LOADING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
      arrivalStatus: 'ARRIVED',
      arrivalDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  const handleReject = (tripId: string) => {
    if (!confirm('REJECT WARNING: Move trip to Reject Registry?')) return;
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), { 
      status: 'REJECTION',
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
    reader.onloadend = () => setPodData({ ...podData, podFile: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handlePostPOD = () => {
    if (!podData.receivedBy || !podData.podFile) return alert('Received By and File Registry Mandatory');
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

  const CNPrintView = ({ trip }: { trip: any }) => {
    const consignor = getPartyData(trip.consignorCode);
    const consignee = getPartyData(trip.consigneeCode);
    const shipTo = getPartyData(trip.shipToPartyCode);
    const carrier = getCompanyData(trip.plantCode);
    const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');
    const totalPkg = (trip.items || []).reduce((acc: number, it: any) => acc + (parseInt(it.package) || 0), 0);
    const totalWgt = (trip.items || []).reduce((acc: number, it: any) => acc + (parseFloat(it.weight) || 0), 0);

    const CopyPage = ({ label }: { label: string }) => (
      <div className="cn-print-page p-6 font-normal uppercase border border-black mb-8 bg-white relative text-black">
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-4 items-start">
            <div className="relative w-16 h-16">
              {carrier.logoUrl ? (
                <img src={carrier.logoUrl} alt="Logo" className="object-contain w-full h-full" />
              ) : logoAsset && (
                <Image src={logoAsset.url} alt="Logo" fill className="object-contain" unoptimized />
              )}
            </div>
            <div className="flex flex-col">
              <h1 className="text-[24px] leading-none mb-1 font-normal text-blue-900">{carrier.companyName || 'SIKKA INDUSTRIES AND LOGISTICS'}</h1>
              <p className="text-[15px] max-w-[420px] leading-tight mb-2 font-normal">{carrier.address || 'INDUSTRIAL AREA, GHAZIABAD'}</p>
              <div className="flex gap-20 text-[14px]">
                <div className="flex flex-col gap-0.5">
                   <div className="flex gap-1 font-normal uppercase"><span>GSTIN:</span>{carrier.gstNo || '-'}</div>
                   <div className="flex gap-1 font-normal uppercase"><span>MOBILE:</span>{carrier.mobile || '-'}</div>
                   <div className="flex gap-1 font-normal uppercase"><span>EMAIL:</span>{carrier.email || '-'}</div>
                   <div className="flex gap-1 font-normal uppercase"><span>WEBSITE:</span>{carrier.website || '-'}</div>
                </div>
                <div className="flex flex-col gap-0.5">
                   <div className="flex gap-1 font-normal uppercase"><span>PAN:</span>{carrier.panNo || '-'}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="border border-black bg-black text-white px-2 py-0.5 text-[14px] mb-3 font-normal">{label}</div>
            <div className="text-right space-y-1 font-normal">
              <div className="text-[21px] tracking-tighter font-normal uppercase">CN: {trip.cnNumber || 'DRAFT'}</div>
              <div className="flex justify-end gap-2 text-[20px] font-normal uppercase"><span>DATE:</span><span>{trip.cnDate || format(new Date(), 'yyyy-MM-dd')}</span></div>
              <div className="flex justify-end gap-2 text-[20px] font-normal mt-1 text-emerald-800 uppercase"><span>FROM:</span><span>{consignor.city || trip.from}</span></div>
              <div className="flex justify-end gap-2 text-[20px] font-normal text-blue-800 uppercase"><span>TO:</span><span>{shipTo.city || trip.destination}</span></div>
            </div>
          </div>
        </div>

        <div className="border-t border-black mb-3" />

        <table className="w-full border-collapse border border-black mb-3 font-normal">
          <thead>
            <tr className="bg-slate-50 border-b border-black text-[15px] text-center">
              <th className="p-1.5 border-r border-black font-normal uppercase">VEHICLE NUMBER</th>
              <th className="p-1.5 border-r border-black font-normal uppercase">DRIVER MOBILE</th>
              <th className="p-1.5 border-r border-black font-normal uppercase">PAYMENT TERM</th>
              <th className="p-1.5 font-normal uppercase">TRIP ID</th>
            </tr>
          </thead>
          <tbody className="text-center text-[16px]">
            <tr className="font-normal">
              <td className="p-2 border-r border-black font-normal">{trip.vehicleNo}</td>
              <td className="p-2 border-r border-black font-normal">{trip.driverMobile}</td>
              <td className="p-2 border-r border-black font-normal">{trip.paymentTerms || 'PAID'}</td>
              <td className="p-2 font-normal">{trip.tripNo}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-3 border border-black mb-3 font-normal min-h-[140px]">
          {[
            { title: 'CONSIGNOR', data: consignor, fallback: trip.consignorName },
            { title: 'CONSIGNEE', data: consignee, fallback: trip.consigneeName },
            { title: 'SHIP TO PARTY', data: shipTo, fallback: trip.shipToParty }
          ].map((node, i) => (
            <div key={i} className={cn("p-2 flex flex-col font-normal", i < 2 && "border-r border-black")}>
              <h4 className="border-b border-black mb-1.5 pb-1 text-[15px] font-normal uppercase">{node.title}</h4>
              <p className="text-[17px] leading-tight mb-1 font-normal">{node.data.customerName || node.fallback || '-'}</p>
              <p className="text-[15px] leading-snug flex-1 italic mb-2 font-normal">{node.data.address || '-'}</p>
              <div className="mt-auto space-y-0.5 text-[14px] font-normal">
                <div className="flex gap-1 font-normal uppercase"><span>MOBILE:</span>{node.data.mobile || '-'}</div>
                <div className="flex gap-1 pt-1 border-t border-slate-100 font-normal uppercase"><span>GSTIN:</span>{node.data.gstNo || '-'}</div>
              </div>
            </div>
          ))}
        </div>

        <table className="w-full border-collapse border border-black mb-3 font-normal">
          <thead>
            <tr className="bg-slate-50 border-b border-black text-[15px]">
              <th className="p-1.5 border-r border-black text-left font-normal uppercase">INVOICE NO</th>
              <th className="p-1.5 border-r border-black text-left font-normal uppercase">E-WAYBILL NO</th>
              <th className="p-1.5 border-r border-black text-left font-normal uppercase">DESCRIPTION OF GOODS</th>
              <th className="p-1.5 border-r border-black text-center w-24 font-normal uppercase">PKG</th>
              <th className="p-1.5 text-right w-28 font-normal uppercase">WEIGHT (MT)</th>
            </tr>
          </thead>
          <tbody className="text-[16px] font-normal">
            {(trip.items?.length ? trip.items : [{invoiceNo: '-', ewaybillNo: '-', goodsDescription: trip.materialName || '-', package: '-', packageUom: '-', weight: trip.assignWeight || '0.000'}]).map((it: any, i: number) => (
              <tr key={i} className="border-b border-black last:border-b-0 font-normal">
                <td className="p-1.5 border-r border-black font-normal">{it.invoiceNo}</td>
                <td className="p-1.5 border-r border-black font-normal">{it.ewaybillNo}</td>
                <td className="p-1.5 border-r border-black italic break-words font-normal">{it.goodsDescription}</td>
                <td className="p-1.5 border-r border-black text-center font-normal">{it.package} {it.packageUom || ''}</td>
                <td className="p-1.5 text-right font-normal">{parseFloat(it.weight || 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 text-[17px] border-t border-black font-normal">
              <td colSpan={3} className="p-1.5 border-r border-black text-right font-normal uppercase">TOTAL CONSIGNMENT REGISTRY</td>
              <td className="p-1.5 border-r border-black text-center font-normal uppercase">{totalPkg} PKG</td>
              <td className="p-1.5 text-right font-normal">{(totalWgt || parseFloat(trip.assignWeight || 0)).toFixed(3)} MT</td>
            </tr>
          </tfoot>
        </table>

        <div className="flex justify-between items-end mt-5 font-normal">
          <div className="w-2/3 font-normal">
            <h6 className="text-[15px] mb-1 underline font-normal uppercase">TERMS & CONDITIONS:</h6>
            <p className="text-[14px] leading-relaxed italic text-justify pr-10 font-normal uppercase">
              1. The carrier is responsible for safe delivery in original condition.<br/>
              2. Consignor must ensure correct material count before sealing.<br/>
              3. Rates are based on {trip.fleetType || 'Agreed Node'} strategy.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5 w-52 font-normal">
            <div className="border-b border-black w-full h-10" />
            <span className="text-[15px] font-normal uppercase">AUTHORIZED SIGNATORY</span>
          </div>
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

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-300 px-8 py-3 shadow-sm flex justify-between items-center z-30 shrink-0">
        <h2 className="text-[16px] font-black text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD CONTROL HUB</h2>
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
                 placeholder="SEARCH REGISTRY..."
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

        {/* High-Density Grid Registry */}
        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner green-scrollbar p-1">
          <div className="flex flex-col gap-0.5">
            {/* Legend Header */}
            <div className="flex bg-[#f8fafc] border-b border-slate-200 text-[9px] font-black uppercase text-slate-500 sticky top-0 z-20">
               <div className="p-3 w-[20%] border-r">Ship to Party</div>
               <div className="p-3 w-[12%] border-r">Route</div>
               <div className="p-3 w-[15%] border-r">Vehicle Detail</div>
               <div className="p-3 w-[10%] border-r text-center">Assign Qty</div>
               <div className="p-3 w-[15%] border-r">Invoice/E-waybill</div>
               <div className="p-3 w-[13%] border-r">CN No</div>
               <div className="p-3 flex-1 text-center">Action Hub</div>
            </div>

            {/* List Rows */}
            {filteredData.map((item: any) => {
              const liveNode = gpsLive.find(n => n.vehicleNumber === item.vehicleNo);
              const consignorData = getPartyData(item.consignorCode);
              const shipToData = getPartyData(item.shipToPartyCode);
              
              // Correct Origin/Destination for Route Handshake
              const origin = encodeURIComponent(consignorData.pincode || item.from || '');
              const destination = encodeURIComponent(shipToData.pincode || item.destination || '');
              const waypoints = liveNode ? `${liveNode.latitude},${liveNode.longitude}` : '';
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}`;

              return (
                <div key={item.id} className="flex flex-col border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
                  {/* Top Data Row */}
                  <div className="flex items-center text-[10px] font-bold uppercase min-h-[75px]">
                    <div className="p-3 w-[20%] border-r font-black text-slate-700 leading-tight">
                      {item.shipToParty || '-'}
                    </div>
                    <div className="p-3 w-[12%] border-r text-[9px] italic text-slate-500 space-y-0.5">
                      <div className="truncate">{item.from}</div>
                      <div className="truncate text-blue-400">&bull; {item.destination}</div>
                    </div>
                    <div className="p-3 w-[15%] border-r font-black text-slate-800 hover:bg-slate-50 cursor-pointer group" onClick={() => { setSelectedTrip(item); setVehicleEdit({vehicleNo: item.vehicleNo, mobile: item.driverMobile}); setShowVehiclePortal(true); }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{item.vehicleDetail}</span>
                        <Edit3 className="h-3 w-3 text-slate-300 shrink-0 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                    <div className="p-3 w-[10%] border-r text-center font-black text-slate-800 text-[11px]">
                      {item.assignWeight}
                    </div>
                    <div className="p-3 w-[15%] border-r">
                       <div className="flex flex-col gap-0.5">
                          <div className="truncate"><span className="text-[8px] text-slate-300 font-black">INV:</span> <span className="text-slate-400 font-bold">{item.invoiceDisplay}</span></div>
                          <div className="truncate"><span className="text-[8px] text-slate-300 font-black">EWB:</span> <span className="text-slate-400 font-bold">{item.ewaybillDisplay}</span></div>
                       </div>
                    </div>
                    <div className="p-3 w-[13%] border-r">
                       <button onClick={() => { setSelectedTrip(item); if(item.cnNumber) { setShowPrintView(true); } else { setCnData({mode: 'Road', paymentTerms: item.paymentTerms || 'TO PAY'}); setCnItems([{invoiceNo: '', goodsDescription: item.materialName || '', weight: item.assignWeight, package: '', packageUom: 'Bag'}]); fetchPreviousCN(item.plantCode, item.vehicleNo); setShowCNPortal(true); } }} className="flex flex-col gap-1 hover:text-[#0056d2] transition-colors group w-full font-black text-left text-[10px]">
                          {item.cnNumber ? (
                            <>
                              <div className="flex items-center gap-1.5 text-[#0056d2]">
                                <Printer className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-[#0056d2]" />
                                <span className="truncate">{item.cnNumber}</span>
                              </div>
                              <span className="text-[8px] text-slate-300 font-bold pl-4.5">{item.cnDate ? format(new Date(item.cnDate), 'dd-MM-yyyy') : '-'}</span>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Plus className="h-3 w-3 shrink-0 text-slate-300" />
                              <span className="text-[9px] text-slate-400 font-bold uppercase">REGISTRY</span>
                            </div>
                          )}
                       </button>
                    </div>
                    <div className="p-3 flex-1 flex flex-col gap-2 items-end">
                       <div className="flex gap-4 items-center">
                          {activeTab === 'Open Orders' ? (
                            <Button onClick={() => { setSelectedOrder(item); setAssignData({assignWeight: item.balance.toFixed(3), paymentTerms: 'TO PAY'}); setShowAssign(true); }} className="h-8 text-[10px] font-black uppercase bg-[#1e3a8a] text-white rounded-none px-8 shadow-sm">Assign</Button>
                          ) : (
                            <>
                              {activeTab === 'Loading' && (
                                <>
                                  <Button onClick={() => { setSelectedTrip(item); setOutData({date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm')}); setShowOutPortal(true); }} className="h-7 text-[10px] font-black bg-[#1e3a8a] text-white rounded-none px-6 shadow-sm">OUT</Button>
                                  <button onClick={() => { setSelectedTrip(item); setShowUnassignWarning(true); }} className="text-[9px] font-black text-red-500 hover:underline uppercase tracking-tighter">UNASSIGN</button>
                                </>
                              )}
                              {activeTab === 'In-Transit' && (
                                <Button onClick={() => handleArrival(item.id)} className="h-7 text-[10px] font-black bg-emerald-600 text-white rounded-none px-8 shadow-sm">ARRIVED</Button>
                              )}
                              {activeTab === 'Arrived' && (
                                <>
                                  <Button onClick={() => handleUnload(item.id)} className="h-7 text-[10px] font-black bg-blue-600 text-white rounded-none px-8 shadow-sm">UNLOAD</Button>
                                  <button onClick={() => handleReject(item.id)} className="text-[9px] font-black text-red-500 hover:underline uppercase tracking-tighter">REJECT</button>
                                </>
                              )}
                              {activeTab === 'POD Verify' && (
                                <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} className="h-7 text-[10px] font-black bg-purple-600 text-white rounded-none px-6 shadow-sm">UPLOAD POD</Button>
                              )}
                              {activeTab === 'Closed' && (
                                <div className="flex gap-2">
                                   <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} variant="outline" className="h-7 text-[10px] font-black border-slate-300 rounded-none px-4">POD UPDATE</Button>
                                   {item.podUrl && <Button onClick={() => window.open(item.podUrl, '_blank')} variant="ghost" className="h-7 text-blue-600 p-1"><FileCheck className="h-4 w-4" /></Button>}
                                </div>
                              )}
                            </>
                          )}
                       </div>
                    </div>
                  </div>

                  {/* Redesigned Merged Footer Node with Live Location Tracking */}
                  {['Loading', 'In-Transit', 'Arrived'].includes(activeTab) && (
                    <div className="flex bg-slate-50/50 border-t border-slate-100/50 h-8 items-center">
                       <div className="w-[32%]" />
                       <div className="flex-1 flex items-center justify-between px-3 gap-6">
                          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.open(mapsUrl, '_blank')}>
                             <MapPin className="h-3 w-3 text-red-400 shrink-0" />
                             <span className="text-[9px] font-black text-[#0056d2] uppercase truncate group-hover:underline italic leading-none">
                                {liveNode?.lastLocation || 'SYNCHRONIZING SATELLITE GATEWAY...'}
                             </span>
                          </div>
                          <button onClick={() => { setSelectedTrip(item); setShowTrackPortal(true); }} className="flex items-center gap-2 h-6 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all text-[8px] font-black uppercase tracking-[0.2em] rounded-full px-3 shrink-0">
                             <Radar className="h-2.5 w-2.5" /> 
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

      {/* CN Copy / LR Preview Overlay */}
      {showPrintView && selectedTrip && (
        <div className="fixed inset-0 z-[100] bg-slate-100 flex flex-col overflow-hidden animate-fade-in">
           <div className="bg-white border-b border-slate-300 px-8 py-2 flex items-center justify-between shadow-sm shrink-0 z-10">
              <div className="flex flex-col">
                 <h3 className="text-xs font-black uppercase text-[#1e3a8a] italic">Registry: Consignment Note Preview</h3>
                 <span className="text-[9px] font-bold text-slate-400 font-normal">TRIP SEQUENCE: {selectedTrip.tripNo} | CN: {selectedTrip.cnNumber}</span>
              </div>
              <div className="flex gap-4">
                 <Button onClick={handleGeneratePDF} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none text-[10px] font-black uppercase px-10 shadow-md">
                    <Printer className="h-4 w-4 mr-2" /> Generate PDF
                 </Button>
                 <Button onClick={() => setShowPrintView(false)} variant="outline" className="h-9 border-red-500 text-red-600 hover:bg-red-50 rounded-none text-[10px] font-black uppercase px-8">
                    <X className="h-4 w-4 mr-2" /> Close LR
                 </Button>
              </div>
           </div>
           <div className="flex-1 overflow-hidden">
              <CNPrintView trip={selectedTrip} />
           </div>
        </div>
      )}

      {/* Assignment Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-[800px] max-h-[95vh] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col text-slate-900">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 shrink-0">
             <DialogTitle className="sr-only">Vehicle Assignment Registry</DialogTitle>
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
                      <option value="Own Vehicle">Own Vehicle Node</option>
                      <option value="Contract Vehicle">Contract Vehicle Node</option>
                      <option value="Market Vehicle">Market Vehicle Strategy</option>
                   </select>
                </div>
             </div>
             {assignData.fleetType === 'Market Vehicle' && (
                <div className="space-y-6 bg-blue-50/30 p-6 border border-blue-100 animate-fade-in">
                   <div className="grid grid-cols-2 gap-8">
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
                         <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase">Rate (Per MT)</label>
                            <div className="flex items-center gap-2 px-2 bg-slate-200/50">
                               <Checkbox 
                                 id="fix-rate" 
                                 checked={assignData.isFixRate} 
                                 onCheckedChange={(checked) => setAssignData({ ...assignData, isFixRate: !!checked })} 
                                 className="h-3 w-3 rounded-none border-slate-400" 
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
                <Button onClick={handlePostAssignment} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-20 shadow-lg">Post Registry Node</Button>
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CN Entry Portal */}
      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-[950px] max-h-[95vh] rounded-none border-[3px] border-[#0056d2] font-mono p-0 flex flex-col text-slate-900">
           <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 shrink-0">
              <DialogTitle className="text-sm font-black uppercase text-[#0056d2]">Consignment Note Registry Hub: {selectedTrip?.tripNo}</DialogTitle>
           </DialogHeader>
           <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-8">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">Previous CN (Registry Match)</label><input readOnly value={previousCN} className="h-9 w-full border border-slate-200 bg-slate-50 px-3 text-[11px] font-black outline-none" /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-[#0056d2] uppercase tracking-tighter">CN Number *</label><input autoFocus value={cnData.cnNo || ''} onChange={e => setCnData({...cnData, cnNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">CN Date</label><input type="date" value={cnData.cnDate || format(new Date(), 'yyyy-MM-dd')} onChange={e => setCnData({...cnData, cnDate: e.target.value})} className="h-9 w-full border border-slate-400 px-3 outline-none" /></div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Payment Terms</label>
                    <select value={cnData.paymentTerms} onChange={e => setCnData({...cnData, paymentTerms: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-[11px] font-bold">
                       <option value="PAID">PAID</option>
                       <option value="TO PAY">TO PAY</option>
                       <option value="FOC">FOC</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Transport Mode</label>
                    <select value={cnData.mode} onChange={e => setCnData({...cnData, mode: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-[11px] font-black">
                       <option value="Road">Road</option>
                       <option value="Road from Rail">Road from Rail</option>
                    </select>
                 </div>
                 {cnData.mode === 'Road from Rail' && <div className="space-y-1.5 animate-fade-in"><label className="text-[10px] font-black text-blue-600 uppercase tracking-tighter italic underline underline-offset-4">Rake Point Name</label><input value={cnData.ratePoint || ''} onChange={e => setCnData({...cnData, ratePoint: e.target.value.toUpperCase()})} className="h-9 w-full border border-blue-400 px-3 text-[11px] font-black outline-none" /></div>}
              </div>
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase text-slate-500 border-b-2 border-slate-100 pb-3 flex justify-between items-center">
                    <span>Invoice Registry Matrix</span>
                    <Button onClick={() => setCnItems([...cnItems, {invoiceNo: '', ewaybillNo: '', goodsDescription: selectedTrip?.materialName || '', weight: '', package: '', packageUom: 'Bag'}])} variant="ghost" size="sm" className="h-7 text-[9px] font-black uppercase text-[#0056d2] border border-blue-100 px-4 hover:bg-blue-50 transition-all"><Plus className="h-3.5 w-3.5 mr-1" /> Add Invoice Item</Button>
                 </h4>
                 <div className="border border-slate-200 overflow-hidden shadow-sm">
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
                              <td className="border-r"><input value={it.invoiceNo} onChange={e => { const n = [...cnItems]; n[idx].invoiceNo = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-9 px-3 outline-none focus:bg-yellow-50 text-[11px] font-bold" /></td>
                              <td className="border-r"><input value={it.ewaybillNo || ''} onChange={e => { const n = [...cnItems]; n[idx].ewaybillNo = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-9 px-3 outline-none focus:bg-yellow-50 text-[11px]" /></td>
                              <td className="border-r"><input value={it.goodsDescription} onChange={e => { const n = [...cnItems]; n[idx].goodsDescription = e.target.value.toUpperCase(); setCnItems(n); }} className="w-full h-9 px-3 outline-none focus:bg-yellow-50 text-[11px]" /></td>
                              <td className="border-r text-center"><input type="number" value={it.package} onChange={e => { const n = [...cnItems]; n[idx].package = e.target.value; setCnItems(n); }} className="w-full h-9 text-center outline-none" /></td>
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
              </div>
              <div className="flex gap-4">
                 <Button onClick={() => setShowCNPortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-black border-slate-300 px-8">Cancel</Button>
                 <Button onClick={handlePostCN} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-black px-16 shadow-lg">Post Registry Node</Button>
              </div>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POD Entry Portal */}
      <Dialog open={showPODPortal} onOpenChange={setShowPODPortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-purple-600 font-mono text-slate-900">
           <DialogHeader>
             <DialogTitle className="text-sm font-black uppercase italic text-purple-600">POD Registry Center: {selectedTrip?.tripNo}</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-6">
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
                         <span className="text-[9px] font-black uppercase">Document Registry Synchronized</span>
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
              <Button onClick={handlePostPOD} className="h-9 bg-purple-600 text-white rounded-none text-[10px] font-black uppercase px-10 shadow-lg">Post POD Hub</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gate Out Dialog */}
      <Dialog open={showOutPortal} onOpenChange={setShowOutPortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-[#1e3a8a] font-mono text-slate-900">
           <DialogHeader>
             <DialogTitle className="text-sm font-black uppercase italic text-[#1e3a8a]">Gate-Out Registry Dispatch</DialogTitle>
           </DialogHeader>
           <div className="py-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Date</label>
                   <input type="date" value={outData.date} onChange={e => setOutData({...outData, date: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[11px]" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Time</label>
                   <input type="time" value={outData.time} onChange={e => setOutData({...outData, time: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-[11px]" />
                </div>
              </div>
           </div>
           <DialogFooter className="gap-2">
              <Button onClick={() => setShowOutPortal(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300 px-6">Cancel</Button>
              <Button onClick={handleGateOut} className="h-9 bg-[#1e3a8a] text-white rounded-none text-[10px] font-black uppercase px-10 shadow-lg">Post and Exit</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Warning */}
      <Dialog open={showUnassignWarning} onOpenChange={setShowUnassignWarning}>
        <DialogContent className="max-w-md rounded-none border-[4px] border-red-600 font-mono text-slate-900">
           <DialogHeader>
             <DialogTitle className="text-red-600 flex items-center gap-2 font-black uppercase italic"><AlertTriangle className="h-5 w-5" /> REVERSAL WARNING</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-4">
              <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase">Are you sure you want to unassign Vehicle <span className="font-black text-red-600">{selectedTrip?.vehicleNo}</span>?</p>
           </div>
           <DialogFooter className="gap-2">
              <Button onClick={handleUnassign} className="bg-red-600 text-white h-9 rounded-none text-[10px] font-black uppercase px-8 shadow-md">Confirm Reversal</Button>
              <Button onClick={() => setShowUnassignWarning(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300 px-8">Exit &times;</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Registry Update */}
      <Dialog open={showVehiclePortal} onOpenChange={setShowVehiclePortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-[#1e3a8a] font-mono text-slate-900">
           <DialogHeader>
             <DialogTitle className="text-sm font-black uppercase italic text-[#1e3a8a]">Vehicle Detail Registry Hub</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-6">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number</label>
                 <input value={vehicleEdit.vehicleNo} onChange={e => setVehicleEdit({...vehicleEdit, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-yellow-50" />
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-black text-slate-400 uppercase">Driver Mobile</label>
                 <input value={vehicleEdit.mobile} onChange={e => setVehicleEdit({...vehicleEdit, mobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs outline-none" />
              </div>
           </div>
           <DialogFooter className="gap-2">
              <Button onClick={() => setShowVehiclePortal(false)} variant="outline" className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300 px-6">Cancel</Button>
              <Button onClick={handleUpdateVehicle} className="h-9 bg-[#1e3a8a] text-white rounded-none text-[10px] font-black uppercase px-10">Update Node</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Track Portal Overlay with Enhanced Header and Live Data */}
      <Dialog open={showTrackPortal} onOpenChange={setShowTrackPortal}>
        <DialogContent className="max-w-[700px] rounded-none border-[3px] border-[#0056d2] font-mono text-slate-900 p-0 overflow-hidden">
           <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
             <DialogTitle className="text-sm font-black uppercase italic text-[#0056d2] flex justify-between items-center">
               <span>Satellite Track Registry: {selectedTrip?.vehicleNo}</span>
               <Badge className="bg-emerald-600 rounded-none font-black text-[9px] px-3">{selectedTrip?.status}</Badge>
             </DialogTitle>
           </DialogHeader>
           <div className="p-8 space-y-8">
              {/* Enhanced Info Registry Header */}
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-[11px] font-black uppercase bg-white border border-slate-100 p-6 shadow-inner">
                 <div className="flex justify-between border-b pb-1.5"><span className="text-slate-400 font-bold">Vehicle No:</span><span className="text-[#1e3a8a]">{selectedTrip?.vehicleNo}</span></div>
                 <div className="flex justify-between border-b pb-1.5"><span className="text-slate-400 font-bold">Driver Mob:</span><span className="text-slate-700">{selectedTrip?.driverMobile || '-'}</span></div>
                 <div className="flex justify-between border-b pb-1.5 col-span-2"><span className="text-slate-400 font-bold">Ship To:</span><span className="text-[#1e3a8a] truncate pl-4">{selectedTrip?.shipToParty}</span></div>
                 <div className="flex justify-between border-b pb-1.5 col-span-2"><span className="text-slate-400 font-bold">Route:</span><span className="text-emerald-700 italic">{selectedTrip?.from} &rarr; {selectedTrip?.destination}</span></div>
              </div>

              <div className="p-6 bg-slate-50 border border-slate-200 rounded-sm">
                 <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Street + City Live Handshake</span>
                       <p className="text-sm font-black text-slate-800 leading-relaxed uppercase italic">
                          {gpsLive?.find(n => n.vehicleNumber === selectedTrip?.vehicleNo)?.lastLocation || 'SYNCHRONIZING SATELLITE GATEWAY...'}
                       </p>
                    </div>
                 </div>
              </div>

              {/* Status Visual Registry */}
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
           <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200">
              <Button onClick={() => setShowTrackPortal(false)} className="h-10 bg-[#0056d2] text-white rounded-none text-[11px] font-black uppercase px-20 shadow-lg">Exit Registry Mode</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}