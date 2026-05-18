'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

export default function XDPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const activeTCode = searchParams.get('tcode') || 'XD03';
  const isReadOnly = activeTCode === 'XD03';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [errors, setErrors] = React.useState<string[]>([]);

  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const { data: customers } = useCollection(customersQuery);
  const { data: plants } = useCollection(plantsQuery);

  const handleSave = React.useCallback(() => {
    if (isReadOnly) return;

    const mandatory = ['plantCodes', 'customerCode', 'customerName', 'address', 'city'];
    const missing = mandatory.filter(key => {
      const val = formData[key];
      return Array.isArray(val) ? val.length === 0 : !val;
    });

    if (missing.length > 0) {
      setErrors(missing);
      alert('Error: Mandatory columns cannot be blank.');
      return;
    }

    if (activeTCode === 'XD01') {
      const exists = customers?.find(c => c.customerCode === formData.customerCode);
      if (exists) {
        return alert(`Not Allow duplicate entry Customer ID ${formData.customerCode}/ Sale order N/A is already exit.`);
      }
    }

    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'customers', docId), { 
      ...formData, 
      id: docId, 
      updatedAt: new Date().toISOString() 
    }, { merge: true });
    
    setFormData({});
    setErrors([]);
    alert('Synchronized');
  }, [activeTCode, customers, db, formData, isReadOnly]);

  React.useEffect(() => {
    const handleGlobalSave = () => handleSave();
    window.addEventListener('sap-save-triggered', handleGlobalSave);
    return () => window.removeEventListener('sap-save-triggered', handleGlobalSave);
  }, [handleSave]);

  const filteredCustomers = (customers || []).filter(c => {
    if (!searchId) return true;
    const term = searchId.toUpperCase();
    return c.customerCode?.includes(term) || 
           c.customerName?.toUpperCase().includes(term) ||
           c.city?.toUpperCase().includes(term);
  });

  const paginated = filteredCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">{activeTCode} - Customer Master</h2>
      </div>

      <div className="px-2">
        {!formData.id && activeTCode !== 'XD01' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:bg-yellow-50" value={searchId} onChange={e => { setSearchId(e.target.value); setCurrentPage(1); }} placeholder="ENTER CODE OR NAME..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-black uppercase text-slate-500">
                    <tr>
                      <th className="p-4 border-r">Plant</th>
                      <th className="p-4 border-r">Code</th>
                      <th className="p-4 border-r">Name</th>
                      <th className="p-4 border-r">City</th>
                      <th className="p-4 border-r">GSTIN</th>
                      <th className="p-4">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold uppercase">
                    {paginated.map(c => (
                      <tr key={c.id} onClick={() => setFormData(c)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer">
                        <td className="p-4 border-r text-slate-500 font-bold">{Array.isArray(c.plantCodes) ? c.plantCodes.join(', ') : c.plantCodes || '-'}</td>
                        <td className="p-4 border-r text-[#0056d2] font-black">{c.customerCode}</td>
                        <td className="p-4 border-r">{c.customerName}</td>
                        <td className="p-4 border-r">{c.city}</td>
                        <td className="p-4 border-r text-slate-400">{c.gstNo || c.gstin}</td>
                        <td className="p-4 text-slate-300">{c.updatedAt ? format(new Date(c.updatedAt), 'dd/MM HH:mm') : '-'}</td>
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
        ) : (
          <div className="animate-slide-up space-y-12 bg-white p-12 border border-slate-300 shadow-inner">
             <div className="grid grid-cols-2 gap-y-6 gap-x-12">
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Plant Selection:</label>
                 <div className="w-80 flex flex-wrap gap-2">
                   {plants?.map(p => (
                     <button
                       key={p.id}
                       type="button"
                       disabled={isReadOnly}
                       onClick={() => {
                         const current = formData.plantCodes || [];
                         const next = current.includes(p.plantCode) ? current.filter((c: string) => c !== p.plantCode) : [...current, p.plantCode];
                         setFormData({...formData, plantCodes: next});
                       }}
                       className={cn(
                         "px-3 py-1 text-[10px] font-black uppercase border transition-all",
                         formData.plantCodes?.includes(p.plantCode) ? "bg-[#0056d2] text-white border-[#0056d2]" : "bg-white text-slate-400 border-slate-300",
                         errors.includes('plantCodes') && !formData.plantCodes?.length && "border-red-500 bg-red-50"
                       )}
                     >
                       {p.plantCode}
                     </button>
                   ))}
                 </div>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Customer Code:</label>
                 <input 
                   value={formData.customerCode || ''} 
                   onChange={e => setFormData({...formData, customerCode: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('customerCode') && !formData.customerCode ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Customer Name:</label>
                 <input 
                   value={formData.customerName || ''} 
                   onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('customerName') && !formData.customerName ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Address:</label>
                 <input 
                   value={formData.address || ''} 
                   onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('address') && !formData.address ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">City:</label>
                 <input 
                   value={formData.city || ''} 
                   onChange={e => setFormData({...formData, city: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('city') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Pincode:</label>
                 <input value={formData.pincode || ''} onChange={e => setFormData({...formData, pincode: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">GSTIN:</label>
                 <input value={formData.gstNo || formData.gstin || ''} onChange={e => setFormData({...formData, gstNo: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Mobile:</label>
                 <input value={formData.mobile || ''} onChange={e => setFormData({...formData, mobile: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}