'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

export default function VAPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const activeTCode = searchParams.get('tcode') || 'VA03';
  const isReadOnly = activeTCode === 'VA03' || activeTCode === 'VA04';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [errors, setErrors] = React.useState<string[]>([]);

  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

  const { data: plants } = useCollection(plantsQuery);
  const { data: orders } = useCollection(ordersQuery);
  const { data: customers } = useCollection(customersQuery);

  React.useEffect(() => {
    if (activeTCode === 'VA01' && !formData.id) {
      setFormData({ 
        orderDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), 
        status: 'Open', 
        uom: 'MT',
        createdAt: new Date().toISOString(),
        consignorName: '',
        consigneeName: '',
        shipToParty: '',
        from: '',
        destination: '',
        consignorCode: '',
        consigneeCode: '',
        shipToPartyCode: '',
        plantCode: ''
      });
    }
  }, [activeTCode, formData.id]);

  const filteredCustomers = React.useMemo(() => {
    if (!customers || !formData.plantCode) return [];
    return customers.filter(c => {
      const codes = c.plantCodes;
      if (Array.isArray(codes)) return codes.includes(formData.plantCode);
      return codes === formData.plantCode;
    });
  }, [customers, formData.plantCode]);

  // SPECIFIC FILTER FOR CONSIGNORS
  const filteredConsignors = React.useMemo(() => {
    return filteredCustomers.filter(c => c.customerType === 'Consignor');
  }, [filteredCustomers]);

  const handleLookupPartyId = (name: string, type: 'consignor' | 'consignee' | 'shipTo') => {
    const party = customers?.find(c => c.customerName === name);
    if (!party) return;

    const updates: any = {};
    if (type === 'consignor') {
      updates.consignorCode = party.customerCode;
      updates.from = party.city || '';
    }
    if (type === 'consignee') {
      updates.consigneeCode = party.customerCode;
    }
    if (type === 'shipTo') {
      updates.shipToPartyCode = party.customerCode;
      updates.destination = party.city || '';
    }
    
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    if (activeTCode === 'VA03') return;

    if (activeTCode === 'VA04') {
      const o = orders?.find(ord => ord.orderNo === formData.orderNo);
      if (!o) return alert('Order Registry Node not found');
      setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', o.id), { 
        status: 'Short closed',
        shortCloseReason: formData.shortCloseReason || 'Manual Termination',
        updatedAt: serverTimestamp() 
      }, { merge: true });
      alert('Order Status Updated: Short Closed');
      setFormData({});
      return;
    }

    const mandatory = [
      'plantCode', 'orderNo', 'consignorName', 'consignorCode', 'consigneeName', 
      'consigneeCode', 'shipToParty', 'shipToPartyCode', 'orderDate', 
      'quantity', 'destination', 'from'
    ];
    const missing = mandatory.filter(key => !formData[key]);
    if (missing.length > 0) {
      setErrors(missing);
      alert('Registry Error: Mandatory columns cannot be blank.');
      return;
    }

    if (activeTCode === 'VA01' && orders?.some(o => o.orderNo === formData.orderNo)) {
      return alert(`System Error: Duplicate Order No ${formData.orderNo} found`);
    }

    const docId = formData.id || crypto.randomUUID();
    let status = formData.status || 'Open';
    if (activeTCode === 'VA02' && status === 'Short closed') status = 'Open';

    const savePayload = { 
      ...formData, 
      id: docId, 
      status, 
      updatedAt: serverTimestamp(),
      createdAt: formData.createdAt || serverTimestamp(),
      updatedBy: 'Sikkaind_System'
    };

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), savePayload, { merge: true });
    setFormData({});
    setErrors([]);
    alert('Registry Synchronized');
  };

  const handleDelete = (id: string) => {
    if (confirm('SATELLITE WARNING: Permanently delete this order node?')) {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', id));
    }
  };

  const paginated = (orders || [])
    .filter(o => !searchId || o.orderNo?.includes(searchId.toUpperCase()))
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil((orders || []).length / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">{activeTCode} - SALE ORDER REGISTRY</h2>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isReadOnly && activeTCode !== 'VA04'} className="h-8 bg-[#0056d2] text-white text-[10px] font-black uppercase px-6 rounded-none shadow-sm transition-all active:scale-95">
            <Save className="h-3.5 w-3.5 mr-2" /> {activeTCode === 'VA04' ? 'Execute Short Close' : 'Save (F8)'}
          </Button>
          <Button onClick={() => { if(formData.id) setFormData({}); else router.back(); }} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none border-slate-300">Exit (F3)</Button>
        </div>
      </div>

      <div className="px-2">
        {!formData.id && activeTCode !== 'VA01' && activeTCode !== 'VA04' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search Registry:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:bg-yellow-50 shadow-inner" value={searchId} onChange={e => { setSearchId(e.target.value); setCurrentPage(1); }} placeholder="ENTER SALE ORDER NO..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-black uppercase text-slate-500">
                    <tr>
                      <th className="p-4 border-r">Plant</th>
                      <th className="p-4 border-r">Sale Order</th>
                      <th className="p-4 border-r">Consignor</th>
                      <th className="p-4 border-r">From</th>
                      <th className="p-4 border-r">Consignee</th>
                      <th className="p-4 border-r">Ship to Party</th>
                      <th className="p-4 border-r">Destination</th>
                      <th className="p-4 border-r">Weight</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold uppercase text-[11px]">
                    {paginated.map(o => (
                      <tr key={o.id} onClick={() => setFormData(o)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="p-4 border-r text-slate-500">{o.plantCode}</td>
                        <td className="p-4 border-r text-[#0056d2] font-black">{o.orderNo}</td>
                        <td className="p-4 border-r">{o.consignorName}</td>
                        <td className="p-4 border-r text-slate-400 italic">{o.from}</td>
                        <td className="p-4 border-r">{o.consigneeName}</td>
                        <td className="p-4 border-r">{o.shipToParty}</td>
                        <td className="p-4 border-r text-slate-400 italic">{o.destination}</td>
                        <td className="p-4 border-r font-black">{o.quantity}</td>
                        <td className="p-4">
                           {activeTCode === 'VA02' && <button onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }} className="p-1 hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
               <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                 <div className="flex gap-2 items-center">
                   <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
                   <input type="number" min="1" max={totalPages} value={currentPage} onChange={e => setCurrentPage(Math.max(1, Math.min(totalPages, Number(e.target.value))))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black outline-none" />
                   <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
                 </div>
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Page {currentPage} of {totalPages || 1}</span>
               </div>
            </div>
          </div>
        ) : activeTCode === 'VA04' ? (
          <div className="bg-white p-12 border border-slate-300 shadow-sm max-w-4xl mx-auto w-full">
             <h3 className="text-red-600 font-black uppercase italic mb-8 border-b pb-4">Short Close Workflow</h3>
             <div className="space-y-6">
                <div className="flex items-center gap-8">
                    <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Sale Order No:</label>
                    <input value={formData.orderNo || ''} onChange={e => setFormData({...formData, orderNo: e.target.value.toUpperCase()})} className="h-9 w-80 border border-slate-400 px-3 text-[12px] font-black outline-none" placeholder="ENTER ORDER NO..." />
                </div>
                <div className="flex items-center gap-8">
                    <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Reason:</label>
                    <input value={formData.shortCloseReason || ''} onChange={e => setFormData({...formData, shortCloseReason: e.target.value.toUpperCase()})} className="h-9 w-80 border border-slate-400 px-3 text-[12px] font-black outline-none" placeholder="OPTIONAL..." />
                </div>
             </div>
          </div>
        ) : (
          <div className="animate-slide-up space-y-12 bg-white p-12 border border-slate-300 shadow-inner">
             <div className="grid grid-cols-2 gap-y-6 gap-x-24">
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">PLANT CODE:</label>
                 <select 
                   value={formData.plantCode || ''} 
                   onChange={e => setFormData({...formData, plantCode: e.target.value})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border bg-white px-2 text-[12px] font-black outline-none", errors.includes('plantCode') ? "border-red-500 bg-red-50" : "border-slate-400")}
                 >
                   <option value="">SELECT PLANT...</option>
                   {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
                 </select>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">SALE ORDER NO:</label>
                 <input 
                   value={formData.orderNo || ''} 
                   onChange={e => setFormData({...formData, orderNo: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('orderNo') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">CONSIGNOR NAME:</label>
                 <select 
                   value={formData.consignorName || ''} 
                   onChange={e => { setFormData({...formData, consignorName: e.target.value}); handleLookupPartyId(e.target.value, 'consignor'); }} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border bg-white px-2 text-[11px] font-bold uppercase outline-none", errors.includes('consignorName') ? "border-red-500 bg-red-50" : "border-slate-400")}
                 >
                   <option value="">SELECT MASTER...</option>
                   {filteredConsignors?.map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
                 </select>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">CONSIGNOR CODE:</label>
                 <input value={formData.consignorCode || ''} readOnly className="h-8 w-80 border border-slate-300 bg-slate-50 px-2 text-[12px] font-black outline-none" />
               </div>

               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">CONSIGNEE NAME:</label>
                 <select 
                   value={formData.consigneeName || ''} 
                   onChange={e => { setFormData({...formData, consigneeName: e.target.value}); handleLookupPartyId(e.target.value, 'consignee'); }} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border bg-white px-2 text-[11px] font-bold uppercase outline-none", errors.includes('consigneeName') ? "border-red-500 bg-red-50" : "border-slate-400")}
                 >
                   <option value="">SELECT MASTER...</option>
                   {filteredCustomers?.map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
                 </select>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">SHIP TO PARTY:</label>
                 <select 
                   value={formData.shipToParty || ''} 
                   onChange={e => { setFormData({...formData, shipToParty: e.target.value}); handleLookupPartyId(e.target.value, 'shipTo'); }} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border bg-white px-2 text-[11px] font-bold uppercase outline-none", errors.includes('shipToParty') ? "border-red-500 bg-red-50" : "border-slate-400")}
                 >
                   <option value="">SELECT MASTER...</option>
                   {filteredCustomers?.map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
                 </select>
               </div>

               <div className="flex items-center gap-8">
                  <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">QUANTITY (MT):</label>
                  <input type="number" step="0.001" value={formData.quantity || ''} onChange={e => setFormData({...formData, quantity: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('quantity') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                  <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">ORDER DATE TIME:</label>
                  <input type="datetime-local" value={formData.orderDate || ''} onChange={e => setFormData({...formData, orderDate: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('orderDate') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">MATERIAL NAME:</label>
                 <input value={formData.materialName || ''} onChange={e => setFormData({...formData, materialName: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase italic">DESTINATION:</label>
                 <input value={formData.destination || ''} readOnly className="h-8 w-80 border border-slate-300 bg-slate-50 px-2 text-[12px] font-black outline-none" />
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
