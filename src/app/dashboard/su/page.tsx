'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format } from 'date-fns';

const PAGE_SIZE = 15;

export default function SUPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const activeTCode = searchParams.get('tcode') || 'SU03';
  const isReadOnly = activeTCode === 'SU03';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);

  const usersQuery = useMemoFirebase(() => collection(db, 'user_registry'), [db]);
  const { data: users } = useCollection(usersQuery);

  const handleSave = () => {
    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'user_registry', docId), { ...formData, id: docId, updatedAt: new Date().toISOString() }, { merge: true });
    setFormData({});
  };

  const paginated = (users || []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil((users || []).length / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">SU01/02/03 - User Management Hub</h2>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isReadOnly} className="h-8 bg-[#0056d2] text-white text-[10px] font-black uppercase px-6 rounded-none shadow-sm"><Save className="h-3.5 w-3.5 mr-2" /> Save (F8)</Button>
          <Button onClick={() => router.back()} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none border-slate-300">Exit (F3)</Button>
        </div>
      </div>

      <div className="px-2">
        {!formData.id && activeTCode !== 'SU01' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search User:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:ring-1 focus:ring-blue-500" value={searchId} onChange={e => setSearchId(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const u = users?.find(u => u.username === searchId); if (u) setFormData(u); } }} placeholder="ENTER USERNAME AND PRESS ENTER..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-300 text-[10px] font-black uppercase">
                  <tr><th className="p-4 border-r">Username</th><th className="p-4 border-r">Full Name</th><th className="p-4">Updated</th></tr>
                </thead>
                <tbody>
                  {paginated.map(u => (
                    <tr key={u.id} onClick={() => setFormData(u)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer text-[11px] font-bold uppercase">
                      <td className="p-4 border-r text-[#0056d2] font-black">{u.username}</td>
                      <td className="p-4 border-r">{u.fullName}</td>
                      <td className="p-4 text-slate-400">{format(new Date(u.updatedAt || new Date()), 'dd-MM-yy HH:mm')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                 <div className="flex gap-2">
                   <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} className="h-7 w-7 rounded-none p-0"><ChevronLeft className="h-3 w-3" /></Button>
                   <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} className="h-7 w-7 rounded-none p-0"><ChevronRight className="h-3 w-3" /></Button>
                 </div>
                 <span className="text-[9px] font-black uppercase text-slate-400">Page {currentPage} of {totalPages || 1}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-slide-up space-y-12 bg-white p-12 border border-slate-300 shadow-inner">
             <div className="flex items-center gap-8">
               <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Username:</label>
               <input value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
             </div>
             <div className="flex items-center gap-8">
               <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Full Name:</label>
               <input value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
