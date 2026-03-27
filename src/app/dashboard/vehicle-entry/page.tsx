'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VehicleIn from '@/components/dashboard/vehicle-entry/VehicleIn';
import VehicleOut from '@/components/dashboard/vehicle-entry/VehicleOut';
import UpcomingVehicles from '@/components/dashboard/vehicle-entry/UpcomingVehicles';
import GateRegister from '@/components/dashboard/vehicle-entry/GateRegister';
import type { WithId, Trip, VehicleEntryExit, SubUser, Plant } from '@/types';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, FileDown, Plus, Truck, LayoutList, ClipboardCheck, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { normalizePlantId } from '@/lib/utils';

export type UpcomingVehicleData = WithId<Trip>;

export default function VehicleEntryPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('vehicle-in');
  const [upcomingVehicleData, setUpcomingVehicleData] = useState<UpcomingVehicleData | null>(null);
  
  const [counts, setCounts] = useState({ in: 0, out: 0, upcoming: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;

    let unsubIn: () => void;
    let unsubTrips: (() => void)[] = [];

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. High-fidelity User Lookup by Email (Security Protocol)
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

            let authPlantIds: string[] = [];
            const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdmin;
                const allPlantsSnap = await getDocs(collection(firestore, "logistics_plants"));
                authPlantIds = isRoot ? allPlantsSnap.docs.map(d => d.id) : (userData.plantIds || []);
            } else if (isAdmin) {
                const allPlantsSnap = await getDocs(collection(firestore, "logistics_plants"));
                authPlantIds = allPlantsSnap.docs.map(d => d.id);
            }

            if (authPlantIds.length === 0) {
                setIsLoading(false);
                return;
            }

            // 2. Real-time IN Count (Vehicles in yard)
            const qIn = collection(firestore, "vehicleEntries");
            const qInFiltered = query(qIn, where("status", "==", "IN"));
            unsubIn = onSnapshot(qInFiltered, (snap) => {
                const activeInVehicles = snap.docs
                    .map(d => d.data() as VehicleEntryExit)
                    .filter(d => authPlantIds.some(aid => normalizePlantId(aid) === normalizePlantId(d.plantId)));
                
                const inVehiclesList = activeInVehicles.map(v => v.vehicleNumber);
                setCounts(prev => ({ ...prev, in: activeInVehicles.length }));

                // 3. Real-time Upcoming Count (Assigned trips NOT yet IN)
                // We fetch all trips and filter for active ones not yet logged in the yard
                let totalUpcoming = 0;
                const currentPlantTrips: Record<string, number> = {};

                unsubTrips.forEach(u => u()); // Clear old listeners
                unsubTrips = authPlantIds.map(pId => {
                    const tripCol = collection(firestore, `plants/${pId}/trips`);
                    // Broader query to include 'in-transit' Own Vehicles and 'Assigned' Market Vehicles
                    const qU = query(tripCol);
                    
                    return onSnapshot(qU, (tripSnap) => {
                        const count = tripSnap.docs.filter(td => {
                            const data = td.data() as Trip;
                            const isActive = ['Assigned', 'in-transit', 'Vehicle Assigned'].includes(data.currentStatusId);
                            return isActive && !inVehiclesList.includes(data.vehicleNumber || '');
                        }).length;
                        
                        currentPlantTrips[pId] = count;
                        const grandTotal = Object.values(currentPlantTrips).reduce((a, b) => a + b, 0);
                        setCounts(prev => ({ ...prev, upcoming: grandTotal }));
                    });
                });
            }, async (error) => {
                setDbError(true);
            });

            setIsLoading(false);
        } catch (e) {
            console.error("Registry Sync Error:", e);
            setDbError(true);
            setIsLoading(false);
        }
    };

    fetchData();
    return () => {
        if (unsubIn) unsubIn();
        unsubTrips.forEach(u => u());
    };
  }, [firestore, user]);

  const handleVehicleInFromUpcoming = (tripData: UpcomingVehicleData) => {
    setUpcomingVehicleData(tripData);
    setActiveTab('vehicle-in');
  };
  
  const handleTabChange = (tab: string) => {
    if (tab !== 'vehicle-in') {
      setUpcomingVehicleData(null);
    }
    setActiveTab(tab);
  }

  return (
    <main className="flex flex-1 flex-col h-full bg-slate-50/50">
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight uppercase flex items-center gap-3">
            <Truck className="h-8 w-8 text-blue-900" />
            Gate Control Registry
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 ml-11">Lifting & Receiving Log</p>
        </div>
        
        <div className="flex items-center gap-3">
          {dbError && (
              <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-orange-200">
                  <WifiOff className="h-3 w-3" />
                  <span>Registry Desync</span>
              </div>
          )}
          <Button variant="outline" className="h-10 rounded-xl font-bold text-xs uppercase tracking-widest border-slate-200 gap-2">
            <FileDown className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-8">
          <TabsList className="inline-flex h-12 items-center justify-start rounded-none border-b bg-transparent p-0 w-full gap-8">
            <TabsTrigger 
              value="vehicle-in" 
              className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-xs font-black uppercase tracking-widest text-slate-400 transition-all data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 data-[state=active]:shadow-none"
            >
              Vehicle IN
              <Badge className="ml-2 bg-blue-100 text-blue-900 border-none font-black text-[10px]">{counts.in}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="vehicle-out" 
              className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-xs font-black uppercase tracking-widest text-slate-400 transition-all data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 data-[state=active]:shadow-none"
            >
              Vehicle OUT
            </TabsTrigger>
            <TabsTrigger 
              value="gate-register" 
              className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-xs font-black uppercase tracking-widest text-slate-400 transition-all data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 data-[state=active]:shadow-none flex items-center gap-2"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Gate Register
            </TabsTrigger>
            <TabsTrigger 
              value="upcoming-vehicle" 
              className="relative h-12 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-xs font-black uppercase tracking-widest text-slate-400 transition-all data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900 data-[state=active]:shadow-none"
            >
              Upcoming Vehicles
              <Badge className="ml-2 bg-amber-100 text-amber-900 border-none font-black text-[10px]">{counts.upcoming}</Badge>
            </TabsTrigger>
          </TabsList>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <TabsContent value="vehicle-in" className="m-0 focus-visible:ring-0">
                  <VehicleIn upcomingVehicleData={upcomingVehicleData} key={upcomingVehicleData?.id || 'new'} />
              </TabsContent>
              <TabsContent value="vehicle-out" className="m-0 focus-visible:ring-0">
                  <VehicleOut />
              </TabsContent>
              <TabsContent value="gate-register" className="m-0 focus-visible:ring-0">
                  <GateRegister plants={plants || []} />
              </TabsContent>
              <TabsContent value="upcoming-vehicle" className="m-0 focus-visible:ring-0">
                  <UpcomingVehicles onVehicleInClick={handleVehicleInFromUpcoming} />
              </TabsContent>
          </div>
        </Tabs>
      </div>
    </main>
  );
}
