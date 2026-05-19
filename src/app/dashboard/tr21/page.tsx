'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  Filter, Search, MapPin, Truck, Radar, 
  X, Trash2, Plus, FileText, ChevronLeft, ChevronRight, Printer,
  Loader2, CheckCircle, FileUp, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useUser } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import placeholderData from '@/app/lib/placeholder-images.json';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

export default function TR21Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
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
  const [showCNPreview, setShowCNPreview] = React.useState(false);
  const [showPODPortal, setShowPODPortal] = React.useState(false);
  
  const [podFile, setPodFile] = React.useState<string | null>(null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const podInputRef = React.useRef<HTMLInputElement>(null);

  const registryId = typeof window !== 'undefined' ? localStorage.getItem('sap_registry_id') : null;
  const isBootstrapAdmin = typeof window !== 'undefined' ? localStorage.getItem('sap_bootstrap_session') === 'true' : false;

  const profileRef = useMemoFirebase(() => {
    if (!registryId || isBootstrapAdmin) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'users_master', registryId);
  }, [db, registryId, isBootstrapAdmin]);
  const { data: userProfile } = useDoc(profileRef);

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

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: plants } = useCollection(plantsQuery);
  const { data: companies } = useCollection(companiesQuery);
  const { data: customers } = useCollection(customersQuery);

  const authorizedPlantCodes = React.useMemo(() => {
    if (isBootstrapAdmin) return null;
    return userProfile?.plantAccess || [];
  }, [isBootstrapAdmin, userProfile]);

  React.useEffect(() => {
    if (authorizedPlantCodes && authorizedPlantCodes.length > 0 && plantFilter === 'ALL') {
      setPlantFilter(authorizedPlantCodes[0]);
    }
  }, [authorizedPlantCodes, plantFilter]);

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
    const carrier = companies?.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(selectedTrip.plantCode)) || companies?.[0];
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', selectedTrip.id), { 
      ...cnData, 
      carrierName: carrier?.companyName || '',
      updatedAt: new Date().toISOString() 
    });
    setShowCNPortal(false);
    alert('Documentation Synchronized');
  };

  const handleUpdateStatus = (tripId: string, newStatus: string, dateField?: string) => {
    const updates: any = { status: newStatus, updatedAt: new Date().toISOString() };
    if (dateField) updates[dateField] = new Date().toISOString();
    updateDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trip_board', tripId), updates);
    alert(`Node Status Updated: ${newStatus}`);
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

  const currentCarrier = React.useMemo(() => {
    if (!selectedTrip || !companies) return null;
    return companies.find(c => c.companyName === selectedTrip.carrierName) || companies.find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(selectedTrip.plantCode)) || companies[0];
  }, [selectedTrip, companies]);

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
            <button key={l} onClick={() => { setActiveTab(l); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-normal uppercase tracking-widest border-r border-slate-300 shrink-0", activeTab === l ? "bg-white text-[#0056d2] border-t-2 border-t-[#0056d2]" : "text-slate-500 hover:bg-white/50")}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner custom-scrollbar relative flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[2000px] text-[11px]">
              <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300 font-normal uppercase text-slate-500">
                {activeTab === 'Open Orders' ? (
                  <tr>
                    <th className="p-3 border-r w-[80px]">Plant</th>
                    <th className="p-3 border-r w-[180px]">Sale Order/Date</th>
                    <th className="p-3 border-r w-[200px]">Consignor</th>
                    <th className="p-3 border-r w-[200px]">Consignee</th>
                    <th className="p-3 border-r w-[200px]">Ship to Party</th>
                    <th className="p-3 border-r w-[200px]">Route</th>
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
                    <th className="p-3 border-r w-[150px]">Vehicle/Mobile</th>
                    <th className="p-3 border-r w-[180px]">Carrier/Vendor</th>
                    <th className="p-3 border-r w-[100px]">Fleet Type</th>
                    <th className="p-3 border-r w-[150px]">CN No/Date</th>
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
                        <td className="p-3 border-r text-right text-slate-400 font-normal">{parseFloat(item.quantity || 0).toFixed(3)}</td>
                        <td className="p-3 border-r text-right text-emerald-600 font-normal">{parseFloat(item.dispatched || 0).toFixed(3)}</td>
                        <td className="p-3 border-r text-right font-normal text-blue-600">{parseFloat(item.balance || 0).toFixed(3)}</td>
                        <td className="p-3 text-center">
                          <Button onClick={() => { setSelectedOrder(item); setAssignData({ ...assignData, assignWeight: item.balance.toFixed(3) }); setShowAssign(true); }} className="h-7 w-20 text-[9px] font-normal bg-[#1e3a8a] rounded-none">Assign</Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 border-r text-left">
                          <button onClick={() => { setSelectedTrip(item); setVehicleData({vehicleNo: item.vehicleNo, driverMobile: item.driverMobile}); setShowVehiclePortal(true); }} className="flex flex-col text-left hover:underline">
                            <span className="font-normal text-blue-800">{item.vehicleNo || 'ADD'}</span>
                            <span className="text-[9px] text-slate-400 font-normal">{item.driverMobile || '-'}</span>
                          </button>
                        </td>
                        <td className="p-3 border-r text-left">
                           {(() => {
                              const carrier = (companies || []).find(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(item.plantCode));
                              return (
                                <div className="flex flex-col leading-tight overflow-hidden">
                                  <span className="text-[#0056d2] font-normal text-[10px] truncate" title={carrier?.companyName || item.carrierName}>
                                    {carrier?.companyName || item.carrierName || 'PENDING'}
                                  </span>
                                  <span className="text-slate-500 font-normal text-[9px] truncate" title={item.vendorName}>
                                    {item.vendorName || '-'}
                                  </span>
                                </div>
                              );
                           })()}
                        </td>
                        <td className="p-3 border-r text-[9px] font-normal text-slate-400">{item.fleetType}</td>
                        <td className="p-3 border-r text-left">
                           <div className="flex flex-col leading-tight">
                             {item.cnNumber ? (
                               <button onClick={() => { setSelectedTrip(item); setShowCNPreview(true); }} className="text-left group font-normal">
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
                        <td className="p-3 text-center flex flex-col gap-1 items-center justify-center min-w-[100px]">
                          {activeTab === 'Loading' && (
                            <>
                              <Button onClick={() => handleUpdateStatus(item.id, 'IN-TRANSIT', 'outDate')} className="h-6 w-20 text-[8px] font-normal bg-[#1e3a8a] text-white rounded-none">OUT</Button>
                              <Button onClick={() => { setSelectedTrip(item); setCNData(item.cnNumber ? item : { ...cnData, invoices: item.invoices || [{ id: '1', invNo: '', ewaybillNo: '', desc: '', pkg: '', uom: 'Bag' }] }); setShowCNPortal(true); }} className="h-6 w-20 text-[8px] font-normal bg-emerald-600 text-white rounded-none">CN ENTRY</Button>
                            </>
                          )}
                          {activeTab === 'In-Transit' && (
                            <>
                              <Button onClick={() => handleUpdateStatus(item.id, 'ARRIVED', 'arrivedDate')} className="h-6 w-20 text-[8px] font-normal bg-emerald-600 text-white rounded-none">ARRIVED</Button>
                              <Button onClick={() => { setSelectedTrip(item); setCNData(item); setShowCNPortal(true); }} variant="outline" className="h-6 w-20 text-[8px] font-normal border-slate-300 rounded-none">CN EDIT</Button>
                            </>
                          )}
                          {activeTab === 'Arrived' && (
                            <>
                              <Button onClick={() => handleUpdateStatus(item.id, 'POD')} className="h-6 w-20 text-[8px] font-normal bg-emerald-600 text-white rounded-none">UNLOAD</Button>
                              <Button onClick={() => handleUpdateStatus(item.id, 'REJECTION')} className="h-6 w-20 text-[8px] font-normal bg-red-600 text-white rounded-none">REJECT</Button>
                              <Button onClick={() => { setSelectedTrip(item); setCNData(item); setShowCNPortal(true); }} variant="outline" className="h-6 w-20 text-[8px] font-normal border-slate-300 rounded-none">CN EDIT</Button>
                            </>
                          )}
                          {activeTab === 'Reject' && (
                            <>
                              <Button className="h-6 w-20 text-[8px] font-normal bg-blue-600 text-white rounded-none">RESENT</Button>
                              <Button className="h-6 w-20 text-[8px] font-normal bg-slate-800 text-white rounded-none">SRN</Button>
                            </>
                          )}
                          {(activeTab === 'POD Verify' || activeTab === 'Closed') && (
                            <Button onClick={() => { setSelectedTrip(item); setShowPODPortal(true); }} className={cn("h-6 w-24 text-[8px] font-normal rounded-none", item.podUrl ? "bg-emerald-600" : "bg-orange-600")}>
                               {item.podUrl ? 'VIEW POD' : 'UPLOAD POD'}
                            </Button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
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
                <div className="p-4 bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                   <span className="text-[9px] font-normal uppercase text-emerald-700">Current POD Active</span>
                   <Button variant="outline" className="h-6 text-[8px] font-normal rounded-none border-emerald-300" onClick={() => window.open(selectedTrip.podUrl, '_blank')}>View Original</Button>
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

      <Dialog open={showCNPreview} onOpenChange={setShowCNPreview}>
        <DialogContent className="max-w-[1000px] h-[90vh] rounded-none border-[3px] border-black font-sans p-0 overflow-hidden flex flex-col text-left text-black">
          <DialogHeader className="bg-white p-4 border-b border-black flex flex-row items-center justify-between shrink-0 no-print text-left">
             <div className="flex flex-col text-left">
                <DialogTitle className="text-sm font-normal uppercase italic text-black">Consignment Note Preview</DialogTitle>
                <span className="text-[9px] font-normal text-black uppercase tracking-widest">Protocol Matrix: 3-Copy A4 System</span>
             </div>
             <div className="flex gap-2">
                <Button onClick={() => window.print()} className="h-9 bg-black hover:bg-black/90 text-white rounded-none text-[10px] font-normal uppercase px-8 flex items-center gap-2 shadow-md">
                   <Printer className="h-4 w-4" /> Print Protocol
                </Button>
                <Button onClick={() => setShowCNPreview(false)} variant="outline" className="h-9 border-black text-black rounded-none text-[10px] font-normal uppercase px-8 flex items-center gap-2">
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
        <DialogContent className="max-w-[900px] rounded-none border-[3px] border-[#0056d2] font-mono p-0 overflow-hidden text-left text-black">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
             <DialogTitle className="text-[14px] font-normal uppercase text-[#1e3a8a] italic mb-4">Vehicle Assignment Protocol</DialogTitle>
             <div className="grid grid-cols-4 gap-6 bg-white border border-slate-200 p-4 shadow-inner text-[10px] font-normal uppercase">
                <div><span className="text-slate-400 text-[8px]">Consignee</span><p className="truncate">{selectedOrder?.consigneeName}</p></div>
                <div><span className="text-slate-400 text-[8px]">Ship To Party</span><p className="truncate">{selectedOrder?.shipToParty}</p></div>
                <div><span className="text-slate-400 text-[8px]">Route</span><p className="truncate text-emerald-600 italic">{selectedOrder?.from} → {selectedOrder?.destination}</p></div>
                <div><span className="text-slate-400 text-[8px]">Registry Qty</span><p className="text-blue-700">{selectedOrder?.quantity} MT</p></div>
             </div>
          </DialogHeader>
          <div className="p-8 grid grid-cols-2 gap-x-10 gap-y-6">
             <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Vehicle Number *</label><input value={assignData.vehicleNo || ''} onChange={e => setAssignData({...assignData, vehicleNo: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal outline-none focus:bg-yellow-50" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Driver Mobile</label><input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal" /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Fleet Type</label><select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"><option value="Own Vehicle">Own Vehicle</option><option value="Market Vehicle">Market Vehicle</option></select></div>
             <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Transport Mode</label><select value={assignData.mode} onChange={e => setAssignData({...assignData, mode: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"><option value="Road">Road</option><option value="Road from Rail">Road from Rail</option></select></div>
             <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Carrier/Vendor Name</label><input value={assignData.vendorName || ''} onChange={e => setAssignData({...assignData, vendorName: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal uppercase" placeholder="ENTER NAME..." /></div>
             <div className="space-y-1.5"><label className="text-[10px] font-normal text-[#0056d2] uppercase">Assign Qty (MT) *</label><input type="number" step="0.001" value={assignData.assignWeight || ''} onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} className="h-9 w-full border border-[#0056d2] px-3 text-xs font-normal outline-none" /></div>
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
                <div><span className="text-slate-400 text-[8px]">Carrier</span><p className="text-[#0056d2] truncate">{currentCarrier?.companyName || 'N/A'}</p></div>
             </div>
          </DialogHeader>
          <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto green-scrollbar">
             <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">CN Number *</label><input value={cnData.cnNumber || ''} onChange={e => setCNData({...cnData, cnNumber: e.target.value.toUpperCase()})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">CN Date *</label><input type="date" value={cnData.cnDate} onChange={e => setCNData({...cnData, cnDate: e.target.value})} className="h-9 w-full border border-slate-400 px-3 text-xs font-normal" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-normal text-slate-400 uppercase">Payment Terms</label><select value={cnData.paymentTerms} onChange={e => setCNData({...cnData, paymentTerms: e.target.value})} className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"><option value="PAID">PAID</option><option value="TO PAY">TO PAY</option></select></div>
             </div>
             <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-slate-200 pb-2">
                   <h4 className="text-[10px] font-normal uppercase italic text-slate-600 border-b-2 border-blue-100 w-fit pb-1">Invoice Registry</h4>
                   <Button onClick={() => setCNData({...cnData, invoices: [...cnData.invoices, { id: Math.random().toString(), invNo: '', ewaybillNo: '', desc: '', pkg: '', uom: 'Bag' }]})} variant="outline" className="h-7 text-[8px] uppercase font-normal px-4 rounded-none"><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
                </div>
                <table className="w-full text-left text-[10px]">
                   <thead><tr className="bg-slate-50 font-normal uppercase text-slate-400 border-b border-slate-200"><th className="p-2">Invoice No</th><th className="p-2">E-waybill No</th><th className="p-2">Goods Desc</th><th className="p-2 w-[100px]">Package</th><th className="p-2 w-[120px]">UOM</th><th className="p-2 w-[40px]"></th></tr></thead>
                   <tbody>
                      {cnData.invoices.map((row: any, idx: number) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="p-2"><input value={row.invNo} onChange={e => { const r = [...cnData.invoices]; r[idx].invNo = e.target.value.toUpperCase(); setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-normal" /></td>
                          <td className="p-2"><input value={row.ewaybillNo} onChange={e => { const r = [...cnData.invoices]; r[idx].ewaybillNo = e.target.value; setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-normal" /></td>
                          <td className="p-2"><input value={row.desc} onChange={e => { const r = [...cnData.invoices]; r[idx].desc = e.target.value.toUpperCase(); setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-normal" /></td>
                          <td className="p-2"><input type="number" value={row.pkg} onChange={e => { const r = [...cnData.invoices]; r[idx].pkg = e.target.value; setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none focus:bg-yellow-50 px-1 font-normal" /></td>
                          <td className="p-2"><select value={row.uom} onChange={e => { const r = [...cnData.invoices]; r[idx].uom = e.target.value; setCNData({...cnData, invoices: r}); }} className="h-7 w-full border-none outline-none bg-transparent font-normal uppercase"><option value="Bag">Bag</option><option value="Box">Box</option><option value="Pieces">Pieces</option><option value="Mix">Mix</option></select></td>
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
    </div>
  );
}

function CNPreviewContent({ trip, carrier, customers }: { trip: any, carrier: any, customers: any[] | null }) {
  const logoFallback = placeholderData.placeholderImages.find(p => p.id === 'logo-old');
  const copies = ['CONSIGNEE COPY', 'DRIVER COPY', 'CONSIGNOR COPY'];
  
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

  const termsList = React.useMemo(() => {
    const rawTerms = carrier?.termsAndConditions;
    const defaultTerms = '1. THE CARRIER HOLDS NO LIABILITY FOR SHORTAGE NOT REPORTED AT ARRIVAL.\n2. ALL DISPUTES FALL UNDER CORPORATE HQ JURISDICTION.\n3. WEIGHT BASED ON PARTY DECLARATIONS.';
    const termsString = typeof rawTerms === 'string' && rawTerms.trim() ? rawTerms : defaultTerms;
    return termsString.split('\n').filter((t: string) => t.trim());
  }, [carrier]);

  const consignor = customers?.find(c => c.customerCode === trip.consignorCode);
  const consignee = customers?.find(c => c.customerCode === trip.consigneeCode);
  const shipToParty = customers?.find(c => c.customerCode === trip.shipToPartyCode);

  return (
    <div className="flex flex-col gap-0 bg-white text-black font-normal">
      {copies.map((copyLabel, index) => (
        <div key={index} className="cn-page bg-white overflow-hidden text-left flex flex-col text-black font-normal border-b last:border-b-0 p-[15mm] min-h-[297mm]">
          <div className="flex justify-between items-start mb-6">
            <div className="flex gap-2 items-start">
              {(carrier?.logoUrl || logoFallback?.url) && (
                <div className="relative w-[90px] h-[42px] shrink-0">
                  <Image 
                    src={carrier?.logoUrl || logoFallback?.url || ''} 
                    alt="Carrier Logo" 
                    fill 
                    className="object-contain grayscale" 
                    unoptimized 
                  />
                </div>
              )}
              <div className="space-y-0.5">
                <h1 className="text-[17px] font-normal uppercase italic tracking-tighter leading-none text-black">{carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                <p className="text-[10px] uppercase max-w-[400px] leading-tight text-black font-normal">{carrier?.address}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-normal uppercase text-black pt-1">
                  <span>GSTIN: {carrier?.gstNo || 'UNREGISTERED'}</span>
                  {carrier?.panNo && <span>PAN: {carrier.panNo}</span>}
                  <span>MOB: {carrier?.mobile}</span>
                  <span>EMAIL: {carrier?.email}</span>
                  {carrier?.website && <span>WEB: {carrier.website}</span>}
                </div>
              </div>
            </div>
            <div className="border border-black px-5 py-2 text-[10px] font-normal uppercase italic bg-white tracking-widest shrink-0 text-black">{copyLabel}</div>
          </div>

          <div className="mb-4">
             <table className="w-full border-collapse border border-black text-[12px]">
                <thead>
                   <tr className="bg-white uppercase text-[8px] font-normal text-black border-b border-black">
                      <th className="p-2 border-r border-black text-center font-normal">CN Number</th>
                      <th className="p-2 border-r border-black text-center font-normal">Date</th>
                      <th className="p-2 border-r border-black text-center font-normal">From</th>
                      <th className="p-2 border-r border-black text-center font-normal">Via</th>
                      <th className="p-2 text-center font-normal">To</th>
                   </tr>
                </thead>
                <tbody>
                   <tr className="uppercase font-normal text-black text-[12px]">
                      <td className="p-2 border-r border-black text-center">CN No: {trip.cnNumber || 'DRAFT'}</td>
                      <td className="p-2 border-r border-black text-center">{trip.cnDate ? format(new Date(trip.cnDate), 'dd-MMM-yyyy') : '-'}</td>
                      <td className="p-2 border-r border-black text-center text-[10px]">{trip.from}</td>
                      <td className="p-2 border-r border-black text-center text-[10px]">{trip.via || '-'}</td>
                      <td className="p-2 text-center text-[10px]">{trip.destination}</td>
                   </tr>
                </tbody>
             </table>
          </div>

          <div className="mb-6 text-black">
             <table className="w-full border-collapse border border-black text-[12px]">
                <thead>
                   <tr className="bg-white uppercase text-[8px] font-normal text-black border-b border-black">
                      <th className="p-2 border-r border-black w-1/5 text-center font-normal">Vehicle Number</th>
                      <th className="p-2 border-r border-black w-1/5 text-center font-normal">Driver Mobile</th>
                      <th className="p-2 border-r border-black w-1/5 text-center font-normal">Payment Term</th>
                      <th className="p-2 border-r border-black w-1/5 text-center font-normal">Mode</th>
                      <th className="p-2 w-1/5 text-center font-normal">Trip ID</th>
                   </tr>
                </thead>
                <tbody>
                   <tr className="uppercase font-normal text-black text-[12px]">
                      <td className="p-2 border-r border-black text-center">{trip.vehicleNo}</td>
                      <td className="p-2 border-r border-black text-center">{trip.driverMobile || '-'}</td>
                      <td className="p-2 border-r border-black text-center text-[10px]">{trip.paymentTerms}</td>
                      <td className="p-2 border-r border-black text-center text-[10px]">{trip.mode}</td>
                      <td className="p-2 text-center text-[10px]">{trip.tripNo}</td>
                   </tr>
                </tbody>
             </table>
          </div>

          <div className="grid grid-cols-3 gap-0 mb-6 border border-black">
             <div className="border-r border-black p-4 space-y-4 min-h-[160px]">
                <h4 className="text-[10px] font-normal uppercase text-black italic mb-2 tracking-widest">Consignor</h4>
                <div className="text-[10px] uppercase font-normal space-y-1.5 text-black">
                   <p className="text-[10px] font-normal">{trip.consignorName}</p>
                   <p className="leading-relaxed text-black whitespace-pre-wrap">{consignor?.address}</p>
                   <p>MOB: {consignor?.mobile}</p>
                   <p className="text-[10px] pt-1 text-black font-normal">GSTIN: {consignor?.gstNo || consignor?.gstin}</p>
                </div>
             </div>
             <div className="border-r border-black p-4 space-y-4 min-h-[160px]">
                <h4 className="text-[10px] font-normal uppercase text-black italic mb-2 tracking-widest">Consignee</h4>
                <div className="text-[10px] uppercase font-normal space-y-1.5 text-black">
                   <p className="text-[10px] font-normal">{trip.consigneeName}</p>
                   <p className="leading-relaxed text-black whitespace-pre-wrap">{consignee?.address}</p>
                   <p className="text-[10px] pt-1 text-black font-normal">GSTIN: {consignee?.gstNo || consignee?.gstin}</p>
                </div>
             </div>
             <div className="p-4 space-y-4 min-h-[160px] bg-white text-black">
                <h4 className="text-[10px] font-normal uppercase text-black italic mb-2 tracking-widest">Ship To Party</h4>
                <div className="text-[10px] uppercase font-normal space-y-1.5 text-black">
                   <p className="text-[10px] font-normal">{trip.shipToParty}</p>
                   <p className="leading-relaxed text-black whitespace-pre-wrap">{shipToParty?.address}</p>
                   <p>MOB: {shipToParty?.mobile}</p>
                   <p className="text-[10px] pt-1 text-black font-normal">GSTIN: {shipToParty?.gstNo || shipToParty?.gstin}</p>
                </div>
             </div>
          </div>

          <div className="mb-6">
             <table className="w-full border-collapse text-[11px] border border-black">
                <thead>
                   <tr className="bg-white uppercase text-[8px] font-normal text-black border-b border-black">
                      <th className="p-2 border-r border-black w-[130px] text-left font-normal">Invoice No</th>
                      <th className="p-2 border-r border-black w-[160px] text-left font-normal">E-Waybill No</th>
                      <th className="p-2 border-r border-black text-left font-normal">Description</th>
                      <th className="p-2 border-r border-black w-[110px] text-center font-normal">Package</th>
                      <th className="p-2 w-[110px] text-right font-normal">Weight (MT)</th>
                   </tr>
                </thead>
                <tbody>
                   {trip.invoices?.filter((inv: any) => inv.invNo).map((inv: any, i: number) => (
                      <tr key={i} className="border-b border-black last:border-b-0 uppercase font-normal text-black text-[11px]">
                         <td className="p-2 border-r border-black">{inv.invNo}</td>
                         <td className="p-2 border-r border-black">{inv.ewaybillNo}</td>
                         <td className="p-2 border-r border-black leading-snug text-[11px]">{inv.desc}</td>
                         <td className="p-2 border-r border-black text-center">{inv.pkg} {inv.uom}</td>
                         <td className="p-2 text-right">{i === 0 ? parseFloat(trip.assignWeight || 0).toFixed(3) : '-'}</td>
                      </tr>
                   ))}
                </tbody>
                <tfoot>
                   <tr className="bg-white font-normal text-[15px] uppercase border-t border-black">
                      <td colSpan={3} className="p-3 text-right text-black italic border-r border-black">Gross Total:</td>
                      <td className="p-3 text-center text-black font-normal border-r border-black">{packageSummary}</td>
                      <td className="p-3 text-right text-black font-normal">{parseFloat(trip.assignWeight || 0).toFixed(3)} MT</td>
                   </tr>
                </tfoot>
             </table>
          </div>

          <div className="mt-auto space-y-8 text-black">
             <div className="flex justify-between items-end">
                <div className="space-y-3 max-w-[60%]">
                   <h5 className="text-[8px] font-normal uppercase text-black tracking-widest italic border-b border-black w-fit pb-1">Terms & Conditions</h5>
                   <div className="space-y-1 text-black font-normal">
                      {termsList.map((term: string, i: number) => (
                        <p key={i} className="text-[8px] leading-relaxed text-justify text-black uppercase font-normal">
                          {term.trim()}
                        </p>
                      ))}
                   </div>
                </div>
                <div className="text-right space-y-10 pr-4">
                   <div className="h-12"></div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-normal uppercase italic tracking-tighter text-black">Authorized Signature</p>
                   </div>
                </div>
             </div>
             <div className="text-center pt-4 border-t border-black">
                <p className="text-[10px] font-normal uppercase tracking-tighter italic text-black">
                   This Consignment Note was generated digitally and is to be considered as original.
                </p>
             </div>
          </div>
        </div>
      ))}
    </div>
  );
}