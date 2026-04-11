"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Truck,
  Package,
  Clock,
  Navigation,
  CheckCircle,
  PlayCircle,
  ClipboardCheck,
  Timer,
  Wrench,
  CircleDot,
  MapPin,
  ClipboardCheck as LoadedIcon,
  BarChart3,
  Loader2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModalId } from "@/app/dashboard/page";
import { useFirestore } from "@/firebase";
import { collection, onSnapshot, query, where, Timestamp, getDocs } from "firebase/firestore";
import { startOfDay, endOfDay, subDays, isValid, format } from "date-fns";
import { cn, normalizePlantId, handleFirestoreError, OperationType } from "@/lib/utils";
import { fetchFleetLocation } from "@/app/actions/wheelseye";

type DashboardCardProps = {
  title: string;
  icon: React.ElementType;
  value: string;
  description: string;
  onClick?: () => void;
  isLoading: boolean;
  isError: boolean;
  extra?: React.ReactNode;
  showGpsStats?: boolean;
  gpsMoving?: number;
  gpsStop?: number;
  locationRegistry?: string;
  lastUpdateTime?: string;
};

function DashboardCard({
  icon: Icon,
  title,
  value,
  description,
  onClick,
  isLoading,
  isError,
  showGpsStats,
  gpsMoving = 0,
  gpsStop = 0,
  locationRegistry,
  lastUpdateTime
}: DashboardCardProps) {
  const cardContent = useMemo(() => {
    if (isLoading) {
      return <Skeleton className="h-7 w-16" />;
    }
    if (isError) {
      return <div className="text-2xl font-bold text-destructive">Error</div>;
    }
    return <div className="text-2xl font-bold">{value || "0"}</div>;
  }, [isLoading, isError, value]);

  const cardClass = isError ? "border-destructive/50" : "cursor-pointer hover:bg-muted/50 transition-colors";

  return (
    <Card onClick={isError ? undefined : onClick} className={cn("relative overflow-hidden group min-h-[160px]", cardClass)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 text-wrap">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-tight">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </CardHeader>
      <CardContent>
        {cardContent}
        
        {showGpsStats && !isLoading && !isError && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 mb-1">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {gpsMoving} Moving
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-red-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {gpsStop} Stop
                </div>
            </div>
        )}

        {locationRegistry && !isLoading && !isError && (
            <div className="mt-3 space-y-1 group/loc">
                <div className="flex justify-between items-center pr-1">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                        <MapPin className="h-2.5 w-2.5 text-blue-600" />
                        Location Registry
                    </p>
                    {lastUpdateTime && (
                        <span className="text-[8px] font-mono text-slate-400 font-bold">{lastUpdateTime}</span>
                    )}
                </div>
                <p className={cn(
                    "text-[10px] font-bold leading-tight uppercase line-clamp-1",
                    locationRegistry === "GPS Offline" ? "text-slate-300" : "text-slate-700"
                )}>
                    {locationRegistry}
                </p>
            </div>
        )}

        <p className="text-[10px] font-medium text-slate-400 mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardCards({ 
  selectedPlant, 
  authorizedPlantIds,
  onCardClick,
  fromDate,
  toDate,
  refreshKey,
 }: { 
  selectedPlant: string;
  authorizedPlantIds: string[];
  onCardClick: (modalId: ModalId) => void;
  fromDate?: Date;
  toDate?: Date;
  refreshKey: number;
}) {
  const firestore = useFirestore();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [gpsStats, setGpsStats] = useState({ moving: 0, stopped: 0, total: 0 });
  const [tripsByType, setTripsByType] = useState({ own: 0, contract: 0, market: 0 });
  const [categoryGps, setCategoryGps] = useState<Record<string, { moving: number, stopped: number }>>({
    assigned: { moving: 0, stopped: 0 },
    active: { moving: 0, stopped: 0 },
    transit: { moving: 0, stopped: 0 },
    arrived: { moving: 0, stopped: 0 }
  });
  const [categoryLocations, setCategoryLocations] = useState<Record<string, { location: string, ts: number }>>({});
  
  // Real-time State Node
  const [rawShipments, setRawShipments] = useState<Record<string, any[]>>({});
  const [rawTrips, setRawTrips] = useState<Record<string, any[]>>({});
  const [rawEntries, setRawEntries] = useState<any[]>([]);
  const [isFleetLoading, setIsFleetLoading] = useState(false);
  const [isRegistryLoading, setIsRegistryLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // 1. Real-time Registry Synchronizer (Multi-Node)
  useEffect(() => {
    if (!firestore || authorizedPlantIds.length === 0) return;

    const unsubscribers: (() => void)[] = [];
    const scopePlantIds = selectedPlant === 'all-plants' ? authorizedPlantIds : [selectedPlant];

    // Listen to Gate Presence (Global Registry)
    const entryQ = query(collection(firestore, "vehicleEntries"), where("status", "==", "IN"));
    unsubscribers.push(onSnapshot(entryQ, (snap) => {
        setRawEntries(snap.docs.map(d => d.data()));
    }, async (e) => {
        await handleFirestoreError(e, OperationType.LIST, 'vehicleEntries');
    }));

    // Listen to partitioned plant data
    scopePlantIds.forEach(pId => {
        const shipmentCol = collection(firestore, `plants/${pId}/shipments`);
        unsubscribers.push(onSnapshot(shipmentCol, (snap) => {
            setRawShipments(prev => ({ ...prev, [pId]: snap.docs.map(d => d.data()) }));
        }, async (e) => {
            await handleFirestoreError(e, OperationType.LIST, shipmentCol.path);
        }));

        const tripCol = collection(firestore, `plants/${pId}/trips`);
        unsubscribers.push(onSnapshot(tripCol, (snap) => {
            setRawTrips(prev => ({ ...prev, [pId]: snap.docs.map(d => d.data()) }));
            setIsRegistryLoading(false);
        }, async (e) => {
            await handleFirestoreError(e, OperationType.LIST, tripCol.path);
        }));
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [firestore, selectedPlant, authorizedPlantIds, refreshKey]);

  // 2. GIS Telemetry Poller (External Handshake)
  useEffect(() => {
    const fetchGps = async () => {
        setIsFleetLoading(true);
        const res = await fetchFleetLocation();
        if (res.data) setGpsStats({ moving: res.data.filter(v => v.speed > 5).length, stopped: res.data.filter(v => v.speed <= 5).length, total: res.data.length });
        setIsFleetLoading(false);
    };
    fetchGps();
    const interval = setInterval(fetchGps, 60000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  // 3. Logic Node: Real-time Aggregate Computation
  const calculatedStats = useMemo(() => {
    const dayStart = fromDate ? startOfDay(fromDate) : startOfDay(subDays(new Date(), 7));
    const dayEnd = toDate ? endOfDay(toDate) : endOfDay(new Date());

    let pending = 0, assigned = 0, transit = 0, arrived = 0, maintenance = 0, loadedTrips = 0, completed = 0;
    let own = 0, contract = 0, market = 0;

    Object.values(rawShipments).flat().forEach(s => {
        const status = s.currentStatusId?.toLowerCase() || '';
        if (['pending', 'partly vehicle assigned'].includes(status)) pending++;
    });

    Object.values(rawTrips).flat().forEach(t => {
        const statusRaw = (t.tripStatus || t.currentStatusId || '').toLowerCase().trim().replace(/[\s_-]+/g, '-');
        const startTime = t.startDate instanceof Timestamp ? t.startDate.toDate() : (t.startDate ? new Date(t.startDate) : new Date());
        const isDateMatch = startTime >= dayStart && startTime <= dayEnd;

        const vType = (t.vehicleType || '').toLowerCase();
        if (isDateMatch) {
            if (vType.includes('own')) own++;
            else if (vType.includes('contract')) contract++;
            else if (vType.includes('market')) market++;
        }

        if (statusRaw === 'assigned' || statusRaw === 'vehicle-assigned') assigned++;
        else if (statusRaw === 'in-transit') transit++;
        else if (statusRaw === 'arrived' || statusRaw === 'arrival-for-delivery' || statusRaw === 'arrive-for-deliver') arrived++;
        else if (statusRaw === 'delivered' && isDateMatch) completed++;
        else if (statusRaw === 'loaded' || statusRaw === 'loading-complete') loadedTrips++;
    });

    rawEntries.forEach(entry => {
        const isInMaintenance = entry.remarks && ['Break-down', 'Under Maintenance'].includes(entry.remarks);
        if (isInMaintenance) maintenance++;
    });

    return {
        'pending-shipments': pending,
        'assigned-vehicles': assigned,
        'in-transit': transit,
        'arrival-for-delivery': arrived,
        'breakdown-maintenance': maintenance,
        'loaded-trips': loadedTrips,
        'completed-shipments': completed,
        'active-trips': assigned + transit + arrived,
        own, contract, market
    };
  }, [rawShipments, rawTrips, rawEntries, fromDate, toDate]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card className="relative overflow-hidden group min-h-[160px] cursor-default">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-tight">Trips by Vehicle Type</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent>
          {isRegistryLoading ? (
            <div className="flex flex-col gap-2 mt-4"><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-2/3"/></div>
          ) : (
            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-blue-700">Own</span><span className="text-sm font-black text-blue-700">{calculatedStats.own}</span></div>
              <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-violet-700">Contract</span><span className="text-sm font-black text-violet-700">{calculatedStats.contract}</span></div>
              <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-amber-600">Market</span><span className="text-sm font-black text-amber-600">{calculatedStats.market}</span></div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <DashboardCard title="Pending Orders" icon={Package} value={`${calculatedStats['pending-shipments']}`} description="Shipments awaiting allocation" onClick={() => onCardClick('pending-shipments')} isLoading={isRegistryLoading} isError={isError} />
      <DashboardCard title="Assigned Vehicles" icon={Clock} value={`${calculatedStats['assigned-vehicles']}`} description="Assigned, awaiting gate-out" onClick={() => onCardClick('assigned-vehicles')} isLoading={isRegistryLoading} isError={isError} />
      <DashboardCard title="Loaded Trips" icon={LoadedIcon} value={`${calculatedStats['loaded-trips']}`} description="Ready, awaiting gate departure" onClick={() => onCardClick('loaded-trips')} isLoading={isRegistryLoading} isError={isError} />
      <DashboardCard title="Active Trips" icon={PlayCircle} value={`${calculatedStats['active-trips']}`} description="Total non-closed missions" onClick={() => onCardClick('active-trips')} isLoading={isRegistryLoading} isError={isError} />
      <DashboardCard title="In-Transit" icon={Navigation} value={`${calculatedStats['in-transit']}`} description="Missions moving to destination" onClick={() => onCardClick('in-transit')} isLoading={isRegistryLoading} isError={isError} />
      <DashboardCard title="Arrival Vehicles" icon={ClipboardCheck} value={`${calculatedStats['arrival-for-delivery']}`} description="Reported at destination" onClick={() => onCardClick('arrival-for-delivery')} isLoading={isRegistryLoading} isError={isError} />
      <DashboardCard title="Under Maintenance" icon={Wrench} value={`${calculatedStats['breakdown-maintenance']}`} description="Fleet nodes in registry" onClick={() => onCardClick('breakdown-maintenance')} isLoading={isRegistryLoading} isError={isError} />
      <DashboardCard title="Completed" icon={CheckCircle} value={`${calculatedStats['completed-shipments']}`} description="Verified mission completions" onClick={() => onCardClick('completed-shipments')} isLoading={isRegistryLoading} isError={isError} />
    </div>
  );
}
