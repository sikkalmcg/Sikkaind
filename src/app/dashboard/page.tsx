'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Printer, Save, X, Info, LogOut,
  ChevronRight, ChevronLeft, Truck, MapPin, User, Users, ShoppingBag,
  Grid2X2, CloudUpload, ShieldAlert, Edit3, 
  PlusSquare, XCircle, Calendar as CalendarIcon, Package, Undo2
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import placeholderData from '@/app/lib/placeholder-images.json';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'VA04' | 'TR21' | 'BULK' | 'SU01' | 'SU02' | 'SU03' | 'ZCODE';

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
  { code: 'BULK', description: 'BULK DATA HUB CONTROL', icon: CloudUpload, module: 'System' },
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
  const [printData, setPrintData] = React.useState<any>(null);
  const [cnPreviewData, setCnPreviewData] = React.useState<any>(null);
  
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL');
  const [homeMonthFilter, setHomeMonthFilter] = React.useState(format(new Date(), 'yyyy-MM'));
  const [showMonthCalendar, setShowMonthCalendar] = React.useState(false);
  const [sessionCount, setSessionCount] = React.useState(1);
  const tCodeRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLDivElement>(null);

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
    if (activeScreen.startsWith('XD')) return rawCustomers || [];
    if (activeScreen.startsWith('VA')) return rawOrders || [];
    if (activeScreen.startsWith('SU')) return allUsers || [];
    return [];
  }, [activeScreen, rawPlants, rawCompanies, rawVendors, rawCustomers, rawOrders, allUsers]);

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
        (i.plantCode || i.customerCode || i.companyCode || i.saleOrder || i.username || i.id).toString().toUpperCase() === searchId.toUpperCase()
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
    if (activeScreen === 'VA04') {
      if (!formData.saleOrder || !formData.reason) {
        setStatusMsg({ text: 'Error: Sales Order & Reason are mandatory', type: 'error' });
        return;
      }
      const orderToCancel = rawOrders?.find(o => (o.saleOrder || o.id)?.toString().toUpperCase() === formData.saleOrder.toString().toUpperCase());
      if (!orderToCancel) {
        setStatusMsg({ text: `Error: Order ${formData.saleOrder} not found`, type: 'error' });
        return;
      }
      const docRef = doc(db, 'users', user.uid, 'sales_orders', orderToCancel.id);
      setDocumentNonBlocking(docRef, { status: 'CANCELLED', cancellationReason: formData.reason, updatedAt: new Date().toISOString() }, { merge: true });
      setStatusMsg({ text: `Success: Order ${formData.saleOrder} CANCELLED`, type: 'success' });
      setFormData({});
      return;
    }

    let collectionName = '';
    const docId = formData.id || crypto.randomUUID();
    if (activeScreen.startsWith('OX')) collectionName = 'plants';
    else if (activeScreen.startsWith('FM')) collectionName = 'companies';
    else if (activeScreen.startsWith('XK')) collectionName = 'vendors';
    else if (activeScreen.startsWith('XD')) collectionName = 'customers';
    else if (activeScreen.startsWith('VA')) collectionName = 'sales_orders';
    else if (activeScreen.startsWith('SU')) collectionName = 'user_registry';

    if (collectionName) {
      const isSystemUser = collectionName === 'user_registry';
      const docRef = isSystemUser ? doc(db, 'user_registry', docId) : doc(db, 'users', user.uid, collectionName, docId);
      const payload = { ...formData, id: docId, updatedAt: new Date().toISOString() };
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
  const hideSidebar = activeScreen.startsWith('OX') || activeScreen.startsWith('FM') || activeScreen === 'ZCODE' || activeScreen === 'BULK';

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
              {MASTER_TCODES.filter(t => t.code.endsWith('01') || t.code === 'TR21' || t.code === 'VA04' || t.code === 'BULK' || t.code === 'ZCODE').map((item) => (
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
                      {rawPlants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}
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
                     {activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                     {activeScreen.startsWith('VA') && activeScreen !== 'VA04' && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} allCustomers={rawCustomers} />}
                     {activeScreen === 'VA04' && <CancelOrderForm data={formData} onChange={setFormData} allOrders={rawOrders} onPost={handleSave} onCancel={() => setFormData({})} />}
                     {activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                   </div>
                 )}
                 {showList && (
                   <div className="space-y-6">
                     <div className="bg-[#dae4f1]/30 p-4 border border-slate-300">
                        <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">
                           Enter {activeScreen.startsWith('OX') ? 'Plant' : activeScreen.startsWith('FM') ? 'Company' : 'ID'} & Press Enter
                        </label>
                        <input 
                           className="h-10 w-full max-w-md border border-slate-400 px-4 text-xs font-black outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                           value={searchId} onChange={(e) => setSearchId(e.target.value)} onKeyDown={handleSearchIdEnter} placeholder="ENTER CODE..."
                        />
                     </div>
                     <RegistryList onSelectItem={setFormData} listData={getRegistryList()} />
                   </div>
                 )}
                 {activeScreen === 'TR21' && <DripBoard orders={rawOrders} trips={allTrips} onStatusUpdate={setStatusMsg} plants={rawPlants} onPrintLR={setPrintData} onPrintCN={setCnPreviewData} />}
                 {activeScreen === 'BULK' && <BulkDataHub allPlants={rawPlants} onStatusUpdate={setStatusMsg} />}
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
          {statusMsg.text !== 'Ready' && <><span className="text-slate-400">|</span><span className="text-blue-400">EVENT: {statusMsg.text}</span></>}
        </div>
      </div>

      <Dialog open={!!printData} onOpenChange={() => setPrintData(null)}>
        <DialogContent className="max-w-4xl p-0 border-none bg-slate-800"><LRPrintTemplate trip={printData?.trip} order={printData?.order} onPrint={() => { window.print(); setPrintData(null); }} /></DialogContent>
      </Dialog>
      <Dialog open={!!cnPreviewData} onOpenChange={() => setCnPreviewData(null)}>
        <DialogContent className="max-w-5xl p-0 border-none bg-slate-800"><CNPrintTemplate trip={cnPreviewData?.trip} order={cnPreviewData?.order} onPrint={() => { window.print(); setCnPreviewData(null); }} /></DialogContent>
      </Dialog>
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
      <SectionGrouping title="">
        <FormInput label="PLANT CODE" value={data.plantCode} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="SETTINGS / ">
        <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
        <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
        <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
        <FormInput label="STATE" value={data.state} onChange={(v: string) => onChange({...data, state: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function CompanyForm({ data, onChange, disabled, allPlants }: any) {
  const plantOpts = (allPlants || []).map((p: any) => ({ value: p.plantCode, label: `${p.plantCode} - ${p.plantName}` }));
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
      </SectionGrouping>

      <SectionGrouping title="TAX & CONTACT">
        <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
        <FormInput label="PAN" value={data.pan} onChange={(v: string) => onChange({...data, pan: v})} disabled={disabled} />
        <FormInput label="MOBILE (COMMA SEPARATED)" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} placeholder="e.g. 9876543210, 8765432109" />
        <FormInput label="EMAIL" value={data.email} onChange={(v: string) => onChange({...data, email: v})} disabled={disabled} />
        <FormInput label="WEBSITE" value={data.website} onChange={(v: string) => onChange({...data, website: v})} disabled={disabled} />
      </SectionGrouping>

      <SectionGrouping title="LOGO">
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
      <SectionGrouping title="">
        <FormInput label="VENDOR NAME" value={data.vendorName} onChange={(v: string) => onChange({...data, vendorName: v})} disabled={disabled} />
        <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function CustomerForm({ data, onChange, disabled }: any) {
  return (
    <div className="space-y-4">
      <SectionGrouping title="">
        <FormInput label="CUSTOMER CODE" value={data.customerCode} onChange={(v: string) => onChange({...data, customerCode: v})} disabled={disabled} />
        <FormInput label="CUSTOMER NAME" value={data.customerName} onChange={(v: string) => onChange({...data, customerName: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="ROLE">
        <RadioGroup value={data.customerType || 'Consignor'} onValueChange={(v) => onChange({...data, customerType: v})} disabled={disabled} className="flex gap-6 mt-1">
          <div className="flex items-center space-x-2"><RadioGroupItem value="Consignor" id="con" /><Label htmlFor="con">Consignor</Label></div>
          <div className="flex items-center space-x-2"><RadioGroupItem value="Consignee" id="cee" /><Label htmlFor="cee">Consignee</Label></div>
        </RadioGroup>
      </SectionGrouping>
    </div>
  );
}

function SalesOrderForm({ data, onChange, disabled, allPlants, allCustomers }: any) {
  const plantOpts = (allPlants || []).map((p: any) => p.plantCode);
  const consignors = Array.from(new Set((allCustomers || []).filter((c: any) => c.customerType === 'Consignor').map((c: any) => c.customerName)));
  const consignees = Array.from(new Set((allCustomers || []).filter((c: any) => c.customerType === 'Consignee').map((c: any) => c.customerName)));
  return (
    <div className="space-y-4">
      <SectionGrouping title="">
        <FormSelect label="PLANT CODE" value={data.plantCode} options={plantOpts} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
        <FormInput label="SALE ORDER NO" value={data.saleOrder} onChange={(v: string) => onChange({...data, saleOrder: v})} disabled={disabled} />
        <FormInput label="LR NO" value={data.lrNo} onChange={(v: string) => onChange({...data, lrNo: v})} disabled={disabled} />
        <FormInput label="LR DATE" value={data.lrDate} type="date" onChange={(v: string) => onChange({...data, lrDate: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="COORDINATION">
        <FormSelect label="CONSIGNOR" value={data.consignor} options={consignors} onChange={(v: string) => onChange({...data, consignor: v})} disabled={disabled} />
        <FormSelect label="CONSIGNEE" value={data.consignee} options={consignees} onChange={(v: string) => onChange({...data, consignee: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function CancelOrderForm({ data, onChange, allOrders, onPost, onCancel }: any) {
  return (
    <div className="space-y-8">
      <SectionGrouping title="">
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
      <SectionGrouping title="">
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
          <tr key={item.id} onClick={() => onSelectItem(item)} className="border-b border-slate-200 hover:bg-[#e8f0fe] cursor-pointer transition-colors"><td className="p-3 text-[11px] font-black text-[#0056d2]">{item.saleOrder || item.plantCode || item.customerCode || item.id.slice(0, 8)}</td><td className="p-3 text-[11px] font-bold uppercase">{item.customerName || item.plantName || `${item.consignor} → ${item.consignee}`}</td><td className="p-3 text-[11px] italic text-slate-500">{item.city || item.customerType || 'DATA'}</td><td className="p-3 text-[11px] font-bold text-slate-400">{format(new Date(item.updatedAt || new Date()), 'dd-MM-yyyy')}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function DripBoard({ orders, trips, onStatusUpdate, plants, onPrintLR, onPrintCN }: any) {
  const { user } = useUser();
  const db = useFirestore();
  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);

  const handleAssign = (vehicleNo: string, weight: string) => {
    if (!user || !selectedOrder) return;
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    const newId = crypto.randomUUID();
    const payload = { id: newId, tripId, saleOrderId: selectedOrder.id, saleOrder: selectedOrder.saleOrder, plantCode: selectedOrder.plantCode, vehicleNumber: vehicleNo, assignWeight: parseFloat(weight), status: 'LOADING', createdAt: new Date().toISOString() };
    setDocumentNonBlocking(doc(db, 'users', user.uid, 'trips', newId), payload, { merge: true });
    setSelectedOrder(null);
    onStatusUpdate({ text: `${tripId} created`, type: 'success' });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4"><select className="bg-white border border-slate-400 h-9 px-4 font-bold text-xs outline-none shadow-sm" value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)}><option value="ALL">ALL PLANTS</option>{plants?.map((p: any) => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}</select></div>
      <div className="bg-white border border-slate-300 p-8 shadow-sm">
        <h3 className="text-sm font-black uppercase text-[#1e3a8a] mb-6">Active Trips Hub</h3>
        <div className="space-y-4">
          {trips?.filter((t: any) => plantFilter === 'ALL' || t.plantCode === plantFilter).map((t: any) => (
            <div key={t.id} className="flex justify-between items-center p-4 border border-slate-200 bg-slate-50">
              <span className="font-black text-xs text-[#0056d2]">#{t.tripId}</span>
              <span className="text-[10px] font-bold uppercase">{t.vehicleNumber}</span>
              <Badge className="bg-blue-600 text-white font-black uppercase text-[8px]">{t.status}</Badge>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="p-8"><DialogTitle>Assign Vehicle</DialogTitle><Button onClick={() => handleAssign('UP14-TEST', '20')} className="bg-[#0056d2] text-white font-black uppercase text-[10px] px-8 h-12 rounded-none shadow-lg">Initiate</Button></DialogContent>
      </Dialog>
    </div>
  );
}

function BulkDataHub({ allPlants, onStatusUpdate }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-7xl mx-auto p-4">
      <div className="bg-white rounded-sm shadow-xl border border-slate-300 overflow-hidden flex flex-col">
        <div className="bg-[#1e293b] p-6 text-white font-black uppercase italic text-sm tracking-widest">Template Repository</div>
        <div className="p-10 space-y-6 flex-1 bg-slate-50/30">
          {['Customer Master', 'Sales Order Master'].map(t => <button key={t} onClick={() => onStatusUpdate({ text: `Template ${t} exported`, type: 'info' })} className="w-full flex justify-between items-center p-5 bg-white border border-slate-300 rounded-none hover:bg-blue-50 transition-colors text-[11px] font-black uppercase tracking-tight">{t} <CloudUpload className="h-5 w-5 text-[#0056d2]" /></button>)}
        </div>
      </div>
      <div className="bg-white rounded-sm shadow-xl border border-slate-300 overflow-hidden flex flex-col">
        <div className="bg-[#0056d2] p-6 text-white font-black uppercase italic text-sm tracking-widest">Sync Control</div>
        <div className="p-10 space-y-8 flex-1">
          <Button onClick={() => onStatusUpdate({ text: "Bulk Sync started", type: 'info' })} className="w-full h-16 bg-blue-900 text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-none shadow-xl">Initiate Bulk Sync</Button>
        </div>
      </div>
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

function CNPrintTemplate({ trip, order, onPrint }: any) {
  return (
    <div className="w-full p-12 bg-white min-h-[297mm] flex flex-col box-border border-4 border-black/5">
      <div className="flex justify-between items-start border-b-2 border-black pb-8 mb-8">
        <h1 className="text-3xl font-black uppercase italic">Consignment Note</h1>
        <Button onClick={onPrint} className="bg-blue-600 text-white font-black uppercase text-[10px]">Confirm & Print</Button>
      </div>
      <div className="p-8 border-2 border-black space-y-4">
        <p className="font-black">Trip ID: {trip?.tripId || 'N/A'}</p>
        <p className="font-black">Consignor: {trip?.consignor || 'N/A'}</p>
        <p className="font-black">Consignee: {trip?.consignee || 'N/A'}</p>
      </div>
    </div>
  );
}

function LRPrintTemplate({ trip, order, onPrint }: any) {
  return (
    <div className="w-full p-12 bg-white min-h-[297mm] flex flex-col box-border border-4 border-black/5">
      <div className="flex justify-between items-start border-b-2 border-black pb-8 mb-8">
        <h1 className="text-3xl font-black uppercase italic">Lorry Receipt</h1>
        <Button onClick={onPrint} className="bg-blue-600 text-white font-black uppercase text-[10px]">Confirm & Print</Button>
      </div>
      <div className="p-8 border-2 border-black space-y-4">
        <p className="font-black">LR No: {trip?.lrNo || 'N/A'}</p>
        <p className="font-black">Vehicle: {trip?.vehicleNumber || 'N/A'}</p>
      </div>
    </div>
  );
}
