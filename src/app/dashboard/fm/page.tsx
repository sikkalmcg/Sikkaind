
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight, Upload, X, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollection, useMemoMongo, setDocumentNonBlocking } from '@/mongodb';
import { collection, doc, serverTimestamp } from '@/lib/mongo-store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

export default function FMPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useMongoStore();
  const activeTCode = searchParams.get('tcode') || 'FM03';
  const isReadOnly = activeTCode === 'FM03';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [errors, setErrors] = React.useState<string[]>([]);

  const companiesQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const { data: companies } = useCollection(companiesQuery);
  const { data: plants } = useCollection(plantsQuery);

  const handleSave = React.useCallback(() => {
    if (isReadOnly) return;
    
    const mandatory = ['companyCode', 'companyName', 'address', 'city', 'gstNo', 'panNo', 'mobile', 'email'];
    const missing = mandatory.filter(key => !formData[key]);
    if (missing.length > 0) {
      setErrors(missing);
      alert('Error: Mandatory columns cannot be blank.');
      return;
    }

    if (activeTCode === 'FM01' && companies?.some(c => c.companyCode === formData.companyCode)) {
      alert(`System Error: Duplicate Company Code ${formData.companyCode} found.`);
      return;
    }

    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'companies', docId), { 
      ...formData, 
      id: docId, 
      updatedAt: serverTimestamp(),
      createdAt: formData.createdAt || serverTimestamp(),
      updatedBy: 'Sikkaind_System'
    }, { merge: true });
    setFormData({});
    setErrors([]);
    alert('Synchronized');
  }, [activeTCode, companies, db, formData, isReadOnly]);

  React.useEffect(() => {
    const handleGlobalSave = () => handleSave();
    window.addEventListener('sap-save-triggered', handleGlobalSave);
    return () => window.removeEventListener('sap-save-triggered', handleGlobalSave);
  }, [handleSave]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const paginated = (companies || []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil((companies || []).length / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">FM01/02/03 - Company Master</h2>
      </div>

      <div className="px-2">
        {!formData.id && activeTCode !== 'FM01' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search Company:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:bg-yellow-50" value={searchId} onChange={e => setSearchId(e.target.value)} placeholder="ENTER CODE..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-black uppercase">
                    <tr><th className="p-4 border-r">Code</th><th className="p-4 border-r">Name</th><th className="p-4 border-r">City</th><th className="p-4">Updated</th></tr>
                  </thead>
                  <tbody className="font-bold uppercase">
                    {paginated.map(c => (
                      <tr key={c.id} onClick={() => setFormData(c)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer">
                        <td className="p-4 border-r text-[#0056d2] font-black">{c.companyCode}</td>
                        <td className="p-4 border-r">{c.companyName}</td>
                        <td className="p-4 border-r">{c.city}</td>
                        <td className="p-4 text-slate-300">{c.updatedAt?.seconds ? format(new Date(c.updatedAt.seconds * 1000), 'dd-MM HH:mm') : '-'}</td>
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
          <div className="animate-slide-up space-y-8 bg-white p-12 border border-slate-300 shadow-inner">
             <div className="grid grid-cols-2 gap-y-6 gap-x-12">
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Company Code:</label>
                 <input 
                   value={formData.companyCode || ''} 
                   onChange={e => setFormData({...formData, companyCode: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('companyCode') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Company Name:</label>
                 <input 
                   value={formData.companyName || ''} 
                   onChange={e => setFormData({...formData, companyName: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('companyName') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Address:</label>
                 <input 
                   value={formData.address || ''} 
                   onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('address') ? "border-red-500 bg-red-50" : "border-slate-400")} 
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
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">GSTIN:</label>
                 <input 
                   value={formData.gstNo || ''} 
                   onChange={e => setFormData({...formData, gstNo: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('gstNo') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">PAN:</label>
                 <input 
                   value={formData.panNo || ''} 
                   onChange={e => setFormData({...formData, panNo: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('panNo') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Mobile:</label>
                 <input 
                   value={formData.mobile || ''} 
                   onChange={e => setFormData({...formData, mobile: e.target.value})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('mobile') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Email:</label>
                 <input 
                   value={formData.email || ''} 
                   onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('email') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Website:</label>
                 <input 
                   value={formData.website || ''} 
                   onChange={e => setFormData({...formData, website: e.target.value.toLowerCase()})} 
                   disabled={isReadOnly} 
                   className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" 
                   placeholder="WWW.EXAMPLE.COM"
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Associated Plants:</label>
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
                         formData.plantCodes?.includes(p.plantCode) ? "bg-[#0056d2] text-white border-[#0056d2]" : "bg-white text-slate-400 border-slate-300"
                       )}
                     >
                       {p.plantCode}
                     </button>
                   ))}
                 </div>
               </div>
               <div className="flex items-start gap-8 col-span-2">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase pt-2">Terms & Conditions:</label>
                 <textarea
                   value={formData.termsAndConditions || ''}
                   onChange={e => setFormData({...formData, termsAndConditions: e.target.value.toUpperCase()})}
                   disabled={isReadOnly}
                   className="h-24 w-full max-w-[700px] border border-slate-400 px-2 py-1 text-[12px] font-bold outline-none uppercase"
                   placeholder="ENTER STANDARD TERMS FOR THE CARRIER..."
                 />
               </div>
               <div className="flex items-start gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase pt-2">Company Logo:</label>
                 <div className="space-y-4">
                    <input 
                      type="file" 
                      id="logo-upload" 
                      className="hidden" 
                      accept="image/*" 
                      disabled={isReadOnly}
                      onChange={handleLogoUpload} 
                    />
                    <div 
                      onClick={() => !isReadOnly && document.getElementById('logo-upload')?.click()}
                      className={cn(
                        "h-32 w-32 border-2 border-dashed flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 transition-all overflow-hidden relative",
                        errors.includes('logoUrl') ? "border-red-500 bg-red-50" : "border-slate-300"
                      )}
                    >
                      {formData.logoUrl ? (
                        <>
                          <img src={formData.logoUrl} alt="Logo Preview" className="h-full w-full object-contain" />
                          {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); setFormData({...formData, logoUrl: null}); }} className="absolute top-1 right-1 bg-red-500 text-white p-0.5"><X className="h-3 w-3" /></button>}
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400">
                          <Upload className="h-6 w-6 mb-2" />
                          <span className="text-[8px] font-black uppercase">Upload Logo</span>
                        </div>
                      )}
                    </div>
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

