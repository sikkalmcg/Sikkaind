
'use client';

import * as React from 'react';
import { 
  Radar, Search, Package, Truck, CheckCircle, 
  AlertCircle, Loader2, MapPin, User, ArrowLeft, 
  ShoppingCart, AlertTriangle, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';

export default function TrackPage() {
  const db = useFirestore();
  const [refType, setRefType] = React.useState('');
  const [refValue, setRefValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState<'search' | 'so_details' | 'track_view'>('search');
  const [trackingData, setTrackingData] = React.useState<any>(null);
  const [linkedTrip, setLinkedTrip] = React.useState<any>(null);
  const [activeStep, setActiveStep] = React.useState(-1);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [gpsData, setGpsData] = React.useState<any[]>([]);

  const { data: orders } = useCollection(collection(db, 'users', SHARED_HUB_ID, 'sales_orders'));
  const { data: trips } = useCollection(collection(db, 'users', SHARED_HUB_ID, 'trips'));

  React.useEffect(() => {
    const fetchGps = async () => { try { const res = await fetch('/api/gps'); if (res.ok) { const json = await res.json(); if (json?.data?.list) setGpsData(json.data.list); } } catch (e) {} };
    fetchGps(); const i = setInterval(fetchGps, 30000); return () => clearInterval(i);
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
          const trip = trips?.find((t: any) => t.saleOrderId === order.id);
          setLinkedTrip(trip || null);
          setView('so_details');
        } else { alert("Registry Failure: Sale Order Not Found"); }
      } else {
        const trip = trips?.find((t: any) => t.tripId === val || t.id === val);
        if (trip) {
          setTrackingData(trip);
          setLinkedTrip(trip);
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
    if (!window.google || !trackingData || !linkedTrip) return;
    const geocoder = new window.google.maps.Geocoder();
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({ suppressMarkers: true, polylineOptions: { strokeColor: '#1e3a8a', strokeWeight: 5 } });
    
    geocoder.geocode({ address: 'India' }, (res: any) => {
      if (!mapRef.current) return;
      const map = new window.google.maps.Map(mapRef.current, { center: { lat: 20, lng: 78 }, zoom: 5 });
      directionsRenderer.setMap(map);
      const gps = gpsData.find(v => v.vehicleNumber === linkedTrip.vehicleNumber);
      if (gps) new window.google.maps.Marker({ position: { lat: gps.latitude, lng: gps.longitude }, map, icon: { url: 'https://maps.google.com/mapfiles/ms/icons/truck.png', scaledSize: new window.google.maps.Size(40, 40) } });
    });
  };

  React.useEffect(() => { if (view === 'track_view' && trackingData) renderMap(); }, [view, trackingData, gpsData]);

  if (view === 'search') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 py-12 font-mono">
        <div className="w-full max-w-2xl space-y-10 bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-slide-up">
          <div className="flex flex-col items-center gap-6">
            <div className="p-5 bg-blue-900 rounded-[1.5rem] shadow-xl shadow-blue-900/20"><Radar className="h-10 w-10 text-white" /></div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic text-center">Track Shipment</h1>
          </div>
          <div className="space-y-8">
            <div className="space-y-2.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Reference Type *</label>
              <select value={refType} onChange={e => setRefType(e.target.value)} className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-black focus:ring-2 focus:ring-blue-600 outline-none">
                <option value="">Select Option...</option>
                <option value="Sale Order">Sale Order</option>
                <option value="Trip ID">Trip ID</option>
              </select>
            </div>
            {refType && (
              <div className="space-y-2.5 animate-fade-in">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">{refType} *</label>
                <Input value={refValue} onChange={(e) => setRefValue(e.target.value)} className="h-16 rounded-2xl font-black text-center text-slate-700 bg-slate-50 border-slate-100 text-lg uppercase tracking-wider focus:ring-blue-600 transition-all" placeholder={`ENTER ${refType.toUpperCase()}...`} />
              </div>
            )}
            <div className="flex gap-4">
               <Button onClick={() => setRefValue('')} className="flex-1 h-16 bg-red-600 hover:bg-red-700 font-black uppercase text-xs tracking-[0.4em] rounded-2xl shadow-xl transition-all">Cancel</Button>
               <Button onClick={handleTrackNow} disabled={loading || !refType || !refValue} className="flex-[2] h-16 bg-blue-900 hover:bg-black font-black uppercase text-xs tracking-[0.4em] rounded-2xl shadow-xl transition-all flex items-center justify-center gap-4 disabled:opacity-50">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />} Track Now
               </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'so_details') {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-mono animate-fade-in">
        <div className="max-w-4xl mx-auto space-y-6">
          <button onClick={() => setView('search')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-900 transition-colors"><ArrowLeft className="h-3 w-3" /> BACK TO SEARCH</button>
          <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Booked On</span><span className="text-[11px] font-black uppercase">{format(new Date(trackingData.createdAt), 'dd-MMM-yyyy HH:mm')}</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Weight</span><span className="text-[11px] font-black text-emerald-600">{trackingData.weight} {trackingData.weightUom}</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[11px] font-black text-[#1e3a8a] uppercase">{trackingData.from} → {trackingData.destination}</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Consignor</span><span className="text-[11px] font-black uppercase truncate">{trackingData.consignor}</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Consignee</span><span className="text-[11px] font-black uppercase truncate">{trackingData.consignee}</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ship To</span><span className="text-[11px] font-black uppercase truncate">{trackingData.shipToParty}</span></div>
            </div>
            {linkedTrip ? (
              <div className="bg-blue-50 border-l-[6px] border-blue-600 p-8 rounded-2xl text-center"><p className="text-sm font-black italic uppercase text-slate-800 leading-relaxed">Sale order {trackingData.saleOrder} against Trip ID <button onClick={() => { setTrackingData(linkedTrip); startAnimation(linkedTrip); setView('track_view'); }} className="text-blue-600 underline decoration-2">{linkedTrip.tripId}</button> has been generated successfully. Click on Trip ID for track your Shipment</p></div>
            ) : (
              <div className="bg-orange-50 border-l-[6px] border-orange-500 p-8 rounded-2xl text-center"><p className="text-sm font-black italic uppercase text-slate-800 leading-relaxed">Currently your sale order {trackingData.saleOrder} against Trip ID not generated, we will share trip ID shortly… Thanks for visit.</p></div>
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
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-mono animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={() => setView('search')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-900 transition-colors"><ArrowLeft className="h-3 w-3" /> BACK TO SEARCH</button>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border-t-[6px] border-blue-600">
           <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-10 opacity-80">
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Vehicle</span><span className="text-sm font-black uppercase">{trackingData.vehicleNumber}</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Driver</span><span className="text-sm font-black">{trackingData.driverMobile}</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Weight</span><span className="text-sm font-black text-emerald-600">{trackingData.assignWeight} MT</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Consignee</span><span className="text-[10px] font-black uppercase truncate">{trackingData.consignee}</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Ship To</span><span className="text-[10px] font-black uppercase truncate">{trackingData.shipToParty}</span></div>
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Route</span><span className="text-[10px] font-black uppercase truncate text-blue-600">{trackingData.route}</span></div>
           </div>
           <div className="py-12 relative flex justify-between px-4">
              {steps.map((s, i) => {
                let statusColor = "text-red-500";
                let iconColor = "bg-red-50 text-red-500 border-red-200";
                if (i < activeStep) {
                  statusColor = "text-emerald-500";
                  iconColor = "bg-emerald-50 text-emerald-500 border-emerald-200";
                } else if (i === activeStep) {
                  statusColor = "text-yellow-600";
                  iconColor = "bg-yellow-50 text-yellow-600 border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.2)]";
                }

                return (
                  <div key={s.label} className="flex flex-col items-center gap-4 group relative z-10">
                    <div className={cn("w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 shadow-sm", iconColor)}>
                       <s.icon className="h-6 w-6 drop-shadow-md" />
                    </div>
                    <div className="text-center">
                      <p className={cn("text-[8px] md:text-[10px] font-black uppercase tracking-widest", statusColor)}>{s.label}</p>
                      {i <= activeStep && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                          {format(new Date(trackingData.createdAt), 'dd-MMM-yy HH:mm')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="absolute top-[35px] left-[10%] right-[10%] h-0.5 bg-slate-100 -z-0" />
              
              {/* Jumbo 3D Truck Animation */}
              <div 
                className="absolute top-[-5px] transition-all duration-[2000ms] ease-in-out"
                style={{ 
                  left: `${(activeStep / (steps.length - 1)) * 80 + 10}%`,
                  transform: 'translateX(-50%)'
                }}
              >
                 <div className="bg-white p-3 rounded-full shadow-2xl border border-blue-100 animate-bounce">
                    <Truck className={cn("h-10 w-10", trackingData.status === 'REJECTION' && activeStep === 4 ? "text-red-500 rotate-180" : "text-[#1e3a8a]")} />
                 </div>
              </div>
           </div>
           {trackingData.status === 'REJECTION' && <div className="mt-6 bg-red-50 border border-red-200 p-4 rounded-xl text-center"><p className="text-[10px] font-black text-red-600 uppercase italic">REJECTION REASON: {trackingData.rejectionRemark || 'NODE REJECTED BY CONSIGNEE'}</p></div>}
        </div>
        <div className="h-[450px] bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl"><div ref={mapRef} className="w-full h-full" /></div>
        <div className="flex justify-between items-center px-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Sync: Active node tracking</p><Badge variant="outline" className="text-[8px] font-black bg-blue-50 border-blue-100 text-blue-800">TR24 INTERFACE</Badge></div>
      </div>
    </div>
  );
}
