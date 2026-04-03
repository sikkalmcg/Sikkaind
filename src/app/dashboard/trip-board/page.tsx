
'use client';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import TripBoardTable from '@/components/dashboard/trip-board/TripBoardTable';
import TripBoardLayoutModal from '@/components/dashboard/trip-board/TripBoardLayoutModal';
import LRGenerationModal from '@/components/dashboard/lr-create/LRGenerationModal';
import LRPrintPreviewModal from '@/components/dashboard/lr-create/LRPrintPreviewModal';
import PodUploadModal from '@/components/dashboard/trip-board/PodUploadModal';
import TripViewModal from '@/components/dashboard/trip-board/TripViewModal';
import CancelTripModal from '@/components/dashboard/trip-board/CancelTripModal';
import EditVehicleModal from '@/components/dashboard/trip-board/EditVehicleModal';
import ArrivedModal from '@/components/dashboard/trip-board/ArrivedModal';
import UnloadedModal from '@/components/dashboard/trip-board/UnloadedModal';
import RejectModal from '@/components/dashboard/trip-board/RejectModal';
import PodStatusModal from '@/components/dashboard/trip-board/PodStatusModal';
import SrnModal from '@/components/dashboard/trip-board/SrnModal';
import MultiSelectPlantFilter from '@/components/dashboard/MultiSelectPlantFilter';
import type { WithId, Shipment, Trip, Plant, SubUser, Carrier, LR, VehicleEntryExit } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { normalizePlantId, parseSafeDate, sanitizeRegistryNode } from '@/lib/utils';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, doc, getDoc, updateDoc, serverTimestamp, runTransaction, where, limit, onSnapshot, getDocs, addDoc, writeBatch } from "firebase/firestore";
import { Loader2, WifiOff, MonitorPlay, RefreshCcw, Search, Factory, Filter, ArrowRightLeft, Trash2, Ban, ShieldAlert, Sparkles, X, Octagon, CheckCircle2, RotateCcw, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/date-picker';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type TripBoardTab = 'loading' | 'transit' | 'arrived' | 'pod-status' | 'rejection' | 'closed';

function TripBoardContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showLoader, hideLoader } = useLoading();
  
  const activeTab = (searchParams.get('tab') as TripBoardTab) || 'loading';
  const urlPlants = searchParams.get('plants')?.split(',').filter(Boolean) || [];

  const [selectedPlants, setSelectedPlants] = useState<string[]>(urlPlants);
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 30)));
  const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [shipments, setShipments] = useState<WithId<Shipment>[]>([]);
  const [lrs, setLrs] = useState<WithId<LR>[]>([]);
  const [entries, setEntries] = useState<WithId<VehicleEntryExit>[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  
  const [viewTripData, setViewTripData] = useState<any | null>(null);
  const [lrGenerateTrip, setLrGenerateTrip] = useState<any | null>(null);
  const [lrEditData, setLrEditData] = useState<{ trip: any, carrier: any, lr: any } | null>(null);
  const [lrPreviewData, setLrPreviewData] = useState<EnrichedLR | null>(null);
  const [cancelTripData, setCancelTripData] = useState<any | null>(null);
  const [editVehicleTrip, setEditVehicleTrip] = useState<any | null>(null);

  // New Modal States
  const [arrivedTrip, setArrivedTrip] = useState<any | null>(null);
  const [unloadedTrip, setUnloadedTrip] = useState<any | null>(null);
  const [rejectTrip, setRejectTrip] = useState<any | null>(null);
  const [podStatusTrip, setPodStatusTrip] = useState<any | null>(null);
  const [srnTrip, setSrnTrip] = useState<any | null>(null);

  const isAdminSession = useMemo(() => {
    return user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
  }, [user]);

  const masterPlantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: allMasterPlants } = useCollection<Plant>(masterPlantsQuery);
  const carriersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "carriers")) : null, [firestore]);
  const { data: dbCarriers } = useCollection<Carrier>(carriersQuery);

  useEffect(() => {
    if (!firestore || !user) return;
    const fetchAuth = async () => {
        setIsAuthLoading(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) userDocSnap = qSnap.docs[0];

            const baseList = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : mockPlants;
            let authIds: string[] = [];

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
                authIds = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdminSession) {
                authIds = baseList.map(p => p.id);
            }

            setAuthorizedPlantIds(authIds);
            setPlants(baseList.filter(p => authIds.some(aid => normalizePlantId(aid) === normalizePlantId(p.id))));
            if (authIds.length > 0 && selectedPlants.length === 0) {
                setSelectedPlants(authIds);
            }
        } catch (e) { setDbError(true); } finally { setIsAuthLoading(false); }
    };
    fetchAuth();
  }, [firestore, user, allMasterPlants, isAdminSession]);

  useEffect(() => {
    if (!firestore || selectedPlants.length === 0) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];

    selectedPlants.forEach((plantId) => {
      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/trips`), (snap) => {
        const list = snap.docs.map(d => ({ 
            id: d.id, 
            originPlantId: plantId, 
            ...d.data(), 
            startDate: parseSafeDate(d.data().startDate) 
        } as any));
        setTrips(prev => [...prev.filter(t => t.originPlantId !== plantId), ...list]);
        setIsLoading(false);
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/shipments`), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, originPlantId: plantId, ...d.data() } as any));
        setShipments(prev => [...prev.filter(s => s.originPlantId !== plantId), ...list]);
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/lrs`), (snap) => {
        const list = snap.docs.map(d => ({
          id: d.id,
          originPlantId: plantId,
          ...d.data(),
          date: parseSafeDate(d.data().date)
        } as any));
        setLrs(prev => [...prev.filter(l => l.originPlantId !== plantId), ...list]);
      }));
    });

    unsubscribers.push(onSnapshot(collection(firestore, "vehicleEntries"), (snap) => {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }));

    return () => unsubscribers.forEach(u => u());
  }, [firestore, JSON.stringify(selectedPlants)]);

  const allFilteredData = useMemo(() => {
    return trips.map(t => {
      const shipId = Array.isArray(t.shipmentIds) ? t.shipmentIds[0] : t.shipmentIds;
      const shipment = shipments.find(s => s.id === shipId || s.shipmentId === shipId);
      const lr = lrs.find(l => l.tripDocId === t.id || l.tripId === t.tripId);
      const entry = entries.find(e => e.tripId === t.id);
      const carrier = dbCarriers?.find(c => c.id === t.carrierId);

      const items = lr?.items || t.items || shipment?.items || [];
      const invoiceNumbers = Array.from(new Set(items.map((i: any) => i.invoiceNumber).filter(Boolean))).join(', ');
      const description = Array.from(new Set(items.map((i: any) => i.itemDescription || i.description).filter(Boolean))).join(', ') || t.itemDescription || shipment?.material || '--';
      const units = items.reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0);

      const dispatchedQty = lr ? (Number(lr.assignedTripWeight) || 0) : (Number(t.assignedQtyInTrip || t.assignQty) || 0);

      return {
        ...t,
        plantName: plants.find(p => normalizePlantId(p.id) === normalizePlantId(t.originPlantId))?.name || t.originPlantId,
        invoiceNumbers: invoiceNumbers || shipment?.invoiceNumber || '--',
        itemDescription: description,
        lrUnits: units || shipment?.totalUnits || '--',
        dispatchedQty,
        shipmentObj: shipment,
        lrData: lr,
        carrierObj: carrier,
        entry,
        lrNumber: lr?.lrNumber || t.lrNumber || shipment?.lrNumber || '',
        lrDate: parseSafeDate(lr?.date || t.lrDate || shipment?.lrDate),
        consignor: t.consignor || shipment?.consignor || '--',
        consignee: t.billToParty || shipment?.billToParty || '--',
        material: shipment?.itemDescription || shipment?.material || '--',
        qtyUom: `${t.assignedQtyInTrip} ${shipment?.materialTypeId || 'MT'}`
      };
    });
  }, [trips, shipments, lrs, entries, plants, dbCarriers]);

  const finalData = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : null;
    const dayEnd = toDate ? endOfDay(toDate) : null;

    return allFilteredData.filter(t => {
      if (selectedPlants.length > 0 && !selectedPlants.some(pid => normalizePlantId(pid) === normalizePlantId(t.originPlantId))) return false;
      const start = t.startDate;
      if (dayStart && start && start < dayStart) return false;
      if (dayEnd && start && start > dayEnd) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return Object.values(t).some(val => val?.toString().toLowerCase().includes(s));
      }
      return true;
    });
  }, [allFilteredData, fromDate, toDate, searchTerm, selectedPlants]);

  const tabFilteredData = useMemo(() => {
    return finalData.filter(t => {
        const status = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim().replace(/[\s_-]+/g, '-');
        const isOut = t.entry?.status === 'OUT';
        const isPod = t.podReceived === true;

        switch (activeTab) {
            case 'loading': return !isOut && (status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete');
            case 'transit': return status === 'in-transit' || status === 'out-for-delivery' || status === 'break-down';
            case 'arrived': return ['arrived', 'arrival-for-delivery', 'arrive-for-deliver'].includes(status);
            case 'pod-status': return (['arrived', 'arrival-for-delivery', 'arrive-for-deliver', 'delivered'].includes(status)) && !isPod;
            case 'rejection': return status === 'rejected';
            case 'closed': return isPod || status === 'closed' || status === 'trip-closed' || status === 'delivered';
            default: return true;
        }
    });
  }, [finalData, activeTab]);

  const counts = useMemo(() => {
    const res = { loading: 0, transit: 0, arrived: 0, podStatus: 0, rejection: 0, closed: 0 };
    finalData.forEach(t => {
        const status = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim().replace(/[\s_-]+/g, '-');
        const isOut = t.entry?.status === 'OUT';
        const isPod = t.podReceived === true;
        
        if (!isOut && (status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete')) res.loading++;
        if (status === 'in-transit' || status === 'out-for-delivery' || status === 'break-down') res.transit++;
        if (['arrived', 'arrival-for-delivery', 'arrive-for-deliver'].includes(status)) res.arrived++;
        if ((['arrived', 'arrival-for-delivery', 'arrive-for-deliver', 'delivered'].includes(status)) && !isPod) res.podStatus++;
        if (status === 'rejected') res.rejection++;
        if (isPod || status === 'closed' || status === 'trip-closed' || status === 'delivered') res.closed++;
    });
    return res;
  }, [finalData]);

  const handlePostAction = async (id: string, updateData: any) => {
    if (!firestore) return;
    const trip = trips.find(t => t.id === id);
    if (!trip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(trip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, id);
        const globalTripRef = doc(firestore, 'trips', id);
        const ts = serverTimestamp();

        await updateDoc(tripRef, { ...updateData, lastUpdated: ts });
        await updateDoc(globalTripRef, { ...updateData, lastUpdated: ts });
        
        toast({ title: 'Registry Updated' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    } finally {
        hideLoader();
    }
  };

  const handleReSentAction = async (trip: any) => {
    showLoader();
    try {
        const plantId = normalizePlantId(trip.originPlantId);
        const tripRef = doc(firestore!, `plants/${plantId}/trips`, trip.id);
        const globalTripRef = doc(firestore!, 'trips', trip.id);
        const ts = serverTimestamp();

        const updateData = {
            tripStatus: 'Assigned',
            currentStatusId: 'assigned',
            lastUpdated: ts,
            rejectedAt: null,
            rejectReason: null
        };

        await updateDoc(tripRef, updateData);
        await updateDoc(globalTripRef, updateData);
        toast({ title: 'Mission Re-Initialized', description: 'Trip moved back to Loading tab.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Resent Failed', description: e.message });
    } finally {
        hideLoader();
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full relative">
      {isExtracting && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
              <div className="p-8 bg-white rounded-3xl shadow-2xl border flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Extracting Manifest...</p>
              </div>
          </div>
      )}

      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><MonitorPlay className="h-7 w-7" /></div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight uppercase italic">Trip Monitoring HUB</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-Time Mission Dispatch & Lifecycle Manifest</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
            <Input placeholder="Search board registry..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-[320px] h-11 rounded-2xl bg-slate-50 border-slate-200 font-bold shadow-inner" />
          </div>
          <Button variant="outline" onClick={() => window.location.reload()} size="icon" className="h-11 w-11 rounded-xl text-blue-900 border-slate-200"><RefreshCcw className="h-5 w-5" /></Button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-10">
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <div className="bg-slate-50 border-b p-8 flex flex-wrap items-end justify-between gap-6">
                <div className="flex flex-wrap items-end gap-10">
                    <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                          <Factory className="h-3 w-3" /> Plant Node Registry
                        </Label>
                        <MultiSelectPlantFilter options={plants} selected={selectedPlants} onChange={setSelectedPlants} isLoading={isAuthLoading} />
                    </div>
                    <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1"><Filter className="h-3 w-3" /> Start Node</Label><DatePicker date={fromDate} setDate={setFromDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" /></div>
                    <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1"><Filter className="h-3 w-3" /> End Node</Label><DatePicker date={toDate} setDate={setTodayDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" /></div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => { const params = new URLSearchParams(searchParams); params.set('tab', v); router.replace(`${pathname}?${params.toString()}`, { scroll: false }); }} className="w-full">
                <TabsList className="bg-white px-4 md:px-8 h-14 border-b rounded-none w-full justify-start gap-6 md:gap-10 overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-hide shrink-0">
                    <TabsTrigger value="loading" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Loading ({counts.loading})</TabsTrigger>
                    <TabsTrigger value="transit" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Transit ({counts.transit})</TabsTrigger>
                    <TabsTrigger value="arrived" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Arrived ({counts.arrived})</TabsTrigger>
                    <TabsTrigger value="pod-status" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">POD Status ({counts.podStatus})</TabsTrigger>
                    <TabsTrigger value="rejection" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-red-600 data-[state=active]:text-red-600 flex items-center gap-2 whitespace-nowrap">Rejection ({counts.rejection})</TabsTrigger>
                    <TabsTrigger value="closed" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Closed ({counts.closed})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={paginatedData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession} 
                        onAction={(type, trip) => {
                            if (type === 'arrived') setArrivedTrip(trip);
                            else if (type === 'unloaded') setUnloadedTrip(trip);
                            else if (type === 'reject') setRejectTrip(trip);
                            else if (type === 'pod-status') setPodStatusTrip(trip);
                            else if (type === 'srn') setSrnTrip(trip);
                            else if (type === 're-sent') handleReSentAction(trip);
                            else if (type === 'view') setViewTripData(trip);
                            else if (type === 'track') router.push(`/dashboard/shipment-tracking?search=${trip.vehicleNumber}`);
                            else if (type === 'edit-vehicle') setEditVehicleTrip(trip);
                            else if (type === 'cancel') setCancelTripData(trip);
                        }} 
                    />
                    <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-10">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Rows per page:</span>
                                <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                                    <SelectTrigger className="h-9 w-[80px] rounded-xl border-slate-200 bg-white font-black text-xs shadow-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl"><SelectItem value="10" className="font-bold py-2">10</SelectItem><SelectItem value="25" className="font-bold py-2">25</SelectItem><SelectItem value="50" className="font-bold py-2">50</SelectItem><SelectItem value="100" className="font-bold py-2">100</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} itemCount={tabFilteredData.length} />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </Card>
      </div>

      {/* Registry Modals */}
      {arrivedTrip && <ArrivedModal isOpen={!!arrivedTrip} onClose={() => setArrivedTrip(null)} trip={arrivedTrip} onPost={(data) => handlePostAction(arrivedTrip.id, { ...data, tripStatus: 'Arrived', currentStatusId: 'arrived' })} />}
      {unloadedTrip && <UnloadedModal isOpen={!!unloadedTrip} onClose={() => setUnloadedTrip(null)} trip={unloadedTrip} onPost={(data) => handlePostAction(unloadedTrip.id, { ...data, tripStatus: 'Delivered', currentStatusId: 'delivered', actualCompletionDate: serverTimestamp() })} />}
      {rejectTrip && <RejectModal isOpen={!!rejectTrip} onClose={() => setRejectTrip(null)} trip={rejectTrip} onPost={(data) => handlePostAction(rejectTrip.id, { ...data, tripStatus: 'Rejected', currentStatusId: 'rejected', rejectedAt: serverTimestamp() })} />}
      {podStatusTrip && <PodStatusModal isOpen={!!podStatusTrip} onClose={() => setPodStatusTrip(null)} trip={podStatusTrip} onPost={(data) => handlePostAction(podStatusTrip.id, { ...data })} />}
      {srnTrip && <SrnModal isOpen={!!srnTrip} onClose={() => setSrnTrip(null)} trip={srnTrip} onPost={(data) => handlePostAction(srnTrip.id, { ...data, tripStatus: 'Closed', currentStatusId: 'closed' })} />}
      
      {viewTripData && <TripViewModal isOpen={!!viewTripData} onClose={() => setViewTripData(null)} trip={viewTripData} />}
      {editVehicleTrip && <EditVehicleModal isOpen={!!editVehicleTrip} onClose={() => setEditVehicleTrip(null)} trip={editVehicleTrip} onSave={async (id, values) => handlePostAction(id, values)} />}
      {cancelTripData && <CancelTripModal isOpen={!!cancelTripData} onClose={() => setCancelTripData(null)} trip={cancelTripData} onConfirm={async () => { /* reuse existing executePurge logic if needed */ }} />}
    </div>
  );
}

export default function TripBoardPage() {
    return <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}><TripBoardContent /></Suspense>;
}
