'use client';

import * as React from 'react';
import { Radar, MapPin, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollectionOptimized, useMemoMongo, useDoc } from '@/mongodb';
import { collection, doc } from '@/lib/mongo-store';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const SHARED_HUB_ID = 'Sikkaind';

declare global {
  interface Window {
    require?: any;
  }
}

type View = 'search' | 'details' | 'mapping';

type LonLat = { lon: number; lat: number };

export default function TR24Page() {
  const db = useMongoStore();
  const [view, setView] = React.useState<View>('search');
  const [q, setQ] = React.useState('');
  const [order, setOrder] = React.useState<any>(null);
  const [tripsList, setTripsList] = React.useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);
  const [gpsLive, setGpsLive] = React.useState<any[]>([]);

  const ordersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const customersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const settingsRef = useMemoMongo(() => doc(db, 'users', SHARED_HUB_ID, 'gps_tracking', 'settings'), [db]);
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);

  const { data: orders } = useCollectionOptimized(ordersQuery);
  const { data: trips } = useCollectionOptimized(tripsQuery);
  const { data: customers } = useCollectionOptimized(customersQuery);
  const { data: settings } = useDoc(settingsRef);

  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const { data: plants } = useCollectionOptimized(plantsQuery);
  const mapRef = React.useRef<any>(null);
  const maplibreRef = React.useRef<any>(null);

  React.useEffect(() => {
    const fetchGps = async () => {
      try {
        const res = await fetch('/api/gps');
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.list) setGpsLive(json.data.list);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchGps(); 
    const interval = setInterval(fetchGps, 30000); 

    return () => clearInterval(interval);
  }, []);

  const handleTrack = () => {
    const val = q.toUpperCase().trim();
    if (!val) {
      alert('Please enter Sale Order Number.');
      return;
    }

    const ord = orders?.find((o: any) => o.orderNo === val);
    if (ord) {
      setOrder(ord);
      const linked = trips?.filter((t: any) => t.orderNo === val) || [];
      setTripsList(linked);
      if (linked.length === 0) alert('No linked trip executions found.');
      setView('details');
    } else {
      alert('No shipment found for the entered Sale Order Number.');
    }
  };

  const getCustomerPincode = (code: string) => {
    if (!customers || !code) return '-';
    if (customers) {
      const customer = customers.find((c: any) => c.customerCode === code || c.id === code);
      if (customer) {
        return customer.pincode || customer.postalCode || '-';
      }
    }
    const plant = plants?.find((p: any) => p.plantCode === code || p.id === code);
    return plant?.pincode || plant?.postalCode || '-';
  };

  // Map Initializer
  React.useEffect(() => {
    if (view !== 'mapping' || !mapContainerRef.current || mapRef.current) return;

    let map: any;

    const liveNode = gpsLive.find((n: any) => {
      const apiVehicle = n.vehicleNumber?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const tripVehicle = selectedTrip?.vehicleNo?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return apiVehicle === tripVehicle;
    });

    const lat = liveNode ? parseFloat(liveNode.latitude) : 20.5937;
    const lng = liveNode ? parseFloat(liveNode.longitude) : 78.9629;

    const initMap = async () => {
      const styleUrlEnv = process.env.NEXT_PUBLIC_MAPTILER_STYLE_URL as string | undefined;
      const token = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || process.env.MAPTILER_API_KEY || '';

      const maplibregl = await import('maplibre-gl');
      maplibreRef.current = maplibregl;

      const styleUrl = styleUrlEnv
        ? styleUrlEnv
        : `https://api.maptiler.com/maps/streets/style.json?key=${encodeURIComponent(token)}`;

      map = new maplibregl.Map({
        container: mapContainerRef.current!,
        style: styleUrl,
        center: [lng, lat],
        zoom: liveNode ? 13 : 5,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      mapRef.current = map;
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [view, selectedTrip]);

  // Route Drawing with Corrected GeoJSON Geometry Parsing
  React.useEffect(() => {
    if (!mapRef.current || !selectedTrip) return;

    const map = mapRef.current;

    const onMapLoad = async () => {
      const startPin = getCustomerPincode(selectedTrip.consignorCode);
      const dropPin = getCustomerPincode(selectedTrip.shipToPartyCode);
      const token = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || process.env.MAPTILER_API_KEY || '';

      if (!startPin || !dropPin || startPin === '-' || dropPin === '-') {
        console.log('[tr24] route skipped: invalid pins', { startPin, dropPin });
        return;
      }

      // GeoJSON Dataset से कोऑर्डिनेट्स निकालने का सही तरीका
      const geocode = async (qstr: string): Promise<LonLat | null> => {
        try {
          const res = await fetch(
            `https://api.maptiler.com/data/019f4b53-c7db-74a8-b443-9fef0334f932/features.json?key=${encodeURIComponent(token)}`
          );
          const data = await res.json();
          
          const f = data?.features?.find((feat: any) => {
            const props = feat?.properties || {};
            const pin = props?.pincode?.toString?.();
            const postal = props?.postalCode?.toString?.();
            const q = qstr.toString();
            return pin === q || postal === q;
          });

          if (!f) return null;

          // अगर feature में center डायरेक्ट नहीं है, तो geometry coordinates का उपयोग करें
          if (f.center) {
            return { lon: f.center[0], lat: f.center[1] };
          } else if (f.geometry && f.geometry.type === 'Point') {
            return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
          }
          return null;
        } catch (err) {
          console.error('[tr24] Geocoding parsing error', err);
          return null;
        }
      };

      const a = await geocode(startPin);
      const b = await geocode(dropPin);
      
      if (!a || !b) {
        console.error('[tr24] Geocoding failed for pins:', { startPin, dropPin, a, b });
        alert(`Could not draw route. Geocoding failed for Start PIN '${startPin}' or Drop PIN '${dropPin}'. Please check customer master data.`);
        return;
      }

      // MapTiler Routing API Call using parsed coordinates
      let routeCoordinates: any[] = [[a.lon, a.lat], [b.lon, b.lat]];
      try {
        const routingUrl = `https://api.maptiler.com/routing/v1/maps/truck/${a.lon},${a.lat};${b.lon},${b.lat}.json?key=${encodeURIComponent(token)}&alternatives=false&geometries=geojson&overview=full`;
        const routingRes = await fetch(routingUrl);
        if (routingRes.ok) {
          const routingData = await routingRes.json();
          const routeFeature = routingData?.routes?.[0]?.geometry;
          if (routeFeature?.coordinates && routeFeature.coordinates.length > 0) {
            routeCoordinates = routeFeature.coordinates;
          }
        }
      } catch (err) {
        console.error('[tr24] Route logic error, using fallback line', err);
      }

      if (map.getSource('route')) {
        if (map.getLayer('route-line')) map.removeLayer('route-line');
        map.removeSource('route');
      }

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { 
            type: 'LineString', 
            coordinates: routeCoordinates 
          },
        },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: { 
          'line-width': 5, 
          'line-color': '#0056d2', 
          'line-opacity': 0.85
        },
      });

      const bounds = new maplibreRef.current.LngLatBounds();
      routeCoordinates.forEach((coord: [number, number]) => bounds.extend(coord));
      map.fitBounds(bounds, { padding: 80, duration: 500 });
    };

    if (map.isStyleLoaded()) {
      onMapLoad();
    } else {
      map.once('load', onMapLoad);
    }
  }, [selectedTrip]);

  // Vehicle Live Marker Updating Effect
  React.useEffect(() => {
    if (!mapRef.current || !selectedTrip) return;

    const map = mapRef.current;
    let marker: any = null;

    const updateMarker = () => {
      const liveNode = gpsLive.find((n: any) => {
        const apiVehicle = n.vehicleNumber?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const tripVehicle = selectedTrip.vehicleNo?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return apiVehicle === tripVehicle;
      });

      if (!liveNode) {
        if (marker) marker.remove();
        return;
      }

      const lat = parseFloat(liveNode.latitude);
      const lng = parseFloat(liveNode.longitude);

      if (marker) {
        marker.setLngLat([lng, lat]);
      } else {
        const vehicleEl = document.createElement('div');
        vehicleEl.style.width = '32px';
        vehicleEl.style.height = '32px';
        const iconUrl = liveNode.status === 'RUNNING'
          ? (settings?.activeIcon || 'https://static.arcgis.com/images/Symbols/Shapes/GreenCircleLargeB.png')
          : (settings?.stoppedIcon || 'https://static.arcgis.com/images/Symbols/Shapes/RedCircleLargeB.png');
        vehicleEl.style.backgroundImage = `url(${iconUrl})`;
        vehicleEl.style.backgroundSize = 'contain';
        vehicleEl.style.backgroundRepeat = 'no-repeat';
        marker = new maplibreRef.current.Marker({ element: vehicleEl }).setLngLat([lng, lat]).addTo(map);
      }
    };

    if (map.isStyleLoaded()) {
      updateMarker();
    } else {
      map.once('load', updateMarker);
    }

    return () => {
      if (marker) marker.remove();
    };
  }, [gpsLive, selectedTrip, settings]);

  if (view === 'mapping' && selectedTrip) {
    const startPin = getCustomerPincode(selectedTrip.consignorCode);
    const dropPin = getCustomerPincode(selectedTrip.shipToPartyCode);

    const liveNode = gpsLive.find((n: any) => {
      const apiVehicle = n.vehicleNumber?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const tripVehicle = selectedTrip.vehicleNo?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return apiVehicle === tripVehicle;
    });

    const statusMap: Record<string, string> = {
      LOADING: 'Loading',
      'IN-TRANSIT': 'In-Transit',
      ARRIVED: 'Arrived',
      REJECTION: 'Reject',
      POD: 'Unload',
    };

    return (
      <div className="flex-1 flex flex-col p-8 font-mono bg-[#f2f2f2] text-black">
        <div className="bg-white border border-slate-300 p-8 shadow-sm space-y-8">
          <div className="flex justify-between items-start border-b border-slate-100 pb-6">
            <div className="space-y-1">
              <h3 className="text-[14px] font-black uppercase text-[#1e3a8a] italic tracking-tighter">
                Live Execution Trace: {selectedTrip.tripNo}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {selectedTrip.vehicleNo} • {selectedTrip.mode}
              </p>
            </div>
            <div className="flex gap-4">
              <Badge className="bg-[#0056d2] rounded-none font-black text-[9px] px-6 uppercase shadow-lg">
                {statusMap[selectedTrip.status] || selectedTrip.status}
              </Badge>
              <Button
                onClick={() => setView('details')}
                variant="outline"
                className="h-8 rounded-none text-[9px] font-black uppercase"
              >
                Back to Trips
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 border border-slate-200 space-y-4 shadow-inner">
                <div className="flex items-start gap-4">
                  <MapPin className="h-4 w-4 text-emerald-600 mt-1" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Start Point</span>
                    <p className="text-xs font-black text-slate-800 uppercase italic">
                      {selectedTrip.consignorName} ({selectedTrip.from}) - PIN: {startPin}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Calendar className="h-4 w-4 text-slate-500 mt-1" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Vehicle Assigned</span>
                    <p className="text-xs font-black text-slate-800 uppercase italic">
                      {selectedTrip.assignDate ? format(new Date(selectedTrip.assignDate), 'dd-MMM-yy HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Clock className="h-4 w-4 text-slate-500 mt-1" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Warehouse Out</span>
                    <p className="text-xs font-black text-slate-800 uppercase italic">
                      {selectedTrip.outDate ? format(new Date(selectedTrip.outDate), 'dd-MMM-yy HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Clock className="h-4 w-4 text-slate-500 mt-1" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Arrived</span>
                    <p className="text-xs font-black text-slate-800 uppercase italic">
                      {selectedTrip.arrivedDate ? format(new Date(selectedTrip.arrivedDate), 'dd-MMM-yy HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Clock className="h-4 w-4 text-slate-500 mt-1" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Unload</span>
                    <p className="text-xs font-black text-slate-800 uppercase italic">
                      {selectedTrip.unloadDate ? format(new Date(selectedTrip.unloadDate), 'dd-MMM-yy HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <MapPin className="h-4 w-4 text-red-600 mt-1" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Drop Point</span>
                    <p className="text-xs font-black text-slate-800 uppercase italic">
                      {selectedTrip.shipToParty} ({selectedTrip.destination}) - PIN: {dropPin}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <div
                ref={mapContainerRef}
                className="bg-slate-100 border-2 border-slate-300 relative h-[400px] w-full shadow-lg"
              />
              {liveNode && (
                <div className="bg-slate-800 text-white p-3 text-center text-[10px] uppercase font-bold tracking-widest">
                  Last Update:{' '}
                  {liveNode.timestamp && !isNaN(new Date(liveNode.timestamp).getTime())
                    ? format(new Date(liveNode.timestamp), 'dd-MMM-yy HH:mm:ss')
                    : 'N/A'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'details' && order) {
    return (
      <div className="flex-1 flex flex-col p-8 font-mono bg-[#f2f2f2] text-black">
        <div className="bg-white border border-slate-300 p-8 shadow-sm space-y-10">
          <div className="flex justify-between items-center border-b border-slate-100 pb-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black uppercase italic text-[#1e3a8a] tracking-tighter">
                Shipment Overview: {order.orderNo}
              </h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">System Booking Entry</span>
            </div>
            <Button
              onClick={() => {
                setView('search');
                setOrder(null);
                setQ('');
                setTripsList([]);
              }}
              variant="outline"
              className="h-8 rounded-none uppercase text-[9px] font-black px-10 border-slate-300"
            >
              New Search
            </Button>
          </div>

          <div className="grid grid-cols-3 lg:grid-cols-6 gap-6 text-[11px] font-bold uppercase bg-slate-50 p-6 shadow-inner">
            <div className="flex flex-col gap-1.5">
              <span className="text-slate-400 text-[9px] font-black tracking-widest">Plant</span>
              <p>{order.plantCode}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-slate-400 text-[9px] font-black tracking-widest">Consignor</span>
              <p className="truncate" title={order.consignorName}>
                {order.consignorName}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-slate-400 text-[9px] font-black tracking-widest">Consignee</span>
              <p className="truncate" title={order.consigneeName}>
                {order.consigneeName}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-slate-400 text-[9px] font-black tracking-widest">Ship To Party</span>
              <p className="truncate" title={order.shipToParty}>
                {order.shipToParty}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-slate-400 text-[9px] font-black tracking-widest">Route</span>
              <p className="truncate" title={`${order.from} → ${order.destination}`}>
                {order.from} → {order.destination}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-slate-400 text-[9px] font-black tracking-widest">Order Qty</span>
              <p className="text-blue-700">{order.quantity} MT</p>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] font-black uppercase italic text-slate-600 border-b-2 border-blue-100 w-fit pb-1">
              Linked Trip Executions ({tripsList.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] uppercase">
                <thead className="bg-slate-50 font-black text-slate-500">
                  <tr>
                    <th className="p-3">Plant</th>
                    <th className="p-3">Consignor</th>
                    <th className="p-3">Consignee</th>
                    <th className="p-3">Ship To Party</th>
                    <th className="p-3">Route</th>
                    <th className="p-3 text-right">Assigned Qty</th>
                    <th className="p-3">Vehicle No.</th>
                    <th className="p-3">Driver Mobile</th>
                    <th className="p-3">CN No.</th>
                    <th className="p-3">CN Date</th>
                    <th className="p-3">Invoice No.</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {tripsList.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-blue-50/30 font-bold">
                      <td className="p-3">{t.plantCode}</td>
                      <td className="p-3 truncate max-w-[150px]" title={t.consignorName}>
                        {t.consignorName}
                      </td>
                      <td className="p-3 truncate max-w-[150px]" title={t.consigneeName}>
                        {t.consigneeName}
                      </td>
                      <td className="p-3 truncate max-w-[150px]" title={t.shipToParty}>
                        {t.shipToParty}
                      </td>
                      <td className="p-3 italic">
                        {t.from} → {t.destination}
                      </td>
                      <td className="p-3 text-right">{parseFloat(t.assignWeight || 0).toFixed(3)}</td>
                      <td className="p-3">{t.vehicleNo}</td>
                      <td className="p-3">{t.driverMobile}</td>
                      <td className="p-3">{t.cnNumber}</td>
                      <td className="p-3">{t.cnDate ? format(new Date(t.cnDate), 'dd-MMM-yyyy') : '-'}</td>
                      <td
                        className="p-3 truncate max-w-[150px]"
                        title={(t.invoices || []).map((i: any) => i.invNo).join(', ')}
                      >
                        {(t.invoices || []).map((i: any) => i.invNo).join(', ')}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          onClick={() => {
                            setSelectedTrip(t);
                            setView('mapping');
                          }}
                          variant="ghost"
                          className="h-7 w-7 p-0"
                        >
                          <Radar className="h-4 w-4 text-blue-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-10 font-mono bg-[#f2f2f2] text-black">
      <div className="max-w-4xl mx-auto w-full mt-20">
        <div className="bg-white border border-slate-300 p-12 space-y-12 shadow-md rounded-sm">
          <div className="flex flex-col items-center gap-2 mb-4">
            <Radar className="h-10 w-10 text-[#0056d2] animate-pulse" />
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-[#1e3a8a]">Shipment Trace Protocol</h2>
          </div>
          <div className="flex items-center gap-8 px-8">
            <label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase tracking-widest">
              Sale Order Number:
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
              className="h-10 w-full border border-slate-400 bg-white px-4 text-[12px] font-black outline-none uppercase shadow-inner focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleTrack}
              className="h-10 px-16 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
            >
              Track Movement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}