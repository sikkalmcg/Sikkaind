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

  const handleExecute = () => {
    if (!search.plant || !search.from || !search.to) { alert('Criteria Mandatory'); return; }
    const filtered = (trips || []).filter(t => {
      const matchPlant = t.plantCode === search.plant;
      const matchDate = isWithinInterval(new Date(t.createdAt), { start: startOfDay(new Date(search.from)), end: endOfDay(new Date(search.to)) });
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

  const exportToExcel = () => {
    const headers = [
      'Plant', 'Trip ID', 'CN No', 'Vehicle', 'Vehicle Type', 'Transporter',
      'Source', 'Destination', 'Consignor', 'Consignee', 'Ship To Party',
      'Item Description', 'Status', 'Qty (MT)', 'Indent Time', 'Assign Time',
      'Dispatch Time', 'POD Status', 'POD Time'
    ];

    const csvRows = results.map(r => {
      return [
        r.plantCode || '-',
        r.tripNo || r.tripId || r.id || '-',
        r.cnNumber || r.cnNo || r.lrNo || r.lrNumber || '-',
        r.vehicleNo || r.vehicleNumber || r.truckNo || r.truckNumber || '-',
        r.vehicleType || r.truckType || '-',
        r.transporterName || r.transporter?.name || r.carrierName || r.carrier?.name || r.vendorName || r.vendor?.name || r.carrier?.companyName || r.transporter || '-',
        r.source || r.fromCity || r.from || '-',
        r.destination || r.toCity || r.to || '-',
        r.consignorName || r.consignor?.name || r.consignor || '-',
        r.consigneeName || r.consignee?.name || r.consignee || '-',
        r.shipToPartyName || r.shipToParty?.name || r.shipToParty || '-',
        r.itemDescription || r.materialDescription || r.materialGroup || r.itemName || r.material || r.description || r.commodity || '-',
        r.status || '-',
        r.assignWeight || r.weight || r.quantity || '-',
        formatTime(r.createdAt || r.indentDate || r.indentTime),
        formatTime(r.assignedAt || r.vehicleAssignTime || r.assignTime || r.placementTime || r.placementDate || r.assignDate),
        formatTime(r.dispatchedAt || r.dispatchTime || r.cnDate || r.invoiceDate),
        r.podStatus || '-',
        formatTime(r.podAt || r.podDate || r.deliveredAt || r.deliveryDate)
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
                  <th className="p-3 border-r border-slate-200">CN No</th>
                  <th className="p-3 border-r border-slate-200">Vehicle</th>
                  <th className="p-3 border-r border-slate-200">Vehicle Type</th>
                  <th className="p-3 border-r border-slate-200">Transporter</th>
                  <th className="p-3 border-r border-slate-200">Source</th>
                  <th className="p-3 border-r border-slate-200">Destination</th>
                  <th className="p-3 border-r border-slate-200">Consignor</th>
                  <th className="p-3 border-r border-slate-200">Consignee</th>
                  <th className="p-3 border-r border-slate-200">Ship To Party</th>
                  <th className="p-3 border-r border-slate-200">Item Description</th>
                  <th className="p-3 border-r border-slate-200">Status</th>
                  <th className="p-3 border-r border-slate-200">Qty (MT)</th>
                  <th className="p-3 border-r border-slate-200">Indent Time</th>
                  <th className="p-3 border-r border-slate-200">Assign Time</th>
                  <th className="p-3 border-r border-slate-200">Dispatch Time</th>
                  <th className="p-3 border-r border-slate-200">POD Status</th>
                  <th className="p-3">POD Time</th>
                </tr>
             </thead>
             <tbody>{results.map((r, i) => (
               <tr key={i} className="hover:bg-blue-50/30 border-b border-slate-100 whitespace-nowrap">
                 <td className="p-3 border-r border-slate-100 uppercase">{r.plantCode || '-'}</td>
                 <td className="p-3 border-r border-slate-100 font-black text-blue-700 uppercase">{r.tripNo || r.tripId || r.id || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase">{r.cnNumber || r.cnNo || r.lrNo || r.lrNumber || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase">{r.vehicleNo || r.vehicleNumber || r.truckNo || r.truckNumber || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase">{r.vehicleType || r.truckType || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.transporterName || r.transporter?.name || r.carrierName || r.carrier?.name || r.vendorName || r.vendor?.name || r.carrier?.companyName || r.transporter || ''}>{r.transporterName || r.transporter?.name || r.carrierName || r.carrier?.name || r.vendorName || r.vendor?.name || r.carrier?.companyName || r.transporter || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.source || r.fromCity || r.from || ''}>{r.source || r.fromCity || r.from || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.destination || r.toCity || r.to || ''}>{r.destination || r.toCity || r.to || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.consignorName || r.consignor?.name || r.consignor || ''}>{r.consignorName || r.consignor?.name || r.consignor || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.consigneeName || r.consignee?.name || r.consignee || ''}>{r.consigneeName || r.consignee?.name || r.consignee || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.shipToPartyName || r.shipToParty?.name || r.shipToParty || ''}>{r.shipToPartyName || r.shipToParty?.name || r.shipToParty || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase truncate max-w-[150px]" title={r.itemDescription || r.materialDescription || r.materialGroup || r.itemName || r.material || r.description || r.commodity || ''}>{r.itemDescription || r.materialDescription || r.materialGroup || r.itemName || r.material || r.description || r.commodity || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase font-black">{r.status || '-'}</td>
                 <td className="p-3 border-r border-slate-100 uppercase">{r.assignWeight || r.weight || r.quantity || '-'}</td>
                 <td className="p-3 border-r border-slate-100">{formatTime(r.createdAt || r.indentDate || r.indentTime)}</td>
                 <td className="p-3 border-r border-slate-100">{formatTime(r.assignedAt || r.vehicleAssignTime || r.assignTime || r.placementTime || r.placementDate || r.assignDate)}</td>
                 <td className="p-3 border-r border-slate-100">{formatTime(r.dispatchedAt || r.dispatchTime || r.cnDate || r.invoiceDate)}</td>
                 <td className="p-3 border-r border-slate-100 uppercase font-black">{r.podStatus || '-'}</td>
                 <td className="p-3">{formatTime(r.podAt || r.podDate || r.deliveredAt || r.deliveryDate)}</td>
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
             <h2 className="text-xl font-black uppercase italic text-[#1e3a8a]">SE38: Transactional Analytics</h2>
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
