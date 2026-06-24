'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, Upload, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, useUser, useDoc } from '@/mongodb';
import { collection, doc, serverTimestamp } from '@/lib/mongo-store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

interface SAPAutocompleteProps {
  value: string;
  options: any[];
  onSelect: (item: any) => void;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
  className?: string;
}

function SAPAutocomplete({ value, options, onSelect, disabled, hasError, placeholder, className }: SAPAutocompleteProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [inputValue, setInputValue] = React.useState(value || '');
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { setInputValue(value || ''); }, [value]);

  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return [];
    const term = inputValue.toUpperCase();
    return options.filter(opt => 
      (opt.customerName || '').toUpperCase().includes(term) || 
      (opt.customerCode || '').toUpperCase().includes(term) ||
      (opt.city || '').toUpperCase().includes(term)
    ).slice(0, 10);
  }, [options, inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIsOpen(true); setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0)); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (isOpen && filteredOptions[highlightedIndex]) {
        if (e.key === 'Enter') e.preventDefault();
        onSelect(filteredOptions[highlightedIndex]);
          setIsOpen(false);
      }
    } else if (e.key === 'Escape') { setIsOpen(false); }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        value={inputValue}
        disabled={disabled}
        onChange={(e) => {
          const val = e.target.value.toUpperCase();
          setInputValue(val);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "h-8 w-80 border px-2 text-[12px] font-black outline-none transition-all uppercase",
          hasError ? "border-red-500 bg-red-50" : "border-slate-400 focus:bg-yellow-50",
          disabled && "bg-slate-50 cursor-not-allowed"
        )}
      />
      {isOpen && filteredOptions.length > 0 && !disabled && (
        <ul className="absolute z-[100] w-full bg-white border border-slate-400 shadow-lg mt-0.5 max-h-60 overflow-y-auto font-mono text-left">
          {filteredOptions.map((opt, idx) => (
            <li
              key={opt.id}
              onClick={() => { onSelect(opt); setIsOpen(false); }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                "px-3 py-1.5 cursor-pointer text-[10px] font-bold border-b border-slate-100 last:border-0 uppercase flex justify-between gap-4",
                highlightedIndex === idx ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-blue-50"
              )}
            >
              <div className="flex flex-col">
                <span className="truncate">{opt.customerName}</span>
                <span className={cn("text-[8px] font-black", highlightedIndex === idx ? "text-blue-100" : "text-[#0056d2]")}>CODE: {opt.customerCode}</span>
              </div>
              <span className="shrink-0 italic text-[9px] opacity-60">{opt.city}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function VAPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useMongoStore();
  const { user } = useUser();
  const activeTCode = searchParams.get('tcode') || 'VA03';
  const isReadOnly = activeTCode === 'VA03' || activeTCode === 'VA04';
  
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

  const plantsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const ordersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const customersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

  const { data: allPlants } = useCollectionOptimized(plantsQuery);
  const { data: allOrders } = useCollectionOptimized(ordersQuery);
  const { data: allCustomers } = useCollectionOptimized(customersQuery);

  const filteredPlants = React.useMemo(() => {
    if (!allPlants || authorizedPlantCodes === undefined) return [];
    if (!authorizedPlantCodes) return allPlants;
    return allPlants.filter(p => authorizedPlantCodes.includes(p.plantCode));
  }, [allPlants, authorizedPlantCodes]);

  // Handle single plant auto-selection to prevent empty/disabled state
  React.useEffect(() => {
    if (mounted && filteredPlants.length === 1 && !formData.plantCode && !isReadOnly) {
      setFormData((prev: any) => ({ ...prev, plantCode: filteredPlants[0].plantCode }));
    }
  }, [mounted, filteredPlants, formData.plantCode, isReadOnly]);

  const filteredCustomersForSelection = React.useMemo(() => {
    if (!allCustomers) return [];
    if (!formData.plantCode) return allCustomers;
    return allCustomers.filter(c => Array.isArray(c.plantCodes) && c.plantCodes.includes(formData.plantCode));
  }, [allCustomers, formData.plantCode]);

  const handleShortClose = React.useCallback(() => {
    if (!formData.id) return;
    if (!window.confirm(`Are you sure you want to short close order ${formData.orderNo}?`)) return;

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', formData.id), { 
      status: 'Short Closed',
      updatedAt: serverTimestamp(),
      updatedBy: 'Sikkaind_System'
    }, { merge: true });
    
    setFormData({});
    alert(`Order ${formData.orderNo} has been Short Closed.`);
  }, [db, formData]);

  const handleSave = React.useCallback(() => {
    if (isReadOnly) return;
    
    const mandatory = ['plantCode', 'orderNo', 'orderDate', 'consignorCode', 'consigneeCode', 'shipToPartyCode', 'materialName', 'quantity'];

    const missing = mandatory.filter(key => !formData[key]);
    if (missing.length > 0) {
      setErrors(missing);
      alert('Error: Mandatory columns cannot be blank.');
      return;
    }

    const normalizedOrderNo = (formData.orderNo || '').trim().toUpperCase();
    if (!normalizedOrderNo) {
      setErrors(prev => [...new Set([...prev, 'orderNo'])]);
      alert('Error: Sale Order No cannot be blank.');
      return;
    }

    if (allOrders === undefined) {
      alert('Please wait while existing sale orders are loaded.');
      return;
    }

    const isDuplicate = (allOrders || []).some(o => ((o.orderNo || '').trim().toUpperCase() === normalizedOrderNo) && o.id !== formData.id);
    if (isDuplicate) {
      setErrors(prev => [...new Set([...prev, 'orderNo'])]);
      alert('Duplicate Sale Order not allowed. Please use a unique Sale Order number.');
      return;
    }

    const docId = formData.id || crypto.randomUUID();
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), { 
      ...formData,
      orderNo: normalizedOrderNo,
      invoiceNo: (formData.invoiceNo || '').toString().trim().toUpperCase(),
      eWaybillNo: (formData.eWaybillNo || '').toString().trim(),
      vehicleNo: (formData.vehicleNo || '').toString().trim().toUpperCase(),

      mode: formData.mode || 'Road',
      via: formData.mode === 'Rail to Road' ? (formData.via || '') : '',
      id: docId, 
      updatedAt: serverTimestamp(),
      createdAt: formData.createdAt || serverTimestamp(),
      updatedBy: 'Sikkaind_System',
      status: formData.status || 'Open'
    }, { merge: true });
    
    setFormData({});
    setErrors([]);
    alert('Successfully Saved');
  }, [db, formData, isReadOnly, allOrders]);

  React.useEffect(() => {
    const handleGlobalSave = () => handleSave();
    window.addEventListener('sap-save-triggered', handleGlobalSave);
    return () => window.removeEventListener('sap-save-triggered', handleGlobalSave);
  }, [handleSave]);

  const handleDownloadTemplate = () => {
    const headers = ['Plant', 'Sale Order', 'Order Date', 'Consignor Code', 'Consignee Code', 'Ship To Party Code', 'Material', 'Weight', 'Invoice No', 'E-Waybill', 'Vehicle No'];

    const csv = headers.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VA01_Bulk_Template.csv`;
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
      
      // Lines split करें और पूरी तरह खाली लाइनों को इग्नोर करें
      const lines = text
        .split(/\r\n|\n|\r/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (lines.length <= 1) { 
        alert("File empty or missing headers"); 
        setIsUploading(false); 
        if (fileInputRef.current) fileInputRef.current.value = '';
        return; 
      }

      // कोट्स, BOM कैरेक्टर और स्पेस हटाने के लिए हेल्पर फ़ंक्शन
      const cleanCell = (str: string) => {
        if (!str) return '';
        return str
          .replace(/^\uFEFF/, '') // Remove BOM
          .trim()
          .replace(/^["']|["']$/g, '') // Remove wrapping quotes
          .trim();
      };

      // हेडर रो को सही से साफ़ करके अपरकेस में कनवर्ट करें
      const headers = lines[0].split(',').map(h => cleanCell(h).toUpperCase());
      const rows = lines.slice(1);
      const tempLog: typeof uploadLog = [];
      const fileOrderNos = new Set<string>();

      const mandatoryCols = ['PLANT', 'SALE ORDER', 'ORDER DATE', 'CONSIGNOR CODE', 'CONSIGNEE CODE', 'SHIP TO PARTY CODE', 'MATERIAL', 'WEIGHT'];
      const optionalCols = ['INVOICE NO', 'E-WAYBILL', 'VEHICLE NO'];

      const headerIndices: Record<string, number> = {};
      mandatoryCols.forEach(col => {
        headerIndices[col] = headers.indexOf(col);
      });
      optionalCols.forEach(col => {
        headerIndices[col] = headers.indexOf(col);
      });


      const missingCols = mandatoryCols.filter(col => headerIndices[col] === -1);
      if (missingCols.length > 0) {
        alert(`Invalid CSV. Missing required columns: ${missingCols.join(', ')}`);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
  
      for (let i = 0; i < rows.length; i++) {
        // कोट्स के अंदर के कॉमा को सेफ़ रखकर रो स्प्लिट करने के लिए RegEx
        const columns = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => cleanCell(c));
        
        const plant = columns[headerIndices['PLANT']];
        const orderNo = columns[headerIndices['SALE ORDER']].toUpperCase();
        const orderDate = columns[headerIndices['ORDER DATE']];
        const cnrCode = columns[headerIndices['CONSIGNOR CODE']];
        const cneCode = columns[headerIndices['CONSIGNEE CODE']];
        const stpCode = columns[headerIndices['SHIP TO PARTY CODE']];
        const material = columns[headerIndices['MATERIAL']];
        const weight = columns[headerIndices['WEIGHT']];

        const invoiceNo = headerIndices['INVOICE NO'] !== -1 ? columns[headerIndices['INVOICE NO']] : '';
        const eWaybillNo = headerIndices['E-WAYBILL'] !== -1 ? columns[headerIndices['E-WAYBILL']] : '';
        const vehicleNo = headerIndices['VEHICLE NO'] !== -1 ? columns[headerIndices['VEHICLE NO']] : '';


        const rowId = orderNo || `Row ${i + 2}`;
        let errorReason = '';

        if (!plant || !orderNo || !orderDate || !cnrCode || !cneCode || !stpCode || !material || !weight) {
          errorReason = 'Mandatory column missing';
        } 
        else if (authorizedPlantCodes && !authorizedPlantCodes.includes(plant)) {
          errorReason = `Authorization failure for plant ${plant}`;
        }
        else if (fileOrderNos.has(orderNo)) {
          errorReason = 'Duplicate Sale Order in File';
        }
        else if (allOrders?.some(o => ((o.orderNo || '').trim().toUpperCase() === orderNo))) {
          errorReason = 'Duplicate Sale Order in Database';
        }
        else {
          const cnr = allCustomers?.find(c => c.customerCode === cnrCode);
          const cne = allCustomers?.find(c => c.customerCode === cneCode);
          const stp = allCustomers?.find(c => c.customerCode === stpCode);

          if (!cnr) errorReason = 'Consignor Code Not Found';
          else if (!cne) errorReason = 'Consignee Code Not Found';
          else if (!stp) errorReason = 'Ship To Party Code Not Found';
          else {
            fileOrderNos.add(orderNo);
            const docId = crypto.randomUUID();
            const payload = {
              id: docId,
              plantCode: plant,
              orderNo,

              mode: 'Road',
              via: '',
              orderDate,
              consignorCode: cnrCode,
              consignorName: cnr.customerName,
              from: cnr.city || '',
              consigneeCode: cneCode,
              consigneeName: cne.customerName,
              shipToPartyCode: stpCode,
              shipToParty: stp.customerName,
              destination: stp.city || '',
              materialName: material,
              invoiceNo: (invoiceNo || '').toString().trim().toUpperCase(),
              eWaybillNo: (eWaybillNo || '').toString().trim(),
              vehicleNo: (vehicleNo || '').toString().trim().toUpperCase(),
              quantity: parseFloat(weight),

              status: 'Open',
              uom: 'MT',
              createdAt: new Date().toISOString(),
              updatedAt: serverTimestamp()
            };
            setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), payload, { merge: true });
          }
        }
        tempLog.push({ 
          status: errorReason ? 'failed' : 'success', 
          id: rowId, 
          msg: errorReason || 'Successfully Saved' 
        });
      }
      setUploadLog(tempLog);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const filteredOrders = React.useMemo(() => {
    if (authorizedPlantCodes === undefined) return [];
    return (allOrders || [])
      .filter(o => {
        if (authorizedPlantCodes && !authorizedPlantCodes.includes(o.plantCode)) return false;

        const isValid = o.plantCode && o.orderNo && o.orderDate && o.consignorCode && o.consigneeCode && o.shipToPartyCode && o.quantity && o.materialName;
        if (!isValid) return false;
        
        if (!searchId) return true;
        const term = searchId.toUpperCase();
        return o.orderNo?.includes(term) || (o.consigneeName || '').toUpperCase().includes(term);
      })
      .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [allOrders, searchId, currentPage, authorizedPlantCodes]);

  const totalPages = Math.ceil((allOrders || []).filter(o => o.plantCode && o.orderNo && (!authorizedPlantCodes || authorizedPlantCodes.includes(o.plantCode))).length / PAGE_SIZE);

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between text-black">
        <h2 className="text-[16px] font-bold uppercase italic">{activeTCode} - Sale Order Registry</h2>
        <div className="flex gap-4">
           {activeTCode === 'VA01' && !formData.id && (
             <>
               <Button onClick={handleDownloadTemplate} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 border-slate-300 rounded-none"><Download className="h-3 w-3 mr-2" /> Download Template</Button>
               <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleBulkUpload} />
               <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 border-[#0056d2] text-[#0056d2] rounded-none"><Upload className="h-3 w-3 mr-2" /> Bulk Upload</Button>
             </>
           )}
           {activeTCode === 'VA04' && formData.id && formData.status !== 'Short Closed' && (
             <Button onClick={handleShortClose} className="h-8 bg-red-600 hover:bg-red-700 text-white rounded-none text-[10px] font-black uppercase px-8 shadow-md">
               Short Close Order
             </Button>
           )}
           {isUploading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
        </div>
      </div>

      <div className="px-2">
        {uploadLog.length > 0 && (
          <div className="mb-10 bg-white border border-slate-300 shadow-md animate-fade-in max-h-60 overflow-y-auto text-black">
             <div className="bg-slate-50 p-2 border-b border-slate-200 flex justify-between sticky top-0 z-10"><span className="text-[10px] font-black uppercase text-blue-800">Processing Log</span><button onClick={() => setUploadLog([])}><X className="h-4 w-4 text-slate-400" /></button></div>
             <div className="p-4 space-y-1.5 text-[10px] font-bold uppercase">
                {uploadLog.map((log, i) => (
                  <div key={i} className={cn("flex items-center gap-3", log.status === 'success' ? "text-emerald-600" : "text-red-500")}>
                    <span>{log.status === 'success' ? '✔' : '✘'}</span>
                    <span className="w-48 shrink-0">Sale Order {log.id}</span>
                    <span className="italic">— {log.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {!formData.id && activeTCode !== 'VA01' ? (
          <div className="bg-white border border-slate-300 shadow-sm overflow-x-auto custom-scrollbar text-black">
             <div className="p-6 bg-slate-50 border-b flex items-center gap-6">
                <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search Registry:</label>
                <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:bg-yellow-50" value={searchId} onChange={e => setSearchId(e.target.value)} placeholder="ENTER ORDER NO OR CUSTOMER..." />
             </div>
             {isProfileLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-300">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Validating Authorization...</span>
                </div>
             ) : (
                <table className="w-full text-left text-[11px] min-w-[1550px] border-collapse">
                   <thead className="bg-[#f8fafc] border-b border-slate-300 font-black uppercase text-slate-500 sticky top-0 z-20">
                     <tr>
                       <th className="p-4 border-r w-[80px]">Plant</th>
                       <th className="p-4 border-r w-[120px]">Sale Order</th>
                       <th className="p-4 border-r w-[120px]">Order Date</th>
                       <th className="p-4 border-r w-[200px]">Consignor</th>
                       <th className="p-4 border-r w-[150px] flex flex-col justify-center leading-none"><span>From</span><span className="text-[7px] text-blue-600 mt-0.5">Via</span></th>
                       <th className="p-4 border-r w-[200px]">Consignee</th>
                       <th className="p-4 border-r w-[200px]">Ship to Party</th>
                       <th className="p-4 border-r w-[150px]">Destination</th>
                       <th className="p-4 border-r w-[150px]">Material</th>
                       <th className="p-4 border-r text-right w-[100px]">Weight</th>
                       <th className="p-4 text-center w-[100px]">Status</th>
                     </tr>
                   </thead>
                   <tbody className="font-bold uppercase">
                     {filteredOrders.map(o => (
                       <tr key={o.id} onClick={() => setFormData(o)} className="border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer">
                         <td className="p-4 border-r text-slate-600">{o.plantCode}</td>
                         <td className="p-4 border-r text-[#0056d2] font-black">{o.orderNo}</td>
                         <td className="p-4 border-r whitespace-nowrap">{o.orderDate ? format(new Date(o.orderDate), 'dd-MMM-yyyy') : '-'}</td>
                         <td className="p-4 border-r truncate max-w-[200px]" title={o.consignorName}>{o.consignorName}</td>
                         <td className="p-4 border-r flex flex-col justify-center leading-tight">
                           <span className="truncate">{o.from}</span>
                           {o.via && <span className="text-[8px] text-blue-600 font-black uppercase truncate">VIA: {o.via}</span>}
                         </td>
                         <td className="p-4 border-r truncate max-w-[200px]" title={o.consigneeName}>{o.consigneeName}</td>
                         <td className="p-4 border-r truncate max-w-[200px]" title={o.shipToParty}>{o.shipToParty}</td>
                         <td className="p-4 border-r truncate max-w-[150px]">{o.destination}</td>
                         <td className="p-4 border-r truncate max-w-[150px]">{o.materialName}</td>
                         <td className="p-4 border-r text-right text-blue-800 font-black">{o.quantity} MT</td>
                         <td className="p-4 text-center">
                           <span className={cn("px-2 py-1 text-[9px] font-black rounded-sm whitespace-nowrap", o.status === 'Short Closed' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>{o.status || 'OPEN'}</span>
                         </td>
                       </tr>
                     ))}
                     {filteredOrders.length === 0 && !isProfileLoading && (
                       <tr>
                         <td colSpan={11} className="p-20 text-center text-slate-300 italic uppercase font-black text-[10px] tracking-widest">No matching registry records found.</td>
                       </tr>
                     )}
                   </tbody>
                </table>
             )}
             <div className="p-3 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black">
                <div className="flex gap-2">
                  <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
                  <Button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
                </div>
                <span className="uppercase text-slate-400 italic">Page {currentPage} of {totalPages || 1}</span>
             </div>
          </div>
        ) : (
          <div className="animate-slide-up space-y-10 bg-white p-12 border border-slate-300 shadow-inner text-black">
             <div className="grid grid-cols-2 gap-x-24 gap-y-6">
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Plant Code:</label>
                 <select 
                   value={formData.plantCode || ''} 
                   onChange={e => setFormData({...formData, plantCode: e.target.value})} 
                   disabled={isReadOnly || (!isBootstrapAdmin && authorizedPlantCodes?.length === 1 && formData.plantCode)} 
                   className={cn("h-8 w-80 border bg-white px-2 text-[12px] font-black outline-none", errors.includes('plantCode') ? "border-red-500 bg-red-50" : "border-slate-400")}
                 >
                   <option value="">Select Plant...</option>
                   {filteredPlants.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
                 </select>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Sale Order No:</label>
                 <div className="flex items-center gap-4">
                   <input value={formData.orderNo || ''} onChange={e => setFormData({...formData, orderNo: e.target.value.toUpperCase()})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('orderNo') ? "border-red-500 bg-red-50" : "border-slate-400")} />
                   {formData.status === 'Short Closed' && <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase whitespace-nowrap border border-red-200 shadow-sm">Short Closed</span>}
                 </div>
               </div>
               
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Order Date:</label><input type="date" value={formData.orderDate || ''} onChange={e => setFormData({...formData, orderDate: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('orderDate') ? "border-red-500 bg-red-50" : "border-slate-400")} /></div>
               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Weight (MT):</label><input type="number" step="0.001" value={formData.quantity || ''} onChange={e => setFormData({...formData, quantity: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('quantity') ? "border-red-500 bg-red-50" : "border-slate-400")} /></div>

               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Consignor Name:</label>
                 <SAPAutocomplete value={formData.consignorName || ''} disabled={isReadOnly} options={filteredCustomersForSelection} onSelect={c => setFormData({...formData, consignorName: c.customerName, consignorCode: c.customerCode, from: c.city || ''})} hasError={errors.includes('consignorCode')} />
               </div>
               <div className="flex items-center gap-8 italic"><label className="text-[12px] font-bold text-slate-400 w-48 text-right uppercase">Consignor Code:</label><input value={formData.consignorCode || ''} readOnly className="h-8 w-80 border border-slate-300 bg-slate-50 px-2 text-[12px] font-black text-[#0056d2]" /></div>

               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Consignee Name:</label>
                 <SAPAutocomplete value={formData.consigneeName || ''} disabled={isReadOnly} options={filteredCustomersForSelection} onSelect={c => setFormData({...formData, consigneeName: c.customerName, consigneeCode: c.customerCode})} hasError={errors.includes('consigneeCode')} />
               </div>
               <div className="flex items-center gap-8 italic"><label className="text-[12px] font-bold text-slate-400 w-48 text-right uppercase">Consignee Code:</label><input value={formData.consigneeCode || ''} readOnly className="h-8 w-80 border border-slate-300 bg-slate-50 px-2 text-[12px] font-black text-[#0056d2]" /></div>

               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Ship to Party:</label>
                 <SAPAutocomplete value={formData.shipToParty || ''} disabled={isReadOnly} options={filteredCustomersForSelection} onSelect={c => setFormData({...formData, shipToParty: c.customerName, shipToPartyCode: c.customerCode, destination: c.city || ''})} hasError={errors.includes('shipToPartyCode')} />
               </div>
               <div className="flex items-center gap-8 italic"><label className="text-[12px] font-bold text-slate-400 w-48 text-right uppercase">Ship to Code:</label><input value={formData.shipToPartyCode || ''} readOnly className="h-8 w-80 border border-slate-300 bg-slate-50 px-2 text-[12px] font-black text-[#0056d2]" /></div>

               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Material:</label><input value={formData.materialName || ''} onChange={e => setFormData({...formData, materialName: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" /></div>

               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Invoice No:</label><input value={formData.invoiceNo || ''} onChange={e => setFormData({...formData, invoiceNo: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none uppercase" /></div>

               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">E-Waybill:</label><input value={formData.eWaybillNo || ''} onChange={e => setFormData({...formData, eWaybillNo: e.target.value})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none uppercase" /></div>

               <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Vehicle No:</label><input value={formData.vehicleNo || ''} onChange={e => setFormData({...formData, vehicleNo: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none uppercase" /></div>

               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Transport Mode:</label>
                 <select 
                   value={formData.mode || 'Road'} 
                   onChange={e => setFormData({...formData, mode: e.target.value, via: e.target.value === 'Road' ? '' : formData.via})} 
                   disabled={isReadOnly} 
                   className="h-8 w-80 border border-slate-400 bg-white px-2 text-[12px] font-black outline-none uppercase"
                 >
                   <option value="Road">Road</option>
                   <option value="Rail to Road">Rail to Road</option>
                 </select>
               </div>

               {formData.mode === 'Rail to Road' && (
                 <div className="flex items-center gap-8">
                   <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Station Name:</label>
                   <input placeholder="ENTER STATION NAME..." value={formData.via || ''} onChange={e => setFormData({...formData, via: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none uppercase focus:bg-yellow-50" />
                 </div>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}