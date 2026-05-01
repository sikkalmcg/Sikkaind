
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Printer, Save, RotateCcw, X, HelpCircle, LogOut,
  ChevronRight, Check, AlertCircle, Info, PlusCircle, Trash2,
  Grid2X2, Upload, Download, ShoppingBag, ArrowUpRight,
  Filter, Truck, MapPin, User, Users, DollarSign, Activity,
  Layers, PackageCheck, Ban, Lock, Play, XCircle, Search,
  ArrowLeft, Calendar, Phone, FileText, Package, Clock,
  LayoutDashboard, Database, Settings, BarChart, TrendingUp,
  FileSpreadsheet, HardDriveDownload, CloudUpload, ShieldAlert,
  AlertTriangle, Radar, Loader2, Edit3, FileDown,
  Monitor, Share2, Copy, Eraser, Undo2
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import placeholderData from '@/app/lib/placeholder-images.json';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'VA04' | 'TR21' | 'BULK' | 'SU01' | 'SU02' | 'SU03';

const MASTER_TCODES = [
  { code: 'OX01', description: 'PLANT MASTER: CREATE INITIAL SCREEN', icon: Database },
  { code: 'OX02', description: 'PLANT MASTER: CHANGE REGISTRY', icon: Edit3 },
  { code: 'OX03', description: 'PLANT MASTER: DISPLAY NODE', icon: Info },
  { code: 'FM01', description: 'COMPANY MASTER: CREATE INITIAL SCREEN', icon: Layers },
  { code: 'FM02', description: 'COMPANY MASTER: CHANGE REGISTRY', icon: Edit3 },
  { code: 'FM03', description: 'COMPANY MASTER: DISPLAY NODE', icon: Info },
  { code: 'XK01', description: 'VENDOR MASTER: CREATE INITIAL SCREEN', icon: User },
  { code: 'XK02', description: 'VENDOR MASTER: CHANGE REGISTRY', icon: Edit3 },
  { code: 'XK03', description: 'VENDOR MASTER: DISPLAY NODE', icon: Info },
  { code: 'XD01', description: 'CUSTOMER MASTER: CREATE INITIAL SCREEN', icon: Users },
  { code: 'XD02', description: 'CUSTOMER MASTER: CHANGE REGISTRY', icon: Edit3 },
  { code: 'XD03', description: 'CUSTOMER MASTER: DISPLAY NODE', icon: Info },
  { code: 'VA01', description: 'SALES ORDER REGISTRY: CREATE INITIAL SCREEN', icon: ShoppingBag },
  { code: 'VA02', description: 'SALES ORDER REGISTRY: CHANGE NODE', icon: Edit3 },
  { code: 'VA03', description: 'SALES ORDER REGISTRY: DISPLAY NODE', icon: Info },
  { code: 'VA04', description: 'CANCEL SALES ORDER REGISTRY', icon: Ban },
  { code: 'TR21', description: 'DRIP BOARD REGISTRY CONTROL', icon: Truck },
  { code: 'BULK', description: 'BULK DATA HUB CONTROL', icon: CloudUpload },
  { code: 'SU01', description: 'USER MANAGEMENT: CREATE INITIAL SCREEN', icon: ShieldAlert },
  { code: 'SU02', description: 'USER MANAGEMENT: CHANGE REGISTRY', icon: Edit3 },
  { code: 'SU03', description: 'USER MANAGEMENT: DISPLAY NODE', icon: Info },
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

  const allPlantsList = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawPlants;
    return rawPlants?.filter(p => authPlants.includes(p.plantCode));
  }, [rawPlants, userProfile]);

  const allCompaniesList = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawCompanies;
    return rawCompanies?.filter(c => authPlants.includes(c.plantCode));
  }, [rawCompanies, userProfile]);

  const allVendorsList = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (!authPlants.length) return rawVendors;
    return rawVendors?.filter(v => v.plantCodes?.some((p: string) => authPlants.includes(p)));
  }, [rawVendors, userProfile]);

  const allCustomersList = React.useMemo(() => {
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
    if (activeScreen.startsWith('OX')) return allPlantsList;
    if (activeScreen.startsWith('FM')) return allCompaniesList;
    if (activeScreen.startsWith('XK')) return allVendorsList;
    if (activeScreen.startsWith('XD')) return allCustomersList;
    if (activeScreen.startsWith('VA')) return recentOrders;
    if (activeScreen.startsWith('SU')) return allUsers;
    return [];
  };

  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'slmc-logo');

  return (
    <div className="flex flex-col h-screen w-full bg-[#f0f3f9] text-[#333] font-mono select-none overflow-hidden">
      {/* SAP TOP MENU BAR */}
      <div className="flex items-center bg-[#c5e0b4] border-b border-slate-400 px-3 h-8 text-[11px] font-semibold z-50">
        <div className="flex items-center gap-6">
          {['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map(item => (
            <button key={item} className="hover:text-blue-800 transition-colors uppercase">{item}</button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[10px] text-slate-700 font-bold pr-4">
          <ChevronRight className="h-3 w-3" /> <span>S4P (1) 100</span>
          <div className="flex items-center gap-1.5 ml-4">
            <Monitor className="h-3 w-3" />
            <Share2 className="h-3 w-3" />
            <Copy className="h-3 w-3" />
          </div>
        </div>
      </div>

      {/* SAP COMMAND BAR */}
      <div className="flex flex-col bg-[#f0f0f0] border-b border-slate-300 shadow-sm z-40">
        <div className="flex items-center px-2 py-1 gap-4">
          <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-slate-300">
             {logoAsset && (
               <Image src={logoAsset.url} alt="SLMC" width={80} height={30} className="object-contain" unoptimized />
             )}
          </div>
          <div className="flex items-center bg-white border border-slate-400 p-0.5 shadow-inner">
            <button onClick={() => executeTCode(tCode)} className="px-1 text-[#008000] font-black text-xs hover:bg-slate-100 transition-colors">✓</button>
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
          <div className="flex items-center gap-1.5 px-4 border-l border-slate-300 ml-2 h-7">
             <button onClick={handleSave} className="p-1 hover:bg-slate-200 rounded group"><Save className="h-4 w-4 text-slate-600" /></button>
             <button onClick={() => setTCode('')} className="p-1 hover:bg-slate-200 rounded group"><Undo2 className="h-4 w-4 text-slate-600" /></button>
             <button onClick={() => setFormData({})} className="p-1 hover:bg-slate-200 rounded group"><Eraser className="h-4 w-4 text-slate-600" /></button>
             <button className="p-1 hover:bg-slate-200 rounded group ml-4"><Filter className="h-4 w-4 text-slate-600" /></button>
             <button className="p-1 hover:bg-slate-200 rounded group"><Database className="h-4 w-4 text-slate-600" /></button>
             <button className="p-1 hover:bg-slate-200 rounded group"><Activity className="h-4 w-4 text-slate-600" /></button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 pr-4">
             <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Search className="h-4 w-4" /></button>
             <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Printer className="h-4 w-4" /></button>
             <button onClick={handleLogout} className="flex items-center gap-2 px-3 h-7 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-black uppercase tracking-widest text-slate-700">
               <LogOut className="h-3.5 w-3.5" /> Log Off
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR FAVORITES */}
        <div className="w-72 bg-white border-r border-slate-300 flex flex-col overflow-y-auto no-scrollbar">
          <div className="p-4 border-b border-slate-200 bg-[#dae4f1]/50">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1e3a8a] flex items-center gap-2">
              <Grid2X2 className="h-3.5 w-3.5" /> Favorites Registry
            </h2>
          </div>
          <div className="flex flex-col">
            {MASTER_TCODES.filter(t => t.code.endsWith('01') || t.code === 'TR21' || t.code === 'VA04' || t.code === 'BULK').map((item) => (
              <div 
                key={item.code} 
                onClick={() => executeTCode(item.code)}
                className={cn(
                  "flex items-center gap-4 px-5 py-3 hover:bg-blue-50 cursor-pointer group border-b border-slate-50 transition-all",
                  activeScreen === item.code ? "bg-[#0056d2] text-white" : "text-[#1e3a8a]"
                )}
              >
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  activeScreen === item.code ? "bg-white" : "bg-slate-300 group-hover:bg-blue-600"
                )} />
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-tight",
                  activeScreen === item.code ? "text-white" : "text-[#1e3a8a]"
                )}>
                  {item.code} - {item.description.split(':')[0]}
                </span>
                <div className="flex-1" />
                <item.icon className={cn("h-3.5 w-3.5", activeScreen === item.code ? "text-white" : "text-slate-400")} />
              </div>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f3f9]">
          {activeScreen !== 'HOME' && (
             <div className="bg-[#0056d2] text-white py-3 px-6 shadow-md flex items-center gap-4 shrink-0">
                <Badge className="bg-white/20 text-white rounded-none font-black italic">{activeScreen}</Badge>
                <h1 className="text-lg font-black italic tracking-tighter uppercase leading-none">
                  {MASTER_TCODES.find(t => t.code === activeScreen)?.description}
                </h1>
             </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 relative">
            {activeScreen === 'HOME' ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8">
                <div className="relative w-full max-w-[1100px] aspect-video shadow-2xl rounded-sm overflow-hidden border-8 border-white group">
                   <Image 
                    src="https://picsum.photos/seed/sikka-team/1200/800" 
                    alt="Sikka Logistics Hub" 
                    fill 
                    className="object-cover transition-transform duration-1000 group-hover:scale-105"
                    data-ai-hint="logistics operations"
                    unoptimized
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-12">
                      <h2 className="text-white text-5xl font-black italic tracking-tighter uppercase leading-none mb-2">Sikka Logistics Hub</h2>
                      <p className="text-white/80 font-bold uppercase tracking-[0.4em] text-xs">Mission Operations & Registry Control</p>
                   </div>
                </div>
              </div>
            ) : (
              <div className="bg-white shadow-xl rounded-sm border border-slate-300 overflow-hidden animate-slide-up w-full min-h-[600px] p-6 max-w-[1400px] mx-auto">
                 {showForm && (
                   <div className="space-y-6">
                     {activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                     {activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                     {activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                     {activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                     {activeScreen.startsWith('VA') && activeScreen !== 'VA04' && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} allCustomers={rawCustomers} />}
                     {activeScreen === 'VA04' && <CancelOrderForm data={formData} onChange={setFormData} allOrders={rawOrders} onPost={handleSave} onCancel={() => setFormData({})} />}
                     {activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                   </div>
                 )}
                 {showList && <RegistryList onSelectItem={setFormData} listData={getRegistryList()} />}
                 {activeScreen === 'TR21' && <DripBoard orders={rawOrders} trips={allTrips} onStatusUpdate={setStatusMsg} plants={allPlants} onPrintLR={handlePrintLR} onPrintCN={handlePrintCN} />}
                 {activeScreen === 'BULK' && <BulkDataHub allPlants={rawPlants} />}
              </div>
            )}
          </div>

          {/* SAP STATUS BAR */}
          <div className="h-6 bg-[#0f172a] flex items-center px-4 text-[9px] font-black text-white/70 uppercase tracking-widest shrink-0">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]" /> MISSION SYNC: ACTIVE</span>
              <span>NODE: {activeScreen}</span>
              <span>USER: {userProfile?.username || 'GUEST'}</span>
              <span>{statusMsg.text !== 'Ready' && `| EVENT: ${statusMsg.text}`}</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <span>PRD</span>
              <span>INS</span>
            </div>
          </div>
        </div>
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
  );
}

// SAP COMPONENT ABSTRACTIONS

function SectionGrouping({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="border border-slate-300 p-5 pt-4 relative bg-slate-50/30 rounded-sm">
      <span className="absolute -top-3 left-4 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-200 shadow-sm">
        {title}
      </span>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string, value?: string | number }) {
  return <div className="grid grid-cols-3 gap-4 py-2 border-b border-slate-100 last:border-none"><span className="text-[9px] font-black uppercase text-slate-400">{label}</span><span className="col-span-2 text-[10px] font-bold text-slate-700 uppercase">{value || '--'}</span></div>;
}

function FormInput({ label, value, onChange, type = "text", disabled }: any) {
  return <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label><Input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-9 rounded-none border-slate-400 text-xs font-bold bg-white focus:ring-1 focus:ring-blue-600 shadow-sm" /></div>;
}

function FormSelect({ label, value, options, onChange, disabled }: any) {
  return <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label><select value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-9 border border-slate-400 bg-white px-2 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-600 shadow-sm"><option value="">Select...</option>{options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select></div>;
}

function PlantForm({ data, onChange, disabled }: any) {
  return (
    <div className="space-y-8">
      <SectionGrouping title="Database Selection Node">
        <FormInput label="Plant Code" value={data.plantCode} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
        <FormInput label="Plant Name" value={data.plantName} onChange={(v: string) => onChange({...data, plantName: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="Settings / Registry Node">
        <FormInput label="City" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
        <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function CompanyForm({ data, onChange, disabled }: any) {
  return (
    <div className="space-y-8">
      <SectionGrouping title="Database Selection Node">
        <FormInput label="Company Code" value={data.companyCode} onChange={(v: string) => onChange({...data, companyCode: v})} disabled={disabled} />
        <FormInput label="Company Name" value={data.companyName} onChange={(v: string) => onChange({...data, companyName: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function VendorForm({ data, onChange, disabled }: any) {
  return (
    <div className="space-y-8">
      <SectionGrouping title="Database Selection Node">
        <FormInput label="Vendor Name" value={data.vendorName} onChange={(v: string) => onChange({...data, vendorName: v})} disabled={disabled} />
        <FormInput label="Mobile" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function CustomerForm({ data, onChange, disabled }: any) {
  return (
    <div className="space-y-8">
      <SectionGrouping title="Database Selection Node">
        <FormInput label="Customer Code" value={data.customerCode} onChange={(v: string) => onChange({...data, customerCode: v})} disabled={disabled} />
        <FormInput label="Customer Name" value={data.customerName} onChange={(v: string) => onChange({...data, customerName: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="Stock Type / Registry">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Customer Role</label>
          <RadioGroup 
            value={data.customerType || 'Consignor'} 
            onValueChange={(v) => onChange({...data, customerType: v})}
            disabled={disabled}
            className="flex gap-6 mt-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Consignor" id="consignor" />
              <Label htmlFor="consignor" className="text-[11px] font-bold uppercase">Consignor</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Consignee" id="consignee" />
              <Label htmlFor="consignee" className="text-[11px] font-bold uppercase">Consignee</Label>
            </div>
          </RadioGroup>
        </div>
      </SectionGrouping>
    </div>
  );
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

  return (
    <div className="space-y-10">
      <SectionGrouping title="Database Selection Node">
        <FormSelect label="Plant Code" value={data.plantCode} options={plantOpts} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
        <FormInput label="LR Number" value={data.lrNo} onChange={(v: string) => onChange({...data, lrNo: v})} disabled={disabled} />
        <FormInput label="LR Date" value={data.lrDate} type="date" onChange={(v: string) => onChange({...data, lrDate: v})} disabled={disabled} />
        <FormInput label="Sale Order No" value={data.saleOrder} onChange={(v: string) => onChange({...data, saleOrder: v})} disabled={disabled} />
      </SectionGrouping>
      <SectionGrouping title="Mission Coordination Node">
        <FormSelect label="Consignor" value={data.consignor} options={consignors} onChange={(v: string) => onChange({...data, consignor: v})} disabled={disabled} />
        <FormSelect label="Consignee" value={data.consignee} options={consignees} onChange={(v: string) => onChange({...data, consignee: v})} disabled={disabled} />
        <FormSelect label="Ship To Party" value={data.shipToParty} options={shipto} onChange={(v: string) => onChange({...data, shipToParty: v})} disabled={disabled} />
        <FormSelect label="From City" value={data.from} options={cities} onChange={(v: string) => onChange({...data, from: v})} disabled={disabled} />
        <FormSelect label="Destination" value={data.destination} options={cities} onChange={(v: string) => onChange({...data, destination: v})} disabled={disabled} />
      </SectionGrouping>
      <div className="space-y-4">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-200 px-3 py-1 shadow-sm">Product Registry Hub</span>
        <table className="w-full text-left border-collapse border border-slate-300 text-[10px] shadow-sm">
          <thead className="bg-[#f0f0f0]"><tr><th className="p-3 border border-slate-300">Product</th><th className="p-3 border border-slate-300">Weight</th><th className="p-3 border border-slate-300">Invoice No</th></tr></thead>
          <tbody>{(data.items || [{ product: 'SALT', weight: '', weightUom: 'MT', invoiceNumber: '' }]).map((item: any, idx: number) => (
            <tr key={idx}>
              <td className="p-2 border border-slate-300"><input className="w-full outline-none p-1 font-bold" value={item.product || ''} onChange={(e) => {
                const items = [...(data.items || [{ product: 'SALT' }])];
                items[idx] = { ...items[idx], product: e.target.value };
                onChange({ ...data, items });
              }} disabled={disabled} /></td>
              <td className="p-2 border border-slate-300"><input className="w-full outline-none p-1 font-bold" value={item.weight || ''} onChange={(e) => {
                const items = [...(data.items || [{ product: 'SALT' }])];
                items[idx] = { ...items[idx], weight: e.target.value };
                onChange({ ...data, items });
              }} disabled={disabled} /></td>
              <td className="p-2 border border-slate-300"><input className="w-full outline-none p-1 font-bold" value={item.invoiceNumber || ''} onChange={(e) => {
                const items = [...(data.items || [{ product: 'SALT' }])];
                items[idx] = { ...items[idx], invoiceNumber: e.target.value };
                onChange({ ...data, items });
              }} disabled={disabled} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
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
  return (
    <div className="space-y-8">
      <SectionGrouping title="Database Selection Node">
        <div className="flex flex-col gap-2 col-span-2">
          <label className="text-[11px] font-black uppercase text-red-600">Sales Order Number *</label>
          <input className="h-12 border border-red-200 rounded-none px-4 text-sm font-black outline-none focus:ring-2 focus:ring-red-600 bg-red-50/30" placeholder="ENTER ORDER NO. & PRESS ENTER" value={data.saleOrder || ''} onChange={(e) => onChange({ ...data, saleOrder: e.target.value.toUpperCase() })} onKeyDown={handleKeyDown} />
        </div>
      </SectionGrouping>
      <SectionGrouping title="Mission Registry Overview">
        <DetailRow label="Consignor" value={data.consignor} />
        <DetailRow label="From" value={data.from} />
        <DetailRow label="Consignee" value={data.consignee} />
        <DetailRow label="Destination" value={data.destination} />
        <DetailRow label="Product Name" value={data.productName} />
        <DetailRow label="Weight" value={data.weight} />
      </SectionGrouping>
      <SectionGrouping title="Settings / Cancellation Reason">
        <textarea className="w-full min-h-[120px] rounded-none border border-slate-300 p-4 font-bold text-xs outline-none focus:ring-1 focus:ring-blue-600 col-span-2" value={data.reason || ''} onChange={(e) => onChange({ ...data, reason: e.target.value })} placeholder="State mandatory cancellation reason..." />
      </SectionGrouping>
      <div className="flex justify-end gap-4">
        <Button onClick={onCancel} variant="ghost" className="font-black uppercase text-[10px]">Exit</Button>
        <Button onClick={onPost} className="bg-red-600 hover:bg-black text-white font-black uppercase text-[10px] px-10 h-11 rounded-none shadow-lg">Execute Cancellation</Button>
      </div>
    </div>
  );
}

function UserForm({ data, onChange, disabled, allPlants }: any) {
  return (
    <div className="space-y-8">
      <SectionGrouping title="Database Selection Node">
        <FormInput label="Full Name" value={data.fullName} onChange={(v: string) => onChange({...data, fullName: v})} disabled={disabled} />
        <FormInput label="Username" value={data.username} onChange={(v: string) => onChange({...data, username: v})} disabled={disabled} />
      </SectionGrouping>
    </div>
  );
}

function RegistryList({ onSelectItem, listData }: any) {
  return (
    <div className="overflow-x-auto border border-slate-300 shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#f0f0f0] border-b border-slate-300"><tr>{['Registry ID', 'Name / Node Description', 'Type / Details', 'Sync Node'].map(c => <th key={c} className="p-3 text-[10px] font-black uppercase text-slate-500 border-r border-slate-200">{c}</th>)}</tr></thead>
        <tbody>{listData?.map((item: any) => (
          <tr key={item.id} onClick={() => onSelectItem(item)} className="border-b border-slate-200 hover:bg-[#e8f0fe] cursor-pointer transition-colors"><td className="p-3 text-[11px] font-black text-[#0056d2]">{item.saleOrder || item.plantCode || item.customerCode || item.id.slice(0, 8)}</td><td className="p-3 text-[11px] font-bold uppercase">{item.customerName || item.plantName || `${item.consignor} → ${item.consignee}`}</td><td className="p-3 text-[11px] italic text-slate-500">{item.city || item.customerType || 'REGISTRY'}</td><td className="p-3 text-[11px] font-bold text-slate-400">{format(new Date(item.updatedAt || new Date()), 'dd-MM-yyyy')}</td></tr>
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
    <div className="space-y-8">
      {/* TOP FILTER PANEL - SAP Standard */}
      <SectionGrouping title="Database Selection / Filters">
        <div className="flex items-center gap-4 col-span-2">
          <Filter className="h-4 w-4 text-[#1e3a8a]" />
          <select className="bg-white border border-slate-400 rounded-none h-9 px-4 font-bold text-xs outline-none flex-1 shadow-sm" value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)}>
            <option value="ALL">ALL PLANTS REGISTRY</option>
            {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}
          </select>
          <Button variant="outline" className="h-9 text-[10px] font-black uppercase rounded-none px-6">Refresh Hub</Button>
        </div>
      </SectionGrouping>

      <Tabs defaultValue="OPEN">
        <TabsList className="bg-slate-100 rounded-none w-full justify-start overflow-x-auto gap-0 h-12 p-0 border border-slate-300 shadow-sm">
          {['OPEN', 'LOADING', 'IN-TRANSIT', 'ARRIVED', 'POD', 'CLOSED'].map(s => (
            <TabsTrigger key={s} value={s} className="rounded-none px-8 font-black text-[10px] uppercase data-[state=active]:bg-[#0056d2] data-[state=active]:text-white text-slate-600 h-12 border-r border-slate-300 last:border-none">{s} ({s === 'OPEN' ? orders?.filter(o => (plantFilter === 'ALL' || o.plantCode === plantFilter) && o.status !== 'CANCELLED').length : getTripsByStatus(s).length})</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="OPEN" className="mt-8 bg-white border border-slate-300 shadow-xl overflow-hidden rounded-sm">
          <table className="w-full text-left">
            <thead className="bg-[#f0f0f0] border-b border-slate-300"><tr><th className="p-4 text-[10px] font-black uppercase text-slate-500 border-r border-slate-200">Order Node</th><th className="p-4 text-[10px] font-black uppercase text-slate-500 border-r border-slate-200">Registry Details</th><th className="p-4 text-[10px] font-black uppercase text-slate-500 text-center">Action</th></tr></thead>
            <tbody>{orders?.filter(o => (plantFilter === 'ALL' || o.plantCode === plantFilter) && o.status !== 'CANCELLED').map(o => (
              <tr key={o.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-black text-[11px] text-[#0056d2]">{o.saleOrder || o.id.slice(0,8)}</td>
                <td className="p-4 font-bold text-[11px] uppercase">{o.consignor} → {o.consignee}</td>
                <td className="p-4 text-center"><Button onClick={() => setSelectedOrder(o)} className="bg-[#0056d2] text-white h-9 px-6 text-[10px] font-black uppercase rounded-none hover:bg-black shadow-md">Assign Mission</Button></td>
              </tr>
            ))}</tbody>
          </table>
        </TabsContent>
        {['LOADING', 'IN-TRANSIT', 'ARRIVED', 'POD', 'CLOSED'].map(s => (
          <TabsContent key={s} value={s} className="space-y-6 mt-8">
            {getTripsByStatus(s).map(t => {
              const parentOrder = orders?.find(o => o.id === t.saleOrderId);
              const lrVal = t.lrNo || parentOrder?.lrNo || '--';
              const invVal = t.invoiceNumber || parentOrder?.items?.[0]?.invoiceNumber || '--';
              const cnVal = t.cnNo || '--';
              return (
                <div key={t.id} className="bg-white border border-slate-300 rounded-none p-8 shadow-sm flex flex-col lg:flex-row gap-8 items-center border-l-8 border-l-[#0056d2]">
                  <div className="flex flex-col gap-1 min-w-[160px]">
                    <span className="text-[#0056d2] font-black text-sm tracking-tighter">MISSION #{t.tripId}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SO REG: {t.saleOrder || 'N/A'}</span>
                    <button onClick={() => onPrintLR(t, parentOrder)} className="text-[#0056d2] font-black text-[10px] uppercase hover:underline text-left mt-2">LR: {lrVal}</button>
                    <span className="text-[10px] font-black text-slate-400 uppercase">INV: {invVal}</span>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                      <button 
                        onClick={() => cnVal !== '--' && onPrintCN(t, parentOrder)} 
                        className={cn("font-black text-[10px] uppercase", cnVal === '--' ? "text-slate-300 cursor-default" : "text-emerald-600 hover:underline")}
                      >
                        CN: {cnVal}
                      </button>
                      <button onClick={() => setEditingTrip(t)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"><Edit3 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div className="flex flex-col"><span className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Consignor</span><span className="text-[11px] font-black uppercase truncate">{t.consignor}</span></div>
                    <div className="flex flex-col"><span className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Consignee</span><span className="text-[11px] font-black uppercase truncate">{t.consignee}</span></div>
                    <div className="flex flex-col"><span className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Vehicle</span><span className="text-[11px] font-black uppercase">{t.vehicleNumber}</span></div>
                    <div className="flex flex-col"><span className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Payload</span><span className="text-[11px] font-black">{t.assignWeight} {t.weightUom}</span></div>
                  </div>
                  <div className="flex gap-3"><Button onClick={() => setViewTrip(t)} variant="outline" className="h-10 text-[10px] font-black uppercase rounded-none border-slate-300 hover:bg-slate-50 px-8 shadow-sm">Details</Button></div>
                </div>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>

      {/* DIALOGS */}
      <Dialog open={!!editingTrip} onOpenChange={() => setEditingTrip(null)}>
        <DialogContent className="max-w-md rounded-none border-none shadow-2xl p-0 font-mono">
          <div className="bg-[#1e3a8a] p-6 text-white text-center"><DialogTitle className="text-lg font-black uppercase italic tracking-tighter">Edit CN Registry Node</DialogTitle></div>
          <div className="p-10 space-y-6">
            <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400">CN Number Registry</label><Input value={editingTrip?.cnNo || ''} onChange={(e) => setEditingTrip({ ...editingTrip, cnNo: e.target.value.toUpperCase() })} placeholder="CN-XXXXXX" className="h-11 rounded-none border-slate-400 font-bold text-xs" /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400">CN Date Registry</label><Input type="date" value={editingTrip?.cnDate || ''} onChange={(e) => setEditingTrip({ ...editingTrip, cnDate: e.target.value })} className="h-11 rounded-none border-slate-400 font-bold text-xs" /></div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Payment Mode Hub</label>
              <select className="w-full h-11 border border-slate-400 rounded-none px-3 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-600" value={editingTrip?.paymentMode || 'To Pay'} onChange={(e) => setEditingTrip({ ...editingTrip, paymentMode: e.target.value })}>
                <option value="Paid">Paid Registry</option>
                <option value="To Pay">To Pay Registry</option>
              </select>
            </div>
          </div>
          <DialogFooter className="p-8 border-t border-slate-100"><Button onClick={handleUpdateCn} className="w-full bg-[#1e3a8a] hover:bg-black text-white px-8 h-12 rounded-none font-black uppercase text-[11px] tracking-widest shadow-lg">Execute Sync</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-xl rounded-none border-none shadow-2xl p-0 font-mono">
          <div className="bg-[#0056d2] p-6 text-white text-center"><DialogTitle className="text-lg font-black uppercase italic tracking-tighter">Assign Mission Vehicle Registry</DialogTitle></div>
          <div className="p-10 space-y-6">
            <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400">Vehicle No. Registry</label><Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} placeholder="UP14-XX-0000" className="h-12 rounded-none border-slate-400 font-black text-sm" /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400">Payload Quantity Hub</label><Input value={assignWeight} onChange={(e) => setAssignWeight(e.target.value)} placeholder="0.00" className="h-12 rounded-none border-slate-400 font-black text-sm" /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400">Driver Contact Node</label><Input value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} placeholder="+91-XXXXX-XXXXX" className="h-12 rounded-none border-slate-400 font-black text-sm" /></div>
          </div>
          <DialogFooter className="p-8 border-t border-slate-100"><Button onClick={handleAssign} className="w-full bg-[#0056d2] hover:bg-black text-white px-8 h-14 rounded-none font-black uppercase text-[11px] tracking-widest shadow-lg">Initiate Mission</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BulkDataHub({ allPlants }: any) {
  const [mod, setMod] = React.useState('');
  const [plant, setPlant] = React.useState('');
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-7xl mx-auto p-4">
      <div className="bg-white rounded-none shadow-xl border border-slate-300 overflow-hidden flex flex-col">
        <div className="bg-[#1e293b] p-6 text-white font-black uppercase italic text-sm tracking-widest">Template Repository Hub</div>
        <div className="p-10 space-y-6 flex-1 bg-slate-50/30">
          {['Customer Master Registry', 'Sales Order Master Registry'].map(t => <button key={t} className="w-full flex justify-between items-center p-5 bg-white border border-slate-300 rounded-none hover:bg-blue-50 transition-colors text-[11px] font-black uppercase tracking-tight">{t} <Download className="h-5 w-5 text-[#0056d2]" /></button>)}
        </div>
      </div>
      <div className="bg-white rounded-none shadow-xl border border-slate-300 overflow-hidden flex flex-col">
        <div className="bg-[#0056d2] p-6 text-white font-black uppercase italic text-sm tracking-widest">Mission Sync Control</div>
        <div className="p-10 space-y-8 flex-1">
          <SectionGrouping title="Database Selection Node">
            <select className="w-full h-12 bg-white border border-slate-400 rounded-none px-4 text-[11px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-600 shadow-sm col-span-2" value={mod} onChange={(e) => setMod(e.target.value)}>
              <option value="">Select Registry Node Type...</option><option value="XD">CUSTOMER MASTER REGISTRY</option><option value="VA">SALES ORDER MASTER REGISTRY</option>
            </select>
          </SectionGrouping>
          {mod === 'VA' && (
            <SectionGrouping title="Settings / Target Node">
              <select className="w-full h-12 bg-white border border-slate-400 rounded-none px-4 text-[11px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-600 shadow-sm col-span-2" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <option value="">Select Target Plant Node...</option>
                {allPlants?.map((p: any) => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}
              </select>
            </SectionGrouping>
          )}
          <div className="flex-1 border-4 border-dashed border-slate-200 rounded-none flex flex-col items-center justify-center p-14 hover:bg-blue-50/50 transition-all cursor-pointer group shadow-inner"><Upload className="h-14 w-14 text-slate-200 mb-4 group-hover:text-[#0056d2] transition-colors" /><p className="text-[11px] font-black uppercase text-slate-400 group-hover:text-blue-600">Drag & Drop Master Registry File</p></div>
          <Button className="w-full h-16 bg-blue-900 hover:bg-black text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-none shadow-xl">Initiate Bulk Registry Sync</Button>
        </div>
      </div>
    </div>
  );
}

function CNPrintTemplate({ trip, order, copyType, deliveryAddress }: { trip: any, order: any, copyType: string, deliveryAddress?: string }) {
  const cnNo = trip?.cnNo || '--';
  const cnDate = trip?.cnDate || (trip?.createdAt ? format(new Date(trip.createdAt), 'dd-MMM-yyyy') : '--');
  const paymentMode = trip?.paymentMode || 'To Pay';
  const items = order?.items || [{ product: trip?.product || 'SALT', weight: trip?.assignWeight || '--', weightUom: trip?.weightUom || 'MT', invoiceNumber: trip?.invoiceNumber || '--' }];
  
  const totalPackages = items.reduce((acc: number, item: any) => acc + (parseFloat(item.packages) || 0), 0);
  const totalWeight = items.reduce((acc: number, item: any) => acc + (parseFloat(item.weight) || 0), 0);

  return (
    <div className="w-full p-12 font-serif text-black leading-tight bg-white min-h-[297mm] flex flex-col box-border border-4 border-black/5">
      <div className="flex justify-between items-start border-b-2 border-black pb-8 mb-8">
        <div className="flex gap-8 items-center">
          <div className="w-20 h-20 bg-black flex items-center justify-center rounded-sm shrink-0">
            <span className="text-white font-black text-4xl italic">S</span>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">Sikka Industries & Logistics</h1>
            <p className="text-[11px] font-bold opacity-70">Ghaziabad – 201009, Uttar Pradesh, India</p>
            <p className="text-[10px] font-black uppercase text-slate-600">GSTIN: 09ABCDE1234F1Z5 | PH: +91 120 4290010</p>
          </div>
        </div>
        <div className="text-right space-y-4">
          <div className="inline-block border-2 border-black px-6 py-2 font-black text-sm uppercase bg-black text-white">{copyType}</div>
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase text-slate-400">CN Number Node</p>
            <p className="text-2xl font-black tracking-widest">{cnNo}</p>
            <div className="flex justify-end gap-6 pt-2">
               <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase">Registry Date</p><p className="text-xs font-black">{cnDate}</p></div>
               <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase">Origin</p><p className="text-xs font-black uppercase italic">{order?.from || '--'}</p></div>
               <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase">Destination</p><p className="text-xs font-black uppercase italic">{order?.destination || '--'}</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-2 border-black mb-8">
        <div className="grid grid-cols-4 divide-x-2 divide-black bg-slate-50 border-b-2 border-black font-black text-[10px] uppercase">
          <div className="p-3 text-center">Vehicle Number Hub</div>
          <div className="p-3 text-center">Driver Mobile Node</div>
          <div className="p-3 text-center">Payment Term Registry</div>
          <div className="p-3 text-center">Trip ID Registry</div>
        </div>
        <div className="grid grid-cols-4 divide-x-2 divide-black text-sm font-black uppercase">
          <div className="p-4 text-center">{trip?.vehicleNumber || '--'}</div>
          <div className="p-4 text-center">{trip?.driverMobile || '--'}</div>
          <div className="p-4 text-center text-blue-800 italic">{paymentMode}</div>
          <div className="p-4 text-center">{trip?.tripId || '--'}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 border-2 border-black divide-x-2 divide-black mb-8">
        <div className="p-6 space-y-3">
          <h3 className="text-[11px] font-black uppercase border-b border-black pb-2 mb-3 text-slate-500 tracking-[0.2em]">Consignor Registry</h3>
          <p className="text-sm font-black uppercase leading-tight">{trip?.consignor || '--'}</p>
          <p className="text-[10px] font-medium text-slate-600">{order?.from || '--'}</p>
          <p className="text-[10px] font-black mt-4">GSTIN: {trip?.consignorGst || '--'}</p>
        </div>
        <div className="p-6 space-y-3">
          <h3 className="text-[11px] font-black uppercase border-b border-black pb-2 mb-3 text-slate-500 tracking-[0.2em]">Consignee Registry</h3>
          <p className="text-sm font-black uppercase leading-tight">{trip?.consignee || '--'}</p>
          <p className="text-[10px] font-medium text-slate-600">{order?.destination || '--'}</p>
          <p className="text-[10px] font-black mt-4">GSTIN: {trip?.consigneeGst || '--'}</p>
        </div>
        <div className="p-6 space-y-3 bg-slate-50/50">
          <h3 className="text-[11px] font-black uppercase border-b border-black pb-2 mb-3 text-slate-500 tracking-[0.2em]">Ship To Party Node</h3>
          <p className="text-sm font-black uppercase leading-tight">{trip?.shipToParty || '--'}</p>
          <div className="min-h-[50px] border border-dashed border-black/20 p-2 mt-2">
             <p className="text-[10px] font-medium leading-relaxed italic">{deliveryAddress || '--'}</p>
          </div>
          <p className="text-[10px] font-black mt-2">GSTIN: {trip?.shipToGst || '--'}</p>
        </div>
      </div>

      <div className="border-2 border-black flex-1 flex flex-col mb-8">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-black text-white font-black text-[10px] uppercase tracking-widest">
              <th className="p-4 border-r border-white/20 w-[20%]">Invoice Registry</th>
              <th className="p-4 border-r border-white/20 w-[20%]">E-waybill Node</th>
              <th className="p-4 border-r border-white/20 w-[15%]">Package Unit</th>
              <th className="p-3 border-r border-white/20 w-[30%]">Description of Goods Hub</th>
              <th className="p-4 w-[15%] text-right">Qty Hub</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black/10">
            {items.map((item: any, idx: number) => (
              <tr key={idx} className="text-xs font-bold align-top">
                <td className="p-4 border-r-2 border-black/5 uppercase">{item.invoiceNumber || '--'}</td>
                <td className="p-4 border-r-2 border-black/5 uppercase">{item.ewaybillNumber || '--'}</td>
                <td className="p-4 border-r-2 border-black/5 uppercase">{item.packages || '--'} {item.unitUom || 'BAGS'}</td>
                <td className="p-4 border-r-2 border-black/5 uppercase italic">{item.product || 'SALT'}</td>
                <td className="p-4 text-right font-black">{item.weight || '--'} {item.weightUom || 'MT'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black bg-slate-100 font-black text-sm">
              <td colSpan={2} className="p-5 text-right uppercase opacity-50 text-[10px]">Total Mission Payload Registry</td>
              <td className="p-5 border-l-2 border-black uppercase text-center">{totalPackages || '--'} PKGS</td>
              <td className="p-5 border-l-2 border-black"></td>
              <td className="p-5 border-l-2 border-black text-right">{totalWeight || '--'} {trip?.weightUom || 'MT'}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-0 border-2 border-black divide-x-2 divide-black mb-8">
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Delivery Address Node</h4>
            <p className="text-[11px] font-black italic uppercase leading-relaxed">{deliveryAddress || '--'}</p>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="p-6 border-b-2 border-black bg-slate-50 flex-1 text-center">
            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] mb-6">Consignment Acknowledgement Hub</h4>
            <div className="h-32"></div>
          </div>
          <div className="p-6 text-right">
             <p className="text-[10px] font-black uppercase tracking-widest">For Sikka Industries & Logistics Registry</p>
             <div className="h-16"></div>
             <p className="text-[11px] font-black uppercase underline decoration-2 underline-offset-8">Authorized Registry Signatory</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-[8px] text-justify leading-relaxed opacity-60 font-medium italic">
          1. Carriage subject to terms on primary carrier management registry node. 2. Not responsible for packaging damage at consignor end. 3. All disputes subject to Ghaziabad jurisdiction registry only.
        </p>
      </div>

      <div className="text-center pt-4 border-t border-black/20">
         <p className="text-[10px] font-black uppercase tracking-[0.4em] italic text-slate-500">
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
    <div className="w-full space-y-12 font-serif text-black leading-tight p-4">
      <div className="text-center border-b-4 border-black pb-8">
        <h1 className="text-4xl font-black uppercase tracking-[0.3em]">Lorry Receipt Registry</h1>
        <h2 className="text-2xl font-bold uppercase mt-4 italic">Sikka Industries & Logistics</h2>
        <p className="text-xs font-medium mt-2 tracking-widest uppercase">Headquarters HUB: Ghaziabad – 201009, Uttar Pradesh, India</p>
      </div>
      <div className="grid grid-cols-2 gap-20 pt-10">
        <div className="space-y-10">
          <div><p className="text-[11px] font-black uppercase text-slate-500 mb-2 tracking-widest">Consignor Node Registry</p><p className="text-lg font-black uppercase">{trip?.consignor || order?.consignor || '--'}</p><p className="text-sm mt-2 italic">{order?.from || '--'}</p></div>
          <div><p className="text-[11px] font-black uppercase text-slate-500 mb-2 tracking-widest">Consignee Node Registry</p><p className="text-lg font-black uppercase">{trip?.consignee || order?.consignee || '--'}</p><p className="text-sm mt-2 italic">{order?.destination || '--'}</p></div>
        </div>
        <div className="border-l-4 border-black pl-12 space-y-8">
          <div className="grid grid-cols-2 gap-8"><div><p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">LR Registry No</p><p className="text-2xl font-black tracking-widest">{lrNo}</p></div><div><p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Registry Date</p><p className="text-xl font-black">{lrDate}</p></div></div>
          <div><p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Vehicle Registry Hub</p><p className="text-2xl font-black uppercase tracking-[0.2em]">{trip?.vehicleNumber || '--'}</p></div>
        </div>
      </div>
      <div className="border-4 border-black mt-10">
        <table className="w-full text-left border-collapse">
          <thead><tr className="bg-slate-100 border-b-4 border-black"><th className="p-5 border-r-4 border-black text-xs font-black uppercase tracking-widest">Consignment Hub Particulars</th><th className="p-5 border-r-4 border-black text-xs font-black uppercase tracking-widest">Invoice Registry Node</th><th className="p-5 text-xs font-black uppercase tracking-widest">Mission Payload Qty</th></tr></thead>
          <tbody><tr className="h-64 align-top"><td className="p-6 border-r-4 border-black font-bold uppercase text-lg italic">{product}</td><td className="p-6 border-r-4 border-black font-bold uppercase text-lg">{invNo}</td><td className="p-6 font-black text-2xl">{weight}</td></tr></tbody>
        </table>
      </div>
      <div className="flex flex-col items-center justify-end pt-24"><p className="text-xs font-black uppercase tracking-[0.4em] border-t-4 border-black w-72 text-center pt-4 italic">Authorized Registry Signatory</p></div>
    </div>
  );
}
