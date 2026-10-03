'use client';

import * as React from 'react';
import { 
  Radar, MapPin, Loader2, Settings, X, RefreshCw, Truck, AlertCircle, 
  Building2, ShieldCheck, Clock, Navigation, CheckCircle2, AlertTriangle,
  Radio, Compass, ChevronRight, Search, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  useMongoStore, 
  setDocumentNonBlocking, 
  useCollectionOptimized, 
  useDoc, 
  useMemoMongo 
} from '@/mongodb';
import { collection, doc, onSnapshot } from '@/lib/mongo-store';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { KNOWN_PLANTS, PlantLocation, evaluateGeofenceStatus, GeofenceEvaluation } from '@/lib/geofence';
import { processGeofenceTransition, VehicleGeofenceEvent, calculateStayHour, formatVehicleDateTime } from '@/lib/vehicle-stay-notes';
import 'maplibre-gl/dist/maplibre-gl.css';

const SHARED_HUB_ID = 'Sikkaind';
const POLL_INTERVAL_SECONDS = 30; // 30-second live refresh
const STALE_THRESHOLD_HOURS = 2; // Flag data as stale if > 2 hours old

export interface RegisteredVehicle {
  id: string;
  vehicleNumber: string;
  driverName?: string;
  mobile?: string;
  fleetType?: string;
  ownerName?: string;
  status?: string;
  lastGps?: any;
}

export interface WheelseyeRawItem {
  vehicleNumber: string;
  deviceNumber?: string;
  latitude: number | string;
  longitude: number | string;
  speed?: number;
  ignition?: boolean;
  status?: string;
  createdDate?: number;
  createdDateReadable?: string;
  dttime?: string;
  vendorCode?: string;
  vendorName?: string;
}

export interface EnrichedVehicleTracking {
  id: string;
  vehicleNumber: string;
  norm: string;
  driverName: string;
  mobile: string;
  fleetType: string;
  status: string; // Active / Inactive
  isMatched: boolean;
  gpsStatus: 'RUNNING' | 'IDLE' | 'STOPPED' | 'STALE' | 'NO_DATA';
  speed: number;
  ignition: boolean;
  latitude: number | null;
  longitude: number | null;
  latestGpsTimeReadable: string;
  isStale: boolean;
  geofence: GeofenceEvaluation;
  geofenceEvent?: VehicleGeofenceEvent;
  stayHour?: string;
}

// Generate GeoJSON circular polygon coordinates for 500m geofence
function createGeoJSONCircle(lng: number, lat: number, radiusMeters = 500, points = 64) {
  const km = radiusMeters / 1000;
  const ret: [number, number][] = [];
  const distanceX = km / (111.320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    ret.push([lng + x, lat + y]);
  }
  ret.push(ret[0]);
  return ret;
}

