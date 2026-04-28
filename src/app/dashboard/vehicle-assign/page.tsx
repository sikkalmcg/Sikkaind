'use client';
import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { collection, query, doc, getDocs, getDoc, Timestamp, where, limit, onSnapshot, serverTimestamp, runTransaction, updateDoc } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/date-picker';
import { Loader2, WifiOff, Settings2, Search, RefreshCcw, Factory, ShieldCheck, ArrowRightLeft, ClipboardList } from "lucide-react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
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
import { mockPlants } from '@/lib/mock-data';
import { normalizePlantId, parseSafeDate } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { Card } from '@/components/ui/card';

export type OrderTab = 'pending' | 'process' | 'dispatched' | 'cancelled';

/**
 * @fileOverview Fleet Allocation HUB.
 * Registry terminal for mapping lifting nodes to vehicles.
 * Updated: Enabled horizontal scrolling for mobile navigation tabs with hidden scrollbars.
 */
function OpenOrdersContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showLoader, hideLoader } = useLoading();
  
  const activeTab = (searchParams.get('tab') as OrderTab) || 'pending';
  const urlPlants = useMemo(() => searchParams.get('plants')?.split(',').filter(Boolean) || [], [searchParams]);
  
  const [selectedPlants, setSelectedPlants] = useState<string[]>(urlPlants);
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 30)));
  const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [allData, setAllData] = useState<{ 
    shipments: WithId<Shipment>[], 
    trips: WithId<Trip>[], 
    entries: WithId<VehicleEntryExit>[], 
    lrs: WithId<LR>[] 
  }>({ shipments: [], trips: [], entries: [], lrs: [] });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [drawerOrder, setDrawerOrder] = useState<any | null>(null);
  const [drawerTrip, setDrawerTrip] = useState<any | null>(null);
  const [lrPreviewData, setLrPreviewData] = useState<EnrichedLR | null>(null);
  const [cancelModalData, setCancelModalData] = useState<{ id: string, type: 'order' | 'assignment', tripId?: string, qty?: number } | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [editingTrip, setEditingTrip] = useState<WithId<Trip> | null>(null);

  const isInitialized = useRef(false);

  const isAdminSession = useMemo(() => {
    return user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
  }, [user]);

  const masterPlantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: allMasterPlants } = useCollection<Plant>(masterPlantsQuery);
  const carriersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "carriers")) : null, [firestore]);
  const { data: dbCarriers } = useCollection<Carrier>(carriersQuery);

  const updateURL = useCallback((plantIds: string[], tabVal?: string) => {
    const params = new URLSearchParams();
    if (plantIds.length > 0) params.set('plants', plantIds.join(','));
    params.set('tab', tabVal || activeTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, activeTab]);

  useEffect(() => {
    if (!firestore || !user) return;
    const fetchAuth = async () => {
        try {
            const searchEmail = user.email;
            if (!searchEmail) return;
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            
            const baseList = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : mockPlants;
            let authIds: string[] = [];

            if (!qSnap.empty) {
                const userData = qSnap.docs[0].data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
                authIds = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdminSession) {
                authIds = baseList.map(p => p.id);
            }

            setAuthorizedPlantIds(authIds);
            const authorizedPlants = baseList.filter(p => authIds.includes(p.id));
            setPlants(authorizedPlants);

            if (!isInitialized.current) {
                if (urlPlants.length > 0) {
                    setSelectedPlants(urlPlants);
                } else if (authIds.length > 0) {
                    setSelectedPlants(authIds);
                }
                isInitialized.current = true;
            }
        } catch (e) { setDbError(true); } finally { setIsAuthLoading(false); }
    };
    fetchAuth();
  }, [firestore, user, allMasterPlants, isAdminSession, urlPlants]);

  const handlePlantChange = (ids: string[]) => {
    setSelectedPlants(ids);
    updateURL(ids);
  };

  useEffect(() => {
    if (!firestore || !user || selectedPlants.length === 0) {
      if (selectedPlants.length === 0 && isInitialized.current) {
          setAllData({ shipments: [], trips: [], entries: [], lrs: [] });
          setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(onSnapshot(collection(firestore, "vehicleEntries"), (snap) => {
        const entriesList = snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(),
            entryTimestamp: parseSafeDate(d.data().entryTimestamp),
            exitTimestamp: parseSafeDate(d.data().exitTimestamp)
        } as WithId<VehicleEntryExit>));
        setAllData(prev => ({ ...prev, entries: entriesList }));
    }));

    selectedPlants.forEach((plantId) => {
      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/shipments`), (snap) => {
        const plantShipments = snap.docs.map(d => ({ 
          id: d.id, 
          originPlantId: plantId,
          ...d.data(),
          creationDate: parseSafeDate(d.data().creationDate),
          lastUpdateDate: parseSafeDate(d.data().lastUpdateDate),
          lrDate: parseSafeDate(d.data().lrDate)
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
          startDate: parseSafeDate(d.data().startDate),
          lrDate: parseSafeDate(d.data().lrDate)
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
          date: parseSafeDate(d.data().date)
        } as any));

        setAllData(prev => ({
          ...prev,
          lrs: [...prev.lrs.filter(l => l.originPlantId !== plantId), ...plantLrs]
        }));
      }));
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [firestore, user, JSON.stringify(selectedPlants)]);

  const enrichedOrders = useMemo(() => {
    const { shipments, trips, entries, lrs } = allData;
    const normalizedSelected = selectedPlants.map(normalizePlantId);

    return (shipments || [])
      .filter(s => normalizedSelected.includes(normalizePlantId(s.originPlantId)))
      .map(s => {
        const normalizedSPlantId = normalizePlantId(s.originPlantId);
        const masterPlant = plants?.find(p => p.id === s.originPlantId || normalizePlantId(p.id) === normalizedSPlantId);

        const associatedTrips = trips.filter(t => t.shipmentIds?.includes(s.id));
        const linkedTrips = associatedTrips.map(t => {
            const carrierObj = (dbCarriers || []).find(c => c.id === t.carrierId);
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

        const itemsManifest = s.items || [];
        const getInvoice = (i: any) => i.invoiceNumber || i.invoiceNo || i.deliveryNumber || i.deliveryNo;
        const summarizedInvoices = Array.from(new Set(itemsManifest.map(getInvoice).filter(Boolean))).join(', ') || s.invoiceNumber || '--';
        
        const uniqueDescs = Array.from(new Set(itemsManifest.map(i => (i.itemDescription || i.description || '').toUpperCase().trim()).filter(Boolean)));
        const summarizedItems = uniqueDescs.length > 2 
            ? "VARIOUS ITEMS AS PER INVOICE" 
            : (uniqueDescs.join(', ') || s.itemDescription || s.material || '--');

        const totalUnitsCount = itemsManifest.reduce((sum, i) => sum + (Number(i.units) || 0), 0) || s.totalUnits || 0;

        const dispatchQty = linkedTrips.reduce((sum, t) => sum + (t.entry?.status === 'OUT' ? (t.assignedQtyInTrip || 0) : 0), 0);
        
        const lrNumber = linkedTrips[0]?.lrNumber || s.lrNumber || '';
        const lrDate = linkedTrips[0]?.lrDate || s.lrDate || null;

        return {
          ...s,
          linkedTrips,
          dispatchQty,
          balanceQty: s.quantity - (s.assignedQty || 0),
          plantName: masterPlant?.name || s.originPlantId,
          tripId: linkedTrips[0]?.tripId || '--',
          tripDate: linkedTrips[0]?.startDate || null,
          vehicleNumber: linkedTrips[0]?.vehicleNumber || '--',
          driverName: linkedTrips[0]?.driverName || '--',
          driverMobile: linkedTrips[0]?.driverMobile || '--',
          carrier: linkedTrips[0]?.carrier || '--',
          transporterName: linkedTrips[0]?.transporterName || '--',
          lrNumber,
          lrDate,
          summarizedInvoices,
          summarizedItems,
          totalUnitsCount,
          paymentTerm: linkedTrips[0]?.paymentTerm || s.paymentTerm,
          consignee: s.billToParty || '--', 
          shipToParty: s.shipToParty || '--' 
        };
      });
  }, [allData, dbCarriers, plants, selectedPlants]);

  const finalData = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : null;
    const dayEnd = toDate ? endOfDay(toDate) : null;

    return enrichedOrders.filter(t => {
      const start = t.creationDate; 
      if (!start) return true; 

      if (dayStart && start < dayStart) return false;
      if (dayEnd && start > dayEnd) return false;
      
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return Object.values(t).some(val => val?.toString().toLowerCase().includes(s));
      }
      return true;
    });
  }, [enrichedOrders, fromDate, toDate, searchTerm]);

  const handleOpenLR = async (row: any) => {
    if (!row.lrNumber || !firestore) return;
    showLoader();
    try {
        const plantId = normalizePlantId(row.originPlantId);
        const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
        
        let q = query(lrsRef, where("lrNumber", "==", row.lrNumber), limit(1));
        let snap = await getDocs(q);
        
        const plantNode = row.plant || { id: row.originPlantId, name: row.plantName };
        const shipmentObj = row.shipmentObj || row;

        const pIdStr = normalizePlantId(row.originPlantId);
        const isSikkaLmcShorthand = row.carrierName?.toLowerCase().trim() === 'sikka lmc';
        let finalCarrier: any = row.carrierObj || (dbCarriers || []).find(c => c.id === row.carrierId);

        if (!finalCarrier && pIdStr === '1426') {
            finalCarrier = {
                id: 'ID20',
                name: 'SIKKA LMC',
                address: '20Km. Stone, Near Tivoli Grand Resort, Khasra No. -9, G.T. Karnal Road, Jindpur, Delhi - 110036',
                mobile: '9136688004',
                gstin: '07AYQPS6936B1ZZ',
                stateCode: '07',
                stateName: 'DELHI',
                pan: 'AYQPS6936B',
                email: 'sil@sikkaenterprises.com'
            };
        } else if (!finalCarrier && (pIdStr === '1214' || isSikkaLmcShorthand)) {
            finalCarrier = {
                id: 'ID21',
                name: 'SIKKA LMC',
                address: 'B-11, BULANDSHAHR ROAD INDLAREA, GHAZIABAD, UTTAR PRADESH, 201009',
                mobile: '9136688004',
                gstin: '09AYQPS6936B1ZV',
                stateCode: '09',
                stateName: 'UTTAR PRADESH',
                pan: 'AYQPS6936B',
                email: 'sil@sikkaenterprises.com'
            };
        }

        if (!finalCarrier) {
            finalCarrier = {
                id: 'ID20',
                name: 'SIKKA LMC',
                address: '20Km. Stone, Near Tivoli Grand Resort, Khasra No. -9, G.T. Karnal Road, Jindpur, Delhi - 110036',
                mobile: '9136688004',
                gstin: '07AYQPS6936B1ZZ',
                stateCode: '07',
                stateName: 'DELHI',
                pan: 'AYQPS6936B',
                email: 'sil@sikkaenterprises.com'
            };
        }

        if (snap.empty) {
            setLrPreviewData({
                lrNumber: row.lrNumber,
                date: row.lrDate || new Date(),
                trip: row as any,
                carrier: finalCarrier,
                shipment: shipmentObj,
                plant: plantNode as any,
                items: shipmentObj.items || [],
                weightSelection: 'Assigned Weight',
                assignedTripWeight: row.quantity,
                from: shipmentObj.loadingPoint || '',
                to: shipmentObj.unloadingPoint || '',
                consignorName: shipmentObj.consignor || row.consignor || '',
                consignorGtin: shipmentObj.consignorGtin || row.consignorGtin || '',
                consignorAddress: shipmentObj.consignorAddress || '',
                buyerName: shipmentObj.billToParty || row.billToParty || '',
                buyerAddress: shipmentObj.billToAddress || row.billToAddress || shipmentObj.deliveryAddress || shipmentObj.unloadingPoint || '',
                buyerGtin: shipmentObj.billToGtin || row.billToGtin || '',
                shipToParty: shipmentObj.shipToParty || row.shipToParty || shipmentObj.billToParty || row.billToParty || '',
                shipToGtin: shipmentObj.shipToGtin || row.shipToGtin || '',
                deliveryAddress: shipmentObj.deliveryAddress || shipmentObj.unloadingPoint || '',
                vehicleNumber: row.vehicleNumber || '--',
                driverName: row.driverName || '--',
                driverMobile: row.driverMobile || '--',
                paymentTerm: row.paymentTerm || '--',
                id: row.id
            } as any);
        } else {
            const lrDoc = snap.docs[0].data() as LR;
            setLrPreviewData({
                ...lrDoc,
                id: snap.docs[0].id,
                date: parseSafeDate(lrDoc.date),
                trip: row as any,
                carrier: finalCarrier,
                shipment: shipmentObj,
                plant: plantNode as any,
                consignorName: lrDoc.consignorName || shipmentObj.consignor || '',
                consignorAddress: lrDoc.consignorAddress || shipmentObj.consignorAddress || '',
                consignorGtin: lrDoc.consignorGtin || shipmentObj.consignorGtin || '',
                buyerName: lrDoc.buyerName || shipmentObj.billToParty || '',
                buyerAddress: lrDoc.buyerAddress || shipmentObj.billToAddress || shipmentObj.deliveryAddress || shipmentObj.unloadingPoint || '',
                buyerGtin: lrDoc.buyerGtin || shipmentObj.billToGtin || '',
                shipToParty: lrDoc.shipToParty || shipmentObj.shipToParty || shipmentObj.billToParty || '',
                shipToGtin: lrDoc.shipToGtin || shipmentObj.shipToGtin || '',
                deliveryAddress: lrDoc.deliveryAddress || shipmentObj.deliveryAddress || shipmentObj.unloadingPoint || '',
                vehicleNumber: row.vehicleNumber || lrDoc.vehicleNumber,
                driverName: row.driverName || lrDoc.driverName,
                driverMobile: row.driverMobile || lrDoc.driverMobile,
                paymentTerm: row.paymentTerm || lrDoc.paymentTerm
            } as EnrichedLR);
        }
    } catch (e) {
        toast({ variant: 'destructive', title: "Registry Error", description: "Could not extract LR manifest." });
    } finally {
        hideLoader();
    }
  };

  const handleCancelAssignment = async (tripId: string, shipId: string, qty: number) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        const trip = allData.trips.find(t => t.id === tripId);
        if(!trip) throw new Error("Trip node not found.");
        const plantId = normalizePlantId(trip.originPlantId);

        await runTransaction(firestore, async (transaction) => {
            const shipRef = doc(firestore, `plants/${plantId}/shipments`, shipId);
            const shipSnap = await transaction.get(shipRef);
            if (!shipSnap.exists()) throw new Error("Shipment node not found.");
            
            const sData = shipSnap.data() as Shipment;
            const newAssigned = (sData.assignedQty || 0) - qty;
            const newBalance = sData.quantity - newAssigned;

            transaction.update(shipRef, {
                assignedQty: newAssigned,
                balanceQty: newBalance,
                currentStatusId: newAssigned > 0 ? 'Partly Vehicle Assigned' : 'pending',
                lastUpdateDate: serverTimestamp()
            });

            transaction.delete(doc(firestore, `plants/${plantId}/trips`, tripId));
            transaction.delete(doc(firestore, 'trips', tripId));
        });
        toast({ title: 'Assignment Reverted', description: 'Fleet plant successfully removed from mission.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Registry Error', description: e.message });
    } finally { hideLoader(); }
  };

  const handleShortClose = async (reason: string) => {
    if (!firestore || !user || !cancelModalData) return;
    showLoader();
    try {
        const { id } = cancelModalData;
        const shipment = allData.shipments.find(s => s.id === id);
        if (!shipment) return;
        const plantId = normalizePlantId(shipment.originPlantId);

        await updateDoc(doc(firestore, `plants/${plantId}/shipments`, id), {
            currentStatusId: 'Short Closed',
            shortCloseReason: reason,
            shortClosedBy: user.displayName || user.email,
            lastUpdateDate: serverTimestamp()
        });
        toast({ title: 'Order Short Closed', description: 'Manifest lifecycle finalized with balance.' });
        setCancelModalData(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { hideLoader(); }
  };

  const handleCancelOrder = async (reason: string) => {
    if (!firestore || !user || !cancelModalData) return;
    showLoader();
    try {
        const { id } = cancelModalData;
        const shipment = allData.shipments.find(s => s.id === id);
        if (!shipment) return;
        const plantId = normalizePlantId(shipment.originPlantId);

        await updateDoc(doc(firestore, `plants/${plantId}/shipments`, id), {
            currentStatusId: 'Cancelled',
            cancelReason: reason,
            cancelledBy: user.displayName || user.email,
            lastUpdateDate: serverTimestamp()
        });
        toast({ title: 'Order Revoked', description: 'Mission plant removed from active queue.' });
        setCancelModalData(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { hideLoader(); }
  };

  const counts = useMemo(() => {
    const res = { pending: 0, process: 0, dispatched: 0, cancelled: 0 };
    finalData.forEach(s => {
        const status = s.currentStatusId?.toLowerCase() || '';
        if (status === 'pending' || status === 'partly vehicle assigned') res.pending++;
        else if (status === 'assigned' || status === 'vehicle assigned') res.process++;
        else if (['dispatched', 'delivered', 'in-transit', 'arrived', 'arrival-for-delivery'].includes(status)) res.dispatched++;
        else if (status === 'cancelled' || status === 'short closed') res.cancelled++;
    });
    return res;
  }, [finalData]);

  const tabFilteredData = useMemo(() => {
    return finalData.filter(o => {
        const status = o.currentStatusId?.toLowerCase() || '';
        switch (activeTab) {
            case 'pending': return status === 'pending' || status === 'partly vehicle assigned';
            case 'process': return status === 'assigned' || status === 'vehicle assigned';
            case 'dispatched': return ['dispatched', 'delivered', 'in-transit', 'arrived', 'arrival-for-delivery'].includes(status); 
            case 'cancelled': return status === 'cancelled' || status === 'short closed';
            default: return true;
        }
    });
  }, [finalData, activeTab]);

  const totalPages = Math.ceil(tabFilteredData.length / itemsPerPage);

  return (
    <main className="flex flex-1 flex-col h-full overflow-hidden bg-white">
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-lg rotate-3">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-blue-900 tracking-tight uppercase italic leading-none">Fleet Allocation HUB</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lifting Plant Registry & Assignment</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end gap-3 bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-inner w-full lg:w-auto">
            <div className="grid gap-1">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Lifting Plants</Label>
              <MultiSelectPlantFilter options={plants} selected={selectedPlants} onChange={handlePlantChange} isLoading={isAuthLoading} />
            </div>
            <div className="grid gap-1">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Search Registry</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="Search orders..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 w-full lg:w-[240px] border-slate-200 font-bold bg-white" />
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end pt-2">
              <Button variant="outline" size="icon" className="h-9 w-9 text-blue-900 rounded-xl" onClick={() => window.location.reload()}><RefreshCcw className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setIsLayoutModalOpen(true)} className="h-9 w-9 text-slate-400 rounded-xl"><Settings2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { updateURL(selectedPlants, v); setCurrentPage(1); }} className="w-full">
          <TabsList className="bg-transparent h-10 p-0 border-b-0 gap-10 justify-start overflow-x-auto no-scrollbar flex-nowrap shrink-0">
            {[
                { id: 'pending', label: 'Awaiting Fleet', count: counts.pending },
                { id: 'process', label: 'Allocated Plants', count: counts.process },
                { id: 'dispatched', label: 'Outbound Flow', count: counts.dispatched },
                { id: 'cancelled', label: 'Revoked Archive', count: counts.cancelled }
            ].map(t => (
                <TabsTrigger key={t.id} value={t.id} className="relative h-10 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-900 data-[state=active]:bg-transparent px-0 font-bold uppercase text-[11px] tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all shrink-0">
                    {t.label} <Badge className="ml-2 bg-slate-100 text-slate-500 border-none font-black text-[9px] shrink-0">{t.count}</Badge>
                </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Establishing Registry Link...</p>
            </div>
        ) : (
            <div className="space-y-6">
                <OrdersTable 
                    data={tabFilteredData} 
                    tab={activeTab}
                    onAssign={(order) => { setSelectedShipment(order); setAssignModalOpen(true); }}
                    onEditAssignment={(order, trip) => { setEditingTrip(trip); setSelectedShipment(order); setAssignModalOpen(true); }}
                    onViewOrder={setDrawerOrder}
                    onViewTrip={setDrawerTrip}
                    onViewLR={handleOpenLR}
                    onShortClose={(id) => setCancelModalData({ id, type: 'order' })}
                    onCancelOrder={(id) => setCancelModalData({ id, type: 'order' })}
                    onRestoreOrder={() => {}}
                    onCancelAssignment={(tripId, shipId, qty) => handleCancelAssignment(tripId, shipId, qty)}
                    isAdmin={isAdminSession}
                />
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={tabFilteredData.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
            </div>
        )}
      </div>

      <LayoutSettingsModal isOpen={isLayoutModalOpen} onClose={() => setIsLayoutModalOpen(false)} activeTab={activeTab} />
      
      {isAssignModalOpen && selectedShipment && (
        <VehicleAssignModal 
            isOpen={isAssignModalOpen}
            onClose={() => { setAssignModalOpen(false); setEditingTrip(null); }}
            shipments={[selectedShipment]}
            trip={editingTrip}
            carriers={dbCarriers || []}
            onAssignmentComplete={() => { setAssignModalOpen(false); setEditingTrip(null); }}
        />
      )}

      {drawerOrder && <OrderDetailsDrawer isOpen={!!drawerOrder} onClose={() => setDrawerOrder(null)} shipment={drawerOrder} />}
      {drawerTrip && <TripDetailsDrawer isOpen={!!drawerTrip} onClose={() => setDrawerTrip(null)} trip={drawerTrip} />}
      {lrPreviewData && <LRPrintPreviewModal isOpen={!!lrPreviewData} onClose={() => setLrPreviewData(null)} lr={lrPreviewData} />}
      
      {cancelModalData && (
        <CancelReasonModal 
            isOpen={!!cancelModalData} 
            onClose={() => setCancelModalData(null)} 
            onConfirm={cancelModalData.type === 'order' ? handleCancelOrder : (r) => {}} 
        />
      )}
    </main>
  );
}

export default function VehicleAssignPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <OpenOrdersContent />
        </Suspense>
    );
}
