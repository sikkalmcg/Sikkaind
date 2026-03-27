'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, getDocs, getDoc, Timestamp, where, updateDoc, serverTimestamp, addDoc, orderBy, runTransaction, limit, onSnapshot, deleteDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/date-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { 
    Loader2, 
    WifiOff, 
    Settings2, 
    Search, 
    RefreshCcw, 
    MonitorPlay, 
    FileDown, 
    Factory, 
    Filter, 
    ShieldCheck, 
    CheckCircle2, 
    AlertTriangle, 
    PlayCircle, 
    Truck, 
    MapPin, 
    FileText 
} from "lucide-react";
import { subDays, startOfDay, endOfDay, format, isValid } from "date-fns";
import type { WithId, Shipment, Trip, Plant, SubUser, Carrier, LR, VehicleEntryExit } from '@/types';
import TripBoardTable from '@/components/dashboard/trip-board/TripBoardTable';
import TripBoardLayoutModal from '@/components/dashboard/trip-board/TripBoardLayoutModal';
import LRGenerationModal from '@/components/dashboard/lr-create/LRGenerationModal';
import LRPrintPreviewModal from '@/components/dashboard/lr-create/LRPrintPreviewModal';
import PodUploadModal from '@/components/dashboard/trip-board/PodUploadModal';
import TripViewModal from '@/components/dashboard/trip-board/TripViewModal';
import CancelTripModal from '@/components/dashboard/trip-board/CancelTripModal';
import VehicleAssignModal from '@/components/dashboard/vehicle-assign/VehicleAssignModal';
import MultiSelectPlantFilter from '@/components/dashboard/MultiSelectPlantFilter';
import EditVehicleModal from '@/components/dashboard/trip-board/EditVehicleModal';
import { mockPlants, mockCarriers } from '@/lib/mock-data';
import { normalizePlantId, sanitizeRegistryNode } from '@/lib/utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLoading } from '@/context/LoadingContext';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { cn } from '@/lib/utils';

export type TripBoardTab = 'active' | 'loading' | 'transit' | 'arrived' | 'pod-pending' | 'closed';

function TripBoardContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showLoader, hideLoader } = useLoading();
  
  const activeTab = (searchParams.get('tab') as TripBoardTab) || 'active';
  const urlPlants = searchParams.get('plants')?.split(',').filter(Boolean) || [];

  const [selectedPlants, setSelectedPlants] = useState<string[]>(urlPlants);
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 30)));
  const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [operatorFullName, setOperatorFullName] = useState('');
  
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [shipments, setShipments] = useState<WithId<Shipment>[]>([]);
  const [lrs, setLrs] = useState<WithId<LR>[]>([]);
  const [entries, setEntries] = useState<WithId<VehicleEntryExit>[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [podUploadTrip, setPodUploadTrip] = useState<any | null>(null);
  const [viewTripData, setViewTripData] = useState<any | null>(null);
  const [lrGenerateTrip, setLrGenerateTrip] = useState<any | null>(null);
  const [lrPreviewData, setLrPreviewData] = useState<EnrichedLR | null>(null);
  const [cancelTripData, setCancelTripData] = useState<any | null>(null);
  const [changeVehicleTrip, setChangeVehicleTrip] = useState<any | null>(null);
  const [editVehicleTrip, setEditVehicleTrip] = useState<any | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);

  const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);
  const carriersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "carriers")) : null, [firestore]);
  const { data: dbCarriers } = useCollection<Carrier>(carriersQuery);

  const updateURL = useCallback((plantIds: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (plantIds.length > 0) {
      params.set('plants', plantIds.join(','));
    } else {
      params.delete('plants');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const fetchAuthorizedPlants = useCallback(async () => {
    if (!firestore || !user) return;
    setIsAuthLoading(true);
    try {
      const lastIdentity = localStorage.getItem('slmc_last_identity');
      const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
      
      let userDocSnap = null;
      const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        userDocSnap = qSnap.docs[0];
      } else {
        const uidSnap = await getDoc(doc(firestore, "users", user.uid));
        if (uidSnap.exists()) userDocSnap = uidSnap;
      }

      const baseList = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : mockPlants;
      let authIds: string[] = [];
      let isRoot = false;

      if (userDocSnap) {
        const userData = userDocSnap.data() as SubUser;
        isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
        authIds = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
        setOperatorFullName(userData.fullName || userData.username || 'Operator');
      } else if (isAdminSession) {
        isRoot = true;
        authIds = baseList.map(p => p.id);
        setOperatorFullName('AJAY SOMRA');
      }

      setIsAdmin(isRoot);
      setAuthorizedPlantIds(authIds);
      const filtered = baseList.filter(p => authIds.some(aid => normalizePlantId(aid).toLowerCase() === normalizePlantId(p.id).toLowerCase()));
      setPlants(filtered);
      
      if (filtered.length > 0 && selectedPlants.length === 0 && urlPlants.length === 0) {
        const allIds = filtered.map(p => p.id);
        setSelectedPlants(allIds);
        updateURL(allIds);
      }
    } catch (e) {
      console.error(e);
      setDbError(true);
    } finally {
      setIsAuthLoading(false);
    }
  }, [firestore, user, allMasterPlants, updateURL, selectedPlants.length, urlPlants.length, isAdminSession]);

  useEffect(() => { fetchAuthorizedPlants(); }, [fetchAuthorizedPlants]);

  const handlePlantChange = (ids: string[]) => {
    setSelectedPlants(ids);
    updateURL(ids);
  };

  useEffect(() => {
    if (!firestore || !user || selectedPlants.length === 0) {
      setTrips([]);
      setShipments([]);
      setLrs([]);
      setEntries([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];

    selectedPlants.forEach((plantId) => {
      const parseDate = (val: any) => val instanceof Timestamp ? val.toDate() : (val ? new Date(val) : null);

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/trips`), (snap) => {
        const plantTrips = snap.docs.map(d => ({ 
          id: d.id, 
          originPlantId: plantId,
          ...d.data(), 
          startDate: parseDate(d.data().startDate),
          lrDate: d.data().lrDate ? parseDate(d.data().lrDate) : undefined,
          outDate: d.data().outDate ? parseDate(d.data().outDate) : undefined,
          arrivalDate: d.data().arrivalDate ? parseDate(d.data().arrivalDate) : undefined,
          actualCompletionDate: parseDate(d.data().actualCompletionDate),
          podUploadDate: parseDate(d.data().podUploadDate),
          podVerifiedAt: parseDate(d.data().podVerifiedAt),
        } as WithId<Trip>));
        setTrips(prev => [...prev.filter(t => t.originPlantId !== plantId), ...plantTrips]);
        setIsLoading(false);
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/shipments`), (snap) => {
        const plantShipments = snap.docs.map(d => ({ 
          id: d.id, 
          originPlantId: plantId, 
          ...d.data(),
          creationDate: parseDate(d.data().creationDate),
        } as WithId<Shipment>));

        setShipments(prev => [...prev.filter(s => s.originPlantId !== plantId), ...plantShipments] );
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/lrs`), (snap) => {
        const plantLrs = snap.docs.map(d => ({ 
          id: d.id, 
          originPlantId: plantId, 
          ...d.data(),
          date: parseDate(d.data().date)
        } as WithId<LR>));

        setLrs(prev => [...prev.filter(l => l.originPlantId !== plantId), ...plantLrs]);
      }));

      unsubscribers.push(onSnapshot(query(collection(firestore, "vehicleEntries")), (snap) => {
        const plantEntries = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          entryTimestamp: parseDate(d.data().entryTimestamp),
          exitTimestamp: d.data().exitTimestamp ? parseDate(d.data().exitTimestamp) : undefined
        } as WithId<VehicleEntryExit>));
        setEntries(plantEntries);
      }));
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [firestore, user, JSON.stringify(selectedPlants)]);

  const allFilteredData = useMemo(() => {
    return trips.map(t => {
      const shipment = shipments.find(s => s.id === t.shipmentIds?.[0]);
      const lr = lrs.find(l => l.tripDocId === t.id || l.tripId === t.tripId);
      
      const entry = entries.find(e => e.tripId === t.id) || 
                    entries.filter(e => e.vehicleNumber === t.vehicleNumber)
                           .sort((a,b) => b.entryTimestamp.getTime() - a.entryTimestamp.getTime())[0];

      const carrierObj = (dbCarriers || mockCarriers).find(c => c.id === t.carrierId);
      const masterPlant = plants?.find(p => p.id === t.originPlantId || normalizePlantId(p.id) === normalizePlantId(t.originPlantId));

      const parseDate = (val: any) => val instanceof Date ? val : (val instanceof Timestamp ? val.toDate() : null);

      return {
        ...t,
        entry,
        lrData: lr,
        shipmentObj: shipment,
        carrierObj: carrierObj,
        plant: masterPlant,
        startDate: parseDate(t.startDate),
        tripCreateDate: parseDate(t.startDate),
        orderCreateDate: shipment ? parseDate(shipment.creationDate) : null,
        plantName: masterPlant?.name || t.originPlantId,
        shipmentId: shipment?.shipmentId || '--',
        consignor: shipment?.consignor || '--',
        loadingPoint: shipment?.loadingPoint || '--',
        billToParty: shipment?.billToParty || '--',
        shipToParty: t.shipToParty || shipment?.shipToParty || '--',
        unloadingPoint: t.unloadingPoint || shipment?.unloadingPoint || '--',
        orderQty: shipment?.quantity || 0,
        balanceQty: shipment ? (shipment.quantity - (shipment.assignedQty || 0)) : 0,
        carrier: carrierObj?.name || '--',
        dispatchedQty: lr ? (Number(lr.assignedTripWeight) || 0) : 0,
        lrQty: lr ? lr.items?.reduce((sum: number, i: any) => sum + (Number(i.weight) || 0), 0) : 0,
        lrUnits: lr ? lr.items?.reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0) : 0,
        lrNumber: t.lrNumber || shipment?.lrNumber || '',
        lrDate: t.lrDate || shipment?.lrDate || null,
      };
    });
  }, [trips, shipments, lrs, entries, dbCarriers, plants]);

  const filteredBase = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : null;
    const dayEnd = toDate ? endOfDay(toDate) : null;

    return allFilteredData.filter(t => {
      // Normalizing status for logic consistency
      const statusRaw = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim();
      const status = statusRaw.replace(/[\s_-]+/g, '-');
      const isClosed = ['delivered', 'closed', 'trip-closed', 'cancelled'].includes(status);

      // REGISTRY RULE: Active trips should ALWAYS show up regardless of date selection to maintain operational visibility
      if (!isClosed) return true;

      // Closed trips strictly follow the range registry
      const compareDate = t.actualCompletionDate || t.startDate;
      if (dayStart && compareDate && compareDate < dayStart) return false;
      if (dayEnd && compareDate && compareDate > dayEnd) return false;
      return true;
    });
  }, [allFilteredData, fromDate, toDate]);

  const filteredTrips = useMemo(() => {
    return filteredBase.filter(t => {
      const isOut = t.entry?.status === 'OUT';
      const isPodReceived = t.podReceived === true;
      const statusRaw = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim();
      const status = statusRaw.replace(/[\s_-]+/g, '-');
      
      const hasVehicle = t.vehicleNumber && t.vehicleNumber.trim() !== '';
      if (!hasVehicle) return false;

      // Tab logic forceful sync
      if (activeTab === 'loading') {
          return !isOut && (status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete');
      }
      
      if (activeTab === 'transit') {
          return status === 'in-transit';
      }

      if (activeTab === 'arrived') {
          return status === 'arrived' || status === 'arrival-for-delivery' || status === 'arrived-at-destination' || status === 'arrive-for-deliver';
      }

      if (activeTab === 'pod-pending') {
          return (status === 'arrived' || status === 'arrival-for-delivery' || status === 'arrived-at-destination' || status === 'arrive-for-deliver' || status === 'delivered') && !isPodReceived;
      }

      if (activeTab === 'closed') {
          return isPodReceived || status === 'closed' || status === 'trip-closed';
      }

      if (activeTab === 'active') {
          // Mission stays active until finalizing delivery pulse
          return !['delivered', 'closed', 'trip-closed', 'cancelled'].includes(status);
      }

      return true;
    }).filter(t => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return Object.values(t).some(v => v?.toString().toLowerCase().includes(s));
    });
  }, [filteredBase, activeTab, searchTerm]);

  const counts = useMemo(() => {
    const res = { active: 0, loading: 0, transit: 0, arrived: 0, podPending: 0, closed: 0 };
    filteredBase.forEach(t => {
      const hasVehicle = t.vehicleNumber && t.vehicleNumber.trim() !== '';
      if (!hasVehicle) return;

      const isOut = t.entry?.status === 'OUT';
      const isPodReceived = t.podReceived === true;
      const statusRaw = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim();
      const status = statusRaw.replace(/[\s_-]+/g, '-');

      if (!isOut && (status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete')) res.loading++;
      if (status === 'in-transit') res.transit++;
      if (status === 'arrived' || status === 'arrival-for-delivery' || status === 'arrived-at-destination' || status === 'arrive-for-deliver') res.arrived++;
      if ((status === 'arrived' || status === 'arrival-for-delivery' || status === 'arrived-at-destination' || status === 'arrive-for-deliver' || status === 'delivered') && !isPodReceived) res.podPending++;
      if (isPodReceived || status === 'closed' || status === 'trip-closed') res.closed++;

      if (!['delivered', 'closed', 'trip-closed', 'cancelled'].includes(status)) {
          res.active++;
      }
    });
    return res;
  }, [filteredBase]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
            <MonitorPlay className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight uppercase italic">Trip Monitoring HUB</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-Time Mission Dispatch & Lifecycle Manifest</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
            <Input 
                placeholder="Search board registry..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10 w-[320px] h-11 rounded-2xl bg-slate-50 border-slate-200 font-bold focus-visible:ring-blue-900 shadow-inner" 
            />
          </div>
          <Button variant="outline" onClick={() => window.location.reload()} size="icon" className="h-11 w-11 rounded-xl text-blue-900 border-slate-200 hover:bg-slate-50 shadow-sm transition-all">
            <RefreshCcw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-10">
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group">
            <div className="bg-slate-50 border-b p-8 flex flex-wrap items-end gap-10">
                <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Factory className="h-3 w-3" /> Plant Node Registry
                    </Label>
                    {isAuthLoading ? (
                        <div className="h-11 w-[220px] bg-white rounded-xl animate-pulse" />
                    ) : isAdminSession || authorizedPlantIds.length > 1 ? (
                        <MultiSelectPlantFilter 
                            options={plants || []} 
                            selected={selectedPlants} 
                            onChange={handlePlantChange} 
                            isLoading={isAuthLoading} 
                        />
                    ) : (
                        <div className="h-11 px-5 flex items-center bg-blue-50 border border-blue-100 rounded-xl text-blue-900 font-black text-xs shadow-sm uppercase tracking-tighter min-w-[220px]">
                            <ShieldCheck className="h-4 w-4 mr-2 text-blue-600" /> {plants?.find(p => p.id === authorizedPlantIds[0])?.name || authorizedPlantIds[0]}
                        </div>
                    )}
                </div>

                <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Filter className="h-3 w-3" /> Start Date Node
                    </Label>
                    <DatePicker date={fromDate} setDate={setFromDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" />
                </div>

                <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Filter className="h-3 w-3" /> End Date Node
                    </Label>
                    <DatePicker date={toDate} setDate={setTodayDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" />
                </div>

                <div className="ml-auto flex items-center gap-3 self-end pb-0.5">
                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl text-slate-400 hover:text-blue-900 hover:bg-blue-50 transition-all" onClick={() => setIsLayoutModalOpen(true)}>
                        <Settings2 className="h-6 w-6" />
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => { const params = new URLSearchParams(searchParams); params.set('tab', v); router.replace(`${pathname}?${params.toString()}`, { scroll: false }); }} className="w-full">
                <TabsList className="bg-white px-8 h-14 border-b rounded-none w-full justify-start gap-10">
                    {[
                        { id: 'active', label: 'Active Missions', count: counts.active, icon: PlayCircle },
                        { id: 'loading', label: 'In-Yard Loading', count: counts.loading, icon: Factory },
                        { id: 'transit', label: 'In-Transit Registry', count: counts.transit, icon: Truck },
                        { id: 'arrived', label: 'Arrive for Deliver', count: counts.arrived, icon: MapPin },
                        { id: 'pod-pending', label: 'POD Pending', count: counts.podPending, icon: FileText },
                        { id: 'closed', label: 'Closed Registry', count: counts.closed, icon: CheckCircle2 },
                    ].map((t) => (
                        <TabsTrigger 
                            key={t.id} 
                            value={t.id} 
                            className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 transition-all data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2"
                        >
                            <t.icon className="h-3.5 w-3.5" />
                            {t.label} 
                            <Badge className={cn(
                                "ml-1.5 h-5 px-2 border-none font-black text-[9px]",
                                activeTab === t.id ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-400"
                            )}>
                                {t.count}
                            </Badge>
                        </TabsTrigger>
                    ))}
                </TabsList>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <TabsContent value={activeTab} className="mt-0 focus-visible:ring-0">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-40">
                                <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Establishing Registry Pulse...</p>
                            </div>
                        ) : selectedPlants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-center opacity-30 gap-4 grayscale group">
                                <Factory className="h-20 w-20 transition-transform duration-500 group-hover:scale-110" />
                                <div className="space-y-1">
                                    <p className="text-xl font-black uppercase tracking-tighter">No Node Context Established</p>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Please pick at least one lifting node to view the mission board.</p>
                                </div>
                            </div>
                        ) : (
                            <TripBoardTable 
                                data={filteredTrips} 
                                activeTab={activeTab} 
                                isAdmin={isAdmin}
                                canVerifyPod={isAdminSession} 
                                onVerifyPod={(trip) => {
                                    const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
                                    const globalRef = doc(firestore, 'trips', trip.id);
                                    const currentName = isAdminSession ? 'AJAY SOMRA' : (user?.displayName || user?.email?.split('@')[0]);
                                    updateDoc(tripRef, { podStatus: 'Verified', tripStatus: 'Closed', podVerifiedBy: currentName, podVerifiedAt: serverTimestamp(), lastUpdated: serverTimestamp() });
                                    updateDoc(globalRef, { podStatus: 'Verified', tripStatus: 'Closed', podVerifiedBy: currentName, podVerifiedAt: serverTimestamp(), lastUpdated: serverTimestamp() });
                                    toast({ title: "POD Verified", description: `Documentation for ${trip.lrNumber} finalized.` });
                                }} 
                                onUploadPod={setPodUploadTrip} 
                                onGenerateLR={(t) => setLrGenerateTrip({ trip: t, carrier: (dbCarriers || mockCarriers).find(c => c.id === t.carrierId) || mockCarriers[0] })} 
                                onViewLR={(row) => { 
                                    if (!row.lrData) return; 
                                    const parseDate = (val: any) => val instanceof Timestamp ? val.toDate() : (val ? new Date(val) : new Date()); 
                                    setLrPreviewData({ 
                                        ...row.lrData, 
                                        date: parseDate(row.lrData.date), 
                                        trip: row, 
                                        carrier: row.carrierObj || (dbCarriers || mockCarriers)[0], 
                                        shipment: row.shipmentObj || { materialTypeId: 'MT' },
                                        plant: row.plant
                                    } as EnrichedLR); 
                                }} 
                                onViewTrip={setViewTripData} 
                                onUpdatePod={setPodUploadTrip} 
                                onCancelTrip={setCancelTripData} 
                                onEditTrip={(trip) => {
                                    setSelectedShipment(trip.shipmentObj || {
                                        id: trip.shipmentIds[0],
                                        originPlantId: trip.originPlantId,
                                        shipmentId: trip.shipmentId,
                                        consignor: trip.consignor,
                                        loadingPoint: trip.loadingPoint,
                                        billToParty: trip.billToParty,
                                        shipToParty: trip.shipToParty,
                                        unloadingPoint: trip.unloadingPoint,
                                        balanceQty: trip.balanceQty,
                                        quantity: trip.orderQty,
                                        assignedQty: trip.assignedQty,
                                        materialTypeId: 'MT'
                                    });
                                    setChangeVehicleTrip(trip);
                                }} 
                                onTrack={(row) => router.push(`/dashboard/tracking/consignment?search=${row.tripId}`)} 
                                onEditVehicle={setEditVehicleTrip} 
                            />
                        )}
                    </TabsContent>
                </div>
            </Tabs>
        </Card>
      </div>

      <TripBoardLayoutModal isOpen={isLayoutModalOpen} onClose={() => setIsLayoutModalOpen(false)} activeTab={activeTab} />
      
      {lrGenerateTrip && (
          <LRGenerationModal 
            isOpen={!!lrGenerateTrip} 
            onClose={() => setLrGenerateTrip(null)} 
            trip={lrGenerateTrip.trip} 
            carrier={lrGenerateTrip.carrier} 
            lrToEdit={lrGenerateTrip.trip.lrData} 
            onGenerate={() => setLrGenerateTrip(null)} 
          />
      )}
      
      {lrPreviewData && <LRPrintPreviewModal isOpen={!!lrPreviewData} onClose={() => setPreviewLr(null)} lr={lrPreviewData} />}
      {podUploadTrip && <PodUploadModal isOpen={!!podUploadTrip} onClose={() => setPodUploadTrip(null)} trip={podUploadTrip} onSuccess={() => setPodUploadTrip(null)} />}
      {viewTripData && <TripViewModal isOpen={!!viewTripData} onClose={() => setViewTripData(null)} trip={viewTripData} />}
      
      {cancelTripData && (
          <CancelTripModal 
            isOpen={!!cancelTripData} 
            onClose={() => setCancelTripData(null)} 
            trip={cancelTripData} 
            onConfirm={async () => {
                if (!firestore || !cancelTripData || !user) return;
                showLoader();
                try {
                    await runTransaction(firestore, async (transaction) => {
                        const plantId = cancelTripData.originPlantId;
                        const tripRef = doc(firestore, `plants/${plantId}/trips`, cancelTripData.id);
                        const globalTripRef = doc(firestore, 'trips', cancelTripData.id);
                        const shipmentId = cancelTripData.shipmentIds[0];
                        const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipmentId);
                        const shipmentSnap = await transaction.get(shipmentRef);
                        
                        if (!shipmentSnap.exists()) throw new Error("Sale Order registry error.");
                        const shipmentData = shipmentSnap.data() as Shipment;
                        const newAssignedTotal = Math.max(0, (shipmentData.assignedQty || 0) - cancelTripData.assignedQtyInTrip);
                        const newBalanceTotal = shipmentData.quantity - newAssignedTotal;
                        
                        if (cancelTripData.vehicleId) {
                            const vehicleRef = doc(firestore, 'vehicles', cancelTripData.vehicleId);
                            const vSnap = await transaction.get(vehicleRef);
                            if (vSnap.exists()) {
                                transaction.update(vehicleRef, { status: 'Available' });
                            }
                        }
                        
                        transaction.delete(tripRef);
                        transaction.delete(globalTripRef);
                        transaction.update(shipmentRef, { assignedQty: newAssignedTotal, balanceQty: newBalanceTotal, currentStatusId: newAssignedTotal === 0 ? 'pending' : 'Partly Vehicle Assigned', lastUpdateDate: serverTimestamp() });
                    });

                    const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System Operator');
                    const sanitizedData = sanitizeRegistryNode({ ...cancelTripData, type: 'Trip' });

                    await addDoc(collection(firestore, "recycle_bin"), {
                        pageName: "Trip Board (Revocation)",
                        userName: currentName,
                        deletedAt: serverTimestamp(),
                        data: sanitizedData
                    });

                    toast({ title: 'Mission Revoked', description: `Trip purged and archived in recycle bin. Order balance restored.` });
                    setCancelTripData(null);
                } catch (error: any) {
                    toast({ variant: 'destructive', title: "Revocation Failed", description: error.message });
                } finally {
                    hideLoader();
                }
            }} 
          />
      )}

      {changeVehicleTrip && selectedShipment && (
          <VehicleAssignModal 
            isOpen={!!changeVehicleTrip} 
            onClose={() => {setChangeVehicleTrip(null); setSelectedShipment(null); }} 
            shipment={selectedShipment} 
            trip={changeVehicleTrip} 
            carriers={dbCarriers || []} 
            onAssignmentComplete={() => {setChangeVehicleTrip(null); setSelectedShipment(null); }} 
          />
      )}

      {editVehicleTrip && (
          <EditVehicleModal 
            isOpen={!!editVehicleTrip} 
            onClose={() => setEditVehicleTrip(null)} 
            trip={editVehicleTrip} 
            onSave={async (tripId, values) => {
                if (!firestore || !user) return;
                const targetTrip = allFilteredData.find(t => t.id === tripId);
                if (!targetTrip) return;
                showLoader();
                try {
                    await runTransaction(firestore, async (transaction) => {
                        const plantId = targetTrip.originPlantId;
                        const tripRef = doc(firestore, `plants/${plantId}/trips`, tripId);
                        const globalTripRef = doc(firestore, 'trips', tripId);
                        const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'Operator');
                        const timestamp = serverTimestamp();
                        const newVehicle = values.vehicleNumber.toUpperCase().replace(/\s/g, '');
                        
                        transaction.update(tripRef, { vehicleNumber: newVehicle, driverMobile: values.driverMobile, lastUpdated: timestamp });
                        transaction.update(globalTripRef, { vehicleNumber: newVehicle, driverMobile: values.driverMobile, lastUpdated: timestamp });
                        
                        const entryToUpdate = targetTrip.entry;
                        if (entryToUpdate) {
                            transaction.update(doc(firestore, 'vehicleEntries', entryToUpdate.id), { vehicleNumber: newVehicle, driverMobile: values.driverMobile, lastUpdated: timestamp });
                        }
                        if (targetTrip.lrData) {
                            transaction.update(doc(firestore, `plants/${plantId}/lrs`, targetTrip.lrData.id), { vehicleNumber: newVehicle, driverMobile: values.driverMobile, updatedAt: timestamp });
                        }
                    });
                    toast({ title: 'Registry Synchronized', description: `Vehicle updated across all mission nodes.` });
                    setEditVehicleTrip(null);
                } catch (e: any) {
                    toast({ variant: 'destructive', title: 'Correction Failed', description: e.message });
                } finally {
                    hideLoader();
                }
            }} 
          />
      )}
    </div>
  );
}

export default function TripBoardPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <TripBoardContent />
        </Suspense>
    );
}
