'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { 
  Radar, ShoppingCart, Package, Truck, MapPin, 
  CheckCircle, Loader2, ArrowLeft, AlertTriangle, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SHARED_HUB_ID = 'Sikkaind';

const formatWeight = (val: any) => {
  const num = parseFloat(val);
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export default function TrackPage() {
  const db = useFirestore();
  const [searchSo, setSearchSo] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState<'search' | 'order_details' | 'trip_tracking'>('search');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [linkedTrips, setLinkedTrips] = React.useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);
  const [activeStep, setActiveStep] = React.useState(0);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [gpsData, setGpsData] = React.useState<any[]>([]);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: customers } = useCollection(customersQuery);

  React.useEffect(() => {
    const scriptId = 'google-maps-api-loader';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

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

  const handleTrack = () => {
    if (!searchSo) return;
    setLoading(true);
    setTimeout(() => {
      const val = searchSo.trim().toUpperCase();
      const order = orders?.find((o: any) => o.saleOrder === val || o.id === val);
      if (order) {
        setSelectedOrder(order);
        const tList = trips?.filter((t: any) => t.saleOrderId === order.id) || [];
        setLinkedTrips(tList);
        setView('order_details');
      } else {
        alert("Registry Failure: Sale Order Not Found");
      }
      setLoading(false);
    }, 800);
  };

  const handleSelectTrip = (trip: any) => {
    setSelectedTrip(trip);
    setView('trip_tracking');
    startAnimation(trip);
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
    const forwardInterval = setInterval(() => {
      if (current < target) {
        current++;
        setActiveStep(current);
      } else {
        clearInterval(forwardInterval);
        if (trip.status === 'REJECTION') {
          setTimeout(() => {
            const backwardInterval = setInterval(() => {
              if (current > 0) {
                current--;
                setActiveStep(current);
              } else {
                clearInterval(backwardInterval);
              }
            }, 2000);
          }, 2000);
        }
      }
    }, 2000);
  };

  const renderMap = () => {
    if (!window.google || !selectedTrip || !mapRef.current) return;
    const geocoder = new window.google.maps.Geocoder();
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#1e3a8a', strokeWeight: 6 }
    });

    const order = selectedOrder;
    const consignorMaster = customers?.find((c: any) => c.customerName === order?.consignor || (c.customerName + ' - ' + c.city) === order?.consignor);
    const shipToMaster = customers?.find((c: any) => c.customerName === order?.shipToParty || (c.customerName + ' - ' + c.city) === order?.shipToParty);
    const gps = gpsData?.find((v: any) => v.vehicleNumber?.toUpperCase() === selectedTrip.vehicleNumber?.toUpperCase());

    const getLoc = (addr: string) => new Promise((resolve) => {
      geocoder.geocode({ address: addr }, (res, status) => {
        if (status === 'OK') resolve(res[0].geometry.location);
        else resolve(null);
      });
    });

    Promise.all([
      getLoc(consignorMaster?.postalCode || order?.from),
      getLoc(shipToMaster?.postalCode || order?.destination)
    ]).then(([startLoc, endLoc]: any) => {
      const map = new window.google.maps.Map(mapRef.current!, {
        center: gps ? { lat: parseFloat(gps.latitude), lng: parseFloat(gps.longitude) } : (startLoc || { lat: 20.5937, lng: 78.9629 }),
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false
      });
      directionsRenderer.setMap(map);

      if (startLoc) new window.google.maps.Marker({ position: startLoc, map, icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' });
      if (endLoc) new window.google.maps.Marker({ position: endLoc, map, icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' });
      
      if (gps) {
        new window.google.maps.Marker({
          position: { lat: parseFloat(gps.latitude), lng: parseFloat(gps.longitude) },
          map,
          icon: { url: 'https://maps.google.com/mapfiles/ms/icons/truck.png', scaledSize: new window.google.maps.Size(40, 40) }
        });
      }

      if (startLoc && endLoc) {
        const request: any = { origin: startLoc, destination: endLoc, travelMode: window.google.maps.TravelMode.DRIVING };
        if (gps) request.waypoints = [{ location: { lat: parseFloat(gps.latitude), lng: parseFloat(gps.longitude) }, stopover: false }];
        directionsService.route(request, (result, status) => {
          if (status === 'OK') directionsRenderer.setDirections(result);
        });
      }
    });
  };

  React.useEffect(() => { if (view === 'trip_tracking') renderMap(); }, [view, selectedTrip, gpsData]);

  if (view === 'search') {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex flex-col font-mono">
        <div className="bg-white border-b border-slate-300 px-8 py-4 mb-12 shadow-sm">
           <div className="max-w-7xl mx-auto flex items-center gap-6">
             <Radar className="h-6 w-6 text-[#1e3a8a]" />
             <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase italic">SIKKA LIVE TRACK SHIPMENT PLATFORM</h1>
           </div>
        </div>
        <div className="max-w-4xl mx-auto w-full px-8">
          <div className="bg-white border border-slate-300 p-12 space-y-10 shadow-sm animate-fade-in">
            <div className="flex items-center gap-8">
              <label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase">Sale Order:</label>
              <input value={searchSo} onChange={(e) => setSearchSo(e.target.value)} className="h-9 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase tracking-widest" placeholder="ENTER SALE ORDER..." />
            </div>
            <div className="pl-[212px] flex gap-4">
               <Button onClick={() => setSearchSo('')} variant="outline" className="h-9 px-8 rounded-none border-red-300 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase">Cancel</Button>
               <Button onClick={handleTrack} disabled={loading || !searchSo} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Track'}
               </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'order_details') {
    return (
      <div className="min-h-screen bg-[#f2f2f2] font-mono animate-fade-in">
        <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 flex items-center justify-between shadow-sm">
           <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">Order Details Node</h2>
           <Button onClick={() => setView('search')} variant="outline" className="h-8 text-[9px] font-black uppercase rounded-none border-slate-300">New Search</Button>
        </div>
        <div className="max-w-5xl mx-auto px-8">
          <div className="bg-white border border-slate-300 p-10 space-y-10 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6 mb-10">
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Order Date:</label><span className="text-[12px] font-black uppercase">{format(new Date(selectedOrder.saleOrderDate || selectedOrder.createdAt), 'dd-MMM-yyyy HH:mm')}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Consignor:</label><span className="text-[12px] font-black uppercase truncate">{selectedOrder.consignor}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Consignee:</label><span className="text-[12px] font-black uppercase truncate">{selectedOrder.consignee}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Ship to Party:</label><span className="text-[12px] font-black uppercase truncate">{selectedOrder.shipToParty}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Order Weight:</label><span className="text-[12px] font-black text-emerald-600">{formatWeight(selectedOrder.weight)} {selectedOrder.weightUom}</span></div>
              <div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Route:</label><span className="text-[12px] font-black text-[#1e3a8a] uppercase">{selectedOrder.from} → {selectedOrder.destination}</span></div>
            </div>

            <div className="pt-8 border-t border-slate-100">
              {linkedTrips.length > 0 ? (
                <div className="space-y-6">
                  <p className="text-[13px] font-black text-[#1e3a8a] uppercase leading-relaxed italic">
                    Sale order {selectedOrder.saleOrder} against Trip ID {linkedTrips.map(t => t.tripId).join(', ')} has been generated successfully. Click on Trip ID for track your Shipment.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {linkedTrips.map(t => (
                      <button key={t.id} onClick={() => handleSelectTrip(t)} className="px-8 py-2.5 bg-blue-50 border border-blue-200 text-[#0056d2] font-black text-[11px] uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm">Trip ID {t.tripId}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] font-black text-blue-800 uppercase italic leading-relaxed">Currently your sale order {selectedOrder.saleOrder} against Trip ID not generated, we will share trip ID shortly… Thanks for visit.</p>
              )}
            </div>
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
    { label: selectedTrip?.status === 'REJECTION' ? 'Reject' : 'Delivered', icon: selectedTrip?.status === 'REJECTION' ? AlertTriangle : CheckCircle }
  ];

  return (
    <div className="min-h-screen bg-[#f2f2f2] font-mono animate-fade-in pb-20">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 flex items-center justify-between shadow-sm">
         <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">Live Shipment Node Tracking</h2>
         <Button onClick={() => setView('order_details')} variant="outline" className="h-8 text-[9px] font-black uppercase rounded-none border-slate-300">Back</Button>
      </div>
      <div className="max-w-6xl mx-auto px-8 space-y-8">
        <div className="bg-white border border-slate-300 p-10 space-y-12 shadow-md relative overflow-hidden">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-6 mb-8 opacity-80 border-b border-slate-100 pb-10">
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{selectedTrip.shipToParty}</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Node</span><span className="text-[12px] font-black uppercase text-[#1e3a8a]">{selectedTrip.vehicleNumber}</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Weight</span><span className="text-[12px] font-black text-emerald-600">{formatWeight(selectedTrip.assignWeight)} {selectedTrip.weightUom}</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driver Mobile</span><span className="text-[12px] font-black">{selectedTrip.driverMobile}</span></div>
           </div>
           
           <div className="py-20 relative flex justify-between px-10">
              {steps.map((s, i) => {
                const isActive = i === activeStep;
                const isPast = i < activeStep;
                return (
                  <div key={s.label} className="flex flex-col items-center gap-6 group relative z-10">
                    <div className={cn(
                      "w-16 h-16 rounded-none border-2 flex items-center justify-center transition-all duration-700",
                      isPast ? "bg-emerald-50 text-emerald-600 border-emerald-200" : isActive ? "bg-yellow-50 text-yellow-600 border-yellow-300 shadow-2xl" : "bg-white text-slate-200 border-slate-100"
                    )}>
                       <s.icon className="h-8 w-8" />
                    </div>
                    <div className="text-center">
                      <p className={cn("text-[10px] font-black uppercase tracking-widest", isPast ? "text-emerald-600" : isActive ? "text-yellow-600" : "text-slate-300")}>{s.label}</p>
                      {(isPast || isActive) && <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">{format(new Date(selectedTrip.createdAt), 'dd-MMM HH:mm')}</p>}
                    </div>
                  </div>
                );
              })}
              <div className="absolute top-[52px] left-[10%] right-[10%] h-[2px] bg-slate-100 -z-0" />
              <div className="absolute top-[-15px] transition-all duration-[2000ms] ease-in-out z-20" style={{ left: `${(activeStep / (steps.length - 1)) * 80 + 10}%`, transform: 'translateX(-50%)' }}>
                 <div className="bg-white p-4 shadow-2xl border border-blue-100 animate-bounce">
                    <Truck className={cn("h-12 w-12", selectedTrip.status === 'REJECTION' && activeStep < 4 ? "text-red-500 rotate-180" : "text-[#1e3a8a]")} />
                 </div>
              </div>
           </div>

           {selectedTrip.status === 'REJECTION' && (
             <div className="mt-8 bg-red-50 border-2 border-red-100 p-6 flex items-center gap-6">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div>
                   <h3 className="text-[11px] font-black text-red-600 uppercase tracking-widest mb-1">Logistics Rejection Node</h3>
                   <p className="text-[13px] font-black text-red-800 uppercase italic">Reason: {selectedTrip.rejectionRemark || 'Administrative Exception'}</p>
                </div>
             </div>
           )}
        </div>
        <div className="h-[500px] bg-white border border-slate-300 shadow-xl overflow-hidden"><div ref={mapRef} className="w-full h-full" /></div>
        <div className="flex justify-between items-center px-4 italic text-[#1e3a8a] font-black text-[10px] uppercase tracking-widest">
           <span>Sikka Satellite Node Active – Live Coordinates Synchronized</span>
           <span>Sikka Industries & Logistics</span>
        </div>
      </div>
    </div>
  );
}
