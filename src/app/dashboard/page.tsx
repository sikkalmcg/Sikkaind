'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, RotateCcw, X, HelpCircle, LogOut,
  ChevronRight, Check, AlertCircle, Info, PlusCircle, Trash2,
  Grid2X2, Upload, Download, ShoppingBag, ArrowUpRight,
  Filter, Truck, MapPin, User, Users, DollarSign, Activity,
  Layers, PackageCheck, Ban, Lock, Play, XCircle, Search,
  ArrowRight, Calendar, Phone, FileText, Package, Clock,
  LayoutDashboard, Database, Settings, BarChart, TrendingUp,
  FileSpreadsheet, HardDriveDownload, CloudUpload, ShieldAlert,
  AlertTriangle, Radar, Loader2, Edit3, FileDown
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
import { collection, doc, query, where, getDoc } from 'firebase/firestore';
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
import { cn } from '@/lib/utils';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'VA04' | 'TR21' | 'BULK' | 'SU01' | 'SU02' | 'SU03';

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
  { code: 'VA04', description: 'CANCEL SALES ORDER REGISTRY' },
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
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [printData, setPrintData] = React.useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = React.useState(false);
  const [cnPreviewData, setCnPreviewData] = React.useState<any>(null);
  const [showCnPreview, setShowCnPreview] = React.useState(false);
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
    const activeOrders = rawOrders?.filter(o => o.status !== 'CANCELLED');
    if (!authPlants.length) return activeOrders;
    return activeOrders?.filter(o => authPlants.includes(o.plantCode));
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

  const executeTCode = (code: string) => {
    const cleanCode = code.toUpperCase().trim().replace(/^\/N/, '');
    if (cleanCode === 'HOME' || cleanCode === '') {
      setActiveScreen('HOME');
      setTCode('');
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
    }
    setTCode('');
  };

  const handleSave = () => {
    if (!user) return;
    
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

    if (activeScreen.endsWith('03')) return;

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
      setStatusMsg({ text: `Registry synchronized successfully`, type: 'success' });
      if (!formData.id) setFormData(payload);
    }
  };

  const handlePrintLR = (trip: any, order: any) => {
    setPrintData({ trip, order });
    setShowPrintPreview(true);
  };

  const handlePrintCN = (trip: any, order: any) => {
    setCnPreviewData({ trip, order, deliveryAddress: trip.deliveryAddress || order.destination || '' });
    setShowCnPreview(true);
  };

  const handleActualPrint = () => {
    window.print();
    setShowPrintPreview(false);
    setShowCnPreview(false);
  };

  const handleLogout = () => router.push('/login');

  if (isUserLoading) return <div className="flex h-screen items-center justify-center bg-[#d9e1f2] font-mono"><RotateCcw className="h-12 w-12 text-[#0056d2] animate-spin" /></div>;

  const isModuleActive = activeScreen !== 'HOME';
  const showList = (activeScreen.endsWith('02') || activeScreen.endsWith('03')) && !formData.id;
  const showForm = activeScreen.endsWith('01') || activeScreen === 'VA04' || ((activeScreen.endsWith('02') || activeScreen.endsWith('03')) && formData.id);
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
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="flex flex-col h-screen w-full bg-[#d9e1f2] text-[#333] font-mono select-none overflow-hidden">
        {/* TOP BAR */}
        <div className="flex items-center bg-[#f0f0f0] border-b border-white/50 px-2 h-7 text-[11px] font-semibold z-50">
          <DropdownMenu>
            <DropdownMenuTrigger className="px-3 hover:bg-[#0056d2] hover:text-white outline-none transition-colors h-full flex items-center">Menu</DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white rounded-none border-slate-300 shadow-xl text-[11px] p-0 min-w-[150px]">
              <DropdownMenuItem onClick={() => setActiveScreen('HOME')} className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4">Home Hub (/n)</DropdownMenuItem>
              <DropdownMenuSeparator className="m-0 bg-slate-200" />
              <DropdownMenuItem onClick={handleSave} className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4">Save (Ctrl+S)</DropdownMenuItem>
              <DropdownMenuSeparator className="m-0 bg-slate-200" />
              <DropdownMenuItem onClick={handleLogout} className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4 text-red-600">Log Off</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* COMMAND BAR */}
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
               <button onClick={handleSave} className="p-1 hover:bg-slate-200 rounded group"><Save className="h-4 w-4 text-slate-600 group-hover:text-[#0056d2]" /></button>
               <button onClick={() => setActiveScreen('HOME')} className="p-1 hover:bg-slate-200 rounded group"><X className="h-4 w-4 text-slate-600 group-hover:text-[#0056d2]" /></button>
               <button onClick={() => setFormData({})} className="p-1 hover:bg-slate-200 rounded group"><RotateCcw className="h-4 w-4 text-slate-600 group-hover:text-[#0056d2]" /></button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <Sidebar collapsible="icon" className="border-r border-slate-300 bg-sidebar">
            <SidebarHeader className="bg-[#0056d2] text-white p-3">
              <SidebarMenuButton onClick={() => setActiveScreen('HOME')} isActive={activeScreen === 'HOME'} className="hover:bg-white/10 text-white">
                <Grid2X2 className="h-4 w-4" />
                <span className="font-black uppercase italic tracking-tighter text-xs">Home Hub</span>
              </SidebarMenuButton>
            </SidebarHeader>
            <SidebarContent className="custom-scrollbar px-2">
              <div className="px-4 py-6 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Logistics</div>
              <SidebarMenu className="gap-2">
                {[
                  { code: 'OX01', label: 'PLANT MASTER', icon: Database },
                  { code: 'FM01', label: 'COMPANY MASTER', icon: Database },
                  { code: 'XK01', label: 'VENDOR MASTER', icon: User },
                  { code: 'XD01', label: 'CUSTOMER MASTER', icon: Users },
                  { code: 'VA01', label: 'SALES ORDERS', icon: ShoppingBag },
                  { code: 'VA04', label: 'CANCEL ORDER', icon: Ban },
                  { code: 'TR21', label: 'DRIP BOARD', icon: Truck },
                  { code: 'BULK', label: 'BULK SYNC', icon: CloudUpload },
                  { code: 'SU01', label: 'USER MANAGEMENT', icon: Settings },
                ].map((item) => (
                  <SidebarMenuItem key={item.code}>
                    <SidebarMenuButton 
                      onClick={() => executeTCode(item.code)} 
                      isActive={activeScreen.startsWith(item.code.slice(0,2)) || (item.code === 'BULK' && activeScreen === 'BULK')}
                      className="px-4 h-9 hover:bg-slate-100 transition-colors"
                    >
                      <item.icon className={cn("h-4 w-4 mr-2", activeScreen.startsWith(item.code.slice(0,2)) ? "text-[#0056d2]" : "text-slate-500")} />
                      <span className={cn(
                        "text-[11px] font-black uppercase tracking-tight",
                        activeScreen.startsWith(item.code.slice(0,2)) ? "text-[#0056d2]" : "text-slate-600"
                      )}>
                        {item.code} - {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>

          <SidebarInset className="flex flex-col overflow-hidden bg-[#f0f3f9]">
            <div className="bg-[#0056d2] text-white py-2 px-6 shadow-lg flex flex-col items-center justify-center min-h-[60px] shrink-0">
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
                {activeScreen === 'HOME' ? 'SIKKA LOGISTICS HUB' : MASTER_TCODES.find(t => t.code === activeScreen)?.description}
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-8">
              {activeScreen === 'HOME' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 max-w-[1400px] mx-auto">
                  {[
                    { code: 'OX01', label: ['CREATE', 'INITIAL', 'SCREEN'] },
                    { code: 'FM01', label: ['CREATE', 'INITIAL', 'SCREEN'] },
                    { code: 'XK01', label: ['CREATE', 'INITIAL', 'SCREEN'] },
                    { code: 'XD01', label: ['CREATE', 'INITIAL', 'SCREEN'] },
                    { code: 'VA01', label: ['CREATE', 'INITIAL', 'SCREEN'] },
                    { code: 'VA04', label: ['CANCEL', 'NODE'] },
                  ].map((item) => (
                    <div 
                      key={item.code} 
                      onClick={() => executeTCode(item.code)} 
                      className="bg-white p-8 rounded-[1.5rem] shadow-xl border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col min-h-[220px] w-full"
                    >
                      <Badge className="bg-[#e8f0fe] text-[#0056d2] rounded-none px-4 py-1.5 font-black italic tracking-[0.15em] text-[10px] border-none mb-8 w-fit">
                        {item.code}
                      </Badge>
                      <h3 className="text-[13px] font-black text-[#1e3a8a] leading-[1.8] uppercase tracking-[0.1em]">
                        {item.label.map((line, idx) => (
                          <span key={idx} className="block">{line}</span>
                        ))}
                      </h3>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white shadow-2xl rounded-sm border border-slate-300 overflow-hidden animate-slide-up w-full min-h-[600px] p-6">
                   {showForm && (
                     <>
                       {activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                       {activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                       {activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                       {activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                       {activeScreen.startsWith('VA') && activeScreen !== 'VA04' && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} allCustomers={rawCustomers} />}
                       {activeScreen === 'VA04' && <CancelOrderForm data={formData} onChange={setFormData} allOrders={rawOrders} onPost={handleSave} onCancel={() => setFormData({})} />}
                       {activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                     </>
                   )}
                   {showList && <RegistryList onSelectItem={setFormData} listData={getRegistryList()} />}
                   {activeScreen === 'TR21' && <DripBoard orders={rawOrders} trips={allTrips} onStatusUpdate={setStatusMsg} plants={allPlants} onPrintLR={handlePrintLR} onPrintCN={handlePrintCN} />}
                   {activeScreen === 'BULK' && <BulkDataHub allPlants={rawPlants} />}
                </div>
              )}
            </div>
            <div className="h-6 bg-[#f0f0f0] border-t border-slate-300 flex items-center px-4 text-[10px] font-bold text-slate-600">
              <span>{statusMsg.text}</span>
            </div>
          </SidebarInset>
        </div>

        {/* DIALOGS FOR PRINTING */}
        <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none bg-slate-800 shadow-2xl">
            <div className="bg-slate-900 p-4 flex justify-between items-center sticky top-0 z-10 border-b border-white/10">
              <DialogTitle className="text-white font-black uppercase italic tracking-tighter text-sm">Registry Print Handshake: LR Preview</DialogTitle>
              <Button onClick={handleActualPrint} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest h-9 px-8 rounded-lg">Confirm & Print Mission Node</Button>
            </div>
            <div className="p-12 bg-slate-200">
              <div className="bg-white p-12 shadow-2xl mx-auto max-w-[210mm] border border-slate-300">
                {printData && <LRPrintTemplate trip={printData.trip} order={printData.order} />}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showCnPreview} onOpenChange={setShowCnPreview}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 border-none bg-slate-800 shadow-2xl">
            <div className="bg-slate-900 p-4 flex justify-between items-center sticky top-0 z-10 border-b border-white/10">
              <DialogTitle className="text-white font-black uppercase italic tracking-tighter text-sm">Consignment Note: 3-Copy Registry Hub</DialogTitle>
              <div className="flex items-center gap-4">
                <div className="bg-white/5 px-4 py-1.5 rounded-lg border border-white/10">
                  <span className="text-[10px] font-black uppercase text-blue-400 mr-2">Delivery Node Edit:</span>
                  <input 
                    className="bg-transparent text-white text-xs outline-none border-b border-white/20 focus:border-blue-400 w-48"
                    value={cnPreviewData?.deliveryAddress || ''}
                    onChange={(e) => setCnPreviewData({ ...cnPreviewData, deliveryAddress: e.target.value })}
                  />
                </div>
                <Button onClick={handleActualPrint} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest h-9 px-8 rounded-lg flex items-center gap-2">
                  <Printer className="h-3 w-3" /> PRINT ALL COPIES
                </Button>
              </div>
            </div>
            <div className="p-8 bg-slate-200 space-y-12">
              {cnPreviewData && ["CONSIGNEE COPY", "DRIVER COPY", "CONSIGNOR COPY"].map((copyType) => (
                <div key={copyType} className="bg-white shadow-2xl mx-auto max-w-[210mm] min-h-[297mm] print:shadow-none print:m-0 page-break-after-always">
                  <CNPrintTemplate trip={cnPreviewData.trip} order={cnPreviewData.order} copyType={copyType} deliveryAddress={cnPreviewData.deliveryAddress} />
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        
        <div id="printable-area" className="hidden print:block p-0 m-0">
          {printData && <LRPrintTemplate trip={printData.trip} order={printData.order} />}
          {cnPreviewData && ["CONSIGNEE COPY", "DRIVER COPY", "CONSIGNOR COPY"].map((copyType) => (
             <div key={copyType} className="page-break-after-always">
                <CNPrintTemplate trip={cnPreviewData.trip} order={cnPreviewData.order} copyType={copyType} deliveryAddress={cnPreviewData.deliveryAddress} />
             </div>
          ))}
        </div>
      </div>
    </SidebarProvider>
  );
}

// COMPONENTS & TEMPLATES

function CNPrintTemplate({ trip, order, copyType, deliveryAddress }: { trip: any, order: any, copyType: string, deliveryAddress?: string }) {
  const cnNo = trip?.cnNo || '--';
  const cnDate = trip?.cnDate || (trip?.createdAt ? format(new Date(trip.createdAt), 'dd-MMM-yyyy') : '--');
  const paymentMode = trip?.paymentMode || 'To Pay';
  const items = order?.items || [{ product: trip?.product || 'SALT', weight: trip?.assignWeight || '--', weightUom: trip?.weightUom || 'MT', invoiceNumber: trip?.invoiceNumber || '--' }];
  
  const totalPackages = items.reduce((acc: number, item: any) => acc + (parseFloat(item.packages) || 0), 0);
  const totalWeight = items.reduce((acc: number, item: any) => acc + (parseFloat(item.weight) || 0), 0);

  return (
    <div className="w-full p-8 md:p-12 font-body text-black leading-tight bg-white min-h-[297mm] flex flex-col box-border border-4 border-black/5">
      <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
        <div className="flex gap-6 items-center">
          <div className="w-16 h-16 bg-black flex items-center justify-center rounded-xl shrink-0">
            <span className="text-white font-black text-3xl italic">S</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">Sikka Industries & Logistics</h1>
            <p className="text-[10px] font-bold opacity-70">Ghaziabad – 201009, Uttar Pradesh, India</p>
            <p className="text-[9px] font-black uppercase text-slate-500">GSTIN: 09ABCDE1234F1Z5 | PH: +91 120 4290010</p>
          </div>
        </div>
        <div className="text-right space-y-3">
          <div className="inline-block border-2 border-black px-4 py-1.5 font-black text-xs uppercase bg-black text-white rounded-md">{copyType}</div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase text-slate-400">CN Number</p>
            <p className="text-xl font-black tracking-widest">{cnNo}</p>
            <div className="flex justify-end gap-4 pt-1">
               <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">Date</p><p className="text-[10px] font-black">{cnDate}</p></div>
               <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">Origin</p><p className="text-[10px] font-black uppercase italic">{order?.from || '--'}</p></div>
               <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">Dest.</p><p className="text-[10px] font-black uppercase italic">{order?.destination || '--'}</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-2 border-black mb-6">
        <div className="grid grid-cols-4 divide-x-2 divide-black bg-slate-50 border-b-2 border-black font-black text-[9px] uppercase">
          <div className="p-2 text-center">Vehicle Number</div>
          <div className="p-2 text-center">Driver Mobile</div>
          <div className="p-2 text-center">Payment Term</div>
          <div className="p-2 text-center">Trip ID</div>
        </div>
        <div className="grid grid-cols-4 divide-x-2 divide-black text-[11px] font-black uppercase">
          <div className="p-3 text-center">{trip?.vehicleNumber || '--'}</div>
          <div className="p-3 text-center">{trip?.driverMobile || '--'}</div>
          <div className="p-3 text-center text-blue-600 italic">{paymentMode}</div>
          <div className="p-3 text-center">{trip?.tripId || '--'}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 border-2 border-black divide-x-2 divide-black mb-6">
        <div className="p-4 space-y-2">
          <h3 className="text-[10px] font-black uppercase border-b border-black pb-1 mb-2 text-slate-500 tracking-widest">Consignor</h3>
          <p className="text-xs font-black uppercase leading-tight">{trip?.consignor || '--'}</p>
          <p className="text-[9px] font-medium text-slate-600">{order?.from || '--'}</p>
          <p className="text-[9px] font-black mt-2">GSTIN: {trip?.consignorGst || '--'}</p>
        </div>
        <div className="p-4 space-y-2">
          <h3 className="text-[10px] font-black uppercase border-b border-black pb-1 mb-2 text-slate-500 tracking-widest">Consignee</h3>
          <p className="text-xs font-black uppercase leading-tight">{trip?.consignee || '--'}</p>
          <p className="text-[9px] font-medium text-slate-600">{order?.destination || '--'}</p>
          <p className="text-[9px] font-black mt-2">GSTIN: {trip?.consigneeGst || '--'}</p>
        </div>
        <div className="p-4 space-y-2 bg-slate-50/50">
          <h3 className="text-[10px] font-black uppercase border-b border-black pb-1 mb-2 text-slate-500 tracking-widest">Ship To Party</h3>
          <p className="text-xs font-black uppercase leading-tight">{trip?.shipToParty || '--'}</p>
          <div className="min-h-[40px] border border-dashed border-black/10 p-1 mt-1">
             <p className="text-[9px] font-medium leading-relaxed italic">{deliveryAddress || '--'}</p>
          </div>
          <p className="text-[9px] font-black mt-1">GSTIN: {trip?.shipToGst || '--'}</p>
        </div>
      </div>

      <div className="border-2 border-black flex-1 flex flex-col mb-6">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-black text-white font-black text-[9px] uppercase tracking-wider">
              <th className="p-3 border-r border-white/20 w-[20%]">Invoice No</th>
              <th className="p-3 border-r border-white/20 w-[20%]">E-waybill No</th>
              <th className="p-3 border-r border-white/20 w-[15%]">Package + UOM</th>
              <th className="p-3 border-r border-white/20 w-[30%]">Description of Goods</th>
              <th className="p-3 w-[15%] text-right">Quantity + UOM</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black/10">
            {items.map((item: any, idx: number) => (
              <tr key={idx} className="text-[10px] font-bold align-top">
                <td className="p-3 border-r-2 border-black/5 uppercase">{item.invoiceNumber || '--'}</td>
                <td className="p-3 border-r-2 border-black/5 uppercase">{item.ewaybillNumber || '--'}</td>
                <td className="p-3 border-r-2 border-black/5 uppercase">{item.packages || '--'} {item.unitUom || 'BAGS'}</td>
                <td className="p-3 border-r-2 border-black/5 uppercase italic">{item.product || 'SALT'}</td>
                <td className="p-3 text-right font-black">{item.weight || '--'} {item.weightUom || 'MT'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black bg-slate-100 font-black text-xs">
              <td colSpan={2} className="p-4 text-right uppercase opacity-50 text-[9px]">Total Payload Registry</td>
              <td className="p-4 border-l-2 border-black uppercase text-center">{totalPackages || '--'} PKGS</td>
              <td className="p-4 border-l-2 border-black"></td>
              <td className="p-4 border-l-2 border-black text-right">{totalWeight || '--'} {trip?.weightUom || 'MT'}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-0 border-2 border-black divide-x-2 divide-black mb-6">
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <h4 className="text-[9px] font-black uppercase text-slate-400">Delivery Address Node</h4>
            <p className="text-[10px] font-black italic uppercase leading-relaxed">{deliveryAddress || '--'}</p>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="p-4 border-b-2 border-black bg-slate-50 flex-1 text-center">
            <h4 className="text-[9px] font-black uppercase tracking-[0.2em] mb-4">Acknowledgement</h4>
            <div className="h-24"></div>
          </div>
          <div className="p-4 text-right">
             <p className="text-[9px] font-black uppercase">For Sikka Industries & Logistics</p>
             <div className="h-12"></div>
             <p className="text-[10px] font-black uppercase underline decoration-2 underline-offset-4">Authorized Signatory</p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-[7px] text-justify leading-relaxed opacity-60 font-medium italic">
          1. Carriage subject to terms on primary management node. 2. Not responsible for packaging damage at consignor end. 3. Ghaziabad jurisdiction only.
        </p>
      </div>

      <div className="text-center pt-2 border-t border-black/10">
         <p className="text-[9px] font-black uppercase tracking-[0.3em] italic">
           Note: "This Lorry Receipt was generated digitally and is to be considered as original."
         </p>
      </div>
    </div>
  );
}

function LRPrintTemplate({ trip, order }: { trip: any, order: any }) {
  const lrNo = trip?.lrNo || order?.lrNo || '--';
  const lrDate = trip?.lrDate || order?.lrDate || (trip?.createdAt ? format(new Date(trip.createdAt), 'dd-MMM-yyyy') : '--');
  const invNo = trip?.invoiceNumber || order?.items?.[0]?.invoiceNumber || '--';
  const product = trip?.product || order?.items?.[0]?.product || 'SALT';
  const weight = `${trip?.assignWeight || '--'} ${trip?.weightUom || order?.items?.[0]?.weightUom || 'MT'}`;

  return (
    <div className="w-full space-y-8 font-serif text-black leading-tight">
      <div className="text-center border-b-2 border-black pb-4">
        <h1 className="text-3xl font-black uppercase tracking-widest">Lorry Receipt</h1>
        <h2 className="text-xl font-bold uppercase mt-2">Sikka Industries & Logistics</h2>
        <p className="text-[11px] font-medium mt-1">Headquarters: Ghaziabad – 201009, Uttar Pradesh, India</p>
      </div>
      <div className="grid grid-cols-2 gap-12 pt-4">
        <div className="space-y-6">
          <div><p className="text-[9px] font-black uppercase text-slate-500 mb-1">Consignor Node</p><p className="text-sm font-black uppercase">{trip?.consignor || order?.consignor || '--'}</p><p className="text-[11px] mt-1">{order?.from || '--'}</p></div>
          <div><p className="text-[9px] font-black uppercase text-slate-500 mb-1">Consignee Node</p><p className="text-sm font-black uppercase">{trip?.consignee || order?.consignee || '--'}</p><p className="text-[11px] mt-1">{order?.destination || '--'}</p></div>
        </div>
        <div className="border-l-2 border-black pl-8 space-y-4">
          <div className="grid grid-cols-2 gap-4"><div><p className="text-[9px] font-black text-slate-500 uppercase">LR Number</p><p className="text-lg font-black">{lrNo}</p></div><div><p className="text-[9px] font-black text-slate-500 uppercase">LR Date</p><p className="text-md font-black">{lrDate}</p></div></div>
          <div><p className="text-[9px] font-black text-slate-500 uppercase">Vehicle Number</p><p className="text-lg font-black uppercase tracking-widest">{trip?.vehicleNumber || '--'}</p></div>
        </div>
      </div>
      <div className="border-2 border-black">
        <table className="w-full text-left border-collapse">
          <thead><tr className="bg-slate-100 border-b-2 border-black"><th className="p-3 border-r-2 border-black text-[11px] font-black uppercase">Consignment Particulars</th><th className="p-3 border-r-2 border-black text-[11px] font-black uppercase">Invoice Node</th><th className="p-3 text-[11px] font-black uppercase">Quantity / Weight</th></tr></thead>
          <tbody><tr className="h-40 align-top"><td className="p-4 border-r-2 border-black font-bold uppercase">{product}</td><td className="p-4 border-r-2 border-black font-bold uppercase">{invNo}</td><td className="p-4 font-black">{weight}</td></tr></tbody>
        </table>
      </div>
      <div className="flex flex-col items-center justify-end pt-12"><p className="text-[10px] font-black uppercase border-t border-black w-48 text-center pt-2">Authorized Signatory</p></div>
    </div>
  );
}

// FORM HELPERS

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-[10px] font-black uppercase tracking-widest bg-[#dae4f1] border-y border-slate-300 px-4 py-1 text-[#1e3a8a]">{title}</h3>;
}

function DetailRow({ label, value }: { label: string, value?: string | number }) {
  return <div className="grid grid-cols-3 gap-4 py-1 border-b border-slate-50 last:border-none"><span className="text-[9px] font-black uppercase text-slate-400">{label}</span><span className="col-span-2 text-[10px] font-bold text-slate-700 uppercase">{value || '--'}</span></div>;
}

function FormInput({ label, value, onChange, type = "text", disabled }: any) {
  return <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label><Input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-8 rounded-none border-slate-400 text-xs font-bold bg-white" /></div>;
}

function FormSelect({ label, value, options, onChange, disabled }: any) {
  return <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label><select value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-8 border border-slate-400 bg-white px-2 text-xs font-bold outline-none"><option value="">Select...</option>{options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select></div>;
}

// FORMS

function PlantForm({ data, onChange, disabled }: any) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
    <FormInput label="Plant Code" value={data.plantCode} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
    <FormInput label="Plant Name" value={data.plantName} onChange={(v: string) => onChange({...data, plantName: v})} disabled={disabled} />
    <FormInput label="City" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
    <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
  </div>;
}

function CompanyForm({ data, onChange, disabled }: any) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
    <FormInput label="Company Code" value={data.companyCode} onChange={(v: string) => onChange({...data, companyCode: v})} disabled={disabled} />
    <FormInput label="Company Name" value={data.companyName} onChange={(v: string) => onChange({...data, companyName: v})} disabled={disabled} />
  </div>;
}

function VendorForm({ data, onChange, disabled }: any) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
    <FormInput label="Vendor Name" value={data.vendorName} onChange={(v: string) => onChange({...data, vendorName: v})} disabled={disabled} />
    <FormInput label="Mobile" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
  </div>;
}

function CustomerForm({ data, onChange, disabled }: any) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
    <FormInput label="Customer Code" value={data.customerCode} onChange={(v: string) => onChange({...data, customerCode: v})} disabled={disabled} />
    <FormInput label="Customer Name" value={data.customerName} onChange={(v: string) => onChange({...data, customerName: v})} disabled={disabled} />
    <FormSelect label="Type" value={data.customerType} options={['Consignor', 'Consignee']} onChange={(v: string) => onChange({...data, customerType: v})} disabled={disabled} />
  </div>;
}

function SalesOrderForm({ data, onChange, disabled, allPlants, allCustomers }: any) {
  const plantOpts = (allPlants || []).map((p: any) => p.plantCode);
  const consignors = Array.from(new Set((allCustomers || []).filter((c: any) => c.customerType === 'Consignor').map((c: any) => c.customerName)));
  const consignees = Array.from(new Set((allCustomers || []).filter((c: any) => c.customerType === 'Consignee').map((c: any) => c.customerName)));
  const shipto = Array.from(new Set((allCustomers || []).map((c: any) => c.customerName)));
  const cities = Array.from(new Set([
    ...(allPlants || []).map((p: any) => p.city),
    ...(allCustomers || []).map((c: any) => c.city)
  ].filter(Boolean)));

  return <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
      <FormSelect label="Plant Code" value={data.plantCode} options={plantOpts} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
      <FormInput label="LR Number" value={data.lrNo} onChange={(v: string) => onChange({...data, lrNo: v})} disabled={disabled} />
      <FormInput label="LR Date" value={data.lrDate} type="date" onChange={(v: string) => onChange({...data, lrDate: v})} disabled={disabled} />
      <FormInput label="Sale Order No" value={data.saleOrder} onChange={(v: string) => onChange({...data, saleOrder: v})} disabled={disabled} />
      <FormSelect label="Consignor" value={data.consignor} options={consignors} onChange={(v: string) => onChange({...data, consignor: v})} disabled={disabled} />
      <FormSelect label="Consignee" value={data.consignee} options={consignees} onChange={(v: string) => onChange({...data, consignee: v})} disabled={disabled} />
      <FormSelect label="Ship To Party" value={data.shipToParty} options={shipto} onChange={(v: string) => onChange({...data, shipToParty: v})} disabled={disabled} />
      <FormSelect label="From City" value={data.from} options={cities} onChange={(v: string) => onChange({...data, from: v})} disabled={disabled} />
      <FormSelect label="Destination" value={data.destination} options={cities} onChange={(v: string) => onChange({...data, destination: v})} disabled={disabled} />
    </div>
    <div className="space-y-4"><SectionHeader title="Product Registry" />
      <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
        <thead className="bg-[#f0f0f0]"><tr><th className="p-2 border border-slate-300">Product</th><th className="p-2 border border-slate-300">Weight</th><th className="p-2 border border-slate-300">Invoice No</th></tr></thead>
        <tbody>{(data.items || [{ product: 'SALT', weight: '', weightUom: 'MT', invoiceNumber: '' }]).map((item: any, idx: number) => (
          <tr key={idx}>
            <td className="p-1 border border-slate-300"><input className="w-full outline-none p-1 font-bold" value={item.product || ''} onChange={(e) => {
              const items = [...(data.items || [{ product: 'SALT' }])];
              items[idx] = { ...items[idx], product: e.target.value };
              onChange({ ...data, items });
            }} disabled={disabled} /></td>
            <td className="p-1 border border-slate-300"><input className="w-full outline-none p-1 font-bold" value={item.weight || ''} onChange={(e) => {
              const items = [...(data.items || [{ product: 'SALT' }])];
              items[idx] = { ...items[idx], weight: e.target.value };
              onChange({ ...data, items });
            }} disabled={disabled} /></td>
            <td className="p-1 border border-slate-300"><input className="w-full outline-none p-1 font-bold" value={item.invoiceNumber || ''} onChange={(e) => {
              const items = [...(data.items || [{ product: 'SALT' }])];
              items[idx] = { ...items[idx], invoiceNumber: e.target.value };
              onChange({ ...data, items });
            }} disabled={disabled} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  </div>;
}

function CancelOrderForm({ data, onChange, allOrders, onPost, onCancel }: any) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && data.saleOrder) {
      const order = allOrders?.find((o: any) => (o.saleOrder || o.id)?.toString().toUpperCase() === data.saleOrder.toString().toUpperCase());
      if (order) onChange({ 
        ...data, 
        ...order, 
        weight: `${order.items?.[0]?.weight || '0'} ${order.items?.[0]?.weightUom || 'MT'}`,
        productName: order.items?.[0]?.product || 'SALT'
      });
    }
  };
  return <div className="space-y-6">
    <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col gap-2">
      <label className="text-[10px] font-black uppercase text-red-600">Sales Order Number *</label>
      <input className="h-12 border border-red-200 rounded-xl px-4 text-sm font-black outline-none" placeholder="ENTER ORDER NO. & ENTER" value={data.saleOrder || ''} onChange={(e) => onChange({ ...data, saleOrder: e.target.value.toUpperCase() })} onKeyDown={handleKeyDown} />
    </div>
    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[2rem]">
      <DetailRow label="Consignor" value={data.consignor} />
      <DetailRow label="From" value={data.from} />
      <DetailRow label="Consignee" value={data.consignee} />
      <DetailRow label="Ship To Party" value={data.shipToParty} />
      <DetailRow label="Destination" value={data.destination} />
      <DetailRow label="Product Name" value={data.productName} />
      <DetailRow label="Weight" value={data.weight} />
    </div>
    <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400">Reason *</label><textarea className="w-full min-h-[100px] rounded-2xl border border-slate-200 p-4 font-bold" value={data.reason || ''} onChange={(e) => onChange({ ...data, reason: e.target.value })} /></div>
    <div className="flex justify-end gap-4"><Button onClick={onCancel} variant="ghost" className="font-black uppercase text-[10px]">Cancel</Button><Button onClick={onPost} className="bg-red-600 hover:bg-black text-white font-black uppercase text-[10px] px-8 h-12">Post Cancellation</Button></div>
  </div>;
}

function UserForm({ data, onChange, disabled, allPlants }: any) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
    <FormInput label="Full Name" value={data.fullName} onChange={(v: string) => onChange({...data, fullName: v})} disabled={disabled} />
    <FormInput label="Username" value={data.username} onChange={(v: string) => onChange({...data, username: v})} disabled={disabled} />
  </div>;
}

function RegistryList({ onSelectItem, listData }: any) {
  return (
    <div className="overflow-x-auto border border-slate-300">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#f0f0f0] border-b border-slate-300"><tr>{['Registry ID', 'Name / Node Description', 'Type / Details', 'Sync Node'].map(c => <th key={c} className="p-2 text-[9px] font-black uppercase text-slate-500">{c}</th>)}</tr></thead>
        <tbody>{listData?.map((item: any) => (
          <tr key={item.id} onClick={() => onSelectItem(item)} className="border-b border-slate-200 hover:bg-[#e8f0fe] cursor-pointer"><td className="p-2 text-[10px] font-black text-[#0056d2]">{item.saleOrder || item.plantCode || item.customerCode || item.id.slice(0, 8)}</td><td className="p-2 text-[10px] font-bold uppercase">{item.customerName || item.plantName || `${item.consignor} → ${item.consignee}`}</td><td className="p-2 text-[10px] italic">{item.city || item.customerType || 'REGISTRY'}</td><td className="p-2 text-[10px] font-bold text-slate-400">{format(new Date(item.updatedAt || new Date()), 'dd-MM-yyyy')}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function DripBoard({ orders, trips, onStatusUpdate, plants, onPrintLR, onPrintCN }: { orders: any[] | null, trips: any[] | null, onStatusUpdate: any, plants: any[] | null, onPrintLR: any, onPrintCN: any }) {
  const { user } = useUser();
  const db = useFirestore();
  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [viewTrip, setViewTrip] = React.useState<any>(null);
  const [editingTrip, setEditingTrip] = React.useState<any>(null);
  const [assignWeight, setAssignWeight] = React.useState('');
  const [vehicleNo, setVehicleNo] = React.useState('');
  const [driverMobile, setDriverMobile] = React.useState('');

  const handleAssign = () => {
    if (!user || !selectedOrder) return;
    const tripId = `T${Math.floor(100000000 + Math.random() * 900000000)}`;
    const newId = crypto.randomUUID();
    const payload = {
      id: newId, tripId, saleOrderId: selectedOrder.id, saleOrder: selectedOrder.saleOrder,
      plantCode: selectedOrder.plantCode, consignor: selectedOrder.consignor, consignee: selectedOrder.consignee,
      vehicleNumber: vehicleNo, driverMobile, assignWeight: parseFloat(assignWeight),
      status: 'LOADING', createdAt: new Date().toISOString(),
      lrNo: selectedOrder.lrNo || '', lrDate: selectedOrder.lrDate || '',
      invoiceNumber: selectedOrder.items?.[0]?.invoiceNumber || '',
      product: selectedOrder.items?.[0]?.product || 'SALT',
      weightUom: selectedOrder.items?.[0]?.weightUom || 'MT',
      shipToParty: selectedOrder.shipToParty || '',
      route: `${selectedOrder.from || 'Sikka'}--${selectedOrder.destination || 'Unloaded'}`,
      cnNo: '', cnDate: '', paymentMode: 'To Pay'
    };
    setDocumentNonBlocking(doc(db, 'users', user.uid, 'trips', newId), payload, { merge: true });
    setSelectedOrder(null);
    onStatusUpdate({ text: `Mission ${tripId} created`, type: 'success' });
  };

  const handleUpdateCn = () => {
    if (!user || !editingTrip) return;
    setDocumentNonBlocking(doc(db, 'users', user.uid, 'trips', editingTrip.id), editingTrip, { merge: true });
    setEditingTrip(null);
    onStatusUpdate({ text: `CN Registry Node synchronized`, type: 'success' });
  };

  const getTripsByStatus = (status: string) => (trips || []).filter(t => t.status === status && (plantFilter === 'ALL' || t.plantCode === plantFilter));

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4 shadow-sm">
        <Filter className="h-4 w-4 text-slate-400" />
        <select className="bg-slate-50 border-none rounded-lg h-9 px-4 font-bold text-xs" value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)}>
          <option value="ALL">ALL PLANTS</option>
          {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}
        </select>
      </div>
      <Tabs defaultValue="OPEN">
        <TabsList className="bg-slate-100 rounded-2xl w-full justify-start overflow-x-auto gap-1 h-12 p-1">
          {['OPEN', 'LOADING', 'IN-TRANSIT', 'ARRIVED', 'POD', 'CLOSED'].map(s => (
            <TabsTrigger key={s} value={s} className="rounded-xl px-6 font-black text-[10px] uppercase data-[state=active]:bg-[#0056d2] data-[state=active]:text-white text-slate-600 h-10">{s} ({s === 'OPEN' ? orders?.filter(o => (plantFilter === 'ALL' || o.plantCode === plantFilter) && o.status !== 'CANCELLED').length : getTripsByStatus(s).length})</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="OPEN" className="mt-6 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b"><tr><th className="p-4 text-[9px] font-black uppercase text-slate-400">Order Node</th><th className="p-4 text-[9px] font-black uppercase text-slate-400">Details</th><th className="p-4 text-[9px] font-black uppercase text-slate-400 text-center">Action</th></tr></thead>
            <tbody>{orders?.filter(o => (plantFilter === 'ALL' || o.plantCode === plantFilter) && o.status !== 'CANCELLED').map(o => (
              <tr key={o.id} className="border-b hover:bg-slate-50 transition-colors">
                <td className="p-4 font-black text-xs text-[#0056d2]">{o.saleOrder || o.id.slice(0,8)}</td>
                <td className="p-4 font-bold text-[10px] uppercase">{o.consignor} → {o.consignee}</td>
                <td className="p-4 text-center"><Button onClick={() => setSelectedOrder(o)} className="bg-[#0056d2] text-white h-8 px-4 text-[9px] font-black uppercase rounded-xl">Assign vehicle</Button></td>
              </tr>
            ))}</tbody>
          </table>
        </TabsContent>
        {['LOADING', 'IN-TRANSIT', 'ARRIVED', 'POD', 'CLOSED'].map(s => (
          <TabsContent key={s} value={s} className="space-y-4 mt-6">
            {getTripsByStatus(s).map(t => {
              const parentOrder = orders?.find(o => o.id === t.saleOrderId);
              const lrVal = t.lrNo || parentOrder?.lrNo || '--';
              const invVal = t.invoiceNumber || parentOrder?.items?.[0]?.invoiceNumber || '--';
              const cnVal = t.cnNo || '--';
              return (
                <div key={t.id} className="bg-white border rounded-lg p-6 shadow-sm flex flex-col lg:flex-row gap-6 items-center">
                  <div className="flex flex-col gap-1 min-w-[140px]">
                    <span className="text-[#0056d2] font-black text-xs">#{t.tripId}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">SO: {t.saleOrder || 'N/A'}</span>
                    <button onClick={() => onPrintLR(t, parentOrder)} className="text-[#0056d2] font-black text-[8px] uppercase hover:underline text-left">LR: {lrVal}</button>
                    <span className="text-[8px] font-black text-slate-400 uppercase">INV: {invVal}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <button 
                        onClick={() => cnVal !== '--' && onPrintCN(t, parentOrder)} 
                        className={cn("font-black text-[9px] uppercase", cnVal === '--' ? "text-slate-300 cursor-default" : "text-emerald-600 hover:underline")}
                      >
                        CN: {cnVal}
                      </button>
                      <button onClick={() => setEditingTrip(t)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"><Edit3 className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col"><span className="text-[8px] uppercase text-slate-400 font-black">Consignor</span><span className="text-[10px] font-black uppercase truncate">{t.consignor}</span></div>
                    <div className="flex flex-col"><span className="text-[8px] uppercase text-slate-400 font-black">Consignee</span><span className="text-[10px] font-black uppercase truncate">{t.consignee}</span></div>
                    <div className="flex flex-col"><span className="text-[8px] uppercase text-slate-400 font-black">Vehicle</span><span className="text-[10px] font-black uppercase">{t.vehicleNumber}</span></div>
                    <div className="flex flex-col"><span className="text-[8px] uppercase text-slate-400 font-black">Qty</span><span className="text-[10px] font-black">{t.assignWeight} {t.weightUom}</span></div>
                  </div>
                  <div className="flex gap-2"><Button onClick={() => setViewTrip(t)} variant="outline" className="h-8 text-[9px] font-black uppercase rounded-xl">View Node</Button></div>
                </div>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>

      {/* DIALOGS */}
      <Dialog open={!!editingTrip} onOpenChange={() => setEditingTrip(null)}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 font-mono">
          <div className="bg-[#1e3a8a] p-6 text-white text-center"><DialogTitle className="text-lg font-black uppercase italic tracking-tighter">Edit CN Registry Node</DialogTitle></div>
          <div className="p-8 space-y-4">
            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">CN Number</label><Input value={editingTrip?.cnNo || ''} onChange={(e) => setEditingTrip({ ...editingTrip, cnNo: e.target.value.toUpperCase() })} placeholder="CN-XXXXXX" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">CN Date</label><Input type="date" value={editingTrip?.cnDate || ''} onChange={(e) => setEditingTrip({ ...editingTrip, cnDate: e.target.value })} /></div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Payment Mode</label>
              <select className="w-full h-10 border border-slate-200 rounded-lg px-3 text-xs font-bold" value={editingTrip?.paymentMode || 'To Pay'} onChange={(e) => setEditingTrip({ ...editingTrip, paymentMode: e.target.value })}>
                <option value="Paid">Paid</option>
                <option value="To Pay">To Pay</option>
              </select>
            </div>
          </div>
          <DialogFooter className="p-6 border-t"><Button onClick={handleUpdateCn} className="bg-[#1e3a8a] hover:bg-black text-white px-8 h-12 rounded-xl font-black uppercase text-[10px]">Sync Registry</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-xl rounded-[2rem] border-none shadow-2xl p-0 font-mono">
          <div className="bg-[#0056d2] p-6 text-white text-center"><DialogTitle className="text-lg font-black uppercase italic tracking-tighter">Assign Mission Vehicle</DialogTitle></div>
          <div className="p-8 space-y-4">
            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">Vehicle No.</label><Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} placeholder="UP14-XX-0000" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">Weight</label><Input value={assignWeight} onChange={(e) => setAssignWeight(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">Driver Mobile</label><Input value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} placeholder="+91..." /></div>
          </div>
          <DialogFooter className="p-6 border-t"><Button onClick={handleAssign} className="bg-[#0056d2] hover:bg-black text-white px-8 h-12 rounded-xl font-black uppercase text-[10px]">Assign Mission</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTrip} onOpenChange={() => setViewTrip(null)}>
        <DialogContent className="max-w-xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-mono">
          <div className="bg-[#0056d2] p-6 text-white flex flex-col items-center">
            <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Mission Registry Hub</DialogTitle>
            <span className="text-[10px] font-bold text-white/60 tracking-widest mt-1">NODE: {viewTrip?.tripId}</span>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 gap-4"><SectionHeader title="Mission Consignment" /><DetailRow label="Consignor" value={viewTrip?.consignor} /><DetailRow label="Consignee" value={viewTrip?.consignee} /><DetailRow label="Ship-to-Party" value={viewTrip?.shipToParty} /></div>
            <div className="grid grid-cols-1 gap-4"><SectionHeader title="Official Documentation" /><DetailRow label="LR Number" value={viewTrip?.lrNo} /><DetailRow label="Invoice" value={viewTrip?.invoiceNumber} /><DetailRow label="Route" value={viewTrip?.route} /></div>
            <div className="grid grid-cols-1 gap-4"><SectionHeader title="Mission Specs" /><DetailRow label="Vehicle No" value={viewTrip?.vehicleNumber} /><DetailRow label="Assigned Qty" value={`${viewTrip?.assignWeight} ${viewTrip?.weightUom}`} /></div>
          </div>
          <DialogFooter className="p-6 border-t"><Button onClick={() => setViewTrip(null)} className="w-full bg-slate-900 hover:bg-black text-white h-12 rounded-xl font-black uppercase text-[10px]">Close Node</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BulkDataHub({ allPlants }: any) {
  const [mod, setMod] = React.useState('');
  const [plant, setPlant] = React.useState('');
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-6xl mx-auto">
      <div className="bg-white rounded-[2rem] shadow-xl border overflow-hidden flex flex-col">
        <div className="bg-[#1e293b] p-6 text-white font-black uppercase italic text-sm">Template Repository Node</div>
        <div className="p-8 space-y-4 flex-1">
          {['Customer Registry', 'Sales Order Registry'].map(t => <button key={t} className="w-full flex justify-between items-center p-4 bg-slate-50 border rounded-xl hover:bg-blue-50 transition-colors text-xs font-black uppercase">{t} <Download className="h-4 w-4" /></button>)}
        </div>
      </div>
      <div className="bg-white rounded-[2rem] shadow-xl border overflow-hidden flex flex-col">
        <div className="bg-[#0056d2] p-6 text-white font-black uppercase italic text-sm">Mission Sync Hub</div>
        <div className="p-8 space-y-6 flex-1">
          <select className="w-full h-11 bg-slate-50 border rounded-xl px-4 text-xs font-bold outline-none" value={mod} onChange={(e) => setMod(e.target.value)}>
            <option value="">Select Registry Node...</option><option value="XD">CUSTOMER REGISTRY</option><option value="VA">SALES ORDER REGISTRY</option>
          </select>
          {mod === 'VA' && <select className="w-full h-11 bg-slate-50 border rounded-xl px-4 text-xs font-bold outline-none" value={plant} onChange={(e) => setPlant(e.target.value)}><option value="">Select Plant Node...</option>{allPlants?.map((p: any) => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}</select>}
          <div className="flex-1 border-4 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center p-10 hover:bg-blue-50/30 transition-all cursor-pointer"><Upload className="h-10 w-10 text-slate-200 mb-2" /><p className="text-[10px] font-black uppercase text-slate-400">Drag & Drop Registry File</p></div>
          <Button className="w-full h-14 bg-blue-900 text-white font-black uppercase text-[10px] rounded-2xl">Initiate Bulk Sync</Button>
        </div>
      </div>
    </div>
  );
}
