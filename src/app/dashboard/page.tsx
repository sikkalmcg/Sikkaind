'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Grid2X2, Package, Truck, Radar, ShoppingBag, XCircle,
  Calendar as CalendarIcon, Activity, BarChart3, Badge
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind'; 

const FAVORITE_TCODES = [
  { code: 'OX03', description: 'PLANT MASTER PREVIEW', icon: Package },
  { code: 'FM03', description: 'COMPANY MASTER PREVIEW', icon: Grid2X2 },
  { code: 'XK03', description: 'VENDOR MASTER PREVIEW', icon: Package },
  { code: 'XD03', description: 'CUSTOMER MASTER PREVIEW', icon: ShoppingBag },
  { code: 'VA03', description: 'SALES ORDER PREVIEW', icon: ShoppingBag },
  { code: 'TR21', description: 'TRIP BOARD CONTROL', icon: Truck },
  { code: 'WGPS24', description: 'GPS TRACKING HUB', icon: Radar },
];

export default function DashboardPage() {
  const router = useRouter();
  const db = useFirestore();
  
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL'); 
  const [counts, setCounts] = React.useState({ open: 0, loading: 0, transit: 0, arrived: 0, pod: 0 });

  React.useEffect(() => {
    // Real-time synchronization for dashboard widgets
    const tripsRef = collection(db, 'users', SHARED_HUB_ID, 'trips');
    const ordersRef = collection(db, 'users', SHARED_HUB_ID, 'sales_orders');

    const unsubscribeTrips = onSnapshot(tripsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setCounts(prev => ({
        ...prev,
        loading: data.filter((t: any) => t.status === 'LOADING' && (homePlantFilter === 'ALL' || t.plantCode === homePlantFilter)).length,
        transit: data.filter((t: any) => t.status === 'IN-TRANSIT' && (homePlantFilter === 'ALL' || t.plantCode === homePlantFilter)).length,
        arrived: data.filter((t: any) => t.status === 'ARRIVED' && (homePlantFilter === 'ALL' || t.plantCode === homePlantFilter)).length,
        pod: data.filter((t: any) => t.status === 'POD' && (homePlantFilter === 'ALL' || t.plantCode === homePlantFilter)).length,
      }));
    });

    const unsubscribeOrders = onSnapshot(ordersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setCounts(prev => ({
        ...prev,
        open: data.filter((o: any) => o.status === 'Open' && (homePlantFilter === 'ALL' || o.plantCode === homePlantFilter)).length,
      }));
    });

    return () => { unsubscribeTrips(); unsubscribeOrders(); };
  }, [db, homePlantFilter]);

  const handleNavigate = (code: string) => {
    const c = code.toUpperCase();
    let target = c.substring(0, 2).toLowerCase();
    
    // SAP Routing logic for specialized T-Codes
    if (c === 'TR21') target = 'tr21';
    else if (c === 'TR24') target = 'tr24';
    else if (c === 'WGPS24') target = 'wgsp24';

    router.push(`/dashboard/${target}?tcode=${c}`);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-72 bg-white border-r border-slate-300 hidden lg:flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-[#dae4f1]/50">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1e3a8a] flex items-center gap-2"><Grid2X2 className="h-3.5 w-3.5" /> Quick Access Hub</h2>
        </div>
        <div className="flex-1 overflow-y-auto green-scrollbar">
          {FAVORITE_TCODES.map(t => (
            <div key={t.code} onClick={() => handleNavigate(t.code)} className="flex items-center gap-4 px-5 py-3 hover:bg-blue-50 cursor-pointer group border-b border-slate-100 transition-all">
              <span className="text-[10px] font-black uppercase tracking-tight text-[#1e3a8a]">{t.code} - {t.description}</span>
              <div className="flex-1" />
              <t.icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-[#f2f2f2] animate-fade-in text-[#333]">
        <div className="mb-10 flex justify-between items-end">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter leading-none">
              SIKKA INDUSTRIES
            </h1>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">
              & LOGISTICS • NODE CONTROL CENTER
            </span>
          </div>
          <div className="flex gap-4">
             <div className="flex flex-col gap-1">
               <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Global Plant Filter</label>
               <select className="h-8 border border-slate-300 bg-white px-2 text-[10px] font-black uppercase outline-none focus:ring-1 focus:bg-yellow-50" value={homePlantFilter} onChange={e => setHomePlantFilter(e.target.value)}>
                 <option value="ALL">ALL NODES</option>
                 <option value="IMPC">PLANT IMPC</option>
                 <option value="ID20">PLANT ID20</option>
                 <option value="ID23">PLANT ID23</option>
               </select>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
          {[
            { l: 'OPEN ORDER', c: counts.open, cl: 'text-blue-600' }, 
            { l: 'LOADING', c: counts.loading, cl: 'text-orange-600' }, 
            { l: 'IN-TRANSIT', c: counts.transit, cl: 'text-emerald-600' }, 
            { l: 'ARRIVED', c: counts.arrived, cl: 'text-indigo-600' }, 
            { l: 'POD VERIFY', c: counts.pod, cl: 'text-purple-600' }
          ].map(w => (
            <div key={w.l} className="p-6 border border-slate-200 shadow-md flex flex-col items-center justify-center gap-3 bg-white hover:scale-105 transition-all cursor-default group">
              <span className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest h-6 flex items-center group-hover:text-blue-600 transition-colors">{w.l}</span>
              <span className={cn("text-3xl font-black italic tracking-tighter", w.cl)}>{w.c}</span>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
           <div className="bg-white border border-slate-300 p-6 shadow-sm">
              <h3 className="text-[11px] font-black uppercase text-slate-400 border-b pb-2 mb-4 flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Moving Stock Registry</h3>
              <div className="h-40 flex items-center justify-center text-[10px] font-black text-slate-300 uppercase italic">Camera Stream Node Active</div>
           </div>
           <div className="bg-white border border-slate-300 p-6 shadow-sm">
              <h3 className="text-[11px] font-black uppercase text-slate-400 border-b pb-2 mb-4 flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" /> Stacking Statistics</h3>
              <div className="h-40 flex items-center justify-center text-[10px] font-black text-slate-300 uppercase italic">Object Counting: Box/Bag Node</div>
           </div>
           <div className="bg-white border border-slate-300 p-6 shadow-sm">
              <h3 className="text-[11px] font-black uppercase text-slate-400 border-b pb-2 mb-4">Node Health Status</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase"><span>Satellite Sync</span><Badge className="bg-emerald-500 rounded-none h-4 px-2">ACTIVE</Badge></div>
                 <div className="flex justify-between items-center text-[10px] font-black uppercase"><span>Database Latency</span><span className="text-slate-400">12ms</span></div>
                 <div className="flex justify-between items-center text-[10px] font-black uppercase"><span>API Handshake</span><Badge className="bg-blue-500 rounded-none h-4 px-2">VERIFIED</Badge></div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
