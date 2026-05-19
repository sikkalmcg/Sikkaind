'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Grid2X2, Package, Truck, Radar, ShoppingBag, XCircle,
  Activity, BarChart3
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SHARED_HUB_ID = 'Sikkaind'; 

export default function DashboardPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));
    setMounted(true);
  }, []);

  const profileRef = useMemoFirebase(() => {
    if (!registryId || isBootstrapAdmin) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'users_master', registryId);
  }, [db, registryId, isBootstrapAdmin]);
  
  const { data: userProfile } = useDoc(profileRef);
  
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL'); 
  const [counts, setCounts] = React.useState({ open: 0, loading: 0, transit: 0, arrived: 0, pod: 0 });

  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const { data: allPlants } = useCollection(plantsQuery);

  const authorizedPlants = React.useMemo(() => {
    if (isBootstrapAdmin) return allPlants || [];
    const codes = userProfile?.plantAccess || [];
    return (allPlants || []).filter(p => codes.includes(p.plantCode));
  }, [allPlants, userProfile, isBootstrapAdmin]);

  // Set initial filter based on authorization
  React.useEffect(() => {
    if (authorizedPlants.length > 0 && homePlantFilter === 'ALL') {
      if (!isBootstrapAdmin) {
        setHomePlantFilter(authorizedPlants[0].plantCode);
      }
    }
  }, [authorizedPlants, homePlantFilter, isBootstrapAdmin]);

  React.useEffect(() => {
    const tripsRef = collection(db, 'users', SHARED_HUB_ID, 'trip_board');
    const ordersRef = collection(db, 'users', SHARED_HUB_ID, 'sales_orders');

    const unsubscribeTrips = onSnapshot(tripsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      const authCodes = authorizedPlants.map(p => p.plantCode);
      
      setCounts(prev => ({
        ...prev,
        loading: data.filter((t: any) => t.status === 'LOADING' && (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter)).length,
        transit: data.filter((t: any) => t.status === 'IN-TRANSIT' && (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter)).length,
        arrived: data.filter((t: any) => t.status === 'ARRIVED' && (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter)).length,
        pod: data.filter((t: any) => t.status === 'POD' && (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter)).length,
      }));
    });

    const unsubscribeOrders = onSnapshot(ordersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      const authCodes = authorizedPlants.map(p => p.plantCode);
      
      setCounts(prev => ({
        ...prev,
        open: data.filter((o: any) => o.status === 'Open' && (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(o.plantCode)) : o.plantCode === homePlantFilter)).length,
      }));
    });

    return () => { unsubscribeTrips(); unsubscribeOrders(); };
  }, [db, homePlantFilter, authorizedPlants, isBootstrapAdmin]);

  if (!mounted) return null;

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#f2f2f2] animate-fade-in text-[#333]">
      <div className="mb-10 flex justify-between items-end">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter leading-none">
            SIKKA INDUSTRIES
          </h1>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">
            & LOGISTICS • CONTROL CENTER
          </span>
        </div>
        <div className="flex gap-4">
           <div className="flex flex-col gap-1">
             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Authorized Plant Filter</label>
             <select 
               className="h-8 border border-slate-300 bg-white px-2 text-[10px] font-black uppercase outline-none focus:ring-1 focus:bg-yellow-50 min-w-[150px]" 
               value={homePlantFilter} 
               onChange={e => setHomePlantFilter(e.target.value)}
             >
               {isBootstrapAdmin && <option value="ALL">ALL PLANTS</option>}
               {authorizedPlants.map(p => (
                 <option key={p.id} value={p.plantCode}>PLANT {p.plantCode}</option>
               ))}
               {!isBootstrapAdmin && authorizedPlants.length === 0 && <option value="">NO ACCESS</option>}
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
    </div>
  );
}

