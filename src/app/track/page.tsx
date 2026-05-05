
'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { 
  Radar, Search, Package, Truck, CheckCircle, 
  Loader2, MapPin, ArrowLeft, 
  ShoppingCart, AlertTriangle, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SHARED_HUB_ID = 'Sikkaind';

export default function TrackPage() {
  const db = useFirestore();
  const [refType, setRefType] = React.useState('');
  const [refValue, setRefValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState<'search' | 'so_details' | 'track_view'>('search');
  const [trackingData, setTrackingData] = React.useState<any>(null);
  const [linkedTrips, setLinkedTrips] = React.useState<any[]>([]);
  const [activeStep, setActiveStep] = React.useState(-1);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [gpsData, setGpsData] = React.useState<any[]>([]);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: customers } = useCollection(customersQuery);

  React.useEffect(() => {
    const fetchGps = async () => { 
      try { 
        const res = await fetch('/api/gps'); 
        if (res.ok) { 
          const json = await res.json(); 
          if (json?.data?.list) setGpsData(json.data.list); 
        } 
      } catch (e) {} 
    };
    fetchGps(); 
    const i = setInterval(fetchGps, 30000); 
    return () => clearInterval(i);
  }, []);

  const handleTrackNow = () => {
    if (!refValue) return;
    setLoading(true);
    const val = refValue.trim().toUpperCase();
    
    setTimeout(() => {
      if (refType === 'Sale Order') {
        const order = orders?.find((o: any) => o.saleOrder === val || o.id === val);
        if (order) {
          setTrackingData(order);
          const tList = trips?.filter((t: any) => t.saleOrderId === order.id) || [];
          setLinkedTrips(tList);
          setView('so_details');
        } else { alert("Registry Failure: Sale Order Not Found"); }
      } else {
        const trip = trips?.find((t: any) => t.tripId === val || t.id === val);
        if (trip) {
          setTrackingData(trip);
          setLinkedTrips([trip]);
          setView('track_view');
          startAnimation(trip);
        } else { alert("Registry Failure: Trip ID Not Found"); }
      }
      setLoading(false);
    }, 800);
  };

  const startAnimation = (trip: any) => {
    let target = 0;
    if (trip.status === 'LOADING') target = 1;
    else if (trip.status === 'IN-TRANSIT') target = 2;
    else if (trip.status === 'ARRIVED') target = 3;
    else if (trip.status === 'CLOSED') target = 4;
    else if (trip.status === 'REJECTION') target = 4;

    let current = 0;
    setActiveStep(0);
    const interval = setInterval(() => {
      if (current < target) {
        current++;
        setActiveStep(current);
      } else {
        clearInterval(interval);
      }
    }, 2000);
  };

  const renderMap = () => {
    if (!window.google || !trackingData) return;
    const geocoder = new window.google.maps.Geocoder();
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#1e3a8a', strokeWeight: 5 }
    });
    
    // Find associated order
    const order = trackingData.saleOrderId ? orders?.find((o: any) => o.id === trackingData.saleOrderId) : trackingData;
    
    // Find master data for Start and Drop points from XD03 Saved Data
    const consignorMaster = customers?.find((c: any) => 
      c.customerName?.toUpperCase() === order?.consignor?.toUpperCase() || 
      (c.customerName + ' - ' + c.city)?.toUpperCase() === order?.consignor?.toUpperCase()
    );
    const shipToMaster = customers?.find((c: any) => 
      c.customerName?.toUpperCase() === order?.shipToParty?.toUpperCase() || 
      (c.customerName + ' - ' + c.city)?.toUpperCase() === order?.shipToParty?.toUpperCase()
    );

    const gps = gpsData.find(v => v.vehicleNumber?.toUpperCase() === trackingData.vehicleNumber?.toUpperCase());

    const p1 = new Promise((resolve) => {
      if (consignorMaster?.postalCode) {
        geocoder.geocode({ address: consignorMaster.postalCode }, (res, status) => {
          if (status === 'OK') resolve(res[0].geometry.location);
          else resolve(null);
        });
      } else resolve(null);
    });

    const p2 = new Promise((resolve) => {
      if (shipToMaster?.postalCode) {
        geocoder.geocode({ address: shipToMaster.postalCode }, (res, status) => {
          if (status === 'OK') resolve(res[0].geometry.location);
          else resolve(null);
        });
      } else resolve(null);
    });

    Promise.all([p1, p2]).then(([startLoc, endLoc]: any) => {
      if (!mapRef.current) return;
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: gps ? { lat: gps.latitude, lng: gps.longitude } : { lat: 20.5937, lng: 78.9629 },
        zoom: gps ? 12 : 5,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });
      directionsRenderer.setMap(map);

      if (startLoc) {
        new window.google.maps.Marker({
          position: startLoc,
          map,
          title: 'Start Point',
          icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        });
      }

      if (endLoc) {
        new window.google.maps.Marker({
          position: endLoc,
          map,
          title: 'Drop Point',
          icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        });
      }

      if (gps) {
        new window.google.maps.Marker({
          position: { lat: gps.latitude, lng: gps.longitude },
          map,
          title: gps.vehicleNumber,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/truck.png',
            scaledSize: new window.google.maps.Size(40, 40)
          }
        });
      }

      if (startLoc && endLoc) {
        const request: any = {
          origin: startLoc,
          destination: endLoc,
          travelMode: window.google.maps.TravelMode.DRIVING,
        };

        if (gps) {
          request.waypoints = [{
            location: { lat: gps.latitude, lng: gps.longitude },
            stopover: false
          }];
        }

        directionsService.route(request, (result, status) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(result);
          }
        });
      }
    });
  };

  React.useEffect(() => { if (view === 'track_view' && trackingData) renderMap(); }, [view, trackingData, gpsData]);

  if (view === 'search') {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex flex-col font-mono">
        <div className="bg-white border-b border-slate-300 px-8 py-4 mb-12 shadow-sm">
           <div className="max-w-7xl mx-auto flex items-center gap-6">
             <Radar className="h-6 w-6 text-[#1e3a8a]" />
             <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase italic">Track Shipment Interface</h1>
           </div>
        </div>
        <div className="max-w-4xl mx-auto w-full px-8 space-y-12">
          <div className="bg-white border border-slate-300 p-12 space-y-10 shadow-sm animate-fade-in">
            <div className="space-y-6">
              <div className="flex items-center gap-8">
                <label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase">Reference Type:</label>
                <select value={refType} onChange={e => setRefType(e.target.value)} className="h-9 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase">
                  <option value="">SELECT OPTION...</option>
                  <option value="Sale Order">Sale Order</option>
                  <option value="Trip ID">Trip ID</option>
                </select>
              </div>
              {refType && (
                <div className="flex items-center gap-8 animate-fade-in">
                  <label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase">{refType}:</label>
                  <input value={refValue} onChange={(e) => setRefValue(e.target.value)} className="h-9 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase tracking-widest" placeholder={`ENTER ${refType.toUpperCase()}...`} />
                </div>
              )}
            </div>
            <div className="pl-[212px] flex gap-4">
               <Button onClick={() => setRefValue('')} variant="outline" className="h-9 px-8 rounded-none border-slate-300 text-[10px] font-black uppercase">Clear</Button>
               <Button onClick={handleTrackNow} disabled={loading || !refType || !refValue} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Execute Tracking'}
               </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'so_details') {
    return (
      <div className="min-h-screen bg-[#f2f2f2] font-mono animate-fade-in">
        <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 flex items-center justify-between shadow-sm">
           <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">Order Registry Details</h2>
           <Button onClick={() => setView('search')} variant="outline" className="h-8 text-[9px] font-black uppercase rounded-none border-slate-300">New Search</Button>
        </div>
        <div className="max-w-5xl mx-auto px-8 space-y-12">
          <div className="bg-white border border-slate-300 p-10 space-y-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-32 uppercase tracking-tighter">Booked On:</label><span className="text-[12px] font-black uppercase">{format(new Date(trackingData.createdAt), 'dd-MMM-yyyy HH:mm')}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-32 uppercase tracking-tighter">Weight:</label><span className="text-[12px] font-black text-emerald-600">{trackingData.weight} {trackingData.weightUom}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-32 uppercase tracking-tighter">Consignor:</label><span className="text-[12px] font-black uppercase truncate">{trackingData.consignor}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-32 uppercase tracking-tighter">Consignee:</label><span className="text-[12px] font-black uppercase truncate">{trackingData.consignee}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-32 uppercase tracking-tighter">Ship To:</label><span className="text-[12px] font-black uppercase truncate">{trackingData.shipToParty}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-32 uppercase tracking-tighter">Route:</label><span className="text-[12px] font-black text-[#1e3a8a] uppercase">{trackingData.from} → {trackingData.destination}</span></div>
            </div>
            {trackingData.delayRemark && (
              <div className="p-6 bg-yellow-50 border border-yellow-200 animate-fade-in">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="h-4 w-4 text-yellow-700" />
                  <span className="text-[10px] font-black uppercase text-yellow-700 tracking-widest">Delay Registered by Logistics Hub</span>
                </div>
                <p className="text-[12px] font-black uppercase text-[#1e3a8a] italic">"{trackingData.delayRemark}"</p>
              </div>
            )}
            {linkedTrips && linkedTrips.length > 0 ? (
              <div className="bg-blue-50 border border-blue-100 p-8 space-y-4">
                <p className="text-[11px] font-black uppercase text-slate-500 tracking-tighter">Linked Logistical Nodes Found:</p>
                <div className="flex flex-wrap gap-4">
                  {linkedTrips.map((t: any) => (
                    <button 
                      key={t.id} 
                      onClick={() => { setTrackingData(t); startAnimation(t); setView('track_view'); }}
                      className="bg-white border border-[#1e3a8a] text-[#1e3a8a] px-6 py-3 text-[12px] font-black uppercase hover:bg-[#1e3a8a] hover:text-white transition-all shadow-md flex items-center gap-3 group"
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-500 group-hover:bg-white animate-pulse" />
                      TRACK TRIP: {t.tripId}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-100 p-8 text-center"><p className="text-sm font-black italic uppercase text-slate-800 leading-relaxed">Waiting for logistical node synchronization...</p></div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { label: 'Order Booked', icon: ShoppingCart },
    { label: 'Loading', icon: Package },
    { label: 'IN-Transit', icon: Truck },
    { label: 'Arrived', icon: MapPin },
    { label: trackingData.status === 'REJECTION' ? 'Reject' : 'Delivered', icon: trackingData.status === 'REJECTION' ? AlertTriangle : CheckCircle }
  ];

  return (
    <div className="min-h-screen bg-[#f2f2f2] font-mono animate-fade-in">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 flex items-center justify-between shadow-sm">
         <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">Live Logistical Node Tracker</h2>
         <Button onClick={() => setView(linkedTrips.length > 1 ? 'so_details' : 'search')} variant="outline" className="h-8 text-[9px] font-black uppercase rounded-none border-slate-300">Back</Button>
      </div>
      <div className="max-w-6xl mx-auto px-8 space-y-8 pb-20">
        <div className="bg-white border border-slate-300 p-8 space-y-10 shadow-sm relative overflow-hidden">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10 opacity-80 border-b border-slate-100 pb-8">
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[13px] font-black uppercase text-[#1e3a8a]">{trackingData.vehicleNumber}</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driver Registry</span><span className="text-[13px] font-black">{trackingData.driverMobile}</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Weight Node</span><span className="text-[13px] font-black text-emerald-600">{trackingData.assignWeight} MT</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route Hub</span><span className="text-[13px] font-black uppercase text-blue-600 truncate">{trackingData.route}</span></div>
           </div>
           <div className="py-12 relative flex justify-between px-8">
              {steps.map((s, i) => {
                const statusColor = i < activeStep ? "text-emerald-600" : i === activeStep ? "text-yellow-600" : "text-red-500";
                const iconColor = i < activeStep ? "bg-emerald-50 text-emerald-600 border-emerald-200" : i === activeStep ? "bg-yellow-50 text-yellow-600 border-yellow-300 shadow-md" : "bg-red-50 text-red-500 border-red-100";
                return (
                  <div key={s.label} className="flex flex-col items-center gap-4 group relative z-10">
                    <div className={cn("w-14 h-14 rounded-none border-2 flex items-center justify-center transition-all duration-500", iconColor)}>
                       <s.icon className="h-7 w-7" />
                    </div>
                    <div className="text-center">
                      <p className={cn("text-[10px] font-black uppercase tracking-widest", statusColor)}>{s.label}</p>
                      {i <= activeStep && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                          {format(new Date(trackingData.createdAt), 'dd-MMM-yy HH:mm')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="absolute top-[40px] left-[10%] right-[10%] h-px bg-slate-200 -z-0" />
              <div className="absolute top-[-5px] transition-all duration-[2000ms] ease-in-out" style={{ left: `${(activeStep / (steps.length - 1)) * 80 + 10}%`, transform: 'translateX(-50%)' }}>
                 <div className="bg-white p-3 shadow-2xl border border-blue-100 animate-bounce">
                    <Truck className={cn("h-11 w-11", trackingData.status === 'REJECTION' && activeStep === 4 ? "text-red-500 rotate-180" : "text-[#1e3a8a]")} />
                 </div>
              </div>
           </div>
           {trackingData.status === 'REJECTION' && <div className="mt-8 bg-red-50 border border-red-200 p-4 text-center"><p className="text-[10px] font-black text-red-600 uppercase italic">REJECTION REASON: {trackingData.rejectionRemark}</p></div>}
        </div>
        <div className="h-[450px] bg-white border border-slate-300 shadow-sm"><div ref={mapRef} className="w-full h-full" /></div>
        <div className="flex justify-between items-center px-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Sync: High-Density Node Tracking</p><Badge variant="outline" className="text-[8px] font-black bg-blue-50 border-blue-100 text-blue-800 rounded-none">TR24 SAP INTERFACE</Badge></div>
      </div>
    </div>
  );
}
