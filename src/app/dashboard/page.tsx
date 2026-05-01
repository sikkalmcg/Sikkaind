
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  Menu as MenuIcon, Search, Printer, Save, ArrowLeft, ArrowRight, 
  RotateCcw, X, HelpCircle, LogOut, LayoutDashboard, PlusCircle,
  Settings, User, ChevronRight, FileText, Building2, Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import placeholderData from '@/app/lib/placeholder-images.json';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03';

export default function SapDashboard() {
  const router = useRouter();
  const [tCode, setTCode] = React.useState('');
  const [activeScreen, setActiveScreen] = React.useState<Screen>('HOME');
  const tCodeRef = React.useRef<HTMLInputElement>(null);
  const logoImg = placeholderData.placeholderImages.find(p => p.id === 'slmc-logo');

  // Handle T-Code Execution
  const executeTCode = (code: string) => {
    const formatted = code.toUpperCase().trim();
    const cleanCode = formatted.startsWith('/N') ? formatted.slice(2) : formatted;
    
    if (['OX01', 'OX02', 'OX03', 'FM01', 'FM02', 'FM03', 'XK01', 'XK02', 'XK03'].includes(cleanCode)) {
      setActiveScreen(cleanCode as Screen);
    } else if (cleanCode === 'HOME' || cleanCode === '') {
      setActiveScreen('HOME');
    }
    setTCode('');
  };

  // Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'm': e.preventDefault(); break; // Menu
          case 'e': e.preventDefault(); break; // Edit
          case 'f': e.preventDefault(); break; // Favorites
          case 'x': e.preventDefault(); break; // Extras
          case 'y': e.preventDefault(); break; // System
          case 'h': e.preventDefault(); break; // Help
        }
      }
      if (e.ctrlKey && (e.key === 'q' || e.key === 'l')) {
        e.preventDefault();
        router.push('/login');
      }
      if (e.key === '/' || (e.ctrlKey && e.key === 't')) {
        e.preventDefault();
        tCodeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const handleLogout = () => router.push('/login');

  return (
    <div className="flex flex-col h-screen bg-[#d9e1f2] text-[#333] font-mono select-none overflow-hidden">
      {/* 1. TOP MENU BAR */}
      <div className="flex items-center bg-[#f0f0f0] border-b border-white/50 px-2 h-7 text-[11px] font-semibold">
        {['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map((item) => (
          <DropdownMenu key={item}>
            <DropdownMenuTrigger className="px-3 hover:bg-[#0056d2] hover:text-white outline-none transition-colors h-full flex items-center">
              {item}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white rounded-none border-slate-300 shadow-xl text-[11px] p-0 min-w-[150px]">
              <DropdownMenuItem className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4">Execute T-Code</DropdownMenuItem>
              <DropdownMenuItem className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4">Create Window</DropdownMenuItem>
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

      {/* 2. COMMAND BAR / T-CODE BAR */}
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
            placeholder=""
          />
        </div>
        <div className="flex items-center gap-1 px-4 border-l border-slate-300 ml-2 h-6">
           {[Save, ArrowLeft, ArrowRight, RotateCcw, X, Printer].map((Icon, idx) => (
             <button key={idx} className="p-1 hover:bg-slate-200 rounded transition-colors group">
               <Icon className="h-4 w-4 text-slate-600 group-hover:text-[#0056d2]" />
             </button>
           ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
           {[Search, HelpCircle].map((Icon, idx) => (
             <button key={idx} className="p-1 hover:bg-slate-200 rounded transition-colors">
               <Icon className="h-4 w-4 text-slate-600" />
             </button>
           ))}
        </div>
      </div>

      {/* 3. MAIN WORK AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR / TREE */}
        <div className="w-80 bg-white border-r border-slate-300 flex flex-col shadow-sm">
           <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="bg-[#0056d2] p-2 rounded">
                 <LayoutDashboard className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-[12px] font-black uppercase text-[#1e3a8a] italic leading-tight">Sikka Logistics</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Management Control</p>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Favorites</p>
                {[
                  { code: 'OX01', label: 'Create Plant' },
                  { code: 'FM01', label: 'Create Company' },
                  { code: 'XK01', label: 'Create Vendor' },
                ].map((item) => (
                  <button 
                    key={item.code} 
                    onClick={() => setActiveScreen(item.code as Screen)}
                    className="flex items-center gap-3 w-full text-left p-2 hover:bg-[#e8f0fe] rounded-lg group transition-all"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-[#0056d2]" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-[#1e3a8a]">{item.code} - {item.label}</span>
                  </button>
                ))}
              </div>
           </div>
           <div className="p-4 bg-slate-50 border-t border-slate-200">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">System Status: Active</span>
             </div>
           </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 flex flex-col bg-[#f0f3f9] overflow-y-auto custom-scrollbar">
          {/* SCREEN HEADER */}
          <div className="bg-[#0056d2] text-white p-6 shadow-lg flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                {activeScreen === 'HOME' ? 'Sikka Logistics Hub' : activeScreen}
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-80">
                {activeScreen === 'HOME' ? 'Central Management Control Registry' : getScreenTitle(activeScreen)}
              </p>
            </div>
            {activeScreen !== 'HOME' && (
              <Button onClick={() => setActiveScreen('HOME')} variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 rounded-none uppercase text-[10px] font-black px-6">
                Back to Hub
              </Button>
            )}
          </div>

          <div className="p-8 max-w-5xl">
            {activeScreen === 'HOME' && (
              <div className="space-y-12 animate-fade-in">
                {/* FIRM IMAGE PLACEHOLDER */}
                <div className="relative w-full aspect-[21/9] border-4 border-dashed border-slate-300 bg-white/50 flex flex-col items-center justify-center group hover:border-[#0056d2] transition-colors rounded-[2rem] overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-br from-[#0056d2]/5 to-transparent opacity-50" />
                   <Building2 className="h-16 w-16 text-slate-200 mb-4 group-hover:scale-110 transition-transform" />
                   <p className="text-xl font-black text-slate-300 uppercase tracking-tighter italic group-hover:text-[#0056d2]">Your firm image will be placed here</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Replace in DashboardPage.tsx</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {['OX01', 'FM01', 'XK01'].map((code) => (
                    <div key={code} onClick={() => executeTCode(code)} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                      <div className="flex items-center justify-between mb-4">
                        <Badge className="bg-[#e8f0fe] text-[#0056d2] hover:bg-[#e8f0fe] rounded-none px-4 py-1 font-black italic">{code}</Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#0056d2] transition-colors" />
                      </div>
                      <h3 className="text-sm font-black uppercase text-[#1e3a8a]">{getScreenTitle(code as Screen)}</h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">Access Registry Mission Node</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FORM SCREENS */}
            {(activeScreen === 'OX01' || activeScreen === 'FM01' || activeScreen === 'XK01') && (
              <div className="bg-white shadow-2xl rounded-[2.5rem] border border-slate-100 overflow-hidden animate-slide-up">
                 <div className="h-2 bg-yellow-500 w-full" />
                 <div className="p-10 space-y-10">
                   {activeScreen === 'OX01' && <PlantForm />}
                   {activeScreen === 'FM01' && <CompanyForm />}
                   {activeScreen === 'XK01' && <VendorForm />}
                 </div>
              </div>
            )}

            {/* LIST SCREENS */}
            {(activeScreen === 'OX02' || activeScreen === 'FM02' || activeScreen === 'XK02' || activeScreen === 'OX03' || activeScreen === 'FM03' || activeScreen === 'XK03') && (
              <div className="bg-white shadow-2xl rounded-[2.5rem] border border-slate-100 p-8 animate-slide-up">
                 <h2 className="text-xl font-black uppercase italic text-[#1e3a8a] mb-6 flex items-center gap-3">
                   <FileText className="h-6 w-6" /> Node Registry Entries
                 </h2>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-y border-slate-100">
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Entry ID</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Node Description</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                         {[1,2,3].map((i) => (
                           <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-bold text-xs text-[#0056d2]">ND-00{i}</td>
                              <td className="p-4 font-bold text-xs text-slate-600 uppercase">Sikka Node Integration Layer</td>
                              <td className="p-4">
                                <Badge className="bg-emerald-50 text-emerald-600 rounded-none uppercase text-[8px] font-black border border-emerald-100">Synchronized</Badge>
                              </td>
                              <td className="p-4 font-bold text-[10px] uppercase text-blue-500 cursor-pointer">View Node</td>
                           </tr>
                         ))}
                      </tbody>
                    </table>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. SHORTCUT HELP BAR */}
      <div className="bg-[#f0f0f0] border-t border-slate-300 px-4 h-6 flex items-center gap-6 text-[9px] font-bold text-slate-500">
        <div className="flex gap-3">
          <span>ALT+M MENU</span>
          <span>ALT+E EDIT</span>
          <span>ALT+Y SYSTEM</span>
          <span>CTRL+T COMMAND</span>
          <span>CTRL+L LOGOFF</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
           <span>INS</span>
           <span>CAPS</span>
           <span>S4P (1) 100</span>
           <span className="text-emerald-600 uppercase">Sikka.Local: Synchronized</span>
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
    default: return '';
  }
}

function PlantForm() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      <FormField label="Plant Code" placeholder="E.G. PLNT01" required />
      <FormField label="Plant Name" placeholder="Sikka Logistics Hub 01" required />
      <FormField label="City" placeholder="Ghaziabad" />
      <FormField label="State" placeholder="Uttar Pradesh" />
      <FormField label="State Code" placeholder="UP09" />
      <FormField label="Postal Code" placeholder="201009" />
      <div className="md:col-span-2">
        <FormField label="Address" placeholder="Full Address Node Details" type="textarea" />
      </div>
      <div className="md:col-span-2 pt-6">
        <Button className="bg-[#0056d2] text-white rounded-none uppercase text-xs font-black px-10 h-12 shadow-xl hover:bg-black transition-all">Create Plant Node</Button>
      </div>
    </div>
  );
}

function CompanyForm() {
  const [gstin, setGstin] = React.useState('');
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-slate-400">Plant Code (Select Node)</label>
        <select className="w-full h-11 border border-slate-200 bg-slate-50 px-4 rounded-xl font-bold outline-none focus:ring-1 focus:ring-[#0056d2]">
          <option>PLNT01 - HUB 01</option>
          <option>PLNT02 - HUB 02</option>
        </select>
      </div>
      <FormField label="Company Code" value="10000" disabled />
      <FormField label="Company Name" placeholder="Sikka Industries" required />
      <FormField label="GSTIN" value={gstin} onChange={(e: any) => setGstin(e.target.value)} placeholder="09AAAAA0000A1Z5" required />
      <FormField label="PAN" value={gstin.length >= 10 ? gstin.slice(2, 12) : ''} disabled />
      <FormField label="State" value={gstin.startsWith('09') ? 'Uttar Pradesh' : ''} placeholder="Auto via GSTIN" disabled />
      <FormField label="State Code" value={gstin.startsWith('09') ? '09' : ''} placeholder="Auto via GSTIN" disabled />
      <FormField label="Mobile Number" placeholder="+91 0000000000" />
      <FormField label="Email ID" placeholder="registry@sikka.com" />
      <FormField label="Website" placeholder="www.sikka.com" />
      <div className="md:col-span-2 pt-6">
        <Button className="bg-[#0056d2] text-white rounded-none uppercase text-xs font-black px-10 h-12 shadow-xl hover:bg-black transition-all">Create Company Hub</Button>
      </div>
    </div>
  );
}

function VendorForm() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      <div className="md:col-span-2 space-y-2">
        <label className="text-[10px] font-black uppercase text-slate-400">Select Plants (Multi-Node Selection)</label>
        <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[60px]">
          {['PLNT01', 'PLNT02', 'PLNT03'].map(p => (
            <Badge key={p} className="bg-white border-slate-200 text-slate-600 rounded-lg py-1.5 px-3 hover:bg-[#e8f0fe] hover:text-[#0056d2] transition-colors">
              {p}
            </Badge>
          ))}
        </div>
      </div>
      <FormField label="Vendor Name" placeholder="Legacy Supplier Node" required />
      <FormField label="Mobile" placeholder="+91 0000000000" />
      <FormField label="GSTIN" placeholder="09AAAAA0000A1Z5" />
      <FormField label="PAN" placeholder="ABCDE1234F" />
      <div className="md:col-span-2">
        <FormField label="Address" placeholder="Vendor Mission Address" type="textarea" />
      </div>
      <div className="md:col-span-2 pt-6">
        <Button className="bg-[#0056d2] text-white rounded-none uppercase text-xs font-black px-10 h-12 shadow-xl hover:bg-black transition-all">Register Vendor Mission</Button>
      </div>
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
          placeholder={placeholder}
          disabled={disabled}
          className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold min-h-[100px] outline-none focus:ring-1 focus:ring-[#0056d2] disabled:opacity-50"
        />
      ) : (
        <Input 
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="h-11 border-slate-200 bg-slate-50 px-4 rounded-xl font-bold focus:ring-[#0056d2] disabled:opacity-50"
        />
      )}
    </div>
  );
}

