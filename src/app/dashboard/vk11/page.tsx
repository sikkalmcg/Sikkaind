'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, useUser, useDoc } from '@/mongodb';
import { collection, doc } from '@/lib/mongo-store';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';

type ConditionRecord = 'Regular' | 'One time Approval (OTA)';

const CONDITION_OPTIONS: ConditionRecord[] = ['Regular', 'One time Approval (OTA)'];

const DEFAULT_FORM = {
  id: '',
  plantCode: '',
  origin: '',
  destination: '',
  minimumGranteeWeightMt: '',
  ratePMT: '',
  validityFromDate: '',
  validityToDate: '',
  conditionRecord: 'Regular' as ConditionRecord,
};

function toNum(val: any) {
  const n = typeof val === 'number' ? val : parseFloat((val ?? '').toString());
  return Number.isFinite(n) ? n : 0;
}

export default function VK11CreatePrimaryFreightRates() {
  const searchParams = useSearchParams();
  const db = useMongoStore();
  const { user } = useUser();

  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState<any>(DEFAULT_FORM);
  const [errors, setErrors] = React.useState<string[]>([]);

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

  React.useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));
    setMounted(true);

    setFormData((prev: any) => ({
      ...prev,
      conditionRecord: 'Regular',
    }));
  }, []);

  const validate = () => {
    const mandatory: Array<keyof typeof DEFAULT_FORM> = [
      'plantCode',
      'origin',
      'destination',
      'minimumGranteeWeightMt',
      'ratePMT',
      'validityFromDate',
      'validityToDate',
      'conditionRecord',
    ];

    const missing = mandatory.filter((k) => {
      const v: any = (formData as any)[k];
      return typeof v === 'string' ? !v.trim() : v === undefined || v === null;
    });

    if (authorizedPlantCodes && authorizedPlantCodes.length > 0) {
      if (!authorizedPlantCodes.includes(formData.plantCode)) {
        missing.push('plantCode');
      }
    }

    setErrors(missing.map((m) => String(m)));
    return missing.length === 0;
  };

  const isDuplicateRecord = () => {
    const plantCode = (formData.plantCode || '').toUpperCase().trim();
    const origin = (formData.origin || '').toUpperCase().trim();
    const destination = (formData.destination || '').toUpperCase().trim();
    const minWt = toNum(formData.minimumGranteeWeightMt);
    const conditionRecord = formData.conditionRecord;

    return (primaryRates || []).some((r: any) => {
      return (
        (r.plantCode || '').toUpperCase().trim() === plantCode &&
        (r.origin || '').toUpperCase().trim() === origin &&
        (r.destination || '').toUpperCase().trim() === destination &&
        toNum(r.minimumGranteeWeightMt) === minWt &&
        (r.conditionRecord || 'Regular') === conditionRecord
      );
    });
  };

  const handleExecute = () => {
    if (!validate()) {
      alert('Mandatory fields missing');
      return;
    }

    if (isDuplicateRecord()) {
      alert('Duplicate record restricted. Matching Plant+Origin+Destination+Minimum Grantee Weight+Condition record already exists.');
      return;
    }

    const id = crypto.randomUUID();
    const payload = {
      id,
      plantCode: formData.plantCode.toUpperCase().trim(),
      origin: formData.origin.toUpperCase().trim(),
      destination: formData.destination.toUpperCase().trim(),
      minimumGranteeWeightMt: toNum(formData.minimumGranteeWeightMt),
      ratePMT: toNum(formData.ratePMT),
      validityFromDate: formData.validityFromDate,
      validityToDate: formData.validityToDate,
      conditionRecord: formData.conditionRecord,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocumentNonBlocking(
      doc(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates', id),
      payload,
      { merge: true }
    );

    setFormData(DEFAULT_FORM);
    alert('Primary freight rate created & synchronized');
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 shadow-sm">
        <h2 className="text-[16px] font-bold uppercase italic">VK11 – Create Primary Freight Rates</h2>
      </div>

      <div className="bg-white border border-slate-300 shadow-inner p-8">
        <div className="grid grid-cols-2 gap-x-14 gap-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Plant *</label>
            <select
              value={formData.plantCode}
              disabled={isBootstrapAdmin ? false : authorizedPlantCodes?.length === 1}
              onChange={(e) => setFormData({ ...formData, plantCode: e.target.value })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none',
                errors.includes('plantCode') && 'border-red-500 bg-red-50'
              )}
            >
              <option value="">Select Plant...</option>
              {(plants || [])
                .filter((p: any) => !authorizedPlantCodes || authorizedPlantCodes === null || authorizedPlantCodes.includes(p.plantCode))
                .map((p: any) => (
                  <option key={p.id} value={p.plantCode}>
                    {p.plantCode}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Condition record *</label>
            <select
              value={formData.conditionRecord}
              onChange={(e) => setFormData({ ...formData, conditionRecord: e.target.value as ConditionRecord })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none')}
            >
              {CONDITION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Origin *</label>
            <input
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value.toUpperCase() })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none',
                errors.includes('origin') && 'border-red-500 bg-red-50'
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Destination *</label>
            <input
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value.toUpperCase() })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none',
                errors.includes('destination') && 'border-red-500 bg-red-50'
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Minimum Grantee Weight (MT) *</label>
            <input
              type="number"
              step="0.001"
              value={formData.minimumGranteeWeightMt}
              onChange={(e) => setFormData({ ...formData, minimumGranteeWeightMt: e.target.value })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none',
                errors.includes('minimumGranteeWeightMt') && 'border-red-500 bg-red-50'
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Rate (PMT) *</label>
            <input
              type="number"
              step="0.01"
              value={formData.ratePMT}
              onChange={(e) => setFormData({ ...formData, ratePMT: e.target.value })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none',
                errors.includes('ratePMT') && 'border-red-500 bg-red-50'
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Validity Period From Date *</label>
            <input
              type="date"
              value={formData.validityFromDate}
              onChange={(e) => setFormData({ ...formData, validityFromDate: e.target.value })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">To Date *</label>
            <input
              type="date"
              value={formData.validityToDate}
              onChange={(e) => setFormData({ ...formData, validityToDate: e.target.value })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none')}
            />
          </div>
        </div>

        <div className="mt-10 flex items-center justify-end gap-3">
          <Button variant="outline" className="h-10 rounded-none px-10" onClick={() => setFormData(DEFAULT_FORM)}>
            Cancel
          </Button>
          <Button className="h-10 bg-[#0056d2] text-white rounded-none px-14" onClick={handleExecute}>
            Create Primary Rate
          </Button>
        </div>

        <div className="mt-8 bg-slate-50 border border-slate-200 p-4 text-[10px] text-slate-700">
          <div className="font-black uppercase italic text-slate-600">Duplicate record restricted rule</div>
          <div className="mt-2">
            Duplicate is allowed only when any of the following differs.
            <br />
            Duplicate match key: Plant + Origin + Destination + Minimum Grantee Weight (MT) + Condition record.
          </div>
        </div>
      </div>
    </div>
  );
}

