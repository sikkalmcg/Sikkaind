'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  Filter, Search, MapPin, Truck, Radar, 
  X, Trash2, Plus, FileText, ChevronLeft, ChevronRight, Printer,
  Loader2, CheckCircle, FileUp, ExternalLink, Calculator, History, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc, useUser } from '@/mongodb';
import { collection, doc, serverTimestamp } from '@/lib/mongo-store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Download } from 'lucide-react';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

export default function TR21Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useMongoStore();
  const { user } = useUser();
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Open Orders');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);
  
  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);

  const [showAssign, setShowAssign] = React.useState(false);
  const [showCNPortal, setShowCNPortal] = React.useState(false);
  const [showVehiclePortal, setShowVehiclePortal] = React.useState(false);
  const [showPODPortal, setShowPODPortal] = React.useState(false);
  const [showStatusPortal, setShowStatusPortal] = React.useState(false);
  const [showPODViewer, setShowPODViewer] = React.useState(false);
  
  const [podFile, setPodFile] = React.useState<string | null>(null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const podInputRef = React.useRef<HTMLInputElement>(null);

  const [lastGeneratedCN, setLastGeneratedCN] = React.useState<string>('N/A');

  const cnPortalTripIdRef = React.useRef<string | null>(null);

  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  const [assignData, setAssignData] = React.useState<any>({
    fleetType: 'Own Vehicle',
    assignDate: '',
    mode: 'Road',
    via: '',
    fixRate: false,
    paymentTerms: 'PAID',
    assignWeight: '0',
    rate: '0',
    freightAmount: '0',
    arrangeBy: ''
  });

  const [cnData, setCNData] = React.useState<any>({
    cnNumber: '',
    cnDate: '',
    paymentTerms: 'PAID',
    invoices: [{ id: '1', invNo: '', ewaybillNo: '', desc: '', pkg: '', uom: 'Bag' }]
  });

  const [vehicleData, setVehicleData] = React.useState({ vehicleNo: '', driverMobile: '' });
  const [cnVehicleWeightData, setCnVehicleWeightData] = React.useState({
    vehicleNo: '',
    assignWeight: ''
  });

  const [showRestoreDialog, setShowRestoreDialog] = React.useState(false);
  const [restoreDialogTrip, setRestoreDialogTrip] = React.useState<any>(null);

  const [statusUpdateData, setStatusUpdateData] = React.useState({
    tripId: '',
    newStatus: '',
    dateField: '',
    timestamp: '',
    label: '',
    consignor: '',
    consignee: '',
    route: ''
  });

  React.useEffect(() => { 
    const isAd = localStorage.getItem('sap_bootstrap_session') === 'true';
    const rId = localStorage.getItem('sap_registry_id');
    setIsBootstrapAdmin(isAd);
    setRegistryId(rId);

    setAssignData((prev: any) => ({ ...prev, assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") }));
    setCNData((prev: any) => ({ ...prev, cnDate: format(new Date(), 'yyyy-MM-dd') }));

    setMounted(true); 
  }, []);

  const profileRef = useMemoMongo(() => {
    if (!registryId || isBootstrapAdmin) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'users_master', registryId);
  }, [db, registryId, isBootstrapAdmin]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(profileRef);

  const ordersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const companiesQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const vendorsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const forwardingAgentsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'forwarding_agents'), [db]);

  const { data: orders } = useCollectionOptimized(ordersQuery);
  const { data: trips } = useCollectionOptimized(tripsQuery);
  const { data: plants } = useCollectionOptimized(plantsQuery);
  const { data: companies } = useCollectionOptimized(companiesQuery);
  const { data: vendors } = useCollectionOptimized(vendorsQuery);
  const { data: forwardingAgents } = useCollectionOptimized(forwardingAgentsQuery);

  const authorizedPlantCodes = React.useMemo(() => {
    if (isProfileLoading) return undefined;
    if (isBootstrapAdmin) return null;
    return userProfile?.plantAccess || [];
  }, [isBootstrapAdmin, userProfile, isProfileLoading]);

  React.useEffect(() => {
    if (mounted && authorizedPlantCodes && authorizedPlantCodes.length > 0 && plantFilter === 'ALL') {
      setPlantFilter(authorizedPlantCodes[0]);
    }
  }, [mounted, authorizedPlantCodes, plantFilter]);

  const tabCounts = React.useMemo(() => {
    const counts: { [key: string]: number } = {
      'Open Orders': 0, 'Loading': 0, 'In-Transit': 0, 'Arrived': 0, 
      'Reject': 0, 'POD Verify': 0, 'Closed': 0
    };

    if (!orders || !trips || !mounted || authorizedPlantCodes === undefined) {
      return counts;
    }

    let baseOrders = authorizedPlantCodes ? orders.filter(d => authorizedPlantCodes.includes(d.plantCode)) : orders;
    let baseTrips = authorizedPlantCodes ? trips.filter(d => authorizedPlantCodes.includes(d.plantCode)) : trips;

    if (plantFilter !== 'ALL') {
      baseOrders = baseOrders.filter(d => d.plantCode === plantFilter);
      baseTrips = baseTrips.filter(d => d.plantCode === plantFilter);
    }

    counts['Open Orders'] = baseOrders.filter(o => o.status === 'Open').map(o => {
      const dispatched = baseTrips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                               .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
      const weight = parseFloat(o.quantity) || 0;
      return { ...o, dispatched, balance: weight - dispatched };
    }).filter(o => o.balance > 0.001).length;

    const statusMap: { [key: string]: string } = { 
      'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 
      'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' 
    };

    Object.keys(statusMap).forEach(tabName => {
      counts[tabName] = baseTrips.filter(t => t.status === statusMap[tabName]).length;
    });

    return counts;

  }, [orders, trips, mounted, plantFilter, authorizedPlantCodes]);

  React.useEffect(() => {
    if (!assignData.fixRate) {
      const weight = parseFloat(assignData.assignWeight) || 0;
      const rate = parseFloat(assignData.rate) || 0;
      const total = (weight * rate).toFixed(2);
      setAssignData((prev: any) => ({ ...prev, freightAmount: total }));
    }
  }, [assignData.rate, assignData.assignWeight, assignData.fixRate]);

  React.useEffect(() => {
    if (!showCNPortal) {
      cnPortalTripIdRef.current = null;
      return;
    }

    if (!selectedTrip || !trips || !companies) return;

    const carrier = companies.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(selectedTrip.plantCode)) || companies[0];
    const carrierName = carrier?.companyName || '';
    const carrierCNs = (trips || [])
      .filter(t => (t.carrierName === carrierName || (!t.carrierName && t.plantCode === selectedTrip.plantCode)) && t.cnNumber)
      .map(t => t.cnNumber as string);

    let lastFull = '';
    let suggestedCN = '000001';

    if (carrierCNs.length > 0) {
      let maxVal = -1;

      carrierCNs.forEach(cn => {
        const match = cn.match(/(\d+)$/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > maxVal) {
            maxVal = val;
            lastFull = cn;
          }
        }
      });

      if (lastFull) {
        const match = lastFull.match(/^(.*?)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const digits = match[2];
          const nextVal = (parseInt(digits, 10) + 1).toString();
          suggestedCN = prefix + nextVal.padStart(digits.length, '0');
        } else {
          suggestedCN = lastFull;
        }
      } else {
        suggestedCN = '000001';
      }
    }

    setLastGeneratedCN(lastFull || (carrierCNs.length > 0 ? 'NONE (NUMERIC REQ)' : 'NONE (INITIAL)'));

    if (cnPortalTripIdRef.current !== selectedTrip.id) {
      cnPortalTripIdRef.current = selectedTrip.id;

      const hasInvoices = (selectedTrip.invoices || []).length > 0;

      const prefills = (() => {
        if (!selectedOrder) {
          return [{ id: '1', invNo: '', ewaybillNo: '', desc: '', pkg: '', uom: 'Bag' }];
        }

        const materialNames: string[] = Array.isArray(selectedOrder.materialName)
          ? selectedOrder.materialName
          : (selectedOrder.materialName ? [selectedOrder.materialName] : []);

        const invoiceNos: string[] = Array.isArray(selectedOrder.invoiceNo)
          ? selectedOrder.invoiceNo
          : (selectedOrder.invoiceNo ? [selectedOrder.invoiceNo] : []);

        const ewaybillNos: string[] = Array.isArray(selectedOrder.eWaybillNo)
          ? selectedOrder.eWaybillNo
          : (selectedOrder.eWaybillNo ? [selectedOrder.eWaybillNo] : []);

        if (materialNames.length <= 1 && invoiceNos.length <= 1 && ewaybillNos.length <= 1) {
          return [
            {
              id: '1',
              invNo: (selectedOrder?.invoiceNo || '').toString().trim().toUpperCase(),
              ewaybillNo: (selectedOrder?.eWaybillNo || '').toString().trim(),
              desc: (selectedOrder?.materialName || '').toString().trim().toUpperCase(),
              pkg: '',
              uom: 'Bag',
            },
          ];
        }

        const uniqueDesc = Array.from(new Set(materialNames.map((m) => (m ?? '').toString().trim().toUpperCase()).filter(Boolean)));
        const descToUse = uniqueDesc.length > 0 ? uniqueDesc.join(' / ') : (selectedOrder?.materialName || '').toString().trim().toUpperCase();

        const maxLen = Math.max(invoiceNos.length, ewaybillNos.length, materialNames.length);
        const rows: any[] = [];

        for (let i = 0; i < maxLen; i += 2) {
          const inv1 = invoiceNos[i] ?? '';
          const inv2 = invoiceNos[i + 1] ?? '';
          const e1 = ewaybillNos[i] ?? '';
          const e2 = ewaybillNos[i + 1] ?? '';

          const row1 = {
            id: `${selectedOrder?.orderNo || 'SO'}-${i}-1`,
            invNo: inv1.toString().trim().toUpperCase(),
            ewaybillNo: e1.toString().trim(),
            desc: descToUse,
            pkg: '',
            uom: 'Bag',
          };

          const row2 = {
            id: `${selectedOrder?.orderNo || 'SO'}-${i}-2`,
            invNo: inv2.toString().trim().toUpperCase(),
            ewaybillNo: e2.toString().trim(),
            desc: descToUse,
            pkg: '',
            uom: 'Bag',
          };

          const shouldPush1 = row1.invNo || row1.ewaybillNo || row1.desc || row1.pkg;
          const shouldPush2 = row2.invNo || row2.ewaybillNo || row2.desc || row2.pkg;

          if (shouldPush1) rows.push(row1);
          if (shouldPush2) rows.push(row2);
        }

        return rows.length > 0 ? rows : [{ id: '1', invNo: '', ewaybillNo: '', desc: '', pkg: '', uom: 'Bag' }];
      })();

      setCNData((prev: any) => ({
        ...prev,
        id: selectedTrip.id,
        cnNumber: selectedTrip.cnNumber || suggestedCN,
        cnDate: prev.cnDate || format(new Date(), 'yyyy-MM-dd'),
        invoices: hasInvoices
          ? selectedTrip.invoices
          : (prev.invoices || []).length > 0
            ? prev.invoices
            : prefills,
      }));
    }
  }, [showCNPortal, selectedTrip, trips, companies]);

  const filteredData = React.useMemo(() => {
    if (!orders || !trips || !mounted || authorizedPlantCodes === undefined) return [];
    let baseData: any[] = [];

    if (activeTab === 'Open Orders') {
      baseData = orders.filter(o => o.status === 'Open').map(o => {
        const dispatched = trips.filter(t => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
        const weight = parseFloat(o.quantity) || 0;
        return { ...o, dispatched, balance: weight - dispatched };
      }).filter(o => o.balance > 0.001);
    } else {
      const statusMap: any = { 
        'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 
        'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' 
      };
      baseData = trips.filter(t => t.status === statusMap[activeTab]);
    }

    if (authorizedPlantCodes) {
      baseData = baseData.filter(d => authorizedPlantCodes.includes(d.plantCode));
    }

    if (plantFilter !== 'ALL') baseData = baseData.filter(d => d.plantCode === plantFilter);
    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      baseData = baseData.filter(d => (d.orderNo || '').includes(query) || (d.tripNo || '').includes(query) || (d.vehicleNo || '').includes(query));
    }
    return baseData;
  }, [orders, trips, activeTab, mounted, plantFilter, searchQuery, authorizedPlantCodes]);

  const paginated = React.useMemo(() => {
    return filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

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
      from: selectedOrder.from,
      materialName: selectedOrder.materialName,
      invoiceNo: (selectedOrder?.invoiceNo || '').toString().trim().toUpperCase(),
      eWaybillNo: (selectedOrder?.eWaybillNo || '').toString().trim(),
      vehicleNoFromOrder: (selectedOrder?.vehicleNo || '').toString().trim().toUpperCase(),
      paymentTerms: assignData.paymentTerms || 'PAID', vendorName: assignData.vendorName || '',
      vendorMobile: assignData.vendorMobile || '',
      arrangeBy: assignData.fleetType === 'Market Vehicle' ? (assignData.arrangeBy || '') : '',
      rate: parseFloat(assignData.rate) || 0, freightAmount: parseFloat(assignData.freightAmount) || 0,
      fixRate: assignData.fixRate || false,
      invoices: []
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', payload.id), payload, { merge: true });
    setShowAssign(false);
    alert(`Protocol Post: Trip ID ${tripId} registered.`);
  };

  const handlePostCN = () => {
    const cnNumber = cnData.cnNumber?.trim().toUpperCase();
    if (!cnNumber) return alert('CN Number Mandatory');

    const normalizedInvoices = (cnData.invoices || [])
      .map((row: any) => {
        const invNo = (row?.invNo ?? '').toString().trim().toUpperCase();
        const ewaybillNo = (row?.ewaybillNo ?? '').toString().trim();
        const desc = (row?.desc ?? '').toString().trim().toUpperCase();
        const pkgRaw = row?.pkg ?? '';
        const pkg = typeof pkgRaw === 'number' ? pkgRaw : parseFloat(pkgRaw.toString());
        const uom = (row?.uom ?? 'Bag').toString().trim().toUpperCase();

        return {
          id: row?.id ?? Math.random().toString(),
          invNo,
          ewaybillNo,
          desc,
          pkg: Number.isFinite(pkg) ? pkg : (pkgRaw === '' ? '' : 0),
          uom: uom || 'BAG',
        };
      })
      .filter((r: any) => r.invNo || r.ewaybillNo || r.desc || r.pkg !== '' && r.pkg !== 0);

    const vehicleNo = (vehicleData.vehicleNo || selectedTrip?.vehicleNo || '').toString().toUpperCase().trim();
    const assignWeightNum = parseFloat((assignData.assignWeight || selectedTrip?.assignWeight || 0).toString());
    const freightAmountNum = assignData.fixRate ? selectedTrip?.freightAmount : (assignWeightNum * parseFloat(assignData.rate || 0));

    const carrier = companies?.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(selectedTrip.plantCode)) || companies?.[0];

    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), {
      ...cnData,
      invoices: normalizedInvoices,
      cnNumber,
      carrierName: carrier?.companyName || '',
      ...(vehicleNo ? { vehicleNo } : {}),
      ...(Number.isFinite(assignWeightNum) ? { assignWeight: assignWeightNum } : {}),
      ...(Number.isFinite(freightAmountNum) ? { freightAmount: freightAmountNum } : {}),
      updatedAt: new Date().toISOString(),
    });

    setShowCNPortal(false);
    alert('Documentation Synchronized');
  };

  const openStatusPortal = (trip: any, newStatus: string, dateField: string, label: string) => {
    setStatusUpdateData({
      tripId: trip.id,
      newStatus,
      dateField,
      label,
      timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      consignor: trip.consignorName || trip.consignorCode,
      consignee: trip.consigneeName || trip.consigneeCode,
      route: `${trip.from} → ${trip.destination}`
    });
    setShowStatusPortal(true);
  };

  const handleCommitStatusUpdate = () => {
    const updates: any = { 
      status: statusUpdateData.newStatus, 
      updatedAt: new Date().toISOString() 
    };
    if (statusUpdateData.dateField) {
      updates[statusUpdateData.dateField] = statusUpdateData.timestamp;
    }
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', statusUpdateData.tripId), updates);
    setShowStatusPortal(false);
    alert(`Node Status Updated: ${statusUpdateData.newStatus}`);
  };

  const handleUnassign = (trip: any) => {
    if (!window.confirm(`Confirm unassign of ${trip.tripNo || trip.orderNo}? This will return the order to Open Orders.`)) {
      return;
    }
    deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', trip.id));
    if (activeTab === 'Loading') {
      setCurrentPage(1);
    }
    alert('Order unassigned and returned to Open Orders. Please reassign or short close the order.');
  };

  const handlePODUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('SATELLITE ERROR: File exceeds 2MB limit.');
    if (file.type.startsWith('image/')) {
      setIsCompressing(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new (window as any).Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          const maxDim = 1200;
          if (width > height && width > maxDim) { height *= maxDim / width; width = maxDim; }
          else if (height > maxDim) { width *= maxDim / height; height = maxDim; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedData = canvas.toDataURL('image/jpeg', 0.5);
          setPodFile(compressedData);
          setIsCompressing(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => setPodFile(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const isAdminUser = React.useMemo(() => {
    try {
      return (userProfile?.registryId || registryId) === SHARED_HUB_ID || localStorage.getItem('sap_registry_id') === registryId && localStorage.getItem('sap_registry_id') === 'Sikkaind';
    } catch {
      return false;
    }
  }, [userProfile, registryId]);

  const openRestoreDialog = (trip: any) => {
    if (!trip) return;
    setRestoreDialogTrip(trip);
    setShowRestoreDialog(true);
  };

  const handleRestoreCommit = (trip: any) => {
    if (!trip) return;
    const current = trip.status;
    const restoredStatusByCurrent: Record<string, string> = {
      'IN-TRANSIT': 'LOADING',
      'ARRIVED': 'IN-TRANSIT',
      'REJECTION': 'ARRIVED',
      'POD': 'ARRIVED',
      'CLOSED': 'POD',
    };

    const nextStatus = restoredStatusByCurrent[current];
    if (!nextStatus) {
      alert('Restore not supported for the current trip status.');
      return;
    }

    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', trip.id), {
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });

    alert(`Trip restored to previous stage (${nextStatus}).`);
  };

  const handleOpenPrint = (tripId: string) => {
    window.open(`/dashboard/tr21/print/${tripId}`, '_blank');
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 shadow-sm flex justify-between items-center z-30 shrink-0">
        <h2 className="text-[16px] font-normal text-[#1e3a8a] uppercase italic">TR21 – TRIP BOARD</h2>
        <div className="flex gap-4 bg-[#f8fafc] border border-slate-200 p-1 px-4 shadow-inner">
           <div className="flex items-center gap-2">
             <Filter className="h-3.5 w-3.5 text-slate-400" />
             <select 
               value={plantFilter} 
               onChange={e => setPlantFilter(e.target.value)} 
               disabled={!isBootstrapAdmin && authorizedPlantCodes?.length === 1}
               className="h-7 bg-transparent text-[10px] font-normal uppercase outline-none"
             >
               {isBootstrapAdmin && <option value="ALL">All Plants</option>}
               {plants?.filter(p => !authorizedPlantCodes || authorizedPlantCodes.includes(p.plantCode)).map(p => (
                 <option key={p.id} value={p.plantCode}>{p.plantCode}</option>
               ))}
             </select>
           </div>
           <div className="w-[1px] h-4 bg-slate-300" />
           <div className="flex items-center gap-2">
             <Search className="h-3.5 w-3.5 text-slate-400" />
             <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-7 w-48 bg-transparent text-[10px] font-normal uppercase outline-none" placeholder="SEARCH..." />
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-8 overflow-hidden">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4 overflow-x-auto no-scrollbar">
          {['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'].map(l => (
            <button key={l} onClick={() => { setActiveTab(l); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-normal uppercase tracking-widest border-r border-slate-300 shrink-0 flex items-center gap-2", activeTab === l ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              <span>{l}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[9px]", activeTab === l ? "bg-[#0056d2] text-white" : "bg-slate-200 text-slate-500")}>{tabCounts[l]}</span>
            </button>
          ))}
        </div>

        <Dialog open={!!(showRestoreDialog && restoreDialogTrip)} onOpenChange={(open) => {
          if (!open) {
            setShowRestoreDialog(false);
            setRestoreDialogTrip(null);
          }
        }}>
          <DialogContent className="max-w-md rounded-none border-[3px] border-slate-200 font-mono p-0 overflow-hidden text-left text-black">
            <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
              <DialogTitle className="text-[12px] font-normal uppercase text-slate-700 italic">Restore Trip</DialogTitle>
            </DialogHeader>
            <div className="p-8">
              <p className="text-[10px] font-normal text-slate-600 uppercase italic leading-relaxed">
                Are you sure you want to restore this Trip? The trip will be moved back to the previous workflow stage.
              </p>
            </div>
            <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
              <Button onClick={() => {
                setShowRestoreDialog(false);
                setRestoreDialogTrip(null);
              }} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-normal px-10">
                No
              </Button>
              <Button onClick={() => {
                if (!restoreDialogTrip) return;
                handleRestoreCommit(restoreDialogTrip);
                setShowRestoreDialog(false);
                setRestoreDialogTrip(null);
              }} className="bg-emerald-600 text-white rounded-none h-10 uppercase text-[10px] font-normal px-16">
                Yes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner custom-scrollbar relative flex flex-col">
          <div className="flex-1 overflow-auto">
            {isProfileLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-300">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest">Identifying Local Profile...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[2200px] text-[11px]">
                <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300 font-normal uppercase text-slate-500">
                  {activeTab === 'Open Orders' ? (
                    <tr>
                      <th className="p-3 border-r w-[80px]">Plant</th>
                      <th className="p-3 border-r w-[180px]">Sale Order/Date</th>
                      <th className="p-3 border-r w-[200px]">Consignor</th>
                      <th className="p-3 border-r w-[200px]">Consignee</th>
                      <th className="p-3 border-r w-[200px]">Ship to Party</th>
                      <th className="p-3 border-r w-[200px]">Route</th>
                      <th className="p-3 border-r w-[100px] text-right">Assign Qty</th>
                      <th className="p-3 border-r w-[100px] text-right">Order Qty</th>
                      <th className="p-3 border-r w-[100px] text-right">Dispatch Qty</th>
                      <th className="p-3 border-r w-[100px] text-right">Balance Qty</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="p-3 border-r w-[60px]">Plant</th>
                      <th className="p-3 border-r w-[150px]">Sale Order/Date</th>
                      <th className="p-3 border-r w-[150px]">Trip ID/Date</th>
                      <th className="p-3 border-r w-[180px]">Consignor</th>
                      <th className="p-3 border-r w-[180px]">Consignee</th>
                      <th className="p-3 border-r w-[180px]">Ship to Party</th>
                      <th className="p-3 border-r w-[180px]">Route</th>
                      <th className="p-3 border-r w-[100px] text-right">Assign Qty</th>
                      <th className="p-3 border-r w-[180px]">Invoice / E-Way Bill</th>
                      <th className="p-3 border-r w-[150px]">Vehicle/Mobile</th>
                      <th className="p-3 border-r w-[180px]">Carrier</th>
                      <th className="p-3 border-r w-[180px]">Vendor Firm / Arrange By</th>
                      <th className="p-3 border-r w-[100px]">Fleet Type</th>
                      <th className="p-3 border-r w-[150px]">CN No / Date</th>
                      {(activeTab === 'Reject' || activeTab === 'POD Verify' || activeTab === 'Closed') && (
                        <>
                          <th className="p-3 border-r w-[120px]">Out Date/Time</th>
                          <th className="p-3 border-r w-[120px]">Arrived Date/Time</th>
                        </>
                      )}
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {paginated.map((item: any) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors group h-[60px] font-normal uppercase">
                      <td className="p-3 border-r text-center font-normal">{item.plantCode}</td>
                      <td className="p-3 border-r">
                        <div className="flex flex-col leading-tight">
                          <span className="font-normal text-slate-800">{item.orderNo}</span>
                          <span className="text-[9px] text-slate-400 font-normal">{item.orderDate ? format(new Date(item.orderDate), 'dd-MMM-yyyy') : '-'}</span>
                        </div>
                      </td>
                      
                      {activeTab !== 'Open Orders' && (
                        <td className="p-3 border-r text-left">
                          <div className="flex flex-col leading-tight">
                            <span className="font-normal text-blue-700">{item.tripNo || '-'}</span>
                            <span className="text-[9px] text-slate-400 font-normal">{item.createdAt ? format(new Date(item.createdAt), 'dd-MMM-yyyy') : '-'}</span>
                          </div>
                        </td>
                      )}

                      <td className="p-3 border-r truncate max-w-[200px] font-normal">{item.consignorName || item.consignorCode}</td>
                      <td className="p-3 border-r truncate max-w-[200px] font-normal">{item.consigneeName || item.consigneeCode}</td>
                      <td className="p-3 border-r truncate max-w-[200px] font-normal">{item.shipToParty || item.shipToPartyCode}</td>
                      <td className="p-3 border-r italic text-[10px] uppercase font-normal">{item.from} → {item.destination}</td>

                      {activeTab === 'Open Orders' ? (
                        <>
                          <td className="p-3 border-r text-right font-normal text-slate-800 italic bg-blue-50/30">0.000</td>
                          <td className="p-3 border-r text-right text-slate-400 font-normal">{parseFloat(item.quantity || 0).toFixed(3)}</td>
                          <td className="p-3 border-r text-right text-emerald-600 font-normal">{parseFloat(item.dispatched || 0).toFixed(3)}</td>
                          <td className="p-3 border-r text-right font-normal text-blue-600">{parseFloat(item.balance || 0).toFixed(3)}</td>
                          <td className="p-3 text-center">
                            <Button onClick={() => {
                              setSelectedOrder(item);
                              setAssignData({
                                ...assignData,
                                vehicleNo: (item?.vehicleNo || '').toString().trim().toUpperCase(),
                                assignWeight: item.balance.toFixed(3),
                                mode: item.mode || 'Road',
                                via: item.via || '',
                              });
                              setShowAssign(true);
                            }} className="h-7 w-20 text-[9px] font-normal bg-[#1e3a8a] rounded-none">Assign</Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 border-r text-right font-normal text-slate-800 italic bg-blue-50/30">{parseFloat(item.assignWeight || 0).toFixed(3)}</td>
                          <td className="p-3 border-r text-left max-w-[180px] truncate">
                            <div className="flex flex-col leading-tight">
                              <span className="font-normal text-slate-800 truncate" title={(item.invoices || []).map((i: any) => i.invNo).filter(Boolean).join(', ')}>{(item.invoices || []).map((i: any) => i.invNo).filter(Boolean).join(', ') || '-'}</span>
                              <span className="text-[9px] text-slate-400 font-normal truncate" title={(item.invoices || []).map((i: any) => i.ewaybillNo).filter(Boolean).join(', ')}>{(item.invoices || []).map((i: any) => i.ewaybillNo).filter(Boolean).join(', ') || '-'}</span>
                            </div>
                          </td>
                          <td className="p-3 border-r text-left">
                            <button onClick={() => { setSelectedTrip(item); setVehicleData({vehicleNo: item.vehicleNo, driverMobile: item.driverMobile}); setShowVehiclePortal(true); }} className="flex flex-col text-left hover:underline">
                              <span className="font-normal text-blue-800">{item.vehicleNo || 'ADD'}</span>
                              <span className="text-[9px] text-slate-400 font-normal">{item.driverMobile || '-'}</span>
                            </button>
                          </td>
                          <td className="p-3 border-r text-left text-[#0056d2] font-normal text-[10px] truncate" title={item.carrierName}>{item.carrierName || 'PENDING'}</td>
                          <td className="p-3 border-r text-left">
                                  <div className="flex flex-col leading-tight overflow-hidden">
                                    <span className="text-slate-500 font-normal text-[9px] truncate" title={item.vendorName}>
                                      {item.vendorName || '-'}
                                    </span>
                                  </div>
                          </td>
                          <td className="p-3 border-r text-[9px] font-normal text-slate-400">{item.fleetType}</td>
                          <td className="p-3 border-r text-left">
                            <div className="flex flex-col leading-tight">
                              {item.cnNumber ? (
                                <button onClick={() => handleOpenPrint(item.id)} className="text-left group font-normal">
                                    <span className="font-normal text-emerald-700 group-hover:underline flex items-center gap-1.5"><FileText className="h-3 w-3" /> {item.cnNumber}</span>
                                    <span className="text-[9px] text-slate-400 font-normal">{item.cnDate ? format(new Date(item.cnDate), 'dd-MMM-yyyy') : '-'}</span>
                                </button>
                              ) : <span className="text-slate-300 italic text-[9px] font-normal">PENDING</span>}
                            </div>
                          </td>
                          {(activeTab === 'Reject' || activeTab === 'POD Verify' || activeTab === 'Closed') && (
                            <>
                              <td className="p-3 border-r text-slate-400 text-[9px] font-normal">{item.outDate ? format(new Date(item.outDate), 'dd-MM HH:mm') : '-'}</td>
                              <td className="p-3 border-r text-slate-400 text-[9px] font-normal">{item.arrivedDate ? format(new Date(item.arrivedDate), 'dd-MM HH:mm') : '-'}</td>
                            </>
                          )}
                          <td className="p-3 text-center flex flex-row gap-2 items-center justify-center min-w-[200px]">
                            {activeTab === 'Loading' && (
                              <>
                                <Button onClick={() => {
                                  if (!item.cnNumber) {
                                    alert('SATELLITE PROTOCOL ERROR: Consignment Note (CN) must be generated before Gate Out.');
                                    return;
                                  }
                                  openStatusPortal(item, 'IN-TRANSIT', 'outDate', 'GATE OUT PROTOCOL');
                                }} className="h-6 w-20 text-[8px] font-normal bg-[#1e3a8a] text-white rounded-none">OUT</Button>
                                <Button onClick={() => handleUnassign(item)} className="h-6 w-20 text-[8px] font-normal bg-orange-600 text-white rounded-none">UNASSIGN</Button>
                                <Button onClick={() => { 
                                  setSelectedTrip(item);
                                  setVehicleData({ vehicleNo: item.vehicleNo || '', driverMobile: item.driverMobile || '' });
                                  setAssignData((prev: any) => ({
                                    ...prev,
                                    assignWeight: (item.assignWeight ?? item.balance ?? item.weight ?? 0).toString(),
                                    rate: (item.rate || 0).toString(),
                                    fixRate: !!item.fixRate,
                                  }));
                                  const invs = (item.invoices || []).length > 0
                                    ? item.invoices
                                    : [
                                        {
                                          id: '1',
                                          invNo: (selectedOrder?.invoiceNo || '').toString().trim().toUpperCase(),
                                          ewaybillNo: (selectedOrder?.eWaybillNo || '').toString().trim(),
                                          desc: (selectedOrder?.materialName || '').toString().trim().toUpperCase(),
                                          pkg: '',
                                          uom: 'Bag',
                                        },
                                      ];

                                  setCNData({
                                    ...(item.cnNumber ? item : { ...cnData, cnNumber: '', cnDate: format(new Date(), 'yyyy-MM-dd') }),
                                    id: item.id,
                                    invoices: invs,
                                  });

                                  setShowCNPortal(true);
                                }} className="h-6 w-20 text-[8px] font-normal bg-emerald-600 text-white rounded-none">CN ENTRY</Button>
                              </>
                            )}
                            {activeTab === 'In-Transit' && (
                              <>
                                <Button onClick={() => openStatusPortal(item, 'ARRIVED', 'arrivedDate', 'ARRIVAL HANDSHAKE')} className="h-6 w-20 text-[8px] font-normal bg-emerald-600 text-white rounded-none">ARRIVED</Button>
                                {isAdminUser && (
                                  <Button onClick={() => openRestoreDialog(item)} className="h-6 w-20 text-[8px] font-normal bg-slate-500 text-white rounded-none">RESTORE</Button>
                                )}
                                <Button onClick={() => { 
                                  setSelectedTrip(item); 
                                  setVehicleData({ vehicleNo: item.vehicleNo || '', driverMobile: item.driverMobile || '' });
                                  setAssignData((prev: any) => ({
                                    ...prev,
                                    assignWeight: (item.assignWeight ?? item.balance ?? item.weight ?? 0).toString(),
                                    rate: (item.rate || 0).toString(),
                                    fixRate: !!item.fixRate,
                                  }));
                                  setCNData({ ...item, invoices: item.invoices || [] }); 
                                  setShowCNPortal(true); 
                                }} variant="outline" className="h-6 w-20 text-[8px] font-normal border-slate-300 rounded-none">CN EDIT</Button>
                              </>
                            )}
                            {activeTab === 'Arrived' && (
                              <>
                                <Button onClick={() => openStatusPortal(item, 'POD', 'unloadDate', 'UNLOADING PROTOCOL')} className="h-6 w-20 text-[8px] font-normal bg-emerald-600 text-white rounded-none">UNLOAD</Button>
                                {isAdminUser && (
                                  <Button onClick={() => openRestoreDialog(item)} className="h-6 w-20 text-[8px] font-normal bg-slate-500 text-white rounded-none">RESTORE</Button>
                                )}
                                <Button onClick={() => openStatusPortal(item, 'REJECTION', 'rejectionDate', 'REJECTION PROTOCOL')} className="h-6 w-20 text-[8px] font-normal bg-red-600 text-white rounded-none">REJECT</Button>
                                <Button onClick={() => { 
                                  setSelectedTrip(item); 
                                  setVehicleData({ vehicleNo: item.vehicleNo || '', driverMobile: item.driverMobile || '' });
                                  setAssignData((prev: any) => ({
                                    ...prev,
                                    assignWeight: (item.assignWeight ?? item.balance ?? item.weight ?? 0).toString(),
                                    rate: (item.rate || 0).toString(),
                                    fixRate: !!item.fixRate,
                                  }));
                                  setCNData({ ...item, invoices: item.invoices || [] }); 
                                  setShowCNPortal(true); 
                                }} variant="outline" className="h-6 w-20 text-[8px] font-normal border-slate-300 rounded-none">CN EDIT</Button>
                              </>
                            )}
                            {activeTab === 'Reject' && (
                              <>
                                <Button className="h-6 w-20 text-[8px] font-normal bg-blue-600 text-white rounded-none">RESENT</Button>
                                <Button className="h-6 w-20 text-[8px] font-normal bg-slate-800 text-white rounded-none">SRN</Button>
                                {isAdminUser && (
                                  <Button onClick={() => openRestoreDialog(item)} className="h-6 w-20 text-[8px] font-normal bg-slate-500 text-white rounded-none">RESTORE</Button>
                                )}
                              </>
                            )}
                            {activeTab === 'POD Verify' && (
                              <>
                                <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} className={cn("h-6 w-24 text-[8px] font-normal rounded-none", item.podUrl ? "bg-emerald-600" : "bg-orange-600")}>
                                  {item.podUrl ? 'VIEW POD' : 'UPLOAD POD'}
                                </Button>
                                {isAdminUser && (
                                  <Button onClick={() => openRestoreDialog(item)} className="h-6 w-20 text-[8px] font-normal bg-slate-500 text-white rounded-none">RESTORE</Button>
                                )}
                              </>
                            )}
                            {activeTab === 'Closed' && (
                              <>
                                <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} className={cn("h-6 w-24 text-[8px] font-normal rounded-none", item.podUrl ? "bg-emerald-600" : "bg-orange-600")}>
                                  {item.podUrl ? 'VIEW POD' : 'UPLOAD POD'}
                                </Button>
                                {isAdminUser && (
                                  <Button onClick={() => openRestoreDialog(item)} className="h-6 w-20 text-[8px] font-normal bg-slate-500 text-white rounded-none">RESTORE</Button>
                                )}
                              </>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {paginated.length === 0 && !isProfileLoading && (
                    <tr>
                      <td colSpan={15} className="p-20 text-center text-slate-300 italic uppercase font-black text-[10px] tracking-widest">No active trips found in current protocol registry.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
            <div className="flex gap-2 items-center">
              <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
              <input type="number" min="1" max={totalPages} value={currentPage} onChange={e => setCurrentPage(Math.max(1, Math.min(totalPages || 1, Number(e.target.value))))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-normal outline-none" />
              <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
            </div>
            <span className="text-[10px] font-normal uppercase text-slate-400 tracking-widest italic">Page {currentPage} of {totalPages || 1}</span>
          </div>
        </div>
      </div>

      <Dialog open={showPODPortal} onOpenChange={setShowPODPortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-orange-600 font-mono p-0 overflow-hidden text-left text-black">
           <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
              <DialogTitle className="text-[12px] font-normal uppercase text-orange-700 italic">POD Matrix Synchronization</DialogTitle>
           </DialogHeader>
           <div className="p-8 space-y-6">
              <div 
                onClick={() => podInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 p-10 text-center bg-slate-50 hover:bg-white hover:border-orange-400 transition-all cursor-pointer relative"
              >
                <input type="file" ref={podInputRef} className="hidden" accept="image/*,application/pdf" onChange={handlePODUpload} />
                {isCompressing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
                    <span className="text-[10px] font-normal uppercase text-orange-400 animate-pulse">Compressing Registry Data...</span>
                  </div>
                ) : podFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="h-10 w-10 text-emerald-500" />
                    <span className="text-[10px] font-normal uppercase text-emerald-600 italic">Payload Ready (&lt; 200KB)</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <FileUp className="h-10 w-10" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-normal uppercase">Attach POD Image or PDF</p>
                      <p className="text-[8px] italic font-normal">Protocol: Max 2MB File size</p>
                    </div>
                  </div>
                )}
              </div>
              
              {selectedTrip?.podUrl && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 space-y-4">
                   <div className="flex items-center justify-between">
                     <span className="text-[9px] font-normal uppercase text-emerald-700">Current POD Active</span>
                     <Button variant="outline" className="h-6 text-[8px] font-normal rounded-none border-emerald-300" onClick={() => {
                       setShowPODPortal(false);
                       setShowPODViewer(true);
                     }}>View Original</Button>
                   </div>
                   <div className="w-full flex justify-center bg-white border border-emerald-200 p-2">
                     <img src={selectedTrip.podUrl} alt="POD Preview" className="max-h-64 object-contain" />
                   </div>
                </div>
              )}
           </div>
           <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
              <Button onClick={() => { setPodFile(null); setShowPODPortal(false); }} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-normal px-10">Exit</Button>
              <Button 
                disabled={!podFile || isCompressing}
                onClick={() => {
                  updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
                    podUrl: podFile, 
                    status: 'CLOSED',
                    updatedAt: new Date().toISOString() 
                  });
                  setPodFile(null);
                  setShowPODPortal(false);
                  alert('POD Synchronized: Workflow Termination Successful.');
                }} 
                className="bg-emerald-600 text-white rounded-none h-10 uppercase text-[10px] font-normal px-16 shadow-lg"
              >
                Sync & Close
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPODViewer} onOpenChange={setShowPODViewer}>
        <DialogContent className="max-w-4xl h-[90vh] rounded-none border-[3px] border-blue-900 font-mono p-0 flex flex-col text-left text-black">
          <DialogHeader className="bg-slate-50 p-4 border-b border-slate-200 text-left flex flex-row justify-between items-center shrink-0">
             <DialogTitle className="text-[12px] font-normal uppercase text-blue-900 italic">POD Viewer</DialogTitle>
             <div className="flex items-center gap-2">
                <Button variant="outline" className="h-8 rounded-none text-xs" onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedTrip?.podUrl;
                    link.download = `POD_${selectedTrip?.tripNo || selectedTrip?.cnNumber || 'download'}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" className="h-8 rounded-none text-xs" onClick={() => setShowPODViewer(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Close
                </Button>
             </div>
          </DialogHeader>
          <div className="flex-1 p-4 overflow-auto bg-slate-100 flex items-center justify-center">
            {selectedTrip?.podUrl && <img src={selectedTrip.podUrl} alt="POD" className="max-w-full max-h-full object-contain" />}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-[900px] rounded-none border-[3px] border-[#0056d2] font-mono p-0 overflow-hidden text-left text-black">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
             <DialogTitle className="text-[14px] font-normal uppercase text-[#1e3a8a] italic mb-4">VEHICLE ASSIGNMENT PROTOCOL</DialogTitle>
             <div className="grid grid-cols-4 gap-6 bg-white border border-slate-200 p-4 shadow-inner text-[10px] font-normal uppercase">
               <div><span className="text-slate-400 text-[8px]">Consignee</span><p className="truncate">{selectedOrder?.consigneeName}</p></div>
               <div><span className="text-slate-400 text-[8px]">Ship To Party</span><p className="truncate">{selectedOrder?.shipToParty}</p></div>
               <div><span className="text-slate-400 text-[8px]">Route</span><p className="truncate text-emerald-600 italic">{selectedOrder?.from} → {selectedOrder?.destination}</p></div>
               <div><span className="text-slate-400 text-[8px]">Registry Qty</span><p className="text-blue-700">{selectedOrder?.quantity} MT</p></div>
             </div>
          </DialogHeader>
          <div className="p-8 grid grid-cols-2 gap-x-10 gap-y-6 overflow-y-auto max-h-[50vh] green-scrollbar">
             <div className="space-y-1.5">
                <label className="text-[10px] font-normal text-slate-400 uppercase">Fleet Type</label>
                <select 
                  value={assignData.fleetType} 
                  onChange={e => setAssignData({
                    ...assignData,
                    fleetType: e.target.value,
                    arrangeBy: e.target.value === 'Market Vehicle' ? assignData.arrangeBy : ''
                  })} 
                  className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"
                >
                  <option value="Own Vehicle">Own Vehicle</option>
                  <option value="Market Vehicle">Market Vehicle</option>
                </select>
             </div>

             {assignData.fleetType === 'Market Vehicle' && (
               <div className="space-y-1.5">
                  <label className="text-[10px] font-normal text-slate-400 uppercase">Arrange By Party</label>
                  <select 
                    value={assignData.arrangeBy || ''} 
                    onChange={e => setAssignData({ ...assignData, arrangeBy: e.target.value })} 
                    className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"
                  >
                    <option value="">SELECT PARTY...</option>
                    {forwardingAgents?.filter((a: any) => a.status !== 'Inactive').map((agent: any) => (
                      <option key={agent.id} value={agent.arrangeByName}>{agent.arrangeByName}</option>
                    ))}
                  </select>
               </div>
             )}

             <div className="space-y-1.5">
                <label className="text-[10px] font-normal text-slate-400 uppercase">Transport Mode</label>
                <select value={assignData.mode} onChange={e => setAssignData({...assignData, mode: e.target.value, via: e.target.value === 'Road' ? '' : assignData.via})} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none">
                  <option value="Road">Road</option>
                  <option value="Rail to Road">Rail to Road</option>
                </select>
             </div>
             
             {assignData.mode === 'Rail to Road' && (
               <div className="space-y-1.5">
                  <label className="text-[10px] font-normal text-slate-400 uppercase">Station Name</label>
                  <input placeholder="ENTER STATION NAME..." value={assignData.via || ''} onChange={e => setAssignData({...assignData, via: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal outline-none focus:bg-yellow-50" />
               </div>
             )}

             <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Vehicle Number *</label><input value={assignData.vehicleNo || ''} onChange={e => setAssignData({...assignData, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal outline-none focus:bg-yellow-50" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Driver Mobile</label><input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal" /></div>
             
             <div className="space-y-1.5">
                <label className="text-[10px] font-normal text-[#0056d2] uppercase">Assign Qty (MT) *</label>
                <input 
                  type="number" 
                  step="0.001" 
                  value={assignData.assignWeight || ''} 
                  onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} 
                  className="h-9 w-full border border-[#0056d2] px-3 text-xs font-normal outline-none" 
                />
             </div>

             <div className="space-y-1.5">
                <label className="text-[10px] font-normal text-slate-400 uppercase">Assign Date *</label>
                <input 
                  type="datetime-local" 
                  value={assignData.assignDate || ''} 
                  onChange={e => setAssignData({...assignData, assignDate: e.target.value})} 
                  className="h-9 w-full border border-slate-400 px-3 text-xs font-normal" 
                />
             </div>

             {assignData.fleetType === 'Market Vehicle' && (
               <>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-normal text-slate-400 uppercase">Vendor Name (XK03)</label>
                    <select 
                      value={assignData.vendorName || ''} 
                      onChange={e => setAssignData({...assignData, vendorName: e.target.value})} 
                      className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"
                    >
                      <option value="">Select Vendor...</option>
                      {vendors?.map((v: any) => (
                        <option key={v.id} value={v.vendorName}>{v.vendorName} ({v.vendorCode})</option>
                      ))}
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                       <label className="text-[10px] font-normal text-slate-400 uppercase">Secondary Rate (Per MT)</label>
                       <div className="flex items-center gap-2">
                          <Checkbox 
                            id="fix-charge" 
                            checked={assignData.fixRate} 
                            onCheckedChange={checked => setAssignData({...assignData, fixRate: !!checked})} 
                            className="rounded-none border-slate-400"
                          />
                          <label htmlFor="fix-charge" className="text-[8px] font-normal uppercase text-slate-400 cursor-pointer">Fix Charge</label>
                       </div>
                    </div>
                    <input 
                      type="number" 
                      step="0.01" 
                      disabled={assignData.fixRate}
                      value={assignData.rate || ''} 
                      onChange={e => setAssignData({...assignData, rate: e.target.value})} 
                      className={cn("h-9 w-full border border-slate-400 px-3 text-xs font-normal", assignData.fixRate && "bg-slate-50 opacity-50")} 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-normal text-slate-400 uppercase flex items-center gap-2">
                       <Calculator className="h-3 w-3 text-blue-400" /> secondary Freight Amount
                    </label>
                    <input 
                      type="number" 
                      step="0.01" 
                      readOnly={!assignData.fixRate}
                      value={assignData.freightAmount || ''} 
                      onChange={e => setAssignData({...assignData, freightAmount: e.target.value})} 
                      className={cn("h-9 w-full border px-3 text-xs font-normal", assignData.fixRate ? "border-blue-400 bg-white" : "border-slate-300 bg-slate-50 text-slate-500")} 
                    />
                 </div>
               </>
             )}

             <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-normal text-slate-400 uppercase">Carrier Branding (FM03 Node)</label>
                <input 
                  readOnly 
                  value={(companies || []).find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(selectedOrder?.plantCode))?.companyName || 'AUTO-RESOLVING CARRIER...'} 
                  className="h-9 w-full border border-slate-300 bg-slate-50 px-3 text-xs font-normal italic text-slate-400" 
                />
             </div>
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowAssign(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-normal px-10">Exit</Button>
             <Button onClick={handlePostAssignment} className="bg-[#0056d2] text-white rounded-none h-10 uppercase text-[10px] font-normal px-24">Post Protocol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCNPortal} onOpenChange={setShowCNPortal}>
        <DialogContent className="max-w-[1000px] rounded-none border-[3px] border-emerald-600 font-mono p-0 overflow-hidden text-left text-black">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
             <DialogTitle className="text-[14px] font-normal uppercase text-emerald-700 italic mb-4">Documentation Execution: Consignment Note</DialogTitle>
             <div className="grid grid-cols-5 gap-6 bg-white border border-slate-200 p-4 text-[10px] font-normal uppercase">
               <div><span className="text-slate-400 text-[8px]">Plant</span><p>{selectedTrip?.plantCode}</p></div>
               <div><span className="text-slate-400 text-[8px]">Ship To Party</span><p className="truncate">{selectedTrip?.shipToParty}</p></div>
               <div><span className="text-slate-400 text-[8px]">Route</span><p className="italic">{selectedTrip?.from} → {selectedTrip?.destination}</p></div>
               <div><span className="text-slate-400 text-[8px]">Vehicle</span><p className="text-blue-700">{selectedTrip?.vehicleNo}</p></div>
               <div><span className="text-slate-400 text-[8px]">Carrier</span><p className="text-[#0056d2] truncate">{companies?.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(selectedTrip?.plantCode))?.companyName || 'N/A'}</p></div>
             </div>
          </DialogHeader>
          <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto green-scrollbar">
             <div className="grid grid-cols-3 gap-8">
                <div className="space-y-1.5 relative">
                   <div className="flex items-center gap-1.5 mb-1">
                      <History className="h-3 w-3 text-slate-400" />
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Generated CN: <span className="text-blue-600">{lastGeneratedCN}</span></label>
                   </div>
                   <label className="text-[10px] font-normal text-slate-400 uppercase">CN Number *</label>
                   <input 
                     value={cnData.cnNumber || ''} 
                     onChange={e => setCNData({...cnData, cnNumber: e.target.value.toUpperCase()})} 
                     className="h-9 w-full border border-slate-400 px-3 text-xs font-normal bg-white focus:bg-yellow-50 outline-none" 
                   />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                   <label className="text-[10px] font-normal text-slate-400 uppercase">CN Date *</label>
                   <input type="date" value={cnData.cnDate} onChange={e => setCNData({...cnData, cnDate: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal" />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                   <label className="text-[10px] font-normal text-slate-400 uppercase">Payment Terms</label>
                   <select value={cnData.paymentTerms} onChange={e => setCNData({...cnData, paymentTerms: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"><option value="PAID">PAID</option><option value="TO PAY">TO PAY</option></select>
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                   <label className="text-[10px] font-normal text-slate-400 uppercase">Vehicle Number</label>
                   <input 
                     value={vehicleData.vehicleNo || ''} 
                     onChange={e => setVehicleData({...vehicleData, vehicleNo: e.target.value.toUpperCase()})} 
                     className="h-9 w-full border border-slate-400 px-3 text-xs font-normal bg-white focus:bg-yellow-50 outline-none" 
                   />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                   <label className="text-[10px] font-normal text-slate-400 uppercase">Assign Qty (MT)</label>
                   <input 
                     type="number" step="0.001"
                     value={assignData.assignWeight || ''} 
                     onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} 
                     className="h-9 w-full border border-slate-400 px-3 text-xs font-normal bg-white focus:bg-yellow-50 outline-none" 
                   />
                </div>
             </div>
             <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-slate-200 pb-2">
                   <h4 className="text-[10px] font-normal uppercase italic text-slate-600 border-b-2 border-blue-100 w-fit pb-1">Invoice Registry</h4>
                   <Button onClick={() => setCNData({...cnData, invoices: [...(cnData.invoices || []), { id: Math.random().toString(), invNo: '', ewaybillNo: '', desc: '', pkg: '', uom: 'Bag' }]})} variant="outline" className="h-7 text-[8px] uppercase font-normal px-4 rounded-none"><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
                </div>
                <table className="w-full text-left text-[10px]">
                   <thead><tr className="bg-slate-50 font-normal uppercase text-slate-400 border-b border-slate-200"><th className="p-2">Invoice No</th><th className="p-2">E-waybill No</th><th className="p-2">Goods Desc</th><th className="p-2 w-[100px]">Package</th><th className="p-2 w-[120px]">UOM</th><th className="p-2 w-[40px]"></th></tr></thead>
                   <tbody>
                      {(cnData.invoices || []).map((row: any, idx: number) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="p-2"><input value={row.invNo} onChange={e => { const r = [...cnData.invoices]; r[idx].invNo = e.target.value.toUpperCase(); setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-normal" /></td>
                          <td className="p-2"><input value={row.ewaybillNo} onChange={e => { const r = [...cnData.invoices]; r[idx].ewaybillNo = e.target.value; setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-normal" /></td>
                          <td className="p-2"><input value={row.desc} onChange={e => { const r = [...cnData.invoices]; r[idx].desc = e.target.value.toUpperCase(); setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-normal" /></td>
                          <td className="p-2"><input type="number" value={row.pkg} onChange={e => { const r = [...cnData.invoices]; r[idx].pkg = e.target.value; setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-normal" /></td>
                          <td className="p-2"><select value={row.uom} onChange={e => { const r = [...cnData.invoices]; r[idx].uom = e.target.value; setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none bg-transparent font-normal uppercase"><option value="Bag">Bag</option><option value="Box">Box</option><option value="Pieces">Pieces</option><option value="Drum">Drum</option><option value="Mix">Mix</option></select></td>
                          <td className="p-2"><button onClick={() => setCNData({...cnData, invoices: cnData.invoices.filter((_: any, i: number) => i !== idx)})} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button></td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowCNPortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-normal px-10">Cancel</Button>
             <Button onClick={handlePostCN} className="bg-emerald-600 text-white rounded-none h-10 uppercase text-[10px] font-normal px-24">Post Protocol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVehiclePortal} onOpenChange={setShowVehiclePortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-blue-900 font-mono p-0 overflow-hidden text-left text-black">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
             <DialogTitle className="text-[12px] font-normal uppercase text-blue-900 italic mb-4">Vehicle Data Handshake</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
             <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Update Vehicle No *</label><input autoFocus value={vehicleData.vehicleNo} onChange={e => setVehicleData({...vehicleData, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal uppercase" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Update Driver Mobile</label><input value={vehicleData.driverMobile} onChange={e => setVehicleData({...vehicleData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal" /></div>
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowVehiclePortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-normal px-10">Cancel</Button>
             <Button onClick={() => { updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { vehicleNo: vehicleData.vehicleNo.toUpperCase(), driverMobile: vehicleData.driverMobile, updatedAt: new Date().toISOString() }); setShowVehiclePortal(false); }} className="bg-blue-900 text-white rounded-none h-10 uppercase text-[10px] font-normal px-16">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showStatusPortal} onOpenChange={setShowStatusPortal}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-[#1e3a8a] font-mono p-0 overflow-hidden text-left text-black">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
             <DialogTitle className="text-[12px] font-normal uppercase text-[#1e3a8a] italic mb-4">{statusUpdateData.label}</DialogTitle>
             <div className="grid grid-cols-1 gap-2 bg-white border border-slate-200 p-4 shadow-inner text-[9px] font-normal uppercase">
                <div className="flex items-center gap-2"><span className="text-slate-400 text-[8px] w-20 shrink-0">Consignor:</span><span className="truncate font-normal">{statusUpdateData.consignor}</span></div>
                <div className="flex items-center gap-2"><span className="text-slate-400 text-[8px] w-20 shrink-0">Consignee:</span><span className="truncate font-normal">{statusUpdateData.consignee}</span></div>
                <div className="flex items-center gap-2"><span className="text-slate-400 text-[8px] w-20 shrink-0">Route:</span><span className="truncate text-emerald-600 italic font-normal">{statusUpdateData.route}</span></div>
             </div>
          </DialogHeader>
          <div className="p-8 space-y-6">
             <div className="space-y-1.5">
                <label className="text-[10px] font-normal text-slate-400 uppercase flex items-center gap-2">
                   <Clock className="h-3 w-3 text-blue-500" /> Protocol Date & Time *
                </label>
                <input 
                  type="datetime-local" 
                  autoFocus 
                  value={statusUpdateData.timestamp} 
                  onChange={e => setStatusUpdateData({...statusUpdateData, timestamp: e.target.value})} 
                  className="h-10 w-full border border-slate-400 px-3 text-xs font-normal bg-white focus:bg-yellow-50 outline-none" 
                />
             </div>
             <p className="text-[9px] text-slate-400 italic uppercase">Warning: This action will record a permanent transactional node in the control registry.</p>
          </div>
          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
             <Button onClick={() => setShowStatusPortal(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-normal px-10">Exit</Button>
             <Button onClick={handleCommitStatusUpdate} className="bg-[#1e3a8a] text-white rounded-none h-10 uppercase text-[10px] font-normal px-16">Sync Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}