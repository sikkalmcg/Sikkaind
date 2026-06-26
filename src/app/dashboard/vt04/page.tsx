'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { collection, doc } from '@/lib/mongo-store';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import {
  useMongoStore,
  useCollectionOptimized,
  useMemoMongo,
  useUser,
  useDoc,
} from '@/mongodb';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, FileSpreadsheet, Loader2 } from 'lucide-react';

const SHARED_HUB_ID = 'Sikkaind';
const DEFAULT_FORM = {
  plantCode: 'ALL',
  fromDate: '',
  toDate: '',
};

type ShipmentRow = {
  plant: string;
  tripId: string;
  date: string;
  consignor: string;
  consignee: string;
  shipToParty: string;
  origin: string;
  destination: string;
  assignQty: number;
  vehicleNumber: string;
  driverMobile: string;
  cnNo: string;
  cnDate: string;
  package: string;
  primaryFreightRate: number;
  primaryFreightAmount: number;
  secondaryFreightRate: number;
  secondaryFreightAmount: number;
  lossProfit: number;
  outDateTime: string;
  arrivedDateTime: string;
  unloadDateTime: string;
  rejectDateTime: string;
  reasonRejection: string;
};

function safeUpper(v: any) {
  return (v ?? '').toString().trim().toUpperCase();
}

function safeNum(v: any) {
  const n = typeof v === 'number' ? v : parseFloat((v ?? '').toString());
  return Number.isFinite(n) ? n : 0;
}

function toISODateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function withinDateRange(value: any, fromDate: string, toDate: string) {
  if (!fromDate && !toDate) return true;
  if (!value) return false;

  const dt = typeof value === 'string' ? new Date(value) : value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(dt.getTime())) return false;

  const valDateOnly = toISODateOnly(dt);
  if (fromDate && valDateOnly < fromDate) return false;
  if (toDate && valDateOnly > toDate) return false;
  return true;
}

function formatMaybeDateTime(value: any) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return format(dt, 'dd-MM HH:mm');
}

