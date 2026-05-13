'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, Undo2, XCircle, Search, Trash2, Edit3, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const SHARED_HUB_ID = 'Sikkaind';

// --- Shared Internal Components ---
function SectionGrouping({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="mb-10 w-full animate-fade-in">
      <div className="flex items-center gap-6 mb-6">
        <span className="text-[13px] font-black text-slate-800 min-w-[120px] uppercase tracking-widest">{title}</span>
        <div className="h-px bg-slate-300 flex-1" />
      </div>
      <div className="space-y-4 pl-12">{children}</div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text", disabled, placeholder, labelWidth = "w-[180px]" }: any) {
  return (
    <div className="flex items-center gap-8 group">
      <label className={cn("text-[12px] font-bold text-slate-600 text-right shrink-0 uppercase tracking-tight", labelWidth)}>{label}:</label>
      <input 
        type={type} value={value || ''} onChange={(e: any) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} 
        className="h-8 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm disabled:opacity-60" 
      />
    </div>
  );
}

function FormSelect({ label, value, options, onChange, disabled, placeholder }: any) {
  return (
    <div className="flex items-center gap-8 group">
      <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">{label}:</label>
      <select 
        value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} 
        className="h-8 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm"
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((o: any, idx: number) => <option key={idx} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}
      </select>
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
          className="h-8 w-full border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase" 
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

const formatWeight = (val: any) => {
  const num = parseFloat(val);
  return isNaN(num) ? "0.000" : num.toFixed(3);
};

export default function VAPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const activeTCode = searchParams.get('tcode') || 'VA03';
  const isReadOnly = activeTCode === 'VA03';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [statusMsg, setStatusMsg] = React.useState({ text: 'Ready', type: 'info' });

  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);

  const { data: plants } = useCollection(plantsQuery);
  const { data: orders } = useCollection(ordersQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: trips } = useCollection(tripsQuery);

  React.useEffect(() => {
    if (activeTCode === 'VA01' && !formData.id) {
      setFormData({ saleOrderDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), status: 'Active', weightUom: 'MT' });
    }
  }, [activeTCode]);

  const handleSave = async () => {
    if (activeTCode === 'VA04') {
      const o = orders?.find(ord => ord.saleOrder === formData.saleOrder);
      if (o) {
        setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', o.id), { status: 'Short closed' }, { merge: true });
        setStatusMsg({ text: 'Order Short Closed', type: 'success' });
        setFormData({});
      }
      return;
    }
    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), { ...formData, id: docId, updatedAt: new Date().toISOString(), createdAt: formData.createdAt || new Date().toISOString() }, { merge: true });
    setStatusMsg({ text: 'Order Registry Synchronized', type: 'success' });
    setFormData({});
  };

  const pOpts = (plants || []).map(p => p.plantCode);
  const custOpts = (customers || []).map(c => `${c.customerName} - ${c.city}`);

  if (activeTCode === 'VA04') {
    return (
      <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
        <div className="bg-white p-10 border border-slate-300 shadow-sm animate-fade-in">
          <SectionGrouping title="SHORT CLOSE ORDER">
            <div className="flex items-center gap-8">
              <label className="text-[12px] font-black text-red-600 w-[180px] text-right uppercase">Sale Order No:</label>
              <input value={formData.saleOrder || ''} onChange={e => setFormData({ ...formData, saleOrder: e.target.value.toUpperCase() })} className="h-9 w-[320px] border border-red-200 bg-red-50/10 px-3 text-[12px] font-black outline-none" placeholder="ENTER ORDER NO..." />
            </div>
            <div className="pl-[212px] pt-10 flex gap-4">
              <Button onClick={() => setFormData({})} variant="outline" className="h-10 px-10 rounded-none text-[10px] font-black uppercase">Exit</Button>
              <Button onClick={handleSave} className="h-10 px-12 bg-red-600 text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post Close</Button>
            </div>
          </SectionGrouping>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">VA01/02/03 - Sale Order Registry</h2>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isReadOnly} className="h-8 bg-[#0056d2] text-white text-[10px] font-black uppercase px-6 rounded-none shadow-sm"><Save className="h-3.5 w-3.5 mr-2" /> Save Registry (F8)</Button>
          <Button onClick={() => router.back()} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none border-slate-300">Exit (F3)</Button>
        </div>
      </div>

      <div className="px-2 pb-20">
        {!formData.id && activeTCode !== 'VA01' ? (
          <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in mb-10">
            <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search Order:</label>
            <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:ring-1 focus:ring-blue-500" value={searchId} onChange={e => setSearchId(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const o = orders?.find(ord => ord.saleOrder === searchId.toUpperCase()); if (o) setFormData(o); } }} placeholder="ENTER SALE ORDER NO AND PRESS ENTER..." />
          </div>
        ) : (
          <div className="animate-slide-up space-y-12">
            <SectionGrouping title="HEADER DATA">
              <div className="grid grid-cols-2 gap-y-4">
                <FormSelect label="PLANT CODE" value={formData.plantCode} options={pOpts} onChange={(v: string) => setFormData({...formData, plantCode: v})} disabled={isReadOnly} />
                <FormInput label="SALE ORDER NO" value={formData.saleOrder} onChange={(v: string) => setFormData({...formData, saleOrder: v.toUpperCase()})} disabled={isReadOnly} />
                <FormInput label="BOOK DATE TIME" type="datetime-local" value={formData.saleOrderDate} onChange={(v: string) => setFormData({...formData, saleOrderDate: v})} disabled={isReadOnly} />
                {formData.id && <FormInput label="ORDER STATUS" value={formData.status} disabled={true} />}
              </div>
            </SectionGrouping>
            <SectionGrouping title="LOGISTICAL PARTIES">
              <div className="grid grid-cols-2 gap-y-4">
                <FormSearchInput label="CONSIGNOR" value={formData.consignor} options={custOpts} onChange={(v: string) => { 
                  const name = v.split(' - ')[0]; 
                  const master = customers?.find(c => c.customerName === name);
                  setFormData({...formData, consignor: name, consignorId: master?.customerCode || (name === 'PLANT IMPC' ? 'DIMPC' : ''), from: master?.city || ''}); 
                }} disabled={isReadOnly} />
                <FormInput label="CONSIGNOR ID" value={formData.consignorId} disabled={true} />
                
                <FormSearchInput label="CONSIGNEE" value={formData.consignee} options={custOpts} onChange={(v: string) => {
                   const name = v.split(' - ')[0];
                   const master = customers?.find(c => c.customerName === name);
                   setFormData({...formData, consignee: name, consigneeId: master?.customerCode || ''});
                }} disabled={isReadOnly} />
                <FormInput label="CONSIGNEE ID" value={formData.consigneeId} disabled={true} />

                <FormSearchInput label="SHIP TO PARTY" value={formData.shipToParty} options={custOpts} onChange={(v: string) => {
                   const name = v.split(' - ')[0];
                   const master = customers?.find(c => c.customerName === name);
                   let id = master?.customerCode || '';
                   if (name.includes('TATA CHEMICALS')) {
                     if (v.includes('MITHAPUR')) id = 'DIMPC';
                     else if (v.includes('DASNA')) id = 'DID23';
                     else if (v.includes('GHAZIABAD')) id = 'DID20';
                   }
                   setFormData({...formData, shipToParty: name, shipToPartyId: id, destination: master?.city || ''});
                }} disabled={isReadOnly} />
                <FormInput label="SHIP TO ID" value={formData.shipToPartyId} disabled={true} />
              </div>
            </SectionGrouping>
            <SectionGrouping title="ITEM DATA">
               <div className="grid grid-cols-2 gap-y-4">
                 <FormInput label="WEIGHT / QTY" type="number" value={formData.weight} onChange={(v: string) => setFormData({...formData, weight: v})} onBlur={() => setFormData({...formData, weight: formatWeight(formData.weight)})} disabled={isReadOnly} />
                 <FormSelect label="UOM" value={formData.weightUom} options={['MT', 'LTR', 'BAG']} onChange={(v: string) => setFormData({...formData, weightUom: v})} disabled={isReadOnly} />
               </div>
            </SectionGrouping>
          </div>
        )}
      </div>
    </div>
  );
}
