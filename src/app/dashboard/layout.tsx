'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  X, LogOut, Grid2X2, Package, Edit3, Info, User, Users, ShoppingBag, 
  Truck, Radar, FileText, ShieldAlert, XCircle, Save, ArrowLeft, LogOut as ExitIcon, Printer, Search
} from 'lucide-react';
import { useUser, initializeFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import placeholderData from '@/app/lib/placeholder-images.json';
import { cn } from '@/lib/utils';

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
  { code: 'VA04', description: 'SHORT CLOSE', icon: XCircle, module: 'Logistics' },
  { code: 'TR21', description: 'TRIP BOARD CONTROL', icon: Truck, module: 'Logistics' },
  { code: 'TR24', description: 'TRACK SHIPMENT', icon: Radar, module: 'Logistics' },
  { code: 'WGPS24', description: 'GPS TRACKING HUB', icon: Radar, module: 'Logistics' },
  { code: 'SE38', description: 'CUSTOM REPORT EXECUTION', icon: FileText, module: 'System' },
  { code: 'SU01', description: 'USER MANAGEMENT: CREATE', icon: ShieldAlert, module: 'System' },
  { code: 'SU02', description: 'USER MANAGEMENT: CHANGE', icon: Edit3, module: 'System' },
  { code: 'SU03', description: 'USER MANAGEMENT: DISPLAY', icon: Info, module: 'System' },
  { code: 'ZCODE', description: 'SYSTEM: ALL ACTIVE T-CODES', icon: Grid2X2, module: 'System' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { firestore: db } = React.useMemo(() => initializeFirebase(), []);
  
  const [tCode, setTCode] = React.useState('');
  const [history, setHistory] = React.useState<string[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);

  const tCodeRef = React.useRef<HTMLInputElement>(null);
  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');

  const profileRef = useMemoFirebase(() => {
    if (!user) return null;
    const rid = localStorage.getItem('sap_registry_id');
    return rid ? doc(db, 'user_registry', rid) : doc(db, 'user_registry', user.uid);
  }, [user, db]);
  const { data: userProfile } = useDoc(profileRef);

  React.useEffect(() => {
    const isAdmin = localStorage.getItem('sap_bootstrap_session') === 'true';
    setIsBootstrapAdmin(isAdmin);
  }, []);

  const executeTCode = React.useCallback((cmd: string) => {
    const input = cmd.toUpperCase().trim();
    if (!input) return;
    
    if (input === '/NEND' || input === '/NEX') { 
      localStorage.removeItem('sap_bootstrap_session'); 
      localStorage.removeItem('sap_user_role'); 
      localStorage.removeItem('sap_registry_id'); 
      router.push('/login'); 
      return; 
    }
    
    if (input === '/N' || input === 'HOME') { 
      router.push('/dashboard');
      setTCode('');
      return; 
    }

    let code = input;
    if (input.startsWith('/N')) code = input.substring(2);
    else if (input.startsWith('/O')) {
      const target = input.substring(2);
      window.open(`${window.location.origin}/dashboard/${target.toLowerCase().substring(0, 2)}?tcode=${target}`, '_blank');
      setTCode('');
      return;
    }

    if (!code) { router.push('/dashboard'); return; }

    const exists = MASTER_TCODES.find(t => t.code === code);
    if (!exists) { alert(`Transaction ${code} does not exist`); setTCode(''); return; }

    const authorizedTcodes = isBootstrapAdmin ? MASTER_TCODES.map(t => t.code) : (userProfile?.tcodes || []);
    if (!authorizedTcodes.includes(code)) { alert(`No authorization for transaction ${code}`); setTCode(''); return; }

    const routeMap: any = {
      'OX': '/dashboard/ox', 'FM': '/dashboard/fm', 'XK': '/dashboard/xk',
      'XD': '/dashboard/xd', 'VA': '/dashboard/va', 'SU': '/dashboard/su',
      'TR21': '/dashboard/tr21', 'TR24': '/dashboard/tr24', 'WGPS24': '/dashboard/wgsp24',
      'SE38': '/dashboard/se38', 'ZCODE': '/dashboard/zcode'
    };

    const baseCode = code.startsWith('WGPS') ? 'WGPS24' : (code.startsWith('TR2') ? code : code.substring(0, 2));
    const targetRoute = routeMap[baseCode] || `/dashboard/${baseCode.toLowerCase()}`;
    
    router.push(`${targetRoute}?tcode=${code}`);
    setTCode('');
    setShowHistory(false);
    setHistory(prev => [input, ...prev.filter(h => h !== input)].slice(0, 10));
  }, [isBootstrapAdmin, userProfile, router]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#f0f3f9] text-[#333] font-mono overflow-hidden">
      {/* SAP Top Menu Bar */}
      <div className="flex items-center bg-[#c5e0b4] border-b border-slate-400 px-3 h-8 text-[11px] font-semibold z-50 print:hidden">
        <div className="flex items-center gap-6">
          {['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map(i => (
            <button key={i} className="hover:text-blue-800 transition-colors uppercase">{i}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => router.push('/')} className="h-full px-3 hover:bg-[#e81123] hover:text-white transition-all"><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* SAP Navigation & T-Code Bar */}
      <div className="flex flex-col bg-[#f0f0f0] border-b border-slate-300 shadow-sm z-40 print:hidden">
        <div className="flex items-center px-2 py-1 gap-4 h-10">
          <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-slate-300 h-full">
            {logoAsset && <Image src={logoAsset.url} alt="SLMC" width={80} height={30} className="object-contain" unoptimized />}
          </div>
          <div className="flex items-center bg-white border border-slate-400 p-0.5 shadow-inner relative">
            <button onClick={() => executeTCode(tCode)} className="px-1 text-[#008000] font-black text-xs hover:bg-slate-100">✓</button>
            <input 
              ref={tCodeRef}
              type="text" 
              value={tCode} 
              onChange={e => setTCode(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter') executeTCode(tCode); }}
              onClick={() => history.length > 0 && setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              className="w-48 outline-none text-xs px-1 font-bold tracking-wider" 
              placeholder="T-CODE..." 
            />
            {showHistory && (
              <div className="absolute top-full left-0 w-full bg-white border border-slate-400 shadow-md z-[60]">
                {history.map((h, i) => <div key={i} onClick={() => executeTCode(h)} className="px-4 py-1.5 text-xs font-bold cursor-pointer hover:bg-blue-50">{h}</div>)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 px-4 border-l border-slate-300 ml-2 h-full">
            <button className="p-1.5 hover:bg-slate-200 rounded transition-all text-slate-700" title="Save (F8)"><Save className="h-4 w-4" /></button>
            <button className="p-1.5 hover:bg-slate-200 rounded transition-all text-slate-700" title="Back (F3)" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></button>
            <button className="p-1.5 hover:bg-slate-200 rounded transition-all text-slate-700" title="Exit (Shift+F3)" onClick={() => router.push('/dashboard')}><ExitIcon className="h-4 w-4" /></button>
            <button className="p-1.5 hover:bg-slate-200 rounded transition-all text-slate-700" title="Cancel (F12)" onClick={() => setTCode('')}><XCircle className="h-4 w-4" /></button>
            <div className="w-[1px] h-4 bg-slate-300 mx-2" />
            <button className="p-1.5 hover:bg-slate-200 rounded transition-all text-slate-700" title="Print (Ctrl+P)"><Printer className="h-4 w-4" /></button>
            <button className="p-1.5 hover:bg-slate-200 rounded transition-all text-slate-700" title="Find (Ctrl+F)"><Search className="h-4 w-4" /></button>
          </div>
          <div className="flex-1" />
          <button onClick={() => executeTCode('/NEND')} className="flex items-center gap-2 px-3 h-7 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all">
            <LogOut className="h-3.5 w-3.5" /> Log Off
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {children}
      </div>

      {/* SAP Status Bar */}
      <div className="h-7 bg-[#0f172a] flex items-center px-4 text-[9px] font-black text-white/90 uppercase tracking-[0.15em] shrink-0 z-50 print:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-8 overflow-hidden flex-1">
          <span className="flex items-center gap-2.5 shrink-0"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />SYNC: ACTIVE</span>
          <span className="shrink-0">{searchParams.get('tcode') || 'HOME'}</span>
          <span className="truncate">USER: {isBootstrapAdmin ? 'SUPER ADMIN' : (userProfile?.fullName || 'IDENTIFYING...')}</span>
        </div>
        <div className="shrink-0 ml-4 hidden sm:block text-blue-400 font-bold italic tracking-wider">SIKKA INDUSTRIES & LOGISTICS</div>
      </div>
    </div>
  );
}
