'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight, Download, Upload, Loader2, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollection, useMemoMongo, setDocumentNonBlocking, useUser, useDoc } from '@/mongodb';
import { collection, doc, serverTimestamp } from '@/lib/mongo-store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

// CSV parse karne ke liye intelligent function jo commas inside quotes ko handle karega
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes; // Toggle quote state
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, '')); // Clean bounding quotes
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

export default function XDPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useMongoStore();
  const { user } = useUser();
  const activeTCode = searchParams.get('tcode') || 'XD03';
  const isReadOnly = activeTCode === 'XD03';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadLog, setUploadLog] = React.useState<{ status: 'success' | 'failed', msg: string, id: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));
    setMounted(true);
  }, []);

  const profileRef = useMemoMongo(() => {
    if (!registryId || isBootstrapAdmin) return null;
    return doc(db, 'users', SHARED_HUB_ID, 'users_master', registryId);
  }, [db, registryId, isBootstrapAdmin]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(profileRef);

  const authorizedPlantCodes = React.useMemo(() => {
    if (isProfileLoading) return undefined;
    if (isBootstrapAdmin) return null;
    return userProfile?.plantAccess || [];
  }, [isBootstrapAdmin, userProfile, isProfileLoading]);

  const customersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const { data: allCustomers } = useCollection(customersQuery);
  const { data: plants } = useCollection(plantsQuery);

  const handleSave = React.useCallback(() => {
    if (isReadOnly) return;

    const isDuplicate = (allCustomers || []).some(c => c.customerCode === formData.customerCode && c.id !== formData.id);
    if (isDuplicate) {
      alert('Duplicate Customer ID not allowed');
      return;
    }

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

    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'customers', docId), { 
      ...formData, 
      id: docId, 
      updatedAt: new Date().toISOString(),
      updatedBy: 'Sikkaind_System'
    }, { merge: true });
    
    setFormData({});
    setErrors([]);
    alert('Synchronized Successfully');
  }, [allCustomers, db, formData, isReadOnly]);

  React.useEffect(() => {
    const handleGlobalSave = () => handleSave();
    window.addEventListener('sap-save-triggered', handleGlobalSave);
    return () => window.removeEventListener('sap-save-triggered', handleGlobalSave);
  }, [handleSave]);

  const handleDownloadTemplate = () => {
    const headers = ['PLANTS', 'CUSTOMER CODE', 'CUSTOMER NAME', 'ADDRESS', 'CITY', 'PINCODE', 'GSTIN', 'MOBILE'];
    const csv = headers.join(',') + '\n' + '1426,101010101,"AADI TRADERS","A-196 SECTOR- 4B, POCKET- A","MEERUT(NA)",,09FIGPS4019L1ZP,';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `XD01_Customer_Template.csv`;
    a.click();
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadLog([]);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length <= 1) { 
        alert("File empty or missing headers"); 
        setIsUploading(false); 
        return; 
      }

      // Headers parsed using standard comma split since headers don't have commas
      const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
      const rows = lines.slice(1);
      const tempLog: typeof uploadLog = [];
      const fileCodes = new Set<string>();

      const mandatoryCols = ['PLANTS', 'CUSTOMER CODE', 'CUSTOMER NAME', 'ADDRESS', 'CITY'];
      const headerIndices: Record<string, number> = {};
      mandatoryCols.forEach(col => {
        headerIndices[col] = headers.indexOf(col);
      });
      
      headerIndices['PINCODE'] = headers.indexOf('PINCODE');
      headerIndices['GSTIN'] = headers.indexOf('GSTIN');
      headerIndices['MOBILE'] = headers.indexOf('MOBILE');

      const missingCols = mandatoryCols.filter(col => headerIndices[col] === -1);
      if (missingCols.length > 0) {
        alert(`Invalid CSV. Missing required columns: ${missingCols.join(', ')}`);
        setIsUploading(false);
        return;
      }

      for (let i = 0; i < rows.length; i++) {
        // Smart parse logic applied here to protect strings with commas
        const columns = parseCSVLine(rows[i]);
        if (columns.length < mandatoryCols.length) continue;

        const plantStr = columns[headerIndices['PLANTS']]?.toUpperCase();
        const code = columns[headerIndices['CUSTOMER CODE']]?.toUpperCase();
        const name = columns[headerIndices['CUSTOMER NAME']]?.toUpperCase();
        const address = columns[headerIndices['ADDRESS']]?.toUpperCase();
        const city = columns[headerIndices['CITY']]?.toUpperCase();
        const pincode = headerIndices['PINCODE'] !== -1 ? columns[headerIndices['PINCODE']] : '';
        const gstin = headerIndices['GSTIN'] !== -1 ? columns[headerIndices['GSTIN']]?.toUpperCase() : '';
        const mobile = headerIndices['MOBILE'] !== -1 ? columns[headerIndices['MOBILE']] : '';

        const rowId = code || `Row ${i + 2}`;
        let errorReason = '';

        if (!plantStr || !code || !name || !address || !city) {
          errorReason = 'Mandatory column missing';
        } 
        else if (fileCodes.has(code)) {
          errorReason = 'Duplicate Code in File';
        }
        else if (allCustomers?.some(c => c.customerCode === code)) {
          errorReason = 'Duplicate Code in Database';
        }
        else {
          const splitPlants = plantStr.split(';').map(p => p.trim());
          const invalidPlants = authorizedPlantCodes ? splitPlants.filter(p => !authorizedPlantCodes.includes(p)) : [];
          
          if (invalidPlants.length > 0) {
            errorReason = `Authorization failure for plant(s): ${invalidPlants.join(', ')}`;
          } else {
            fileCodes.add(code);
            const docId = crypto.randomUUID();
            const payload = {
              id: docId,
              plantCodes: splitPlants,
              customerCode: code,
              customerName: name,
              address: address,
              city: city,
              pincode: pincode,
              gstNo: gstin, 
              mobile: mobile,
              updatedAt: new Date().toISOString(),
              updatedBy: 'Sikkaind_System'
            };
            setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'customers', docId), payload, { merge: true });
          }
        }
        tempLog.push({ 
          status: errorReason ? 'failed' : 'success', 
          id: rowId, 
          msg: errorReason || 'Successfully Synchronized' 
        });
      }
      setUploadLog(tempLog);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    };
    reader.readAsText(file);
  };

  const filteredCustomers = React.useMemo(() => {
    if (authorizedPlantCodes === undefined) return [];
    const seen = new Set();
    return (allCustomers || [])
      .filter(c => {
        if (authorizedPlantCodes) {
          const hasAccess = Array.isArray(c.plantCodes) && c.plantCodes.some((p: string) => authorizedPlantCodes.includes(p));
          if (!hasAccess) return false;
        }

        if (seen.has(c.customerCode)) return false;
        seen.add(c.customerCode);

        if (!searchId) return true;
        const term = searchId.toUpperCase();
        return c.customerCode?.includes(term) || 
               c.customerName?.toUpperCase().includes(term) ||
               c.city?.toUpperCase().includes(term);
      });
  }, [allCustomers, searchId, authorizedPlantCodes]);

  const paginated = filteredCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE);

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          {formData.id && (
            <Button 
              onClick={() => { setFormData({}); setErrors([]); }} 
              variant="ghost" 
              className="h-8 w-8 p-0 rounded-none border border-slate-300 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-[16px] font-bold uppercase italic">{activeTCode} - Customer Master</h2>
        </div>
        <div className="flex gap-4">
           {activeTCode === 'XD01' && !formData.id && (
             <>
               <Button onClick={handleDownloadTemplate} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 border-slate-300 rounded-none"><Download className="h-3 w-3 mr-2" /> Download Template</Button>
               <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleBulkUpload} />
               <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 border-[#0056d2] text-[#0056d2] rounded-none"><Upload className="h-3 w-3 mr-2" /> Bulk Upload</Button>
             </>
           )}
           {formData.id && !isReadOnly && (
             <Button onClick={handleSave} className="h-8 text-[10px] font-black uppercase px-6 bg-[#0056d2] text-white rounded-none hover:bg-blue-700">
               <Save className="h-3 w-3 mr-2" /> Save Changes
             </Button>
           )}
           {isUploading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
         </div>
      </div>

      <div className="px-2">
        {uploadLog.length > 0 && (
          <div className="mb-10 bg-white border border-slate-300 shadow-md animate-fade-in max-h-60 overflow-y-auto">
             <div className="bg-slate-50 p-2 border-b border-slate-200 flex justify-between sticky top-0 z-10"><span className="text-[10px] font-black uppercase text-blue-800 px-2">Bulk Processing Log</span><button onClick={() => setUploadLog([])} className="p-1 hover:bg-red-50 text-red-500 transition-colors"><X className="h-4 w-4" /></button></div>
             <div className="p-4 space-y-1.5 text-[10px] font-bold uppercase">
                {uploadLog.map((log, i) => (
                  <div key={i} className={cn("flex items-center gap-3", log.status === 'success' ? "text-emerald-600" : "text-red-500")}>
                    <span className="w-4 shrink-0">{log.status === 'success' ? '✔' : '✘'}</span>
                    <span className="w-48 shrink-0">Customer {log.id}</span>
                    <span className="italic">— {log.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {!formData.id && activeTCode !== 'XD01' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search Customer:</label>
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
                      <tr key={c.id} onClick={() => setFormData(c)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="p-4 border-r text-slate-500 font-bold">{Array.isArray(c.plantCodes) ? c.plantCodes.join(', ') : c.plantCodes || '-'}</td>
                        <td className="p-4 border-r text-[#0056d2] font-black">{c.customerCode}</td>
                        <td className="p-4 border-r">{c.customerName}</td>
                        <td className="p-4 border-r">{c.city}</td>
                        <td className="p-4 border-r text-slate-700">{c.gstNo || '-'}</td>
                        <td className="p-4 text-slate-400">{c.updatedAt ? format(new Date(c.updatedAt), 'dd/MM HH:mm') : '-'}</td>
                      </tr>
                    ))}
                    {paginated.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-20 text-center text-slate-300 italic uppercase font-black text-[10px] tracking-widest">No matching customer records found in current protocol.</td>
                      </tr>
                    )}
                  </tbody>
               </table>
               <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                 <div className="flex gap-2 items-center">
                   <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
                   <input type="number" min="1" max={totalPages} value={currentPage} onChange={e => setCurrentPage(Math.max(1, Math.min(totalPages || 1, Number(e.target.value))))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black outline-none" />
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
                   {plants?.filter(p => !authorizedPlantCodes || authorizedPlantCodes.includes(p.plantCode)).map(p => (
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
                   disabled={isReadOnly || !!formData.id} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none transition-all", errors.includes('customerCode') && !formData.customerCode ? "border-red-500 bg-red-50" : "border-slate-400 focus:bg-yellow-50 disabled:bg-slate-100")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Customer Name:</label>
                 <input 
                   value={formData.customerName || ''} 
                   onChange={e => setFormData({...formData, customerName: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none transition-all", errors.includes('customerName') && !formData.customerName ? "border-red-500 bg-red-50" : "border-slate-400 focus:bg-yellow-50")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Address:</label>
                 <input 
                   value={formData.address || ''} 
                   onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none transition-all", errors.includes('address') && !formData.address ? "border-red-500 bg-red-50" : "border-slate-400 focus:bg-yellow-50")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">City:</label>
                 <input 
                   value={formData.city || ''} 
                   onChange={e => setFormData({...formData, city: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none transition-all", errors.includes('city') ? "border-red-500 bg-red-50" : "border-slate-400 focus:bg-yellow-50")} 
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Pincode:</label>
                 <input value={formData.pincode || ''} onChange={e => setFormData({...formData, pincode: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none focus:bg-yellow-50" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">GSTIN:</label>
                 <input value={formData.gstNo || ''} onChange={e => setFormData({...formData, gstNo: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none focus:bg-yellow-50" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Mobile:</label>
                 <input value={formData.mobile || ''} onChange={e => setFormData({...formData, mobile: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none focus:bg-yellow-50" />
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}