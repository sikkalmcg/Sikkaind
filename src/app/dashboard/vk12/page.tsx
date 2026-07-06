'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, useUser, useDoc } from '@/mongodb';
import { useMemo } from 'react';
import { collection, doc } from '@/lib/mongo-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';

const SHARED_HUB_ID = 'Sikkaind';

type ConditionRecord = 'Regular' | 'One time Approval (OTA)';

const CONDITION_OPTIONS: ConditionRecord[] = ['Regular', 'One time Approval (OTA)'];

function toNum(val: any) {
  const n = typeof val === 'number' ? val : parseFloat((val ?? '').toString());
  return Number.isFinite(n) ? n : 0;
}

export default function VK12UpdatePrimaryFreightRates() {
  const db = useMongoStore();
  const { user } = useUser();
  const router = useRouter();

  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  const [showExtendDialog, setShowExtendDialog] = React.useState(false);
  const [extendRecord, setExtendRecord] = React.useState<any>(null);
  const [newValidityToDate, setNewValidityToDate] = React.useState('');
  const [extendError, setExtendError] = React.useState<string | null>(null);


  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const primaryRatesQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates'), [db]);

  const { data: plants } = useCollectionOptimized(plantsQuery);
  const { data: primaryRates } = useCollectionOptimized(primaryRatesQuery);

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

  const filteredRates = useMemo(() => {
    if (!primaryRates || !mounted) return [];
    let data = primaryRates as any[];
    if (authorizedPlantCodes) {
      data = data.filter((r) => authorizedPlantCodes.includes(r.plantCode));
    }
    return data;
  }, [primaryRates, mounted, authorizedPlantCodes]);

  React.useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));
    setMounted(true);
  }, []);

  const handleUpdate = (recordId: string) => {
    router.push(`/dashboard/vk11?id=${recordId}`);
  };

  const handleOpenExtend = (record: any) => {
    setExtendRecord(record);
    setNewValidityToDate(record.validityToDate || '');
    setExtendError(null);
    setShowExtendDialog(true);
  };

  const handleSaveExtension = () => {
    setExtendError(null);
    if (!extendRecord || !newValidityToDate) {
      setExtendError('"Valid To" date is mandatory.');
      return;
    }

    const newDate = new Date(newValidityToDate + 'T00:00:00');
    const oldDate = new Date(extendRecord.validityToDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (newDate < oldDate || newDate < today) {
      setExtendError('New "Valid To" date cannot be earlier than the current one.');
      return;
    }

    const payload = {
      validityToDate: newValidityToDate,
      updatedAt: new Date().toISOString(),
      auditLog: [
        ...(extendRecord.auditLog || []),
        { action: 'Extended Validity', from: extendRecord.validityToDate, to: newValidityToDate, user: user?.email || 'System', timestamp: new Date().toISOString() }
      ]
    };

    setDocumentNonBlocking(
      doc(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates', extendRecord.id),
      payload,
      { merge: true }
    );

    alert('Validity period extended successfully.');
    setShowExtendDialog(false);
    setExtendRecord(null);
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 shadow-sm">
        <h2 className="text-[16px] font-bold uppercase italic">VK12 – Update Primary Freight Rates</h2>
      </div>

      <div className="bg-white border border-slate-300 shadow-inner p-8">
        <div className="border border-slate-300 shadow-inner overflow-x-auto">
          <table className="w-full text-left text-[11px] min-w-[1200px]">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-300 font-normal uppercase text-slate-500">
              <tr>
                <th className="p-3 border-r">Plant</th>
                <th className="p-3 border-r">Destination</th>
                <th className="p-3 border-r">Condition Record</th>
                <th className="p-3 border-r">Charge Type</th>
                <th className="p-3 border-r">Vehicle Type</th>
                <th className="p-3 border-r text-right">Primary Rate (PMT)</th>
                <th className="p-3 border-r text-right">Fix Amount</th>
                <th className="p-3">Validity</th>
                <th className="p-3">Record Date</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {(filteredRates || []).map((r: any) => (
                <tr
                  key={r.id}
                  className='border-b border-slate-100 hover:bg-blue-50/20'
                >
                  <td className="p-3 border-r">{r.plantCode}</td>
                  <td className="p-3 border-r">{r.destination}</td>
                  <td className="p-3 border-r">{r.conditionRecord}</td>
                  <td className="p-3 border-r">{r.fixedCharge ? 'Fix' : 'PMT'}</td>
                  <td className="p-3 border-r">{r.fixedCharge ? r.vehicleType : 'All Types'}</td>
                  <td className="p-3 border-r text-right">{!r.fixedCharge ? toNum(r.ratePMT).toFixed(2) : '0.00'}</td>
                  <td className="p-3 border-r text-right">{r.fixedCharge ? toNum(r.primaryFreightAmount).toFixed(2) : '0.00'}</td>
                  <td className="p-3 whitespace-nowrap">{r.validityFromDate} - {r.validityToDate}</td>
                  <td className="p-3 whitespace-nowrap">{r.createdAt ? format(new Date(r.createdAt), 'yyyy-MM-dd') : '-'}</td>
                  <td className="p-3 text-center flex gap-2 justify-center">
                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-none" onClick={() => handleUpdate(r.id)}>Update</Button>
                    <Button size="sm" className="h-7 text-xs rounded-none bg-green-600 hover:bg-green-700" onClick={() => handleOpenExtend(r)}>Extend</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent className="max-w-lg rounded-none border-[3px] border-green-600 font-mono p-0 overflow-hidden text-left text-black">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-200 text-left">
            <DialogTitle className="text-[14px] font-normal uppercase text-green-700 italic">Extend Validity Period</DialogTitle>
          </DialogHeader>
          
          {extendRecord && (
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 bg-white border border-slate-200 p-4 shadow-inner text-[10px] font-normal uppercase">
                <div><span className="text-slate-400 text-[8px]">Plant</span><p>{extendRecord.plantCode}</p></div>
                <div><span className="text-slate-400 text-[8px]">Destination</span><p>{extendRecord.destination}</p></div>
                <div><span className="text-slate-400 text-[8px]">Condition Record</span><p>{extendRecord.conditionRecord}</p></div>
                <div><span className="text-slate-400 text-[8px]">Charge Type</span><p>{extendRecord.fixedCharge ? 'Fix' : 'PMT'}</p></div>
                <div><span className="text-slate-400 text-[8px]">Vehicle Type</span><p>{extendRecord.fixedCharge ? extendRecord.vehicleType : 'All Types'}</p></div>
                <div><span className="text-slate-400 text-[8px]">Primary Rate (PMT)</span><p>{!extendRecord.fixedCharge ? toNum(extendRecord.ratePMT).toFixed(2) : '0.00'}</p></div>
                <div><span className="text-slate-400 text-[8px]">Fix Amount</span><p>{extendRecord.fixedCharge ? toNum(extendRecord.primaryFreightAmount).toFixed(2) : '0.00'}</p></div>
                <div><span className="text-slate-400 text-[8px]">Valid From</span><p>{extendRecord.validityFromDate}</p></div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-normal text-slate-500 uppercase">Valid To *</label>
                <input
                  type="date"
                  value={newValidityToDate}
                  min={new Date(extendRecord.validityToDate) < new Date() ? extendRecord.validityToDate : new Date().toISOString().split('T')[0]}
                  onChange={(e) => setNewValidityToDate(e.target.value)}
                  className="h-9 w-full border px-3 text-xs font-normal outline-none focus:bg-yellow-50"
                />
              </div>

              {extendError && (
                <p className="text-xs text-red-600 bg-red-50 p-3 border border-red-200">{extendError}</p>
              )}
            </div>
          )}

          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-200 gap-2">
            <Button onClick={() => setShowExtendDialog(false)} variant="outline" className="rounded-none h-10 uppercase text-[10px] font-normal px-10">Cancel</Button>
            <Button onClick={handleSaveExtension} className="bg-green-600 text-white rounded-none h-10 uppercase text-[10px] font-normal px-16">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
