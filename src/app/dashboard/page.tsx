'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Grid2X2, Package, Truck, Radar, ShoppingBag, XCircle,
  Activity, BarChart3
} from 'lucide-react';
import { useMongoStore, useCollectionOptimized, useMemoMongo, useUser, useDoc } from '@/mongodb';
import { collection, onSnapshot, doc } from '@/lib/mongo-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SHARED_HUB_ID = 'Sikkaind'; 

// Stats card with skeleton
function StatCard({ label, count, className }: { label: string; count: number | null; className: string }) {
  return (
    <div className="p-6 border border-slate-200 shadow-md flex flex-col items-center justify-center gap-3 bg-white hover:scale-105 transition-all cursor-default group">
      <span className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest h-6 flex items-center group-hover:text-blue-600 transition-colors">
        {label}
      </span>
      {count === null ? (
        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
      ) : (
        <span className={cn("text-3xl font-black italic tracking-tighter", className)}>
          {count}
        </span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const db = useMongoStore();
  const { user } = useUser();
  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));

    // CHANGES: By default aaj ki date set karne wala logic hata diya hai, 
    // taaki initial load par poora data aggregate hokar show ho.
    setSelectedDate('');

    setMounted(true);
  }, []);

  const profileRef = useMemoMongo(() => {
    if (!registryId || isBootstrapAdmin) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'users_master', registryId);
  }, [db, registryId, isBootstrapAdmin]);
  
  const { data: userProfile } = useDoc(profileRef);
  
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL');
  const [selectedDate, setSelectedDate] = React.useState<string>('');
  const [counts, setCounts] = React.useState<{
    open: number | null;
    loading: number | null;
    transit: number | null;
    arrived: number | null;
    pod: number | null;
    schedule: number | null;
    dispatched: number | null;
    dispatchedTotal: number | null;
  }>({
    open: null,
    loading: null,
    transit: null,
    arrived: null,
    pod: null,
    schedule: null,
    dispatched: null,
    dispatchedTotal: null,
  });


  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const { data: allPlants } = useCollectionOptimized(plantsQuery);

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

  // Optimized: Use ref instead of refetch to reduce re-renders
  React.useEffect(() => {
    if (!db) return;

    const tripsRef = collection(db, 'users', SHARED_HUB_ID, 'trip_board');
    const ordersRef = collection(db, 'users', SHARED_HUB_ID, 'sales_orders');

    const selectedDayISO = selectedDate
      ? new Date(selectedDate + 'T00:00:00.000Z')
      : null;

    const isSameDay = (value: any) => {
      // CHANGES: Agar selectedDate khali ('') hai, toh filter bypass hoga aur saara data count hoga
      if (!selectedDate || !selectedDayISO) return true;
      if (!value) return false;

      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return false;

      return d.getUTCFullYear() === selectedDayISO.getUTCFullYear() &&
        d.getUTCMonth() === selectedDayISO.getUTCMonth() &&
        d.getUTCDate() === selectedDayISO.getUTCDate();
    };

    // Batch updates to reduce state changes
    let tripsData: any[] = [];
    let ordersData: any[] = [];
    let updateTimer: NodeJS.Timeout;

    const updateCounts = () => {
      const authCodes = authorizedPlants.map(p => p.plantCode);

      const filteredOrders = ordersData.filter((o: any) => 
        (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(o.plantCode)) : o.plantCode === homePlantFilter) &&
        (isSameDay(o.createdAt) || isSameDay(o.orderDate) || isSameDay(o.updatedAt))
      );

      const filteredTrips = tripsData.filter((t: any) => 
        (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter) &&
        (isSameDay(t.createdAt) || isSameDay(t.assignDate) || isSameDay(t.updatedAt))
      );

      setCounts({
        open: filteredOrders.filter((o: any) => o.status === 'Open').map((o: any) => {
          const dispatched = filteredTrips.filter((t: any) => t.orderNo === o.orderNo && t.status !== 'REJECTION')
                                  .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
          const weight = parseFloat(o.quantity) || 0;
          return { ...o, balance: weight - dispatched };
        }).filter((o: any) => o.balance > 0.001).length,
        loading: tripsData.filter((t: any) => t.status === 'LOADING' &&
          (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter) &&
          (isSameDay(t.createdAt) || isSameDay(t.assignDate) || isSameDay(t.updatedAt) )
        ).length,
        transit: tripsData.filter((t: any) => t.status === 'IN-TRANSIT' &&
          (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter) &&
          (isSameDay(t.createdAt) || isSameDay(t.assignDate) || isSameDay(t.updatedAt))
        ).length,
        arrived: tripsData.filter((t: any) => t.status === 'ARRIVED' &&
          (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter) &&
          (isSameDay(t.createdAt) || isSameDay(t.updatedAt) )
        ).length,
        pod: tripsData.filter((t: any) => t.status === 'POD' &&
          (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter) &&
          (isSameDay(t.createdAt) || isSameDay(t.updatedAt) )
        ).length,
        schedule: null, // This will be calculated after other counts
        // CHANGES: DISPATCHED DELIVERIES should equal Arrived + POD Verify + In-Transit totals (by date)
        dispatched: tripsData.filter((t: any) =>
          (t.status === 'IN-TRANSIT' || t.status === 'ARRIVED' || t.status === 'POD') &&
          (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter) &&
          (isSameDay(t.createdAt) || isSameDay(t.assignDate) || isSameDay(t.updatedAt))
        ).length,
        dispatchedTotal: (
          tripsData.filter((t: any) => t.status === 'IN-TRANSIT' &&
            (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter) &&
            (isSameDay(t.createdAt) || isSameDay(t.assignDate) || isSameDay(t.updatedAt))
          ).length +
          tripsData.filter((t: any) => t.status === 'ARRIVED' &&
            (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter) &&
            (isSameDay(t.createdAt) || isSameDay(t.updatedAt))
          ).length +
          tripsData.filter((t: any) => t.status === 'POD' &&
            (homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter) &&
            (isSameDay(t.createdAt) || isSameDay(t.updatedAt))
          ).length
        ),
      });

      // Post-calculation for dependent counts
      setCounts(prev => {
        const openCount = prev.open ?? 0;
        const loadingCount = prev.loading ?? 0;
        return { ...prev, schedule: openCount + loadingCount };
      });
    };

    const unsubscribeTrips = onSnapshot(tripsRef, (snapshot) => {
      tripsData = snapshot.docs.map(doc => doc.data());
      clearTimeout(updateTimer);
      updateTimer = setTimeout(updateCounts, 100); // Batch updates every 100ms
    });

    const unsubscribeOrders = onSnapshot(ordersRef, (snapshot) => {
      ordersData = snapshot.docs.map(doc => doc.data());
      clearTimeout(updateTimer);
      updateTimer = setTimeout(updateCounts, 100);
    });

    return () => {
      unsubscribeTrips();
      unsubscribeOrders();
      clearTimeout(updateTimer);
    };
  }, [db, homePlantFilter, authorizedPlants, isBootstrapAdmin, selectedDate]);

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

           <div className="flex flex-col gap-1">
             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Selected Date</label>
             <input
               type="date"
               className="h-8 border border-slate-300 bg-white px-2 text-[10px] font-black outline-none focus:ring-1 focus:bg-yellow-50 min-w-[150px]"
               value={selectedDate}
               onChange={(e) => setSelectedDate(e.target.value)}
             />
             <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
               {selectedDate
                 ? (() => {
                     try {
                       const [y, m, d] = selectedDate.split('-').map(Number);
                       const date = new Date(y, m - 1, d);
                       const dd = String(date.getDate()).padStart(2, '0');
                       const MMM = date.toLocaleString('en-GB', { month: 'short' }).toUpperCase();
                       return `${dd}-${MMM}-${y}`;
                     } catch {
                       return selectedDate;
                     }
                   })()
                 : 'ALL TIME DATA'} 
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-12">
        <StatCard label="OPEN ORDER" count={counts.open} className="text-blue-600" />
        <StatCard label="LOADING" count={counts.loading} className="text-orange-600" />
        <StatCard label="IN-TRANSIT" count={counts.transit} className="text-emerald-600" />
        <StatCard label="ARRIVED" count={counts.arrived} className="text-indigo-600" />
        <StatCard label="POD VERIFY" count={counts.pod} className="text-purple-600" />
        <StatCard label="SCHEDULE DELIVERIES" count={counts.schedule} className="text-slate-800" />
        <StatCard label="DISPATCHED DELIVERIES" count={counts.dispatched} className="text-slate-800" />
      </div>
    </div>
  );
}