export default function WGPS24Page() {
  const db = useMongoStore();
  const searchParams = useSearchParams();
  const queryVehicle = searchParams.get('vehicle');

  const [view, setView] = React.useState<'MAP' | 'SETTING'>('MAP');
  const [loading, setLoading] = React.useState(true);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = React.useState<Date | null>(null);
  const [countdown, setCountdown] = React.useState<number>(POLL_INTERVAL_SECONDS);

  // WheelEye raw telemetry map
  const [wheelEyeMap, setWheelEyeMap] = React.useState<Record<string, WheelseyeRawItem>>({});
  const [rawApiCount, setRawApiCount] = React.useState(0);

  // Filter state
  const [filterTab, setFilterTab] = React.useState<'ALL' | 'INSIDE' | 'OUTSIDE' | 'STALE'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedVehicle, setSelectedVehicle] = React.useState<EnrichedVehicleTracking | null>(null);
  const [resolvedAddress, setResolvedAddress] = React.useState<string>('SELECT A VEHICLE');

  // Map state
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const maplibreRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);
  const plantMarkersRef = React.useRef<any[]>([]);
  const [mapError, setMapError] = React.useState<string | null>(null);

  // Persistent icon settings
  const settingsRef = useMemoMongo(() => doc(db, 'users', SHARED_HUB_ID, 'gps_tracking', 'settings'), [db]);
  const { data: settings } = useDoc(settingsRef);
  const [activeIcon, setActiveIcon] = React.useState<string>('');
  const [stoppedIcon, setStoppedIcon] = React.useState<string>('');

  React.useEffect(() => {
    if (settings) {
      if (settings.activeIcon) setActiveIcon(settings.activeIcon);
      if (settings.stoppedIcon) setStoppedIcon(settings.stoppedIcon);
    }
  }, [settings]);

  // Dynamic plants from database
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const { data: dbPlants } = useCollectionOptimized<any>(plantsQuery);

  // Registered fleet vehicles from SF22 registry
  const fleetQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'fleet_vehicles'), [db]);
  const { data: dbFleetVehicles, isLoading: isFleetLoading } = useCollectionOptimized<any>(fleetQuery);

  // Geofence events for stay hours & IN/OUT tracking
  const geofenceEventsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'vehicle_geofence_events'), [db]);
  const { data: geofenceEvents } = useCollectionOptimized<any>(geofenceEventsQuery);

  // Available plant locations with 500m geofence radius
  const activePlantsList: PlantLocation[] = React.useMemo(() => {
    const list: PlantLocation[] = [...KNOWN_PLANTS];
    (dbPlants || []).forEach((p: any) => {
      if (p.status !== 'Inactive' && typeof p.latitude === 'number' && typeof p.longitude === 'number') {
        const idx = list.findIndex(
          item => item.plantCode === p.plantCode || item.plantName.toLowerCase() === (p.plantName || '').toLowerCase()
        );
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            latitude: p.latitude,
            longitude: p.longitude,
            plantName: p.plantName || list[idx].plantName,
            radiusMeters: 500,
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

  // Helper: Normalize vehicle number
  const normalizeVehicleNo = (num: string) => (num || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();

  // 1. Fetch WheelEye API via secure backend proxy
  const fetchWheelEyeGps = React.useCallback(async (isManual = false) => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch('/api/gps');
      const json = await res.json();

      if (!res.ok && !json.data?.list?.length) {
        throw new Error(json.error || `WheelEye sync status ${res.status}`);
      }

      const list: WheelseyeRawItem[] = json?.data?.list || [];
      setRawApiCount(list.length);

      const map: Record<string, WheelseyeRawItem> = {};
      list.forEach((item) => {
        if (item.vehicleNumber) {
          const norm = normalizeVehicleNo(item.vehicleNumber);
          map[norm] = item;
        }
      });

      setWheelEyeMap(map);
      setLastSyncTime(new Date());
      setCountdown(POLL_INTERVAL_SECONDS);
    } catch (err: any) {
      console.warn('WGPS24 WheelEye Handshake Error:', err);
      setApiError(err.message || 'WheelEye GPS proxy timed out. Using cached positions.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll GPS on mount and on countdown
  React.useEffect(() => {
    fetchWheelEyeGps(false);
  }, [fetchWheelEyeGps]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchWheelEyeGps(false);
          return POLL_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchWheelEyeGps]);

  // Map of geofence events keyed by vehicle norm
  const eventsByVehicle = React.useMemo(() => {
    const map: Record<string, VehicleGeofenceEvent> = {};
    (geofenceEvents || []).forEach((ev: any) => {
      const norm = normalizeVehicleNo(ev.vehicleNo || ev.id);
      if (norm) map[norm] = ev;
    });
    return map;
  }, [geofenceEvents]);

  // 2. Match API Vehicle Number with Registered Application Vehicles
  // 3. Update Lat/Long, GPS time, 500m Geofence, and IN/OUT transitions
  const trackedVehicles: EnrichedVehicleTracking[] = React.useMemo(() => {
    const registeredList = dbFleetVehicles || [];
    const now = new Date();

    return registeredList.map((v: any) => {
      const norm = normalizeVehicleNo(v.vehicleNumber || v.id);
      const apiItem = wheelEyeMap[norm];

      const isMatched = !!apiItem;
      let lat = apiItem?.latitude ? parseFloat(String(apiItem.latitude)) : null;
      let lng = apiItem?.longitude ? parseFloat(String(apiItem.longitude)) : null;

      // Fallback to vehicle's last cached GPS if API item not present in current payload
      if ((lat === null || lng === null) && v.lastGps?.latitude && v.lastGps?.longitude) {
        lat = parseFloat(v.lastGps.latitude);
        lng = parseFloat(v.lastGps.longitude);
      }

      const speed = typeof apiItem?.speed === 'number' ? apiItem.speed : (v.lastGps?.speed || 0);
      const ignition = typeof apiItem?.ignition === 'boolean' ? apiItem.ignition : (v.lastGps?.ignition || false);

      // Check staleness: if timestamp > STALE_THRESHOLD_HOURS ago
      let isStale = false;
      let latestGpsTimeReadable = 'No GPS Received';

      if (apiItem?.createdDate) {
        // createdDate can be seconds (10 digits) or ms (13 digits)
        const tsMs = apiItem.createdDate > 1e11 ? apiItem.createdDate : apiItem.createdDate * 1000;
        const diffHours = (now.getTime() - tsMs) / (1000 * 60 * 60);
        if (diffHours > STALE_THRESHOLD_HOURS) {
          isStale = true;
        }
        latestGpsTimeReadable = apiItem.createdDateReadable || format(new Date(tsMs), 'dd-MMM-yyyy hh:mm a');
      } else if (apiItem?.dttime) {
        latestGpsTimeReadable = apiItem.dttime;
      } else if (v.lastGps?.dttimeReadable) {
        latestGpsTimeReadable = v.lastGps.dttimeReadable;
        isStale = true;
      }

      // 500m Plant Geofence Calculation
      const geofence = evaluateGeofenceStatus(lat || undefined, lng || undefined, activePlantsList);

      // Determine GPS Status
      let gpsStatus: EnrichedVehicleTracking['gpsStatus'] = 'NO_DATA';
      if (lat !== null && lng !== null) {
        if (isStale) {
          gpsStatus = 'STALE';
        } else if (speed > 0) {
          gpsStatus = 'RUNNING';
        } else if (ignition) {
          gpsStatus = 'IDLE';
        } else {
          gpsStatus = 'STOPPED';
        }
      }

      const prevEvent = eventsByVehicle[norm];
      const stayHour = prevEvent?.status === 'INSIDE' && prevEvent?.inDateTime
        ? calculateStayHour(prevEvent.inDateTime, now)
        : undefined;

      return {
        id: v.id || norm,
        vehicleNumber: v.vehicleNumber || norm,
        norm,
        driverName: v.driverName || 'Unassigned',
        mobile: v.mobile || '-',
        fleetType: v.fleetType || 'Own Fleet',
        status: v.status || 'Active',
        isMatched,
        gpsStatus,
        speed,
        ignition,
        latitude: lat,
        longitude: lng,
        latestGpsTimeReadable,
        isStale,
        geofence,
        geofenceEvent: prevEvent,
        stayHour,
      };
    });
  }, [dbFleetVehicles, wheelEyeMap, activePlantsList, eventsByVehicle]);

  // Synchronize matched GPS telemetry and geofence transitions to MongoDB in background
  React.useEffect(() => {
    if (!db || trackedVehicles.length === 0) return;

    trackedVehicles.forEach((v) => {
      if (!v.latitude || !v.longitude) return;

      // 1. Process Geofence Transition for SF22 IN/OUT detection
      const prevEvent = eventsByVehicle[v.norm];
      const transition = processGeofenceTransition({
        vehicleNo: v.vehicleNumber,
        isInside: v.geofence.isInside,
        plantCode: v.geofence.plantCode,
        plantName: v.geofence.plantName,
        distanceMeters: v.geofence.distanceMeters,
        previousEvent: prevEvent,
      });

      if (transition.hasChanged) {
        const evDocRef = doc(db, 'users', SHARED_HUB_ID, 'vehicle_geofence_events', v.norm);
        setDocumentNonBlocking(evDocRef, transition.event, { merge: true });
      }

      // 2. Persist updated GPS location & geofence in fleet_vehicles
      const vRef = doc(db, 'users', SHARED_HUB_ID, 'fleet_vehicles', v.id);
      setDocumentNonBlocking(vRef, {
        lastGps: {
          latitude: v.latitude,
          longitude: v.longitude,
          speed: v.speed,
          ignition: v.ignition,
          status: v.gpsStatus,
          lastUpdate: format(new Date(), 'dd-MM-yyyy, HH:mm:ss'),
          dttimeReadable: v.latestGpsTimeReadable,
          isInsidePlant: v.geofence.isInside,
          plantName: v.geofence.plantName,
          distanceMeters: v.geofence.distanceMeters,
        },
        geofenceStatus: v.geofence.displayText,
      }, { merge: true });
    });
  }, [db, trackedVehicles, eventsByVehicle]);

  // Statistics
  const stats = React.useMemo(() => {
    const total = trackedVehicles.length;
    const withLiveGps = trackedVehicles.filter(v => v.gpsStatus !== 'NO_DATA' && !v.isStale).length;
    const insidePlant = trackedVehicles.filter(v => v.geofence.isInside).length;
    const outsidePlant = trackedVehicles.filter(v => !v.geofence.isInside && v.latitude !== null).length;
    const staleOrOffline = trackedVehicles.filter(v => v.isStale || v.gpsStatus === 'NO_DATA').length;
    return { total, withLiveGps, insidePlant, outsidePlant, staleOrOffline };
  }, [trackedVehicles]);

  // Filtered vehicles for sidebar list
  const filteredVehicles = React.useMemo(() => {
    return trackedVehicles.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        v.vehicleNumber.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        v.mobile.toLowerCase().includes(q) ||
        v.geofence.displayText.toLowerCase().includes(q);

      let matchesTab = true;
      if (filterTab === 'INSIDE') matchesTab = v.geofence.isInside;
      else if (filterTab === 'OUTSIDE') matchesTab = !v.geofence.isInside && v.latitude !== null;
      else if (filterTab === 'STALE') matchesTab = v.isStale || v.gpsStatus === 'NO_DATA';

      return matchesSearch && matchesTab;
    });
  }, [trackedVehicles, searchQuery, filterTab]);

  // Auto-select vehicle from query parameter if present
  React.useEffect(() => {
    if (queryVehicle && trackedVehicles.length > 0 && !selectedVehicle) {
      const targetNorm = normalizeVehicleNo(queryVehicle);
      const match = trackedVehicles.find(v => v.norm === targetNorm);
      if (match) {
        handleSelectVehicle(match);
      }
    }
  }, [queryVehicle, trackedVehicles, selectedVehicle]);

  // Reverse geocoding using ArcGIS or fallback
  const reverseGeocode = React.useCallback(async (lat: number, lng: number) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '';
      if (apiKey) {
        const res = await fetch(
          `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${lng},${lat}&token=${encodeURIComponent(apiKey)}`
        );
        const data = await res.json();
        if (data?.address?.Match_addr) {
          setResolvedAddress(data.address.Match_addr);
          return;
        }
      }
      setResolvedAddress(`Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setResolvedAddress(`Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }, []);

  const handleSelectVehicle = (v: EnrichedVehicleTracking) => {
    setSelectedVehicle(v);
    setResolvedAddress('Resolving location address...');
    if (v.latitude && v.longitude) {
      reverseGeocode(v.latitude, v.longitude);
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [v.longitude, v.latitude],
          zoom: 15,
          duration: 1000,
        });
      }
    } else {
      setResolvedAddress('No GPS coordinates acquired for this vehicle');
    }
  };

  // Initialize MapLibre GL with fallback to OpenStreetMap tiles
  React.useEffect(() => {
    if (view !== 'MAP' || !mapContainerRef.current || mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '';

    const initMap = async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        maplibreRef.current = maplibregl;

        if (typeof maplibregl.setWorkerUrl === 'function') {
          maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
        }

        // Try ArcGIS style, fallback to high-reliability OpenStreetMap raster tiles
        const styleUrl = apiKey 
          ? `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/navigation?token=${encodeURIComponent(apiKey)}`
          : {
              version: 8,
              sources: {
                'osm-tiles': {
                  type: 'raster',
                  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                  tileSize: 256,
                  attribution: '&copy; OpenStreetMap contributors'
                }
              },
              layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 }]
            };

        const map = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: styleUrl as any,
          center: [77.45, 28.65], // Center near Sikka Plant Hub (NCR)
          zoom: 10,
          attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        mapRef.current = map;
        setMapError(null);

        // When style loads, draw 500m Plant Geofence Circles
        map.on('load', () => {
          renderPlantGeofences(map);
        });

      } catch (err) {
        console.error('MapLibre init error:', err);
        setMapError('Map initialized with satellite fallback.');
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        maplibreRef.current = null;
      }
    };
  }, [view]);

  // Render 500m Plant Geofence Circles & Center Markers on Map
  const renderPlantGeofences = (map: any) => {
    if (!map) return;

    // Remove existing plant center markers
    plantMarkersRef.current.forEach(m => m.remove());
    plantMarkersRef.current = [];

    // Create GeoJSON FeatureCollection of 500m circles
    const features = activePlantsList.map((plant) => {
      const circleCoords = createGeoJSONCircle(plant.longitude, plant.latitude, 500);
      return {
        type: 'Feature',
        properties: {
          plantCode: plant.plantCode,
          plantName: plant.plantName,
          radius: '500m',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [circleCoords],
        },
      };
    });

    const sourceData: any = {
      type: 'FeatureCollection',
      features,
    };

    if (map.getSource('plant-geofences-source')) {
      map.getSource('plant-geofences-source').setData(sourceData);
    } else {
      map.addSource('plant-geofences-source', {
        type: 'geojson',
        data: sourceData,
      });

      // Fill layer: subtle transparent green
      map.addLayer({
        id: 'plant-geofence-fill',
        type: 'fill',
        source: 'plant-geofences-source',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.15,
        },
      });

      // Stroke layer: distinct 500m boundary line
      map.addLayer({
        id: 'plant-geofence-stroke',
        type: 'line',
        source: 'plant-geofences-source',
        paint: {
          'line-color': '#059669',
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });
    }

    // Add Plant Center Markers with 500m Radius Tag
    const maplibregl = maplibreRef.current;
    if (!maplibregl) return;

    activePlantsList.forEach((plant) => {
      const el = document.createElement('div');
      el.className = 'flex flex-col items-center select-none cursor-pointer';
      el.innerHTML = `
        <div style="background:#065f46; color:#ffffff; font-size:10px; font-weight:900; padding:2px 8px; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.3); border:1px solid #34d399; white-space:nowrap; text-transform:uppercase;">
          🏭 ${plant.plantName} (500m Geofence)
        </div>
        <div style="width:12px; height:12px; background:#10b981; border:2px solid #ffffff; border-radius:50%; box-shadow:0 0 8px #10b981; margin-top:2px;"></div>
      `;

      el.addEventListener('click', () => {
        map.flyTo({
          center: [plant.longitude, plant.latitude],
          zoom: 15,
          duration: 800,
        });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([plant.longitude, plant.latitude])
        .addTo(map);

      plantMarkersRef.current.push(marker);
    });
  };

  // Update vehicle markers on trackedVehicles or selectedVehicle change
  React.useEffect(() => {
    if (!mapRef.current || !maplibreRef.current || view !== 'MAP') return;

    const map = mapRef.current;
    const maplibregl = maplibreRef.current;

    const updateMarkers = () => {
      // Remove old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      trackedVehicles.forEach((v) => {
        if (v.latitude === null || v.longitude === null) return;

        const isSelected = selectedVehicle?.norm === v.norm;
        const isInsidePlant = v.geofence.isInside;

        let statusColor = '#ef4444'; // Red for stopped
        if (v.isStale) statusColor = '#f59e0b'; // Amber for stale
        else if (v.gpsStatus === 'RUNNING') statusColor = '#10b981'; // Green for running
        else if (v.gpsStatus === 'IDLE') statusColor = '#f59e0b'; // Amber for idle

        const el = document.createElement('div');
        el.className = 'flex flex-col items-center cursor-pointer select-none';
        el.style.zIndex = isSelected ? '100' : (isInsidePlant ? '50' : '20');

        // Badge pill over marker
        const tag = document.createElement('div');
        tag.className = cn(
          'px-2 py-0.5 mb-1 rounded text-[10px] font-black font-mono shadow-md whitespace-nowrap transition-transform border',
          isSelected 
            ? 'bg-blue-600 text-white border-blue-400 scale-110 ring-2 ring-blue-300'
            : isInsidePlant
            ? 'bg-emerald-700 text-white border-emerald-400'
            : 'bg-white text-slate-900 border-slate-700'
        );
        tag.innerText = v.vehicleNumber;
        el.appendChild(tag);

        // Circular pin with Truck Icon
        const pin = document.createElement('div');
        pin.className = cn(
          'relative flex items-center justify-center rounded-full shadow-lg transition-transform',
          isSelected ? 'w-10 h-10 ring-4 ring-blue-400 scale-110' : 'w-8 h-8 hover:scale-110'
        );
        pin.style.backgroundColor = statusColor;
        pin.style.border = '2.5px solid #ffffff';

        // Pulse effect for running vehicles or selected vehicle
        if (v.gpsStatus === 'RUNNING' || isSelected) {
          const ping = document.createElement('span');
          ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75';
          ping.style.backgroundColor = statusColor;
          pin.appendChild(ping);
        }

        // Inside SVG Truck
        pin.innerHTML += `
          <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? 20 : 16}" height="${isSelected ? 20 : 16}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="relative z-10 pointer-events-none">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
            <path d="M15 18H9"/>
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
            <circle cx="17" cy="18" r="2"/>
            <circle cx="7" cy="18" r="2"/>
          </svg>
        `;

        el.appendChild(pin);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          handleSelectVehicle(v);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([v.longitude, v.latitude])
          .addTo(map);

        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) {
      updateMarkers();
    } else {
      map.once('load', updateMarkers);
    }
  }, [trackedVehicles, selectedVehicle, view]);

  return (
    <div className="flex-1 flex flex-col bg-[#f4f6f9] font-sans text-slate-900 h-screen overflow-hidden">
      {/* Top Banner / Error Notice if WheelEye API timed out or network error */}
      {apiError && (
        <div className="bg-amber-500 text-white px-6 py-2 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{apiError} (Serving latest verified positions).</span>
          </div>
          <Button
            onClick={() => fetchWheelEyeGps(true)}
            size="sm"
            className="h-6 px-2.5 text-[11px] bg-white text-amber-900 hover:bg-amber-100 font-bold"
          >
            Retry Sync
          </Button>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
              <span>WGPS24 – WheelEye Current Location Monitoring</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                500m Plant Geofence Engine
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Real-time telemetry integration with SF22 vehicle registry & geofence transitions
            </p>
          </div>
        </div>

        {/* Sync Controls & View Switcher */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <span>Sync: <strong className="text-slate-900 font-bold">{lastSyncTime ? format(lastSyncTime, 'HH:mm:ss') : 'Connecting...'}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Next: <strong className="text-blue-600 font-bold">{countdown}s</strong></span>
            <button
              onClick={() => fetchWheelEyeGps(true)}
              disabled={loading}
              title="Synchronize WheelEye GPS Now"
              className="p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer text-slate-700"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </button>
          </div>

          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setView('MAP')}
              className={cn(
                "px-3.5 py-1.5 text-xs font-black uppercase rounded-md transition-all cursor-pointer",
                view === 'MAP' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              GPS Tracking Map
            </button>
            <button
              onClick={() => setView('SETTING')}
              className={cn(
                "px-3.5 py-1.5 text-xs font-black uppercase rounded-md transition-all cursor-pointer",
                view === 'SETTING' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            Fleet Fleet Status:
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
            <Truck className="h-3.5 w-3.5 text-slate-400" />
            Registered: <strong className="text-slate-950 font-black">{stats.total}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Live GPS Active: <strong className="font-black">{stats.withLiveGps}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <Building2 className="h-3.5 w-3.5 text-emerald-600" />
            Inside Plant (≤500m): <strong className="font-black">{stats.insidePlant}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            <Navigation className="h-3.5 w-3.5 text-blue-600" />
            Outside / Transit: <strong className="font-black">{stats.outsidePlant}</strong>
          </span>
          {stats.staleOrOffline > 0 && (
            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
              <Clock className="h-3 w-3" />
              Stale / Offline: <strong>{stats.staleOrOffline}</strong>
            </span>
          )}
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          WheelEye Gateway: <strong className="text-emerald-700 font-bold">{rawApiCount} Nodes Online</strong>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {view === 'MAP' ? (
          <>
            {/* Left Sidebar: Matched Vehicles List */}
            <div className="w-84 md:w-96 bg-white border-r border-slate-200 flex flex-col shadow-md z-10 shrink-0">
              {/* Filter Tabs */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search vehicle number or driver..."
                    className="h-8 pl-8 pr-3 w-full bg-white border border-slate-300 rounded-md text-xs outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-4 gap-1 text-[10px] font-bold uppercase">
                  <button
                    onClick={() => setFilterTab('ALL')}
                    className={cn(
                      "py-1 rounded text-center transition-all cursor-pointer",
                      filterTab === 'ALL' ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    onClick={() => setFilterTab('INSIDE')}
                    className={cn(
                      "py-1 rounded text-center transition-all cursor-pointer",
                      filterTab === 'INSIDE' ? "bg-emerald-600 text-white" : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50"
                    )}
                  >
                    Inside ({stats.insidePlant})
                  </button>
                  <button
                    onClick={() => setFilterTab('OUTSIDE')}
                    className={cn(
                      "py-1 rounded text-center transition-all cursor-pointer",
                      filterTab === 'OUTSIDE' ? "bg-blue-600 text-white" : "bg-white text-blue-800 border border-blue-200 hover:bg-blue-50"
                    )}
                  >
                    Outside ({stats.outsidePlant})
                  </button>
                  <button
                    onClick={() => setFilterTab('STALE')}
                    className={cn(
                      "py-1 rounded text-center transition-all cursor-pointer",
                      filterTab === 'STALE' ? "bg-amber-600 text-white" : "bg-white text-amber-800 border border-amber-200 hover:bg-amber-50"
                    )}
                  >
                    Stale ({stats.staleOrOffline})
                  </button>
                </div>
              </div>

              {/* Scrollable Vehicle List */}
              <div className="flex-1 overflow-y-auto green-scrollbar divide-y divide-slate-100">
                {filteredVehicles.map((v) => {
                  const isSelected = selectedVehicle?.norm === v.norm;
                  const isInside = v.geofence.isInside;

                  return (
                    <div
                      key={v.id}
                      onClick={() => handleSelectVehicle(v)}
                      className={cn(
                        "p-3.5 transition-all cursor-pointer hover:bg-slate-50 flex flex-col gap-1.5 border-l-4",
                        isSelected
                          ? "bg-blue-50/70 border-l-blue-600 shadow-xs"
                          : isInside
                          ? "border-l-emerald-500"
                          : v.isStale
                          ? "border-l-amber-500"
                          : "border-l-slate-300"
                      )}
                    >
                      {/* Top: Plate & Speed */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-xs text-slate-900 tracking-wide flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-slate-500" />
                          {v.vehicleNumber}
                        </span>

                        <div className="flex items-center gap-1">
                          {v.gpsStatus === 'RUNNING' && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Running {v.speed} KM/H
                            </span>
                          )}
                          {v.gpsStatus === 'IDLE' && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-amber-100 text-amber-800 border border-amber-300">
                              Idle
                            </span>
                          )}
                          {v.gpsStatus === 'STOPPED' && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-red-100 text-red-800 border border-red-300">
                              Stopped
                            </span>
                          )}
                          {v.isStale && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" /> Stale
                            </span>
                          )}
                          {v.gpsStatus === 'NO_DATA' && (
                            <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-100 text-slate-500">
                              No GPS
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Driver & Fleet */}
                      <div className="text-[11px] text-slate-600 flex justify-between">
                        <span className="font-medium truncate max-w-[180px]">
                          {v.driverName} ({v.mobile})
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {v.fleetType}
                        </span>
                      </div>

                      {/* Bottom: 500m Geofence Evaluation Result */}
                      <div className="pt-1 flex items-center justify-between text-[10px]">
                        {isInside ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            Inside: {v.geofence.plantName} ({v.geofence.distanceMeters}m)
                            {v.stayHour && <strong className="text-emerald-900 font-black">[{v.stayHour}h]</strong>}
                          </span>
                        ) : (
                          <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <Navigation className="h-3 w-3 text-blue-500" />
                            Outside Plant {v.geofence.distanceMeters ? `(${(v.geofence.distanceMeters / 1000).toFixed(1)} km away)` : ''}
                          </span>
                        )}

                        <span className="text-slate-400 font-mono text-[9px]">
                          {v.latestGpsTimeReadable}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {filteredVehicles.length === 0 && (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <AlertCircle className="h-6 w-6 mx-auto opacity-50" />
                    <p className="text-xs font-bold">No registered vehicles matching filter.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Map Canvas */}
            <div className="flex-1 relative bg-slate-200">
              <div ref={mapContainerRef} className="w-full h-full" />

              {/* Floating Vehicle Detail Card */}
              {selectedVehicle && (
                <div className="absolute top-4 left-4 right-4 md:right-auto md:w-96 bg-white/95 backdrop-blur-md border border-slate-300 p-4 rounded-xl shadow-2xl z-30 animate-fade-in">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-black text-slate-900">
                          {selectedVehicle.vehicleNumber}
                        </span>
                        <Badge className={cn(
                          "text-[10px] font-black uppercase rounded border-none",
                          selectedVehicle.geofence.isInside ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                        )}>
                          {selectedVehicle.geofence.isInside ? `Inside 500m: ${selectedVehicle.geofence.plantName}` : 'Outside Plant'}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-600 font-medium">
                        Driver: <strong>{selectedVehicle.driverName}</strong> | {selectedVehicle.mobile}
                      </div>
                    </div>

                    <Button
                      onClick={() => setSelectedVehicle(null)}
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5 text-slate-700">
                      <MapPin className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <span className="leading-tight text-[11px] font-medium">{resolvedAddress}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px] text-slate-600">
                      <div>
                        Speed: <strong className="text-slate-900 font-bold">{selectedVehicle.speed} KM/H</strong>
                      </div>
                      <div>
                        Status: <strong className="text-slate-900 font-bold">{selectedVehicle.gpsStatus}</strong>
                      </div>
                      <div>
                        Distance: <strong className="text-slate-900 font-bold">{selectedVehicle.geofence.distanceMeters ?? '-'}m</strong>
                      </div>
                      <div>
                        Stay: <strong className="text-emerald-700 font-bold">{selectedVehicle.stayHour ? `${selectedVehicle.stayHour} Hrs` : 'N/A'}</strong>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono pt-1 flex items-center justify-between">
                      <span>Telemetry: {selectedVehicle.latestGpsTimeReadable}</span>
                      {selectedVehicle.isStale && (
                        <span className="text-amber-600 font-bold">⚠️ Stale Telemetry</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {loading && (
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm border border-slate-200 px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 text-xs font-bold text-slate-700 z-30">
                  <Loader2 className="h-3.5 w-3.5 text-emerald-600 animate-spin" />
                  <span>Syncing WheelEye Telemetry...</span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* SETTINGS TAB */
          <div className="flex-1 bg-white p-8 max-w-2xl mx-auto overflow-y-auto">
            <h2 className="text-sm font-black uppercase text-slate-900 mb-2">
              WGPS24 Tracking Settings & Markers
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Configure telemetry thresholds and custom vehicle icon overlays.
            </p>

            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800 uppercase block">
                  Plant Geofence Threshold
                </label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-mono font-bold text-xs rounded border border-emerald-300">
                    500 Meters (Fixed Standard)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    All plants use 500-meter radius around plant coordinates.
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-800 uppercase block">
                  WheelEye Current Location API Endpoint
                </label>
                <div className="font-mono text-xs bg-white p-2.5 rounded border border-slate-300 text-slate-700 select-all">
                  GET https://api.wheelseye.com/currentLoc?accessToken=[TOKEN_PROTECTED]
                </div>
                <p className="text-[11px] text-slate-500">
                  Access token is securely managed on backend server route to prevent client exposure.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
