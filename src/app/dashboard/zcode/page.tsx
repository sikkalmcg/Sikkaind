'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Grid2X2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const MASTER_TCODES = [
  { code: 'OX01', description: 'PLANT MASTER: CREATE', icon: Grid2X2, module: 'Master Data' },
  { code: 'OX02', description: 'PLANT MASTER: CHANGE', icon: Grid2X2, module: 'Master Data' },
  { code: 'OX03', description: 'PLANT MASTER: DISPLAY', icon: Grid2X2, module: 'Master Data' },
  { code: 'FM01', description: 'COMPANY MASTER: CREATE', icon: Grid2X2, module: 'Master Data' },
  { code: 'VA01', description: 'SALES ORDER: CREATE', icon: Grid2X2, module: 'Logistics' },
  { code: 'TR21', description: 'TRIP BOARD CONTROL', icon: Grid2X2, module: 'Logistics' },
  { code: 'WGPS24', description: 'GPS TRACKING HUB', icon: Grid2X2, module: 'Logistics' },
  { code: 'SE38', description: 'CUSTOM REPORT EXECUTION', icon: Grid2X2, module: 'System' },
];

export default function ZCodePage() {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const filtered = MASTER_TCODES.filter(t => t.code.includes(q.toUpperCase()) || t.description.toUpperCase().includes(q.toUpperCase()));

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
    <div className="flex-1 flex flex-col p-10 font-mono bg-[#f2f2f2] overflow-hidden">
      <div className="bg-white border border-slate-300 p-8 shadow-sm flex flex-col h-full rounded-sm">
        <div className="flex items-center gap-6 border-b border-slate-200 pb-6 mb-8 shrink-0">
          <Grid2X2 className="h-6 w-6 text-[#1e3a8a]" />
          <h2 className="text-xl font-black uppercase italic text-[#1e3a8a] tracking-tighter">ZCODE Registry: All Transaction Nodes</h2>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} className="h-9 w-80 border border-slate-400 pl-9 pr-4 text-xs font-black uppercase outline-none focus:ring-1 focus:ring-blue-500" placeholder="Filter Registry..." />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto green-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#f8fafc] z-10 border-b border-slate-300">
              <tr className="text-[10px] font-black uppercase text-slate-500">
                <th className="p-4 border-r border-slate-200">T-Code</th>
                <th className="p-4 border-r border-slate-200">Description</th>
                <th className="p-4">Module</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.code} onClick={() => handleNavigate(t.code)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                  <td className="p-4 border-r border-slate-200 text-[#0056d2] font-black text-xs">{t.code}</td>
                  <td className="p-4 border-r border-slate-200 font-bold text-xs uppercase text-slate-700">{t.description}</td>
                  <td className="p-4"><Badge variant="outline" className="text-[8px] font-black uppercase bg-slate-50 rounded-none">{t.module}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
