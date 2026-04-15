
'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardCards } from "@/components/dashboard/dashboard-cards";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    RefreshCcw, 
    LayoutDashboard, 
    ShieldCheck, 
    Loader2,
    Factory,
    Radar
} from "lucide-react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import type { Plant, WithId, SubUser } from "@/types";
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/date-picker";
import { handleFirestoreError, OperationType } from "@/lib/utils";

// MODAL REGISTRY IMPORTS
import ActiveTripsModal from "@/components/dashboard/modals/active-trips-modal";
import AssignedVehiclesModal from "@/components/dashboard/modals/assigned-vehicles-modal";
import InTransitShipmentsModal from "@/components/dashboard/modals/in-transit-shipments-modal";
import ArrivalForDeliveryModal from "@/components/dashboard/modals/arrival-for-delivery-modal";
import PendingShipmentsModal from "@/components/dashboard/modals/pending-shipments-modal";
import CompletedShipmentsModal from "@/components/dashboard/modals/completed-shipments-modal";
import LoadedStayModal from "@/components/dashboard/modals/loaded-stay-modal";
import BreakdownMaintenanceModal from "@/components/dashboard/modals/breakdown-maintenance-modal";
import AvailableVehiclesModal from "@/components/dashboard/modals/available-vehicles-modal";
import LoadedTripsModal from "@/components/dashboard/modals/loaded-trips-modal";
import GISMonitor from "@/components/dashboard/GISMonitor";

export type ModalId =
  | "available-vehicles"
  | "pending-shipments"
  | "assigned-vehicles"
  | "in-transit"
  | "arrival-for-delivery"
  | "completed-shipments"
  | "active-trips"
  | "loaded-stay"
  | "breakdown-maintenance"
  | "gis-monitor"
  | "loaded-trips"
  | null;

/**
 * @fileOverview Logistics Dashboard (Monitoring Hub).
 * Optimized for mobile responsiveness with a compact sticky header.
 */
