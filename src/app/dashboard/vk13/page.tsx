'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking } from '@/mongodb';
import { collection, doc } from '@/lib/mongo-store';
import { cn } from '@/lib/utils';
import { useUser, useDoc } from '@/mongodb';
import { useMemo } from 'react';
import * as XLSX from 'xlsx';

const SHARED_HUB_ID = 'Sikkaind';

type ConditionRecord = 'Regular' | 'One time Approval (OTA)';

export default function VK13DisplayPrimaryFreightRates() {
  const db = useMongoStore();
  const { user } = useUser();

  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));
    setMounted(true);
  }, []);

  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const ratesQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates'), [db]);

  const { data: plants } = useCollectionOptimized(plantsQuery);
  const { data: rates } = useCollectionOptimized(ratesQuery);

  const profileRef = useMemoMongo(() => {
    if (!registryId || isBootstrapAdmin) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'users_master', registryId);
  }, [db, registryId, isBootstrapAdmin]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(profileRef);

  const authorizedPlantCodes = React.useMemo(() => {
    if (isProfileLoading) return undefined;
    if (isBootstrapAdmin) return null;
    return userProfile?.plantAccess || [];
  }, [isBootstrapAdmin, userProfile, isProfileLoading]);

  React.useEffect(() => {
    if (!mounted) return;
    if (authorizedPlantCodes && authorizedPlantCodes.length > 0 && plantFilter === 'ALL') {
      setPlantFilter(authorizedPlantCodes[0]);
    }
  }, [mounted, authorizedPlantCodes, plantFilter]);

  const filtered = useMemo(() => {
    if (!rates || !mounted) return [];
    let data = rates as any[];
    if (authorizedPlantCodes) {
      data = data.filter((r) => authorizedPlantCodes.includes(r.plantCode));
    }
    if (plantFilter !== 'ALL') {
      data = data.filter((r) => r.plantCode === plantFilter);
    }
    const q = search.trim().toUpperCase();
    if (q) {
      data = data.filter((r) => {
        return (
          (r.plantCode || '').includes(q) ||
          (r.origin || '').includes(q) ||
          (r.destination || '').includes(q) ||
          (r.minimumGranteeWeightMt ?? '').toString().includes(q) ||
          (r.conditionRecord || '').includes(q)
        );
      });
    }
    return data;
  }, [rates, mounted, authorizedPlantCodes, plantFilter, search]);

  const handleExport = () => {
    if (!filtered || filtered.length === 0) {
      alert('No data to export.');
      return;
    }

    const header = ['Plant', 'Origin', 'Destination', 'Min Grantee Weight (MT)', 'Rate (PMT)', 'Condition Record', 'Valid From', 'Valid To'];
    const dataToExport = filtered.map((r: any) => [
      r.plantCode,
      r.origin,
      r.destination,
      r.minimumGranteeWeightMt,
      r.ratePMT,
      r.conditionRecord,
      r.validityFromDate,
      r.validityToDate,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...dataToExport]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FreightHistory');
    XLSX.writeFile(wb, 'VK13_Freight_History.xlsx');
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold uppercase italic">VK13 – Display Primary Freight Rates / Condition Records</h2>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-8 w-64 border border-slate-300 px-3 text-xs font-normal outline-none bg-white"
          />
          <Button variant="outline" className="h-8 rounded-sm px-4 text-xs" onClick={handleExport}>
            Export to Excel
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-300 shadow-inner p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Plant</label>
            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              disabled={!isBootstrapAdmin && authorizedPlantCodes?.length === 1}
              className="h-9 border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"
            >
              {isBootstrapAdmin && <option value="ALL">All Plants</option>}
              {(plants || [])
                .filter((p) => !authorizedPlantCodes || authorizedPlantCodes.includes(p.plantCode))
                .map((p) => (
                  <option key={p.id} value={p.plantCode}>
                    {p.plantCode}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-300 shadow-inner overflow-x-auto">
        <table className="w-full text-left text-[11px] min-w-[1400px]">
          <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-300 font-normal uppercase text-slate-500">
            <tr>
              <th className="p-3 border-r">Plant</th>
              <th className="p-3 border-r">Origin</th>
              <th className="p-3 border-r">Destination</th>
              <th className="p-3 border-r text-right">Min Grantee Weight (MT)</th>
              <th className="p-3 border-r text-right">Rate (PMT)</th>
              <th className="p-3 border-r">Condition Record</th>
              <th className="p-3 border-r">Valid From</th>
              <th className="p-3">Valid To</th>
            </tr>
          </thead>
          <tbody>
            {(filtered || []).map((r: any) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-blue-50/20">
                <td className="p-3 border-r">{r.plantCode}</td>
                <td className="p-3 border-r">{r.origin}</td>
                <td className="p-3 border-r">{r.destination}</td>
                <td className="p-3 border-r text-right">{r.minimumGranteeWeightMt}</td>
                <td className="p-3 border-r text-right">{r.ratePMT}</td>
                <td className="p-3 border-r">{r.conditionRecord}</td>
                <td className="p-3 border-r">{r.validityFromDate || '-'}</td>
                <td className="p-3">{r.validityToDate || '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-20 text-center text-slate-300 italic uppercase font-black text-[10px] tracking-widest">
                  No primary freight rates found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
