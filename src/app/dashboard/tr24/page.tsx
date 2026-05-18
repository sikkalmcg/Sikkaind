'use client';

import * as React from 'react';
import { Radar, Truck, MapPin, Search, Map as MapIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SHARED_HUB_ID = 'Sikkaind';

export default function TR24Page() {
  const db = useFirestore();
  const [view, setView] = React.useState<'search' | 'details' | 'mapping'>('search');
  const [q, setQ] = React.useState('');
  const [order, setOrder] = React.useState<any>(null);
  const [tripsList, setTripsList] = React.useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);
  const [gpsLive, setGpsLive] = React.useState<any[]>([]);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const settingsRef = useMemoFirebase(() => doc(db, 'users', SHARED_HUB_ID, 'gps_tracking', 'settings'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: settings } = useDoc(settingsRef);

  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstance = React.useRef<any>(null);

  React.useEffect(() => {
    const fetchGps = async () => {
      try {
        const res = await fetch('/api/gps');
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.list) setGpsLive(json.data.list);
        }
      } catch (e) { console.error(e); }
    };
    fetchGps();
  }, []);

  const handleTrack = () => {
    const val = q.toUpperCase().trim();
    if (!val) return;

    const ord = orders?.find(o => o.orderNo === val);
    if (ord) {
      setOrder(ord);
      const linked = trips?.filter(t => t.orderNo === val) || [];
      setTripsList(linked);
      setView('details');
    } else {
      alert("Order Not Found in Registry");
    }
  };

  const getCustomerPincode = (code: string) => {
    if (!customers || !code) return '-';
    const found = customers.find(c => c.customerCode === code || c.id === code);
    return found?.pincode || found?.postalCode || '-';
  };

  React.useEffect(() => {
    if (view === 'mapping' && selectedTrip && mapContainerRef.current && window.google) {
      const liveNode = gpsLive.find(n => n.vehicleNumber?.trim() === selectedTrip.vehicleNo?.trim());
      const lat = liveNode ? parseFloat(liveNode.latitude) : 20.5937;
      const lng = liveNode ? parseFloat(liveNode.longitude) : 78.9629;

      mapInstance.current = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat, lng },
        zoom: 12,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
      });

      new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstance.current,
        icon: {
          url: liveNode?.status === 'RUNNING' ? (settings?.activeIcon || 'https://maps.google.com/mapfiles/ms/icons/green-dot.png') : (settings?.stoppedIcon || 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'),
          scaledSize: new window.google.maps.Size(42, 42),
          anchor: new window.google.maps.Point(21, 21)
        }
      });
    }
  }, [view, selectedTrip, gpsLive, settings]);

  if (view === 'mapping' && selectedTrip) {
    const startPin = getCustomerPincode(selectedTrip.consignorCode);
    const dropPin = getCustomerPincode(selectedTrip.shipToPartyCode);

    return (
      <div className="flex-1 flex flex-col p-8 font-mono bg-[#f2f2f2] text-black">
        <div className="bg-white border border-slate-300 p-8 shadow-sm space-y-8 animate-fade-in">
           <div className="flex justify-between items-start border-b border-slate-100 pb-6">
              <div className="space-y-1">
                 <h3 className="text-[14px] font-black uppercase text-[#1e3a8a] italic tracking-tighter">Live Execution Trace: {selectedTrip.tripNo}</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedTrip.vehicleNo} • {selectedTrip.mode}</p>
              </div>
              <div className="flex gap-4">
                 <Badge className="bg-[#0056d2] rounded-none font-black text-[9px] px-6 uppercase shadow-lg">{selectedTrip.status}</Badge>
                 <Button onClick={() => setView('details')} variant="outline" className="h-8 rounded-none text-[9px] font-black uppercase">Back to Trips</Button>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div className="p-6 bg-slate-50 border border-slate-200 space-y-4 shadow-inner">
                    <div className="flex items-start gap-4">
                       <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-200">
                          <MapPin className="h-4 w-4 text-emerald-600" />
                       </div>
                       <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Start Point Mark</span>
                          <p className="text-xs font-black text-slate-800 uppercase italic">PIN: {startPin} ({selectedTrip.from})</p>
                       </div>
                    </div>
                    <div className="h-10 w-[1.5px] bg-slate-200 ml-4" />
                    <div className="flex items-start gap-4">
                       <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
                          <Truck className="h-4 w-4 text-blue-600" />
                       </div>
                       <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Payload</span>
                          <p className="text-xs font-black text-slate-800 uppercase italic">{selectedTrip.assignWeight} MT - IN TRANSIT</p>
                       </div>
                    </div>
                    <div className="h-10 w-[1.5px] bg-slate-200 ml-4" />
                    <div className="flex items-start gap-4">
                       <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 border border-red-200">
                          <MapPin className="h-4 w-4 text-red-600" />
                       </div>
                       <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Drop Point Mark</span>
                          <p className="text-xs font-black text-slate-800 uppercase italic">PIN: {dropPin} ({selectedTrip.destination})</p>
                       </div>
                    </div>
                 </div>
              </div>
              <div ref={mapContainerRef} className="bg-slate-100 border-2 border-slate-300 relative min-h-[350px] shadow-lg" />
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
              <h2 className="text-xl font-black uppercase italic text-[#1e3a8a] tracking-tighter">Shipment Overview: {order.orderNo}</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">System Booking Entry</span>
            </div>
            <Button onClick={() => setView('search')} variant="outline" className="h-8 rounded-none uppercase text-[9px] font-black px-10 border-slate-300">New Search</Button>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-[11px] font-bold uppercase bg-slate-50 p-6 shadow-inner">
             <div className="flex flex-col gap-1.5"><span className="text-slate-400 text-[9px] font-black tracking-widest">Ship To Party</span><p className="truncate" title={order.shipToParty}>{order.shipToParty}</p></div>
             <div className="flex flex-col gap-1.5"><span className="text-slate-400 text-[9px] font-black tracking-widest">Destination</span><p>{order.destination}</p></div>
             <div className="flex flex-col gap-1.5"><span className="text-slate-400 text-[9px] font-black tracking-widest">Registry Qty</span><p className="text-blue-700">{order.quantity} MT</p></div>
             <div className="flex flex-col gap-1.5"><span className="text-slate-400 text-[9px] font-black tracking-widest">Status</span><Badge className="bg-emerald-600 rounded-none w-fit h-4 text-[8px] uppercase">{order.status}</Badge></div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] font-black uppercase italic text-slate-600 border-b-2 border-blue-100 w-fit pb-1">Linked Trip Executions ({tripsList.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {tripsList.map(t => (
                 <div key={t.id} onClick={() => { setSelectedTrip(t); setView('mapping'); }} className="border border-slate-200 p-5 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group shadow-sm bg-white">
                    <div className="flex justify-between items-start mb-3">
                       <span className="text-[#0056d2] font-black text-[12px]">{t.tripNo}</span>
                       <Radar className="h-3 w-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-[11px] font-black text-slate-800">{t.vehicleNo}</p>
                       <div className="flex justify-between text-[9px] font-bold text-slate-400">
                          <span>QTY: {t.assignWeight} MT</span>
                          <span className="text-emerald-600 uppercase">{t.status}</span>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-10 font-mono bg-[#f2f2f2] animate-fade-in text-black">
       <div className="max-w-4xl mx-auto w-full mt-20">
         <div className="bg-white border border-slate-300 p-12 space-y-12 shadow-md rounded-sm">
            <div className="flex flex-col items-center gap-2 mb-4">
               <Radar className="h-10 w-10 text-[#0056d2] animate-pulse" />
               <h2 className="text-xl font-black uppercase italic tracking-tighter text-[#1e3a8a]">Shipment Trace Protocol</h2>
            </div>
            <div className="flex items-center gap-8 px-8">
              <label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase tracking-widest">Sale Order Number:</label>
              <input 
                value={q} 
                onChange={e => setQ(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleTrack()}
                className="h-10 w-full border border-slate-400 bg-white px-4 text-[12px] font-black outline-none uppercase shadow-inner focus:ring-1 focus:ring-blue-500" 
                placeholder="ENTER 10-DIGIT NO..." 
              />
            </div>
            <div className="flex justify-center gap-4">
              <Button onClick={handleTrack} className="h-10 px-16 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Track Movement</Button>
            </div>
         </div>
       </div>
    </div>
  );
}
