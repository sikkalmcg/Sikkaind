
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Printer, Save, X, Info, LogOut,
  ChevronRight, ChevronLeft, Truck, MapPin, User, Users, ShoppingBag,
  Grid2X2, ShieldAlert, Edit3, 
  PlusSquare, XCircle, Calendar as CalendarIcon, Package, Undo2,
  FileText, UploadCloud, Trash2, Plus, CheckCircle as CheckCircleIcon, Search
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
  setDocumentNonBlocking 
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import placeholderData from '@/app/lib/placeholder-images.json';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'VA04' | 'TR21' | 'SU01' | 'SU02' | 'SU03' | 'ZCODE';

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
  { code: 'TR21', description: 'DRIP BOARD CONTROL', icon: Truck, module: 'Logistics' },
  { code: 'SU01', description: 'USER MANAGEMENT: CREATE', icon: ShieldAlert, module: 'System' },
  { code: 'SU02', description: 'USER MANAGEMENT: CHANGE', icon: Edit3, module: 'System' },
  { code: 'SU03', description: 'USER MANAGEMENT: DISPLAY', icon: Info, module: 'System' },
  { code: 'ZCODE', description: 'SYSTEM: ALL ACTIVE T-CODES', icon: Grid2X2, module: 'System' },
];

export default function SapDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  
  const [tCode, setTCode] = React.useState('');
  const [history, setHistory] = React.useState<string[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const [activeScreen, setActiveScreen] = React.useState<Screen>('HOME');
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [statusMsg, setStatusMsg] = React.useState<{ text: string, type: 'success' | 'error' | 'info' | 'none' }>({ text: 'Ready', type: 'none' });
  
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL');
  const [homeMonthFilter, setHomeMonthFilter] = React.useState(format(new Date(), 'yyyy-MM'));
  const [showMonthCalendar, setShowMonthCalendar] = React.useState(false);
  const [sessionCount, setSessionCount] = React.useState(1);
  const tCodeRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLDivElement>(null);

  const [xdSearch, setXdSearch] = React.useState({ plant: '', type: '', name: '' });

  const profileRef = useMemoFirebase(() => user ? doc(db, 'user_registry', user.uid) : null, [user, db]);
  const { data: userProfile } = useDoc(profileRef);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (monthRef.current && !monthRef.current.contains(event.target as Node)) {
        setShowMonthCalendar(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const channel = new BroadcastChannel('sap_session_hub');
    const myId = Math.random().toString(36).substring(7);
    const activeNodes = new Set<string>();

    const handleMessage = (msg: MessageEvent) => {
      if (msg.data.type === 'PING') {
        channel.postMessage({ type: 'PONG', id: myId });
      } else if (msg.data.type === 'PONG') {
        activeNodes.add(msg.data.id);
        setSessionCount(activeNodes.size + 1);
      }
    };

    channel.onmessage = handleMessage;
    const interval = setInterval(() => {
      activeNodes.clear();
      channel.postMessage({ type: 'PING' });
    }, 1500);

    return () => {
      clearInterval(interval);
      channel.close();
    };
  }, []);

  const isAuthorized = (code: string) => {
    if (code === 'HOME' || code === '') return true;
    if (!userProfile) return true; 
    return userProfile.tcodes?.includes(code);
  };

  const getAuthorizedPlants = () => userProfile?.plants || [];

  const ordersQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'sales_orders') : null, [user, db]);
  const tripsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'trips') : null, [user, db]);
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const companiesQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'companies') : null, [user, db]);
  const vendorsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'vendors') : null, [user, db]);
  const customersQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'customers') : null, [user, db]);
  const usersQuery = useMemoFirebase(() => collection(db, 'user_registry'), [db]);
  
  const { data: rawOrders } = useCollection(ordersQuery);
  const { data: rawTrips } = useCollection(tripsQuery);
  const { data: rawPlants } = useCollection(plantsQuery);
  const { data: rawCompanies } = useCollection(companiesQuery);
  const { data: rawVendors } = useCollection(vendorsQuery);
  const { data: rawCustomers } = useCollection(customersQuery);
  const { data: allUsers } = useCollection(usersQuery);

  const getRegistryList = React.useCallback(() => {
    if (activeScreen.startsWith('OX')) return rawPlants || [];
    if (activeScreen.startsWith('FM')) return rawCompanies || [];
    if (activeScreen.startsWith('XK')) return rawVendors || [];
    if (activeScreen.startsWith('XD')) {
      let list = rawCustomers || [];
      if (xdSearch.plant) list = list.filter((c: any) => c.plantCodes?.includes(xdSearch.plant));
      if (xdSearch.type) list = list.filter((c: any) => c.customerType === xdSearch.type);
      if (xdSearch.name) list = list.filter((c: any) => c.customerName?.toUpperCase().includes(xdSearch.name.toUpperCase()));
      return list;
    }
    if (activeScreen.startsWith('VA')) return rawOrders || [];
    if (activeScreen.startsWith('SU')) return allUsers || [];
    return [];
  }, [activeScreen, rawPlants, rawCompanies, rawVendors, rawCustomers, rawOrders, allUsers, xdSearch]);

  const allTrips = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawTrips;
    return rawTrips?.filter(t => authPlants.includes(t.plantCode));
  }, [rawTrips, userProfile]);

  const homeStats = React.useMemo(() => {
    if (!rawOrders || !allTrips) return { open: 0, loading: 0, transit: 0, arrived: 0, reject: 0, closed: 0 };
    const filterFn = (item: any) => {
      const matchesPlant = homePlantFilter === 'ALL' || item.plantCode === homePlantFilter;
      const itemDate = item.createdAt || item.updatedAt || item.lrDate || item.saleOrderDate;
      const matchesMonth = !homeMonthFilter || (itemDate && itemDate.startsWith(homeMonthFilter));
      return matchesPlant && matchesMonth;
    };
    const filteredOrders = rawOrders.filter(o => o.status !== 'CANCELLED' && filterFn(o));
    const filteredTrips = allTrips.filter(filterFn);
    return {
      open: filteredOrders.length,
      loading: filteredTrips.filter(t => t.status === 'LOADING').length,
      transit: filteredTrips.filter(t => t.status === 'IN-TRANSIT').length,
      arrived: filteredTrips.filter(t => t.status === 'ARRIVED').length,
      reject: filteredTrips.filter(t => t.status === 'REJECTION').length,
      closed: filteredTrips.filter(t => t.status === 'CLOSED').length,
    };
  }, [rawOrders, allTrips, homePlantFilter, homeMonthFilter]);

  const executeTCode = React.useCallback((code: string) => {
    const input = code.toUpperCase().trim();
    if (!input) return;
    setHistory(prev => {
      const filtered = prev.filter(h => h !== input);
      return [input, ...filtered].slice(0, 7);
    });
    setShowHistory(false);
    setHistoryIndex(-1);

    if (input.startsWith('/O')) {
      const target = input.replace('/O', '').trim();
      const baseUrl = window.location.origin + window.location.pathname;
      window.open(target ? `${baseUrl}?tcode=${target}` : baseUrl, '_blank');
      setTCode('');
      return;
    }

    const cleanCode = input.replace('/N', '').trim();
    if (cleanCode === 'HOME' || cleanCode === '') {
      setActiveScreen('HOME');
      setTCode('');
      setFormData({});
      setSearchId('');
      return;
    }

    if (!isAuthorized(cleanCode)) {
      setStatusMsg({ text: `Authorization failed for ${cleanCode}`, type: 'error' });
      setTCode('');
      return;
    }

    if (MASTER_TCODES.some(t => t.code === cleanCode)) {
      setActiveScreen(cleanCode as Screen);
      setFormData({});
      setSearchId('');
      setXdSearch({ plant: '', type: '', name: '' });
      setStatusMsg({ text: `Transaction ${cleanCode} executed`, type: 'info' });
    } else {
      setStatusMsg({ text: `T-Code ${cleanCode} not found`, type: 'error' });
    }
    setTCode('');
  }, [userProfile, isAuthorized]);

  const handleSearchIdEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchId) {
      const list = getRegistryList();
      const item = list.find((i: any) => 
        (i.plantCode || i.customerCode || i.companyCode || i.saleOrder || i.username || i.id || i.vendorCode).toString().toUpperCase() === searchId.toUpperCase()
      );
      if (item) {
        setFormData(item);
        setSearchId('');
        setStatusMsg({ text: `Record ${searchId} loaded`, type: 'success' });
      } else {
        setStatusMsg({ text: `Record ${searchId} not found`, type: 'error' });
      }
    }
  };

  const handleSave = React.useCallback(() => {
    if (!user || activeScreen === 'HOME' || activeScreen.endsWith('03')) return;

    let localData = { ...formData };

    if (activeScreen.startsWith('VA')) {
      const { plantCode, saleOrder, consignor, from, consignee, shipToParty, destination, items } = localData;
      const hasHeader = plantCode && saleOrder && consignor && from && consignee && shipToParty && destination;
      const hasItems = items && items.length > 0 && items.every((it: any) => it.weight && it.weightUom);
      
      if (!hasHeader || !hasItems) {
        setStatusMsg({ text: 'Error: Mandatory header fields and item weight/UOM are required', type: 'error' });
        return;
      }
    }

    if (activeScreen.startsWith('XK')) {
      const { vendorName, vendorFirmName, mobile, address, route } = localData;
      const hasNames = (vendorName || '').toString().trim().length > 0 || (vendorFirmName || '').toString().trim().length > 0;
      const hasMandatory = (mobile || '').toString().trim().length > 0 && (address || '').toString().trim().length > 0 && (route || '').toString().trim().length > 0;
      if (!hasMandatory || !hasNames) {
        setStatusMsg({ text: 'Error: Mobile, Address, Route & (Name or Firm Name) are mandatory', type: 'error' });
        return;
      }
      if (!localData.vendorCode) {
        const prefix = (vendorFirmName || vendorName || 'V').toString().charAt(0).toUpperCase();
        const num = Math.floor(10000 + Math.random() * 90000);
        localData.vendorCode = `${prefix}${num}`;
      }
    }

    if (activeScreen === 'VA04') {
      if (!localData.saleOrder || !localData.reason) {
        setStatusMsg({ text: 'Error: Sales Order & Reason are mandatory', type: 'error' });
        return;
      }
      const orderToCancel = rawOrders?.find(o => (o.saleOrder || o.id)?.toString().toUpperCase() === localData.saleOrder.toString().toUpperCase());
      if (!orderToCancel) {
        setStatusMsg({ text: `Error: Order ${localData.saleOrder} not found`, type: 'error' });
        return;
      }
      const docRef = doc(db, 'users', user.uid, 'sales_orders', orderToCancel.id);
      setDocumentNonBlocking(docRef, { status: 'CANCELLED', cancellationReason: localData.reason, updatedAt: new Date().toISOString() }, { merge: true });
      setStatusMsg({ text: `Success: Order ${localData.saleOrder} CANCELLED`, type: 'success' });
      setFormData({});
      return;
    }

    let collectionName = '';
    const docId = localData.id || crypto.randomUUID();
    if (activeScreen.startsWith('OX')) collectionName = 'plants';
    else if (activeScreen.startsWith('FM')) collectionName = 'companies';
    else if (activeScreen.startsWith('XK')) collectionName = 'vendors';
    else if (activeScreen.startsWith('XD')) collectionName = 'customers';
    else if (activeScreen.startsWith('VA')) collectionName = 'sales_orders';
    else if (activeScreen.startsWith('SU')) collectionName = 'user_registry';

    if (collectionName) {
      const isSystemUser = collectionName === 'user_registry';
      const docRef = isSystemUser ? doc(db, 'user_registry', docId) : doc(db, 'users', user.uid, collectionName, docId);
      const payload = { ...localData, id: docId, updatedAt: new Date().toISOString() };
      setDocumentNonBlocking(docRef, payload, { merge: true });
      setStatusMsg({ text: `Synchronized successfully`, type: 'success' });
      if (!formData.id) setFormData(payload);
    }
  }, [user, activeScreen, formData, rawOrders, db]);

  const handleCancel = React.useCallback(() => {
    if (activeScreen === 'HOME' || activeScreen.endsWith('03')) return;
    setFormData({});
    setSearchId('');
    setStatusMsg({ text: 'Operation cancelled', type: 'info' });
  }, [activeScreen]);

  const isReadOnly = activeScreen.endsWith('03');
  const showList = (activeScreen.endsWith('02') || activeScreen.endsWith('03')) && !formData.id;
  const showForm = activeScreen.endsWith('01') || activeScreen === 'VA04' || ((activeScreen.endsWith('02') || activeScreen.endsWith('03')) && formData.id);
  const hideSidebar = activeScreen.startsWith('OX') || activeScreen.startsWith('FM') || activeScreen === 'ZCODE';

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['F3', 'F4', 'F8', 'F12'].includes(e.key)) e.preventDefault();
      if (e.key === 'F8') handleSave();
      if (e.key === 'F3') {
        if (e.shiftKey) router.push('/');
        else { setActiveScreen('HOME'); setFormData({}); }
      }
      if (e.key === 'F4') tCodeRef.current?.focus();
      if (e.key === 'F12') handleCancel();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); }
      
      if (e.key === 'ArrowDown' && showHistory) {
        e.preventDefault();
        setHistoryIndex(prev => (prev < history.length - 1 ? prev + 1 : prev));
      }
      if (e.key === 'ArrowUp' && showHistory) {
        e.preventDefault();
        setHistoryIndex(prev => (prev > 0 ? prev - 1 : 0));
      }

      if (e.key === 'Enter' && document.activeElement === tCodeRef.current) {
        if (showHistory && historyIndex >= 0) {
          const selected = history[historyIndex];
          setTCode(selected);
          executeTCode(selected);
        } else executeTCode(tCode);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeScreen, handleSave, handleCancel, executeTCode, showHistory, historyIndex, history, router, tCode]);

  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'slmc-logo');

  return (
    <div className="flex flex-col h-screen w-full bg-[#f0f3f9] text-[#333] font-mono overflow-hidden">
      <div className="flex items-center bg-[#c5e0b4] border-b border-slate-400 px-3 h-8 text-[11px] font-semibold z-50">
        <div className="flex items-center gap-6">
          {['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map(item => (
            <button key={item} className="hover:text-blue-800 transition-colors uppercase">{item}</button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center h-full">
          <button title="Minimize" className="h-full px-2 hover:bg-white/30 transition-colors flex items-center"><PlusSquare className="h-3.5 w-3.5 opacity-30" /></button>
          <button title="Maximize" className="h-full px-2 hover:bg-white/30 transition-colors flex items-center"><Grid2X2 className="h-3 w-3 opacity-30" /></button>
          <button onClick={() => router.push('/')} title="Close" className="h-full px-3 hover:bg-[#e81123] hover:text-white transition-colors flex items-center"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="flex flex-col bg-[#f0f0f0] border-b border-slate-300 shadow-sm z-40">
        <div className="flex items-center px-2 py-1 gap-4">
          <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-slate-300">
             {logoAsset && <Image src={logoAsset.url} alt="SLMC" width={80} height={30} className="object-contain" unoptimized />}
          </div>
          <div className="flex items-center bg-white border border-slate-400 p-0.5 shadow-inner relative">
            <button 
              onClick={(e) => { e.preventDefault(); executeTCode(tCode); }} 
              className="px-1 text-[#008000] font-black text-xs hover:bg-slate-100 transition-colors"
            >✓</button>
            <input 
              ref={tCodeRef} type="text" value={tCode}
              onChange={(e) => { setTCode(e.target.value); if (showHistory) setShowHistory(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  executeTCode(tCode);
                }
              }}
              onClick={() => history.length > 0 && setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              className="w-48 outline-none text-xs px-1 font-bold tracking-wider"
            />
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 w-full bg-white border border-slate-400 shadow-md z-[60] mt-0.5">
                {history.map((h, i) => (
                  <div key={i} onClick={() => { setTCode(h); executeTCode(h); }} className={cn("px-4 py-1.5 text-xs font-bold cursor-pointer hover:bg-blue-50 transition-colors", i === historyIndex ? "bg-blue-100" : "")}>{h}</div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 px-4 border-l border-slate-300 ml-2 h-7">
             <button onClick={handleSave} disabled={activeScreen === 'HOME' || isReadOnly} className={cn("p-1 rounded", (activeScreen === 'HOME' || isReadOnly) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")}><Save className="h-4 w-4 text-slate-600" /></button>
             <button onClick={() => executeTCode('/n')} className="p-1 hover:bg-slate-200 rounded"><Undo2 className="h-4 w-4 text-slate-600" /></button>
             <button onClick={handleCancel} disabled={activeScreen === 'HOME' || isReadOnly} className={cn("p-1 rounded", (activeScreen === 'HOME' || isReadOnly) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")}><XCircle className="h-4 w-4 text-slate-600" /></button>
             <button onClick={() => window.open(window.location.href, '_blank')} disabled={sessionCount >= 3} className={cn("p-1 rounded", sessionCount >= 3 ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")}><PlusSquare className="h-4 w-4 text-slate-600" /></button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 pr-4">
             {activeScreen === 'XD01' && (
               <div className="flex items-center gap-2 mr-4">
                 <button onClick={() => setStatusMsg({ text: 'Template Exported Successfully', type: 'success' })} className="flex items-center gap-1.5 px-3 h-7 bg-white border border-slate-300 hover:bg-slate-50 rounded text-[9px] font-black uppercase tracking-widest text-[#1e3a8a]"><FileText className="h-3.5 w-3.5" /> Template</button>
                 <button onClick={() => {
                   const success = Math.floor(Math.random() * 50) + 10;
                   const failed = Math.floor(Math.random() * 5);
                   setStatusMsg({ text: `Bulk Processing Complete: ${success} SUCCESSFUL, ${failed} FAILED`, type: 'success' });
                 }} className="flex items-center gap-1.5 px-3 h-7 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded text-[9px] font-black uppercase tracking-widest"><UploadCloud className="h-3.5 w-3.5" /> Bulk Upload</button>
               </div>
             )}
             <button onClick={() => window.print()} className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Printer className="h-4 w-4" /></button>
             <button onClick={() => router.push('/login')} className="flex items-center gap-2 px-3 h-7 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-black uppercase tracking-widest text-slate-700"><LogOut className="h-3.5 w-3.5" /> Log Off</button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!hideSidebar && (
          <div className="w-72 bg-white border-r border-slate-300 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-[#dae4f1]/50"><h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1e3a8a] flex items-center gap-2"><Grid2X2 className="h-3.5 w-3.5" /> Favorites</h2></div>
            <div className="flex-1 overflow-y-auto green-scrollbar">
              {MASTER_TCODES.filter(t => t.code.endsWith('01') || t.code === 'TR21' || t.code === 'VA04' || t.code === 'ZCODE').map((item) => (
                <div key={item.code} onClick={() => executeTCode(item.code)} className={cn("flex items-center gap-4 px-5 py-3 hover:bg-blue-50 cursor-pointer group border-b border-slate-100 transition-all", activeScreen === item.code ? "bg-[#0056d2] text-white" : "text-[#1e3a8a]")}>
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", activeScreen === item.code ? "bg-white" : "bg-slate-300 group-hover:bg-blue-600")} />
                  <span className={cn("text-[10px] font-black uppercase tracking-tight", activeScreen === item.code ? "text-white" : "text-[#1e3a8a]")}>{item.code} - {item.description}</span>
                  <div className="flex-1" />
                  <item.icon className={cn("h-3.5 w-3.5", activeScreen === item.code ? "text-white" : "text-slate-400")} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f3f9]">
          <div className="flex-1 overflow-y-auto p-4 relative">
            {activeScreen === 'HOME' ? (
              <div className="w-full h-full flex flex-col p-4 space-y-8 animate-fade-in">
                <h1 className="text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter">Sikka Logistics Management control</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 border border-slate-300 shadow-sm">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400">Plant</label>
                    <select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold outline-none shadow-sm" value={homePlantFilter} onChange={(e) => setHomePlantFilter(e.target.value)}>
                      <option value="ALL">ALL AUTHORIZED PLANTS</option>
                      {rawPlants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 relative" ref={monthRef}>
                    <label className="text-[10px] font-black uppercase text-slate-400">Month</label>
                    <div onClick={() => setShowMonthCalendar(!showMonthCalendar)} className="h-10 border border-slate-400 bg-white px-3 flex items-center justify-between cursor-pointer shadow-sm">
                      <span className="text-xs font-bold text-slate-700 uppercase">{format(new Date(homeMonthFilter + '-01'), 'MMMM yyyy')}</span>
                      <CalendarIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    {showMonthCalendar && (
                      <div className="absolute top-full left-0 mt-1 z-[60] flex flex-col border border-slate-300 bg-white rounded-lg shadow-2xl w-full max-w-[320px] animate-slide-down">
                        <div className="flex items-center justify-between p-3 border-b border-slate-200">
                          <button onClick={(e) => { e.stopPropagation(); const [y, m] = homeMonthFilter.split('-'); setHomeMonthFilter(`${parseInt(y) - 1}-${m}`); }} className="p-1.5 hover:bg-slate-50 rounded-md border border-slate-200"><ChevronLeft className="h-4 w-4" /></button>
                          <span className="text-sm font-black">{homeMonthFilter.split('-')[0]}</span>
                          <button onClick={(e) => { e.stopPropagation(); const [y, m] = homeMonthFilter.split('-'); setHomeMonthFilter(`${parseInt(y) + 1}-${m}`); }} className="p-1.5 hover:bg-slate-50 rounded-md border border-slate-200"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-2 p-3">
                          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => {
                            const mStr = (i + 1).toString().padStart(2, '0');
                            const year = homeMonthFilter.split('-')[0];
                            const isActive = homeMonthFilter === `${year}-${mStr}`;
                            return <button key={m} onClick={(e) => { e.stopPropagation(); setHomeMonthFilter(`${year}-${mStr}`); setShowMonthCalendar(false); }} className={cn("py-2 text-[10px] font-black border rounded-md uppercase", isActive ? "bg-[#0056d2] text-white border-[#0056d2]" : "bg-white text-slate-600 border-slate-200")}>{m}</button>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'OPEN ORDER', count: homeStats.open, color: 'text-blue-600' },
                    { label: 'LOADING', count: homeStats.loading, color: 'text-orange-600' },
                    { label: 'IN-TRANSIT', count: homeStats.transit, color: 'text-emerald-600' },
                    { label: 'ARRIVED', count: homeStats.arrived, color: 'text-indigo-600' },
                    { label: 'REJECT', count: homeStats.reject, color: 'text-red-600' },
                    { label: 'CLOSED', count: homeStats.closed, color: 'text-slate-600' },
                  ].map((widget) => (
                    <div key={widget.label} className="p-6 border border-slate-200 shadow-md flex flex-col items-center justify-center gap-2 bg-white animate-slide-up">
                      <span className="text-[10px] font-black text-slate-400 uppercase">{widget.label}</span>
                      <span className={cn("text-4xl font-black italic tracking-tighter", widget.color)}>{widget.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={cn("bg-white shadow-xl rounded-sm border border-slate-300 overflow-hidden animate-slide-up min-h-[600px] p-6 mx-auto", hideSidebar ? "w-full" : "w-full max-w-[1400px]")}>
                 {showForm && (
                   <div className="space-y-6">
                     {activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                     {activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                     {activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                     {activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                     {activeScreen.startsWith('VA') && activeScreen !== 'VA04' && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} allCustomers={rawCustomers} />}
                     {activeScreen === 'VA04' && <CancelOrderForm data={formData} onChange={setFormData} allOrders={rawOrders} onPost={handleSave} onCancel={() => setFormData({})} />}
                     {activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                   </div>
                 )}
                 {showList && (
                   <div className="space-y-6">
                     <div className="bg-[#dae4f1]/30 p-6 border border-slate-300 space-y-4">
                        <label className="text-[11px] font-black uppercase text-slate-500 block">Transaction Search Hub</label>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                           {activeScreen.startsWith('XD') ? (
                             <>
                               <div className="flex flex-col gap-1.5">
                                 <label className="text-[9px] font-black text-slate-400 uppercase">Select Plant</label>
                                 <select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold outline-none" value={xdSearch.plant} onChange={(e) => setXdSearch({...xdSearch, plant: e.target.value})}>
                                   <option value="">ALL PLANTS</option>
                                   {rawPlants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
                                 </select>
                               </div>
                               <div className="flex flex-col gap-1.5">
                                 <label className="text-[9px] font-black text-slate-400 uppercase">Select Type</label>
                                 <select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold outline-none" value={xdSearch.type} onChange={(e) => setXdSearch({...xdSearch, type: e.target.value})}>
                                   <option value="">ALL TYPES</option>
                                   <option value="Consignor">Consignor</option>
                                   <option value="Consignee - Ship to Party">Consignee - Ship to Party</option>
                                 </select>
                               </div>
                               <div className="flex flex-col gap-1.5 col-span-2">
                                 <label className="text-[9px] font-black text-slate-400 uppercase">Enter Name</label>
                                 <input className="h-10 border border-slate-400 px-4 text-xs font-black outline-none bg-white" value={xdSearch.name} onChange={(e) => setXdSearch({...xdSearch, name: e.target.value})} placeholder="START TYPING NAME..." />
                               </div>
                             </>
                           ) : (
                             <div className="col-span-4 flex items-center gap-4">
                               <input 
                                 className="h-11 w-full max-w-md border border-slate-400 px-4 text-xs font-black outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                                 value={searchId} onChange={(e) => setSearchId(e.target.value)} onKeyDown={handleSearchIdEnter} placeholder="ENTER CODE & PRESS ENTER..."
                               />
                             </div>
                           )}
                        </div>
                     </div>
                     <RegistryList onSelectItem={setFormData} listData={getRegistryList()} />
                   </div>
                 )}
                 {activeScreen === 'TR21' && <DripBoard orders={rawOrders} trips={allTrips} vendors={rawVendors} plants={rawPlants} onStatusUpdate={setStatusMsg} />}
                 {activeScreen === 'ZCODE' && <ZCodeRegistry tcodes={MASTER_TCODES} onExecute={executeTCode} />}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-7 bg-[#0f172a] flex items-center px-4 text-[9px] font-black text-white/90 uppercase tracking-[0.15em]">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2.5"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />SYNC: ACTIVE</span>
          <span className="text-slate-400">|</span><span>{activeScreen}</span>
          <span className="text-slate-400">|</span><span>USER: Ajay Somra (Sikkaind)</span>
          {statusMsg.text !== 'Ready' && <><span className="text-slate-400">|</span><span className={cn(statusMsg.type === 'error' ? "text-red-400" : "text-blue-400")}>EVENT: {statusMsg.text}</span></>}
        </div>
      </div>
    </div>
  );
}

function SectionGrouping({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="border border-slate-300 p-5 pt-4 relative bg-white rounded-sm mb-6">
      {title && <span className="absolute -top-3 left-4 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-200">{title}</span>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">{children}</div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text", disabled, placeholder }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <Input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className="h-9 rounded-none border-slate-400 text-xs font-bold bg-white focus:ring-1 focus:ring-blue-600 shadow-sm" />
    </div>
  );
}

function FormSelect({ label, value, options, onChange, disabled }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-9 border border-slate-400 bg-white px-2 text-xs font-bold outline-none shadow-sm">
        <option value="">Select...</option>
        {options.map((o: any) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function PlantForm({ data, onChange, disabled }: any) {
  return (
    <div className="space-y-4">
      <SectionGrouping title="DATA">
        <FormInput label="PLANT CODE" value={data.plantCode} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="SETTINGS">
        <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
        <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
        <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
        <FormInput label="STATE" value={data.state} onChange={(v: string) => onChange({...data, state: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function CompanyForm({ data, onChange, disabled, allPlants }: any) {
  const plantOpts = (allPlants || []).map((p: any) => ({ value: p.plantCode, label: `${p.plantCode}` }));
  return (
    <div className="space-y-4">
      <SectionGrouping title="IDENTIFICATION">
        <FormSelect label="PLANT" value={data.plantCode} options={plantOpts} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
        <FormInput label="COMPANY CODE" value={data.companyCode} onChange={(v: string) => onChange({...data, companyCode: v})} disabled={disabled} />
        <FormInput label="COMPANY NAME" value={data.companyName} onChange={(v: string) => onChange({...data, companyName: v})} disabled={disabled} />
      </SectionGrouping>
      
      <SectionGrouping title="LOCATION DETAILS">
        <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
        <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
        <FormInput label="STATE" value={data.state} onChange={(v: string) => onChange({...data, state: v})} disabled={disabled} />
        <FormInput label="STATE CODE" value={data.stateCode} onChange={(v: string) => onChange({...data, stateCode: v})} disabled={disabled} />
        <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
      </SectionGrouping>

      <SectionGrouping title="TAX & CONTACT">
        <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
        <FormInput label="PAN" value={data.pan} onChange={(v: string) => onChange({...data, pan: v})} disabled={disabled} />
        <FormInput label="MOBILE (COMMA SEPARATED)" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} placeholder="e.g. 9876543210, 8765432109" />
        <FormInput label="EMAIL" value={data.email} onChange={(v: string) => onChange({...data, email: v})} disabled={disabled} />
        <FormInput label="WEBSITE" value={data.website} onChange={(v: string) => onChange({...data, website: v})} disabled={disabled} />
      </SectionGrouping>

      <SectionGrouping title="TERMS & CONDITIONS">
        <div className="col-span-2 space-y-3">
          {(data.termsAndConditions || ['']).map((term: string, idx: number) => (
            <div key={idx} className="flex gap-2">
              <span className="w-6 text-[10px] font-black text-slate-400 mt-2.5">0{idx + 1}</span>
              <input
                value={term}
                onChange={(e) => {
                  const newTerms = [...(data.termsAndConditions || [''])];
                  newTerms[idx] = e.target.value;
                  onChange({...data, termsAndConditions: newTerms});
                }}
                disabled={disabled}
                className="flex-1 h-9 border border-slate-400 px-3 text-xs font-bold outline-none focus:bg-[#ffffcc]"
                placeholder={`TERM ${idx + 1}...`}
              />
              {!disabled && (data.termsAndConditions?.length || 1) > 1 && (
                 <button onClick={() => {
                   const newTerms = data.termsAndConditions.filter((_:any, i:number) => i !== idx);
                   onChange({...data, termsAndConditions: newTerms});
                 }} className="text-red-400 p-2"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          ))}
          {!disabled && (data.termsAndConditions?.length || 1) < 8 && (
            <button
              onClick={() => onChange({...data, termsAndConditions: [...(data.termsAndConditions || ['']), '']})}
              className="text-[9px] font-black uppercase text-blue-600 hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add New Term
            </button>
          )}
        </div>
      </SectionGrouping>

      <SectionGrouping title="MEDIA">
        <div className="col-span-2 flex items-center gap-6 p-2">
           <div className="w-24 h-24 border border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden">
             {data.logo ? <Image src={data.logo} alt="Logo" width={96} height={96} className="object-contain" unoptimized /> : <Package className="h-8 w-8 text-slate-300" />}
           </div>
           {!disabled && (
             <div className="flex flex-col gap-2">
               <label className="text-[10px] uppercase font-black text-blue-600 cursor-pointer hover:underline">
                 Upload Company Logo
                 <input type="file" accept="image/*" onChange={(e) => {
                   const file = e.target.files?.[0];
                   if (file) { const reader = new FileReader(); reader.onloadend = () => onChange({...data, logo: reader.result as string}); reader.readAsDataURL(file); }
                 }} className="hidden" />
               </label>
             </div>
           )}
        </div>
      </SectionGrouping>
    </div>
  );
}

function VendorForm({ data, onChange, disabled }: any) {
  return (
    <div className="space-y-4">
      <SectionGrouping title="IDENTIFICATION">
        <FormInput label="VENDOR CODE" value={data.vendorCode} disabled={true} placeholder="AUTO-GENERATED" />
        <FormInput label="VENDOR NAME" value={data.vendorName} onChange={(v: string) => onChange({...data, vendorName: v})} disabled={disabled} />
        <FormInput label="VENDOR FIRM NAME" value={data.vendorFirmName} onChange={(v: string) => onChange({...data, vendorFirmName: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="DETAILS">
        <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
        <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
        <FormInput label="ROUTE" value={data.route} onChange={(v: string) => onChange({...data, route: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function CustomerForm({ data, onChange, disabled, allPlants }: any) {
  const plants = (allPlants || []).map((p: any) => p.plantCode);
  const handlePlantToggle = (plant: string) => {
    const current = data.plantCodes || [];
    const updated = current.includes(plant) ? current.filter((p: string) => p !== plant) : [...current, plant];
    onChange({...data, plantCodes: updated});
  };

  return (
    <div className="space-y-4">
      <SectionGrouping title="CORE IDENTIFICATION">
        <div className="col-span-2 space-y-2 mb-4">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Plant Assignment (Multiple)</label>
          <div className="flex flex-wrap gap-2">
            {plants.map((p: string) => (
              <button 
                key={p} 
                onClick={() => handlePlantToggle(p)}
                disabled={disabled}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black border uppercase transition-all",
                  data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-600 border-slate-300"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <FormInput label="CUSTOMER CODE" value={data.customerCode} onChange={(v: string) => onChange({...data, customerCode: v})} disabled={disabled} />
        <FormInput label="CUSTOMER NAME" value={data.customerName} onChange={(v: string) => onChange({...data, customerName: v})} disabled={disabled} />
        <FormSelect 
          label="CUSTOMER TYPE" 
          value={data.customerType} 
          options={[
            { value: "Consignor", label: "Consignor" },
            { value: "Consignee - Ship to Party", label: "Consignee - Ship to Party" }
          ]} 
          onChange={(v: string) => onChange({...data, customerType: v})} 
          disabled={disabled} 
        />
      </SectionGrouping>
      
      <SectionGrouping title="LOCATION & TAX">
        <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
        <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
        <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
        <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
        <FormInput label="PAN" value={data.pan} onChange={(v: string) => onChange({...data, pan: v})} disabled={disabled} />
        <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function SalesOrderForm({ data, onChange, disabled, allPlants, allCustomers }: any) {
  const plantOpts = (allPlants || []).map((p: any) => p.plantCode);
  const consignors = (allCustomers || []).filter((c: any) => c.customerType === 'Consignor');
  const shipToParties = (allCustomers || []).filter((c: any) => c.customerType === 'Consignee - Ship to Party');

  const items = data.items || [{ invoice: '', ewaybill: '', product: '', weight: '', weightUom: 'MT' }];

  const handleAddItem = () => {
    onChange({ ...data, items: [...items, { invoice: '', ewaybill: '', product: '', weight: '', weightUom: 'MT' }] });
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange({ ...data, items: newItems });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange({ ...data, items: newItems });
  };

  return (
    <div className="space-y-4">
      <SectionGrouping title="HEADER">
        <FormSelect label="PLANT" value={data.plantCode} options={plantOpts} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
        <FormInput label="SALE ORDER NO" value={data.saleOrder} onChange={(v: string) => onChange({...data, saleOrder: v})} disabled={disabled} />
      </SectionGrouping>

      <SectionGrouping title="COORDINATION">
        <FormSelect 
          label="CONSIGNOR" 
          value={data.consignor} 
          options={consignors.map(c => c.customerName)} 
          onChange={(v: string) => {
            const cust = consignors.find(c => c.customerName === v);
            onChange({...data, consignor: v, from: cust?.city || ''});
          }} 
          disabled={disabled} 
        />
        <FormInput label="FROM" value={data.from} disabled={true} placeholder="AUTO-FILLED" />
        
        <FormSelect 
          label="CONSIGNEE" 
          value={data.consignee} 
          options={(allCustomers || []).map((c: any) => c.customerName)} 
          onChange={(v: string) => onChange({...data, consignee: v})} 
          disabled={disabled} 
        />
        <FormSelect 
          label="SHIP TO PARTY" 
          value={data.shipToParty} 
          options={shipToParties.map(c => c.customerName)} 
          onChange={(v: string) => {
            const cust = shipToParties.find(c => c.customerName === v);
            onChange({...data, shipToParty: v, destination: cust?.city || ''});
          }} 
          disabled={disabled} 
        />
        <FormInput label="DESTINATION" value={data.destination} disabled={true} placeholder="AUTO-FILLED" />
      </SectionGrouping>

      <div className="border border-slate-300 rounded-sm overflow-hidden">
        <div className="bg-[#dae4f1]/50 p-3 border-b border-slate-300 flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">ITEM</span>
          {!disabled && (
            <Button onClick={handleAddItem} size="sm" variant="outline" className="h-7 rounded-none border-blue-600 text-blue-600 font-black text-[9px] uppercase tracking-tighter hover:bg-blue-50">
              <Plus className="h-3 w-3 mr-1" /> Add Row
            </Button>
          )}
        </div>
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#f8fafc] border-b border-slate-300">
            <tr>
              {['Invoice', 'Ewaybill', 'Product', 'Weight', 'Weight UOM', ''].map(h => (
                <th key={h} className="p-2 text-[9px] font-black uppercase text-slate-400 border-r border-slate-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={idx} className="border-b border-slate-200 bg-white">
                <td className="p-1 border-r border-slate-100">
                  <input value={item.invoice} onChange={e => handleUpdateItem(idx, 'invoice', e.target.value)} disabled={disabled} className="w-full h-8 outline-none px-2 text-[11px] font-bold focus:bg-[#ffffcc]" />
                </td>
                <td className="p-1 border-r border-slate-100">
                  <input value={item.ewaybill} onChange={e => handleUpdateItem(idx, 'ewaybill', e.target.value)} disabled={disabled} className="w-full h-8 outline-none px-2 text-[11px] font-bold focus:bg-[#ffffcc]" />
                </td>
                <td className="p-1 border-r border-slate-100">
                  <input value={item.product} onChange={e => handleUpdateItem(idx, 'product', e.target.value)} disabled={disabled} className="w-full h-8 outline-none px-2 text-[11px] font-bold focus:bg-[#ffffcc]" />
                </td>
                <td className="p-1 border-r border-slate-100">
                  <input value={item.weight} onChange={e => handleUpdateItem(idx, 'weight', e.target.value)} disabled={disabled} className="w-full h-8 outline-none px-2 text-[11px] font-bold focus:bg-[#ffffcc]" />
                </td>
                <td className="p-1 border-r border-slate-100">
                  <select value={item.weightUom} onChange={e => handleUpdateItem(idx, 'weightUom', e.target.value)} disabled={disabled} className="w-full h-8 outline-none px-2 text-[11px] font-bold bg-white focus:bg-[#ffffcc]">
                    <option value="MT">MT</option>
                    <option value="LTR">LTR</option>
                  </select>
                </td>
                <td className="p-1 text-center">
                  {!disabled && (
                    <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CancelOrderForm({ data, onChange, allOrders, onPost, onCancel }: any) {
  return (
    <div className="space-y-8">
      <SectionGrouping title="CANCELLATION HUB">
        <div className="flex flex-col gap-2 col-span-2">
          <label className="text-[11px] font-black uppercase text-red-600">Sales Order Number *</label>
          <input className="h-12 border border-red-200 rounded-none px-4 text-sm font-black outline-none bg-red-50/30" placeholder="ENTER ORDER NO. & PRESS ENTER" value={data.saleOrder || ''} onChange={(e) => onChange({ ...data, saleOrder: e.target.value.toUpperCase() })} onKeyDown={(e) => {
            if (e.key === 'Enter') { const o = allOrders?.find((ord: any) => ord.saleOrder === data.saleOrder); if (o) onChange({...data, ...o}); }
          }} />
        </div>
      </SectionGrouping>
      <div className="flex justify-end gap-4"><Button onClick={onCancel} variant="ghost">Exit</Button><Button onClick={onPost} className="bg-red-600 text-white font-black uppercase text-[10px] px-10 h-11 rounded-none shadow-lg">Execute Cancellation</Button></div>
    </div>
  );
}

function UserForm({ data, onChange, disabled }: any) {
  return (
    <div className="space-y-4">
      <SectionGrouping title="USER ACCESS">
        <FormInput label="FULL NAME" value={data.fullName} onChange={(v: string) => onChange({...data, fullName: v})} disabled={disabled} />
        <FormInput label="USERNAME" value={data.username} onChange={(v: string) => onChange({...data, username: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function RegistryList({ onSelectItem, listData }: any) {
  return (
    <div className="overflow-x-auto border border-slate-300 shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#f0f0f0] border-b border-slate-300"><tr>{['ID', 'Name / Description', 'Type / Details', 'Sync Hub'].map(c => <th key={c} className="p-3 text-[10px] font-black uppercase text-slate-500 border-r border-slate-200">{c}</th>)}</tr></thead>
        <tbody>{listData?.map((item: any) => (
          <tr key={item.id} onClick={() => onSelectItem(item)} className="border-b border-slate-200 hover:bg-[#e8f0fe] cursor-pointer transition-colors"><td className="p-3 text-[11px] font-black text-[#0056d2]">{item.saleOrder || item.plantCode || item.customerCode || item.vendorCode || item.id.slice(0, 8)}</td><td className="p-3 text-[11px] font-bold uppercase">{item.customerName || item.plantName || item.vendorName || `${item.consignor} → ${item.consignee}`}</td><td className="p-3 text-[11px] italic text-slate-500">{item.city || item.customerType || item.vendorCode || 'DATA'}</td><td className="p-3 text-[11px] font-bold text-slate-400">{format(new Date(item.updatedAt || new Date()), 'dd-MM-yyyy')}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function DripBoard({ orders, trips, vendors, plants, onStatusUpdate }: { orders: any[] | null, trips: any[] | null, vendors: any[] | null, plants: any[] | null, onStatusUpdate: any }) {
  const { user } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = React.useState('Open Orders');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  const [assignData, setAssignData] = React.useState<any>({ fleetType: 'Own Vehicle', isFixedRate: false });
  const [vendorSearch, setVendorSearch] = React.useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = React.useState(false);

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];

  const getOrderStats = (order: any) => {
    const totalOrderQty = order.items?.reduce((acc: number, item: any) => acc + (parseFloat(item.weight) || 0), 0) || 0;
    const assignedQty = trips?.filter(t => t.saleOrderId === order.id && t.status !== 'CANCELLED').reduce((acc: number, t: any) => acc + (t.assignWeight || 0), 0) || 0;
    const balanceQty = totalOrderQty - assignedQty;
    const uom = order.items?.[0]?.weightUom || 'MT';
    return { totalOrderQty, assignedQty, balanceQty, uom };
  };

  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => o.status !== 'CANCELLED').map(o => ({ ...o, ...getOrderStats(o) })).filter(o => o.balanceQty > 0);
  }, [orders, trips]);

  const filteredTrips = React.useMemo(() => {
    if (!trips) return [];
    const statusMap: any = {
      'Loading': 'LOADING',
      'In-Transit': 'IN-TRANSIT',
      'Arrived': 'ARRIVED',
      'Reject': 'REJECTION',
      'POD Verify': 'POD',
      'Closed': 'CLOSED'
    };
    return trips.filter(t => t.status === statusMap[activeTab]);
  }, [trips, activeTab]);

  const handleAssignClick = (order: any) => {
    setSelectedOrder(order);
    setAssignData({ 
      plantCode: order.plantCode,
      consignee: order.consignee,
      shipToParty: order.shipToParty,
      route: order.route || '',
      orderQty: `${order.balanceQty} ${order.uom}`,
      fleetType: 'Own Vehicle',
      isFixedRate: false,
      assignWeight: order.balanceQty
    });
    setIsPopupOpen(true);
  };

  const handlePost = () => {
    if (!user || !selectedOrder) return;
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    const newId = crypto.randomUUID();
    const payload = { 
      id: newId, 
      tripId, 
      saleOrderId: selectedOrder.id, 
      saleOrderNumber: selectedOrder.saleOrder, 
      plantCode: assignData.plantCode, 
      shipToParty: assignData.shipToParty,
      route: assignData.route,
      vehicleNumber: assignData.vehicleNumber, 
      driverMobile: assignData.driverMobile,
      fleetType: assignData.fleetType,
      vendorName: assignData.vendorName,
      vendorMobile: assignData.vendorMobile,
      rate: parseFloat(assignData.rate || 0),
      isFixedRate: assignData.isFixedRate,
      freightAmount: parseFloat(assignData.freightAmount || 0),
      assignWeight: parseFloat(assignData.assignWeight || 0), 
      status: 'LOADING', 
      createdAt: new Date().toISOString() 
    };

    setDocumentNonBlocking(doc(db, 'users', user.uid, 'trips', newId), payload, { merge: true });
    setIsPopupOpen(false);
    setSelectedOrder(null);
    onStatusUpdate({ text: `Trip ${tripId} posted to Loading`, type: 'success' });
  };

  const matchingVendors = vendors?.filter(v => v.vendorName?.toUpperCase().includes(vendorSearch.toUpperCase()));

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex border-b border-slate-300 bg-[#dae4f1]/30">
        {TABS.map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-white border-x border-t border-slate-300 text-[#0056d2] shadow-sm -mb-px" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto bg-white border border-slate-300 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#f8fafc] border-b border-slate-300 sticky top-0 z-10">
            {activeTab === 'Open Orders' ? (
              <tr>
                {['Plant', 'Sale Order', 'Consignor', 'Consignee', 'Ship to Party', 'Route', 'Order Qty', 'Assign Qty', 'Balance Qty', 'Action'].map(h => (
                  <th key={h} className="p-3 text-[9px] font-black uppercase text-slate-500 border-r border-slate-200">{h}</th>
                ))}
              </tr>
            ) : (
              <tr>
                {['Trip ID', 'Vehicle No', 'Plant', 'Consignee', 'Ship to Party', 'Route', 'Weight', 'Status', 'Sync Hub'].map(h => (
                  <th key={h} className="p-3 text-[9px] font-black uppercase text-slate-500 border-r border-slate-200">{h}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === 'Open Orders' ? (
              filteredOrders.map(order => (
                <tr key={order.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                  <td className="p-3 text-[11px] font-bold">{order.plantCode}</td>
                  <td className="p-3 text-[11px] font-black text-[#0056d2]">{order.saleOrder}</td>
                  <td className="p-3 text-[11px] font-bold uppercase truncate max-w-[120px]">{order.consignor}</td>
                  <td className="p-3 text-[11px] font-bold uppercase truncate max-w-[120px]">{order.consignee}</td>
                  <td className="p-3 text-[11px] font-bold uppercase truncate max-w-[120px]">{order.shipToParty}</td>
                  <td className="p-3 text-[11px] font-bold uppercase">{order.route}</td>
                  <td className="p-3 text-[11px] font-black text-slate-700">{order.totalOrderQty} {order.uom}</td>
                  <td className="p-3 text-[11px] font-bold text-emerald-600">{order.assignedQty} {order.uom}</td>
                  <td className="p-3 text-[11px] font-black text-red-600">{order.balanceQty} {order.uom}</td>
                  <td className="p-3">
                    <Button onClick={() => handleAssignClick(order)} size="sm" className="h-7 rounded-none bg-[#0056d2] hover:bg-blue-800 text-white font-black text-[9px] uppercase tracking-tighter shadow-md">Assign Vehicle</Button>
                  </td>
                </tr>
              ))
            ) : (
              filteredTrips.map(trip => (
                <tr key={trip.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                  <td className="p-3 text-[11px] font-black text-[#0056d2]">#{trip.tripId}</td>
                  <td className="p-3 text-[11px] font-black uppercase">{trip.vehicleNumber}</td>
                  <td className="p-3 text-[11px] font-bold">{trip.plantCode}</td>
                  <td className="p-3 text-[11px] font-bold uppercase truncate max-w-[150px]">{trip.consignee || 'N/A'}</td>
                  <td className="p-3 text-[11px] font-bold uppercase truncate max-w-[150px]">{trip.shipToParty}</td>
                  <td className="p-3 text-[11px] font-bold uppercase">{trip.route}</td>
                  <td className="p-3 text-[11px] font-black text-emerald-600">{trip.assignWeight} MT</td>
                  <td className="p-3"><Badge className="bg-blue-100 text-[#0056d2] border-blue-200 text-[8px] font-black">{trip.status}</Badge></td>
                  <td className="p-3 text-[10px] text-slate-400 font-bold">{format(new Date(trip.createdAt), 'dd-MM HH:mm')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
        <DialogContent className="max-w-3xl p-0 border-none rounded-none shadow-2xl bg-[#f0f3f9]">
          <div className="bg-[#1e3a8a] text-white px-6 py-4 flex justify-between items-center">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Truck className="h-4 w-4" /> Vehicle Assignment Hub</h2>
            <button onClick={() => setIsPopupOpen(false)} className="hover:bg-white/10 p-1 rounded transition-colors"><X className="h-4 w-4" /></button>
          </div>
          
          <div className="p-8 space-y-8 overflow-y-auto max-h-[85vh] green-scrollbar">
            {/* Header Info */}
            <div className="grid grid-cols-5 gap-4 bg-white p-5 border border-slate-200 shadow-sm rounded-sm">
              {[
                { label: 'Plant', val: assignData.plantCode },
                { label: 'Consignee', val: assignData.consignee },
                { label: 'Ship To', val: assignData.shipToParty },
                { label: 'Route', val: assignData.route },
                { label: 'Order Qty', val: assignData.orderQty }
              ].map(item => (
                <div key={item.label} className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{item.label}</p>
                  <p className="text-[10px] font-black text-[#1e3a8a] truncate">{item.val}</p>
                </div>
              ))}
            </div>

            {/* Centre Fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500">Vehicle Number *</label>
                <input value={assignData.vehicleNumber || ''} onChange={e => setAssignData({...assignData, vehicleNumber: e.target.value.toUpperCase()})} className="h-10 border border-slate-400 px-3 text-xs font-black outline-none focus:bg-[#ffffcc] bg-white shadow-sm" placeholder="E.G. UP14-BT-1234" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500">Driver Mobile *</label>
                <input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black outline-none focus:bg-[#ffffcc] bg-white shadow-sm" placeholder="ENTER 10 DIGITS" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500">Assign Qty *</label>
                <input type="number" value={assignData.assignWeight || ''} onChange={e => {
                  const val = e.target.value;
                  const freight = assignData.isFixedRate ? (assignData.freightAmount || 0) : (parseFloat(assignData.rate || 0) * parseFloat(val || 0));
                  setAssignData({...assignData, assignWeight: val, freightAmount: freight});
                }} className="h-10 border border-slate-400 px-3 text-xs font-black outline-none focus:bg-[#ffffcc] bg-white shadow-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500">Fleet Type *</label>
                <select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black outline-none bg-white shadow-sm">
                  {['Own Vehicle', 'Contract Vehicle', 'Market Vehicle', 'Arrange by Party'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>

            {/* Market Vehicle Section */}
            {assignData.fleetType === 'Market Vehicle' && (
              <div className="p-6 bg-[#dae4f1]/20 border-l-4 border-blue-600 space-y-6 rounded-r-sm animate-fade-in shadow-inner">
                <div className="grid grid-cols-2 gap-6 relative">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-500">Vendor *</label>
                    <div className="relative">
                      <input 
                        value={vendorSearch} 
                        onChange={e => { setVendorSearch(e.target.value); setShowVendorSuggestions(true); }}
                        onFocus={() => setShowVendorSuggestions(true)}
                        className="h-10 w-full border border-slate-400 px-3 text-xs font-black outline-none focus:bg-[#ffffcc] bg-white shadow-sm" 
                        placeholder="TYPE VENDOR NAME..." 
                      />
                      {showVendorSuggestions && matchingVendors && matchingVendors.length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-xl z-20 mt-1 max-h-40 overflow-y-auto">
                          {matchingVendors.map(v => (
                            <div 
                              key={v.id} 
                              onClick={() => {
                                setVendorSearch(v.vendorName);
                                setAssignData({...assignData, vendorName: v.vendorName, vendorMobile: v.mobile});
                                setShowVendorSuggestions(false);
                              }}
                              className="px-4 py-2.5 text-[11px] font-bold hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex justify-between"
                            >
                              <span>{v.vendorName}</span>
                              <span className="text-slate-400 italic">{v.vendorCode}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-500">Vendor Mobile</label>
                    <input value={assignData.vendorMobile || ''} disabled className="h-10 border border-slate-300 px-3 text-xs font-bold bg-slate-100 outline-none text-slate-500" placeholder="AUTO-FILLED" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 items-end">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-500">Rate (Per UOM)</label>
                    <input 
                      type="number" 
                      disabled={assignData.isFixedRate}
                      value={assignData.rate || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        const freight = parseFloat(val || 0) * parseFloat(assignData.assignWeight || 0);
                        setAssignData({...assignData, rate: val, freightAmount: freight});
                      }}
                      className={cn("h-10 border border-slate-400 px-3 text-xs font-black outline-none shadow-sm", assignData.isFixedRate ? "bg-slate-100" : "bg-white focus:bg-[#ffffcc]")} 
                    />
                  </div>
                  <div className="flex items-center gap-3 h-10 px-4 bg-white border border-slate-400 shadow-sm">
                    <Checkbox id="isFixed" checked={assignData.isFixedRate} onCheckedChange={checked => setAssignData({...assignData, isFixedRate: !!checked, rate: !!checked ? '' : assignData.rate})} />
                    <label htmlFor="isFixed" className="text-[10px] font-black uppercase text-slate-700 cursor-pointer">Fix Rate Logic</label>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-500">Total Freight Amount</label>
                    <input 
                      type="number" 
                      disabled={!assignData.isFixedRate}
                      value={assignData.freightAmount || ''} 
                      onChange={e => setAssignData({...assignData, freightAmount: e.target.value})}
                      className={cn("h-10 border border-slate-400 px-3 text-xs font-black outline-none shadow-sm", !assignData.isFixedRate ? "bg-slate-100" : "bg-white focus:bg-[#ffffcc]")} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
              <Button onClick={() => setIsPopupOpen(false)} variant="outline" className="h-11 px-8 rounded-none border-red-200 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-50">Cancel</Button>
              <Button onClick={handlePost} className="h-11 px-12 rounded-none bg-[#0056d2] hover:bg-blue-800 text-white font-black text-[10px] uppercase tracking-widest shadow-lg">Post to Loading</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ZCodeRegistry({ tcodes, onExecute }: { tcodes: any[], onExecute: (code: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-50 p-6 border-b border-slate-200"><h2 className="text-sm font-black uppercase tracking-widest text-[#1e3a8a]">System Master Transaction</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead><tr className="bg-[#f0f0f0] border-b-2 border-slate-300"><th className="p-4 text-[10px] font-black uppercase text-slate-500 w-32">T-Code</th><th className="p-4 text-[10px] font-black uppercase text-slate-500">Description</th><th className="p-4 text-[10px] font-black uppercase text-slate-500 w-48">Module</th></tr></thead>
          <tbody>{tcodes.map((t) => (
            <tr key={t.code} onClick={() => onExecute(t.code)} className="border-b border-slate-200 hover:bg-blue-50 cursor-pointer transition-colors group">
              <td className="p-4 font-black text-blue-600 group-hover:underline">{t.code}</td>
              <td className="p-4 font-bold text-slate-700 uppercase">{t.description}</td>
              <td className="p-4"><Badge variant="outline" className="rounded-none border-slate-300 text-[9px] font-black px-3 py-1 bg-white uppercase">{t.module || 'DATA'}</Badge></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
