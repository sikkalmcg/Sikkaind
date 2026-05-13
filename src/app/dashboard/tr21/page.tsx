'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Printer, Save, Search, ChevronLeft, ChevronRight, Truck, MapPin, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

const formatWeight = (val: any) => {
  const num = parseFloat(val);
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export default function TR21Page() {
  const router = useRouter();
  const db = useFirestore();
  const [activeTab, setActiveTab] = React.useState('Open Orders');
  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [fromDate, setFromDate] = React.useState(format(subDays(new Date(), 4), 'yyyy-MM-dd'));
  const [toDate, setToDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentPage, setCurrentPage] = React.useState(1);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: plants } = useCollection(plantsQuery);

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];

  const filteredData = React.useMemo(() => {
    if (!orders || !trips) return [];
    if (activeTab === 'Open Orders') {
      return orders.filter(o => o.status !== 'Short closed' && (plantFilter === 'ALL' || o.plantCode === plantFilter))
        .map(o => {
          const ass = trips.filter(t => t.saleOrderId === o.id).reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
          return { ...o, ass, bal: (parseFloat(o.weight) || 0) - ass };
        }).filter(o => o.bal > 0);
    }
    const statusMap: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
    return trips.filter(t => t.status === statusMap[activeTab] && (plantFilter === 'ALL' || t.plantCode === plantFilter));
  }, [orders, trips, activeTab, plantFilter]);

  const paginated = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col bg-[#f2f2f2] font-mono overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 flex items-center justify-between shadow-sm">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">TR21 – TRIP BOARD CONTROL HUB</h2>
        <div className="flex items-center gap-6">
          <div className="flex gap-4">
            <select value={plantFilter} onChange={e => { setPlantFilter(e.target.value); setCurrentPage(1); }} className="h-8 border border-slate-300 px-2 text-[10px] font-black uppercase outline-none">
              <option value="ALL">ALL PLANTS</option>
              {(plants || []).map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
            </select>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 border border-slate-300 px-2 text-[10px] font-black" />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 border border-slate-300 px-2 text-[10px] font-black" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-8 overflow-hidden">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 mb-4">
          {TABS.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setCurrentPage(1); }} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 transition-all", activeTab === t ? "bg-white text-[#0056d2] shadow-sm" : "text-slate-500 hover:bg-white/50")}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-inner">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300">
              <tr className="text-[9px] font-black uppercase text-slate-500">
                <th className="p-3 border-r border-slate-200">Plant</th>
                <th className="p-3 border-r border-slate-200">Identifier</th>
                <th className="p-3 border-r border-slate-200">Destination</th>
                <th className="p-3 border-r border-slate-200">Vehicle No</th>
                <th className="p-3 border-r border-slate-200">Weight</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((item: any) => (
                <tr key={item.id} className="text-[11px] font-bold hover:bg-blue-50/30">
                  <td className="p-3 border-r border-slate-100">{item.plantCode}</td>
                  <td className="p-3 border-r border-slate-100 font-black text-[#0056d2] uppercase">{item.tripId || item.saleOrder}</td>
                  <td className="p-3 border-r border-slate-100 uppercase">{item.destination || item.shipToParty}</td>
                  <td className="p-3 border-r border-slate-100 font-black uppercase">{item.vehicleNumber || 'PENDING'}</td>
                  <td className="p-3 border-r border-slate-100 text-emerald-600">{formatWeight(item.assignWeight || item.weight)}</td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black uppercase border border-slate-200">Process</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="mt-4 bg-white border border-slate-300 p-2 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex gap-2">
            <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
            <span className="flex items-center px-4 text-[10px] font-black uppercase text-slate-400">Page {currentPage} of {totalPages || 1}</span>
            <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase italic">SAP Registry Node: {filteredData.length} records total</div>
        </div>
      </div>
    </div>
  );
}
