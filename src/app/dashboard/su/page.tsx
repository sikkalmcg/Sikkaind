'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
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
  const [errors, setErrors] = React.useState<string[]>([]);

  const usersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'users_master'), [db]);
  const { data: users } = useCollection(usersQuery);

  const handleSave = () => {
    if (isReadOnly) return;
    
    const mandatory = ['username', 'employeeName', 'role', 'activeStatus'];
    const missing = mandatory.filter(key => !formData[key]);
    if (missing.length > 0) {
      setErrors(missing);
      alert('Registry Error: Mandatory columns cannot be blank.');
      return;
    }

    if (activeTCode === 'SU01' && users?.some(u => u.username === formData.username)) {
      alert(`System Error: Username ${formData.username} already exists in registry.`);
      return;
    }

    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'users_master', docId), { 
      ...formData, 
      id: docId, 
      updatedAt: serverTimestamp(),
      createdAt: formData.createdAt || serverTimestamp(),
      updatedBy: 'Sikkaind_System'
    }, { merge: true });
    setFormData({});
    setErrors([]);
    alert('User Registry Synchronized');
  };

  const handleDelete = (id: string) => {
    if (confirm('SATELLITE WARNING: Permanently delete this user profile?')) {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'users_master', id));
    }
  };

  const paginated = (users || [])
    .filter(u => !searchId || u.username?.includes(searchId) || u.employeeName?.toUpperCase().includes(searchId.toUpperCase()))
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil((users || []).length / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">SU01/02/03 - User Management</h2>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isReadOnly} className="h-8 bg-[#0056d2] text-white text-[10px] font-black uppercase px-6 rounded-none shadow-sm transition-all active:scale-95"><Save className="h-3.5 w-3.5 mr-2" /> Save (F8)</Button>
          <Button onClick={() => { if(formData.id) setFormData({}); else router.back(); }} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none border-slate-300">Exit (F3)</Button>
        </div>
      </div>

      <div className="px-2">
        {!formData.id && activeTCode !== 'SU01' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search User:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:bg-yellow-50" value={searchId} onChange={e => { setSearchId(e.target.value); setCurrentPage(1); }} placeholder="ENTER USERNAME OR NAME..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-black uppercase text-slate-500">
                    <tr><th className="p-4 border-r">Username</th><th className="p-4 border-r">Employee Name</th><th className="p-4 border-r">Role</th><th className="p-4 border-r text-center">Status</th><th className="p-4">Action</th></tr>
                  </thead>
                  <tbody className="font-bold uppercase">
                    {paginated.map(u => (
                      <tr key={u.id} onClick={() => setFormData(u)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer">
                        <td className="p-4 border-r text-[#0056d2] font-black">{u.username}</td>
                        <td className="p-4 border-r">{u.employeeName}</td>
                        <td className="p-4 border-r">{u.role}</td>
                        <td className="p-4 border-r text-center">
                           <span className={cn("px-3 py-0.5 text-[8px] font-black rounded-none", u.activeStatus === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{u.activeStatus}</span>
                        </td>
                        <td className="p-4">
                           {activeTCode === 'SU02' && <button onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }} className="p-1 hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        ) : (
          <div className="animate-slide-up space-y-12 bg-white p-12 border border-slate-300 shadow-inner">
             <div className="grid grid-cols-2 gap-y-6 gap-x-12">
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Username:</label>
                 <input value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('username') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Password Registry:</label>
                 <input type="password" value={formData.passwordEncrypted || ''} onChange={e => setFormData({...formData, passwordEncrypted: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Employee Name:</label>
                 <input value={formData.employeeName || ''} onChange={e => setFormData({...formData, employeeName: e.target.value.toUpperCase()})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('employeeName') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Role:</label>
                 <select value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border bg-white px-2 text-[12px] font-black outline-none", errors.includes('role') ? "border-red-500 bg-red-50" : "border-slate-400")}>
                    <option value="">Select Role...</option>
                    <option value="Admin">System Admin</option>
                    <option value="Manager">Logistics Manager</option>
                    <option value="User">Standard Operator</option>
                 </select>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Status:</label>
                 <select value={formData.activeStatus || ''} onChange={e => setFormData({...formData, activeStatus: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border bg-white px-2 text-[12px] font-black outline-none", errors.includes('activeStatus') ? "border-red-500 bg-red-50" : "border-slate-400")}>
                    <option value="">Select Status...</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                 </select>
               </div>
               <div className="flex items-center gap-8">
                  <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Post Registry:</label>
                  <div className="w-80 flex items-center gap-2">
                     <span className="text-[10px] font-bold text-slate-400 italic">User Profile Node Sync</span>
                  </div>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
