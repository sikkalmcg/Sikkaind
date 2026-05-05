'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Printer, Save, X, Info, LogOut,
  ChevronRight, ChevronLeft, Truck, MapPin, User, Users, ShoppingBag,
  Grid2X2, ShieldAlert, Edit3, 
  PlusSquare, XCircle, Calendar as CalendarIcon, Package, Undo2,
  FileText, UploadCloud, Trash2, Plus, CheckCircle as CheckCircleIcon, Search,
  AlertTriangle, Clock, Calendar as LucideCalendar, FileCheck, Eye, EyeOff, Download,
  Loader2, Radar, Settings, PlayCircle, ShoppingCart, CheckCircle, ArrowLeft, Share
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  useFirestore, 
  useUser, 
  useCollection, 
  useDoc,
  useMemoFirebase,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, isAfter, parse, addHours, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import placeholderData from '@/app/lib/placeholder-images.json';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XK03_LIST' | 'XK01_LIST' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'VA04' | 'TR21' | 'TR24' | 'WGPS24' | 'SU01' | 'SU02' | 'SU03' | 'ZCODE' | 'SE38';

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
  { code: 'XK03_LIST', description: 'VENDOR MASTER: REGISTRY', icon: Info, module: 'Master Data' },
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

function VehicleLocation({ lat, lng, locationName, onClick }: { lat: number, lng: number, locationName?: string, onClick?: (loc: string) => void }) {
  const [loc, setLoc] = React.useState<string>('Syncing...');
  
  React.useEffect(() => {
    if (locationName) {
      const isCoords = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(locationName);
      if (!isCoords) {
        const parts = locationName.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          setLoc(`${parts[0]}, ${parts[1]}`);
        } else {
          setLoc(locationName);
        }
        return;
      }
    }
    
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const comps = results[0].address_components;
        let street = '', city = '';
        for (const c of comps) {
          if (c.types.includes('route') || c.types.includes('sublocality')) street = c.long_name;
          if (c.types.includes('locality')) city = c.long_name;
        }
        const full = city ? `${street}, ${city}` : results[0].formatted_address.split(',').slice(0, 2).join(', ');
        setLoc(full);
      } else {
        setLoc('Location Offline');
      }
    });
  }, [lat, lng, locationName]);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick(loc);
    }
  };

  return (
    <span 
      onClick={handleClick}
      className={cn(
        "text-[10px] font-black text-[#1e3a8a] truncate max-w-[200px] cursor-pointer hover:underline underline-offset-2 uppercase tracking-tighter"
      )}
    >
      {loc}
    </span>
  );
}

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
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  
  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return [];
    return options.filter((o: string) => o?.toUpperCase().includes(inputValue.toUpperCase())).slice(0, 10);
  }, [options, inputValue]);

  React.useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const handleSelect = (val: string) => {
    const cleanName = val.includes(' - ') ? val.split(' - ').slice(0, -1).join(' - ') : val;
    setInputValue(cleanName);
    onChange(val);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Tab') {
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-8 group relative">
      <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">{label}:</label>
      <div className="relative w-[320px]">
        <input 
          value={inputValue} 
          onChange={(e) => { 
            const val = e.target.value;
            setInputValue(val); 
            onChange(val);
            setIsOpen(true); 
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 250)}
          onKeyDown={handleKeyDown}
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
            <div 
              key={idx} 
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                "px-4 py-2 text-[11px] font-black cursor-pointer border-b border-slate-50 last:border-0",
                idx === highlightedIndex ? "bg-[#e8f0fe] text-[#0056d2]" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlantForm({ data, onChange, disabled }: any) {
  return <div className="space-y-10"><SectionGrouping title="PRIMARY DATA">
    <FormInput label="PLANT CODE" value={data.plantCode} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
    <FormInput label="PLANT NAME" value={data.plantName} onChange={(v: string) => onChange({...data, plantName: v})} disabled={disabled} /></SectionGrouping>
    <SectionGrouping title="LOCATION DATA"><FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
    <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
    <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
    <FormInput label="STATE" value={data.state} onChange={(v: string) => onChange({...data, state: v})} disabled={disabled} /></SectionGrouping></div>;
}

function CompanyForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("Error: Image size must be under 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ ...data, logo: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return <div className="space-y-10">
    <SectionGrouping title="PLANT ASSIGNMENT">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Assigned Plants:</label>
        <div className="flex flex-wrap gap-2 w-full max-w-[600px]">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none transition-all", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300 hover:border-blue-500")}>{p}</button>)}</div>
      </div>
    </SectionGrouping>
    <SectionGrouping title="IDENTIFICATION">
      <FormInput label="COMPANY CODE" value={data.companyCode} onChange={(v: string) => onChange({...data, companyCode: v})} disabled={disabled} />
      <FormInput label="COMPANY NAME" value={data.companyName} onChange={(v: string) => onChange({...data, companyName: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="LOCATION">
      <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
      <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
      <FormInput label="STATE" value={data.state} onChange={(v: string) => onChange({...data, state: v})} disabled={disabled} />
      <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="TAX & ASSETS">
      <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
      <FormInput label="PAN" value={data.pan} onChange={(v: string) => onChange({...data, pan: v})} disabled={disabled} />
      <FormInput label="WEBSITE" value={data.website} onChange={(v: string) => onChange({...data, website: v})} disabled={disabled} />
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Company Logo:</label>
        <div className="flex items-center gap-4">
          <input type="file" accept="image/*" onChange={handleFile} disabled={disabled} className="hidden" id="fm01-logo-up" />
          <label htmlFor="fm01-logo-up" className={cn("px-4 h-8 border border-slate-400 bg-white flex items-center text-[10px] font-black cursor-pointer shadow-sm uppercase tracking-widest", disabled && "opacity-50 cursor-not-allowed")}>
            {data.logo ? "CHANGE IMAGE" : "UPLOAD LOGO"}
          </label>
          {data.logo && (
            <div className="h-10 w-10 border border-slate-300 overflow-hidden bg-white shrink-0 relative group">
              <Image src={data.logo} alt="Logo" fill className="object-contain" unoptimized />
              {!disabled && <button onClick={() => onChange({...data, logo: ''})} className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Trash2 className="h-3 w-3" /></button>}
            </div>
          )}
        </div>
      </div>
    </SectionGrouping>
    <SectionGrouping title="TERMS & CONDITIONS">
       <div className="flex items-start gap-8 group">
          <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">TERMS:</label>
          <textarea 
            value={Array.isArray(data.termsAndConditions) ? data.termsAndConditions.join('\n') : (data.termsAndConditions || '')} 
            onChange={(e) => onChange({...data, termsAndConditions: e.target.value.split('\n')})} 
            disabled={disabled}
            className="w-[450px] h-32 border border-slate-400 bg-white px-2 py-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm disabled:opacity-60 resize-none"
            placeholder="ENTER TERMS AND CONDITIONS (ONE PER LINE)..."
          />
       </div>
    </SectionGrouping>
  </div>;
}

function VendorForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  
  return <div className="space-y-10">
    <SectionGrouping title="PLANT MAPPING">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Assigned Plants:</label>
        <div className="flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none transition-all", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{p}</button>)}</div>
      </div>
    </SectionGrouping>
    <SectionGrouping title="IDENTIFICATION">
      <FormInput label="VENDOR CODE" value={data.vendorCode} disabled={true} placeholder="AUTO-GEN" />
      <FormInput label="VENDOR NAME" value={data.vendorName} onChange={(v: string) => onChange({...data, vendorName: v})} disabled={disabled} />
      <FormInput label="VENDOR FIRM" value={data.vendorFirmName} onChange={(v: string) => onChange({...data, vendorFirmName: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="DETAILS">
      <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
      <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
      <FormInput label="SPECIAL ROUTE" value={data.route} onChange={(v: string) => onChange({...data, route: v})} disabled={disabled} />
    </SectionGrouping></div>;
}

function CustomerForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  return <div className="space-y-10">
    <SectionGrouping title="PLANT">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Assigned Plants:</label>
        <div className="flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none transition-all", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{p}</button>)}</div>
      </div>
    </SectionGrouping>
    <SectionGrouping title="IDENTIFICATION">
      <FormInput label="CUSTOMER CODE" value={data.customerCode} onChange={(v: string) => onChange({...data, customerCode: v})} disabled={disabled} />
      <FormInput label="CUSTOMER NAME" value={data.customerName} onChange={(v: string) => onChange({...data, customerName: v})} disabled={disabled} />
      <FormSelect label="CUSTOMER TYPE" value={data.customerType} options={["Consignor", "Consignee - Ship to Party"]} onChange={(v: string) => onChange({...data, customerType: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="LOCATION">
      <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
      <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
      <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
      <FormInput 
        label="MOBILE NO." 
        value={data.mobile} 
        onChange={(v: string) => {
          const val = v.replace(/\D/g, '').slice(0, 10);
          onChange({...data, mobile: val});
        }} 
        disabled={disabled} 
        leftElement={<span className="text-[12px] font-black text-slate-400">+91</span>}
      />
      <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
    </SectionGrouping></div>;
}

function SalesOrderForm({ data, onChange, disabled, allPlants, allCustomers, trips, screen }: any) {
  const pOpts = (allPlants || []).map((p: any) => p.plantCode);
  const filtered = (allCustomers || []).filter((c: any) => c.plantCodes?.includes(data.plantCode));
  const cons = filtered.filter((c: any) => c.customerType === 'Consignor');
  const ships = filtered.filter((c: any) => c.customerType === 'Consignee - Ship to Party');

  const dispatchWeight = React.useMemo(() => {
    if (!data.id || !trips) return 0;
    return trips.filter((t: any) => t.saleOrderId === data.id).reduce((acc: number, t: any) => acc + (parseFloat(t.assignWeight) || 0), 0);
  }, [data.id, trips]);

  const balanceWeight = (parseFloat(data.weight) || 0) - dispatchWeight;

  React.useEffect(() => {
    if (!data.saleOrderDate && !disabled && screen === 'VA01') {
      onChange({ ...data, saleOrderDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
    }
  }, [data.saleOrderDate, disabled, onChange, data, screen]);
  
  return <div className="space-y-10">
    <SectionGrouping title="HEADER">
      <FormSelect label="PLANT" value={data.plantCode} options={pOpts} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
      <FormInput label="SALE ORDER" value={data.saleOrder} onChange={(v: string) => onChange({...data, saleOrder: v})} disabled={disabled} />
      <FormInput label="BOOKED DATE TIME" type="datetime-local" value={data.saleOrderDate} onChange={(v: string) => onChange({...data, saleOrderDate: v})} disabled={disabled} />
      
      {(screen === 'VA02' || screen === 'VA03') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 pt-4 border-t border-slate-200 mt-6 animate-fade-in">
          <FormSearchInput 
            label="CONSIGNOR" 
            value={data.consignor} 
            options={cons.map(c => c.customerName + ' - ' + c.city)} 
            onChange={(v: string) => {
              const matching = cons.find(c => (c.customerName + ' - ' + c.city).toUpperCase() === v?.toUpperCase());
              const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v;
              onChange({...data, consignor: nameOnly, from: matching?.city || ''});
            }} 
            disabled={disabled} 
          />
          <FormInput label="FROM" value={data.from} disabled={true} />
          <FormSearchInput 
            label="CONSIGNEE" 
            value={data.consignee} 
            options={ships.map(c => c.customerName + ' - ' + c.city)} 
            onChange={(v: string) => {
              const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v;
              onChange({...data, consignee: nameOnly});
            }} 
            disabled={disabled} 
          />
          <FormSearchInput 
            label="SHIP TO PARTY" 
            value={data.shipToParty} 
            options={ships.map(c => c.customerName + ' - ' + c.city)} 
            onChange={(v: string) => {
              const matching = ships.find(c => (c.customerName + ' - ' + c.city).toUpperCase() === v?.toUpperCase());
              const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v;
              onChange({...data, shipToParty: nameOnly, destination: matching?.city || '', deliveryAddress: matching?.address || ''});
            }} 
            disabled={disabled} 
          />
          <FormInput label="DESTINATION" value={data.destination} disabled={true} />
          <FormInput label="SALE ORDER WEIGHT" type="number" value={data.weight} onChange={(v: string) => onChange({...data, weight: v})} disabled={disabled} />
          <FormInput label="DISPATCH WEIGHT" value={dispatchWeight} disabled={true} />
          <FormInput label="BALANCE WEIGHT" value={balanceWeight.toFixed(2)} disabled={true} />
          <FormSelect label="STATUS" value={data.status} options={["Active", "Short closed"]} onChange={(v: string) => onChange({...data, status: v})} disabled={disabled} />
        </div>
      )}
    </SectionGrouping>
    {screen === 'VA01' && (
      <SectionGrouping title="COORDINATION">
        <FormSearchInput 
          label="CONSIGNOR" 
          value={data.consignor} 
          options={cons.map(c => c.customerName + ' - ' + c.city)} 
          onChange={(v: string) => {
            const matching = cons.find(c => (c.customerName + ' - ' + c.city).toUpperCase() === v?.toUpperCase());
            const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v;
            onChange({...data, consignor: nameOnly, from: matching?.city || ''});
          }} 
          disabled={disabled} 
        />
        <FormInput label="FROM" value={data.from} disabled={true} />
        <FormSearchInput 
          label="CONSIGNEE" 
          value={data.consignee} 
          options={ships.map(c => c.customerName + ' - ' + c.city)} 
          onChange={(v: string) => {
            const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v;
            onChange({...data, consignee: nameOnly});
          }} 
          disabled={disabled} 
        />
        <FormSearchInput 
          label="SHIP TO PARTY" 
          value={data.shipToParty} 
          options={ships.map(c => c.customerName + ' - ' + c.city)} 
          onChange={(v: string) => {
            const matching = ships.find(c => (c.customerName + ' - ' + c.city).toUpperCase() === v?.toUpperCase());
            const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v;
            onChange({...data, shipToParty: nameOnly, destination: matching?.city || '', deliveryAddress: matching?.address || ''});
          }} 
          disabled={disabled} 
        />
        <FormInput label="DESTINATION" value={data.destination} disabled={true} />
        <FormInput label="SALE ORDER WEIGHT" type="number" value={data.weight} onChange={(v: string) => onChange({...data, weight: v})} disabled={disabled} />
        <FormSelect label="UOM" value={data.weightUom} options={["MT", "LTR"]} onChange={(v: string) => onChange({...data, weightUom: v})} disabled={disabled} />
      </SectionGrouping>
    )}
  </div>;
}

function UserForm({ data, onChange, disabled, allPlants }: any) {
  const [showPassword, setShowPassword] = React.useState(false);
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handlePToggle = (p: string) => { if (disabled) return; const curr = data.plants || []; onChange({...data, plants: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  const handleTToggle = (c: string) => { if (disabled) return; const curr = data.tcodes || []; onChange({...data, tcodes: curr.includes(c) ? curr.filter((i: string) => i !== c) : [...curr, c]}); };
  
  return <div className="space-y-12">
    <SectionGrouping title="USER IDENTIFICATION">
      <FormInput label="FULL NAME" value={data.fullName} onChange={(v: string) => onChange({...data, fullName: v})} disabled={disabled} />
      <FormInput label="USERNAME" value={data.username} onChange={(v: string) => onChange({...data, username: v})} disabled={disabled} />
      <FormInput label="PASSWORD" type={showPassword ? "text" : "password"} value={data.password} onChange={(v: string) => onChange({...data, password: v})} disabled={disabled} rightElement={<button onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-blue-900">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
      <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="PLANT ACCESS">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Authorized Plants:</label>
        <div className="flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handlePToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none", data.plants?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{p}</button>)}</div>
      </div>
    </SectionGrouping>
    <SectionGrouping title="TRANSACTION ACCESS">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">T-Code Registry:</label>
        <div className="flex flex-wrap gap-2">{MASTER_TCODES.map(t => <button key={t.code} onClick={() => handleTToggle(t.code)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none", data.tcodes?.includes(t.code) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{t.code}</button>)}</div>
      </div>
    </SectionGrouping>
  </div>;
}

function CancelOrderForm({ data, onChange, allOrders, allTrips, onPost, onCancel }: any) {
  const stats = React.useMemo(() => {
    if (!data.id || !allTrips) return { tot: 0, ass: 0, bal: 0, uom: '' };
    const tot = parseFloat(data.weight) || 0;
    const ass = allTrips.filter((t: any) => t.saleOrderId === data.id).reduce((acc: number, t: any) => acc + (parseFloat(t.assignWeight) || 0), 0);
    return { tot, ass, bal: tot - ass, uom: data.weightUom || 'MT' };
  }, [data, allTrips]);

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const o = allOrders?.find((ord: any) => (ord.saleOrder || ord.id).toString().toUpperCase() === data.saleOrder?.toString().toUpperCase());
      if (o) onChange({ ...data, ...o });
    }
  };

  return (
    <div className="space-y-12">
      <SectionGrouping title="CANCELLATION / SHORT CLOSE">
        <div className="flex items-center gap-8">
          <label className="text-[12px] font-bold text-red-600 w-[180px] text-right shrink-0 uppercase">Order Number:</label>
          <input 
            className="h-10 w-[320px] border border-red-200 px-3 text-[12px] font-black outline-none bg-red-50/20 focus:ring-1 focus:ring-red-500 uppercase" 
            placeholder="" 
            value={data.saleOrder || ''} 
            onChange={e => onChange({ ...data, saleOrder: e.target.value.toUpperCase() })} 
            onKeyDown={handleEnter} 
          />
        </div>
      </SectionGrouping>

      {data.id && (
        <div className="space-y-6 animate-fade-in">
          <SectionGrouping title="ORDER REGISTRY DATA">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4">
              <FormInput label="PLANT" value={data.plantCode} disabled={true} />
              <FormInput label="CONSIGNOR" value={data.consignor} disabled={true} />
              <FormInput label="FROM" value={data.from} disabled={true} />
              <FormInput label="CONSIGNEE" value={data.consignee} disabled={true} />
              <FormInput label="SHIP TO PARTY" value={data.shipToParty} disabled={true} />
              <FormInput label="DESTINATION" value={data.destination} disabled={true} />
              <FormInput label="SALE ORDER QTY" value={`${stats.tot} ${stats.uom}`} disabled={true} />
              <FormInput label="BALANCE QTY" value={`${stats.bal.toFixed(2)} ${stats.uom}`} disabled={true} />
            </div>
          </SectionGrouping>

          <div className="pl-[212px] flex gap-4">
            <Button onClick={onCancel} variant="outline" className="h-10 px-8 text-[10px] font-black uppercase border-slate-400">Exit</Button>
            <Button 
              onClick={onPost} 
              disabled={stats.bal <= 0}
              className={cn(
                "font-black uppercase text-[10px] px-10 h-10 shadow-lg",
                stats.bal <= 0 ? "bg-slate-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              {stats.ass === 0 ? "Execute Cancellation" : "Execute Short Close"}
            </Button>
          </div>
          
          {stats.bal <= 0 && (
            <div className="pl-[212px] mt-4">
              <p className="text-[10px] font-black text-red-600 uppercase italic">
                * Error: Full quantity assigned. Action not permitted for completed nodes.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RegistryList({ onSelectItem, listData, activeScreen }: any) {
  const isSuPage = activeScreen?.startsWith('SU');
  const isVendorRegistry = activeScreen?.startsWith('XK');
  const isCustomerRegistry = activeScreen?.startsWith('XD');
  const headers = isSuPage 
    ? ['Full Name', 'Username', 'Authentication', 'Authorized HUB'] 
    : isVendorRegistry 
      ? ['Vendor Code', 'Vendor Name', 'Vendor Firm Name', 'Mobile', 'Special Route'] 
      : isCustomerRegistry
        ? ['Customer Code', 'Customer Name', 'Type / Details', 'Mobile No.', 'Sync Hub']
        : ['ID', 'Name / Description', 'Type / Details', 'Sync Hub'];
  
  return <div className="w-full bg-white border border-slate-300 shadow-sm overflow-hidden">
    <table className="w-full text-left border-collapse min-w-[700px]">
      <thead className="bg-[#f0f0f0] border-b-2 border-slate-300 h-10">
        <tr className="text-[10px] font-black uppercase text-slate-600">
          {headers.map(c => <th key={c} className="p-3 border-r border-slate-200 last:border-0">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {listData?.map((item: any) => (
          <tr key={item.id} onClick={() => onSelectItem(item)} className="border-b border-slate-100 hover:bg-[#e8f0fe] cursor-pointer transition-colors text-[11px] font-bold group">
            {isSuPage ? (
              <><td className="p-4 font-black text-[#0056d2] uppercase">{item.fullName}</td><td className="p-4 uppercase">{item.username}</td><td className="p-4"><span className="bg-slate-50 px-2 py-1 border border-slate-200 text-slate-500 font-mono">{item.password}</span></td><td className="p-4 uppercase text-slate-500 italic tracking-tight">{item.plants?.join(', ') || 'NOT REGISTERED'}</td></>
            ) : isVendorRegistry ? (
              <><td className="p-3 font-black text-[#0056d2]">{item.vendorCode}</td><td className="p-3 uppercase">{item.vendorName}</td><td className="p-3 uppercase">{item.vendorFirmName}</td><td className="p-3">{item.mobile}</td><td className="p-3 italic text-slate-500">{item.route}</td></>
            ) : isCustomerRegistry ? (
              <>
                <td className="p-3 font-black text-[#0056d2]">{item.customerCode || item.id.slice(0, 8)}</td>
                <td className="p-3 uppercase">{item.customerName}</td>
                <td className="p-3 italic text-slate-500">{item.city} - {item.customerType}</td>
                <td className="p-3 font-black">{item.mobile ? `+91 ${item.mobile}` : '-'}</td>
                <td className="p-3 text-slate-400">{format(new Date(item.updatedAt || new Date()), 'dd-MM-yyyy')}</td>
              </>
            ) : (
              <><td className="p-3 font-black text-[#0056d2]">{item.saleOrder || item.plantCode || item.customerCode || item.vendorCode || item.companyCode || item.id.slice(0, 8)}</td><td className="p-3 uppercase">{item.customerName || item.plantName || item.vendorName || item.companyName || item.fullName || item.username || `${item.consignor} → ${item.consignee}`}</td><td className="p-3 italic text-slate-500">{item.city || item.customerType || item.vendorCode || 'DATA'}</td><td className="p-3 text-slate-400">{format(new Date(item.updatedAt || new Date()), 'dd-MM-yyyy')}</td></>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}

function TripBoard({ orders, trips, vendors, plants, companies, customers, onStatusUpdate, viewMode, setViewMode, trackingNode, setTrackingNode, settings }: any) {
  const { user } = useUser(); const db = useFirestore(); 
  const [activeTab, setActiveTab] = React.useState('Open Orders'); 
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null); 
  const [isPopupOpen, setIsPopupOpen] = React.useState(false); 
  const [assignData, setAssignData] = React.useState<any>({ fleetType: 'Own Vehicle', isFixedRate: false, rate: 0, freightAmount: 0 }); 
  const [vendorSearch, setVendorSearch] = React.useState(''); 
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 15;
  const [fromDate, setFromDate] = React.useState(format(subDays(new Date(), 4), 'yyyy-MM-dd'));
  const [toDate, setToDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [isOutPopupOpen, setIsOutPopupOpen] = React.useState(false);
  const [outData, setOutData] = React.useState<any>({ tripId: '', vehicleNumber: '', route: '', shipToParty: '', cnNo: '', date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  const [isAssignmentPopupOpen, setIsAssignmentPopupOpen] = React.useState(false);
  const [selectedTripForAssignment, setSelectedTripForAssignment] = React.useState<any>(null);
  const [isArrivedPopupOpen, setIsArrivedPopupOpen] = React.useState(false);
  const [arrivedData, setArrivedData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), tripId: '', vehicleNumber: '', route: '', shipToParty: '', cnNo: '' });
  const [isRejectPopupOpen, setIsRejectPopupOpen] = React.useState(false);
  const [rejectData, setRejectData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), remark: '', trip: null });
  const [isUnloadPopupOpen, setIsUnloadPopupOpen] = React.useState(false);
  const [unloadData, setUnloadData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), trip: null });
  const [isPodPopupOpen, setIsPodPopupOpen] = React.useState(false);
  const [selectedTripForPod, setSelectedTripForPod] = React.useState<any>(null);
  const [podFile, setPodFile] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isClosedViewPopupOpen, setIsClosedViewPopupOpen] = React.useState(false);
  const [selectedTripForClosed, setSelectedTripForClosed] = React.useState<any>(null);
  const [isCnPopupOpen, setIsCnPopupOpen] = React.useState(false);
  const [selectedTripForCn, setSelectedTripForCn] = React.useState<any>(null);
  const [cnFormData, setCnFormData] = React.useState<any>({ cnNo: '', cnDate: format(new Date(), 'yyyy-MM-dd'), paymentTerms: 'PAID', carrierName: '', items: [{ invoiceNo: '', ewaybillNo: '', product: '', unit: '', uom: 'Bag' }] });
  const [isCnPreviewOpen, setIsCnPreviewOpen] = React.useState(false);
  const [selectedTripForPreview, setSelectedTripForPreview] = React.useState<any>(null);
  const [previewDeliveryAddress, setPreviewDeliveryAddress] = React.useState('');
  const [isAddressEditable, setIsAddressEditable] = React.useState(false);
  const [gpsData, setGpsData] = React.useState<any[]>([]);

  const [isDelayRemarkPopupOpen, setIsDelayRemarkPopupOpen] = React.useState(false);
  const [selectedOrderForRemark, setSelectedOrderForRemark] = React.useState<any>(null);
  const [delayRemarkInput, setDelayRemarkInput] = React.useState('');

  const [isResentPopupOpen, setIsResentPopupOpen] = React.useState(false);
  const [resentData, setResentData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), trip: null });
  const [isSrnPopupOpen, setIsSrnPopupOpen] = React.useState(false);
  const [srnData, setSrnData] = React.useState<any>({ srnNo: '', srnDate: format(new Date(), 'yyyy-MM-dd'), trip: null });
  const [isPodChangePopupOpen, setIsPodChangePopupOpen] = React.useState(false);
  const [selectedTripForPodChange, setSelectedTripForPodChange] = React.useState<any>(null);
  const [changePodFile, setChangePodFile] = React.useState<string | null>(null);
  const changePodInputRef = React.useRef<HTMLInputElement>(null);

  const compressImage = async (base64: string): Promise<string> => {
    if (!base64.startsWith('data:image/')) return base64;
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 1600;
        const maxHeight = 1600;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        } else {
          if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        }
        canvas.width = width; canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const fetchGps = React.useCallback(async () => {
    try {
      const res = await fetch('/api/gps');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.list) setGpsData(json.data.list);
      }
    } catch (e) {}
  }, []);
  
  React.useEffect(() => { 
    fetchGps(); const i = setInterval(fetchGps, 30000); return () => clearInterval(i); 
  }, [fetchGps]);

  const handleGeneratePdf = React.useCallback(() => {
    const originalTitle = document.title;
    document.title = selectedTripForPreview?.cnNo || 'CN_Document';
    window.print();
    document.title = originalTitle;
  }, [selectedTripForPreview]);

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];
  const getStatsLocal = React.useCallback((o: any) => { const tot = parseFloat(o.weight) || 0; const ass = trips?.filter((t: any) => t.saleOrderId === o.id).reduce((a: number, t: any) => a + (parseFloat(t.assignWeight) || 0), 0) || 0; return { tot, ass, bal: tot - ass, uom: o.weightUom || 'MT' }; }, [trips]);
  const fOrders = React.useMemo(() => (orders || []).filter(o => o.status !== 'CANCELLED' && o.status !== 'Short closed').map(o => { const stats = getStatsLocal(o); const route = (o.from && o.destination) ? `${o.from} → ${o.destination}` : (o.route || ''); return { ...o, ...stats, route }; }).filter(o => { const bal = o.bal > 0; const itemDate = new Date(o.createdAt); return bal && isWithinInterval(itemDate, { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) }); }), [orders, getStatsLocal, fromDate, toDate]);
  const fTrips = React.useMemo(() => { if (!trips) return []; const map: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' }; return trips.filter(t => t.status === map[activeTab]).map(t => { const route = (t.from && t.destination && !t.route?.includes('→')) ? `${t.from} → ${t.destination}` : t.route; return { ...t, route }; }).filter(t => isWithinInterval(new Date(t.createdAt), { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) })); }, [trips, activeTab, fromDate, toDate]);
  const tabCounts = React.useMemo(() => { const counts: Record<string, number> = {}; counts['Open Orders'] = fOrders.length; ['Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'].forEach(t => { const map: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' }; counts[t] = (trips || []).filter(tr => tr.status === map[t] && isWithinInterval(new Date(tr.createdAt), { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) })).length; }); return counts; }, [fOrders, trips, fromDate, toDate]);
  const filteredData = React.useMemo(() => { const rawData = activeTab === 'Open Orders' ? fOrders : fTrips; if (!searchQuery) return rawData; const lowerQuery = searchQuery.toLowerCase(); return rawData.filter((item: any) => Object.values(item).some(val => String(val).toLowerCase().includes(lowerQuery))); }, [activeTab, fOrders, fTrips, searchQuery]);
  const paginatedData = React.useMemo(() => { const start = (currentPage - 1) * itemsPerPage; return filteredData.slice(start, start + itemsPerPage); }, [filteredData, currentPage]);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleAssign = (o: any) => { 
    setSelectedOrder(o); 
    setAssignData({ 
      plantCode: o.plantCode, 
      consignee: o.consignee, 
      shipToParty: o.shipToParty, 
      route: o.route || '', 
      orderQty: `${o.bal} ${o.uom}`, 
      fleetType: 'Own Vehicle', 
      assignWeight: o.bal, 
      isFixedRate: false, 
      rate: 0, 
      freightAmount: 0,
      assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      vendorName: '',
      vendorCode: '',
      vendorFirmName: '',
      vendorMobile: '',
      arrangeBy: '',
      vehicleNumber: '',
      driverMobile: ''
    }); 
    setIsPopupOpen(true); 
  };
  
  const handleDelayRemark = (o: any) => {
    setSelectedOrderForRemark(o);
    setDelayRemarkInput(o.delayRemark || '');
    setIsDelayRemarkPopupOpen(true);
  };

  const handlePostDelayRemark = () => {
    if (!selectedOrderForRemark) return;
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', selectedOrderForRemark.id), {
      delayRemark: delayRemarkInput,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setIsDelayRemarkPopupOpen(false);
    onStatusUpdate({ text: 'Delay Remark Saved', type: 'success' });
  };

  const handleAssignmentClick = (t: any) => { 
    setSelectedTripForAssignment(t); 
    setAssignData({ 
      vehicleNumber: t.vehicleNumber, 
      driverMobile: t.driverMobile, 
      plantCode: t.plantCode, 
      shipToParty: t.shipToParty, 
      route: t.route
    }); 
    setIsAssignmentPopupOpen(true); 
  };

  const handleUnassignTrip = () => {
    if (!selectedTripForAssignment) return;
    deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForAssignment.id));
    onStatusUpdate({ text: `Trip Unassigned Successfully`, type: 'success' });
    setIsAssignmentPopupOpen(false);
  };
  
  const handlePodFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2048 * 1024) { alert("Error: File size must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setPodFile(ev.target?.result as string); };
    reader.readAsDataURL(file);
  };

  const handleAssignmentPost = () => { 
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForAssignment.id), { 
      vehicleNumber: assignData.vehicleNumber.toUpperCase(), 
      driverMobile: assignData.driverMobile, 
      updatedAt: new Date().toISOString() 
    }, { merge: true }); 
    onStatusUpdate({ text: `Assignment Updated`, type: 'success' }); 
    setIsAssignmentPopupOpen(false); 
  };

  const handleCreateTrip = () => {
    if (!assignData.vehicleNumber) { onStatusUpdate({ text: 'Error: Vehicle Number Required', type: 'error' }); return; }
    let tripId = ''; let isUnique = false;
    while (!isUnique) {
      const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
      tripId = `T${randomDigits}`;
      isUnique = !trips?.some((t: any) => t.tripId === tripId);
    }
    const docId = crypto.randomUUID();
    const payload = {
      id: docId, tripId, saleOrderId: selectedOrder.id, saleOrderNumber: selectedOrder.saleOrder,
      plantCode: selectedOrder.plantCode, consignor: selectedOrder.consignor, from: selectedOrder.from,
      consignee: selectedOrder.consignee, shipToParty: selectedOrder.shipToParty, route: selectedOrder.route,
      vehicleNumber: assignData.vehicleNumber.toUpperCase(), driverMobile: assignData.driverMobile,
      fleetType: assignData.fleetType, assignWeight: parseFloat(assignData.assignWeight) || 0,
      weightUom: selectedOrder.uom, rate: parseFloat(assignData.rate) || 0,
      freightAmount: parseFloat(assignData.freightAmount) || 0, isFixedRate: assignData.isFixedRate,
      vendorName: assignData.vendorName, vendorCode: assignData.vendorCode, vendorFirmName: assignData.vendorFirmName,
      status: 'LOADING', createdAt: new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', docId), payload, { merge: true });
    setIsPopupOpen(false);
    onStatusUpdate({ text: `Trip ${tripId} Created`, type: 'success' });
  };

  const handleOpenMapPage = (t: any, gps: any) => { setTrackingNode({ trip: t, gps }); setViewMode('tracking'); };
  
  const handleOutVehicle = (t: any) => { 
    setOutData({ 
      tripId: t.tripId, id: t.id, vehicleNumber: t.vehicleNumber, route: t.route, shipToParty: t.shipToParty, 
      cnNo: t.cnNo || 'N/A', date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') 
    }); 
    setIsOutPopupOpen(true); 
  };

  const handleConfirmOut = () => { 
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', outData.id), { 
      status: 'IN-TRANSIT', outDate: outData.date, outTime: outData.time, updatedAt: new Date().toISOString() 
    }, { merge: true }); 
    setIsOutPopupOpen(false); onStatusUpdate({ text: `Vehicle IN-TRANSIT`, type: 'success' }); 
  };

  const handleArrivedAction = (t: any) => { 
    setArrivedData({ 
      id: t.id, tripId: t.tripId, vehicleNumber: t.vehicleNumber, route: t.route, shipToParty: t.shipToParty, 
      cnNo: t.cnNo || 'N/A', date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') 
    }); 
    setIsArrivedPopupOpen(true); 
  };

  const handleArrivedPost = () => { 
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', arrivedData.id), { 
      status: 'ARRIVED', arrivedDate: arrivedData.date, arrivedTime: arrivedData.time, updatedAt: new Date().toISOString() 
    }, { merge: true }); 
    setIsArrivedPopupOpen(false); onStatusUpdate({ text: `Arrived Registry Synced`, type: 'success' }); 
  };

  const handleRejectAction = (t: any) => { setRejectData({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), remark: '', trip: t }); setIsRejectPopupOpen(true); };
  const handleRejectPost = () => { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', rejectData.trip.id), { status: 'REJECTION', rejectionDate: rejectData.date, rejectionTime: rejectData.time, rejectionRemark: rejectData.remark, updatedAt: new Date().toISOString() }, { merge: true }); setIsRejectPopupOpen(false); onStatusUpdate({ text: `Rejected`, type: 'success' }); };
  const handleUnloadAction = (t: any) => { setUnloadData({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), trip: t }); setIsUnloadPopupOpen(true); };
  const handleUnloadPost = () => { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', unloadData.trip.id), { status: 'POD', unloadDate: unloadData.date, unloadTime: unloadData.time, updatedAt: new Date().toISOString() }, { merge: true }); setIsUnloadPopupOpen(false); onStatusUpdate({ text: `Unload Synced`, type: 'success' }); };
  const handlePodUploadAction = (t: any) => { setSelectedTripForPod(t); setPodFile(null); setIsPodPopupOpen(true); };
  const handlePodPost = async () => { if (!podFile) return; const compressed = await compressImage(podFile); setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForPod.id), { status: 'CLOSED', podFile: compressed, podUploadedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true }); setIsPodPopupOpen(false); onStatusUpdate({ text: `CLOSED`, type: 'success' }); };
  const handleViewAction = (t: any) => { setSelectedTripForClosed(t); setPodFile(t.podFile || null); setIsClosedViewPopupOpen(true); };
  
  const handleDownloadPod = (t: any) => {
    if (!t.podFile) { onStatusUpdate({ text: 'Error: No POD file found', type: 'error' }); return; }
    const link = document.createElement('a');
    link.href = t.podFile; link.download = `POD_${t.tripId}.png`; document.body.appendChild(link);
    link.click(); document.body.removeChild(link);
  };

  const handleResentAction = (t: any) => { setResentData({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), trip: t }); setIsResentPopupOpen(true); };
  const handleResentPost = () => { if (!resentData.trip) return; deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', resentData.trip.id)); setIsResentPopupOpen(false); onStatusUpdate({ text: `Trip Re-sent to Open Order Registry`, type: 'success' }); };
  const handleSrnAction = (t: any) => { setSrnData({ srnNo: '', srnDate: format(new Date(), 'yyyy-MM-dd'), trip: t }); setIsSrnPopupOpen(true); };
  const handleSrnPost = () => { if (!srnData.srnNo || !srnData.trip) return; setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', srnData.trip.id), { status: 'CLOSED', srnNo: srnData.srnNo.toUpperCase(), srnDate: srnData.srnDate, updatedAt: new Date().toISOString() }, { merge: true }); setIsSrnPopupOpen(false); onStatusUpdate({ text: `SRN Registered & Closed`, type: 'success' }); };
  const handlePodChangeAction = (t: any) => { setSelectedTripForPodChange(t); setChangePodFile(null); setIsPodChangePopupOpen(true); };
  const handlePodChangeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; if (file.size > 2048 * 1024) { alert("Error: File size must be under 2MB"); return; }
    const reader = new FileReader(); reader.onload = (ev) => { setChangePodFile(ev.target?.result as string); }; reader.readAsDataURL(file);
  };
  const handlePodChangePost = async () => {
    if (!changePodFile || !selectedTripForPodChange) return; const compressed = await compressImage(changePodFile);
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForPodChange.id), { podFile: compressed, podUploadedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
    setIsPodChangePopupOpen(false); onStatusUpdate({ text: `POD Document Updated`, type: 'success' });
  };

  const handleAddCn = (t: any) => { 
    setSelectedTripForCn(t); 
    const carrier = (companies || []).find((c: any) => c.plantCodes?.includes(t.plantCode))?.companyName || '';
    setCnFormData({ 
      cnNo: t.cnNo || '', cnDate: t.cnDate || format(new Date(), 'yyyy-MM-dd'), 
      paymentTerms: t.paymentTerms || 'PAID', carrierName: carrier,
      items: t.cnItems || [{ invoiceNo: '', ewaybillNo: '', product: '', unit: '', uom: 'Bag' }] 
    }); 
    setIsCnPopupOpen(true); 
  };

  const handleCnPost = () => { 
    if (!cnFormData.cnNo) { onStatusUpdate({ text: 'Error: CN Number Required', type: 'error' }); return; }
    const duplicate = trips?.find((t: any) => t.id !== selectedTripForCn.id && t.cnNo?.toUpperCase() === cnFormData.cnNo.toUpperCase());
    if (duplicate) { onStatusUpdate({ text: `Error: CN ${cnFormData.cnNo} already registered`, type: 'error' }); return; }
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForCn.id), { 
      cnNo: cnFormData.cnNo.toUpperCase(), cnDate: cnFormData.cnDate, paymentTerms: cnFormData.paymentTerms, 
      carrierName: cnFormData.carrierName, cnItems: cnFormData.items, updatedAt: new Date().toISOString() 
    }, { merge: true }); 
    setIsCnPopupOpen(false); onStatusUpdate({ text: `CN Registry Synchronized`, type: 'success' }); 
  };

  const handleCnPreviewClick = (t: any) => { 
    const order = (orders || []).find((o: any) => o.id === t.saleOrderId); 
    const carrier = (companies || []).find((c: any) => c.plantCodes?.includes(t.plantCode));
    const consignorMaster = (customers || []).find((c: any) => (c.customerName?.toUpperCase() === order?.consignor?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === order?.consignor?.toUpperCase()));
    const consigneeMaster = (customers || []).find((c: any) => (c.customerName?.toUpperCase() === order?.consignee?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === order?.consignee?.toUpperCase()));
    const shipToMaster = (customers || []).find((c: any) => (c.customerName?.toUpperCase() === order?.shipToParty?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === order?.shipToParty?.toUpperCase()));
    const dataForPreview = { ...t, order, carrier, consignorMaster, consigneeMaster, shipToMaster };
    setSelectedTripForPreview(dataForPreview); 
    const fullShipToAddr = [shipToMaster?.address, shipToMaster?.city, shipToMaster?.postalCode].filter(Boolean).join(', ');
    setPreviewDeliveryAddress(fullShipToAddr || order?.deliveryAddress || '');
    setIsAddressEditable(false); setIsCnPreviewOpen(true); 
  };

  const cnTableTotal = React.useMemo(() => {
    const total = cnFormData.items?.reduce((acc: number, item: any) => acc + (parseFloat(item.unit) || 0), 0) || 0;
    const uoms = Array.from(new Set(cnFormData.items?.map((i: any) => i.uom).filter(Boolean)));
    const uom = uoms.length > 1 ? 'Combined' : (uoms[0] || '');
    return { total, uom };
  }, [cnFormData.items]);

  return <div className="flex flex-col h-full space-y-0">
    <div className="bg-white border-b border-slate-300 px-8 py-3 mb-4 print:hidden">
       <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">TRIP BOARD CONTROL</h2>
    </div>
    <div className="px-8 space-y-4">
      <div className="flex flex-col md:flex-row items-center gap-6 bg-white border border-slate-300 p-4 rounded-none shadow-sm print:hidden">
        <div className="flex items-center gap-4 flex-1">
          <label className="text-[11px] font-black uppercase text-slate-500 min-w-[60px]">Search:</label>
          <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="h-8 w-full max-sm border border-slate-300 px-3 text-[11px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase tracking-widest" placeholder="FILTER..." />
        </div>
        <div className="flex items-center gap-6 border-l border-slate-200 pl-6">
          <div className="flex items-center gap-3"><label className="text-[10px] font-black uppercase text-slate-400">From:</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 border border-slate-300 px-2 text-[10px] font-black outline-none" /></div>
          <div className="flex items-center gap-3"><label className="text-[10px] font-black uppercase text-slate-400">To:</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 border border-slate-300 px-2 text-[10px] font-black outline-none" /></div>
        </div>
      </div>
      <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 overflow-x-auto print:hidden">{TABS.map(t => (<button key={t} onClick={() => setActiveTab(t)} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-r border-slate-300 transition-all", activeTab === t ? "bg-white text-[#0056d2] -mb-px" : "text-slate-500 hover:text-slate-700")}>{t} ({tabCounts[t] || 0})</button>))}</div>
      <div className="flex-1 flex flex-col overflow-hidden bg-white border border-slate-300"><div className="flex-1 overflow-auto"><table className="w-full text-left border-collapse min-w-[1000px]"><thead><tr className="bg-[#f0f0f0] text-[9px] font-black uppercase sticky top-0 border-b border-slate-300 z-10 print:hidden">{activeTab === 'Open Orders' ? ['Plant', 'Sale Order', 'Consignor', 'Consignee', 'Ship to Party', 'Route', 'Order Qty', 'Assign Qty', 'Balance Qty', 'Action'].map(h => <th key={h} className="p-3 border-r border-slate-200">{h}</th>) : ['Plant', 'Trip ID', 'Sale Order', 'Ship to Party', 'Route', 'Vehicle No', 'Assign Qty', 'CN Number', 'Action'].map(h => <th key={h} className="p-3 border-r border-slate-200">{h}</th>)}</tr></thead>
            <tbody>{paginatedData.map((item: any) => {
                  if (activeTab === 'Open Orders') {
                    const o = item; const isDelayed = (new Date().getTime() - new Date(o.createdAt).getTime()) > 24 * 60 * 60 * 1000;
                    return (<tr key={o.id} className="border-b border-slate-100 text-[11px] font-bold"><td className="p-3">{o.plantCode}</td><td className="p-3 text-[#0056d2] font-black">{o.saleOrder}</td><td className="p-3 uppercase">{o.consignor}</td><td className="p-3 uppercase">{o.consignee}</td><td className="p-3 uppercase">{o.shipToParty}</td><td className="p-3 uppercase">{o.route}</td><td className="p-3 font-black">{o.tot} {o.uom}</td><td className="p-3 text-emerald-600">{o.ass} {o.uom}</td><td className="p-3 text-red-600 font-black">{o.bal} {o.uom}</td><td className="p-3">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <Button onClick={() => handleAssign(o)} size="sm" className="bg-[#0056d2] text-white font-black text-[9px] h-7 rounded-none uppercase">Assign</Button>
                            {isDelayed && ( <Button onClick={() => handleDelayRemark(o)} size="sm" className="bg-[#facc15] text-[#1e3a8a] hover:bg-[#eab308] font-black text-[9px] h-7 rounded-none uppercase">Delay Remark</Button> )}
                          </div>
                        </div>
                    </td></tr>);
                  } else {
                    const t = item; const gpsVehicle = gpsData.find(v => v.vehicleNumber?.toUpperCase() === t.vehicleNumber?.toUpperCase());
                    const canEditCn = ['Loading', 'In-Transit', 'Arrived'].includes(activeTab); const isArrangeBy = t.fleetType === 'Arrange by Party';
                    return (<tr key={t.id} className="border-b border-slate-100 text-[11px] font-bold"><td className="p-3">{t.plantCode}</td><td className="p-3 text-[#0056d2] font-black">{t.tripId}</td><td className="p-3 uppercase">{t.saleOrderNumber}</td><td className="p-3 uppercase">{t.shipToParty}</td><td className="p-3 uppercase">{t.route}</td><td className="p-3 uppercase cursor-pointer hover:underline" onDoubleClick={(e) => { e.stopPropagation(); handleAssignmentClick(t); }}>{t.vehicleNumber}</td><td className="p-3 text-emerald-600 font-black">{t.assignWeight} MT</td><td className="p-3">
                        <div className="flex items-center gap-2">
                          {t.cnNo ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleCnPreviewClick(t)} className="font-black text-[#0056d2] uppercase hover:underline">{t.cnNo}</button>
                              {canEditCn && !isArrangeBy && ( <button onClick={() => handleAddCn(t)} title="Edit CN" className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 className="h-3 w-3" /></button> )}
                            </div>
                          ) : ( !isArrangeBy && ( <button onClick={() => handleAddCn(t)} className="p-1.5 bg-blue-50 text-[#0056d2] border border-blue-100 hover:bg-blue-100 transition-all"><Plus className="h-3 w-3" /></button> ) )}
                        </div>
                      </td>
                        <td className="p-3">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                              {activeTab === 'Loading' && (<><Button onClick={() => handleOutVehicle(t)} size="sm" className="text-[9px] bg-emerald-600 text-white font-black h-7 rounded-none uppercase">Out</Button><Button onClick={() => handleAssignmentClick(t)} size="sm" className="text-[9px] bg-yellow-400 text-black font-black h-7 rounded-none uppercase">Assign</Button></>)}
                              {activeTab === 'In-Transit' && (<><Button onClick={() => handleArrivedAction(t)} size="sm" className="text-[9px] bg-[#0056d2] text-white font-black h-7 rounded-none uppercase">Arrived</Button></>)}
                              {activeTab === 'Arrived' && (<><Button onClick={() => handleUnloadAction(t)} size="sm" className="text-[9px] bg-emerald-600 text-white font-black h-7 rounded-none uppercase">Unload</Button><Button onClick={() => handleRejectAction(t)} size="sm" className="text-[9px] bg-red-600 text-white font-black h-7 rounded-none uppercase">Reject</Button></>)}
                              {activeTab === 'Reject' && (<><Button onClick={() => handleResentAction(t)} size="sm" className="text-[9px] bg-indigo-600 text-white font-black h-7 rounded-none uppercase">Re-sent</Button><Button onClick={() => handleSrnAction(t)} size="sm" className="text-[9px] bg-emerald-600 text-white font-black h-7 rounded-none uppercase">SRN</Button></>)}
                              {activeTab === 'POD Verify' && (<Button onClick={() => handlePodUploadAction(t)} size="sm" className="text-[9px] bg-[#0056d2] text-white font-black h-7 rounded-none uppercase">POD</Button>)}
                              {activeTab === 'Closed' && (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handleDownloadPod(t)} className="p-1.5 hover:bg-slate-100 text-[#1e3a8a] transition-all" title="Download POD"><Download className="h-4 w-4" /></button>
                                  <button onClick={() => handlePodChangeAction(t)} className="p-1.5 hover:bg-slate-100 text-[#1e3a8a] transition-all" title="Change POD"><Edit3 className="h-4 w-4" /></button>
                                </div>
                              )}
                            </div>
                            {gpsVehicle && <VehicleLocation lat={gpsVehicle.latitude} lng={gpsVehicle.longitude} locationName={gpsVehicle.location} onClick={() => handleOpenMapPage(t, gpsVehicle)} />}
                          </div>
                        </td></tr>);
                  }
                })}</tbody></table></div>
        <div className="p-3 bg-[#f8fafc] border-t border-slate-300 flex items-center justify-between print:hidden">
          <div className="text-[9px] font-black text-slate-500 uppercase">Records: {filteredData.length} Registry Items</div>
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-7 px-3 text-[9px] font-black uppercase rounded-none border-slate-300">Previous</Button>
            <div className="h-7 px-4 flex items-center text-[9px] font-black text-[#1e3a8a] bg-blue-50 border border-blue-100 rounded-none">PAGE {currentPage} / {totalPages || 1}</div>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p + 1)} className="h-7 px-3 text-[9px] font-black uppercase rounded-none border-slate-300">Next</Button></div></div></div>
    </div>
    
    <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
      <DialogContent className="max-w-[1200px] max-h-[90vh] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Truck className="h-4 w-4" /> TR21 – Assign Vehicle</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4 overflow-y-auto green-scrollbar flex-1">
          <SectionGrouping title="HEADER">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12 mb-4">
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plant</span><span className="text-[12px] font-black text-[#1e3a8a]">{selectedOrder?.plantCode}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sale Order</span><span className="text-[12px] font-black text-[#1e3a8a]">{selectedOrder?.saleOrder}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Consignee</span><span className="text-[12px] font-black uppercase truncate">{selectedOrder?.consignee}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{selectedOrder?.shipToParty}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[12px] font-black uppercase truncate">{selectedOrder?.route}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Balance Qty</span><span className="text-[12px] font-black text-red-600">{selectedOrder?.bal} {selectedOrder?.uom}</span></div>
             </div>
          </SectionGrouping>
          <SectionGrouping title="CENTRE SECTION">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <FormInput label="VEHICLE NO" value={assignData.vehicleNumber} onChange={(v: string) => setAssignData({...assignData, vehicleNumber: v.toUpperCase()})} />
                <FormInput label="DRIVER MOBILE" value={assignData.driverMobile} onChange={(v: string) => setAssignData({...assignData, driverMobile: v})} />
                <FormSelect label="FLEET TYPE" value={assignData.fleetType} options={["Own Vehicle", "Contract Vehicle", "Market Vehicle", "Arrange by Party"]} onChange={(v: string) => setAssignData({...assignData, fleetType: v})} />
                <FormInput label="ASSIGN QTY (MT)" type="number" value={assignData.assignWeight} onChange={(v: string) => { const w = parseFloat(v) || 0; const r = parseFloat(assignData.rate) || 0; setAssignData({ ...assignData, assignWeight: v, freightAmount: !assignData.isFixedRate ? (w * r).toFixed(2) : assignData.freightAmount }); }} />
                <FormInput label="ASSIGN DATE TIME" type="datetime-local" value={assignData.assignDate} onChange={(v: string) => setAssignData({...assignData, assignDate: v})} />
             </div>
             {assignData.fleetType === 'Market Vehicle' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 pt-4 border-t border-slate-200 mt-4 animate-fade-in">
                  <FormSelect label="VENDOR NAME" value={assignData.vendorName} options={vendors.map((v: any) => ({ value: v.vendorName, label: v.vendorName }))} onChange={(v: string) => { const match = vendors.find((vend: any) => vend.vendorName === v); setAssignData({ ...assignData, vendorName: v, vendorCode: match?.vendorCode || '', vendorFirmName: match?.vendorFirmName || '', vendorMobile: match?.mobile || '' }); }} />
                  <FormInput label="VENDOR FIR" value={assignData.vendorFirmName} disabled={true} />
                  <FormInput label="MOBILE" value={assignData.vendorMobile} disabled={true} />
                  <FormInput label="ARRANGE BY" value={assignData.arrangeBy} onChange={(v: string) => setAssignData({...assignData, arrangeBy: v})} />
                  <FormInput label="RATE" type="number" value={assignData.rate} onChange={(v: string) => { const r = parseFloat(v) || 0; const w = parseFloat(assignData.assignWeight) || 0; setAssignData({ ...assignData, rate: v, freightAmount: !assignData.isFixedRate ? (r * w).toFixed(2) : assignData.freightAmount }); }} />
                  <div className="flex items-center gap-8 pl-[180px]"><div className="flex items-center gap-2"><Checkbox checked={assignData.isFixedRate} onCheckedChange={(c) => setAssignData({...assignData, isFixedRate: !!c})} id="assign-fix-rate" /><label htmlFor="assign-fix-rate" className="text-[10px] font-black uppercase cursor-pointer text-slate-500">Fix Rate Mode</label></div></div>
                  <FormInput label="FREIGHT AMOUNT" type="number" value={assignData.freightAmount} disabled={!assignData.isFixedRate} onChange={(v: string) => setAssignData({...assignData, freightAmount: v})} />
                </div>
             )}
          </SectionGrouping>
        </div>
        <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsPopupOpen(false)} variant="outline" className="h-10 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handleCreateTrip} className="h-10 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isAssignmentPopupOpen} onOpenChange={setIsAssignmentPopupOpen}>
      <DialogContent className="max-w-[1200px] max-h-[90vh] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Edit3 className="h-4 w-4" /> Assignment Management</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-6 overflow-y-auto green-scrollbar flex-1">
          <div className="flex items-center justify-between mb-4 bg-white p-4 border border-slate-200">
            <div className="grid grid-cols-2 gap-12 flex-1">
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{selectedTripForAssignment?.shipToParty}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[12px] font-black uppercase truncate">{selectedTripForAssignment?.route}</span></div>
            </div>
            <div className="flex items-center gap-4 pl-12 border-l border-slate-200 ml-12">
               <RadioGroup defaultValue="edit" onValueChange={(v) => { if (v === 'unassign') handleUnassignTrip(); }} className="flex items-center gap-6">
                 <div className="flex items-center space-x-2"><RadioGroupItem value="edit" id="r-edit" className="border-[#1e3a8a] text-[#1e3a8a]" /><Label htmlFor="r-edit" className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-[#1e3a8a]">Edit Assignment</Label></div>
                 <div className="flex items-center space-x-2"><RadioGroupItem value="unassign" id="r-unassign" className="border-red-600 text-red-600" /><Label htmlFor="r-unassign" className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-red-600">Unassign Trip</Label></div>
               </RadioGroup>
            </div>
          </div>
          <div className="space-y-4 animate-fade-in border-t border-slate-200 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              <FormInput label="VEHICLE NO" value={assignData.vehicleNumber} onChange={(v: string) => setAssignData({...assignData, vehicleNumber: v.toUpperCase()})} />
              <FormInput label="DRIVER MOBILE" value={assignData.driverMobile} onChange={(v: string) => setAssignData({...assignData, driverMobile: v})} />
              <FormInput label="ASSIGN QTY (MT)" type="number" value={assignData.assignWeight} onChange={(v: string) => setAssignData({...assignData, assignWeight: v})} />
            </div>
          </div>
        </div>
        <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsAssignmentPopupOpen(false)} variant="outline" className="h-10 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handleAssignmentPost} className="h-10 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isOutPopupOpen} onOpenChange={setIsOutPopupOpen}>
      <DialogContent className="max-w-[700px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Truck className="h-4 w-4" /> Outward Registration</DialogTitle>
        </DialogHeader>
        <div className="p-8 space-y-10 overflow-y-auto flex-1">
          <SectionGrouping title="HUB HEADER">
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{outData.shipToParty}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[12px] font-black uppercase">{outData.vehicleNumber}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CN Number</span><span className="text-[12px] font-black uppercase">{outData.cnNo}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[12px] font-black uppercase truncate">{outData.route}</span></div>
            </div>
          </SectionGrouping>
          <SectionGrouping title="DATE TIME">
            <div className="space-y-4">
              <FormInput label="OUT DATE" type="date" value={outData.date} onChange={(v: string) => setOutData({...outData, date: v})} />
              <FormInput label="OUT TIME" type="time" value={outData.time} onChange={(v: string) => setOutData({...outData, time: v})} />
            </div>
          </SectionGrouping>
        </div>
        <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsOutPopupOpen(false)} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handleConfirmOut} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isArrivedPopupOpen} onOpenChange={setIsArrivedPopupOpen}>
      <DialogContent className="max-w-[700px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><MapPin className="h-4 w-4" /> Arrival Registration</DialogTitle>
        </DialogHeader>
        <div className="p-8 space-y-10 overflow-y-auto flex-1">
          <SectionGrouping title="TRACKING HEADER">
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{arrivedData.shipToParty}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[12px] font-black uppercase">{arrivedData.vehicleNumber}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CN Number</span><span className="text-[12px] font-black uppercase">{arrivedData.cnNo}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[12px] font-black uppercase truncate">{arrivedData.route}</span></div>
            </div>
          </SectionGrouping>
          <SectionGrouping title="DATE TIME">
            <div className="space-y-4">
              <FormInput label="ARRIVED DATE" type="date" value={arrivedData.date} onChange={(v: string) => setArrivedData({...arrivedData, date: v})} />
              <FormInput label="ARRIVED TIME" type="time" value={arrivedData.time} onChange={(v: string) => setArrivedData({...arrivedData, time: v})} />
            </div>
          </SectionGrouping>
        </div>
        <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsArrivedPopupOpen(false)} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handleArrivedPost} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isUnloadPopupOpen} onOpenChange={setIsUnloadPopupOpen}>
      <DialogContent className="max-w-[700px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Package className="h-4 w-4" /> Unload Process</DialogTitle>
        </DialogHeader>
        <div className="p-8 space-y-10 overflow-y-auto flex-1">
          <SectionGrouping title="TOP HEADER">
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{unloadData.trip?.shipToParty}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[12px] font-black uppercase">{unloadData.trip?.vehicleNumber}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Qty</span><span className="text-[12px] font-black uppercase">{unloadData.trip?.assignWeight} {unloadData.trip?.weightUom}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[12px] font-black uppercase truncate">{unloadData.trip?.route}</span></div>
            </div>
          </SectionGrouping>
          <SectionGrouping title="CENTRE FIELDS">
            <div className="space-y-4">
              <FormInput label="DATE" type="date" value={unloadData.date} onChange={(v: string) => setUnloadData({...unloadData, date: v})} />
              <FormInput label="TIME" type="time" value={unloadData.time} onChange={(v: string) => setUnloadData({...unloadData, time: v})} />
            </div>
          </SectionGrouping>
        </div>
        <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsUnloadPopupOpen(false)} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handleUnloadPost} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isRejectPopupOpen} onOpenChange={setIsRejectPopupOpen}>
      <DialogContent className="max-w-[700px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-red-600 px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><XCircle className="h-4 w-4" /> Reject Registry</DialogTitle>
        </DialogHeader>
        <div className="p-8 space-y-10 overflow-y-auto flex-1">
          <SectionGrouping title="TOP HEADER">
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{rejectData.trip?.shipToParty}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[12px] font-black uppercase">{rejectData.trip?.vehicleNumber}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Qty</span><span className="text-[12px] font-black uppercase">{rejectData.trip?.assignWeight} {rejectData.trip?.weightUom}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[12px] font-black uppercase truncate">{rejectData.trip?.route}</span></div>
            </div>
          </SectionGrouping>
          <SectionGrouping title="CENTRE FIELDS">
            <div className="space-y-4">
              <FormInput label="DATE" type="date" value={rejectData.date} onChange={(v: string) => setRejectData({...rejectData, date: v})} />
              <FormInput label="TIME" type="time" value={rejectData.time} onChange={(v: string) => setRejectData({...rejectData, time: v})} />
              <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-[180px] text-right uppercase shrink-0">REJECT REASON:</label><textarea value={rejectData.remark} onChange={e => setRejectData({...rejectData, remark: e.target.value})} className="h-20 w-[320px] border border-slate-400 bg-white px-2 py-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-red-500 uppercase resize-none" placeholder="ENTER REASON..." /></div>
            </div>
          </SectionGrouping>
        </div>
        <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsRejectPopupOpen(false)} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handleRejectPost} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isResentPopupOpen} onOpenChange={setIsResentPopupOpen}>
      <DialogContent className="max-w-[700px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Undo2 className="h-4 w-4" /> Re-sent Process</DialogTitle>
        </DialogHeader>
        <div className="p-8 space-y-10 overflow-y-auto flex-1">
          <SectionGrouping title="TOP HEADER">
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{resentData.trip?.shipToParty}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[12px] font-black uppercase">{resentData.trip?.vehicleNumber}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Qty</span><span className="text-[12px] font-black uppercase">{resentData.trip?.assignWeight} {resentData.trip?.weightUom}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[12px] font-black uppercase truncate">{resentData.trip?.route}</span></div>
            </div>
          </SectionGrouping>
          <SectionGrouping title="CENTRE FIELDS">
            <div className="space-y-4">
              <FormInput label="DATE" type="date" value={resentData.date} onChange={(v: string) => setResentData({...resentData, date: v})} />
              <FormInput label="TIME" type="time" value={resentData.time} onChange={(v: string) => setResentData({...resentData, time: v})} />
            </div>
          </SectionGrouping>
        </div>
        <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsResentPopupOpen(false)} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handleResentPost} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isSrnPopupOpen} onOpenChange={setIsSrnPopupOpen}>
      <DialogContent className="max-w-[700px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><FileCheck className="h-4 w-4" /> SRN Registry</DialogTitle>
        </DialogHeader>
        <div className="p-8 space-y-10 overflow-y-auto flex-1">
          <SectionGrouping title="TOP HEADER">
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plant</span><span className="text-[12px] font-black uppercase">{srnData.trip?.plantCode}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{srnData.trip?.shipToParty}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[12px] font-black uppercase">{srnData.trip?.vehicleNumber}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Qty</span><span className="text-[12px] font-black uppercase">{srnData.trip?.assignWeight} {srnData.trip?.weightUom}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[12px] font-black uppercase truncate">{srnData.trip?.route}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CN Number</span><span className="text-[12px] font-black uppercase">{srnData.trip?.cnNo}</span></div>
            </div>
          </SectionGrouping>
          <SectionGrouping title="CENTRE FIELDS">
            <div className="space-y-4">
              <FormInput label="SRN NUMBER" value={srnData.srnNo} onChange={(v: string) => setSrnData({...srnData, srnNo: v})} />
              <FormInput label="SRN DATE" type="date" value={srnData.srnDate} onChange={(v: string) => setSrnData({...srnData, srnDate: v})} />
            </div>
          </SectionGrouping>
        </div>
        <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsSrnPopupOpen(false)} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handleSrnPost} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isPodChangePopupOpen} onOpenChange={setIsPodChangePopupOpen}>
      <DialogContent className="max-w-[700px] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><UploadCloud className="h-4 w-4" /> Change POD Document</DialogTitle>
        </DialogHeader>
        <div className="p-8 space-y-10 overflow-y-auto flex-1">
          <SectionGrouping title="TOP HEADER">
            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plant</span><span className="text-[12px] font-black uppercase">{selectedTripForPodChange?.plantCode}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{selectedTripForPodChange?.shipToParty}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[12px] font-black uppercase">{selectedTripForPodChange?.vehicleNumber}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Qty</span><span className="text-[12px] font-black uppercase">{selectedTripForPodChange?.assignWeight} {selectedTripForPodChange?.weightUom}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[12px] font-black uppercase truncate">{selectedTripForPodChange?.route}</span></div>
              <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CN Number</span><span className="text-[12px] font-black uppercase">{selectedTripForPodChange?.cnNo}</span></div>
            </div>
          </SectionGrouping>
          <SectionGrouping title="CENTRE SECTION">
            <div className="flex flex-col items-center justify-center gap-6">
              <input type="file" accept="image/*,.pdf" ref={changePodInputRef} onChange={handlePodChangeFileChange} className="hidden" />
              <div onClick={() => changePodInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-blue-50 transition-all">
                {changePodFile ? <div className="text-emerald-600 font-black text-xs uppercase">Document Ready (≤ 250 KB Buffer)</div> : <><UploadCloud className="h-8 w-8 text-[#1e3a8a]" /><span className="text-[10px] font-black uppercase">Click to Select New POD File</span></>}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Allowed formats: PDF, Image | Max Size: 2 MB</p>
            </div>
          </SectionGrouping>
        </div>
        <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsPodChangePopupOpen(false)} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handlePodChangePost} disabled={!changePodFile} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg disabled:opacity-50">Post</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isPodPopupOpen} onOpenChange={setIsPodPopupOpen}><DialogContent className="max-w-md bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden"><DialogHeader className="bg-[#1e3a8a] px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><UploadCloud className="h-4 w-4" /> Upload POD</DialogTitle></DialogHeader>
        <div className="p-8 space-y-6 flex flex-col items-center justify-center"><input type="file" accept="image/*,.pdf" ref={fileInputRef} onChange={handlePodFileChange} className="hidden" />
          <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-blue-50 transition-all">
            {podFile ? <div className="text-emerald-600 font-black text-xs uppercase">Document Ready</div> : <><UploadCloud className="h-8 w-8 text-[#1e3a8a]" /><span className="text-[10px] font-black uppercase">Select Registry File</span></>}
          </div><div className="flex justify-end gap-3 w-full"><Button onClick={() => setIsPodPopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handlePodPost} disabled={!podFile} className="h-9 px-8 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Post & Close</Button></div></div></DialogContent></Dialog>

    {isCnPreviewOpen && selectedTripForPreview && (
      <div id="printable-area" className="fixed inset-0 z-[1000] bg-white overflow-auto flex flex-col font-mono text-black">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={cn("w-[210mm] min-h-[297mm] p-[10mm] mx-auto bg-white relative border-b border-dashed border-slate-300 last:border-0", i < 2 && "print:page-break-after-always")}>
            <div className="border-[1.5px] border-black h-full p-4 flex flex-col">
              <div className="flex justify-between items-start border-b-[1.5px] border-black pb-4 mb-4">
                <div className="flex gap-4 items-center">
                  {selectedTripForPreview.carrier?.logo && (
                    <div className="relative w-14 h-14 shrink-0">
                      <Image src={selectedTripForPreview.carrier.logo} alt="Logo" fill className="object-contain" unoptimized />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <h1 className="text-[26px] font-black uppercase italic tracking-tighter leading-none whitespace-nowrap">{selectedTripForPreview.carrier?.companyName || 'SIKKA INDUSTRIES & LOGISTICS'}</h1>
                    <p className="text-[10px] font-bold mt-1 uppercase max-w-[450px]">{selectedTripForPreview.carrier?.address}, {selectedTripForPreview.carrier?.city} - {selectedTripForPreview.carrier?.postalCode}</p>
                    <p className="text-[9px] font-bold mt-0.5">GSTIN: {selectedTripForPreview.carrier?.gstin} | PAN: {selectedTripForPreview.carrier?.pan}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="border border-black px-3 py-1 text-[11px] font-black uppercase bg-slate-50 whitespace-nowrap">{i === 0 ? 'CONSIGNEE COPY' : i === 1 ? 'DRIVER COPY' : 'CONSIGNOR COPY'}</span>
                  <div className="text-right mt-2">
                    <p className="text-[16px] font-black leading-none whitespace-nowrap">CN NO: <span className="text-blue-800">{selectedTripForPreview.cnNo}</span></p>
                    <p className="text-[10px] font-black mt-1">DATE: {format(new Date(selectedTripForPreview.cnDate || new Date()), 'dd-MM-yyyy')}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 mb-6">
                <div className="space-y-4">
                  <div className="border border-black p-3 bg-slate-50/50 h-[120px]">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">CONSIGNOR (FROM):</p>
                    <p className="text-[12px] font-black uppercase leading-tight">{selectedTripForPreview.consignorMaster?.customerName || selectedTripForPreview.order?.consignor}</p>
                    <p className="text-[10px] font-bold uppercase mt-1 leading-tight">{selectedTripForPreview.consignorMaster?.address}, {selectedTripForPreview.consignorMaster?.city}</p>
                    <p className="text-[10px] font-black mt-1 uppercase">GSTIN: {selectedTripForPreview.consignorMaster?.gstin || 'N/A'}</p>
                  </div>
                  <div className="border border-black p-3 h-[120px]">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">CONSIGNEE (TO):</p>
                    <p className="text-[12px] font-black uppercase leading-tight">{selectedTripForPreview.consigneeMaster?.customerName || selectedTripForPreview.order?.consignee}</p>
                    <p className="text-[10px] font-bold uppercase mt-1 leading-tight">{selectedTripForPreview.consigneeMaster?.address}, {selectedTripForPreview.consigneeMaster?.city}</p>
                    <p className="text-[10px] font-black mt-1 uppercase">GSTIN: {selectedTripForPreview.consigneeMaster?.gstin || 'N/A'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="border border-black p-3 bg-slate-50/50 h-[120px]">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">SHIP TO PARTY (DELIVERY):</p>
                    <p className="text-[12px] font-black uppercase leading-tight">{selectedTripForPreview.shipToMaster?.customerName || selectedTripForPreview.shipToParty}</p>
                    <div className="relative group">
                      <p className={cn("text-[10px] font-bold uppercase mt-1 leading-tight", isAddressEditable && "bg-white p-1 ring-1 ring-blue-500")}>
                        {isAddressEditable ? (
                          <textarea value={previewDeliveryAddress} onChange={e => setPreviewDeliveryAddress(e.target.value)} onBlur={() => setIsAddressEditable(false)} autoFocus className="w-full h-16 outline-none resize-none border-none p-0 text-[10px] font-bold uppercase" />
                        ) : (
                          <span onClick={() => setIsAddressEditable(true)} title="Click to edit address" className="cursor-text">{previewDeliveryAddress}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="border border-black p-3 h-[120px] flex flex-col justify-between">
                     <div className="grid grid-cols-2 gap-2">
                       <div><p className="text-[9px] font-black text-slate-500 uppercase">VEHICLE NO:</p><p className="text-[11px] font-black uppercase">{selectedTripForPreview.vehicleNumber}</p></div>
                       <div><p className="text-[9px] font-black text-slate-500 uppercase">DRIVER NO:</p><p className="text-[11px] font-black">{selectedTripForPreview.driverMobile}</p></div>
                       <div><p className="text-[9px] font-black text-slate-400 uppercase">PAYMENT TERMS:</p><p className="text-[11px] font-black uppercase">{selectedTripForPreview.paymentTerms}</p></div>
                       <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase">TRIP ID:</p><p className="text-[11px] font-black uppercase">{selectedTripForPreview.tripId}</p></div>
                     </div>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <table className="w-full border-collapse border border-black">
                  <thead className="bg-slate-100">
                    <tr className="text-[10px] font-black uppercase">
                      <th className="border border-black p-2 w-[120px] text-center">Invoice No</th>
                      <th className="border border-black p-2 w-[144px] text-center">E-Waybill No</th>
                      <th className="border border-black p-2 text-left">Description of Goods</th>
                      <th className="border border-black p-2 w-[96px] text-center">Package</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedTripForPreview.cnItems || [{}]).map((item: any, idx: number) => (
                      <tr key={idx} className="text-[11px] font-bold uppercase h-10">
                        <td className="border border-black p-2 text-center">{item.invoiceNo}</td>
                        <td className="border border-black p-2 text-center">{item.ewaybillNo}</td>
                        <td className="border border-black p-2">{item.product}</td>
                        <td className="border border-black p-2 text-center">{item.unit} {item.uom}</td>
                      </tr>
                    ))}
                    {[...Array(Math.max(0, 5 - (selectedTripForPreview.cnItems?.length || 0)))].map((_, i) => (
                      <tr key={`empty-${i}`} className="h-10"><td className="border border-black p-2" /><td className="border border-black p-2" /><td className="border border-black p-2" /><td className="border border-black p-2" /></tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black">
                    <tr>
                      <td colSpan={2} className="border border-black p-2 text-[10px] italic">Sikka Logistics Handshake Sync</td>
                      <td className="border border-black p-2 text-right uppercase text-[10px]">Total Consolidated Quantity:</td>
                      <td className="border border-black p-2 text-center text-[12px]">{selectedTripForPreview.cnItems?.reduce((a: number, c: any) => a + (parseFloat(c.unit) || 0), 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-12">
                <div className="border-t border-black pt-2 text-center"><p className="text-[9px] font-black uppercase text-slate-500">Receiver Signature & Stamp</p></div>
                <div className="border-t border-black pt-2 text-center"><p className="text-[9px] font-black uppercase text-slate-500">Driver Signature</p></div>
                <div className="border-t border-black pt-2 text-center">
                  <p className="text-[9px] font-black uppercase text-slate-500 mb-8">For {selectedTripForPreview.carrier?.companyName || 'Sikka Industries'}</p>
                  <p className="text-[10px] font-black uppercase">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="fixed top-6 right-6 flex flex-col gap-3 print:hidden z-[1100]">
          <Button onClick={handleGeneratePdf} className="h-12 w-12 rounded-full bg-[#1e3a8a] text-white shadow-2xl hover:scale-110 transition-transform"><Printer className="h-6 w-6" /></Button>
          <Button onClick={() => setIsCnPreviewOpen(false)} className="h-12 w-12 rounded-full bg-red-600 text-white shadow-2xl hover:scale-110 transition-transform"><X className="h-6 w-6" /></Button>
        </div>
      </div>
    )}

    {isDelayRemarkPopupOpen && selectedOrderForRemark && (
      <Dialog open={isDelayRemarkPopupOpen} onOpenChange={setIsDelayRemarkPopupOpen}>
        <DialogContent className="max-w-md bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden">
          <DialogHeader className="bg-[#1e3a8a] px-6 py-4">
            <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Clock className="h-4 w-4" /> Log Delay Remark</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
             <div className="space-y-4">
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sale Order</span><span className="text-[12px] font-black text-[#1e3a8a]">{selectedOrderForRemark.saleOrder}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase">{selectedOrderForRemark.shipToParty}</span></div>
                <div className="flex flex-col gap-2 mt-4"><label className="text-[11px] font-black uppercase text-slate-500">Delay Remark:</label><textarea value={delayRemarkInput} onChange={e => setDelayRemarkInput(e.target.value)} className="h-24 w-full border border-slate-400 bg-white px-2 py-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase resize-none" placeholder="ENTER REASON FOR DELAY..." /></div>
             </div>
             <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button onClick={() => setIsDelayRemarkPopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase">Cancel</Button>
                <Button onClick={handlePostDelayRemark} className="h-9 px-10 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Post Remark</Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    )}

    {isCnPopupOpen && selectedTripForCn && (
      <Dialog open={isCnPopupOpen} onOpenChange={setIsCnPopupOpen}>
        <DialogContent className="max-w-[1000px] max-h-[90vh] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
          <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
            <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><FileText className="h-4 w-4" /> CN - Consignment Note Entry</DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-10 overflow-y-auto green-scrollbar flex-1">
            <SectionGrouping title="CN HEADER">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                 <FormInput label="CN NUMBER" value={cnFormData.cnNo} onChange={(v: string) => setCnFormData({...cnFormData, cnNo: v})} />
                 <FormInput label="CN DATE" type="date" value={cnFormData.cnDate} onChange={(v: string) => setCnFormData({...cnFormData, cnDate: v})} />
                 <FormSelect label="PAYMENT TERMS" value={cnFormData.paymentTerms} options={['PAID', 'TO PAY', 'TBB', 'FOC']} onChange={(v: string) => setCnFormData({...cnFormData, paymentTerms: v})} />
                 <FormInput label="CARRIER NAME" value={cnFormData.carrierName} disabled={true} />
              </div>
            </SectionGrouping>
            <SectionGrouping title="ITEM DETAILS">
              <div className="bg-white border border-slate-300 shadow-inner overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-300 text-[10px] font-black uppercase">
                    <tr>
                      <th className="p-2 border-r border-slate-200">Invoice No</th>
                      <th className="p-2 border-r border-slate-200">E-Waybill No</th>
                      <th className="p-2 border-r border-slate-200">Product</th>
                      <th className="p-2 border-r border-slate-200">Qty</th>
                      <th className="p-2 border-r border-slate-200">UOM</th>
                      <th className="p-2 w-10 text-center">X</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cnFormData.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-100 h-8">
                        <td className="p-0 border-r border-slate-100"><input value={item.invoiceNo} onChange={(e) => { const itms = [...cnFormData.items]; itms[idx].invoiceNo = e.target.value; setCnFormData({...cnFormData, items: itms}); }} className="w-full h-full px-2 text-[11px] font-bold outline-none uppercase" /></td>
                        <td className="p-0 border-r border-slate-100"><input value={item.ewaybillNo} onChange={(e) => { const itms = [...cnFormData.items]; itms[idx].ewaybillNo = e.target.value; setCnFormData({...cnFormData, items: itms}); }} className="w-full h-full px-2 text-[11px] font-bold outline-none uppercase" /></td>
                        <td className="p-0 border-r border-slate-100"><input value={item.product} onChange={(e) => { const itms = [...cnFormData.items]; itms[idx].product = e.target.value; setCnFormData({...cnFormData, items: itms}); }} className="w-full h-full px-2 text-[11px] font-bold outline-none uppercase" /></td>
                        <td className="p-0 border-r border-slate-100"><input type="number" value={item.unit} onChange={(e) => { const itms = [...cnFormData.items]; itms[idx].unit = e.target.value; setCnFormData({...cnFormData, items: itms}); }} className="w-full h-full px-2 text-[11px] font-bold outline-none uppercase" /></td>
                        <td className="p-0 border-r border-slate-100"><select value={item.uom} onChange={(e) => { const itms = [...cnFormData.items]; itms[idx].uom = e.target.value; setCnFormData({...cnFormData, items: itms}); }} className="w-full h-full px-1 text-[11px] font-bold outline-none uppercase"><option value="Bag">Bag</option><option value="Box">Box</option><option value="Drum">Drum</option><option value="Pallet">Pallet</option><option value="Roll">Roll</option><option value="MT">MT</option><option value="KG">KG</option><option value="LTR">LTR</option></select></td>
                        <td className="p-0 text-center"><button onClick={() => { if (cnFormData.items.length > 1) { const itms = cnFormData.items.filter((_: any, i: number) => i !== idx); setCnFormData({...cnFormData, items: itms}); } }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="h-3 w-3" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black">
                     <tr className="h-10">
                        <td colSpan={3} className="px-3">
                          <button onClick={() => setCnFormData({...cnFormData, items: [...cnFormData.items, { invoiceNo: '', ewaybillNo: '', product: '', unit: '', uom: 'Bag' }]})} className="flex items-center gap-1 text-[9px] uppercase text-[#1e3a8a] hover:underline transition-all"><Plus className="h-3 w-3" /> Add Item Line</button>
                        </td>
                        <td className="px-2 text-center text-[11px] text-[#0056d2]">{cnTableTotal.total}</td>
                        <td className="px-2 text-center text-[10px] text-[#0056d2]">{cnTableTotal.uom}</td>
                        <td />
                     </tr>
                  </tfoot>
                </table>
              </div>
            </SectionGrouping>
          </div>
          <div className="p-3 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
            <Button onClick={() => setIsCnPopupOpen(false)} variant="outline" className="h-10 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
            <Button onClick={handleCnPost} className="h-10 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post CN</Button>
          </div>
        </DialogContent>
      </Dialog>
    )}
  </div>;
}

function Tr21TrackingPage({ node, onBack, customers, settings }: any) {
  const [gpsData, setGpsData] = React.useState<any[]>([]); const [distance, setDistance] = React.useState<string>('Calculating...'); const mapRef = React.useRef<HTMLDivElement>(null);
  const fetchGps = React.useCallback(async () => { try { const res = await fetch('/api/gps'); if (res.ok) { const json = await res.json(); if (json?.data?.list) setGpsData(json.data.list); } } catch (e) {} }, []);
  React.useEffect(() => { fetchGps(); const i = setInterval(fetchGps, 30000); return () => clearInterval(i); }, [fetchGps]);
  React.useEffect(() => {
    if (!node || !window.google) return; const { trip } = node; const gpsVehicle = gpsData.find(v => v.vehicleNumber?.toUpperCase() === trip.vehicleNumber?.toUpperCase()); const geocoder = new window.google.maps.Geocoder(); const directionsService = new window.google.maps.DirectionsService(); const directionsRenderer = new window.google.maps.DirectionsRenderer({ suppressMarkers: true, polylineOptions: { strokeColor: '#1e3a8a', strokeWeight: 5 } });
    const cons = customers?.find((c: any) => c.customerName?.toUpperCase() === trip.consignor?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === trip.consignor?.toUpperCase());
    const ship = customers?.find((c: any) => c.customerName?.toUpperCase() === trip.shipToParty?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === trip.shipToParty?.toUpperCase());
    const p1 = new Promise((resolve) => { if (cons?.postalCode) { geocoder.geocode({ address: cons.postalCode }, (res, status) => { if (status === 'OK') resolve(res[0].geometry.location); else resolve(null); }); } else resolve(null); });
    const p2 = new Promise((resolve) => { if (ship?.postalCode) { geocoder.geocode({ address: ship.postalCode }, (res, status) => { if (status === 'OK') resolve(res[0].geometry.location); else resolve(null); }); } else resolve(null); });
    Promise.all([p1, p2]).then(([origin, dest]: any) => {
      if (!mapRef.current) return; const map = new window.google.maps.Map(mapRef.current, { center: gpsVehicle ? { lat: gpsVehicle.latitude, lng: gpsVehicle.longitude } : { lat: 20.5937, lng: 78.9629 }, zoom: gpsVehicle ? 12 : 5, styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }] }); directionsRenderer.setMap(map);
      if (origin) new window.google.maps.Marker({ position: origin, map, title: 'Start Point', icon: { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png', scaledSize: new window.google.maps.Size(32, 32) } });
      if (dest) new window.google.maps.Marker({ position: dest, map, title: 'Drop Point', icon: { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png', scaledSize: new window.google.maps.Size(32, 32) } });
      if (gpsVehicle) { const vIcon = gpsVehicle.speed > 0 ? settings?.activeIcon : settings?.stopIcon; new window.google.maps.Marker({ position: { lat: gpsVehicle.latitude, lng: gpsVehicle.longitude }, map, title: gpsVehicle.vehicleNumber, icon: { url: vIcon || 'https://maps.google.com/mapfiles/ms/icons/truck.png', scaledSize: new window.google.maps.Size(40, 40) } }); }
      if (origin && dest) directionsService.route({ origin, destination: dest, travelMode: window.google.maps.TravelMode.DRIVING }, (result, status) => { if (status === 'OK') { directionsRenderer.setDirections(result); if (result.routes[0].legs[0].distance) setDistance(result.routes[0].legs[0].distance.text); } });
    });
  }, [node, gpsData, customers, settings]);
  const { trip } = node; const currentGps = gpsData.find(v => v.vehicleNumber?.toUpperCase() === trip.vehicleNumber?.toUpperCase());
  return (<div className="flex flex-col h-full bg-[#f2f2f2] animate-fade-in font-mono"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-4 flex items-center justify-between shadow-sm shrink-0"><div className="flex items-center gap-8"><button onClick={onBack} className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"><ArrowLeft className="h-5 w-5" /></button><h2 className="text-[14px] font-black text-slate-800 tracking-tight uppercase">Live Logistical Tracking</h2></div><div className="flex items-center gap-12"><div className="flex items-center gap-12"><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[11px] font-black uppercase text-[#1e3a8a]">{trip.shipToParty}</span></div><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[11px] font-black uppercase text-blue-600">{trip.vehicleNumber}</span></div><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[11px] font-black uppercase text-slate-700">{trip.route}</span></div><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Distance</span><span className="text-[11px] font-black text-emerald-600">{distance}</span></div></div></div></div><div className="flex-1 relative p-4"><div className="absolute top-8 left-8 z-10 space-y-3 pointer-events-none">{currentGps && (<div className="bg-white/90 backdrop-blur-sm border-2 border-[#1e3a8a] p-4 shadow-2xl flex flex-col gap-2 min-w-[220px]"><div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1"><span className="text-[10px] font-black uppercase text-[#1e3a8a]">Vehicle Registry</span><Badge className={cn("text-[9px] font-black uppercase h-5", currentGps.speed > 0 ? "bg-emerald-500" : "bg-red-500")}>{currentGps.speed > 0 ? `${currentGps.speed} KM/H` : 'IDLE'}</Badge></div><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">Speed</span><span className="text-sm font-black italic">{currentGps.speed} KM/H</span></div><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">Last Sync</span><span className="text-[10px] font-bold">{currentGps.lastUpdate || 'Just Now'}</span></div></div>)}</div><div ref={mapRef} className="w-full h-full bg-white border border-slate-300 shadow-inner rounded-none" /></div></div>);
}

function GpsTrackingHub({ trips, onStatusUpdate, db, settings, settingsRef }: any) {
  const [activeTab, setActiveTab] = React.useState('GPS MAP');
  const [gpsData, setGpsData] = React.useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = React.useState<any>(null);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const googleMap = React.useRef<any>(null);
  const markers = React.useRef<Record<string, any>>({});
  const fetchGps = React.useCallback(async () => { try { const res = await fetch('/api/gps'); if (res.ok) { const json = await res.json(); if (json?.data?.list) setGpsData(json.data.list); } } catch (e) {} }, []);
  React.useEffect(() => { fetchGps(); const interval = setInterval(fetchGps, 900000); return () => clearInterval(interval); }, [fetchGps]);
  const onVehicleSelect = (v: any) => {
    setSelectedVehicle(v); let street = ''; let city = '';
    if (v.location && v.location !== 'Syncing...' && v.location !== 'Syncing') {
      const isCoords = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(v.location);
      if (isCoords) { street = 'Locating Asset'; city = ''; }
      else { const parts = v.location.split(',').map((p: string) => p.trim()).filter(Boolean); street = parts[0] || 'Unknown'; city = parts[1] || ''; }
    } else { street = 'Locating Asset'; city = ''; }
    const locationText = city ? `${street}, ${city}` : street;
    onStatusUpdate({ text: `Vehicle Last Location: ${locationText}`, type: 'info' });
    if (googleMap.current) { googleMap.current.setCenter({ lat: v.latitude, lng: v.longitude }); googleMap.current.setZoom(15); }
  };
  React.useEffect(() => {
    if (activeTab !== 'GPS MAP' || !window.google || !mapRef.current) return;
    if (!googleMap.current) { googleMap.current = new window.google.maps.Map(mapRef.current, { center: { lat: 20.5937, lng: 78.9629 }, zoom: 5, styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }] }); }
    Object.values(markers.current).forEach(m => m.setMap(null)); markers.current = {};
    gpsData.forEach(v => {
      const icon = v.speed > 0 ? settings?.activeIcon : settings?.stopIcon;
      const marker = new window.google.maps.Marker({ position: { lat: v.latitude, lng: v.longitude }, map: googleMap.current, title: v.vehicleNumber, icon: { url: icon || 'https://maps.google.com/mapfiles/ms/icons/truck.png', scaledSize: new window.google.maps.Size(32, 32) } });
      marker.addListener('click', () => onVehicleSelect(v)); markers.current[v.vehicleNumber] = marker;
    });
  }, [activeTab, gpsData, settings]);
  const handleIconUpload = (e: any, type: 'activeIcon' | 'stopIcon') => {
    const file = e.target.files?.[0]; if (!file) return; if (file.size > 500 * 1024) { alert("Error: Image must be under 500 KB"); return; }
    const reader = new FileReader(); reader.onload = (ev) => { setDocumentNonBlocking(settingsRef, { [type]: ev.target?.result }, { merge: true }); onStatusUpdate({ text: 'Icon Registry Updated', type: 'success' }); }; reader.readAsDataURL(file);
  };
  return (<div className="flex flex-col h-full bg-[#f2f2f2] font-mono"><div className="flex border-b border-slate-300 bg-white">{['GPS MAP', 'Setting'].map(t => (<button key={t} onClick={() => setActiveTab(t)} className={cn("px-8 py-3 text-[10px] font-black uppercase tracking-widest border-r border-slate-200 transition-all", activeTab === t ? "bg-[#1e3a8a] text-white" : "text-slate-500 hover:bg-slate-50")}>{t}</button>))}</div><div className="flex-1 overflow-hidden">{activeTab === 'GPS MAP' ? (<div className="flex h-full"><div className="w-1/4 bg-white border-r border-slate-300 flex flex-col"><div className="p-4 bg-slate-50 border-b border-slate-200 font-black text-[10px] uppercase tracking-tighter text-[#1e3a8a]">Vehicle Registry</div><div className="flex-1 overflow-y-auto green-scrollbar">{gpsData.map(v => (<div key={v.vehicleNumber} onClick={() => onVehicleSelect(v)} className={cn("p-4 border-b border-slate-100 cursor-pointer hover:bg-blue-50 transition-all", selectedVehicle?.vehicleNumber === v.vehicleNumber && "bg-blue-50 border-l-4 border-l-[#1e3a8a]")}><div className="flex justify-between items-center mb-1"><span className="text-[11px] font-black uppercase text-[#1e3a8a]">{v.vehicleNumber}</span><Badge className={cn("text-[8px] h-4 uppercase", v.speed > 0 ? "bg-emerald-500" : "bg-red-500")}>{v.speed > 0 ? `${v.speed} km/h` : 'Stop'}</Badge></div><p className="text-[9px] font-bold text-slate-400 uppercase truncate">{v.location || 'Syncing...'}</p></div>))}</div></div><div className="flex-1 relative"><div ref={mapRef} className="w-full h-full" /></div></div>) : (<div className="p-12 max-w-4xl mx-auto space-y-12"><div className="bg-white border border-slate-300 p-10 shadow-sm animate-fade-in"><SectionGrouping title="ASSET REGISTRY"><div className="grid grid-cols-2 gap-16"><div className="space-y-4"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Running Vehicle Icon</label><div className="flex items-center gap-6"><div className="w-16 h-16 border border-slate-200 rounded-none bg-slate-50 flex items-center justify-center overflow-hidden">{settings?.activeIcon ? <Image src={settings.activeIcon} alt="Running" width={40} height={40} unoptimized /> : <Truck className="h-6 w-6 text-emerald-500 opacity-30" />}</div><input type="file" id="active-icon-up" className="hidden" onChange={e => handleIconUpload(e, 'activeIcon')} /><label htmlFor="active-icon-up" className="px-4 py-2 bg-[#1e3a8a] text-white text-[9px] font-black uppercase cursor-pointer hover:bg-blue-900 shadow-sm">Upload PNG</label></div></div><div className="space-y-4"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Stop Vehicle Icon</label><div className="flex items-center gap-6"><div className="w-16 h-16 border border-slate-200 rounded-none bg-slate-50 flex items-center justify-center overflow-hidden">{settings?.stopIcon ? <Image src={settings.stopIcon} alt="Stop" width={40} height={40} unoptimized /> : <Truck className="h-6 w-6 text-red-500 opacity-30" />}</div><input type="file" id="stop-icon-up" className="hidden" onChange={e => handleIconUpload(e, 'stopIcon')} /><label htmlFor="stop-icon-up" className="px-4 py-2 bg-white border border-slate-400 text-slate-600 text-[9px] font-black uppercase cursor-pointer hover:bg-slate-50 shadow-sm">Upload PNG</label></div></div></div></SectionGrouping></div></div>)}</div></div>);
}

function Se38Report({ search, results, view, onSearchChange, onViewChange, allPlants, allVendors, allCompanies, allCustomers }: any) {
  const handleExport = () => {
    if (!results || results.length === 0) return;
    const headers = ['Plant', 'Sale Order', 'Sale order Date time', 'Consignor', 'Consignee', 'Ship to Party', 'destination', 'Trip ID', 'Trip ID Created', 'Vehicle Number', 'Driver Mobile', 'Carrier Name', 'CN Number', 'Invoice Number', 'E-waybill Number', 'Product', 'Unit', 'Unit UOM', 'Assign Qty', 'Weight UOM', 'Vendor Name', 'Vendor Firm', 'Vendor Mobile', 'Fleet Type', 'Payment Term', 'Employee', 'Rate', 'Freight Amount', 'Vehicle Out Date Time', 'Vehicle Arrived Date Time', 'Unload Date Time', 'Reject Date Time', 'POD Status'];
    const csvRows = results.map((t: any) => {
      const o = t.order || {}; const cnItems = t.cnItems || []; const primaryItem = cnItems[0] || {};
      return [t.plantCode, o.saleOrder || '', o.saleOrderDate || '', o.consignor || '', o.consignee || '', t.shipToParty || '', o.destination || '', t.tripId, t.createdAt || '', t.vehicleNumber, t.driverMobile || '', t.carrierName || '', t.cnNo || '', primaryItem.invoiceNo || '', primaryItem.ewaybillNo || '', primaryItem.product || '', primaryItem.unit || '', primaryItem.uom || '', t.assignWeight, t.weightUom || 'MT', t.vendorName || '', t.vendorFirmName || '', t.vendorMobile || '', t.fleetType || '', t.paymentTerms || '', t.rate || '0', t.freightAmount || '0', t.outDate || '', t.arrivedDate || '', t.unloadDate || '', t.rejectionDate || '', t.status].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });
    const csvContent = [headers.join(','), ...csvRows].join('\n'); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${search.plant}_Report_${search.from}_to_${search.to}.csv`; link.click();
  };
  if (view === 'result') {
    return (<div className="flex flex-col h-full bg-[#f2f2f2] animate-fade-in font-mono"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-4 flex items-center justify-between shadow-sm shrink-0"><div className="flex items-center gap-8"><button onClick={() => onViewChange('selection')} className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"><ArrowLeft className="h-5 w-5" /></button><h2 className="text-[14px] font-black text-slate-800 tracking-tight uppercase">Custom Report Execution Results</h2></div><div className="flex items-center gap-4"><Button onClick={handleExport} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-none shadow-md"><Download className="h-3.5 w-3.5 mr-2" /> Export to CSV</Button><Button onClick={() => onViewChange('selection')} variant="outline" className="h-8 text-[10px] font-black uppercase rounded-none border-slate-300">Back to Selection</Button></div></div><div className="flex-1 overflow-auto bg-white border border-slate-300 mx-4 mb-4 shadow-inner"><table className="w-full text-left border-collapse min-w-[3500px]"><thead className="sticky top-0 z-10 bg-[#f0f0f0] border-b border-slate-300"><tr className="text-[9px] font-black uppercase text-slate-600">{['Plant', 'Sale Order', 'SO Date Time', 'Consignor', 'Consignee', 'Ship To Party', 'Destination', 'Trip ID', 'Trip Created', 'Vehicle No', 'Driver Mob', 'Carrier', 'CN No', 'Invoice', 'E-Waybill', 'Product', 'Unit', 'Unit UOM', 'Assign Qty', 'Weight UOM', 'Vendor', 'Vendor Firm', 'Vendor Mob', 'Fleet Type', 'Payment Term', 'Rate', 'Freight Amt', 'Out Time', 'Arrived Time', 'Unload Time', 'Reject Time', 'POD Status'].map(h => <th key={h} className="p-2 border-r border-slate-200">{h}</th>)}</tr></thead><tbody>{results?.map((t: any) => {
                const o = t.order || {}; const cnItems = t.cnItems || []; const primaryItem = cnItems[0] || {};
                return (<tr key={t.id} className="border-b border-slate-100 text-[10px] font-bold hover:bg-blue-50/50"><td className="p-2 border-r border-slate-50">{t.plantCode}</td><td className="p-2 border-r border-slate-50 font-black text-[#1e3a8a]">{o.saleOrder}</td><td className="p-2 border-r border-slate-50">{o.saleOrderDate}</td><td className="p-2 border-r border-slate-50 uppercase truncate max-w-[200px]">{o.consignor}</td><td className="p-2 border-r border-slate-50 uppercase truncate max-w-[200px]">{o.consignee}</td><td className="p-2 border-r border-slate-50 uppercase truncate max-w-[200px]">{t.shipToParty}</td><td className="p-2 border-r border-slate-50 uppercase">{o.destination}</td><td className="p-2 border-r border-slate-50 font-black">{t.tripId}</td><td className="p-2 border-r border-slate-50">{t.createdAt}</td><td className="p-2 border-r border-slate-50 font-black text-blue-600">{t.vehicleNumber}</td><td className="p-2 border-r border-slate-50">{t.driverMobile}</td><td className="p-2 border-r border-slate-50 uppercase truncate max-w-[150px]">{t.carrierName}</td><td className="p-2 border-r border-slate-50 font-black text-emerald-600">{t.cnNo}</td><td className="p-2 border-r border-slate-50 uppercase">{primaryItem.invoiceNo}</td><td className="p-2 border-r border-slate-50 uppercase">{primaryItem.ewaybillNo}</td><td className="p-2 border-r border-slate-50 uppercase truncate max-w-[200px]">{primaryItem.product}</td><td className="p-2 border-r border-slate-50">{primaryItem.unit}</td><td className="p-2 border-r border-slate-50 uppercase">{primaryItem.uom}</td><td className="p-2 border-r border-slate-50 font-black text-emerald-700">{t.assignWeight}</td><td className="p-2 border-r border-slate-50 uppercase">{t.weightUom}</td><td className="p-2 border-r border-slate-50 uppercase truncate max-w-[150px]">{t.vendorName}</td><td className="p-2 border-r border-slate-50 uppercase truncate max-w-[150px]">{t.vendorFirmName}</td><td className="p-2 border-r border-slate-50">{t.vendorMobile}</td><td className="p-2 border-r border-slate-50 uppercase">{t.fleetType}</td><td className="p-2 border-r border-slate-50 uppercase">{t.paymentTerms}</td><td className="p-2 border-r border-slate-50">{t.rate}</td><td className="p-2 border-r border-slate-50">{t.freightAmount}</td><td className="p-2 border-r border-slate-50">{t.outDate} {t.outTime}</td><td className="p-2 border-r border-slate-50">{t.arrivedDate} {t.arrivedTime}</td><td className="p-2 border-r border-slate-50">{t.unloadDate} {t.unloadTime}</td><td className="p-2 border-r border-slate-50">{t.rejectionDate} {t.rejectionTime}</td><td className="p-2 font-black uppercase text-slate-500">{t.status}</td></tr>);
              })}</tbody></table></div></div>);
  }
  return (<div className="flex flex-col h-full bg-[#f2f2f2] font-mono"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-12 shadow-sm"><h1 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">ABAP Report Selection Hub</h1></div><div className="max-w-4xl mx-auto w-full px-8 space-y-12"><div className="bg-white border border-slate-300 p-12 space-y-10 shadow-sm animate-fade-in"><SectionGrouping title="MANDATORY FILTERS"><FormSelect label="PLANT" value={search.plant} options={allPlants.map((p: any) => p.plantCode)} onChange={(v: string) => onSearchChange({...search, plant: v})} /><FormInput label="FROM DATE" type="date" value={search.from} onChange={(v: string) => onSearchChange({...search, from: v})} /><FormInput label="TO DATE" type="date" value={search.to} onChange={(v: string) => onSearchChange({...search, to: v})} /></SectionGrouping><SectionGrouping title="OPTIONAL ENTITIES"><FormSelect label="COMPANY" value={search.company} options={allCompanies.map((c: any) => ({ value: c.companyCode, label: c.companyName }))} onChange={(v: string) => onSearchChange({...search, company: v})} /><FormSelect label="VENDOR" value={search.vendor} options={allVendors.map((v: any) => ({ value: v.vendorCode, label: v.vendorName }))} onChange={(v: string) => onSearchChange({...search, vendor: v})} /><FormSelect label="CUSTOMER" value={search.customer} options={allCustomers.map((c: any) => ({ value: c.customerCode, label: c.customerName }))} onChange={(v: string) => onSearchChange({...search, customer: v})} /></SectionGrouping></div></div></div>);
}

function ZCodeRegistry({ tcodes, onExecute }: any) {
  return (<div className="flex flex-col h-full bg-[#f2f2f2] font-mono animate-fade-in"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 shadow-sm"><h1 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase italic">ZCODE: System Transaction Registry</h1></div><div className="px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">{tcodes.map((t: any) => (<div key={t.code} onClick={() => onExecute(t.code)} className="bg-white border border-slate-300 p-6 hover:border-[#1e3a8a] hover:shadow-xl cursor-pointer transition-all group relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><t.icon className="h-16 w-16" /></div><div className="flex items-center gap-4 mb-4"><div className="w-10 h-10 bg-slate-50 flex items-center justify-center border border-slate-200 group-hover:bg-[#1e3a8a] transition-colors"><t.icon className="h-5 w-5 text-[#1e3a8a] group-hover:text-white" /></div><span className="text-[14px] font-black text-[#1e3a8a]">{t.code}</span></div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-t border-slate-50 pt-3">{t.description}</p></div>))}</div></div>);
}

function TrackShipmentScreen({ trips, orders, customers }: any) {
  const [refType, setRefType] = React.useState(''); const [refValue, setRefValue] = React.useState(''); const [loading, setLoading] = React.useState(false); const [view, setView] = React.useState<'search' | 'so_details' | 'track_view'>('search'); const [trackingData, setTrackingData] = React.useState<any>(null); const [linkedTrips, setLinkedTrips] = React.useState<any[]>([]); const [activeStep, setActiveStep] = React.useState(-1); const mapRef = React.useRef<HTMLDivElement>(null); const [gpsData, setGpsData] = React.useState<any[]>([]);
  React.useEffect(() => { const fetchGps = async () => { try { const res = await fetch('/api/gps'); if (res.ok) { const json = await res.json(); if (json?.data?.list) setGpsData(json.data.list); } } catch (e) {} }; fetchGps(); const i = setInterval(fetchGps, 30000); return () => clearInterval(i); }, []);
  const handleTrackNow = () => { if (!refValue) return; setLoading(true); const val = refValue.trim().toUpperCase(); setTimeout(() => { if (refType === 'Sale Order') { const order = orders?.find((o: any) => o.saleOrder === val || o.id === val); if (order) { setTrackingData(order); const tList = trips?.filter((t: any) => t.saleOrderId === order.id) || []; setLinkedTrips(tList); setView('so_details'); } else { alert("Registry Failure: Sale Order Not Found"); } } else { const trip = trips?.find((t: any) => t.tripId === val || t.id === val); if (trip) { setTrackingData(trip); setLinkedTrips([trip]); setView('track_view'); startAnimation(trip); } else { alert("Registry Failure: Trip ID Not Found"); } } setLoading(false); }, 800); };
  const startAnimation = (trip: any) => { let target = 0; if (trip.status === 'LOADING') target = 1; else if (trip.status === 'IN-TRANSIT') target = 2; else if (trip.status === 'ARRIVED') target = 3; else if (trip.status === 'CLOSED') target = 4; else if (trip.status === 'REJECTION') target = 4; let current = 0; setActiveStep(0); const interval = setInterval(() => { if (current < target) { current++; setActiveStep(current); } else { clearInterval(interval); } }, 2000); };
  const renderMap = () => {
    if (!window.google || !trackingData) return; const geocoder = new window.google.maps.Geocoder(); const directionsService = new window.google.maps.DirectionsService(); const directionsRenderer = new window.google.maps.DirectionsRenderer({ suppressMarkers: true, polylineOptions: { strokeColor: '#1e3a8a', strokeWeight: 5 } });
    const order = trackingData.saleOrderId ? orders?.find((o: any) => o.id === trackingData.saleOrderId) : trackingData;
    const consignorMaster = customers?.find((c: any) => c.customerName?.toUpperCase() === order?.consignor?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === order?.consignor?.toUpperCase());
    const shipToMaster = customers?.find((c: any) => c.customerName?.toUpperCase() === order?.shipToParty?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === order?.shipToParty?.toUpperCase());
    const gps = gpsData.find(v => v.vehicleNumber?.toUpperCase() === trackingData.vehicleNumber?.toUpperCase());
    const p1 = new Promise((resolve) => { if (consignorMaster?.postalCode) { geocoder.geocode({ address: consignorMaster.postalCode }, (res, status) => { if (status === 'OK') resolve(res[0].geometry.location); else resolve(null); }); } else resolve(null); });
    const p2 = new Promise((resolve) => { if (shipToMaster?.postalCode) { geocoder.geocode({ address: shipToMaster.postalCode }, (res, status) => { if (status === 'OK') resolve(res[0].geometry.location); else resolve(null); }); } else resolve(null); });
    Promise.all([p1, p2]).then(([startLoc, endLoc]: any) => {
      if (!mapRef.current) return; const map = new window.google.maps.Map(mapRef.current, { center: gps ? { lat: gps.latitude, lng: gps.longitude } : { lat: 20.5937, lng: 78.9629 }, zoom: gps ? 12 : 5, styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }] }); directionsRenderer.setMap(map);
      if (startLoc) { new window.google.maps.Marker({ position: startLoc, map, title: 'Start Point', icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' }); }
      if (endLoc) { new window.google.maps.Marker({ position: endLoc, map, title: 'Drop Point', icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' }); }
      if (gps) { new window.google.maps.Marker({ position: { lat: gps.latitude, lng: gps.longitude }, map, title: gps.vehicleNumber, icon: { url: 'https://maps.google.com/mapfiles/ms/icons/truck.png', scaledSize: new window.google.maps.Size(40, 40) } }); }
      if (startLoc && endLoc) { const request: any = { origin: startLoc, destination: endLoc, travelMode: window.google.maps.TravelMode.DRIVING }; if (gps) { request.waypoints = [{ location: { lat: gps.latitude, lng: gps.longitude }, stopover: false }]; } directionsService.route(request, (result, status) => { if (status === 'OK') { directionsRenderer.setDirections(result); } }); }
    });
  };
  React.useEffect(() => { if (view === 'track_view' && trackingData) renderMap(); }, [view, trackingData, gpsData]);
  if (view === 'search') { return (<div className="h-full flex flex-col font-mono"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-12 shadow-sm"><h1 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">Track Shipment Interface</h1></div><div className="max-w-4xl mx-auto w-full px-8 space-y-12"><div className="bg-white border border-slate-300 p-12 space-y-10 shadow-sm animate-fade-in"><div className="space-y-6"><div className="flex items-center gap-8"><label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase">Reference Type:</label><select value={refType} onChange={e => setRefType(e.target.value)} className="h-9 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase"><option value="">SELECT OPTION...</option><option value="Sale Order">Sale Order</option><option value="Trip ID">Trip ID</option></select></div>{refType && (<div className="flex items-center gap-8 animate-fade-in"><label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase">{refType}:</label><input value={refValue} onChange={(e) => setRefValue(e.target.value)} className="h-9 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase tracking-widest" placeholder={`ENTER ${refType.toUpperCase()}...`} /></div>)}</div><div className="pl-[212px] flex gap-4"><Button onClick={() => setRefValue('')} variant="outline" className="h-9 px-8 rounded-none border-slate-300 text-[10px] font-black uppercase">Clear</Button><Button onClick={handleTrackNow} disabled={loading || !refType || !refValue} className="h-9 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Execute Tracking'}</Button></div></div></div></div>); }
  if (view === 'so_details') { return (<div className="h-full font-mono animate-fade-in"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 flex items-center justify-between shadow-sm"><h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">Order Registry Details</h2><Button onClick={() => setView('search')} variant="outline" className="h-8 text-[9px] font-black uppercase rounded-none border-slate-300">New Search</Button></div><div className="max-w-5xl mx-auto px-8 space-y-12"><div className="bg-white border border-slate-300 p-10 space-y-10 shadow-sm"><div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6 mb-10"><div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Plant:</label><span className="text-[12px] font-black uppercase">{trackingData.plantCode}</span></div><div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Order Booked Date Time:</label><span className="text-[12px] font-black uppercase">{format(new Date(trackingData.saleOrderDate || trackingData.createdAt), 'dd-MMM-yyyy HH:mm')}</span></div><div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Consignor:</label><span className="text-[12px] font-black uppercase truncate">{trackingData.consignor}</span></div><div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Consignee:</label><span className="text-[12px] font-black uppercase truncate">{trackingData.consignee}</span></div><div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Ship to Party:</label><span className="text-[12px] font-black uppercase truncate">{trackingData.shipToParty}</span></div><div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Order Quantity:</label><span className="text-[12px] font-black text-emerald-600">{trackingData.weight} {trackingData.weightUom}</span></div><div className="flex items-center gap-6 border-b border-slate-50 pb-2"><label className="text-[11px] font-black text-slate-400 w-40 uppercase tracking-tighter shrink-0">Route:</label><span className="text-[12px] font-black text-[#1e3a8a] uppercase">{trackingData.from} → {trackingData.destination}</span></div></div>{(!linkedTrips || linkedTrips.length === 0) && (<div className="space-y-4"><p className="text-[13px] font-black text-[#1e3a8a] uppercase leading-relaxed">Your sale order {trackingData.saleOrder} has been booked for dispatch. Once the vehicle is assigned, we will share the Trip ID for live updates.</p>{trackingData.delayRemark && (<div className="p-4 bg-yellow-50 border border-yellow-200"><p className="text-[12px] font-black text-yellow-700 uppercase italic">"{trackingData.delayRemark}"</p></div>)}</div>)}{linkedTrips && linkedTrips.length === 1 && (<div className="space-y-4"><p className="text-[13px] font-black text-[#1e3a8a] uppercase leading-relaxed">Sale order {trackingData.saleOrder} against generated Trip ID is <button onClick={() => { setTrackingData(linkedTrips[0]); startAnimation(linkedTrips[0]); setView('track_view'); }} className="underline hover:text-blue-700 decoration-2 underline-offset-4">{linkedTrips[0].tripId}</button>. Click on Trip ID to track your shipment.</p>{trackingData.delayRemark && (<div className="p-4 bg-yellow-50 border border-yellow-200"><p className="text-[12px] font-black text-yellow-700 uppercase italic">"{trackingData.delayRemark}"</p></div>)}</div>)}{linkedTrips && linkedTrips.length > 1 && (<div className="space-y-6"><p className="text-[13px] font-black text-[#1e3a8a] uppercase leading-relaxed">Sale order {trackingData.saleOrder} against multiple Trip IDs:</p><div className="space-y-3 pl-4">{linkedTrips.map((t: any) => (<div key={t.id} className="flex items-center gap-4"><button onClick={() => { setTrackingData(t); startAnimation(t); setView('track_view'); }} className="text-[12px] font-black text-[#0056d2] uppercase hover:underline decoration-2 underline-offset-4">Trip ID {t.tripId}</button><span className="text-[12px] font-bold text-slate-500 uppercase tracking-tighter">– Assigned Qty – {t.assignWeight} {t.weightUom || 'MT'}</span></div>))}</div><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest pt-4 border-t border-slate-100">Click on Trip ID to track your shipment.</p>{trackingData.delayRemark && (<div className="p-4 bg-yellow-50 border border-yellow-200"><p className="text-[12px] font-black text-yellow-700 uppercase italic">"{trackingData.delayRemark}"</p></div>)}</div>)}</div></div></div>); }
  const steps = [{ label: 'Order Booked', icon: ShoppingCart }, { label: 'Loading', icon: Package }, { label: 'IN-Transit', icon: Truck }, { label: 'Arrived', icon: MapPin }, { label: trackingData.status === 'REJECTION' ? 'Reject' : 'Delivered', icon: trackingData.status === 'REJECTION' ? AlertTriangle : CheckCircle }];
  return (<div className="h-full font-mono animate-fade-in flex flex-col"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 flex items-center justify-between shadow-sm shrink-0"><h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">Live Logistical Tracker</h2><Button onClick={() => setView(linkedTrips.length > 1 ? 'so_details' : 'search')} variant="outline" className="h-8 text-[9px] font-black uppercase rounded-none border-slate-300">Back</Button></div><div className="flex-1 overflow-y-auto px-8 space-y-8 pb-20"><div className="bg-white border border-slate-300 p-8 space-y-10 shadow-sm relative overflow-hidden"><div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10 opacity-80 border-b border-slate-100 pb-8"><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[13px] font-black uppercase text-[#1e3a8a]">{trackingData.vehicleNumber}</span></div><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driver Registry</span><span className="text-[13px] font-black">{trackingData.driverMobile}</span></div><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Weight Data</span><span className="text-[13px] font-black text-emerald-600">{trackingData.assignWeight} MT</span></div><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</span><span className="text-[13px] font-black uppercase text-blue-600 truncate">{trackingData.route}</span></div></div><div className="py-12 relative flex justify-between px-8">{steps.map((s, i) => { const statusColor = i < activeStep ? "text-emerald-600" : i === activeStep ? "text-yellow-600" : "text-red-500"; const iconColor = i < activeStep ? "bg-emerald-50 text-emerald-600 border-emerald-200" : i === activeStep ? "bg-yellow-50 text-yellow-600 border-yellow-300 shadow-md" : "bg-red-50 text-red-500 border-red-100"; return (<div key={s.label} className="flex flex-col items-center gap-4 group relative z-10"><div className={cn("w-14 h-14 rounded-none border-2 flex items-center justify-center transition-all duration-500", iconColor)}><s.icon className="h-7 w-7" /></div><div className="text-center"><p className={cn("text-[10px] font-black uppercase tracking-widest", statusColor)}>{s.label}</p>{i <= activeStep && (<p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{format(new Date(trackingData.createdAt), 'dd-MMM-yy HH:mm')}</p>)}</div></div>); })}<div className="absolute top-[40px] left-[10%] right-[10%] h-px bg-slate-200 -z-0" /><div className="absolute top-[-5px] transition-all duration-[2000ms] ease-in-out" style={{ left: `${(activeStep / (steps.length - 1)) * 80 + 10}%`, transform: 'translateX(-50%)' }}><div className="bg-white p-3 shadow-2xl border border-blue-100 animate-bounce"><Truck className={cn("h-11 w-11", trackingData.status === 'REJECTION' && activeStep === 4 ? "text-red-500 rotate-180" : "text-[#1e3a8a]")} /></div></div></div>{trackingData.status === 'REJECTION' && <div className="mt-8 bg-red-50 border border-yellow-200 p-4 text-center"><p className="text-[10px] font-black text-red-600 uppercase italic">REJECTION REASON: {trackingData.rejectionRemark}</p></div>}</div><div className="h-[450px] bg-white border border-slate-300 shadow-sm"><div ref={mapRef} className="w-full h-full" /></div><div className="flex justify-between items-center px-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Sync: High-Density Tracking</p><Badge variant="outline" className="text-[8px] font-black bg-blue-50 border-blue-100 text-blue-800 rounded-none">TR24 SAP INTERFACE</Badge></div></div></div>);
}

export default function DashboardPage() {
  const router = useRouter(); const { user, isUserLoading } = useUser(); const db = useFirestore();
  const [tCode, setTCode] = React.useState(''); const [history, setHistory] = React.useState<string[]>([]); const [screenStack, setScreenStack] = React.useState<Screen[]>(['HOME']); const [showHistory, setShowHistory] = React.useState(false); const [historyIndex, setHistoryIndex] = React.useState(-1); const [activeScreen, setActiveScreen] = React.useState<Screen>('HOME'); const [formData, setFormData] = React.useState<any>({}); const [searchId, setSearchId] = React.useState(''); const [statusMsg, setStatusMsg] = React.useState<{ text: string, type: 'success' | 'error' | 'info' | 'none' }>({ text: 'Ready', type: 'none' }); const [greeting, setGreeting] = React.useState('');
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL'); const [homeMonthFilter, setHomeMonthFilter] = React.useState(format(new Date(), 'yyyy-MM')); const [showMonthCalendar, setShowMonthCalendar] = React.useState(false); const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false); const [isAuthChecking, setIsAuthChecking] = React.useState(true); const [registryId, setRegistryId] = React.useState<string | null>(null); const [xdSearch, setXdSearch] = React.useState({ plant: '', type: '', name: '', customerId: '', postalCode: '' });
  const [se38Search, setSe38Search] = React.useState({ plant: '', vendor: '', company: '', customer: '', from: format(subDays(new Date(), 7), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }); const [se38Results, setSe38Results] = React.useState<any[] | null>(null); const [se38View, setSe38View] = React.useState<'selection' | 'result'>('selection');
  const [viewMode, setViewMode] = React.useState<'list' | 'tracking'>('list'); const [trackingNode, setTrackingNode] = React.useState<any>(null);
  const tCodeRef = React.useRef<HTMLInputElement>(null); const monthRef = React.useRef<HTMLDivElement>(null); const bulkInputRef = React.useRef<HTMLInputElement>(null);
  const settingsRef = useMemoFirebase(() => doc(db, 'users', SHARED_HUB_ID, 'settings', 'gps_config'), [db]);
  const { data: settings } = useDoc(settingsRef);

  React.useEffect(() => {
    const isAdmin = localStorage.getItem('sap_bootstrap_session') === 'true'; const rid = registryId || localStorage.getItem('sap_registry_id'); setIsBootstrapAdmin(isAdmin); setRegistryId(rid); setIsAuthChecking(false);
    const scriptId = 'google-maps-script'; if (!document.getElementById(scriptId)) { const script = document.createElement('script'); script.id = scriptId; script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU&libraries=places`; script.async = true; script.defer = true; document.head.appendChild(script); }
  }, [registryId]);

  React.useEffect(() => {
    const updateGreeting = () => { const now = new Date(); const utc = now.getTime() + (now.getTimezoneOffset() * 60000); const istTime = new Date(utc + (3600000 * 5.5)); const hour = istTime.getHours();
      let msg = ''; if (hour >= 0 && hour < 12) msg = 'Good Morning, Have a good day'; else if (hour >= 12 && hour < 17) msg = 'Good Afternoon, Have a great day'; else msg = 'Good Evening'; setGreeting(msg);
    }; updateGreeting(); const interval = setInterval(updateGreeting, 60000); return () => clearInterval(interval);
  }, []);

  const profileRef = useMemoFirebase(() => { if (!user) return null; if (isBootstrapAdmin) return doc(db, 'user_registry', user.uid); const rid = registryId || localStorage.getItem('sap_registry_id'); return rid ? doc(db, 'user_registry', rid) : null; }, [user, db, isBootstrapAdmin, registryId]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(profileRef);
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
  const { data: allUsers, isLoading: isAllUsersLoading } = useCollection(usersQuery);

  const getStats = React.useCallback((o: any) => { 
    if (!o.id || !rawTrips) return { tot: 0, ass: 0, bal: 0, uom: o.weightUom || 'MT' };
    const tot = parseFloat(o.weight) || 0; 
    const ass = rawTrips?.filter((t: any) => t.saleOrderId === o.id).reduce((a: number, t: any) => a + (parseFloat(t.assignWeight) || 0), 0) || 0; 
    return { tot, ass, bal: tot - ass, uom: o.weightUom || 'MT' }; 
  }, [rawTrips]);

  const authorizedPlantsList = React.useMemo(() => userProfile?.plants || [], [userProfile]);
  const accessiblePlants = React.useMemo(() => { if (isBootstrapAdmin) return rawPlants || []; return (rawPlants || []).filter(p => authorizedPlantsList.includes(p.plantCode)); }, [rawPlants, authorizedPlantsList, isBootstrapAdmin]);
  const accessibleCompanies = React.useMemo(() => { if (isBootstrapAdmin) return rawCompanies || []; return (rawCompanies || []).filter(c => c.plantCodes?.some((p: string) => authorizedPlantsList.includes(p))); }, [rawCompanies, authorizedPlantsList, isBootstrapAdmin]);
  const accessibleVendors = React.useMemo(() => { if (isBootstrapAdmin) return rawVendors || []; return (rawVendors || []).filter(v => v.plantCodes?.some((p: string) => authorizedPlantsList.includes(p))); }, [rawVendors, authorizedPlantsList, isBootstrapAdmin]);
  const accessibleCustomers = React.useMemo(() => { if (isBootstrapAdmin) return rawCustomers || []; return (rawCustomers || []).filter(c => c.plantCodes?.some((p: string) => authorizedPlantsList.includes(p))); }, [rawCustomers, authorizedPlantsList, isBootstrapAdmin]);
  const accessibleUsers = React.useMemo(() => { if (isBootstrapAdmin) return allUsers || []; if (!authorizedPlantsList.length) return []; return (allUsers || []).filter(u => u.plants?.some((p: string) => authorizedPlantsList.includes(p))); }, [allUsers, authorizedPlantsList, isBootstrapAdmin]);
  const allTrips = React.useMemo(() => { if (isBootstrapAdmin) return rawTrips || []; if (!authorizedPlantsList.length) return []; return rawTrips?.filter(t => authorizedPlantsList.includes(t.plantCode)) || []; }, [rawTrips, authorizedPlantsList, isBootstrapAdmin]);
  const allOrders = React.useMemo(() => { if (isBootstrapAdmin) return rawOrders || []; if (!authorizedPlantsList.length) return []; return rawOrders?.filter(o => authorizedPlantsList.includes(o.plantCode)) || []; }, [rawOrders, authorizedPlantsList, isBootstrapAdmin]);

  const homeStats = React.useMemo(() => {
    if (!allOrders || !allTrips) return { open: 0, loading: 0, transit: 0, arrived: 0, pod: 0, reject: 0, closed: 0 };
    const filterFn = (item: any) => { const matchesPlant = homePlantFilter === 'ALL' || item.plantCode === homePlantFilter; if (!matchesPlant) return false; const itemDate = item.createdAt || item.updatedAt || item.lrDate || item.saleOrderDate; const matchesMonth = !homeMonthFilter || (itemDate && itemDate.startsWith(homeMonthFilter)); return matchesMonth; };
    const filteredOrders = allOrders.filter(o => { if (o.status === 'CANCELLED' || o.status === 'Short closed') return false; if (!filterFn(o)) return false; const stats = getStats(o); return stats.bal > 0; });
    const filteredTrips = allTrips.filter(filterFn);
    return {
      open: filteredOrders.length, loading: filteredTrips.filter(t => t.status === 'LOADING').length,
      transit: filteredTrips.filter(t => t.status === 'IN-TRANSIT').length, arrived: filteredTrips.filter(t => t.status === 'ARRIVED').length,
      pod: filteredTrips.filter(t => t.status === 'POD').length, reject: filteredTrips.filter(t => t.status === 'REJECTION').length,
      closed: filteredTrips.filter(t => t.status === 'CLOSED').length,
    };
  }, [allOrders, allTrips, homePlantFilter, homeMonthFilter, getStats]);

  const isAuthorized = React.useCallback((code: string) => { if (code === 'HOME' || code === '' || isBootstrapAdmin) return true; if (!userProfile) { const registryIsEmpty = Array.isArray(allUsers) && allUsers.length === 0; return registryIsEmpty; } return userProfile.tcodes?.includes(code); }, [userProfile, allUsers, isBootstrapAdmin]);
  const getRegistryList = React.useCallback(() => { if (activeScreen.startsWith('OX')) return accessiblePlants; if (activeScreen.startsWith('FM')) return accessibleCompanies; if (activeScreen.startsWith('XK')) return accessibleVendors; if (activeScreen.startsWith('XD')) { let list = accessibleCustomers; if (xdSearch.plant) list = list.filter((c: any) => c.plantCodes?.includes(xdSearch.plant)); if (xdSearch.type) list = list.filter((c: any) => c.customerType === xdSearch.type); if (xdSearch.name) list = list.filter((c: any) => c.customerName?.toUpperCase().includes(xdSearch.name.toUpperCase())); return list; } if (activeScreen.startsWith('VA')) return allOrders; if (activeScreen.startsWith('SU')) return accessibleUsers; return []; }, [activeScreen, accessiblePlants, accessibleCompanies, accessibleVendors, accessibleCustomers, allOrders, accessibleUsers, xdSearch]);

  const handleDownloadTemplate = React.useCallback(() => {
    let headers = ""; let filename = "";
    if (activeScreen.startsWith('VA')) { headers = "Plant,Consignor,Consignee Code,Consignee Name,Ship to Party Code,Ship to Party Name,Weight,UOM"; filename = "VA01_SALES_ORDER_TEMPLATE.csv"; }
    else if (activeScreen.startsWith('XD')) { headers = "PlantCodes,CustomerCode,CustomerName,CustomerType,Address,City,PostalCode,Mobile No.,GSTIN"; filename = "XD01_CUSTOMER_MASTER_TEMPLATE.csv"; }
    else if (activeScreen.startsWith('FM')) { headers = "CompanyCode,CompanyName,Address,City,State,PostalCode,GSTIN,PAN,Mobile,Email,Website"; filename = "FM01_COMPANY_MASTER_TEMPLATE.csv"; }
    else { setStatusMsg({ text: "Template Not Available", type: 'error' }); return; }
    const blob = new Blob([headers], { type: 'text/csv' }); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); window.URL.revokeObjectURL(url); setStatusMsg({ text: `Template ${filename} downloaded`, type: 'success' });
  }, [activeScreen]);

  const handleBulkUpload = React.useCallback(() => { if (bulkInputRef.current) bulkInputRef.current.click(); }, []);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string; const rows = text.split('\n').filter(r => r.trim()); if (rows.length < 2) { setStatusMsg({ text: 'Error: CSV is empty or invalid', type: 'error' }); return; }
      const parseCsvRow = (rowText: string) => { const result = []; let currentField = ''; let insideQuotes = false; for (let i = 0; i < rowText.length; i++) { const char = rowText[i]; if (char === '"') insideQuotes = !insideQuotes; else if (char === ',' && !insideQuotes) { result.push(currentField.trim()); currentField = ''; } else currentField += char; } result.push(currentField.trim()); return result.map(field => field.replace(/^"|"$/g, '').trim()); };
      const headers = parseCsvRow(rows[0]); const dataRows = rows.slice(1); setStatusMsg({ text: `Synchronizing...`, type: 'info' });
      if (activeScreen.startsWith('VA')) {
        const getIdx = (name: string) => headers.findIndex(h => h.toLowerCase().replace(/\s/g, '') === name.toLowerCase().replace(/\s/g, ''));
        const idxP = getIdx('Plant'); const idxCons = getIdx('Consignor'); const idxCeeCode = getIdx('ConsigneeCode'); const idxShipCode = getIdx('ShiptoPartyCode'); const idxW = getIdx('Weight'); const idxU = getIdx('UOM');
        if (idxP === -1 || idxCons === -1 || idxCeeCode === -1 || idxShipCode === -1 || idxW === -1 || idxU === -1) { setStatusMsg({ text: 'Error: Mandatory headers missing', type: 'error' }); return; }
        const orderGroups: Record<string, any> = {}; let rejectedCount = 0;
        dataRows.forEach((row, rowIndex) => {
          const cols = parseCsvRow(row); const plant = cols[idxP]; const cons = cols[idxCons]; const ceeCode = cols[idxCeeCode]; const shipCode = cols[idxShipCode]; const weight = parseFloat(cols[idxW] || '0'); const uom = cols[idxU];
          if (!plant || !cons || !ceeCode || !shipCode || isNaN(weight) || !uom) { rejectedCount++; return; }
          const ceeMaster = rawCustomers?.find(c => c.customerCode?.toString().toUpperCase() === ceeCode.toUpperCase());
          const shipMaster = rawCustomers?.find(c => c.customerCode?.toString().toUpperCase() === shipCode.toUpperCase());
          const consMaster = rawCustomers?.find(c => (c.customerName?.toUpperCase() === cons.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === cons.toUpperCase()));
          const soNo = `SO-B${Date.now().toString().slice(-6)}${rowIndex}`;
          if (!orderGroups[soNo]) { orderGroups[soNo] = { plantCode: plant, saleOrder: soNo, consignor: cons, from: consMaster?.city || '', consignee: ceeMaster?.customerName || 'UNKNOWN', shipToParty: shipMaster?.customerName || 'UNKNOWN', destination: shipMaster?.city || '', deliveryAddress: shipMaster?.address || '', weight: 0, weightUom: uom, status: 'Active', createdAt: new Date().toISOString(), saleOrderDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") }; }
          orderGroups[soNo].weight += weight;
        });
        Object.values(orderGroups).forEach(order => { const docId = crypto.randomUUID(); setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), { ...order, id: docId }, { merge: true }); });
        setStatusMsg({ text: `Bulk Sync: ${Object.keys(orderGroups).length} Saved, ${rejectedCount} Rejected`, type: rejectedCount > 0 ? 'error' : 'success' });
      } else if (activeScreen.startsWith('XD')) {
        const getIdx = (name: string) => headers.findIndex(h => h.toLowerCase().replace(/\s/g, '') === name.toLowerCase().replace(/\s/g, ''));
        const idxP = getIdx('PlantCodes'); const idxCC = getIdx('CustomerCode'); const idxCN = getIdx('CustomerName'); const idxCi = getIdx('City');
        if (idxP === -1 || idxCC === -1 || idxCN === -1 || idxCi === -1) { setStatusMsg({ text: 'Error: Mandatory headers missing', type: 'error' }); return; }
        let savedCount = 0; let rejectedCount = 0;
        dataRows.forEach(row => {
          const cols = parseCsvRow(row); if (!cols[idxP] || !cols[idxCC] || !cols[idxCN] || !cols[idxCi]) { rejectedCount++; return; }
          const docId = crypto.randomUUID();
          setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'customers', docId), { id: docId, plantCodes: cols[idxP].split(';'), customerCode: cols[idxCC], customerName: cols[idxCN], city: cols[idxCi], customerType: headers.includes('CustomerType') ? cols[headers.indexOf('CustomerType')] : '', address: headers.includes('Address') ? cols[headers.indexOf('Address')] : '', postalCode: headers.includes('PostalCode') ? cols[headers.indexOf('PostalCode')] : '', mobile: headers.includes('Mobile No.') ? cols[headers.indexOf('Mobile No.')].replace(/\D/g, '').slice(-10) : '', gstin: headers.includes('GSTIN') ? cols[headers.indexOf('GSTIN')] : '', updatedAt: new Date().toISOString() }, { merge: true });
          savedCount++;
        }); setStatusMsg({ text: `Bulk Sync: ${savedCount} Customers Saved, ${rejectedCount} Rejected`, type: rejectedCount > 0 ? 'error' : 'success' });
      }
      setTimeout(() => { if (bulkInputRef.current) bulkInputRef.current.value = ''; }, 1500);
    }; reader.readAsText(file);
  };

  const handleSave = React.useCallback(() => {
    if (!user || activeScreen === 'HOME' || (activeScreen.endsWith('03') && activeScreen !== 'SE38')) return;
    if (activeScreen === 'SE38') {
      const { plant, from, to, vendor, company, customer } = se38Search; if (!plant || !from || !to) { setStatusMsg({ text: 'Error: Mandatory filters missing', type: 'error' }); return; }
      let results = (rawTrips || []).filter(t => {
        const matchesPlant = t.plantCode === plant; const tripDate = (t.createdAt || t.updatedAt || '').split('T')[0]; const matchesDate = tripDate >= from && tripDate <= to;
        if (!matchesPlant || !matchesDate) return false;
        if (vendor && t.vendorCode !== vendor) return false;
        if (company) { const c = (rawCompanies || []).find(comp => comp.companyCode === company); if (!c || !c.plantCodes?.includes(t.plantCode)) return false; }
        if (customer) { const cust = (rawCustomers || []).find(c => c.customerCode === customer); if (!cust || (t.shipToParty !== cust.customerName && t.consignee !== cust.customerName && t.consignor !== cust.customerName)) return false; }
        return true;
      });
      results = results.map(t => ({ ...t, order: allOrders?.find(o => o.id === t.saleOrderId) }));
      setSe38Results(results); setSe38View('result'); setStatusMsg({ text: `Sync complete: ${results.length} records found`, type: 'success' }); return;
    }
    let localData = { ...formData }; const registryIsEmpty = Array.isArray(allUsers) && allUsers.length === 0;
    
    if (activeScreen === 'VA04') {
      const o = allOrders?.find(ord => (ord.saleOrder || ord.id)?.toString().toUpperCase() === localData.saleOrder?.toString().toUpperCase());
      if (!o) { setStatusMsg({ text: `Order Not Found`, type: 'error' }); return; }
      const stats = getStats(o);
      if (stats.bal <= 0) { setStatusMsg({ text: `Error: Fully assigned order cannot be closed`, type: 'error' }); return; }
      const newStatus = stats.ass === 0 ? 'CANCELLED' : 'Short closed';
      setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', o.id), { status: newStatus, updatedAt: new Date().toISOString() }, { merge: true });
      setStatusMsg({ text: `Order ${newStatus.toUpperCase()}`, type: 'success' }); setFormData({}); return;
    }

    if (!isBootstrapAdmin) {
      if (activeScreen.startsWith('OX')) { if (rawPlants?.some((p: any) => p.id !== localData.id && p.plantCode?.toString().toUpperCase() === localData.plantCode?.toString().toUpperCase())) { setStatusMsg({ text: `Duplicate Plant Code`, type: 'error' }); return; } }
      if (activeScreen.startsWith('FM')) { if (rawCompanies?.some((c: any) => c.id !== localData.id && c.companyCode?.toString().toUpperCase() === localData.companyCode?.toString().toUpperCase())) { setStatusMsg({ text: `Duplicate Company Code`, type: 'error' }); return; } }
      if (activeScreen.startsWith('XK')) { if (!(localData.plantCodes?.length && localData.mobile?.trim() && (localData.vendorName?.trim() || localData.vendorFirmName?.trim()))) { setStatusMsg({ text: 'Error: Missing mandatory data', type: 'error' }); return; } if (!localData.vendorCode) localData.vendorCode = `V${Math.floor(10000 + Math.random() * 90000)}`; }
      if (activeScreen.startsWith('XD')) { if (!(localData.plantCodes?.length && localData.customerCode && localData.customerName && localData.city)) { setStatusMsg({ text: 'Error: Missing mandatory data', type: 'error' }); return; } }
      if (activeScreen.startsWith('VA') && activeScreen !== 'VA04') { if (!(localData.plantCode && localData.saleOrder && localData.consignor && localData.weight)) { setStatusMsg({ text: 'Error: Missing mandatory data', type: 'error' }); return; } }
      if (activeScreen.startsWith('SU')) { if (!(localData.fullName && localData.username && localData.password && localData.plants?.length)) { setStatusMsg({ text: 'Error: Missing user data', type: 'error' }); return; } }
    }
    let col = ''; let docId = localData.id;
    if (activeScreen.endsWith('01')) docId = (activeScreen === 'SU01' && registryIsEmpty) ? user.uid : crypto.randomUUID();
    else docId = docId || crypto.randomUUID();
    if (activeScreen.startsWith('OX')) col = 'plants'; else if (activeScreen.startsWith('FM')) col = 'companies'; else if (activeScreen.startsWith('XK')) col = 'vendors'; else if (activeScreen.startsWith('XD')) col = 'customers'; else if (activeScreen.startsWith('VA')) col = 'sales_orders'; else if (activeScreen.startsWith('SU')) col = 'user_registry';
    if (col) {
      const docRef = col === 'user_registry' ? doc(db, 'user_registry', docId) : doc(db, 'users', SHARED_HUB_ID, col, docId);
      const payload = { ...localData, id: docId, updatedAt: new Date().toISOString(), createdAt: localData.createdAt || new Date().toISOString() };
      setDocumentNonBlocking(docRef, payload, { merge: true }); setStatusMsg({ text: `Synchronized successfully`, type: 'success' });
      if (activeScreen.endsWith('01')) { setFormData({}); setSearchId(''); } else if (!formData.id) setFormData(payload);
    }
  }, [user, activeScreen, formData, allOrders, rawPlants, allUsers, db, isBootstrapAdmin, rawCustomers, rawCompanies, rawVendors, rawOrders, se38Search, rawTrips, getStats]);

  const executeTCode = React.useCallback((code: string) => {
    const input = code.toUpperCase().trim(); if (!input) return; let clean = input; let isNewSession = false;
    if (input.startsWith('/N')) clean = input.substring(2).trim(); else if (input.startsWith('/O')) { clean = input.substring(2).trim(); isNewSession = true; }
    if (clean !== 'HOME' && clean !== '' && !isAuthorized(clean)) { setStatusMsg({ text: `Unauthorized: ${clean}`, type: 'error' }); setTCode(''); return; }
    setHistory(p => [input, ...p.filter(h => h !== input)].slice(0, 7)); setShowHistory(false); setHistoryIndex(-1);
    if (isNewSession) { const baseUrl = window.location.origin + window.location.pathname; window.open(clean ? `${baseUrl}?tcode=${clean}` : baseUrl, '_blank'); setTCode(''); return; }
    if (clean === 'HOME' || clean === '') { setScreenStack(prev => [...prev, 'HOME']); setActiveScreen('HOME'); setTCode(''); setFormData({}); setSearchId(''); return; }
    if (MASTER_TCODES.some(t => t.code === clean)) { setScreenStack(prev => [...prev, clean as Screen]); setActiveScreen(clean as Screen); setFormData({}); setSearchId(''); setXdSearch({ plant: '', type: '', name: '', customerId: '', postalCode: '' }); setSe38Results(null); setSe38View('selection'); setViewMode('list'); setStatusMsg({ text: `Transaction ${clean} executed`, type: 'info' }); }
    else setStatusMsg({ text: `T-Code ${clean} not found`, type: 'error' }); setTCode('');
  }, [isAuthorized]);

  const handleBack = React.useCallback(() => { if (activeScreen === 'TR21' && viewMode === 'tracking') { setViewMode('list'); return; } if (activeScreen === 'SE38' && se38View === 'result') { setSe38View('selection'); return; } if (screenStack.length <= 1) { setActiveScreen('HOME'); setFormData({}); return; } const newStack = [...screenStack]; newStack.pop(); const prevScreen = newStack[newStack.length - 1]; setScreenStack(newStack); setActiveScreen(prevScreen); setFormData({}); setSearchId(''); setStatusMsg({ text: `Navigated to ${prevScreen}`, type: 'info' }); }, [screenStack, activeScreen, viewMode, se38View]);
  const handleCancel = React.useCallback(() => { if (activeScreen === 'HOME' || (activeScreen.endsWith('03') && activeScreen !== 'SE38')) return; setFormData({}); setSearchId(''); setStatusMsg({ text: 'Operation cancelled', type: 'info' }); }, [activeScreen]);
  React.useEffect(() => { const handleGlobalKeyDown = (e: KeyboardEvent) => { if (['F3', 'F4', 'F8', 'F12'].includes(e.key)) e.preventDefault(); if (e.key === 'F8') handleSave(); if (e.key === 'F3') { if (e.shiftKey) router.push('/'); else handleBack(); } if (e.key === 'F4') tCodeRef.current?.focus(); if (e.key === 'F12') handleCancel(); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); } if (e.key === 'ArrowDown' && showHistory) { e.preventDefault(); setHistoryIndex(p => (p < history.length - 1 ? p + 1 : p)); } if (e.key === 'ArrowUp' && showHistory) { e.preventDefault(); setHistoryIndex(p => (p > 0 ? p - 1 : 0)); } if (e.key === 'Enter' && document.activeElement === tCodeRef.current) { if (showHistory && historyIndex >= 0) { const s = history[historyIndex]; setTCode(s); executeTCode(s); } else executeTCode(tCode); } }; window.addEventListener('keydown', handleGlobalKeyDown); return () => window.removeEventListener('keydown', handleGlobalKeyDown); }, [activeScreen, handleSave, handleCancel, executeTCode, handleBack, showHistory, historyIndex, history, router, tCode]);

  if (isUserLoading || isProfileLoading || isAllUsersLoading || isAuthChecking) { return <div className="h-screen w-full bg-[#f0f3f9] flex flex-col items-center justify-center font-mono space-y-4"><div className="w-8 h-8 border-2 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" /><span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1e3a8a]">Synchronizing...</span></div>; }
  const isReadOnly = activeScreen.endsWith('03'); const showList = (activeScreen.endsWith('02') || activeScreen.endsWith('03')) && !formData.id && activeScreen !== 'SE38'; const showForm = activeScreen.endsWith('01') || activeScreen === 'VA04' || ((activeScreen.endsWith('02') || activeScreen.endsWith('03')) && formData.id); const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'slmc-logo');
  const handleSearchIdEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { const idToSearch = searchId; if (!idToSearch) return; let list = getRegistryList(); let item = list.find((i: any) => (i.plantCode || i.customerCode || i.companyCode || i.saleOrder || i.username || i.id || i.vendorCode).toString().toUpperCase() === idToSearch.toUpperCase()); if (item) { setFormData(item); setSearchId(''); setStatusMsg({ text: `Record ${idToSearch} loaded`, type: 'success' }); } else setStatusMsg({ text: `Record ${idToSearch} not found`, type: 'error' }); } };

  return (<div className="flex flex-col h-screen w-full bg-[#f0f3f9] text-[#333] font-mono overflow-hidden"><div className="flex items-center bg-[#c5e0b4] border-b border-slate-400 px-3 h-8 text-[11px] font-semibold z-50 print:hidden"><div className="flex items-center gap-6">{['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map(i => <button key={i} className="hover:text-blue-800 transition-colors uppercase">{i}</button>)}</div><div className="flex-1" /><div className="flex items-center h-full"><button className="h-full px-2 hover:bg-white/30"><PlusSquare className="h-3.5 w-3.5 opacity-30" /></button><button className="h-full px-2 hover:bg-white/30"><Grid2X2 className="h-3 w-3 opacity-30" /></button><button onClick={() => router.push('/')} className="h-full px-3 hover:bg-[#e81123] hover:text-white"><X className="h-3.5 w-3.5" /></button></div></div><div className="flex flex-col bg-[#f0f0f0] border-b border-slate-300 shadow-sm z-40 print:hidden"><div className="flex items-center px-2 py-1 gap-4"><div className="flex items-center gap-2 shrink-0 pr-4 border-r border-slate-300">{logoAsset && <Image src={logoAsset.url} alt="SLMC" width={80} height={30} className="object-contain" unoptimized data-ai-hint="logistics logo" />}</div><div className="flex items-center bg-white border border-slate-400 p-0.5 shadow-inner relative"><button onClick={(e) => { e.preventDefault(); executeTCode(tCode); }} className="px-1 text-[#008000] font-black text-xs hover:bg-slate-100 transition-colors">✓</button><input ref={tCodeRef} type="text" value={tCode} onChange={(e) => { setTCode(e.target.value); if (showHistory) setShowHistory(false); }} onClick={() => history.length > 0 && setShowHistory(true)} onBlur={() => setTimeout(() => setShowHistory(false), 200)} className="w-48 outline-none text-xs px-1 font-bold tracking-wider" />{showHistory && history.length > 0 && (<div className="absolute top-full left-0 w-full bg-white border border-slate-400 shadow-md z-[60] mt-0.5">{history.map((h, i) => <div key={i} onClick={() => { setTCode(h); executeTCode(h); }} className={cn("px-4 py-1.5 text-xs font-bold cursor-pointer hover:bg-blue-50 transition-colors", i === historyIndex ? "bg-blue-100" : "")}>{h}</div>)}</div>)}</div><div className="flex items-center gap-1.5 px-4 border-l border-slate-300 ml-2 h-7"><button onClick={handleSave} disabled={activeScreen === 'HOME' || (isReadOnly && activeScreen !== 'SE38')} className={cn("p-1 rounded", (activeScreen === 'HOME' || (isReadOnly && activeScreen !== 'SE38')) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")} title={activeScreen === 'SE38' ? "Execute (F8)" : "Save (F8)"}>{activeScreen === 'SE38' ? <PlayCircle className="h-4 w-4 text-blue-600" /> : <Save className="h-4 w-4 text-slate-600" />}</button><button onClick={handleBack} className="p-1 hover:bg-slate-200 rounded" title="Back Step-by-Step (F3)"><Undo2 className="h-4 w-4 text-slate-600" /></button><button onClick={handleCancel} disabled={activeScreen === 'HOME' || (isReadOnly && activeScreen !== 'SE38')} className={cn("p-1 rounded", (activeScreen === 'HOME' || (isReadOnly && activeScreen !== 'SE38')) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")} title="Cancel (F12)"><XCircle className="h-4 w-4 text-slate-600" /></button><button onClick={() => window.open(window.location.href, '_blank')} className={cn("p-1 rounded hover:bg-slate-200")} title="New Session"><PlusSquare className="h-4 w-4 text-slate-600" /></button></div><div className="flex-1" /><div className="flex items-center gap-3 pr-4">{(activeScreen === 'XD01' || activeScreen === 'VA01' || activeScreen === 'FM01') && (<div className="flex items-center gap-2 mr-4"><input type="file" ref={bulkInputRef} onChange={handleFileChange} className="hidden" accept=".csv" /><button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 h-7 bg-white border border-slate-300 hover:bg-slate-50 rounded text-[9px] font-black uppercase tracking-widest text-[#1e3a8a]"><FileText className="h-3.5 w-3.5" /> Template</button><button onClick={handleBulkUpload} className="flex items-center gap-1.5 px-3 h-7 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded text-[9px] font-black uppercase tracking-widest"><UploadCloud className="h-3.5 w-3.5" /> Bulk Upload</button></div>)}<button onClick={() => window.print()} className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Printer className="h-4 w-4" /></button><button onClick={() => { localStorage.removeItem('sap_bootstrap_session'); localStorage.removeItem('sap_user_role'); router.push('/login'); }} className="flex items-center gap-2 px-3 h-7 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-black uppercase tracking-widest text-slate-700"><LogOut className="h-3.5 w-3.5" /> Log Off</button></div></div></div><div className="flex-1 flex overflow-hidden">{activeScreen === 'HOME' && (<div className="w-72 bg-white border-r border-slate-300 hidden lg:flex flex-col overflow-hidden print:hidden"><div className="p-4 border-b border-slate-200 bg-[#dae4f1]/50"><h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1e3a8a] flex items-center gap-2"><Grid2X2 className="h-3.5 w-3.5" /> Favorites</h2></div><div className="flex-1 overflow-y-auto green-scrollbar">{MASTER_TCODES.filter(t => t.code.endsWith('01') || t.code === 'TR21' || t.code === 'TR24' || t.code === 'VA04' || t.code === 'ZCODE' || t.code === 'WGPS24' || t.code === 'SE38').map((item) => (<div key={item.code} onClick={() => executeTCode(item.code)} className={cn("flex items-center gap-4 px-5 py-3 hover:bg-blue-50 cursor-pointer group border-b border-slate-100 transition-all", activeScreen === item.code ? "bg-[#0056d2] text-white" : "text-[#1e3a8a]")}><div className={cn("w-1.5 h-1.5 rounded-full shrink-0", activeScreen === item.code ? "bg-white" : "bg-slate-300 group-hover:bg-blue-600")} /><span className={cn("text-[10px] font-black uppercase tracking-tight", activeScreen === item.code ? "text-white" : "text-[#1e3a8a]")}>{item.code} - {item.description}</span><div className="flex-1" /><item.icon className={cn("h-3.5 w-3.5", activeScreen === item.code ? "text-white" : "text-slate-400")} /></div>))}</div></div>)}<div className="flex-1 flex flex-col overflow-hidden bg-[#f0f3f9]"><div className="flex-1 flex flex-col overflow-hidden bg-[#f2f2f2] print:bg-white">{activeScreen === 'HOME' ? (<div className="flex-1 overflow-y-auto p-2 md:p-4 relative animate-fade-in"><h1 className="text-2xl md:text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter mb-8">Sikka Logistics Management Control</h1><div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 md:p-6 border border-slate-300 shadow-sm mb-12"><div className="flex flex-col gap-1.5"><label className="text-[10px] font-black uppercase text-slate-400">Authorized Plant</label><select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold outline-none" value={homePlantFilter} onChange={(e) => setHomePlantFilter(e.target.value)}><option value="ALL">ALL AUTHORIZED PLANTS</option>{accessiblePlants.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}</select></div><div className="flex flex-col gap-2 relative" ref={monthRef}><label className="text-[10px] font-black uppercase text-slate-400">Period</label><div onClick={() => setShowMonthCalendar(!showMonthCalendar)} className="h-10 border border-slate-400 bg-white px-3 flex items-center justify-between cursor-pointer shadow-sm"><span className="text-xs font-bold text-slate-700 uppercase">{format(new Date(homeMonthFilter + '-01'), 'MMMM yyyy')}</span><CalendarIcon className="h-4 w-4 text-slate-400" /></div>{showMonthCalendar && (<div className="absolute top-full left-0 mt-1 z-[60] flex flex-col border border-slate-300 bg-white rounded-lg shadow-2xl w-full max-w-[320px] animate-slide-down"><div className="flex items-center justify-between p-3 border-b border-slate-200"><button onClick={(e) => { e.stopPropagation(); const [y, m] = homeMonthFilter.split('-'); setHomeMonthFilter(`${parseInt(y) - 1}-${m}`); }} className="p-1.5 hover:bg-slate-50 rounded-md border border-slate-200"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm font-black">{homeMonthFilter.split('-')[0]}</span><button onClick={(e) => { e.stopPropagation(); const [y, m] = homeMonthFilter.split('-'); setHomeMonthFilter(`${parseInt(y) + 1}-${m}`); }} className="p-1.5 hover:bg-slate-50 rounded-md border border-slate-200"><ChevronRight className="h-4 w-4" /></button></div><div className="grid grid-cols-4 gap-2 p-3">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => { const mStr = (i + 1).toString().padStart(2, '0'); const year = homeMonthFilter.split('-')[0]; const isActive = homeMonthFilter === `${year}-${mStr}`; return <button key={m} onClick={(e) => { e.stopPropagation(); setHomeMonthFilter(`${year}-${mStr}`); setShowMonthCalendar(false); }} className={cn("py-2 text-[10px] font-black border rounded-md uppercase", isActive ? "bg-[#0056d2] text-white border-[#0056d2]" : "bg-white text-slate-600 border-slate-200")}>{m}</button>; })}</div></div>)}</div></div><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">{[{ label: 'OPEN ORDER', count: homeStats.open, color: 'text-blue-600' }, { label: 'LOADING', count: homeStats.loading, color: 'text-orange-600' }, { label: 'IN-TRANSIT', count: homeStats.transit, color: 'text-emerald-600' }, { label: 'ARRIVED', count: homeStats.arrived, color: 'text-indigo-600' }, { label: 'POD SECTION', count: homeStats.pod, color: 'text-purple-600' }, { label: 'REJECT', count: homeStats.reject, color: 'text-red-600' }, { label: 'CLOSED', count: homeStats.closed, color: 'text-slate-600' }].map(w => (<div key={w.label} className="p-4 md:p-6 border border-slate-200 shadow-md flex flex-col items-center justify-center gap-2 bg-white animate-slide-up"><span className="text-[10px] font-black text-slate-400 uppercase text-center">{w.label}</span><span className={cn("text-2xl md:text-4xl font-black italic tracking-tighter", w.color)}>{w.count}</span></div>))}</div></div>) : (<div className={cn("animate-slide-up print:p-0 print:border-none print:shadow-none flex flex-col w-full h-full overflow-y-auto bg-[#f2f2f2] green-scrollbar")}>{showForm && <div className="space-y-0 min-h-full"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-10"><h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">{MASTER_TCODES.find(t => t.code === activeScreen)?.description || activeScreen}</h2></div><div className="px-10 pb-20 max-w-full">{activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}{activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}{activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}{activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}{activeScreen.startsWith('VA') && activeScreen !== 'VA04' && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} allCustomers={accessibleCustomers} trips={allTrips} screen={activeScreen} />}{activeScreen === 'VA04' && <CancelOrderForm data={formData} onChange={setFormData} allOrders={allOrders} allTrips={allTrips} onPost={handleSave} onCancel={() => setFormData({})} />}{activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}</div></div>}{showList && <div className="space-y-0 min-h-full"><div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 flex items-center justify-between"><h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">{MASTER_TCODES.find(t => t.code === activeScreen)?.description || activeScreen} - REGISTRY</h2><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AUTHORIZED</div></div><div className="px-10 pb-20 max-w-full"><div className="bg-white border-b-2 border-slate-300 p-6 mb-8 flex flex-col md:flex-row items-center gap-8"><div className="flex flex-col gap-2 flex-1 w-full"><label className="text-[11px] font-black uppercase text-slate-500 block tracking-widest">Search Criteria</label><div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">{activeScreen.startsWith('XD') ? (<><div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Select Plant</label><select className="h-8 border border-slate-400 bg-white px-2 text-xs font-bold" value={xdSearch.plant} onChange={(e) => setXdSearch({...xdSearch, plant: e.target.value})}><option value="">ALL PLANTS</option>{accessiblePlants.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}</select></div><div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Select Type</label><select className="h-8 border border-slate-400 bg-white px-2 text-xs font-bold" value={xdSearch.type} onChange={(e) => setXdSearch({...xdSearch, type: e.target.value})}><option value="">ALL TYPES</option><option value="Consignor">Consignor</option><option value="Consignee - Ship to Party">Consignee - Ship to Party</option></select></div><div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Enter Name</label><input className="h-8 border border-slate-400 px-3 text-xs font-black outline-none" value={xdSearch.name} onChange={(e) => setXdSearch({...xdSearch, name: e.target.value})} /></div></>) : (<div className="col-span-1 md:col-span-3 flex items-center gap-4"><input className="h-9 w-full max-w-2xl border border-slate-400 px-4 text-xs font-black outline-none bg-white focus:ring-1 focus:ring-blue-500 uppercase tracking-widest" value={searchId} onChange={(e) => setSearchId(e.target.value)} onKeyDown={handleSearchIdEnter} placeholder="ENTER IDENTIFIER AND PRESS ENTER..." /></div>)}</div></div></div><RegistryList onSelectItem={setFormData} listData={getRegistryList()} activeScreen={activeScreen} /></div></div>}{activeScreen === 'TR21' && viewMode === 'list' && (<TripBoard orders={allOrders} trips={allTrips} vendors={accessibleVendors} plants={accessiblePlants} companies={accessibleCompanies} customers={accessibleCustomers} onStatusUpdate={setStatusMsg} viewMode={viewMode} setViewMode={setViewMode} trackingNode={trackingNode} setTrackingNode={setTrackingNode} settings={settings} />)}{activeScreen === 'TR21' && viewMode === 'tracking' && (<Tr21TrackingPage node={trackingNode} onBack={() => setViewMode('list')} customers={accessibleCustomers} settings={settings} />)}{activeScreen === 'TR24' && <TrackShipmentScreen trips={allTrips} orders={allOrders} customers={accessibleCustomers} />}{activeScreen === 'WGPS24' && <GpsTrackingHub trips={allTrips} onStatusUpdate={setStatusMsg} db={db} settings={settings} settingsRef={settingsRef} />}{activeScreen === 'SE38' && (<Se38Report search={se38Search} results={se38Results} view={se38View} onSearchChange={setSe38Search} onViewChange={setSe38View} allPlants={accessiblePlants} allVendors={accessibleVendors} allCompanies={accessibleCompanies} allCustomers={accessibleCustomers} />)}{activeScreen === 'ZCODE' && <ZCodeRegistry tcodes={MASTER_TCODES} onExecute={executeTCode} />}</div>)}</div></div></div><div className="h-7 bg-[#0f172a] flex items-center px-4 text-[9px] font-black text-white/90 uppercase tracking-[0.15em] print:hidden"><div className="flex items-center gap-4 md:gap-8 overflow-hidden flex-1"><span className="flex items-center gap-2.5 shrink-0"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />SYNC: ACTIVE</span><span className="shrink-0">{activeScreen}</span><span className="truncate">USER: {isBootstrapAdmin ? 'SUPER ADMIN' : (userProfile?.fullName || 'Authenticating...')}</span>{statusMsg.text !== 'Ready' && <span className={cn("truncate", statusMsg.type === 'error' ? "text-red-400" : "text-blue-400")}>EVENT: {statusMsg.text}</span>}</div>{greeting && <div className="shrink-0 ml-4 hidden sm:block text-blue-400">{greeting}</div>}</div></div>);
}
