'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { 
  X, LogOut, Grid2X2, Package, Edit3, Info, User, Users, ShoppingBag, 
  Truck, Radar, FileText, ShieldAlert, XCircle, Save, ArrowLeft, LogOut as ExitIcon, Printer, Search,
  Plus, Minus, Lock
} from 'lucide-react';
import { useUser, useMongoStore, useDoc, useMemoMongo } from '@/mongodb';
import { doc } from '@/lib/mongo-store';
import placeholderData from '@/app/lib/placeholder-images.json';
import { cn } from '@/lib/utils';
import { QuickAccessPrefetch } from '@/components/dashboard/QuickAccessPrefetch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  { code: 'WGPS24', description: 'GPS TRACKING', icon: Radar, module: 'Logistics' },
  { code: 'VK11', description: 'PRIMARY FREIGHT RATES: CREATE', icon: ShoppingBag, module: 'Logistics' },
  { code: 'VK12', description: 'PRIMARY FREIGHT RATES: CHANGE', icon: Edit3, module: 'Logistics' },
  { code: 'VK13', description: 'PRIMARY FREIGHT RATES: DISPLAY', icon: Info, module: 'Logistics' },
  { code: 'VT04', description: 'SHIPMENT REPORT', icon: FileText, module: 'Logistics' },
  { code: 'VT11', description: 'FREIGHT COST REPORT', icon: FileText, module: 'Logistics' },
  { code: 'SE38', description: 'CUSTOM REPORT EXECUTION', icon: FileText, module: 'System' },
  { code: 'SU01', description: 'USER MANAGEMENT: CREATE', icon: ShieldAlert, module: 'System' },
  { code: 'SU02', description: 'USER MANAGEMENT: CHANGE', icon: Edit3, module: 'System' },
  { code: 'SU03', description: 'USER MANAGEMENT: DISPLAY', icon: Info, module: 'System' },
  { code: 'ZCODE', description: 'SYSTEM: ALL ACTIVE T-CODES', icon: Grid2X2, module: 'System' },
  // MK - Forwarding Agent (VA module)
  { code: 'MK01', description: 'FORWARDING AGENT: CREATE', icon: Grid2X2, module: 'Logistics' },
  { code: 'MK02', description: 'FORWARDING AGENT: CHANGE', icon: Edit3, module: 'Logistics' },
  { code: 'MK03', description: 'FORWARDING AGENT: DISPLAY / HISTORY', icon: Info, module: 'Logistics' },
];

