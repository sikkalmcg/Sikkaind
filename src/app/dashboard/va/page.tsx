'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, ChevronRight, Trash2, Search, Download, Upload, Loader2, AlertCircle, CheckCircle2, FileText, X } from 'lucide-react';
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
  const [uploadLog, setUploadLog] = React.useState<{ status: 'success' | 'failed', msg: string, id: string }[]>([]);
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

    // MANDATORY FIELD VALIDATION
    const mandatory = ['plantCode', 'orderNo', 'orderDate', 'consignorName', 'from', 'consigneeName', 'shipToParty', 'destination', 'quantity'];
    const missing = mandatory.filter(key => !formData[key]);
    if (missing.length > 0) {
      setErrors(missing);
      alert('STRICT SYSTEM ERROR: All mandatory fields (Plant, Order, Date, Consignor, From, Consignee, Ship To, Destination, Weight) must be completed.');
      return;
    }

    // DUPLICATE CHECK
    const isDuplicate = (orders || []).some(o => o.orderNo === formData.orderNo && o.id !== formData.id);
    if (isDuplicate) {
      alert('Duplicate Sale Order not allowed');
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

  const handleDownloadTemplate = () => {
    const headers = ['Plant', 'Sale Order', 'Customer ID', 'Order Date', 'Consignor', 'From', 'Consignee', 'Ship To Party', 'Destination', 'Weight'];
    const csv = headers.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VA01_SAP_Template.csv`;
    a.click();
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadLog([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length <= 1) {
        alert("Error: File is empty or contains only headers.");
        setIsUploading(false);
        return;
      }

      const rows = lines.slice(1);
      const tempLog: { status: 'success' | 'failed', msg: string, id: string }[] = [];
      const fileOrderNos = new Set();
      const fileCustomerIds = new Set();

      for (let i = 0; i < rows.length; i++) {
        const columns = rows[i].split(',').map(c => c.trim());
        // Template: Plant, Sale Order, Customer ID, Order Date, Consignor, From, Consignee, Ship To Party, Destination, Weight
        const [plant, orderNo, custId, orderDate, cnr, from, cne, stp, dest, weight] = columns;
        const rowId = orderNo || `Row ${i + 2}`;
        let error = '';

        // 1. Mandatory Field Validation
        if (!plant) error = 'Plant Missing';
        else if (!orderNo) error = 'Sale Order Missing';
        else if (!custId) error = 'Customer ID Missing';
        else if (!orderDate) error = 'Order Date Missing';
        else if (!cnr) error = 'Consignor Missing';
        else if (!from) error = 'From Missing';
        else if (!cne) error = 'Consignee Missing';
        else if (!stp) error = 'Ship To Party Missing';
        else if (!dest) error = 'Destination Missing';
        else if (!weight || isNaN(parseFloat(weight))) error = 'Invalid Weight';

        // 2. Duplicate Validation (File & Database)
        if (!error) {
          if (fileOrderNos.has(orderNo)) error = 'Duplicate Sale Order in File';
          else if (fileCustomerIds.has(custId)) error = 'Duplicate Customer ID in File';
          else if (orders?.some(o => o.orderNo === orderNo)) error = 'Duplicate Sale Order';
          // (Assuming Customer ID is the unique identifier for the transaction context requested)
        }

        if (error) {
          tempLog.push({ status: 'failed', id: rowId, msg: `Failed – ${error}` });
        } else {
          fileOrderNos.add(orderNo);
          fileCustomerIds.add(custId);
          
          const docId = crypto.randomUUID();
          const payload = {
            id: docId,
            plantCode: plant,
            orderNo,
            customerCode: custId, // Mapping Customer ID to customerCode
            orderDate,
            consignorName: cnr,
            from,
            consigneeName: cne,
            shipToParty: stp,
            destination: dest,
            quantity: parseFloat(weight),
            status: 'Open',
            uom: 'MT',
            createdAt: new Date().toISOString(),
            updatedAt: serverTimestamp(),
            updatedBy: 'Sikkaind_Bulk_Upload'
          };

          setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), payload, { merge: true });
          tempLog.push({ status: 'success', id: rowId, msg: 'Successfully Saved' });
        }
      }

      setUploadLog(tempLog);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const validAndPaginated = React.useMemo(() => {
    const seen = new Set();
    const filtered = (orders || [])
      .filter(o => {
        if (seen.has(o.orderNo)) return false;
        seen.add(o.orderNo);
        const matchesSearch = !searchId || o.orderNo?.includes(searchId.toUpperCase());
        return matchesSearch;
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

  const filteredConsignors = React.useMemo(() => {
    if (!customers || !formData.plantCode) return [];
    return customers.filter(c => {
      const codes = c.plantCodes;
      const matchPlant = Array.isArray(codes) ? codes.includes(formData.plantCode) : codes === formData.plantCode;
      return matchPlant && c.customerType === 'Consignor';
    });
  }, [customers, formData.plantCode]);

  const filteredParties = React.useMemo(() => {
    if (!customers || !formData.plantCode) return [];
    return customers.filter(c => {
      const codes = c.plantCodes;
      return Array.isArray(codes) ? codes.includes(formData.plantCode) : codes === formData.plantCode;
    });
  }, [customers, formData.plantCode]);

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
        {uploadLog.length > 0 && (
          <div className="mb-10 bg-white border border-slate-300 shadow-lg animate-fade-in flex flex-col max-h-[400px]">
             <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#1e3a8a]">Bulk Processing Log</span>
                <button onClick={() => setUploadLog([])} className="text-slate-400 hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-1.5 bg-slate-900 text-slate-300 custom-scrollbar">
                {uploadLog.map((log, idx) => (
                  <div key={idx} className={cn("text-[10px] font-bold uppercase tracking-tight flex items-center gap-3", log.status === 'success' ? "text-emerald-400" : "text-red-400")}>
                    <span className="shrink-0">{log.status === 'success' ? '✔' : '✘'}</span>
                    <span className="w-40 shrink-0">Sale Order {log.id}</span>
                    <span className="flex-1 italic">— {log.msg}</span>
                  </div>
                ))}
             </div>
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
                      <th className="p-4 border-r">Sale Order</th>
                      <th className="p-4 border-r">Order Date</th>
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
                        <td className="p-4 border-r text-[#0056d2] font-black">{o.orderNo}</td>
                        <td className="p-4 border-r">{formatDateDisplay(o.orderDate)}</td>
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
          <div className="bg-white p-12 border border-slate-300 shadow-sm max-w-4xl mx-auto w-full animate-fade-in">
             <h3 className="text-red-600 font-black uppercase italic mb-8 border-b pb-4">Short Close Workflow</h3>
             <div className="space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-8">
                      <label className="text-[12px] font-bold text-slate-600 w-40 text-right uppercase">Sale Order No:</label>
                      <input value={formData.orderNo || ''} onChange={e => setFormData({...formData, orderNo: e.target.value.toUpperCase()})} className="h-9 w-80 border border-slate-400 px-3 text-[12px] font-black outline-none" placeholder="ENTER ORDER NO..." />
                  </div>
                </div>
                {formData.orderNo && (
                   <div className="p-8 bg-slate-50 border border-slate-200 animate-slide-up space-y-4">
                      <p className="text-[11px] font-black text-slate-500 uppercase italic">Execution Summary:</p>
                      <div className="grid grid-cols-2 gap-4 text-[12px] font-bold">
                         <div className="flex justify-between border-b border-slate-200 pb-2 uppercase"><span className="text-slate-400">Ship To Party:</span><span className="text-slate-800">{orders?.find(o => o.orderNo === formData.orderNo)?.shipToParty || '-'}</span></div>
                         <div className="flex justify-between border-b border-slate-200 pb-2 uppercase"><span className="text-slate-400">Balance:</span><span className="text-emerald-600">MT</span></div>
                      </div>
                   </div>
                )}
             </div>
          </div>
        ) : (
          <div className="animate-slide-up space-y-12 bg-white p-12 border border-slate-300 shadow-inner">
             <div className="grid grid-cols-2 gap-y-6 gap-x-24">
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Plant Code:</label>
                 <select value={formData.plantCode || ''} onChange={e => setFormData({...formData, plantCode: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border bg-white px-2 text-[12px] font-black outline-none", errors.includes('plantCode') ? "border-red-500 bg-red-50" : "border-slate-400")}>
                    <option value="">Select Plant...</option>
                    {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
                 </select>
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Sale Order No:</label>
                 <input value={formData.orderNo || ''} onChange={e => setFormData({...formData, orderNo: e.target.value.toUpperCase()})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('orderNo') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Consignor Name:</label>
                 <SAPAutocomplete value={formData.consignorName || ''} disabled={isReadOnly} options={filteredConsignors} onSelect={val => { const c = customers?.find(x => x.customerName === val); setFormData({...formData, consignorName: val, consignorCode: c?.customerCode || '', from: c?.city || ''}); }} hasError={errors.includes('consignorName')} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Order Date:</label>
                 <input type="date" value={formData.orderDate || ''} onChange={e => setFormData({...formData, orderDate: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('orderDate') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Consignee Name:</label>
                 <SAPAutocomplete value={formData.consigneeName || ''} disabled={isReadOnly} options={filteredParties} onSelect={val => { const c = customers?.find(x => x.customerName === val); setFormData({...formData, consigneeName: val, consigneeCode: c?.customerCode || ''}); }} hasError={errors.includes('consigneeName')} />
               </div>
               <div className="flex items-center gap-8 italic">
                 <label className="text-[12px] font-bold text-slate-400 w-48 text-right uppercase">From (Auto-Fill):</label>
                 <input value={formData.from || ''} readOnly className="h-8 w-80 border border-slate-300 bg-slate-50 px-2 text-[12px] font-black" />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Ship to Party:</label>
                 <SAPAutocomplete value={formData.shipToParty || ''} disabled={isReadOnly} options={filteredParties} onSelect={val => { const c = customers?.find(x => x.customerName === val); setFormData({...formData, shipToParty: val, shipToPartyCode: c?.customerCode || '', destination: c?.city || ''}); }} hasError={errors.includes('shipToParty')} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Weight (MT):</label>
                 <input type="number" step="0.001" value={formData.quantity || ''} onChange={e => setFormData({...formData, quantity: e.target.value})} disabled={isReadOnly} className={cn("h-8 w-80 border px-2 text-[12px] font-black outline-none", errors.includes('quantity') ? "border-red-500 bg-red-50" : "border-slate-400")} />
               </div>
               <div className="flex items-center gap-8">
                 <label className="text-[12px] font-bold text-slate-600 w-48 text-right uppercase">Material Name:</label>
                 <input value={formData.materialName || ''} onChange={e => setFormData({...formData, materialName: e.target.value.toUpperCase()})} disabled={isReadOnly} className="h-8 w-80 border border-slate-400 px-2 text-[12px] font-black outline-none" />
               </div>
               <div className="flex items-center gap-8 italic">
                 <label className="text-[12px] font-bold text-slate-400 w-48 text-right uppercase">Destination:</label>
                 <input value={formData.destination || ''} readOnly className="h-8 w-80 border border-slate-300 bg-slate-50 px-2 text-[12px] font-black" />
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