export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedPlant, setSelectedPlant] = useState("all-plants");
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 7)));
  const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);

  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [runningIconUrl, setRunningIconUrl] = useState<string | null>(null);
  const [stoppedIconUrl, setStoppedIconUrl] = useState<string | null>(null);

  const [selectedModal, setSelectedModal] = useState<ModalId>(null);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchAuthorizedPlants = async () => {
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
                const directRef = doc(firestore, "users", user.uid);
                const directSnap = await getDoc(directRef);
                if (directSnap.exists()) userDocSnap = directSnap;
            }

            let authIds: string[] = [];
            let isRoot = false;

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                isRoot = userData.username?.toLowerCase() === 'sikkaind' || user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
                const userPlantIds = userData.plantIds || [];
                authIds = (isRoot || userPlantIds.length === 0) && allMasterPlants
                    ? allMasterPlants.map(p => p.id)
                    : userPlantIds;
                setIsAdmin(isRoot);
            } else if (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') {
                authIds = allMasterPlants?.map(p => p.id) || [];
                setIsAdmin(true);
            } else if (allMasterPlants) {
                authIds = allMasterPlants.map(p => p.id);
            }
            
            setAuthorizedPlantIds(authIds);
            if (authIds.length > 0) {
                if (isRoot) setSelectedPlant("all-plants");
                else if (authIds.length === 1) setSelectedPlant(authIds[0]);
                else setSelectedPlant("all-plants");
            }
        } catch (error) {
            console.error("Dashboard Auth Sync Error:", error);
        } finally {
            setIsAuthLoading(false);
        }
    };
    
    const fetchIconUrls = async () => {
        const settingsDoc = doc(firestore, 'gps_settings', 'api_config');
        const docSnap = await getDoc(settingsDoc);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setRunningIconUrl(data.runningIconUrl || null);
            setStoppedIconUrl(data.stoppedIconUrl || null);
        }
    };

    fetchAuthorizedPlants();
    fetchIconUrls();
  }, [firestore, user, allMasterPlants, refreshKey]);

  const plantsList = useMemo(() => {
    return (allMasterPlants || []).filter(p => authorizedPlantIds.includes(p.id));
  }, [allMasterPlants, authorizedPlantIds]);

  const isReadOnlyPlant = !isAdmin && plantsList.length === 1;

  const handleCardClick = (id: ModalId) => {
    setSelectedModal(id);
  };

  const activePlantName = selectedPlant === 'all-plants' ? 'All Authorized Plants' : plantsList.find(p => p.id === selectedPlant)?.name || selectedPlant;

  return (
    <main className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
      <div className="sticky top-0 z-30 bg-white border-b px-4 py-3 md:px-8 md:py-4 flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-4 shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 md:gap-3">
            <LayoutDashboard className="h-5 w-5 md:h-6 md:w-6 text-blue-900" />
            <h1 className="text-lg md:text-3xl font-black text-blue-900 tracking-tight uppercase italic">LOGISTICS DASHBOARD</h1>
          </div>
          <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:ml-9">MONITORING HUB & REGISTRY ANALYTICS</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end gap-2 md:gap-3 bg-slate-100/50 md:bg-slate-50 p-2 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-inner w-full lg:w-auto">
          <div className="grid gap-1">
            <label className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">AUTHORIZED SCOPE</label>
            {isReadOnlyPlant ? (
                <div className="h-9 md:h-10 px-3 flex items-center bg-white rounded-xl border border-slate-200 text-blue-900 font-black text-[10px] md:text-xs shadow-sm uppercase tracking-tighter min-w-[160px]">
                    <ShieldCheck className="h-3 w-3 mr-2 text-blue-600" /> {plantsList[0]?.name}
                </div>
            ) : (
                <Select value={selectedPlant} onValueChange={setSelectedPlant} disabled={isAuthLoading}>
                    <SelectTrigger className="w-full lg:w-[180px] h-9 md:h-10 rounded-xl bg-white border-slate-200 font-bold text-blue-900 shadow-sm focus:ring-blue-900 text-[10px] md:text-xs">
                    <SelectValue placeholder="Select a plant" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                    {isAdmin && <SelectItem value="all-plants">All Authorized Plants</SelectItem>}
                    {plantsList.map(plant => (
                        <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            )}
          </div>

          <div className="grid gap-1">
            <label className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">PERIOD FROM</label>
            <DatePicker date={fromDate} setDate={setFromDate} className="h-9 md:h-10 rounded-xl bg-white border-none shadow-sm text-[10px] md:text-xs" />
          </div>

          <div className="grid gap-1">
            <label className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">PERIOD TO</label>
            <DatePicker date={toDate} setDate={setTodayDate} className="h-9 md:h-10 rounded-xl bg-white border-none shadow-sm text-[10px] md:text-xs" />
          </div>

          <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
            <Button onClick={() => setRefreshKey(k => k + 1)} variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 rounded-xl text-blue-900 hover:bg-blue-50">
                <RefreshCcw className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1 overflow-y-auto">
        <DashboardCards 
          selectedPlant={selectedPlant} 
          authorizedPlantIds={authorizedPlantIds}
          onCardClick={handleCardClick}
          refreshKey={refreshKey}
          fromDate={fromDate}
          toDate={toDate}
        />
      </div>

      {/* MODAL REGISTRY */}
      {selectedModal === "active-trips" && (
        <ActiveTripsModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "assigned-vehicles" && (
        <AssignedVehiclesModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "in-transit" && (
        <InTransitShipmentsModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "arrival-for-delivery" && (
        <ArrivalForDeliveryModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "pending-shipments" && (
        <PendingShipmentsModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "completed-shipments" && (
        <CompletedShipmentsModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "loaded-stay" && (
        <LoadedStayModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "breakdown-maintenance" && (
        <BreakdownMaintenanceModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "available-vehicles" && (
        <AvailableVehiclesModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "loaded-trips" && (
        <LoadedTripsModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          plantId={selectedPlant}
          plantName={activePlantName}
          authorizedPlantIds={authorizedPlantIds}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {selectedModal === "gis-monitor" && (
        <GISMonitor
          isOpen={true}
          onClose={() => setSelectedModal(null)}
        />
      )}
    </main>
  );
}
