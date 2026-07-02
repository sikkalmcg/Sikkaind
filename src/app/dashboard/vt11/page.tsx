'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { collection, doc } from '@/lib/mongo-store';
import { format } from 'date-fns';
import {
  useMongoStore,
  useCollectionOptimized,
  useMemoMongo,
  useUser,
  useDoc,
} from '@/mongodb';
import { FileSpreadsheet, Loader2 } from 'lucide-react';

const SHARED_HUB_ID = 'Sikkaind';

const DEFAULT_FORM = {
  plantCode: 'ALL',
  fromDate: '',
  toDate: '',
  vendorId: 'ALL',
  arrangeBy: 'ALL',
  destinationId: 'ALL',
};

type ForwardingAgentRow = {
  id: string;
  arrangeByName?: string;
  mobileNumber?: string;
};

type MasterOption = {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  label?: string;
};

type ReportRow = {
  tripId: string;
  lrNo: string;
  lrDate: string;
  saleOrder: string;
  billToParty: string;
  shipToParty: string;
  origin: string;
  destination: string;
  invoiceNo: string;
  totalPackages: number;
  weightWithUom: string;
  fleetType: string;
  vehicleNumber: string;
  driverMobileNumber: string;
  vendorName: string;
  secondaryRate: number;
  secondaryFreight: number;
  arrangeBy: string;
  primaryRate: number;
  primaryFreightAmount: number;
  outDateTime: string;
  arrivedDateTime: string;
  unloadDateTime: string;
  rejectDateTime: string;
  podStatus: string;
  currentStatus: string;
};

function safeUpper(v: any) {
  return (v ?? '').toString().trim().toUpperCase();
}

