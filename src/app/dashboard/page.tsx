
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Grid2X2, Package, Truck, Radar, ShoppingBag, XCircle,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const MASTER_TCODES = [
  { code: 'OX01', description: 'PLANT MASTER: CREATE', icon: Package, module: 'Master Data' },
  { code: 'FM01', description: 'COMPANY MASTER: CREATE', icon: Grid2X2, module: 'Master Data' },
  { code: 'XK01', description: 'VENDOR MASTER: CREATE', icon: Package, module: 'Master Data' },
  { code: 'XD01', description: 'CUSTOMER MASTER: CREATE', icon: ShoppingBag, module: 'Master Data' },
  { code: 'VA01', description: 'SALES ORDER: CREATE', icon: ShoppingBag, module: 'Logistics' },
  { code: 'VA04', description: 'SHORT CLOSE', icon: XCircle, module: 'Logistics' },
  { code: 'TR21', description: 'TRIP BOARD CONTROL', icon: Truck, module: 'Logistics' },
  { code: 'TR24', description: 'TRACK SHIPMENT', icon: Radar, module: 'Logistics' },
  { code: 'WGPS24', description: 'GPS TRACKING HUB', icon: Radar, module: 'Logistics' },
];

const SHARED_HUB_ID = 'Sikkaind'; 

export default function DashboardPage() {
  const router = useRouter();
  const db = useFirestore();
  
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL'); 
  const [homeMonthFilter, setHomeMonthFilter] = React.useState(format(new Date(), 'MMM-yyyy').toUpperCase());

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  
  const { data: allOrders } = useCollection(ordersQuery);
  const { data: allTrips } = useCollection(tripsQuery);
  const { data: rawPlants } = useCollection(plantsQuery);

  const homeStats = React.useMemo(() => {
    if (!allOrders || !allTrips) return { open: 0, loading: 0, transit: 0, arrived: 0, pod: 0, reject: 0, closed: 0 };
    
    const filteredOrders = allOrders.filter(o => o.status !== 'Short closed' && (homePlantFilter === 'ALL' || o.plantCode === homePlantFilter));
    const filteredTrips = allTrips.filter(t => (homePlantFilter === 'ALL' || t.plantCode === homePlantFilter));

    const openCount = filteredOrders.filter(o => {
      const ass = (allTrips || []).filter((t: any) => t.saleOrderId === o.id).reduce((a: number, t: any) => a + (parseFloat(t.assignWeight) || 0), 0);
      return (parseFloat(o.weight) - ass) > 0;
    }).length;

    return { 
      open: openCount, 
      loading: filteredTrips.filter(t => t.status === 'LOADING').length, 
      transit: filteredTrips.filter(t => t.status === 'IN-TRANSIT').length, 
      arrived: filteredTrips.filter(t => t.status === 'ARRIVED').length, 
      pod: filteredTrips.filter(t => t.status === 'POD').length, 
      reject: filteredTrips.filter(t => t.status === 'REJECTION').length, 
      closed: filteredTrips.filter(t => t.status === 'CLOSED').length 
    };
  }, [allOrders, allTrips, homePlantFilter]);

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-72 bg-white border-r border-slate-300 hidden lg:flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-[#dae4f1]/50">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1e3a8a] flex items-center gap-2"><Grid2X2 className="h-3.5 w-3.5" /> Favorites</h2>
        </div>
        <div className="flex-1 overflow-y-auto green-scrollbar">
          {MASTER_TCODES.map(t => (
            <div key={t.code} onClick={() => router.push(`/dashboard/${t.code.toLowerCase().substring(0, 2)}?tcode=${t.code}`)} className="flex items-center gap-4 px-5 py-3 hover:bg-blue-50 cursor-pointer group border-b border-slate-100 transition-all">
              <span className="text-[10px] font-black uppercase tracking-tight text-[#1e3a8a]">{t.code} - {t.description}</span>
              <div className="flex-1" />
              <t.icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-[#f2f2f2] animate-fade-in">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter leading-none">
            Sikka Industries & Logistics
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Logistics Management Control Node</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 border border-slate-300 shadow-sm mb-12">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plant Filter</label>
            <select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold outline-none focus:ring-1" value={homePlantFilter} onChange={e => setHomePlantFilter(e.target.value)}>
              <option value="ALL">ALL AUTHORIZED PLANTS</option>
              {(rawPlants || []).map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reporting Month</label>
            <button className="h-10 border border-slate-400 bg-white px-3 text-xs font-black uppercase flex items-center justify-between">{homeMonthFilter} <CalendarIcon className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[{ l: 'OPEN ORDER', c: homeStats.open, cl: 'text-blue-600' }, { l: 'LOADING', c: homeStats.loading, cl: 'text-orange-600' }, { l: 'IN-TRANSIT', c: homeStats.transit, cl: 'text-emerald-600' }, { l: 'ARRIVED', c: homeStats.arrived, cl: 'text-indigo-600' }, { l: 'POD', c: homeStats.pod, cl: 'text-purple-600' }, { l: 'REJECT', c: homeStats.reject, cl: 'text-red-600' }, { l: 'CLOSED', c: homeStats.closed, cl: 'text-slate-600' }].map(w => (
            <div key={w.l} className="p-6 border border-slate-200 shadow-md flex flex-col items-center justify-center gap-3 bg-white hover:scale-105 transition-all">
              <span className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest h-6 flex items-center">{w.l}</span>
              <span className={cn("text-3xl font-black italic tracking-tighter", w.cl)}>{w.c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
