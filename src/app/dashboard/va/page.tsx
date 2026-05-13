
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

function FormInput({ label, value, onChange, type = "text", disabled, placeholder, labelWidth = "w-[180px]" }: any) {
  return (
    <div className="flex items-center gap-8 group">
      <label className={cn("text-[12px] font-bold text-slate-600 text-right shrink-0 uppercase tracking-tight", labelWidth)}>{label}:</label>
      <input 
        type={type} value={value || ''} onChange={(e: any) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} 
        className="h-8 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm disabled:bg-slate-50 disabled:text-slate-500" 
      />
    </div>
  );
}

function FormSearchInput({ label, value, options, onChange, disabled, placeholder }: any) {
  const [inputValue, setInputValue] = React.useState(value || '');
  const [isOpen, setIsOpen] = React.useState(false);
  const filtered = React.useMemo(() => options.filter((o: string) => o?.toUpperCase().includes(inputValue.toUpperCase())).slice(0, 10), [options, inputValue]);
  React.useEffect(() => { setInputValue(value || ''); }, [value]);
  return (
    <div className="flex items-center gap-8 group relative">
      <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">{label}:</label>
      <div className="relative w-[320px]">
        <input 
          value={inputValue} onChange={(e) => { setInputValue(e.target.value); onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)} onBlur={() => setTimeout(() => setIsOpen(false), 200)} disabled={disabled} placeholder={placeholder} 
          className="h-8 w-full border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase disabled:bg-slate-50 disabled:text-slate-500" 
        />
        {isOpen && filtered.length > 0 && (
          <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-xl z-50 mt-1 max-h-40 overflow-y-auto">
            {filtered.map((opt: string, i: number) => <div key={i} onMouseDown={() => { onChange(opt); setIsOpen(false); }} className="px-3 py-2 text-[11px] font-black cursor-pointer hover:bg-blue-50 uppercase">{opt}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

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
        status: 'Active', 
        weightUom: 'MT',
        createdAt: new Date().toISOString()
      });
    }
  }, [activeTCode]);

  const handleSave = () => {
    if (activeTCode === 'VA04') {
      const o = orders?.find(ord => ord.saleOrder === formData.saleOrder);
      if (o) setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', o.id), { status: 'Short closed' }, { merge: true });
      setFormData({});
      return;
    }
    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), { ...formData, id: docId, updatedAt: new Date().toISOString() }, { merge: true });
    setFormData({});
  };

  const getCustomerCode = (name: string, city: string) => {
    const cleanName = name.split(' - ')[0];
    const c = customers?.find(c => c.customerName === cleanName);
    if (!c) return '';
    
    // Tata Chemicals Branch Specific Mapping
    if (cleanName.includes('TATA CHEMICALS')) {
      if (city?.toUpperCase().includes('MITHAPUR')) return 'DIMPC';
      if (city?.toUpperCase().includes('DASNA')) return 'DID23';
      if (city?.toUpperCase().includes('GHAZIABAD')) return 'DID20';
    }
    return c.customerCode || '';
  };

  const isLocked = React.useMemo(() => {
    if (!formData.id || !allTrips) return false;
    const trips = allTrips.filter(t => t.saleOrderId === formData.id);
    return trips.some(t => t.status !== 'LOADING' || t.cnNumber);
  }, [formData.id, allTrips]);

  const paginated = (orders || []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil((orders || []).length / PAGE_SIZE);

  if (activeTCode === 'VA04') {
    return (
      <div className="flex-1 flex flex-col p-10 bg-[#f2f2f2] font-mono">
        <div className="bg-white p-10 border border-slate-300 shadow-sm animate-fade-in max-w-4xl mx-auto w-full">
          <h2 className="text-lg font-black text-red-600 mb-8 border-b pb-4 uppercase italic">VA04 - Short Close Order Registry</h2>
          <div className="space-y-6">
            <FormInput label="SALE ORDER NO" value={formData.saleOrder} onChange={(v: string) => setFormData({...formData, saleOrder: v.toUpperCase()})} />
            <div className="pt-6 flex gap-4">
              <Button onClick={handleSave} className="h-10 px-12 bg-red-600 text-white rounded-none text-[10px] font-black uppercase">Post Short Close</Button>
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
          <Button onClick={handleSave} disabled={isReadOnly || (activeTCode === 'VA02' && isLocked)} className="h-8 bg-[#0056d2] text-white text-[10px] font-black uppercase px-6 rounded-none shadow-sm"><Save className="h-3.5 w-3.5 mr-2" /> Save (F8)</Button>
          <Button onClick={() => router.back()} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none border-slate-300">Exit (F3)</Button>
        </div>
      </div>

      <div className="px-2 pb-20">
        {!formData.id && activeTCode !== 'VA01' ? (
          <div className="space-y-6 max-w-6xl mx-auto w-full">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search Order:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:ring-1 focus:ring-blue-500" value={searchId} onChange={e => setSearchId(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const o = orders?.find(ord => ord.saleOrder === searchId.toUpperCase()); if (o) setFormData(o); } }} placeholder="ENTER SALE ORDER NO AND PRESS ENTER..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-black uppercase text-slate-500">
                    <tr><th className="p-4 border-r">Order No</th><th className="p-4 border-r">Plant</th><th className="p-4 border-r">Consignor</th><th className="p-4 border-r">Ship To</th><th className="p-4">Weight</th></tr>
                  </thead>
                  <tbody className="font-bold uppercase">
                    {paginated.map(o => (
                      <tr key={o.id} onClick={() => setFormData(o)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer">
                        <td className="p-4 border-r text-[#0056d2] font-black">{o.saleOrder}</td>
                        <td className="p-4 border-r">{o.plantCode}</td>
                        <td className="p-4 border-r">{o.consignor}</td>
                        <td className="p-4 border-r">{o.shipToParty}</td>
                        <td className="p-4">{o.weight} {o.weightUom}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
               <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                 <div className="flex gap-2">
                   <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
                   <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
                   <input type="number" min="1" max={totalPages} value={currentPage} onChange={e => setCurrentPage(Number(e.target.value))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black" />
                 </div>
                 <span className="text-[10px] font-black uppercase text-slate-400">Page {currentPage} of {totalPages || 1}</span>
               </div>
            </div>
          </div>
        ) : (
          <div className="animate-slide-up space-y-12 max-w-6xl mx-auto w-full">
            {isLocked && <div className="bg-amber-50 border border-amber-200 p-4 text-[11px] font-black text-amber-700 flex items-center gap-3 uppercase italic"><Lock className="h-4 w-4" /> Logistics Node Active: Master Records Locked. Only Weight Increase & SO No modification permitted.</div>}
            
            <div className="bg-white p-12 border border-slate-300 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
               <FormInput label="PLANT CODE" value={formData.plantCode} disabled={isReadOnly || isLocked} />
               <FormInput label="SALE ORDER NO" value={formData.saleOrder} onChange={(v: string) => setFormData({...formData, saleOrder: v.toUpperCase()})} disabled={isReadOnly} />
               <FormInput label="BOOK DATE TIME" type="datetime-local" value={formData.saleOrderDate} onChange={(v: string) => setFormData({...formData, saleOrderDate: v})} disabled={isReadOnly} />
               <FormInput label="TOTAL WEIGHT" type="number" value={formData.weight} onChange={(v: string) => setFormData({...formData, weight: v})} disabled={isReadOnly} />
               
               <div className="col-span-2 h-px bg-slate-200 my-6" />

               <FormSearchInput label="CONSIGNOR" value={formData.consignor} options={(customers || []).map(c => c.customerName)} onChange={(v: string) => {
                  const id = getCustomerCode(v, formData.from);
                  setFormData({...formData, consignor: v, consignorId: id});
               }} disabled={isReadOnly || isLocked} />
               <FormInput label="CONSIGNOR ID" value={formData.consignorId} disabled={true} />

               <FormSearchInput label="CONSIGNEE" value={formData.consignee} options={(customers || []).map(c => c.customerName)} onChange={(v: string) => {
                  const id = getCustomerCode(v, '');
                  setFormData({...formData, consignee: v, consigneeId: id});
               }} disabled={isReadOnly || isLocked} />
               <FormInput label="CONSIGNEE ID" value={formData.consigneeId} disabled={true} />

               <FormSearchInput label="SHIP TO PARTY" value={formData.shipToParty} options={(customers || []).map(c => c.customerName)} onChange={(v: string) => {
                  const c = customers?.find(cust => cust.customerName === v);
                  const id = getCustomerCode(v, c?.city || '');
                  setFormData({...formData, shipToParty: v, shipToPartyId: id, destination: c?.city || ''});
               }} disabled={isReadOnly || isLocked} />
               <FormInput label="SHIP TO ID" value={formData.shipToPartyId} disabled={true} />
            </div>

            {activeTCode === 'VA03' && allTrips && (
              <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-300">
                  <h3 className="text-[12px] font-black uppercase text-slate-700 italic">Linked Logistics Nodes (Trips)</h3>
                </div>
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100 border-b border-slate-300 font-black uppercase">
                    <tr>
                      <th className="p-3 border-r">Trip ID</th><th className="p-3 border-r">CN No</th><th className="p-3 border-r">Fleet</th><th className="p-3 border-r">Vehicle</th><th className="p-3 border-r">Qty</th><th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold uppercase">
                    {allTrips.filter(t => t.saleOrderId === formData.id).map(t => (
                      <tr key={t.id} className="border-b border-slate-100">
                        <td className="p-3 border-r text-blue-600">{t.tripId}</td>
                        <td className="p-3 border-r">{t.cnNumber || 'PENDING'}</td>
                        <td className="p-3 border-r">{t.vehicleType}</td>
                        <td className="p-3 border-r">{t.vehicleNumber}</td>
                        <td className="p-3 border-r">{t.assignWeight} {formData.weightUom}</td>
                        <td className="p-3"><Badge variant="outline" className="text-[8px] font-black rounded-none">{t.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