export default function VT04Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useMongoStore();
  const { user } = useUser();

  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  const [form, setForm] = React.useState(DEFAULT_FORM);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [executing, setExecuting] = React.useState(false);

  const [rows, setRows] = React.useState<ShipmentRow[]>([]);
  const [reportGenerated, setReportGenerated] = React.useState(false);

  // Prefetch collections
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const tripsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const vkRatesQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates'), [db]);

  const { data: plants } = useCollectionOptimized(plantsQuery);
  const { data: trips } = useCollectionOptimized(tripsQuery);
  const { data: vkRates } = useCollectionOptimized(vkRatesQuery);

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
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    if (!isBootstrapAdmin && authorizedPlantCodes && authorizedPlantCodes.length === 1) {
      setForm((prev) => ({ ...prev, plantCode: authorizedPlantCodes[0] }));
    }
  }, [mounted, authorizedPlantCodes, isBootstrapAdmin]);

  const validate = () => {
    const nextErrors: string[] = [];
    if (!form.fromDate && !form.toDate) {
      nextErrors.push('Select From Date or To Date');
    }

    if (form.fromDate && form.toDate && form.fromDate > form.toDate) {
      nextErrors.push('From Date cannot be after To Date');
    }

    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const resolvePrimaryRate = (trip: any) => {
    const plantCode = safeUpper(trip.plantCode);
    const origin = safeUpper(trip.origin || trip.from || '');
    const destination = safeUpper(trip.destination || trip.to || '');
    const minWt = safeNum(trip.minimumGranteeWeightMt);
    const conditionRecord = trip.conditionRecord || 'Regular';

    const match = (vkRates || []).find((r: any) => {
      const rPlant = safeUpper(r.plantCode);
      const rOrigin = safeUpper(r.origin);
      const rDest = safeUpper(r.destination);
      const rMinWt = safeNum(r.minimumGranteeWeightMt);
      const rCond = (r.conditionRecord || 'Regular').toString();
      return rPlant === plantCode && rOrigin === origin && rDest === destination && rMinWt === minWt && rCond === conditionRecord;
    });

    return match ? safeNum(match.ratePMT) : 0;
  };

  const resolveSecondaryRateAmount = (trip: any) => {
    const secondaryRate = safeNum(trip.rate);
    const secondaryAmount = safeNum(trip.freightAmount);
    return { secondaryRate, secondaryAmount };
  };

  const handleExecute = async () => {
    if (!validate()) return;
    setExecuting(true);
    setReportGenerated(false);

    try {
      const fromDate = form.fromDate;
      const toDate = form.toDate;
      const selectedPlant = form.plantCode;

      const tripList: any[] = (trips || []).slice();

      const filteredTrips = tripList.filter((t) => {
        const plantOk = selectedPlant === 'ALL'
          ? isBootstrapAdmin || true
          : safeUpper(t.plantCode) === safeUpper(selectedPlant);

        if (!plantOk) return false;
        return withinDateRange(t.createdAt || t.assignDate || t.updatedAt, fromDate, toDate);
      });

      const nextRows: ShipmentRow[] = [];

      for (const t of filteredTrips) {
        const primaryRate = resolvePrimaryRate(t);
        const assignQty = safeNum(t.assignWeight || t.balance || t.weight);
        const primaryAmount = primaryRate * assignQty;

        const { secondaryRate, secondaryAmount } = resolveSecondaryRateAmount(t);
        const lossProfit = primaryAmount - secondaryAmount;

        const packageStr = (t.invoices || [])
          .map((inv: any) => {
            const pkg = inv.pkg ?? '';
            return pkg !== '' && pkg !== 0 ? String(pkg) : '';
          })
          .filter(Boolean)
          .join(', ');

        const row: ShipmentRow = {
          plant: safeUpper(t.plantCode),
          tripId: safeUpper(t.tripNo || t.id || ''),
          date: format(new Date(t.createdAt || t.assignDate || Date.now()), 'dd-MMM-yyyy'),
          consignor: safeUpper(t.consignorName || t.consignorCode),
          consignee: safeUpper(t.consigneeName || t.consigneeCode),
          shipToParty: safeUpper(t.shipToParty || t.shipToPartyCode),
          origin: safeUpper(t.from || ''),
          destination: safeUpper(t.destination || ''),
          assignQty,
          vehicleNumber: safeUpper(t.vehicleNo || ''),
          driverMobile: safeUpper(t.driverMobile || ''),
          cnNo: safeUpper(t.cnNumber || t.cnNo || ''),
          cnDate: t.cnDate ? format(new Date(t.cnDate), 'dd-MMM-yyyy') : '-',
          package: packageStr || '-',
          primaryFreightRate: primaryRate,
          primaryFreightAmount: primaryAmount,
          secondaryFreightRate: secondaryRate,
          secondaryFreightAmount: secondaryAmount,
          lossProfit,
          outDateTime: formatMaybeDateTime(t.outDate),
          arrivedDateTime: formatMaybeDateTime(t.arrivedDate),
          unloadDateTime: formatMaybeDateTime(t.unloadDate),
          rejectDateTime: formatMaybeDateTime(t.rejectionDate),
          reasonRejection: safeUpper(t.reasonRejection || t.reason || ''),
        };

        nextRows.push(row);
      }

      setRows(nextRows);
      setReportGenerated(true);
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = () => {
    setForm(DEFAULT_FORM);
    setErrors([]);
    setRows([]);
    setReportGenerated(false);
  };

  const exportExcel = () => {
    const header = [
      'Plant', 'Trip ID', 'Date', 'Consignor', 'Consignee', 'Ship to Party',
      'Origin', 'Destination', 'Assign Qty', 'Vehicle Number', 'Driver Mobile',
      'CN No.', 'CN Date', 'Package', 'Primary Freight Rate', 'Primary Freight Amount',
      'Secondary Freight Rate', 'Secondary Freight Amount', 'Loss/Profit',
      'Out Date time', 'Arrived Date time', 'Unload Date time', 'Reject Date time', 'Reason Rejection'
    ];

    const csvRows = rows.map((r) => [
      r.plant, r.tripId, r.date, r.consignor, r.consignee, r.shipToParty,
      r.origin, r.destination, r.assignQty, r.vehicleNumber, r.driverMobile,
      r.cnNo, r.cnDate, r.package, r.primaryFreightRate, r.primaryFreightAmount,
      r.secondaryFreightRate, r.secondaryFreightAmount, r.lossProfit,
      r.outDateTime, r.arrivedDateTime, r.unloadDateTime, r.rejectDateTime, r.reasonRejection
    ]);

    const escape = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const csv = [header.map(escape).join(','), ...csvRows.map((rr) => rr.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VT04_Shipment_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!mounted) return null;

  const plantOptions = (plants || []).filter((p: any) => {
    if (isBootstrapAdmin) return true;
    if (!authorizedPlantCodes) return false;
    return authorizedPlantCodes.includes(p.plantCode);
  });

  return (
    <div className="h-screen w-full flex flex-col p-6 bg-[#f2f2f2] font-mono text-black overflow-hidden">
      {/* Top Bar Header */}
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-4 shadow-sm flex items-end justify-between gap-4 flex-shrink-0">
        <h2 className="text-[16px] font-bold uppercase italic">VT04 – Shipment Report</h2>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase font-black tracking-widest">
          <span className="inline-flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            {reportGenerated ? `${rows.length} records` : 'Execute to generate'}
          </span>
        </div>
      </div>

      {/* Input Selection Form Block */}
      <div className="bg-white border border-slate-300 shadow-inner p-6 mb-4 flex-shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Plant</label>
            <select
              value={form.plantCode}
              disabled={!isBootstrapAdmin && authorizedPlantCodes?.length === 1}
              onChange={(e) => setForm((p) => ({ ...p, plantCode: e.target.value }))}
              className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"
            >
              {isBootstrapAdmin && <option value="ALL">All Plants</option>}
              {plantOptions.map((p: any) => (
                <option key={p.id} value={p.plantCode}>
                  {p.plantCode}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">From Date</label>
            <input
              type="date"
              value={form.fromDate}
              onChange={(e) => setForm((p) => ({ ...p, fromDate: e.target.value }))}
              className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">To Date</label>
            <input
              type="date"
              value={form.toDate}
              onChange={(e) => setForm((p) => ({ ...p, toDate: e.target.value }))}
              className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal outline-none"
            />
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 p-2 text-[10px] text-red-700">
            {errors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-3">
          <Button variant="outline" className="h-9 rounded-none px-8 text-xs" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            className="h-9 bg-[#0056d2] text-white rounded-none px-12 text-xs"
            onClick={handleExecute}
            disabled={executing}
          >
            {executing ? 'Executing...' : 'Execute'}
          </Button>
        </div>
      </div>

      {/* Main Full-Page Table Grid Output Area */}
      <div className="bg-white border border-slate-300 shadow-inner flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Table Action Utilities */}
        <div className="flex items-center justify-between gap-3 p-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="text-[10px] font-black uppercase italic text-slate-600">Shipment Data Grid</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8 rounded-none text-[10px] font-normal"
              disabled={!reportGenerated || rows.length === 0}
              onClick={exportExcel}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Export excel
            </Button>
          </div>
        </div>

        {/* Scrollable Container Wrapper */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[11px] min-w-[2400px] border-collapse">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-300 font-normal uppercase text-slate-500 bg-white">
              <tr>
                <th className="p-3 border-r bg-[#f8fafc]">Plant</th>
                <th className="p-3 border-r bg-[#f8fafc]">Trip ID</th>
                <th className="p-3 border-r bg-[#f8fafc]">Date</th>
                <th className="p-3 border-r bg-[#f8fafc]">Consignor</th>
                <th className="p-3 border-r bg-[#f8fafc]">Consignee</th>
                <th className="p-3 border-r bg-[#f8fafc]">Ship to Party</th>
                <th className="p-3 border-r bg-[#f8fafc]">Origin</th>
                <th className="p-3 border-r bg-[#f8fafc]">Destination</th>
                <th className="p-3 border-r text-right bg-[#f8fafc]">Assign Qty</th>
                <th className="p-3 border-r bg-[#f8fafc]">Vehicle Number</th>
                <th className="p-3 border-r bg-[#f8fafc]">Driver Mobile</th>
                <th className="p-3 border-r bg-[#f8fafc]">CN No.</th>
                <th className="p-3 border-r bg-[#f8fafc]">CN Date</th>
                <th className="p-3 border-r bg-[#f8fafc]">Package</th>
                <th className="p-3 border-r text-right bg-[#f8fafc]">Primary Freight Rate</th>
                <th className="p-3 border-r text-right bg-[#f8fafc]">Primary Freight Amount</th>
                <th className="p-3 border-r text-right bg-[#f8fafc]">Secondary Freight Rate</th>
                <th className="p-3 border-r text-right bg-[#f8fafc]">Secondary Freight Amount</th>
                <th className="p-3 border-r text-right bg-[#f8fafc]">Loss/Profit</th>
                <th className="p-3 border-r bg-[#f8fafc]">Out Date time</th>
                <th className="p-3 border-r bg-[#f8fafc]">Arrived Date time</th>
                <th className="p-3 border-r bg-[#f8fafc]">Unload Date time</th>
                <th className="p-3 border-r bg-[#f8fafc]">Reject Date time</th>
                <th className="p-3 bg-[#f8fafc]">Reason Rejection</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.tripId}-${idx}`} className="border-b border-slate-100 hover:bg-blue-50/20">
                  <td className="p-3 border-r">{r.plant}</td>
                  <td className="p-3 border-r text-blue-600 font-bold">{r.tripId}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.date}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.consignor}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.consignee}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.shipToParty}</td>
                  <td className="p-3 border-r">{r.origin}</td>
                  <td className="p-3 border-r">{r.destination}</td>
                  <td className="p-3 border-r text-right font-bold">{r.assignQty.toFixed(3)}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.vehicleNumber}</td>
                  <td className="p-3 border-r">{r.driverMobile}</td>
                  <td className="p-3 border-r">{r.cnNo}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.cnDate}</td>
                  <td className="p-3 border-r">{r.package}</td>
                  <td className="p-3 border-r text-right">{r.primaryFreightRate.toFixed(2)}</td>
                  <td className="p-3 border-r text-right">{r.primaryFreightAmount.toFixed(2)}</td>
                  <td className="p-3 border-r text-right">{r.secondaryFreightRate.toFixed(2)}</td>
                  <td className="p-3 border-r text-right">{r.secondaryFreightAmount.toFixed(2)}</td>
                  <td className={cn('p-3 border-r text-right font-bold', r.lossProfit >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {r.lossProfit.toFixed(2)}
                  </td>
                  <td className="p-3 border-r whitespace-nowrap">{r.outDateTime}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.arrivedDateTime}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.unloadDateTime}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.rejectDateTime}</td>
                  <td className="p-3 truncate max-w-xs">{r.reasonRejection}</td>
                </tr>
              ))}

              {!executing && reportGenerated && rows.length === 0 && (
                <tr>
                  <td colSpan={24} className="p-20 text-center text-slate-400 italic uppercase font-black text-[10px] tracking-widest">
                    No records found
                  </td>
                </tr>
              )}

              {executing && (
                <tr>
                  <td colSpan={24} className="p-20 text-center">
                    <div className="flex items-center justify-center gap-3 text-slate-400 font-bold text-xs">
                      <Loader2 className="h-5 w-5 animate-spin text-[#0056d2]" /> GENERATING REPORT DATA GRID...
                    </div>
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