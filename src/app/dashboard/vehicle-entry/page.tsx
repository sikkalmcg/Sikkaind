'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
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
 * Hardened for multi-node plant authorization.
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
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);

  // 1. Authorization Handshake - Hardened for Multi-Node Accuracy
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
            const isSystemAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkaind.admin@sikka.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isSystemAdmin;
                
                const baseList = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : mockPlants;
                ids = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
                setIsAdmin(isRoot);
            } else if (isSystemAdmin) {
                const baseList = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : mockPlants;
                ids = baseList.map(p => p.id);
                setIsAdmin(true);
            }
            setAuthPlantIds(ids);
        } catch (e) {
            console.error("Auth sync error:", e);
            setDbError(true);
        }
    };
    fetchAuth();
  }, [firestore, user, allMasterPlants]);

  // 2. Real-time Registry Sync - Transitioned to Partitioned Scanning
  useEffect(() => {
    if (!firestore || authPlantIds.length === 0) return;

    const unsubscribers: (() => void)[] = [];
    setIsLoading(true);

    const normalizedAuthIds = authPlantIds.map(normalizePlantId);

    // Sync Gate Entries (Global but filtered by auth context)
    const unsubIn = onSnapshot(collection(firestore, "vehicleEntries"), (snap) => {
        const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(d => isAdmin || normalizedAuthIds.includes(normalizePlantId(d.plantId)));
        setEntries(list);
        setIsLoading(false);
    }, () => setDbError(true));
    unsubscribers.push(unsubIn);

    // Sync Partitioned Data (Trips & Shipments) for each authorized node
    authPlantIds.forEach(pId => {
        const pIdStr = normalizePlantId(pId);
        
        // Sync Trips for "Upcoming" logic
        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pIdStr}/trips`), (snap) => {
            const plantTrips = snap.docs.map(d => ({ 
                id: d.id, 
                originPlantId: pIdStr, 
                ...d.data() 
            } as any));
            
            setTrips(prev => {
                const others = prev.filter(t => normalizePlantId(t.originPlantId) !== pIdStr);
                return [...others, ...plantTrips];
            });
        }));

        // Sync Shipments for Enrichment
        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pIdStr}/shipments`), (snap) => {
            const plantShipments = snap.docs.map(d => ({ 
                id: d.id, 
                originPlantId: pIdStr, 
                ...d.data() 
            } as any));
            
            setShipments(prev => {
                const others = prev.filter(s => normalizePlantId(s.originPlantId) !== pIdStr);
                return [...others, ...plantShipments];
            });
        }));
    });

    return () => unsubscribers.forEach(u => u());
  }, [firestore, JSON.stringify(authPlantIds), isAdmin]);

  // 3. Centralized Logic Nodes
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
        return {
            ...t,
            shipToParty: t.shipToParty || shipment?.shipToParty || shipment?.billToParty || '--',
            assignedQtyInTrip: t.assignedQtyInTrip || shipment?.quantity || 0,
            materialTypeId: shipment?.materialTypeId || 'MT'
        };
    });
  }, [trips, authPlantIds, inVehiclesSet, shipments, isAdmin]);

  const counts = useMemo(() => {
    const normalizedAuthIds = authPlantIds.map(normalizePlantId);
    return {
        in: entries.filter(e => e.status === 'IN' && (isAdmin || normalizedAuthIds.includes(normalizePlantId(e.plantId)))).length,
        upcoming: upcomingList.length
    };
  }, [entries, upcomingList, authPlantIds, isAdmin]);

  const handleVehicleInFromUpcoming = (tripData: any) => {
    setUpcomingVehicleData(tripData);
    setActiveTab('vehicle-in');
  };
  
  return (
    <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                <Truck className="h-7 w-7" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tighter uppercase italic">Gate Control Registry</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1 ml-1">Lifting & Receiving Log</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
          {dbError && (
              <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border border-orange-200 shadow-sm animate-pulse">
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>Registry Sync Issue</span>
              </div>
          )}
          <Button variant="outline" className="h-11 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
            <FileDown className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent border-b h-14 rounded-none gap-12 p-0 mb-10 w-full justify-start overflow-x-auto custom-scrollbar">
            <TabsTrigger value="vehicle-in" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
              Vehicle IN <Badge className="bg-blue-100 text-blue-900 border-none font-black text-[10px] px-2 h-5">{counts.in}</Badge>
            </TabsTrigger>
            <TabsTrigger value="vehicle-out" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
              Vehicle OUT
            </TabsTrigger>
            <TabsTrigger value="gate-register" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
              Gate Register
            </TabsTrigger>
            <TabsTrigger value="upcoming-vehicle" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
              Upcoming Vehicles <Badge className="bg-orange-100 text-orange-700 border-none font-black text-[10px] px-2 h-5">{counts.upcoming}</Badge>
            </TabsTrigger>
          </TabsList>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <TabsContent value="vehicle-in" className="m-0 focus-visible:ring-0">
                  <VehicleIn upcomingVehicleData={upcomingVehicleData} onFinished={() => setUpcomingVehicleData(null)} />
              </TabsContent>
              <TabsContent value="vehicle-out" className="m-0 focus-visible:ring-0">
                  <VehicleOut />
              </TabsContent>
              <TabsContent value="gate-register" className="m-0 focus-visible:ring-0">
                  <GateRegister authPlantIds={authPlantIds} isAdmin={isAdmin} />
              </TabsContent>
              <TabsContent value="upcoming-vehicle" className="m-0 focus-visible:ring-0">
                  <UpcomingVehicles data={upcomingList} isLoading={isLoading} onVehicleInClick={handleVehicleInFromUpcoming} />
              </TabsContent>
          </div>
        </Tabs>
      </div>
    </main>
  );
}

export default function VehicleEntryPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <VehicleEntryContent />
        </Suspense>
    );
}
