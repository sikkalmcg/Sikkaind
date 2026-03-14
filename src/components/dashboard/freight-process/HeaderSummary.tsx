'use client';

import { ShieldCheck, Factory, Calculator, Landmark } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function HeaderSummary({ trip }: { trip: any }) {
  const freightAmount = trip.freightAmount || (trip.freightRate && trip.quantity ? trip.freightRate * trip.quantity : 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600"/> 
            Mission Trip Context (Read Only)
        </h3>
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            <Factory className="h-3 w-3 text-blue-600" />
            <span className="text-[10px] font-black uppercase text-blue-900 tracking-tight">Plant: {trip.plantName || trip.originPlantId}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-8 p-8 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
        {[
          { label: 'Trip ID Node', value: trip.tripId, mono: true, bold: true, color: 'text-blue-700' },
          { label: 'Mission Date', value: trip.startDate ? format(new Date(trip.startDate), 'dd-MMM-yyyy') : '--' },
          { label: 'LR Number', value: trip.lrNumber, mono: true, bold: true },
          { label: 'LR Date', value: trip.lrDate ? format(new Date(trip.lrDate), 'dd-MMM-yyyy') : '--' },
          { label: 'FROM (Dispatch)', value: trip.from },
          { label: 'To (Destination)', value: trip.unloadingPoint },
          { label: 'Ship To Party', value: trip.shipToParty },
          { label: 'Vehicle Number', value: trip.vehicleNumber, bold: true },
          { label: 'Manifest Weight', value: `${trip.quantity} MT`, bold: true, color: 'text-blue-900' },
          { label: 'Transporter', value: trip.transporterName || '--' },
          { label: 'Freight Rate', value: trip.freightRate ? `₹ ${trip.freightRate}` : '--', color: 'text-emerald-600' },
          { label: 'Total Freight', value: `₹ ${Number(freightAmount).toLocaleString('en-IN')}`, bold: true, color: 'text-blue-900' },
        ].map((item, i) => (
          <div key={i} className="space-y-1">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider leading-none mb-1">{item.label}</p>
            <p className={cn(
                "text-xs truncate leading-tight", 
                item.mono && "font-mono tracking-tighter", 
                item.bold ? "font-black text-slate-900" : "font-bold text-slate-700", 
                item.color
            )}>
                {item.value || '--'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
