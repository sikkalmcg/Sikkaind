'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, useUser, useDoc } from '@/mongodb';
import { collection, doc } from '@/lib/mongo-store';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

const SHARED_HUB_ID = 'Sikkaind';

type ConditionRecord = 'Regular' | 'One time Approval (OTA)';

const CONDITION_OPTIONS: ConditionRecord[] = ['Regular', 'One time Approval (OTA)'];

const VEHICLE_TYPES = [
  'LPT / Mini Truck',
  'Pickup / LCV',
  'LCV',
  'Medium Truck (MCV)',
  'HCV',
  'Multi Axle Truck (MAT)',
  'Trailer',
  'Multi Axle Trailer',
];

const DEFAULT_FORM = {
  id: '',
  plantCode: '',
  destination: '',
  primaryRatePMT: '',
  validityFromDate: '',
  validityToDate: '',
  conditionRecord: 'Regular' as ConditionRecord,
  fixedCharge: false,
  vehicleType: '',
  primaryFreightAmount: '',
};

function toNum(val: any) {
  const n = typeof val === 'number' ? val : parseFloat((val ?? '').toString());
  return Number.isFinite(n) ? n : 0;
}

export default function VK11CreatePrimaryFreightRates() {
  const db = useMongoStore();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const recordId = searchParams.get('id');

  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState<any>(DEFAULT_FORM);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [bulkErrors, setBulkErrors] = React.useState<string[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const primaryRatesQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates'), [db]);

  const { data: plants } = useCollectionOptimized(plantsQuery);
  const { data: primaryRates } = useCollectionOptimized(primaryRatesQuery);

  const recordToUpdateQuery = useMemoMongo(() => {
    if (!recordId) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates', recordId);
  }, [db, recordId]);

  const { data: recordToUpdate } = useDoc(recordToUpdateQuery);


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

  React.useEffect(() => {
    if (recordId && recordToUpdate) {
      setFormData({
        id: recordToUpdate.id,
        plantCode: recordToUpdate.plantCode,
        destination: recordToUpdate.destination,
        primaryRatePMT: recordToUpdate.ratePMT,
        validityFromDate: recordToUpdate.validityFromDate,
        validityToDate: recordToUpdate.validityToDate,
        conditionRecord: recordToUpdate.conditionRecord,
        fixedCharge: recordToUpdate.fixedCharge,
        vehicleType: recordToUpdate.vehicleType,
        primaryFreightAmount: recordToUpdate.primaryFreightAmount,
      });
    }
  }, [recordId, recordToUpdate]);

  const validate = () => {
    const mandatory: Array<keyof typeof DEFAULT_FORM> = [
      'plantCode',
      'destination',
      'validityFromDate',
      'validityToDate',
      'conditionRecord',
    ];

    const nextErrors: string[] = [];

    if (formData.fixedCharge) {
      if (!formData.vehicleType) nextErrors.push('vehicleType');
      if (!formData.primaryFreightAmount) nextErrors.push('primaryFreightAmount');
    } else {
      if (!formData.primaryRatePMT) nextErrors.push('primaryRatePMT');
    }

    if (!formData.fixedCharge && !formData.primaryRatePMT && (formData.fixedCharge && (!formData.vehicleType || !formData.primaryFreightAmount))) {
        alert('Please configure either a Primary Rate (PMT) or a Fixed Charge with Vehicle Type and Primary Freight Charge.');
    }

    const missing = mandatory.filter((k) => {
      const v: any = (formData as any)[k];
      return typeof v === 'string' ? !v.trim() : v === undefined || v === null;
    });

    if (authorizedPlantCodes && authorizedPlantCodes.length > 0) {
      if (!authorizedPlantCodes.includes(formData.plantCode)) {
        missing.push('plantCode');
      }
    }

    setErrors([...missing.map((m) => String(m)), ...nextErrors]);
    return missing.length === 0 && nextErrors.length === 0;
  };

  const isDuplicateRecord = () => {
    const plantCode = (formData.plantCode || '').toUpperCase().trim();
    const destination = (formData.destination || '').toUpperCase().trim();
    const primaryRatePMT = toNum(formData.primaryRatePMT);

    return (primaryRates || []).some((r: any) => {
      if (recordId && r.id === recordId) return false; // Don't compare against itself when updating
      return (
        (r.plantCode || '').toUpperCase().trim() === plantCode &&
        (r.destination || '').toUpperCase().trim() === destination &&
        !formData.fixedCharge && toNum(r.ratePMT) === primaryRatePMT
      );
    });
  };

  const handleExecute = () => {
    if (!validate()) {
      alert('Mandatory fields missing');
      return;
    }

    if (isDuplicateRecord()) {
      alert('Duplicate record restricted. Matching Plant+Destination+Primary Rate (PMT) already exists for a non-fixed charge record.');
      return;
    }

    if (formData.conditionRecord === 'One time Approval (OTA)') {
      const from = new Date(formData.validityFromDate);
      const to = new Date(formData.validityToDate);
      if (from && to && to > from) {
        const diffTime = to.getTime() - from.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) {
          alert('For OTA records, the validity period cannot exceed 7 days.');
          return;
        }
      }
    }

    const id = recordId || crypto.randomUUID();
    const payload: any = {
      id,
      plantCode: formData.plantCode.toUpperCase().trim(),
      destination: formData.destination.toUpperCase().trim(),
      minimumGranteeWeightMt: 0,
      ratePMT: formData.fixedCharge ? 0 : toNum(formData.primaryRatePMT),
      validityFromDate: formData.validityFromDate,
      validityToDate: formData.validityToDate,
      conditionRecord: formData.conditionRecord,
      fixedCharge: formData.fixedCharge,
      vehicleType: formData.fixedCharge ? formData.vehicleType : '',
      primaryFreightAmount: formData.fixedCharge ? toNum(formData.primaryFreightAmount) : 0,
      updatedAt: new Date().toISOString(),
    };

    if (!recordId) {
      payload.createdAt = new Date().toISOString();
    }

    setDocumentNonBlocking(
      doc(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates', id),
      payload,
      { merge: true }
    );
    
    if (recordId) {
      alert('Freight rate updated successfully.');
      router.push('/dashboard/vk12');
    } else {
      setFormData(DEFAULT_FORM);
      alert('Primary freight rate created & synchronized');
    }
  };

  const handleDownloadTemplate = () => {
    const templateHeader = [
      'plantCode',
      'destination',
      'validityFromDate',
      'validityToDate',
      'conditionRecord',
    ];
    const ws = XLSX.utils.aoa_to_sheet([templateHeader]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PrimaryFreightRates');
    XLSX.writeFile(wb, 'VK11_Primary_Freight_Template.xlsx');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleBulkUpload(file);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBulkUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // Get formatted strings
          dateNF: 'mm/dd/yyyy',
        });

        const newErrors: string[] = [];
        const payloads: any[] = [];

        const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;

        json.forEach((row, index) => {
          const rowNum = index + 2;
          const mandatoryFields = ['plantCode', 'destination', 'validityFromDate', 'validityToDate', 'conditionRecord'];
          for (const field of mandatoryFields) {
            if (!row[field]) {
              newErrors.push(`Row ${rowNum}: Mandatory field "${field}" is missing.`);
            }
          }

          if (row.validityFromDate && !dateRegex.test(row.validityFromDate)) {
            newErrors.push(`Row ${rowNum}: "validityFromDate" has invalid format. Use MM/DD/YYYY.`);
          }
          if (row.validityToDate && !dateRegex.test(row.validityToDate)) {
            newErrors.push(`Row ${rowNum}: "validityToDate" has invalid format. Use MM/DD/YYYY.`);
          }

          if (authorizedPlantCodes && !authorizedPlantCodes.includes(row.plantCode)) {
            newErrors.push(`Row ${rowNum}: Plant code "${row.plantCode}" is not authorized for your profile.`);
          }

          const plantCode = (row.plantCode || '').toUpperCase().trim();
          const destination = (row.destination || '').toUpperCase().trim();
          const ratePMT = toNum(row.ratePMT);

          const isDuplicate = (primaryRates || []).some((r: any) =>
            (r.plantCode || '').toUpperCase().trim() === plantCode &&
            (r.destination || '').toUpperCase().trim() === destination &&
            toNum(r.ratePMT) === ratePMT
          );

          if (isDuplicate) {
            newErrors.push(`Row ${rowNum}: Duplicate record restricted for Plant+Destination+Rate (PMT).`);
          }

          if (newErrors.length === 0) {
            const id = crypto.randomUUID();
            payloads.push({
              id,
              plantCode: plantCode,
              destination: destination,
              minimumGranteeWeightMt: 0, // As per requirement to remove
              ratePMT: ratePMT,
              validityFromDate: row.validityFromDate,
              validityToDate: row.validityToDate,
              conditionRecord: row.conditionRecord || 'Regular',
              fixedCharge: false, // Bulk upload defaults to non-fixed
              vehicleType: '',
              primaryFreightAmount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        });

        setBulkErrors(newErrors);

        if (newErrors.length > 0) {
          alert('Upload failed. Please check the errors and try again.');
        } else {
          payloads.forEach(payload => {
            setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates', payload.id), payload, { merge: true });
          });
          alert(`${payloads.length} records uploaded and synchronized successfully.`);
        }
      } catch (error) {
        console.error("Error processing file:", error);
        setBulkErrors(['An unexpected error occurred while processing the file.']);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 shadow-sm">
        <h2 className="text-[16px] font-bold uppercase italic">{recordId ? 'VK11 – Update Primary Freight Rate' : 'VK11 – Create Primary Freight Rates'}</h2>
      </div>

      <div className="bg-white border border-slate-300 shadow-inner p-8 mb-8">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-[14px] font-bold uppercase">Bulk Upload</h3>
            <div className="flex items-center gap-3">
                <Button variant="outline" className="h-10 rounded-none px-6" onClick={handleDownloadTemplate}>
                    Download Template
                </Button>
                <Button className="h-10 bg-green-600 hover:bg-green-700 text-white rounded-none px-8" onClick={() => fileInputRef.current?.click()}>
                    Bulk Upload (Excel)
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".xlsx, .xls" />
            </div>
        </div>
        {bulkErrors.length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Upload Errors</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 text-xs max-h-40 overflow-y-auto">
                {bulkErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-3 gap-x-14 gap-y-6">
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
            <div className="flex items-center gap-2">
                <Checkbox
                    id="fixed-charge"
                    checked={formData.fixedCharge}
                    onCheckedChange={(checked) => setFormData({ ...formData, fixedCharge: !!checked })}
                    className="rounded-none border-slate-400"
                />
                <label htmlFor="fixed-charge" className="text-[10px] font-normal text-slate-500 uppercase cursor-pointer">Fixed Charge</label>
            </div>
          </div>

          {formData.fixedCharge && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-normal text-slate-500 uppercase">Vehicle Type *</label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                  className={cn('h-9 w-full border px-3 text-xs font-normal outline-none',
                    errors.includes('vehicleType') && 'border-red-500 bg-red-50'
                  )}
                >
                  <option value="">Select Vehicle Type...</option>
                  {VEHICLE_TYPES.map((vt) => <option key={vt} value={vt}>{vt}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-normal text-slate-500 uppercase">Primary Freight Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.primaryFreightAmount}
                  onChange={(e) => setFormData({ ...formData, primaryFreightAmount: e.target.value })}
                  className={cn('h-9 w-full border px-3 text-xs font-normal outline-none',
                    errors.includes('primaryFreightAmount') && 'border-red-500 bg-red-50'
                  )}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Primary Rate (PMT) *</label>
            <input
              type="number"
              step="0.01"
              value={formData.primaryRatePMT}
              onChange={(e) => setFormData({ ...formData, primaryRatePMT: e.target.value })}
              disabled={formData.fixedCharge}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none',
                errors.includes('primaryRatePMT') && 'border-red-500 bg-red-50',
                formData.fixedCharge && 'bg-slate-100 cursor-not-allowed'
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Validity Period From Date *</label>
            <input
              type="date"
              max="9999-12-31"
              value={formData.validityFromDate}
              onChange={(e) => setFormData({ ...formData, validityFromDate: e.target.value })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">To Date *</label>
            <input
              type="date"
              max="9999-12-31"
              value={formData.validityToDate}
              onChange={(e) => setFormData({ ...formData, validityToDate: e.target.value })}
              className={cn('h-9 w-full border px-3 text-xs font-normal outline-none')}
            />
          </div>
        </div>

        <div className="mt-10 flex items-center justify-end gap-3">
          <Button variant="outline" className="h-10 rounded-none px-10" onClick={() => recordId ? router.back() : setFormData(DEFAULT_FORM)}>
            Cancel
          </Button>
          <Button className="h-10 bg-[#0056d2] text-white rounded-none px-14" onClick={handleExecute}>
            {recordId ? 'Update Primary Rate' : 'Create Primary Rate'}
          </Button>
        </div>

        <div className="mt-8 bg-slate-50 border border-slate-200 p-4 text-[10px] text-slate-700">
          <div className="font-black uppercase italic text-slate-600">Duplicate record restricted rule</div>
          <div className="mt-2">
            Duplicate record is restricted.
            <br />
            Duplicate match key: Plant + Destination + Primary Rate (PMT).
          </div>
        </div>
      </div>
    </div>
  );
}