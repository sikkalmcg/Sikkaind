
'use client';
import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, doc, getDocs, getDoc, Timestamp, where, limit, onSnapshot, serverTimestamp, runTransaction, deleteDoc, addDoc, updateDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { Card } from '@/components/ui/card';
import { Loader2, WifiOff, Settings2, Search, RefreshCcw, Factory, ShieldCheck } from "lucide-react";
import { subDays, startOfDay, endOfDay, isBefore } from "date-fns";
import type { WithId, Shipment, Trip, Plant, SubUser, VehicleEntryExit, LR, Carrier } from '@/types';
import OrdersTable from '@/components/dashboard/vehicle-assign/OrdersTable';
import LayoutSettingsModal from '@/components/dashboard/vehicle-assign/LayoutSettingsModal';
import VehicleAssignModal from '@/components/dashboard/vehicle-assign/VehicleAssignModal';
import OrderDetailsDrawer from '@/components/dashboard/vehicle-assign/OrderDetailsDrawer';
import TripDetailsDrawer from '@/components/dashboard/vehicle-assign/TripDetailsDrawer';
import CancelReasonModal from '@/components/dashboard/vehicle-assign/CancelReasonModal';
import MultiSelectPlantFilter from '@/components/dashboard/MultiSelectPlantFilter';
import LRPrintPreviewModal from '@/components/dashboard/lr-create/LRPrintPreviewModal';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { mockPlants, mockCarriers } from '@/lib/mock-data';
import { normalizePlantId, sanitizeRegistryNode } from '@/lib/utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLoading } from '@/context/LoadingContext';

export type OrderTab = 'pending' | 'process' | 'dispatched' | 'cancelled';

function OpenOrdersContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showLoader, hideLoader } = useLoading();
  
  const activeTab = (searchParams.get('tab') as OrderTab) || 'pending';
  const urlPlants = searchParams.get('plants')?.split(',').filter(Boolean) || [];
  
  const [selectedPlants, setSelectedPlants] = useState<string[]>(urlPlants);
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 30)));
  const [toDate, setToDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [allData, setAllData] = useState<{ 
    shipments: WithId<Shipment>[], 
    trips: WithId<Trip>[], 
    entries: WithId<VehicleEntryExit>[], 
    lrs: WithId<LR>[] 
  }>({ shipments: [], trips: [], entries: [], lrs: [] });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [drawerOrder, setDrawerOrder] = useState<any | null>(null);
  const [drawerTrip, setDrawerTrip] = useState<any | null>(null);
  const [previewLr, setPreviewLr] = useState<EnrichedLR | null>(null);
  const [cancelModalData, setCancelModalData] = useState<{ id: string, type: 'order' | 'assignment', tripId?: string, qty?: number } | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [editingTrip, setEditingTrip] = useState<WithId<Trip> | null>(null);

  const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const plantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);
  const carriersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "carriers")) : null, [firestore]);
  const { data: carriers } = useCollection<Carrier>(carriersQuery);

  const updateURL = useCallback((plantIds: string[], tabVal?: string) => {
    const params = new URLSearchParams(searchParams);
    if (plantIds.length > 0) {
      params.set('plants', plantIds.join(','));
    } else {
      params.delete('plants');
    }
    if (tabVal) {
        params.set('tab', tabVal);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleTabChange = useCallback((v: string) => {
    updateURL(selectedPlants, v);
  }, [selectedPlants, updateURL]);

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
      }

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
      setAllData({ shipments: [], trips: [], entries: [], lrs: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(onSnapshot(collection(firestore, "vehicleEntries"), (snap) => {
        const entries = snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(),
            entryTimestamp: d.data().entryTimestamp instanceof Timestamp ? d.data().entryTimestamp.toDate() : new Date(d.data().entryTimestamp),
            exitTimestamp: d.data().exitTimestamp instanceof Timestamp ? d.data().exitTimestamp.toDate() : (d.data().exitTimestamp ? new Date(d.data().exitTimestamp) : undefined)
        } as WithId<VehicleEntryExit>));
        setAllData(prev => ({ ...prev, entries }));
    }));

    selectedPlants.forEach((plantId) => {
      const parseDate = (val: any) => val instanceof Timestamp ? val.toDate() : (val ? new Date(val) : null);

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/shipments`), (snap) => {
        const plantShipments = snap.docs.map(d => ({ 
          id: d.id, 
          originPlantId: plantId,
          ...d.data(),
          creationDate: parseDate(d.data().creationDate),
          lastUpdateDate: d.data().lastUpdateDate ? parseDate(d.data().lastUpdateDate) : undefined,
        } as WithId<Shipment>));

        setAllData(prev => ({
          ...prev,
          shipments: [...prev.shipments.filter(s => s.originPlantId !== plantId), ...plantShipments]
        }));
        setIsLoading(false);
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/trips`), (snap) => {
        const plantTrips = snap.docs.map(d => ({ 
          id: d.id, 
          originPlantId: plantId, 
          ...d.data(), 
          startDate: parseDate(d.data().startDate),
        } as WithId<Trip>));

        setAllData(prev => ({
          ...prev,
          trips: [...prev.trips.filter(t => t.originPlantId !== plantId), ...plantTrips]
        }));
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/lrs`), (snap) => {
        const plantLrs = snap.docs.map(d => ({
          id: d.id,
          originPlantId: plantId,
          ...d.data(),
          date: parseDate(d.data().date)
        } as WithId<LR>));

        setAllData(prev => ({
          ...prev,
          lrs: [...prev.lrs.filter(l => l.originPlantId !== plantId), ...plantLrs]
        }));
      }));
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [firestore, user, JSON.stringify(selectedPlants)]);

  const allFilteredData = useMemo(() => {
    const { shipments, trips, entries, lrs } = allData;
    const dayStart = fromDate ? startOfDay(fromDate) : null;
    const dayEnd = toDate ? endOfDay(toDate) : null;

    return (shipments || []).filter(s => {
      if (dayStart && s.creationDate < dayStart) return false;
      if (dayEnd && s.creationDate > dayEnd) return false;
      return true;
    }).map(s => {
      const normalizedSPlantId = normalizePlantId(s.originPlantId);
      const masterPlant = plants?.find(p => p.id === s.originPlantId || normalizePlantId(p.id) === normalizedSPlantId);

      const associatedTrips = trips.filter(t => t.shipmentIds?.includes(s.id));
      const linkedTrips = associatedTrips.map(t => {
          const carrierObj = (carriers || []).find(c => c.id === t.carrierId);
          const carrierName = carrierObj?.name || '--';
          const entry = entries.find(e => e.tripId === t.id);
          const lr = lrs.find(l => l.tripDocId === t.id || l.tripId === t.tripId);
          return { 
            ...t, 
            carrier: carrierName, 
            carrierObj, 
            entry, 
            lr,
            shipmentObj: s,
            plant: masterPlant
          };
      });

      const dispatchQty = linkedTrips.reduce((sum, t) => sum + (t.entry?.status === 'OUT' ? (t.assignedQtyInTrip || 0) : 0), 0);
      
      return {
        ...s,
        linkedTrips,
        dispatchQty,
        balanceQty: s.quantity - (s.assignedQty || 0),
        plantName: masterPlant?.name || s.originPlantId,
        tripId: linkedTrips[0]?.tripId || '--',
        tripDate: linkedTrips[0]?.startDate || null,
        vehicleNumber: linkedTrips[0]?.vehicleNumber || '--',
        driverMobile: linkedTrips[0]?.driverMobile || '--',
        carrier: linkedTrips[0]?.carrier || '--',
        transporterName: linkedTrips[0]?.transporterName || '--',
        lrNumber: linkedTrips[0]?.lrNumber || s.lrNumber || '',
        lrDate: linkedTrips[0]?.lrDate || s.lrDate || null,
      };
    });
  }, [allData, fromDate, toDate, carriers, plants]);

  const handleOpenLR = async (row: any) => {
    if (!row.lrNumber || !firestore) return;
    showLoader();
    try {
        const plantId = normalizePlantId(row.originPlantId);
        const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
        
        let q = query(lrsRef, where("lrNumber", "==", row.lrNumber), limit(1));
        let snap = await getDocs(q);
        
        const parseDate = (val: any) => val instanceof Timestamp ? val.toDate() : (val ? new Date(val) : new Date());

        if (snap.empty) {
            const shipmentObj = row.shipmentObj || row;
            setPreviewLr({
                lrNumber: row.lrNumber,
                date: parseDate(row.lrDate),
                trip: row,
                carrier: row.carrierObj || (carriers || [])[0],
                shipment: shipmentObj,
                plant: row.plant,
                items: shipmentObj.items || [],
                weightSelection: 'Assigned Weight',
                assignedTripWeight: row.assignedQtyInTrip || shipmentObj.quantity,
                from: shipmentObj.loadingPoint || '',
                to: shipmentObj.unloadingPoint || '',
                consignorName: shipmentObj.consignor || '',
                buyerName: shipmentObj.billToParty || '',
                shipToParty: shipmentObj.shipToParty || '',
                deliveryAddress: shipmentObj.deliveryAddress || shipmentObj.unloadingPoint || '',
                id: row.id
            } as any);
        } else {
            const lrDoc = snap.docs[0].data() as LR;
            setPreviewLr({
                ...lrDoc,
                id: snap.docs[0].id,
                date: parseDate(lrDoc.date),
                trip: row,
                carrier: row.carrierObj || (carriers || [])[0],
                shipment: row.shipmentObj || row,
                plant: row.plant
            } as EnrichedLR);
        }
    } catch (e) {
        toast({ variant: 'destructive', title: "Registry Error", description: "Could not extract LR manifest." });
    } finally {
        hideLoader();
    }
  };

  const counts = useMemo(() => {
    const res = { pending: 0, process: 0, dispatched: 0, cancelled: 0 };
    allFilteredData.forEach(s => {
      const associatedTrips = s.linkedTrips || [];
      const dispatchedTrips = associatedTrips.filter(t => t.entry?.status === 'OUT');
      const inProcessTrips = associatedTrips.filter(t => t.entry?.status === 'IN' || (t.assignedQtyInTrip > 0 && !t.entry));

      const isCancelled = ['Cancelled', 'Short Closed'].includes(s.currentStatusId);
      const isDispatched = dispatchedTrips.length > 0;
      const isInProcess = inProcessTrips.length > 0;

      if (isCancelled) {
          res.cancelled++;
      } else {
          if (s.balanceQty > 0.001) res.pending++;
          if (isInProcess) res.process++;
          if (isDispatched) res.dispatched++;
      }
    });
    return res;
  }, [allFilteredData]);

  const enrichedOrders = useMemo(() => {
    return allFilteredData.filter(s => {
      const associatedTrips = s.linkedTrips || [];
      const dispatchedTrips = associatedTrips.filter(t => t.entry?.status === 'OUT');
      const inProcessTrips = associatedTrips.filter(t => t.entry?.status === 'IN' || (t.assignedQtyInTrip > 0 && !t.entry));

      const isCancelled = ['Cancelled', 'Short Closed'].includes(s.currentStatusId);
      const isDispatched = dispatchedTrips.length > 0;
      const isInProcess = inProcessTrips.length > 0;

      if (activeTab === 'pending') return !isCancelled && s.balanceQty > 0.001;
      if (activeTab === 'process') return !isCancelled && isInProcess;
      if (activeTab === 'dispatched') return !isCancelled && isDispatched;
      if (activeTab === 'cancelled') return isCancelled;
      return true;
    }).filter(o => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return Object.values(o).some(v => v?.toString().toLowerCase().includes(s));
    });
  }, [allFilteredData, activeTab, searchTerm]);

  const handleCancelAssignment = async (tripId: string, shipId: string, qty: number) => {
    if (!firestore || !user) return;
    const shipment = allData.shipments.find(s => s.id === shipId);
    if (!shipment) return;
    const plantId = shipment.originPlantId;

    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const shipRef = doc(firestore, `plants/${plantId}/shipments`, shipId);
            const tripRef = doc(firestore, `plants/${plantId}/trips`, tripId);
            const globalTripRef = doc(firestore, 'trips', tripId);

            const [shipSnap, tripSnap] = await Promise.all([transaction.get(shipRef), transaction.get(tripRef)]);

            if (!shipSnap.exists()) throw new Error("Order Registry error.");
            
            if (tripSnap.exists()) {
                const tripData = tripSnap.data() as Trip;
                if (tripData.vehicleId) {
                    const vehicleRef = doc(firestore, 'vehicles', tripData.vehicleId);
                    transaction.update(vehicleRef, { status: 'Available' });
                }
            }

            const sData = shipSnap.data() as Shipment;
            const newAssigned = Math.max(0, (sData.assignedQty || 0) - qty);
            const newBalance = sData.quantity - newAssigned;
            
            transaction.delete(tripRef);
            transaction.delete(globalTripRef);
            transaction.update(shipRef, { assignedQty: newAssigned, balanceQty: newBalance, currentStatusId: newAssigned === 0 ? 'pending' : 'Partly Vehicle Assigned', lastUpdateDate: serverTimestamp() });
        });
        toast({ title: "Assignment Detached", description: "Vehicle removed and quantities reverted." });
        setCancelModalData(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
        hideLoader();
    }
  };

  const handleShortCloseOrder = async (id: string, reason: string) => {
    if (!firestore || !user) return;
    const shipment = allData.shipments.find(s => s.id === id);
    if (!shipment) return;

    showLoader();
    try {
        const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
        const shipRef = doc(firestore, `plants/${shipment.originPlantId}/shipments`, id);
        await updateDoc(shipRef, { currentStatusId: 'Short Closed', cancelReason: reason, shortClosedBy: currentName, shortClosedAt: serverTimestamp(), lastUpdateDate: serverTimestamp() });
        toast({ title: "Order Short Closed", description: `Shipment ${shipment.shipmentId} moved to cancelled registry.` });
        setCancelModalData(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
        hideLoader();
    }
  };

  const handleRestoreOrder = async (id: string) => {
    if (!firestore || !user) return;
    const shipment = allData.shipments.find(s => s.id === id);
    if (!shipment) return;

    showLoader();
    try {
        const shipRef = doc(firestore, `plants/${shipment.originPlantId}/shipments`, id);
        const nextStatus = shipment.assignedQty > 0.001 ? 'Partly Vehicle Assigned' : 'pending';
        await updateDoc(shipRef, { currentStatusId: nextStatus, lastUpdateDate: serverTimestamp(), cancelledAt: null, cancelledBy: null, cancelReason: null });
        toast({ title: "Order Restored", description: `Shipment ${shipment.shipmentId} returned to active registry.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Restoration Failed", description: e.message });
    } finally {
        hideLoader();
    }
  };

  if (isLoading && allData.shipments.length === 0) {
    return (
        <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Syncing Open Orders Registry...</p>
            </div>
        </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col h-full overflow-hidden bg-white">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full w-full">
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur px-4 md:px-8 pt-2 md:pt-4 pb-4 border-b">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black uppercase text-blue-900 italic tracking-tight">Mission Control: Open Orders</h1>
              {dbError && <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-orange-200"><WifiOff className="h-3 w-3" /><span>Cloud Sync Issue</span></div>}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                  <Factory className="h-2.5 w-2.5" /> Plant Node Registry
                </Label>
                {isAuthLoading ? (
                    <div className="h-9 w-[180px] bg-slate-100 animate-pulse rounded-lg" />
                ) : (
                    <MultiSelectPlantFilter 
                        options={plants || []}
                        selected={selectedPlants}
                        onChange={handlePlantChange}
                        isLoading={isAuthLoading}
                    />
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">From Date</Label>
                <DatePicker date={fromDate} setDate={setFromDate} className="h-9 border-slate-200" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">To Date</Label>
                <DatePicker date={toDate} setDate={setToDate} className="h-9 border-slate-200" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Global Registry Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Quick search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 w-[240px] bg-slate-50 border-slate-200 focus-visible:ring-blue-900" />
                </div>
              </div>
              <div className="flex items-end gap-2 pt-5">
                <Button variant="outline" size="icon" className="h-9 w-9 border-slate-300" onClick={() => window.location.reload()}><RefreshCcw className="h-4 w-4 text-blue-900" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50" onClick={() => setIsLayoutModalOpen(true)}>
                  <Settings2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          <TabsList className="flex w-full justify-start gap-8 bg-transparent border-b border-slate-100 rounded-none h-12 px-0">
            <TabsTrigger value="pending" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
              Pending Orders <span className="ml-2 py-0.5 px-2 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black">{counts.pending}</span>
            </TabsTrigger>
            <TabsTrigger value="process" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
              Under Process <span className="ml-2 py-0.5 px-2 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black">{counts.process}</span>
            </TabsTrigger>
            <TabsTrigger value="dispatched" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
              Dispatched <span className="ml-2 py-0.5 px-2 bg-green-100 text-green-700 rounded-full text-[10px] font-black">{counts.dispatched}</span>
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
              Cancelled <span className="ml-2 py-0.5 px-2 bg-red-100 text-red-700 rounded-full text-[10px] font-black">{counts.cancelled}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          {selectedPlants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
              <Factory className="h-16 w-16 mb-4 opacity-10" />
              <p className="text-lg font-bold">No Plants Selected</p>
              <p className="text-sm">Select at least one plant from the filter above to view orders.</p>
            </div>
          ) : (
            <OrdersTable 
                data={enrichedOrders} 
                tab={activeTab} 
                onAssign={(s) => { setSelectedShipment(s); setEditingTrip(null); setIsAssignModalOpen(true); }}
                onEditAssignment={(s, t) => { setSelectedShipment(s); setEditingTrip(t); setIsAssignModalOpen(true); }}
                onViewOrder={(s) => setDrawerOrder(s)}
                onViewTrip={(t) => setDrawerTrip(t)}
                onViewLR={handleOpenLR}
                onShortClose={(id) => setCancelModalData({ id, type: 'order' })}
                onCancelOrder={(id) => setCancelModalData({ id, type: 'order' })}
                onRestoreOrder={handleRestoreOrder} 
                onCancelAssignment={(tId, sId, q) => setCancelModalData({ id: sId, type: 'assignment', tripId: tId, qty: q })}
                isAdmin={isAdminSession}
            />
          )}
        </div>
      </Tabs>

      <LayoutSettingsModal isOpen={isLayoutModalOpen} onClose={() => setIsLayoutModalOpen(false)} activeTab={activeTab} />
      {isAssignModalOpen && selectedShipment && <VehicleAssignModal isOpen={isAssignModalOpen} onClose={() => {setIsAssignModalOpen(false); setSelectedShipment(null); setEditingTrip(null);}} shipment={selectedShipment} trip={editingTrip} onAssignmentComplete={() => {setIsAssignModalOpen(false); setSelectedShipment(null); setEditingTrip(null);}} carriers={carriers || []} />}
      {drawerOrder && <OrderDetailsDrawer isOpen={!!drawerOrder} onClose={() => setDrawerOrder(null)} shipment={drawerOrder} />}
      {drawerTrip && <TripDetailsDrawer isOpen={!!drawerTrip} onClose={() => setDrawerTrip(null)} trip={drawerTrip} />}
      {cancelModalData && <CancelReasonModal isOpen={!!cancelModalData} onClose={() => setCancelModalData(null)} onConfirm={(reason) => { if (cancelModalData.type === 'assignment' && cancelModalData.tripId) { handleCancelAssignment(cancelModalData.tripId, cancelModalData.id, cancelModalData.qty || 0); } else if (cancelModalData.type === 'order') { handleShortCloseOrder(cancelModalData.id, reason); } else { setCancelModalData(null); } }} />}
      {previewLr && <LRPrintPreviewModal isOpen={!!previewLr} onClose={() => setPreviewLr(null)} lr={previewLr} />}
    </main>
  );
}

export default function OpenOrdersPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <OpenOrdersContent />
        </Suspense>
    );
}
