'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight, Trash2, ShieldCheck, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/mongodb';
import { collection, doc, serverTimestamp } from '@/lib/mongo-store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

const ALL_TCODES = [
  { code: 'OX01', desc: 'Plant Create' }, { code: 'OX02', desc: 'Plant Change' }, { code: 'OX03', desc: 'Plant Display' },
  { code: 'FM01', desc: 'Company Create' }, { code: 'FM02', desc: 'Company Change' }, { code: 'FM03', desc: 'Company Display' },
  { code: 'XK01', desc: 'Vendor Create' }, { code: 'XK02', desc: 'Vendor Change' }, { code: 'XK03', desc: 'Vendor Display' },
  { code: 'XD01', desc: 'Customer Create' }, { code: 'XD02', desc: 'Customer Change' }, { code: 'XD03', desc: 'Customer Display' },
  { code: 'VA01', desc: 'Sales Order Create' }, { code: 'VA02', desc: 'Sales Order Change' }, { code: 'VA03', desc: 'Sales Order Display' }, { code: 'VA04', desc: 'Short Close' },
  { code: 'TR21', desc: 'Trip Board' }, { code: 'TR24', desc: 'Track Shipment' }, { code: 'WGPS24', desc: 'GPS Tracking' },
  { code: 'SE38', desc: 'Reports' }, { code: 'SU01', desc: 'User Create' }, { code: 'SU02', desc: 'User Change' }, { code: 'SU03', desc: 'User Display' },
  { code: 'ZCODE', desc: 'T-Code Map' }
];

