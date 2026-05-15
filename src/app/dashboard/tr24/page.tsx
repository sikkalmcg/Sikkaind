
'use client';

import * as React from 'react';
import { Radar, ShoppingCart, Package, Truck, MapPin, CheckCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';

export default function TR24Page() {
  const db = useFirestore();
  const [view, setView] = React.useState<'search' | 'details'>('search');
  const [q, setQ] = React.useState('');
  const [order, setOrder] = React.useState<any>(null);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const { data: orders } = useCollection(ordersQuery);

  const handleTrack = () => {
    const o = orders?.find(ord => (ord.orderNo === q.toUpperCase() || ord.saleOrder === q.toUpperCase()));
    if (o) { setOrder(o); setView('details'); }
    else alert("Order Node Not Found");
  };

  if (view === 'details') {
    return (
      <div className="flex-1 flex flex-col p-10 font-mono bg-[#f2f2f2]">
        <div className="bg-white border border-slate-300 p-10 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-black uppercase italic text-[#1e3a8a]">Shipment Trace: {order.orderNo || order.saleOrder}</h2>
            <Button onClick={() => setView('search')} variant="outline" className="h-8 rounded-none uppercase text-[9px] font-black">Back</Button>
          </div>
          <div className="grid grid-cols-2 gap-8 text-[11px] font-bold uppercase">
             <div className="flex justify-between border-b pb-2"><span className="text-slate-400">Ship To Party:</span><span>{order.shipToParty}</span></div>
             <div className="flex justify-between border-b pb-2"><span className="text-slate-400">Destination:</span><span>{order.destination}</span></div>
             <div className="flex justify-between border-b pb-2"><span className="text-slate-400">Order Qty:</span><span>{order.weight || order.quantity} {order.weightUom || order.uom}</span></div>
             <div className="flex justify-between border-b pb-2"><span className="text-slate-400">Status:</span><span className="text-blue-600">{order.status}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-10 font-mono bg-[#f2f2f2] animate-fade-in">
       <div className="max-w-4xl mx-auto w-full mt-20">
         <div className="bg-white border border-slate-300 p-12 space-y-10 shadow-sm">
            <div className="flex items-center gap-8">
              <label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase">Sale Order:</label>
              <input value={q} onChange={e => setQ(e.target.value)} className="h-9 w-[320px] border border-slate-400 bg-white px-3 text-[12px] font-black outline-none uppercase" placeholder="ENTER ORDER NO..." />
            </div>
            <div className="pl-[212px] flex gap-4">
              <Button onClick={() => setQ('')} className="h-9 px-8 bg-red-600 text-white rounded-none text-[10px] font-black uppercase">Clear</Button>
              <Button onClick={handleTrack} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Track Node</Button>
            </div>
         </div>
       </div>
    </div>
  );
}
