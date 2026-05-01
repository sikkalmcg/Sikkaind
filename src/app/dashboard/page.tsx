'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Printer, Save, ArrowLeft, ArrowRight, 
  RotateCcw, X, HelpCircle, LogOut, LayoutDashboard,
  ChevronRight, Building2, Check, AlertCircle, Info, PlusCircle, Trash2,
  Grid2X2, Upload, FileText, Download, Calendar as CalendarIcon,
  ShoppingBag, ArrowUpRight
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

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'BULK';

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

  // Memoize sales order query for the Home Screen summary
  const ordersQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'sales_orders') : null, [user, db]);
  const { data: recentOrders } = useCollection(ordersQuery);

  const handleSave = () => {
    if (!user) {
      setStatusMsg({ text: 'Session error: Please log in again', type: 'error' });
      return;
    }
    
    if (activeScreen === 'HOME' || activeScreen === 'BULK' || activeScreen.endsWith('02') || activeScreen.endsWith('03')) {
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
    
    const validCodes = ['OX01', 'OX02', 'OX03', 'FM01', 'FM02', 'FM03', 'XK01', 'XK02', 'XK03', 'XD01', 'XD02', 'XD03', 'VA01', 'VA02', 'VA03', 'BULK'];
    
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
            <DropdownMenuTrigger 
              onClick={() => item === 'Menu' && setActiveScreen('HOME')}
              className="px-3 hover:bg-[#0056d2] hover:text-white outline-none transition-colors h-full flex items-center"
            >
              {item}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white rounded-none border-slate-300 shadow-xl text-[11px] p-0 min-w-[150px]">
              {item === 'Menu' && (
                <>
                  <DropdownMenuItem onClick={() => setActiveScreen('HOME')} className="rounded-none py-1.5 hover:bg-[#0056d2] hover:text-white px-4">Home (/n)</DropdownMenuItem>
                  <DropdownMenuSeparator className="m-0 bg-slate-200" />
                </>
              )}
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
             {/* Header branding */}
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
             
             {/* Favorites list */}
             <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                <div className="space-y-4">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-6">Favorites</p>
                  {[
                    { code: 'OX01', label: 'Create Plant' },
                    { code: 'FM01', label: 'Create Company' },
                    { code: 'XK01', label: 'Create Vendor' },
                    { code: 'XD01', label: 'Create Customer' },
                    { code: 'VA01', label: 'Create Sales Order' },
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
              <div className="space-y-8 animate-fade-in">
                {/* Recent Orders Overview replacing the firm image placeholder */}
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
                   {recentOrders && recentOrders.length > 5 && (
                     <div className="p-4 border-t border-slate-50 text-center">
                       <button onClick={() => executeTCode('VA03')} className="text-[10px] font-black text-[#0056d2] uppercase tracking-widest hover:underline flex items-center justify-center gap-2 mx-auto">
                         View Complete Order Registry <ArrowUpRight className="h-3 w-3" />
                       </button>
                     </div>
                   )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {['OX01', 'FM01', 'XK01', 'XD01', 'VA01', 'BULK'].map((code) => (
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
                   {activeScreen === 'VA01' && <SalesOrderForm data={formData} onChange={setFormData} />}
                   {activeScreen === 'BULK' && <BulkUploadForm setStatus={setStatusMsg} />}
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
    case 'VA01': return 'Create Sales Order Registry';
    case 'VA02': return 'Edit Sales Order Registry';
    case 'VA03': return 'Display Sales Order Registry';
    case 'BULK': return 'Bulk Data Hub Registry';
    default: return 'Central Management Control Registry';
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

      <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex gap-4">
        <Info className="h-5 w-5 text-blue-500 shrink-0" />
        <div className="text-[11px] text-blue-700 leading-relaxed font-bold italic">
          Tip: Ensure the first line contains exact field names from the registry schema. For multi-selection fields (like Plant Codes), use a semicolon (;) to separate values within the cell.
        </div>
      </div>
    </div>
  );
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
      <FormField label="Customer Code" placeholder="CUST1000" value={data.customerCode} onChange={(e: any) => updateField('customerCode', e.target.value)} required />
      <FormField label="Customer Name" placeholder="ABC Logistics" value={data.customerName} onChange={(e: any) => updateField('customerName', e.target.value)} required />
      
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

function SalesOrderForm({ data, onChange }: any) {
  const { user } = useUser();
  const db = useFirestore();
  
  const plantsQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'plants') : null, [user, db]);
  const customersQuery = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'customers') : null, [user, db]);
  
  const { data: plants } = useCollection(plantsQuery);
  const { data: customers } = useCollection(customersQuery);

  const updateField = (field: string, val: any) => {
    let nextData = { ...data, [field]: val };
    
    // Auto populate city for Consignor
    if (field === 'consignor') {
      const selected = customers?.find(c => c.customerName === val);
      if (selected) nextData.from = selected.city;
    }
    
    // Auto populate city for Ship to Party
    if (field === 'shipToParty') {
      const selected = customers?.find(c => c.customerName === val);
      if (selected) nextData.destination = selected.city;
    }
    
    onChange(nextData);
  };

  const addItem = () => {
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
    const nextItems = [...(data.items || [])];
    nextItems[idx] = { ...nextItems[idx], [field]: val };
    onChange({ ...data, items: nextItems });
  };

  const removeItem = (idx: number) => {
    const nextItems = (data.items || []).filter((_: any, i: number) => i !== idx);
    onChange({ ...data, items: nextItems });
  };

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Plant Code</label>
          <select 
            className="w-full h-11 border border-slate-200 bg-slate-50 px-4 rounded-xl font-bold outline-none"
            value={data.plantCode}
            onChange={(e) => updateField('plantCode', e.target.value)}
          >
            <option value="">Select Plant</option>
            {plants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode} - {p.plantName}</option>)}
          </select>
        </div>
        <FormField label="Sale Order" placeholder="SO-10001" value={data.saleOrder} onChange={(e: any) => updateField('saleOrder', e.target.value)} required />
        <FormField label="Sale Order Date" type="date" value={data.saleOrderDate} onChange={(e: any) => updateField('saleOrderDate', e.target.value)} required />
        
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Consignor</label>
          <select 
            className="w-full h-11 border border-slate-200 bg-slate-50 px-4 rounded-xl font-bold outline-none"
            value={data.consignor}
            onChange={(e) => updateField('consignor', e.target.value)}
          >
            <option value="">Select Consignor</option>
            {customers?.filter(c => c.customerType === 'Consignor').map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
          </select>
        </div>
        <FormField label="From (City)" value={data.from} disabled />
        
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Consignee</label>
          <select 
            className="w-full h-11 border border-slate-200 bg-slate-50 px-4 rounded-xl font-bold outline-none"
            value={data.consignee}
            onChange={(e) => updateField('consignee', e.target.value)}
          >
            <option value="">Select Consignee</option>
            {customers?.filter(c => c.customerType === 'Consignee').map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Ship to Party</label>
          <select 
            className="w-full h-11 border border-slate-200 bg-slate-50 px-4 rounded-xl font-bold outline-none"
            value={data.shipToParty}
            onChange={(e) => updateField('shipToParty', e.target.value)}
          >
            <option value="">Select Ship to Party</option>
            {customers?.filter(c => c.customerType === 'Consignee').map(c => <option key={c.id} value={c.customerName}>{c.customerName}</option>)}
          </select>
        </div>
        <FormField label="Destination (City)" value={data.destination} disabled />
        
        <FormField label="Vehicle Number" placeholder="UP14-XX-0000" value={data.vehicleNumber} onChange={(e: any) => updateField('vehicleNumber', e.target.value)} />
        <FormField label="Driver Mobile" placeholder="+91..." value={data.driverMobile} onChange={(e: any) => updateField('driverMobile', e.target.value)} />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest italic">Line Items Registry</h3>
          <Button onClick={addItem} variant="outline" className="h-9 px-6 rounded-xl font-bold gap-2 text-[#0056d2] border-blue-200 bg-blue-50/50">
            <PlusCircle className="h-4 w-4" /> Add Row Node
          </Button>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm bg-slate-50/30 p-1">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-100/50">
                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-r border-white/50">Invoice No.</th>
                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-r border-white/50">Ewaybill No.</th>
                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-r border-white/50">Product Node</th>
                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-r border-white/50 w-48">Unit / UOM</th>
                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 border-r border-white/50 w-48">Weight / UOM</th>
                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 w-12 text-center">Act</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).map((item: any, idx: number) => (
                <tr key={idx} className="border-t border-slate-100 group">
                  <td className="p-2 border-r border-slate-100">
                    <Input value={item.invoiceNumber} onChange={(e) => updateItem(idx, 'invoiceNumber', e.target.value)} className="h-9 border-none bg-transparent font-bold focus:bg-white" />
                  </td>
                  <td className="p-2 border-r border-slate-100">
                    <Input value={item.ewaybillNumber} onChange={(e) => updateItem(idx, 'ewaybillNumber', e.target.value)} className="h-9 border-none bg-transparent font-bold focus:bg-white" />
                  </td>
                  <td className="p-2 border-r border-slate-100">
                    <Input value={item.product} onChange={(e) => updateItem(idx, 'product', e.target.value)} className="h-9 border-none bg-transparent font-bold focus:bg-white" />
                  </td>
                  <td className="p-2 border-r border-slate-100">
                    <div className="flex gap-1">
                      <Input value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="h-9 w-20 border-none bg-transparent font-bold focus:bg-white" />
                      <select 
                        value={item.unitUom} 
                        onChange={(e) => updateItem(idx, 'unitUom', e.target.value)}
                        className="h-9 flex-1 bg-transparent font-bold outline-none border-none text-[10px] uppercase"
                      >
                        {['Box', 'Bag', 'Drum', 'Pcs', 'Others'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-100">
                    <div className="flex gap-1">
                      <Input value={item.weight} onChange={(e) => updateItem(idx, 'weight', e.target.value)} className="h-9 w-20 border-none bg-transparent font-bold focus:bg-white" />
                      <select 
                        value={item.weightUom} 
                        onChange={(e) => updateItem(idx, 'weightUom', e.target.value)}
                        className="h-9 flex-1 bg-transparent font-bold outline-none border-none text-[10px] uppercase"
                      >
                        {['KG', 'MT', 'LTR'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!data.items || data.items.length === 0) && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-300 font-bold text-[10px] italic uppercase tracking-widest">
                    No Line items registered. Click "Add Row Node" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
  else if (screen.startsWith('VA')) collectionName = 'sales_orders';

  const listQuery = useMemoFirebase(() => user && collectionName ? collection(db, 'users', user.uid, collectionName) : null, [user, db, collectionName]);
  const { data: list, isLoading } = useCollection(listQuery);

  if (isLoading) return <div className="p-8 text-center text-slate-400 font-bold">Synchronizing Node Data...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-y border-slate-100">
            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">ID / Node</th>
            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Name / Description</th>
            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Type / Details</th>
            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
          </tr>
        </thead>
        <tbody>
          {list?.map((item) => (
            <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="p-4 font-bold text-xs text-[#0056d2]">
                {item.saleOrder || item.customerCode || item.plantCode || item.companyCode || item.id.slice(0, 8)}
              </td>
              <td className="p-4 font-bold text-xs text-slate-600 uppercase">
                {item.consignor || item.plantName || item.companyName || item.vendorName || item.customerName}
              </td>
              <td className="p-4 font-bold text-xs text-slate-400 uppercase italic">
                {item.destination || item.customerType || item.city || 'Standard Registry'}
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