export default function SUPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useMongoStore();
  const activeTCode = searchParams.get('tcode') || 'SU03';
  const isReadOnly = activeTCode === 'SU03';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [errors, setErrors] = React.useState<string[]>([]);

  const usersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'users_master'), [db]);
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  
  const { data: users } = useCollectionOptimized(usersQuery);
  const { data: plants } = useCollectionOptimized(plantsQuery);

  const handleSave = React.useCallback(() => {
    if (isReadOnly) return;
    
    const mandatory = ['username', 'employeeName', 'role', 'activeStatus'];
    const missing = mandatory.filter(key => !formData[key]);
    if (missing.length > 0) {
      setErrors(missing);
      alert('Error: Mandatory columns cannot be blank.');
      return;
    }

    if (activeTCode === 'SU01' && users?.some(u => u.username === formData.username)) {
      alert(`System Error: Username ${formData.username} already exists.`);
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
    alert('User Synchronized');
  }, [activeTCode, db, formData, isReadOnly, users]);

  React.useEffect(() => {
    const handleGlobalSave = () => handleSave();
    window.addEventListener('sap-save-triggered', handleGlobalSave);
    return () => window.removeEventListener('sap-save-triggered', handleGlobalSave);
  }, [handleSave]);

  const handleDelete = (id: string) => {
    if (confirm('SATELLITE WARNING: Permanently delete this user profile?')) {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'users_master', id));
    }
  };

  const togglePlant = (code: string) => {
    if (isReadOnly) return;
    const current = formData.plantAccess || [];
    const next = current.includes(code) ? current.filter((c: string) => c !== code) : [...current, code];
    setFormData({ ...formData, plantAccess: next });
  };

  const toggleTCode = (code: string) => {
    if (isReadOnly) return;
    const current = formData.tcodeAccess || [];
    const next = current.includes(code) ? current.filter((c: string) => c !== code) : [...current, code];
    setFormData({ ...formData, tcodeAccess: next });
  };

  const paginated = (users || [])
    .filter(u => !searchId || u.username?.includes(searchId) || u.employeeName?.toUpperCase().includes(searchId.toUpperCase()))
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil((users || []).length / PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-normal uppercase italic">SU01/02/03 - User Management</h2>
      </div>

      <div className="px-2">
        {!formData.id && activeTCode !== 'SU01' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-normal uppercase text-slate-500 w-40 text-right">Search User:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-normal uppercase outline-none focus:bg-yellow-50" value={searchId} onChange={e => { setSearchId(e.target.value); setCurrentPage(1); }} placeholder="ENTER USERNAME OR NAME..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-normal uppercase text-slate-500">
                    <tr>
                      <th className="p-4 border-r">Username</th>
                      <th className="p-4 border-r">Employee Name</th>
                      <th className="p-4 border-r">Role</th>
                      <th className="p-4 border-r text-center">Status</th>
                      <th className="p-4 border-r">Plants</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="font-normal uppercase">
                    {paginated.map(u => (
                      <tr key={u.id} onClick={() => setFormData(u)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="p-4 border-r text-[#0056d2] font-normal">{u.username}</td>
                        <td className="p-4 border-r">{u.employeeName}</td>
                        <td className="p-4 border-r">{u.role}</td>
                        <td className="p-4 border-r text-center">
                           <span className={cn("px-3 py-0.5 text-[8px] font-normal rounded-none", u.activeStatus === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{u.activeStatus}</span>
                        </td>
                        <td className="p-4 border-r text-slate-400 text-[9px]">
                           {Array.isArray(u.plantAccess) ? u.plantAccess.join(', ') : '-'}
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
             <div className="grid grid-cols-2 gap-y-6 gap-x-24 border-b border-slate-100 pb-12">
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-normal text-slate-600 w-48 text-right uppercase">Username:</label>
                 <input value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-normal outline-none", errors.includes('username') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-normal text-slate-600 w-48 text-right uppercase">Password:</label>
                 <input type="password" value={formData.password || formData.passwordEncrypted || ''} onChange={e => setFormData({...formData, password: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-normal outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-normal text-slate-600 w-48 text-right uppercase">Employee Name:</label>
                 <input value={formData.employeeName || ''} onChange={e => setFormData({...formData, employeeName: e.target.value.toUpperCase()})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-normal outline-none", errors.includes('employeeName') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-normal text-slate-600 w-48 text-right uppercase">Role:</label>
                 <select value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border bg-white px-2 text-[12px] font-normal outline-none", errors.includes('role') ? "border-red-500 bg-red-50" : "border-slate-400")}>
                    <option value="">Select Role...</option>
                    <option value="Admin">System Admin</option>
                    <option value="Manager">Logistics Manager</option>
                    <option value="User">Standard Operator</option>
                 </select>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-normal text-slate-600 w-48 text-right uppercase">Status:</label>
                 <select value={formData.activeStatus || ''} onChange={e => setFormData({...formData, activeStatus: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border bg-white px-2 text-[12px] font-normal outline-none", errors.includes('activeStatus') ? "border-red-500 bg-red-50" : "border-slate-400")}>
                    <option value="">Select Status...</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                 </select>
               </div>
             </div>

             <div className="space-y-10">
                <div className="space-y-6">
                   <h3 className="text-[11px] font-normal uppercase text-[#1e3a8a] italic flex items-center gap-2 border-b-2 border-blue-50 w-fit pb-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Authorized Plants Registry
                   </h3>
                   <div className="flex flex-wrap gap-2 pl-4">
                      {plants?.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => togglePlant(p.plantCode)}
                          className={cn(
                            "px-4 py-1.5 text-[10px] font-normal uppercase border transition-all rounded-none",
                            formData.plantAccess?.includes(p.plantCode) 
                              ? "bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-md" 
                              : "bg-white text-slate-400 border-slate-200 hover:border-blue-200"
                          )}
                        >
                          {p.plantCode}
                        </button>
                      ))}
                      {(!plants || plants.length === 0) && <span className="text-[10px] text-slate-300 italic uppercase">No plants registered in system.</span>}
                   </div>
                </div>

                <div className="space-y-6">
                   <h3 className="text-[11px] font-normal uppercase text-[#1e3a8a] italic flex items-center gap-2 border-b-2 border-blue-50 w-fit pb-1">
                      <Layout className="h-3.5 w-3.5" /> Page Authorization Matrix
                   </h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pl-4">
                      {ALL_TCODES.map(t => (
                        <button
                          key={t.code}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => toggleTCode(t.code)}
                          className={cn(
                            "p-3 text-left border transition-all rounded-none flex flex-col gap-1",
                            formData.tcodeAccess?.includes(t.code)
                              ? "bg-[#0056d2] text-white border-[#0056d2] shadow-md"
                              : "bg-white text-slate-400 border-slate-200 hover:border-blue-200"
                          )}
                        >
                          <span className="text-[11px] font-normal uppercase leading-none">{t.code}</span>
                          <span className={cn("text-[8px] uppercase tracking-tighter opacity-70", formData.tcodeAccess?.includes(t.code) ? "text-blue-100" : "text-slate-400")}>{t.desc}</span>
                        </button>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

