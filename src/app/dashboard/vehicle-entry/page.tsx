'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VehicleIn from '@/components/dashboard/vehicle-entry/VehicleIn';
import VehicleOut from '@/components/dashboard/vehicle-entry/VehicleOut';
import UpcomingVehicles from '@/components/dashboard/vehicle-entry/UpcomingVehicles';
import GateRegister from '@/components/dashboard/vehicle-entry/GateRegister';
import type { WithId, Trip, VehicleEntryExit, SubUser, Plant } from '@/types';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
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

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            
            if (!userQSnap.empty) {
                userDocSnap = userQSnap.docs[0];
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

            const qIn = query(collection(firestore, "vehicleEntries"), where("status", "==", "IN"));
            unsubIn = onSnapshot(qIn, (snap) => {
                const activeInVehicles = snap.docs
                    .map(d => d.data() as VehicleEntryExit)
                    .filter(d => authPlantIds.some(aid => normalizePlantId(aid) === normalizePlantId(d.plantId)));
                
                setCounts(prev => ({ ...prev, in: activeInVehicles.length }));
            }, async (error) => {
                setDbError(true);
            });

            setIsLoading(false);
        } catch (e) {
            setDbError(true);
            setIsLoading(false);
        }
    };

    fetchData();
    return () => {
        if (unsubIn) unsubIn();
    };
  }, [firestore, user]);

  const handleVehicleInFromUpcoming = (tripData: UpcomingVehicleData) => {
    setUpcomingVehicleData(tripData);
    setActiveTab('vehicle-in');
  };
  
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
          <TabsList className="inline-flex h-12 items-center justify-start rounded-none border-b bg-transparent p-0 w-full gap-8">
            <TabsTrigger value="vehicle-in" className="relative h-12 rounded-none border-b-2 border-b-transparent px-0 pb-3 pt-2 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:border-b-blue-900 data-[state=active]:text-blue-900">
              Vehicle IN <Badge className="ml-2 bg-blue-100 text-blue-900 border-none font-black text-[10px]">{counts.in}</Badge>
            </TabsTrigger>
            <TabsTrigger value="vehicle-out" className="h-12 px-0 pb-3 pt-2 text-xs font-black uppercase tracking-widest text-slate-400">Vehicle OUT</TabsTrigger>
            <TabsTrigger value="gate-register" className="h-12 px-0 pb-3 pt-2 text-xs font-black uppercase tracking-widest text-slate-400">Gate Register</TabsTrigger>
            <TabsTrigger value="upcoming-vehicle" className="h-12 px-0 pb-3 pt-2 text-xs font-black uppercase tracking-widest text-slate-400">Upcoming Vehicles</TabsTrigger>
          </TabsList>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <TabsContent value="vehicle-in" className="m-0 focus-visible:ring-0">
                  <VehicleIn upcomingVehicleData={upcomingVehicleData} />
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