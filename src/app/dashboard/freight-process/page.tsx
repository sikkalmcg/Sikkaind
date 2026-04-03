'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, getDocs, getDoc, Timestamp, where, limit, onSnapshot } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/date-picker";
import { Loader2, WifiOff, RefreshCcw, Search, FileDown, ShieldCheck, Factory, ArrowRightLeft } from "lucide-react";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import type { WithId, Plant, SubUser, Carrier, Trip, Shipment, LR, Freight } from '@/types';
import TripFreightTable from '@/components/dashboard/freight-process/TripFreightTable';
import CloseFreightTripTable from '@/components/dashboard/freight-process/CloseFreightTripTable';
import BankingModal from '@/components/dashboard/freight-process/BankingModal';
import AddFreightModal from '@/components/dashboard/freight-process/AddFreightModal';
import OtherChargesModal from '@/components/dashboard/freight-process/OtherChargesModal';
import AddDebitModal from '@/components/dashboard/freight-process/AddDebitModal';
import PrintVoucherModal from '@/components/dashboard/freight-process/PrintVoucherModal';
import EditSelectionModal from '@/components/dashboard/freight-process/EditSelectionModal';
import MultiSelectPlantFilter from '@/components/dashboard/MultiSelectPlantFilter';
import { mockPlants } from '@/lib/mock-data';
import { normalizePlantId } from '@/lib/utils';

