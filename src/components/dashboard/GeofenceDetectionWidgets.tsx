'use client';

import * as React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Navigation, 
  MapPin, 
  Compass, 
  Search, 
  Clock, 
  Truck, 
  ExternalLink, 
  CheckCircle2, 
  Radio,
  AlertCircle,
  RefreshCw,
  Gauge,
  Shield,
  Plus
} from 'lucide-react';
import { useMongoStore } from '@/mongodb';
import { collection, onSnapshot } from '@/lib/mongo-store';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { 
  PlantLocation, 
  KNOWN_PLANTS, 
  evaluateGeofenceStatus 
} from '@/lib/geofence';

const SHARED_HUB_ID = 'Sikkaind';

export interface GeofenceWidgetData {
  id: 'dasna-plant' | 'salt-plant' | 'tea-plant' | 'outside';
  name: string;
  type: 'plant' | 'outside';
  code?: string;
  address: string;
  radiusText?: string;
  coverageText?: string;
  badgeText: string;
}

export interface VehicleLogItem {
  id: string;
  vehicleNo: string;
  status: 'RUNNING' | 'IDLE' | 'STOPPED' | 'INSIDE PLANT' | 'IN-TRANSIT';
  driverName?: string;
  driverMobile?: string;
  destination?: string;
  material?: string;
  entryTimestamp: string;
  speed?: number;
  plantName: string;
  route?: string;
  distanceMeters?: number | null;
}

export interface SF22VehicleRecord {
  id: string;
  vehicleNumber: string;
  driverName?: string;
  mobile?: string;
  fleetType?: string;
  ownerName?: string;
  status?: string;
  lastGps?: {
    latitude?: number;
    longitude?: number;
    speed?: number;
    ignition?: boolean;
    status?: string;
    lastUpdate?: string;
    dttimeReadable?: string;
    deviceNumber?: string;
  };
}

export interface WheelseyeVehicleItem {
  vehicleNumber: string;
  deviceNumber?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  ignition?: boolean;
  dttime?: string;
  createdDateReadable?: string;
  provider?: string;
  venndorName?: string;
}

const DEFAULT_WIDGETS: GeofenceWidgetData[] = [
  {
    id: 'dasna-plant',
    name: 'Dasna Plant',
    type: 'plant',
    code: 'DASNA',
    address: 'Devi Mandir Road Dasna 201015',
    radiusText: '200m radius',
    badgeText: 'Geofenced',
  },
  {
    id: 'salt-plant',
    name: 'Salt Plant',
    type: 'plant',
    code: '1426',
    address: 'C-17 UPSIDC Industrial Area Vijay Nagar Ghaziabad',
    radiusText: '200m radius',
    badgeText: 'Geofenced',
  },
  {
    id: 'tea-plant',
    name: 'Tea Plant',
    type: 'plant',
    code: 'TEA',
    address: 'B 11, Industrial Area, Bulandshahar Road Ghaziabad',
    radiusText: '200m radius',
    badgeText: 'Geofenced',
  },
  {
    id: 'outside',
    name: 'Outside',
    type: 'outside',
    code: 'OUTSIDE',
    address: 'Outside all active plant geofences',
    coverageText: 'En route / Open highway (>200m)',
    badgeText: 'Transit',
  },
];

