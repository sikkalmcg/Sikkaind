'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, RotateCcw, X, HelpCircle, LogOut,
  ChevronRight, Check, AlertCircle, Info, PlusCircle, Trash2,
  Grid2X2, Upload, Download, ShoppingBag, ArrowUpRight,
  Filter, Truck, MapPin, User, DollarSign, Activity,
  Layers, PackageCheck, Ban, Lock, Play, XCircle, Search,
  ArrowRight, Calendar, Phone, FileText, Package, Clock,
  LayoutDashboard, Database, Settings, BarChart
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
  useDoc,
  useMemoFirebase,
  setDocumentNonBlocking 
} from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'TR21' | 'BULK' | 'SU01' | 'SU02' | 'SU03';

const MASTER_TCODES = [
  { code: 'OX01', description: 'PLANT MASTER: CREATE INITIAL SCREEN' },
  { code: 'OX02', description: 'PLANT MASTER: CHANGE REGISTRY' },
  { code: 'OX03', description: 'PLANT MASTER: DISPLAY NODE' },
  { code: 'FM01', description: 'COMPANY MASTER: CREATE INITIAL SCREEN' },
  { code: 'FM02', description: 'COMPANY MASTER: CHANGE REGISTRY' },
  { code: 'FM03', description: 'COMPANY MASTER: DISPLAY NODE' },
  { code: 'XK01', description: 'VENDOR MASTER: CREATE INITIAL SCREEN' },
  { code: 'XK02', description: 'VENDOR MASTER: CHANGE REGISTRY' },
  { code: 'XK03', description: 'VENDOR MASTER: DISPLAY NODE' },
  { code: 'XD01', description: 'CUSTOMER MASTER: CREATE INITIAL SCREEN' },
  { code: 'XD02', description: 'CUSTOMER MASTER: CHANGE REGISTRY' },
  { code: 'XD03', description: 'CUSTOMER MASTER: DISPLAY NODE' },
  { code: 'VA01', description: 'SALES ORDER REGISTRY: CREATE INITIAL SCREEN' },
  { code: 'VA02', description: 'SALES ORDER REGISTRY: CHANGE NODE' },
  { code: 'VA03', description: 'SALES ORDER REGISTRY: DISPLAY NODE' },
  { code: 'TR21', description: 'DRIP BOARD REGISTRY CONTROL' },
  { code: 'BULK', description: 'BULK DATA HUB CONTROL' },
  { code: 'SU01', description: 'USER MANAGEMENT: CREATE INITIAL SCREEN' },
  { code: 'SU02', description: 'USER MANAGEMENT: CHANGE REGISTRY' },
  { code: 'SU03', description: 'USER MANAGEMENT: DISPLAY NODE' },
];

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

  const profileRef = useMemoFirebase(() => user ? doc(db, 'user_registry', user.uid) : null, [user, db]);
  const { data: userProfile } = useDoc(profileRef);

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

  const recentOrders = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawOrders;
    return rawOrders?.filter(o => authPlants.includes(o.plantCode));
  }, [rawOrders, userProfile]);

  const allTrips = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawTrips;
    return rawTrips?.filter(t => authPlants.includes(t.plantCode));
  }, [rawTrips, userProfile]);

  const allPlants = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawPlants;
    return rawPlants?.filter(p => authPlants.includes(p.plantCode));
  }, [rawPlants, userProfile]);

  const allCompanies = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawCompanies;
    return rawCompanies?.filter(c => authPlants.includes(c.plantCode));
  }, [rawCompanies, userProfile]);

  const allVendors = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawVendors;
    return rawVendors?.filter(v => v.plantCodes?.some((p: string) => authPlants.includes(p)));
  }, [rawVendors, userProfile]);

  const allCustomers = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawCustomers;
    return rawCustomers?.filter(c => c.plantCodes?.some((p: string) => authPlants.includes(p)));
  }, [rawCustomers, userProfile]);

  const handleSave = () => {
    if (!user) {
      setStatusMsg({ text: 'Session error: Please log in again', type: 'error' });
      return;
    }
    
    const isDisplayOnly = activeScreen.endsWith('03');
    if (isDisplayOnly) {
      setStatusMsg({ text: 'Display mode: Changes not allowed', type: 'info' });
      return;
    }

    if (activeScreen === 'HOME' || activeScreen === 'BULK' || activeScreen === 'TR21' || ((activeScreen.endsWith('02') || activeScreen.endsWith('03')) && !formData.id)) {
      setStatusMsg({ text: 'No active transaction to save', type: 'info' });
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
      const docRef = isSystemUser 
        ? doc(db, 'user_registry', docId)
        : doc(db, 'users', user.uid, collectionName, docId);

      const payload = { 
        ...formData, 
        id: docId, 
        updatedAt: new Date().toISOString() 
      };

      if (isSystemUser) {
        const tcodes = payload.tcodes || [];
        const expandedTcodes = [...tcodes];
        tcodes.forEach((code: string) => {
          if (code.endsWith('01')) {
            const prefix = code.slice(0, 2);
            ['02', '03'].forEach(suffix => {
              if (!expandedTcodes.includes(prefix + suffix)) {
                expandedTcodes.push(prefix + suffix);
              }
            });
          }
        });
        payload.tcodes = Array.from(new Set(expandedTcodes));
      }
      
      setDocumentNonBlocking(docRef, payload, { merge: true });
      
      if (collectionName === 'sales_orders' && (payload.saleOrder || payload.saleOrderNumber)) {
        const cleanSo = (payload.saleOrder || payload.saleOrderNumber).toString().trim().toUpperCase();
        const publicRef = doc(db, 'public_orders', cleanSo);
        
        const totalQty = (payload.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.weight) || 0), 0);
        const uom = payload.items?.[0]?.weightUom || 'MT';
        const routeStr = (payload.from && payload.destination) ? `${payload.from.toUpperCase()}--${payload.destination.toUpperCase()}` : '';

        setDocumentNonBlocking(publicRef, {
          type: 'order',
          status: payload.status || 'PLACED',
          saleOrder: cleanSo,
          saleOrderNumber: cleanSo,
          consignor: payload.consignor || '',
          consignee: payload.consignee || '',
          shipToParty: payload.shipToParty || '',
          route: routeStr,
          orderQty: `${totalQty} ${uom}`,
          destination: payload.destination || '',
          delayRemark: payload.delayRemark || '',
          updatedAt: payload.updatedAt
        }, { merge: true });
      }

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
    
    if (cleanCode === 'HOME' || cleanCode === '') {
      setActiveScreen('HOME');
      setStatusMsg({ text: 'Main Hub', type: 'none' });
      setTCode('');
      return;
    }

    if (!isAuthorized(cleanCode)) {
      setStatusMsg({ text: `You have not authorized for access T code ${cleanCode}`, type: 'error' });
      setTCode('');
      return;
    }

    const validCodes = MASTER_TCODES.map(t => t.code);
    
    if (validCodes.includes(cleanCode)) {
      setActiveScreen(cleanCode as Screen);
      setFormData({});
      setStatusMsg({ text: `Transaction ${cleanCode} started`, type: 'info' });
    }
    setTCode('');
  };

  const handleCancel = () => {
    setFormData({});
    if (activeScreen.endsWith('02') || activeScreen.endsWith('03')) {
    } else {
      setActiveScreen('HOME');
    }
  };

  const getScreenTitle = (code: Screen) => {
    return MASTER_TCODES.find(t => t.code === code)?.description || '';
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
  const showList = (activeScreen.endsWith('02') || activeScreen.endsWith('03')) && !formData.id;
  const showForm = activeScreen.endsWith('01') || ((activeScreen.endsWith('02') || activeScreen.endsWith('03')) && formData.id);
  const isReadOnly = activeScreen.endsWith('03');

  const getRegistryList = () => {
    if (activeScreen.startsWith('OX')) return allPlants;
    if (activeScreen.startsWith('FM')) return allCompanies;
    if (activeScreen.startsWith('XK')) return allVendors;
    if (activeScreen.startsWith('XD')) return allCustomers;
    if (activeScreen.startsWith('VA')) return recentOrders;
    if (activeScreen.startsWith('SU')) return allUsers;
    return [];
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-full bg-[#d9e1f2] text-[#333] font-mono select-none overflow-hidden">
        {/* TOP BAR */}
        <div className="flex items-center bg-[#f0f0f0] border-b border-white/50 px-2 h-7 text-[11px] font-semibold z-50">
          <DropdownMenu>
            <DropdownMenuTrigger className="px-3 hover:bg-[#0056d2] hover:text-white outline-none transition-colors h-full flex items-center">
              Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white rounded-none border-slate-300 shadow-xl text-[11px] p-0 min-w-[150px]">
              <DropdownMenuItem onClick={() => setActiveScreen('HOME')} className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4">Home (/n)</DropdownMenuItem>
              <DropdownMenuSeparator className="m-0 bg-slate-200" />
              <DropdownMenuItem onClick={handleSave} className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4">Save (Ctrl+S)</DropdownMenuItem>
              <DropdownMenuSeparator className="m-0 bg-slate-200" />
              <DropdownMenuItem onClick={handleLogout} className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4 text-red-600">Log Off</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {['Edit', 'Favorites', 'Extras', 'System', 'Help'].map((item) => (
            <div key={item} className="px-3 hover:bg-[#0056d2] hover:text-white transition-colors h-full flex items-center cursor-pointer">
              {item}
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 pr-4 text-[10px] text-slate-500 font-bold uppercase">
            <span>S4P (1) 100</span>
            <div className="flex items-center gap-1 ml-4 text-[#0056d2] cursor-pointer" onClick={handleLogout}>
               <LogOut className="h-3 w-3" />
               <span>Log Off</span>
            </div>
          </div>
        </div>

        {/* T-CODE COMMAND BAR */}
        <div className="flex flex-col bg-[#f0f0f0] border-b border-slate-300 shadow-sm z-40">
          <div className="flex items-center px-2 py-1 gap-2">
            <SidebarTrigger className="h-6 w-6 text-slate-600 hover:bg-slate-200 rounded" />
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
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* DASHBOARD SIDEBAR - THEMED TO MATCH REFERENCE */}
          <Sidebar collapsible="icon" className="border-r border-slate-300 bg-sidebar">
            <SidebarHeader className="bg-[#1e293b] text-white p-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="font-black text-lg italic">S</span>
                </div>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <span className="text-[10px] font-black uppercase tracking-tighter text-white">Sikka Hub</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Registry V2.5</span>
                </div>
              </div>
            </SidebarHeader>
            <SidebarContent className="custom-scrollbar">
              <SidebarMenu>
                <div className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest group-data-[collapsible=icon]:hidden opacity-60">Main Registry</div>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveScreen('HOME')} isActive={activeScreen === 'HOME'}>
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Home Hub (/n)</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                <div className="px-4 py-3 mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest group-data-[collapsible=icon]:hidden opacity-60">Master Data</div>
                {[
                  { icon: Database, label: "Plant Master (OX01)", code: "OX01" },
                  { icon: Database, label: "Company Master (FM01)", code: "FM01" },
                  { icon: User, label: "Vendor Master (XK01)", code: "XK01" },
                  { icon: User, label: "Customer Master (XD01)", code: "XD01" },
                ].map((item) => (
                  <SidebarMenuItem key={item.code}>
                    <SidebarMenuButton onClick={() => executeTCode(item.code)} isActive={activeScreen.startsWith(item.code.slice(0, 2))}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                <div className="px-4 py-3 mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest group-data-[collapsible=icon]:hidden opacity-60">Logistics</div>
                {[
                  { icon: ShoppingBag, label: "Sales Orders (VA01)", code: "VA01" },
                  { icon: Truck, label: "Drip Board (TR21)", code: "TR21" },
                  { icon: BarChart, label: "Bulk Data Hub (BULK)", code: "BULK" },
                ].map((item) => (
                  <SidebarMenuItem key={item.code}>
                    <SidebarMenuButton onClick={() => executeTCode(item.code)} isActive={activeScreen === item.code}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                <div className="px-4 py-3 mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest group-data-[collapsible=icon]:hidden opacity-60">System</div>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => executeTCode("SU01")} isActive={activeScreen.startsWith("SU")}>
                    <Settings className="h-4 w-4" />
                    <span>User Registry (SU01)</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="bg-slate-50 border-t border-slate-200">
               <div className="p-2 group-data-[collapsible=icon]:p-0">
                  <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-3 h-9 text-red-600 hover:text-red-700 hover:bg-red-50 group-data-[collapsible=icon]:px-2">
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden text-[10px] font-black uppercase">Sign Out</span>
                  </Button>
               </div>
            </SidebarFooter>
          </Sidebar>

          {/* MAIN CONTENT AREA */}
          <SidebarInset className="flex flex-col overflow-hidden bg-[#f0f3f9]">
            <div className="bg-[#0056d2] text-white py-2 px-6 shadow-lg flex flex-col items-center justify-center min-h-[60px] shrink-0">
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-center">
                Sikka Logistics Hub
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] mt-1 text-center text-blue-100">
                Central Management Hub
              </p>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className={`p-8 w-full ${isModuleActive ? 'max-w-none' : 'max-w-[1400px]'} mx-auto`}>
                {activeScreen === 'HOME' ? (
                  <div className="space-y-12 animate-fade-in">
                    {/* RECENT SALES ORDER REGISTRY */}
                    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
                       <div className="bg-[#1e293b] px-10 py-6 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <ShoppingBag className="h-6 w-6 text-blue-400" />
                            <h2 className="text-sm font-black uppercase text-white tracking-[0.2em] italic">Recent Sales Order Registry</h2>
                          </div>
                          <Badge className="bg-[#0056d2] text-white border-none rounded-lg px-6 py-1.5 font-black italic tracking-widest text-[10px]">NODE ACTIVITY</Badge>
                       </div>
                       <div className="overflow-x-auto p-4">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b-2 border-slate-100">
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">SO Number</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Consignor</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Destination</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date</th>
                                <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recentOrders?.slice(0, 5).map((order) => (
                                <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => { setFormData(order); setActiveScreen('VA03'); }}>
                                  <td className="p-6 font-black text-sm text-[#0056d2]">{order.saleOrder || order.saleOrderNumber}</td>
                                  <td className="p-6 font-bold text-[11px] text-slate-600 uppercase tracking-tight">{order.consignor}</td>
                                  <td className="p-6 font-black italic text-[11px] text-[#64748b] uppercase">{order.destination}</td>
                                  <td className="p-6 font-bold text-[11px] text-slate-400">{order.saleOrderDate ? format(new Date(order.saleOrderDate), 'dd-MM-yyyy') : '--'}</td>
                                  <td className="p-6 text-center">
                                    <div className="flex items-center justify-center gap-2 text-emerald-500">
                                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                       <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                       </div>
                    </div>

                    {/* T-CODE CARDS GRID - 3 COLUMNS PER REQUEST */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                      {['OX01', 'FM01', 'XK01', 'XD01', 'VA01', 'TR21', 'SU01'].map((code) => (
                        <div 
                          key={code} 
                          onClick={() => executeTCode(code)} 
                          className="bg-white p-6 rounded-[1.5rem] shadow-lg border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col min-h-[220px]"
                        >
                          <div className="flex items-center justify-between mb-6">
                            <Badge className="bg-[#e8f0fe] text-[#0056d2] rounded-none px-4 py-1.5 font-black italic tracking-widest text-[10px] border-none shadow-sm">{code}</Badge>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#0056d2] group-hover:translate-x-1 transition-all" />
                          </div>
                          <div className="flex-1 flex flex-col justify-start">
                             <h3 className="text-[12px] font-black text-[#1e3a8a] leading-[1.6] uppercase tracking-wider">
                               {getScreenTitle(code as Screen).split(' ').map((word, i) => (
                                 <span key={i} className="block">{word}</span>
                               ))}
                             </h3>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white shadow-2xl rounded-sm border border-slate-300 overflow-hidden animate-slide-up w-full">
                     <div className="h-1 bg-yellow-500 w-full" />
                     <div className="p-1 min-h-[600px] bg-[#fdfdfd] flex flex-col">
                       {showList && (
                         <div className="bg-[#e9f0f8] p-4 border-b border-slate-300 mb-6">
                            <div className="flex items-center gap-6 max-w-2xl">
                               <label className="text-xs font-bold text-slate-600 w-32">Selection Registry</label>
                               <select 
                                className="flex-1 h-8 bg-white border border-slate-400 px-2 text-xs outline-none"
                                onChange={(e) => {
                                  const selected = getRegistryList()?.find(i => i.id === e.target.value);
                                  if (selected) setFormData(selected);
                                }}
                               >
                                <option value="">Select Registry Item...</option>
                                {getRegistryList()?.map(item => (
                                  <option key={item.id} value={item.id}>
                                    {item.username || item.saleOrder || item.saleOrderNumber || item.customerCode || item.plantCode || item.companyCode || item.id.slice(0, 8)} - {item.fullName || item.consignor || item.plantName || item.companyName || item.vendorName || item.customerName}
                                  </option>
                                ))}
                               </select>
                            </div>
                         </div>
                       )}
                       <div className="p-4 space-y-6">
                         {showForm && (
                           <>
                             {activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                             {activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                             {activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                             {activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                             {activeScreen.startsWith('VA') && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                             {activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                           </>
                         )}
                         {showList && (
                           <div className="space-y-4">
                             <h3 className="text-[10px] font-bold uppercase bg-[#dae4f1] px-4 py-1 border-y border-slate-300 text-[#1e3a8a]">Selection List</h3>
                             <RegistryList screen={activeScreen} onSelectItem={setFormData} listData={getRegistryList()} />
                           </div>
                         )}
                         {activeScreen === 'TR21' && <DripBoard orders={recentOrders} trips={allTrips} onStatusUpdate={setStatusMsg} plants={allPlants} />}
                       </div>
                     </div>
                  </div>
                )}
              </div>
            </div>

            {/* STATUS FOOTER BAR */}
            <div className="h-6 bg-[#f0f0f0] border-t border-slate-300 flex items-center px-4 gap-6 text-[10px] font-bold text-slate-600 print:hidden shrink-0">
              <div className="flex items-center gap-2 pr-6 border-r border-slate-200 min-w-[250px]">
                {statusMsg.type === 'success' && <Check className="h-3 w-3 text-emerald-500" />}
                {statusMsg.type === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
                {statusMsg.type === 'info' && <Info className="h-3 w-3 text-blue-500" />}
                <span className={statusMsg.type === 'error' ? 'text-red-600' : ''}>{statusMsg.text}</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] uppercase tracking-widest text-emerald-600">Synced</span>
              </div>
            </div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Helper components remain the same
function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-[10px] font-black uppercase tracking-widest bg-[#dae4f1] border-y border-slate-300 px-4 py-1 text-[#1e3a8a]">
      {title}
    </h3>
  );
}

function DetailRow({ label, value }: { label: string, value?: string | number }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-1 border-b border-slate-50 last:border-none">
      <span className="text-[9px] font-black uppercase text-slate-400">{label}</span>
      <span className="col-span-2 text-[10px] font-bold text-slate-700 uppercase">{value || '--'}</span>
    </div>
  );
}

function PlantForm({ data, onChange, disabled }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
      <FormInput label="Plant Code" value={data.plantCode} onChange={(v) => onChange({...data, plantCode: v})} disabled={disabled} />
      <FormInput label="Plant Name" value={data.plantName} onChange={(v) => onChange({...data, plantName: v})} disabled={disabled} />
      <FormInput label="City" value={data.city} onChange={(v) => onChange({...data, city: v})} disabled={disabled} />
      <FormInput label="State" value={data.state} onChange={(v) => onChange({...data, state: v})} disabled={disabled} />
      <FormInput label="GSTIN" value={data.gstin} onChange={(v) => onChange({...data, gstin: v})} disabled={disabled} />
      <FormInput label="Address" value={data.address} onChange={(v) => onChange({...data, address: v})} disabled={disabled} />
    </div>
  );
}

function CompanyForm({ data, onChange, disabled }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
      <FormInput label="Company Code" value={data.companyCode} onChange={(v) => onChange({...data, companyCode: v})} disabled={disabled} />
      <FormInput label="Company Name" value={data.companyName} onChange={(v) => onChange({...data, companyName: v})} disabled={disabled} />
      <FormInput label="Address" value={data.address} onChange={(v) => onChange({...data, address: v})} disabled={disabled} />
      <FormInput label="GSTIN" value={data.gstin} onChange={(v) => onChange({...data, gstin: v})} disabled={disabled} />
    </div>
  );
}

function VendorForm({ data, onChange, disabled }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
      <FormInput label="Vendor Name" value={data.vendorName} onChange={(v) => onChange({...data, vendorName: v})} disabled={disabled} />
      <FormInput label="Mobile" value={data.mobile} onChange={(v) => onChange({...data, mobile: v})} disabled={disabled} />
      <FormInput label="PAN" value={data.pan} onChange={(v) => onChange({...data, pan: v})} disabled={disabled} />
      <FormInput label="GSTIN" value={data.gstin} onChange={(v) => onChange({...data, gstin: v})} disabled={disabled} />
    </div>
  );
}

function CustomerForm({ data, onChange, disabled }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
      <FormInput label="Customer Code" value={data.customerCode} onChange={(v) => onChange({...data, customerCode: v})} disabled={disabled} />
      <FormInput label="Customer Name" value={data.customerName} onChange={(v) => onChange({...data, customerName: v})} disabled={disabled} />
      <FormInput label="City" value={data.city} onChange={(v) => onChange({...data, city: v})} disabled={disabled} />
      <FormInput label="Mobile" value={data.mobile} onChange={(v) => onChange({...data, mobile: v})} disabled={disabled} />
      <FormSelect label="Type" value={data.customerType} options={['Consignor', 'Consignee']} onChange={(v) => onChange({...data, customerType: v})} disabled={disabled} />
    </div>
  );
}

function SalesOrderForm({ data, onChange, disabled }: any) {
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    if (!data.id) {
      const timer = setInterval(() => setTime(new Date()), 1000);
      return () => clearInterval(timer);
    }
  }, [data.id]);

  const currentTimeStr = format(time, 'dd-MM-yyyy HH:mm:ss');

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
        <FormInput label="Plant Code" value={data.plantCode} onChange={(v) => onChange({...data, plantCode: v})} disabled={disabled} />
        <FormInput label="System Date/Time" value={data.id ? (data.saleOrderDate || '--') : currentTimeStr} disabled={true} />
        <FormInput label="Sale Order No" value={data.saleOrder} onChange={(v) => onChange({...data, saleOrder: v})} disabled={disabled} />
        <FormInput label="Consignor Name" value={data.consignor} onChange={(v) => onChange({...data, consignor: v})} disabled={disabled} />
        <FormInput label="Consignee Name" value={data.consignee} onChange={(v) => onChange({...data, consignee: v})} disabled={disabled} />
        <FormInput label="Ship To Party" value={data.shipToParty} onChange={(v) => onChange({...data, shipToParty: v})} disabled={disabled} />
        <FormInput label="From City" value={data.from} onChange={(v) => onChange({...data, from: v})} disabled={disabled} />
        <FormInput label="Destination City" value={data.destination} onChange={(v) => onChange({...data, destination: v})} disabled={disabled} />
        <FormInput label="LR Number" value={data.lrNo} onChange={(v) => onChange({...data, lrNo: v})} disabled={disabled} />
        <FormInput label="LR Date" value={data.lrDate} type="date" onChange={(v) => onChange({...data, lrDate: v})} disabled={disabled} />
      </div>
      
      <div className="space-y-4">
        <SectionHeader title="Product Item Registry" />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead className="bg-[#f0f0f0]">
              <tr>
                <th className="p-2 border border-slate-300 text-[9px] font-black uppercase">Product</th>
                <th className="p-2 border border-slate-300 text-[9px] font-black uppercase">Weight</th>
                <th className="p-2 border border-slate-300 text-[9px] font-black uppercase">UOM</th>
                <th className="p-2 border border-slate-300 text-[9px] font-black uppercase">Ewaybill</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || [{ product: 'SALT', weight: '', weightUom: 'MT', ewaybillNumber: '' }]).map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="p-1 border border-slate-300">
                    <input className="w-full outline-none text-[10px] p-1 font-bold" value={item.product || ''} onChange={(e) => {
                      const items = [...(data.items || [{ product: 'SALT' }])];
                      items[idx] = { ...items[idx], product: e.target.value };
                      onChange({ ...data, items });
                    }} disabled={disabled} />
                  </td>
                  <td className="p-1 border border-slate-300">
                    <input className="w-full outline-none text-[10px] p-1 font-bold" value={item.weight || ''} onChange={(e) => {
                      const items = [...(data.items || [{ product: 'SALT' }])];
                      items[idx] = { ...items[idx], weight: e.target.value };
                      onChange({ ...data, items });
                    }} disabled={disabled} />
                  </td>
                  <td className="p-1 border border-slate-300">
                    <select className="w-full outline-none text-[10px] p-1 font-bold" value={item.weightUom || 'MT'} onChange={(e) => {
                      const items = [...(data.items || [{ product: 'SALT' }])];
                      items[idx] = { ...items[idx], weightUom: e.target.value };
                      onChange({ ...data, items });
                    }} disabled={disabled}>
                      <option value="MT">MT</option>
                      <option value="KG">KG</option>
                      <option value="PCS">PCS</option>
                    </select>
                  </td>
                  <td className="p-1 border border-slate-300">
                    <input className="w-full outline-none text-[10px] p-1 font-bold" value={item.ewaybillNumber || ''} onChange={(e) => {
                      const items = [...(data.items || [{ product: 'SALT' }])];
                      items[idx] = { ...items[idx], ewaybillNumber: e.target.value };
                      onChange({ ...data, items });
                    }} disabled={disabled} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserForm({ data, onChange, disabled, allPlants }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
      <FormInput label="Full Name" value={data.fullName} onChange={(v) => onChange({...data, fullName: v})} disabled={disabled} />
      <FormInput label="Username" value={data.username} onChange={(v) => onChange({...data, username: v})} disabled={disabled} />
      <FormInput label="Mobile" value={data.mobile} onChange={(v) => onChange({...data, mobile: v})} disabled={disabled} />
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase">Authorized T-Codes</label>
        <div className="bg-white border border-slate-400 h-32 overflow-y-auto p-2">
          {MASTER_TCODES.filter(t => t.code.endsWith('01') || t.code === 'TR21' || t.code === 'BULK').map(t => (
            <div key={t.code} className="flex items-center gap-2 mb-1">
              <Checkbox 
                checked={data.tcodes?.includes(t.code)} 
                onCheckedChange={(val) => {
                  const codes = data.tcodes || [];
                  if (val) onChange({...data, tcodes: [...codes, t.code]});
                  else onChange({...data, tcodes: codes.filter((c: string) => c !== t.code)});
                }}
                disabled={disabled}
              />
              <span className="text-[10px] font-bold">{t.code} - {t.description}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase">Authorized Plants</label>
        <div className="bg-white border border-slate-400 h-32 overflow-y-auto p-2">
          {allPlants?.map((p: any) => (
            <div key={p.plantCode} className="flex items-center gap-2 mb-1">
              <Checkbox 
                checked={data.plants?.includes(p.plantCode)} 
                onCheckedChange={(val) => {
                  const plants = data.plants || [];
                  if (val) onChange({...data, plants: [...plants, p.plantCode]});
                  else onChange({...data, plants: plants.filter((c: string) => c !== p.plantCode)});
                }}
                disabled={disabled}
              />
              <span className="text-[10px] font-bold">{p.plantCode} - {p.plantName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text", disabled }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <Input 
        type={type} 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        disabled={disabled}
        className="h-8 rounded-none border-slate-400 focus:ring-0 focus:border-[#0056d2] text-xs font-bold bg-white"
      />
    </div>
  );
}

function FormSelect({ label, value, options, onChange, disabled }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <select 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        disabled={disabled}
        className="h-8 border border-slate-400 bg-white px-2 text-xs font-bold outline-none"
      >
        <option value="">Select...</option>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function RegistryList({ screen, onSelectItem, listData }: any) {
  const getCols = () => {
    if (screen.startsWith('VA')) return ['SO Number', 'Name / Description', 'Type / Details', 'Date'];
    if (screen.startsWith('SU')) return ['Username', 'Name', 'Registry ID', 'Node Active'];
    return ['Registry ID', 'Name / Description', 'Type / Details', 'Sync Node'];
  };

  return (
    <div className="overflow-x-auto border border-slate-300">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#f0f0f0] border-b border-slate-300">
            {getCols().map(col => <th key={col} className="p-2 text-[9px] font-black uppercase text-slate-500">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {listData?.map((item: any) => (
            <tr key={item.id} onClick={() => onSelectItem(item)} className="border-b border-slate-200 hover:bg-[#e8f0fe] cursor-pointer transition-colors">
              <td className="p-2 text-[10px] font-black text-[#0056d2]">
                {item.username || item.saleOrder || item.saleOrderNumber || item.customerCode || item.plantCode || item.companyCode || item.id.slice(0, 8)}
              </td>
              <td className="p-2 text-[10px] font-bold text-slate-600 uppercase">
                {item.fullName || item.plantName || item.companyName || item.vendorName || item.customerName || `${item.consignor} → ${item.consignee || 'UNSPECIFIED'}`}
                {item.shipToParty && item.shipToParty !== item.consignee && <span className="block text-[8px] text-red-500">Ship to: {item.shipToParty}</span>}
              </td>
              <td className="p-2 text-[10px] font-bold text-slate-400 uppercase italic">
                {item.customerType || item.city || (item.from ? `${item.from} → ${item.destination}` : 'REGISTRY NODE')}
              </td>
              <td className="p-2 text-[10px] font-bold text-slate-400">
                {item.saleOrderDate || item.updatedAt ? format(new Date(item.saleOrderDate || item.updatedAt), 'dd-MM-yyyy') : 'SYNC ACTIVE'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DripBoard({ orders, trips, onStatusUpdate, plants }: { orders: any[] | null, trips: any[] | null, onStatusUpdate: any, plants: any[] | null }) {
  const { user } = useUser();
  const db = useFirestore();
  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [viewTrip, setViewTrip] = React.useState<any>(null);
  const [assignWeight, setAssignWeight] = React.useState<string>('');
  const [vehicleNo, setVehicleNo] = React.useState('');
  const [driverMobile, setDriverMobile] = React.useState('');
  const [vendorName, setVendorName] = React.useState('');
  const [delayRemark, setDelayRemark] = React.useState('');
  const [rate, setRate] = React.useState<string>('');
  const [freightAmount, setFreightAmount] = React.useState<string>('');
  const [isFixRate, setIsFixRate] = React.useState(false);
  const [vehicleType, setVehicleType] = React.useState('OWN FLEET');

  React.useEffect(() => {
    if (!isFixRate && assignWeight && rate) {
      const total = parseFloat(assignWeight) * parseFloat(rate);
      setFreightAmount(total.toString());
    }
  }, [assignWeight, rate, isFixRate]);

  const handleAssign = () => {
    if (!user || !selectedOrder) return;
    
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    const newTripId = crypto.randomUUID();
    const routeStr = (selectedOrder.from && selectedOrder.destination) ? `${selectedOrder.from.toUpperCase()}--${selectedOrder.destination.toUpperCase()}` : '';
    const totalOrderWeight = (selectedOrder.items || []).reduce((s: number, i: any) => s + (parseFloat(i.weight) || 0), 0);
    const weightUom = selectedOrder.items?.[0]?.weightUom || 'MT';
    const soNo = (selectedOrder.saleOrder || selectedOrder.saleOrderNumber || 'N/A').toString().trim().toUpperCase();
    const productName = selectedOrder.items?.[0]?.product || 'SALT';
    
    const tripData = {
      id: newTripId,
      tripId: tripId,
      saleOrderId: selectedOrder.id,
      saleOrderNumber: soNo,
      saleOrder: soNo,
      plantCode: selectedOrder.plantCode,
      shipToParty: selectedOrder.shipToParty || '',
      consignee: selectedOrder.consignee || '',
      consignor: selectedOrder.consignor || '',
      route: routeStr,
      assignWeight: parseFloat(assignWeight),
      weightUom: weightUom,
      product: productName,
      vehicleType: vehicleType,
      vehicleNumber: vehicleNo,
      driverMobile: driverMobile,
      vendorName: vehicleType === 'MARKET VEHICLE' ? vendorName : 'SIKKA INDUSTRIES & LOGISTICS',
      delayRemark: delayRemark,
      rate: (vehicleType === 'MARKET VEHICLE' && !isFixRate) ? parseFloat(rate) : 0,
      freightAmount: vehicleType === 'MARKET VEHICLE' ? parseFloat(freightAmount) : 0,
      isFixedRate: vehicleType === 'MARKET VEHICLE' ? isFixRate : false,
      status: 'LOADING',
      createdAt: new Date().toISOString()
    };

    const docRef = doc(db, 'users', user.uid, 'trips', newTripId);
    setDocumentNonBlocking(docRef, tripData, { merge: true });

    const publicTripRef = doc(db, 'public_trips', tripId);
    setDocumentNonBlocking(publicTripRef, {
      type: 'trip',
      status: 'LOADING',
      tripId: tripId,
      saleOrder: soNo,
      saleOrderNumber: soNo,
      vehicleNumber: vehicleNo,
      route: routeStr,
      consignor: selectedOrder.consignor || '',
      consignee: selectedOrder.consignee || '',
      shipToParty: selectedOrder.shipToParty || '',
      orderQty: `${parseFloat(assignWeight)} ${weightUom}`,
      delayRemark: delayRemark,
      updatedAt: tripData.createdAt
    }, { merge: true });

    const publicOrderRef = doc(db, 'public_orders', soNo);
    setDocumentNonBlocking(publicOrderRef, {
      status: 'LOADING',
      vehicleNumber: vehicleNo,
      tripId: tripId,
      consignor: selectedOrder.consignor || '',
      consignee: selectedOrder.consignee || '',
      shipToParty: selectedOrder.shipToParty || '',
      route: routeStr,
      orderQty: `${totalOrderWeight} ${weightUom}`,
      delayRemark: delayRemark,
      updatedAt: tripData.createdAt,
      saleOrder: soNo,
      saleOrderNumber: soNo
    }, { merge: true });

    onStatusUpdate({ text: `Trip ${tripId} registered successfully`, type: 'success' });
    setSelectedOrder(null);
    resetForm();
  };

  const updateTripStatus = (trip: any, nextStatus: string) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid, 'trips', trip.id);
    setDocumentNonBlocking(docRef, { status: nextStatus }, { merge: true });

    const publicTripRef = doc(db, 'public_trips', trip.tripId);
    setDocumentNonBlocking(publicTripRef, { status: nextStatus, updatedAt: new Date().toISOString() }, { merge: true });

    const soNo = (trip.saleOrderNumber || trip.saleOrder || '').toString().trim().toUpperCase();
    const publicOrderRef = doc(db, 'public_orders', soNo);
    setDocumentNonBlocking(publicOrderRef, { status: nextStatus, updatedAt: new Date().toISOString() }, { merge: true });

    onStatusUpdate({ text: `Mission ${trip.tripId} moved to ${nextStatus}`, type: 'success' });
  };

  const resetForm = () => {
    setVehicleType('OWN FLEET');
    setAssignWeight('');
    setVehicleNo('');
    setDriverMobile('');
    setVendorName('');
    setDelayRemark('');
    setRate('');
    setFreightAmount('');
    setIsFixRate(false);
  };

  const calculateRemainingWeight = (orderId: string, totalWeight: number) => {
    const assigned = (trips || [])
      .filter(t => t.saleOrderId === orderId)
      .reduce((sum, t) => sum + (parseFloat(t.assignWeight) || 0), 0);
    return totalWeight - assigned;
  };

  const filteredOrders = orders?.filter(o => {
    const totalW = (o.items || []).reduce((s: number, i: any) => s + (parseFloat(i.weight) || 0), 0);
    const remaining = calculateRemainingWeight(o.id, totalW);
    const matchesPlant = plantFilter === 'ALL' || o.plantCode === plantFilter;
    const hasNoTrips = !(trips || []).some(t => t.saleOrderId === o.id);
    return matchesPlant && (remaining > 0 || (totalW > 0 && hasNoTrips) || (totalW === 0 && hasNoTrips));
  });

  const getTripsByStatus = (status: string) => {
    return (trips || []).filter(t => t.status === status && (plantFilter === 'ALL' || t.plantCode === plantFilter)) || [];
  };

  const getNextStatus = (current: string) => {
    const sequence = ['LOADING', 'IN-TRANSIT', 'ARRIVED', 'POD', 'CLOSED'];
    const idx = sequence.indexOf(current);
    if (idx !== -1 && idx < sequence.length - 1) return sequence[idx + 1];
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <Filter className="h-4 w-4 text-slate-400" />
        <span className="text-[10px] font-black uppercase text-slate-400">Plant Filter</span>
        <select 
          className="h-9 border-none bg-white px-4 rounded-lg font-bold text-xs outline-none shadow-sm min-w-[200px]"
          value={plantFilter}
          onChange={(e) => setPlantFilter(e.target.value)}
        >
          <option value="ALL">ALL PLANTS</option>
          {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}
        </select>
      </div>

      <Tabs defaultValue="OPEN" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-2xl w-full justify-start overflow-x-auto no-scrollbar gap-1 h-12">
          {['OPEN ORDER', 'LOADING', 'IN-TRANSIT', 'ARRIVED', 'POD SECTION', 'REJECTION', 'CLOSED'].map((tab) => (
            <TabsTrigger 
              key={tab} 
              value={tab.split(' ')[0]}
              className="rounded-xl px-6 font-black text-[10px] uppercase tracking-wider data-[state=active]:bg-[#0056d2] data-[state=active]:text-white h-10"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="OPEN" className="mt-6">
          <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-xl bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400">Order Header</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400">Plant</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400">Consignor</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400">Consignee</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400">Ship To Party</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400">Route</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400">Remaining Weight</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders?.map(order => {
                  const totalW = (order.items || []).reduce((s: number, i: any) => s + (parseFloat(i.weight) || 0), 0);
                  const remaining = calculateRemainingWeight(order.id, totalW);
                  const uom = order.items?.[0]?.weightUom || 'MT';
                  const soNo = (order.saleOrder || order.saleOrderNumber || 'N/A');
                  
                  return (
                    <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black text-xs text-[#0056d2]">{soNo}</td>
                      <td className="p-4 font-bold text-[10px] text-slate-600 uppercase">{order.plantCode}</td>
                      <td className="p-4 font-bold text-[10px] uppercase text-slate-600">{order.consignor}</td>
                      <td className="p-4 font-bold text-[10px] uppercase text-slate-600">{order.consignee}</td>
                      <td className="p-4 font-bold text-[10px] uppercase text-slate-600">{order.shipToParty}</td>
                      <td className="p-4 font-bold text-[10px] uppercase text-slate-400 italic">
                        {order.from}--{order.destination}
                      </td>
                      <td className="p-4 font-black text-xs">
                        <Badge variant="outline" className="border-blue-100 text-[#0056d2] rounded-lg px-2">
                          {remaining} {uom}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Button 
                          onClick={() => setSelectedOrder(order)}
                          className="bg-[#0056d2] hover:bg-black text-white h-8 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2"
                        >
                          <Truck className="h-3 w-3" /> Assign Vehicle
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {['LOADING', 'IN-TRANSIT', 'ARRIVED', 'POD', 'REJECTION', 'CLOSED'].map(status => (
          <TabsContent key={status} value={status} className="mt-6">
            <div className="space-y-4">
              <div className="hidden lg:grid grid-cols-10 bg-slate-100 border-y border-slate-200 py-3 px-6 text-[9px] font-black uppercase tracking-widest text-slate-500">
                <div className="col-span-1">ID / Node</div>
                <div className="col-span-1">Date</div>
                <div className="col-span-2">Loading / Consignor</div>
                <div className="col-span-2">Unloading / Consignee / Ship To</div>
                <div className="col-span-1">Vehicle / Carrier</div>
                <div className="col-span-1">Driver / Contact</div>
                <div className="col-span-1">Qty / Product</div>
                <div className="col-span-1 text-center">Actions</div>
              </div>

              {getTripsByStatus(status).map(trip => {
                const next = getNextStatus(status);
                const soNo = trip.saleOrderNumber || trip.saleOrder || 'N/A';
                const formattedDate = trip.createdAt ? format(new Date(trip.createdAt), 'dd MMM').toUpperCase() : '--';
                const formattedTime = trip.createdAt ? format(new Date(trip.createdAt), 'hh:mm a') : '--';
                
                return (
                  <div key={trip.id} className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-10 items-center p-4 lg:p-6 gap-4">
                      <div className="col-span-1 flex flex-col gap-1">
                        <span className="text-[#0056d2] font-black text-[11px] leading-tight">#{trip.tripId}</span>
                        <span className="text-slate-400 font-bold text-[9px]">SO: {soNo}</span>
                      </div>

                      <div className="col-span-1 flex flex-col gap-1">
                        <span className="text-slate-900 font-black text-[10px]">{formattedDate}</span>
                        <span className="text-slate-400 font-bold text-[9px]">{formattedTime}</span>
                      </div>

                      <div className="col-span-2 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-slate-900 font-black text-[10px] truncate uppercase">{trip.consignor || 'PLANT NODE'}</span>
                        </div>
                        <span className="text-slate-400 font-bold text-[9px] pl-3.5 truncate italic">{trip.route?.split('--')[0]}</span>
                      </div>

                      <div className="col-span-2 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-black text-[10px] truncate uppercase">{trip.consignee || trip.shipToParty || 'REGISTRY NODE'}</span>
                            {trip.shipToParty && (
                              <span className="text-red-600 font-bold text-[8px] uppercase truncate">
                                Ship To: {trip.shipToParty}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-slate-400 font-bold text-[9px] pl-3.5 truncate italic">{trip.route?.split('--')[1]}</span>
                      </div>

                      <div className="col-span-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3 w-3 text-[#0056d2]" />
                          <span className="text-slate-900 font-black text-[10px] uppercase">{trip.vehicleNumber}</span>
                        </div>
                        <span className="text-slate-400 font-bold text-[8px] leading-tight uppercase">{trip.vendorName || 'OWN FLEET'}</span>
                      </div>

                      <div className="col-span-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span className="text-slate-900 font-black text-[10px]">{trip.driverMobile}</span>
                        </div>
                        <span className="text-slate-400 font-bold text-[8px] uppercase">Registry Verified</span>
                      </div>

                      <div className="col-span-1 flex flex-col gap-1">
                        <span className="text-slate-900 font-black text-[10px]">{trip.assignWeight} {trip.weightUom || 'MT'}</span>
                        <span className="text-slate-400 font-bold text-[9px] truncate italic">{trip.product || 'SALT'}</span>
                      </div>

                      <div className="col-span-1 flex flex-col gap-2 items-center">
                        {next && (
                          <Button 
                            onClick={() => updateTripStatus(trip, next)}
                            className="w-full bg-[#0056d2] hover:bg-black text-white h-7 rounded-sm text-[8px] font-black uppercase tracking-widest px-2"
                          >
                            {next === 'ARRIVED' ? 'Arrived In' : next === 'POD' ? 'Upload POD' : `Move ${next}`}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          onClick={() => setViewTrip(trip)}
                          className="w-full h-7 border-slate-200 text-slate-600 text-[8px] font-black uppercase tracking-widest px-2"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>

                    <div className="bg-slate-50 border-t border-slate-100 px-6 py-2 flex items-center justify-between">
                       <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                             <Badge variant="outline" className="border-emerald-100 text-emerald-600 font-black text-[7px] uppercase tracking-tighter rounded-sm">On Schedule</Badge>
                             <span className="text-slate-400 font-bold text-[8px]">{formattedDate}, {formattedTime}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-mono">
          <div className="bg-[#0056d2] p-6 text-white flex flex-col items-center">
            <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Assign Mission Vehicle</DialogTitle>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Vehicle Type</label>
                <select 
                  value={vehicleType} 
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full h-11 rounded-xl font-bold bg-slate-50 border-slate-200 px-4 text-xs outline-none"
                >
                  <option value="OWN FLEET">OWN FLEET</option>
                  <option value="CONTRACT">CONTRACT</option>
                  <option value="MARKET VEHICLE">MARKET VEHICLE</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Assign Weight</label>
                <Input value={assignWeight} onChange={(e) => setAssignWeight(e.target.value)} placeholder="0.00" className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Vehicle Number</label>
                <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="UP14-XX-0000" className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Driver Mobile</label>
                <Input value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} placeholder="+91..." className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200" />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Delay Remark</label>
                <Input value={delayRemark} onChange={(e) => setDelayRemark(e.target.value)} placeholder="Reason for delay..." className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200" />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 border-t border-slate-50">
            <Button variant="ghost" onClick={() => setSelectedOrder(null)} className="rounded-xl font-black uppercase text-[10px]">Cancel</Button>
            <Button onClick={handleAssign} className="bg-[#0056d2] hover:bg-black text-white px-8 h-12 rounded-xl font-black uppercase text-[10px]">Assign Mission</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTrip} onOpenChange={() => setViewTrip(null)}>
        <DialogContent className="max-w-4xl rounded-sm border border-slate-300 p-0 overflow-hidden font-mono shadow-2xl">
          <div className="bg-[#0056d2] p-4 text-white flex justify-between items-center">
            <div>
              <DialogTitle className="text-lg font-black uppercase italic tracking-tighter">Mission Registry Hub</DialogTitle>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-200 mt-1">Registry Detail Node: {viewTrip?.tripId}</p>
            </div>
          </div>
          <div className="p-6 space-y-8 bg-[#fdfdfd]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <SectionHeader title="Consignment Context" />
                <div className="space-y-3 px-2">
                  <DetailRow label="Sale Order" value={viewTrip?.saleOrderNumber} />
                  <DetailRow label="Consignor" value={viewTrip?.consignor} />
                  <DetailRow label="Consignee" value={viewTrip?.consignee} />
                </div>
              </div>
              <div className="space-y-4">
                <SectionHeader title="Mission Specs" />
                <div className="space-y-3 px-2">
                  <DetailRow label="Vehicle" value={viewTrip?.vehicleNumber} />
                  <DetailRow label="Product" value={viewTrip?.product} />
                  <DetailRow label="Assign Weight" value={`${viewTrip?.assignWeight} ${viewTrip?.weightUom}`} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-[#f0f0f0]">
            <Button onClick={() => setViewTrip(null)} className="bg-slate-800 hover:bg-black text-white px-8 rounded-none font-black uppercase text-[10px]">Close Registry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
