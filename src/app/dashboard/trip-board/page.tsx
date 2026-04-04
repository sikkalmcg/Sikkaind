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
import SrnModal from '@/components/dashboard/trip-board/SrnModal';
import MultiSelectPlantFilter from '@/components/dashboard/MultiSelectPlantFilter';
import LRGenerationModal from '@/components/dashboard/lr-create/LRGenerationModal';
import LRPrintPreviewModal from '@/components/dashboard/lr-create/LRPrintPreviewModal';
import type { WithId, Shipment, Trip, Plant, SubUser, Carrier, LR, VehicleEntryExit } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { normalizePlantId, parseSafeDate, calculateDuration } from '@/lib/utils';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, query, doc, getDoc, updateDoc, serverTimestamp, runTransaction, where, limit, onSnapshot, getDocs, orderBy } from "firebase/firestore";
import { Loader2, WifiOff, MonitorPlay, RefreshCcw, Search, Factory, Filter, ArrowRightLeft, Trash2, Ban, FileDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/date-picker';
import { startOfDay, endOfDay, subDays } from 'date-fns';
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
  const [srnTrip, setSrnTrip] = useState<any | null>(null);

  const [editLrTrip, setEditLrTrip] = useState<any | null>(null);
  const [previewLrData, setPreviewLrData] = useState<EnrichedLR | null>(null);

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
            const authPlants = baseList.filter(p => authIds.includes(p.id));
            setPlants(authPlants);

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
    if (!firestore || selectedPlants.length === 0) {
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
        const getInvoice = (i: any) => i.invoiceNumber || i.invoiceNo || i.deliveryNumber || i.deliveryNo;
        const invoiceNumbers = Array.from(new Set(items.map(getInvoice).filter(Boolean))).join(', ');
        
        const summarizedItems = Array.from(new Set(items.map((i: any) => i.itemDescription || i.description).filter(Boolean))).join(', ') || shipment?.itemDescription || shipment?.material || '--';

        const units = items.reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0);
        const dispatchedQty = lr ? (Number(lr.assignedTripWeight) || 0) : (Number(t.assignedQtyInTrip || t.assignQty) || 0);

        return {
            ...t,
            plant,
            plantName: plant?.name || t.originPlantId,
            orderNo: shipment?.shipmentId || '--',
            orderCreatedUser: shipment?.userName || '--',
            consignor: t.consignor || shipment?.consignor || '--',
            consignee: t.billToParty || shipment?.billToParty || '--',
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
            paymentTerm: t.paymentTerm || shipment?.paymentTerm || 'Paid'
        };
    });
}, [trips, shipments, lrs, entries, plants, dbCarriers, selectedPlants]);

  const finalData = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : null;
    const dayEnd = toDate ? endOfDay(toDate) : null;

    return joinedData.filter(t => {
      const checkDate = t.startDate;
      if (dayStart && checkDate && checkDate < dayStart) return false;
      if (dayEnd && checkDate && checkDate > dayEnd) return false;
      
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return Object.values(t).some(val => val?.toString().toLowerCase().includes(s));
      }
      return true;
    });
  }, [joinedData, fromDate, toDate, searchTerm]);

  const tabFilteredData = useMemo(() => {
    return finalData.filter(t => {
        const status = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim().replace(/[\s_-]+/g, '-');
        const isPod = t.podReceived === true;

        switch (activeTab) {
            case 'active': return !isPod && !['cancelled', 'rejected'].includes(status);
            case 'loading': return (status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete') && !t.gateOutDateTime;
            case 'transit': return (status === 'in-transit' || status === 'out-for-delivery' || status === 'break-down') && t.gateOutDateTime && !t.arrivedDateTime;
            case 'arrived': return ['arrived', 'arrival-for-delivery', 'arrive-for-deliver'].includes(status) && t.arrivedDateTime && !t.unloadDateTime;
            case 'pod-status': return (['arrived', 'arrival-for-delivery', 'arrive-for-deliver', 'delivered'].includes(status)) && !isPod;
            case 'rejection': return status === 'rejected';
            case 'closed': return isPod || status === 'closed' || status === 'trip-closed' || status === 'delivered';
            default: return true;
        }
    });
  }, [finalData, activeTab]);

  const totalPagesCount = Math.ceil(tabFilteredData.length / itemsPerPage);
  const paginatedData = tabFilteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const counts = useMemo(() => {
    const res = { active: 0, loading: 0, transit: 0, arrived: 0, podStatus: 0, rejection: 0, closed: 0 };
    finalData.forEach(t => {
        const status = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim().replace(/[\s_-]+/g, '-');
        const isPod = t.podReceived === true;
        
        if (!isPod && !['cancelled', 'rejected'].includes(status)) res.active++;
        if ((status === 'assigned' || status === 'vehicle-assigned' || status === 'loaded' || status === 'loading-complete') && !t.gateOutDateTime) res.loading++;
        if ((status === 'in-transit' || status === 'out-for-delivery' || status === 'break-down') && t.gateOutDateTime && !t.arrivedDateTime) res.transit++;
        if (['arrived', 'arrival-for-delivery', 'arrive-for-deliver'].includes(status) && t.arrivedDateTime && !t.unloadDateTime) res.arrived++;
        if ((['arrived', 'arrival-for-delivery', 'arrive-for-deliver', 'delivered'].includes(status)) && !isPod) res.podStatus++;
        if (status === 'rejected') res.rejection++;
        if (isPod || status === 'closed' || status === 'trip-closed' || status === 'delivered') res.closed++;
    });
    return res;
  }, [finalData]);

  const handleExport = () => {
    const dataToExport = tabFilteredData.map(item => ({
        'Plant': item.plantName,
        'Order No': item.orderNo,
        'Order Creator': item.orderCreatedUser,
        'Consignor': item.consignor,
        'Consignee': item.consignee,
        'Ship To': item.shipToParty,
        'Route': `${item.loadingPoint} → ${item.unloadingPoint}`,
        'Vehicle No': item.vehicleNumber,
        'Pilot Mobile': item.driverMobile,
        'Fleet Type': item.fleetType,
        'Vendor': item.vendorName,
        'Assigned User': item.assignedUsername,
        'Invoice No': item.invoiceNumbers,
        'E-Waybill': item.ewaybillNumber,
        'Units': item.unitUom,
        'Quantity': item.qtyUom,
        'LR No': item.lrNumber,
        'LR Date': item.lrDate ? format(item.lrDate, 'dd-MM-yyyy') : '--',
        'Assigned At': item.assignedDateTime ? format(item.assignedDateTime, 'dd-MM-yyyy HH:mm') : '--',
        'Gate Out At': item.gateOutDateTime ? format(item.gateOutDateTime, 'dd-MM-yyyy HH:mm') : '--',
        'Arrived At': item.arrivedDateTime ? format(item.arrivedDateTime, 'dd-MM-yyyy HH:mm') : '--',
        'Unloaded At': item.unloadDateTime ? format(item.unloadDateTime, 'dd-MM-yyyy HH:mm') : '--',
        'Rejected At': item.rejectDateTime ? format(item.rejectDateTime, 'dd-MM-yyyy HH:mm') : '--',
        'Re-sent At': item.resentDateTime ? format(item.resentDateTime, 'dd-MM-yyyy HH:mm') : '--',
        'Resent By': item.resentUsername,
        'SRN No': item.srnNumber,
        'SRN Date': item.srnDate ? format(item.srnDate, 'dd-MM-yyyy') : '--',
        'SRN User': item.srnUsername,
        'POD Status': item.podStatus,
        'POD User': item.podUpdateUsername,
        'Dispatch (Hr)': item.dispatchHour,
        'Transit (Hr)': item.transitHour,
        'Unload (Hr)': item.unloadHour,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mission Registry");
    XLSX.writeFile(wb, `Mission_Ledger_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

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

  const handleOpenLR = useCallback(async (row: any) => {
    if (!row.lrNumber || !firestore) return;
    showLoader();
    try {
        const plantId = normalizePlantId(row.originPlantId);
        if (!plantId) throw new Error("Plant node identification failure.");
        
        const lrsRef = collection(firestore, `plants/${plantId}/lrs`);
        const q = query(lrsRef, where("lrNumber", "==", String(row.lrNumber).trim().toUpperCase()), limit(1));
        const snap = await getDocs(q);
        
        const plantNode = row.plant || { id: row.originPlantId, name: row.plantName };
        const carrierNode = row.carrierObj || (dbCarriers || [])[0] || { name: 'SIKKA INDUSTRIES & LOGISTICS' };
        const shipmentObj = row.shipmentObj || row;

        let finalLrData: any;

        if (snap.empty) {
            const manifestItems = row.items && row.items.length > 0 ? row.items : [{
                invoiceNumber: row.invoiceNumbers || 'NA',
                ewaybillNumber: row.ewaybillNumber || '',
                units: parseInt(row.unitUom) || 1,
                unitType: 'Package',
                itemDescription: row.itemDescription || 'GENERAL CARGO',
                weight: parseFloat(row.assignedQtyInTrip) || 0
            }];

            finalLrData = {
                lrNumber: row.lrNumber,
                date: row.lrDate || new Date(),
                trip: row,
                carrier: carrierNode,
                shipment: shipmentObj,
                plant: plantNode,
                items: manifestItems,
                weightSelection: 'Assigned Weight',
                assignedTripWeight: row.assignedQtyInTrip || shipmentObj.quantity || 0,
                from: shipmentObj.loadingPoint || row.loadingPoint || '',
                to: shipmentObj.unloadingPoint || row.unloadingPoint || '',
                consignorName: shipmentObj.consignor || row.consignor || '',
                consignorGtin: shipmentObj.consignorGtin || row.consignorGtin || '',
                buyerName: shipmentObj.billToParty || row.billToParty || '',
                buyerGtin: shipmentObj.billToGtin || row.billToGtin || '',
                shipToParty: shipmentObj.shipToParty || row.shipToParty || '',
                shipToGtin: shipmentObj.shipToGtin || row.shipToGtin || '',
                deliveryAddress: shipmentObj.deliveryAddress || shipmentObj.unloadingPoint || row.unloadingPoint || '',
                // Mission Critical: Explicit Asset Mapping
                vehicleNumber: row.vehicleNumber || '--',
                driverName: row.driverName || '--',
                driverMobile: row.driverMobile || '--',
                paymentTerm: row.paymentTerm || '--',
                id: `pseudo-${Date.now()}`
            };
        } else {
            const lrDoc = snap.docs[0].data() as LR;
            finalLrData = {
                ...lrDoc,
                id: snap.docs[0].id,
                date: parseSafeDate(lrDoc.date),
                trip: row as any,
                carrier: carrierNode,
                shipment: shipmentObj,
                plant: plantNode,
                consignorGtin: lrDoc.consignorGtin || (shipmentObj as any)?.consignorGtin || '',
                buyerGtin: lrDoc.buyerGtin || (shipmentObj as any)?.billToGtin || '',
                shipToGtin: lrDoc.shipToGtin || (shipmentObj as any)?.shipToGtin || '',
                // Forced Sync from active Trip Registry
                vehicleNumber: row.vehicleNumber || lrDoc.vehicleNumber,
                driverName: row.driverName || lrDoc.driverName,
                driverMobile: row.driverMobile || lrDoc.driverMobile,
                paymentTerm: row.paymentTerm || lrDoc.paymentTerm
            };
        }
        
        setPreviewLrData(finalLrData);
    } catch (e: any) {
        console.error("LR Manifest Resolution Failure:", e);
        toast({ variant: 'destructive', title: "Registry Handshake Error", description: e.message || "Could not resolve document node." });
    } finally {
        hideLoader();
    }
  }, [firestore, showLoader, hideLoader, dbCarriers, toast]);

  const handleActionCallback = useCallback((type: string, trip: any) => {
      if (type === 'arrived') setArrivedTrip(trip);
      else if (type === 'unloaded') setUnloadedTrip(trip);
      else if (type === 'reject') setRejectTrip(trip);
      else if (type === 'pod-status') setPodStatusTrip(trip);
      else if (type === 'srn') setSrnTrip(trip);
      else if (type === 'view') setViewTripData(trip);
      else if (type === 'track') router.push(`/dashboard/shipment-tracking?search=${trip.vehicleNumber}`);
      else if (type === 'edit-vehicle') setEditVehicleTrip(trip);
      else if (type === 'cancel') setCancelTripData(trip);
      else if (type === 'edit-lr') setEditLrTrip(trip);
      else if (type === 'view-lr') handleOpenLR(trip);
  }, [router, handleOpenLR]);

  return (
    <main className="flex flex-1 flex-col h-full relative">
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
                        <MultiSelectPlantFilter options={plants} selected={selectedPlants} onChange={handlePlantChange} isLoading={isAuthLoading} />
                    </div>
                    <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1"><Filter className="h-3 w-3" /> Start Node</Label><DatePicker date={fromDate} setDate={setFromDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" /></div>
                    <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1"><Filter className="h-3 w-3" /> End Node</Label><DatePicker date={toDate} setDate={setTodayDate} className="h-11 border-slate-200 bg-white rounded-xl shadow-sm" /></div>
                </div>
                {activeTab === 'closed' && (
                    <Button onClick={handleExport} variant="outline" className="h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest bg-white border-slate-200 text-emerald-700 shadow-sm hover:bg-emerald-50">
                        <FileDown className="h-4 w-4 mr-2" /> Export to Excel
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={(v) => { const params = new URLSearchParams(searchParams); params.set('tab', v); router.replace(`${pathname}?${params.toString()}`, { scroll: false }); }} className="w-full">
                <TabsList className="bg-white px-4 md:px-8 h-14 border-b rounded-none w-full justify-start gap-6 md:gap-10 overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-hide shrink-0">
                    <TabsTrigger value="active" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Active ({counts.active})</TabsTrigger>
                    <TabsTrigger value="loading" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Loading ({counts.loading})</TabsTrigger>
                    <TabsTrigger value="transit" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Transit ({counts.transit})</TabsTrigger>
                    <TabsTrigger value="arrived" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Arrived ({counts.arrived})</TabsTrigger>
                    <TabsTrigger value="pod-status" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">POD Status ({counts.podStatus})</TabsTrigger>
                    <TabsTrigger value="rejection" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-red-600 data-[state=active]:text-red-600 flex items-center gap-2 whitespace-nowrap">Rejection ({counts.rejection})</TabsTrigger>
                    <TabsTrigger value="closed" className="relative h-14 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 flex items-center gap-2 whitespace-nowrap">Closed ({counts.closed})</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={paginatedData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession} 
                        onAction={handleActionCallback} 
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
                            <Pagination currentPage={currentPage} totalPages={totalPagesCount} onPageChange={setCurrentPage} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPagesCount} itemCount={tabFilteredData.length} />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="loading" className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={paginatedData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession} 
                        onAction={handleActionCallback} 
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
                            <Pagination currentPage={currentPage} totalPages={totalPagesCount} onPageChange={setCurrentPage} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPagesCount} itemCount={tabFilteredData.length} />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="transit" className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={paginatedData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession} 
                        onAction={handleActionCallback} 
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
                            <Pagination currentPage={currentPage} totalPages={totalPagesCount} onPageChange={setCurrentPage} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPagesCount} itemCount={tabFilteredData.length} />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="arrived" className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={paginatedData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession} 
                        onAction={handleActionCallback} 
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
                            <Pagination currentPage={currentPage} totalPages={totalPagesCount} onPageChange={setCurrentPage} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPagesCount} itemCount={tabFilteredData.length} />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="pod-status" className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={paginatedData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession} 
                        onAction={handleActionCallback} 
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
                            <Pagination currentPage={currentPage} totalPages={totalPagesCount} onPageChange={setCurrentPage} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPagesCount} itemCount={tabFilteredData.length} />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="rejection" className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={paginatedData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession} 
                        onAction={handleActionCallback} 
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
                            <Pagination currentPage={currentPage} totalPages={totalPagesCount} onPageChange={setCurrentPage} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPagesCount} itemCount={tabFilteredData.length} />
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="closed" className="mt-0 focus-visible:ring-0">
                    <TripBoardTable 
                        data={paginatedData} 
                        activeTab={activeTab} 
                        isAdmin={isAdminSession} 
                        onAction={handleActionCallback} 
                    />
                    <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-10">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Rows per page:</span>
                                <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                                    <SelectTrigger className="h-9 w-[80px] rounded-xl border-slate-200 bg-white font-black text-xs shadow-sm"><SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="10" className="font-bold py-2">10</SelectItem>
                                        <SelectItem value="25" className="font-bold py-2">25</SelectItem>
                                        <SelectItem value="50" className="font-bold py-2">50</SelectItem>
                                        <SelectItem value="100" className="font-bold py-2">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Pagination currentPage={currentPage} totalPages={totalPagesCount} onPageChange={setCurrentPage} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPagesCount} itemCount={tabFilteredData.length} />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </Card>
      </div>

      {arrivedTrip && <ArrivedModal isOpen={!!arrivedTrip} onClose={() => setArrivedTrip(null)} trip={arrivedTrip} onPost={(data) => handlePostAction(arrivedTrip.id, { ...data, tripStatus: 'Arrived', currentStatusId: 'arrived' })} />}
      {unloadedTrip && <UnloadedModal isOpen={!!unloadedTrip} onClose={() => setUnloadedTrip(null)} trip={unloadedTrip} onPost={(data) => handlePostAction(unloadedTrip.id, { ...data, tripStatus: 'Delivered', currentStatusId: 'delivered', actualCompletionDate: serverTimestamp() })} />}
      {rejectTrip && <RejectModal isOpen={!!rejectTrip} onClose={() => setRejectTrip(null)} trip={rejectTrip} onPost={(data) => handlePostAction(rejectTrip.id, { ...data, tripStatus: 'Rejected', currentStatusId: 'rejected', rejectedAt: serverTimestamp() })} />}
      {podStatusTrip && <PodStatusModal isOpen={!!podStatusTrip} onClose={() => setPodStatusTrip(null)} trip={podStatusTrip} onPost={(data) => handlePostAction(podStatusTrip.id, { ...data })} />}
      {srnTrip && <SrnModal isOpen={!!srnTrip} onClose={() => setSrnTrip(null)} trip={srnTrip} onPost={(data) => handlePostAction(srnTrip.id, { ...data, tripStatus: 'Closed', currentStatusId: 'closed' })} />}
      
      {viewTripData && <TripViewModal isOpen={!!viewTripData} onClose={() => setViewTripData(null)} trip={viewTripData} />}
      {editVehicleTrip && <EditVehicleModal isOpen={!!editVehicleTrip} onClose={() => setEditVehicleTrip(null)} trip={editVehicleTrip} onSave={async (id, values) => handlePostAction(id, values)} />}
      {cancelTripData && <CancelTripModal isOpen={!!cancelTripData} onClose={() => setCancelTripData(null)} trip={cancelTripData} onConfirm={async () => {}} />}
      
      {editLrTrip && (
          <LRGenerationModal 
            isOpen={!!editLrTrip}
            onClose={() => setEditLrTrip(null)}
            trip={editLrTrip}
            carrier={editLrTrip.carrierObj}
            lrToEdit={editLrTrip.lrData}
            onGenerate={() => setEditLrTrip(null)}
          />
      )}

      {previewLrData && (
          <LRPrintPreviewModal 
            isOpen={!!previewLrData}
            onClose={() => setPreviewLrData(null)}
            lr={previewLrData}
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