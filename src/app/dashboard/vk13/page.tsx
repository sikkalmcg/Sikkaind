'use client';

import * as React from 'react';
import { useMongoStore, useCollectionOptimized, useMemoMongo } from '@/mongodb';
import { collection, doc } from '@/lib/mongo-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useUser, useDoc } from '@/mongodb';
import { useMemo } from 'react';
import * as XLSX from 'xlsx';

const SHARED_HUB_ID = 'Sikkaind';

type ConditionRecord = 'Regular' | 'One time Approval (OTA)';
type RateHistoryItem = {
  updateType: string;
  updateDate: string;
  validFrom: string;
  validTo: string;
};
export default function VK13DisplayPrimaryFreightRates() {
  const db = useMongoStore();
  const { user } = useUser();

  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [showHistory, setShowHistory] = React.useState(false);
  const [selectedRateGroup, setSelectedRateGroup] = React.useState<any[]>([]);
  const [historyData, setHistoryData] = React.useState<RateHistoryItem[]>([]);

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

  const groupedAndFilteredRates = useMemo(() => {
    if (!rates || !mounted) return [];

    let filteredData = rates as any[];
    if (authorizedPlantCodes) {
      filteredData = filteredData.filter((r) => authorizedPlantCodes.includes(r.plantCode));
    }
    if (plantFilter !== 'ALL') {
      filteredData = filteredData.filter((r) => r.plantCode === plantFilter);
    }

    const q = search.trim().toUpperCase();
    if (q) {
      filteredData = filteredData.filter((r) => {
        return (
          (r.plantCode || '').includes(q) ||
          (r.origin || '').includes(q) ||
          (r.destination || '').includes(q) ||
          (r.conditionRecord || '').includes(q)
        );
      });
    }

    const groups: { [key: string]: any[] } = {};
    filteredData.forEach((rate) => {
      const key = `${rate.plantCode}|${rate.origin}|${rate.destination}|${rate.ratePMT}|${rate.conditionRecord}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(rate);
    });

    return Object.values(groups).map((group) => {
      group.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      return group[0]; // Return the latest record for display
    });
  }, [rates, mounted, authorizedPlantCodes, plantFilter, search]);

  const handleViewHistory = (rate: any) => {
    const key = `${rate.plantCode}|${rate.origin}|${rate.destination}|${rate.ratePMT}|${rate.conditionRecord}`;
    const allRelatedRates = (rates as any[]).filter(
      (r) => `${r.plantCode}|${r.origin}|${r.destination}|${r.ratePMT}|${r.conditionRecord}` === key
    );
    allRelatedRates.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    setSelectedRateGroup(allRelatedRates);
    setShowHistory(true);
  };

  const handleExport = () => {
    if (!rates || rates.length === 0) {
      alert('No data to export.');
      return;
    }

    const groups: { [key: string]: any[] } = {};
    (rates as any[]).forEach((rate) => {
      const key = `${rate.plantCode}|${rate.origin}|${rate.destination}|${rate.ratePMT}|${rate.conditionRecord}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(rate);
    });

    const dataToExport: any[][] = [];
    const header = ['Plant', 'Origin', 'Destination', 'Rate (PMT)', 'Condition Record', 'Update Type', 'Update Date', 'Valid From', 'Valid To'];
    dataToExport.push(header);

    Object.values(groups).forEach((group) => {
      group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      group.forEach((rate, index) => {
        const updateType = index === 0 ? 'Original' : `Extend-${index}`;
        dataToExport.push([
          rate.plantCode,
          rate.origin,
          rate.destination,
          rate.ratePMT,
          rate.conditionRecord,
          updateType,
          rate.updatedAt || rate.createdAt,
          rate.validityFromDate,
          rate.validityToDate,
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FreightHistory');
    XLSX.writeFile(wb, 'VK13_Freight_History.xlsx');
  };

  if (!mounted) return null;
  const filtered = groupedAndFilteredRates;
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
              <th className="p-3 border-r text-right">Rate (PMT)</th>
              <th className="p-3 border-r">Condition Record</th>
              <th className="p-3 border-r">Valid From</th>
              <th className="p-3 border-r">Valid To</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {(filtered || []).map((r: any) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-blue-50/20">
                <td className="p-3 border-r">{r.plantCode}</td>
                <td className="p-3 border-r">{r.origin}</td>
                <td className="p-3 border-r">{r.destination}</td>
                <td className="p-3 border-r text-right">{r.ratePMT}</td>
                <td className="p-3 border-r">{r.conditionRecord}</td>
                <td className="p-3 border-r">{r.validityFromDate || '-'}</td>
                <td className="p-3 border-r">{r.validityToDate || '-'}</td>
                <td className="p-3 text-center">
                  <Button variant="outline" className="h-6 px-4 text-[10px]" onClick={() => handleViewHistory(r)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-20 text-center text-slate-300 italic uppercase font-black text-[10px] tracking-widest">
                  No primary freight rates found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl rounded-none border-[3px] border-blue-600 font-mono p-0 text-black">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200">
            <DialogTitle className="text-[14px] font-normal uppercase text-blue-700 italic">Rate Validity History</DialogTitle>
            {selectedRateGroup.length > 0 && (
              <div className="text-xs pt-2">
                <span className="font-bold">Plant:</span> {selectedRateGroup[0].plantCode} | <span className="font-bold">Destination:</span> {selectedRateGroup[0].destination}
              </div>
            )}
          </DialogHeader>
          <div className="p-8 max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="p-3">Update Type</th>
                  <th className="p-3">Update Date</th>
                  <th className="p-3">Valid From</th>
                  <th className="p-3">Valid To</th>
                </tr>
              </thead>
              <tbody>
                {selectedRateGroup.map((rate, index) => (
                  <tr key={rate.id} className="border-b border-slate-200">
                    <td className="p-3">{index === 0 ? 'Original' : `Extend-${index}`}</td>
                    <td className="p-3">{new Date(rate.updatedAt || rate.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">{rate.validityFromDate}</td>
                    <td className="p-3">{rate.validityToDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-200">
            <Button variant="outline" onClick={() => setShowHistory(false)} className="rounded-none h-9 px-8">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
