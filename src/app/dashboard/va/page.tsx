'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

export default function VAPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const activeTCode = searchParams.get('tcode') || 'VA03';
  const isReadOnly = activeTCode === 'VA03';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);

  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);

  const { data: plants } = useCollection(plantsQuery);
  const { data: orders } = useCollection(ordersQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: allTrips } = useCollection(tripsQuery);

  React.useEffect(() => {
    if (activeTCode === 'VA01' && !formData.id) {
      setFormData({ 
        saleOrderDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), 
        status: 'Open', 
        weightUom: 'MT',
        createdAt: new Date().toISOString()
      });
    }
  }, [activeTCode]);

  const handleSave = () => {
    // VA04 Short Close Logic
    if (activeTCode === 'VA04') {
      const o = orders?.find(ord => ord.saleOrder === formData.saleOrder);
      if (!o) {
        alert('Sale Order not found.');
        return;
      }
      
      const assignedQty = allTrips?.filter(t => t.saleOrderId === o.id).reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0) || 0;
      if (assignedQty >= parseFloat(o.weight)) {
        alert('Fully assigned orders cannot be short closed.');
        return;
      }

      setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', o.id), { 
        status: 'Short closed',
        shortClosedDate: new Date().toISOString()
      }, { merge: true });
      
      setFormData({});
      alert('Order successfully short closed and removed from open registry.');
      return;
    }

    // VA02 Reopen Logic
    let status = formData.status;
    if (activeTCode === 'VA02' && status === 'Short closed') {
      status = 'Open';
    }

    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), { 
      ...formData, 
      id: docId, 
      status,
      updatedAt: new Date().toISOString() 
    }, { merge: true });
    setFormData({});
  };

  const getOrderStatus = (order: any) => {
    if (order.status === 'Short closed') return 'Short Close';
    const trips = allTrips?.filter(t => t.saleOrderId === order.id) || [];
    if (trips.length === 0) return 'Open';
    
    const latestStatus = trips[0].status;
    if (order.status === 'Short closed' && latestStatus === 'ARRIVED') return 'Short Close + Arrived';
    
    const statusMap: any = {
      'LOADING': 'Assigned',
      'IN-TRANSIT': 'In-Transit',
      'ARRIVED': 'Arrived',
      'POD': 'POD',
      'REJECTION': 'Reject',
      'CLOSED': 'Closed'
    };
    return statusMap[latestStatus] || 'Assigned';
  };

  const paginated = (orders || []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil((orders || []).length / PAGE_SIZE);

  if (activeTCode === 'VA04') {
    return (
      <div className="flex-1 flex flex-col p-10 bg-[#f2f2f2] font-mono">
        <div className="bg-white p-10 border border-slate-300 shadow-sm animate-fade-in max-w-4xl mx-auto w-full">
          <h2 className="text-lg font-black text-red-600 mb-8 border-b pb-4 uppercase italic">VA04 - Short Close Order Registry</h2>
          <div className="space-y-6">
            <div className="flex items-center gap-8">
              <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right uppercase">Sale Order No:</label>
              <input value={formData.saleOrder || ''} onChange={e => setFormData({...formData, saleOrder: e.target.value.toUpperCase()})} className="h-9 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none" placeholder="ENTER ORDER NO..." />
            </div>
            <div className="pt-6 flex gap-4 pl-[212px]">
              <Button onClick={handleSave} className="h-10 px-12 bg-red-600 text-white rounded-none text-[10px] font-black uppercase shadow-lg">Short Close</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">VA01/02/03 - Sale Order Registry</h2>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isReadOnly} className="h-8 bg-[#0056d2] text-white text-[10px] font-black uppercase px-6 rounded-none shadow-sm"><Save className="h-3.5 w-3.5 mr-2" /> Save (F8)</Button>
          <Button onClick={() => router.back()} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none border-slate-300">Exit (F3)</Button>
        </div>
      </div>

      <div className="px-2">
        {!formData.id && activeTCode !== 'VA01' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search Order:</label>
              <input 
                className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:ring-1 focus:ring-blue-500" 
                value={searchId} 
                onChange={e => setSearchId(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') { const o = orders?.find(ord => ord.saleOrder === searchId.toUpperCase()); if (o) setFormData(o); } }} 
                placeholder="ENTER SALE ORDER NO AND PRESS ENTER..." 
              />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-black uppercase text-slate-500">
                    <tr><th className="p-4 border-r">Order No</th><th className="p-4 border-r">Status</th><th className="p-4 border-r">Plant</th><th className="p-4 border-r">Consignor</th><th className="p-4">Weight</th></tr>
                  </thead>
                  <tbody className="font-bold uppercase">
                    {paginated.map(o => (
                      <tr key={o.id} onClick={() => setFormData(o)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer">
                        <td className="p-4 border-r text-[#0056d2] font-black">{o.saleOrder}</td>
                        <td className="p-4 border-r"><Badge variant="outline" className="rounded-none text-[8px]">{getOrderStatus(o)}</Badge></td>
                        <td className="p-4 border-r">{o.plantCode}</td>
                        <td className="p-4 border-r">{o.consignor}</td>
                        <td className="p-4">{o.weight} {o.weightUom}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
               <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                 <div className="flex gap-2">
                   <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
                   <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
                 </div>
                 <span className="text-[10px] font-black uppercase text-slate-400">Page {currentPage} of {totalPages || 1}</span>
               </div>
            </div>
          </div>
        ) : (
          <div className="animate-slide-up space-y-12 bg-white p-12 border border-slate-300 shadow-inner">
             <div className="grid grid-cols-2 gap-y-6 gap-x-12">
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Plant Code:</label><input value={formData.plantCode || ''} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black" /></div>
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Sale Order No:</label><input value={formData.saleOrder || ''} onChange={e => setFormData({...formData, saleOrder: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black" /></div>
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Booked Date:</label><input type="datetime-local" value={formData.saleOrderDate || ''} onChange={e => setFormData({...formData, saleOrderDate: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black" /></div>
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Total Weight:</label><input type="number" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black" /></div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
