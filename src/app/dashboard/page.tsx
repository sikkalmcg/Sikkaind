'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Printer, Save, X, Info, LogOut,
  ChevronRight, ChevronLeft, Truck, MapPin, User, Users, ShoppingBag,
  Grid2X2, ShieldAlert, Edit3, 
  PlusSquare, XCircle, Calendar as CalendarIcon, Package, Undo2,
  FileText, UploadCloud, Trash2, Plus, Search,
  AlertTriangle, Clock, FileCheck, Eye, EyeOff, Download,
  Loader2, Radar, PlayCircle, ShoppingCart, CheckCircle, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import placeholderData from '@/app/lib/placeholder-images.json';

const MASTER_TCODES = [
  { code: 'OX01', description: 'PLANT MASTER: CREATE', icon: Package, module: 'Master Data' },
  { code: 'OX02', description: 'PLANT MASTER: CHANGE', icon: Edit3, module: 'Master Data' },
  { code: 'OX03', description: 'PLANT MASTER: DISPLAY', icon: Info, module: 'Master Data' },
  { code: 'FM01', description: 'COMPANY MASTER: CREATE', icon: Grid2X2, module: 'Master Data' },
  { code: 'FM02', description: 'COMPANY MASTER: CHANGE', icon: Edit3, module: 'Master Data' },
  { code: 'FM03', description: 'COMPANY MASTER: DISPLAY', icon: Info, module: 'Master Data' },
  { code: 'XK01', description: 'VENDOR MASTER: CREATE', icon: User, module: 'Master Data' },
  { code: 'XK02', description: 'VENDOR MASTER: CHANGE', icon: Edit3, module: 'Master Data' },
  { code: 'XK03', description: 'VENDOR MASTER: DISPLAY', icon: Info, module: 'Master Data' },
  { code: 'XD01', description: 'CUSTOMER MASTER: CREATE', icon: Users, module: 'Master Data' },
  { code: 'XD02', description: 'CUSTOMER MASTER: CHANGE', icon: Edit3, module: 'Master Data' },
  { code: 'XD03', description: 'CUSTOMER MASTER: DISPLAY', icon: Info, module: 'Master Data' },
  { code: 'VA01', description: 'SALES ORDER: CREATE', icon: ShoppingBag, module: 'Logistics' },
  { code: 'VA02', description: 'SALES ORDER: CHANGE', icon: Edit3, module: 'Logistics' },
  { code: 'VA03', description: 'SALES ORDER: DISPLAY', icon: Info, module: 'Logistics' },
  { code: 'VA04', description: 'CANCEL SALES ORDER', icon: XCircle, module: 'Logistics' },
  { code: 'TR21', description: 'TRIP BOARD CONTROL', icon: Truck, module: 'Logistics' },
  { code: 'TR24', description: 'TRACK SHIPMENT', icon: Radar, module: 'Logistics' },
  { code: 'WGPS24', description: 'GPS TRACKING HUB', icon: Radar, module: 'Logistics' },
  { code: 'SE38', description: 'CUSTOM REPORT EXECUTION', icon: FileText, module: 'System' },
  { code: 'SU01', description: 'USER MANAGEMENT: CREATE', icon: ShieldAlert, module: 'System' },
  { code: 'SU02', description: 'USER MANAGEMENT: CHANGE', icon: Edit3, module: 'System' },
  { code: 'SU03', description: 'USER MANAGEMENT: DISPLAY', icon: Info, module: 'System' },
  { code: 'ZCODE', description: 'SYSTEM: ALL ACTIVE T-CODES', icon: Grid2X2, module: 'System' },
];

const SHARED_HUB_ID = 'Sikkaind'; 

// --- SHARED COMPONENTS ---