function safeStr(v: any) {
  const s = v === null || v === undefined ? '' : String(v);
  return s.trim();
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

function formatMaybeDateOnly(value: any) {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return format(dt, 'dd-MMM-yyyy');
}

export default function VT11FreightCostReportPage() {
  const db = useMongoStore();
  const { user } = useUser();

  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);

  const [form, setForm] = React.useState(DEFAULT_FORM);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [executing, setExecuting] = React.useState(false);

  const [rows, setRows] = React.useState<ReportRow[]>([]);
  const [reportGenerated, setReportGenerated] = React.useState(false);

  // Masters / reference
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const tripBoardQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);

  const forwardingAgentsQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'forwarding_agents'),
    [db]
  );

  // These may differ in your data model; adjust if needed.
  const vendorQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'vendors'),
    [db]
  );
  const destinationQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'destination_master'),
    [db]
  );

  const { data: plants } = useCollectionOptimized(plantsQuery);
  const { data: tripBoard } = useCollectionOptimized(tripBoardQuery);
  const { data: forwardingAgents } = useCollectionOptimized(forwardingAgentsQuery);
  const { data: vendors } = useCollectionOptimized(vendorQuery);
  const { data: destinations } = useCollectionOptimized(destinationQuery);

  // Authorized plant filtering (same pattern as VT04)
  const [registryId, setRegistryId] = React.useState<string | null>(null);
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

  const plantOptions = (plants || []).filter((p: any) => {
    if (isBootstrapAdmin) return true;
    if (!authorizedPlantCodes) return false;
    return authorizedPlantCodes.includes(p.plantCode);
  });

  const forwardingArrangeByOptions = React.useMemo(() => {
    const list: ForwardingAgentRow[] = (forwardingAgents || []).map((a: any) => ({
      id: a?.id || a?._id || crypto.randomUUID(),
      arrangeByName: a?.arrangeByName,
      mobileNumber: a?.mobileNumber,
    }));

    return list
      .filter((a) => safeStr(a.arrangeByName).length > 0)
      .sort((x, y) => (safeUpper(x.arrangeByName) < safeUpper(y.arrangeByName) ? -1 : 1));
  }, [forwardingAgents]);

  const vendorOptions = React.useMemo(() => {
    return (vendors || []).map((v: any) => ({
      id: v?.id || v?._id || crypto.randomUUID(),
      code: safeStr(v?.vendorCode || v?.code),
      name: safeStr(v?.vendorName || v?.name),
      description: safeStr(v?.description),
    }));
  }, [vendors]);

  const destinationOptions = React.useMemo(() => {
    return (destinations || []).map((d: any) => ({
      id: d?.id || d?._id || crypto.randomUUID(),
      code: safeStr(d?.destinationCode || d?.code),
      name: safeStr(d?.destinationName || d?.name),
      description: safeStr(d?.description),
    }));
  }, [destinations]);

  const validate = () => {
    const next: string[] = [];
    if (!form.fromDate && !form.toDate) next.push('Select From Date or To Date');
    if (form.fromDate && form.toDate && form.fromDate > form.toDate) next.push('From Date cannot be after To Date');
    setErrors(next);
    return next.length === 0;
  };

  const exportExcel = () => {
    const header = [
      'Trip ID',
      'LR No.',
      'LR Date',
      'Sale Order',
      'Bill To Party',
      'Ship To Party',
      'Origin',
      'Destination',
      'Invoice No.',
      'Total Packages',
      'Weight (with UOM)',
      'Fleet Type',
      'Vehicle Number',
      'Driver Mobile Number',
      'Vendor Name',
      'Secondary Rate',
      'Secondary Freight',
      'Arrange By',
      'Primary Rate',
      'Primary Freight Amount',
      'Out Date & Time',
      'Arrived Date & Time',
      'Unload Date & Time',
      'Reject Date & Time',
      'POD Status',
      'Current Status',
    ];

    const csvRows = rows.map((r) => [
      r.tripId,
      r.lrNo,
      r.lrDate,
      r.saleOrder,
      r.billToParty,
      r.shipToParty,
      r.origin,
      r.destination,
      r.invoiceNo,
      r.totalPackages,
      r.weightWithUom,
      r.fleetType,
      r.vehicleNumber,
      r.driverMobileNumber,
      r.vendorName,
      r.secondaryRate,
      r.secondaryFreight,
      r.arrangeBy,
      r.primaryRate,
      r.primaryFreightAmount,
      r.outDateTime,
      r.arrivedDateTime,
      r.unloadDateTime,
      r.rejectDateTime,
      r.podStatus,
      r.currentStatus,
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
    a.download = `VT11_Freight_Cost_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExecute = async () => {
    if (!validate()) return;
    setExecuting(true);
    setReportGenerated(false);

    try {
      const fromDate = form.fromDate;
      const toDate = form.toDate;
      const selectedPlant = form.plantCode;

      const vendorNameById = new Map(
        vendorOptions.map((v) => [
          v.id,
          v.name || v.code || '-',
        ])
      );

      const destinationNameById = new Map(
        destinationOptions.map((d) => [
          d.id,
          d.name || d.code || '-',
        ])
      );

      const arrangeByNameById = new Map(
        forwardingArrangeByOptions.map((a) => [a.id, a.arrangeByName || '-'])
      );

      const filtered = (tripBoard || []).filter((t: any) => {
        const plantOk = selectedPlant === 'ALL' ? true : safeUpper(t.plantCode) === safeUpper(selectedPlant);

        // Using "any date" since user said create anything.
        const dateOk = withinDateRange(t.lrDate || t.createdAt || t.outDate || t.assignDate || t.updatedAt || t.inDateTime, fromDate, toDate);

        const vendorOk = form.vendorId === 'ALL' ? true : safeUpper(t.vendorId || t.vendorCode || t.vendor?.id || t.vendor) === safeUpper(form.vendorId);
        const destinationOk = form.destinationId === 'ALL' ? true : safeUpper(t.destinationId || t.destinationCode || t.destination?.id || t.destination) === safeUpper(form.destinationId);

        const arrangeByOk = form.arrangeBy === 'ALL'
          ? true
          : safeUpper(t.arrangeById || t.arrangeByName || t.forwardingAgentId || t.forwarding_agent_id) === safeUpper(form.arrangeBy);

        return plantOk && dateOk && vendorOk && destinationOk && arrangeByOk;
      });

      const nextRows: ReportRow[] = filtered.map((t: any) => {
        const tripId = safeStr(t.tripNo || t.tripId || t.tripNoText || t.id);
        const lrNo = safeStr(t.lrNo || t.lrNoNumber || t.lrNumber);
        const lrDate = formatMaybeDateOnly(t.lrDate || t.lr_dt || t.createdAt);

        const saleOrder = safeStr(t.saleOrder || t.saleOrderNo || t.soNo);
        const billToParty = safeStr(t.billToParty || t.billTo || t.bill_to);
        const shipToParty = safeStr(t.shipToParty || t.shipTo || t.ship_to);

        const origin = safeUpper(t.origin || t.from || '');
        const destination = safeUpper(t.destination || t.to || '');

        const invoiceNo = safeStr(t.invoiceNo || t.invoice || t.invNo);

        const totalPackages = safeNum(t.totalPackages || t.packageTotal || (t.packages ? t.packages : 0));

        const weightVal = safeNum(t.weight || t.totalWeight || t.totalWeightMt || t.totalWeightMtKg);
        const uom = safeStr(t.uom || t.weightUom || t.weight_uom);
        const weightWithUom = `${weightVal}${uom ? ` ${uom}` : ''}`.trim() || '-';

        const fleetType = safeStr(t.fleetType || t.fleet_type);
        const vehicleNumber = safeStr(t.vehicleNo || t.vehicleNumber || t.vehicle_no);
        const driverMobileNumber = safeStr(t.driverMobile || t.driverMobileNumber || t.driver_mobile);

        const vendorName = (() => {
          const id = safeStr(t.vendorId || t.vendorCode || t.vendor?.id || t.vendor);
          // If the filter matches by id/code, still show name when possible.
          return vendorOptions.find((v) => safeUpper(v.id) === safeUpper(id))?.name ||
            vendorNameById.get(id) ||
            safeStr(t.vendorName || t.vendor?.name) ||
            id ||
            '-';
        })();

        const secondaryRate = safeNum(t.secondaryRate || t.secRate || t.rate2);
        const secondaryFreight = safeNum(t.secondaryFreight || t.secondaryFreightAmount || t.secFreightAmount || t.freightAmount2);

        const arrangeBy = safeStr(t.arrangeByName || t.arrangeBy || arrangeByNameById.get(safeStr(t.arrangeById || t.forwardingAgentId)));

        const primaryRate = safeNum(t.primaryRate || t.priRate || t.rate1);
        const primaryFreightAmount = safeNum(t.primaryFreightAmount || t.primaryFreight || t.freightAmount1 || t.priFreightAmount);

        const outDateTime = formatMaybeDateTime(t.outDate || t.outDateTime || t.out_dt);
        const arrivedDateTime = formatMaybeDateTime(t.arrivedDate || t.arrivedDateTime || t.arrived_dt);
        const unloadDateTime = formatMaybeDateTime(t.unloadDate || t.unloadDateTime || t.unload_dt);
        const rejectDateTime = formatMaybeDateTime(t.rejectDate || t.rejectDateTime || t.rejectionDate || t.reject_dt);

        const podStatus = safeStr(t.podStatus || t.PODStatus || t.pod_status);
        const currentStatus = safeStr(t.status || t.currentStatus || t.tripStatus);

        return {
          tripId,
          lrNo,
          lrDate,
          saleOrder,
          billToParty,
          shipToParty,
          origin,
          destination,
          invoiceNo,
          totalPackages,
          weightWithUom,
          fleetType,
          vehicleNumber,
          driverMobileNumber,
          vendorName,
          secondaryRate,
          secondaryFreight,
          arrangeBy,
          primaryRate,
          primaryFreightAmount,
          outDateTime,
          arrivedDateTime,
          unloadDateTime,
          rejectDateTime,
          podStatus,
          currentStatus,
        };
      });

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

  if (!mounted) return null;

  return (
    <div className="h-screen w-full flex flex-col p-6 bg-[#f2f2f2] font-mono text-black overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-4 shadow-sm flex items-end justify-between gap-4 flex-shrink-0">
        <h2 className="text-[16px] font-bold uppercase italic">VT11 – Freight Cost Report</h2>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase font-black tracking-widest">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 bg-blue-600 rounded-full" />
            {reportGenerated ? `${rows.length} records` : 'Execute to generate'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-300 shadow-inner p-6 mb-4 flex-shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
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

          {/* From/To in same row concept */}
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

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Vendor</label>
            <select
              value={form.vendorId}
              onChange={(e) => setForm((p) => ({ ...p, vendorId: e.target.value }))}
              className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"
            >
              <option value="ALL">All</option>
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name || v.code}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Arrange By</label>
            <select
              value={form.arrangeBy}
              onChange={(e) => setForm((p) => ({ ...p, arrangeBy: e.target.value }))}
              className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"
            >
              <option value="ALL">All</option>
              {forwardingArrangeByOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.arrangeByName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[10px] font-normal text-slate-500 uppercase">Destination</label>
            <select
              value={form.destinationId}
              onChange={(e) => setForm((p) => ({ ...p, destinationId: e.target.value }))}
              className="h-9 w-full border border-slate-400 bg-white px-3 text-xs font-normal uppercase outline-none"
            >
              <option value="ALL">All</option>
              {destinationOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.code}
                </option>
              ))}
            </select>
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

      {/* Output */}
      <div className="bg-white border border-slate-300 shadow-inner flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="text-[10px] font-black uppercase italic text-slate-600">Freight Cost Data Grid</div>
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

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[11px] min-w-[2600px] border-collapse">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-300 font-normal uppercase text-slate-500 bg-white">
              <tr>
                {[
                  'Trip ID',
                  'LR No.',
                  'LR Date',
                  'Sale Order',
                  'Bill To Party',
                  'Ship To Party',
                  'Origin',
                  'Destination',
                  'Invoice No.',
                  'Total Packages',
                  'Weight (with UOM)',
                  'Fleet Type',
                  'Vehicle Number',
                  'Driver Mobile Number',
                  'Vendor Name',
                  'Secondary Rate',
                  'Secondary Freight',
                  'Arrange By',
                  'Primary Rate',
                  'Primary Freight Amount',
                  'Out Date & Time',
                  'Arrived Date & Time',
                  'Unload Date & Time',
                  'Reject Date & Time',
                  'POD Status',
                  'Current Status',
                ].map((h) => (
                  <th key={h} className="p-3 border-r bg-[#f8fafc] last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.tripId}-${idx}`} className="border-b border-slate-100 hover:bg-blue-50/20">
                  <td className="p-3 border-r">{r.tripId}</td>
                  <td className="p-3 border-r">{r.lrNo}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.lrDate}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.saleOrder}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.billToParty}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.shipToParty}</td>
                  <td className="p-3 border-r">{r.origin}</td>
                  <td className="p-3 border-r">{r.destination}</td>
                  <td className="p-3 border-r">{r.invoiceNo}</td>
                  <td className="p-3 border-r text-right font-bold">{r.totalPackages}</td>
                  <td className="p-3 border-r">{r.weightWithUom}</td>
                  <td className="p-3 border-r">{r.fleetType}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.vehicleNumber}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.driverMobileNumber}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.vendorName}</td>
                  <td className="p-3 border-r text-right">{r.secondaryRate}</td>
                  <td className="p-3 border-r text-right">{r.secondaryFreight}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.arrangeBy}</td>
                  <td className="p-3 border-r text-right">{r.primaryRate}</td>
                  <td className="p-3 border-r text-right font-bold">{r.primaryFreightAmount}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.outDateTime}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.arrivedDateTime}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.unloadDateTime}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.rejectDateTime}</td>
                  <td className="p-3 border-r">{r.podStatus}</td>
                  <td className="p-3 border-r">
                    <span
                      className={cn(
                        'px-2 py-1 text-[10px] font-black rounded-sm whitespace-nowrap',
                        r.currentStatus?.toLowerCase?.() === 'pod'
                          ? 'bg-purple-100 text-purple-700'
                          : r.currentStatus?.toLowerCase?.() === 'arrived'
                            ? 'bg-indigo-100 text-indigo-700'
                            : r.currentStatus?.toLowerCase?.() === 'in-transit'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {r.currentStatus || '-'}
                    </span>
                  </td>
                </tr>
              ))}

              {!executing && reportGenerated && rows.length === 0 && (
                <tr>
                  <td colSpan={26} className="p-20 text-center text-slate-400 italic uppercase font-black text-[10px] tracking-widest">
                    No records found
                  </td>
                </tr>
              )}

              {executing && (
                <tr>
                  <td colSpan={26} className="p-20 text-center">
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

