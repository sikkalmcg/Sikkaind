'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VehicleIn from '@/components/dashboard/vehicle-entry/VehicleIn';
import VehicleOut from '@/components/dashboard/vehicle-entry/VehicleOut';
import UpcomingVehicles from '@/components/dashboard/vehicle-entry/UpcomingVehicles';
import GateRegister from '@/components/dashboard/vehicle-entry/GateRegister';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, getDocs, limit, doc, getDoc, orderBy } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, FileDown, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizePlantId } from '@/lib/utils';
import type { SubUser, VehicleEntryExit, Trip, Shipment, Plant } from '@/types';
import { mockPlants } from '@/lib/mock-data';

/**
 * @fileOverview Gate Control Registry (Parent Page).
 * Centralizes real-time data fetching to ensure synchronization between badges and tables.
 * Optimized: Unified scroll container and compact mobile header.
 */
function VehicleEntryContent() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [activeTab, setActiveTab] = useState('vehicle-in');
  const [upcomingVehicleData, setUpcomingVehicleData] = useState<any | null>(null);
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [entries, setEntries] = useState<VehicleEntryExit[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [authPlantIds, setAuthPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: allPlants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchAuth = async () => {
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            
            if (!userQSnap.empty) {
                userDocSnap = userQSnap.docs[0];
            } else {
                const directRef = doc(firestore, "users", user.uid);
                const directSnap = await getDoc(directRef);
                if (directSnap.exists()) userDocSnap = directSnap;
            }

            let ids: string[] = [];
            const isSystemAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isSystemAdmin;
                
                const baseList = allPlants && allPlants.length > 0 ? allPlants : mockPlants;
                ids = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
                setIsAdmin(isRoot);
            } else if (isSystemAdmin) {
                const baseList = allPlants && allPlants.length > 0 ? allPlants : mockPlants;
                ids = baseList.map(p => p.id);
                setIsAdmin(true);
            }
            setAuthPlantIds(ids);
        } catch (e) {
            setDbError(true);
        }
    };
    fetchAuth();
  }, [firestore, user, allPlants]);

  useEffect(() => {
    if (!firestore || authPlantIds.length === 0) return;

    const unsubscribers: (() => void)[] = [];
    setIsLoading(true);

    const normalizedAuthIds = authPlantIds.map(normalizePlantId);

    const unsubIn = onSnapshot(collection(firestore, "vehicleEntries"), (snap) => {
        const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(d => isAdmin || normalizedAuthIds.includes(normalizePlantId(d.plantId)));
        setEntries(list);
        setIsLoading(false);
    }, () => setDbError(true));
    unsubscribers.push(unsubIn);

    authPlantIds.forEach(pId => {
        const pIdStr = normalizePlantId(pId);
        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pIdStr}/trips`), (snap) => {
            const plantTrips = snap.docs.map(d => ({ id: d.id, originPlantId: pIdStr, ...d.data() } as any));
            setTrips(prev => [...prev.filter(t => normalizePlantId(t.originPlantId) !== pIdStr), ...plantTrips]);
        }));
        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pIdStr}/shipments`), (snap) => {
            const plantShipments = snap.docs.map(d => ({ id: d.id, originPlantId: pIdStr, ...d.data() } as any));
            setShipments(prev => [...prev.filter(s => normalizePlantId(s.originPlantId) !== pIdStr), ...plantShipments]);
        }));
    });

    return () => unsubscribers.forEach(u => u());
  }, [firestore, JSON.stringify(authPlantIds), isAdmin]);

  const inVehiclesSet = useMemo(() => {
    return new Set(entries.filter(e => e.status === 'IN').map(e => e.vehicleNumber?.toUpperCase().trim()));
  }, [entries]);

  const upcomingList = useMemo(() => {
    const normalizedAuthIds = authPlantIds.map(normalizePlantId);
    return trips.filter(t => {
        const normPId = normalizePlantId(t.originPlantId);
        const isAuth = isAdmin || normalizedAuthIds.includes(normPId);
        const rawStatus = (t.tripStatus || t.currentStatusId || '').toLowerCase().replace(/[\s_-]+/g, '-');
        const isAssigned = ['assigned', 'vehicle-assigned'].includes(rawStatus);
        const isNotInYard = !inVehiclesSet.has(t.vehicleNumber?.toUpperCase().trim());
        return isAuth && isAssigned && isNotInYard;
    }).map(t => {
        const shipId = Array.isArray(t.shipmentIds) ? t.shipmentIds[0] : t.shipmentIds;
        const shipment = shipments.find(s => s.id === shipId || s.shipmentId === shipId);
        return { ...t, shipToParty: t.shipToParty || shipment?.shipToParty || shipment?.billToParty || '--', assignedQtyInTrip: t.assignedQtyInTrip || shipment?.quantity || 0, materialTypeId: shipment?.materialTypeId || 'MT' };
    });
  }, [trips, authPlantIds, inVehiclesSet, shipments, isAdmin]);

  const counts = useMemo(() => {
    const normalizedAuthIds = authPlantIds.map(normalizePlantId);
    return { in: entries.filter(e => e.status === 'IN' && (isAdmin || normalizedAuthIds.includes(normalizePlantId(e.plantId)))).length, upcoming: upcomingList.length };
  }, [entries, upcomingList, authPlantIds, isAdmin]);

  const handleVehicleInFromUpcoming = (tripData: any) => {
    setUpcomingVehicleData(tripData);
    setActiveTab('vehicle-in');
  };
  
  return (
    <div className="flex flex-1 flex-col h-full bg-[#f8fafc] overflow-hidden">
      <div className="bg-white border-b px-4 md:px-8 py-3 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
            <div className="p-2 md:p-2.5 bg-blue-900 text-white rounded-xl shadow-lg rotate-3">
                <Truck className="h-5 w-5 md:h-7 md:w-7" />
            </div>
            <div>
                <h1 className="text-xl md:text-3xl font-black text-blue-900 tracking-tighter uppercase italic leading-none">Gate Control Registry</h1>
                <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1 ml-1">Lifting & Receiving Log</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
          {dbError && (
              <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-2 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase border border-orange-200">
                  <WifiOff className="h-3 w-3" />
                  <span>Sync Issue</span>
              </div>
          )}
          <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl font-black text-[9px] md:text-[11px] uppercase tracking-widest border-slate-200 text-blue-900 bg-white">
            <FileDown className="h-3.5 w-3.5 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 md:p-8 space-y-10">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-transparent border-b h-12 rounded-none gap-6 md:gap-12 p-0 mb-8 w-full justify-start overflow-x-auto no-scrollbar shrink-0">
                <TabsTrigger value="vehicle-in" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                Vehicle IN <Badge className="bg-blue-100 text-blue-900 border-none font-black text-[8px] md:text-[10px] px-1.5 h-4 md:h-5">{counts.in}</Badge>
                </TabsTrigger>
                <TabsTrigger value="vehicle-out" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
                Vehicle OUT
                </TabsTrigger>
                <TabsTrigger value="gate-register" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                Gate Register
                </TabsTrigger>
                <TabsTrigger value="upcoming-vehicle" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-3 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                Upcoming Vehicles <Badge className="bg-orange-100 text-orange-700 border-none font-black text-[8px] md:text-[10px] px-1.5 h-4 md:h-5">{counts.upcoming}</Badge>
                </TabsTrigger>
            </TabsList>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <TabsContent value="vehicle-in" className="m-0 focus-visible:ring-0"><VehicleIn upcomingVehicleData={upcomingVehicleData} onFinished={() => setUpcomingVehicleData(null)} /></TabsContent>
                <TabsContent value="vehicle-out" className="m-0 focus-visible:ring-0"><VehicleOut /></TabsContent>
                <TabsContent value="gate-register" className="m-0 focus-visible:ring-0"><GateRegister authPlantIds={authPlantIds} isAdmin={isAdmin} /></TabsContent>
                <TabsContent value="upcoming-vehicle" className="m-0 focus-visible:ring-0"><UpcomingVehicles data={upcomingList} isLoading={isLoading} onVehicleInClick={handleVehicleInFromUpcoming} /></TabsContent>
            </div>
            </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function VehicleEntryPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <VehicleEntryContent />
        </Suspense>
    );
}