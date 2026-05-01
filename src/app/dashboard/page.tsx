
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ArrowLeft, ArrowRight, 
  RotateCcw, X, HelpCircle, LogOut, LayoutDashboard,
  ChevronRight, Building2, Check, AlertCircle, Info, PlusCircle, Trash2,
  Grid2X2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  useFirestore, 
  useUser, 
  useCollection, 
  useMemoFirebase,
  setDocumentNonBlocking 
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XD01' | 'XD02' | 'XD03';

export default function SapDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [tCode, setTCode] = React.useState('');
  const [activeScreen, setActiveScreen] = React.useState<Screen>('HOME');
  const [formData, setFormData] = React.useState<any>({});
  const [statusMsg, setStatusMsg] = React.useState<{ text: string, type: 'success' | 'error' | 'info' | 'none' }>({ text: 'Ready', type: 'none' });
  const tCodeRef = React.useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (!user) {
      setStatusMsg({ text: 'Session error: Please log in again', type: 'error' });
      return;
    }
    
    if (activeScreen === 'HOME' || activeScreen.endsWith('02') || activeScreen.endsWith('03')) {
      setStatusMsg({ text: 'No active transaction to save', type: 'info' });
      return;
    }

    let collectionName = '';
    const docId = formData.id || crypto.randomUUID();
    
    if (activeScreen.startsWith('OX')) collectionName = 'plants';
    else if (activeScreen.startsWith('FM')) collectionName = 'companies';
    else if (activeScreen.startsWith('XK')) collectionName = 'vendors';
    else if (activeScreen.startsWith('XD')) collectionName = 'customers';

    if (collectionName) {
      const docRef = doc(db, 'users', user.uid, collectionName, docId);
      const payload = { 
        ...formData, 
        id: docId, 
        updatedAt: new Date().toISOString() 
      };
      
      setDocumentNonBlocking(docRef, payload, { merge: true });
      
      if (!formData.id) {
        setFormData(payload);
      }
      
      const msg = `Registry ${docId.slice(0, 8)} synchronized successfully`;
      setStatusMsg({ text: msg, type: 'success' });
      
      toast({
        title: "Registry Updated",
        description: msg,
      });
    }
  };

  const executeTCode = (code: string) => {
    const formatted = code.toUpperCase().trim();
    const cleanCode = formatted.startsWith('/N') ? formatted.slice(2) : formatted;
    
    const validCodes = ['OX01', 'OX02', 'OX03', 'FM01', 'FM02', 'FM03', 'XK01', 'XK02', 'XK03', 'XD01', 'XD02', 'XD03'];
    
    if (validCodes.includes(cleanCode)) {
      setActiveScreen(cleanCode as Screen);
      setFormData({});
      setStatusMsg({ text: `Transaction ${cleanCode} started`, type: 'info' });
    } else if (cleanCode === 'HOME' || cleanCode === '') {
      setActiveScreen('HOME');
      setStatusMsg({ text: 'Main Hub', type: 'none' });
    }
    setTCode('');
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === '/' || (e.ctrlKey && e.key === 't')) {
        e.preventDefault();
        tCodeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, activeScreen, formData]);

  const handleLogout = () => router.push('/login');

  if (isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#d9e1f2] font-mono">
        <div className="text-center space-y-4">
          <RotateCcw className="h-12 w-12 text-[#0056d2] animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Synchronizing Session...</p>
        </div>
      </div>
    );
  }

  const isModuleActive = activeScreen !== 'HOME';

  return (
    <div className="flex flex-col h-screen bg-[#d9e1f2] text-[#333] font-mono select-none overflow-hidden">
      {/* Menu Bar */}
      <div className="flex items-center bg-[#f0f0f0] border-b border-white/50 px-2 h-7 text-[11px] font-semibold">
        {['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map((item) => (
          <DropdownMenu key={item}>
            <DropdownMenuTrigger className="px-3 hover:bg-[#0056d2] hover:text-white outline-none transition-colors h-full flex items-center">
              {item}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white rounded-none border-slate-300 shadow-xl text-[11px] p-0 min-w-[150px]">
              <DropdownMenuItem onClick={handleSave} className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4">Save (Ctrl+S)</DropdownMenuItem>
              <DropdownMenuSeparator className="m-0 bg-slate-200" />
              <DropdownMenuItem onClick={handleLogout} className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4 text-red-600">Log Off</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
        <div className="ml-auto flex items-center gap-2 pr-4 text-[10px] text-slate-500 font-bold uppercase">
          <span>S4P (1) 100</span>
          <div className="flex items-center gap-1 ml-4 text-[#0056d2] cursor-pointer" onClick={handleLogout}>
             <LogOut className="h-3 w-3" />
             <span>Log Off</span>
          </div>
        </div>
      </div>

      {/* Command Bar */}
      <div className="flex items-center bg-[#f0f0f0] border-b border-slate-300 px-2 py-1 gap-2 shadow-sm">
        <div className="flex items-center bg-white border border-slate-400 p-0.5 shadow-inner">
          <div className="px-1 text-[#008000] font-black text-xs">✓</div>
          <input 
            ref={tCodeRef}
            type="text" 
            value={tCode}
            onChange={(e) => setTCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeTCode(tCode)}
            className="w-48 outline-none text-xs px-1 font-bold tracking-wider"
            placeholder="/n..."
          />
        </div>
        <div className="flex items-center gap-1 px-4 border-l border-slate-300 ml-2 h-6">
           <button onClick={handleSave} title="Save (Ctrl+S)" className="p-1 hover:bg-slate-200 rounded group transition-all">
             <Save className="h-4 w-4 text-slate-600 group-hover:text-[#0056d2]" />
           </button>
           <button onClick={() => setActiveScreen('HOME')} title="Exit" className="p-1 hover:bg-slate-200 rounded group transition-all">
             <X className="h-4 w-4 text-slate-600 group-hover:text-[#0056d2]" />
           </button>
           <button onClick={() => setFormData({})} title="Refresh/Reset" className="p-1 hover:bg-slate-200 rounded group transition-all">
             <RotateCcw className="h-4 w-4 text-slate-600 group-hover:text-[#0056d2]" />
           </button>
           <button onClick={() => window.print()} title="Print" className="p-1 hover:bg-slate-200 rounded group transition-all">
             <Printer className="h-4 w-4 text-slate-600 group-hover:text-[#0056d2]" />
           </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
           <HelpCircle className="h-4 w-4 text-slate-600" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Auto hides when module is active */}
        {!isModuleActive && (
          <div className="w-80 bg-white border-r border-slate-300 flex flex-col shadow-sm animate-fade-in print:hidden">
             {/* Header branding as per reference image */}
             <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                <div className="bg-[#0056d2] p-2 rounded-lg flex items-center justify-center">
                   <Grid2X2 className="h-6 w-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-[13px] font-black uppercase text-[#1e3a8a] italic tracking-tight leading-none">
                    Sikka Logistics
                  </h2>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Registry Control
                  </span>
                </div>
             </div>
             
             {/* Favorites list as per reference image */}
             <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                <div className="space-y-4">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-6">Favorites</p>
                  {[
                    { code: 'OX01', label: 'Create Plant' },
                    { code: 'FM01', label: 'Create Company' },
                    { code: 'XK01', label: 'Create Vendor' },
                    { code: 'XD01', label: 'Create Customer' },
                  ].map((item) => (
                    <button 
                      key={item.code} 
                      onClick={() => executeTCode(item.code)}
                      className="flex items-center gap-4 w-full text-left py-2 px-2 hover:bg-[#f0f3f9] rounded-lg group transition-all"
                    >
                      <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-[#0056d2] shrink-0" />
                      <span className="text-[12px] font-bold text-slate-600 group-hover:text-[#1e3a8a] flex items-center gap-2">
                        <span className="text-[#1e3a8a]">{item.code}</span>
                        <span className="text-slate-300">-</span>
                        <span>{item.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
             </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-[#f0f3f9] overflow-y-auto no-scrollbar">
          {/* Centered Title Bar */}
          <div className="bg-[#0056d2] text-white py-1.5 px-6 shadow-lg print:bg-white print:text-black print:shadow-none flex flex-col items-center justify-center min-h-[50px]">
            <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none text-center">
              {activeScreen === 'HOME' ? 'Sikka Logistics Hub' : activeScreen}
            </h1>
            <p className="text-[8px] font-bold uppercase tracking-[0.4em] opacity-80 mt-1 text-center">
              {getScreenTitle(activeScreen)}
            </p>
          </div>

          <div id="printable-area" className={`p-8 w-full ${isModuleActive ? 'max-w-none' : 'max-w-7xl'} mx-auto`}>
            {activeScreen === 'HOME' ? (
              <div className="space-y-12 animate-fade-in">
                <div className="relative w-full aspect-[21/9] border-4 border-dashed border-slate-300 bg-white/50 flex flex-col items-center justify-center rounded-[2rem] overflow-hidden group hover:border-[#0056d2] transition-colors">
                   <Building2 className="h-16 w-16 text-slate-200 mb-4 group-hover:scale-110 transition-transform" />
                   <p className="text-xl font-black text-slate-300 uppercase tracking-tighter italic group-hover:text-[#0056d2]">Your firm image will be placed here</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  {['OX01', 'FM01', 'XK01', 'XD01'].map((code) => (
                    <div key={code} onClick={() => executeTCode(code)} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                      <div className="flex items-center justify-between mb-4">
                        <Badge className="bg-[#e8f0fe] text-[#0056d2] rounded-none px-4 py-1 font-black italic">{code}</Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#0056d2]" />
                      </div>
                      <h3 className="text-[11px] font-black uppercase text-[#1e3a8a]">{getScreenTitle(code as Screen)}</h3>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white shadow-2xl rounded-[2.5rem] border border-slate-100 overflow-hidden animate-slide-up w-full print:shadow-none print:border-none print:rounded-none">
                 <div className="h-2 bg-yellow-500 w-full print:hidden" />
                 <div className="p-10 space-y-10">
                   {activeScreen === 'OX01' && <PlantForm data={formData} onChange={setFormData} />}
                   {activeScreen === 'FM01' && <CompanyForm data={formData} onChange={setFormData} />}
                   {activeScreen === 'XK01' && <VendorForm data={formData} onChange={setFormData} />}
                   {activeScreen === 'XD01' && <CustomerForm data={formData} onChange={setFormData} />}
                   {(activeScreen.endsWith('02') || activeScreen.endsWith('03')) && <RegistryList screen={activeScreen} />}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-[#f0f0f0] border-t border-slate-300 flex items-center px-4 gap-6 text-[10px] font-bold text-slate-600 print:hidden">
        <div className="flex items-center gap-2 pr-6 border-r border-slate-200 min-w-[250px]">
          {statusMsg.type === 'success' && <Check className="h-3 w-3 text-emerald-500" />}
          {statusMsg.type === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
          {statusMsg.type === 'info' && <Info className="h-3 w-3 text-blue-500" />}
          <span className={statusMsg.type === 'error' ? 'text-red-600' : ''}>{statusMsg.text}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">System: <span className="text-slate-600">S4P</span></span>
          <span className="text-slate-400">Client: <span className="text-slate-600">100</span></span>
          <span className="text-slate-400">User: <span className="text-slate-600">{user?.uid.slice(0, 8).toUpperCase()}</span></span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] uppercase tracking-widest text-emerald-600">Synced</span>
        </div>
      </div>
    </div>
  );
}

function getScreenTitle(screen: Screen): string {
  switch (screen) {
    case 'OX01': return 'Create Plant Master';
    case 'OX02': return 'Edit Plant Registry';
    case 'OX03': return 'Display Plant Node';
    case 'FM01': return 'Create Company Hub';
    case 'FM02': return 'Edit Company Registry';
    case 'FM03': return 'Display Company Node';
    case 'XK01': return 'Create Vendor Registry';
    case 'XK02': return 'Edit Vendor Registry';
    case 'XK03': return 'Display Vendor Registry';
    case 'XD01': return 'Create Customer Registry';
    case 'XD02': return 'Edit Customer Registry';
    case 'XD03': return 'Display Customer Registry';
    default: return 'Central Management Control Registry';
  }
}

function PlantForm({ data, onChange }: any) {
  const updateField = (field: string, val: any) => onChange({ ...data, [field]: val });

  const addMobile = () => {
    const current = data.mobileNumbers || [];
    onChange({ ...data, mobileNumbers: [...current, ''] });
  };

  const updateMobile = (idx: number, val: string) => {
    const current = [...(data.mobileNumbers || [])];
    current[idx] = val;
    onChange({ ...data, mobileNumbers: current });
  };

  const removeMobile = (idx: number) => {
    const current = (data.mobileNumbers || []).filter((_: any, i: number) => i !== idx);
    onChange({ ...data, mobileNumbers: current });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      <FormField label="Plant Code" placeholder="PLNT01" value={data.plantCode} onChange={(e: any) => updateField('plantCode', e.target.value)} required />
      <FormField label="Plant Name" placeholder="Sikka Industries Hub" value={data.plantName} onChange={(e: any) => updateField('plantName', e.target.value)} required />
      <FormField label="City" placeholder="Ghaziabad" value={data.city} onChange={(e: any) => updateField('city', e.target.value)} />
      <FormField label="State" placeholder="Uttar Pradesh" value={data.state} onChange={(e: any) => updateField('state', e.target.value)} />
      <FormField label="State Code" placeholder="09" value={data.stateCode} onChange={(e: any) => updateField('stateCode', e.target.value)} />
      <FormField label="Postal Code" placeholder="201009" value={data.postalCode} onChange={(e: any) => updateField('postalCode', e.target.value)} />
      <FormField label="GSTIN" placeholder="07AAAAA0000A1Z5" value={data.gstin} onChange={(e: any) => updateField('gstin', e.target.value)} />
      <FormField label="PAN" placeholder="ABCDE1234F" value={data.pan} onChange={(e: any) => updateField('pan', e.target.value)} />
      <FormField label="Email ID" placeholder="plant@sikka.com" value={data.email} onChange={(e: any) => updateField('email', e.target.value)} />
      <FormField label="Website" placeholder="www.sikka.com" value={data.website} onChange={(e: any) => updateField('website', e.target.value)} />
      
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-between">
          Mobile Numbers
          <button onClick={addMobile} className="text-[#0056d2] hover:underline flex items-center gap-1">
            <PlusCircle className="h-3 w-3" /> Add Multiple
          </button>
        </label>
        <div className="space-y-2">
          {(data.mobileNumbers || ['']).map((num: string, idx: number) => (
            <div key={idx} className="flex gap-2">
              <Input 
                value={num} 
                onChange={(e) => updateMobile(idx, e.target.value)}
                placeholder="+91..."
                className="h-9 border-slate-200 bg-slate-50 px-3 rounded-lg font-bold"
              />
              {idx > 0 && (
                <button onClick={() => removeMobile(idx)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        <FormField label="Address" type="textarea" value={data.address} onChange={(e: any) => updateField('address', e.target.value)} />
      </div>
    </div>
  );
}

function CompanyForm({ data, onChange }: any) {
  const { user } = useUser();
  const db = useFirestore();
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const { data: plants } = useCollection(plantsQuery);

  const updateField = (field: string, val: any) => {
    let newData = { ...data, [field]: val };
    if (field === 'gstin' && val.length >= 2) {
      if (val.startsWith('09')) {
        newData.state = 'Uttar Pradesh';
        newData.stateCode = '09';
      }
      if (val.length >= 12) {
        newData.pan = val.slice(2, 12);
      }
    }
    onChange(newData);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-slate-400">Plant Code (Select Node)</label>
        <select 
          className="w-full h-11 border border-slate-200 bg-slate-50 px-4 rounded-xl font-bold outline-none"
          value={data.plantCode}
          onChange={(e) => updateField('plantCode', e.target.value)}
        >
          <option value="">Select Plant</option>
          {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}
        </select>
      </div>
      <FormField label="Company Code" value={data.companyCode || '10000'} onChange={(e: any) => updateField('companyCode', e.target.value)} required />
      <FormField label="Company Name" placeholder="Sikka Industries" value={data.companyName} onChange={(e: any) => updateField('companyName', e.target.value)} required />
      <FormField label="GSTIN" placeholder="09AAAAA0000A1Z5" value={data.gstin} onChange={(e: any) => updateField('gstin', e.target.value)} required />
      <FormField label="PAN" value={data.pan} disabled />
      <FormField label="State" value={data.state} disabled />
      <FormField label="Mobile Number" value={data.mobileNumber} onChange={(e: any) => updateField('mobileNumber', e.target.value)} />
    </div>
  );
}

function VendorForm({ data, onChange }: any) {
  const { user } = useUser();
  const db = useFirestore();
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const { data: plants } = useCollection(plantsQuery);

  const updateField = (field: string, val: any) => onChange({ ...data, [field]: val });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      <div className="md:col-span-2 space-y-2">
        <label className="text-[10px] font-black uppercase text-slate-400">Select Plants (Multi-Node Selection)</label>
        <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[60px]">
          {plants?.map(p => (
            <Badge 
              key={p.id} 
              onClick={() => {
                const current = data.plantCodes || [];
                const next = current.includes(p.plantCode) ? current.filter((c: string) => c !== p.plantCode) : [...current, p.plantCode];
                updateField('plantCodes', next);
              }}
              className={`cursor-pointer rounded-lg py-1.5 px-3 transition-colors ${data.plantCodes?.includes(p.plantCode) ? 'bg-[#0056d2] text-white' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              {p.plantCode}
            </Badge>
          ))}
        </div>
      </div>
      <FormField label="Vendor Name" value={data.vendorName} onChange={(e: any) => updateField('vendorName', e.target.value)} required />
      <FormField label="GSTIN" value={data.gstin} onChange={(e: any) => updateField('gstin', e.target.value)} />
      <FormField label="PAN" value={data.pan} onChange={(e: any) => updateField('pan', e.target.value)} />
      <FormField label="Mobile" value={data.mobile} onChange={(e: any) => updateField('mobile', e.target.value)} />
      <div className="md:col-span-2">
        <FormField label="Address" type="textarea" value={data.address} onChange={(e: any) => updateField('address', e.target.value)} />
      </div>
    </div>
  );
}

function CustomerForm({ data, onChange }: any) {
  const { user } = useUser();
  const db = useFirestore();
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const { data: plants } = useCollection(plantsQuery);

  const updateField = (field: string, val: any) => onChange({ ...data, [field]: val });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      <div className="md:col-span-2 space-y-2">
        <label className="text-[10px] font-black uppercase text-slate-400">Plant Code (Select Multiple) <span className="text-red-500">*</span></label>
        <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[60px]">
          {plants?.map(p => (
            <Badge 
              key={p.id} 
              onClick={() => {
                const current = data.plantCodes || [];
                const next = current.includes(p.plantCode) ? current.filter((c: string) => c !== p.plantCode) : [...current, p.plantCode];
                updateField('plantCodes', next);
              }}
              className={`cursor-pointer rounded-lg py-1.5 px-3 transition-colors ${data.plantCodes?.includes(p.plantCode) ? 'bg-[#0056d2] text-white' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              {p.plantCode}
            </Badge>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-slate-400">Customer Type <span className="text-red-500">*</span></label>
        <select 
          className="w-full h-11 border border-slate-200 bg-slate-50 px-4 rounded-xl font-bold outline-none"
          value={data.customerType}
          onChange={(e) => updateField('customerType', e.target.value)}
        >
          <option value="">Select Type</option>
          <option value="Consignor">Consignor</option>
          <option value="Consignee">Consignee – Ship to Party</option>
        </select>
      </div>
      <FormField label="Customer Name" placeholder="ABC Logistics" value={data.customerName} onChange={(e: any) => updateField('customerName', e.target.value)} required />
      <FormField label="City" placeholder="Noida" value={data.city} onChange={(e: any) => updateField('city', e.target.value)} required />
      <FormField label="GSTIN" placeholder="09XXXX..." value={data.gstin} onChange={(e: any) => updateField('gstin', e.target.value)} />
      <FormField label="PAN" placeholder="ABCDE1234F" value={data.pan} onChange={(e: any) => updateField('pan', e.target.value)} />
      <FormField label="Mobile" value={data.mobile} onChange={(e: any) => updateField('mobile', e.target.value)} />
      <FormField label="Email" value={data.email} onChange={(e: any) => updateField('email', e.target.value)} />
      <div className="md:col-span-2">
        <FormField label="Address" type="textarea" value={data.address} onChange={(e: any) => updateField('address', e.target.value)} />
      </div>
    </div>
  );
}

function RegistryList({ screen }: { screen: string }) {
  const { user } = useUser();
  const db = useFirestore();
  let collectionName = '';
  if (screen.startsWith('OX')) collectionName = 'plants';
  else if (screen.startsWith('FM')) collectionName = 'companies';
  else if (screen.startsWith('XK')) collectionName = 'vendors';
  else if (screen.startsWith('XD')) collectionName = 'customers';

  const listQuery = useMemoFirebase(() => user && collectionName ? collection(db, 'users', user.uid, collectionName) : null, [user, db, collectionName]);
  const { data: list, isLoading } = useCollection(listQuery);

  if (isLoading) return <div className="p-8 text-center text-slate-400 font-bold">Synchronizing Node Data...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-y border-slate-100">
            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">ID</th>
            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Name / Description</th>
            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Type / Details</th>
            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
          </tr>
        </thead>
        <tbody>
          {list?.map((item) => (
            <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="p-4 font-bold text-xs text-[#0056d2]">{item.plantCode || item.companyCode || item.id.slice(0, 8)}</td>
              <td className="p-4 font-bold text-xs text-slate-600 uppercase">{item.plantName || item.companyName || item.vendorName || item.customerName}</td>
              <td className="p-4 font-bold text-xs text-slate-400 uppercase italic">
                {item.customerType || item.city || 'Standard Registry'}
              </td>
              <td className="p-4">
                <Badge className="bg-emerald-50 text-emerald-600 rounded-none uppercase text-[8px] font-black border border-emerald-100">Synchronized</Badge>
              </td>
            </tr>
          ))}
          {(!list || list.length === 0) && (
            <tr>
              <td colSpan={4} className="p-12 text-center text-slate-300 font-bold text-xs italic">No registry nodes found for this transaction.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FormField({ label, placeholder, type = 'text', required, value, onChange, disabled }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-slate-400">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea 
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold min-h-[100px] outline-none disabled:opacity-50"
        />
      ) : (
        <Input 
          type={type}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="h-11 border-slate-200 bg-slate-50 px-4 rounded-xl font-bold disabled:opacity-50"
        />
      )}
    </div>
  );
}
