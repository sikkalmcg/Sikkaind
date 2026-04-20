'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
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
} from "lucide-react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import type { Plant, WithId, SubUser } from "@/types";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/date-picker";

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
 * Optimized for mobile: Single scroll node and compact header grid.
 */
function DashboardContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPlant, setSelectedPlant] = useState("all-plants");
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 7)));
  const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);

  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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
            const searchEmail = user.email;
            if (!searchEmail) return;
            
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            let ids: string[] = [];
            let isRoot = false;

            if (!qSnap.empty) {
                const userData = qSnap.docs[0].data() as SubUser;
                isRoot = userData.username?.toLowerCase() === 'sikkaind' || user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
                const userPlantIds = userData.plantIds || [];
                ids = (isRoot || userPlantIds.length === 0) && allMasterPlants ? allMasterPlants.map(p => p.id) : userPlantIds;
                setIsAdmin(isRoot);
            } else if (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') {
                ids = allMasterPlants?.map(p => p.id) || [];
                setIsAdmin(true);
            }
            setAuthorizedPlantIds(ids);
            if (ids.length > 0) {
                if (isRoot) setSelectedPlant("all-plants");
                else if (ids.length === 1) setSelectedPlant(ids[0]);
                else setSelectedPlant("all-plants");
            }
        } catch (error) { console.error(error); } finally { setIsAuthLoading(false); }
    };
    fetchAuthorizedPlants();
  }, [firestore, user, allMasterPlants, refreshKey]);

  const plantsList = useMemo(() => (allMasterPlants || []).filter(p => authorizedPlantIds.includes(p.id)), [allMasterPlants, authorizedPlantIds]);
  const isReadOnlyPlant = !isAdmin && plantsList.length === 1;
  const activePlantName = selectedPlant === 'all-plants' ? 'All Authorized Plants' : plantsList.find(p => p.id === selectedPlant)?.name || selectedPlant;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      <div className="bg-white border-b px-4 md:px-8 py-3 md:py-4 flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 md:h-6 md:w-6 text-blue-900" />
            <h1 className="text-lg md:text-3xl font-black text-blue-900 tracking-tight uppercase italic leading-none">DASHBOARD</h1>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end gap-2 bg-slate-50 p-2 md:p-3 rounded-2xl border border-slate-100 shadow-inner w-full lg:w-auto">
          <div className="grid gap-1">
            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest px-1">SCOPE</label>
            {isReadOnlyPlant ? (
                <div className="h-9 px-3 flex items-center bg-white rounded-xl border border-slate-200 text-blue-900 font-black text-[10px] shadow-sm uppercase min-w-[160px]">
                    <ShieldCheck className="h-3 w-3 mr-2 text-blue-600" /> {plantsList[0]?.name}
                </div>
            ) : (
                <Select value={selectedPlant} onValueChange={setSelectedPlant} disabled={isAuthLoading}>
                    <SelectTrigger className="w-full lg:w-[180px] h-9 rounded-xl bg-white border-slate-200 font-bold text-blue-900 shadow-sm text-[10px]">
                    <SelectValue placeholder="Select plant" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                    {isAdmin && <SelectItem value="all-plants">All Authorized Plants</SelectItem>}
                    {plantsList.map(plant => (<SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>))}
                    </SelectContent>
                </Select>
            )}
          </div>
          <div className="grid gap-1">
            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest px-1">PERIOD</label>
            <DatePicker date={fromDate} setDate={setFromDate} className="h-9 rounded-xl bg-white border-none shadow-sm text-[10px]" />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => setRefreshKey(k => k + 1)} variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-900 hover:bg-blue-50">
                <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 md:p-8">
            <DashboardCards 
                selectedPlant={selectedPlant} 
                authorizedPlantIds={authorizedPlantIds}
                onCardClick={(id) => setSelectedModal(id)}
                refreshKey={refreshKey}
                fromDate={fromDate}
                toDate={toDate}
            />
        </div>
      </div>

      {/* MODAL REGISTRY */}
      {selectedModal === "active-trips" && <ActiveTripsModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "assigned-vehicles" && <AssignedVehiclesModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "in-transit" && <InTransitShipmentsModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "arrival-for-delivery" && <ArrivalForDeliveryModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "pending-shipments" && <PendingShipmentsModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "completed-shipments" && <CompletedShipmentsModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "loaded-stay" && <LoadedStayModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "breakdown-maintenance" && <BreakdownMaintenanceModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "available-vehicles" && <AvailableVehiclesModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "loaded-trips" && <LoadedTripsModal isOpen={true} onClose={() => setSelectedModal(null)} plantId={selectedPlant} plantName={activePlantName} authorizedPlantIds={authorizedPlantIds} fromDate={fromDate} toDate={toDate} />}
      {selectedModal === "gis-monitor" && <GISMonitor isOpen={true} onClose={() => setSelectedModal(null)} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#f8fafc]">
            <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
        </div>
    }>
        <DashboardContent />
    </Suspense>
  );
}