// Helper: Normalize vehicle registration number
const normalizeNumber = (num: string) => (num || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();

export function GeofenceDetectionWidgets() {
  const router = useRouter();
  const db = useMongoStore();

  // SF22 Registered Fleet Vehicles & Plants from MongoDB
  const [fleetVehicles, setFleetVehicles] = useState<SF22VehicleRecord[]>([]);
  const [dbPlants, setDbPlants] = useState<any[]>([]);

  // Wheelseye live GPS telemetry state
  const [gpsDataMap, setGpsDataMap] = useState<Record<string, WheelseyeVehicleItem>>({});
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Modal & Search
  const [selectedWidget, setSelectedWidget] = useState<GeofenceWidgetData | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Fetch live Wheelseye GPS telemetry
  const fetchWheelseyeGps = useCallback(async () => {
    setIsGpsLoading(true);
    try {
      const res = await fetch('/api/gps');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list: WheelseyeVehicleItem[] = json?.data?.list || [];
      const map: Record<string, WheelseyeVehicleItem> = {};
      list.forEach((item) => {
        if (item.vehicleNumber) {
          const norm = normalizeNumber(item.vehicleNumber);
          map[norm] = item;
        }
      });
      setGpsDataMap(map);
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn('GPS fetch error in widgets:', err);
    } finally {
      setIsGpsLoading(false);
    }
  }, []);

  // Poll GPS on mount and every 30 seconds for live updates
  useEffect(() => {
    fetchWheelseyeGps();
    const interval = setInterval(() => {
      fetchWheelseyeGps();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchWheelseyeGps]);

  // Real-time synchronization with MongoDB: fleet_vehicles (SF22) and plants
  useEffect(() => {
    if (!db) return;

    // Listen to SF22 fleet_vehicles
    const fleetRef = collection(db, 'users', SHARED_HUB_ID, 'fleet_vehicles');
    const unsubscribeFleet = onSnapshot(fleetRef, (snapshot) => {
      setFleetVehicles(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SF22VehicleRecord)));
    });

    // Listen to dynamic plants
    const plantsRef = collection(db, 'users', SHARED_HUB_ID, 'plants');
    const unsubscribePlants = onSnapshot(plantsRef, (snapshot) => {
      setDbPlants(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeFleet();
      unsubscribePlants();
    };
  }, [db]);

  // Combine dynamic plants from MongoDB with known plants
  const activePlantsList: PlantLocation[] = useMemo(() => {
    const list: PlantLocation[] = [...KNOWN_PLANTS];
    (dbPlants || []).forEach((p: any) => {
      if (p.status !== 'Inactive' && typeof p.latitude === 'number' && typeof p.longitude === 'number') {
        const idx = list.findIndex(
          (item) => item.plantCode === p.plantCode || item.plantName.toLowerCase() === (p.plantName || '').toLowerCase()
        );
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            latitude: p.latitude,
            longitude: p.longitude,
            plantName: p.plantName || list[idx].plantName,
          };
        } else {
          list.push({
            id: p.id,
            plantCode: p.plantCode,
            plantName: p.plantName || p.plantCode || 'Plant',
            latitude: p.latitude,
            longitude: p.longitude,
            radiusMeters: 200,
          });
        }
      }
    });
    return list;
  }, [dbPlants]);

  // Compute live vehicle lists for each widget based on SF22 + Wheelseye live GPS
  const widgetLogsMap = useMemo(() => {
    const map = new Map<string, VehicleLogItem[]>();
    map.set('dasna-plant', []);
    map.set('salt-plant', []);
    map.set('tea-plant', []);
    map.set('outside', []);

    // Combine SF22 registered vehicles + Wheelseye live GPS telemetry
    const vehicleEntries = new Map<string, {
      vehicleNo: string;
      driverName: string;
      driverMobile: string;
      fleetType: string;
      lat?: number;
      lon?: number;
      speed?: number;
      ignition?: boolean;
      lastUpdate?: string;
    }>();

    // 1. Ingest SF22 registered vehicles
    fleetVehicles.forEach((fv) => {
      const norm = normalizeNumber(fv.vehicleNumber);
      if (!norm) return;
      const live = gpsDataMap[norm];
      vehicleEntries.set(norm, {
        vehicleNo: fv.vehicleNumber,
        driverName: fv.driverName || 'Designated Driver',
        driverMobile: fv.mobile || 'N/A',
        fleetType: fv.fleetType || 'SF22 Fleet',
        lat: live?.latitude ?? fv.lastGps?.latitude,
        lon: live?.longitude ?? fv.lastGps?.longitude,
        speed: live?.speed ?? fv.lastGps?.speed ?? 0,
        ignition: live?.ignition ?? fv.lastGps?.ignition ?? false,
        lastUpdate: live?.createdDateReadable || live?.dttime || fv.lastGps?.dttimeReadable || fv.lastGps?.lastUpdate,
      });
    });

    // 2. Ingest any remaining live Wheelseye GPS devices not yet manually entered in SF22
    Object.values(gpsDataMap).forEach((item) => {
      const norm = normalizeNumber(item.vehicleNumber);
      if (!norm || vehicleEntries.has(norm)) return;
      vehicleEntries.set(norm, {
        vehicleNo: item.vehicleNumber,
        driverName: item.venndorName || 'Wheelseye Fleet',
        driverMobile: 'N/A',
        fleetType: 'Live GPS',
        lat: item.latitude,
        lon: item.longitude,
        speed: item.speed || 0,
        ignition: item.ignition || false,
        lastUpdate: item.createdDateReadable || item.dttime,
      });
    });

    // 3. Evaluate Geofence status for each vehicle
    vehicleEntries.forEach((v) => {
      const evalResult = evaluateGeofenceStatus(v.lat, v.lon, activePlantsList);
      const isRunning = (v.speed || 0) > 0;
      let statusStr: VehicleLogItem['status'] = 'STOPPED';
      if (isRunning) {
        statusStr = 'RUNNING';
      } else if (v.ignition) {
        statusStr = 'IDLE';
      } else if (evalResult.isInside) {
        statusStr = 'INSIDE PLANT';
      }

      const logItem: VehicleLogItem = {
        id: v.vehicleNo,
        vehicleNo: v.vehicleNo,
        status: statusStr,
        driverName: v.driverName,
        driverMobile: v.driverMobile,
        destination: evalResult.isInside ? (evalResult.plantName || 'Plant Yard') : 'Transit / Open Highway',
        material: v.fleetType,
        entryTimestamp: v.lastUpdate || 'Live GPS',
        speed: v.speed || 0,
        plantName: evalResult.plantName || 'Outside',
        distanceMeters: evalResult.distanceMeters,
        route: evalResult.isInside
          ? `Inside ${evalResult.plantName} (${evalResult.distanceMeters ?? 0}m from center)`
          : `Outside (${evalResult.distanceMeters ? (evalResult.distanceMeters / 1000).toFixed(1) + ' km to nearest plant' : 'Open Highway'})`,
      };

      const targetList = map.get(evalResult.widgetId) || [];
      targetList.push(logItem);
      map.set(evalResult.widgetId, targetList);
    });

    return map;
  }, [fleetVehicles, gpsDataMap, activePlantsList]);

  // Compute live count for each card
  const getVehicleCount = (widgetId: string): number => {
    return widgetLogsMap.get(widgetId)?.length || 0;
  };

  const activeWidgetLogs = useMemo(() => {
    if (!selectedWidget) return [];
    const logs = widgetLogsMap.get(selectedWidget.id) || [];
    if (!searchFilter.trim()) return logs;
    const query = searchFilter.toLowerCase().trim();
    return logs.filter(item => 
      item.vehicleNo.toLowerCase().includes(query) ||
      (item.driverName && item.driverName.toLowerCase().includes(query)) ||
      (item.destination && item.destination.toLowerCase().includes(query)) ||
      (item.status && item.status.toLowerCase().includes(query)) ||
      (item.material && item.material.toLowerCase().includes(query))
    );
  }, [selectedWidget, widgetLogsMap, searchFilter]);

  const plantWidgets = DEFAULT_WIDGETS.filter(w => w.type === 'plant');
  const outsideWidget = DEFAULT_WIDGETS.find(w => w.type === 'outside');

  const totalTracked = useMemo(() => {
    let count = 0;
    widgetLogsMap.forEach(list => { count += list.length; });
    return count;
  }, [widgetLogsMap]);

  return (
    <div className="mb-8">
      {/* Section Header with SF22 Real-time Sync Status */}
      <div className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Geofence Detection Widgets
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              SF22 Live GPS Real-Time
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            Real-time geofence tracking (200m radius) across Sikka plants powered by SF22 Fleet & Wheelseye GPS telemetry
          </p>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-400 font-medium">
              Total Fleet Tracked: <strong className="text-slate-700">{totalTracked} Vehicles</strong>
            </div>
            {lastSyncTime && (
              <div className="text-[10px] text-slate-400 font-mono">
                Synced: {format(lastSyncTime, 'hh:mm:ss a')}
              </div>
            )}
          </div>

          <button
            onClick={() => fetchWheelseyeGps()}
            disabled={isGpsLoading}
            className="h-8 px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            title="Refresh GPS telemetry now"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-slate-600", isGpsLoading && "animate-spin text-blue-600")} />
            <span>{isGpsLoading ? 'Syncing...' : 'Sync GPS'}</span>
          </button>

          <button
            onClick={() => router.push('/dashboard/sf22')}
            className="h-8 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex items-center gap-1 shadow-sm transition-all"
            title="Manage vehicles in SF22 Fleet Registry"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>SF22 Registry</span>
          </button>
        </div>
      </div>

      {/* Grid: 3 columns on desktop, first row = plants, second row = outside */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plant Cards */}
        {plantWidgets.map((widget) => {
          const count = getVehicleCount(widget.id);
          return (
            <div
              key={widget.id}
              onClick={() => {
                setSelectedWidget(widget);
                setSearchFilter('');
              }}
              className="group relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer border-r-[6px] border-r-emerald-500 flex flex-col justify-between"
            >
              <div>
                {/* Top Row: Icon + Plant Name + Geofenced Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                      <Building2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 tracking-tight group-hover:text-emerald-700 transition-colors">
                      {widget.name}
                    </h3>
                  </div>
                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    {widget.badgeText}
                  </span>
                </div>

                {/* Middle Info: Address & Radius */}
                <div className="mt-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{widget.address}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 pl-5">
                    Radius: <span className="text-slate-600 font-medium">{widget.radiusText || '200m'}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Vehicles Count + View Fleet Link */}
              <div className="flex items-baseline justify-between mt-6 pt-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">
                    {count}
                  </span>
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    VEHICLES
                  </span>
                </div>

                <div className="text-xs font-semibold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1">
                  <span>View Fleet</span>
                  <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Outside Card: Displays on second row, first column */}
        {outsideWidget && (
          <div
            onClick={() => {
              setSelectedWidget(outsideWidget);
              setSearchFilter('');
            }}
            className="group relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer border-r-[6px] border-r-amber-500 flex flex-col justify-between"
          >
            <div>
              {/* Top Row: Icon + Title + Transit Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                    <Navigation className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 tracking-tight group-hover:text-amber-700 transition-colors">
                    {outsideWidget.name}
                  </h3>
                </div>
                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  {outsideWidget.badgeText}
                </span>
              </div>

              {/* Middle Info: Address & Coverage */}
              <div className="mt-4 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{outsideWidget.address}</span>
                </div>
                <div className="text-[11px] text-slate-400 pl-5">
                  Coverage: <span className="text-slate-700 font-semibold">{outsideWidget.coverageText}</span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Vehicles Count + View Fleet Link */}
            <div className="flex items-baseline justify-between mt-6 pt-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {getVehicleCount(outsideWidget.id)}
                </span>
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  VEHICLES
                </span>
              </div>

              <div className="text-xs font-semibold text-amber-600 group-hover:text-amber-700 flex items-center gap-1">
                <span>View Fleet</span>
                <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Vehicle Logs Modal Dialog */}
      <Dialog open={!!selectedWidget} onOpenChange={(open) => !open && setSelectedWidget(null)}>
        <DialogContent className="max-w-4xl bg-white p-0 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl">
          {selectedWidget && (
            <div>
              {/* Modal Header */}
              <div className={cn(
                "p-6 border-b border-slate-100 flex items-start justify-between",
                selectedWidget.type === 'plant' ? "bg-gradient-to-r from-emerald-50/70 to-white" : "bg-gradient-to-r from-amber-50/70 to-white"
              )}>
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm",
                    selectedWidget.type === 'plant' ? "bg-emerald-100/60 border-emerald-200 text-emerald-700" : "bg-amber-100/60 border-amber-200 text-amber-700"
                  )}>
                    {selectedWidget.type === 'plant' ? <Building2 className="w-6 h-6" /> : <Navigation className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <DialogTitle className="text-lg font-bold text-slate-900">
                        {selectedWidget.name} - Real-Time Fleet ({activeWidgetLogs.length})
                      </DialogTitle>
                      <span className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                        selectedWidget.type === 'plant' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {selectedWidget.badgeText}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {selectedWidget.address}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {activeWidgetLogs.length}
                  </span>
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    Active Vehicles
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search vehicle, driver, route..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => {
                      setSelectedWidget(null);
                      router.push('/dashboard/wgsp24');
                    }}
                    className="h-8 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                    <span>Live GPS Map</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedWidget(null);
                      router.push('/dashboard/sf22');
                    }}
                    className="h-8 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Truck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>SF22 Registry</span>
                  </button>
                </div>
              </div>

              {/* Vehicle Logs Table */}
              <div className="max-h-[380px] overflow-y-auto">
                {activeWidgetLogs.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-4">Vehicle No</th>
                        <th className="py-2.5 px-4">Status & Speed</th>
                        <th className="py-2.5 px-4">Driver / Mobile</th>
                        <th className="py-2.5 px-4">Location / Distance</th>
                        <th className="py-2.5 px-4">GPS Time</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {activeWidgetLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <Truck className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-mono">{log.vehicleNo}</span>
                            </div>
                            {log.material && (
                              <span className="text-[10px] font-medium text-slate-400 block mt-0.5">
                                {log.material}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded",
                              log.status === 'RUNNING' ? "bg-emerald-100 text-emerald-800" :
                              log.status === 'IDLE' ? "bg-amber-100 text-amber-800" :
                              log.status === 'INSIDE PLANT' ? "bg-blue-100 text-blue-800" :
                              "bg-slate-100 text-slate-700"
                            )}>
                              {log.status}
                            </span>
                            {log.speed !== undefined && (
                              <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                                {log.speed} KM/H
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">{log.driverName || 'Designated Driver'}</div>
                            <div className="text-[10px] text-slate-400">{log.driverMobile || 'N/A'}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-[220px]">
                            <div className="font-medium text-slate-800 truncate">
                              {log.destination}
                            </div>
                            {log.route && (
                              <div className="text-[10px] text-slate-400 truncate">
                                {log.route}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{log.entryTimestamp || 'Just now'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedWidget(null);
                                  router.push(`/dashboard/wgsp24?vehicle=${encodeURIComponent(log.vehicleNo)}`);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                                title="Track live on GPS map"
                              >
                                <span>Track</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                              {selectedWidget?.type === 'plant' && (
                                <button
                                  onClick={() => {
                                    setSelectedWidget(null);
                                    router.push(
                                      `/dashboard/tr21?createTrip=1&vehicleNo=${encodeURIComponent(log.vehicleNo)}&plant=${encodeURIComponent(selectedWidget.code || selectedWidget.name)}`
                                    );
                                  }}
                                  className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition-colors"
                                  title="Create a trip plan in TR21 for this vehicle"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Trip Plan</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 px-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-700">
                        No vehicles currently detected inside {selectedWidget.name}
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Vehicles entering within the 200m geofence radius will automatically show here in real-time from SF22 & Wheelseye GPS telemetry.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedWidget(null);
                        router.push('/dashboard/sf22');
                      }}
                      className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-4"
                    >
                      View SF22 Fleet Registry →
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Synced with SF22 Fleet Registry & Wheelseye Live GPS
                </span>
                <button
                  onClick={() => setSelectedWidget(null)}
                  className="px-4 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
