'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Grid2X2, Search, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview ZCODE - Comprehensive System Transaction Registry.
 * Lists all active T-Codes with their full descriptions and internal functional tabs.
 */
const MASTER_TCODES = [
  { 
    code: 'OX01', 
    description: 'PLANT MASTER: CREATE', 
    module: 'Master Data', 
    tabs: ['Entry'] 
  },
  { 
    code: 'OX02', 
    description: 'PLANT MASTER: CHANGE', 
    module: 'Master Data', 
    tabs: ['Modify'] 
  },
  { 
    code: 'OX03', 
    description: 'PLANT MASTER: DISPLAY', 
    module: 'Master Data', 
    tabs: ['View'] 
  },
  { 
    code: 'FM01', 
    description: 'COMPANY MASTER: CREATE', 
    module: 'Master Data', 
    tabs: ['Entry', 'Plant Mapping'] 
  },
  { 
    code: 'FM02', 
    description: 'COMPANY MASTER: CHANGE', 
    module: 'Master Data', 
    tabs: ['Modify', 'Update Logo'] 
  },
  { 
    code: 'FM03', 
    description: 'COMPANY MASTER: DISPLAY', 
    module: 'Master Data', 
    tabs: ['View'] 
  },
  { 
    code: 'XK01', 
    description: 'VENDOR MASTER: CREATE', 
    module: 'Master Data', 
    tabs: ['Entry'] 
  },
  { 
    code: 'XK02', 
    description: 'VENDOR MASTER: CHANGE', 
    module: 'Master Data', 
    tabs: ['Modify Vendor'] 
  },
  { 
    code: 'XK03', 
    description: 'VENDOR MASTER: DISPLAY', 
    module: 'Master Data', 
    tabs: ['View'] 
  },
  { 
    code: 'XD01', 
    description: 'CUSTOMER MASTER: CREATE', 
    module: 'Master Data', 
    tabs: ['Consignor/Consignee Entry'] 
  },
  { 
    code: 'XD02', 
    description: 'CUSTOMER MASTER: CHANGE', 
    module: 'Master Data', 
    tabs: ['Modify Profile'] 
  },
  { 
    code: 'XD03', 
    description: 'CUSTOMER MASTER: DISPLAY', 
    module: 'Master Data', 
    tabs: ['View'] 
  },
  { 
    code: 'VA01', 
    description: 'SALES ORDER: CREATE', 
    module: 'Logistics', 
    tabs: ['Order Entry', 'Auto-fill Lookup'] 
  },
  { 
    code: 'VA02', 
    description: 'SALES ORDER: CHANGE', 
    module: 'Logistics', 
    tabs: ['Edit Weight', 'Update Date'] 
  },
  { 
    code: 'VA03', 
    description: 'SALES ORDER: DISPLAY', 
    module: 'Logistics', 
    tabs: ['Order History'] 
  },
  { 
    code: 'VA04', 
    description: 'ORDER SHORT CLOSE', 
    module: 'Logistics', 
    tabs: ['Workflow Termination'] 
  },
  { 
    code: 'TR21', 
    description: 'TRIP BOARD CONTROL', 
    module: 'Logistics', 
    tabs: ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'] 
  },
  { 
    code: 'TR24', 
    description: 'TRACK SHIPMENT', 
    module: 'Logistics', 
    tabs: ['Trace'] 
  },
  { 
    code: 'WGPS24', 
    description: 'GPS TRACKING', 
    module: 'Logistics', 
    tabs: ['Satellite Map', 'Gateway Settings'] 
  },
  { 
    code: 'SE38', 
    description: 'CUSTOM REPORT EXECUTION', 
    module: 'System', 
    tabs: ['Criteria Selection', 'Analytics Result'] 
  },
  { 
    code: 'SU01', 
    description: 'USER MANAGEMENT: CREATE', 
    module: 'System', 
    tabs: ['Profile Entry'] 
  },
  { 
    code: 'SU02', 
    description: 'USER MANAGEMENT: CHANGE', 
    module: 'System', 
    tabs: ['Access Control', 'T-Code Assignment'] 
  },
  { 
    code: 'SU03', 
    description: 'USER MANAGEMENT: DISPLAY', 
    module: 'System', 
    tabs: ['View'] 
  },
  { 
    code: 'ZCODE', 
    description: 'SYSTEM: ALL ACTIVE T-CODES', 
    module: 'System', 
    tabs: ['Map'] 
  },
];

export default function ZCodePage() {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  
  const filtered = MASTER_TCODES.filter(t => 
    t.code.includes(q.toUpperCase()) || 
    t.description.toUpperCase().includes(q.toUpperCase()) ||
    t.module.toUpperCase().includes(q.toUpperCase())
  );

  const handleNavigate = (code: string) => {
    const c = code.toUpperCase();
    
    // Standardized routing logic
    const baseCode = ['ZCODE', 'SE38', 'WGPS24', 'TR21', 'TR24'].includes(c) ? c : c.substring(0, 2);
    let target = baseCode.toLowerCase();
    
    // Special handling for GPS route
    if (target === 'wgps24') target = 'wgsp24';

    router.push(`/dashboard/${target}?tcode=${c}`);
  };

  return (
    <div className="flex-1 flex flex-col p-10 font-mono bg-[#f2f2f2] overflow-hidden">
      <div className="bg-white border border-slate-300 p-8 shadow-sm flex flex-col h-full rounded-sm animate-fade-in">
        <div className="flex items-center gap-6 border-b border-slate-200 pb-6 mb-8 shrink-0">
          <Grid2X2 className="h-6 w-6 text-[#1e3a8a]" />
          <div className="flex flex-col">
            <h2 className="text-xl font-black uppercase italic text-[#1e3a8a] tracking-tighter">ZCODE</h2>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global System Component Inventory</span>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input 
              value={q} 
              onChange={e => setQ(e.target.value)} 
              className="h-9 w-80 border border-slate-400 pl-9 pr-4 text-xs font-black uppercase outline-none focus:ring-1 focus:ring-blue-500 shadow-inner" 
              placeholder="Filter by T-Code, Description or Module..." 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto green-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#f8fafc] z-10 border-b border-slate-300">
              <tr className="text-[10px] font-black uppercase text-slate-500">
                <th className="p-4 border-r border-slate-200 w-[120px]">T-Code</th>
                <th className="p-4 border-r border-slate-200 w-[300px]">Description</th>
                <th className="p-4 border-r border-slate-200">Active / Functionality</th>
                <th className="p-4 w-[150px]">Module</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr 
                  key={t.code} 
                  onClick={() => handleNavigate(t.code)} 
                  className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-all group"
                >
                  <td className="p-4 border-r border-slate-200 text-[#0056d2] font-black text-xs group-hover:underline">
                    {t.code}
                  </td>
                  <td className="p-4 border-r border-slate-200 font-bold text-[11px] uppercase text-slate-700 leading-tight">
                    {t.description}
                  </td>
                  <td className="p-4 border-r border-slate-200">
                    <div className="flex flex-wrap gap-2">
                      {t.tabs.map((tab, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-sm">
                          <Layers className="h-2.5 w-2.5 text-slate-300" />
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{tab}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[8px] font-black uppercase rounded-none border-none px-3",
                        t.module === 'Master Data' ? "bg-blue-100 text-blue-800" : 
                        t.module === 'Logistics' ? "bg-emerald-100 text-emerald-800" : 
                        "bg-slate-800 text-white"
                      )}
                    >
                      {t.module}
                    </Badge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-[10px] font-black uppercase text-slate-300 italic tracking-[0.2em]">
                    Query Returned Zero
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Helper function for class merging */
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
