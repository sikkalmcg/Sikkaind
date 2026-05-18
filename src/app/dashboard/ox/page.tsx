'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

export default function OXPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const activeTCode = searchParams.get('tcode') || 'OX03';
  const isReadOnly = activeTCode === 'OX03';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [errors, setErrors] = React.useState<string[]>([]);

  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const handleSave = React.useCallback(() => {
    if (isReadOnly) return;
    
    const mandatory = ['plantCode', 'plantName', 'city', 'status'];
    const missing = mandatory.filter(key => !formData[key]);
    if (missing.length > 0) {
      setErrors(missing);
      alert('Error: Mandatory columns cannot be blank.');
      return;
    }

    if (activeTCode === 'OX01' && plants?.some(p => p.plantCode === formData.plantCode)) {
      alert(`System Error: Duplicate Plant Code ${formData.plantCode} found.`);
      return;
    }

    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'plants', docId), { 
      ...formData, 
      id: docId, 
      updatedAt: serverTimestamp(),
      createdAt: formData.createdAt || serverTimestamp(),
      updatedBy: 'Sikkaind_System'
    }, { merge: true });
    setFormData({});
    setErrors([]);
    alert('Synchronized');
  }, [activeTCode, db, formData, isReadOnly, plants]);

  React.useEffect(() => {
    const handleGlobalSave = () => handleSave();
    window.addEventListener('sap-save-triggered', handleGlobalSave);
    return () => window.removeEventListener('sap-save-triggered', handleGlobalSave);
  }, [handleSave]);

  const handleDelete = (id: string) => {
    if (confirm('SATELLITE WARNING: Permanently delete this plant?')) {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'plants', id));
    }
  };

  const paginated = (plants || [])
    .filter(p => !searchId || p.plantCode?.includes(searchId.toUpperCase()) || p.plantName?.toUpperCase().includes(searchId.toUpperCase()))
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil((plants || []).length / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">OX01/02/03 - Plant Master</h2>
      </div>

      <div className="px-2">
        {!formData.id && activeTCode !== 'OX01' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search Plant:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:bg-yellow-50 shadow-inner" value={searchId} onChange={e => { setSearchId(e.target.value); setCurrentPage(1); }} placeholder="ENTER CODE OR NAME..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-black uppercase text-slate-500">
                    <tr>
                      <th className="p-4 border-r">Code</th>
                      <th className="p-4 border-r">Name</th>
                      <th className="p-4 border-r">Type</th>
                      <th className="p-4 border-r text-center">Status</th>
                      <th className="p-4 border-r">City</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold uppercase">
                    {paginated.map(p => (
                      <tr key={p.id} onClick={() => setFormData(p)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="p-4 border-r text-[#0056d2] font-black">{p.plantCode}</td>
                        <td className="p-4 border-r">{p.plantName}</td>
                        <td className="p-4 border-r text-slate-400 italic text-[9px]">{p.plantType || '-'}</td>
                        <td className="p-4 border-r text-center">
                           <span className={cn("px-3 py-0.5 text-[8px] font-black rounded-none", p.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{p.status}</span>
                        </td>
                        <td className="p-4 border-r">{p.city}</td>
                        <td className="p-4">
                           {activeTCode === 'OX02' && <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="p-1 hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>}
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
        ) : (
          <div className="animate-slide-up space-y-12 bg-white p-12 border border-slate-300 shadow-inner">
             <div className="grid grid-cols-2 gap-y-6 gap-x-12">
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Plant Code:</label>
                 <input value={formData.plantCode || ''} onChange={e => setFormData({...formData, plantCode: e.target.value.toUpperCase()})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('plantCode') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Plant Name:</label>
                 <input value={formData.plantName || ''} onChange={e => setFormData({...formData, plantName: e.target.value.toUpperCase()})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('plantName') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Status:</label>
                 <select value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border bg-white px-2 text-[12px] font-black outline-none", errors.includes('status') ? "border-red-500 bg-red-50" : "border-slate-400")}>
                    <option value="">Select Status...</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                 </select>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Plant Type:</label>
                 <input value={formData.plantType || ''} onChange={e => setFormData({...formData, plantType: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Address:</label>
                 <input value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">City:</label>
                 <input value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value.toUpperCase()})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('city') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">State:</label>
                 <input value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">GST No:</label>
                 <input value={formData.gstNo || ''} onChange={e => setFormData({...formData, gstNo: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Contact Person:</label>
                 <input value={formData.contactPerson || ''} onChange={e => setFormData({...formData, contactPerson: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Contact Number:</label>
                 <input value={formData.contactNumber || ''} onChange={e => setFormData({...formData, contactNumber: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}