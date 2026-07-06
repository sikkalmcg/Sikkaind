'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useMongoStore, useCollectionOptimized, useMemoMongo, useUser, useDoc } from '@/mongodb';
import { collection, onSnapshot, doc } from '@/lib/mongo-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SHARED_HUB_ID = 'Sikkaind'; 

// amCharts 5 Imports
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

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
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  // Reference container for amCharts root registry protection
  const chartRootRef = useRef<am5.Root | null>(null);

  // Month Picker State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  React.useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));
    setMounted(true);
  }, []);

  const handleMonthSelect = (monthIndex: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), monthIndex, 1));
    setShowMonthPicker(false);
  };

  const changeYear = (amount: number) => {
    setCurrentDate(new Date(currentDate.getFullYear() + amount, currentDate.getMonth(), 1));
  };

  const selectedMonthYear = useMemo(() => {
    return {
      month: currentDate.getMonth(),
      year: currentDate.getFullYear(),
    };
  }, [currentDate]);

  // Performance Chart Logic
  useEffect(() => {
    if (!mounted) return;

    setIsChartLoading(true);

    // Safeguard: Dispose absolute pre-existing root contexts instantly
    if (chartRootRef.current) {
      chartRootRef.current.dispose();
    }

    const chartData = [
        { date: new Date(selectedMonthYear.year, selectedMonthYear.month, 1).getTime(), openOrder: 10, loading: 5, inTransit: 8, arrived: 4, podVerify: 2, closed: 15 },
        { date: new Date(selectedMonthYear.year, selectedMonthYear.month, 5).getTime(), openOrder: 12, loading: 8, inTransit: 10, arrived: 6, podVerify: 4, closed: 18 },
        { date: new Date(selectedMonthYear.year, selectedMonthYear.month, 10).getTime(), openOrder: 8, loading: 4, inTransit: 6, arrived: 10, podVerify: 8, closed: 20 },
        { date: new Date(selectedMonthYear.year, selectedMonthYear.month, 15).getTime(), openOrder: 15, loading: 10, inTransit: 12, arrived: 8, podVerify: 6, closed: 25 },
        { date: new Date(selectedMonthYear.year, selectedMonthYear.month, 20).getTime(), openOrder: 11, loading: 7, inTransit: 9, arrived: 11, podVerify: 9, closed: 22 },
        { date: new Date(selectedMonthYear.year, selectedMonthYear.month, 25).getTime(), openOrder: 9, loading: 6, inTransit: 7, arrived: 13, podVerify: 11, closed: 28 },
    ];

    let root = am5.Root.new("performanceChartDiv");
    
    // Smooth rendering animation engine attach karein
    root.setThemes([am5themes_Animated.new(root)]);
    chartRootRef.current = root;

    let chart = root.container.children.push(am5xy.XYChart.new(root, {
      panX: false, panY: false, wheelX: "panX", wheelY: "zoomX", layout: root.verticalLayout
    }));

    let xAxis = chart.xAxes.push(am5xy.DateAxis.new(root, {
      baseInterval: { timeUnit: "day", count: 1 },
      renderer: am5xy.AxisRendererX.new(root, {}),
      tooltip: am5.Tooltip.new(root, {})
    }));

    let yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
      renderer: am5xy.AxisRendererY.new(root, {})
    }));

    function createSeries(name: string, field: string) {
      let series = chart.series.push(am5xy.LineSeries.new(root, {
        name: name,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: field,
        valueXField: "date",
        tooltip: am5.Tooltip.new(root, { labelText: "{name}: {valueY}" })
      }));
      series.data.setAll(chartData);
      series.strokes.template.setAll({ strokeWidth: 2 });
      
      // Load animations smooth execute krega
      series.appear(1000);
    }

    createSeries("Open Order", "openOrder");
    createSeries("Loading", "loading");
    createSeries("In-Transit", "inTransit");
    createSeries("Arrived", "arrived");
    createSeries("POD Verify", "podVerify");
    createSeries("Closed", "closed");

    let legend = chart.children.push(am5.Legend.new(root, {
      centerX: am5.p50,
      x: am5.p50
    }));
    legend.data.setAll(chart.series.values);

    chart.set("cursor", am5xy.XYCursor.new(root, {}));
    
    chart.appear(1000, 100);
    setIsChartLoading(false);

    return () => {
      if (chartRootRef.current) {
        chartRootRef.current.dispose();
        chartRootRef.current = null;
      }
    };
  }, [mounted, selectedMonthYear]);

  const profileRef = useMemoMongo(() => {
    if (!registryId || isBootstrapAdmin) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'users_master', registryId);
  }, [db, registryId, isBootstrapAdmin]);
  
  const { data: userProfile } = useDoc(profileRef);
  
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL');
  const [counts, setCounts] = React.useState<{
    open: number | null;
    loading: number | null;
    transit: number | null;
    arrived: number | null;
    pod: number | null;
    closed: number | null;
  }>({
    open: null,
    loading: null,
    transit: null,
    arrived: null,
    pod: null,
    closed: null,
  });

  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const { data: allPlants } = useCollectionOptimized(plantsQuery);

  const authorizedPlants = React.useMemo(() => {
    if (isBootstrapAdmin) return allPlants || [];
    const codes = userProfile?.plantAccess || [];
    return (allPlants || []).filter(p => codes.includes(p.plantCode));
  }, [allPlants, userProfile, isBootstrapAdmin]);

  React.useEffect(() => {
    if (authorizedPlants.length > 0 && homePlantFilter === 'ALL') {
      if (!isBootstrapAdmin) {
        setHomePlantFilter(authorizedPlants[0].plantCode);
      }
    }
  }, [authorizedPlants, homePlantFilter, isBootstrapAdmin]);

  React.useEffect(() => {
    if (!db) return;

    const tripsRef = collection(db, 'users', SHARED_HUB_ID, 'trip_board');
    const ordersRef = collection(db, 'users', SHARED_HUB_ID, 'sales_orders');

    const isInSelectedMonth = (value: any) => {
      if (!value) return false;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return false;
      return d.getFullYear() === selectedMonthYear.year &&
             d.getMonth() === selectedMonthYear.month;
    };

    let tripsData: any[] = [];
    let ordersData: any[] = [];
    let updateTimer: NodeJS.Timeout;

    const updateCounts = () => {
      const authCodes = authorizedPlants.map(p => p.plantCode);

      const plantFilteredOrders = ordersData.filter((o: any) => 
        homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(o.plantCode)) : o.plantCode === homePlantFilter
      );

      const plantFilteredTrips = tripsData.filter((t: any) => 
        homePlantFilter === 'ALL' ? (isBootstrapAdmin || authCodes.includes(t.plantCode)) : t.plantCode === homePlantFilter
      );

      setCounts({
        open: plantFilteredOrders.filter((o: any) => 
          o.status === 'Open' && (isInSelectedMonth(o.createdAt) || isInSelectedMonth(o.orderDate) || isInSelectedMonth(o.updatedAt))
        ).map((o: any) => {
          const dispatched = plantFilteredTrips
            .filter((t: any) => t.orderNo === o.orderNo && t.status !== 'REJECTION')
            .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
          const weight = parseFloat(o.quantity) || 0;
          return { ...o, balance: weight - dispatched };
        }).filter((o: any) => o.balance > 0.001).length,

        loading: plantFilteredTrips.filter((t: any) => 
          t.status === 'LOADING' && isInSelectedMonth(t.assignDate)
        ).length,

        transit: plantFilteredTrips.filter((t: any) => 
          t.status === 'IN-TRANSIT' && isInSelectedMonth(t.outDate)
        ).length,

        arrived: plantFilteredTrips.filter((t: any) => 
          t.status === 'ARRIVED' && isInSelectedMonth(t.arrivedDate)
        ).length,

        pod: plantFilteredTrips.filter((t: any) => 
          t.status === 'POD' && isInSelectedMonth(t.unloadDate)
        ).length,

        closed: plantFilteredTrips.filter((t: any) => 
          t.status === 'CLOSED' && isInSelectedMonth(t.updatedAt)
        ).length,
      });
    };

    const unsubscribeTrips = onSnapshot(tripsRef, (snapshot) => {
      tripsData = snapshot.docs.map(doc => doc.data());
      clearTimeout(updateTimer);
      updateTimer = setTimeout(updateCounts, 100);
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
  }, [db, homePlantFilter, authorizedPlants, isBootstrapAdmin, selectedMonthYear]);

  if (!mounted) return null;

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#f2f2f2] animate-fade-in text-[#333]">
      <div className="mb-8 flex justify-end items-center">
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

           <div className="relative flex flex-col gap-1">
             <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Select Month</label>
             <button
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                className="h-8 border border-slate-300 bg-white px-3 text-[10px] font-black uppercase outline-none focus:ring-1 focus:bg-yellow-50 min-w-[180px] text-left"
             >
                {currentDate.toLocaleString('default', { month: 'long' }).toUpperCase()} {currentDate.getFullYear()}
             </button>
             {showMonthPicker && (
                <div className="absolute top-full mt-1 right-0 w-64 bg-white border border-slate-300 shadow-lg rounded-md p-4 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => changeYear(-1)} className="p-1 rounded-full hover:bg-slate-100"><ChevronLeft className="h-5 w-5" /></button>
                        <span className="text-sm font-bold">{currentDate.getFullYear()}</span>
                        <button onClick={() => changeYear(1)} className="p-1 rounded-full hover:bg-slate-100"><ChevronRight className="h-5 w-5" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                            <button key={month} onClick={() => handleMonthSelect(index)} className={cn("p-2 text-xs rounded-md hover:bg-blue-100", currentDate.getMonth() === index && "bg-blue-600 text-white")}>
                                {month}
                            </button>
                        ))}
                    </div>
                </div>
             )}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-6 mb-8">
        <StatCard label="OPEN ORDER" count={counts.open} className="text-blue-600" />
        <StatCard label="LOADING" count={counts.loading} className="text-orange-600" />
        <StatCard label="IN-TRANSIT" count={counts.transit} className="text-emerald-600" />
        <StatCard label="ARRIVED" count={counts.arrived} className="text-indigo-600" />
        <StatCard label="POD VERIFY" count={counts.pod} className="text-purple-600" />
        <StatCard label="CLOSED" count={counts.closed} className="text-slate-800" />
      </div>

      <div className="bg-white border border-slate-200 shadow-md p-6">
        <h3 className="text-lg font-bold text-slate-700 mb-4">Performance Chart</h3>
        <div id="performanceChartDiv" style={{ width: "100%", height: "400px", position: 'relative' }}>
          {isChartLoading && <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}
        </div>
      </div>
    </div>
  );
}