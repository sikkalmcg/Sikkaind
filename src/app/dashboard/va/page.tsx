'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight, Trash2, Search, Download, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SHARED_HUB_ID = 'Sikkaind';
const PAGE_SIZE = 15;

interface SAPAutocompleteProps {
  value: string;
  options: any[];
  onSelect: (name: string) => void;
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

  React.useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return [];
    const term = inputValue.toUpperCase();
    return options.filter(opt => 
      (opt.customerName || '').toUpperCase().includes(term) || 
      (opt.city || '').toUpperCase().includes(term)
    ).slice(0, 10);
  }, [options, inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (isOpen && filteredOptions[highlightedIndex]) {
        if (e.key === 'Enter') e.preventDefault();
        const selected = filteredOptions[highlightedIndex].customerName;
        onSelect(selected);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
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
          onSelect(val);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "h-8 w-80 border px-2 text-[12px] font-black outline-none transition-all uppercase",
          hasError ? "border-red-500 bg-red-50" : "border-slate-400 focus:bg-yellow-50",
          disabled && "bg-slate-50 cursor-not-allowed border-slate-200"
        )}
      />
      {isOpen && filteredOptions.length > 0 && !disabled && (
        <ul className="absolute z-[100] w-full bg-white border border-slate-400 shadow-lg mt-0.5 max-h-60 overflow-y-auto font-mono">
          {filteredOptions.map((opt, idx) => (
            <li
              key={opt.id}
              onClick={() => {
                onSelect(opt.customerName);
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                "px-3 py-1.5 cursor-pointer text-[10px] font-bold border-b border-slate-100 last:border-0 uppercase flex justify-between gap-4",
                highlightedIndex === idx ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-blue-50"
              )}
            >
              <span className="truncate">{opt.customerName}</span>
              <span className={cn("shrink-0 italic text-[9px]", highlightedIndex === idx ? "text-blue-100" : "text-slate-400")}>
                {opt.city || 'NO CITY'}
              </span>
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
  const db = useFirestore();
  const activeTCode = searchParams.get('tcode') || 'VA03';
  const isReadOnly = activeTCode === 'VA03' || activeTCode === 'VA04';
  
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [errors, setErrors] = React.useState<string[]>([]);
  
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadResults, setUploadResults] = React.useState<{ success: number; failed: { row: number; msg: string }[] } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);

  const { data: plants } = useCollection(plantsQuery);
  const { data: orders } = useCollection(ordersQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: trips } = useCollection(tripsQuery);

  const handleSave = React.useCallback(() => {
    if (activeTCode === 'VA03') return;

    // DUPLICATE SALE ORDER CONTROL
    const isDuplicate = (orders || []).some(o => o.orderNo === formData.orderNo && o.id !== formData.id);
    if (isDuplicate) {
      alert('Duplicate Sale Order not allowed');
      return;
    }

    if (activeTCode === 'VA04') {
      const orderToShortClose = (orders || []).find(o => o.orderNo === formData.orderNo);
      if (!orderToShortClose) return alert('Error: Sale Order not found');
      
      const dispatched = (trips || [])
        .filter(t => t.orderNo === orderToShortClose.orderNo && t.status !== 'REJECTION')
        .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0);
      const balance = (parseFloat(orderToShortClose.quantity) || 0) - dispatched;

      if (balance <= 0.001) return alert('VALIDATION ERROR: Sale Order fully assigned. Short close protocol blocked.');

      setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', orderToShortClose.id), { 
        status: 'Short closed',
        shortCloseReason: formData.shortCloseReason || 'Manual Termination',
        updatedAt: serverTimestamp() 
      }, { merge: true });
      alert('Order Status Updated: Short Closed');
      setFormData({});
      return;
    }

    // STRICT VALIDATION RULE: 9 Mandatory Fields
    const mandatory = [
      'plantCode', 'orderNo', 'orderDate', 'consignorName', 'from', 
      'consigneeName', 'shipToParty', 'destination', 'quantity'
    ];
    
    const missing = mandatory.filter(key => !formData[key]);
    if (missing.length > 0) {
      setErrors(missing);
      alert('STRICT SYSTEM ERROR: All mandatory fields (Plant, Order, Date, Consignor, From, Consignee, Ship To, Destination, Weight) must be completed before synchronization.');
      return;
    }

    const docId = formData.id || crypto.randomUUID();
    let status = formData.status || 'Open';
    if (activeTCode === 'VA02' && status === 'Short closed') status = 'Open';

    const savePayload = { 
      ...formData, 
      id: docId, 
      status, 
      updatedAt: serverTimestamp(),
      createdAt: formData.createdAt || serverTimestamp(),
      updatedBy: 'Sikkaind_System'
    };

    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), savePayload, { merge: true });
    setFormData({});
    setErrors([]);
    alert('Order Synchronized Successfully');
  }, [activeTCode, db, formData, orders, trips]);

  React.useEffect(() => {
    if (activeTCode === 'VA01' && !formData.id) {
      setFormData({ 
        orderDate: format(new Date(), "yyyy-MM-dd"), 
        status: 'Open', 
        uom: 'MT',
        createdAt: new Date().toISOString(),
        consignorName: '',
        consigneeName: '',
        shipToParty: '',
        from: '',
        destination: '',
        consignorCode: '',
        consigneeCode: '',
        shipToPartyCode: '',
        plantCode: ''
      });
    }
  }, [activeTCode, formData.id]);

  React.useEffect(() => {
    const handleGlobalSave = () => handleSave();
    window.addEventListener('sap-save-triggered', handleGlobalSave);
    return () => window.removeEventListener('sap-save-triggered', handleGlobalSave);
  }, [handleSave]);

  const filteredCustomers = React.useMemo(() => {
    if (!customers || !formData.plantCode) return [];
    return customers.filter(c => {
      const codes = c.plantCodes;
      if (Array.isArray(codes)) return codes.includes(formData.plantCode);
      return codes === formData.plantCode;
    });
  }, [customers, formData.plantCode]);

  const filteredConsignors = React.useMemo(() => {
    return filteredCustomers.filter(c => c.customerType === 'Consignor');
  }, [filteredCustomers]);

  const handleLookupPartyId = (name: string, type: 'consignor' | 'consignee' | 'shipTo') => {
    const party = filteredCustomers.find(c => c.customerName === name);
    
    if (!party) {
      const clearUpdates: any = {};
      if (type === 'consignor') { clearUpdates.consignorCode = ''; clearUpdates.from = ''; }
      if (type === 'consignee') { clearUpdates.consigneeCode = ''; }
      if (type === 'shipTo') { clearUpdates.shipToPartyCode = ''; clearUpdates.destination = ''; }
      setFormData((prev: any) => ({ ...prev, ...clearUpdates }));
      return;
    }

    const updates: any = {};
    if (type === 'consignor') { updates.consignorCode = party.customerCode; updates.from = party.city || ''; }
    if (type === 'consignee') { updates.consigneeCode = party.customerCode; }
    if (type === 'shipTo') { updates.shipToPartyCode = party.customerCode; updates.destination = party.city || ''; }
    
    setFormData((prev: any) => ({ ...prev, ...updates }));
  };

  const handleDownloadTemplate = () => {
    const headers = ['Order No', 'Plant', 'Order Date', 'Consignor Code', 'Consignor Name', 'Consignee Code', 'Consignee Name', 'Ship to Party Code', 'Ship to Party Name', 'Material', 'Weight'];
    const csv = headers.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VA01_Template_${format(new Date(), 'ddMMyy')}.csv`;
    a.click();
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResults(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').map(r => r.split(',').map(c => c.trim())).filter(r => r.length > 1 && r[0] !== 'Order No');
      
      const failed: { row: number; msg: string }[] = [];
      const validRows: any[] = [];
      const incomingNos = new Set();

      rows.forEach((r, idx) => {
        const [orderNo, plant, orderDate, cnrCode, cnrName, cneCode, cneName, stpCode, stpName, material, weight] = r;
        const rowNum = idx + 2;

        if (!orderNo || !plant || !orderDate || !cnrCode || !cnrName || !cneCode || !cneName || !stpCode || !stpName || !material || !weight) {
          failed.push({ row: rowNum, msg: 'Mandatory field(s) missing' });
          return;
        }

        // DUPLICATE SALE ORDER CHECK (INCOMING AND DB)
        if (incomingNos.has(orderNo) || orders?.some(o => o.orderNo === orderNo)) {
          failed.push({ row: rowNum, msg: 'Duplicate Sale Order not allowed' });
          return;
        }
        incomingNos.add(orderNo);

        const plantExists = plants?.some(p => p.plantCode === plant);
        if (!plantExists) { failed.push({ row: rowNum, msg: `Invalid Plant: ${plant}` }); return; }

        const cnr = customers?.find(c => c.customerCode === cnrCode && c.customerName === cnrName);
        const stp = customers?.find(c => c.customerCode === stpCode && c.customerName === stpName);

        if (!cnr) { failed.push({ row: rowNum, msg: `Consignor Mismatch: ${cnrCode}/${cnrName}` }); return; }
        if (!stp) { failed.push({ row: rowNum, msg: `Ship-To Mismatch: ${stpCode}/${stpName}` }); return; }

        validRows.push({
          orderNo, plantCode: plant, orderDate, consignorCode: cnrCode, consignorName: cnrName,
          consigneeCode: cneCode, consigneeName: cneName, shipToPartyCode: stpCode, shipToParty: stpName,
          materialName: material, quantity: parseFloat(weight), from: cnr.city || '', destination: stp.city || ''
        });
      });

      if (failed.length > 0) {
        setUploadResults({ success: 0, failed });
        setIsUploading(false);
        return;
      }

      let successCount = 0;
      validRows.forEach(order => {
        const docId = crypto.randomUUID();
        const payload = {
          ...order,
          id: docId,
          status: 'Open',
          uom: 'MT',
          createdAt: new Date().toISOString(),
          updatedAt: serverTimestamp(),
          updatedBy: 'Sikkaind_Bulk_Portal'
        };
        setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), payload, { merge: true });
        successCount++;
      });

      setUploadResults({ success: successCount, failed: [] });
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDelete = (id: string) => {
    if (confirm('SATELLITE WARNING: Permanently delete this order?')) {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', id));
    }
  };

  const validAndPaginated = React.useMemo(() => {
    const seen = new Set();
    const filtered = (orders || [])
      .filter(o => {
        // ACCESS DENIED: Filter out duplicates and invalid entries
        if (seen.has(o.orderNo)) return false;
        seen.add(o.orderNo);

        const hasMandatory = o.plantCode && o.orderNo && o.orderDate && o.consignorName && o.from && 
                           o.consigneeName && o.shipToParty && o.destination && o.quantity;
        const matchesSearch = !searchId || o.orderNo?.includes(searchId.toUpperCase());
        return hasMandatory && matchesSearch;
      });
    
    const start = (currentPage - 1) * PAGE_SIZE;
    return {
      list: filtered.slice(start, start + PAGE_SIZE),
      total: Math.ceil(filtered.length / PAGE_SIZE)
    };
  }, [orders, searchId, currentPage]);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      return format(new Date(cleanDate), 'dd-MMM-yyyy');
    } catch(e) { return '-'; }
  };

  const matchedOrder = React.useMemo(() => {
    if (activeTCode !== 'VA04' || !formData.orderNo) return null;
    const ord = orders?.find(o => o.orderNo === formData.orderNo);
    if (!ord) return null;
    const dispatched = trips?.filter(t => t.orderNo === ord.orderNo && t.status !== 'REJECTION')
                             .reduce((acc, t) => acc + (parseFloat(t.assignWeight) || 0), 0) || 0;
    return { ...ord, balance: parseFloat(ord.quantity) - dispatched };
  }, [activeTCode, formData.orderNo, orders, trips]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase italic">{activeTCode} - SALE ORDER</h2>
        <div className="flex items-center gap-3">
          {activeTCode === 'VA01' && !formData.id && (
            <>
               <Button onClick={handleDownloadTemplate} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none border-slate-300 hover:bg-slate-50">
                  <Download className="h-3.5 w-3.5 mr-2" /> Template
               </Button>
               <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleBulkUpload} />
               <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-8 text-[10px] font-black uppercase px-6 rounded-none border-[#0056d2] text-[#0056d2] hover:bg-blue-50">
                  <Upload className="h-3.5 w-3.5 mr-2" /> Bulk Upload
               </Button>
            </>
          )}
          {isUploading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
        </div>
      </div>

      <div className="px-2">
        {activeTCode === 'VA01' && uploadResults && (
          <div className={cn("mb-8 p-6 border-l-4 shadow-sm animate-fade-in", uploadResults.failed.length > 0 ? "bg-red-50 border-red-500" : "bg-emerald-50 border-emerald-500")}>
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                   {uploadResults.failed.length > 0 ? <AlertCircle className="text-red-500" /> : <CheckCircle2 className="text-emerald-500" />}
                   <span className="text-[12px] font-black uppercase tracking-tight">
                     Summary: {uploadResults.success} Successfully Created | {uploadResults.failed.length} Failed
                   </span>
                </div>
                <button onClick={() => setUploadResults(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase">Clear Message &times;</button>
             </div>
             {uploadResults.failed.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-4 custom-scrollbar">
                   {uploadResults.failed.map((f, i) => (
                      <p key={i} className="text-[10px] font-bold text-red-600 uppercase italic">Row {f.row}: {f.msg}</p>
                   ))}
                </div>
             )}
          </div>
        )}

        {!formData.id && activeTCode !== 'VA01' && activeTCode !== 'VA04' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 border border-slate-300 shadow-sm flex items-center gap-6 animate-fade-in">
              <label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search:</label>
              <input className="h-9 w-full border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:bg-yellow-50 shadow-inner" value={searchId} onChange={e => { setSearchId(e.target.value); setCurrentPage(1); }} placeholder="ENTER SALE ORDER NO..." />
            </div>
            <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
               <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-300 font-black uppercase text-slate-500">
                    <tr>
                      <th className="p-4 border-r">Plant</th>
                      <th className="p-4 border-r">Sale Order Details</th>
                      <th className="p-4 border-r">Consignor</th>
                      <th className="p-4 border-r">From</th>
                      <th className="p-4 border-r">Consignee</th>
                      <th className="p-4 border-r">Ship to Party</th>
                      <th className="p-4 border-r">Destination</th>
                      <th className="p-4 border-r text-right">Weight</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold uppercase text-[11px]">
                    {validAndPaginated.list.map(o => (
                      <tr key={o.id} onClick={() => setFormData(o)} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="p-4 border-r text-slate-500">{o.plantCode}</td>
                        <td className="p-4 border-r flex flex-col gap-0.5">
                           <span className="text-[#0056d2] font-black">{o.orderNo}</span>
                           <span className="text-[9px] text-slate-400">Date: {formatDateDisplay(o.orderDate)}</span>
                        </td>
                        <td className="p-4 border-r">{o.consignorName}</td>
                        <td className="p-4 border-r text-slate-400 italic">{o.from}</td>
                        <td className="p-4 border-r">{o.consigneeName}</td>
                        <td className="p-4 border-r">{o.shipToParty}</td>
                        <td className="p-4 border-r text-slate-400 italic">{o.destination}</td>
                        <td className="p-4 border-r text-right font-black">{parseFloat(o.quantity).toFixed(3)}</td>
                        <td className="p-4">
                           {activeTCode === 'VA02' && <button onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }} className="p-1 hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
               <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                 <div className="flex gap-2 items-center">
                   <Button disabled={currentPage === 1} onClick={() => setCurrentPage(v => v - 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronLeft className="h-3 w-3" /></Button>
                   <input type="number" min="1" max={validAndPaginated.total} value={currentPage} onChange={e => setCurrentPage(Math.max(1, Math.min(validAndPaginated.total, Number(e.target.value))))} className="h-7 w-12 border border-slate-300 text-center text-[10px] font-black outline-none" />
                   <Button disabled={currentPage >= validAndPaginated.total} onClick={() => setCurrentPage(v => v + 1)} variant="outline" className="h-7 w-7 p-0 rounded-none"><ChevronRight className="h-3 w-3" /></Button>
                 </div>
                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Page {currentPage} of {validAndPaginated.total || 1}</span>
               </div>
            </div>
          </div>
        ) : activeTCode === 'VA04' ? (
          <div className="bg-white p-12 border border-slate-300 shadow-sm max-w-4xl mx-auto w-full">
             <h3 className="text-red-600 font-black uppercase italic mb-8 border-b pb-4">Short Close Workflow</h3>
             <div className="space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-8">
                      <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Sale Order No:</label>
                      <input value={formData.orderNo || ''} onChange={e => setFormData({...formData, orderNo: e.target.value.toUpperCase()})} className="h-9 w-80 border border-slate-400 px-3 text-[12px] font-black outline-none" placeholder="ENTER ORDER NO..." />
                  </div>
                  <div className="flex items-center gap-8">
                      <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Reason:</label>
                      <input value={formData.shortCloseReason || ''} onChange={e => setFormData({...formData, shortCloseReason: e.target.value.toUpperCase()})} className="h-9 w-80 border border-slate-400 px-3 text-[12px] font-black outline-none" placeholder="OPTIONAL..." />
                  </div>
                </div>

                {matchedOrder && (
                  <div className="grid grid-cols-2 gap-y-4 gap-x-12 p-8 bg-slate-50 border border-slate-100 rounded-sm animate-fade-in text-[11px] font-bold uppercase">
                    <div className="flex justify-between border-b pb-2"><span className="text-slate-400">Consignor:</span><span className="text-slate-800">{matchedOrder.consignorName}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-slate-400">Consignee:</span><span className="text-slate-800">{matchedOrder.consigneeName}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-slate-400">Ship To Party:</span><span className="text-slate-800">{matchedOrder.shipToParty}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-slate-400 font-black text-[#1e3a8a]">Balance Qty:</span><span className="text-emerald-600 font-black">{matchedOrder.balance.toFixed(3)} MT</span></div>
                    
                    {matchedOrder.balance <= 0.001 && (
                       <div className="col-span-2 mt-4 p-3 bg-red-50 border border-red-100 text-red-600 font-black text-[9px] text-center italic">
                          SATELLITE ALERT: ORDER FULLY ASSIGNED. SHORT CLOSE PROTOCOL BLOCKED.
                       </div>
                    )}
                  </div>
                )}
             </div>
          </div>
        ) : (
          <div className="animate-slide-up space-y-12 bg-white p-12 border border-slate-300 shadow-inner">
             <div className="grid grid-cols-2 gap-y-6 gap-x-24">
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">PLANT CODE:</label>
                 <select 
                   value={formData.plantCode || ''} 
                   onChange={e => {
                     const val = e.target.value;
                     setFormData({
                       ...formData, 
                       plantCode: val,
                       consignorName: '',
                       consignorCode: '',
                       consigneeName: '',
                       consigneeCode: '',
                       shipToParty: '',
                       shipToPartyCode: '',
                       from: '',
                       destination: ''
                     });
                   }} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border bg-white px-2 text-[12px] font-black outline-none", errors.includes('plantCode') ? "border-red-500 bg-red-50" : "border-slate-400")}
                 >
                   <option value="">SELECT PLANT...</option>
                   {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
                 </select>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">SALE ORDER NO:</label>
                 <input 
                   value={formData.orderNo || ''} 
                   onChange={e => setFormData({...formData, orderNo: e.target.value.toUpperCase()})} 
                   disabled={isReadOnly} 
                   className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('orderNo') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>
               
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">CONSIGNOR NAME:</label>
                 <SAPAutocomplete
                   value={formData.consignorName || ''}
                   disabled={isReadOnly}
                   options={filteredConsignors || []}
                   onSelect={(name) => {
                     setFormData((prev: any) => ({...prev, consignorName: name}));
                     handleLookupPartyId(name, 'consignor');
                   }}
                   hasError={errors.includes('consignorName')}
                   placeholder="SEARCH CONSIGNOR..."
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">ORDER DATE:</label>
                 <input 
                    type="date" 
                    value={formData.orderDate ? formData.orderDate.split('T')[0] : ''} 
                    onChange={e => setFormData({...formData, orderDate: e.target.value})} 
                    disabled={isReadOnly} 
                    className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none uppercase", errors.includes('orderDate') ? "border-red-500 bg-red-50" : "border-slate-400")} 
                 />
               </div>

               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">CONSIGNEE NAME:</label>
                 <SAPAutocomplete
                   value={formData.consigneeName || ''}
                   disabled={isReadOnly}
                   options={filteredCustomers || []}
                   onSelect={(name) => {
                     setFormData((prev: any) => ({...prev, consigneeName: name}));
                     handleLookupPartyId(name, 'consignee');
                   }}
                   hasError={errors.includes('consigneeName')}
                   placeholder="SEARCH CONSIGNEE..."
                 />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase italic">FROM (AUTO-FILL):</label>
                 <input value={formData.from || ''} readOnly className="h-8 w-80 border border-slate-300 bg-slate-50 px-2 text-[12px] font-black outline-none" />
               </div>

               <div className="flex items-center gap-8">
                  <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">WEIGHT (MT):</label>
                  <input type="number" step="0.001" value={formData.quantity || ''} onChange={e => setFormData({...formData, quantity: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('quantity') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">SHIP TO PARTY:</label>
                 <SAPAutocomplete
                   value={formData.shipToParty || ''}
                   disabled={isReadOnly}
                   options={filteredCustomers || []}
                   onSelect={(name) => {
                     setFormData((prev: any) => ({...prev, shipToParty: name}));
                     handleLookupPartyId(name, 'shipTo');
                   }}
                   hasError={errors.includes('shipToParty')}
                   placeholder="SEARCH SHIP TO..."
                 />
               </div>

               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">MATERIAL NAME:</label>
                 <input value={formData.materialName || ''} onChange={e => setFormData({...formData, materialName: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase italic">DESTINATION:</label>
                 <input value={formData.destination || ''} readOnly className="h-8 w-80 border border-slate-300 bg-slate-50 px-2 text-[12px] font-black outline-none" />
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
