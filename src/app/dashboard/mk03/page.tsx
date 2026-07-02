'use client';

import * as React from 'react';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, useUser } from '@/mongodb';
import { collection, doc, serverTimestamp } from '@/lib/mongo-store';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

type AgentStatus = 'Active' | 'Inactive';

type HistoryRow = {
  id: string;
  forwardingAgentId: string;
  arrangeByName: string;
  mobileNumber: string;
  status: AgentStatus;
  updatedBy: string;
  updatedAt?: any;
};

export default function VA_MK03_DisplayHistoryForwardingAgent() {
  const router = useRouter();
  const db = useMongoStore();
  const { user } = useUser();

  const [mounted, setMounted] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | AgentStatus>('ALL');

  const [sortKey, setSortKey] = React.useState<'arrangeByName' | 'mobileNumber' | 'status' | 'createdAt' | 'updatedAt'>('arrangeByName');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const [currentPage, setCurrentPage] = React.useState(1);

  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const [historyRows, setHistoryRows] = React.useState<HistoryRow[]>([]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const forwardingAgentsQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'forwarding_agents'),
    [db]
  );
  const historyQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'forwarding_agent_history'),
    [db]
  );

  const { data: agents } = useCollectionOptimized(forwardingAgentsQuery);
  const { data: history } = useCollectionOptimized(historyQuery);

  const filteredAgents = React.useMemo(() => {
    const all = agents || [];
    const term = search.trim().toUpperCase();

    let list = all.filter((a: any) => {
      const name = (a?.arrangeByName || '').toString().toUpperCase();
      const mobile = (a?.mobileNumber || '').toString().toUpperCase();
      const st: AgentStatus = (a?.status as AgentStatus) || 'Active';

      if (statusFilter !== 'ALL' && st !== statusFilter) return false;
      if (!term) return true;
      return name.includes(term) || mobile.includes(term);
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    list = list.sort((a: any, b: any) => {
      const av = a?.[sortKey];
      const bv = b?.[sortKey];

      const aVal = typeof av === 'string' ? av.toUpperCase() : av;
      const bVal = typeof bv === 'string' ? bv.toUpperCase() : bv;

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return -1 * dir;
      if (bVal == null) return 1 * dir;

      if (sortKey === 'createdAt' || sortKey === 'updatedAt') {
        const at = aVal?.toMillis ? aVal.toMillis() : new Date(aVal as any).getTime();
        const bt = bVal?.toMillis ? bVal.toMillis() : new Date(bVal as any).getTime();
        return (at - bt) * dir;
      }

      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });

    return list;
  }, [agents, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortKey, sortDir]);

  const pageRows = React.useMemo(() => {
    return filteredAgents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [filteredAgents, currentPage]);

  const openHistory = (agentId: string) => {
    setSelectedAgentId(agentId);
    setHistoryOpen(true);
    const rows = (history || [])
      .filter((h: any) => h?.forwardingAgentId === agentId)
      .sort((a: any, b: any) => {
        const at = a?.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt as any).getTime();
        const bt = b?.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt as any).getTime();
        return (bt - at);
      });
    setHistoryRows(rows);
  };

  const fmtDate = (v: any) => {
    if (!v) return '-';
    try {
      const t = v?.toMillis ? v.toMillis() : new Date(v as any).getTime();
      if (!t) return '-';
      return new Date(t).toLocaleString();
    } catch {
      return '-';
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold uppercase italic">MK03 - Display / History</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-8 rounded-none text-[10px] font-black uppercase" onClick={() => router.back()}>
            Back
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-300 shadow-sm p-12">
        <div className="flex gap-6 items-center flex-wrap mb-8">
          <div className="flex items-center gap-3">
            <label className="text-[12px] font-bold text-slate-600 uppercase">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-80 border border-slate-400 px-3 text-[12px] font-black outline-none"
              placeholder="Arrange By or Mobile"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[12px] font-bold text-slate-600 uppercase">Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 w-48 border border-slate-400 bg-white px-3 text-[12px] font-black outline-none uppercase"
            >
              <option value="ALL">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[12px] font-bold text-slate-600 uppercase">Sorting</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="h-9 w-56 border border-slate-400 bg-white px-3 text-[12px] font-black outline-none uppercase"
            >
              <option value="arrangeByName">Arrange By</option>
              <option value="mobileNumber">Mobile</option>
              <option value="status">Status</option>
              <option value="createdAt">Created Date</option>
              <option value="updatedAt">Updated Date</option>
            </select>

            <button
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="h-9 px-3 border border-slate-300 bg-slate-50 text-[12px] font-black uppercase"
              title="Toggle sort direction"
            >
              {sortDir}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[11px]">
            <thead className="bg-[#f8fafc] border-b border-slate-300 font-black uppercase text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="p-4 border-r w-[260px]">Arrange By</th>
                <th className="p-4 border-r w-[200px]">Mobile Number</th>
                <th className="p-4 border-r w-[140px]">Status</th>
                <th className="p-4 border-r w-[200px]">Created By</th>
                <th className="p-4 border-r w-[200px]">Created Date</th>
                <th className="p-4 border-r w-[200px]">Updated By</th>
                <th className="p-4 border-r w-[200px]">Updated Date</th>
                <th className="p-4 w-[140px] text-center">View History</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((a: any) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-blue-50/30">
                  <td className="p-4 border-r text-slate-700 font-bold">{a.arrangeByName || '-'}</td>
                  <td className="p-4 border-r text-slate-700 font-bold">{a.mobileNumber || '-'}</td>
                  <td className="p-4 border-r">
                    <span
                      className={
                        a.status === 'Inactive'
                          ? 'px-2 py-1 text-[10px] font-black rounded-sm bg-red-100 text-red-700 whitespace-nowrap'
                          : 'px-2 py-1 text-[10px] font-black rounded-sm bg-emerald-100 text-emerald-700 whitespace-nowrap'
                      }
                    >
                      {a.status || 'Active'}
                    </span>
                  </td>
                  <td className="p-4 border-r text-slate-600">{a.createdBy || '-'}</td>
                  <td className="p-4 border-r text-slate-600">{fmtDate(a.createdAt)}</td>
                  <td className="p-4 border-r text-slate-600">{a.updatedBy || '-'}</td>
                  <td className="p-4 border-r text-slate-600">{fmtDate(a.updatedAt)}</td>
                  <td className="p-4 text-center">
                    <Button
                      onClick={() => openHistory(a.id)}
                      variant="outline"
                      className="h-8 rounded-none text-[10px] font-black uppercase border-slate-300"
                    >
                      History
                    </Button>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-slate-300 italic uppercase font-black text-[10px] tracking-widest">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] font-black">
          <div className="flex gap-2 items-center">
            <Button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((v) => Math.max(1, v - 1))}
              variant="outline"
              className="h-7 w-7 p-0 rounded-none"
            >
              ◀
            </Button>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => setCurrentPage(Math.max(1, Math.min(totalPages, Number(e.target.value || 1))))}
              className="h-7 w-14 border border-slate-300 text-center text-[10px] font-normal outline-none"
            />
            <Button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((v) => Math.min(totalPages, v + 1))}
              variant="outline"
              className="h-7 w-7 p-0 rounded-none"
            >
              ▶
            </Button>
          </div>
          <span className="uppercase text-slate-400 italic">Page {currentPage} of {totalPages}</span>
        </div>
      </div>

      {historyOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white border border-slate-300 shadow-lg w-[900px] max-w-[95vw]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <div className="text-[12px] font-black uppercase text-[#0056d2]">Forwarding Agent History</div>
                <div className="text-[10px] font-bold uppercase text-slate-500">Agent ID: {selectedAgentId}</div>
              </div>
              <Button
                variant="outline"
                className="h-8 rounded-none text-[10px] font-black uppercase border-slate-300"
                onClick={() => setHistoryOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="p-6 overflow-auto max-h-[60vh]">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="bg-[#f8fafc] border-b border-slate-300 font-black uppercase text-slate-500">
                  <tr>
                    <th className="p-3 border-r">Arrange By</th>
                    <th className="p-3 border-r">Mobile</th>
                    <th className="p-3 border-r">Status</th>
                    <th className="p-3 border-r">Updated By</th>
                    <th className="p-3">Updated Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((h) => (
                    <tr key={h.id} className="border-b border-slate-100 hover:bg-blue-50/30">
                      <td className="p-3 border-r font-bold text-slate-700">{h.arrangeByName || '-'}</td>
                      <td className="p-3 border-r font-bold text-slate-700">{h.mobileNumber || '-'}</td>
                      <td className="p-3 border-r">
                        <span
                          className={
                            h.status === 'Inactive'
                              ? 'px-2 py-1 text-[10px] font-black rounded-sm bg-red-100 text-red-700 whitespace-nowrap'
                              : 'px-2 py-1 text-[10px] font-black rounded-sm bg-emerald-100 text-emerald-700 whitespace-nowrap'
                          }
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="p-3 border-r text-slate-600">{h.updatedBy || '-'}</td>
                      <td className="p-3 text-slate-600">{fmtDate(h.updatedAt)}</td>
                    </tr>
                  ))}
                  {historyRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-300 italic uppercase font-black text-[10px] tracking-widest">
                        No history entries.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(!agents || !history) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
}

