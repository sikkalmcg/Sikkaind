'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format } from 'date-fns';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

export default function XKPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const activeTCode = searchParams.get('tcode') || 'XK03';
  const isReadOnly = activeTCode === 'XK03';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);

  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const { data: vendors } = useCollection(vendorsQuery);

  const handleSave = React.useCallback(() => {
    if (isReadOnly) return;
    if (!formData.id) {
       const char = formData.vendorName?.[0]?.toUpperCase() || 'V';
       formData.vendorCode = `${char}${Math.floor(10000 + Math.random() * 90000)}`;
    }
    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'vendors', docId), { ...formData, id: docId, updatedAt: new Date().toISOString() }, { merge: true });
    setFormData({});
    alert('Synchronized');
  }, [db, formData, isReadOnly]);

  React.useEffect(() => {
    const handleGlobalSave = () => handleSave();
    window.addEventListener('sap-save-triggered', handleGlobalSave);
    return () => window.removeEventListener('sap-save-triggered', handleGlobalSave);
  }, [handleSave]);

  const filteredVendors = (vendors || []).filter(v => {
    if (!searchId) return true;
    const term = searchId.toUpperCase();
    return v.vendorCode?.includes(term) || v.vendorName?.toUpperCase().includes(term);
  });

  const paginated = filteredVendors.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(filteredVendors.length / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">XK01/02/03 - Vendor Master</h2>
      </div>

      <div className="px-2">
        {!formData.id && activeTCode !== 'XK01' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:bg-yellow-50" value={searchId} onChange={e => { setSearchId(e.target.value); setCurrentPage(1); }} placeholder="ENTER VENDOR CODE OR NAME..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-black uppercase text-slate-500">
                    <tr><th className="p-4 border-r">Code</th><th className="p-4 border-r">Name</th><th className="p-4 border-r">Firm</th><th className="p-4 border-r">Route</th><th className="p-4">Updated</th></tr>
                  </thead>
                  <tbody className="font-bold uppercase">
                    {paginated.map(v => (
                      <tr key={v.id} onClick={() => setFormData(v)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer">
                        <td className="p-4 border-r text-[#0056d2] font-black">{v.vendorCode}</td>
                        <td className="p-4 border-r">{v.vendorName}</td>
                        <td className="p-4 border-r">{v.vendorFirmName || '-'}</td>
                        <td className="p-4 border-r text-slate-400 italic">{v.route || '-'}</td>
                        <td className="p-4 text-slate-300">{v.updatedAt ? format(new Date(v.updatedAt), 'dd/MM HH:mm') : '-'}</td>
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
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Vendor Name:</label><input value={formData.vendorName || ''} onChange={e => setFormData({...formData, vendorName: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" /></div>
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Firm Name:</label><input value={formData.vendorFirmName || ''} onChange={e => setFormData({...formData, vendorFirmName: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" /></div>
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Mobile:</label><input value={formData.mobile || ''} onChange={e => setFormData({...formData, mobile: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" /></div>
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Route:</label><input value={formData.route || ''} onChange={e => setFormData({...formData, route: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" placeholder="E.G. GHAZIABAD - DELHI" /></div>
               <div className="flex items-center gap-8 col-span-2"><label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Address:</label><input value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-[calc(80px*10+12px)] border border-slate-400 px-2 text-[12px] font-black outline-none" /></div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}