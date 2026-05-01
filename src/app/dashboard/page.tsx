
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, RotateCcw, X, HelpCircle, LogOut,
  ChevronRight, Check, AlertCircle, Info, PlusCircle, Trash2,
  Grid2X2, Upload, Download, ShoppingBag, ArrowUpRight,
  Filter, Truck, Calendar, MapPin, User, DollarSign, Activity,
  Layers, PackageCheck, Ban, Lock, Play, XCircle
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'TR21' | 'BULK';

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

  // Memoize data for various contexts
  const ordersQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'sales_orders') : null, [user, db]);
  const tripsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'trips') : null, [user, db]);
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const companiesQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'companies') : null, [user, db]);
  const vendorsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'vendors') : null, [user, db]);
  const customersQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'customers') : null, [user, db]);
  
  const { data: recentOrders } = useCollection(ordersQuery);
  const { data: allTrips } = useCollection(tripsQuery);
  const { data: allPlants } = useCollection(plantsQuery);
  const { data: allCompanies } = useCollection(companiesQuery);
  const { data: allVendors } = useCollection(vendorsQuery);
  const { data: allCustomers } = useCollection(customersQuery);

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

    if (collectionName) {
      const docRef = doc(db, 'users', user.uid, collectionName, docId);
      const payload = { 
        ...formData, 
        id: docId, 
        updatedAt: new Date().toISOString() 
      };
      
      setDocumentNonBlocking(docRef, payload, { merge: true });
      
      // Sync to public tracking if it's a Sales Order
      if (collectionName === 'sales_orders' && payload.saleOrder) {
        const publicRef = doc(db, 'public_orders', payload.saleOrder);
        setDocumentNonBlocking(publicRef, {
          type: 'order',
          status: 'PLACED',
          saleOrder: payload.saleOrder,
          consignor: payload.consignor,
          destination: payload.destination,
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
    
    const validCodes = ['OX01', 'OX02', 'OX03', 'FM01', 'FM02', 'FM03', 'XK01', 'XK02', 'XK03', 'XD01', 'XD02', 'XD03', 'VA01', 'VA02', 'VA03', 'TR21', 'BULK'];
    
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

  const handleCancel = () => {
    setFormData({});
    if (activeScreen.endsWith('02') || activeScreen.endsWith('03')) {
      // Logic for cancel in initial screen
    } else {
      setActiveScreen('HOME');
    }
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
    return [];
  };

  return (
    <div className="flex flex-col h-screen bg-[#d9e1f2] text-[#333] font-mono select-none overflow-hidden">
      {/* Menu Bar */}
      <div className="flex items-center bg-[#f0f0f0] border-b border-white/50 px-2 h-7 text-[11px] font-semibold">
        <DropdownMenu>
          <DropdownMenuTrigger 
            className="px-3 hover:bg-[#0056d2] hover:text-white outline-none transition-colors h-full flex items-center"
          >
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

      {/* Command Bar */}
      <div className="flex flex-col bg-[#f0f0f0] border-b border-slate-300 shadow-sm">
        <div className="flex items-center px-2 py-1 gap-2">
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

        {/* Transaction Sub-Toolbar */}
        {isModuleActive && activeScreen !== 'HOME' && (
          <div className="bg-[#e2eaf3] border-t border-slate-200 px-4 py-1.5 flex items-center gap-6">
            <button 
              onClick={handleSave} 
              className="flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:text-blue-700 transition-colors uppercase tracking-widest"
            >
              <Play className="h-3 w-3 fill-emerald-500 text-emerald-500" /> Execute
            </button>
            <button 
              onClick={handleCancel}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:text-red-700 transition-colors uppercase tracking-widest"
            >
              <XCircle className="h-3 w-3 text-red-500" /> Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {!isModuleActive && (
          <div className="w-80 bg-white border-r border-slate-300 flex flex-col shadow-sm animate-fade-in print:hidden">
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
             <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                <div className="space-y-4">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-6">Favorites</p>
                  {[
                    { code: 'OX01', label: 'Create Plant' },
                    { code: 'FM01', label: 'Create Company' },
                    { code: 'XK01', label: 'Create Vendor' },
                    { code: 'XD01', label: 'Create Customer' },
                    { code: 'VA01', label: 'Create Sales Order' },
                    { code: 'TR21', label: 'Drip Board Control' },
                    { code: 'BULK', label: 'Bulk Data Upload' },
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
              <div className="space-y-8 animate-fade-in">
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                   <div className="bg-slate-900 px-8 py-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <ShoppingBag className="h-5 w-5 text-blue-400" />
                        <h2 className="text-[13px] font-black uppercase text-white tracking-widest italic">Recent Sales Order Registry</h2>
                      </div>
                      <Badge className="bg-blue-600 text-white border-none rounded-lg px-4 font-black italic">NODE ACTIVITY</Badge>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">SO Number</th>
                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Consignor</th>
                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Destination</th>
                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Date</th>
                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentOrders?.slice(0, 5).map((order) => (
                            <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => { setFormData(order); setActiveScreen('VA03'); }}>
                              <td className="p-4 font-black text-xs text-[#0056d2]">{order.saleOrder}</td>
                              <td className="p-4 font-bold text-xs text-slate-600 uppercase">{order.consignor}</td>
                              <td className="p-4 font-bold text-xs text-slate-400 uppercase italic">{order.destination}</td>
                              <td className="p-4 font-bold text-[10px] text-slate-400">{order.saleOrderDate}</td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-1 text-emerald-500">
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                   <span className="text-[8px] font-black uppercase">Active</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {(!recentOrders || recentOrders.length === 0) && (
                            <tr>
                              <td colSpan={5} className="p-12 text-center">
                                <p className="text-slate-300 font-bold text-xs italic uppercase tracking-[0.2em]">No recent order registry nodes found.</p>
                                <Button onClick={() => executeTCode('VA01')} variant="outline" className="mt-4 border-dashed border-slate-300 text-slate-400 rounded-xl font-bold uppercase text-[10px]">Create Initial Order Registry</Button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {['OX01', 'FM01', 'XK01', 'XD01', 'VA01', 'TR21'].map((code) => (
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
              <div className="bg-white shadow-2xl rounded-sm border border-slate-300 overflow-hidden animate-slide-up w-full print:shadow-none print:border-none print:rounded-none">
                 {/* Top SAP Yellow Highlight */}
                 <div className="h-1 bg-yellow-500 w-full print:hidden" />
                 
                 <div className="p-1 min-h-[600px] bg-[#fdfdfd] flex flex-col">
                   {/* Form Header Area for Initial Screens */}
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
                                {item.saleOrder || item.customerCode || item.plantCode || item.companyCode || item.id.slice(0, 8)} - {item.consignor || item.plantName || item.companyName || item.vendorName || item.customerName}
                              </option>
                            ))}
                           </select>
                        </div>
                     </div>
                   )}

                   {/* Form Content */}
                   <div className="p-4 space-y-6">
                     {showForm && (
                       <>
                         {activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                         {activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                         {activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                         {activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                         {activeScreen.startsWith('VA') && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                       </>
                     )}
                     {showList && (
                       <div className="space-y-4">
                         <h3 className="text-[10px] font-bold uppercase bg-[#dae4f1] px-4 py-1 border-y border-slate-300 text-[#1e3a8a]">Selection List</h3>
                         <RegistryList screen={activeScreen} onSelectItem={setFormData} />
                       </div>
                     )}
                     {activeScreen === 'TR21' && <DripBoard orders={recentOrders} trips={allTrips} onStatusUpdate={setStatusMsg} />}
                     {activeScreen === 'BULK' && <BulkUploadForm setStatus={setStatusMsg} />}
                   </div>
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

function DripBoard({ orders, trips, onStatusUpdate }: { orders: any[] | null, trips: any[] | null, onStatusUpdate: any }) {
  const { user } = useUser();
  const db = useFirestore();
  const [plantFilter, setPlantFilter] = React.useState('ALL');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [assignWeight, setAssignWeight] = React.useState<string>('');
  const [vehicleNo, setVehicleNo] = React.useState('');
  const [driverMobile, setDriverMobile] = React.useState('');
  const [vendorName, setVendorName] = React.useState('');
  const [rate, setRate] = React.useState<string>('');
  const [freightAmount, setFreightAmount] = React.useState<string>('');
  const [isFixRate, setIsFixRate] = React.useState(false);

  // Fetch plants for filter
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const { data: plants } = useCollection(plantsQuery);

  // Auto calculate freight
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
    
    const tripData = {
      id: newTripId,
      tripId: tripId,
      saleOrderId: selectedOrder.id,
      saleOrderNumber: selectedOrder.saleOrder,
      plantCode: selectedOrder.plantCode,
      shipToParty: selectedOrder.shipToParty,
      route: `${selectedOrder.from} - ${selectedOrder.destination}`,
      assignWeight: parseFloat(assignWeight),
      vehicleNumber: vehicleNo,
      driverMobile: driverMobile,
      vendorName: vendorName,
      rate: isFixRate ? 0 : parseFloat(rate),
      freightAmount: parseFloat(freightAmount),
      isFixedRate: isFixRate,
      status: 'LOADING',
      createdAt: new Date().toISOString()
    };

    const docRef = doc(db, 'users', user.uid, 'trips', newTripId);
    setDocumentNonBlocking(docRef, tripData, { merge: true });

    // Sync to public tracking
    const publicTripRef = doc(db, 'public_trips', tripId);
    setDocumentNonBlocking(publicTripRef, {
      type: 'trip',
      status: 'LOADING',
      tripId: tripId,
      vehicleNumber: vehicleNo,
      route: tripData.route,
      updatedAt: tripData.createdAt
    }, { merge: true });

    // Update public order tracking too
    const publicOrderRef = doc(db, 'public_orders', selectedOrder.saleOrder);
    setDocumentNonBlocking(publicOrderRef, {
      status: 'LOADING',
      vehicleNumber: vehicleNo,
      tripId: tripId,
      updatedAt: tripData.createdAt
    }, { merge: true });

    onStatusUpdate({ text: `Trip ${tripId} registered successfully`, type: 'success' });
    setSelectedOrder(null);
    resetForm();
  };

  const resetForm = () => {
    setAssignWeight('');
    setVehicleNo('');
    setDriverMobile('');
    setVendorName('');
    setRate('');
    setFreightAmount('');
    setIsFixRate(false);
  };

  const calculateRemainingWeight = (orderId: string, totalWeight: number) => {
    const assigned = trips?.filter(t => t.saleOrderId === orderId).reduce((sum, t) => sum + (t.assignWeight || 0), 0) || 0;
    return totalWeight - assigned;
  };

  const filteredOrders = orders?.filter(o => {
    const totalW = o.items?.reduce((s: number, i: any) => s + (parseFloat(i.weight) || 0), 0) || 0;
    const remaining = calculateRemainingWeight(o.id, totalW);
    const matchesPlant = plantFilter === 'ALL' || o.plantCode === plantFilter;
    return remaining > 0 && matchesPlant;
  });

  const getTripsByStatus = (status: string) => {
    return trips?.filter(t => t.status === status && (plantFilter === 'ALL' || t.plantCode === plantFilter)) || [];
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
                  const totalW = order.items?.reduce((s: number, i: any) => s + (parseFloat(i.weight) || 0), 0) || 0;
                  const remaining = calculateRemainingWeight(order.id, totalW);
                  const uom = order.items?.[0]?.weightUom || 'KG';
                  
                  return (
                    <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black text-xs text-[#0056d2]">{order.saleOrder}</td>
                      <td className="p-4 font-bold text-[10px] uppercase text-slate-600">{order.consignor}</td>
                      <td className="p-4 font-bold text-[10px] uppercase text-slate-600">{order.consignee}</td>
                      <td className="p-4 font-bold text-[10px] uppercase text-slate-600">{order.shipToParty}</td>
                      <td className="p-4 font-bold text-[10px] uppercase text-slate-400 italic">
                        {order.from} - {order.destination}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getTripsByStatus(status).map(trip => (
                <div key={trip.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-slate-900 text-white rounded-lg px-3 py-1 font-black italic">{trip.tripId}</Badge>
                    <Badge variant="outline" className="border-emerald-100 text-emerald-600 uppercase text-[8px] font-black">
                      {status}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[11px] font-bold">
                       <span className="text-slate-400 uppercase tracking-tighter">Order Number:</span>
                       <span className="text-slate-900">{trip.saleOrderNumber}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                       <span className="text-slate-400 uppercase tracking-tighter">Vehicle Number:</span>
                       <span className="text-slate-900">{trip.vehicleNumber}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                       <span className="text-slate-400 uppercase tracking-tighter">Assign Weight:</span>
                       <span className="text-slate-900">{trip.assignWeight}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-50 flex items-center gap-2 text-slate-400">
                      <MapPin className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase truncate">{trip.route}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden font-mono">
          <div className="bg-[#0056d2] p-6 text-white flex flex-col items-center">
            <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Assign Mission Vehicle</DialogTitle>
            <div className="flex gap-4 mt-3 opacity-80 text-[10px] font-bold uppercase tracking-widest">
              <span>SO: {selectedOrder?.saleOrder}</span>
              <span>•</span>
              <span>To: {selectedOrder?.shipToParty}</span>
            </div>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Assign Weight</label>
                <Input 
                  value={assignWeight} 
                  onChange={(e) => setAssignWeight(e.target.value)} 
                  placeholder="0.00"
                  className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Vehicle Number</label>
                <Input 
                  value={vehicleNo} 
                  onChange={(e) => setVehicleNo(e.target.value)} 
                  placeholder="UP14-XX-0000"
                  className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Driver Mobile</label>
                <Input 
                  value={driverMobile} 
                  onChange={(e) => setDriverMobile(e.target.value)} 
                  placeholder="+91..."
                  className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Vendor Name</label>
                <Input 
                  value={vendorName} 
                  onChange={(e) => setVendorName(e.target.value)} 
                  placeholder="Select Vendor"
                  className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200" 
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="fix-rate" checked={isFixRate} onCheckedChange={(val) => setIsFixRate(val as boolean)} />
                    <label htmlFor="fix-rate" className="text-[10px] font-black uppercase text-slate-600">Apply Fix Rate Manual</label>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[9px] font-black uppercase text-slate-400">Rate (Per UOM)</label>
                   <Input 
                     disabled={isFixRate} 
                     value={rate} 
                     onChange={(e) => setRate(e.target.value)}
                     className="h-10 rounded-xl font-bold border-slate-200 disabled:opacity-30" 
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black uppercase text-slate-400">Freight Amount</label>
                   <Input 
                     disabled={!isFixRate} 
                     value={freightAmount} 
                     onChange={(e) => setFreightAmount(e.target.value)}
                     className="h-10 rounded-xl font-bold border-slate-200 disabled:bg-white/50" 
                   />
                 </div>
               </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t border-slate-50 bg-slate-50/50">
            <Button variant="ghost" onClick={() => setSelectedOrder(null)} className="rounded-xl font-black uppercase text-[10px]">Cancel</Button>
            <Button onClick={handleAssign} className="bg-[#0056d2] hover:bg-black text-white px-8 h-12 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-900/20">Assign Mission</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getScreenTitle(screen: Screen): string {
  const isCreate = screen.endsWith('01');
  const isEdit = screen.endsWith('02');
  const isDisplay = screen.endsWith('03');
  const suffix = isEdit ? ': CHANGE INITIAL SCREEN' : isDisplay ? ': DISPLAY INITIAL SCREEN' : isCreate ? ': CREATE INITIAL SCREEN' : '';

  switch (screen) {
    case 'OX01': case 'OX02': case 'OX03': return 'PLANT MASTER' + suffix;
    case 'FM01': case 'FM02': case 'FM03': return 'COMPANY MASTER' + suffix;
    case 'XK01': case 'XK02': case 'XK03': return 'VENDOR MASTER' + suffix;
    case 'XD01': case 'XD02': case 'XD03': return 'CUSTOMER MASTER' + suffix;
    case 'VA01': case 'VA02': case 'VA03': return 'SALES ORDER REGISTRY' + suffix;
    case 'TR21': return 'DRIP BOARD REGISTRY CONTROL';
    case 'BULK': return 'BULK DATA HUB REGISTRY';
    default: return 'CENTRAL MANAGEMENT HUB';
  }
}

function BulkUploadForm({ setStatus }: { setStatus: any }) {
  const { user } = useUser();
  const db = useFirestore();
  const [registryType, setRegistryType] = React.useState('customers');
  const [csvData, setCsvData] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleProcess = () => {
    if (!user || !csvData.trim()) return;

    setIsProcessing(true);
    setStatus({ text: 'Parsing batch data...', type: 'info' });

    const lines = csvData.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).filter(l => l.trim() !== '');

    let successCount = 0;
    
    rows.forEach((row) => {
      const values = row.split(',').map(v => v.trim());
      const data: any = {};
      headers.forEach((header, index) => {
        if (header === 'plantCodes') {
          data[header] = values[index] ? values[index].split(';') : [];
        } else {
          data[header] = values[index];
        }
      });

      const docId = data.id || crypto.randomUUID();
      const docRef = doc(db, 'users', user.uid, registryType, docId);
      
      setDocumentNonBlocking(docRef, {
        ...data,
        id: docId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      successCount++;
    });

    setIsProcessing(false);
    setStatus({ text: `Batch synchronization complete: ${successCount} nodes processed`, type: 'success' });
    setCsvData('');
  };

  const getTemplate = () => {
    if (registryType === 'customers') return 'customerCode,customerName,customerType,city,plantCodes,gstin,pan,mobile,email,address\nC1001,Global Logistics,Consignee,Mumbai,PLNT01;PLNT02,27AAAAA0000A1Z5,ABCDE1234F,9876543210,info@global.com,Street 1';
    if (registryType === 'plants') return 'plantCode,plantName,city,state,stateCode,postalCode,gstin,pan,email,website,address\nPLNT01,North Hub,Delhi,Delhi,07,110001,07AAAAA0000A1Z5,ABCDE1234F,north@sikka.com,www.sikka.com,Warehouse 1';
    return '';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
        <div className="space-y-2 flex-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Target Registry Node</label>
          <select 
            className="w-full h-12 border border-slate-200 bg-white px-4 rounded-xl font-bold outline-none"
            value={registryType}
            onChange={(e) => setRegistryType(e.target.value)}
          >
            <option value="plants">Plants Master</option>
            <option value="companies">Company Hubs</option>
            <option value="vendors">Vendor Nodes</option>
            <option value="customers">Customer Nodes</option>
          </select>
        </div>
        <div className="flex gap-4 items-end">
          <Button onClick={() => setCsvData(getTemplate())} variant="outline" className="h-12 rounded-xl font-bold gap-2">
            <Download className="h-4 w-4" /> Load Template
          </Button>
          <Button 
            disabled={isProcessing || !csvData.trim()} 
            onClick={handleProcess}
            className="h-12 bg-[#0056d2] hover:bg-[#0044a8] text-white rounded-xl font-bold px-8 gap-2"
          >
            {isProcessing ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Execute Bulk Upload
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-slate-400">CSV Input Area (Comma Separated)</label>
        <div className="relative">
          <textarea 
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            placeholder="Header1,Header2,Header3..."
            className="w-full h-64 p-6 border border-slate-200 bg-slate-50 rounded-[2rem] font-mono text-xs outline-none focus:ring-2 focus:ring-[#0056d2] transition-all"
          />
          <div className="absolute top-4 right-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest bg-white/80 px-3 py-1 rounded-full">
            Raw Node Input
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-[#dae4f1] border-y border-slate-300 px-4 py-1.5 mb-6">
      <h3 className="text-[11px] font-bold text-[#1e3a8a] uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function PlantForm({ data, onChange, disabled }: any) {
  const updateField = (field: string, val: any) => !disabled && onChange({ ...data, [field]: val });

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader title="Plant Master Data" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 px-4">
          <FormField label="Plant Code" placeholder="PLNT01" value={data.plantCode} onChange={(e: any) => updateField('plantCode', e.target.value)} required disabled={disabled} />
          <FormField label="Plant Name" placeholder="Sikka Industries Hub" value={data.plantName} onChange={(e: any) => updateField('plantName', e.target.value)} required disabled={disabled} />
          <FormField label="City" placeholder="Ghaziabad" value={data.city} onChange={(e: any) => updateField('city', e.target.value)} disabled={disabled} />
          <FormField label="State" placeholder="Uttar Pradesh" value={data.state} onChange={(e: any) => updateField('state', e.target.value)} disabled={disabled} />
        </div>
      </div>

      <div>
        <SectionHeader title="Tax & Financial Details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 px-4">
          <FormField label="GSTIN" placeholder="07AAAAA0000A1Z5" value={data.gstin} onChange={(e: any) => updateField('gstin', e.target.value)} disabled={disabled} />
          <FormField label="PAN" placeholder="ABCDE1234F" value={data.pan} onChange={(e: any) => updateField('pan', e.target.value)} disabled={disabled} />
          <FormField label="Postal Code" placeholder="201009" value={data.postalCode} onChange={(e: any) => updateField('postalCode', e.target.value)} disabled={disabled} />
          <FormField label="Email ID" placeholder="plant@sikka.com" value={data.email} onChange={(e: any) => updateField('email', e.target.value)} disabled={disabled} />
        </div>
      </div>

      <div>
        <SectionHeader title="Location Details" />
        <div className="px-4">
           <FormField label="Address" type="textarea" value={data.address} onChange={(e: any) => updateField('address', e.target.value)} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

function CompanyForm({ data, onChange, disabled }: any) {
  const { user } = useUser();
  const db = useFirestore();
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const { data: plants } = useCollection(plantsQuery);

  const updateField = (field: string, val: any) => {
    if (disabled) return;
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
    <div className="space-y-8">
      <div>
        <SectionHeader title="Company Hub Selection" />
        <div className="px-4">
          <div className="flex items-center gap-6 max-w-2xl">
            <label className="text-xs font-bold text-slate-600 w-48">Plant Node Selection</label>
            <select 
              disabled={disabled}
              className="flex-1 h-8 border border-slate-400 bg-white px-2 text-xs outline-none disabled:bg-slate-50"
              value={data.plantCode}
              onChange={(e) => updateField('plantCode', e.target.value)}
            >
              <option value="">Select Plant...</option>
              {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Company Registry Data" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 px-4">
          <FormField label="Company Code" value={data.companyCode || '10000'} onChange={(e: any) => updateField('companyCode', e.target.value)} required disabled={disabled} />
          <FormField label="Company Name" placeholder="Sikka Industries" value={data.companyName} onChange={(e: any) => updateField('companyName', e.target.value)} required disabled={disabled} />
          <FormField label="GSTIN" placeholder="09AAAAA0000A1Z5" value={data.gstin} onChange={(e: any) => updateField('gstin', e.target.value)} required disabled={disabled} />
          <FormField label="PAN" value={data.pan} disabled />
          <FormField label="State" value={data.state} disabled />
          <FormField label="Mobile Number" value={data.mobileNumber} onChange={(e: any) => updateField('mobileNumber', e.target.value)} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

function VendorForm({ data, onChange, disabled }: any) {
  const { user } = useUser();
  const db = useFirestore();
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const { data: plants } = useCollection(plantsQuery);

  const updateField = (field: string, val: any) => !disabled && onChange({ ...data, [field]: val });

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader title="Selection: Plant Nodes" />
        <div className="px-4">
           <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border border-slate-300 min-h-[40px]">
            {plants?.map(p => (
              <Badge 
                key={p.id} 
                onClick={() => {
                  if (disabled) return;
                  const current = data.plantCodes || [];
                  const next = current.includes(p.plantCode) ? current.filter((c: string) => c !== p.plantCode) : [...current, p.plantCode];
                  updateField('plantCodes', next);
                }}
                className={`cursor-pointer rounded-none border-slate-400 text-[10px] font-bold py-0.5 px-2 transition-colors ${data.plantCodes?.includes(p.plantCode) ? 'bg-[#0056d2] text-white' : 'bg-white text-slate-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {p.plantCode}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Vendor Data Registry" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 px-4">
          <FormField label="Vendor Name" value={data.vendorName} onChange={(e: any) => updateField('vendorName', e.target.value)} required disabled={disabled} />
          <FormField label="GSTIN" value={data.gstin} onChange={(e: any) => updateField('gstin', e.target.value)} disabled={disabled} />
          <FormField label="PAN" value={data.pan} onChange={(e: any) => updateField('pan', e.target.value)} disabled={disabled} />
          <FormField label="Mobile" value={data.mobile} onChange={(e: any) => updateField('mobile', e.target.value)} disabled={disabled} />
        </div>
      </div>

      <div>
        <SectionHeader title="Address Registry" />
        <div className="px-4">
          <FormField label="Address" type="textarea" value={data.address} onChange={(e: any) => updateField('address', e.target.value)} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

function CustomerForm({ data, onChange, disabled }: any) {
  const { user } = useUser();
  const db = useFirestore();
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const { data: plants } = useCollection(plantsQuery);

  const updateField = (field: string, val: any) => !disabled && onChange({ ...data, [field]: val });

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader title="Selection" />
        <div className="px-4">
           <div className="flex items-center gap-6 max-w-2xl">
              <label className="text-xs font-bold text-slate-600 w-48">Plant Code Selection</label>
              <div className="flex-1 flex flex-wrap gap-1 p-1 bg-slate-50 border border-slate-300 min-h-[32px]">
                {plants?.map(p => (
                  <Badge 
                    key={p.id} 
                    onClick={() => {
                      if (disabled) return;
                      const current = data.plantCodes || [];
                      const next = current.includes(p.plantCode) ? current.filter((c: string) => c !== p.plantCode) : [...current, p.plantCode];
                      updateField('plantCodes', next);
                    }}
                    className={`cursor-pointer rounded-none text-[9px] font-bold transition-colors ${data.plantCodes?.includes(p.plantCode) ? 'bg-[#0056d2] text-white' : 'bg-white border-slate-300 text-slate-600'}`}
                  >
                    {p.plantCode}
                  </Badge>
                ))}
              </div>
           </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Customer Data" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 px-4">
          <FormField label="Customer Code" placeholder="CUST1000" value={data.customerCode} onChange={(e: any) => updateField('customerCode', e.target.value)} required disabled={disabled} />
          <FormField label="Full Name" placeholder="ABC Logistics" value={data.customerName} onChange={(e: any) => updateField('customerName', e.target.value)} required disabled={disabled} />
          <FormField label="Mobile Number" value={data.mobile} onChange={(e: any) => updateField('mobile', e.target.value)} disabled={disabled} />
          <FormField label="Email Address" value={data.email} onChange={(e: any) => updateField('email', e.target.value)} disabled={disabled} />
          <div className="space-y-1 flex items-center gap-6 md:col-span-2">
            <label className="text-xs font-bold text-slate-600 w-48">Customer Type</label>
            <select 
              disabled={disabled}
              className="flex-1 h-8 border border-slate-400 bg-white px-2 text-xs outline-none max-w-sm"
              value={data.customerType}
              onChange={(e) => updateField('customerType', e.target.value)}
            >
              <option value="">Select Type...</option>
              <option value="Consignor">Consignor</option>
              <option value="Consignee">Consignee – Ship to Party</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Tax & Financial Details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 px-4">
          <FormField label="GSTIN" placeholder="09XXXX..." value={data.gstin} onChange={(e: any) => updateField('gstin', e.target.value)} disabled={disabled} />
          <FormField label="PAN" placeholder="ABCDE1234F" value={data.pan} onChange={(e: any) => updateField('pan', e.target.value)} disabled={disabled} />
          <FormField label="City" placeholder="Noida" value={data.city} onChange={(e: any) => updateField('city', e.target.value)} required disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

function SalesOrderForm({ data, onChange, disabled }: any) {
  const { user } = useUser();
  const db = useFirestore();
  
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const customersQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'customers') : null, [user, db]);
  
  const { data: plants } = useCollection(plantsQuery);
  const { data: customers } = useCollection(customersQuery);

  const updateField = (field: string, val: any) => {
    if (disabled) return;
    let nextData = { ...data, [field]: val };
    
    if (field === 'consignor') {
      const selected = customers?.find(c => c.customerName === val);
      if (selected) nextData.from = selected.city;
    }
    
    if (field === 'shipToParty') {
      const selected = customers?.find(c => c.customerName === val);
      if (selected) nextData.destination = selected.city;
    }
    
    onChange(nextData);
  };

  const addItem = () => {
    if (disabled) return;
    const current = data.items || [];
    onChange({ ...data, items: [...current, { 
      invoiceNumber: '', 
      ewaybillNumber: '', 
      product: '', 
      unit: '', 
      unitUom: 'Box', 
      weight: '', 
      weightUom: 'KG' 
    }] });
  };

  const updateItem = (idx: number, field: string, val: any) => {
    if (disabled) return;
    const nextItems = [...(data.items || [])];
    nextItems[idx] = { ...nextItems[idx], [field]: val };
    onChange({ ...data, items: nextItems });
  };

  const removeItem = (idx: number) => {
    if (disabled) return;
    const nextItems = (data.items || []).filter((_: any, i: number) => i !== idx);
    onChange({ ...data, items: nextItems });
  };

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader title="Order Registry Selection" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 px-4">
           <div className="flex items-center gap-6">
              <label className="text-xs font-bold text-slate-600 w-48">Plant Selection</label>
              <select 
                disabled={disabled}
                className="flex-1 h-8 border border-slate-400 bg-white px-2 text-xs outline-none"
                value={data.plantCode}
                onChange={(e) => updateField('plantCode', e.target.value)}
              >
                <option value="">Select Plant...</option>
                {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}
              </select>
           </div>
           <FormField label="Sale Order Date" type="date" value={data.saleOrderDate} onChange={(e: any) => updateField('saleOrderDate', e.target.value)} required disabled={disabled} />
        </div>
      </div>

      <div>
        <SectionHeader title="Consignment Data" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 px-4">
          <FormField label="Sale Order No" placeholder="SO-10001" value={data.saleOrder} onChange={(e: any) => updateField('saleOrder', e.target.value)} required disabled={disabled} />
          <div className="flex items-center gap-6">
            <label className="text-xs font-bold text-slate-600 w-48">Consignor</label>
            <select 
              disabled={disabled}
              className="flex-1 h-8 border border-slate-400 bg-white px-2 text-xs outline-none"
              value={data.consignor}
              onChange={(e) => updateField('consignor', e.target.value)}
            >
              <option value="">Select Consignor...</option>
              {customers?.filter(c => c.customerType === 'Consignor').map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
            </select>
          </div>
          <FormField label="From (City)" value={data.from} disabled />
          <div className="flex items-center gap-6">
            <label className="text-xs font-bold text-slate-600 w-48">Consignee</label>
            <select 
              disabled={disabled}
              className="flex-1 h-8 border border-slate-400 bg-white px-2 text-xs outline-none"
              value={data.consignee}
              onChange={(e) => updateField('consignee', e.target.value)}
            >
              <option value="">Select Consignee...</option>
              {customers?.filter(c => c.customerType === 'Consignee').map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-6">
            <label className="text-xs font-bold text-slate-600 w-48">Ship to Party</label>
            <select 
              disabled={disabled}
              className="flex-1 h-8 border border-slate-400 bg-white px-2 text-xs outline-none"
              value={data.shipToParty}
              onChange={(e) => updateField('shipToParty', e.target.value)}
            >
              <option value="">Select Ship to Party...</option>
              {customers?.filter(c => c.customerType === 'Consignee').map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
            </select>
          </div>
          <FormField label="Destination" value={data.destination} disabled />
          <FormField label="Vehicle Number" placeholder="UP14-XX-0000" value={data.vehicleNumber} onChange={(e: any) => updateField('vehicleNumber', e.target.value)} disabled={disabled} />
          <FormField label="Driver Mobile" placeholder="+91..." value={data.vehicleNumber} onChange={(e: any) => updateField('driverMobile', e.target.value)} disabled={disabled} />
        </div>
      </div>

      <div>
        <SectionHeader title="Line Item Registry Table" />
        <div className="px-4">
           {!disabled && (
            <Button onClick={addItem} variant="outline" className="h-7 px-4 mb-2 rounded-none font-bold gap-1 text-[9px] uppercase border-slate-400 bg-slate-50">
              <PlusCircle className="h-3 w-3" /> Add Item Row
            </Button>
           )}
           <div className="overflow-x-auto border border-slate-300">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead className="bg-[#e9f0f8] border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300">Invoice No</th>
                  <th className="p-2 border-r border-slate-300">Ewaybill No</th>
                  <th className="p-2 border-r border-slate-300">Product</th>
                  <th className="p-2 border-r border-slate-300 w-32">Unit / UOM</th>
                  <th className="p-2 border-r border-slate-300 w-32">Weight / UOM</th>
                  {!disabled && <th className="p-2 w-8 text-center">Act</th>}
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-1 border-r border-slate-200">
                      <input disabled={disabled} value={item.invoiceNumber} onChange={(e) => updateItem(idx, 'invoiceNumber', e.target.value)} className="w-full h-7 bg-transparent px-1 outline-none" />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input disabled={disabled} value={item.ewaybillNumber} onChange={(e) => updateItem(idx, 'ewaybillNumber', e.target.value)} className="w-full h-7 bg-transparent px-1 outline-none" />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <input disabled={disabled} value={item.product} onChange={(e) => updateItem(idx, 'product', e.target.value)} className="w-full h-7 bg-transparent px-1 outline-none" />
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <div className="flex gap-1">
                        <input disabled={disabled} value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="w-12 h-7 bg-transparent px-1 outline-none border-r border-slate-200" />
                        <select disabled={disabled} value={item.unitUom} onChange={(e) => updateItem(idx, 'unitUom', e.target.value)} className="flex-1 bg-transparent text-[9px] outline-none">
                          {['Box', 'Bag', 'Drum', 'Pcs', 'Others'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="p-1 border-r border-slate-200">
                      <div className="flex gap-1">
                        <input disabled={disabled} value={item.weight} onChange={(e) => updateItem(idx, 'weight', e.target.value)} className="w-12 h-7 bg-transparent px-1 outline-none border-r border-slate-200" />
                        <select disabled={disabled} value={item.weightUom} onChange={(e) => updateItem(idx, 'weightUom', e.target.value)} className="flex-1 bg-transparent text-[9px] outline-none">
                          {['KG', 'MT', 'LTR'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </td>
                    {!disabled && (
                      <td className="p-1 text-center">
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
        </div>
      </div>
    </div>
  );
}

function RegistryList({ screen, onSelectItem }: { screen: string, onSelectItem: (item: any) => void }) {
  const { user } = useUser();
  const db = useFirestore();
  let collectionName = '';
  if (screen.startsWith('OX')) collectionName = 'plants';
  else if (screen.startsWith('FM')) collectionName = 'companies';
  else if (screen.startsWith('XK')) collectionName = 'vendors';
  else if (screen.startsWith('XD')) collectionName = 'customers';
  else if (screen.startsWith('VA')) collectionName = 'sales_orders';

  const listQuery = useMemoFirebase(() => user && collectionName ? collection(db, 'users', user.uid, collectionName) : null, [user, db, collectionName]);
  const { data: list, isLoading } = useCollection(listQuery);

  if (isLoading) return <div className="p-8 text-center text-slate-400 font-bold">Synchronizing Node Data...</div>;

  return (
    <div className="overflow-x-auto px-4">
      <table className="w-full text-left border-collapse border border-slate-300">
        <thead className="bg-[#f0f3f9] border-b border-slate-300">
          <tr>
            <th className="p-2 text-[10px] font-bold text-slate-600 border-r border-slate-300">ID / Node</th>
            <th className="p-2 text-[10px] font-bold text-slate-600 border-r border-slate-300">Name / Description</th>
            <th className="p-2 text-[10px] font-bold text-slate-600 border-r border-slate-300">Type / Details</th>
            <th className="p-2 text-[10px] font-bold text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {list?.map((item) => (
            <tr 
              key={item.id} 
              className="border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer group"
              onClick={() => onSelectItem(item)}
            >
              <td className="p-2 font-bold text-[11px] text-[#0056d2] group-hover:underline border-r border-slate-200">
                {item.saleOrder || item.customerCode || item.plantCode || item.companyCode || item.id.slice(0, 8)}
              </td>
              <td className="p-2 font-bold text-[11px] text-slate-600 uppercase border-r border-slate-200">
                {item.consignor || item.plantName || item.companyName || item.vendorName || item.customerName}
              </td>
              <td className="p-2 font-bold text-[11px] text-slate-400 uppercase italic border-r border-slate-200">
                {item.destination || item.customerType || item.city || 'Standard Registry'}
              </td>
              <td className="p-2">
                <Badge className="bg-emerald-50 text-emerald-600 rounded-none uppercase text-[8px] font-black border border-emerald-100">Synchronized</Badge>
              </td>
            </tr>
          ))}
          {(!list || list.length === 0) && (
            <tr>
              <td colSpan={4} className="p-12 text-center text-slate-300 font-bold text-[10px] uppercase italic tracking-widest">
                No records found in this registry hub.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FormField({ label, placeholder, type = 'text', required, value, onChange, disabled }: any) {
  return (
    <div className="flex items-center gap-6 w-full">
      <label className="text-xs font-bold text-slate-600 w-48 shrink-0">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea 
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 p-2 border border-slate-400 bg-white text-xs min-h-[60px] outline-none disabled:bg-slate-50 disabled:text-slate-500"
        />
      ) : (
        <input 
          type={type}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 h-8 border border-slate-400 bg-white px-2 text-xs outline-none disabled:bg-slate-50 disabled:text-slate-500"
        />
      )}
    </div>
  );
}
