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
 * Independent monitoring node providing real-time aggregates and analytics.
 * Rule: Clicking cards opens detailed modals without navigation.
 * Default Period: 7 Days.
 */
export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  // REGISTRY DEFAULT: Last 7 Days
  const [selectedPlant, setSelectedPlant] = useState("all-plants");
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 7)));
  const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);

  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [runningIconUrl, setRunningIconUrl] = useState<string | null>(null);
  const [stoppedIconUrl, setStoppedIconUrl] = useState<string | null>(null);

  // Modal State Control
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
            const qSnap = await getDocs(q).catch(async (e) => {
                await handleFirestoreError(e, OperationType.LIST, 'users');
                throw e;
            });

            if (!qSnap.empty) {
                userDocSnap = qSnap.docs[0];
            } else {
                const directRef = doc(firestore, "users", user.uid);
                const directSnap = await getDoc(directRef).catch(async (e) => {
                    await handleFirestoreError(e, OperationType.GET, directRef.path);
                    throw e;
                });
                if (directSnap.exists()) userDocSnap = directSnap;
            }

            let authIds: string[] = [];
            let isRoot = false;

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                isRoot = userData.username?.toLowerCase() === 'sikkaind' || user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
                const userPlantIds = userData.plantIds || [];
                // If user has no plantIds assigned OR is root, give access to all plants
                authIds = (isRoot || userPlantIds.length === 0) && allMasterPlants
                    ? allMasterPlants.map(p => p.id)
                    : userPlantIds;
                setIsAdmin(isRoot);
            } else if (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') {
                authIds = allMasterPlants?.map(p => p.id) || [];
                setIsAdmin(true);
            } else if (allMasterPlants) {
                // Fallback: user doc not found but user is authenticated — show all plants
                authIds = allMasterPlants.map(p => p.id);
            }
            
            setAuthorizedPlantIds(authIds);
            if (authIds.length > 0) {
                if (isRoot) setSelectedPlant("all-plants");
                // For sub-users with single plant, auto-select it; otherwise keep "all-plants"
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
        const docSnap = await getDoc(settingsDoc).catch(async (e) => {
            await handleFirestoreError(e, OperationType.GET, settingsDoc.path);
            throw e;
        });
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

  const activePlantName = selectedPlant === 'all-plants' ? 'All Authorized Nodes' : plantsList.find(p => p.id === selectedPlant)?.name || selectedPlant;

  return (
    <main className="flex flex-col h-full bg-slate-50/50">
      <div className="sticky top-0 z-30 bg-white border-b px-8 py-4 flex flex-col md:flex-row md:items-end justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 text-blue-900" />
            <h1 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight uppercase italic">Logistics Dashboard</h1>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-9">Monitoring Hub & Registry Analytics</p>
        </div>
        
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Authorized Scope</label>
            {isReadOnlyPlant ? (
                <div className="h-10 px-4 flex items-center bg-blue-50/50 rounded-xl border border-blue-100 text-blue-900 font-black text-xs shadow-sm uppercase tracking-tighter min-w-[200px]">
                    <ShieldCheck className="h-3.5 w-3.5 mr-2 text-blue-600" /> {plantsList[0]?.name}
                </div>
            ) : (
                <Select value={selectedPlant} onValueChange={setSelectedPlant} disabled={isAuthLoading}>
                    <SelectTrigger className="w-[200px] h-10 rounded-xl bg-slate-100 border-none font-bold text-blue-900 shadow-sm focus:ring-blue-900">
                    <SelectValue placeholder="Select a plant" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                    {isAdmin && <SelectItem value="all-plants">All Authorized Nodes</SelectItem>}
                    {plantsList.map(plant => (
                        <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            )}
          </div>

          <div className="grid gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Period From</label>
            <DatePicker date={fromDate} setDate={setFromDate} className="h-10 rounded-xl bg-slate-100 border-none" />
          </div>

          <div className="grid gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Period To</label>
            <DatePicker date={toDate} setDate={setTodayDate} className="h-10 rounded-xl bg-slate-100 border-none" />
          </div>

          <Button onClick={() => setRefreshKey(k => k + 1)} variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-blue-900 hover:bg-blue-50">
            <RefreshCcw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-8">
        <DashboardCards 
          selectedPlant={selectedPlant} 
          authorizedPlantIds={authorizedPlantIds}
          onCardClick={handleCardClick}
          refreshKey={refreshKey}
          fromDate={fromDate}
          toDate={toDate}
        />
      </div>

      {/* MODAL HANDSHAKE REGISTRY */}
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
          runningIconUrl={runningIconUrl}
          stoppedIconUrl={stoppedIconUrl}
        />
      )}
    </main>
  );
}
