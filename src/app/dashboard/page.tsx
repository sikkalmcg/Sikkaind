
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Printer, Save, X, Info, LogOut,
  ChevronRight, ChevronLeft, Truck, MapPin, User, Users, ShoppingBag,
  Grid2X2, ShieldAlert, Edit3, 
  PlusSquare, XCircle, Calendar as CalendarIcon, Package, Undo2,
  FileText, UploadCloud, Trash2, Plus, CheckCircle as CheckCircleIcon, Search,
  AlertTriangle, Clock, Calendar as LucideCalendar, FileCheck, Eye, EyeOff, Download,
  Loader2
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

const SHARED_HUB_ID = 'Sikkaind'; 

export default function SapDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
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
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [isAuthChecking, setIsAuthChecking] = React.useState(true);
  const [registryId, setRegistryId] = React.useState<string | null>(null);
  const [xdSearch, setXdSearch] = React.useState({ plant: '', type: '', name: '', customerId: '' });

  const tCodeRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLDivElement>(null);
  const bulkInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const isAdmin = localStorage.getItem('sap_bootstrap_session') === 'true';
    const rid = localStorage.getItem('sap_registry_id');
    setIsBootstrapAdmin(isAdmin);
    setRegistryId(rid);
    setIsAuthChecking(false);
  }, []);

  const profileRef = useMemoFirebase(() => {
    if (!user) return null;
    if (isBootstrapAdmin) return doc(db, 'user_registry', user.uid);
    const rid = registryId || localStorage.getItem('sap_registry_id');
    return rid ? doc(db, 'user_registry', rid) : null;
  }, [user, db, isBootstrapAdmin, registryId]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(profileRef);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trips'), [db]);
  const plantsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'plants'), [db]);
  const companiesQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'companies'), [db]);
  const vendorsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);
  const usersQuery = useMemoFirebase(() => collection(db, 'user_registry'), [db]);
  
  const { data: rawOrders } = useCollection(ordersQuery);
  const { data: rawTrips } = useCollection(tripsQuery);
  const { data: rawPlants } = useCollection(plantsQuery);
  const { data: rawCompanies } = useCollection(companiesQuery);
  const { data: rawVendors } = useCollection(vendorsQuery);
  const { data: rawCustomers } = useCollection(customersQuery);
  const { data: allUsers, isLoading: isAllUsersLoading } = useCollection(usersQuery);

  const getAuthorizedPlants = React.useCallback(() => {
    return userProfile?.plants || [];
  }, [userProfile]);

  const allTrips = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (isBootstrapAdmin) return rawTrips || [];
    if (!authPlants.length) return [];
    return rawTrips?.filter(t => authPlants.includes(t.plantCode)) || [];
  }, [rawTrips, getAuthorizedPlants, isBootstrapAdmin]);

  const allOrders = React.useMemo(() => {
    const authPlants = getAuthorizedPlants();
    if (isBootstrapAdmin) return rawOrders || [];
    if (!authPlants.length) return [];
    return rawOrders?.filter(o => authPlants.includes(o.plantCode)) || [];
  }, [rawOrders, getAuthorizedPlants, isBootstrapAdmin]);

  const homeStats = React.useMemo(() => {
    if (!allOrders || !allTrips) return { open: 0, loading: 0, transit: 0, arrived: 0, reject: 0, closed: 0 };
    
    const filterFn = (item: any) => {
      const matchesPlant = homePlantFilter === 'ALL' || item.plantCode === homePlantFilter;
      if (!matchesPlant) return false;
      const itemDate = item.createdAt || item.updatedAt || item.lrDate || item.saleOrderDate;
      const matchesMonth = !homeMonthFilter || (itemDate && itemDate.startsWith(homeMonthFilter));
      return matchesMonth;
    };

    const filteredOrders = allOrders.filter(o => o.status !== 'CANCELLED' && filterFn(o));
    const filteredTrips = allTrips.filter(filterFn);
    
    return {
      open: filteredOrders.length,
      loading: filteredTrips.filter(t => t.status === 'LOADING').length,
      transit: filteredTrips.filter(t => t.status === 'IN-TRANSIT').length,
      arrived: filteredTrips.filter(t => t.status === 'ARRIVED').length,
      reject: filteredTrips.filter(t => t.status === 'REJECTION').length,
      closed: filteredTrips.filter(t => t.status === 'CLOSED').length,
    };
  }, [allOrders, allTrips, homePlantFilter, homeMonthFilter]);

  const isAuthorized = React.useCallback((code: string) => {
    if (code === 'HOME' || code === '' || isBootstrapAdmin) return true;
    if (!userProfile) {
      const registryIsEmpty = Array.isArray(allUsers) && allUsers.length === 0;
      return registryIsEmpty;
    }
    return userProfile.tcodes?.includes(code);
  }, [userProfile, allUsers, isBootstrapAdmin]);

  const getRegistryList = React.useCallback(() => {
    if (activeScreen.startsWith('OX')) return rawPlants || [];
    if (activeScreen.startsWith('FM')) return rawCompanies || [];
    if (activeScreen.startsWith('XK')) return rawVendors || [];
    if (activeScreen.startsWith('XD')) {
      let list = rawCustomers || [];
      if (xdSearch.plant) list = list.filter((c: any) => c.plantCodes?.includes(xdSearch.plant));
      if (xdSearch.type) list = list.filter((c: any) => c.customerType === xdSearch.type);
      if (xdSearch.name) list = list.filter((c: any) => c.customerName?.toUpperCase().includes(xdSearch.name.toUpperCase()));
      if (xdSearch.customerId) list = list.filter((c: any) => (c.customerCode || c.id)?.toString().toUpperCase() === xdSearch.customerId.toUpperCase());
      return list;
    }
    if (activeScreen.startsWith('VA')) return allOrders || [];
    if (activeScreen.startsWith('SU')) return allUsers || [];
    return [];
  }, [activeScreen, rawPlants, rawCompanies, rawVendors, rawCustomers, allOrders, allUsers, xdSearch]);

  const handleDownloadTemplate = React.useCallback(() => {
    let headers = "";
    let filename = "";
    
    if (activeScreen.startsWith('VA')) {
      headers = "Plant,Sale Order,Consignor,Consignee,Ship to Party,Weight,UOM";
      filename = "VA01_SALES_ORDER_TEMPLATE.csv";
    } else if (activeScreen.startsWith('XD')) {
      headers = "PlantCodes,CustomerCode,CustomerName,CustomerType,Address,City,Mobile,GSTIN";
      filename = "XD01_CUSTOMER_MASTER_TEMPLATE.csv";
    } else if (activeScreen.startsWith('FM')) {
      headers = "CompanyCode,CompanyName,Address,City,State,PostalCode,GSTIN,PAN,Mobile,Email,Website";
      filename = "FM01_COMPANY_MASTER_TEMPLATE.csv";
    } else {
      toast({ title: "Template Not Available", description: "No template defined for this module." });
      return;
    }

    const blob = new Blob([headers], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    setStatusMsg({ text: `Template ${filename} downloaded`, type: 'success' });
  }, [activeScreen, toast]);

  const handleBulkUpload = React.useCallback(() => {
    if (bulkInputRef.current) bulkInputRef.current.click();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').filter(r => r.trim());
      if (rows.length < 2) {
        setStatusMsg({ text: 'Error: CSV is empty or invalid', type: 'error' });
        return;
      }

      const headers = rows[0].split(',').map(h => h.trim());
      const dataRows = rows.slice(1);

      setStatusMsg({ text: `Synchronizing hub nodes...`, type: 'info' });

      if (activeScreen.startsWith('VA')) {
        const orderGroups: Record<string, any> = {};
        let rejectedCount = 0;

        dataRows.forEach(row => {
          const cols = row.split(',').map(c => c.trim());
          const plant = cols[0];
          const soNo = cols[1];
          const cons = cols[2];
          const consee = cols[3];
          const ship = cols[4];
          const weight = parseFloat(cols[5] || '0');
          const uom = cols[6];

          // Strict validation: Plant, SO No, Consignor, Consignee, Ship to Party, Weight, UOM are mandatory
          if (!plant || !soNo || !cons || !consee || !ship || !weight || !uom) {
            rejectedCount++;
            return;
          }
          
          if (!orderGroups[soNo]) {
            const consData = rawCustomers?.find(c => c.customerName?.toUpperCase() === cons.toUpperCase());
            const shipData = rawCustomers?.find(c => c.customerName?.toUpperCase() === ship.toUpperCase());

            orderGroups[soNo] = {
              plantCode: plant,
              saleOrder: soNo,
              consignor: cons,
              from: consData?.city || '',
              consignee: consee,
              shipToParty: ship,
              destination: shipData?.city || '',
              deliveryAddress: shipData?.address || '',
              weight: 0,
              weightUom: uom,
              status: 'OPEN',
              createdAt: new Date().toISOString()
            };
          }
          orderGroups[soNo].weight += weight;
        });

        Object.values(orderGroups).forEach(order => {
          const docId = crypto.randomUUID();
          setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', docId), { ...order, id: docId }, { merge: true });
        });

        const savedCount = Object.keys(orderGroups).length;
        setStatusMsg({ text: `Bulk Sync: ${savedCount} Nodes Saved, ${rejectedCount} Rows Rejected`, type: rejectedCount > 0 ? 'error' : 'success' });

      } else if (activeScreen.startsWith('XD')) {
        const getIdx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
        const idxP = getIdx('PlantCodes');
        const idxCC = getIdx('CustomerCode');
        const idxCN = getIdx('CustomerName');
        const idxCT = getIdx('CustomerType');
        const idxA = getIdx('Address');
        const idxCi = getIdx('City');
        const idxM = getIdx('Mobile');
        const idxG = getIdx('GSTIN');

        // Check if mandatory headers are present
        if (idxP === -1 || idxCC === -1 || idxCN === -1 || idxCi === -1) {
          setStatusMsg({ text: 'Error: Mandatory headers (PlantCodes, CustomerCode, CustomerName, City) missing', type: 'error' });
          return;
        }

        let savedCount = 0;
        let rejectedCount = 0;

        dataRows.forEach(row => {
          const cols = row.split(',').map(c => c.trim());
          const pCode = cols[idxP];
          const cCode = cols[idxCC];
          const cName = cols[idxCN];
          const city = cols[idxCi];

          // Strict validation: Plant Code, Customer Code, Customer Name, City are mandatory
          if (!pCode || !cCode || !cName || !city) {
            rejectedCount++;
            return;
          }

          const docId = crypto.randomUUID();
          const customer = {
            id: docId,
            plantCodes: pCode.split(';'),
            customerCode: cCode,
            customerName: cName,
            customerType: idxCT !== -1 ? cols[idxCT] : '',
            address: idxA !== -1 ? cols[idxA] : '',
            city: city,
            mobile: idxM !== -1 ? cols[idxM] : '',
            gstin: idxG !== -1 ? cols[idxG] : '',
            updatedAt: new Date().toISOString()
          };
          setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'customers', docId), customer, { merge: true });
          savedCount++;
        });
        setStatusMsg({ text: `Bulk Sync: ${savedCount} Customers Saved, ${rejectedCount} Rejected`, type: rejectedCount > 0 ? 'error' : 'success' });
      }

      setTimeout(() => {
        if (bulkInputRef.current) bulkInputRef.current.value = '';
      }, 1500);
    };
    reader.readAsText(file);
  };

  const handleSave = React.useCallback(() => {
    if (!user || activeScreen === 'HOME' || activeScreen.endsWith('03')) return;

    let localData = { ...formData };
    const registryIsEmpty = Array.isArray(allUsers) && allUsers.length === 0;

    if (!isBootstrapAdmin) {
      if (activeScreen.startsWith('OX')) {
        const exists = rawPlants?.some((p: any) => p.id !== localData.id && p.plantCode?.toString().toUpperCase() === localData.plantCode?.toString().toUpperCase());
        if (exists) { setStatusMsg({ text: `ID/Number ${localData.plantCode} Already exists`, type: 'error' }); return; }
      }
      if (activeScreen.startsWith('FM')) {
        const exists = rawCompanies?.some((c: any) => c.id !== localData.id && c.companyCode?.toString().toUpperCase() === localData.companyCode?.toString().toUpperCase());
        if (exists) { setStatusMsg({ text: `ID/Number ${localData.companyCode} Already exists`, type: 'error' }); return; }
      }
      if (activeScreen.startsWith('XK')) {
        if (!(localData.mobile?.trim() && localData.address?.trim() && localData.route?.trim() && (localData.vendorName?.trim() || localData.vendorFirmName?.trim()))) {
          setStatusMsg({ text: 'Error: Mobile, Address, Route & Name are mandatory', type: 'error' }); return;
        }
        if (!localData.vendorCode) localData.vendorCode = `V${Math.floor(10000 + Math.random() * 90000)}`;
      }
      if (activeScreen.startsWith('XD')) {
        // Strict Mandatory Validation for XD01
        if (!(localData.plantCodes?.length && localData.customerCode && localData.customerName && localData.city)) {
          setStatusMsg({ text: 'Error: Plant, Customer Code, Name & City are mandatory', type: 'error' });
          return;
        }
        const exists = rawCustomers?.some((c: any) => c.id !== localData.id && (c.customerCode || c.id)?.toString().toUpperCase() === (localData.customerCode || localData.id)?.toString().toUpperCase());
        if (exists) { setStatusMsg({ text: `ID/Number ${localData.customerCode} Already exists`, type: 'error' }); return; }
      }
      if (activeScreen.startsWith('VA') && activeScreen !== 'VA04') {
        if (!(localData.plantCode && localData.saleOrder && localData.consignor && localData.from && localData.consignee && localData.shipToParty && localData.destination && localData.weight && localData.weightUom)) {
          setStatusMsg({ text: 'Error: Mandatory fields (Plant, SO No, Consignor, From, Consignee, Ship to Party, Destination, Weight, UOM) required', type: 'error' }); return;
        }
      }
      if (activeScreen === 'VA04') {
        const o = allOrders?.find(ord => (ord.saleOrder || ord.id)?.toString().toUpperCase() === localData.saleOrder?.toString().toUpperCase());
        if (!o) { setStatusMsg({ text: `Error: Order ${localData.saleOrder} not found`, type: 'error' }); return; }
        setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', o.id), { status: 'CANCELLED', updatedAt: new Date().toISOString() }, { merge: true });
        setStatusMsg({ text: `Success: Order ${localData.saleOrder} CANCELLED`, type: 'success' }); setFormData({}); return;
      }
      if (activeScreen.startsWith('SU')) {
        if (!(localData.fullName && localData.username && localData.password && localData.plants?.length && localData.tcodes?.length)) {
          setStatusMsg({ text: 'Error: Mandatory user fields missing', type: 'error' }); return;
        }
        const exists = allUsers?.some((u: any) => u.id !== localData.id && u.username?.toString().toUpperCase() === localData.username?.toString().toUpperCase());
        if (exists) { setStatusMsg({ text: `Username ${localData.username} exists`, type: 'error' }); return; }
      }
    }

    let col = '';
    let docId = localData.id;
    
    if (activeScreen.endsWith('01')) {
      docId = (activeScreen === 'SU01' && registryIsEmpty) ? user.uid : crypto.randomUUID();
    } else {
      docId = docId || crypto.randomUUID();
    }

    if (activeScreen.startsWith('OX')) col = 'plants';
    else if (activeScreen.startsWith('FM')) col = 'companies';
    else if (activeScreen.startsWith('XK')) col = 'vendors';
    else if (activeScreen.startsWith('XD')) col = 'customers';
    else if (activeScreen.startsWith('VA')) col = 'sales_orders';
    else if (activeScreen.startsWith('SU')) col = 'user_registry';

    if (col) {
      const isSys = col === 'user_registry';
      const docRef = isSys ? doc(db, 'user_registry', docId) : doc(db, 'users', SHARED_HUB_ID, col, docId);
      const payload = { 
        ...localData, 
        id: docId, 
        updatedAt: new Date().toISOString(),
        createdAt: localData.createdAt || new Date().toISOString()
      };
      setDocumentNonBlocking(docRef, payload, { merge: true });
      setStatusMsg({ text: `Synchronized successfully`, type: 'success' });
      
      if (activeScreen.endsWith('01')) {
        setFormData({});
        setSearchId('');
      } else if (!formData.id) {
        setFormData(payload);
      }
    }
  }, [user, activeScreen, formData, allOrders, rawVendors, rawCustomers, rawCompanies, rawPlants, allUsers, db, isBootstrapAdmin]);

  const executeTCode = React.useCallback((code: string) => {
    const input = code.toUpperCase().trim();
    if (!input) return;
    setHistory(p => [input, ...p.filter(h => h !== input)].slice(0, 7));
    setShowHistory(false); setHistoryIndex(-1);

    if (input.startsWith('/O')) {
      const target = input.replace('/O', '').trim();
      const baseUrl = window.location.origin + window.location.pathname;
      window.open(target ? `${baseUrl}?tcode=${target}` : baseUrl, '_blank'); setTCode(''); return;
    }

    const clean = input.replace('/N', '').trim();
    if (clean === 'HOME' || clean === '') { setActiveScreen('HOME'); setTCode(''); setFormData({}); setSearchId(''); return; }
    if (!isAuthorized(clean)) { setStatusMsg({ text: `Authorization failed for ${clean}`, type: 'error' }); setTCode(''); return; }

    if (MASTER_TCODES.some(t => t.code === clean)) {
      setActiveScreen(clean as Screen); setFormData({}); setSearchId(''); setXdSearch({ plant: '', type: '', name: '', customerId: '' });
      setStatusMsg({ text: `Transaction ${clean} executed`, type: 'info' });
    } else { setStatusMsg({ text: `T-Code ${clean} not found`, type: 'error' }); }
    setTCode('');
  }, [isAuthorized]);

  const handleCancel = React.useCallback(() => {
    if (activeScreen === 'HOME' || activeScreen.endsWith('03')) return;
    setFormData({}); setSearchId(''); setStatusMsg({ text: 'Operation cancelled', type: 'info' });
  }, [activeScreen]);

  React.useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  React.useEffect(() => {
    if (isAuthChecking || isBootstrapAdmin) return;
    if (!isUserLoading && !isProfileLoading && !isAllUsersLoading && user) {
      const registryIsEmpty = Array.isArray(allUsers) && allUsers.length === 0;
      if (userProfile === null && !registryIsEmpty) {
        toast({ title: "Access Denied", description: "Your account is not registered.", variant: "destructive" });
        router.push('/login');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, isAllUsersLoading, allUsers, router, toast, isBootstrapAdmin, isAuthChecking]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['F3', 'F4', 'F8', 'F12'].includes(e.key)) e.preventDefault();
      if (e.key === 'F8') handleSave();
      if (e.key === 'F3') { if (e.shiftKey) router.push('/'); else { setActiveScreen('HOME'); setFormData({}); } }
      if (e.key === 'F4') tCodeRef.current?.focus();
      if (e.key === 'F12') handleCancel();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); }
      if (e.key === 'ArrowDown' && showHistory) { e.preventDefault(); setHistoryIndex(p => (p < history.length - 1 ? p + 1 : p)); }
      if (e.key === 'ArrowUp' && showHistory) { e.preventDefault(); setHistoryIndex(p => (p > 0 ? p - 1 : 0)); }
      if (e.key === 'Enter' && document.activeElement === tCodeRef.current) {
        if (showHistory && historyIndex >= 0) { const s = history[historyIndex]; setTCode(s); executeTCode(s); }
        else executeTCode(tCode);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown); return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeScreen, handleSave, handleCancel, executeTCode, showHistory, historyIndex, history, router, tCode]);

  if (isUserLoading || isProfileLoading || isAllUsersLoading || isAuthChecking) {
    return <div className="h-screen w-full bg-[#f0f3f9] flex flex-col items-center justify-center font-mono space-y-4">
      <div className="w-8 h-8 border-2 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" /><span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1e3a8a]">Hub Node Synchronizing...</span>
    </div>;
  }

  const isReadOnly = activeScreen.endsWith('03');
  const showList = (activeScreen.endsWith('02') || activeScreen.endsWith('03')) && !formData.id;
  const showForm = activeScreen.endsWith('01') || activeScreen === 'VA04' || ((activeScreen.endsWith('02') || activeScreen.endsWith('03')) && formData.id);
  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'slmc-logo');
  const hideSidebar = activeScreen !== 'HOME';

  const handleSearchIdEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const idToSearch = searchId || xdSearch.customerId; if (!idToSearch) return;
      let list = getRegistryList();
      let item = list.find((i: any) => (i.plantCode || i.customerCode || i.companyCode || i.saleOrder || i.username || i.id || i.vendorCode).toString().toUpperCase() === idToSearch.toUpperCase());
      if (item) { setFormData(item); setSearchId(''); setXdSearch({ ...xdSearch, customerId: '' }); setStatusMsg({ text: `Record ${idToSearch} loaded`, type: 'success' }); }
      else { setStatusMsg({ text: `Record ${idToSearch} not found`, type: 'error' }); }
    }
  };

  const authorizedPlantsList = getAuthorizedPlants();

  return (
    <div className="flex flex-col h-screen w-full bg-[#f0f3f9] text-[#333] font-mono overflow-hidden">
      <div className="flex items-center bg-[#c5e0b4] border-b border-slate-400 px-3 h-8 text-[11px] font-semibold z-50">
        <div className="flex items-center gap-6">{['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map(i => <button key={i} className="hover:text-blue-800 transition-colors uppercase">{i}</button>)}</div>
        <div className="flex-1" /><div className="flex items-center h-full">
          <button className="h-full px-2 hover:bg-white/30"><PlusSquare className="h-3.5 w-3.5 opacity-30" /></button>
          <button className="h-full px-2 hover:bg-white/30"><Grid2X2 className="h-3 w-3 opacity-30" /></button>
          <button onClick={() => router.push('/')} className="h-full px-3 hover:bg-[#e81123] hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="flex flex-col bg-[#f0f0f0] border-b border-slate-300 shadow-sm z-40">
        <div className="flex items-center px-2 py-1 gap-4">
          <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-slate-300">
             {logoAsset && <Image src={logoAsset.url} alt="SLMC" width={80} height={30} className="object-contain" unoptimized />}
          </div>
          <div className="flex items-center bg-white border border-slate-400 p-0.5 shadow-inner relative">
            <button onClick={(e) => { e.preventDefault(); executeTCode(tCode); }} className="px-1 text-[#008000] font-black text-xs hover:bg-slate-100 transition-colors">✓</button>
            <input ref={tCodeRef} type="text" value={tCode} onChange={(e) => { setTCode(e.target.value); if (showHistory) setShowHistory(false); }}
              onClick={() => history.length > 0 && setShowHistory(true)} onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              className="w-48 outline-none text-xs px-1 font-bold tracking-wider"
            />
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 w-full bg-white border border-slate-400 shadow-md z-[60] mt-0.5">
                {history.map((h, i) => <div key={i} onClick={() => { setTCode(h); executeTCode(h); }} className={cn("px-4 py-1.5 text-xs font-bold cursor-pointer hover:bg-blue-50 transition-colors", i === historyIndex ? "bg-blue-100" : "")}>{h}</div>)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 px-4 border-l border-slate-300 ml-2 h-7">
             <button onClick={handleSave} disabled={activeScreen === 'HOME' || (isReadOnly && !isBootstrapAdmin)} className={cn("p-1 rounded", (activeScreen === 'HOME' || (isReadOnly && !isBootstrapAdmin)) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")} title="Save (F8)"><Save className="h-4 w-4 text-slate-600" /></button>
             <button onClick={() => executeTCode('/n')} className="p-1 hover:bg-slate-200 rounded" title="Exit (F3)"><Undo2 className="h-4 w-4 text-slate-600" /></button>
             <button onClick={handleCancel} disabled={activeScreen === 'HOME' || (isReadOnly && !isBootstrapAdmin)} className={cn("p-1 rounded", (activeScreen === 'HOME' || (isReadOnly && !isBootstrapAdmin)) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")} title="Cancel (F12)"><XCircle className="h-4 w-4 text-slate-600" /></button>
             <button onClick={() => window.open(window.location.href, '_blank')} className={cn("p-1 rounded hover:bg-slate-200")} title="New Session"><PlusSquare className="h-4 w-4 text-slate-600" /></button>
          </div>
          <div className="flex-1" /><div className="flex items-center gap-3 pr-4">
             {(activeScreen === 'XD01' || activeScreen === 'VA01' || activeScreen === 'FM01') && (
               <div className="flex items-center gap-2 mr-4">
                 <input type="file" ref={bulkInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
                 <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 h-7 bg-white border border-slate-300 hover:bg-slate-50 rounded text-[9px] font-black uppercase tracking-widest text-[#1e3a8a]"><FileText className="h-3.5 w-3.5" /> Template</button>
                 <button onClick={handleBulkUpload} className="flex items-center gap-1.5 px-3 h-7 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded text-[9px] font-black uppercase tracking-widest"><UploadCloud className="h-3.5 w-3.5" /> Bulk Upload</button>
               </div>
             )}
             <button onClick={() => window.print()} className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Printer className="h-4 w-4" /></button>
             <button onClick={() => { localStorage.removeItem('sap_bootstrap_session'); localStorage.removeItem('sap_user_role'); router.push('/login'); }} className="flex items-center gap-2 px-3 h-7 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-black uppercase tracking-widest text-slate-700"><LogOut className="h-3.5 w-3.5" /> Log Off</button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {!hideSidebar && (
          <div className="w-72 bg-white border-r border-slate-300 hidden lg:flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-[#dae4f1]/50"><h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1e3a8a] flex items-center gap-2"><Grid2X2 className="h-3.5 w-3.5" /> Favorites</h2></div>
            <div className="flex-1 overflow-y-auto green-scrollbar">
              {MASTER_TCODES.filter(t => t.code.endsWith('01') || t.code === 'TR21' || t.code === 'VA04' || t.code === 'ZCODE').map((item) => (
                <div key={item.code} onClick={() => executeTCode(item.code)} className={cn("flex items-center gap-4 px-5 py-3 hover:bg-blue-50 cursor-pointer group border-b border-slate-100 transition-all", activeScreen === item.code ? "bg-[#0056d2] text-white" : "text-[#1e3a8a]")}>
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", activeScreen === item.code ? "bg-white" : "bg-slate-300 group-hover:bg-blue-600")} />
                  <span className={cn("text-[10px] font-black uppercase tracking-tight", activeScreen === item.code ? "text-white" : "text-[#1e3a8a]")}>{item.code} - {item.description}</span>
                  <div className="flex-1" /><item.icon className={cn("h-3.5 w-3.5", activeScreen === item.code ? "text-white" : "text-slate-400")} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 flex-1 flex flex-col overflow-hidden bg-[#f0f3f9]">
          <div className="flex-1 overflow-y-auto p-2 md:p-4 relative">
            {activeScreen === 'HOME' ? (
              <div className="w-full h-full flex flex-col p-2 md:p-4 space-y-8 animate-fade-in">
                <h1 className="text-2xl md:text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter">Sikka Logistics Management Control</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 md:p-6 border border-slate-300 shadow-sm">
                  <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black uppercase text-slate-400">Authorized Plant Hub</label>
                    <select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold outline-none" value={homePlantFilter} onChange={(e) => setHomePlantFilter(e.target.value)}>
                      <option value="ALL">ALL AUTHORIZED PLANTS</option>
                      {rawPlants?.filter(p => isBootstrapAdmin || authorizedPlantsList.includes(p.plantCode)).map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 relative" ref={monthRef}><label className="text-[10px] font-black uppercase text-slate-400">Node Period</label>
                    <div onClick={() => setShowMonthCalendar(!showMonthCalendar)} className="h-10 border border-slate-400 bg-white px-3 flex items-center justify-between cursor-pointer shadow-sm"><span className="text-xs font-bold text-slate-700 uppercase">{format(new Date(homeMonthFilter + '-01'), 'MMMM yyyy')}</span><CalendarIcon className="h-4 w-4 text-slate-400" /></div>
                    {showMonthCalendar && (
                      <div className="absolute top-full left-0 mt-1 z-[60] flex flex-col border border-slate-300 bg-white rounded-lg shadow-2xl w-full max-w-[320px] animate-slide-down">
                        <div className="flex items-center justify-between p-3 border-b border-slate-200">
                          <button onClick={(e) => { e.stopPropagation(); const [y, m] = homeMonthFilter.split('-'); setHomeMonthFilter(`${parseInt(y) - 1}-${m}`); }} className="p-1.5 hover:bg-slate-50 rounded-md border border-slate-200"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm font-black">{homeMonthFilter.split('-')[0]}</span>
                          <button onClick={(e) => { e.stopPropagation(); const [y, m] = homeMonthFilter.split('-'); setHomeMonthFilter(`${parseInt(y) + 1}-${m}`); }} className="p-1.5 hover:bg-slate-50 rounded-md border border-slate-200"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-2 p-3">
                          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => {
                            const mStr = (i + 1).toString().padStart(2, '0'); const year = homeMonthFilter.split('-')[0]; const isActive = homeMonthFilter === `${year}-${mStr}`;
                            return <button key={m} onClick={(e) => { e.stopPropagation(); setHomeMonthFilter(`${year}-${mStr}`); setShowMonthCalendar(false); }} className={cn("py-2 text-[10px] font-black border rounded-md uppercase", isActive ? "bg-[#0056d2] text-white border-[#0056d2]" : "bg-white text-slate-600 border-slate-200")}>{m}</button>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[{ label: 'OPEN ORDER', count: homeStats.open, color: 'text-blue-600' }, { label: 'LOADING', count: homeStats.loading, color: 'text-orange-600' }, { label: 'IN-TRANSIT', count: homeStats.transit, color: 'text-emerald-600' }, { label: 'ARRIVED', count: homeStats.arrived, color: 'text-indigo-600' }, { label: 'REJECT', count: homeStats.reject, color: 'text-red-600' }, { label: 'CLOSED', count: homeStats.closed, color: 'text-slate-600' }].map(w => (
                    <div key={w.label} className="p-4 md:p-6 border border-slate-200 shadow-md flex flex-col items-center justify-center gap-2 bg-white animate-slide-up">
                      <span className="text-[10px] font-black text-slate-400 uppercase text-center">{w.label}</span><span className={cn("text-2xl md:text-4xl font-black italic tracking-tighter", w.color)}>{w.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={cn("bg-white shadow-xl rounded-sm border border-slate-300 overflow-hidden animate-slide-up min-h-[600px] p-4 md:p-6 mx-auto", hideSidebar ? "w-full" : "w-full max-w-[1400px]")}>
                 {showForm && <div className="space-y-6">
                   {activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                   {activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                   {activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                   {activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                   {activeScreen.startsWith('VA') && activeScreen !== 'VA04' && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} allCustomers={rawCustomers} />}
                   {activeScreen === 'VA04' && <CancelOrderForm data={formData} onChange={setFormData} allOrders={allOrders} onPost={handleSave} onCancel={() => setFormData({})} />}
                   {activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={rawPlants} />}
                 </div>}
                 {showList && <div className="space-y-6">
                   <div className="bg-[#dae4f1]/30 p-4 md:p-6 border border-slate-300 space-y-4"><label className="text-[11px] font-black uppercase text-slate-500 block">Registry Search Hub</label>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                           {activeScreen.startsWith('XD') ? <>
                               <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Customer ID</label><input className="h-10 border border-slate-400 px-3 text-xs font-black outline-none bg-white" value={xdSearch.customerId} onChange={(e) => setXdSearch({...xdSearch, customerId: e.target.value})} onKeyDown={handleSearchIdEnter} placeholder="ID & ENTER..." /></div>
                               <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Select Plant</label><select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold" value={xdSearch.plant} onChange={(e) => setXdSearch({...xdSearch, plant: e.target.value})}><option value="">ALL PLANTS</option>{rawPlants?.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}</select></div>
                               <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Select Type</label><select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold" value={xdSearch.type} onChange={(e) => setXdSearch({...xdSearch, type: e.target.value})}><option value="">ALL TYPES</option><option value="Consignor">Consignor</option><option value="Consignee - Ship to Party">Consignee - Ship to Party</option></select></div>
                               <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Enter Name</label><input className="h-10 border border-slate-400 px-4 text-xs font-black outline-none" value={xdSearch.name} onChange={(e) => setXdSearch({...xdSearch, name: e.target.value})} placeholder="NAME..." /></div>
                             </> : <div className="col-span-1 md:col-span-4 flex items-center gap-4"><input className="h-11 w-full border border-slate-400 px-4 text-xs font-black outline-none bg-white" value={searchId} onChange={(e) => setSearchId(e.target.value)} onKeyDown={handleSearchIdEnter} placeholder="ENTER CODE & PRESS ENTER..." /></div>}
                        </div>
                   </div>
                   <RegistryList onSelectItem={setFormData} listData={getRegistryList()} activeScreen={activeScreen} />
                 </div>}
                 {activeScreen === 'TR21' && <DripBoard orders={allOrders} trips={allTrips} vendors={rawVendors} plants={rawPlants} onStatusUpdate={setStatusMsg} />}
                 {activeScreen === 'ZCODE' && <ZCodeRegistry tcodes={MASTER_TCODES} onExecute={executeTCode} />}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-7 bg-[#0f172a] flex items-center px-4 text-[9px] font-black text-white/90 uppercase tracking-[0.15em]">
        <div className="flex items-center gap-4 md:gap-8 overflow-hidden"><span className="flex items-center gap-2.5 shrink-0"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />SYNC: ACTIVE</span><span className="shrink-0">{activeScreen}</span><span className="truncate">USER: {isBootstrapAdmin ? 'SUPER ADMIN' : (userProfile?.fullName || 'Authenticating...')}</span>{statusMsg.text !== 'Ready' && <span className={cn("truncate", statusMsg.type === 'error' ? "text-red-400" : "text-blue-400")}>EVENT: {statusMsg.text}</span>}</div>
      </div>
    </div>
  );
}

function SectionGrouping({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="border border-slate-300 p-4 md:p-5 pt-4 relative bg-white rounded-sm mb-6">
      {title && <span className="absolute -top-3 left-4 bg-white px-2 md:px-3 text-[10px] font-black uppercase text-slate-400 border border-slate-200">{title}</span>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">{children}</div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text", disabled, placeholder, rightElement }: any) {
  return (
    <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <div className="relative">
        <Input type={type} value={value || ''} onChange={(e: any) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className="h-9 rounded-none border-slate-400 text-xs font-bold bg-white focus:ring-1 shadow-sm pr-10" />
        {rightElement && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
    </div>
  );
}

function FormSelect({ label, value, options, onChange, disabled, placeholder }: any) {
  return (
    <div className="flex flex-col gap-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-9 border border-slate-400 bg-white px-2 text-xs font-bold outline-none shadow-sm">
        <option value="">{placeholder || 'Select...'}</option>{options.map((o: any, idx: number) => {
          const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label;
          return <option key={`${v}-${idx}`} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}

function FormSearchInput({ label, value, options, onChange, disabled, placeholder }: any) {
  const [inputValue, setInputValue] = React.useState(value || '');
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  
  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return [];
    return options.filter((o: string) => o?.toUpperCase().includes(inputValue.toUpperCase())).slice(0, 10);
  }, [options, inputValue]);

  React.useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const handleSelect = (val: string) => {
    setInputValue(val);
    onChange(val);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Tab') {
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 relative">
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <div className="relative">
        <Input 
          value={inputValue} 
          onChange={(e) => { 
            const val = e.target.value;
            setInputValue(val); 
            onChange(val);
            setIsOpen(true); 
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 250)}
          onKeyDown={handleKeyDown}
          disabled={disabled} 
          placeholder={placeholder} 
          className="h-9 rounded-none border-slate-400 text-xs font-bold bg-white focus:ring-1 shadow-sm pr-10" 
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Search className="h-3 w-3 text-slate-400" />
        </div>
      </div>
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-xl z-[100] mt-1 max-h-[200px] overflow-y-auto rounded-sm">
          {filteredOptions.map((opt: string, idx: number) => (
            <div 
              key={idx} 
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                "px-4 py-2.5 text-[11px] font-bold cursor-pointer border-b border-slate-50 last:border-0",
                idx === highlightedIndex ? "bg-[#e8f0fe] text-[#0056d2]" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlantForm({ data, onChange, disabled }: any) {
  return <div className="space-y-4"><SectionGrouping title="DATA">
    <FormInput label="PLANT CODE" value={data.plantCode} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
    <FormInput label="PLANT NAME" value={data.plantName} onChange={(v: string) => onChange({...data, plantName: v})} disabled={disabled} /></SectionGrouping>
    <SectionGrouping title="SETTINGS"><FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
    <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
    <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
    <FormInput label="STATE" value={data.state} onChange={(v: string) => onChange({...data, state: v})} disabled={disabled} /></SectionGrouping></div>;
}

function CompanyForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("Error: Image size must be under 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ ...data, logo: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return <div className="space-y-4"><SectionGrouping title="IDENTIFICATION"><div className="col-span-1 md:col-span-2 space-y-2 mb-4"><label className="text-[10px] font-bold text-slate-500">Plant Assignment (Multiple)</label>
    <div className="flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-3 py-1.5 text-[10px] font-black border uppercase", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border-slate-300")}>{p}</button>)}</div></div>
    <FormInput label="COMPANY CODE" value={data.companyCode} onChange={(v: string) => onChange({...data, companyCode: v})} disabled={disabled} /><FormInput label="COMPANY NAME" value={data.companyName} onChange={(v: string) => onChange({...data, companyName: v})} disabled={disabled} /></SectionGrouping>
    <SectionGrouping title="LOCATION"><FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} /><FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
    <FormInput label="STATE" value={data.state} onChange={(v: string) => onChange({...data, state: v})} disabled={disabled} /><FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} /></SectionGrouping>
    <SectionGrouping title="TAXATION & CONTACT">
      <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
      <FormInput label="PAN" value={data.pan} onChange={(v: string) => onChange({...data, pan: v})} disabled={disabled} />
      <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} placeholder="Multiple numbers with comma (,)..." />
      <FormInput label="EMAIL ID" value={data.email} onChange={(v: string) => onChange({...data, email: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="WEB & ASSETS">
      <FormInput label="WEBSITE" value={data.website} onChange={(v: string) => onChange({...data, website: v})} disabled={disabled} />
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase">Company Logo (Under 500 KB)</label>
        <div className="flex items-center gap-3">
          <input type="file" accept="image/*" onChange={handleFile} disabled={disabled} className="hidden" id="fm01-logo-up" />
          <label htmlFor="fm01-logo-up" className={cn("flex-1 h-9 border border-slate-400 bg-white px-3 flex items-center text-[11px] font-bold cursor-pointer shadow-sm", disabled && "opacity-50 cursor-not-allowed")}>
            {data.logo ? "CHANGE IMAGE" : "UPLOAD IMAGE..."}
          </label>
          {data.logo && (
            <div className="h-9 w-9 border border-slate-300 rounded overflow-hidden bg-white shrink-0 relative group">
              <Image src={data.logo} alt="Logo" fill className="object-contain" unoptimized />
              {!disabled && <button onClick={() => onChange({...data, logo: ''})} className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Trash2 className="h-3 w-3" /></button>}
            </div>
          )}
        </div>
      </div>
    </SectionGrouping></div>;
}

function VendorForm({ data, onChange, disabled }: any) {
  return <div className="space-y-4"><SectionGrouping title="IDENTIFICATION"><FormInput label="VENDOR CODE" value={data.vendorCode} disabled={true} placeholder="AUTO-GENERATED" /><FormInput label="VENDOR NAME" value={data.vendorName} onChange={(v: string) => onChange({...data, vendorName: v})} disabled={disabled} />
    <FormInput label="VENDOR FIRM NAME" value={data.vendorFirmName} onChange={(v: string) => onChange({...data, vendorFirmName: v})} disabled={disabled} /></SectionGrouping>
    <SectionGrouping title="DETAILS"><FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} /><FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
    <FormInput label="SPECIAL ROUTE" value={data.route} onChange={(v: string) => onChange({...data, route: v})} disabled={disabled} /></SectionGrouping></div>;
}

function CustomerForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  return <div className="space-y-4"><SectionGrouping title="IDENTIFICATION"><div className="col-span-1 md:col-span-2 space-y-2 mb-4"><label className="text-[10px] font-bold text-slate-500">Plant Assignment (Multiple) *</label>
    <div className="flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-3 py-1.5 text-[10px] font-black border uppercase", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border-slate-300")}>{p}</button>)}</div></div>
    <FormInput label="CUSTOMER CODE *" value={data.customerCode} onChange={(v: string) => onChange({...data, customerCode: v})} disabled={disabled} /><FormInput label="CUSTOMER NAME *" value={data.customerName} onChange={(v: string) => onChange({...data, customerName: v})} disabled={disabled} />
    <FormSelect label="CUSTOMER TYPE" value={data.customerType} options={["Consignor", "Consignee - Ship to Party"]} onChange={(v: string) => onChange({...data, customerType: v})} disabled={disabled} /></SectionGrouping>
    <SectionGrouping title="LOCATION"><FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} /><FormInput label="CITY *" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
    <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} /><FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} placeholder="ENTER GSTIN..." /></SectionGrouping></div>;
}

function SalesOrderForm({ data, onChange, disabled, allPlants, allCustomers }: any) {
  const pOpts = (allPlants || []).map((p: any) => p.plantCode);
  const filtered = (allCustomers || []).filter((c: any) => c.plantCodes?.includes(data.plantCode));
  const cons = filtered.filter((c: any) => c.customerType === 'Consignor');
  const ships = filtered.filter((c: any) => c.customerType === 'Consignee - Ship to Party');
  
  return <div className="space-y-4">
    <SectionGrouping title="HEADER">
      <FormSelect label="PLANT" value={data.plantCode} options={pOpts} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
      <FormInput label="SALE ORDER NO" value={data.saleOrder} onChange={(v: string) => onChange({...data, saleOrder: v})} disabled={disabled} />
    </SectionGrouping>
    
    <SectionGrouping title="COORDINATION">
      <FormSearchInput 
        label="CONSIGNOR" 
        value={data.consignor} 
        options={cons.map(c => c.customerName)} 
        onChange={(v: string) => {
          const matching = cons.find(c => c.customerName?.toUpperCase() === v?.toUpperCase());
          onChange({...data, consignor: v, from: matching?.city || ''});
        }} 
        disabled={disabled} 
      />
      <FormInput label="FROM" value={data.from} disabled={true} />
      <FormSearchInput 
        label="CONSIGNEE" 
        value={data.consignee} 
        placeholder="Select..." 
        options={ships.map(c => c.customerName)} 
        onChange={(v: string) => onChange({...data, consignee: v})} 
        disabled={disabled} 
      />
      <FormSearchInput 
        label="SHIP TO PARTY" 
        value={data.shipToParty} 
        options={ships.map(c => c.customerName)} 
        onChange={(v: string) => {
          const matching = ships.find(c => c.customerName?.toUpperCase() === v?.toUpperCase());
          onChange({...data, shipToParty: v, destination: matching?.city || '', deliveryAddress: matching?.address || ''});
        }} 
        disabled={disabled} 
      />
      <FormInput label="DESTINATION" value={data.destination} disabled={true} />
      <FormInput 
        label="DELIVERY ADDRESS" 
        value={data.deliveryAddress} 
        onChange={(v: string) => onChange({...data, deliveryAddress: v})} 
        disabled={disabled} 
        placeholder="ENTER DELIVERY ADDRESS..." 
      />
      <FormInput 
        label="WEIGHT" 
        type="number"
        value={data.weight} 
        onChange={(v: string) => onChange({...data, weight: v})} 
        disabled={disabled} 
        placeholder="ENTER TOTAL WEIGHT..." 
      />
      <FormSelect 
        label="UOM" 
        value={data.weightUom} 
        options={["MT", "LTR"]} 
        onChange={(v: string) => onChange({...data, weightUom: v})} 
        disabled={disabled} 
      />
    </SectionGrouping>
  </div>;
}

function UserForm({ data, onChange, disabled, allPlants }: any) {
  const [showPassword, setShowPassword] = React.useState(false);
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handlePToggle = (p: string) => { if (disabled) return; const curr = data.plants || []; onChange({...data, plants: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  const handleTToggle = (c: string) => { if (disabled) return; const curr = data.tcodes || []; onChange({...data, tcodes: curr.includes(c) ? curr.filter((i: string) => i !== c) : [...curr, c]}); };
  
  return <div className="space-y-6">
    <SectionGrouping title="USER IDENTIFICATION">
      <FormInput label="NAME" value={data.fullName} onChange={(v: string) => onChange({...data, fullName: v})} disabled={disabled} />
      <FormInput label="USERNAME" value={data.username} onChange={(v: string) => onChange({...data, username: v})} disabled={disabled} />
      <FormInput 
        label="PASSWORD" 
        type={showPassword ? "text" : "password"} 
        value={data.password} 
        onChange={(v: string) => onChange({...data, password: v})} 
        disabled={disabled} 
        rightElement={
          <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-blue-900 transition-colors">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="AUTHORIZED PLANTS"><div className="col-span-1 md:col-span-2 flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handlePToggle(p)} disabled={disabled} className={cn("px-3 py-1.5 text-[10px] font-black border", data.plants?.includes(p) ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border-slate-300")}>{p}</button>)}</div></SectionGrouping>
    <SectionGrouping title="T-CODE AUTHORIZATION"><div className="col-span-1 md:col-span-2 flex flex-wrap gap-2">{MASTER_TCODES.map(t => <button key={t.code} onClick={() => handleTToggle(t.code)} disabled={disabled} className={cn("px-3 py-1.5 text-[10px] font-black border", data.tcodes?.includes(t.code) ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border-slate-300")}>{t.code}</button>)}</div></SectionGrouping></div>;
}

function CancelOrderForm({ data, onChange, allOrders, onPost, onCancel }: any) {
  return <div className="space-y-8"><SectionGrouping title="CANCELLATION HUB"><div className="flex flex-col gap-2 col-span-1 md:col-span-2"><label className="text-[11px] font-black uppercase text-red-600">Sales Order Number *</label>
    <input className="h-12 border border-red-200 px-4 text-sm font-black outline-none bg-red-50/30" placeholder="ENTER ORDER NO. & ENTER" value={data.saleOrder || ''} onChange={e => onChange({ ...data, saleOrder: e.target.value.toUpperCase() })} onKeyDown={e => { if (e.key === 'Enter') { const o = allOrders?.find((ord: any) => ord.saleOrder === data.saleOrder); if (o) onChange({...data, ...o}); } }} /></div></SectionGrouping>
    <div className="flex justify-end gap-4"><Button onClick={onCancel} variant="ghost">Exit</Button><Button onClick={onPost} className="bg-red-600 text-white font-black uppercase text-[10px] px-6 md:px-10 h-11">Execute Cancellation</Button></div></div>;
}

function RegistryList({ onSelectItem, listData, activeScreen }: any) {
  const isUserRegistry = activeScreen?.startsWith('SU');
  const headers = isUserRegistry 
    ? ['Name', 'Username', 'Password', 'Authorized Plant']
    : ['ID', 'Name / Description', 'Type / Details', 'Sync Hub'];

  return <div className="overflow-x-auto border border-slate-300 shadow-sm"><table className="w-full text-left border-collapse min-w-[700px]">
    <thead className="bg-[#f0f0f0] text-[10px] font-black uppercase"><tr>{headers.map(c => <th key={c} className="p-3 border-r">{c}</th>)}</tr></thead>
    <tbody>{listData?.map((item: any) => <tr key={item.id} onClick={() => onSelectItem(item)} className="border-b hover:bg-[#e8f0fe] cursor-pointer transition-colors text-[11px] font-bold">
      {isUserRegistry ? (
        <>
          <td className="p-3 font-black text-[#0056d2] uppercase">{item.fullName}</td>
          <td className="p-3 uppercase">{item.username}</td>
          <td className="p-3">{item.password}</td>
          <td className="p-3 uppercase text-slate-500 italic">{item.plants?.join(', ') || 'NONE'}</td>
        </>
      ) : (
        <>
          <td className="p-3 font-black text-[#0056d2]">{item.saleOrder || item.plantCode || item.customerCode || item.vendorCode || item.companyCode || item.id.slice(0, 8)}</td>
          <td className="p-3 uppercase">{item.customerName || item.plantName || item.vendorName || item.companyName || item.fullName || item.username || `${item.consignor} → ${item.consignee}`}</td>
          <td className="p-3 italic text-slate-500">{item.city || item.customerType || item.vendorCode || 'DATA'}</td>
          <td className="p-3 text-slate-400">{format(new Date(item.updatedAt || new Date()), 'dd-MM-yyyy')}</td>
        </>
      )}
    </tr>)}
    </tbody></table></div>;
}

function DripBoard({ orders, trips, vendors, plants, onStatusUpdate }: any) {
  const { user } = useUser(); const db = useFirestore(); const [activeTab, setActiveTab] = React.useState('Open Orders'); const [selectedOrder, setSelectedOrder] = React.useState<any>(null); const [isPopupOpen, setIsPopupOpen] = React.useState(false); const [assignData, setAssignData] = React.useState<any>({ fleetType: 'Own Vehicle' }); const [vendorSearch, setVendorSearch] = React.useState(''); const [showVS, setShowVS] = React.useState(false);
  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];
  const getStats = (o: any) => { const tot = parseFloat(o.weight) || 0; const ass = trips?.filter((t: any) => t.saleOrderId === o.id).reduce((a: number, t: any) => a + (t.assignWeight || 0), 0) || 0; return { tot, ass, bal: tot - ass, uom: o.weightUom || 'MT' }; };
  const fOrders = React.useMemo(() => (orders || []).filter(o => o.status !== 'CANCELLED').map(o => ({ ...o, ...getStats(o) })).filter(o => o.bal > 0), [orders, trips]);
  const fTrips = React.useMemo(() => { if (!trips) return []; const map: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' }; return trips.filter(t => t.status === map[activeTab]); }, [trips, activeTab]);
  const handleAssign = (o: any) => { setSelectedOrder(o); setAssignData({ plantCode: o.plantCode, consignee: o.consignee, shipToParty: o.shipToParty, route: o.route || '', orderQty: `${o.bal} ${o.uom}`, fleetType: 'Own Vehicle', assignWeight: o.bal }); setIsPopupOpen(true); };
  const handlePost = () => { if (!user || !selectedOrder) return; const tId = `T${Math.floor(100000000 + Math.random() * 900000000)}`; const newId = crypto.randomUUID(); const p = { id: newId, tripId: tId, saleOrderId: selectedOrder.id, saleOrderNumber: selectedOrder.saleOrder, plantCode: assignData.plantCode, shipToParty: assignData.shipToParty, route: assignData.route, consignor: selectedOrder.consignor, consignee: selectedOrder.consignee, vehicleNumber: assignData.vehicleNumber, driverMobile: assignData.driverMobile, fleetType: assignData.fleetType, vendorName: assignData.vendorName, assignWeight: parseFloat(assignData.assignWeight || 0), status: 'LOADING', createdAt: new Date().toISOString() }; setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', newId), p, { merge: true }); setIsPopupOpen(false); setSelectedOrder(null); onStatusUpdate({ text: `Trip ${tId} posted to Loading`, type: 'success' }); };
  const mVendors = (vendors || []).filter((v: any) => v.vendorName?.toUpperCase().includes(vendorSearch.toUpperCase()));
  return <div className="flex flex-col h-full space-y-4"><div className="flex border-b border-slate-300 bg-[#dae4f1]/30 overflow-x-auto no-scrollbar">{TABS.map(t => <button key={t} onClick={() => setActiveTab(t)} className={cn("px-4 md:px-6 py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap", activeTab === t ? "bg-white border-x border-t border-slate-300 text-[#0056d2] shadow-sm -mb-px" : "text-slate-500 hover:text-slate-700")}>{t}</button>)}</div>
    <div className="flex-1 overflow-auto bg-white border border-slate-300"><table className="w-full text-left min-w-[1000px]"><thead><tr className="bg-[#f8fafc] text-[9px] font-black uppercase sticky top-0">{activeTab === 'Open Orders' ? ['Plant', 'Sale Order', 'Consignor', 'Consignee', 'Ship to Party', 'Route', 'Order Qty', 'Assign Qty', 'Balance Qty', 'Action'].map(h => <th key={h} className="p-3 border-r">{h}</th>) : ['Trip ID', 'Vehicle No', 'Plant', 'Consignee', 'Ship to Party', 'Route', 'Assign Qty', 'Action', 'Sync Hub'].map(h => <th key={h} className="p-3 border-r">{h}</th>)}</tr></thead>
      <tbody>{activeTab === 'Open Orders' ? fOrders.map(o => <tr key={o.id} className="border-b text-[11px] font-bold"><td className="p-3">{o.plantCode}</td><td className="p-3 text-[#0056d2] font-black">{o.saleOrder}</td><td className="p-3 uppercase">{o.consignor}</td><td className="p-3 uppercase">{o.consignee}</td><td className="p-3 uppercase">{o.shipToParty}</td><td className="p-3 uppercase">{o.route}</td><td className="p-3 font-black">{o.tot} {o.uom}</td><td className="p-3 text-emerald-600">{o.ass} {o.uom}</td><td className="p-3 text-red-600 font-black">{o.bal} {o.uom}</td><td className="p-3"><Button onClick={() => handleAssign(o)} size="sm" className="bg-[#0056d2] text-white font-black text-[9px]">Assign</Button></td></tr>) : fTrips.map(t => <tr key={t.id} className="border-b text-[11px] font-bold"><td className="p-3 text-[#0056d2] font-black">#{t.tripId}</td><td className="p-3 uppercase">{t.vehicleNumber}</td><td className="p-3">{t.plantCode}</td><td className="p-3 uppercase">{t.consignee}</td><td className="p-3 uppercase">{t.shipToParty}</td><td className="p-3 uppercase">{t.route}</td><td className="p-3 text-emerald-600 font-black">{t.assignWeight} MT</td><td className="p-3"><Button size="sm" className="text-[9px] bg-slate-100 text-slate-600">Action</Button></td><td className="p-3 text-slate-400">{format(new Date(t.createdAt), 'dd-MM HH:mm')}</td></tr>)}</tbody></table></div>
    <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}><DialogContent className="max-w-[90vw] md:max-w-3xl bg-[#f0f3f9] p-0"><div className="p-4 md:p-8 space-y-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"><div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Vehicle Number *</label><input value={assignData.vehicleNumber || ''} onChange={e => setAssignData({...assignData, vehicleNumber: e.target.value.toUpperCase()})} className="h-10 border border-slate-400 px-3 text-xs font-black" /></div><div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Driver Mobile *</label><input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black" /></div><div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Assign Qty *</label><input type="number" value={assignData.assignWeight || ''} onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black" /></div><div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Fleet Type *</label><select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black"><option value="Own Vehicle">Own Vehicle</option><option value="Market Vehicle">Market Vehicle</option></select></div></div>
      {assignData.fleetType === 'Market Vehicle' && <div className="p-4 md:p-6 bg-[#dae4f1]/20 border-l-4 border-blue-600 space-y-4"><div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Vendor Hub *</label><div className="relative"><input value={vendorSearch} onChange={e => { setVendorSearch(e.target.value); setShowVS(true); }} className="h-10 w-full border border-slate-400 px-3 text-xs font-black" />{showVS && mVendors.length > 0 && <div className="absolute top-full left-0 w-full bg-white border shadow-xl z-20 max-h-[150px] overflow-y-auto">{mVendors.map((v:any) => <div key={v.id} onClick={() => { setVendorSearch(v.vendorName); setAssignData({...assignData, vendorName: v.vendorName}); setShowVS(false); }} className="px-4 py-2 text-xs font-bold hover:bg-blue-50 cursor-pointer">{v.vendorName}</div>)}</div>}</div></div></div>}
      <div className="flex justify-end gap-4"><Button onClick={() => setIsPopupOpen(false)} variant="outline">Cancel</Button><Button onClick={handlePost} className="bg-[#0056d2] text-white">Post to Loading</Button></div></div></DialogContent></Dialog>
  </div>;
}

function ZCodeRegistry({ tcodes, onExecute }: { tcodes: any[], onExecute: (code: string) => void }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">{tcodes.map(t => <div key={t.code} onClick={() => onExecute(t.code)} className="bg-white p-4 md:p-6 border hover:border-blue-400 cursor-pointer transition-all relative">
    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200" /><Badge className="mb-4">{t.module}</Badge><h3 className="text-xs font-black text-[#1e3a8a] uppercase">{t.code}</h3><p className="text-[10px] font-bold text-slate-500 uppercase">{t.description}</p></div>)}</div>;
}
