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
  Radar,
  CircleDot,
  MapPin,
  ClipboardCheck as LoadedIcon
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModalId } from "@/app/dashboard/page";
import { useFirestore } from "@/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { startOfDay, endOfDay, subDays, differenceInMinutes, isValid, format } from "date-fns";
import { cn, normalizePlantId } from "@/lib/utils";
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
  const [categoryGps, setCategoryGps] = useState<Record<string, { moving: number, stopped: number }>>({
    assigned: { moving: 0, stopped: 0 },
    active: { moving: 0, stopped: 0 },
    transit: { moving: 0, stopped: 0 },
    arrived: { moving: 0, stopped: 0 }
  });
  const [categoryLocations, setCategoryLocations] = useState<Record<string, { location: string, ts: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchRegistry = async () => {
    if (!firestore) return;
    setIsLoading(true);
    try {
        const isAllPlants = selectedPlant === 'all-plants';
        const scopePlantIds = isAllPlants ? authorizedPlantIds : [selectedPlant];
        
        const dayStart = fromDate ? startOfDay(fromDate) : startOfDay(subDays(new Date(), 7));
        const dayEnd = toDate ? endOfDay(toDate) : endOfDay(new Date());

        const gpsRes = await fetchFleetLocation();
        const vehicleStatusMap = new Map<string, any>();

        if (gpsRes.data) {
            let globalMoving = 0;
            let globalStopped = 0;
            gpsRes.data.forEach((v: any) => {
                const isMoving = v.speed > 5;
                if (isMoving) globalMoving++; else globalStopped++;
                
                const lastSync = v.lastUpdateRaw ? new Date(v.lastUpdateRaw) : new Date();
                const lastSyncTs = isValid(lastSync) ? lastSync.getTime() : 0;

                vehicleStatusMap.set(v.vehicleNumber?.toUpperCase().replace(/\s/g, ''), { 
                    speed: Number(v.speed || 0), 
                    ignition: v.ignition === true || v.ignition === 'true' || v.ignition === 'on',
                    location: v.location,
                    lastUpdateRaw: v.lastUpdateRaw,
                    lastUpdateTs: lastSyncTs
                });
            });
            setGpsStats({ moving: globalMoving, stopped: globalStopped, total: gpsRes.data.length });
        }

        let pending = 0, assigned = 0, transit = 0, arrived = 0, maintenance = 0, loadedTrips = 0, completed = 0;
        const catStats = {
            assigned: { moving: 0, stopped: 0 },
            transit: { moving: 0, stopped: 0 },
            arrived: { moving: 0, stopped: 0 },
            active: { moving: 0, stopped: 0 }
        };

        const catLocations: Record<string, { location: string, ts: number }> = {
            assigned: { location: 'GPS Offline', ts: 0 },
            transit: { location: 'GPS Offline', ts: 0 },
            arrived: { location: 'GPS Offline', ts: 0 },
            active: { location: 'GPS Offline', ts: 0 },
            maintenance: { location: 'GPS Offline', ts: 0 }
        };

        const updateCategoryLocation = (cat: string, gpsNode: any) => {
            if (!gpsNode) return;
            if (gpsNode.lastUpdateTs > catLocations[cat].ts) {
                catLocations[cat] = { location: gpsNode.location, ts: gpsNode.lastUpdateTs };
            }
        };

        for (const pId of scopePlantIds) {
            const shipSnap = await getDocs(collection(firestore, `plants/${pId}/shipments`));
            shipSnap.forEach(d => { 
                const s = d.data();
                const status = s.currentStatusId?.toLowerCase() || '';
                if (['pending', 'partly vehicle assigned'].includes(status)) pending++; 
            });

            const tripSnap = await getDocs(collection(firestore, `plants/${pId}/trips`));
            tripSnap.forEach(d => {
                const t = d.data();
                const statusStr = t.tripStatus || t.currentStatusId || '';
                const s = statusStr.toLowerCase().trim().replace(/[\s_-]+/g, '-');
                
                const startTime = t.startDate instanceof Timestamp ? t.startDate.toDate() : new Date(t.startDate);
                const isDateMatch = startTime >= dayStart && startTime <= dayEnd;

                const vNo = t.vehicleNumber?.toUpperCase().replace(/\s/g, '');
                const gpsInfo = vehicleStatusMap.get(vNo || '');
                const isMoving = gpsInfo && gpsInfo.speed > 5;

                const isAssigned = s === 'assigned' || s === 'vehicle-assigned';
                const isTransit = s === 'in-transit';
                const isArrived = s === 'arrival-for-delivery' || s === 'arrived-at-destination';
                const isDelivered = s === 'delivered';
                const isLoaded = s === 'loading-complete' || s === 'loaded';

                if (isAssigned) {
                    assigned++;
                    if (isMoving) catStats.assigned.moving++; else catStats.assigned.stopped++;
                    if (isMoving) catStats.active.moving++; else catStats.active.stopped++;
                    updateCategoryLocation('assigned', gpsInfo);
                    updateCategoryLocation('active', gpsInfo);
                } else if (isTransit) {
                    transit++;
                    if (isMoving) catStats.transit.moving++; else catStats.transit.stopped++;
                    if (isMoving) catStats.active.moving++; else catStats.active.stopped++;
                    updateCategoryLocation('transit', gpsInfo);
                    updateCategoryLocation('active', gpsInfo);
                } else if (isArrived) {
                    arrived++;
                    if (isMoving) catStats.arrived.moving++; else catStats.arrived.stopped++;
                    if (isMoving) catStats.active.moving++; else catStats.active.stopped++;
                    updateCategoryLocation('arrived', gpsInfo);
                    updateCategoryLocation('active', gpsInfo);
                } else if (isDelivered) {
                    if (isDateMatch) completed++;
                } else if (isLoaded) {
                    // Logic Node: Loaded but still in yard (marked as IN at gate)
                    loadedTrips++;
                }
            });
        }

        const yardSnap = await getDocs(query(collection(firestore, "vehicleEntries"), where("status", "==", "IN")));
        yardSnap.forEach(d => { 
            const entry = d.data();
            const isInMaintenance = entry.remarks && ['Break-down', 'Under Maintenance'].includes(entry.remarks);
            if (isInMaintenance) {
                maintenance++;
                const vNo = entry.vehicleNumber?.toUpperCase().replace(/\s/g, '');
                const gpsInfo = vehicleStatusMap.get(vNo || '');
                updateCategoryLocation('maintenance', gpsInfo);
            }
        });

        setCategoryLocations(catLocations);
        setCategoryGps(catStats);
        setCounts({
            'pending-shipments': pending,
            'assigned-vehicles': assigned,
            'in-transit': transit,
            'arrival-for-delivery': arrived,
            'breakdown-maintenance': maintenance,
            'loaded-trips': loadedTrips,
            'completed-shipments': completed,
            'active-trips': assigned + transit + arrived
        });

    } catch (e) {
        console.error("Dashboard calculation failure:", e);
        setIsError(true);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistry();
    const interval = setInterval(fetchRegistry, 60000);
    return () => clearInterval(interval);
  }, [selectedPlant, fromDate, toDate, refreshKey, firestore, authorizedPlantIds]);

  const formatLoc = (cat: string) => {
    const node = categoryLocations[cat];
    if (!node || node.location === 'GPS Offline' || node.ts === 0) return 'GPS Offline';
    return node.location;
  };

  const formatTime = (cat: string) => {
    const node = categoryLocations[cat];
    if (!node || node.ts === 0) return '';
    return format(new Date(node.ts), 'HH:mm');
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <DashboardCard
        title="Fleet GIS Monitor"
        icon={Radar}
        value={`${gpsStats.total}`}
        description="Active GPS nodes in registry"
        onClick={() => onCardClick('gis-monitor')}
        isLoading={isLoading}
        isError={isError}
        showGpsStats={true}
        gpsMoving={gpsStats.moving}
        gpsStop={gpsStats.stopped}
      />
      
      <DashboardCard
        title="Pending Orders"
        icon={Package}
        value={`${counts['pending-shipments']}`}
        description="Shipments awaiting allocation"
        onClick={() => onCardClick('pending-shipments')}
        isLoading={isLoading}
        isError={isError}
      />

      <DashboardCard
        title="Assigned Vehicles"
        icon={Clock}
        value={`${counts['assigned-vehicles']}`}
        description="Assigned, awaiting gate-out"
        onClick={() => onCardClick('assigned-vehicles')}
        isLoading={isLoading}
        isError={isError}
        showGpsStats={true}
        gpsMoving={categoryGps.assigned.moving}
        gpsStop={categoryGps.assigned.stopped}
        locationRegistry={formatLoc('assigned')}
        lastUpdateTime={formatTime('assigned')}
      />

      <DashboardCard
        title="Loaded Trips"
        icon={LoadedIcon}
        value={`${counts['loaded-trips']}`}
        description="Ready, awaiting gate departure"
        onClick={() => onCardClick('loaded-trips')}
        isLoading={isLoading}
        isError={isError}
      />

      <DashboardCard
        title="Active Trips"
        icon={PlayCircle}
        value={`${counts['active-trips']}`}
        description="Total non-closed missions"
        onClick={() => onCardClick('active-trips')}
        isLoading={isLoading}
        isError={isError}
        showGpsStats={true}
        gpsMoving={categoryGps.active.moving}
        gpsStop={categoryGps.active.stopped}
        locationRegistry={formatLoc('active')}
        lastUpdateTime={formatTime('active')}
      />

      <DashboardCard
        title="In-Transit"
        icon={Navigation}
        value={`${counts['in-transit']}`}
        description="Missions moving to destination"
        onClick={() => onCardClick('in-transit')}
        isLoading={isLoading}
        isError={isError}
        showGpsStats={true}
        gpsMoving={categoryGps.transit.moving}
        gpsStop={categoryGps.transit.stopped}
        locationRegistry={formatLoc('transit')}
        lastUpdateTime={formatTime('transit')}
      />

      <DashboardCard
        title="Arrival Vehicles"
        icon={ClipboardCheck}
        value={`${counts['arrival-for-delivery']}`}
        description="Reported at destination"
        onClick={() => onCardClick('arrival-for-delivery')}
        isLoading={isLoading}
        isError={isError}
        showGpsStats={true}
        gpsMoving={categoryGps.arrived.moving}
        gpsStop={categoryGps.arrived.stopped}
        locationRegistry={formatLoc('arrived')}
        lastUpdateTime={formatTime('arrived')}
      />

      <DashboardCard
        title="Under Maintenance"
        icon={Wrench}
        value={`${counts['breakdown-maintenance']}`}
        description="Fleet nodes in registry"
        onClick={() => onCardClick('breakdown-maintenance')}
        isLoading={isLoading}
        isError={isError}
        locationRegistry={formatLoc('maintenance')}
        lastUpdateTime={formatTime('maintenance')}
      />

      <DashboardCard
        title="Completed"
        icon={CheckCircle}
        value={`${counts['completed-shipments']}`}
        description="Verified mission completions"
        onClick={() => onCardClick('completed-shipments')}
        isLoading={isLoading}
        isError={isError}
      />
    </div>
  );
}