const ALL_TCODES = MASTER_TCODES.map(t => t.code);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const db = useMongoStore();
  
  const [mounted, setMounted] = React.useState(false);
  const [tCode, setTCode] = React.useState('');
  const [history, setHistory] = React.useState<string[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  const [userFavorites, setUserFavorites] = React.useState<any[]>([]);
  const [showAddFav, setShowAddFav] = React.useState(false);
  const [newFavCode, setNewFavCode] = React.useState('');
  const [selectedFavCode, setSelectedFavCode] = React.useState<string | null>(null);

  const tCodeRef = React.useRef<HTMLInputElement>(null);
  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');

  const triggerGlobalSave = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('sap-save-triggered'));
  }, []);

  React.useEffect(() => {
    setMounted(true);
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    const role = localStorage.getItem('sap_user_role');
    setIsAdmin(role === 'admin' || role === 'ADMIN');
    setRegistryId(localStorage.getItem('sap_registry_id'));
  }, []);

  const profileRef = useMemoMongo(() => {
    if (!user || !registryId) return null;
    return doc(db, 'users', 'Sikkaind', 'users_master', registryId);
  }, [user, db, registryId]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(profileRef);

  const tcodeAccessStr = JSON.stringify(userProfile?.tcodeAccess || []);

  const authorizedTcodes = React.useMemo(() => {
    if (isBootstrapAdmin || isAdmin || userProfile?.role === 'admin' || userProfile?.role === 'ADMIN') {
      return ALL_TCODES;
    }
    return JSON.parse(tcodeAccessStr);
  }, [isBootstrapAdmin, isAdmin, userProfile?.role, tcodeAccessStr]);

  React.useEffect(() => {
    if (!mounted || isProfileLoading) return;

    const saved = localStorage.getItem('sap_user_favorites');
    let baseFavs = [];
    if (saved) {
      try { baseFavs = JSON.parse(saved); } catch (e) { baseFavs = []; }
    } else {
      baseFavs = [
        { code: 'OX03', description: 'PLANT MASTER' },
        { code: 'FM03', description: 'COMPANY' },
        { code: 'XK03', description: 'VENDOR' },
        { code: 'XD03', description: 'CUSTOMER' },
        { code: 'VA01', description: 'CREATE SALE ORDER' },
        { code: 'TR21', description: 'TRIP BOARD CONTROL' },
        { code: 'WGPS24', description: 'GPS MONITORING' },
        { code: 'ZCODE', description: 'SYSTEM TRANS MAP' },
      ];
    }

    const filtered = baseFavs
      .filter((fav: any) => authorizedTcodes.includes(fav.code))
      .map((fav: any) => {
        const master = MASTER_TCODES.find(m => m.code === fav.code);
        return { ...fav, icon: master?.icon || Grid2X2 };
      });

    // Ensure we don't get stuck with old/invalid favorites routes after code changes.
    // (Especially relevant when we fix VK/VT routing.)
    try {
      localStorage.removeItem('sap_user_favorites');
    } catch (e) {
      // ignore
    }

    setUserFavorites(filtered);
    
    // Prefetch all favorites routes immediately
    filtered.forEach((fav: { code: string }) => {
      const routeMap: any = {
        // Full T-code mapping for correct route resolution
        VK11: '/dashboard/vk11',
        VK12: '/dashboard/vk12',
        VK13: '/dashboard/vk13',
        VT04: '/dashboard/vt04',
        VT11: '/dashboard/vt11',

        // MK - Forwarding Agent
        MK01: '/dashboard/mk01',
        MK02: '/dashboard/mk02',
        MK03: '/dashboard/mk03',

        // Existing base-code mappings
        'OX': '/dashboard/ox', 'FM': '/dashboard/fm', 'XK': '/dashboard/xk',
        'XD': '/dashboard/xd', 'VA': '/dashboard/va', 'SU': '/dashboard/su',
        'TR21': '/dashboard/tr21', 'TR24': '/dashboard/tr24', 'WGPS24': '/dashboard/wgsp24',
        'SE38': '/dashboard/se38', 'ZCODE': '/dashboard/zcode'
      };
      const baseCode = ['ZCODE', 'SE38', 'WGPS24', 'TR21', 'TR24'].includes(fav.code) ? fav.code : fav.code.substring(0, 2);
      const targetRoute = routeMap[baseCode];
      if (targetRoute) {
        router.prefetch(`${targetRoute}?tcode=${fav.code}`);
      }
    });
  }, [mounted, isProfileLoading, authorizedTcodes, router]);

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
      if (!authorizedTcodes.includes(target)) {
        alert(`ACCESS DENIED: Authorization failure for command ${target}.`);
        return;
      }
      const routeMap: any = {
        // Full T-code mapping for correct route resolution
        VK11: '/dashboard/vk11',
        VK12: '/dashboard/vk12',
        VK13: '/dashboard/vk13',
        VT04: '/dashboard/vt04',
        VT11: '/dashboard/vt11',

        // MK - Forwarding Agent
        MK01: '/dashboard/mk01',
        MK02: '/dashboard/mk02',
        MK03: '/dashboard/mk03',

        // Existing base-code mappings
        'OX': '/dashboard/ox', 'FM': '/dashboard/fm', 'XK': '/dashboard/xk',
        'XD': '/dashboard/xd', 'VA': '/dashboard/va', 'SU': '/dashboard/su',
        'TR21': '/dashboard/tr21', 'TR24': '/dashboard/tr24', 'WGPS24': '/dashboard/wgsp24',
        'SE38': '/dashboard/se38', 'ZCODE': '/dashboard/zcode'
      };
      const targetRoute = routeMap[target] || (() => {
        const baseCode = ['ZCODE', 'SE38', 'WGPS24', 'TR21', 'TR24'].includes(target) ? target : target.substring(0, 2);
        return routeMap[baseCode] || `/dashboard/${baseCode.toLowerCase()}`;
      })();
      React.startTransition(() => {
        window.open(`${window.location.origin}${targetRoute}?tcode=${target}`, '_blank');
      });
      setTCode('');
      return;
    }

    if (!code) { router.push('/dashboard'); return; }

    const exists = MASTER_TCODES.find(t => t.code === code);
    if (!exists) { alert(`Transaction ${code} does not exist`); setTCode(''); return; }

    if (!authorizedTcodes.includes(code)) { 
      alert(`No authorization for transaction ${code}`); 
      setTCode(''); 
      return; 
    }

    const routeMap: any = {
      // Full T-code mapping for correct route resolution
      VK11: '/dashboard/vk11',
      VK12: '/dashboard/vk12',
      VK13: '/dashboard/vk13',
      VT04: '/dashboard/vt04',
      VT11: '/dashboard/vt11',

      // Existing base-code mappings
      'OX': '/dashboard/ox', 'FM': '/dashboard/fm', 'XK': '/dashboard/xk',
      'XD': '/dashboard/xd', 'VA': '/dashboard/va', 'SU': '/dashboard/su',
      'TR21': '/dashboard/tr21', 'TR24': '/dashboard/tr24', 'WGPS24': '/dashboard/wgsp24',
      'SE38': '/dashboard/se38', 'ZCODE': '/dashboard/zcode'
    };

    const targetRoute = routeMap[code] || (() => {
      const baseCode = ['ZCODE', 'SE38', 'WGPS24', 'TR21', 'TR24'].includes(code) ? code : code.substring(0, 2);
      return routeMap[baseCode] || `/dashboard/${baseCode.toLowerCase()}`;
    })();
    
    React.startTransition(() => {
      router.push(`${targetRoute}?tcode=${code}`);
    });
    setTCode('');
    setShowHistory(false);
    setHistory(prev => [input, ...prev.filter(h => h !== input)].slice(0, 10));
  }, [authorizedTcodes, router]);

  const handleAddFavorite = () => {
    const code = newFavCode.toUpperCase().trim();
    if (!code) return;
    
    if (!authorizedTcodes.includes(code)) {
      alert(`AUTHORIZATION DENIED: You cannot add restricted nodes to favorites.`);
      return;
    }
    
    const master = MASTER_TCODES.find(m => m.code === code);
    if (!master) { alert(`Transaction ${code} does not exist`); return; }
    if (userFavorites.some(f => f.code === code)) { alert(`Transaction ${code} already in favorites`); return; }

    const newFav = { code: master.code, description: master.description.split(':')[0] };
    const updated = [...userFavorites, { ...newFav, icon: master.icon }];
    setUserFavorites(updated);
    localStorage.setItem('sap_user_favorites', JSON.stringify(updated.map(f => ({ code: f.code, description: f.description }))));
    setNewFavCode('');
    setShowAddFav(false);
  };

  const handleQuickAccessClick = React.useCallback((code: string) => {
    setSelectedFavCode(code);
    React.startTransition(() => {
      executeTCode(code);
    });
  }, [executeTCode]);

  const handleRemoveFavorite = () => {
    if (!selectedFavCode) return;
    const updated = userFavorites.filter(f => f.code !== selectedFavCode);
    setUserFavorites(updated);
    localStorage.setItem('sap_user_favorites', JSON.stringify(updated.map(f => ({ code: f.code, description: f.description }))));
    setSelectedFavCode(null);
  };

  if (pathname?.includes('/print/')) return <div className="h-auto w-full bg-white print:overflow-visible">{children}</div>;

  return (
    <div className="flex-col h-screen w-full bg-[#f0f3f9] text-[#333] font-mono overflow-hidden flex print:h-auto print:overflow-visible">
      <div className="flex items-center bg-[#c5e0b4] border-b border-slate-400 px-3 h-8 text-[11px] font-semibold z-50 print:hidden">
        <div className="flex items-center gap-6">
          {['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map(i => (
            <button key={i} className="hover:text-blue-800 transition-colors uppercase">{i}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => router.push('/')} className="h-full px-3 hover:bg-[#e81123] hover:text-white transition-all"><X className="h-3.5 w-3.5" /></button>
      </div>

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
            <button onClick={triggerGlobalSave} className="p-1.5 hover:bg-slate-200 rounded transition-all text-slate-700" title="Save (F8 / Ctrl+S)"><Save className="h-4 w-4" /></button>
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

      <div className="flex-1 flex overflow-hidden print:block print:overflow-visible">
        <aside className="w-80 bg-white border-r border-slate-300 lg:flex flex-col overflow-hidden shadow-sm shrink-0 flex hidden print:hidden">
          <div className="p-4 border-b border-slate-200 bg-[#dae4f1]/50 flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1e3a8a] flex items-center gap-2">
              <Grid2X2 className="h-3.5 w-3.5" /> Quick Access
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowAddFav(true)} className="p-1 hover:bg-blue-100 rounded text-blue-700 transition-colors" title="Add Favorite"><Plus className="h-3 w-3" /></button>
              <button onClick={handleRemoveFavorite} className={cn("p-1 rounded transition-colors", selectedFavCode ? "hover:bg-red-100 text-red-600" : "text-slate-300 cursor-not-allowed")} title="Remove Favorite" disabled={!selectedFavCode}><Minus className="h-3 w-3" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto green-scrollbar">
            {mounted && userFavorites.map(t => (
              <React.Fragment key={t.code}>
                <QuickAccessPrefetch tcode={t.code} />
                <div 
                  onClick={() => handleQuickAccessClick(t.code)}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 hover:bg-blue-50 cursor-pointer group border-b border-slate-100 transition-all",
                    searchParams.get('tcode') === t.code && "bg-blue-50 border-l-4 border-l-[#0056d2]"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <span className="text-[11px] font-black text-[#1e3a8a] uppercase shrink-0 w-12">{t.code}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase truncate" title={t.description}>{t.description}</span>
                  </div>
                  <t.icon className={cn("h-3.5 w-3.5 text-slate-300 group-hover:text-blue-600 transition-colors shrink-0", searchParams.get('tcode') === t.code && "text-blue-600")} />
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50">
             <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-center">SIKKA ENTERPRISE • ACCESS SECURED</p>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col print:block print:overflow-visible">
          {children}
        </main>
      </div>

      <div className="h-7 bg-[#0f172a] flex items-center px-4 text-[9px] font-black text-white/90 uppercase tracking-[0.15em] shrink-0 z-50 print:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-8 overflow-hidden flex-1">
          <span className="flex items-center gap-2.5 shrink-0"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />SYNC: ACTIVE</span>
          <span className="shrink-0">{searchParams.get('tcode') || 'HOME'}</span>
          <span className="truncate">USER: {!mounted || isProfileLoading ? 'IDENTIFYING...' : (isBootstrapAdmin ? 'SUPER ADMIN' : isAdmin ? 'ADMIN' : (userProfile?.employeeName || 'IDENTIFYING...') )}</span>
        </div>
        <div className="shrink-0 ml-4 hidden sm:block text-blue-400 font-bold italic tracking-wider">SIKKA INDUSTRIES & LOGISTICS</div>
      </div>

      <Dialog open={showAddFav} onOpenChange={setShowAddFav}>
        <DialogContent className="max-w-md rounded-none border-[3px] border-[#0056d2] font-mono">
          <DialogHeader><DialogTitle className="text-sm font-black uppercase italic text-[#0056d2]">Add to Favorites</DialogTitle></DialogHeader>
          <div className="py-6 space-y-4">
             <div className="flex items-center gap-4">
                <label className="text-[11px] font-black uppercase text-slate-600 w-24 text-right">T-Code:</label>
                <input autoFocus value={newFavCode} onChange={e => setNewFavCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleAddFavorite()} className="flex-1 h-8 border border-slate-400 px-3 text-xs font-black uppercase outline-none focus:bg-yellow-50" placeholder="E.G. VA01" />
             </div>
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={() => setShowAddFav(false)} variant="outline" className="h-8 rounded-none text-[10px] font-black uppercase px-6 border-slate-300">Cancel</Button>
            <Button onClick={handleAddFavorite} className="h-8 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase px-8">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

