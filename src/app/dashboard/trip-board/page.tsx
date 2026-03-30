
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
import type { WithId, Shipment, Trip, Plant, SubUser, Carrier, LR, VehicleEntryExit } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { normalizePlantId, parseSafeDate } from '@/lib/utils';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, getDocs, updateDoc, serverTimestamp, runTransaction, where, limit, onSnapshot } from "firebase/firestore";
import { Loader2, WifiOff, MonitorPlay, RefreshCcw, Search, Factory, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/date-picker';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';

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
  const [editVehicleTrip, setEditVehicleTrip] = useState<any | null>(null);

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);
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
            if (qSnap.empty) {
                const uidRef = doc(firestore, "users", user.uid);
                const uidSnap = await getDoc(uidRef);
                if (uidSnap.exists()) userDocSnap = uidSnap;
            } else {
                userDocSnap = qSnap.docs[0];
            }

            const baseList = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : mockPlants;
            let authIds: string[] = [];
            const isAdminSession = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
                authIds = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdminSession) {
                authIds = baseList.map(p => p.id);
            }

            setAuthorizedPlantIds(authIds);
            setPlants(baseList.filter(p => authIds.some(aid => normalizePlantId(aid) === normalizePlantId(p.id))));
            if (authIds.length > 0 && selectedPlants.length === 0) setSelectedPlants(authIds);
        } catch (e) { setDbError(true); } finally { setIsAuthLoading(false); }
    };
    fetchAuth();
  }, [firestore, user, allMasterPlants]);

  useEffect(() => {
    if (!firestore || selectedPlants.length === 0) return;
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
      const lr = lrs.find(l => l.tripDocId === t.id || l.tripId === t.tripId || (l.lrNumber === t.lrNumber && l.originPlantId === t.originPlantId));
      const entry = entries.find(e => e.tripId === t.id);
      const carrier = dbCarriers?.find(c => c.id === t.carrierId);

      const items = lr?.items || shipment?.items || [];
      const invoiceNumbers = Array.from(new Set(items.map((i: any) => i.invoiceNumber).filter(Boolean))).join(', ');
      const description = Array.from(new Set(items.map((i: any) => i.itemDescription || i.description).filter(Boolean))).join(', ') || t.itemDescription || shipment?.material || '--';
      const units = items.reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0);

      const consignor = t.consignor || shipment?.consignor || '--';
      const billToParty = t.billToParty || shipment?.billToParty || '--';
      const shipToParty = t.shipToParty || shipment?.shipToParty || '--';
      const unloadingPoint = t.unloadingPoint || shipment?.unloadingPoint || t.destination || '--';
      const dispatchedQty = lr ? (Number(lr.assignedTripWeight) || 0) : (Number(t.assignedQtyInTrip || t.assignQty) || 0);

      const lrNumber = lr?.lrNumber || t.lrNumber || shipment?.lrNumber || '';
      const lrDate = parseSafeDate(lr?.date || t.lrDate || shipment?.lrDate);

      return {
        ...t,
        plantName: plants.find(p => normalizePlantId(p.id) === normalizePlantId(t.originPlantId))?.name || t.originPlantId,
        consignor,
        billToParty,
        shipToParty,
        unloadingPoint,
        invoiceNumbers: invoiceNumbers || shipment?.invoiceNumber || '--',
        itemDescription: description,
        lrUnits: units || shipment?.totalUnits || '--',
        dispatchedQty,
        shipmentObj: shipment,
        lrData: lr,
        carrierObj: carrier,
        entry,
        lrNumber,
        lrDate
      };
    });
  }, [trips, shipments, lrs, entries, plants, dbCarriers]);

  const finalData = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : null;
    const dayEnd = toDate ? endOfDay(toDate) : null;

    return allFilteredData.filter(t => {
      if (selectedPlants.length > 0 && !selectedPlants.some(pid => normalizePlantId(pid) === normalizePlantId(t.originPlantId))) return false;

      const start = t.startDate;
      if (!start) return true; 

      if (dayStart && start < dayStart) return false;
      if (dayEnd && start > dayEnd) return false;
      
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return Object.values(t).some(val => val?.toString().toLowerCase().includes(s));
      }
      return true;
    });
  }, [allFilteredData, fromDate, toDate, searchTerm, selectedPlants]);

  const tabFilteredData = useMemo(() => {
    return finalData.filter(t => {
        const status = (t.tripStatus || t.currentStatusId || '').toLowerCase().replace(/[\s_-]+/g, '-');
        const isOut = t.entry?.status === 'OUT';
        const isPod = t.podReceived === true;

        switch (activeTab) {
            case 'active':
                return !['delivered', 'closed', 'trip-closed', 'cancelled'].includes(status);
            case 'loading':
                return !isOut && (status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete');
            case 'transit':
                return status === 'in-transit';
            case 'arrived':
                return ['arrived', 'arrival-for-delivery', 'arrived-at-destination'].includes(status);
            case 'pod-pending':
                return (['arrived', 'arrival-for-delivery', 'delivered'].includes(status)) && !isPod;
            case 'closed':
                return isPod || status === 'closed' || status === 'trip-closed';
            default:
                return true;
        }
    });
  }, [finalData, activeTab]);

  const counts = useMemo(() => {
    const res = { active: 0, loading: 0, transit: 0, arrived: 0, podPending: 0, closed: 0 };
    finalData.forEach(t => {
        const status = (t.tripStatus || t.currentStatusId || '').toLowerCase().replace(/[\s_-]+/g, '-');
        const isOut = t.entry?.status === 'OUT';
        const isPod = t.podReceived === true;

        if (!['delivered', 'closed', 'trip-closed', 'cancelled'].includes(status)) res.active++;
        if (!isOut && (status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete')) res.loading++;
        if (status === 'in-transit') res.transit++;
        if (['arrived', 'arrival-for-delivery', 'arrived-at-destination'].includes(status)) res.arrived++;
        if (['arrived', 'arrival-for-delivery', 'delivered'].includes(status) && !isPod) res.podPending++;
        if (isPod || status === 'closed' || status === 'trip-closed') res.closed++;
    });
    return res;
  }, [finalData]);

  const onViewLR = async (row: any) => {
    if (!row.lrNumber || !firestore) return;
    showLoader();
    try {
        const plantId = normalizePlantId(row.originPlantId);
        const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
        
        let q = query(lrsRef, where("lrNumber", "==", row.lrNumber), limit(1));
        let snap = await getDocs(q);
        
        const plantObj = plants.find(p => normalizePlantId(p.id) === normalizePlantId(row.originPlantId)) || { id: row.originPlantId, name: row.plantName || 'Plant Registry' } as any;
        const carrierObj = row.carrierObj || (dbCarriers || []).find(c => c.id === row.carrierId) || { name: 'Carrier Registry', address: 'N/A', gstin: 'N/A' } as any;

        if (snap.empty) {
            const shipmentObj = row.shipmentObj || row;
            setLrPreviewData({
                lrNumber: row.lrNumber,
                date: row.lrDate || new Date(),
                trip: row,
                carrier: carrierObj,
                shipment: shipmentObj,
                plant: plantObj,
                items: shipmentObj.items || [],
                weightSelection: 'Assigned Weight',
                assignedTripWeight: row.dispatchedQty || shipmentObj.quantity,
                from: row.loadingPoint || shipmentObj.loadingPoint || '',
                to: row.unloadingPoint || shipmentObj.unloadingPoint || '',
                consignorName: row.consignor || shipmentObj.consignor || '',
                buyerName: row.billToParty || shipmentObj.billToParty || '',
                shipToParty: row.shipToParty || shipmentObj.shipToParty || '',
                deliveryAddress: row.unloadingPoint || shipmentObj.deliveryAddress || '',
                id: row.id
            } as any);
        } else {
            const lrDoc = snap.docs[0].data() as LR;
            setLrPreviewData({
                ...lrDoc,
                id: snap.docs[0].id,
                date: parseSafeDate(lrDoc.date),
                trip: row,
                carrier: carrierObj,
                shipment: row.shipmentObj || row,
                plant: plantObj
            } as EnrichedLR);
        }
    } catch (e) {
        toast({ variant: 'destructive', title: "Registry Error", description: "Could not extract LR manifest." });
    } finally {
        hideLoader();
    }
  };

  const handleCancelTrip = async () => {
    if (!cancelTripData || !firestore || !user) return;
    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const plantId = cancelTripData.originPlantId;
            const tripRef = doc(firestore, `plants/${plantId}/trips`, cancelTripData.id);
            const globalTripRef = doc(firestore, 'trips', cancelTripData.id);
            const shipId = cancelTripData.shipmentIds[0];
            const shipRef = doc(firestore, `plants/${plantId}/shipments`, shipId);

            const shipSnap = await transaction.get(shipRef);
            if (shipSnap.exists()) {
                const sData = shipSnap.data() as Shipment;
                const newAssigned = Math.max(0, (sData.assignedQty || 0) - cancelTripData.assignedQtyInTrip);
                transaction.update(shipRef, {
                    assignedQty: newAssigned,
                    balanceQty: sData.quantity - newAssigned,
                    currentStatusId: newAssigned === 0 ? 'pending' : 'Partly Vehicle Assigned',
                    lastUpdateDate: serverTimestamp()
                });
            }

            if (cancelTripData.vehicleId) {
                const vRef = doc(firestore, 'vehicles', cancelTripData.vehicleId);
                transaction.update(vRef, { status: 'Available' });
            }

            transaction.delete(tripRef);
            transaction.delete(globalTripRef);
        });
        toast({ title: "Mission Purged", description: "Trip registry deleted and order balance restored." });
        setCancelTripData(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
        hideLoader();
    }
  };

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
                    <MultiSelectPlantFilter 
                        options={plants} 
                        selected={selectedPlants} 
                        onChange={setSelectedPlants} 
                        isLoading={isAuthLoading} 
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Filter className="h-3 w-3" /> Start Node
                    </Label>
                    <DatePicker date={fromDate} setDate={setFromDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" />
                </div>

                <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Filter className="h-3 w-3" /> End Node
                    </Label>
                    <DatePicker date={toDate} setDate={setTodayDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => { const params = new URLSearchParams(searchParams); params.set('tab', v); router.replace(`${pathname}?${params.toString()}`, { scroll: false }); }} className="w-full">
                <TabsList className="bg-white px-8 h-14 border-b rounded-none w-full justify-start gap-10">
                    <TabsTrigger value="active" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2">
                        Active ({counts.active})
                    </TabsTrigger>
                    <TabsTrigger value="loading" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2">
                        In-Yard ({counts.loading})
                    </TabsTrigger>
                    <TabsTrigger value="transit" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2">
                        Transit ({counts.transit})
                    </TabsTrigger>
                    <TabsTrigger value="arrived" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2">
                        Arrived ({counts.arrived})
                    </TabsTrigger>
                    <TabsTrigger value="pod-pending" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2">
                        POD Pending ({counts.podPending})
                    </TabsTrigger>
                    <TabsTrigger value="closed" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2">
                        Closed ({counts.closed})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={tabFilteredData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession}
                        canVerifyPod={isAdminSession} 
                        onVerifyPod={() => {}} 
                        onUploadPod={setPodUploadTrip} 
                        onGenerateLR={(t) => setLrGenerateTrip({ trip: t, carrier: (dbCarriers || []).find(c => c.id === t.carrierId) })} 
                        onViewLR={onViewLR} 
                        onViewTrip={setViewTripData} 
                        onUpdatePod={setPodUploadTrip} 
                        onCancelTrip={setCancelTripData} 
                        onEditTrip={() => {}} 
                        onTrack={(row) => router.push(`/dashboard/tracking/consignment?search=${row.tripId}`)} 
                        onEditVehicle={setEditVehicleTrip} 
                    />
                </TabsContent>
            </Tabs>
        </Card>
      </div>

      {lrGenerateTrip && (
          <LRGenerationModal 
            isOpen={!!lrGenerateTrip} 
            onClose={() => setLrGenerateTrip(null)} 
            trip={lrGenerateTrip.trip} 
            carrier={lrGenerateTrip.carrier} 
            onGenerate={() => setLrGenerateTrip(null)} 
          />
      )}
      
      {podUploadTrip && <PodUploadModal isOpen={!!podUploadTrip} onClose={() => setPodUploadTrip(null)} trip={podUploadTrip} onSuccess={() => setPodUploadTrip(null)} />}
      {viewTripData && <TripViewModal isOpen={!!viewTripData} onClose={() => setViewTripData(null)} trip={viewTripData} />}
      {editVehicleTrip && <EditVehicleModal isOpen={!!editVehicleTrip} onClose={() => setEditVehicleTrip(null)} trip={editVehicleTrip} onSave={async () => {}} />}
      {cancelTripData && <CancelTripModal isOpen={!!cancelTripData} onClose={() => setCancelTripData(null)} trip={cancelTripData} onConfirm={handleCancelTrip} />}
      {lrPreviewData && <LRPrintPreviewModal isOpen={!!lrPreviewData} onClose={() => setLrPreviewData(null)} lr={lrPreviewData} />}
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
