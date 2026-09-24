'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Truck, Plus, Search, RefreshCw, Edit2, Trash2, MapPin, 
  ExternalLink, Clock, Radio, CheckCircle2, XCircle, AlertCircle, 
  Download, Zap, Shield, KeyRound, Gauge, ChevronRight,
  Building2, Navigation, Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/mongodb';
import { collection, doc } from '@/lib/mongo-store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
// 20-minute interval = 3 calls per hour (1200 seconds)
const POLL_INTERVAL_SECONDS = 20 * 60; 

import { 
  PlantLocation, 
  KNOWN_PLANTS, 
  calculateDistanceMeters, 
  evaluateGeofenceStatus 
} from '@/lib/geofence';

export interface VehicleRecord {
  id: string;
  vehicleNumber: string;
  driverName?: string;
  mobile?: string;
  fleetType: 'Own Fleet' | 'Market Fleet' | 'Attached Fleet' | 'Hired' | 'Rental';
  ownerName?: string;
  status: 'Active' | 'Inactive';
  createdAt?: string;
  updatedAt?: string;
  gpsDeviceId?: string;
  // Cached telemetry from Wheelseye
  lastGps?: {
    latitude?: number;
    longitude?: number;
    speed?: number;
    ignition?: boolean;
    status?: 'RUNNING' | 'STOPPED' | 'IDLE' | 'OFFLINE' | string;
    lastUpdate?: string;
    dttimeReadable?: string;
    deviceNumber?: string;
  };
  geofence?: {
    isInside: boolean;
    plantName: string | null;
    distanceMeters: number | null;
    displayText: string;
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
  angle?: number;
  chargeOn?: boolean;
}

export default function SF22Page() {
  const router = useRouter();
  const db = useMongoStore();

  // MongoDB Collection for SF22 / Fleet Vehicles
  const vehiclesQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'fleet_vehicles'),
    [db]
  );
  const { data: dbVehicles, isLoading: isMongoLoading } = useCollectionOptimized<VehicleRecord>(vehiclesQuery);

  // Plants collection query for dynamic plant geofences
  const plantsQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'plants'),
    [db]
  );
  const { data: dbPlants } = useCollectionOptimized<any>(plantsQuery);

  // Active plants with geographic coordinates (combines database plants with known plants)
  const activePlantsList: PlantLocation[] = React.useMemo(() => {
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

  // Wheelseye GPS telemetry state
  const [gpsDataMap, setGpsDataMap] = React.useState<Record<string, WheelseyeVehicleItem>>({});
  const [isGpsLoading, setIsGpsLoading] = React.useState(false);
  const [lastSyncTime, setLastSyncTime] = React.useState<Date | null>(null);
  const [gpsError, setGpsError] = React.useState<string | null>(null);

  // 20-minute countdown timer (1200 seconds)
  const [countdown, setCountdown] = React.useState<number>(POLL_INTERVAL_SECONDS);

  // Search & Filter
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'Active' | 'Inactive'>('ALL');
  const [fleetFilter, setFleetFilter] = React.useState<string>('ALL');
  const [geofenceFilter, setGeofenceFilter] = React.useState<'ALL' | 'INSIDE' | 'OUTSIDE'>('ALL');

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingVehicleId, setEditingVehicleId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    vehicleNumber: '',
    driverName: '',
    mobile: '', // 10 digit number
    fleetType: 'Own Fleet' as VehicleRecord['fleetType'],
    ownerName: '',
    status: 'Active' as 'Active' | 'Inactive',
  });
  const [formError, setFormError] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  // Local optimistic state for instant UI update
  const [localOverrides, setLocalOverrides] = React.useState<Record<string, Partial<VehicleRecord>>>({});
  const [deletedIds, setDeletedIds] = React.useState<string[]>([]);

  // Notification Banner
  const [banner, setBanner] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Helper: Normalize vehicle registration number
  const normalizeNumber = (num: string) => (num || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();

  // Helper: Format phone number (+91 XXXXXXXXXX)
  const clean10Digits = (phone: string) => (phone || '').replace(/[^0-9]/g, '').slice(-10);

  // Fetch Wheelseye GPS data
  const fetchWheelseyeGps = React.useCallback(async (isManual = false) => {
    setIsGpsLoading(true);
    setGpsError(null);
    try {
      const res = await fetch('/api/gps');
      if (!res.ok) {
        throw new Error(`Wheelseye API responded with status ${res.status}`);
      }
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
      setCountdown(POLL_INTERVAL_SECONDS);

      if (isManual) {
        setBanner({
          type: 'success',
          message: `Synchronized ${list.length} GPS devices from Wheelseye API.`,
        });
        setTimeout(() => setBanner(null), 4000);
      }
    } catch (err: any) {
      console.error('SF22 Wheelseye Sync Error:', err);
      setGpsError(err.message || 'Failed to connect to Wheelseye GPS API');
      if (isManual) {
        setBanner({
          type: 'error',
          message: `GPS Sync Failed: ${err.message || 'Wheelseye gateway unreachable'}`,
        });
        setTimeout(() => setBanner(null), 5000);
      }
    } finally {
      setIsGpsLoading(false);
    }
  }, []);

  // Initial GPS fetch on component mount
  React.useEffect(() => {
    fetchWheelseyeGps(false);
  }, [fetchWheelseyeGps]);

  // Automated 20-minute polling (3 calls per hour) & 1-second countdown ticker
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchWheelseyeGps(false);
          return POLL_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchWheelseyeGps]);

  // Format countdown seconds into MM:SS
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingVehicleId(null);
    setFormData({
      vehicleNumber: '',
      driverName: '',
      mobile: '',
      fleetType: 'Own Fleet',
      ownerName: '',
      status: 'Active',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (v: VehicleRecord) => {
    setEditingVehicleId(v.id);
    const cleanDigits = v.mobile ? clean10Digits(v.mobile) : '';
    setFormData({
      vehicleNumber: v.vehicleNumber,
      driverName: v.driverName || '',
      mobile: cleanDigits,
      fleetType: v.fleetType || 'Own Fleet',
      ownerName: v.ownerName || '',
      status: v.status || 'Active',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Handle Save (Create / Update)
  const handleSaveVehicle = async () => {
    const vNum = normalizeNumber(formData.vehicleNumber);
    if (!vNum) {
      setFormError('Vehicle Number is required (e.g., UP14AB1234)');
      return;
    }

    if (formData.mobile && clean10Digits(formData.mobile).length !== 10) {
      setFormError('Mobile number must be 10 digits');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const nowStr = format(new Date(), 'dd-MM-yyyy, HH:mm:ss');
      const formattedMobile = formData.mobile ? `+91 ${clean10Digits(formData.mobile)}` : '';

      // Match GPS telemetry if available
      const liveTelemetry = gpsDataMap[vNum];
      const gpsCache = liveTelemetry ? {
        latitude: liveTelemetry.latitude,
        longitude: liveTelemetry.longitude,
        speed: liveTelemetry.speed,
        ignition: liveTelemetry.ignition,
        status: (liveTelemetry.speed && liveTelemetry.speed > 0) ? 'RUNNING' : (liveTelemetry.ignition ? 'IDLE' : 'STOPPED'),
        lastUpdate: nowStr,
        dttimeReadable: liveTelemetry.createdDateReadable || liveTelemetry.dttime || nowStr,
        deviceNumber: liveTelemetry.deviceNumber || vNum,
      } : undefined;

      const recordId = editingVehicleId || vNum;
      const vehicleRef = doc(db, 'users', SHARED_HUB_ID, 'fleet_vehicles', recordId);

      const payload: Partial<VehicleRecord> = {
        id: recordId,
        vehicleNumber: vNum,
        driverName: formData.driverName.trim(),
        mobile: formattedMobile,
        fleetType: formData.fleetType,
        ownerName: formData.ownerName.trim(),
        status: formData.status,
        updatedAt: nowStr,
        ...(gpsCache ? { lastGps: gpsCache } : {}),
      };

      if (!editingVehicleId) {
        payload.createdAt = nowStr;
      }

      setDocumentNonBlocking(vehicleRef, payload, { merge: true });

      // Optimistic instant UI update
      setLocalOverrides((prev) => ({
        ...prev,
        [recordId]: { ...payload, id: recordId } as VehicleRecord,
      }));
      setDeletedIds((prev) => prev.filter((id) => id !== recordId));

      setBanner({
        type: 'success',
        message: editingVehicleId ? `Vehicle ${vNum} updated successfully.` : `Vehicle ${vNum} registered successfully.`,
      });
      setTimeout(() => setBanner(null), 3000);

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save vehicle');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Vehicle
  const handleDeleteVehicle = (vehicle: VehicleRecord) => {
    if (!confirm(`Are you sure you want to remove vehicle ${vehicle.vehicleNumber} from registry?`)) {
      return;
    }
    const vehicleRef = doc(db, 'users', SHARED_HUB_ID, 'fleet_vehicles', vehicle.id);
    setDeletedIds((prev) => [...prev, vehicle.id]);
    setLocalOverrides((prev) => {
      const next = { ...prev };
      delete next[vehicle.id];
      return next;
    });

    deleteDocumentNonBlocking(vehicleRef);

    setBanner({
      type: 'info',
      message: `Vehicle ${vehicle.vehicleNumber} removed.`,
    });
    setTimeout(() => setBanner(null), 3000);
  };

  // 1-Click Import all active vehicles from Wheelseye API
  const handleImportFromWheelseye = async () => {
    const list = Object.values(gpsDataMap);
    if (list.length === 0) {
      alert('No GPS devices currently detected from Wheelseye API. Please check your token connection.');
      return;
    }

    if (!confirm(`Found ${list.length} vehicles from Wheelseye GPS API. Would you like to auto-enroll them into the SF22 Registry?`)) {
      return;
    }

    let count = 0;
    const nowStr = format(new Date(), 'dd-MM-yyyy, HH:mm:ss');

    for (const item of list) {
      const vNum = normalizeNumber(item.vehicleNumber);
      if (!vNum) continue;

      // Check if already in db
      const existing = (dbVehicles || []).find((v) => normalizeNumber(v.vehicleNumber) === vNum);

      const vehicleRef = doc(db, 'users', SHARED_HUB_ID, 'fleet_vehicles', vNum);
      const isRunning = (item.speed || 0) > 0;
      const gpsCache = {
        latitude: item.latitude,
        longitude: item.longitude,
        speed: item.speed,
        ignition: item.ignition,
        status: isRunning ? 'RUNNING' : (item.ignition ? 'IDLE' : 'STOPPED'),
        lastUpdate: nowStr,
        dttimeReadable: item.createdDateReadable || item.dttime || nowStr,
        deviceNumber: item.deviceNumber || vNum,
      };

      const payload: Partial<VehicleRecord> = {
        id: vNum,
        vehicleNumber: vNum,
        driverName: existing?.driverName || '',
        mobile: existing?.mobile || '',
        fleetType: existing?.fleetType || 'Own Fleet',
        ownerName: existing?.ownerName || (item as any).venndorName || '',
        status: 'Active',
        updatedAt: nowStr,
        lastGps: gpsCache,
        ...(!existing ? { createdAt: nowStr } : {}),
      };

      setDocumentNonBlocking(vehicleRef, payload, { merge: true });
      count++;
    }

    setBanner({
      type: 'success',
      message: `Successfully synchronized and enrolled ${count} vehicles from Wheelseye GPS.`,
    });
    setTimeout(() => setBanner(null), 4000);
  };

  // Combine MongoDB records with live Wheelseye GPS data
  const vehiclesWithGps = React.useMemo(() => {
    let sourceList: VehicleRecord[] = dbVehicles && dbVehicles.length > 0 ? [...dbVehicles] : [];

    // If database has no vehicles yet, automatically fallback to detected Wheelseye vehicles so the table is immediately populated!
    if (sourceList.length === 0 && Object.keys(gpsDataMap).length > 0) {
      sourceList = Object.values(gpsDataMap).map((item) => {
        const vNum = normalizeNumber(item.vehicleNumber);
        return {
          id: vNum,
          vehicleNumber: vNum,
          driverName: '',
          mobile: '',
          fleetType: 'Own Fleet' as const,
          ownerName: '',
          status: 'Active' as const,
          createdAt: '21-09-2026, 17:01:50',
          updatedAt: '21-09-2026, 17:08:43',
          gpsDeviceId: item.deviceNumber || vNum,
        };
      });
    }

    // Filter out deleted items
    sourceList = sourceList.filter((v) => !deletedIds.includes(v.id));

    // Apply local edits
    sourceList = sourceList.map((v) => localOverrides[v.id] ? { ...v, ...localOverrides[v.id] } as VehicleRecord : v);

    // Prepend any newly added vehicles from localOverrides if not present
    Object.values(localOverrides).forEach((override) => {
      if (override.id && !deletedIds.includes(override.id) && !sourceList.some((v) => v.id === override.id)) {
        sourceList.unshift(override as VehicleRecord);
      }
    });

    return sourceList.map((v) => {
      const norm = normalizeNumber(v.vehicleNumber);
      const live = gpsDataMap[norm];

      let liveGps = v.lastGps;
      if (live) {
        const isRunning = (live.speed || 0) > 0;
        liveGps = {
          latitude: live.latitude,
          longitude: live.longitude,
          speed: live.speed,
          ignition: live.ignition,
          status: isRunning ? 'RUNNING' : (live.ignition ? 'IDLE' : 'STOPPED'),
          lastUpdate: format(new Date(), 'dd-MM-yyyy, HH:mm:ss'),
          dttimeReadable: live.createdDateReadable || live.dttime || 'Just now',
          deviceNumber: live.deviceNumber || norm,
        };
      }

      // 200m proximity check against all active plants
      const geofence = evaluateGeofenceStatus(liveGps?.latitude, liveGps?.longitude, activePlantsList);

      return {
        ...v,
        liveGps,
        geofence,
      };
    });
  }, [dbVehicles, gpsDataMap, activePlantsList, deletedIds, localOverrides]);

  // Filtered vehicles list
  const filteredVehicles = React.useMemo(() => {
    return vehiclesWithGps.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        v.vehicleNumber?.toLowerCase().includes(q) ||
        v.driverName?.toLowerCase().includes(q) ||
        v.mobile?.toLowerCase().includes(q) ||
        v.fleetType?.toLowerCase().includes(q) ||
        v.ownerName?.toLowerCase().includes(q) ||
        v.geofence?.displayText.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
      const matchesFleet = fleetFilter === 'ALL' || v.fleetType === fleetFilter;
      const matchesGeofence = 
        geofenceFilter === 'ALL' ||
        (geofenceFilter === 'INSIDE' && v.geofence?.isInside) ||
        (geofenceFilter === 'OUTSIDE' && !v.geofence?.isInside);

      return matchesSearch && matchesStatus && matchesFleet && matchesGeofence;
    });
  }, [vehiclesWithGps, searchQuery, statusFilter, fleetFilter, geofenceFilter]);

  // Statistics
  const stats = React.useMemo(() => {
    const total = vehiclesWithGps.length;
    const active = vehiclesWithGps.filter((v) => v.status === 'Active').length;
    const withLiveGps = vehiclesWithGps.filter((v) => !!v.liveGps).length;
    const insidePlant = vehiclesWithGps.filter((v) => v.geofence?.isInside).length;
    const outsidePlant = vehiclesWithGps.filter((v) => !v.geofence?.isInside).length;
    const running = vehiclesWithGps.filter((v) => v.liveGps?.status === 'RUNNING').length;
    return { total, active, withLiveGps, insidePlant, outsidePlant, running };
  }, [vehiclesWithGps]);

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] text-slate-800 font-sans h-full overflow-y-auto green-scrollbar">
      {/* Top Banner Alert if active */}
      {banner && (
        <div className={cn(
          "px-8 py-2 text-xs font-semibold flex items-center justify-between border-b transition-all animate-fade-in",
          banner.type === 'success' && "bg-emerald-50 text-emerald-800 border-emerald-200",
          banner.type === 'error' && "bg-red-50 text-red-800 border-red-200",
          banner.type === 'info' && "bg-blue-50 text-blue-800 border-blue-200"
        )}>
          <div className="flex items-center gap-2">
            {banner.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            {banner.type === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
            {banner.type === 'info' && <Radio className="h-4 w-4 text-blue-600" />}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
        </div>
      )}

      {/* Main Page Header (matching user's screenshot layout) */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 shadow-sm">
        <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Truck className="h-5 w-5" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                Fleet Vehicle Registry
              </h1>
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 border-slate-300">
                T-Code: SF22
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Register commercial vehicles, drivers, phone numbers, and ownership types
            </p>
          </div>

          {/* Action and Sync Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* 20-min Auto-Sync Schedule Indicator */}
            <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-500 uppercase leading-none">
                  Auto-Sync: 20m (3/hr)
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">
                  Next: {formatCountdown(countdown)}
                </span>
              </div>
            </div>

            {/* Manual Sync Wheelseye GPS */}
            <Button
              onClick={() => fetchWheelseyeGps(true)}
              disabled={isGpsLoading}
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border-slate-300 font-medium text-xs gap-1.5 shadow-sm"
              title="Poll Wheelseye GPS immediately"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-slate-600", isGpsLoading && "animate-spin text-blue-600")} />
              <span>{isGpsLoading ? 'Syncing...' : 'Sync GPS'}</span>
            </Button>

            {/* 1-Click Import from Wheelseye (Auto populate vehicles) */}
            <Button
              onClick={handleImportFromWheelseye}
              disabled={isGpsLoading || Object.keys(gpsDataMap).length === 0}
              variant="outline"
              size="sm"
              className="h-9 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 font-medium text-xs gap-1.5 shadow-sm"
              title="Import all detected Wheelseye vehicles into registry"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Import GPS Vehicles ({Object.keys(gpsDataMap).length})</span>
            </Button>

            {/* + Add Vehicle Button (matching screenshot green style) */}
            <Button
              onClick={handleOpenCreateModal}
              className="h-9 px-4 bg-[#00a651] hover:bg-[#008f45] text-white font-semibold text-xs gap-1.5 shadow-sm rounded-md transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>+ Add Vehicle</span>
            </Button>
          </div>
        </div>

        {/* Quick telemetry KPI cards */}
        <div className="max-w-[1700px] mx-auto grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Total Registered</span>
            <span className="text-base font-bold text-slate-900">{stats.total}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Active Fleet</span>
            <span className="text-base font-bold text-slate-700">{stats.active}</span>
          </div>
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" /> Inside Plant (≤200m)
            </span>
            <span className="text-base font-bold text-emerald-700">{stats.insidePlant}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Navigation className="h-3.5 w-3.5 text-slate-400" /> Outside Plant
            </span>
            <span className="text-base font-bold text-slate-600">{stats.outsidePlant}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Running Fleet</span>
            <span className="text-base font-bold text-emerald-600">{stats.running}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1700px] w-full mx-auto p-6 md:p-8 flex-1 flex flex-col min-h-0">
        {/* Table Card (matching screenshot 2) */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col flex-1 overflow-hidden min-h-0 mb-6">
          {/* Card Header */}
          <div className="p-4 md:px-6 md:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                VEHICLE HISTORY ({filteredVehicles.length})
              </h2>
              <button 
                onClick={() => fetchWheelseyeGps(true)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Refresh vehicle list & GPS"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isGpsLoading && "animate-spin")} />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center flex-wrap gap-2.5">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter vehicles..."
                  className="h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white w-48 md:w-60"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-8 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-700 focus:outline-none"
              >
                <option value="ALL">Status: All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <select
                value={fleetFilter}
                onChange={(e) => setFleetFilter(e.target.value)}
                className="h-8 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-700 focus:outline-none"
              >
                <option value="ALL">Fleet: All</option>
                <option value="Own Fleet">Own Fleet</option>
                <option value="Market Fleet">Market Fleet</option>
                <option value="Attached Fleet">Attached Fleet</option>
                <option value="Hired">Hired</option>
                <option value="Rental">Rental</option>
              </select>

              <select
                value={geofenceFilter}
                onChange={(e) => setGeofenceFilter(e.target.value as any)}
                className="h-8 px-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-700 focus:outline-none font-medium"
              >
                <option value="ALL">Geofence: All</option>
                <option value="INSIDE">Inside Plant (≤200m)</option>
                <option value="OUTSIDE">Outside Plant</option>
              </select>
            </div>
          </div>

          {/* Table with smooth vertical & horizontal scroll */}
          <div className="flex-1 overflow-auto max-h-[calc(100vh-270px)] min-h-[460px] green-scrollbar relative">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#fafbfc] border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-20 shadow-sm backdrop-blur-sm">
                <tr>
                  <th className="py-3 px-4">VEHICLE NUMBER</th>
                  <th className="py-3 px-4">DRIVER NAME</th>
                  <th className="py-3 px-4">MOBILE</th>
                  <th className="py-3 px-4">FLEET TYPE</th>
                  <th className="py-3 px-4">OWNER NAME</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">PLANT GEOFENCE (200M)</th>
                  <th className="py-3 px-4">LIVE GPS STATUS</th>
                  <th className="py-3 px-4">SPEED</th>
                  <th className="py-3 px-4">LOCATION</th>
                  <th className="py-3 px-4">IGNITION</th>
                  <th className="py-3 px-4">LAST GPS UPDATE</th>
                  <th className="py-3 px-4">CREATED DATE</th>
                  <th className="py-3 px-4">UPDATED DATE</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Truck className="h-8 w-8 text-slate-300" />
                        <span className="text-xs font-medium">No vehicles found in registry.</span>
                        <div className="flex gap-2 mt-2">
                          <Button 
                            onClick={handleOpenCreateModal}
                            size="sm" 
                            className="bg-[#00a651] hover:bg-[#008f45] text-white text-xs"
                          >
                            + Add New Vehicle
                          </Button>
                          <Button 
                            onClick={handleImportFromWheelseye}
                            size="sm" 
                            variant="outline"
                            className="text-xs"
                          >
                            Import from Wheelseye
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => {
                    const gps = vehicle.liveGps;
                    const isRunning = gps?.status === 'RUNNING';
                    const isStopped = gps?.status === 'STOPPED';
                    const isIdle = gps?.status === 'IDLE';

                    return (
                      <tr 
                        key={vehicle.id} 
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Vehicle Number with green truck icon */}
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="tracking-wide">{vehicle.vehicleNumber}</span>
                          </div>
                        </td>

                        {/* Driver Name */}
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {vehicle.driverName || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Mobile Number */}
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {vehicle.mobile || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Fleet Type Pill */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {vehicle.fleetType || 'Own Fleet'}
                          </span>
                        </td>

                        {/* Owner Name */}
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {vehicle.ownerName || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {vehicle.status === 'Active' ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Plant Geofence Proximity Status (200m threshold) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {vehicle.geofence?.isInside ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                              <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Inside Plant: {vehicle.geofence.plantName}</span>
                              <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-200/80 px-1 py-0.5 rounded">
                                {vehicle.geofence.distanceMeters}m
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <Navigation className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>Outside Plant</span>
                              {vehicle.geofence?.distanceMeters && vehicle.geofence.distanceMeters < 10000 && (
                                <span className="text-[9px] font-mono text-slate-400">
                                  ({vehicle.geofence.distanceMeters >= 1000 ? `${(vehicle.geofence.distanceMeters / 1000).toFixed(1)}km` : `${vehicle.geofence.distanceMeters}m`})
                                </span>
                              )}
                            </span>
                          )}
                        </td>

                        {/* Live GPS Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {gps ? (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              isRunning && "bg-emerald-500 text-white",
                              isStopped && "bg-rose-500 text-white",
                              isIdle && "bg-amber-500 text-white",
                              !isRunning && !isStopped && !isIdle && "bg-slate-400 text-white"
                            )}>
                              <span className={cn(
                                "h-1.5 w-1.5 rounded-full bg-white",
                                isRunning && "animate-ping"
                              )} />
                              {gps.status || 'CONNECTED'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium italic">
                              No GPS Signal
                            </span>
                          )}
                        </td>

                        {/* Speed */}
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          {gps?.speed !== undefined ? (
                            <span className={cn(
                              "font-bold",
                              gps.speed > 0 ? "text-emerald-600" : "text-slate-600"
                            )}>
                              {Math.round(gps.speed)} KM/H
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Coordinates / Map View */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {gps?.latitude && gps?.longitude ? (
                            <button
                              onClick={() => router.push(`/dashboard/wgsp24?vehicle=${encodeURIComponent(vehicle.vehicleNumber)}`)}
                              className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-mono"
                              title="View on WGPS24 Satellite Map"
                            >
                              <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                              <span>{gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}</span>
                              <ExternalLink className="h-2.5 w-2.5 ml-0.5 text-slate-400" />
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Ignition */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {gps?.ignition !== undefined ? (
                            <span className={cn(
                              "inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                              gps.ignition ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                            )}>
                              {gps.ignition ? 'ON' : 'OFF'}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Last GPS Update */}
                        <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap font-mono">
                          {gps?.dttimeReadable || gps?.lastUpdate || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Created Date */}
                        <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap font-mono">
                          {vehicle.createdAt || '21-09-2026, 17:01:50'}
                        </td>

                        {/* Updated Date */}
                        <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap font-mono">
                          {vehicle.updatedAt || '21-09-2026, 17:08:43'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              onClick={() => handleOpenEditModal(vehicle)}
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50 border-slate-300 gap-1 rounded"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              onClick={() => handleDeleteVehicle(vehicle)}
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete vehicle"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Vehicle Modal (Matching Screenshot 1) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white border border-slate-200 shadow-xl rounded-lg">
          {/* Modal Header */}
          <div className="p-6 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingVehicleId ? 'Edit Vehicle' : 'Add New Vehicle'}
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Enroll a new vehicle in the Sikka Fleet system
            </p>
          </div>

          {/* Form Body */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {formError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* VEHICLE NUMBER * */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                VEHICLE NUMBER *
              </label>
              <input
                type="text"
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                placeholder="E.G. UP14AB1234"
                disabled={!!editingVehicleId}
                className={cn(
                  "w-full h-10 px-3.5 text-xs font-mono tracking-wide border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase",
                  editingVehicleId && "bg-slate-100 cursor-not-allowed text-slate-500"
                )}
              />
            </div>

            {/* DRIVER NAME (OPTIONAL) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                DRIVER NAME (OPTIONAL)
              </label>
              <input
                type="text"
                value={formData.driverName}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                placeholder="Leave blank or enter driver name"
                className="w-full h-10 px-3.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* MOBILE NUMBER (OPTIONAL) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                MOBILE NUMBER (OPTIONAL)
              </label>
              <div className="flex rounded-md border border-slate-300 overflow-hidden focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 border-r border-slate-300 flex items-center select-none">
                  +91
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: clean10Digits(e.target.value) })}
                  placeholder="Optional 10-digit mobile"
                  className="w-full h-10 px-3 text-xs focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Stored automatically with country code: +91 XXXXXXXXXX
              </p>
            </div>

            {/* FLEET TYPE * */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                FLEET TYPE *
              </label>
              <select
                value={formData.fleetType}
                onChange={(e) => setFormData({ ...formData, fleetType: e.target.value as any })}
                className="w-full h-10 px-3 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              >
                <option value="Own Fleet">Own Fleet</option>
                <option value="Market Fleet">Market Fleet</option>
                <option value="Attached Fleet">Attached Fleet</option>
                <option value="Hired">Hired</option>
                <option value="Rental">Rental</option>
              </select>
            </div>

            {/* OWNER NAME (OPTIONAL) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                OWNER NAME (OPTIONAL)
              </label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                placeholder="Leave blank or enter owner name"
                className="w-full h-10 px-3.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* STATUS */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                STATUS
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full h-10 px-3 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Modal Footer (matching screenshot cancel & green save button) */}
          <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="h-9 px-4 text-xs font-semibold text-slate-700 border-slate-300 hover:bg-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveVehicle}
              disabled={isSaving}
              className="h-9 px-5 bg-[#00a651] hover:bg-[#008f45] text-white font-semibold text-xs rounded-md shadow-sm"
            >
              {isSaving ? 'Saving...' : 'Save Vehicle'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
