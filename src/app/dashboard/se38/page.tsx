'use client';

import * as React from 'react';
import { FileText, PlayCircle, Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollectionOptimized, useMemoMongo } from '@/mongodb';
import { collection } from '@/lib/mongo-store';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

const SHARED_HUB_ID = 'Sikkaind';

export default function SE38Page() {
  const db = useMongoStore();
  const [view, setView] = React.useState<'filter' | 'result'>('filter');
  const [search, setSearch] = React.useState({ plant: '', from: format(subDays(new Date(), 7), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') });
  const [results, setResults] = React.useState<any[]>([]);

  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const tripsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  
  const { data: plants } = useCollectionOptimized(plantsQuery);
  const { data: trips } = useCollectionOptimized(tripsQuery);

  const isAnyRelevantDateInRange = (trip: any) => {
    const start = startOfDay(new Date(search.from));
    const end = endOfDay(new Date(search.to));

    const candidates = [
      trip.createdAt,
      trip.assignDate,
      trip.outDate,
      trip.arrivedDate,
      trip.unloadDate,
      trip.rejectionDate,
      trip.updatedAt,
      // compatibility / fallbacks
      trip.assignTime,
      trip.arrivedAt,
      trip.unloadAt,
      trip.rejectAt,
    ];

    return candidates.some((v) => {
      if (!v) return false;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      return isWithinInterval(d, { start, end });
    });
  };

  const handleExecute = () => {
    if (!search.plant || !search.from || !search.to) { alert('Criteria Mandatory'); return; }
    const normalizedPlant = String(search.plant || '').trim().toUpperCase();

    const filtered = (trips || []).filter(t => {
      const tripPlant = String(t?.plantCode || '').trim().toUpperCase();
      const matchPlant = tripPlant === normalizedPlant;
      const matchDate = isAnyRelevantDateInRange(t);
      return matchPlant && matchDate;
    });

    setResults(filtered);
    setView('result');
  };

  const formatTime = (val: any) => {
    if (!val) return '-';
    try {
      return format(new Date(val), 'dd-MM-yy HH:mm');
    } catch (e) {
      return '-';
    }
  };

  const formatDurationHHMM = (startVal: any, endVal: any) => {
    if (!startVal || !endVal) return '-';
    const start = new Date(startVal);
    const end = new Date(endVal);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';

    const diffMs = end.getTime() - start.getTime();
    if (!Number.isFinite(diffMs)) return '-';

    const sign = diffMs < 0 ? '-' : '';
    const absMs = Math.abs(diffMs);
    const totalMinutes = Math.floor(absMs / (60 * 1000));
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;

    return `${sign}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const exportToExcel = () => {
    const headers = [
      'Plant',
      'Trip ID',
      'Sale Order',
      'CN No',
      'CN Date',
      'Invoice No',
      'E-Way Bill No',
      'Vehicle',
      'Fleet Type',
      'Carrier',
      'Vendor Name/Firm',
      'Arrange By',
      'Source',
      'Destination',
      'Consignor',
      'Consignee',
      'Ship To Party',
      'Goods Desc',
      'Status',
      'Total Unit',
      'Qty (MT)',
      'Indent Time',
      'Assign Time',
      'Dispatch Time',
      'Arrived Date & Time',
      'Unload Date & Time',
      'Reject Date & Time',
      'Detain Hours (HH:MM)'
    ];

    const csvRows = results.map(r => {
      const arrivedAt = r.arrivedAt || r.arrivalDateTime || r.arrivedDate || r.arrivedOn || r.arrived || r.createdAt;
      const unloadAt = r.unloadAt || r.unloadDateTime || r.unloadDate || r.unloadedOn || r.unloadAt || r.unloadDate;
      const rejectAt = r.rejectAt || r.rejectDateTime || r.rejectDate || r.rejectedOn || r.rejectionAt;

      const trip = r;
      
      // Extract array based items from TR21 hierarchy
      const invoiceNos = (trip.invoices || []).map((i: any) => i.invNo).filter(Boolean).join(' / ') || '-';
      const ewaybillNos = (trip.invoices || []).map((i: any) => i.ewaybillNo).filter(Boolean).join(' / ') || '-';
      const goodsDesc = (trip.invoices || []).map((i: any) => i.desc).filter(Boolean).join(' / ') || trip.materialName || '-';
      
      const saleOrderNo = trip.orderNo || trip.saleOrderNo || '-';
      const cnNo = trip.cnNumber || '-';
      const cnDate = trip.cnDate || trip.createdAt;
      const vehicle = trip.vehicleNo || '-';
      const fleetType = trip.fleetType || '-';
      const carrier = trip.carrierName || 'PENDING';
      const vendorFirm = trip.vendorName || '-';
      const arrangeBy = trip.arrangeBy || '-';
      const consignor = trip.consignorName || '-';
      const consignee = trip.consigneeName || '-';
      const shipToParty = trip.shipToParty || '-';
      const source = trip.from || '-';
      const destination = trip.destination || '-';
      const status = trip.status || '-';
      
      const totalPackage = (trip.invoices || []).reduce((acc: number, curr: any) => acc + (parseFloat(curr.pkg) || 0), 0) || '-';
      const qtyMt = trip.assignWeight || '-';
      const indentTime = trip.createdAt;
      const assignTime = trip.assignDate;
      const dispatchTime = trip.outDate;
      const arrivedTime = arrivedAt;
      const unloadTime = unloadAt;
      const rejectTime = rejectAt;
      const detainHours = formatDurationHHMM(arrivedTime, unloadTime);

      return [
        trip.plantCode || '-',
        trip.tripNo || '-',
        saleOrderNo,
        cnNo,
        formatTime(cnDate),

        invoiceNos,
        ewaybillNos,
        vehicle,
        fleetType,
        carrier,
        vendorFirm,
        arrangeBy,
        source,
        destination,
        consignor,
        consignee,
        shipToParty,
        goodsDesc,
        status,
        totalPackage,
        qtyMt,
        formatTime(indentTime),
        formatTime(assignTime),
        formatTime(dispatchTime),
        formatTime(arrivedTime),
        formatTime(unloadTime),
        formatTime(rejectTime),
        detainHours
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SE38_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (view === 'result') {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#f2f2f2] font-mono">
        <div className="bg-white border-b border-slate-300 px-8 py-2 flex items-center justify-between shrink-0">
          <h2 className="text-[14px] font-black uppercase italic text-[#1e3a8a]">SE38 - Analysis Result</h2>
          <div className="flex items-center gap-3">
            <Button onClick={exportToExcel} variant="outline" className="h-8 text-[10px] font-black uppercase px-4 rounded-none gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
              <Download className="w-3 h-3" />
              Export Excel
            </Button>
            <Button onClick={() => setView('filter')} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none">New Selection</Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-white m-4 border border-slate-300 green-scrollbar shadow-inner">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-slate-300 whitespace-nowrap">
                <tr className="font-black uppercase text-slate-500">
                  <th className="p-3 border-r border-slate-200">Plant</th>
                  <th className="p-3 border-r border-slate-200">Trip ID</th>
                  <th className="p-3 border-r border-slate-200">Sale Order</th>
                  <th className="p-3 border-r border-slate-200">E-Way Bill No</th>
                  <th className="p-3 border-r border-slate-200">CN No</th>
                  <th className="p-3 border-r border-slate-200">CN Date</th>
                  <th className="p-3 border-r border-slate-200">Invoice No</th>
                  <th className="p-3 border-r border-slate-200">Vehicle</th>
                  <th className="p-3 border-r border-slate-200">Fleet Type</th>
                  <th className="p-3 border-r border-slate-200">Carrier</th>
                  <th className="p-3 border-r border-slate-200">Vendor Name/Firm</th>
                  <th className="p-3 border-r border-slate-200">Arrange By</th>
                  <th className="p-3 border-r border-slate-200">Source</th>
                  <th className="p-3 border-r border-slate-200">Destination</th>
                  <th className="p-3 border-r border-slate-200">Consignor</th>
                  <th className="p-3 border-r border-slate-200">Consignee</th>
                  <th className="p-3 border-r border-slate-200">Ship To Party</th>
                  <th className="p-3 border-r border-slate-200">Goods Desc</th>
                  <th className="p-3 border-r border-slate-200">Status</th>
                  <th className="p-3 border-r border-slate-200">Total Unit</th>
                  <th className="p-3 border-r border-slate-200">Qty (MT)</th>
                  <th className="p-3 border-r border-slate-200">Indent Time</th>
                  <th className="p-3 border-r border-slate-200">Assign Time</th>
                  <th className="p-3 border-r border-slate-200">Dispatch Time</th>
                  <th className="p-3 border-r border-slate-200">Arrived Date &amp; Time</th>
                  <th className="p-3 border-r border-slate-200">Unload Date &amp; Time</th>
                  <th className="p-3 border-r border-slate-200">Reject Date &amp; Time</th>
                  <th className="p-3">Detain Hours (HH:MM)</th>
                </tr>
              </thead>
              <tbody>{results.map((r, i) => (
                <tr key={i} className="hover:bg-blue-50/30 border-b border-slate-100 whitespace-nowrap">
                  <td className="p-3 border-r border-slate-100 uppercase">{r.plantCode || '-'}</td>
                  <td className="p-3 border-r border-slate-100 font-black text-blue-700 uppercase">{r.tripNo || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase">{r.orderNo || r.saleOrderNo || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase">{(r.invoices || []).map((inv: any) => inv.ewaybillNo).filter(Boolean).join(', ') || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase">{r.cnNumber || '-'}</td>
                  <td className="p-3 border-r border-slate-100">{formatTime(r.cnDate || r.createdAt)}</td>
                  <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[120px]" title={(r.invoices || []).map((inv: any) => inv.invNo).filter(Boolean).join(', ')}>
                    {(r.invoices || []).map((inv: any) => inv.invNo).filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="p-3 border-r border-slate-100 uppercase">{r.vehicleNo || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase">{r.fleetType || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase text-[#0056d2]">{r.carrierName || 'PENDING'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.vendorName || ''}>{r.vendorName || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.arrangeBy || ''}>{r.arrangeBy || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase">{r.from || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.destination || ''}>{r.destination || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.consignorName || ''}>{r.consignorName || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.consigneeName || ''}>{r.consigneeName || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.shipToParty || ''}>{r.shipToParty || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={(r.invoices || []).map((inv: any) => inv.desc).filter(Boolean).join(', ') || r.materialName || ''}>
                    {(r.invoices || []).map((inv: any) => inv.desc).filter(Boolean).join(', ') || r.materialName || '-'}
                  </td>
                  <td className="p-3 border-r border-slate-100 uppercase font-black">{r.status || '-'}</td>
                  <td className="p-3 border-r border-slate-100 uppercase">
                    {(r.invoices || []).reduce((acc: number, curr: any) => acc + (parseFloat(curr.pkg) || 0), 0) || '-'}
                  </td>
                  <td className="p-3 border-r border-slate-100 uppercase">{parseFloat(r.assignWeight || 0).toFixed(3)}</td>
                  <td className="p-3 border-r border-slate-100">{formatTime(r.createdAt)}</td>
                  <td className="p-3 border-r border-slate-100">{formatTime(r.assignDate)}</td>
                  <td className="p-3 border-r border-slate-100">{formatTime(r.outDate)}</td>
                  <td className="p-3 border-r border-slate-100">{formatTime(r.arrivedDate)}</td>
                  <td className="p-3 border-r border-slate-100">{formatTime(r.unloadDate)}</td>
                  <td className="p-3 border-r border-slate-100">{formatTime(r.rejectionDate)}</td>
                  <td className="p-3">{formatDurationHHMM(r.arrivedDate || r.createdAt, r.unloadDate)}</td>
                </tr>
              ))}</tbody>
            </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-10 font-mono bg-[#f2f2f2] overflow-y-auto">
      <div className="bg-white border border-slate-300 p-8 shadow-sm rounded-sm animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-10">
          <div className="flex items-center gap-4">
             <FileText className="h-6 w-6 text-[#1e3a8a]" />
             <h2 className="text-xl font-black uppercase italic text-[#1e3a8a]">SE38: Transactional Analytics (TR21 Mode)</h2>
          </div>
          <Button onClick={handleExecute} className="h-9 bg-[#1e3a8a] text-white text-[11px] font-black uppercase px-10 shadow-lg">Execute Analysis (F8)</Button>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-center gap-8">
            <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Plant:</label>
            <select value={search.plant} onChange={e => setSearch({...search, plant: e.target.value})} className="h-8 w-80 border border-slate-400 bg-white px-2 text-[12px] font-black uppercase">
              <option value="">Select Plant...</option>
              {(plants || []).map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-8">
            <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">From Date:</label>
            <input type="date" value={search.from} onChange={e => setSearch({...search, from: e.target.value})} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black" />
          </div>
          <div className="flex items-center gap-8">
            <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">To Date:</label>
            <input type="date" value={search.to} onChange={e => setSearch({...search, to: e.target.value})} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black" />
          </div>
        </div>
      </div>
    </div>
  );
}