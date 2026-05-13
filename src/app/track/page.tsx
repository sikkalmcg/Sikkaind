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
      const order = orders?.find((o: any) => o.saleOrder === val);
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
    
    // Animation Logic
    let target = 0;
    if (trip.status === 'LOADING') target = 1;
    else if (trip.status === 'IN-TRANSIT') target = 2;
    else if (trip.status === 'ARRIVED') target = 3;
    else if (trip.status === 'CLOSED') target = 4;
    
    setActiveStep(0);
    let current = 0;
    const interval = setInterval(() => {
      if (current < target) {
        current++;
        setActiveStep(current);
      } else clearInterval(interval);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex flex-col font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-4 mb-8 shadow-sm">
         <div className="max-w-7xl mx-auto flex items-center justify-between">
           <div className="flex flex-col">
             <h1 className="text-xl font-black text-[#1e3a8a] italic uppercase tracking-tighter leading-none">SIKKA INDUSTRIES</h1>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">& LOGISTICS • LIVE SATELLITE TRACKING</span>
           </div>
           {view !== 'search' && <Button onClick={() => setView('search')} variant="outline" className="h-8 rounded-none text-[9px] font-black uppercase"><ArrowLeft className="h-3 w-3 mr-1" /> New Search</Button>}
         </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-8 flex-1">
        {view === 'search' && (
          <div className="bg-white border border-slate-300 p-12 space-y-10 shadow-lg mt-20 animate-fade-in">
             <div className="flex items-center gap-8">
                <label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase">Sale Order Number:</label>
                <input value={searchSo} onChange={(e) => setSearchSo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTrack()} className="h-9 w-[320px] border border-slate-400 bg-white px-3 text-[12px] font-black outline-none focus:bg-yellow-50 uppercase" placeholder="ENTER 10-DIGIT ORDER NO..." />
             </div>
             <div className="pl-[212px] flex gap-4">
                <Button onClick={handleTrack} className="h-10 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-xl hover:scale-105 transition-all">Track Node</Button>
             </div>
          </div>
        )}

        {view === 'order_details' && (
          <div className="bg-white border border-slate-300 p-10 space-y-12 shadow-lg animate-fade-in">
            <div className="grid grid-cols-2 gap-8 border-b pb-10">
               <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Consignor:</span><span className="text-xs font-black uppercase truncate">{selectedOrder.consignor}</span></div>
               <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Ship To Party:</span><span className="text-xs font-black uppercase truncate">{selectedOrder.shipToParty}</span></div>
            </div>
            {linkedTrips.length > 0 ? (
              <div className="space-y-6">
                <p className="text-[12px] font-black text-[#1e3a8a] italic uppercase leading-relaxed">
                  Sale order {selectedOrder.saleOrder} synchronized with {linkedTrips.length} execution trip(s). Select a Trip ID node for live mapping.
                </p>
                <div className="flex flex-wrap gap-4">
                  {linkedTrips.map(t => (
                    <button key={t.id} onClick={() => handleSelectTrip(t)} className="px-8 py-3 bg-blue-50 border border-blue-200 text-[#0056d2] font-black text-[11px] uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm">Execution Node: {t.tripId}</button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[12px] font-black text-orange-600 italic uppercase">Logistics Alert: Execution nodes not yet generated for order {selectedOrder.saleOrder}. Please check back shortly.</p>
            )}
          </div>
        )}

        {view === 'trip_tracking' && (
          <div className="space-y-8 pb-20 animate-fade-in">
            <div className="bg-white border border-slate-300 p-10 shadow-lg relative overflow-hidden">
               <div className="flex justify-between items-start mb-20">
                  <div className="space-y-1">
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Live Node Tracking: {selectedTrip.tripId}</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedTrip.vehicleNumber} • {selectedTrip.mode}</p>
                  </div>
                  <Badge className="bg-blue-600 rounded-none font-black text-[9px] px-6 uppercase">{selectedTrip.status}</Badge>
               </div>
               
               <div className="relative flex justify-between px-10 mb-20">
                  {['Booked', 'Loading', 'Transit', 'Arrived', 'Delivered'].map((step, i) => (
                    <div key={step} className="flex flex-col items-center gap-4 relative z-10">
                      <div className={cn("w-12 h-12 border-2 flex items-center justify-center transition-all duration-700", i <= activeStep ? "bg-blue-50 text-blue-600 border-blue-300" : "bg-white text-slate-100 border-slate-100")}>
                        {i === 0 && <ShoppingCart className="h-5 w-5" />}
                        {i === 1 && <Package className="h-5 w-5" />}
                        {i === 2 && <Truck className="h-5 w-5" />}
                        {i === 3 && <MapPin className="h-5 w-5" />}
                        {i === 4 && <CheckCircle className="h-5 w-5" />}
                      </div>
                      <span className={cn("text-[9px] font-black uppercase tracking-widest", i <= activeStep ? "text-blue-600" : "text-slate-300")}>{step}</span>
                    </div>
                  ))}
                  <div className="absolute top-6 left-[15%] right-[15%] h-[2px] bg-slate-100 -z-0" />
               </div>

               <div className="h-[450px] bg-slate-100 border border-slate-200 shadow-inner rounded-sm">
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase text-slate-400 italic">Sikka Satellite Gateway Synchronized • Google Maps Active</div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}