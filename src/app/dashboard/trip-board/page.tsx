'use client';
import { useState, useEffect, useMemo, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import * as XLSX from 'xlsx';
import TripBoardTable from '@/components/dashboard/trip-board/TripBoardTable';
import TripViewModal from '@/components/dashboard/trip-board/TripViewModal';
import CancelTripModal from '@/components/dashboard/trip-board/CancelTripModal';
import EditVehicleModal from '@/components/dashboard/trip-board/EditVehicleModal';
import ArrivedModal from '@/components/dashboard/trip-board/ArrivedModal';
import UnloadedModal from '@/components/dashboard/trip-board/UnloadedModal';
import RejectModal from '@/components/dashboard/trip-board/RejectModal';
import PodStatusModal from '@/components/dashboard/trip-board/PodStatusModal';
import PodUploadModal from '@/components/dashboard/trip-board/PodUploadModal';
import SrnModal from '@/components/dashboard/trip-board/SrnModal';
import MultiSelectPlantFilter from '@/components/dashboard/MultiSelectPlantFilter';
import LRPrintPreviewModal from '@/components/dashboard/lr-create/LRPrintPreviewModal';
import LRGenerationModal from '@/components/dashboard/lr-create/LRGenerationModal';
import VehicleAssignModal from '@/components/dashboard/vehicle-assign/VehicleAssignModal';
import type { WithId, Shipment, Trip, Plant, SubUser, Carrier, LR, VehicleEntryExit } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { normalizePlantId, parseSafeDate, calculateDuration, generateRandomTripId } from '@/lib/utils';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, doc, getDoc, updateDoc, setDoc, addDoc, serverTimestamp, runTransaction, where, limit, onSnapshot, getDocs, orderBy } from "firebase/firestore";
import { Loader2, WifiOff, MonitorPlay, RefreshCcw, Search, Factory, Filter, ArrowRightLeft, Trash2, Ban, FileDown, Container, X, ClipboardList, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/date-picker';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';

export type TripBoardTab = 'pending-assignment' | 'open-order' | 'loading' | 'transit' | 'arrived' | 'pod-status' | 'rejection' | 'closed';

/**
 * @fileOverview Mission Control Board.
 * Re-engineered header for optimized mobile visibility.
 * Flexible grid eliminates filter overlap and layout breakage.
 */
function TripBoardContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showLoader, hideLoader } = useLoading();
  
  const activeTab = (searchParams.get('tab') as TripBoardTab) || 'pending-assignment';
  const urlPlants = useMemo(() => searchParams.get('plants')?.split(',').filter(Boolean) || [], [searchParams]);

  const [selectedPlants, setSelectedPlants] = useState<string[]>(urlPlants);
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 30)));
  const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [shipments, setShipments] = useState<WithId<Shipment>[]>([]);
  const [lrs, setLrs] = useState<WithId<LR>[]>([]);
  const [entries, setEntries] = useState<WithId<VehicleEntryExit>[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  
  const isInitialized = useRef(false);

  // Bulk State
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);

  const [viewTripData, setViewTripData] = useState<any | null>(null);
  const [cancelTripData, setCancelTripData] = useState<any | null>(null);
  const [editVehicleTrip, setEditVehicleTrip] = useState<any | null>(null);
  const [arrivedTrip, setArrivedTrip] = useState<any | null>(null);
  const [unloadedTrip, setUnloadedTrip] = useState<any | null>(null);
  const [rejectTrip, setRejectTrip] = useState<any | null>(null);
  const [podStatusTrip, setPodStatusTrip] = useState<any | null>(null);
  const [podUploadTrip, setPodUploadTrip] = useState<any | null>(null);
  const [srnTrip, setSrnTrip] = useState<any | null>(null);
  const [previewLrData, setPreviewLrData] = useState<EnrichedLR | null>(null);
  const [editLrTrip, setEditLrTrip] = useState<any | null>(null);
  const [editLrCarrier, setEditLrCarrier] = useState<any | null>(null);
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedShipmentsForAssign, setSelectedShipmentsForAssign] = useState<WithId<Shipment>[]>([]);
  const [editingTrip, setEditingTrip] = useState<WithId<Trip> | null>(null);

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
            setTrips([]);
            setShipments([]);
            setLrs([]);
            setIsLoading(false);
        }
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
            startDate: parseSafeDate(d.data().startDate),
            outDate: parseSafeDate(d.data().outDate),
            arrivalDate: parseSafeDate(d.data().arrivalDate),
            actualCompletionDate: parseSafeDate(d.data().actualCompletionDate),
            lrDate: parseSafeDate(d.data().lrDate),
            srnDate: parseSafeDate(d.data().srnDate),
            podUploadDate: parseSafeDate(d.data().podUploadDate),
            rejectedAt: parseSafeDate(d.data().rejectedAt),
            lastUpdated: parseSafeDate(d.data().lastUpdated)
        } as any));
        setTrips(prev => {
            const others = prev.filter(t => t.originPlantId !== plantId);
            return [...others, ...list];
        });
        setIsLoading(false);
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/shipments`), (snap) => {
        const list = snap.docs.map(d => ({ 
            id: d.id, 
            originPlantId: plantId, 
            ...d.data(),
            creationDate: parseSafeDate(d.data().creationDate)
        } as any));
        setShipments(prev => {
            const others = prev.filter(s => s.originPlantId !== plantId);
            return [...others, ...list];
        });
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/lrs`), (snap) => {
        const list = snap.docs.map(d => ({
          id: d.id,
          originPlantId: plantId,
          ...d.data(),
          date: parseSafeDate(d.data().date)
        } as any));
        setLrs(prev => {
            const others = prev.filter(l => l.originPlantId !== plantId);
            return [...others, ...list];
        });
      }));
    });

    unsubscribers.push(onSnapshot(collection(firestore, "vehicleEntries"), (snap) => {
        setEntries(snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(),
            entryTimestamp: parseSafeDate(d.data().entryTimestamp),
            exitTimestamp: parseSafeDate(d.data().exitTimestamp)
        } as any)));
    }));

    return () => unsubscribers.forEach(u => u());
  }, [firestore, JSON.stringify(selectedPlants)]);

  const joinedData = useMemo(() => {
    const normalizedSelected = selectedPlants.map(normalizePlantId);
    
    return trips
      .filter(t => normalizedSelected.includes(normalizePlantId(t.originPlantId)))
      .map(t => {
        const shipId = Array.isArray(t.shipmentIds) ? t.shipmentIds[0] : t.shipmentIds;
        const shipment = shipments.find(s => s.id === shipId || s.shipmentId === shipId);
        const lr = lrs.find(l => l.tripDocId === t.id || l.tripId === t.tripId || (l.lrNumber === t.lrNumber && l.originPlantId === t.originPlantId));
        const entry = entries.find(e => e.tripId === t.id || (e.vehicleNumber === t.vehicleNumber && e.status === 'OUT' && normalizePlantId(e.plantId) === normalizePlantId(t.originPlantId)));
        const carrier = dbCarriers?.find(c => c.id === t.carrierId);
        const plant = plants.find(p => normalizePlantId(p.id) === normalizePlantId(t.originPlantId));

        const items = lr?.items || t.items || shipment?.items || [];
        const invoiceNumbers = Array.from(new Set(items.map((i: any) => i.invoiceNumber || i.invoiceNo || i.deliveryNumber || i.deliveryNo).filter(Boolean))).join(', ');
        const summarizedItems = Array.from(new Set(items.map((i: any) => i.itemDescription || i.description).filter(Boolean))).join(', ') || shipment?.itemDescription || shipment?.material || '--';

        const units = items.reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0);
        const dispatchedQty = lr ? (Number(lr.assignedTripWeight) || 0) : (Number(t.assignedQtyInTrip || t.assignQty) || 0);

        const s = (t.tripStatus || t.currentStatusId || 'assigned').toLowerCase().trim().replace(/[\s_-]+/g, '-');

        return {
            ...t,
            plant,
            plantName: plant?.name || t.originPlantId,
            orderNo: shipment?.shipmentId || '--',
            orderCreatedUser: shipment?.userName || '--',
            consignor: t.consignor || shipment?.consignor || '--',
            consignee: t.shipToParty || shipment?.shipToParty || shipment?.billToParty || '--',
            billToParty: t.billToParty || shipment?.billToParty || '--',
            shipToParty: t.shipToParty || shipment?.shipToParty || '--',
            from: t.loadingPoint || shipment?.loadingPoint || '--',
            unloadingPoint: t.unloadingPoint || shipment?.unloadingPoint || t.destination || '--',
            vehicleNumber: t.vehicleNumber,
            driverName: t.driverName,
            driverMobile: t.driverMobile,
            fleetType: t.vehicleType,
            vendorName: t.transporterName || '--',
            assignedUsername: t.userName || '--',
            invoiceNumbers: invoiceNumbers || shipment?.invoiceNumber || '--',
            itemDescription: summarizedItems,
            ewaybillNumber: shipment?.ewaybillNumber || '--',
            unitUom: `${units || shipment?.totalUnits || '--'} PKG`,
            qtyUom: `${dispatchedQty.toFixed(3)} ${shipment?.materialTypeId || 'MT'}`,
            dispatchedQty,
            lrNumber: lr?.lrNumber || t.lrNumber || shipment?.lrNumber || '',
            lrDate: parseSafeDate(lr?.date || t.lrDate || shipment?.lrDate),
            assignedDateTime: t.startDate,
            gateOutDateTime: t.outDate || entry?.exitTimestamp,
            arrivedDateTime: t.arrivalDate,
            unloadDateTime: t.actualCompletionDate,
            rejectDateTime: t.rejectedAt,
            resentDateTime: t.resentAt,
            resentUsername: t.resentBy,
            srnNumber: t.srnNumber || '--',
            srnDate: t.srnDate,
            srnUsername: t.srnBy,
            podStatus: t.podReceived ? 'Received' : 'Pending',
            podUpdateUsername: t.podUploadedBy || '--',
            dispatchHour: calculateDuration(t.startDate, t.outDate || entry?.exitTimestamp),
            transitHour: calculateDuration(t.outDate || entry?.exitTimestamp, t.arrivalDate),
            unloadHour: calculateDuration(t.arrivalDate, t.actualCompletionDate),
            shipmentObj: shipment,
            lrData: lr,
            carrierObj: carrier,
            entry,
            paymentTerm: t.paymentTerm || shipment?.paymentTerm || 'Paid',
            normalizedStatus: s
        };
    });
}, [trips, shipments, lrs, entries, plants, dbCarriers, selectedPlants]);

  const handleAction = async (type: string, row: any) => {
    if (type === 'assign') {
        setSelectedShipmentsForAssign([row]);
        setAssignModalOpen(true);
    }
    if (type === 'view') setViewTripData(row);
    if (type === 'track') router.push(`/dashboard/shipment-tracking?search=${row.vehicleNumber}`);
    if (type === 'view-lr') setPreviewLrData(row);
    if (type === 'edit-lr') {
        setEditLrTrip(row);
        setEditLrCarrier(row.carrierObj);
    }
    if (type === 'edit-vehicle') setEditVehicleTrip(row);
    if (type === 'cancel') setCancelTripData(row);
    if (type === 'arrived') setArrivedTrip(row);
    if (type === 'unloaded') setUnloadedTrip(row);
    if (type === 'reject') setRejectTrip(row);
    if (type === 'pod-status') setPodStatusTrip(row);
    if (type === 'pod-upload') setPodUploadTrip(row);
    if (type === 'srn') setSrnTrip(row);
    if (type === 'vehicle-in') {
        if (!firestore || !user) return;
        showLoader();
        try {
            const plantId = normalizePlantId(row.originPlantId);
            const ts = serverTimestamp();
            await addDoc(collection(firestore, "vehicleEntries"), {
                tripId: row.id,
                plantId: plantId,
                vehicleNumber: row.vehicleNumber,
                status: "IN",
                entryTimestamp: ts,
                purpose: "Loading"
            });
            const update = { tripStatus: 'Yard/Loading', currentStatusId: 'yard/loading', entryTime: ts, lastUpdated: ts };
            await updateDoc(doc(firestore, `plants/${plantId}/trips`, row.id), update);
            await setDoc(doc(firestore, 'trips', row.id), update, { merge: true });
            toast({ title: 'Vehicle In Logged' });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
        finally { hideLoader(); }
    }
    if (type === 'vehicle-out') {
        if (!firestore || !user) return;
        showLoader();
        try {
            const plantId = normalizePlantId(row.originPlantId);
            const ts = serverTimestamp();
            if (row.entry?.id) {
                await updateDoc(doc(firestore, "vehicleEntries", row.entry.id), { status: "OUT", exitTimestamp: ts });
            } else {
                await addDoc(collection(firestore, "vehicleEntries"), { tripId: row.id, plantId, vehicleNumber: row.vehicleNumber, status: "OUT", exitTimestamp: ts, outType: "Loaded" });
            }
            const update = { tripStatus: 'In Transit', currentStatusId: 'in-transit', outDate: ts, lastUpdated: ts };
            await updateDoc(doc(firestore, `plants/${plantId}/trips`, row.id), update);
            await setDoc(doc(firestore, 'trips', row.id), update, { merge: true });
            toast({ title: 'Vehicle Out & Dispatched' });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
        finally { hideLoader(); }
    }
    if (type === 're-sent') {
        if (!firestore || !user) return;
        showLoader();
        try {
            const plantId = normalizePlantId(row.originPlantId);
            const tripRef = doc(firestore, `plants/${plantId}/trips`, row.id);
            const globalTripRef = doc(firestore, 'trips', row.id);
            const ts = serverTimestamp();
            const currentName = user.displayName || user.email?.split('@')[0] || 'System';
            const update = { tripStatus: 'In Transit', currentStatusId: 'in-transit', resentAt: ts, resentBy: currentName, lastUpdated: ts };
            await updateDoc(tripRef, update);
            await setDoc(globalTripRef, update, { merge: true });
            toast({ title: 'Mission Re-activated' });
        } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
        finally { hideLoader(); }
    }
  };

  const processedData = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : null;
    const dayEnd = toDate ? endOfDay(toDate) : null;

    if (activeTab === 'pending-assignment') {
        const normalizedSelected = selectedPlants.map(normalizePlantId);
        return shipments
            .filter(s => normalizedSelected.includes(normalizePlantId(s.originPlantId)))
            .filter(s => {
                if (['cancelled', 'short closed'].includes(s.currentStatusId?.toLowerCase())) return false;
                if (s.balanceQty <= 0) return false;
                const cDate = parseSafeDate(s.creationDate);
                if (dayStart && cDate && cDate < dayStart) return false;
                if (dayEnd && cDate && cDate > dayEnd) return false;
                return true;
            })
            .map(s => {
                const plant = plants.find(p => normalizePlantId(p.id) === normalizePlantId(s.originPlantId));
                return {
                    ...s,
                    plantName: plant?.name || s.originPlantId,
                    type: 'shipment',
                    orderNo: s.shipmentId,
                    qtyUom: `${s.quantity} ${s.materialTypeId}`,
                    balanceUom: `${s.balanceQty} ${s.materialTypeId}`
                };
            })
            .filter(s => {
                if (!searchTerm) return true;
                const searchLower = searchTerm.toLowerCase();
                return (s.shipmentId?.toLowerCase().includes(searchLower) || s.consignor?.toLowerCase().includes(searchLower) || s.billToParty?.toLowerCase().includes(searchLower));
            });
    }

    return joinedData.filter(t => {
      const start = t.startDate;
      if (dayStart && start && start < dayStart) return false;
      if (dayEnd && start && start > dayEnd) return false;
      
      const s = t.normalizedStatus;
      switch (activeTab) {
        case 'open-order': return s === 'assigned' || s === 'vehicle-assigned';
        case 'loading': return s === 'yard' || s === 'yard/loading' || s === 'loading' || s === 'loaded' || s === 'loading-complete';
        case 'transit': return s === 'in-transit';
        case 'arrived': return s === 'arrived' || s === 'arrival-for-delivery' || s === 'arrive-for-deliver';
        case 'pod-status': return s === 'delivered';
        case 'rejection': return s === 'rejected';
        case 'closed': return s === 'closed';
        default: return true;
      }
    }).filter(t => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (t.tripId?.toLowerCase().includes(s) || t.vehicleNumber?.toLowerCase().includes(s) || t.lrNumber?.toLowerCase().includes(s) || t.consignor?.toLowerCase().includes(s) || t.consignee?.toLowerCase().includes(s));
    });
  }, [joinedData, shipments, activeTab, fromDate, toDate, searchTerm, selectedPlants, plants]);

  const counts = useMemo(() => {
    const res = { pendingAssignment: 0, openOrder: 0, loading: 0, transit: 0, arrived: 0, pod: 0, rejection: 0, closed: 0 };
    
    const normalizedSelected = selectedPlants.map(normalizePlantId);
    shipments.forEach(s => {
        if (normalizedSelected.includes(normalizePlantId(s.originPlantId))) {
            if (!['cancelled', 'short closed'].includes(s.currentStatusId?.toLowerCase()) && s.balanceQty > 0) {
                res.pendingAssignment++;
            }
        }
    });

    joinedData.forEach(t => {
        const s = t.normalizedStatus;
        if (s === 'assigned' || s === 'vehicle-assigned') res.openOrder++;
        else if (s === 'yard' || s === 'yard/loading' || s === 'loading' || s === 'loaded' || s === 'loading-complete') res.loading++;
        else if (s === 'in-transit') res.transit++;
        else if (s === 'arrived' || s === 'arrival-for-delivery' || s === 'arrive-for-deliver') res.arrived++;
        else if (s === 'delivered') res.pod++;
        else if (s === 'rejected') res.rejection++;
        else if (s === 'closed') res.closed++;
    });
    return res;
  }, [joinedData, shipments, selectedPlants]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const paginatedData = processedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectPendingRow = (id: string, checked: boolean) => {
    setSelectedPendingIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleSelectAllPending = (checked: boolean) => {
    if (checked) {
        setSelectedPendingIds(paginatedData.map(d => d.id));
    } else {
        setSelectedPendingIds([]);
    }
  };

  const selectedPendingShipments = useMemo(() => {
    return shipments.filter(s => selectedPendingIds.includes(s.id));
  }, [selectedPendingIds, shipments]);

  const bulkTotalQty = useMemo(() => {
    return selectedPendingShipments.reduce((sum, s) => sum + (Number(s.balanceQty) || 0), 0);
  }, [selectedPendingShipments]);

  const handleBulkAssign = () => {
    if (selectedPendingShipments.length === 0) return;
    setSelectedShipmentsForAssign(selectedPendingShipments);
    setAssignModalOpen(true);
  };

  const handleDownloadExcel = () => {
    const exportData = processedData.map(t => ({
        'Plant': t.plantName, 'ID': t.tripId || t.shipmentId, 'Vehicle Number': t.vehicleNumber || '--', 'LR Number': t.lrNumber || '--', 'Consignor': t.consignor, 'Consignee': t.consignee || t.billToParty, 'Destination': t.unloadingPoint, 'Weight (MT)': t.dispatchedQty || t.quantity, 'Status': t.tripStatus || t.currentStatusId, 'Date': t.startDate ? format(t.startDate, 'dd-MM-yy HH:mm') : (t.creationDate ? format(t.creationDate, 'dd-MM-yy HH:mm') : '--')
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Mission Registry");
    XLSX.writeFile(workbook, `TripBoard_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-white">
      <div className="sticky top-0 z-30 bg-white border-b px-4 py-1 md:px-8 md:py-2 shadow-sm shrink-0">
        <div className="flex flex-col gap-2 md:gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1 md:p-1.5 bg-blue-900 text-white rounded-lg shadow-lg rotate-3 shrink-0">
                <MonitorPlay className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm md:text-xl font-black text-blue-900 tracking-tight uppercase italic leading-none truncate">
                  <span className="md:hidden">TRIP BOARD</span>
                  <span className="hidden md:inline">MISSION CONTROL BOARD</span>
                </h1>
                <p className="hidden md:block text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">LIVE OPERATIONAL REGISTRY PLANT</p>
              </div>
            </div>

            <div className="relative flex-1 max-w-[140px] md:max-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <Input 
                placeholder="Search..." 
                value={searchTerm} 
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                className="pl-7 h-8 md:h-9 rounded-lg md:rounded-xl border-slate-200 font-bold bg-slate-50 text-[10px] md:text-xs focus-visible:ring-blue-900 shadow-inner" 
              />
            </div>
          </div>
          
          <div className="flex flex-wrap items-end gap-1.5 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100 shadow-inner">
            <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
              <Label className="text-[7px] md:text-[8px] font-black uppercase text-slate-400 px-1">PLANT SCOPE</Label>
              <MultiSelectPlantFilter options={plants} selected={selectedPlants} onChange={handlePlantChange} isLoading={isAuthLoading} />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label className="text-[7px] md:text-[8px] font-black uppercase text-slate-400 px-1">DATE FROM</Label>
              <DatePicker date={fromDate} setDate={setFromDate} className="h-8 md:h-9 rounded-lg bg-white border-none shadow-sm text-[9px] px-2" />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label className="text-[7px] md:text-[8px] font-black uppercase text-slate-400 px-1">DATE TO</Label>
              <DatePicker date={toDate} setDate={setTodayDate} className="h-8 md:h-9 rounded-lg bg-white border-none shadow-sm text-[9px] px-2" />
            </div>
            <div className="flex items-center gap-1 mt-auto ml-auto">
              <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="h-8 md:h-9 px-2 md:px-4 font-black uppercase text-[8px] md:text-[9px] tracking-widest border-slate-200 rounded-lg bg-white shadow-sm">
                <FileDown className="h-3 w-3 mr-1"/> EXPORT
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-blue-900" onClick={() => window.location.reload()}>
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { updateURL(selectedPlants, v); setCurrentPage(1); setSelectedPendingIds([]); }} className="w-full mt-2 md:mt-3">
          <TabsList className="bg-transparent h-8 md:h-9 p-0 border-b-0 gap-3 md:gap-6 justify-start overflow-x-auto no-scrollbar shrink-0">
            {[
                { id: 'pending-assignment', label: 'Assign fleet Pending', count: counts.pendingAssignment, icon: ClipboardList },
                { id: 'open-order', label: 'Open Order', count: counts.openOrder },
                { id: 'loading', label: 'Loading', count: counts.loading, icon: Container },
                { id: 'transit', label: 'In Transit', count: counts.transit },
                { id: 'arrived', label: 'Arrived', count: counts.arrived },
                { id: 'pod-status', label: 'POD Verification', count: counts.pod },
                { id: 'rejection', label: 'Rejection/SRN', count: counts.rejection },
                { id: 'closed', label: 'History Ledger', count: counts.closed }
            ].map(t => (
                <TabsTrigger key={t.id} value={t.id} className="relative h-8 md:h-9 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-900 data-[state=active]:bg-transparent px-0 font-bold uppercase text-[8px] md:text-[10px] tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-1 md:gap-1.5 whitespace-nowrap">
                    {t.icon && <t.icon className="h-2.5 md:h-3 w-2.5 md:w-3" />}
                    {t.label} <Badge className="ml-1 bg-slate-100 text-slate-500 border-none font-black text-[7px] md:text-[8px] px-1 h-4">{t.count}</Badge>
                </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-2 md:py-4 bg-slate-50 custom-scrollbar relative">
        {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Registry...</p>
            </div>
        ) : (
            <div className="space-y-4">
                <TripBoardTable 
                    data={paginatedData} 
                    activeTab={activeTab} 
                    isAdmin={isAdminSession} 
                    onAction={handleAction} 
                    selectedIds={selectedPendingIds}
                    onSelectRow={handleSelectPendingRow}
                    onSelectAll={handleSelectAllPending}
                />
                <div className="py-2 px-2 bg-white rounded-xl border border-slate-100">
                    <Pagination 
                        currentPage={currentPage} totalPages={totalPages} 
                        onPageChange={setCurrentPage} itemCount={processedData.length} 
                        canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} 
                    />
                </div>
            </div>
        )}

        {/* Floating Bulk Action Bar */}
        {activeTab === 'pending-assignment' && selectedPendingIds.length > 0 && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500">
                <div className="bg-slate-900 text-white rounded-[2rem] shadow-3xl p-4 md:p-6 flex items-center gap-6 md:gap-10 border border-white/10 backdrop-blur-xl">
                    <div className="flex items-center gap-4 border-r border-white/10 pr-6 md:pr-10">
                        <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg"><Truck className="h-5 w-5" /></div>
                        <div>
                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">BULK ALLOCATION NODES</p>
                            <p className="text-sm font-black text-white uppercase">{selectedPendingIds.length} ORDERS SELECTED</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Aggregate Registry Qty</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl md:text-2xl font-black text-blue-400 tracking-tighter">{bulkTotalQty.toFixed(3)}</span>
                            <span className="text-[10px] font-black text-slate-500">MT</span>
                        </div>
                    </div>
                    <Button 
                        onClick={handleBulkAssign}
                        className="bg-white hover:bg-blue-50 text-blue-900 h-12 md:h-14 px-8 md:px-12 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest shadow-xl transition-all active:scale-95 border-none"
                    >
                        INITIALIZE BULK ASSIGN
                    </Button>
                    <button 
                        onClick={() => setSelectedPendingIds([])}
                        className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
        )}
      </div>

      {isAssignModalOpen && selectedShipmentsForAssign.length > 0 && (
        <VehicleAssignModal 
            isOpen={isAssignModalOpen}
            onClose={() => { setAssignModalOpen(false); setEditingTrip(null); setSelectedShipmentsForAssign([]); }}
            shipments={selectedShipmentsForAssign}
            trip={editingTrip}
            carriers={dbCarriers || []}
            onAssignmentComplete={() => { 
                setAssignModalOpen(false); 
                setEditingTrip(null); 
                setSelectedShipmentsForAssign([]);
                setSelectedPendingIds([]);
            }}
        />
      )}

      {viewTripData && <TripViewModal isOpen={!!viewTripData} onClose={() => setViewTripData(null)} trip={viewTripData} />}
      {cancelTripData && <CancelTripModal isOpen={!!cancelTripData} onClose={() => setCancelTripData(null)} trip={cancelTripData} onConfirm={() => {}} />}
      {editVehicleTrip && <EditVehicleModal isOpen={!!editVehicleTrip} onClose={() => setEditVehicleTrip(null)} trip={editVehicleTrip} onSave={async () => {}} />}
      {arrivedTrip && <ArrivedModal isOpen={!!arrivedTrip} onClose={() => setArrivedTrip(null)} trip={arrivedTrip} onPost={() => {}} />}
      {unloadedTrip && <UnloadedModal isOpen={!!unloadedTrip} onClose={() => setUnloadedTrip(null)} trip={unloadedTrip} onPost={() => {}} />}
      {rejectTrip && <RejectModal isOpen={!!rejectTrip} onClose={() => setRejectTrip(null)} trip={rejectTrip} onPost={() => {}} />}
      {podStatusTrip && <PodStatusModal isOpen={!!podStatusTrip} onClose={() => setPodStatusTrip(null)} trip={podStatusTrip} onPost={() => {}} />}
      {podUploadTrip && <PodUploadModal isOpen={!!podUploadTrip} onClose={() => setPodUploadTrip(null)} trip={podUploadTrip} onSuccess={() => setPodUploadTrip(null)} />}
      {srnTrip && <SrnModal isOpen={!!srnTrip} onClose={() => setSrnTrip(null)} trip={srnTrip} onPost={() => {}} />}
      {previewLrData && <LRPrintPreviewModal isOpen={!!previewLrData} onClose={() => setPreviewLrData(null)} lr={previewLrData} />}
      {editLrTrip && editLrCarrier && (
        <LRGenerationModal 
            isOpen={!!editLrTrip}
            onClose={() => { setEditLrTrip(null); setEditLrCarrier(null); }}
            trip={editLrTrip}
            carrier={editLrCarrier}
            lrToEdit={editLrTrip.lrData}
            onGenerate={() => { setEditLrTrip(null); setEditLrCarrier(null); }}
        />
      )}
    </div>
  );
}

export default function TripBoardPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <TripBoardContent />
        </Suspense>
    );
}
