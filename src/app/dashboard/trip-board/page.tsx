
'use client';
import { useState, useEffect, useMemo, Suspense, useRef, useCallback } from 'react';
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
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import LRGenerationModal from '@/components/dashboard/lr-create/LRGenerationModal';
import VehicleAssignModal from '@/components/dashboard/vehicle-assign/VehicleAssignModal';
import TripTrackingModal from '@/components/dashboard/trip-board/TripTrackingModal';
import SimTrackModal from '@/components/dashboard/trip-board/SimTrackModal';
import DelayRemarkModal from '@/components/dashboard/trip-board/DelayRemarkModal';
import ChangeToContractModal from '@/components/dashboard/trip-board/ChangeToContractModal';
import OrderDetailsDrawer from '@/components/dashboard/vehicle-assign/OrderDetailsDrawer';
import type { WithId, Shipment, Trip, Plant, SubUser, Carrier, LR, VehicleEntryExit, Party } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { DEFAULT_LMC_TERMS } from '@/lib/constants';
import { normalizePlantId, parseSafeDate, calculateDuration, generateRandomTripId, cn } from '@/lib/utils';
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, doc, updateDoc, setDoc, addDoc, serverTimestamp, runTransaction, getDocs, where, limit, onSnapshot, writeBatch, orderBy, deleteDoc } from "firebase/firestore";
import { Loader2, WifiOff, MonitorPlay, RefreshCcw, Search, Factory, Filter, ArrowRightLeft, Trash2, Ban, FileDown, Container, X, ClipboardList, CheckCircle2, Truck, PlusCircle, ArrowUpDown, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { DatePicker } from '@/components/date-picker';
import { Button } from '@/components/ui/button';

type TripBoardTab = 'pending-assignment' | 'open-order' | 'loading' | 'transit' | 'arrived' | 'pod-status' | 'rejection' | 'closed';

function TripBoardContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showLoader, hideLoader } = useLoading();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const activeTab = (searchParams.get('tab') as TripBoardTab) || 'pending-assignment';
  const urlPlants = useMemo(() => (searchParams.get('plants')?.split(',').filter(Boolean) || []).map(normalizePlantId), [searchParams]);

  const [selectedPlants, setSelectedPlants] = useState<string[]>(urlPlants);
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 30)));
  const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  const [sortAlphabetical, setSortAlphabetical] = useState(false);
  
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

  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);

  const [viewTripData, setViewTripData] = useState<any | null>(null);
  const [drawerOrder, setDrawerOrder] = useState<any | null>(null);
  const [cancelTripData, setCancelTripData] = useState<any | null>(null);
  const [editVehicleTrip, setEditVehicleTrip] = useState<any | null>(null);
  const [arrivedTrip, setArrivedTrip] = useState<any | null>(null);
  const [unloadedTrip, setUnloadedTrip] = useState<any | null>(null);
  const [rejectTrip, setRejectTrip] = useState<any | null>(null);
  const [podStatusTrip, setPodStatusTrip] = useState<any | null>(null);
  const [podUploadTrip, setPodUploadTrip] = useState<any | null>(null);
  const [srnTrip, setSrnTrip] = useState<any | null>(null);
  const [lrPreviewData, setLrPreviewData] = useState<EnrichedLR | null>(null);
  const [editLrTrip, setEditLrTrip] = useState<any | null>(null);
  const [editLrCarrier, setEditLrCarrier] = useState<any | null>(null);
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedShipmentsForAssign, setSelectedShipmentsForAssign] = useState<WithId<Shipment>[]>([]);
  const [editingTrip, setEditingTrip] = useState<WithId<Trip> | null>(null);
  const [trackingTrip, setTrackingTrip] = useState<any | null>(null);
  const [simTrackTrip, setSimTrackTrip] = useState<any | null>(null);
  const [delayRemarkShipment, setDelayRemarkShipment] = useState<any | null>(null);
  const [changeToContractTrip, setChangeToContractTrip] = useState<any | null>(null);

  const isAdminSession = useMemo(() => {
    return user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
  }, [user]);

  const masterPlantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: allMasterPlants } = useCollection<Plant>(masterPlantsQuery);
  const carriersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "carriers")) : null, [firestore]);
  const { data: dbCarriers } = useCollection<Carrier>(carriersQuery);
  const partiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_parties"), where("isDeleted", "==", false)) : null, [firestore]);
  const { data: parties } = useCollection<Party>(partiesQuery);

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

            const normalizedAuthIds = authIds.map(normalizePlantId);
            setAuthorizedPlantIds(normalizedAuthIds);
            const authorizedPlants = baseList.filter(p => normalizedAuthIds.includes(normalizePlantId(p.id)));
            setPlants(authorizedPlants);

            if (!isInitialized.current) {
                if (urlPlants.length > 0) {
                    setSelectedPlants(urlPlants.map(normalizePlantId));
                } else if (normalizedAuthIds.length > 0) {
                    setSelectedPlants(normalizedAuthIds);
                }
                isInitialized.current = true;
            }
        } catch (e) { setDbError(true); } finally { setIsAuthLoading(false); }
    };
    fetchAuth();
  }, [firestore, user, allMasterPlants, isAdminSession, urlPlants]);

  const handlePlantChange = (ids: string[]) => {
    const normalized = ids.map(normalizePlantId);
    setSelectedPlants(normalized);
    updateURL(normalized);
  };

  useEffect(() => {
    if (!firestore || !user || selectedPlants.length === 0) {
      if (selectedPlants.length === 0 && isInitialized.current) {
          setShipments([]);
          setTrips([]);
          setEntries([]);
          setLrs([]);
          setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(onSnapshot(collection(firestore, "vehicleEntries"), (snap) => {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data(), entryTimestamp: parseSafeDate(d.data().entryTimestamp), exitTimestamp: parseSafeDate(d.data().exitTimestamp) } as any)));
    }));

    selectedPlants.forEach((pId) => {
      const plantId = normalizePlantId(pId);
      
      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/trips`), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, originPlantId: plantId, ...d.data(), startDate: parseSafeDate(d.data().startDate), outDate: parseSafeDate(d.data().outDate), arrivalDate: parseSafeDate(d.data().arrivalDate), actualCompletionDate: parseSafeDate(d.data().actualCompletionDate), lrDate: parseSafeDate(d.data().lrDate), srnDate: parseSafeDate(d.data().srnDate), podUploadDate: parseSafeDate(d.data().podUploadDate), rejectedAt: parseSafeDate(d.data().rejectedAt), lastUpdated: parseSafeDate(d.data().lastUpdated) } as any));
        setTrips(prev => {
            const others = prev.filter(t => normalizePlantId(t.originPlantId) !== plantId);
            return [...others, ...list];
        });
        setIsLoading(false);
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/shipments`), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, originPlantId: plantId, ...d.data(), creationDate: parseSafeDate(d.data().creationDate) } as any));
        setShipments(prev => [...prev.filter(s => normalizePlantId(s.originPlantId) !== plantId), ...list]);
      }));

      unsubscribers.push(onSnapshot(collection(firestore, `plants/${plantId}/lrs`), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, originPlantId: plantId, ...d.data(), date: parseSafeDate(d.data().date) } as any));
        setLrs(prev => [...prev.filter(l => l.originPlantId !== plantId), ...list]);
      }));
    });

    return () => unsubscribers.forEach(u => u());
  }, [firestore, user, JSON.stringify(selectedPlants)]);

  const joinedData = useMemo(() => {
    const normalizedSelected = selectedPlants.map(normalizePlantId);
    
    return trips
      .filter(t => normalizedSelected.includes(normalizePlantId(t.originPlantId)))
      .map(t => {
        const tPlantId = normalizePlantId(t.originPlantId);
        const shipId = Array.isArray(t.shipmentIds) ? t.shipmentIds[0] : (t.shipmentIds || t.shipmentId);
        const shipment = shipments.find(s => (s.id === shipId || s.shipmentId === shipId) && normalizePlantId(s.originPlantId) === tPlantId);
        const lr = lrs.find(l => l.tripDocId === t.id || l.tripId === t.tripId || (l.lrNumber === t.lrNumber && l.originPlantId === t.originPlantId));
        const entry = entries.find(e => (e.tripId === t.id || (e.vehicleNumber === t.vehicleNumber && e.status === 'OUT')) && normalizePlantId(e.plantId) === tPlantId);
        
        const carrier = (dbCarriers || []).find(c => c.id === t.carrierId || c.id === shipment?.carrierId || (t.carrierName && c.name === t.carrierName) || (shipment?.carrierName && c.name === shipment.carrierName));

        const plant = plants.find(p => normalizePlantId(p.id) === tPlantId);

        const items = lr?.items || t.items || shipment?.items || [];
        const invoiceNumbers = Array.from(new Set(items.map((i: any) => i.invoiceNumber || i.invoiceNo || i.deliveryNumber || i.deliveryNo).filter(Boolean))).join(', ');
        
        const uniqueDescs = Array.from(new Set(items.map((i: any) => (i.itemDescription || i.description || '').toUpperCase().trim()).filter(Boolean)));
        const summarizedItems = uniqueDescs.length > 2 ? "VARIOUS ITEMS AS PER INVOICE" : (uniqueDescs.join(', ') || shipment?.itemDescription || shipment?.material || '--');

        const units = items.reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0);
        const dispatchedQty = lr ? (Number(lr.assignedTripWeight) || 0) : (Number(t.assignedQtyInTrip || t.assignQty) || 0);

        const s = (t.tripStatus || t.currentStatusId || 'assigned').toLowerCase().trim().replace(/[\s/_-]+/g, '-');

        return {
            ...t,
            plant,
            plantName: plant?.name || t.originPlantId,
            orderNo: shipment?.shipmentId || t.shipmentId || '--',
            orderCreatedUser: shipment?.userName || '--',
            consignor: t.consignor || shipment?.consignor || '--',
            consignorAddress: shipment?.consignorAddress || shipment?.loadingPoint || '--',
            consignorGtin: t.consignorGtin || shipment?.consignorGtin || '',
            billToParty: t.billToParty || shipment?.billToParty || '--',
            billToGtin: t.billToGtin || shipment?.billToGtin || '',
            shipToParty: t.shipToParty || shipment?.shipToParty || '--',
            shipToGtin: t.shipToGtin || shipment?.shipToGtin || '',
            consignee: t.billToParty || shipment?.billToParty || '--',
            deliveryAddress: shipment?.deliveryAddress || shipment?.unloadingPoint || '--',
            from: t.loadingPoint || shipment?.loadingPoint || '--',
            unloadingPoint: t.unloadingPoint || shipment?.unloadingPoint || t.destination || '--',
            assignedUsername: t.userName || '--',
            invoiceNumbers: invoiceNumbers || shipment?.invoiceNumber || '--',
            itemDescription: summarizedItems,
            ewaybillNumber: shipment?.ewaybillNumber || '--',
            unitUom: `${units || shipment?.totalUnits || '--'} PKG`,
            qtyUom: `${dispatchedQty.toFixed(3)} MT`,
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
            carrierName: carrier?.name || t.carrierName || shipment?.carrierName || '--',
            paymentTerm: t.paymentTerm || shipment?.paymentTerm || 'Paid',
            normalizedStatus: s
        };
    });
}, [trips, shipments, lrs, entries, plants, dbCarriers, selectedPlants]);

  const processedData = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : startOfDay(subDays(new Date(), 7));
    const dayEnd = toDate ? endOfDay(toDate) : endOfDay(new Date());
    const normalizedSelected = selectedPlants.map(normalizePlantId);

    if (activeTab === 'pending-assignment') {
        let list = shipments
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
                
                const items = s.items || [];
                const invs = Array.from(new Set(items.map((i: any) => i.invoiceNumber || i.invoiceNo || i.deliveryNumber || i.deliveryNo).filter(Boolean))).join(', ') || s.invoiceNumber || '--';

                return {
                    ...s,
                    plantName: plant?.name || s.originPlantId,
                    type: 'shipment',
                    orderNo: s.shipmentId,
                    qtyUom: `${s.quantity} MT`,
                    balanceUom: `${s.balanceQty} MT`,
                    carrierObj: (dbCarriers || []).find(c => c.id === s.carrierId || c.name === s.carrierName),
                    invoiceNumbers: invs,
                    consignee: s.billToParty || '--'
                };
            })
            .filter(s => {
                if (!searchTerm) return true;
                const searchLower = searchTerm.toLowerCase();
                return (s.shipmentId?.toLowerCase().includes(searchLower) || s.consignor?.toLowerCase().includes(searchLower) || s.billToParty?.toLowerCase().includes(searchLower) || s.invoiceNumbers?.toLowerCase().includes(searchLower));
            });

        if (sortAlphabetical) {
            list = list.sort((a, b) => (a.billToParty || '').localeCompare(b.billToParty || ''));
        }
        return list;
    }

    return joinedData.filter(t => {
      const start = t.startDate;
      if (dayStart && start && start < dayStart) return false;
      if (dayEnd && start && start > dayEnd) return false;
      
      const s = t.normalizedStatus;
      switch (activeTab) {
        case 'open-order': return s === 'assigned' || s === 'vehicle-assigned';
        case 'loading': return s === 'yard' || s === 'yard-loading' || s === 'loading' || s === 'loaded' || s === 'loading-complete';
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
      return (t.tripId?.toLowerCase().includes(s) || t.vehicleNumber?.toLowerCase().includes(s) || t.lrNumber?.toLowerCase().includes(s) || t.consignor?.toLowerCase().includes(s) || t.consignee?.toLowerCase().includes(s) || t.invoiceNumbers?.toLowerCase().includes(s));
    });
  }, [joinedData, shipments, activeTab, fromDate, toDate, searchTerm, selectedPlants, plants, sortAlphabetical, dbCarriers]);

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
        else if (s === 'yard' || s === 'yard-loading' || s === 'loading' || s === 'loaded' || s === 'loading-complete') res.loading++;
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
        'Plant': t.plantName, 'ID': t.tripId || t.shipmentId, 'Invoice Number': t.invoiceNumbers || '--', 'Vehicle Number': t.vehicleNumber || '--', 'LR Number': t.lrNumber || '--', 'Consignor': t.consignor, 'Consignee': t.consignee || t.billToParty, 'Destination': t.unloadingPoint, 'Weight (MT)': t.dispatchedQty || t.quantity, 'Status': t.tripStatus || t.currentStatusId, 'Date': t.startDate ? format(t.startDate, 'dd-MM-yy HH:mm') : (t.creationDate ? format(t.creationDate, 'dd-MM-yy HH:mm') : '--')
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mission Registry");
    XLSX.writeFile(workbook, `TripBoard_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleEditVehicleSave = async (tripId: string, values: any) => {
    if (!firestore || !user || !editVehicleTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(editVehicleTrip.originPlantId);
        const ts = serverTimestamp();
        const currentName = user.displayName || user.email?.split('@')[0] || 'System';

        await runTransaction(firestore, async (transaction) => {
            const tripRef = doc(firestore, `plants/${plantId}/trips`, tripId);
            const globalTripRef = doc(firestore, 'trips', tripId);
            
            const updateData: any = {
                vehicleNumber: values.vehicleNumber,
                driverMobile: values.driverMobile || '',
                vehicleType: values.vehicleType,
                freightRate: values.freightRate || 0,
                isFixRate: !!values.isFixRate,
                fixedAmount: values.fixedAmount || 0,
                lastUpdated: ts
            };

            if (values.transporterName) {
                updateData.transporterName = values.transporterName;
            }

            transaction.update(tripRef, updateData);
            transaction.update(globalTripRef, updateData);

            const logRef = doc(collection(firestore, "activity_logs"));
            transaction.set(logRef, {
                userId: user.uid,
                userName: currentName,
                action: 'Vehicle Correction',
                tcode: 'Trip Board',
                pageName: 'Mission Registry',
                timestamp: ts,
                description: `Corrected vehicle for Trip ${editVehicleTrip.tripId} to ${values.vehicleNumber}. Type: ${values.vehicleType}`
            });
        });

        toast({ title: 'Vehicle Corrected', description: 'Registry node updated successfully.' });
        setEditVehicleTrip(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Correction Failed', description: e.message });
    } finally {
        hideLoader();
    }
  };

  const handleAction = async (type: string, row: any) => {
    if (type === 'assign') {
        setSelectedShipmentsForAssign([row]);
        setAssignModalOpen(true);
    }
    if (type === 'view-order') {
        setDrawerOrder(row);
    }
    if (type === 'delay-remark') {
        setDelayRemarkShipment(row);
    }
    if (type === 'change-to-contract') {
        setChangeToContractTrip(row);
    }
    if (type === 'toggle-sort') {
        setSortAlphabetical(!sortAlphabetical);
        return;
    }
    if (type === 'view') setViewTripData(row);
    if (type === 'track') {
        if (row.vehicleType === 'Market Vehicle' || row.vehicleType === 'Contract Vehicle') {
            setSimTrackTrip(row);
        } else {
            setTrackingTrip(row);
        }
    }
    if (type === 'view-lr-direct') {
        setLrPreviewData(row);
    }
    if (type === 'view-lr') {
        if (!row.lrNumber || !firestore) return;
        showLoader();
        try {
            const plantId = normalizePlantId(row.originPlantId);
            const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
            
            let q = query(lrsRef, where("lrNumber", "==", row.lrNumber), limit(1));
            let snap = await getDocs(q);
            
            const pIdStr = normalizePlantId(row.originPlantId);
            const isSikkaLmcShorthand = row.carrierName?.toLowerCase().trim() === 'sikka lmc';
            
            let finalCarrier: any = row.carrierObj || (dbCarriers || []).find(c => 
                c.id === row.carrierId || 
                c.id === row.shipmentObj?.carrierId || 
                c.name === row.carrierName
            );

            if (!finalCarrier && (pIdStr === '1426' || pIdStr === 'ID20')) {
                finalCarrier = {
                    id: 'ID20',
                    name: 'SIKKA INDUSTRIES AND LOGISTICS',
                    address: '20Km. Stone, Near Tivoli Grand Resort, Khasra No. -9, G.T. Karnal Road, Jindpur, Delhi - 110036',
                    mobile: '9136688004',
                    gstin: '07AYQPS6936B1ZZ',
                    stateCode: '07',
                    stateName: 'DELHI',
                    pan: 'AYQPS6936B',
                    email: 'sil@sikkaenterprises.com',
                    terms: DEFAULT_LMC_TERMS
                };
            } else if (!finalCarrier && (pIdStr === '1214' || pIdStr === 'ID23' || isSikkaLmcShorthand)) {
                finalCarrier = {
                    id: 'ID21',
                    name: 'SIKKA LMC',
                    address: 'B-11, BULANDSHAHR ROAD INDLAREA, GHAZIABAD, UTTAR PRADESH, 201009',
                    mobile: '9136688004',
                    gstin: '09AYQPS6936B1ZV',
                    stateCode: '09',
                    stateName: 'UTTAR PRADESH',
                    pan: 'AYQPS6936B',
                    email: 'sil@sikkaenterprises.com',
                    terms: DEFAULT_LMC_TERMS
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
                    email: 'sil@sikkaenterprises.com',
                    terms: DEFAULT_LMC_TERMS
                };
            }

            const shipmentObj = row.shipmentObj || {};

            const resolveParty = (name?: string, code?: string) => {
                if (!name && !code) return null;
                const upperName = name?.toUpperCase();
                const upperCode = code?.toUpperCase();
                return (parties || []).find(p =>
                    (upperCode && p.customerCode?.toUpperCase() === upperCode) ||
                    (upperName && p.name?.toUpperCase() === upperName)
                );
            };

            const consignorParty = resolveParty(row.consignor, row.customerCode);
            const buyerParty = resolveParty(row.billToParty, row.billToCode);
            let shipToPartyVal = row.shipToParty || row.billToParty;
            let shipToCodeVal = row.shipToCode || row.billToCode;
            const shipToPartyObj = resolveParty(shipToPartyVal, shipToCodeVal);

            const consignorGtin = row.consignorGtin || consignorParty?.gstin || '';
            const buyerGtin = row.billToGtin || buyerParty?.gstin || '';
            const shipToGtin = row.shipToGtin || shipToPartyObj?.gstin || '';
            
            const buyerMobile = row.billToMobile || buyerParty?.mobile || '';
            const shipToMobile = row.shipToMobile || shipToPartyObj?.mobile || '';

            const manifestItems = row.items && row.items.length > 0 ? row.items : [{
                invoiceNumber: row.summarizedInvoices || row.invoiceNumbers || 'NA',
                ewaybillNumber: row.ewaybillNumber || '',
                units: row.totalUnitsCount || 1,
                unitType: 'Package',
                itemDescription: row.summarizedItems || row.itemDescription || 'GENERAL CARGO',
                weight: row.dispatchedQty || row.assignedQtyInTrip || row.quantity
            }];

            if (snap.empty) {
                setLrPreviewData({
                    lrNumber: row.lrNumber,
                    date: row.lrDate || new Date(),
                    trip: row as any,
                    carrier: finalCarrier,
                    shipment: shipmentObj,
                    plant: row.plant || { id: row.originPlantId, name: row.plantName },
                    items: manifestItems,
                    weightSelection: 'Assigned Weight',
                    assignedTripWeight: row.quantity,
                    from: row.from || shipmentObj.loadingPoint || '',
                    to: row.unloadingPoint || shipmentObj.unloadingPoint || '',
                    consignorName: row.consignor || shipmentObj.consignor || '',
                    consignorGtin: consignorGtin,
                    consignorAddress: row.consignorAddress || shipmentObj.consignorAddress || '',
                    consignorCode: row.customerCode || '',
                    buyerName: row.billToParty || shipmentObj.billToParty || row.billToParty || '',
                    buyerAddress: row.billToAddress || shipmentObj.billToAddress || shipmentObj.deliveryAddress || shipmentObj.unloadingPoint || '',
                    buyerGtin: buyerGtin,
                    buyerMobile: buyerMobile,
                    buyerCode: row.billToCode || '',
                    shipToParty: shipToPartyVal || shipmentObj.shipToParty || shipmentObj.billToParty || '',
                    shipToGtin: shipToGtin,
                    shipToMobile: shipToMobile,
                    shipToCode: shipToCodeVal || '',
                    deliveryAddress: row.deliveryAddress || shipmentObj.deliveryAddress || row.unloadingPoint || '',
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
                    plant: row.plant || { id: row.originPlantId, name: row.plantName },
                    consignorName: lrDoc.consignorName || row.consignor || '',
                    consignorAddress: lrDoc.consignorAddress || row.consignorAddress || '',
                    consignorGtin: lrDoc.consignorGtin || row.shipmentObj?.consignorGtin || consignorGtin,
                    buyerName: lrDoc.buyerName || row.billToParty || '',
                    buyerAddress: lrDoc.buyerAddress || row.billToAddress || row.deliveryAddress || row.unloadingPoint || '',
                    buyerGtin: lrDoc.buyerGtin || buyerGtin,
                    buyerMobile: lrDoc.buyerMobile || buyerMobile,
                    buyerCode: lrDoc.buyerCode || row.billToCode || '',
                    shipToParty: lrDoc.shipToParty || shipToPartyVal || '',
                    shipToGtin: lrDoc.shipToGtin || shipToGtin,
                    shipToMobile: lrDoc.shipToMobile || shipToMobile,
                    shipToCode: lrDoc.shipToCode || shipToCodeVal || '',
                    deliveryAddress: lrDoc.deliveryAddress || lrDoc.deliveryAddress || row.unloadingPoint || '',
                    vehicleNumber: row.vehicleNumber || lrDoc.vehicleNumber,
                    driverName: row.driverName || lrDoc.driverName,
                    driverMobile: row.driverMobile || lrDoc.driverMobile,
                    paymentTerm: row.paymentTerm || lrDoc.paymentTerm
                } as any);
            }
        } catch (e) {
            toast({ variant: 'destructive', title: "Registry Error", description: "Could not extract LR manifest." });
        } finally {
            hideLoader();
        }
    }
    if (type === 'edit-lr') {
        let finalCarrier = (dbCarriers || []).find(c => 
            c.id === row.carrierId || 
            c.id === row.shipmentObj?.carrierId || 
            c.name === row.carrierName
        ) || row.carrierObj;
        
        if (!finalCarrier) {
            const pIdStr = normalizePlantId(row.originPlantId);
            const isSikkaLmcShorthand = row.carrierName?.toLowerCase().trim() === 'sikka lmc';
            
            if (pIdStr === '1426' || pIdStr === 'ID20') {
                finalCarrier = {
                    id: 'ID20',
                    name: 'SIKKA INDUSTRIES AND LOGISTICS',
                    address: '20Km. Stone, Near Tivoli Grand Resort, Khasra No. -9, G.T. Karnal Road, Jindpur, Delhi - 110036',
                    mobile: '9136688004',
                    gstin: '07AYQPS6936B1ZZ',
                    stateCode: '07',
                    stateName: 'DELHI',
                    pan: 'AYQPS6936B',
                    email: 'sil@sikkaenterprises.com',
                    terms: DEFAULT_LMC_TERMS
                };
            } else if (pIdStr === '1214' || pIdStr === 'ID23' || isSikkaLmcShorthand) {
                finalCarrier = {
                    id: 'ID21',
                    name: 'SIKKA LMC',
                    address: 'B-11, BULANDSHAHR ROAD INDLAREA, GHAZIABAD, UTTAR PRADESH, 201009',
                    mobile: '9136688004',
                    gstin: '09AYQPS6936B1ZV',
                    stateCode: '09',
                    stateName: 'UTTAR PRADESH',
                    pan: 'AYQPS6936B',
                    email: 'sil@sikkaenterprises.com',
                    terms: DEFAULT_LMC_TERMS
                };
            }
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
                email: 'sil@sikkaenterprises.com',
                terms: DEFAULT_LMC_TERMS
            };
        }

        setEditLrTrip(row);
        setEditLrCarrier(finalCarrier);
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
            const update = { tripStatus: 'Yard/Loading', currentStatusId: 'yard-loading', entryTime: ts, lastUpdated: ts };
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

  const handleArrivedPost = async (values: any) => {
    if (!firestore || !user || !arrivedTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(arrivedTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, arrivedTrip.id);
        const globalTripRef = doc(firestore, 'trips', arrivedTrip.id);
        const historyRef = collection(firestore, `plants/${plantId}/status_updates`);

        const arrivalDate = new Date(values.arrivedDate);
        const [hours, mins] = (values.arrivedTime || '00:00').split(':');
        arrivalDate.setHours(parseInt(hours), parseInt(mins), 0, 0);

        const ts = serverTimestamp();
        const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System');

        const updateData = {
            tripStatus: 'Arrival for Delivery',
            currentStatusId: 'arrival-for-delivery',
            arrivalDate: arrivalDate,
            lastUpdated: ts
        };

        await updateDoc(tripRef, updateData);
        await updateDoc(globalTripRef, updateData);

        await addDoc(historyRef, {
            tripId: arrivedTrip.tripId,
            vehicleNumber: arrivedTrip.vehicleNumber || 'N/A',
            shipToParty: arrivedTrip.shipToParty || arrivedTrip.shipment?.shipToParty || 'N/A',
            unloadingPoint: arrivedTrip.unloadingPoint || arrivedTrip.shipment?.unloadingPoint || 'N/A',
            previousStatus: arrivedTrip.tripStatus || arrivedTrip.currentStatusId,
            previousStatusTimestamp: arrivedTrip.lastUpdated || arrivedTrip.startDate,
            newStatus: 'Arrival for Delivery',
            timestamp: ts,
            updatedBy: currentName,
            remarks: 'Vehicle reported at destination node.'
        });

        toast({ title: 'Arrival Recorded', description: `Registry updated for ${arrivedTrip.vehicleNumber}.` });
        setArrivedTrip(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally { hideLoader(); }
  };

  const handleUnloadedPost = async (values: any) => {
    if (!firestore || !user || !unloadedTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(unloadedTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, unloadedTrip.id);
        const globalTripRef = doc(firestore, 'trips', unloadedTrip.id);
        const shipmentId = Array.isArray(unloadedTrip.shipmentIds) ? unloadedTrip.shipmentIds[0] : unloadedTrip.shipmentIds;
        const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipmentId);
        const historyRef = collection(firestore, `plants/${plantId}/status_updates`);

        const unloadDate = new Date(values.unloadDate);
        const [hours, mins] = (values.unloadTime || '00:00').split(':');
        unloadDate.setHours(parseInt(hours), parseInt(mins), 0, 0);

        const ts = serverTimestamp();
        const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System');

        const updateData = {
            tripStatus: 'Delivered',
            currentStatusId: 'delivered',
            actualCompletionDate: unloadDate,
            lastUpdated: ts
        };

        await updateDoc(tripRef, updateData);
        await updateDoc(globalTripRef, updateData);
        await updateDoc(shipmentRef, { currentStatusId: 'Delivered', lastUpdateDate: ts });

        await addDoc(historyRef, {
            tripId: unloadedTrip.tripId,
            vehicleNumber: unloadedTrip.vehicleNumber || 'N/A',
            shipToParty: unloadedTrip.shipToParty || unloadedTrip.shipment?.shipToParty || 'N/A',
            unloadingPoint: unloadedTrip.unloadingPoint || unloadedTrip.shipment?.unloadingPoint || 'N/A',
            previousStatus: unloadedTrip.tripStatus || unloadedTrip.currentStatusId,
            previousStatusTimestamp: unloadedTrip.lastUpdated || unloadedTrip.startDate,
            newStatus: 'Delivered',
            timestamp: ts,
            updatedBy: currentName,
            remarks: 'Vehicle unloaded at destination.'
        });

        toast({ title: 'Unload Handshake OK', description: 'Mission transitioned to Delivered node.' });
        setUnloadedTrip(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { hideLoader(); }
  };

  const handleRejectPost = async (values: any) => {
    if (!firestore || !user || !rejectTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(rejectTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, rejectTrip.id);
        const globalTripRef = doc(firestore, 'trips', rejectTrip.id);
        const historyRef = collection(firestore, `plants/${plantId}/status_updates`);

        const rejectDate = new Date(values.rejectDate);
        const [hours, mins] = (values.rejectTime || '00:00').split(':');
        rejectDate.setHours(parseInt(hours), parseInt(mins), 0, 0);

        const ts = serverTimestamp();
        const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System');

        const updateData = {
            tripStatus: 'Rejected',
            currentStatusId: 'rejected',
            rejectedAt: rejectDate,
            rejectReason: values.rejectedBy,
            rejectRemark: values.remark || '',
            lastUpdated: ts
        };

        await updateDoc(tripRef, updateData);
        await updateDoc(globalTripRef, updateData);

        await addDoc(historyRef, {
            tripId: rejectTrip.tripId,
            vehicleNumber: rejectTrip.vehicleNumber || 'N/A',
            shipToParty: rejectTrip.shipToParty || rejectTrip.shipment?.shipToParty || 'N/A',
            unloadingPoint: rejectTrip.unloadingPoint || rejectTrip.shipment?.unloadingPoint || 'N/A',
            previousStatus: rejectTrip.tripStatus || rejectTrip.currentStatusId,
            previousStatusTimestamp: rejectTrip.lastUpdated || rejectTrip.startDate,
            newStatus: 'Rejected',
            timestamp: ts,
            updatedBy: currentName,
            remarks: `Mission REJECTED: ${values.rejectedBy}. ${values.remark || ''}`
        });

        toast({ title: 'Rejection Logged', description: `Trip ${rejectTrip.tripId} marked as Rejected.` });
        setRejectTrip(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { hideLoader(); }
  };

  const handlePodStatusPost = async (values: any) => {
    if (!firestore || !user || !podStatusTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(podStatusTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, podStatusTrip.id);
        const globalTripRef = doc(firestore, 'trips', podStatusTrip.id);
        const ts = serverTimestamp();
        const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System');

        const updateData = {
            podReceived: values.podReceived,
            podStatus: values.podReceived ? 'Verified' : 'Pending',
            podVerifiedBy: currentName,
            lastUpdated: ts
        };

        await updateDoc(tripRef, updateData);
        await updateDoc(globalTripRef, updateData);

        toast({ title: 'POD Status Updated' });
        setPodStatusTrip(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { hideLoader(); }
  };

  const handleSrnPost = async (values: any) => {
    if (!firestore || !user || !srnTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(srnTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, srnTrip.id);
        const globalTripRef = doc(firestore, 'trips', srnTrip.id);
        const shipmentId = Array.isArray(srnTrip.shipmentIds) ? srnTrip.shipmentIds[0] : srnTrip.shipmentIds;
        const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipmentId);
        const historyRef = collection(firestore, `plants/${plantId}/status_updates`);

        const ts = serverTimestamp();
        const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System');

        const updateData = {
            tripStatus: 'Closed',
            currentStatusId: 'closed',
            srnNumber: values.srnNumber,
            srnDate: values.srnDate,
            srnBy: currentName,
            lastUpdated: ts
        };

        await updateDoc(tripRef, updateData);
        await updateDoc(globalTripRef, updateData);
        await updateDoc(shipmentRef, { currentStatusId: 'Rejected', lastUpdateDate: ts });

        await addDoc(historyRef, {
            tripId: srnTrip.tripId,
            vehicleNumber: srnTrip.vehicleNumber || 'N/A',
            shipToParty: srnTrip.shipToParty || srnTrip.shipment?.shipToParty || 'N/A',
            unloadingPoint: srnTrip.unloadingPoint || srnTrip.shipment?.unloadingPoint || 'N/A',
            previousStatus: srnTrip.tripStatus || srnTrip.currentStatusId,
            previousStatusTimestamp: srnTrip.lastUpdated || srnTrip.startDate,
            newStatus: 'Closed (SRN)',
            timestamp: ts,
            updatedBy: currentName,
            remarks: `SRN Registered: ${values.srnNumber}. Mission closed.`
        });

        toast({ title: 'SRN Registered', description: `Mission finalized and archived.` });
        setSrnTrip(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { hideLoader(); }
  };

  const handleCancelConfirm = async () => {
    if (!firestore || !user || !cancelTripData) return;
    
    let plantId = normalizePlantId(cancelTripData.originPlantId);
    let shipIds = cancelTripData.shipmentIds || cancelTripData.shipmentId || [];
    if (!Array.isArray(shipIds)) shipIds = [shipIds];
    
    if (!plantId) {
        const foundTrip = trips.find(t => t.id === cancelTripData.id);
        plantId = normalizePlantId(foundTrip?.originPlantId || '');
    }

    if (!plantId) {
        toast({ 
            variant: 'destructive', 
            title: 'Revocation Blocked', 
            description: 'Plant Node mapping is incomplete. Force purge may leave orphans.' 
        });
        setCancelTripData(null);
        return;
    }

    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const tripId = cancelTripData.id;
            const tripRef = doc(firestore, `plants/${plantId}/trips`, tripId);
            const globalTripRef = doc(firestore, 'trips', tripId);
            
            for (const shipId of shipIds) {
                if (!shipId) continue;
                const shipmentRef = doc(firestore, `plants/${plantId}/shipments`, shipId);
                const shipSnap = await transaction.get(shipmentRef);
                
                if (shipSnap.exists()) {
                    const sData = shipSnap.data() as Shipment;
                    const assignedInTrip = Number(cancelTripData.assignedQtyInTrip) || 0;
                    
                    const newAssigned = Math.max(0, (sData.assignedQty || 0) - assignedInTrip);
                    const newBalance = sData.quantity - newAssigned;

                    transaction.update(shipmentRef, {
                        assignedQty: newAssigned,
                        balanceQty: newBalance,
                        currentStatusId: newAssigned > 0 ? 'Partly Vehicle Assigned' : 'pending',
                        lastUpdateDate: serverTimestamp()
                    });
                }
            }

            transaction.delete(tripRef);
            transaction.delete(globalTripRef);
        });

        toast({ title: 'Mission Revoked', description: 'Fleet allocation successfully reverted in registry.' });
        setCancelTripData(null);
    } catch (e: any) {
        console.error("Purge Error:", e);
        toast({ variant: 'destructive', title: 'Revocation Failed', description: e.message || 'Registry handshake failed.' });
    } finally { hideLoader(); }
  };

  const handleDelayRemarkSuccess = async (remark: string) => {
    if (!firestore || !delayRemarkShipment) return;
    showLoader();
    try {
        const plantId = normalizePlantId(delayRemarkShipment.originPlantId);
        const shipRef = doc(firestore, `plants/${plantId}/shipments`, delayRemarkShipment.id);
        await updateDoc(shipRef, {
            delayRemark: remark,
            lastUpdateDate: serverTimestamp()
        });
        toast({ title: 'Remark Committed', description: 'Justification node added to mission registry.' });
        setDelayRemarkShipment(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Sync Failed', description: e.message });
    } finally {
        hideLoader();
    }
  };

  const handleChangeToContractSave = async (contractorId: string, contractorName: string) => {
    if (!firestore || !user || !changeToContractTrip) return;
    showLoader();
    try {
        const trip = changeToContractTrip;
        const plantId = normalizePlantId(trip.originPlantId);
        const timestamp = serverTimestamp();

        await runTransaction(firestore, async (transaction) => {
            const tripRef = doc(firestore, `plants/${plantId}/trips`, trip.id);
            const globalTripRef = doc(firestore, 'trips', trip.id);
            const lrRef = doc(firestore, `plants/${plantId}/lrs`, `lr-${trip.id}`); // Traditional ID matching

            const updateData = {
                vehicleType: 'Contract Vehicle',
                carrierId: contractorId,
                carrierName: contractorName,
                lrGenerated: false,
                lrNumber: "",
                lrDate: null,
                lastUpdated: timestamp
            };

            transaction.update(tripRef, updateData);
            transaction.update(globalTripRef, updateData);
            transaction.delete(lrRef);

            // Also check for any custom LR doc with specific lrNumber
            if (trip.lrNumber) {
                const lrSearchQ = query(collection(firestore, `plants/${plantId}/lrs`), where("lrNumber", "==", trip.lrNumber), limit(1));
                const lrSearchSnap = await getDocs(lrSearchQ);
                if (!lrSearchSnap.empty) {
                    transaction.delete(lrSearchSnap.docs[0].ref);
                }
            }
        });

        toast({ title: 'Registry Transition Complete', description: 'Mission converted to Contract node. LR manifest purged.' });
        setChangeToContractTrip(null);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Transition Failed', description: e.message });
    } finally {
        hideLoader();
    }
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

            <div className="flex items-center gap-3">
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
          </div>
          
          <div className="flex flex-wrap items-end gap-1.5 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100 shadow-inner">
            <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
              <Label className="text-[7px] md:text-[8px] font-black uppercase text-slate-400 px-1">PLANT SCOPE</Label>
              <MultiSelectPlantFilter options={plants || []} selected={selectedPlants} onChange={handlePlantChange} isLoading={isAuthLoading} />
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
                <FileDown className="h-3.5 w-3.5 mr-1"/> EXPORT
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-blue-900" onClick={() => window.location.reload()}>
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { updateURL(selectedPlants, v); setCurrentPage(1); setSelectedPendingIds([]); }} className="w-full mt-2 md:mt-3 overflow-x-auto no-scrollbar">
          <TabsList className="bg-transparent h-8 md:h-9 p-0 border-b-0 gap-3 md:gap-6 justify-start flex-nowrap shrink-0">
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
                <TabsTrigger key={t.id} value={t.id} className="relative h-8 md:h-9 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-900 data-[state=active]:bg-transparent px-0 font-bold uppercase text-[8px] md:text-[10px] tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-1 md:gap-1.5 whitespace-nowrap shrink-0">
                    {t.icon && <t.icon className="h-2.5 md:h-3 w-2.5 md:w-3" />}
                    {t.label} <Badge className="ml-1 bg-slate-100 text-slate-500 border-none font-black text-[7px] md:text-[8px] px-1 h-4 shrink-0">{t.count}</Badge>
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
                {activeTab === 'pending-assignment' && (
                    <div className="flex items-center gap-3 px-2 mb-2 animate-in fade-in duration-300">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Group by:</span>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleAction('toggle-sort', null)}
                            className={cn(
                                "h-8 px-4 gap-2 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all shadow-sm",
                                sortAlphabetical 
                                    ? "bg-blue-900 text-white border-blue-900 shadow-blue-200" 
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            <ArrowUpDown className="h-3 w-3" /> Consignee A-Z
                        </Button>
                    </div>
                )}
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

        {activeTab === 'pending-assignment' && selectedPendingIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-4xl animate-in slide-in-from-bottom-10 duration-500">
                <div className="bg-slate-900 text-white rounded-[1.5rem] md:rounded-[2rem] shadow-3xl p-3 md:p-6 flex items-center justify-between gap-3 md:gap-10 border border-white/10 backdrop-blur-xl">
                    <div className="flex items-center gap-2 md:gap-4 border-r border-white/10 pr-3 md:pr-10 shrink-0">
                        <div className="p-1.5 md:p-2.5 bg-blue-600 rounded-lg md:rounded-xl shadow-lg shrink-0"><Truck className="h-4 w-4 md:h-5 md:w-5" /></div>
                        <div className="hidden sm:block">
                            <p className="text-[7px] md:text-[8px] font-black uppercase text-slate-400 tracking-widest">BULK ALLOCATION</p>
                            <p className="text-[10px] md:text-sm font-black text-white uppercase">{selectedPendingIds.length} SELECTED</p>
                        </div>
                        <div className="sm:hidden">
                            <p className="text-[10px] font-black text-white">{selectedPendingIds.length}</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-0 min-w-0">
                        <span className="text-[7px] md:text-[8px] font-black uppercase text-slate-400 tracking-widest truncate">Agg. Qty</span>
                        <div className="flex items-baseline gap-1 md:gap-2">
                            <span className="text-sm md:text-2xl font-black text-blue-400 tracking-tighter">{bulkTotalQty.toFixed(2)}</span>
                            <span className="text-[7px] md:text-[10px] font-black text-slate-500">MT</span>
                        </div>
                    </div>
                    <Button 
                        onClick={handleBulkAssign}
                        className="bg-white hover:bg-blue-50 text-blue-900 h-10 md:h-14 px-4 md:px-12 rounded-xl md:rounded-2xl font-black uppercase text-[8px] md:text-xs tracking-widest shadow-xl transition-all active:scale-95 border-none flex-1 max-w-[200px]"
                    >
                        <span className="hidden md:inline">INITIALIZE BULK ASSIGN</span>
                        <span className="md:hidden">ASSIGN</span>
                    </Button>
                    <button 
                        onClick={() => setSelectedPendingIds([])}
                        className="p-1 md:p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors shrink-0"
                    >
                        <X className="h-4 w-4 md:h-5 md:w-5" />
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
            onAssignmentComplete={() => { setAssignModalOpen(false); 
                setEditingTrip(null); 
                setSelectedShipmentsForAssign([]);
                setSelectedPendingIds([]);
            }}
        />
      )}

      {viewTripData && <TripViewModal isOpen={!!viewTripData} onClose={() => setViewTripData(null)} trip={viewTripData} />}
      {drawerOrder && <OrderDetailsDrawer isOpen={!!drawerOrder} onClose={() => setDrawerOrder(null)} shipment={drawerOrder} />}
      {cancelTripData && <CancelTripModal isOpen={!!cancelTripData} onClose={() => setCancelTripData(null)} trip={cancelTripData} onConfirm={handleCancelConfirm} />}
      {editVehicleTrip && <EditVehicleModal isOpen={!!editVehicleTrip} onClose={() => setEditVehicleTrip(null)} trip={editVehicleTrip} onSave={handleEditVehicleSave} />}
      {arrivedTrip && <ArrivedModal isOpen={!!arrivedTrip} onClose={() => setArrivedTrip(null)} trip={arrivedTrip} onPost={handleArrivedPost} />}
      {unloadedTrip && <UnloadedModal isOpen={!!unloadedTrip} onClose={() => setUnloadedTrip(null)} trip={unloadedTrip} onPost={handleUnloadedPost} />}
      {rejectTrip && <RejectModal isOpen={!!rejectTrip} onClose={() => setRejectTrip(null)} trip={rejectTrip} onPost={handleRejectPost} />}
      {podStatusTrip && <PodStatusModal isOpen={!!podStatusTrip} onClose={() => setPodStatusTrip(null)} trip={podStatusTrip} onPost={handlePodStatusPost} />}
      {podUploadTrip && <PodUploadModal isOpen={!!podUploadTrip} onClose={() => setPodUploadTrip(null)} trip={podUploadTrip} onSuccess={() => setPodUploadTrip(null)} />}
      {srnTrip && <SrnModal isOpen={!!srnTrip} onClose={() => setSrnTrip(null)} trip={srnTrip} onPost={handleSrnPost} />}
      {lrPreviewData && <LRPrintPreviewModal isOpen={!!lrPreviewData} onClose={() => setLrPreviewData(null)} lr={lrPreviewData} />}
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
      {trackingTrip && (
        <TripTrackingModal 
            isOpen={!!trackingTrip}
            onClose={() => setTrackingTrip(null)}
            trip={trackingTrip}
        />
      )}
      {simTrackTrip && (
        <SimTrackModal 
            isOpen={!!simTrackTrip}
            onClose={() => setSimTrackTrip(null)}
            trip={simTrackTrip}
        />
      )}
      {delayRemarkShipment && (
        <DelayRemarkModal 
            isOpen={!!delayRemarkShipment}
            onClose={() => setDelayRemarkShipment(null)}
            shipment={delayRemarkShipment}
            onSuccess={handleDelayRemarkSuccess}
        />
      )}
      {changeToContractTrip && (
        <ChangeToContractModal 
            isOpen={!!changeToContractTrip}
            onClose={() => setChangeToContractTrip(null)}
            trip={changeToContractTrip}
            carriers={dbCarriers || []}
            onSuccess={handleChangeToContractSave}
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
