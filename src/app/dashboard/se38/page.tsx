'use client';

import * as React from 'react';
import { FileText, PlayCircle, Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollectionOptimized, useMemoMongo } from '@/mongodb';
import { collection } from '@/lib/mongo-store';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

const SHARED_HUB_ID = 'Sikkaind';

export default function SE38Page() {
  const db = useMongoStore();
  const [view, setView] = React.useState<'filter' | 'result'>('filter');
  const [search, setSearch] = React.useState({ plant: '', from: format(subDays(new Date(), 7), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') });
  const [results, setResults] = React.useState<any[]>([]);

  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const tripsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  
  const { data: plants } = useCollectionOptimized(plantsQuery);
  const { data: trips } = useCollectionOptimized(tripsQuery);

  const handleExecute = () => {
    if (!search.plant || !search.from || !search.to) { alert('Criteria Mandatory'); return; }
    const filtered = (trips || []).filter(t => {
      const matchPlant = t.plantCode === search.plant;
      const matchDate = isWithinInterval(new Date(t.createdAt), { start: startOfDay(new Date(search.from)), end: endOfDay(new Date(search.to)) });
      return matchPlant && matchDate;
    });
    setResults(filtered);
    setView('result');
  };

  if (view === 'result') {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#f2f2f2] font-mono">
        <div className="bg-white border-b border-slate-300 px-8 py-2 flex items-center justify-between shrink-0">
          <h2 className="text-[14px] font-black uppercase italic text-[#1e3a8a]">SE38 - Analysis Result</h2>
          <Button onClick={() => setView('filter')} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none">New Selection</Button>
        </div>
        <div className="flex-1 overflow-auto bg-white m-4 border border-slate-300 green-scrollbar shadow-inner">
           <table className="w-full text-left border-collapse text-[10px]">
             <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300">
                <tr className="font-black uppercase text-slate-500">
                  <th className="p-3 border-r border-slate-200">Plant</th>
                  <th className="p-3 border-r border-slate-200">Trip ID</th>
                  <th className="p-3 border-r border-slate-200">Vehicle</th>
                  <th className="p-3 border-r border-slate-200">Status</th>
                  <th className="p-3">Qty</th>
                </tr>
             </thead>
             <tbody>{results.map((r, i) => (
               <tr key={i} className="hover:bg-blue-50/30 border-b border-slate-100">
                 <td className="p-3 border-r border-slate-100 uppercase">{r.plantCode}</td>
                 <td className="p-3 border-r border-slate-100 font-black text-blue-700 uppercase">{r.tripNo || r.tripId}</td>
                 <td className="p-3 border-r border-slate-100 uppercase">{r.vehicleNo || r.vehicleNumber}</td>
                 <td className="p-3 border-r border-slate-100 uppercase font-black">{r.status}</td>
                 <td className="p-3 uppercase">{r.assignWeight}</td>
               </tr>
             ))}</tbody>
           </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-10 font-mono bg-[#f2f2f2] overflow-y-auto">
      <div className="bg-white border border-slate-300 p-8 shadow-sm rounded-sm animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-10">
          <div className="flex items-center gap-4">
             <FileText className="h-6 w-6 text-[#1e3a8a]" />
             <h2 className="text-xl font-black uppercase italic text-[#1e3a8a]">SE38: Transactional Analytics</h2>
          </div>
          <Button onClick={handleExecute} className="h-9 bg-[#1e3a8a] text-white text-[11px] font-black uppercase px-10 shadow-lg">Execute Analysis (F8)</Button>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-center gap-8">
            <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Plant:</label>
            <select value={search.plant} onChange={e => setSearch({...search, plant: e.target.value})} className="h-8 w-80 border border-slate-400 bg-white px-2 text-[12px] font-black uppercase">
              <option value="">Select Plant...</option>
              {(plants || []).map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-8">
            <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">From Date:</label>
            <input type="date" value={search.from} onChange={e => setSearch({...search, from: e.target.value})} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black" />
          </div>
          <div className="flex items-center gap-8">
            <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">To Date:</label>
            <input type="date" value={search.to} onChange={e => setSearch({...search, to: e.target.value})} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black" />
          </div>
        </div>
      </div>
    </div>
  );
}

