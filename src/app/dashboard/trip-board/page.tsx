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
import MultiSelectPlantFilter from '@/components/dashboard/MultiSelectPlantFilter';
import type { WithId, Shipment, Trip, Plant, SubUser, Carrier, LR, VehicleEntryExit } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { normalizePlantId, parseSafeDate, sanitizeRegistryNode } from '@/lib/utils';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, doc, getDoc, updateDoc, serverTimestamp, runTransaction, where, limit, onSnapshot, getDocs, addDoc, writeBatch } from "firebase/firestore";
import { Loader2, WifiOff, MonitorPlay, RefreshCcw, Search, Factory, Filter, ArrowRightLeft, Trash2, Ban, ShieldAlert, Sparkles, X } from "lucide-react";
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
  
  const [podUploadTrip, setPodUploadTrip] = useState<any | null>(null);
  const [viewTripData, setViewTripData] = useState<any | null>(null);
  const [lrGenerateTrip, setLrGenerateTrip] = useState<any | null>(null);
  const [lrPreviewData, setLrPreviewData] = useState<EnrichedLR | null>(null);
  const [cancelTripData, setCancelTripData] = useState<any | null>(null);
  const [editVehicleTrip, setEditVehicleTrip] = useState<any | null>(null);

  // Bulk Selection Registry
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

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

      const items = lr?.items || shipment?.items || [];
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
        lrDate: parseSafeDate(lr?.date || t.lrDate || shipment?.lrDate)
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
            case 'active': return !['delivered', 'closed', 'trip-closed', 'cancelled'].includes(status) && !isPod;
            case 'loading': return !isOut && (status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete');
            case 'transit': return status === 'in-transit' || status === 'out-for-delivery' || status === 'break-down';
            case 'arrived': return ['arrived', 'arrival-for-delivery'].includes(status);
            case 'pod-pending': return (['arrived', 'arrival-for-delivery', 'delivered'].includes(status)) && !isPod;
            case 'closed': return isPod || status === 'closed' || status === 'trip-closed' || status === 'delivered';
            default: return true;
        }
    });
  }, [finalData, activeTab]);

  const handleCancelTrip = async () => {
    if (!cancelTripData) return;
    await executePurge(cancelTripData);
    toast({ title: 'Mission Revoked', description: `Trip ${cancelTripData.tripId} purged.` });
    setCancelTripData(null);
  };

  const handleUpdateVehicle = async (tripId: string, values: any) => {
    if (!firestore) return;
    showLoader();
    try {
        const tripObj = trips.find(t => t.id === tripId);
        if (!tripObj) throw new Error("Trip node not found.");
        const plantId = normalizePlantId(tripObj.originPlantId);
        
        await runTransaction(firestore, async (transaction) => {
            const tripRef = doc(firestore, `plants/${plantId}/trips`, tripId);
            const globalTripRef = doc(firestore, 'trips', tripId);
            
            const [tSnap, gSnap] = await Promise.all([
                transaction.get(tripRef),
                transaction.get(globalTripRef)
            ]);

            const updateData = { 
                vehicleNumber: values.vehicleNumber, 
                driverMobile: values.driverMobile, 
                lastUpdated: serverTimestamp() 
            };

            if (tSnap.exists()) transaction.update(tripRef, updateData);
            if (gSnap.exists()) transaction.update(globalTripRef, updateData);
        });
        toast({ title: 'Identity Corrected' });
    } catch (e: any) { 
        toast({ variant: 'destructive', title: 'Update Failed', description: e.message }); 
    } finally { hideLoader(); }
  };

  useEffect(() => { setCurrentPage(1); setSelectedIds([]); }, [activeTab, selectedPlants, fromDate, toDate, searchTerm]);

  const totalPages = Math.ceil(tabFilteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => tabFilteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [tabFilteredData, currentPage, itemsPerPage]);

  const counts = useMemo(() => {
    const res = { active: 0, loading: 0, transit: 0, arrived: 0, podPending: 0, closed: 0 };
    finalData.forEach(t => {
        const status = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim().replace(/[\s_-]+/g, '-');
        const isOut = t.entry?.status === 'OUT';
        const isPod = t.podReceived === true;
        if (!['delivered', 'closed', 'trip-closed', 'cancelled'].includes(status) && !isPod) res.active++;
        if (!isOut && (status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete')) res.loading++;
        if (status === 'in-transit' || status === 'out-for-delivery' || status === 'break-down') res.transit++;
        if (['arrived', 'arrival-for-delivery'].includes(status)) res.arrived++;
        if ((['arrived', 'arrival-for-delivery', 'delivered'].includes(status)) && !isPod) res.podPending++;
        if (isPod || status === 'closed' || status === 'trip-closed' || status === 'delivered') res.closed++;
    });
    return res;
  }, [finalData]);

  const onViewLR = useCallback(async (row: any) => {
    if (!row.lrNumber || !firestore) return;
    setIsExtracting(true);
    try {
        const plantId = normalizePlantId(row.originPlantId);
        const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
        let q = query(lrsRef, where("lrNumber", "==", row.lrNumber), limit(1));
        let snap = await getDocs(q);
        const plantObj = plants.find(p => normalizePlantId(p.id) === normalizePlantId(row.originPlantId)) || { id: row.originPlantId, name: row.plantName } as any;
        const carrierObj = row.carrierObj || (dbCarriers || []).find(c => c.id === row.carrierId) || { name: 'Carrier' } as any;
        const shipmentObj = row.shipmentObj || row;

        if (snap.empty) {
            setLrPreviewData({ 
                lrNumber: row.lrNumber, 
                date: row.lrDate || new Date(), 
                trip: row, 
                carrier: carrierObj, 
                shipment: shipmentObj, 
                plant: plantObj, 
                items: shipmentObj.items || [], 
                weightSelection: 'Assigned Weight', 
                assignedTripWeight: row.dispatchedQty, 
                from: row.loadingPoint || '', 
                to: row.unloadingPoint || '', 
                consignorName: row.consignor || '', 
                consignorGtin: shipmentObj.consignorGtin || '',
                buyerName: row.billToParty || '', 
                buyerGtin: shipmentObj.billToGtin || '',
                shipToParty: row.shipToParty || '', 
                shipToGtin: shipmentObj.shipToGtin || '',
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
                shipment: shipmentObj, 
                plant: plantObj,
                consignorGtin: lrDoc.consignorGtin || shipmentObj.consignorGtin || '',
                buyerGtin: lrDoc.buyerGtin || shipmentObj.billToGtin || '',
                shipToGtin: lrDoc.shipToGtin || shipmentObj.shipToGtin || '',
            } as any);
        }
    } catch (e) { toast({ variant: 'destructive', title: "Registry Error" }); } finally { setIsExtracting(false); }
  }, [firestore, plants, dbCarriers, toast]);

  const executePurge = async (tripData: any) => {
    if (!firestore || !user) return;
    await runTransaction(firestore, async (transaction) => {
        const plantId = normalizePlantId(tripData.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, tripData.id);
        const globalTripRef = doc(firestore, 'trips', tripData.id);
        
        const tripSnap = await transaction.get(tripRef);
        if (!tripSnap.exists()) return;
        const tData = tripSnap.data() as Trip;

        const shipId = (tData.shipmentIds && tData.shipmentIds.length > 0) ? tData.shipmentIds[0] : null;
        
        if (shipId) {
            const shipRef = doc(firestore, `plants/${plantId}/shipments`, shipId);
            const shipSnap = await transaction.get(shipRef);
            if (shipSnap.exists()) {
                const sData = shipSnap.data() as Shipment;
                const weightToRevert = Number(tData.assignedQtyInTrip || 0);
                const newAssigned = Math.max(0, (sData.assignedQty || 0) - weightToRevert);
                transaction.update(shipRef, {
                    assignedQty: newAssigned,
                    balanceQty: sData.quantity - newAssigned,
                    currentStatusId: newAssigned === 0 ? 'pending' : 'Partly Vehicle Assigned',
                    lastUpdateDate: serverTimestamp()
                });
            }
        }

        if (tData.vehicleId) {
            const vRef = doc(firestore, 'vehicles', tData.vehicleId);
            const vSnap = await transaction.get(vRef);
            if (vSnap.exists()) {
                transaction.update(vRef, { status: 'Available' });
            }
        }

        const currentOperator = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || "Admin");
        const recycleRef = doc(collection(firestore, "recycle_bin"));
        const archivePlantName = tripData.plantName || tData.originPlantId || 'Unknown Node';

        transaction.set(recycleRef, {
            pageName: "Trip Board (Cancelled/Purged)",
            userName: currentOperator,
            deletedAt: serverTimestamp(),
            data: sanitizeRegistryNode({ 
                ...tData, 
                id: tripData.id, 
                type: 'Trip', 
                plantName: archivePlantName 
            })
        });

        transaction.delete(tripRef);
        transaction.delete(globalTripRef);
    });
  };

  const handleBulkCancel = async () => {
    if (!selectedIds.length || !firestore || !user) return;
    setIsBulkProcessing(true);
    showLoader();
    try {
        for (const id of selectedIds) {
            const tripObj = trips.find(t => t.id === id);
            if (tripObj) await executePurge(tripObj);
        }
        toast({ title: 'Bulk Purge Complete', description: `Successfully revoked ${selectedIds.length} mission nodes.` });
        setSelectedIds([]);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    } finally {
        setIsBulkProcessing(false);
        hideLoader();
    }
  };

  const handleAutomatedCleanup = async () => {
    const targets = finalData.filter(t => 
        (!t.lrNumber || t.lrNumber === '' || t.lrNumber === 'PENDING') &&
        (t.invoiceNumbers === '--' || !t.invoiceNumbers) &&
        (Number(t.dispatchedQty) === 0) &&
        (t.tripStatus === 'Assigned')
    );

    if (targets.length === 0) {
        toast({ title: 'Registry Clean', description: 'No empty mission nodes detected.' });
        return;
    }

    setIsBulkProcessing(true);
    showLoader();
    try {
        for (const target of targets) {
            await executePurge(target);
        }
        toast({ title: 'Registry Scrubbed', description: `Purged ${targets.length} empty mission nodes.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Scrub Failed', description: e.message });
    } finally {
        setIsBulkProcessing(false);
        hideLoader();
    }
  };

  if (isAuthLoading && authorizedPlantIds.length === 0) {
    return (
        <div className="flex h-screen flex-col items-center justify-center bg-[#f8fafc]">
            <Loader2 className="h-12 w-12 animate-spin text-blue-900 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Lifting Node Registry...</p>
        </div>
    );
  }

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
          {isAdminSession && (
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="ghost" className="h-11 px-6 rounded-2xl font-black text-[10px] uppercase text-blue-600 gap-2 hover:bg-blue-50 border border-blue-100">
                          <RefreshCcw className="h-4 w-4" /> Registry Cleanup
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-none shadow-3xl rounded-[2rem]">
                      <AlertDialogHeader>
                          <div className="flex items-center gap-4 mb-2">
                              <div className="p-2 bg-blue-100 text-blue-900 rounded-lg"><Sparkles className="h-5 w-5" /></div>
                              <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Execute Automated Scrub?</AlertDialogTitle>
                          </div>
                          <AlertDialogDescription className="text-sm font-medium">
                              This will automatically identify and purge all **"0 Data"** mission nodes (No LR, No Invoices, 0 Weight) from the registry. This action is permanent.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 flex-row justify-end gap-3">
                          <AlertDialogCancel className="font-bold rounded-xl m-0 h-11 px-8">Abort</AlertDialogCancel>
                          <AlertDialogAction onClick={handleAutomatedCleanup} className="bg-blue-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest px-10 h-11 rounded-xl shadow-lg border-none">Start Cleanup</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
          )}
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
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Factory className="h-3 w-3" /> Plant Node Registry</Label>
                        <MultiSelectPlantFilter options={plants} selected={selectedPlants} onChange={setSelectedPlants} isLoading={isAuthLoading} />
                    </div>
                    <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1"><Filter className="h-3 w-3" /> Start Node</Label><DatePicker date={fromDate} setDate={setFromDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" /></div>
                    <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1"><Filter className="h-3 w-3" /> End Node</Label><DatePicker date={toDate} setDate={setTodayDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" /></div>
                </div>

                {selectedIds.length > 0 && isAdminSession && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] gap-3 shadow-xl shadow-red-100 animate-in zoom-in duration-300 border-none transition-all active:scale-95">
                                <Ban className="h-5 w-5" /> Revoke Selected ({selectedIds.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-none shadow-3xl rounded-[2rem] p-0 overflow-hidden bg-white">
                            <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><ShieldAlert className="h-8 w-8" /></div>
                                <div>
                                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tight italic text-red-900 leading-none">Bulk Registry Purge?</AlertDialogTitle>
                                    <p className="text-red-700 font-bold uppercase text-[9px] tracking-widest mt-2">Authorized System Override Node</p>
                                </div>
                            </div>
                            <div className="p-10"><p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-4 border-red-100 pl-4">"Executing this action will permanently remove <span className="font-black text-slate-900">{selectedIds.length} mission nodes</span> from the active hub. All vehicle allocations will be reverted. This cannot be undone."</p></div>
                            <AlertDialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                                <AlertDialogCancel className="font-bold border-slate-200 h-11 px-8 rounded-xl m-0">Abort</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkCancel} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-10 h-11 rounded-xl shadow-lg border-none">Confirm Purge</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={(v) => { const params = new URLSearchParams(searchParams); params.set('tab', v); router.replace(`${pathname}?${params.toString()}`, { scroll: false }); }} className="w-full">
                <TabsList className="bg-white px-4 md:px-8 h-14 border-b rounded-none w-full justify-start gap-6 md:gap-10 overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-hide shrink-0">
                    <TabsTrigger value="active" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Active ({counts.active})</TabsTrigger>
                    <TabsTrigger value="loading" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">In-Yard ({counts.loading})</TabsTrigger>
                    <TabsTrigger value="transit" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Transit ({counts.transit})</TabsTrigger>
                    <TabsTrigger value="arrived" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Arrived ({counts.arrived})</TabsTrigger>
                    <TabsTrigger value="pod-pending" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">POD Pending ({counts.podPending})</TabsTrigger>
                    <TabsTrigger value="closed" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Closed ({counts.closed})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={paginatedData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession} 
                        canVerifyPod={isAdminSession} 
                        selectedIds={selectedIds}
                        onSelectRow={(id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))}
                        onSelectAll={(checked) => setSelectedIds(checked ? paginatedData.map(t => t.id) : [])}
                        onVerifyPod={() => {}} 
                        onUploadPod={setPodUploadTrip} 
                        onGenerateLR={(t) => setLrGenerateTrip({ trip: t, carrier: (dbCarriers || []).find(c => c.id === t.carrierId) })} 
                        onViewLR={onViewLR} 
                        onViewTrip={setViewTripData} 
                        onUpdatePod={setPodUploadTrip} 
                        onCancelTrip={(t) => setCancelTripData(t)} 
                        onEditTrip={() => {}} 
                        onTrack={(row) => router.push(`/dashboard/shipment-tracking?search=${row.tripId}`)} 
                        onEditVehicle={setEditVehicleTrip} 
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

      {lrGenerateTrip && <LRGenerationModal isOpen={!!lrGenerateTrip} onClose={() => setLrGenerateTrip(null)} trip={lrGenerateTrip.trip} carrier={lrGenerateTrip.carrier} onGenerate={() => setLrGenerateTrip(null)} />}
      {podUploadTrip && <PodUploadModal isOpen={!!podUploadTrip} onClose={() => setPodUploadTrip(null)} trip={podUploadTrip} onSuccess={() => setPodUploadTrip(null)} />}
      {viewTripData && <TripViewModal isOpen={!!viewTripData} onClose={() => setViewTripData(null)} trip={viewTripData} />}
      {editVehicleTrip && <EditVehicleModal isOpen={!!editVehicleTrip} onClose={() => setEditVehicleTrip(null)} trip={editVehicleTrip} onSave={handleUpdateVehicle} />}
      {cancelTripData && <CancelTripModal isOpen={!!cancelTripData} onClose={() => setCancelTripData(null)} trip={cancelTripData} onConfirm={handleCancelTrip} />}
      {lrPreviewData && <LRPrintPreviewModal isOpen={!!lrPreviewData} onClose={() => setLrPreviewData(null)} lr={lrPreviewData} />}
    </div>
  );
}

export default function TripBoardPage() {
    return <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}><TripBoardContent /></Suspense>;
}