function SectionGrouping({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="mb-10 w-full animate-fade-in">
      {title && (
        <div className="flex items-center gap-6 mb-6">
          <span className="text-[13px] font-black text-slate-800 min-w-[120px] uppercase tracking-widest">{title}</span>
          <div className="h-px bg-slate-300 flex-1" />
        </div>
      )}
      <div className="space-y-4 pl-12">
        {children}
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text", disabled, placeholder, rightElement, leftElement }: any) {
  return (
    <div className="flex items-center gap-8 group">
      <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">{label}:</label>
      <div className="relative w-[320px]">
        {leftElement && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            {leftElement}
          </div>
        )}
        <input 
          type={type} 
          value={value || ''} 
          onChange={(e: any) => onChange(e.target.value)} 
          disabled={disabled} 
          placeholder={placeholder} 
          className={cn(
            "h-8 w-full border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm disabled:opacity-60",
            leftElement && "pl-10"
          )} 
        />
        {rightElement && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
    </div>
  );
}

function FormSelect({ label, value, options, onChange, disabled, placeholder }: any) {
  return (
    <div className="flex items-center gap-8 group">
      <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">{label}:</label>
      <select 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        disabled={disabled} 
        className="h-8 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm disabled:opacity-60"
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((o: any, idx: number) => {
          const v = typeof o === 'string' ? o : o.value; 
          const l = typeof o === 'string' ? o : o.label;
          return <option key={`${v}-${idx}`} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}

function FormSearchInput({ label, value, options, onChange, disabled, placeholder }: any) {
  const [inputValue, setInputValue] = React.useState(value || '');
  const [isOpen, setIsOpen] = React.useState(false);
  
  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return [];
    return options.filter((o: string) => o?.toUpperCase().includes(inputValue.toUpperCase())).slice(0, 10);
  }, [options, inputValue]);

  React.useEffect(() => { setInputValue(value || ''); }, [value]);

  const handleSelect = (val: string) => {
    const cleanName = val.includes(' - ') ? val.split(' - ').slice(0, -1).join(' - ') : val;
    setInputValue(cleanName);
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-8 group relative">
      <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">{label}:</label>
      <div className="relative w-[320px]">
        <input 
          value={inputValue} 
          onChange={(e) => { setInputValue(e.target.value); onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 250)}
          disabled={disabled} 
          placeholder={placeholder} 
          className="h-8 w-full border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm" 
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Search className="h-3 w-3 text-slate-400" />
        </div>
      </div>
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute top-full left-[212px] w-[320px] bg-white border border-slate-300 shadow-2xl z-[110] mt-1 max-h-[250px] overflow-y-auto">
          {filteredOptions.map((opt: string, idx: number) => (
            <div key={idx} onMouseDown={() => handleSelect(opt)} className="px-4 py-2 text-[11px] font-black cursor-pointer hover:bg-[#e8f0fe] border-b border-slate-50 last:border-0">{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- MASTER FORMS ---

function PlantForm({ data, onChange, disabled }: any) {
  return (
    <div className="space-y-10">
      <SectionGrouping title="PRIMARY DATA">
        <FormInput label="PLANT CODE" value={data.plantCode} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
        <FormInput label="PLANT NAME" value={data.plantName} onChange={(v: string) => onChange({...data, plantName: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="LOCATION DATA">
        <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
        <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
        <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
        <FormInput label="STATE" value={data.state} onChange={(v: string) => onChange({...data, state: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function CompanyForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { 
    if (disabled) return; 
    const curr = data.plantCodes || []; 
    onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); 
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("Logo file size must be under 500KB");
      e.target.value = ''; 
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ ...data, logo: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-10">
      <SectionGrouping title="PLANT ASSIGNMENT">
        <div className="flex items-center gap-8">
          <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Assigned Plants:</label>
          <div className="flex wrap gap-2">
            {pList.map((p: string) => (
              <button 
                key={p} 
                onClick={() => handleToggle(p)} 
                disabled={disabled} 
                className={cn(
                  "px-4 py-1.5 text-[10px] font-black border uppercase rounded-none transition-all", 
                  data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </SectionGrouping>
      <SectionGrouping title="IDENTIFICATION">
        <FormInput label="COMPANY CODE" value={data.companyCode} onChange={(v: string) => onChange({...data, companyCode: v})} disabled={disabled} />
        <FormInput label="COMPANY NAME" value={data.companyName} onChange={(v: string) => onChange({...data, companyName: v})} disabled={disabled} />
        <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
        <FormInput label="PAN" value={data.pan} onChange={(v: string) => onChange({...data, pan: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="LOCATION">
        <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
        <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="CONTACT DETAILS">
        <FormInput label="MOBILE" placeholder="Numbers separated by comma" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
        <FormInput label="EMAIL" value={data.email} onChange={(v: string) => onChange({...data, email: v})} disabled={disabled} />
        <FormInput label="WEBSITE" value={data.website} onChange={(v: string) => onChange({...data, website: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="CORPORATE ASSETS">
        <div className="flex items-center gap-8">
          <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">LOGO (MAX 500KB):</label>
          <div className="flex items-center gap-4 w-[320px]">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleLogoChange} 
              disabled={disabled}
              className="text-[10px] font-black uppercase text-slate-500 w-full cursor-pointer file:mr-4 file:py-1 file:px-4 file:rounded-none file:border file:border-slate-300 file:text-[10px] file:font-black file:bg-slate-50 hover:file:bg-slate-100"
            />
            {data.logo && (
              <div className="relative w-12 h-12 border border-slate-300 shrink-0 overflow-hidden bg-white">
                <img src={data.logo} alt="Logo Preview" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
        </div>
      </SectionGrouping>
      <SectionGrouping title="TERMS AND CONDITIONS">
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <FormInput 
              key={i}
              label={`CONDITION ${i + 1}`} 
              value={data.termsAndConditions?.[i] || ''} 
              onChange={(v: string) => {
                const newTerms = [...(data.termsAndConditions || [])];
                while (newTerms.length <= i) newTerms.push('');
                newTerms[i] = v;
                onChange({...data, termsAndConditions: newTerms});
              }} 
              disabled={disabled} 
            />
          ))}
        </div>
      </SectionGrouping>
    </div>
  );
}

function VendorForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  return (
    <div className="space-y-10">
      <SectionGrouping title="PLANT MAPPING">
        <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Assigned Plants:</label><div className="flex wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none transition-all", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{p}</button>)}</div></div>
      </SectionGrouping>
      <SectionGrouping title="IDENTIFICATION">
        <FormInput label="VENDOR NAME" value={data.vendorName} onChange={(v: string) => onChange({...data, vendorName: v})} disabled={disabled} />
        <FormInput label="VENDOR FIRM" value={data.vendorFirmName} onChange={(v: string) => onChange({...data, vendorFirmName: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="DETAILS">
        <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
        <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
        <FormInput label="SPECIAL ROUTE" value={data.route} onChange={(v: string) => onChange({...data, route: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function CustomerForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  return (
    <div className="space-y-10">
      <SectionGrouping title="PLANT">
        <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Assigned Plants:</label><div className="flex wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none transition-all", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{p}</button>)}</div></div>
      </SectionGrouping>
      <SectionGrouping title="IDENTIFICATION">
        <FormInput label="CUSTOMER CODE" value={data.customerCode} onChange={(v: string) => onChange({...data, customerCode: v})} disabled={disabled} />
        <FormInput label="CUSTOMER NAME" value={data.customerName} onChange={(v: string) => onChange({...data, customerName: v})} disabled={disabled} />
        <FormSelect label="CUSTOMER TYPE" value={data.customerType} options={["Consignor", "Consignee - Ship to Party"]} onChange={(v: string) => onChange({...data, customerType: v})} disabled={disabled} />
        <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="LOCATION">
        <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
        <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
        <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
        <FormInput label="MOBILE NO." value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} leftElement={<span className="text-[12px] font-black text-slate-400">+91</span>} />
      </SectionGrouping>
    </div>
  );
}

function SalesOrderForm({ data, onChange, disabled, allPlants, allCustomers, trips, screen }: any) {
  const pOpts = (allPlants || []).map((p: any) => p.plantCode);
  const filtered = (allCustomers || []).filter((c: any) => c.plantCodes?.includes(data.plantCode));
  const cons = filtered.filter((c: any) => c.customerType === 'Consignor');
  const ships = filtered.filter((c: any) => c.customerType === 'Consignee - Ship to Party');
  return (
    <div className="space-y-10">
      <SectionGrouping title="HEADER">
        <FormSelect label="PLANT" value={data.plantCode} options={pOpts} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
        <FormInput label="SALE ORDER" value={data.saleOrder} onChange={(v: string) => onChange({...data, saleOrder: v})} disabled={disabled} />
        <FormInput label="BOOKED DATE TIME" type="datetime-local" value={data.saleOrderDate} onChange={(v: string) => onChange({...data, saleOrderDate: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="COORDINATION">
        <FormSearchInput label="CONSIGNOR" value={data.consignor} options={cons.map(c => c.customerName + ' - ' + c.city)} onChange={(v: string) => { const matching = cons.find(c => (c.customerName + ' - ' + c.city).toUpperCase() === v?.toUpperCase()); const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v; onChange({...data, consignor: nameOnly, from: matching?.city || ''}); }} disabled={disabled} />
        <FormInput label="FROM" value={data.from} disabled={true} />
        <FormSearchInput label="CONSIGNEE" value={data.consignee} options={ships.map(c => c.customerName + ' - ' + c.city)} onChange={(v: string) => { const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v; onChange({...data, consignee: nameOnly}); }} disabled={disabled} />
        <FormSearchInput label="SHIP TO PARTY" value={data.shipToParty} options={ships.map(c => c.customerName + ' - ' + c.city)} onChange={(v: string) => { const matching = ships.find(c => (c.customerName + ' - ' + c.city).toUpperCase() === v?.toUpperCase()); const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v; onChange({...data, shipToParty: nameOnly, destination: matching?.city || '', deliveryAddress: matching?.address || ''}); }} disabled={disabled} />
        <FormInput label="DESTINATION" value={data.destination} disabled={true} />
        <FormInput label="SALE ORDER WEIGHT" type="number" value={data.weight} onChange={(v: string) => onChange({...data, weight: v})} disabled={disabled} />
        <FormSelect label="UOM" value={data.weightUom} options={["MT", "LTR"]} onChange={(v: string) => onChange({...data, weightUom: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function UserForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handlePToggle = (p: string) => { if (disabled) return; const curr = data.plants || []; onChange({...data, plants: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  const handleTToggle = (c: string) => { if (disabled) return; const curr = data.tcodes || []; onChange({...data, tcodes: curr.includes(c) ? curr.filter((i: string) => i !== c) : [...curr, c]}); };
  return (
    <div className="space-y-12">
      <SectionGrouping title="USER IDENTIFICATION">
        <FormInput label="FULL NAME" value={data.fullName} onChange={(v: string) => onChange({...data, fullName: v})} disabled={disabled} />
        <FormInput label="USERNAME" value={data.username} onChange={(v: string) => onChange({...data, username: v})} disabled={disabled} />
        <FormInput label="PASSWORD" type="password" value={data.password} onChange={(v: string) => onChange({...data, password: v})} disabled={disabled} />
        <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="PLANT ACCESS">
        <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Authorized Plants:</label><div className="flex wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handlePToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none", data.plants?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{p}</button>)}</div></div>
      </SectionGrouping>
      <SectionGrouping title="TRANSACTION ACCESS">
        <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">T-Code Registry:</label><div className="flex wrap gap-2">{MASTER_TCODES.map(t => <button key={t.code} onClick={() => handleTToggle(t.code)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none", data.tcodes?.includes(t.code) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{t.code}</button>)}</div></div>
      </SectionGrouping>
    </div>
  );
}

function CancelOrderForm({ data, onChange, allOrders, allTrips, onPost, onCancel }: any) {
  const stats = React.useMemo(() => { if (!data.id || !allTrips) return { tot: 0, ass: 0, bal: 0, uom: '' }; const tot = parseFloat(data.weight) || 0; const ass = allTrips.filter((t: any) => t.saleOrderId === data.id).reduce((acc: number, t: any) => acc + (parseFloat(t.assignWeight) || 0), 0); return { tot, ass, bal: tot - ass, uom: data.weightUom || 'MT' }; }, [data, allTrips]);
  const handleEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { const o = allOrders?.find((ord: any) => (ord.saleOrder || ord.id).toString().toUpperCase() === data.saleOrder?.toString().toUpperCase()); if (o) onChange({ ...data, ...o }); } };
  return (
    <div className="space-y-12">
      <SectionGrouping title="CANCELLATION / SHORT CLOSE">
        <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-red-600 w-[180px] text-right shrink-0 uppercase">Order Number:</label><input className="h-10 w-[320px] border border-red-200 px-3 text-[12px] font-black outline-none bg-red-50/20" value={data.saleOrder || ''} onChange={e => onChange({ ...data, saleOrder: e.target.value.toUpperCase() })} onKeyDown={handleEnter} /></div>
      </SectionGrouping>
      {data.id && (
        <div className="space-y-6 animate-fade-in">
          <SectionGrouping title="ORDER REGISTRY DATA">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4">
              <FormInput label="PLANT" value={data.plantCode} disabled={true} />
              <FormInput label="CONSIGNOR" value={data.consignor} disabled={true} />
              <FormInput label="SALE ORDER QTY" value={`${stats.tot} ${stats.uom}`} disabled={true} />
              <FormInput label="BALANCE QTY" value={`${stats.bal.toFixed(2)} ${stats.uom}`} disabled={true} />
            </div>
          </SectionGrouping>
          <div className="pl-[212px] flex gap-4">
            <Button onClick={onCancel} variant="outline" className="h-10 px-8 text-[10px] font-black uppercase">Exit</Button>
            <Button onClick={onPost} disabled={stats.bal <= 0} className={cn("font-black uppercase text-[10px] px-10 h-10", stats.bal <= 0 ? "bg-slate-400" : "bg-red-600 text-white")}>{stats.ass === 0 ? "Execute Cancellation" : "Execute Short Close"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- LOGISTICAL MODULES ---

function TripBoard({ 
  orders, trips, vendors, plants, companies, customers, onStatusUpdate, 
  viewMode, setViewMode, trackingNode, setTrackingNode, settings,
  onOpenPdfPreview
}: any) {
  const db = useFirestore(); 
  const [activeTab, setActiveTab] = React.useState('Open Orders'); 
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null); 
  const [isPopupOpen, setIsPopupOpen] = React.useState(false); 
  const [assignData, setAssignData] = React.useState<any>({ fleetType: 'Own Vehicle', isFixedRate: false, rate: 0, freightAmount: 0 }); 
  const [searchQuery, setSearchQuery] = React.useState(''); 
  const [fromDate, setFromDate] = React.useState(format(subDays(new Date(), 4), 'yyyy-MM-dd')); 
  const [toDate, setToDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [isOutPopupOpen, setIsOutPopupOpen] = React.useState(false); 
  const [outData, setOutData] = React.useState<any>({});
  const [isArrivedPopupOpen, setIsArrivedPopupOpen] = React.useState(false); 
  const [arrivedData, setArrivedData] = React.useState<any>({});
  const [isRejectPopupOpen, setIsRejectPopupOpen] = React.useState(false); 
  const [rejectData, setRejectData] = React.useState<any>({});
  const [isUnloadPopupOpen, setIsUnloadPopupOpen] = React.useState(false); 
  const [unloadData, setUnloadData] = React.useState<any>({});
  const [isPodPopupOpen, setIsPodPopupOpen] = React.useState(false); 
  const [selectedTripForPod, setSelectedTripForPod] = React.useState<any>(null); 
  const [podFile, setPodFile] = React.useState<string | null>(null);
  const [isCnPopupOpen, setIsCnPopupOpen] = React.useState(false); 
  const [selectedTripForCn, setSelectedTripForCn] = React.useState<any>(null); 
  const [cnFormData, setCnFormData] = React.useState<any>({ paymentTerms: 'Paid', items: [{ invoice: '', ewaybill: '', description: '', package: '', uom: 'BAG' }] });
  const [isUnassignDialogOpen, setIsUnassignDialogOpen] = React.useState(false);
  const [tripToUnassign, setTripToUnassign] = React.useState<any>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePodFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (ev) => { setPodFile(ev.target?.result as string); }; reader.readAsDataURL(file);
  };

  const getStatsLocal = React.useCallback((o: any) => { const tot = parseFloat(o.weight) || 0; const ass = trips?.filter((t: any) => t.saleOrderId === o.id).reduce((a: number, t: any) => a + (parseFloat(t.assignWeight) || 0), 0) || 0; return { tot, ass, bal: tot - ass, uom: o.weightUom || 'MT' }; }, [trips]);
  
  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];
  
  const fOrders = React.useMemo(() => (orders || []).filter((o: any) => o.status !== 'CANCELLED' && o.status !== 'Short closed').map((o: any) => ({ ...o, ...getStatsLocal(o), route: `${o.from} → ${o.destination}` })).filter((o: any) => o.bal > 0 && isWithinInterval(new Date(o.createdAt), { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) })), [orders, getStatsLocal, fromDate, toDate]);
  
  const fTrips = React.useMemo(() => { 
    if (!trips) return []; 
    const map: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' }; 
    return trips.filter((t: any) => t.status === map[activeTab] && isWithinInterval(new Date(t.createdAt), { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) })); 
  }, [trips, activeTab, fromDate, toDate]);

  const getCountForTab = (tab: string) => {
    if (tab === 'Open Orders') return fOrders.length;
    const map: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
    return trips?.filter((t: any) => t.status === map[tab] && isWithinInterval(new Date(t.createdAt), { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) })).length || 0;
  };

  const filteredData = searchQuery ? (activeTab === 'Open Orders' ? fOrders : fTrips).filter((item: any) => Object.values(item).some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()))) : (activeTab === 'Open Orders' ? fOrders : fTrips);

  const handleAssign = (o: any) => { 
    setSelectedOrder(o); 
    setAssignData({ 
      plantCode: o.plantCode, 
      shipToParty: o.shipToParty, 
      route: `${o.from} → ${o.destination}`, 
      fleetType: 'Own Vehicle', 
      assignWeight: o.bal, 
      isFixedRate: false, 
      rate: 0, 
      freightAmount: 0, 
      assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") 
    }); 
    setIsPopupOpen(true); 
  };

  const handleCreateTrip = () => { 
    if (!assignData.vehicleNumber) { onStatusUpdate({ text: 'Error: Vehicle No Required', type: 'error' }); return; } 
    const tid = `T${Math.floor(100000000 + Math.random() * 900000000)}`; 
    const docId = crypto.randomUUID(); 
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', docId), { ...assignData, id: docId, tripId: tid, saleOrderId: selectedOrder.id, saleOrderNumber: selectedOrder.saleOrder, status: 'LOADING', createdAt: new Date().toISOString() }, { merge: true }); 
    setIsPopupOpen(false); 
    onStatusUpdate({ text: `Trip ${tid} Created`, type: 'success' }); 
  };

  const handleOutVehicle = (t: any) => { 
    if (!t.cnNo) { onStatusUpdate({ text: 'CN Number required before Out process.', type: 'error' }); return; }
    setOutData({ trip: t, date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') }); 
    setIsOutPopupOpen(true); 
  };

  const handleOutPost = () => {
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', outData.trip.id), { status: 'IN-TRANSIT', outDate: outData.date, outTime: outData.time, updatedAt: new Date().toISOString() }, { merge: true });
    setIsOutPopupOpen(false);
    onStatusUpdate({ text: 'Vehicle Dispatched (In-Transit)', type: 'success' });
  };

  const handleArrivedAction = (t: any) => { setArrivedData({ ...t, date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') }); setIsArrivedPopupOpen(true); };
  const handleUnloadAction = (t: any) => { setUnloadData({ trip: t, date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') }); setIsUnloadPopupOpen(true); };
  const handleRejectAction = (t: any) => { setRejectData({ trip: t, date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), remark: '' }); setIsRejectPopupOpen(true); };
  
  const handleAddCn = (t: any) => { 
    setSelectedTripForCn(t); 
    if (t.cnNo) {
      setCnFormData({ 
        cnNo: t.cnNo || '', 
        cnDate: t.cnDate || format(new Date(), 'yyyy-MM-dd'), 
        paymentTerms: t.paymentTerms || 'Paid',
        items: t.cnItems || [{ invoice: '', ewaybill: '', description: '', package: '', uom: 'BAG' }] 
      }); 
    } else {
      setCnFormData({ 
        cnNo: '', 
        cnDate: format(new Date(), 'yyyy-MM-dd'), 
        paymentTerms: 'Paid',
        items: [{ invoice: '', ewaybill: '', description: '', package: '', uom: 'BAG' }] 
      });
    }
    setIsCnPopupOpen(true); 
  };

  const handleCnPost = () => { 
    if (!cnFormData.cnNo) { onStatusUpdate({ text: 'Error: CN Number Required', type: 'error' }); return; }
    const isDuplicate = trips.some((t: any) => t.cnNo?.toUpperCase() === cnFormData.cnNo.toUpperCase() && t.id !== selectedTripForCn.id);
    if (isDuplicate) { onStatusUpdate({ text: 'Duplicate CN Number is not allowed.', type: 'error' }); return; }
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForCn.id), { 
      cnNo: cnFormData.cnNo.toUpperCase(), 
      cnDate: cnFormData.cnDate, 
      paymentTerms: cnFormData.paymentTerms,
      cnItems: cnFormData.items, 
      updatedAt: new Date().toISOString() 
    }, { merge: true }); 
    setIsCnPopupOpen(false); 
    onStatusUpdate({ text: cnFormData.cnNo ? 'CN Registry Updated' : 'CN Registered', type: 'success' }); 
  };

  const handleConfirmUnassign = () => {
    if (tripToUnassign) {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', tripToUnassign.id));
      setIsUnassignDialogOpen(false);
      onStatusUpdate({ text: 'Trip Assignment Cancelled', type: 'success' });
    }
  };

  const handleCnClick = (t: any) => {
    const order = (orders || []).find((o: any) => o.id === t.saleOrderId);
    const carrier = (companies || []).find((c: any) => c.plantCodes?.includes(t.plantCode));
    const findCust = (name: string) => (customers || []).find((c: any) => c.customerName?.toUpperCase() === name?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === name?.toUpperCase());
    const previewData = { ...t, order, carrier, consignorMaster: findCust(order?.consignor), consigneeMaster: findCust(order?.consignee), shipToMaster: findCust(order?.shipToParty) };
    onOpenPdfPreview(previewData);
  };

  return (
    <div className="flex flex-col h-full space-y-0">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-4 print:hidden flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800 uppercase">TRIP BOARD CONTROL</h2>
        <div className="flex items-center gap-6">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Entries: {filteredData.length}</div>
          <div className="flex gap-4">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 border border-slate-300 px-2 text-[10px] font-black" />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 border border-slate-300 px-2 text-[10px] font-black" />
          </div>
        </div>
      </div>
      <div className="px-8 space-y-4 flex-1 overflow-hidden flex flex-col">
        <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 print:hidden">
          {TABS.map(t => {
            const count = getCountForTab(t);
            return (
              <button key={t} onClick={() => setActiveTab(t)} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border-r border-slate-300 transition-all", activeTab === t ? "bg-white text-[#0056d2] shadow-sm" : "text-slate-500 hover:bg-white/50")}>
                {t} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-auto bg-white border border-slate-300">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[#f0f0f0] text-[9px] font-black uppercase sticky top-0 z-10 border-b border-slate-300">
                {activeTab === 'Open Orders' ? [
                  'Plant', 'Sale Order / Date Time', 'Consignor', 'Consignee', 'Ship to Party', 'Route', 'Order Qty', 'Assign Qty', 'Balance Qty', 'Action'
                ].map(h => (
                  <th key={h} className="p-3 border-r border-slate-200">
                    <div>{h.split(' / ')[0]}</div>
                    {h.includes(' / ') && <div>{h.split(' / ')[1]}</div>}
                  </th>
                )) : [
                  'Plant', 'Trip ID / Date Time', 'Sale Order / Date Time', 'Ship to Party', 'Route', 'Vehicle No / Driver Mobile', 'Vendor Name / ARRANGE BY', 'Assign Qty', 'CN Number', 'Action'
                ].map(h => (
                  <th key={h} className="p-3 border-r border-slate-200">
                    <div>{h.split(' / ')[0]}</div>
                    {h.includes(' / ') && <div>{h.split(' / ')[1]}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{filteredData.map((item: any) => {
              if (activeTab === 'Open Orders') {
                return <tr key={item.id} className="border-b border-slate-100 text-[11px] font-bold"><td className="p-3">{item.plantCode}</td><td className="p-3"><div className="text-[#0056d2] font-black">{item.saleOrder}</div><div className="text-slate-400">{format(new Date(item.saleOrderDate || item.createdAt), 'dd-MM-yy HH:mm')}</div></td><td className="p-3 uppercase">{item.consignor}</td><td className="p-3 uppercase">{item.consignee}</td><td className="p-3 uppercase">{item.shipToParty}</td><td className="p-3 uppercase">{item.route}</td><td className="p-3">{item.tot} {item.uom}</td><td className="p-3 text-emerald-600">{item.ass} {item.uom}</td><td className="p-3 text-red-600">{item.bal} {item.uom}</td><td className="p-3"><Button onClick={() => handleAssign(item)} size="sm" className="bg-[#0056d2] text-white text-[9px] font-black uppercase h-7 rounded-none">Assign</Button></td></tr>;
              } else {
                return <tr key={item.id} className="border-b border-slate-100 text-[11px] font-bold"><td className="p-3">{item.plantCode}</td><td className="p-3"><div className="text-[#0056d2] font-black">{item.tripId}</div><div className="text-slate-400">{format(new Date(item.createdAt), 'dd-MM-yy HH:mm')}</div></td><td className="p-3"><div>{item.saleOrderNumber}</div><div className="text-slate-400">{format(new Date(item.saleOrderDate || item.createdAt), 'dd-MM-yy HH:mm')}</div></td><td className="p-3 uppercase">{item.shipToParty}</td><td className="p-3 uppercase">{item.route}</td><td className="p-3"><div>{item.vehicleNumber}</div><div className="text-slate-500">{item.driverMobile}</div></td><td className="p-3"><div>{item.vendorName || '-'}</div><div className="text-slate-500 uppercase">{item.arrangeBy || '-'}</div></td><td className="p-3 text-emerald-600">{item.assignWeight} {item.weightUom}</td><td className="p-3"><button onClick={() => handleCnClick(item)} className="font-black text-[#0056d2] uppercase hover:underline">{item.cnNo || '-'}</button></td><td className="p-3"><div className="flex gap-2">
                  {activeTab === 'Loading' && <>
                    <Button onClick={() => handleOutVehicle(item)} size="sm" className="bg-emerald-600 text-white text-[9px] font-black h-7 rounded-none uppercase">Out</Button>
                    <Button onClick={() => { setTripToUnassign(item); setIsUnassignDialogOpen(true); }} size="sm" className="bg-red-600 text-white text-[9px] font-black h-7 rounded-none uppercase">Unassign</Button>
                    <Button onClick={() => handleAddCn(item)} size="sm" className="bg-blue-900 text-white text-[9px] font-black h-7 rounded-none uppercase">{item.cnNo ? 'CN Edit' : 'CN Entry'}</Button>
                  </>}
                  {activeTab === 'In-Transit' && <Button onClick={() => handleArrivedAction(item)} size="sm" className="bg-[#0056d2] text-white text-[9px] font-black h-7 rounded-none uppercase">Arrived</Button>}
                  {activeTab === 'Arrived' && <><Button onClick={() => handleUnloadAction(item)} size="sm" className="bg-emerald-600 text-white text-[9px] font-black h-7 rounded-none uppercase">Unload</Button><Button onClick={() => handleRejectAction(item)} size="sm" className="bg-red-600 text-white text-[9px] font-black h-7 rounded-none uppercase">Reject</Button></>}
                </div></td></tr>;
              }
            })}</tbody>
          </table>
        </div>
      </div>

      <Dialog open={isUnassignDialogOpen} onOpenChange={setIsUnassignDialogOpen}>
        <DialogContent className="max-w-[400px] p-0 rounded-none border-none">
          <DialogHeader className="bg-red-600 px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase">Confirmation Required</DialogTitle></DialogHeader>
          <div className="p-8 text-center space-y-6">
            <p className="text-[12px] font-bold uppercase text-slate-700">Do you want to cancel this trip assignment?</p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => setIsUnassignDialogOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase">Cancel</Button>
              <Button onClick={handleConfirmUnassign} className="h-9 px-6 bg-red-600 text-white rounded-none text-[10px] font-black uppercase">Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
        <DialogContent className="max-w-[1000px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
          <DialogHeader className="bg-[#1e3a8a] px-6 py-4"><DialogTitle className="text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-between w-full"><span>Assign Vehicle Portal</span><div className="flex gap-6 pr-8"><span className="opacity-70">SO: {selectedOrder?.saleOrder}</span><span className="opacity-70">Qty: {selectedOrder?.tot} {selectedOrder?.uom}</span></div></DialogTitle></DialogHeader>
          <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-2 gap-4 mb-4 bg-white p-4 border border-slate-200 shadow-sm"><div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase">Consignee</span><span className="text-[11px] font-black uppercase text-slate-700">{selectedOrder?.consignee}</span></div><div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase">Ship To Party</span><span className="text-[11px] font-black uppercase text-slate-700">{selectedOrder?.shipToParty}</span></div><div className="flex flex-col gap-1 col-span-2"><span className="text-[9px] font-black text-slate-400 uppercase">Route</span><span className="text-[11px] font-black uppercase text-blue-600">{selectedOrder?.route}</span></div></div>
            <SectionGrouping title="ASSIGNMENT DETAILS"><div className="grid grid-cols-2 gap-x-12 gap-y-4"><FormInput label="VEHICLE NO" value={assignData.vehicleNumber} onChange={(v: string) => setAssignData({...assignData, vehicleNumber: v.toUpperCase()})} /><FormInput label="DRIVER MOBILE" value={assignData.driverMobile} onChange={(v: string) => setAssignData({...assignData, driverMobile: v})} /><FormInput label="ASSIGN DATE TIME" type="datetime-local" value={assignData.assignDate} onChange={(v: string) => setAssignData({...assignData, assignDate: v})} /><FormSelect label="FLEET TYPE" value={assignData.fleetType} options={["Own Vehicle", "Contract Vehicle", "Market Vehicle"]} onChange={(v: string) => setAssignData({...assignData, fleetType: v})} /><FormInput label="ASSIGN QTY" type="number" value={assignData.assignWeight} onChange={(v: string) => setAssignData({...assignData, assignWeight: v})} /></div></SectionGrouping>
            {assignData.fleetType === 'Market Vehicle' && (
              <SectionGrouping title="MARKET VENDOR REGISTRY"><div className="grid grid-cols-2 gap-x-12 gap-y-4"><FormSearchInput label="VENDOR NAME" value={assignData.vendorName} options={(vendors || []).map((v: any) => v.vendorName)} onChange={(v: string) => { const master = (vendors || []).find((ven: any) => ven.vendorName === v); setAssignData({...assignData, vendorName: v, vendorMobile: master?.mobile || ''}); }} /><FormInput label="VENDOR MOBILE" value={assignData.vendorMobile} disabled={true} /><FormInput label="ARRANGE BY" value={assignData.arrangeBy} onChange={(v: string) => setAssignData({...assignData, arrangeBy: v.toUpperCase()})} /><FormInput label="RATE" type="number" value={assignData.rate} disabled={assignData.isFixedRate} onChange={(v: string) => { const r = parseFloat(v) || 0; const q = parseFloat(assignData.assignWeight) || 0; setAssignData({...assignData, rate: r, freightAmount: r * q}); }} /><FormInput label="FREIGHT AMOUNT" type="number" value={assignData.freightAmount} disabled={!assignData.isFixedRate} onChange={(v: string) => setAssignData({...assignData, freightAmount: v})} /><div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">FIX RATE:</label><div className="flex items-center gap-2"><Checkbox checked={assignData.isFixedRate} onCheckedChange={(checked) => setAssignData({...assignData, isFixedRate: checked})} className="rounded-none border-slate-400" /><span className="text-[10px] font-black text-slate-400 uppercase">ENABLE MANUAL OVERRIDE</span></div></div></div></SectionGrouping>
            )}
          </div>
          <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3"><Button onClick={() => setIsPopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button><Button onClick={handleCreateTrip} className="h-9 px-10 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCnPopupOpen} onOpenChange={setIsCnPopupOpen}>
        <DialogContent className="max-w-[1000px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
          <DialogHeader className="bg-[#1e3a8a] px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center justify-between w-full"><span>Consignment Note Interface</span><div className="flex gap-6 pr-8 opacity-70"><span>Ship To: {selectedTripForCn?.shipToParty}</span><span>Vehicle: {selectedTripForCn?.vehicleNumber}</span></div></DialogTitle></DialogHeader>
          <div className="p-8 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-3 gap-8 bg-white p-6 border border-slate-200 shadow-sm mb-4">
              <FormInput label="CN NUMBER" value={cnFormData.cnNo} onChange={(v: string) => setCnFormData({...cnFormData, cnNo: v.toUpperCase()})} placeholder="Enter CN Number..." />
              <FormInput label="CN DATE" type="date" value={cnFormData.cnDate} onChange={(v: string) => setCnFormData({...cnFormData, cnDate: v})} />
              <FormSelect label="PAYMENT TERMS" value={cnFormData.paymentTerms || 'Paid'} options={["Paid", "To Pay"]} onChange={(v: string) => setCnFormData({...cnFormData, paymentTerms: v})} />
            </div>
            <div className="bg-white border border-slate-300 shadow-inner overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-300 p-2 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-500 px-2">Document registry table</span>
                <Button onClick={() => setCnFormData({...cnFormData, items: [...cnFormData.items, { invoice: '', ewaybill: '', description: '', package: '', uom: 'BAG' }]})} size="sm" variant="ghost" className="h-6 text-[9px] font-black uppercase text-[#1e3a8a] hover:bg-blue-50">
                  <Plus className="h-3 w-3 mr-1" /> Add Row
                </Button>
              </div>
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-[10px] font-black uppercase border-b border-slate-300">
                  <tr>
                    <th className="p-3 border-r border-slate-200">Invoice</th>
                    <th className="p-3 border-r border-slate-200">E-Waybill No.</th>
                    <th className="p-3 border-r border-slate-200">Goods Description</th>
                    <th className="p-3 border-r border-slate-200 w-24">Package</th>
                    <th className="p-3 border-r border-slate-200 w-32">UOM</th>
                    <th className="p-3 w-10">X</th>
                  </tr>
                </thead>
                <tbody>{cnFormData.items?.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-0 border-r border-slate-200"><input value={item.invoice} onChange={e => { const itms = [...cnFormData.items]; itms[idx].invoice = e.target.value.toUpperCase(); setCnFormData({...cnFormData, items: itms}); }} className="w-full h-9 px-3 text-[11px] font-bold outline-none bg-transparent" /></td>
                    <td className="p-0 border-r border-slate-200"><input value={item.ewaybill} onChange={e => { const itms = [...cnFormData.items]; itms[idx].ewaybill = e.target.value.toUpperCase(); setCnFormData({...cnFormData, items: itms}); }} className="w-full h-9 px-3 text-[11px] font-bold outline-none bg-transparent" /></td>
                    <td className="p-0 border-r border-slate-200"><input value={item.description} onChange={e => { const itms = [...cnFormData.items]; itms[idx].description = e.target.value.toUpperCase(); setCnFormData({...cnFormData, items: itms}); }} className="w-full h-9 px-3 text-[11px] font-bold outline-none bg-transparent" /></td>
                    <td className="p-0 border-r border-slate-200"><input type="number" value={item.package} onChange={e => { const itms = [...cnFormData.items]; itms[idx].package = e.target.value; setCnFormData({...cnFormData, items: itms}); }} className="w-full h-9 px-3 text-[11px] font-bold outline-none bg-transparent" /></td>
                    <td className="p-0 border-r border-slate-200"><select value={item.uom} onChange={e => { const itms = [...cnFormData.items]; itms[idx].uom = e.target.value; setCnFormData({...cnFormData, items: itms}); }} className="w-full h-9 px-2 text-[10px] font-black uppercase outline-none bg-transparent"><option value="BAG">BAG</option><option value="BOX">BOX</option><option value="DRUM">DRUM</option><option value="MIX">MIX</option></select></td>
                    <td className="p-0 text-center"><button onClick={() => { if (cnFormData.items.length > 1) { const itms = cnFormData.items.filter((_: any, i: number) => i !== idx); setCnFormData({...cnFormData, items: itms}); } }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3">
            <Button onClick={() => setIsCnPopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
            <Button onClick={handleCnPost} className="h-9 px-10 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">
              {selectedTripForCn?.cnNo ? 'Update' : 'Post'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isOutPopupOpen} onOpenChange={setIsOutPopupOpen}>
        <DialogContent className="max-w-[600px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl">
          <DialogHeader className="bg-[#1e3a8a] px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase tracking-widest">Gate-Out Control</DialogTitle></DialogHeader>
          <div className="p-8 space-y-6"><div className="bg-white p-6 border border-slate-200 shadow-sm mb-4"><div className="flex justify-between items-center text-[10px] font-black uppercase mb-3"><span className="text-slate-400">Vehicle:</span><span className="text-slate-700">{outData.trip?.vehicleNumber}</span></div><div className="flex justify-between items-center text-[10px] font-black uppercase"><span className="text-slate-400">Route:</span><span className="text-blue-700 text-right max-w-[300px]">{outData.trip?.route}</span></div></div><div className="space-y-4"><FormInput label="OUT DATE" type="date" value={outData.date} onChange={(v: string) => setOutData({...outData, date: v})} /><FormInput label="OUT TIME" type="time" value={outData.time} onChange={(v: string) => setOutData({...outData, time: v})} /></div></div>
          <div className="p-4 bg-white border-t border-slate-300 flex justify-end gap-4"><Button onClick={() => setIsOutPopupOpen(false)} variant="ghost" className="h-10 px-8 rounded-none text-[11px] font-black uppercase border border-slate-200 bg-slate-50 hover:bg-slate-100">Exit</Button><Button onClick={handleOutPost} className="h-10 px-12 bg-emerald-600 text-white rounded-none text-[11px] font-black uppercase shadow-lg hover:bg-emerald-700 transition-all">Dispatch Vehicle</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPodPopupOpen} onOpenChange={setIsPodPopupOpen}>
        <DialogContent className="max-w-[500px] bg-white p-0 rounded-none border-none shadow-2xl">
          <DialogHeader className="bg-[#1e3a8a] px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase">POD Registry Synchronization</DialogTitle></DialogHeader>
          <div className="p-8 space-y-6 flex flex-col items-center justify-center"><input type="file" accept="image/*,.pdf" ref={fileInputRef} onChange={handlePodFileChange} className="hidden" /><div onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-blue-50 transition-all">{podFile ? <div className="text-emerald-600 font-black text-xs uppercase">Document Ready</div> : <><UploadCloud className="h-8 w-8 text-[#1e3a8a]" /><span className="text-[10px] font-black uppercase">Select Registry File</span></>}</div><p className="text-[9px] font-bold text-slate-400 uppercase text-center italic">Supported Formats: PDF, PNG, JPG (Auto-Compression Active)</p></div>
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-3"><Button onClick={() => setIsPodPopupOpen(false)} variant="outline" className="h-8 px-6 text-[10px] font-black uppercase">Cancel</Button><Button disabled={!podFile} className="h-8 px-10 bg-emerald-600 text-white text-[10px] font-black uppercase">Synchronize POD</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tr21TrackingPage({ node, onBack }: any) {
  return (<div className="h-full flex flex-col"><div className="bg-white p-4 border-b border-slate-300 flex items-center gap-4"><button onClick={onBack}><ArrowLeft className="h-5 w-5" /></button><h2 className="text-sm font-black uppercase italic">Logistical Tracking Node</h2></div><div className="flex-1 bg-slate-100 flex items-center justify-center p-20 text-center"><div className="space-y-6"><Radar className="h-12 w-12 text-[#1e3a8a] mx-auto animate-pulse" /><p className="text-xs font-black uppercase">Live Tracking Interface Synchronized for Trip: {node?.tripId}</p></div></div></div>);
}

function GpsTrackingHub() {
  return (<div className="h-full flex flex-col bg-slate-100 items-center justify-center"><Radar className="h-12 w-12 text-[#1e3a8a] mb-4" /><p className="text-xs font-black uppercase">GPS HUB - INTERFACE READY</p></div>);
}

function Se38Report({ search, onSearchChange }: any) {
  return (<div className="h-full flex flex-col bg-white p-12 space-y-8"><h2 className="text-sm font-black uppercase border-b border-slate-200 pb-2 italic">SE38 – Custom Report Hub</h2><div className="grid grid-cols-2 gap-8"><FormInput label="FROM DATE" type="date" value={search.from} onChange={(v: string) => onSearchChange({...search, from: v})} /><FormInput label="TO DATE" type="date" value={search.to} onChange={(v: string) => onSearchChange({...search, to: v})} /></div></div>);
}

function ZCodeRegistry({ tcodes, onExecute }: any) {
  return (<div className="p-12 grid grid-cols-3 gap-6">{tcodes.map((t: any) => (<div key={t.code} onClick={() => onExecute(t.code)} className="bg-white border border-slate-300 p-6 hover:shadow-xl cursor-pointer"><h3 className="text-sm font-black text-[#1e3a8a]">{t.code}</h3><p className="text-[10px] text-slate-400 uppercase mt-2">{t.description}</p></div>))}</div>);
}

function TrackShipmentScreen() {
  return (<div className="h-full flex flex-col items-center justify-center font-mono"><Radar className="h-10 w-10 text-[#1e3a8a] mb-6" /><h2 className="text-sm font-black uppercase">TR24 - LIVE TRACKER</h2></div>);
}

function RegistryList({ onSelectItem, listData, activeScreen }: any) {
  return (
    <div className="bg-white border border-slate-300 overflow-hidden rounded-sm shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-300 text-[10px] font-black uppercase tracking-widest">
          <tr><th className="p-4 border-r border-slate-200 w-48">Identifier</th><th className="p-4 border-r border-slate-200">Name / Description</th><th className="p-4">Updated</th></tr>
        </thead>
        <tbody>
          {listData?.map((item: any) => (
            <tr key={item.id} onClick={() => onSelectItem(item)} className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer text-[11px] font-bold group">
              <td className="p-4 border-r border-slate-200 text-[#0056d2] font-black">{item.plantCode || item.customerCode || item.saleOrder || item.username || item.id.slice(0, 8)}</td>
              <td className="p-4 border-r border-slate-200 uppercase text-slate-700">{item.customerName || item.plantName || item.fullName || item.saleOrder}</td>
              <td className="p-4 text-slate-400 font-medium">{format(new Date(item.updatedAt || new Date()), 'dd-MM-yyyy HH:mm')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- MAIN PAGE ---

export default function DashboardPage() {
  const router = useRouter(); 
  const { user, isUserLoading } = useUser(); 
  const db = useFirestore();
  
  const [tCode, setTCode] = React.useState(''); 
  const [history, setHistory] = React.useState<string[]>([]); 
  const [screenStack, setScreenStack] = React.useState<string[]>(['HOME']); 
  const [showHistory, setShowHistory] = React.useState(false); 
  const [activeScreen, setActiveScreen] = React.useState<string>('HOME'); 
  const [formData, setFormData] = React.useState<any>({}); 
  const [searchId, setSearchId] = React.useState(''); 
  const [statusMsg, setStatusMsg] = React.useState<{ text: string, type: 'success' | 'error' | 'info' | 'none' }>({ text: 'Ready', type: 'none' }); 
  const [greeting, setGreeting] = React.useState('');
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL'); 
  const [homeMonthFilter, setHomeMonthFilter] = React.useState(format(new Date(), 'yyyy-MM')); 
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [se38Search, setSe38Search] = React.useState({ plant: '', from: format(subDays(new Date(), 7), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') });
  const [viewMode, setViewMode] = React.useState<'list' | 'tracking'>('list'); 
  const [trackingNode, setTrackingNode] = React.useState<any>(null);
  
  // PDF Preview State
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = React.useState(false);
  const [selectedTripForPreview, setSelectedTripForPreview] = React.useState<any>(null);
  const [previewDeliveryAddress, setPreviewDeliveryAddress] = React.useState('');
  const [isAddressEditable, setIsAddressEditable] = React.useState(false);
  const [isAddressDirty, setIsAddressDirty] = React.useState(false);
  const [pdfZoom, setPdfZoom] = React.useState(1);

  const tCodeRef = React.useRef<HTMLInputElement>(null); 
  const bulkInputRef = React.useRef<HTMLInputElement>(null);
  const settingsRef = useMemoFirebase(() => doc(db, 'users', SHARED_HUB_ID, 'settings', 'gps_config'), [db]);
  const { data: settings } = useDoc(settingsRef);
  
  const profileRef = useMemoFirebase(() => { if (!user) return null; const rid = localStorage.getItem('sap_registry_id'); return rid ? doc(db, 'user_registry', rid) : doc(db, 'user_registry', user.uid); }, [user, db]);
  const { data: userProfile } = useDoc(profileRef);
  
  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const usersQuery = useMemoFirebase(() => collection(db, 'user_registry'), [db]);
  
  const { data: rawOrders } = useCollection(ordersQuery);
  const { data: rawTrips } = useCollection(tripsQuery);
  const { data: rawPlants } = useCollection(plantsQuery);
  const { data: rawCompanies } = useCollection(companiesQuery);
  const { data: rawVendors } = useCollection(vendorsQuery);
  const { data: rawCustomers } = useCollection(customersQuery);
  const { data: allUsers } = useCollection(usersQuery);

  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');
  const isReadOnly = activeScreen.endsWith('03');

  React.useEffect(() => { const isAdmin = localStorage.getItem('sap_bootstrap_session') === 'true'; setIsBootstrapAdmin(isAdmin); }, []);
  
  const authorizedPlantsList = userProfile?.plants || [];
  const accessiblePlants = isBootstrapAdmin ? (rawPlants || []) : (rawPlants || []).filter(p => authorizedPlantsList.includes(p.plantCode));
  const accessibleCompanies = isBootstrapAdmin ? (rawCompanies || []) : (rawCompanies || []).filter(c => c.plantCodes?.some((p: string) => authorizedPlantsList.includes(p)));
  const accessibleVendors = isBootstrapAdmin ? (rawVendors || []) : (rawVendors || []).filter(v => v.plantCodes?.some((p: string) => authorizedPlantsList.includes(p)));
  const accessibleCustomers = isBootstrapAdmin ? (rawCustomers || []) : (rawCustomers || []).filter(c => c.plantCodes?.some((p: string) => authorizedPlantsList.includes(p)));
  const accessibleUsers = isBootstrapAdmin ? (allUsers || []) : (allUsers || []).filter(u => u.plants?.some((p: string) => authorizedPlantsList.includes(p)));
  const allTrips = isBootstrapAdmin ? (rawTrips || []) : (rawTrips || []).filter(t => authorizedPlantsList.includes(t.plantCode));
  const allOrders = isBootstrapAdmin ? (rawOrders || []) : (rawOrders || []).filter(o => authorizedPlantsList.includes(o.plantCode));

  const homeStats = React.useMemo(() => {
    if (!allOrders || !allTrips) return { open: 0, loading: 0, transit: 0, arrived: 0, pod: 0, reject: 0, closed: 0 };
    const filteredOrders = allOrders.filter(o => { const itemDate = o.createdAt; return o.status !== 'CANCELLED' && (homePlantFilter === 'ALL' || o.plantCode === homePlantFilter) && (!homeMonthFilter || (itemDate && itemDate.startsWith(homeMonthFilter))); });
    const filteredTrips = allTrips.filter(t => { const itemDate = t.createdAt; return (homePlantFilter === 'ALL' || t.plantCode === homePlantFilter) && (!homeMonthFilter || (itemDate && itemDate.startsWith(homeMonthFilter))); });
    return { open: filteredOrders.length, loading: filteredTrips.filter(t => t.status === 'LOADING').length, transit: filteredTrips.filter(t => t.status === 'IN-TRANSIT').length, arrived: filteredTrips.filter(t => t.status === 'ARRIVED').length, pod: filteredTrips.filter(t => t.status === 'POD').length, reject: filteredTrips.filter(t => t.status === 'REJECTION').length, closed: filteredTrips.filter(t => t.status === 'CLOSED').length };
  }, [allOrders, allTrips, homePlantFilter, homeMonthFilter]);

  const executeTCode = React.useCallback((cmd: string) => {
    const input = cmd.toUpperCase().trim();
    if (!input) return;
    const authorizedTcodes = isBootstrapAdmin ? MASTER_TCODES.map(t => t.code) : (userProfile?.tcodes || []);
    if (input === '/NEND' || input === '/NEX') { localStorage.removeItem('sap_bootstrap_session'); localStorage.removeItem('sap_user_role'); localStorage.removeItem('sap_registry_id'); router.push('/login'); return; }
    if (input === '/N' || input === 'HOME') { setActiveScreen('HOME'); setScreenStack(['HOME']); setTCode(''); setStatusMsg({ text: 'Session Reset to Home', type: 'info' }); return; }
    let mode: 'REPLACE' | 'NEW_TAB' | 'NORMAL' = 'NORMAL'; let code = input;
    if (input.startsWith('/N')) { mode = 'REPLACE'; code = input.substring(2); } else if (input.startsWith('/O')) { mode = 'NEW_TAB'; code = input.substring(2); }
    if (!code) { setStatusMsg({ text: 'Specify a valid transaction code', type: 'error' }); return; }
    const exists = MASTER_TCODES.find(t => t.code === code);
    if (!exists) { setStatusMsg({ text: `Transaction ${code} does not exist`, type: 'error' }); setTCode(''); return; }
    if (!authorizedTcodes.includes(code)) { setStatusMsg({ text: `No authorization for transaction ${code}`, type: 'error' }); setTCode(''); return; }
    if (mode === 'NEW_TAB') { window.open(`${window.location.origin}${window.location.pathname}?tcode=${code}`, '_blank'); setTCode(''); setStatusMsg({ text: `Opening ${code} in new session...`, type: 'info' }); } else { setScreenStack(['HOME', code]); setActiveScreen(code); if (code === 'VA01') setFormData({ saleOrderDate: new Date().toISOString().slice(0, 16), status: 'Active' }); else setFormData({}); setTCode(''); setStatusMsg({ text: `Transaction ${code} executed`, type: 'info' }); setShowHistory(false); setHistory(prev => [input, ...prev.filter(h => h !== input)].slice(0, 10)); }
  }, [isBootstrapAdmin, userProfile, router]);

  const validateOrder = async (order: any) => {
    const isDuplicate = allOrders.some(o => o.saleOrder?.toString().toUpperCase() === order.saleOrder?.toString().toUpperCase() && o.id !== order.id);
    if (isDuplicate) return { valid: false, reason: 'Duplicate Sale Order Number' };
    const findCust = (val: string) => accessibleCustomers.some(c => c.customerName?.toUpperCase() === val?.toUpperCase() || c.customerCode?.toUpperCase() === val?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === val?.toUpperCase());
    if (!findCust(order.consignor)) return { valid: false, reason: 'Unknown Consignor (No record in XD03)' };
    if (!findCust(order.consignee)) return { valid: false, reason: 'Unknown Consignee (No record in XD03)' };
    if (!findCust(order.shipToParty)) return { valid: false, reason: 'Unknown Ship to Party (No record in XD03)' };
    return { valid: true };
  };

  const handleSave = React.useCallback(async () => {
    if (activeScreen === 'TR21' && selectedTripForPreview) {
      setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForPreview.id), { deliveryAddress: previewDeliveryAddress, updatedAt: new Date().toISOString() }, { merge: true });
      setIsAddressDirty(false); setIsAddressEditable(false); setStatusMsg({ text: 'Registry Synchronized (F8)', type: 'success' }); return;
    }
    if (activeScreen === 'VA04') { const o = allOrders?.find(ord => ord.saleOrder?.toString().toUpperCase() === formData.saleOrder?.toString().toUpperCase()); if (o) { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', o.id), { status: 'CANCELLED' }, { merge: true }); setStatusMsg({ text: 'Order Cancelled', type: 'success' }); setFormData({}); } return; }
    if (activeScreen === 'VA01') { const validation = await validateOrder(formData); if (!validation.valid) { setStatusMsg({ text: `Rejection: ${validation.reason}`, type: 'error' }); return; } }
    if (activeScreen === 'XD01') { const isDuplicate = accessibleCustomers.some(c => c.customerCode === formData.customerCode && c.id !== formData.id); if (isDuplicate) { setStatusMsg({ text: 'Error: Duplicate Customer Code', type: 'error' }); return; } }
    let col = ''; if (activeScreen.startsWith('OX')) col = 'plants'; else if (activeScreen.startsWith('FM')) col = 'companies'; else if (activeScreen.startsWith('XK')) col = 'vendors'; else if (activeScreen.startsWith('XD')) col = 'customers'; else if (activeScreen.startsWith('VA')) col = 'sales_orders'; else if (activeScreen.startsWith('SU')) col = 'user_registry';
    if (col) {
      const docId = formData.id || crypto.randomUUID();
      const ref = col === 'user_registry' ? doc(db, 'user_registry', docId) : doc(db, 'users', SHARED_HUB_ID, col, docId);
      setDocumentNonBlocking(ref, { ...formData, id: docId, updatedAt: new Date().toISOString(), createdAt: formData.createdAt || new Date().toISOString() }, { merge: true });
      setStatusMsg({ text: 'Synchronized (F8)', type: 'success' }); setFormData({});
    }
  }, [activeScreen, formData, db, allOrders, accessibleCustomers, selectedTripForPreview, previewDeliveryAddress]);

  const handleBack = () => { if (screenStack.length > 1) { const newStack = [...screenStack]; newStack.pop(); const prev = newStack[newStack.length - 1]; setScreenStack(newStack); setActiveScreen(prev); setFormData({}); } };
  
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string; const rows = text.split('\n').slice(1);
      let successCount = 0; let failCount = 0;
      if (activeScreen === 'VA01') {
        for (const row of rows) {
          const cols = row.split(','); if (cols.length < 8) continue;
          const newOrder = { plantCode: cols[0]?.trim(), saleOrder: cols[1]?.trim(), consignor: cols[2]?.trim(), consignee: cols[4]?.trim(), shipToParty: cols[6]?.trim(), weight: cols[7]?.trim(), weightUom: cols[8]?.trim() || 'MT', status: 'Active', createdAt: new Date().toISOString(), saleOrderDate: new Date().toISOString().slice(0, 16) };
          const validation = await validateOrder(newOrder); if (validation.valid) { const docId = crypto.randomUUID(); setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), { ...newOrder, id: docId }, { merge: true }); successCount++; } else { failCount++; }
        }
      } else if (activeScreen === 'XD01') {
        for (const row of rows) {
          const cols = row.split(','); if (cols.length < 7) continue;
          const customerCode = cols[0]?.trim(); const isDuplicate = accessibleCustomers.some(c => c.customerCode === customerCode); if (isDuplicate) { failCount++; continue; }
          const newCust = { customerCode, customerName: cols[1]?.trim(), customerType: cols[2]?.trim(), address: cols[3]?.trim(), city: cols[4]?.trim(), postalCode: cols[5]?.trim(), mobile: cols[6]?.trim(), gstin: cols[7]?.trim() || '', plantCodes: authorizedPlantsList, updatedAt: new Date().toISOString() };
          const docId = crypto.randomUUID(); setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'customers', docId), { ...newCust, id: docId }, { merge: true }); successCount++;
        }
      }
      setStatusMsg({ text: `Bulk: ${successCount} Processed, ${failCount} Rejected`, type: successCount > 0 ? 'success' : 'error' });
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    let headers = ""; let filename = "";
    if (activeScreen === 'VA01') { headers = "Plant,Sale Order,Consignor,Consignee Code,Consignee,Ship to Party Code,Ship to Party,Weight,WeightUom\nPL01,SO9999,CONSIGNOR-NAME,C-CODE,CONSIGNEE-NAME,S-CODE,SHIP-TO-NAME,25,MT"; filename = 'VA01_Template.csv'; } 
    else if (activeScreen === 'XD01') { headers = "Customer Code,Customer Name,Customer Type,Address,City,Postal Code,Mobile,GSTIN\nC1000,CLIENT-NAME,Consignor,STREET-ADDRESS,CITY-NAME,123456,9999999999,GSTIN12345"; filename = 'XD01_Template.csv'; }
    if (!headers) return; const blob = new Blob([headers], { type: 'text/csv' }); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  };

  const getRegistryList = () => { if (activeScreen.startsWith('OX')) return accessiblePlants; if (activeScreen.startsWith('FM')) return accessibleCompanies; if (activeScreen.startsWith('XK')) return accessibleVendors; if (activeScreen.startsWith('XD')) return accessibleCustomers; if (activeScreen.startsWith('VA')) return allOrders; if (activeScreen.startsWith('SU')) return accessibleUsers; return []; };
  const handleSearchIdEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { const item = getRegistryList().find((i: any) => (i.plantCode || i.customerCode || i.saleOrder || i.username || i.id).toString().toUpperCase() === searchId.toUpperCase()); if (item) { setFormData(item); setStatusMsg({ text: 'Record Loaded', type: 'success' }); } else setStatusMsg({ text: 'Not Found', type: 'error' }); } };

  return (
    <div className="flex flex-col h-screen w-full bg-[#f0f3f9] text-[#333] font-mono overflow-hidden">
      <div className="flex items-center bg-[#c5e0b4] border-b border-slate-400 px-3 h-8 text-[11px] font-semibold z-50 print:hidden"><div className="flex items-center gap-6">{['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map(i => <button key={i} className="hover:text-blue-800 transition-colors uppercase">{i}</button>)}</div><div className="flex-1" /><div className="flex items-center h-full"><button onClick={() => router.push('/')} className="h-full px-3 hover:bg-[#e81123] hover:text-white transition-all"><X className="h-3.5 w-3.5" /></button></div></div>
      <div className="flex flex-col bg-[#f0f0f0] border-b border-slate-300 shadow-sm z-40 print:hidden">
        <div className="flex items-center px-2 py-1 gap-4">
          <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-slate-300">{logoAsset && <Image src={logoAsset.url} alt="SLMC" width={80} height={30} className="object-contain" unoptimized />}</div>
          <div className="flex items-center bg-white border border-slate-400 p-0.5 shadow-inner relative"><button onClick={() => executeTCode(tCode)} className="px-1 text-[#008000] font-black text-xs hover:bg-slate-100">✓</button><input ref={tCodeRef} type="text" value={tCode} onChange={e => setTCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') executeTCode(tCode); }} onClick={() => history.length > 0 && setShowHistory(true)} onBlur={() => setTimeout(() => setShowHistory(false), 200)} className="w-48 outline-none text-xs px-1 font-bold tracking-wider" placeholder="T-CODE..." />{showHistory && (<div className="absolute top-full left-0 w-full bg-white border border-slate-400 shadow-md z-[60]">{history.map((h, i) => <div key={i} onClick={() => executeTCode(h)} className="px-4 py-1.5 text-xs font-bold cursor-pointer hover:bg-blue-50">{h}</div>)}</div>)}</div>
          <div className="flex items-center gap-1.5 px-4 border-l border-slate-300 ml-2 h-7"><button onClick={handleSave} className="p-1 hover:bg-slate-200 rounded" title="Save (F8)"><Save className="h-4 w-4 text-slate-600" /></button><button onClick={handleBack} className="p-1 hover:bg-slate-200 rounded" title="Back (F3)"><Undo2 className="h-4 w-4 text-slate-600" /></button><button onClick={() => setFormData({})} className="p-1 hover:bg-slate-200 rounded" title="Clear (F12)"><XCircle className="h-4 w-4 text-slate-600" /></button>{activeScreen === 'TR21' && selectedTripForPreview && (<button onClick={() => setIsPdfPreviewOpen(true)} className="p-1 hover:bg-slate-200 rounded" title="CN Print Preview"><Printer className="h-4 w-4 text-blue-600" /></button>)}</div>
          <div className="flex-1" /><div className="flex items-center gap-3 pr-4">{(activeScreen === 'VA01' || activeScreen === 'XD01') && (<div className="flex items-center gap-2 mr-4"><input type="file" ref={bulkInputRef} onChange={handleBulkUpload} className="hidden" accept=".csv" /><button onClick={handleDownloadTemplate} className="px-3 h-7 bg-white border border-slate-300 rounded text-[9px] font-black uppercase">Template</button><button onClick={() => bulkInputRef.current?.click()} className="px-3 h-7 bg-[#1e3a8a] text-white rounded text-[9px] font-black uppercase shadow-sm">Bulk Upload</button></div>)}<button onClick={() => { localStorage.removeItem('sap_bootstrap_session'); router.push('/login'); }} className="flex items-center gap-2 px-3 h-7 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all"><LogOut className="h-3.5 w-3.5" /> Log Off</button></div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {activeScreen === 'HOME' && (<div className="w-72 bg-white border-r border-slate-300 hidden lg:flex flex-col overflow-hidden print:hidden shadow-sm"><div className="p-4 border-b border-slate-200 bg-[#dae4f1]/50"><h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1e3a8a] flex items-center gap-2"><Grid2X2 className="h-3.5 w-3.5" /> Favorites</h2></div><div className="flex-1 overflow-y-auto green-scrollbar">{MASTER_TCODES.filter(t => t.code.endsWith('01') || t.code === 'TR21' || t.code === 'VA04' || t.code === 'WGPS24').map(t => (<div key={t.code} onClick={() => executeTCode(t.code)} className="flex items-center gap-4 px-5 py-3 hover:bg-blue-50 cursor-pointer group border-b border-slate-100 transition-all"><span className="text-[10px] font-black uppercase tracking-tight text-[#1e3a8a]">{t.code} - {t.description}</span><div className="flex-1" /><t.icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600" /></div>))}</div></div>)}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f2f2f2] print:bg-white">
          {activeScreen === 'HOME' ? (
            <div className="flex-1 overflow-y-auto p-8 animate-fade-in"><h1 className="text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter mb-10">Sikka Logistics Management Control</h1><div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 border border-slate-300 shadow-sm mb-12"><div className="flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plant Filter</label><select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500" value={homePlantFilter} onChange={e => setHomePlantFilter(e.target.value)}><option value="ALL">ALL AUTHORIZED PLANTS</option>{accessiblePlants.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}</select></div><div className="flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fiscal Period</label><input type="month" className="h-10 border border-slate-400 px-3 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500" value={homeMonthFilter} onChange={e => setHomeMonthFilter(e.target.value)} /></div></div><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">{[{ l: 'OPEN ORDER', c: homeStats.open, cl: 'text-blue-600' }, { l: 'LOADING', c: homeStats.loading, cl: 'text-orange-600' }, { l: 'IN-TRANSIT', c: homeStats.transit, cl: 'text-emerald-600' }, { l: 'ARRIVED', c: homeStats.arrived, cl: 'text-indigo-600' }, { l: 'POD', c: homeStats.pod, cl: 'text-purple-600' }, { l: 'REJECT', c: homeStats.reject, cl: 'text-red-600' }, { l: 'CLOSED', c: homeStats.closed, cl: 'text-slate-600' }].map(w => (<div key={w.l} className="p-6 border border-slate-200 shadow-md flex flex-col items-center justify-center gap-3 bg-white hover:scale-105 transition-transform duration-300"><span className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest leading-none h-6 flex items-center">{w.l}</span><span className={cn("text-3xl font-black italic tracking-tighter", w.cl)}>{w.c}</span></div>))}</div></div>
          ) : (
            <div className="flex flex-col w-full h-full overflow-hidden bg-[#f2f2f2]">
              {activeScreen === 'TR21' && viewMode === 'list' && (
                <TripBoard 
                  orders={allOrders} trips={allTrips} vendors={accessibleVendors} plants={accessiblePlants} companies={accessibleCompanies} customers={accessibleCustomers} onStatusUpdate={setStatusMsg} viewMode={viewMode} setViewMode={setViewMode} trackingNode={trackingNode} setTrackingNode={setTrackingNode} settings={settings}
                  onOpenPdfPreview={(t: any) => { 
                    setSelectedTripForPreview(t); 
                    const fullShipToAddr = [t.shipToMaster?.address, t.shipToMaster?.city, t.shipToMaster?.postalCode].filter(Boolean).join(', ');
                    setPreviewDeliveryAddress(t.deliveryAddress || fullShipToAddr || t.order?.deliveryAddress || '');
                    setIsAddressEditable(false); setIsAddressDirty(false); setIsPdfPreviewOpen(true); 
                  }}
                />
              )}
              {activeScreen === 'TR21' && viewMode === 'tracking' && <Tr21TrackingPage node={trackingNode} onBack={() => setViewMode('list')} />}
              {activeScreen === 'TR24' && <TrackShipmentScreen />}
              {activeScreen === 'WGPS24' && <GpsTrackingHub />}
              {activeScreen === 'SE38' && <Se38Report search={se38Search} onSearchChange={setSe38Search} />}
              {activeScreen === 'ZCODE' && <ZCodeRegistry tcodes={MASTER_TCODES} onExecute={executeTCode} />}
              {!['TR21', 'TR24', 'WGPS24', 'SE38', 'ZCODE'].includes(activeScreen) && (
                <div className="flex-1 flex flex-col overflow-y-auto green-scrollbar"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-10"><h2 className="text-[16px] font-bold text-slate-800 uppercase tracking-tight">{MASTER_TCODES.find(t => t.code === activeScreen)?.description || activeScreen}</h2></div><div className="px-10 pb-20">{(activeScreen.endsWith('01') || formData.id || activeScreen === 'VA04') ? (<div className="max-w-full animate-slide-up">{activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}{activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}{activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}{activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}{activeScreen.startsWith('VA') && activeScreen !== 'VA04' && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} allCustomers={accessibleCustomers} trips={allTrips} screen={activeScreen} />}{activeScreen === 'VA04' && <CancelOrderForm data={formData} onChange={setFormData} allOrders={allOrders} allTrips={allTrips} onPost={handleSave} onCancel={() => setFormData({})} />}{activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}</div>) : (<div className="space-y-8 animate-fade-in"><div className="bg-white p-6 border-b-2 border-slate-300 shadow-sm flex items-center gap-6"><label className="text-[11px] font-black uppercase text-slate-500 w-40 text-right">Search Record:</label><input className="h-9 w-full max-w-xl border border-slate-400 px-4 text-xs font-black uppercase outline-none focus:ring-1 focus:ring-blue-500" value={searchId} onChange={e => setSearchId(e.target.value)} onKeyDown={handleSearchIdEnter} placeholder="ENTER CODE OR IDENTIFIER AND PRESS ENTER..." /></div><RegistryList onSelectItem={setFormData} listData={getRegistryList()} activeScreen={activeScreen} /></div>)}</div></div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="h-7 bg-[#0f172a] flex items-center px-4 text-[9px] font-black text-white/90 uppercase tracking-[0.15em] shrink-0 z-50 print:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.2)]"><div className="flex items-center gap-8 overflow-hidden flex-1"><span className="flex items-center gap-2.5 shrink-0"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />SYNC: ACTIVE</span><span className="shrink-0">{activeScreen}</span><span className="truncate">USER: {isBootstrapAdmin ? 'SUPER ADMIN' : (userProfile?.fullName || 'IDENTIFYING...')}</span>{statusMsg.text !== 'Ready' && <span className={cn("truncate", statusMsg.type === 'error' ? "text-red-400" : "text-blue-400")}>EVENT: {statusMsg.text}</span>}</div>{greeting && <div className="shrink-0 ml-4 hidden sm:block text-blue-400 italic">{greeting}</div>}</div>

      {isPdfPreviewOpen && selectedTripForPreview && (
        <div className="fixed inset-0 z-[200] bg-[#525659] flex flex-col font-mono animate-fade-in overflow-hidden">
           <div className="bg-[#c5e0b4] border-b border-slate-400 h-9 flex items-center justify-between px-4 shrink-0"><div className="text-[11px] font-black uppercase tracking-widest text-[#1e3a8a]">PDF Preview Portal</div><button onClick={() => setIsPdfPreviewOpen(false)} className="text-slate-600 hover:text-red-600 transition-colors"><X className="h-4 w-4" /></button></div>
           <div className="bg-[#323639] h-10 flex items-center justify-between px-8 shrink-0 shadow-lg"><div className="flex items-center gap-6"><span className="text-white text-[11px] font-bold">1 of 3</span><div className="h-4 w-px bg-white/20" /><div className="flex items-center gap-3"><button onClick={() => setPdfZoom(Math.max(0.5, pdfZoom - 0.1))} className="text-white/70 hover:text-white"><ChevronLeft className="h-4 w-4" /></button><span className="text-white text-[11px] font-bold w-12 text-center">{Math.round(pdfZoom * 100)}%</span><button onClick={() => setPdfZoom(Math.min(2, pdfZoom + 0.1))} className="text-white/70 hover:text-white"><ChevronRight className="h-4 w-4" /></button></div></div><div className="flex items-center gap-6"><button className="text-white/70 hover:text-white"><Search className="h-4 w-4" /></button><button onClick={() => window.print()} disabled={isAddressDirty} className={cn("text-white/70 hover:text-white", isAddressDirty && "opacity-30 cursor-not-allowed")}><Printer className="h-4 w-4" /></button><button disabled={isAddressDirty} className={cn("text-white/70 hover:text-white", isAddressDirty && "opacity-30 cursor-not-allowed")}><Download className="h-4 w-4" /></button></div></div>
           <div className="flex-1 overflow-auto p-12 flex justify-center custom-scrollbar">
             <div style={{ transform: `scale(${pdfZoom})`, transformOrigin: 'top center' }} className="transition-transform duration-200">
               {[...Array(3)].map((_, i) => {
                 const copyLabel = i === 0 ? 'CONSIGNEE COPY' : i === 1 ? 'DRIVER COPY' : 'CONSIGNOR COPY';
                 const tableItems = selectedTripForPreview.cnItems || [];
                 const totalUnits = tableItems.reduce((acc: number, itm: any) => acc + (parseFloat(itm.package) || 0), 0);
                 const uoms = Array.from(new Set(tableItems.map((itm: any) => itm.uom).filter(Boolean)));
                 const pkgDisplay = uoms.length > 1 ? `${totalUnits} Combined` : `${totalUnits} ${uoms[0] || 'MT'}`;
                 return (
                   <div key={i} className={cn("w-[210mm] min-h-[297mm] p-[10mm] bg-white shadow-2xl mb-8 relative border border-black", i < 2 && "print:page-break-after-always")}>
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4">{selectedTripForPreview.carrier?.logo && <Image src={selectedTripForPreview.carrier.logo} alt="Logo" width={60} height={60} className="object-contain" unoptimized />}<div className="flex flex-col"><h1 className="text-[26px] font-black uppercase italic tracking-tighter leading-none">{selectedTripForPreview.carrier?.companyName || 'CARRIER NAME'}</h1><p className="text-[10px] font-bold mt-2 uppercase">{selectedTripForPreview.carrier?.address}, {selectedTripForPreview.carrier?.city}</p><div className="flex gap-4 text-[10px] font-bold mt-1 uppercase"><span>Mobile: {selectedTripForPreview.carrier?.mobile}</span><span>Email: {selectedTripForPreview.carrier?.email}</span></div><div className="flex gap-4 text-[10px] font-bold mt-1 uppercase"><span>GSTIN: {selectedTripForPreview.carrier?.gstin}</span><span>PAN: {selectedTripForPreview.carrier?.pan || 'N/A'}</span></div></div></div>
                        <div className="text-right">
                          <div className="border border-black px-4 py-1.5 inline-block mb-4"><span className="text-[12px] font-black uppercase">{copyLabel}</span></div>
                          <p className="text-[16px] font-black uppercase leading-tight">CN No: {selectedTripForPreview.cnNo}</p>
                          <p className="text-[10px] font-bold uppercase mt-1 leading-tight">Date: {format(new Date(selectedTripForPreview.cnDate || new Date()), 'dd-MMM-yyyy')}</p>
                          <p className="text-[10px] font-bold uppercase mt-1 leading-tight">FROM: {selectedTripForPreview.order?.from || 'N/A'}</p>
                          <p className="text-[10px] font-bold uppercase mt-1 leading-tight">TO: {selectedTripForPreview.order?.destination || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-0 mb-6 border border-black h-12">
                         <div className="border-r border-black flex flex-col items-center justify-center p-1"><span className="text-[8px] font-black uppercase">Vehicle No</span><span className="text-[10px] font-bold">{selectedTripForPreview.vehicleNumber}</span></div>
                         <div className="border-r border-black flex flex-col items-center justify-center p-1"><span className="text-[8px] font-black uppercase">Driver Mobile</span><span className="text-[10px] font-bold">{selectedTripForPreview.driverMobile}</span></div>
                         <div className="border-r border-black flex flex-col items-center justify-center p-1"><span className="text-[8px] font-black uppercase">Payment Term</span><span className="text-[10px] font-bold">{selectedTripForPreview.paymentTerms || 'Paid'}</span></div>
                         <div className="flex flex-col items-center justify-center p-1"><span className="text-[8px] font-black uppercase">Trip ID</span><span className="text-[10px] font-bold">{selectedTripForPreview.tripId}</span></div>
                      </div>
                      <div className="grid grid-cols-3 gap-0 mb-6 border border-black h-32">{[{ title: 'CONSIGNOR', master: selectedTripForPreview.consignorMaster, fallback: selectedTripForPreview.order?.consignor }, { title: 'CONSIGNEE', master: selectedTripForPreview.consigneeMaster, fallback: selectedTripForPreview.order?.consignee }, { title: 'SHIP TO PARTY', master: selectedTripForPreview.shipToMaster, fallback: selectedTripForPreview.shipToParty }].map((c, idx) => (<div key={idx} className="flex flex-col border-r last:border-0 border-black p-3"><p className="text-[10px] font-black uppercase text-center border-b border-black pb-1 mb-2">{c.title}</p><div className="flex-1 flex flex-col items-center justify-center space-y-0.5 text-center"><p className="text-[11px] font-black uppercase truncate">{c.master?.customerName || c.fallback}</p><p className="text-[9px] font-bold uppercase leading-relaxed text-slate-700 line-clamp-2">{c.master?.address || 'REGISTERED ADDRESS'}</p><div className="mt-1 flex flex-col items-center space-y-0 text-center"><span className="text-[9px] font-bold">Mobile: {c.master?.mobile || '-'}</span><span className="text-[9px] font-bold">GSTIN: {c.master?.gstin || 'N/A'}</span></div></div></div>))}</div>
                      <div className="flex-1">
                        <table className="w-full border-collapse border border-black">
                          <thead><tr className="bg-slate-100 text-[10px] font-black uppercase h-8"><th className="border border-black p-2 w-[120px]">Invoice</th><th className="border border-black p-2 w-[144px]">E-waybill No</th><th className="border border-black p-2 text-left w-[310px]">Description</th><th className="border border-black p-2 w-[96px]">Package</th><th className="border border-black p-2 w-[96px]">Weight</th></tr></thead>
                          <tbody>{tableItems.map((itm: any, idx: number) => (<tr key={idx} className="text-[10px] font-bold uppercase h-10 border-b border-black"><td className="p-2 text-center">{itm.invoice}</td><td className="p-2 text-center">{itm.ewaybill}</td><td className="p-2">{itm.description}</td><td className="p-2 text-center">{itm.package}</td><td className="p-2 text-center">{selectedTripForPreview.assignWeight}</td></tr>))}</tbody>
                          <tfoot className="bg-slate-50 font-black h-8"><tr className="border-t border-black"><td colSpan={3} className="p-2 text-right uppercase text-[10px]">Gross Total:</td><td className="p-2 text-center text-[11px] border-l border-black">{pkgDisplay}</td><td className="p-2 text-center text-[11px] border-l border-black">{selectedTripForPreview.assignWeight} {selectedTripForPreview.weightUom}</td></tr></tfoot>
                        </table>
                        <div className="mt-4 border border-black"><div className="bg-slate-50 border-b border-black p-1"><p className="text-[10px] font-black uppercase">Delivery Address:</p></div><div className="p-3 min-h-[60px] relative group">{isAddressEditable ? <textarea value={previewDeliveryAddress} onChange={e => { setPreviewDeliveryAddress(e.target.value); setIsAddressDirty(true); }} className="w-full h-full text-[10px] font-bold uppercase outline-none bg-yellow-50 resize-none" /> : <p className="text-[10px] font-bold uppercase leading-relaxed pr-10">{previewDeliveryAddress}</p>}<button onClick={() => setIsAddressEditable(true)} className="absolute top-2 right-2 p-1 text-[#1e3a8a] opacity-0 group-hover:opacity-100 print:hidden"><Edit3 className="h-3 w-3" /></button></div></div>
                      </div>
                      <div className="mt-8 space-y-6">
                        {selectedTripForPreview.carrier?.instructions && (
                          <div className="text-[9px] border-l-2 border-black pl-3 py-1">
                            <span className="font-black uppercase">Note / Instructions: </span>
                            <span className="font-bold">{selectedTripForPreview.carrier.instructions}</span>
                          </div>
                        )}
                        <div className="flex items-end justify-between px-2 pt-12">
                          <div className="flex-1 max-w-[65%] text-[8px] font-bold text-slate-500 uppercase italic"></div>
                          <div className="text-right pb-10">
                            <p className="text-[11px] font-black uppercase border-t border-black pt-2 px-6 inline-block">Authorized Signatory</p>
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-6 left-0 right-0 text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          This Consignment Note was generated digitally and is to be considered as original.
                        </p>
                      </div>
                   </div>
                 );
               })}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
