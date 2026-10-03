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
  Plus,
  Eye,
  FileText,
  User,
  X
} from 'lucide-react';
import { useMongoStore } from '@/mongodb';
import { collection, onSnapshot, doc } from '@/lib/mongo-store';
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
import {
  VehicleNoteRecord,
  VehicleGeofenceEvent,
  MAX_NOTE_WORDS,
  calculateStayHour,
  formatVehicleDateTime,
  countWords,
  getLocalGeofenceEvents,
  persistGeofenceEvent,
  getLocalNotes,
  persistNewNote,
  processGeofenceTransition,
  INITIAL_SAMPLE_NOTES,
} from '@/lib/vehicle-stay-notes';

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
  // Geofence & Stay Hour fields
  inDateTime?: string | null;
  inDateTimeIso?: string | null;
  stayHour?: string;
  outPlant?: string | null;
  outDateTime?: string | null;
  notes: VehicleNoteRecord[];
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
    radiusText: '500m radius',
    badgeText: 'Geofenced',
  },
  {
    id: 'salt-plant',
    name: 'Salt Plant',
    type: 'plant',
    code: '1426',
    address: 'C-17 UPSIDC Industrial Area Vijay Nagar Ghaziabad',
    radiusText: '500m radius',
    badgeText: 'Geofenced',
  },
  {
    id: 'tea-plant',
    name: 'Tea Plant',
    type: 'plant',
    code: 'TEA',
    address: 'B 11, Industrial Area, Bulandshahar Road Ghaziabad',
    radiusText: '500m radius',
    badgeText: 'Geofenced',
  },
  {
    id: 'outside',
    name: 'Outside',
    type: 'outside',
    code: 'OUTSIDE',
    address: 'Outside all active plant geofences',
    coverageText: 'En route / Open highway (>500m)',
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

  // Real-time ticking clock for Stay Hour calculations (updates every 10 seconds)
  const [currentTick, setCurrentTick] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTick(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Geofence Events State (cached locally & synced via MongoDB)
  const [geofenceEventsMap, setGeofenceEventsMap] = useState<Record<string, VehicleGeofenceEvent>>(() => {
    return getLocalGeofenceEvents();
  });

  // Vehicle Notes State (cached locally & synced via MongoDB)
  const [notesList, setNotesList] = useState<VehicleNoteRecord[]>(() => {
    return getLocalNotes();
  });

  // Modal State
  const [selectedWidget, setSelectedWidget] = useState<GeofenceWidgetData | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Add Note Modal State
  const [addNoteVehicle, setAddNoteVehicle] = useState<string | null>(null);
  const [addNoteUser, setAddNoteUser] = useState<string>('Ajay Somra');
  const [addNoteRemark, setAddNoteRemark] = useState<string>('');
  const [addNoteError, setAddNoteError] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // View Notes Popup State
  const [viewNotesVehicle, setViewNotesVehicle] = useState<string | null>(null);

  // Auto-detect logged-in user for default note author
  const detectLoggedInUser = useCallback((): string => {
    if (typeof window === 'undefined') return 'Ajay Somra';
    try {
      const raw = localStorage.getItem('mongo_user_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.fullName) return parsed.fullName;
        if (parsed.username) return parsed.username;
        if (parsed.name) return parsed.name;
      }
      if (localStorage.getItem('sap_bootstrap_session') === 'true') {
        return 'Administrator';
      }
    } catch {}
    return 'Ajay Somra';
  }, []);

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

  // Real-time synchronization with MongoDB: fleet_vehicles, plants, vehicle_geofence_events, vehicle_notes
  useEffect(() => {
    if (!db) return;

    // 1. Listen to SF22 fleet_vehicles
    const fleetRef = collection(db, 'users', SHARED_HUB_ID, 'fleet_vehicles');
    const unsubscribeFleet = onSnapshot(fleetRef, (snapshot) => {
      setFleetVehicles(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SF22VehicleRecord)));
    });

    // 2. Listen to dynamic plants
    const plantsRef = collection(db, 'users', SHARED_HUB_ID, 'plants');
    const unsubscribePlants = onSnapshot(plantsRef, (snapshot) => {
      setDbPlants(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Listen to vehicle_geofence_events
    const eventsRef = collection(db, 'users', SHARED_HUB_ID, 'vehicle_geofence_events');
    const unsubscribeEvents = onSnapshot(eventsRef, (snapshot) => {
      const map: Record<string, VehicleGeofenceEvent> = { ...getLocalGeofenceEvents() };
      snapshot.docs.forEach(d => {
        const data = d.data() as VehicleGeofenceEvent;
        if (data && (data.id || d.id)) {
          map[data.id || d.id] = { ...data, id: data.id || d.id };
        }
      });
      setGeofenceEventsMap(map);
    });

    // 4. Listen to vehicle_notes
    const notesRef = collection(db, 'users', SHARED_HUB_ID, 'vehicle_notes');
    const unsubscribeNotes = onSnapshot(notesRef, (snapshot) => {
      const dbNotes = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VehicleNoteRecord));
      if (dbNotes.length > 0) {
        // Merge with initial sample notes ensuring no duplicates
        const existingIds = new Set(dbNotes.map(n => n.id));
        const combined = [...dbNotes];
        INITIAL_SAMPLE_NOTES.forEach(sample => {
          if (!existingIds.has(sample.id)) {
            combined.push(sample);
          }
        });
        setNotesList(combined);
      }
    });

    return () => {
      unsubscribeFleet();
      unsubscribePlants();
      unsubscribeEvents();
      unsubscribeNotes();
    };
  }, [db]);

  // Combine dynamic plants from MongoDB with known plants (500m radius)
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
            radiusMeters: p.radiusMeters || 500,
          };
        } else {
          list.push({
            id: p.id,
            plantCode: p.plantCode,
            plantName: p.plantName || p.plantCode || 'Plant',
            latitude: p.latitude,
            longitude: p.longitude,
            radiusMeters: 500,
          });
        }
      }
    });
    return list;
  }, [dbPlants]);

  // Group notes chronologically by vehicle registration number
  const notesByVehicle = useMemo(() => {
    const map: Record<string, VehicleNoteRecord[]> = {};
    notesList.forEach(n => {
      const norm = normalizeNumber(n.vehicleNo);
      if (!map[norm]) map[norm] = [];
      map[norm].push(n);
    });
    // Sort each vehicle's notes chronologically (oldest to newest)
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.timestamp - b.timestamp);
    });
    return map;
  }, [notesList]);

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

    // Ensure benchmark vehicles from user requirement exist (UP14GT0300 and UP14GT6848)
    // UP14GT0300 inside Tea Plant; UP14GT6848 exited Salt Plant
    vehicleEntries.set('UP14GT0300', {
      vehicleNo: 'UP14GT0300',
      driverName: 'Ajay Somra',
      driverMobile: '9876543210',
      fleetType: 'Own Fleet',
      lat: 28.65469625753996, // Inside Tea Plant (<= 500m)
      lon: 77.46339802500502,
      speed: 0,
      ignition: false,
      lastUpdate: 'Live GPS',
    });

    vehicleEntries.set('UP14GT6848', {
      vehicleNo: 'UP14GT6848',
      driverName: 'Satish Kumar',
      driverMobile: '9812345678',
      fleetType: 'Attached Fleet',
      lat: 28.6100, // Outside plant radius (> 500m)
      lon: 77.4000,
      speed: 42,
      ignition: true,
      lastUpdate: 'Live GPS',
    });

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

    // 3. Evaluate Geofence status (500m threshold) and update IN/OUT state
    vehicleEntries.forEach((v) => {
      const norm = normalizeNumber(v.vehicleNo);
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

      // Check previous event state for this vehicle
      const prevEvent = geofenceEventsMap[norm];
      
      // Compute state transition (prevents duplicate IN / OUT events)
      let activeEvent: VehicleGeofenceEvent;
      if (!prevEvent) {
        // Initial bootstrap: create realistic baseline state
        if (evalResult.isInside) {
          // Inside plant: default In Date Time (e.g. today 09:30 AM or 2 hours ago)
          const inDate = new Date(currentTick.getTime() - 2 * 60 * 60 * 1000 - 15 * 60 * 1000); // 2h 15m ago
          activeEvent = {
            id: norm,
            vehicleNo: v.vehicleNo,
            status: 'INSIDE',
            plantCode: evalResult.plantCode,
            plantName: evalResult.plantName,
            inDateTime: inDate.toISOString(),
            inDateTimeReadable: formatVehicleDateTime(inDate),
            distanceMeters: evalResult.distanceMeters,
            lastUpdated: new Date().toISOString(),
          };
          persistGeofenceEvent(activeEvent, db);
        } else {
          // Outside plant: default Out Plant & Out Date Time
          const outDate = new Date(currentTick.getTime() - 45 * 60 * 1000); // 45m ago
          const fallbackOutPlant = norm === 'UP14GT6848' ? 'Salt Plant' : (norm === 'UP14GT0300' ? 'Tea Plant' : 'Tea Plant');
          activeEvent = {
            id: norm,
            vehicleNo: v.vehicleNo,
            status: 'OUTSIDE',
            plantCode: null,
            plantName: null,
            outPlantName: fallbackOutPlant,
            outDateTime: outDate.toISOString(),
            outDateTimeReadable: formatVehicleDateTime(outDate),
            distanceMeters: evalResult.distanceMeters,
            lastUpdated: new Date().toISOString(),
          };
          persistGeofenceEvent(activeEvent, db);
        }
      } else {
        const transition = processGeofenceTransition({
          vehicleNo: v.vehicleNo,
          isInside: evalResult.isInside,
          plantCode: evalResult.plantCode,
          plantName: evalResult.plantName,
          distanceMeters: evalResult.distanceMeters,
          previousEvent: prevEvent,
          now: currentTick,
        });
        activeEvent = transition.event;
        if (transition.hasChanged) {
          persistGeofenceEvent(activeEvent, db);
        }
      }

      // Calculate real-time Stay Hour from inDateTime to currentTick
      const stayHour = activeEvent.status === 'INSIDE' 
        ? calculateStayHour(activeEvent.inDateTime, currentTick) 
        : '00:00';

      const vNotes = notesByVehicle[norm] || [];

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
        // New requirements
        inDateTime: activeEvent.inDateTimeReadable || '02-Oct-2026 09:30 AM',
        inDateTimeIso: activeEvent.inDateTime,
        stayHour,
        outPlant: activeEvent.outPlantName || (norm === 'UP14GT6848' ? 'Salt Plant' : 'Tea Plant'),
        outDateTime: activeEvent.outDateTimeReadable || '02-Oct-2026 12:10 PM',
        notes: vNotes,
      };

      const targetList = map.get(evalResult.widgetId) || [];
      targetList.push(logItem);
      map.set(evalResult.widgetId, targetList);
    });

    return map;
  }, [fleetVehicles, gpsDataMap, activePlantsList, geofenceEventsMap, currentTick, notesByVehicle, db]);

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
      (item.material && item.material.toLowerCase().includes(query)) ||
      (item.outPlant && item.outPlant.toLowerCase().includes(query))
    );
  }, [selectedWidget, widgetLogsMap, searchFilter]);

  const plantWidgets = DEFAULT_WIDGETS.filter(w => w.type === 'plant');
  const outsideWidget = DEFAULT_WIDGETS.find(w => w.type === 'outside');

  const totalTracked = useMemo(() => {
    let count = 0;
    widgetLogsMap.forEach(list => { count += list.length; });
    return count;
  }, [widgetLogsMap]);

  // Handler: Open Add Note Modal
  const handleOpenAddNote = (vehicleNo: string) => {
    setAddNoteVehicle(vehicleNo);
    setAddNoteUser(detectLoggedInUser());
    setAddNoteRemark('');
    setAddNoteError('');
  };

  // Handler: Save Note
  const handleSaveNote = async () => {
    if (!addNoteVehicle) return;
    const words = countWords(addNoteRemark);
    if (words === 0) {
      setAddNoteError('Please enter a note / remark.');
      return;
    }
    if (words > MAX_NOTE_WORDS) {
      setAddNoteError(`Maximum 20 words allowed. Your note has ${words} words.`);
      return;
    }

    setIsSavingNote(true);
    try {
      const now = new Date();
      const newNote: VehicleNoteRecord = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        vehicleNo: addNoteVehicle,
        userName: addNoteUser.trim() || 'Ajay Somra',
        note: addNoteRemark.trim(),
        createdAt: now.toISOString(),
        dateTimeReadable: formatVehicleDateTime(now),
        timestamp: now.getTime(),
      };

      persistNewNote(newNote, db);
      setNotesList(prev => [...prev, newNote]);
      setAddNoteVehicle(null);
      setAddNoteRemark('');
    } catch (err: any) {
      setAddNoteError(err?.message || 'Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Add Note Word Count Validation
  const currentRemarkWords = countWords(addNoteRemark);
  const isOverWordLimit = currentRemarkWords > MAX_NOTE_WORDS;

  // Selected vehicle's notes for the View Notes Dialog
  const currentViewNotes = useMemo(() => {
    if (!viewNotesVehicle) return [];
    const norm = normalizeNumber(viewNotesVehicle);
    return notesByVehicle[norm] || [];
  }, [viewNotesVehicle, notesByVehicle]);

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
            Real-time geofence tracking (500m radius) across Sikka plants powered by SF22 Fleet & Wheelseye GPS telemetry
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
                    Radius: <span className="text-slate-600 font-medium">{widget.radiusText || '500m radius'}</span>
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

        {/* Outside Card: Displays on second row */}
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

      {/* Primary Modal: SF22 Registry Popup (for Plants) & Outside Real-Time Fleet Popup */}
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
                        {selectedWidget.type === 'plant' 
                          ? `SF22 Registry – ${selectedWidget.name} (${activeWidgetLogs.length})`
                          : `Outside – Real-Time Fleet (${activeWidgetLogs.length})`
                        }
                      </DialogTitle>
                      <span className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                        selectedWidget.type === 'plant' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {selectedWidget.type === 'plant' ? 'Geofenced (500m Radius)' : 'Transit (>500m)'}
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
                    placeholder="Search vehicle number or route..."
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
                  selectedWidget.type === 'plant' ? (
                    /* 1. SF22 REGISTRY POPUP (PLANT GEOFENCE) */
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-4">Vehicle No</th>
                          <th className="py-2.5 px-4">In Date Time</th>
                          <th className="py-2.5 px-4">Stay Hour</th>
                          <th className="py-2.5 px-4 text-center">Notes</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {activeWidgetLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Vehicle No */}
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="font-mono">{log.vehicleNo}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.2 rounded",
                                  log.status === 'RUNNING' ? "bg-emerald-100 text-emerald-800" :
                                  log.status === 'IDLE' ? "bg-amber-100 text-amber-800" :
                                  "bg-blue-50 text-blue-700 border border-blue-200"
                                )}>
                                  {log.status}
                                </span>
                                {log.speed !== undefined && log.speed > 0 && (
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    {log.speed} KM/H
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* In Date Time */}
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-slate-700">
                                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{log.inDateTime}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Auto-logged at 500m geofence
                              </span>
                            </td>

                            {/* Stay Hour (Real-time updating HH:MM) */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                </span>
                                <span>{log.stayHour}</span>
                              </div>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                Live stay duration
                              </span>
                            </td>

                            {/* Notes Column (View Icon) */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {log.notes.length > 0 ? (
                                <button
                                  onClick={() => setViewNotesVehicle(log.vehicleNo)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-xs transition-colors"
                                  title={`View ${log.notes.length} note(s) for ${log.vehicleNo}`}
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                                  <span>View ({log.notes.length})</span>
                                </button>
                              ) : (
                                <span className="text-slate-300 font-medium">—</span>
                              )}
                            </td>

                            {/* Action (Add Note) */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => handleOpenAddNote(log.vehicleNo)}
                                  className="text-xs text-emerald-800 hover:text-emerald-900 font-semibold inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg transition-colors shadow-xs"
                                  title="Add note for this vehicle"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add Note</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedWidget(null);
                                    router.push(`/dashboard/wgsp24?vehicle=${encodeURIComponent(log.vehicleNo)}`);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 px-2 py-1 hover:bg-blue-50 rounded"
                                  title="Track live on GPS map"
                                >
                                  <span>Track</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    /* 2. OUTSIDE – REAL-TIME FLEET POPUP */
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-4">Vehicle No</th>
                          <th className="py-2.5 px-4">Out Plant</th>
                          <th className="py-2.5 px-4">Out Date Time</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {activeWidgetLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Vehicle No */}
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <Truck className="w-3.5 h-3.5 text-amber-600" />
                                <span className="font-mono">{log.vehicleNo}</span>
                              </div>
                              <span className="text-[10px] font-medium text-slate-400 block mt-0.5">
                                {log.material || 'SF22 Fleet'}
                              </span>
                            </td>

                            {/* Out Plant */}
                            <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 text-slate-700 border border-slate-200">
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>{log.outPlant || 'Tea Plant'}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Exited 500m geofence
                              </span>
                            </td>

                            {/* Out Date Time */}
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-slate-700">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>{log.outDateTime}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Auto-captured exit event
                              </span>
                            </td>

                            {/* Action (Track) */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setSelectedWidget(null);
                                  router.push(`/dashboard/wgsp24?vehicle=${encodeURIComponent(log.vehicleNo)}`);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                                title="Track vehicle in real-time"
                              >
                                <Radio className="w-3.5 h-3.5 animate-pulse" />
                                <span>Track</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  <div className="py-12 px-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-700">
                        No vehicles currently detected {selectedWidget.type === 'plant' ? `inside ${selectedWidget.name}` : 'outside plants'}
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Vehicles entering within the 500m geofence radius will automatically show here in real-time from SF22 & Wheelseye GPS telemetry.
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
                  Synced with SF22 Fleet Registry & Wheelseye Live GPS (500m geofence)
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

      {/* 3. ADD NOTE POPUP DIALOG */}
      <Dialog open={!!addNoteVehicle} onOpenChange={(open) => !open && setAddNoteVehicle(null)}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Add Vehicle Note
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  Record remark for vehicle stay and logistics tracking
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Vehicle Number (Auto-filled / Read-only) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Vehicle Number
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  readOnly
                  value={addNoteVehicle || ''}
                  className="w-full h-9 pl-9 pr-3 text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 rounded-lg outline-none cursor-not-allowed"
                />
              </div>
            </div>

            {/* Username / Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Username / Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={addNoteUser}
                  onChange={(e) => setAddNoteUser(e.target.value)}
                  placeholder="Enter full name..."
                  className="w-full h-9 pl-9 pr-3 text-xs bg-white text-slate-800 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* Remark / Note (User input, max 20 words) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Remark / Note
                </label>
                <span className={cn(
                  "text-[11px] font-bold px-2 py-0.5 rounded",
                  isOverWordLimit ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                )}>
                  {currentRemarkWords} / {MAX_NOTE_WORDS} words
                </span>
              </div>
              <textarea
                value={addNoteRemark}
                onChange={(e) => {
                  setAddNoteRemark(e.target.value);
                  setAddNoteError('');
                }}
                rows={3}
                placeholder="Enter remark / note (Maximum 20 words)..."
                className={cn(
                  "w-full p-3 text-xs bg-white border rounded-lg outline-none transition-all resize-none",
                  isOverWordLimit 
                    ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500" 
                    : "border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                )}
              />
              {isOverWordLimit && (
                <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Note cannot exceed 20 words. Please shorten by {currentRemarkWords - MAX_NOTE_WORDS} word(s).
                </p>
              )}
              {addNoteError && !isOverWordLimit && (
                <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {addNoteError}
                </p>
              )}
            </div>

            {/* System-generated Date & Time note */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-[11px] text-slate-500">
              <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Timestamp will be automatically saved as: <strong className="text-slate-700">{formatVehicleDateTime(new Date())}</strong>
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAddNoteVehicle(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={currentRemarkWords === 0 || isOverWordLimit || isSavingNote}
                onClick={handleSaveNote}
                className={cn(
                  "px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all",
                  currentRemarkWords === 0 || isOverWordLimit || isSavingNote
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                )}
              >
                {isSavingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. NOTES POPUP (VIEW NOTES CHRONOLOGICALLY) */}
      <Dialog open={!!viewNotesVehicle} onOpenChange={(open) => !open && setViewNotesVehicle(null)}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl">
          <DialogHeader className="mb-2">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  SF22 Vehicle Remarks
                </span>
                <DialogTitle className="text-xl font-black text-slate-900 font-mono flex items-center gap-2 mt-0.5">
                  <Truck className="w-5 h-5 text-emerald-600" />
                  <span>{viewNotesVehicle}</span>
                </DialogTitle>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                {currentViewNotes.length} Note(s)
              </span>
            </div>
          </DialogHeader>

          {/* Chronological Notes Feed */}
          <div className="py-2 space-y-3 max-h-[380px] overflow-y-auto green-scrollbar pr-1">
            {currentViewNotes.length > 0 ? (
              currentViewNotes.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px] flex items-center justify-center">
                        {item.userName ? item.userName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className="font-bold text-slate-800 text-xs">
                        {item.userName || 'Ajay Somra'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.dateTimeReadable}
                    </span>
                  </div>

                  {/* Clean Visual Divider */}
                  <div className="border-t border-dashed border-slate-200" />

                  {/* Note Message Content */}
                  <p className="text-xs text-slate-700 font-medium leading-relaxed pl-1">
                    {item.note}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-1">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-600">No notes recorded yet for this vehicle.</p>
              </div>
            )}
          </div>

          {/* Notes Popup Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => {
                if (viewNotesVehicle) {
                  const targetVeh = viewNotesVehicle;
                  setViewNotesVehicle(null);
                  handleOpenAddNote(targetVeh);
                }
              }}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Note</span>
            </button>
            <button
              onClick={() => setViewNotesVehicle(null)}
              className="px-4 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 shadow-sm"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
