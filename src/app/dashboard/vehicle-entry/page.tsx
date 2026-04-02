
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

/**
 * @fileOverview Gate Control Registry (Parent Page).
 * Centralizes real-time data fetching to ensure synchronization between badges and tables.
 * Implements "All Plant" upcoming view for authorized nodes.
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);

  // 1. Authorization Handshake
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
            }

            let ids: string[] = [];
            const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdmin;
                
                // Optimized: Use master plants if admin, else use profile-defined IDs
                if (isRoot && allMasterPlants) {
                    ids = allMasterPlants.map(p => p.id);
                } else {
                    ids = userData.plantIds || [];
                }
            } else if (isAdmin && allMasterPlants) {
                ids = allMasterPlants.map(p => p.id);
            }
            setAuthPlantIds(ids);
        } catch (e) {
            console.error("Auth sync error:", e);
            setDbError(true);
        }
    };
    fetchAuth();
  }, [firestore, user, allMasterPlants]);

  // 2. Real-time Registry Sync
  useEffect(() => {
    if (!firestore || authPlantIds.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    // Sync Gate Entries
    const unsubIn = onSnapshot(collection(firestore, "vehicleEntries"), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setEntries(list);
        setIsLoading(false);
    }, () => setDbError(true));
    unsubscribers.push(unsubIn);

    // Sync ALL Assigned Trips (For Upcoming Logic)
    const unsubTrips = onSnapshot(collection(firestore, "trips"), (snap) => {
        setTrips(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    unsubscribers.push(unsubTrips);

    // Sync Shipments for Enrichment
    authPlantIds.forEach(pId => {
        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/shipments`), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as any));
            setShipments(prev => [...prev.filter(s => s.originPlantId !== pId), ...list]);
        }));
    });

    return () => unsubscribers.forEach(u => u());
  }, [firestore, authPlantIds]);

  // 3. Centralized Logic Nodes
  const inVehiclesSet = useMemo(() => {
    return new Set(entries.filter(e => e.status === 'IN').map(e => e.vehicleNumber?.toUpperCase().trim()));
  }, [entries]);

  const upcomingList = useMemo(() => {
    return trips.filter(t => {
        const normPId = normalizePlantId(t.originPlantId);
        const isAuth = authPlantIds.some(aid => normalizePlantId(aid) === normPId);
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
  }, [trips, authPlantIds, inVehiclesSet, shipments]);

  const counts = useMemo(() => ({
    in: entries.filter(e => e.status === 'IN' && authPlantIds.some(aid => normalizePlantId(aid) === normalizePlantId(e.plantId))).length,
    upcoming: upcomingList.length
  }), [entries, upcomingList, authPlantIds]);

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
                  <GateRegister />
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
