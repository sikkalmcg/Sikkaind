
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
import type { WithId, Shipment, Trip, Plant, SubUser, Carrier, LR, VehicleEntryExit } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { normalizePlantId, parseSafeDate, calculateDuration, generateRandomTripId } from '@/lib/utils';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, query, doc, getDoc, updateDoc, setDoc, serverTimestamp, runTransaction, where, limit, onSnapshot, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { Loader2, WifiOff, MonitorPlay, RefreshCcw, Search, Factory, Filter, ArrowRightLeft, Trash2, Ban, FileDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/date-picker';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';

export type TripBoardTab = 'active' | 'loading' | 'transit' | 'arrived' | 'pod-status' | 'rejection' | 'closed';

function TripBoardContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showLoader, hideLoader } = useLoading();
  
  const activeTab = (searchParams.get('tab') as TripBoardTab) || 'active';
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
        const invoiceNumbers = Array.from(new Set(items.map((i: any) => i.invoiceNumber || i.invoiceNo || i.deliveryNumber).filter(Boolean))).join(', ');
        const summarizedItems = Array.from(new Set(items.map((i: any) => i.itemDescription || i.description).filter(Boolean))).join(', ') || shipment?.itemDescription || shipment?.material || '--';

        const units = items.reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0);
        const dispatchedQty = lr ? (Number(lr.assignedTripWeight) || 0) : (Number(t.assignedQtyInTrip || t.assignQty) || 0);

        const s = (t.currentStatusId || t.tripStatus || 'assigned').toLowerCase().trim().replace(/[\s_-]+/g, '-');

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
            loadingPoint: t.loadingPoint || shipment?.loadingPoint || '--',
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

  const handleAction = async (type: string, trip: any) => {
    if (type === 'view') setViewTripData(trip);
    if (type === 'track') router.push(`/dashboard/shipment-tracking?search=${trip.vehicleNumber}`);
    if (type === 'view-lr') setPreviewLrData(trip);
    if (type === 'edit-lr') {
        setEditLrTrip(trip);
        setEditLrCarrier(trip.carrierObj);
    }
    if (type === 'edit-vehicle') setEditVehicleTrip(trip);
    if (type === 'cancel') setCancelTripData(trip);
    if (type === 'arrived') setArrivedTrip(trip);
    if (type === 'unloaded') setUnloadedTrip(trip);
    if (type === 'reject') setRejectTrip(trip);
    if (type === 'pod-status') setPodStatusTrip(trip);
    if (type === 'pod-upload') setPodUploadTrip(trip);
    if (type === 'srn') setSrnTrip(trip);
    if (type === 're-sent') {
        if (!firestore || !user) return;
        showLoader();
        try {
            const plantId = normalizePlantId(trip.originPlantId);
            const tripRef = doc(firestore, `plants/${plantId}/trips`, trip.id);
            const globalTripRef = doc(firestore, 'trips', trip.id);
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

  const handleCancelTrip = async () => {
    if (!firestore || !user || !cancelTripData) return;
    showLoader();
    try {
        await runTransaction(firestore, async (tx) => {
            const plantId = normalizePlantId(cancelTripData.originPlantId);
            const tripRef = doc(firestore, `plants/${plantId}/trips`, cancelTripData.id);
            const globalTripRef = doc(firestore, 'trips', cancelTripData.id);
            const shipId = cancelTripData.shipmentIds[0];
            const shipRef = doc(firestore, `plants/${plantId}/shipments`, shipId);
            const shipSnap = await tx.get(shipRef);
            if (shipSnap.exists()) {
                const sData = shipSnap.data() as Shipment;
                const newAssigned = (sData.assignedQty || 0) - cancelTripData.assignedQtyInTrip;
                tx.update(shipRef, { assignedQty: newAssigned, balanceQty: sData.quantity - newAssigned, currentStatusId: newAssigned > 0 ? 'Partly Vehicle Assigned' : 'pending', lastUpdateDate: serverTimestamp() });
            }
            tx.delete(tripRef);
            tx.delete(globalTripRef);
        });
        toast({ title: 'Mission Purged' });
        setCancelTripData(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { hideLoader(); }
  };

  const handleEditVehicle = async (id: string, values: any) => {
    if (!firestore) return;
    showLoader();
    try {
        const plantId = normalizePlantId(editVehicleTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, id);
        const globalTripRef = doc(firestore, 'trips', id);
        const update = { ...values, lastUpdated: serverTimestamp() };
        await updateDoc(tripRef, update);
        await setDoc(globalTripRef, update, { merge: true });
        toast({ title: 'Registry Updated' });
        setEditVehicleTrip(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { hideLoader(); }
  };

  const handleArrived = async (values: any) => {
    if (!firestore || !arrivedTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(arrivedTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, arrivedTrip.id);
        const globalTripRef = doc(firestore, 'trips', arrivedTrip.id);
        const arrivalDate = new Date(`${values.arrivedDate.toISOString().split('T')[0]}T${values.arrivedTime}`);
        const update = { arrivalDate, tripStatus: 'Arrival For Delivery', currentStatusId: 'arrival-for-delivery', lastUpdated: serverTimestamp() };
        await updateDoc(tripRef, update);
        await setDoc(globalTripRef, update, { merge: true });
        toast({ title: 'Registry Updated' });
        setArrivedTrip(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { hideLoader(); }
  };

  const handleUnloaded = async (values: any) => {
    if (!firestore || !unloadedTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(unloadedTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, unloadedTrip.id);
        const globalTripRef = doc(firestore, 'trips', unloadedTrip.id);
        const actualCompletionDate = new Date(`${values.unloadDate.toISOString().split('T')[0]}T${values.unloadTime}`);
        const update = { actualCompletionDate, tripStatus: 'Delivered', currentStatusId: 'delivered', lastUpdated: serverTimestamp() };
        await updateDoc(tripRef, update);
        await setDoc(globalTripRef, update, { merge: true });
        toast({ title: 'Registry Updated' });
        setUnloadedTrip(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { hideLoader(); }
  };

  const handleReject = async (values: any) => {
    if (!firestore || !rejectTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(rejectTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, rejectTrip.id);
        const globalTripRef = doc(firestore, 'trips', rejectTrip.id);
        const rejectedAt = new Date(`${values.rejectDate.toISOString().split('T')[0]}T${values.rejectTime}`);
        const update = { rejectedAt, tripStatus: 'Rejected', currentStatusId: 'rejected', rejectReason: values.rejectedBy, rejectRemark: values.remark, lastUpdated: serverTimestamp() };
        await updateDoc(tripRef, update);
        await setDoc(globalTripRef, update, { merge: true });
        toast({ title: 'Registry Updated' });
        setRejectTrip(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { hideLoader(); }
  };

  const handlePodStatus = async (values: any) => {
    if (!firestore || !podStatusTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(podStatusTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, podStatusTrip.id);
        const globalTripRef = doc(firestore, 'trips', podStatusTrip.id);
        
        const isReceived = values.podReceived === true;
        const update: any = { 
            ...values, 
            podUploadedBy: user?.displayName || user?.email, 
            podUploadDate: serverTimestamp(), 
            lastUpdated: serverTimestamp() 
        };

        if (isReceived) {
            update.tripStatus = 'Closed';
            update.currentStatusId = 'closed';
        }

        await updateDoc(tripRef, update);
        await setDoc(globalTripRef, update, { merge: true });
        
        toast({ title: isReceived ? 'Mission Closed' : 'Registry Updated' });
        setPodStatusTrip(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { hideLoader(); }
  };

  const handleSrn = async (values: any) => {
    if (!firestore || !srnTrip) return;
    showLoader();
    try {
        const plantId = normalizePlantId(srnTrip.originPlantId);
        const tripRef = doc(firestore, `plants/${plantId}/trips`, srnTrip.id);
        const globalTripRef = doc(firestore, 'trips', srnTrip.id);
        const update = { ...values, tripStatus: 'Closed', currentStatusId: 'closed', srnBy: user?.displayName || user?.email, lastUpdated: serverTimestamp() };
        await updateDoc(tripRef, update);
        await setDoc(globalTripRef, update, { merge: true });
        toast({ title: 'Registry Updated' });
        setSrnTrip(null);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { hideLoader(); }
  };

  const processedData = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : null;
    const dayEnd = toDate ? endOfDay(toDate) : null;

    return joinedData.filter(t => {
      const start = t.startDate;
      if (dayStart && start && start < dayStart) return false;
      if (dayEnd && start && start > dayEnd) return false;
      
      const s = t.normalizedStatus;
      switch (activeTab) {
        case 'active': return s !== 'closed' && s !== 'cancelled';
        case 'loading': return s === 'assigned' || s === 'vehicle-assigned' || s === 'loaded' || s === 'loading-complete';
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
      return (
        t.tripId?.toLowerCase().includes(s) ||
        t.vehicleNumber?.toLowerCase().includes(s) ||
        t.lrNumber?.toLowerCase().includes(s) ||
        t.consignor?.toLowerCase().includes(s) ||
        t.consignee?.toLowerCase().includes(s)
      );
    });
  }, [joinedData, activeTab, fromDate, toDate, searchTerm]);

  const counts = useMemo(() => {
    const res = { active: 0, loading: 0, transit: 0, arrived: 0, pod: 0, rejection: 0, closed: 0 };
    joinedData.forEach(t => {
        const s = t.normalizedStatus;
        if (s !== 'closed' && s !== 'cancelled') res.active++;
        if (s === 'assigned' || s === 'vehicle-assigned' || s === 'loaded' || s === 'loading-complete') res.loading++;
        else if (s === 'in-transit') res.transit++;
        else if (s === 'arrived' || s === 'arrival-for-delivery' || s === 'arrive-for-deliver') res.arrived++;
        else if (s === 'delivered') res.pod++;
        else if (s === 'rejected') res.rejection++;
        else if (s === 'closed') res.closed++;
    });
    return res;
  }, [joinedData]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedData.slice(start, start + itemsPerPage);
  }, [processedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage);

  const handleDownloadExcel = () => {
    const exportData = processedData.map(t => ({
        'Plant': t.plantName,
        'Trip ID': t.tripId,
        'Vehicle Number': t.vehicleNumber,
        'LR Number': t.lrNumber,
        'Consignor': t.consignor,
        'Consignee': t.consignee,
        'Destination': t.unloadingPoint,
        'Weight (MT)': t.dispatchedQty,
        'Status': t.tripStatus,
        'Date': t.startDate ? format(t.startDate, 'dd-MM-yy HH:mm') : '--'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Trip Registry");
    XLSX.writeFile(workbook, `TripBoard_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <main className="flex flex-1 flex-col h-full overflow-hidden bg-white">
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-lg rotate-3">
              <MonitorPlay className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight uppercase italic leading-none">Mission Control Board</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Live Operational registry Node</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-[2rem] border border-slate-100 shadow-inner">
            <div className="grid gap-1">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Lifting Scope</Label>
              <MultiSelectPlantFilter options={plants} selected={selectedPlants} onChange={handlePlantChange} isLoading={isAuthLoading} />
            </div>
            <div className="grid gap-1">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Period From</Label>
              <DatePicker date={fromDate} setDate={setFromDate} className="h-9" />
            </div>
            <div className="grid gap-1">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Period To</Label>
              <DatePicker date={toDate} setDate={setTodayDate} className="h-9" />
            </div>
            <div className="grid gap-1">
              <Label className="text-[9px] font-black uppercase text-slate-400 px-1">Search Registry</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="Search trips..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 w-[240px] border-slate-200 font-bold" />
              </div>
            </div>
            <div className="flex items-end gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="h-9 px-4 font-black uppercase text-[10px] tracking-widest border-slate-200"><FileDown className="h-4 w-4 mr-2"/> Export</Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-900" onClick={() => window.location.reload()}><RefreshCcw className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { updateURL(selectedPlants, v); setCurrentPage(1); }} className="w-full">
          <TabsList className="bg-transparent h-10 p-0 border-b-0 gap-8 justify-start overflow-x-auto custom-scrollbar">
            {[
                { id: 'active', label: 'All Active', count: counts.active },
                { id: 'loading', label: 'Yard/Loading', count: counts.loading },
                { id: 'transit', label: 'In Transit', count: counts.transit },
                { id: 'arrived', label: 'Arrived', count: counts.arrived },
                { id: 'pod-status', label: 'POD Verification', count: counts.pod },
                { id: 'rejection', label: 'Rejection/SRN', count: counts.rejection },
                { id: 'closed', label: 'History Ledger', count: counts.closed }
            ].map(t => (
                <TabsTrigger key={t.id} value={t.id} className="relative h-10 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-900 data-[state=active]:bg-transparent px-0 font-bold uppercase text-[11px] tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                    {t.label} <Badge className="ml-2 bg-slate-100 text-slate-500 border-none font-black text-[9px]">{t.count}</Badge>
                </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Mission Pulse...</p>
            </div>
        ) : (
            <div className="space-y-6">
                <TripBoardTable 
                    data={paginatedData} 
                    activeTab={activeTab} 
                    isAdmin={isAdminSession}
                    onAction={handleAction} 
                />
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={processedData.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
            </div>
        )}
      </div>

      {viewTripData && <TripViewModal isOpen={!!viewTripData} onClose={() => setViewTripData(null)} trip={viewTripData} />}
      {cancelTripData && <CancelTripModal isOpen={!!cancelTripData} onClose={() => setCancelTripData(null)} trip={cancelTripData} onConfirm={handleCancelTrip} />}
      {editVehicleTrip && <EditVehicleModal isOpen={!!editVehicleTrip} onClose={() => setEditVehicleTrip(null)} trip={editVehicleTrip} onSave={handleEditVehicle} />}
      {arrivedTrip && <ArrivedModal isOpen={!!arrivedTrip} onClose={() => setArrivedTrip(null)} trip={arrivedTrip} onPost={handleArrived} />}
      {unloadedTrip && <UnloadedModal isOpen={!!unloadedTrip} onClose={() => setUnloadedTrip(null)} trip={unloadedTrip} onPost={handleUnloaded} />}
      {rejectTrip && <RejectModal isOpen={!!rejectTrip} onClose={() => setRejectTrip(null)} trip={rejectTrip} onPost={handleReject} />}
      {podStatusTrip && <PodStatusModal isOpen={!!podStatusTrip} onClose={() => setPodStatusTrip(null)} trip={podStatusTrip} onPost={handlePodStatus} />}
      {podUploadTrip && <PodUploadModal isOpen={!!podUploadTrip} onClose={() => setPodUploadTrip(null)} trip={podUploadTrip} onSuccess={() => setPodUploadTrip(null)} />}
      {srnTrip && <SrnModal isOpen={!!srnTrip} onClose={() => setSrnTrip(null)} trip={srnTrip} onPost={handleSrn} />}
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
    </main>
  );
}

export default function TripBoardPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <TripBoardContent />
        </Suspense>
    );
}