export default function FreightRequestPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [activeTab, setActiveTab] = useState('trip-freight');
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setTodayDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [shipments, setShipments] = useState<WithId<Shipment>[]>([]);
  const [lrs, setLrs] = useState<WithId<LR>[]>([]);
  const [freights, setFreights] = useState<WithId<Freight>[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [operatorName, setOperatorName] = useState('');
  
  const isInitialized = useRef(false);

  const [bankingTrip, setBankingTrip] = useState<any | null>(null);
  const [freightRequestTrip, setFreightRequestTrip] = useState<any | null>(null);
  const [otherChargesTrip, setOtherChargesTrip] = useState<any | null>(null);
  const [debitTrip, setDebitTrip] = useState<any | null>(null);
  const [printTrip, setPrintTrip] = useState<any | null>(null);
  const [editSelectionTrip, setEditSelectionTrip] = useState<any | null>(null);

  const masterPlantsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "logistics_plants")) : null, [firestore]);
  const { data: allMasterPlants } = useCollection<Plant>(masterPlantsQuery);
  const carriersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "carriers")) : null, [firestore]);
  const { data: dbCarriers } = useCollection<Carrier>(carriersQuery);

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

      const isAdminSession = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

      if (userDocSnap) {
        const userData = userDocSnap.data() as SubUser;
        isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
        authIds = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
        setOperatorName(userData.fullName || userData.username || 'Operator');
      } else if (isAdminSession) {
        isRoot = true;
        authIds = baseList.map(p => p.id);
        setOperatorName('AJAY SOMRA');
      }

      setIsAdmin(isRoot);
      setAuthorizedPlantIds(authIds);
      const filtered = baseList.filter(p => authIds.includes(p.id));
      setPlants(filtered);
      
      // PERMANENT FIX NODE: Loop prevention
      if (!isInitialized.current && filtered.length > 0 && selectedPlants.length === 0) {
          setSelectedPlants(filtered.map(p => p.id));
          isInitialized.current = true;
      }
    } catch (e) {
      setDbError(true);
    } finally {
      setIsAuthLoading(false);
    }
  }, [firestore, user, allMasterPlants, selectedPlants.length]);

  useEffect(() => { fetchAuthorizedPlants(); }, [fetchAuthorizedPlants]);

  useEffect(() => {
    if (!firestore || selectedPlants.length === 0) return;

    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];

    selectedPlants.forEach(pId => {
        const parseDate = (val: any) => val instanceof Timestamp ? val.toDate() : (val ? new Date(val) : null);

        unsubscribers.push(onSnapshot(query(collection(firestore, `plants/${pId}/trips`), where("lrGenerated", "==", true)), (snap) => {
            const plantTrips = snap.docs.map(d => ({ 
                id: d.id, 
                originPlantId: pId, 
                ...d.data(),
                startDate: parseDate(d.data().startDate),
                lrDate: parseDate(d.data().lrDate)
            } as WithId<Trip>));
            setTrips(prev => [...prev.filter(t => t.originPlantId !== pId), ...plantTrips]);
            setIsLoading(false);
        }));

        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/shipments`), (snap) => {
            const plantShipments = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as WithId<Shipment>));
            setShipments(prev => [...prev.filter(s => s.originPlantId !== pId), ...plantShipments]);
        }));

        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/lrs`), (snap) => {
            const plantLrs = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as WithId<LR>));
            setLrs(prev => [...prev.filter(l => l.originPlantId !== pId), ...plantLrs]);
        }));

        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/freights`), (snap) => {
            const plantFreights = snap.docs.map(d => {
                const fData = d.data();
                return { 
                    id: d.id, 
                    originPlantId: pId, 
                    ...fData,
                    lastUpdated: parseDate(fData.lastUpdated) || new Date(),
                    payments: (fData.payments || []).map((p: any) => ({
                        ...p,
                        paymentDate: parseDate(p.paymentDate)
                    }))
                } as WithId<Freight>;
            });
            setFreights(prev => [...prev.filter(f => f.originPlantId !== pId), ...plantFreights]);
        }));
    });

    return () => unsubscribers.forEach(u => u());
  }, [firestore, JSON.stringify(selectedPlants)]);

 const joinedData = useMemo(() => {
    return trips.map(t => {
        const shipment = shipments.find(s => s.id === t.shipmentIds?.[0]);
        const lr = lrs.find(l => l.tripDocId === t.id || l.tripId === t.tripId);
        const freight = freights.find(f => f.tripId === t.id);
        const plant = plants.find(p => p.id === t.originPlantId);
        const carrierObj = (dbCarriers || []).find(c => c.id === t.carrierId);

        const initialCalculatedTotal = Number(t.freightAmount) || (Number(t.freightRate || 0) * Number(t.assignedQtyInTrip || 0)) || 0;
        const totalFreightAmount = freight?.totalFreightAmount || initialCalculatedTotal;
        
        const totalPaidAmount = freight?.totalPaidAmount || 0;
        const podStatus = freight?.podStatus || 'None';
        const holdback = podStatus === 'Hard Copy' ? 0 : (podStatus === 'Soft Copy' ? 500 : 1000);
        const remainingBalance = totalFreightAmount - totalPaidAmount - holdback;

        return {
            ...t,
            lrData: lr,
            freightData: freight,
            carrierObj: carrierObj,
            plantName: plant?.name || t.originPlantId,
            consignor: shipment?.consignor || '--',
            consignee: shipment?.billToParty || '--',
            shipToParty: t.shipToParty || shipment?.shipToParty || '--',
            from: shipment?.loadingPoint || '--',
            loadingPoint: shipment?.loadingPoint || '--',
            unloadingPoint: t.unloadingPoint || shipment?.unloadingPoint || '--',
            quantity: lr ? (lr.assignedTripWeight || t.assignedQtyInTrip || 0) : (t.assignedQtyInTrip || 0),
            carrier: carrierObj?.name || '--',
            totalFreightAmount,
            totalPaidAmount,
            remainingBalance,
            podStatus,
        };
    });
}, [trips, shipments, lrs, freights, plants, dbCarriers]);

  const baseFiltered = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : null;
    const dayEnd = toDate ? endOfDay(toDate) : null;

    return joinedData.filter(t => {
      if (t.vehicleType !== 'Market Vehicle') return false;
      if (dayStart && t.startDate && t.startDate < dayStart) return false;
      if (dayEnd && t.startDate && t.startDate > dayEnd) return false;
      
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
  }, [joinedData, fromDate, toDate, searchTerm]);

  const tripFreightData = useMemo(() => baseFiltered.filter(t => {
    if (!t.freightData) return true; 
    return t.remainingBalance > 50;
  }), [baseFiltered]);

  const closeFreightData = useMemo(() => baseFiltered.filter(t => {
    if (!t.freightData) return false;
    return t.remainingBalance <= 50;
  }), [baseFiltered]);

  const transporters = useMemo(() => {
    const names = tripRegistry
        .map(t => t.transporterName)
        .filter((name): name is string => !!name && name.trim() !== '');
    return Array.from(new Set(names)).sort();
  }, [tripRegistry]);

  const handleEditAction = (type: 'banking' | 'freight' | 'charges' | 'debit', trip: any) => {
      setEditSelectionTrip(null);
      if (type === 'banking') setBankingTrip(trip);
      if (type === 'freight') setFreightRequestTrip(trip);
      if (type === 'charges') setOtherChargesTrip(trip);
      if (type === 'debit') setDebitTrip(trip);
  };

  return (
    <main className="flex flex-1 flex-col h-full overflow-hidden bg-white">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full w-full">
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur px-4 md:px-8 pt-4 pb-4 border-b">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3">
                <ArrowRightLeft className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase text-blue-900 italic tracking-tight">Freight Request HUB</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">transporter Liability & Payment Requests (Market Vehicles)</p>
              </div>
              {dbError && <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-orange-200"><WifiOff className="h-3 w-3" /><span>Cloud Sync Issue</span></div>}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid gap-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Factory className="h-2.5 w-2.5" /> Authorized Scope</label>
                <MultiSelectPlantFilter 
                    options={plants}
                    selected={selectedPlants}
                    onChange={setSelectedPlants}
                    isLoading={isAuthLoading}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">From Date</label>
                <DatePicker date={fromDate} setDate={setFromDate} className="h-9 border-slate-200" />
              </div>
              <div className="grid gap-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">To Date</label>
                <DatePicker date={toDate} setDate={setTodayDate} className="h-9 border-slate-200" />
              </div>
              <div className="grid gap-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Search Process</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search trips..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 w-[240px] bg-slate-50 border-slate-200 focus-visible:ring-blue-900" />
                </div>
              </div>
              <div className="flex items-end gap-2 pt-5">
                <Button variant="outline" size="icon" className="h-9 w-9 border-slate-300" onClick={() => window.location.reload()}><RefreshCcw className="h-4 w-4 text-blue-900" /></Button>
              </div>
            </div>
          </div>

          <TabsList className="bg-transparent h-10 p-0 border-b-0 gap-8">
            <TabsTrigger value="trip-freight" className="relative h-10 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-900 data-[state=active]:bg-transparent px-0 font-bold uppercase text-xs tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
              Requested Trips ({tripFreightData.length})
            </TabsTrigger>
            <TabsTrigger value="close-freight" className="relative h-10 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-blue-900 data-[state=active]:bg-transparent px-0 font-bold uppercase text-xs tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
              Closed Payments ({closeFreightData.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Establishing Registry Link...</p>
            </div>
          ) : (
            <>
              <TabsContent value="trip-freight" className="mt-0 focus-visible:ring-0">
                <TripFreightTable 
                  data={tripFreightData} 
                  isAdmin={isAdmin}
                  operatorName={operatorName}
                  onAction={(type, trip) => {
                      if (type === 'banking') setBankingTrip(trip);
                      if (type === 'freight') setFreightRequestTrip(trip);
                      if (type === 'charges') setOtherChargesTrip(trip);
                      if (type === 'debit') setDebitTrip(trip);
                      if (type === 'print') setPrintTrip(trip);
                      if (type === 'edit-selection') setEditSelectionTrip(trip);
                  }} 
                />
              </TabsContent>
              <TabsContent value="close-freight" className="mt-0 focus-visible:ring-0">
                <CloseFreightTripTable 
                  data={closeFreightData}
                  onView={setPrintTrip}
                />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>

      {editSelectionTrip && (
          <EditSelectionModal 
            isOpen={!!editSelectionTrip}
            onClose={() => setEditSelectionTrip(null)}
            trip={editSelectionTrip}
            onSelect={handleEditAction}
          />
      )}

      {bankingTrip && (
        <BankingModal
          isOpen={!!bankingTrip}
          onClose={() => setBankingTrip(null)}
          trip={bankingTrip}
          onSuccess={() => setBankingTrip(null)}
        />
      )}

      {freightRequestTrip && (
        <AddFreightModal
          isOpen={!!freightRequestTrip}
          onClose={() => setFreightRequestTrip(null)}
          trip={freightRequestTrip}
          onSuccess={() => setFreightRequestTrip(null)}
        />
      )}

      {otherChargesTrip && (
        <OtherChargesModal
          isOpen={!!otherChargesTrip}
          onClose={() => setOtherChargesTrip(null)}
          trip={otherChargesTrip}
          onSuccess={() => setOtherChargesTrip(null)}
        />
      )}

      {debitTrip && (
        <AddDebitModal
          isOpen={!!debitTrip}
          onClose={() => setDebitTrip(null)}
          trip={debitTrip}
          onSuccess={() => setDebitTrip(null)}
        />
      )}

      {printTrip && (
          <PrintVoucherModal
            isOpen={!!printTrip}
            onClose={() => setPrintTrip(null)}
            trip={printTrip}
          />
      )}
    </main>
  );
}
