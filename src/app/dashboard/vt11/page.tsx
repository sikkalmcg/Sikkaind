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

type ReportRow = {
  tripId: string;
  cnNo: string;
  lrDate: string;
  saleOrder: string;
  consignor: string;
  billToParty: string;
  shipToParty: string;
  origin: string;
  destination: string;
  invoiceNo: string;
  totalUnit: number;
  weight: string;
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

  // Masters Queries
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const salesOrdersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripBoardQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const forwardingAgentsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'forwarding_agents'), [db]);
  const vendorQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const destinationQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'destination_master'), [db]);
  const ratesQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'vk_primary_freight_rates'), [db]);

  const { data: plants } = useCollectionOptimized(plantsQuery);
  const { data: tripBoard } = useCollectionOptimized(tripBoardQuery);
  const { data: salesOrders } = useCollectionOptimized(salesOrdersQuery);
  const { data: forwardingAgents } = useCollectionOptimized(forwardingAgentsQuery);
  const { data: vendors } = useCollectionOptimized(vendorQuery);
  const { data: destinations } = useCollectionOptimized(destinationQuery);
  const { data: vkRates } = useCollectionOptimized(ratesQuery);

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
      arrangeByName: a?.arrangeByName || a?.name,
      mobileNumber: a?.mobileNumber,
    }));
    return list
      .filter((a) => safeStr(a.arrangeByName).length > 0)
      .sort((x, y) => (safeUpper(x.arrangeByName) < safeUpper(y.arrangeByName) ? -1 : 1));
  }, [forwardingAgents]);

  const vendorOptions = React.useMemo(() => {
    return (vendors || []).map((v: any) => ({
      id: v?.id || v?._id || v?.vendorCode || v?.code || crypto.randomUUID(),
      code: safeStr(v?.vendorCode || v?.code),
      name: safeStr(v?.vendorName || v?.name),
      description: safeStr(v?.description),
    }));
  }, [vendors]);

const destinationOptions = React.useMemo(() => {
  return (destinations || []).map((d: any) => ({
    id: d?.id || d?._id || d?.destinationCode || d?.code || crypto.randomUUID(),
    code: safeStr(d?.destinationCode || d?.code),
    name: safeStr(d?.destinationName || d?.name || d?.code), //  इसे d?.name कर दें
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
      'Trip ID', 'CN No.', 'LR Date', 'Sale Order', 'Consignor', 'Bill To Party', 'Ship To Party',
      'Origin', 'Destination', 'Invoice No./E-WAYBILL NO.', 'Total Unit', 'Weight',
      'Fleet Type', 'Vehicle Number', 'Driver Mobile Number', 'Vendor Name', 'Secondary Rate', 
      'Secondary Freight', 'Arrange By', 'Primary Rate', 'Primary Freight Amount', 'Out Date & Time', 
      'Arrived Date & Time', 'POD Status'
    ];

    const csvRows = rows.map((r) => [
      r.tripId, r.cnNo, r.lrDate, r.saleOrder, r.consignor, r.billToParty, r.shipToParty,
      r.origin, r.destination, r.invoiceNo, r.totalUnit, r.weight,
      r.fleetType, r.vehicleNumber, r.driverMobileNumber, r.vendorName, r.secondaryRate,
      r.secondaryFreight, r.arrangeBy, r.primaryRate, r.primaryFreightAmount, r.outDateTime,
      r.arrivedDateTime, r.podStatus, r.currentStatus
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

      const filteredTrips = (tripBoard || []).filter((t: any) => {
        const plantOk = selectedPlant === 'ALL' ? true : safeUpper(t.plantCode) === safeUpper(selectedPlant);
        if (!plantOk) return false;

        const dateTarget = t.assignDate || t.lrDate || t.createdAt || t.outDate || t.inDateTime;
        const dateOk = withinDateRange(dateTarget, fromDate, toDate);
        if (!dateOk) return false;

        const tripVendor = t.vendorId || t.vendorCode || t.vendor?.id || t.vendor;
        const vendorOk = form.vendorId === 'ALL' ? true : safeUpper(tripVendor) === safeUpper(form.vendorId);

        const tripDest = t.destinationId || t.destinationCode || t.destination?.id || t.destination;
        const destinationOk = form.destinationId === 'ALL' ? true : safeUpper(tripDest) === safeUpper(form.destinationId);

        const tripArrange = t.arrangeById || t.arrangeByName || t.forwardingAgentId || t.forwarding_agent_id || t.arrangeBy;
        const arrangeByOk = form.arrangeBy === 'ALL' ? true : safeUpper(tripArrange) === safeUpper(form.arrangeBy);

        return vendorOk && destinationOk && arrangeByOk;
      });

      const nextRows: ReportRow[] = filteredTrips.map((t: any) => {
        const currentOrderNo = t.orderNo || t.saleOrder || t.soNo || t.saleOrderNo;
        const saleOrderDoc = (salesOrders || []).find((so: any) => 
          safeStr(so.orderNo) === safeStr(currentOrderNo) || safeStr(so.id) === safeStr(currentOrderNo)
        );

        const extractedCnNo = safeStr(t.cnNumber || t.lrNo || t.lrNumber || t.lr_no || t.lrNoText || t.lrNoNumber || '-');

        const extractedBillTo = safeStr(
          t.billToParty || 
          t.billTo || 
          t.consigneeName ||
          t.billToName ||
          t.billToPartyName ||
          saleOrderDoc?.billToParty || 
          saleOrderDoc?.billTo || 
          saleOrderDoc?.consigneeName ||
          saleOrderDoc?.customerName ||
          t.customerName ||
          t.consigneeCode ||
          saleOrderDoc?.consigneeCode ||
          '-'
        );

        const invoicesFromTrip = Array.isArray(t.invoices) ? t.invoices.map((i: any) => safeStr(i.invNo)).filter(Boolean) : [];
        const ewaybillsFromTrip = Array.isArray(t.invoices) ? t.invoices.map((i: any) => safeStr(i.ewaybillNo)).filter(Boolean) : [];

        const singleInvoice = safeStr(t.invoiceNo || t.invoice || t.invNo);
        const singleEwaybill = safeStr(t.ewayBillNo || t.eWaybillNo);

        const allInvoices = [...invoicesFromTrip, ...(singleInvoice ? [singleInvoice] : [])];
        const allEwaybills = [...ewaybillsFromTrip, ...(singleEwaybill ? [singleEwaybill] : [])];

        const uniqueInvoices = [...new Set(allInvoices)].join(', ');
        const uniqueEwaybills = [...new Set(allEwaybills)].join(', ');

        const extractedInvoiceEwaybill = [uniqueInvoices, uniqueEwaybills]
          .filter(Boolean)
          .join(' / ');

        const totalUnitFromInvoices = Array.isArray(t.invoices)
          ? t.invoices.reduce((sum: number, i: any) => sum + safeNum(i.pkg), 0)
          : 0;

        const tripWeight = safeNum(t.weight || t.totalWeight || t.assignWeight);

        // --- VK13 Integration logic ---
        const tripPlant = safeUpper(t.plantCode || '');
        const tripOrigin = safeUpper(t.origin || t.from || t.plantCode || '');
        const tripDestination = safeUpper(t.destination || t.to || t.destinationName || '');

        const matchedRates = (vkRates || []).filter((r: any) => 
          safeUpper(r.plantCode) === tripPlant &&
          safeUpper(r.origin) === tripOrigin &&
          safeUpper(r.destination) === tripDestination
        );

        if (matchedRates.length > 0) {
          matchedRates.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
        }

        const fetchedPrimaryRate = matchedRates.length > 0 ? safeNum(matchedRates[0].ratePMT) : 0;
        const calculatedPrimaryFreightAmount = fetchedPrimaryRate * tripWeight;

        // --- Sync POD Status Logic from TR21 ---
        let finalPodStatus = 'PENDING';
        if (t.podUrl || safeUpper(t.podStatus) === 'RECEIVED' || safeUpper(t.status) === 'CLOSED') {
          finalPodStatus = 'RECEIVED';
        } else if (safeUpper(t.podStatus)) {
          finalPodStatus = safeUpper(t.podStatus);
        }

        return {
          tripId: safeStr(t.tripNo || t.tripId || t.id),
          cnNo: extractedCnNo,
          lrDate: formatMaybeDateOnly(t.lrDate || t.createdAt),
          saleOrder: safeStr(currentOrderNo || '-'),
          consignor: safeStr(t.consignorName || saleOrderDoc?.consignorName || t.consignorCode || t.consignor || '-'),
          billToParty: extractedBillTo,
          shipToParty: safeStr(t.shipToParty || saleOrderDoc?.shipToParty || t.shipTo || t.shipToName || '-'),
          origin: tripOrigin,
          destination: tripDestination,
          invoiceNo: extractedInvoiceEwaybill || '-',
          totalUnit: totalUnitFromInvoices || safeNum(t.totalPackages || t.packages || t.totalQty),
          weight: `${tripWeight} MT`,
          fleetType: safeStr(t.fleetType || t.fleet_type || '-'),
          vehicleNumber: safeUpper(t.vehicleNo || t.vehicleNumber || ''),
          driverMobileNumber: safeStr(t.driverMobile || t.driverMobileNumber || ''),
          vendorName: safeStr(t.vendorName || t.vendor?.name || t.vendorId || '-'),
          secondaryRate: safeNum(t.secondaryRate || t.secRate || t.rate),
          secondaryFreight: safeNum(t.secondaryFreight || t.secondaryFreightAmount || t.freightAmount),
          arrangeBy: safeStr(t.arrangeByName || t.arrangeBy || '-'),
          primaryRate: fetchedPrimaryRate,
          primaryFreightAmount: calculatedPrimaryFreightAmount,
          outDateTime: formatMaybeDateTime(t.outDate || t.outDateTime),
          arrivedDateTime: formatMaybeDateTime(t.arrivedDate || t.arrivedDateTime),
          unloadDateTime: formatMaybeDateTime(t.unloadDate || t.unloadDateTime),
          rejectDateTime: formatMaybeDateTime(t.rejectDate || t.rejectDateTime),
          
          podStatus: finalPodStatus, // Set mapped pod status
          
          currentStatus: safeStr(t.status || t.currentStatus || 'In-Transit'),
        };
      });

      setRows(nextRows);
      setReportGenerated(true);
    } catch (e) {
      console.error(e);
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
    <div className="h-screen w-full flex flex-col p-6 bg-slate-100 font-mono text-black overflow-hidden">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-4 shadow-sm flex items-end justify-between gap-4 flex-shrink-0">
        <h2 className="text-[16px] font-bold uppercase italic">VT11 – Freight Cost Report</h2>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase font-black tracking-widest">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 bg-green-600 rounded-full" />
            {reportGenerated ? `${rows.length} records` : 'Execute to generate'}
          </span>
        </div>
      </div>

      {/* Filters Form */}
      {!reportGenerated && (
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
                  <option key={p.id || p._id} value={p.plantCode}>
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
                  <option key={a.id} value={a.arrangeByName}>
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
              className="h-9 bg-green-600 hover:bg-green-700 text-white rounded-none px-12 text-xs"
              onClick={handleExecute}
              disabled={executing}
            >
              {executing ? 'Executing...' : 'Execute'}
            </Button>
          </div>
        </div>
      )}

      {/* Output Grid */}
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
            {reportGenerated && (
              <Button variant="outline" className="h-8 rounded-none px-8 text-xs" onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-[11px] min-w-[2800px] border-collapse">
            <thead className="sticky top-0 z-10 border-b border-slate-300 font-normal uppercase text-slate-500 bg-[#f8fafc]">
              <tr>
                {[
                  'Trip ID', 'CN No.', 'LR Date', 'Sale Order', 'Consignor', 'Bill To Party', 'Ship To Party',
                  'Origin', 'Destination', 'Invoice No./E-WAYBILL NO.', 'Total Unit', 'Weight',
                  'Fleet Type', 'Vehicle Number', 'Driver Mobile Number', 'Vendor Name', 'Secondary Rate',
                  'Secondary Freight', 'Arrange By', 'Primary Rate', 'Primary Freight Amount', 'Out Date & Time',
                  'Arrived Date & Time', 'Unload Date & Time', 'Reject Date & Time', 'POD Status', 'Current Status',
                ].map((h) => (
                  <th key={h} className="p-3 border-r bg-[#f8fafc] last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.tripId}-${idx}`} className="border-b border-slate-100 hover:bg-green-50/20">
                  <td className="p-3 border-r">{r.tripId}</td>
                  <td className="p-3 border-r">{r.cnNo}</td>
                  <td className="p-3 border-r whitespace-nowrap">{r.lrDate}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.saleOrder}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.consignor}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.billToParty}</td>
                  <td className="p-3 border-r max-w-xs truncate">{r.shipToParty}</td>
                  <td className="p-3 border-r">{r.origin}</td>
                  <td className="p-3 border-r">{r.destination}</td>
                  <td className="p-3 border-r">{r.invoiceNo}</td>
                  <td className="p-3 border-r text-right font-bold">{r.totalUnit}</td>
                  <td className="p-3 border-r text-right">{r.weight}</td>
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
                  
                  {/* Style for POD Status */}
                  <td className="p-3 border-r text-center font-bold">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px]",
                      r.podStatus === 'RECEIVED' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {r.podStatus}
                    </span>
                  </td>

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
                  <td colSpan={27} className="p-20 text-center text-slate-400 italic uppercase font-black text-[10px] tracking-widest">
                    No records found
                  </td>
                </tr>
              )}

              {executing && (
                <tr>
                  <td colSpan={27} className="p-20 text-center">
                    <div className="flex items-center justify-center gap-3 text-slate-400 font-bold text-xs">
                      <Loader2 className="h-5 w-5 animate-spin text-green-600" /> GENERATING REPORT DATA GRID...
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