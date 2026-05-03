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
  Loader2, Camera, Radar, Settings
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
  setDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, isAfter, parse } from 'date-fns';
import { cn } from '@/lib/utils';
import placeholderData from '@/app/lib/placeholder-images.json';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'VA04' | 'TR21' | 'WGPS24' | 'SU01' | 'SU02' | 'SU03' | 'ZCODE';

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
  { code: 'WGPS24', description: 'GPS TRACKING HUB', icon: Radar, module: 'Logistics' },
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
  const [screenStack, setScreenStack] = React.useState<Screen[]>(['HOME']);
  const [showHistory, setShowHistory] = React.useState(false);
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const [activeScreen, setActiveScreen] = React.useState<Screen>('HOME');
  const [formData, setFormData] = React.useState<any>({});
  const [searchId, setSearchId] = React.useState('');
  const [statusMsg, setStatusMsg] = React.useState<{ text: string, type: 'success' | 'error' | 'info' | 'none' }>({ text: 'Ready', type: 'none' });
  const [greeting, setGreeting] = React.useState('');
  
  const [homePlantFilter, setHomePlantFilter] = React.useState('ALL');
  const [homeMonthFilter, setHomeMonthFilter] = React.useState(format(new Date(), 'yyyy-MM'));
  const [showMonthCalendar, setShowMonthCalendar] = React.useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [isAuthChecking, setIsAuthChecking] = React.useState(true);
  const [registryId, setRegistryId] = React.useState<string | null>(null);
  const [xdSearch, setXdSearch] = React.useState({ plant: '', type: '', name: '', customerId: '', postalCode: '' });

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

  React.useEffect(() => {
    const updateGreeting = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istTime = new Date(utc + (3600000 * 5.5));
      const hour = istTime.getHours();
      
      let msg = '';
      if (hour >= 0 && hour < 12) {
        msg = 'Good Morning, Have a good day';
      } else if (hour >= 12 && hour < 17) {
        msg = 'Good Afternoon, Have a great day';
      } else {
        msg = 'Good Evening';
      }
      setGreeting(msg);
    };

    updateGreeting();
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
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

  const authorizedPlantsList = React.useMemo(() => {
    return userProfile?.plants || [];
  }, [userProfile]);

  const accessiblePlants = React.useMemo(() => {
    if (isBootstrapAdmin) return rawPlants || [];
    return (rawPlants || []).filter(p => authorizedPlantsList.includes(p.plantCode));
  }, [rawPlants, authorizedPlantsList, isBootstrapAdmin]);

  const accessibleCompanies = React.useMemo(() => {
    if (isBootstrapAdmin) return rawCompanies || [];
    return (rawCompanies || []).filter(c => c.plantCodes?.some((p: string) => authorizedPlantsList.includes(p)));
  }, [rawCompanies, authorizedPlantsList, isBootstrapAdmin]);

  const accessibleVendors = React.useMemo(() => {
    if (isBootstrapAdmin) return rawVendors || [];
    return (rawVendors || []).filter(v => v.plantCodes?.some((p: string) => authorizedPlantsList.includes(p)));
  }, [rawVendors, authorizedPlantsList, isBootstrapAdmin]);

  const accessibleCustomers = React.useMemo(() => {
    if (isBootstrapAdmin) return rawCustomers || [];
    return (rawCustomers || []).filter(c => c.plantCodes?.some((p: string) => authorizedPlantsList.includes(p)));
  }, [rawCustomers, authorizedPlantsList, isBootstrapAdmin]);

  const accessibleUsers = React.useMemo(() => {
    if (isBootstrapAdmin) return allUsers || [];
    if (!authorizedPlantsList.length) return [];
    return (allUsers || []).filter(u => u.plants?.some((p: string) => authorizedPlantsList.includes(p)));
  }, [allUsers, authorizedPlantsList, isBootstrapAdmin]);

  const allTrips = React.useMemo(() => {
    if (isBootstrapAdmin) return rawTrips || [];
    if (!authorizedPlantsList.length) return [];
    return rawTrips?.filter(t => authorizedPlantsList.includes(t.plantCode)) || [];
  }, [rawTrips, authorizedPlantsList, isBootstrapAdmin]);

  const allOrders = React.useMemo(() => {
    if (isBootstrapAdmin) return rawOrders || [];
    if (!authorizedPlantsList.length) return [];
    return rawOrders?.filter(o => authorizedPlantsList.includes(o.plantCode)) || [];
  }, [rawOrders, authorizedPlantsList, isBootstrapAdmin]);

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
    if (activeScreen.startsWith('OX')) return accessiblePlants;
    if (activeScreen.startsWith('FM')) return accessibleCompanies;
    if (activeScreen.startsWith('XK')) return accessibleVendors;
    if (activeScreen.startsWith('XD')) {
      let list = accessibleCustomers;
      if (xdSearch.plant) list = list.filter((c: any) => c.plantCodes?.includes(xdSearch.plant));
      if (xdSearch.type) list = list.filter((c: any) => c.customerType === xdSearch.type);
      if (xdSearch.name) list = list.filter((c: any) => c.customerName?.toUpperCase().includes(xdSearch.name.toUpperCase()));
      if (xdSearch.customerId) list = list.filter((c: any) => (c.customerCode || c.id)?.toString().toUpperCase() === xdSearch.customerId.toUpperCase());
      return list;
    }
    if (activeScreen.startsWith('VA')) return allOrders;
    if (activeScreen.startsWith('SU')) return accessibleUsers;
    return [];
  }, [activeScreen, accessiblePlants, accessibleCompanies, accessibleVendors, accessibleCustomers, allOrders, accessibleUsers, xdSearch]);

  const handleDownloadTemplate = React.useCallback(() => {
    let headers = "";
    let filename = "";
    
    if (activeScreen.startsWith('VA')) {
      headers = "Plant,Sale Order,Consignor,Consignee,Ship to Party,Weight,UOM";
      filename = "VA01_SALES_ORDER_TEMPLATE.csv";
    } else if (activeScreen.startsWith('XD')) {
      headers = "PlantCodes,CustomerCode,CustomerName,CustomerType,Address,City,PostalCode,Mobile,GSTIN";
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

      const parseCsvRow = (rowText: string) => {
        const result = [];
        let currentField = '';
        let insideQuotes = false;
        for (let i = 0; i < rowText.length; i++) {
          const char = rowText[i];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            result.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }
        result.push(currentField.trim());
        return result.map(field => field.replace(/^"|"$/g, '').trim());
      };

      const headers = parseCsvRow(rows[0]);
      const dataRows = rows.slice(1);

      setStatusMsg({ text: `Synchronizing hub nodes...`, type: 'info' });

      if (activeScreen.startsWith('VA')) {
        const getIdx = (name: string) => headers.findIndex(h => h.toLowerCase().replace(/\s/g, '') === name.toLowerCase().replace(/\s/g, ''));
        const idxP = getIdx('Plant');
        const idxSO = getIdx('SaleOrder');
        const idxCons = getIdx('Consignor');
        const idxConsee = getIdx('Consignee');
        const idxShip = getIdx('ShiptoParty');
        const idxW = getIdx('Weight');
        const idxU = getIdx('UOM');

        if (idxP === -1 || idxSO === -1 || idxCons === -1 || idxConsee === -1 || idxShip === -1 || idxW === -1 || idxU === -1) {
          setStatusMsg({ text: 'Error: Mandatory headers missing for Sales Order', type: 'error' });
          return;
        }

        const orderGroups: Record<string, any> = {};
        let rejectedCount = 0;

        dataRows.forEach(row => {
          const cols = parseCsvRow(row);
          const plant = cols[idxP];
          const soNo = cols[idxSO];
          const cons = cols[idxCons];
          const consee = cols[idxConsee];
          const ship = cols[idxShip];
          const weight = parseFloat(cols[idxW] || '0');
          const uom = cols[idxU];

          if (!plant || !soNo || !cons || !consee || !ship || isNaN(weight) || !uom) {
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
        const getIdx = (name: string) => headers.findIndex(h => h.toLowerCase().replace(/\s/g, '') === name.toLowerCase().replace(/\s/g, ''));
        const idxP = getIdx('PlantCodes');
        const idxCC = getIdx('CustomerCode');
        const idxCN = getIdx('CustomerName');
        const idxCT = getIdx('CustomerType');
        const idxA = getIdx('Address');
        const idxCi = getIdx('City');
        const idxPC = getIdx('PostalCode');
        const idxM = getIdx('Mobile');
        const idxG = getIdx('GSTIN');

        if (idxP === -1 || idxCC === -1 || idxCN === -1 || idxCi === -1) {
          setStatusMsg({ text: 'Error: Mandatory headers (PlantCodes, CustomerCode, CustomerName, City) missing', type: 'error' });
          return;
        }

        let savedCount = 0;
        let rejectedCount = 0;

        dataRows.forEach(row => {
          const cols = parseCsvRow(row);
          const pCode = cols[idxP];
          const cCode = cols[idxCC];
          const cName = cols[idxCN];
          const city = cols[idxCi];

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
            postalCode: idxPC !== -1 ? cols[idxPC] : '',
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
        if (exists) { setStatusMsg({ text: `Duplicate entry not allowed for Plant Code: ${localData.plantCode}`, type: 'error' }); return; }
      }
      if (activeScreen.startsWith('FM')) {
        const exists = rawCompanies?.some((c: any) => c.id !== localData.id && c.companyCode?.toString().toUpperCase() === localData.companyCode?.toString().toUpperCase());
        if (exists) { setStatusMsg({ text: `Duplicate entry not allowed for Company Code: ${localData.companyCode}`, type: 'error' }); return; }
      }
      if (activeScreen.startsWith('XK')) {
        if (!(localData.plantCodes?.length && localData.mobile?.trim() && localData.address?.trim() && localData.route?.trim() && (localData.vendorName?.trim() || localData.vendorFirmName?.trim()))) {
          setStatusMsg({ text: 'Error: Plant, Mobile, Address, Route & Name are mandatory', type: 'error' }); return;
        }
        const exists = rawVendors?.some((v: any) => v.id !== localData.id && v.vendorCode?.toString().toUpperCase() === localData.vendorCode?.toString().toUpperCase());
        if (exists && localData.vendorCode) { setStatusMsg({ text: `Duplicate entry not allowed for Vendor Code: ${localData.vendorCode}`, type: 'error' }); return; }
        if (!localData.vendorCode) localData.vendorCode = `V${Math.floor(10000 + Math.random() * 90000)}`;
      }
      if (activeScreen.startsWith('XD')) {
        if (!(localData.plantCodes?.length && localData.customerCode && localData.customerName && localData.city)) {
          setStatusMsg({ text: 'Error: Plant, Customer Code, Name & City are mandatory', type: 'error' });
          return;
        }
        const duplicateInPlant = rawCustomers?.some((c: any) => {
          if (c.id === localData.id) return false;
          if (c.customerCode?.toString().toUpperCase() !== localData.customerCode?.toString().toUpperCase()) return false;
          return localData.plantCodes?.some((p: string) => c.plantCodes?.includes(p));
        });

        if (duplicateInPlant) {
          setStatusMsg({ text: `Duplicate entry not allowed for Customer Code ${localData.customerCode} in selected Plants`, type: 'error' });
          return;
        }
      }
      if (activeScreen.startsWith('VA') && activeScreen !== 'VA04') {
        if (!(localData.plantCode && localData.saleOrder && localData.consignor && localData.from && localData.consignee && localData.shipToParty && localData.destination && localData.weight && localData.weightUom)) {
          setStatusMsg({ text: 'Error: Mandatory fields (Plant, SO No, Consignor, From, Consignee, Ship to Party, Destination, Weight, UOM) required', type: 'error' }); return;
        }
        const exists = rawOrders?.some((o: any) => o.id !== localData.id && o.saleOrder?.toString().toUpperCase() === localData.saleOrder?.toString().toUpperCase());
        if (exists) { setStatusMsg({ text: `Duplicate entry not allowed for Sale Order No: ${localData.saleOrder}`, type: 'error' }); return; }
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
  }, [user, activeScreen, formData, allOrders, rawPlants, allUsers, db, isBootstrapAdmin, rawCustomers, rawCompanies, rawVendors, rawOrders]);

  const executeTCode = React.useCallback((code: string) => {
    const input = code.toUpperCase().trim();
    if (!input) return;
    
    let clean = input;
    let isNewSession = false;

    if (input.startsWith('/N')) {
      clean = input.substring(2).trim();
    } else if (input.startsWith('/O')) {
      clean = input.substring(2).trim();
      isNewSession = true;
    }

    if (clean !== 'HOME' && clean !== '' && !isAuthorized(clean)) {
      setStatusMsg({ text: `You are not authorized to run T-code ${clean}`, type: 'error' });
      setTCode('');
      return;
    }

    setHistory(p => [input, ...p.filter(h => h !== input)].slice(0, 7));
    setShowHistory(false); setHistoryIndex(-1);

    if (isNewSession) {
      const baseUrl = window.location.origin + window.location.pathname;
      window.open(clean ? `${baseUrl}?tcode=${clean}` : baseUrl, '_blank'); setTCode(''); return;
    }

    if (clean === 'HOME' || clean === '') { 
      setScreenStack(prev => [...prev, 'HOME']);
      setActiveScreen('HOME'); 
      setTCode(''); setFormData({}); setSearchId(''); return; 
    }

    if (MASTER_TCODES.some(t => t.code === clean)) {
      setScreenStack(prev => [...prev, clean as Screen]);
      setActiveScreen(clean as Screen); setFormData({}); setSearchId(''); setXdSearch({ plant: '', type: '', name: '', customerId: '', postalCode: '' });
      setStatusMsg({ text: `Transaction ${clean} executed`, type: 'info' });
    } else { setStatusMsg({ text: `T-Code ${clean} not found`, type: 'error' }); }
    setTCode('');
  }, [isAuthorized]);

  const handleBack = React.useCallback(() => {
    if (screenStack.length <= 1) {
      setActiveScreen('HOME');
      setFormData({});
      return;
    }
    const newStack = [...screenStack];
    newStack.pop(); 
    const prevScreen = newStack[newStack.length - 1];
    setScreenStack(newStack);
    setActiveScreen(prevScreen);
    setFormData({});
    setSearchId('');
    setStatusMsg({ text: `Navigated to ${prevScreen}`, type: 'info' });
  }, [screenStack]);

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
      if (e.key === 'F3') { if (e.shiftKey) router.push('/'); else handleBack(); }
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
  }, [activeScreen, handleSave, handleCancel, executeTCode, handleBack, showHistory, historyIndex, history, router, tCode]);

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

  return (
    <div className="flex flex-col h-screen w-full bg-[#f0f3f9] text-[#333] font-mono overflow-hidden">
      <div className="flex items-center bg-[#c5e0b4] border-b border-slate-400 px-3 h-8 text-[11px] font-semibold z-50 print:hidden">
        <div className="flex items-center gap-6">{['Menu', 'Edit', 'Favorites', 'Extras', 'System', 'Help'].map(i => <button key={i} className="hover:text-blue-800 transition-colors uppercase">{i}</button>)}</div>
        <div className="flex-1" /><div className="flex items-center h-full">
          <button className="h-full px-2 hover:bg-white/30"><PlusSquare className="h-3.5 w-3.5 opacity-30" /></button>
          <button className="h-full px-2 hover:bg-white/30"><Grid2X2 className="h-3 w-3 opacity-30" /></button>
          <button onClick={() => router.push('/')} className="h-full px-3 hover:bg-[#e81123] hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="flex flex-col bg-[#f0f0f0] border-b border-slate-300 shadow-sm z-40 print:hidden">
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
             <button onClick={handleSave} disabled={activeScreen === 'HOME' || isReadOnly} className={cn("p-1 rounded", (activeScreen === 'HOME' || isReadOnly) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")} title="Save (F8)"><Save className="h-4 w-4 text-slate-600" /></button>
             <button onClick={handleBack} className="p-1 hover:bg-slate-200 rounded" title="Back Step-by-Step (F3)"><Undo2 className="h-4 w-4 text-slate-600" /></button>
             <button onClick={handleCancel} disabled={activeScreen === 'HOME' || isReadOnly} className={cn("p-1 rounded", (activeScreen === 'HOME' || isReadOnly) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")} title="Cancel (F12)"><XCircle className="h-4 w-4 text-slate-600" /></button>
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
          <div className="w-72 bg-white border-r border-slate-300 hidden lg:flex flex-col overflow-hidden print:hidden">
            <div className="p-4 border-b border-slate-200 bg-[#dae4f1]/50"><h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1e3a8a] flex items-center gap-2"><Grid2X2 className="h-3.5 w-3.5" /> Favorites</h2></div>
            <div className="flex-1 overflow-y-auto green-scrollbar">
              {MASTER_TCODES.filter(t => t.code.endsWith('01') || t.code === 'TR21' || t.code === 'VA04' || t.code === 'ZCODE' || t.code === 'WGPS24').map((item) => (
                <div key={item.code} onClick={() => executeTCode(item.code)} className={cn("flex items-center gap-4 px-5 py-3 hover:bg-blue-50 cursor-pointer group border-b border-slate-100 transition-all", activeScreen === item.code ? "bg-[#0056d2] text-white" : "text-[#1e3a8a]")}>
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", activeScreen === item.code ? "bg-white" : "bg-slate-300 group-hover:bg-blue-600")} />
                  <span className={cn("text-[10px] font-black uppercase tracking-tight", activeScreen === item.code ? "text-white" : "text-[#1e3a8a]")}>{item.code} - {item.description}</span>
                  <div className="flex-1" /><item.icon className={cn("h-3.5 w-3.5", activeScreen === item.code ? "text-white" : "text-slate-400")} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f3f9]">
          <div className="flex-1 overflow-y-auto p-2 md:p-4 relative print:p-0 print:overflow-visible">
            {activeScreen === 'HOME' ? (
              <div className="w-full h-full flex flex-col p-2 md:p-4 space-y-8 animate-fade-in">
                <h1 className="text-2xl md:text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter">Sikka Logistics Management Control</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 md:p-6 border border-slate-300 shadow-sm">
                  <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black uppercase text-slate-400">Authorized Plant Hub</label>
                    <select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold outline-none" value={homePlantFilter} onChange={(e) => setHomePlantFilter(e.target.value)}>
                      <option value="ALL">ALL AUTHORIZED PLANTS</option>
                      {accessiblePlants.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}
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
              <div className={cn("bg-white shadow-xl rounded-sm border border-slate-300 overflow-hidden animate-slide-up min-h-[600px] p-4 md:p-6 mx-auto print:p-0 print:border-none print:shadow-none", hideSidebar ? "w-full" : "w-full max-w-[1400px]")}>
                 {showForm && <div className="space-y-6">
                   {activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                   {activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}
                   {activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}
                   {activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}
                   {activeScreen.startsWith('VA') && activeScreen !== 'VA04' && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} allCustomers={accessibleCustomers} />}
                   {activeScreen === 'VA04' && <CancelOrderForm data={formData} onChange={setFormData} allOrders={allOrders} onPost={handleSave} onCancel={() => setFormData({})} />}
                   {activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}
                 </div>}
                 {showList && <div className="space-y-6">
                   <div className="bg-[#dae4f1]/30 p-4 md:p-6 border border-slate-300 space-y-4 flex flex-col md:flex-row items-center gap-6">
                     <div className="flex flex-col gap-2 flex-1 w-full"><label className="text-[11px] font-black uppercase text-slate-500 block">Search</label>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                           {activeScreen.startsWith('XD') ? <>
                               <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Customer ID</label><input className="h-10 border border-slate-400 px-3 text-xs font-black outline-none bg-white" value={xdSearch.customerId} onChange={(e) => setXdSearch({...xdSearch, customerId: e.target.value})} onKeyDown={handleSearchIdEnter} /></div>
                               <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Select Plant</label><select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold" value={xdSearch.plant} onChange={(e) => setXdSearch({...xdSearch, plant: e.target.value})}><option value="">ALL PLANTS</option>{accessiblePlants.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}</select></div>
                               <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Select Type</label><select className="h-10 border border-slate-400 bg-white px-3 text-xs font-bold" value={xdSearch.type} onChange={(e) => setXdSearch({...xdSearch, type: e.target.value})}><option value="">ALL TYPES</option><option value="Consignor">Consignor</option><option value="Consignee - Ship to Party">Consignee - Ship to Party</option></select></div>
                               <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Enter Name</label><input className="h-10 border border-slate-400 px-4 text-xs font-black outline-none" value={xdSearch.name} onChange={(e) => setXdSearch({...xdSearch, name: e.target.value})} /></div>
                             </> : <div className="col-span-1 md:col-span-4 flex items-center gap-4"><input className="h-11 w-full border border-slate-400 px-4 text-xs font-black outline-none bg-white" value={searchId} onChange={(e) => setSearchId(e.target.value)} onKeyDown={handleSearchIdEnter} /></div>}
                        </div>
                     </div>
                     <div className="flex flex-col gap-1 border-l border-slate-300 pl-6 shrink-0 h-16 justify-center">
                        <label className="text-[8px] font-black uppercase text-slate-400">Plant</label>
                        <div className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">Authorized Hub</div>
                     </div>
                   </div>
                   <RegistryList onSelectItem={setFormData} listData={getRegistryList()} activeScreen={activeScreen} />
                 </div>}
                 {activeScreen === 'TR21' && <DripBoard orders={allOrders} trips={allTrips} vendors={accessibleVendors} plants={accessiblePlants} companies={accessibleCompanies} customers={accessibleCustomers} onStatusUpdate={setStatusMsg} />}
                 {activeScreen === 'WGPS24' && <GpsTrackingHub trips={allTrips} onStatusUpdate={setStatusMsg} db={db} />}
                 {activeScreen === 'ZCODE' && <ZCodeRegistry tcodes={MASTER_TCODES} onExecute={executeTCode} />}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-7 bg-[#0f172a] flex items-center px-4 text-[9px] font-black text-white/90 uppercase tracking-[0.15em] print:hidden">
        <div className="flex items-center gap-4 md:gap-8 overflow-hidden flex-1"><span className="flex items-center gap-2.5 shrink-0"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />SYNC: ACTIVE</span><span className="shrink-0">{activeScreen}</span><span className="truncate">USER: {isBootstrapAdmin ? 'SUPER ADMIN' : (userProfile?.fullName || 'Authenticating...')}</span>{statusMsg.text !== 'Ready' && <span className={cn("truncate", statusMsg.type === 'error' ? "text-red-400" : "text-blue-400")}>EVENT: {statusMsg.text}</span>}</div>
        {greeting && <div className="shrink-0 ml-4 hidden sm:block text-blue-400">{greeting}</div>}
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

function VendorForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { 
    if (disabled) return; 
    const curr = data.plantCodes || []; 
    onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); 
  };
  
  return <div className="space-y-4">
    <SectionGrouping title="IDENTIFICATION">
      <div className="col-span-1 md:col-span-2 space-y-2 mb-4">
        <label className="text-[10px] font-bold text-slate-500">Plant Assignment (Multiple) *</label>
        <div className="flex flex-wrap gap-2">
          {pList.map((p: string) => (
            <button 
              key={p} 
              onClick={() => handleToggle(p)} 
              disabled={disabled} 
              className={cn("px-3 py-1.5 text-[10px] font-black border uppercase", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border-slate-300")}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <FormInput label="VENDOR CODE" value={data.vendorCode} disabled={true} placeholder="AUTO-GENERATED" />
      <FormInput label="VENDOR NAME" value={data.vendorName} onChange={(v: string) => onChange({...data, vendorName: v})} disabled={disabled} />
      <FormInput label="VENDOR FIRM NAME" value={data.vendorFirmName} onChange={(v: string) => onChange({...data, vendorFirmName: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="DETAILS">
      <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
      <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
      <FormInput label="SPECIAL ROUTE" value={data.route} onChange={(v: string) => onChange({...data, route: v})} disabled={disabled} />
    </SectionGrouping>
  </div>;
}

function CustomerForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  return <div className="space-y-4"><SectionGrouping title="IDENTIFICATION"><div className="col-span-1 md:col-span-2 space-y-2 mb-4"><label className="text-[10px] font-bold text-slate-500">Plant Assignment (Multiple) *</label>
    <div className="flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-3 py-1.5 text-[10px] font-black border uppercase", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border-slate-300")}>{p}</button>)}</div></div>
    <FormInput label="CUSTOMER CODE *" value={data.customerCode} onChange={(v: string) => onChange({...data, customerCode: v})} disabled={disabled} /><FormInput label="CUSTOMER NAME *" value={data.customerName} onChange={(v: string) => onChange({...data, customerName: v})} disabled={disabled} />
    <FormSelect label="CUSTOMER TYPE" value={data.customerType} options={["Consignor", "Consignee - Ship to Party"]} onChange={(v: string) => onChange({...data, customerType: v})} disabled={disabled} /></SectionGrouping>
    <SectionGrouping title="LOCATION"><FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} /><FormInput label="CITY *" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
    <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
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
    <div className="flex justify-end gap-4"><Button onClick={onCancel} variant="ghost">Exit</Button><Button onClick={handleSave} className="bg-red-600 text-white font-black uppercase text-[10px] px-6 md:px-10 h-11">Execute Cancellation</Button></div></div>;
}

function RegistryList({ onSelectItem, listData, activeScreen }: any) {
  const isUserRegistry = activeScreen?.startsWith('SU');
  const isVendorRegistry = activeScreen?.startsWith('XK');
  
  const headers = isUserRegistry 
    ? ['Name', 'Username', 'Password', 'Authorized Plant']
    : isVendorRegistry
    ? ['Vendor Code', 'Vendor Name', 'Vendor Firm Name', 'Mobile', 'Special Route']
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
      ) : isVendorRegistry ? (
        <>
          <td className="p-3 font-black text-[#0056d2]">{item.vendorCode}</td>
          <td className="p-3 uppercase">{item.vendorName}</td>
          <td className="p-3 uppercase">{item.vendorFirmName}</td>
          <td className="p-3">{item.mobile}</td>
          <td className="p-3 italic text-slate-500">{item.route}</td>
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

function DripBoard({ orders, trips, vendors, plants, companies, customers, onStatusUpdate }: any) {
  const { user } = useUser(); const db = useFirestore(); 
  const [activeTab, setActiveTab] = React.useState('Open Orders'); 
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null); 
  const [isPopupOpen, setIsPopupOpen] = React.useState(false); 
  const [assignData, setAssignData] = React.useState<any>({ fleetType: 'Own Vehicle', isFixedRate: false, rate: 0, freightAmount: 0 }); 
  const [vendorSearch, setVendorSearch] = React.useState(''); 
  const [showVS, setShowVS] = React.useState(false);
  
  // Enhancement States
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 15;

  // Date Range Filter States
  const [fromDate, setFromDate] = React.useState(format(subDays(new Date(), 4), 'yyyy-MM-dd'));
  const [toDate, setToDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));

  // Out Vehicle Logic
  const [isOutPopupOpen, setIsOutPopupOpen] = React.useState(false);
  const [outData, setOutData] = React.useState<any>({ tripId: '', vehicleNumber: '', route: '', date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  
  // Assignment Logic (Edit/Unassign)
  const [isAssignmentPopupOpen, setIsAssignmentPopupOpen] = React.useState(false);
  const [assignmentMode, setAssignmentMode] = React.useState<'edit' | 'unassign' | null>(null);
  const [selectedTripForAssignment, setSelectedTripForAssignment] = React.useState<any>(null);

  // Arrived Logic
  const [isArrivedPopupOpen, setIsArrivedPopupOpen] = React.useState(false);
  const [arrivedData, setArrivedData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });

  // Reject Logic
  const [isRejectPopupOpen, setIsRejectPopupOpen] = React.useState(false);
  const [rejectData, setRejectData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), remark: '' });

  // Unload Logic
  const [isUnloadPopupOpen, setIsUnloadPopupOpen] = React.useState(false);
  const [unloadData, setUnloadData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });

  // POD Upload Logic
  const [isPodPopupOpen, setIsPodPopupOpen] = React.useState(false);
  const [selectedTripForPod, setSelectedTripForPod] = React.useState<any>(null);
  const [podFile, setPodFile] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Closed View Logic
  const [isClosedViewPopupOpen, setIsClosedViewPopupOpen] = React.useState(false);
  const [selectedTripForClosed, setSelectedTripForClosed] = React.useState<any>(null);
  const [closedViewMode, setClosedViewMode] = React.useState<'view' | 'upload'>('view');

  // CN Number Logic
  const [isCnPopupOpen, setIsCnPopupOpen] = React.useState(false);
  const [selectedTripForCn, setSelectedTripForCn] = React.useState<any>(null);
  const [cnFormData, setCnFormData] = React.useState<any>({
    cnNo: '',
    cnDate: format(new Date(), 'yyyy-MM-dd'),
    paymentTerms: 'PAID',
    items: [{ invoiceNo: '', ewaybillNo: '', product: '', unit: '', uom: 'BAG' }]
  });

  // CN Preview Logic
  const [isCnPreviewOpen, setIsCnPreviewOpen] = React.useState(false);
  const [selectedTripForPreview, setSelectedTripForPreview] = React.useState<any>(null);
  const [cnPreviewStatus, setCnPreviewStatus] = React.useState<'idle' | 'generated'>('idle');

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];
  
  const getStats = (o: any) => { 
    const tot = parseFloat(o.weight) || 0; 
    const ass = trips?.filter((t: any) => t.saleOrderId === o.id).reduce((a: number, t: any) => a + (t.assignWeight || 0), 0) || 0; 
    return { tot, ass, bal: tot - ass, uom: o.weightUom || 'MT' }; 
  };
  
  const fOrders = React.useMemo(() => (orders || []).filter(o => o.status !== 'CANCELLED').map(o => {
    const stats = getStats(o);
    const route = (o.from && o.destination) ? `${o.from} → ${o.destination}` : (o.route || '');
    return { ...o, ...stats, route };
  }).filter(o => {
    const bal = o.bal > 0;
    const itemDate = new Date(o.createdAt);
    const matchesDate = isWithinInterval(itemDate, { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) });
    return bal && matchesDate;
  }), [orders, trips, fromDate, toDate]);

  const fTrips = React.useMemo(() => { 
    if (!trips) return []; 
    const map: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' }; 
    return trips.filter(t => t.status === map[activeTab]).map(t => {
       const route = (t.from && t.destination && !t.route?.includes('→')) ? `${t.from} → ${t.destination}` : t.route;
       return { ...t, route };
    }).filter(t => {
       const itemDate = new Date(t.createdAt);
       return isWithinInterval(itemDate, { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) });
    }); 
  }, [trips, activeTab, fromDate, toDate]);

  const tabCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    counts['Open Orders'] = fOrders.length;
    ['Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'].forEach(t => {
       const map: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' };
       counts[t] = (trips || []).filter(tr => tr.status === map[t] && isWithinInterval(new Date(tr.createdAt), { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) })).length;
    });
    return counts;
  }, [fOrders, trips, fromDate, toDate]);

  const filteredData = React.useMemo(() => {
    const rawData = activeTab === 'Open Orders' ? fOrders : fTrips;
    if (!searchQuery) return rawData;
    const lowerQuery = searchQuery.toLowerCase();
    return rawData.filter((item: any) => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(lowerQuery)
      )
    );
  }, [activeTab, fOrders, fTrips, searchQuery]);

  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const tripVendors = React.useMemo(() => {
    const pCode = selectedTripForAssignment?.plantCode || selectedOrder?.plantCode;
    if (!pCode || !vendors) return [];
    return vendors.filter((v: any) => v.plantCodes?.includes(pCode));
  }, [selectedTripForAssignment, selectedOrder, vendors]);

  React.useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
  }, [activeTab]);
  
  const handleAssign = (o: any) => { 
    setSelectedOrder(o); 
    setAssignData({ 
      plantCode: o.plantCode, 
      consignee: o.consignee, 
      shipToParty: o.shipToParty, 
      route: o.route || '', 
      orderQty: `${o.bal} ${o.uom}`, 
      fleetType: 'Own Vehicle', 
      assignWeight: o.bal,
      isFixedRate: false,
      rate: 0,
      freightAmount: 0
    }); 
    setIsPopupOpen(true); 
  };

  const handleAssignmentClick = (t: any) => {
    setSelectedTripForAssignment(t);
    setAssignmentMode(null);
    setAssignData({
      vehicleNumber: t.vehicleNumber,
      driverMobile: t.driverMobile,
      assignWeight: t.assignWeight,
      fleetType: t.fleetType,
      vendorName: t.vendorName,
      vendorMobile: t.vendorMobile,
      employee: t.employee,
      rate: t.rate,
      freightAmount: t.freightAmount,
      isFixedRate: t.isFixedRate,
      plantCode: t.plantCode,
      consignee: t.consignee,
      shipToParty: t.shipToParty,
      route: t.route
    });
    setVendorSearch(t.vendorName || '');
    setIsAssignmentPopupOpen(true);
  };

  const handleAssignmentPost = () => {
    if (!assignmentMode) {
      onStatusUpdate({ text: 'Please select an option (Edit/Unassign)', type: 'error' });
      return;
    }

    if (assignmentMode === 'unassign') {
      deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForAssignment.id));
      onStatusUpdate({ text: `Trip ${selectedTripForAssignment.tripId} unassigned. Order returned to Open Orders.`, type: 'success' });
    } else {
      setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForAssignment.id), {
        vehicleNumber: assignData.vehicleNumber,
        driverMobile: assignData.driverMobile,
        assignWeight: parseFloat(assignData.assignWeight || 0),
        fleetType: assignData.fleetType,
        vendorName: assignData.vendorName || '',
        vendorMobile: assignData.vendorMobile || '',
        employee: assignData.employee || '',
        rate: parseFloat(assignData.rate || 0),
        freightAmount: parseFloat(assignData.freightAmount || 0),
        isFixedRate: !!assignData.isFixedRate,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      onStatusUpdate({ text: `Trip ${selectedTripForAssignment.tripId} updated successfully.`, type: 'success' });
    }
    setIsAssignmentPopupOpen(false);
  };

  const handleOutVehicle = (t: any) => {
    if (['Own Vehicle', 'Contract Vehicle', 'Market Vehicle'].includes(t.fleetType) && !t.cnNo) {
      onStatusUpdate({ text: 'Add CN Number before Out Vehicle', type: 'error' });
      return;
    }

    setOutData({ 
      tripId: t.tripId, 
      id: t.id, 
      vehicleNumber: t.vehicleNumber, 
      route: t.route, 
      date: format(new Date(), 'yyyy-MM-dd'), 
      time: format(new Date(), 'HH:mm') 
    });
    setIsOutPopupOpen(true);
  };

  const handleConfirmOut = () => {
    if (!outData.id) return;
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', outData.id), { 
      status: 'IN-TRANSIT', 
      outDate: outData.date, 
      outTime: outData.time, 
      updatedAt: new Date().toISOString() 
    }, { merge: true });
    setIsOutPopupOpen(false);
    onStatusUpdate({ text: `Vehicle ${outData.vehicleNumber} is now IN-TRANSIT`, type: 'success' });
  };

  const validateDateTime = (dateStr: string, timeStr: string) => {
    const input = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
    return !isAfter(input, new Date());
  };

  const handleArrivedAction = (t: any) => {
    setArrivedData({ ...arrivedData, trip: t });
    setIsArrivedPopupOpen(true);
  };

  const handleArrivedPost = () => {
    const { date, time, trip } = arrivedData;
    if (!validateDateTime(date, time)) {
      onStatusUpdate({ text: 'Error: Future date/time not allowed', type: 'error' });
      return;
    }
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', trip.id), {
      status: 'ARRIVED',
      arrivedDate: date,
      arrivedTime: time,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setIsArrivedPopupOpen(false);
    onStatusUpdate({ text: `Trip ${trip.tripId} status updated to ARRIVED`, type: 'success' });
  };

  const handleRejectAction = (t: any) => {
    setRejectData({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), remark: '', trip: t });
    setIsRejectPopupOpen(true);
  };

  const handleRejectPost = () => {
    const { date, time, remark, trip } = rejectData;
    if (!remark.trim()) {
      onStatusUpdate({ text: 'Error: Remark is mandatory for rejection', type: 'error' });
      return;
    }
    if (!validateDateTime(date, time)) {
      onStatusUpdate({ text: 'Error: Future date/time not allowed', type: 'error' });
      return;
    }
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', trip.id), {
      status: 'REJECTION',
      rejectionDate: date,
      rejectionTime: time,
      rejectionRemark: remark,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setIsRejectPopupOpen(false);
    onStatusUpdate({ text: `Trip ${trip.tripId} status updated to REJECT`, type: 'success' });
  };

  const handleUnloadAction = (t: any) => {
    setUnloadData({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), trip: t });
    setIsUnloadPopupOpen(true);
  };

  const handleUnloadPost = () => {
    const { date, time, trip } = unloadData;
    if (!validateDateTime(date, time)) {
      onStatusUpdate({ text: 'Error: Future date/time not allowed', type: 'error' });
      return;
    }
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', trip.id), {
      status: 'POD',
      unloadDate: date,
      unloadTime: time,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setIsUnloadPopupOpen(false);
    onStatusUpdate({ text: `Trip ${trip.tripId} moved to POD VERIFY`, type: 'success' });
  };

  const handlePodUploadAction = (t: any) => {
    setSelectedTripForPod(t);
    setPodFile(null);
    setIsPodPopupOpen(true);
  };

  const compressFile = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (file.type.includes('image')) {
          const img = new globalThis.Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max = 1200;
            if (width > max || height > max) {
              if (width > height) { height *= max / width; width = max; }
              else { width *= max / height; height = max; }
            }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.src = dataUrl;
        } else {
          resolve(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePodFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onStatusUpdate({ text: 'Error: File exceeds 2MB limit', type: 'error' });
      return;
    }
    const compressed = await compressFile(file);
    setPodFile(compressed);
  };

  const handlePodPost = () => {
    if (!podFile) {
      onStatusUpdate({ text: 'Error: No POD file selected', type: 'error' });
      return;
    }
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForPod.id), {
      status: 'CLOSED',
      podFile: podFile,
      podUploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setIsPodPopupOpen(false);
    onStatusUpdate({ text: `POD uploaded for Trip ${selectedTripForPod.tripId}. Node CLOSED.`, type: 'success' });
  };

  const handleViewAction = (t: any) => {
    setSelectedTripForClosed(t);
    setClosedViewMode('view');
    setPodFile(t.podFile || null);
    setIsClosedViewPopupOpen(true);
  };

  const handleClosedUpdatePost = () => {
    if (closedViewMode === 'upload' && podFile) {
      setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForClosed.id), {
        podFile: podFile,
        podUploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      onStatusUpdate({ text: `POD document replaced for Trip ${selectedTripForClosed.id}`, type: 'success' });
    }
    setIsClosedViewPopupOpen(false);
  };

  const recentCns = React.useMemo(() => {
    if (!trips) return [];
    const list = trips.filter((t: any) => t.cnNo).map((t: any) => t.cnNo);
    return Array.from(new Set(list)).reverse().slice(0, 3);
  }, [trips]);

  const handleAddCn = (t: any) => {
    setSelectedTripForCn(t);
    const company = (companies || []).find((c: any) => c.plantCodes?.includes(t.plantCode));
    setCnFormData({
      cnNo: t.cnNo || '',
      cnDate: t.cnDate || format(new Date(), 'yyyy-MM-dd'),
      paymentTerms: t.paymentTerms || 'PAID',
      carrierName: company?.companyName || 'AUTO-ASSIGN PENDING',
      items: t.cnItems || [{ invoiceNo: '', ewaybillNo: '', product: '', unit: '', uom: 'BAG' }]
    });
    setIsCnPopupOpen(true);
  };

  const handleCnPost = () => {
    if (!cnFormData.cnNo || !cnFormData.cnDate || !cnFormData.items[0]?.invoiceNo || !cnFormData.items[0]?.product) {
      onStatusUpdate({ text: 'Fill mandatory fields: CN No, Date, Invoice No, Product', type: 'error' });
      return;
    }
    
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForCn.id), {
      cnNo: cnFormData.cnNo,
      cnDate: cnFormData.cnDate,
      paymentTerms: cnFormData.paymentTerms,
      carrierName: cnFormData.carrierName,
      cnItems: cnFormData.items,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    setIsCnPopupOpen(false);
    onStatusUpdate({ text: `CN ${cnFormData.cnNo} synchronized successfully`, type: 'success' });
  };

  const handleCnPreviewClick = (t: any) => {
    const order = (orders || []).find((o: any) => o.id === t.saleOrderId);
    setSelectedTripForPreview({ ...t, order });
    setCnPreviewStatus('idle');
    setIsCnPreviewOpen(true);
  };

  const handleDownloadPdf = () => {
    if (!selectedTripForPreview?.cnNo) return;
    const originalTitle = document.title;
    document.title = selectedTripForPreview.cnNo;
    window.print();
    document.title = originalTitle;
  };

  React.useEffect(() => {
    if (assignData.fleetType === 'Market Vehicle' && !assignData.isFixedRate) {
      const weight = parseFloat(assignData.assignWeight || 0);
      const rate = parseFloat(assignData.rate || 0);
      setAssignData(prev => ({ ...prev, freightAmount: isNaN(weight * rate) ? 0 : weight * rate }));
    }
  }, [assignData.assignWeight, assignData.rate, assignData.fleetType, assignData.isFixedRate]);

  const handlePost = () => { 
    if (!user || !selectedOrder) return; 
    const tId = `T${Math.floor(100000000 + Math.random() * 900000000)}`; 
    const newId = crypto.randomUUID(); 
    
    const p = { 
      id: newId, 
      tripId: tId, 
      saleOrderId: selectedOrder.id, 
      saleOrderNumber: selectedOrder.saleOrder, 
      plantCode: assignData.plantCode, 
      shipToParty: assignData.shipToParty, 
      consignee: selectedOrder.consignee,
      route: assignData.route, 
      consignor: selectedOrder.consignor, 
      from: selectedOrder.from || '',
      destination: selectedOrder.destination || '',
      deliveryAddress: selectedOrder.deliveryAddress || '',
      vehicleNumber: assignData.vehicleNumber, 
      driverMobile: assignData.driverMobile, 
      fleetType: assignData.fleetType, 
      vendorName: assignData.vendorName || '', 
      vendorMobile: assignData.vendorMobile || '',
      employee: assignData.employee || '',
      rate: parseFloat(assignData.rate || 0) || 0,
      freightAmount: parseFloat(assignData.freightAmount || 0) || 0,
      isFixedRate: !!assignData.isFixedRate,
      assignWeight: parseFloat(assignData.assignWeight || 0) || 0, 
      status: 'LOADING', 
      createdAt: new Date().toISOString() 
    }; 
    
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', newId), p, { merge: true }); 
    setIsPopupOpen(false); 
    setSelectedOrder(null); 
    onStatusUpdate({ text: `Trip ${tId} posted to Loading`, type: 'success' }); 
  };

  const mVendors = (vendors || []).filter((v: any) => v.vendorName?.toUpperCase().includes(vendorSearch.toUpperCase()));

  return <div className="flex flex-col h-full space-y-4">
    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-white border border-slate-300 p-3 rounded-sm shadow-sm print:hidden">
      <div className="flex items-center gap-4 flex-1">
        <label className="text-[10px] font-black uppercase text-slate-400 whitespace-nowrap pl-2">Search</label>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input 
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="h-9 w-full border border-slate-300 pl-9 pr-4 text-[10px] font-black outline-none focus:bg-yellow-50 focus:border-blue-400 uppercase tracking-wider"
          />
        </div>
        <div className="flex flex-col gap-1 border-l border-slate-200 pl-4 min-w-[120px]">
          <label className="text-[8px] font-black uppercase text-slate-400">Plant</label>
          <div className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">Authorized Hub</div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
        <div className="flex flex-col gap-1">
          <label className="text-[8px] font-black uppercase text-slate-400">From Date</label>
          <input type="date" value={fromDate} onChange={e => {
             if (e.target.value > toDate) return;
             setFromDate(e.target.value);
             setCurrentPage(1);
          }} className="h-8 border border-slate-300 px-2 text-[10px] font-black outline-none focus:bg-yellow-50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[8px] font-black uppercase text-slate-400">To Date</label>
          <input type="date" value={toDate} onChange={e => {
             if (e.target.value < fromDate) return;
             setToDate(e.target.value);
             setCurrentPage(1);
          }} className="h-8 border border-slate-300 px-2 text-[10px] font-black outline-none focus:bg-yellow-50" />
        </div>
      </div>
    </div>

    <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 overflow-x-auto no-scrollbar print:hidden">
      {TABS.map(t => (
        <button key={t} onClick={() => setActiveTab(t)} className={cn("px-4 md:px-6 py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2", activeTab === t ? "bg-white border-x border-t border-slate-300 text-[#0056d2] shadow-sm -mb-px" : "text-slate-500 hover:text-slate-700")}>
          {t} <span className="opacity-50 text-[8px]">({tabCounts[t] || 0})</span>
        </button>
      ))}
    </div>
    
    <div className="flex-1 flex flex-col overflow-hidden bg-white border border-slate-300 print:border-none">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left min-w-[1000px]">
          <thead>
            <tr className="bg-[#f8fafc] text-[9px] font-black uppercase sticky top-0 border-b border-slate-300 z-10 print:hidden">
              {activeTab === 'Open Orders' ? 
                ['Plant', 'Sale Order', 'Consignor', 'Consignee', 'Ship to Party', 'Route', 'Order Qty', 'Assign Qty', 'Balance Qty', 'Action'].map(h => <th key={h} className="p-3 border-r border-slate-200">{h}</th>) : 
                ['Plant', 'Trip ID', 'Consignee', 'Ship to Party', 'Route', 'Vehicle No', 'Assign Qty', 'CN Number', 'Action'].map(h => <th key={h} className="p-3 border-r border-slate-200">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr className="print:hidden">
                <td colSpan={ activeTab === 'Open Orders' ? 10 : 9 } className="p-20 text-center">
                  <div className="flex flex-col items-center gap-3 opacity-20">
                    <Search className="h-10 w-10" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">No Synchronized Nodes Found</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((item: any) => {
                if (activeTab === 'Open Orders') {
                  const o = item;
                  return (
                    <tr key={o.id} className="border-b border-slate-100 hover:bg-[#e8f0fe] transition-colors text-[11px] font-bold group print:hidden">
                      <td className="p-3">{o.plantCode}</td>
                      <td className="p-3 space-y-0.5">
                        <div className="text-[#0056d2] font-black">{o.saleOrder}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{o.createdAt ? format(new Date(o.createdAt), 'dd/MM/yyyy HH:mm') : ''}</div>
                      </td>
                      <td className="p-3 uppercase">{o.consignor}</td>
                      <td className="p-3 uppercase">{o.consignee}</td>
                      <td className="p-3 uppercase">{o.shipToParty}</td>
                      <td className="p-3 uppercase">{o.route}</td>
                      <td className="p-3 font-black">{o.tot} {o.uom}</td>
                      <td className="p-3 text-emerald-600">{o.ass} {o.uom}</td>
                      <td className="p-3 text-red-600 font-black">{o.bal} {o.uom}</td>
                      <td className="p-3"><Button onClick={() => handleAssign(o)} size="sm" className="bg-[#0056d2] text-white font-black text-[9px] h-7 px-3 uppercase tracking-tighter">Assign</Button></td>
                    </tr>
                  );
                } else {
                  const t = item;
                  const isArrangeByParty = t.fleetType === 'Arrange by Party';
                  return (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-[#e8f0fe] transition-colors text-[11px] font-bold group print:hidden">
                      <td className="p-3">{t.plantCode}</td>
                      <td className="p-3 space-y-0.5">
                        <div className="text-[#0056d2] font-black">{t.tripId}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{format(new Date(t.createdAt), 'dd/MM/yyyy HH:mm')}</div>
                      </td>
                      <td className="p-3 uppercase">{t.consignee}</td>
                      <td className="p-3 uppercase">{t.shipToParty}</td>
                      <td className="p-3 uppercase">{t.route}</td>
                      <td className="p-3 space-y-0.5">
                        <div className="uppercase">{t.vehicleNumber}</div>
                        <div className="text-[9px] text-slate-400 font-bold">{t.driverMobile || 'NO MOBILE'}</div>
                      </td>
                      <td className="p-3 text-emerald-600 font-black">{t.assignWeight} MT</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {t.cnNo ? (
                            <button 
                              onClick={() => handleCnPreviewClick(t)} 
                              className="font-black text-[#0056d2] hover:underline uppercase decoration-2"
                            >
                              {t.cnNo}
                            </button>
                          ) : ""}
                          <button 
                            onClick={() => handleAddCn(t)}
                            disabled={isArrangeByParty || activeTab !== 'Loading'}
                            className={cn(
                              "p-1 rounded bg-slate-50 border border-slate-200 transition-all",
                              (isArrangeByParty || activeTab !== 'Loading') ? "opacity-30 cursor-not-allowed" : "text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                            )}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {activeTab === 'Loading' && (
                            <>
                              <Button onClick={() => handleOutVehicle(t)} size="sm" className="text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white font-black h-7 px-3 uppercase tracking-tighter">Out Vehicle</Button>
                              <Button 
                                onClick={() => handleAssignmentClick(t)} 
                                size="sm" 
                                className="text-[9px] bg-yellow-400 hover:bg-yellow-500 text-black font-black h-7 px-3 uppercase tracking-tighter"
                              >
                                Assignment
                              </Button>
                            </>
                          )}
                          {activeTab === 'In-Transit' && (
                            <Button onClick={() => handleArrivedAction(t)} size="sm" className="text-[9px] bg-[#0056d2] text-white font-black h-7 px-3 uppercase tracking-tighter">Arrived</Button>
                          )}
                          {activeTab === 'Arrived' && (
                            <>
                              <Button onClick={() => handleUnloadAction(t)} size="sm" className="text-[9px] bg-emerald-600 text-white font-black h-7 px-3 uppercase tracking-tighter">Unload</Button>
                              <Button onClick={() => handleRejectAction(t)} size="sm" className="text-[9px] bg-red-600 text-white font-black h-7 px-3 uppercase tracking-tighter">Reject</Button>
                            </>
                          )}
                          {activeTab === 'POD Verify' && (
                            <Button onClick={() => handlePodUploadAction(t)} size="sm" className="text-[9px] bg-[#0056d2] text-white font-black h-7 px-3 uppercase tracking-tighter">Upload POD</Button>
                          )}
                          {activeTab === 'Closed' && (
                            <Button onClick={() => handleViewAction(t)} size="sm" className="text-[9px] bg-[#0056d2] text-white font-black h-7 px-3 uppercase tracking-tighter">View</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-[#f8fafc] border-t border-slate-300 flex items-center justify-between z-10 shadow-[0_-2px_5px_rgba(0,0,0,0.02)] print:hidden">
        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
          <span>SHOWING {paginatedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} — {Math.min(currentPage * itemsPerPage, filteredData.length)} OF {filteredData.length}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="h-8 px-4 text-[9px] font-black uppercase tracking-widest border-slate-300 hover:bg-white hover:text-blue-700 hover:border-blue-300 transition-all"
          >
            <ChevronLeft className="h-4 w-4 mr-1.5" /> Previous Page
          </Button>
          
          <div className="h-8 px-5 flex items-center text-[10px] font-black text-[#1e3a8a] bg-blue-50/50 rounded-sm border border-blue-100 uppercase tracking-widest min-w-[120px] justify-center">
            PAGE {currentPage} / {totalPages || 1}
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(p => p + 1)}
            className="h-8 px-4 text-[9px] font-black uppercase tracking-widest border-slate-300 hover:bg-white hover:text-blue-700 hover:border-blue-300 transition-all"
          >
            Next Page <ChevronRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>

    {/* Arrived Popup */}
    <Dialog open={isArrivedPopupOpen} onOpenChange={setIsArrivedPopupOpen}>
      <DialogContent className="max-w-md bg-[#f0f3f9] p-0 overflow-hidden rounded-xl border border-slate-300 shadow-2xl">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <MapPin className="h-4 w-4" /> Vehicle Arrival Hub
          </DialogTitle>
          <DialogDescription className="sr-only">Confirm vehicle arrival at destination.</DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-6">
          <div className="bg-white p-4 border border-slate-200 rounded-sm space-y-2 opacity-80">
            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Party</span><span className="text-[10px] font-black uppercase">{arrivedData.trip?.shipToParty}</span></div>
            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Route</span><span className="text-[10px] font-black uppercase">{arrivedData.trip?.route}</span></div>
            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Vehicle</span><span className="text-[10px] font-black uppercase">{arrivedData.trip?.vehicleNumber}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Arrived Date *</label><input type="date" value={arrivedData.date} onChange={e => setArrivedData({...arrivedData, date: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" /></div>
            <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Arrived Time *</label><input type="time" value={arrivedData.time} onChange={e => setArrivedData({...arrivedData, time: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => setIsArrivedPopupOpen(false)} variant="outline" className="h-10 px-6 border-slate-300 hover:bg-[#e81123] hover:text-white text-[10px] font-black uppercase">Cancel</Button>
            <Button onClick={handleArrivedPost} className="h-10 px-8 bg-[#0056d2] hover:bg-blue-900 text-white text-[10px] font-black uppercase shadow-md">Post</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Reject Popup */}
    <Dialog open={isRejectPopupOpen} onOpenChange={setIsRejectPopupOpen}>
      <DialogContent className="max-w-md bg-[#f0f3f9] p-0 overflow-hidden rounded-xl border border-slate-300 shadow-2xl">
        <DialogHeader className="bg-[#e81123] px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <XCircle className="h-4 w-4" /> Reject Consignment
          </DialogTitle>
          <DialogDescription className="sr-only">Confirm rejection of vehicle or shipment.</DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-6">
          <div className="bg-white p-4 border border-slate-200 rounded-sm space-y-2 opacity-80">
            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Party</span><span className="text-[10px] font-black uppercase">{rejectData.trip?.shipToParty}</span></div>
            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Vehicle</span><span className="text-[10px] font-black uppercase">{rejectData.trip?.vehicleNumber}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Date *</label><input type="date" value={rejectData.date} onChange={e => setRejectData({...rejectData, date: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black" /></div>
            <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Time *</label><input type="time" value={rejectData.time} onChange={e => setRejectData({...rejectData, time: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black" /></div>
          </div>
          <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Remark *</label><textarea value={rejectData.remark} onChange={e => setRejectData({...rejectData, remark: e.target.value})} className="h-20 border border-slate-400 px-3 py-2 text-xs font-black focus:bg-yellow-50 resize-none" placeholder="REASON FOR REJECTION..." /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => setIsRejectPopupOpen(false)} variant="outline" className="h-10 px-6 border-slate-300 text-[10px] font-black uppercase">Cancel</Button>
            <Button onClick={handleRejectPost} className="h-10 px-8 bg-[#0056d2] text-white text-[10px] font-black uppercase shadow-md">Post</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Unload Popup */}
    <Dialog open={isUnloadPopupOpen} onOpenChange={setIsUnloadPopupOpen}>
      <DialogContent className="max-w-md bg-[#f0f3f9] p-0 overflow-hidden rounded-xl border border-slate-300 shadow-2xl">
        <DialogHeader className="bg-emerald-600 px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <Package className="h-4 w-4" /> Unload Confirmation
          </DialogTitle>
          <DialogDescription className="sr-only">Confirm vehicle unloading at party location.</DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-6">
          <div className="bg-white p-4 border border-slate-200 rounded-sm space-y-2 opacity-80">
            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Ship to Party</span><span className="text-[10px] font-black uppercase">{unloadData.trip?.shipToParty}</span></div>
            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Vehicle</span><span className="text-[10px] font-black uppercase">{unloadData.trip?.vehicleNumber}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Unload Date *</label><input type="date" value={unloadData.date} onChange={e => setUnloadData({...unloadData, date: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" /></div>
            <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-500 uppercase">Unload Time *</label><input type="time" value={unloadData.time} onChange={e => setUnloadData({...unloadData, time: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => setIsUnloadPopupOpen(false)} variant="outline" className="h-10 px-6 border-slate-300 text-[10px] font-black uppercase">Cancel</Button>
            <Button onClick={handleUnloadPost} className="h-10 px-8 bg-[#0056d2] text-white text-[10px] font-black uppercase shadow-md">Post</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* POD Upload Popup */}
    <Dialog open={isPodPopupOpen} onOpenChange={setIsPodPopupOpen}>
      <DialogContent className="max-w-md bg-[#f0f3f9] p-0 overflow-hidden rounded-xl border border-slate-300 shadow-2xl">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <UploadCloud className="h-4 w-4" /> Upload POD Document
          </DialogTitle>
          <DialogDescription className="sr-only">Upload POD image or PDF for verification.</DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-6">
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-center">
            <input type="file" accept="image/*,.pdf" ref={fileInputRef} onChange={handlePodFileChange} className="hidden" />
            {podFile ? (
              <div className="w-full space-y-4">
                <div className="relative aspect-video bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                  {podFile.startsWith('data:application/pdf') ? (
                    <FileText className="h-12 w-12 text-blue-900" />
                  ) : (
                    <Image src={podFile} alt="POD" fill className="object-contain" unoptimized />
                  )}
                  <button onClick={() => setPodFile(null)} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-lg"><X className="h-4 w-4" /></button>
                </div>
                <p className="text-[10px] font-black text-emerald-600 uppercase">POD Sync: Ready to Post (&le; 200KB)</p>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer group flex flex-col items-center gap-2">
                <div className="h-14 w-14 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors"><UploadCloud className="h-7 w-7 text-[#1e3a8a]" /></div>
                <div><p className="text-[11px] font-black uppercase text-slate-700">Select POD Document</p><p className="text-[9px] font-bold text-slate-400 uppercase">Image or PDF (Max 2MB)</p></div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => setIsPodPopupOpen(false)} variant="outline" className="h-10 px-6 border-slate-300 text-[10px] font-black uppercase">Cancel</Button>
            <Button onClick={handlePodPost} disabled={!podFile} className="h-10 px-8 bg-[#0056d2] text-white text-[10px] font-black uppercase shadow-md disabled:opacity-50">Post & Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Closed View Popup */}
    <Dialog open={isClosedViewPopupOpen} onOpenChange={setIsClosedViewPopupOpen}>
      <DialogContent className="max-w-2xl bg-[#f0f3f9] p-0 overflow-hidden rounded-xl border border-slate-300 shadow-2xl">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <CheckCircleIcon className="h-4 w-4" /> Node Registry: CLOSED
          </DialogTitle>
          <DialogDescription className="sr-only">View or update POD documents for a closed trip.</DialogDescription>
        </DialogHeader>
        <div className="p-4 md:p-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 border border-slate-200 rounded-sm shadow-inner opacity-80">
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">CN No</span><span className="text-[10px] font-black">{selectedTripForClosed?.cnNo || 'N/A'}</span></div>
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Party</span><span className="text-[10px] font-black truncate">{selectedTripForClosed?.shipToParty}</span></div>
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Route</span><span className="text-[10px] font-black truncate">{selectedTripForClosed?.route}</span></div>
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Vehicle No</span><span className="text-[10px] font-black">{selectedTripForClosed?.vehicleNumber}</span></div>
          </div>
          <div className="bg-white p-4 border border-slate-200 shadow-sm relative">
            <div className="absolute -top-3 left-4 bg-white px-2 text-[8px] font-black text-slate-400 uppercase border border-slate-100">Selection Type *</div>
            <RadioGroup value={closedViewMode} onValueChange={(v: any) => setClosedViewMode(v)} className="flex gap-8">
              <div className="flex items-center space-x-2"><RadioGroupItem value="view" id="cv-view" /><Label htmlFor="cv-view" className="text-xs font-black uppercase text-[#1e3a8a]">View POD</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="upload" id="cv-upload" /><Label htmlFor="cv-upload" className="text-xs font-black uppercase text-[#1e3a8a]">Upload New</Label></div>
            </RadioGroup>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center min-h-[300px]">
            {closedViewMode === 'view' ? (
              podFile ? (
                podFile.startsWith('data:application/pdf') ? (
                  <div className="flex flex-col items-center gap-4">
                    <FileText className="h-16 w-16 text-blue-900" />
                    <a href={podFile} download={`POD_${selectedTripForClosed?.tripId}.pdf`} className="text-blue-600 underline font-black text-[10px] uppercase">Download PDF POD</a>
                  </div>
                ) : (
                  <div className="relative w-full aspect-video"><Image src={podFile} alt="POD" fill className="object-contain" unoptimized /></div>
                )
              ) : <p className="text-[10px] font-black text-slate-300 uppercase">No Document Synchronized</p>
            ) : (
              <div className="w-full flex flex-col items-center gap-4">
                <input type="file" ref={fileInputRef} onChange={handlePodFileChange} className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-14 w-full max-w-sm border-2 border-dashed flex flex-col gap-1 border-slate-300 hover:bg-blue-50">
                  <UploadCloud className="h-6 w-6 text-[#1e3a8a]" />
                  <span className="text-[10px] font-black uppercase">Replace POD File</span>
                </Button>
                {podFile && closedViewMode === 'upload' && <p className="text-[10px] font-black text-emerald-600 uppercase italic">New Registry Loaded: Ready to Post</p>}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setIsClosedViewPopupOpen(false)} variant="outline" className="h-10 px-6 border-slate-300 text-[10px] font-black uppercase">Cancel</Button>
            {closedViewMode === 'upload' && <Button onClick={handleClosedUpdatePost} disabled={!podFile} className="h-10 px-8 bg-[#0056d2] text-white text-[10px] font-black uppercase shadow-md">Post Update</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Assignment Popup (Edit/Unassign) */}
    <Dialog open={isAssignmentPopupOpen} onOpenChange={setIsAssignmentPopupOpen}>
      <DialogContent className="max-w-[90vw] md:max-w-4xl bg-[#f0f3f9] p-0 overflow-hidden rounded-xl border border-slate-300 shadow-2xl">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <Truck className="h-4 w-4" /> Assignment Management
          </DialogTitle>
          <DialogDescription className="sr-only">Edit or unassign the current vehicle assignment.</DialogDescription>
        </DialogHeader>
        
        <div className="p-4 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto green-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 border border-slate-200 rounded-sm shadow-inner opacity-80">
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Ship to Party</span><span className="text-[10px] font-black truncate">{selectedTripForAssignment?.shipToParty}</span></div>
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Route</span><span className="text-[10px] font-black truncate">{selectedTripForAssignment?.route}</span></div>
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Vehicle No</span><span className="text-[10px] font-black">{selectedTripForAssignment?.vehicleNumber}</span></div>
          </div>

          <div className="bg-white p-6 border border-slate-200 shadow-sm relative">
            <div className="absolute -top-3 left-4 bg-white px-2 text-[8px] font-black text-slate-400 uppercase border border-slate-100">Selection Type *</div>
            <RadioGroup 
              value={assignmentMode || ""} 
              onValueChange={(v: any) => setAssignmentMode(v)}
              className="flex gap-8"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="edit" id="mode-edit" className="border-[#1e3a8a] text-[#1e3a8a]" />
                <Label htmlFor="mode-edit" className="text-xs font-black uppercase text-[#1e3a8a] cursor-pointer">Edit Assignment</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unassign" id="mode-unassign" className="border-red-600 text-red-600" />
                <Label htmlFor="mode-unassign" className="text-xs font-black uppercase text-red-600 cursor-pointer">Unassign Vehicle</Label>
              </div>
            </RadioGroup>
          </div>

          {assignmentMode === 'edit' && (
            <div className="animate-fade-in space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Vehicle Number *</label>
                  <input value={assignData.vehicleNumber || ''} onChange={e => setAssignData({...assignData, vehicleNumber: e.target.value.toUpperCase()})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Driver Mobile *</label>
                  <input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Assign Qty *</label>
                  <input type="number" value={assignData.assignWeight || ''} disabled className="h-10 border border-slate-200 bg-slate-50 px-3 text-xs font-black opacity-70 cursor-not-allowed" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Fleet Type *</label>
                  <select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value, vendorName: '', vendorMobile: '', employee: '', rate: 0, freightAmount: 0})} className="h-10 border border-slate-400 px-3 text-xs font-black">
                    <option value="Own Vehicle">Own Vehicle</option>
                    <option value="Contract Vehicle">Contract Vehicle</option>
                    <option value="Market Vehicle">Market Vehicle</option>
                    <option value="Arrange by Party">Arrange by Party</option>
                  </select>
                </div>
              </div>

              {assignData.fleetType === 'Market Vehicle' && (
                <div className="bg-white p-6 border border-blue-200 shadow-md relative">
                  <div className="absolute -top-3 left-4 bg-white px-2 text-[8px] font-black text-blue-600 uppercase border border-blue-100">Market Coordination</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Vendor Name *</label>
                      <select 
                        value={assignData.vendorName || ''} 
                        onChange={e => {
                          const v = tripVendors.find((vend: any) => vend.vendorName === e.target.value);
                          setAssignData({...assignData, vendorName: e.target.value, vendorMobile: v?.mobile || ''});
                        }}
                        className="h-10 w-full border border-slate-400 px-3 text-xs font-black bg-white focus:bg-yellow-50 outline-none"
                      >
                        <option value="">Select Vendor...</option>
                        {tripVendors.map((v: any) => (
                          <option key={v.id} value={v.vendorName}>{v.vendorName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Employee *</label>
                      <input value={assignData.employee || ''} onChange={e => setAssignData({...assignData, employee: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Rate</label>
                        <div className="flex items-center gap-2">
                          <Checkbox id="assign-fix-rate" checked={assignData.isFixedRate} onCheckedChange={(c) => setAssignData({...assignData, isFixedRate: !!c})} />
                          <label htmlFor="assign-fix-rate" className="text-[9px] font-black text-blue-600 cursor-pointer">Fix Rate</label>
                        </div>
                      </div>
                      <input type="number" value={assignData.rate || ''} disabled={assignData.isFixedRate} onChange={e => setAssignData({...assignData, rate: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Freight Amount</label>
                      <input 
                        type="number" 
                        value={assignData.freightAmount || ''} 
                        onChange={e => { if (assignData.isFixedRate) setAssignData({...assignData, freightAmount: e.target.value}); }}
                        disabled={!assignData.isFixedRate}
                        className={cn("h-10 border px-3 text-xs font-black outline-none", !assignData.isFixedRate ? "bg-blue-50/30 border-blue-100 text-blue-800" : "border-slate-400 focus:bg-yellow-50")} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button onClick={() => setIsAssignmentPopupOpen(false)} variant="outline" className="h-11 px-8 border-slate-300 hover:bg-[#e81123] hover:text-white text-[10px] font-black uppercase tracking-widest">Cancel</Button>
            <Button onClick={handleAssignmentPost} className="h-11 px-12 bg-[#0056d2] hover:bg-blue-900 text-white text-[10px] font-black uppercase tracking-widest shadow-lg">Post</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Add CN Popup */}
    <Dialog open={isCnPopupOpen} onOpenChange={setIsCnPopupOpen}>
      <DialogContent className="max-w-[90vw] md:max-w-4xl bg-[#f0f3f9] p-0 overflow-hidden rounded-xl border border-slate-300 shadow-2xl">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <FileCheck className="h-4 w-4" /> Add CN Details
          </DialogTitle>
          <DialogDescription className="sr-only">Add consignment note and document details for the trip.</DialogDescription>
        </DialogHeader>
        
        <div className="p-4 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto green-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 border border-slate-200 rounded-sm shadow-inner opacity-80">
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Ship to Party</span><span className="text-[10px] font-black truncate">{selectedTripForCn?.shipToParty}</span></div>
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Route</span><span className="text-[10px] font-black truncate">{selectedTripForCn?.route}</span></div>
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Vehicle No</span><span className="text-[10px] font-black">{selectedTripForCn?.vehicleNumber}</span></div>
            <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Weight</span><span className="text-[10px] font-black">{selectedTripForCn?.assignWeight} MT</span></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-white p-6 border border-slate-200 shadow-sm relative">
            <div className="absolute -top-3 left-4 bg-white px-2 text-[8px] font-black text-slate-400 uppercase border border-slate-100">CN HEADER</div>
            
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 uppercase">CN Number *</label>
                <div className="flex gap-1">
                  {recentCns.map(cn => (
                    <span key={cn} onClick={() => setCnFormData({...cnFormData, cnNo: cn})} className="text-[8px] font-black bg-yellow-200 text-yellow-900 px-1 cursor-pointer hover:bg-yellow-300">
                      {cn}
                    </span>
                  ))}
                </div>
              </div>
              <input value={cnFormData.cnNo} onChange={e => setCnFormData({...cnFormData, cnNo: e.target.value.toUpperCase()})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" placeholder="ENTER CN NO..." />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">CN Date *</label>
              <input type="date" value={cnFormData.cnDate} onChange={e => setCnFormData({...cnFormData, cnDate: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Payment Terms</label>
              <select value={cnFormData.paymentTerms} onChange={e => setCnFormData({...cnFormData, paymentTerms: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black">
                <option value="PAID">PAID</option>
                <option value="TO PAY">TO PAY</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Carrier Name</label>
              <input value={cnFormData.carrierName} disabled className="h-10 border border-slate-200 bg-slate-50 px-3 text-xs font-black opacity-70" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Document Details</span>
              <Button onClick={() => setCnFormData({...cnFormData, items: [...cnFormData.items, { invoiceNo: '', ewaybillNo: '', product: '', unit: '', uom: 'BAG' }]})} size="sm" variant="outline" className="h-6 px-2 text-[8px] font-black border-blue-200 text-blue-700">
                <Plus className="h-3 w-3 mr-1" /> Add Row
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[8px] font-black uppercase text-slate-400">
                    <th className="p-3 border-r">Invoice No *</th>
                    <th className="p-3 border-r">E-waybill No</th>
                    <th className="p-3 border-r">Product Description *</th>
                    <th className="p-3 border-r w-24">Unit</th>
                    <th className="p-3 border-r w-32">Unit UOM</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {cnFormData.items.map((item: any, idx: number) => (
                    <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="p-2"><input value={item.invoiceNo} onChange={e => {
                        const newItems = [...cnFormData.items];
                        newItems[idx].invoiceNo = e.target.value.toUpperCase();
                        setCnFormData({...cnFormData, items: newItems});
                      }} className="w-full h-8 border border-slate-300 px-2 text-[10px] font-bold outline-none focus:border-blue-400" /></td>
                      <td className="p-2"><input value={item.ewaybillNo} onChange={e => {
                        const newItems = [...cnFormData.items];
                        newItems[idx].ewaybillNo = e.target.value.toUpperCase();
                        setCnFormData({...cnFormData, items: newItems});
                      }} className="w-full h-8 border border-slate-300 px-2 text-[10px] font-bold outline-none focus:border-blue-400" /></td>
                      <td className="p-2"><input value={item.product} onChange={e => {
                        const newItems = [...cnFormData.items];
                        newItems[idx].product = e.target.value.toUpperCase();
                        setCnFormData({...cnFormData, items: newItems});
                      }} className="w-full h-8 border border-slate-300 px-2 text-[10px] font-bold outline-none focus:border-blue-400" /></td>
                      <td className="p-2"><input type="number" value={item.unit} onChange={e => {
                        const newItems = [...cnFormData.items];
                        newItems[idx].unit = e.target.value;
                        setCnFormData({...cnFormData, items: newItems});
                      }} className="w-full h-8 border border-slate-300 px-2 text-[10px] font-bold outline-none focus:border-blue-400" /></td>
                      <td className="p-2">
                        <select value={item.uom} onChange={e => {
                          const newItems = [...cnFormData.items];
                          newItems[idx].uom = e.target.value;
                          setCnFormData({...cnFormData, items: newItems});
                        }} className="w-full h-8 border border-slate-300 px-1 text-[10px] font-bold outline-none">
                          <option value="BAG">BAG</option>
                          <option value="BOX">BOX</option>
                          <option value="DRUM">DRUM</option>
                          <option value="CAN">CAN</option>
                          <option value="Pices">Pices</option>
                          <option value="Others">Others</option>
                        </select>
                      </td>
                      <td className="p-2">
                        {cnFormData.items.length > 1 && (
                          <button onClick={() => {
                            const newItems = cnFormData.items.filter((_:any, i:number) => i !== idx);
                            setCnFormData({...cnFormData, items: newItems});
                          }} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button onClick={() => setIsCnPopupOpen(false)} variant="outline" className="h-11 px-8 border-slate-300 hover:bg-[#e81123] hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">Cancel</Button>
            <Button onClick={handleCnPost} className="h-11 px-12 bg-[#0056d2] hover:bg-blue-900 text-white text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Post</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Out Vehicle Popup */}
    <Dialog open={isOutPopupOpen} onOpenChange={setIsOutPopupOpen}>
      <DialogContent className="max-md bg-[#f0f3f9] p-0 overflow-hidden rounded-xl border border-slate-300 shadow-2xl">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <Truck className="h-4 w-4" /> Out Vehicle Registry
          </DialogTitle>
          <DialogDescription className="sr-only">Confirm vehicle departure time and date.</DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-6">
          <div className="bg-white p-4 border border-slate-200 rounded-sm space-y-2">
            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Vehicle</span><span className="text-xs font-black uppercase">{outData.vehicleNumber}</span></div>
            <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Route</span><span className="text-[10px] font-bold text-blue-800 uppercase">{outData.route}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Out Date</label>
              <input type="date" value={outData.date} onChange={e => setOutData({...outData, date: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Out Time</label>
              <input type="time" value={outData.time} onChange={e => setOutData({...outData, time: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => setIsOutPopupOpen(false)} variant="outline" className="h-10 px-6 border-slate-300 hover:bg-[#e81123] hover:text-white text-[10px] font-black uppercase">Cancel</Button>
            <Button onClick={handleConfirmOut} className="h-10 px-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase">Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Assign Vehicle Popup */}
    <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
      <DialogContent className="max-w-[90vw] md:max-w-4xl bg-[#f0f3f9] p-0 overflow-hidden rounded-xl border border-slate-300 shadow-2xl">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <Truck className="h-4 w-4" /> TR24 - Assign Vehicle Hub
            {assignData.route && <span className="ml-4 pl-4 border-l border-white/20 text-blue-300 tracking-normal font-bold lowercase first-letter:uppercase">{assignData.route}</span>}
          </DialogTitle>
          <DialogDescription className="sr-only">Assign vehicle and details for the selected sales order.</DialogDescription>
        </DialogHeader>
        
        <div className="p-4 md:p-8 space-y-8 max-h-[80vh] overflow-y-auto green-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 bg-white p-6 border border-slate-200 shadow-sm relative">
            <div className="absolute -top-3 left-4 bg-white px-2 text-[8px] font-black text-slate-400 uppercase border border-slate-100">Primary Node</div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Vehicle Number *</label>
              <input value={assignData.vehicleNumber || ''} onChange={e => setAssignData({...assignData, vehicleNumber: e.target.value.toUpperCase()})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Driver Mobile *</label>
              <input value={assignData.driverMobile || ''} onChange={e => setAssignData({...assignData, driverMobile: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Assign Qty *</label>
              <input type="number" value={assignData.assignWeight || ''} onChange={e => setAssignData({...assignData, assignWeight: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Fleet Type *</label>
              <select value={assignData.fleetType} onChange={e => setAssignData({...assignData, fleetType: e.target.value, vendorName: '', vendorMobile: '', employee: '', rate: 0, freightAmount: 0})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50">
                <option value="Own Vehicle">Own Vehicle</option>
                <option value="Contract Vehicle">Contract Vehicle</option>
                <option value="Market Vehicle">Market Vehicle</option>
                <option value="Arrange by Party">Arrange by Party</option>
              </select>
            </div>
          </div>

          {assignData.fleetType === 'Market Vehicle' && (
            <div className="bg-white p-6 border border-blue-200 shadow-md animate-fade-in relative">
              <div className="absolute -top-3 left-4 bg-white px-2 text-[8px] font-black text-blue-600 uppercase border border-blue-100">Market Coordination</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Vendor Name *</label>
                  <div className="relative">
                    <input 
                      value={vendorSearch} 
                      onChange={e => { setVendorSearch(e.target.value); setShowVS(true); }} 
                      onFocus={() => setShowVS(true)}
                      className="h-10 w-full border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" 
                    />
                    {showVS && mVendors.length > 0 && (
                      <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-xl z-50 max-h-[150px] overflow-y-auto">
                        {mVendors.map((v:any) => (
                          <div key={v.id} onClick={() => { 
                            setVendorSearch(v.vendorName); 
                            setAssignData({...assignData, vendorName: v.vendorName, vendorMobile: v.mobile}); 
                            setShowVS(false); 
                          }} className="px-4 py-2.5 text-[11px] font-bold hover:bg-[#e8f0fe] hover:text-[#0056d2] cursor-pointer border-b border-slate-50 last:border-0">
                            {v.vendorName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Mobile (Auto)</label>
                  <input value={assignData.vendorMobile || ''} disabled className="h-10 border border-slate-200 bg-slate-50 px-3 text-xs font-black opacity-70" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Employee *</label>
                  <input value={assignData.employee || ''} onChange={e => setAssignData({...assignData, employee: e.target.value})} className="h-10 border border-slate-400 px-3 text-xs font-black focus:bg-yellow-50" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Rate</label>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="fix-rate" 
                        checked={assignData.isFixedRate} 
                        onCheckedChange={(checked) => setAssignData({...assignData, isFixedRate: checked === true})} 
                      />
                      <label htmlFor="fix-rate" className="text-[9px] font-black text-blue-600 uppercase cursor-pointer">Fix Rate</label>
                    </div>
                  </div>
                  <input 
                    type="number" 
                    value={assignData.rate || ''} 
                    disabled={assignData.isFixedRate}
                    onChange={e => setAssignData({...assignData, rate: e.target.value})} 
                    className={cn("h-10 border px-3 text-xs font-black", assignData.isFixedRate ? "bg-slate-50 border-slate-200 opacity-50" : "border-slate-400 focus:bg-yellow-50")} 
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Freight Amount</label>
                  <input 
                    type="number" 
                    value={assignData.freightAmount || ''} 
                    onChange={e => { if (assignData.isFixedRate) setAssignData({...assignData, freightAmount: e.target.value}); }}
                    disabled={!assignData.isFixedRate}
                    className={cn("h-10 border px-3 text-xs font-black", !assignData.isFixedRate ? "bg-blue-50/30 border-blue-100 text-blue-800" : "border-slate-400 focus:bg-yellow-50")} 
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button onClick={() => setIsPopupOpen(false)} variant="outline" className="h-11 px-8 border-slate-300 hover:bg-[#e81123] hover:text-white hover:border-[#e81123] text-[10px] font-black uppercase tracking-widest transition-all">Cancel</Button>
            <Button onClick={handlePost} className="h-11 px-10 bg-[#0056d2] hover:bg-blue-900 text-white text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Post to Loading</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* CN Preview Popup */}
    <Dialog open={isCnPreviewOpen} onOpenChange={setIsCnPreviewOpen}>
      <DialogContent className="max-w-[1000px] w-[95vw] max-h-[95vh] overflow-y-auto bg-white p-0 rounded-none border-none">
        <DialogHeader className="bg-[#1e3a8a] text-white p-4 sticky top-0 z-[110] flex flex-row items-center justify-between space-y-0 print:hidden shadow-lg">
          <DialogTitle className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <FileText className="h-4 w-4" /> CN PREVIEW - {selectedTripForPreview?.cnNo}
          </DialogTitle>
          <DialogDescription className="sr-only">Professional A4 preview of the Consignment Note with Three-Copy system.</DialogDescription>
          <div className="flex items-center gap-4">
            {cnPreviewStatus === 'generated' ? (
              <Button onClick={handleDownloadPdf} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase h-9 px-6 rounded-none shadow-md">
                <Download className="h-3.5 w-3.5 mr-2" /> Download
              </Button>
            ) : (
              <Button onClick={() => setCnPreviewStatus('generated')} className="bg-white hover:bg-slate-100 text-[#1e3a8a] font-black text-[10px] uppercase h-9 px-6 rounded-none shadow-md">
                <Printer className="h-3.5 w-3.5 mr-2" /> Generate PDF
              </Button>
            )}
            <button onClick={() => setIsCnPreviewOpen(false)} className="text-white/70 hover:text-white transition-colors ml-2"><X className="h-5 w-5" /></button>
          </div>
        </DialogHeader>
        
        <div className="p-4 md:p-12 bg-slate-200 min-h-screen flex flex-col items-center gap-8 print:bg-white print:p-0">
          <div className="bg-white shadow-2xl w-full max-w-[210mm] print:shadow-none print:w-full print:max-w-none">
             <div id="printable-area" className="p-0 m-0">
               {selectedTripForPreview && (
                 <CnPrintLayout 
                   trip={selectedTripForPreview} 
                   company={(companies || []).find((c: any) => c.plantCodes?.includes(selectedTripForPreview.plantCode))}
                   consignor={(customers || []).find((c: any) => c.customerName?.toUpperCase() === selectedTripForPreview.consignor?.toUpperCase())}
                   consignee={(customers || []).find((c: any) => c.customerName?.toUpperCase() === selectedTripForPreview.consignee?.toUpperCase())}
                   shipTo={(customers || []).find((c: any) => c.customerName?.toUpperCase() === selectedTripForPreview.shipToParty?.toUpperCase())}
                 />
               )}
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

function GpsTrackingHub({ trips, onStatusUpdate, db }: any) {
  const [activeTab, setActiveTab] = React.useState('Tracking MAP');
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [map, setMap] = React.useState<any>(null);
  const [markers, setMarkers] = React.useState<any[]>([]);
  
  const settingsRef = useMemoFirebase(() => doc(db, 'users', SHARED_HUB_ID, 'settings', 'gps_config'), [db]);
  const { data: settings } = useDoc(settingsRef);

  React.useEffect(() => {
    if (activeTab === 'Tracking MAP') {
       const scriptId = 'google-maps-script';
       if (!document.getElementById(scriptId)) {
         const script = document.createElement('script');
         script.id = scriptId;
         script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU&libraries=places`;
         script.async = true;
         script.defer = true;
         document.head.appendChild(script);
       }
    }
  }, [activeTab]);

  const fetchGpsData = async () => {
    try {
      const res = await fetch('https://api.wheelseye.com/currentLoc?accessToken=53afc208-0981-48c7-b134-d85d2f33dc0c');
      if (!res.ok) throw new Error('API Sync Failed');
      const json = await res.json();
      if (json.data) {
        setVehicles(json.data);
      }
    } catch (e) {
      console.error("GPS Fetch Error", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchGpsData();
    const interval = setInterval(fetchGpsData, 30000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!map || !vehicles.length || !window.google) return;

    markers.forEach(m => m.setMap(null));
    const newMarkers: any[] = [];

    vehicles.forEach((v: any) => {
      const pos = { lat: parseFloat(v.lat), lng: parseFloat(v.lng) };
      const isActive = v.speed > 0;
      const iconUrl = isActive ? (settings?.activeIcon || 'https://maps.google.com/mapfiles/ms/icons/green-dot.png') : (settings?.stopIcon || 'https://maps.google.com/mapfiles/ms/icons/red-dot.png');

      const marker = new window.google.maps.Marker({
        position: pos,
        map: map,
        title: v.vehicleNo,
        icon: {
          url: iconUrl,
          scaledSize: new window.google.maps.Size(32, 32)
        }
      });
      newMarkers.push(marker);
    });

    setMarkers(newMarkers);
  }, [map, vehicles, settings]);

  const handleIconUpload = async (e: any, type: 'activeIcon' | 'stopIcon') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setDocumentNonBlocking(settingsRef, { [type]: dataUrl }, { merge: true });
      onStatusUpdate({ text: `${type === 'activeIcon' ? 'Active' : 'Stop'} icon synchronized`, type: 'success' });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 overflow-x-auto no-scrollbar">
        {['Tracking MAP', 'Setting'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap", activeTab === t ? "bg-white border-x border-t border-slate-300 text-[#0056d2] shadow-sm -mb-px" : "text-slate-500 hover:text-slate-700")}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-white border border-slate-300 overflow-hidden flex flex-col md:flex-row">
        {activeTab === 'Tracking MAP' ? (
          <>
            <div className="w-full md:w-80 border-r border-slate-200 flex flex-col h-[300px] md:h-auto">
               <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500">Vehicle Registry</span>
                  <Badge variant="outline" className="text-[8px]">{vehicles.length} Units</Badge>
               </div>
               <div className="flex-1 overflow-y-auto green-scrollbar">
                  {loading ? (
                    <div className="p-10 flex flex-col items-center gap-2">
                       <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                       <span className="text-[8px] font-black uppercase text-slate-400">Loading GPS Nodes...</span>
                    </div>
                  ) : vehicles.map((v: any) => (
                    <div key={v.vehicleNo} onClick={() => map?.panTo({ lat: parseFloat(v.lat), lng: parseFloat(v.lng) })} className="p-3 border-b border-slate-50 hover:bg-blue-50 cursor-pointer transition-colors group">
                       <div className="flex justify-between items-start">
                          <span className="text-[11px] font-black text-[#1e3a8a]">{v.vehicleNo}</span>
                          <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded", v.speed > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                            {v.speed > 0 ? `${v.speed} KM/H` : 'STOPPED'}
                          </span>
                       </div>
                       <p className="text-[9px] text-slate-400 font-bold uppercase truncate mt-1">{v.location || 'SYNCING LOCATION...'}</p>
                    </div>
                  ))}
               </div>
            </div>
            <div className="flex-1 relative bg-slate-100">
               <div id="google-map" ref={(el) => {
                  if (el && !map && window.google) {
                    const newMap = new window.google.maps.Map(el, {
                      center: { lat: 28.6139, lng: 77.2090 },
                      zoom: 5,
                      disableDefaultUI: false
                    });
                    setMap(newMap);
                  }
               }} className="w-full h-full min-h-[400px]" />
            </div>
          </>
        ) : (
          <div className="p-8 space-y-10 max-w-2xl mx-auto w-full">
             <div className="space-y-6">
                <h3 className="text-sm font-black text-[#1e3a8a] uppercase tracking-tighter border-b border-slate-100 pb-2">GPS ICON SYNCHRONIZATION</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-3 p-6 border border-slate-200 bg-white shadow-sm rounded-sm">
                      <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Active Vehicle Icon</label>
                      <div className="flex flex-col items-center gap-4 border-2 border-dashed border-slate-100 p-4">
                         {settings?.activeIcon ? (
                           <div className="relative w-12 h-12 border border-slate-200 p-1">
                              <Image src={settings.activeIcon} alt="Active" fill className="object-contain" unoptimized />
                           </div>
                         ) : <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded"><Truck className="h-6 w-6 text-slate-200" /></div>}
                         <input type="file" accept="image/*" onChange={(e) => handleIconUpload(e, 'activeIcon')} className="hidden" id="up-active-icon" />
                         <Button asChild size="sm" variant="outline" className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-300">
                            <label htmlFor="up-active-icon" className="cursor-pointer">Upload New Node</label>
                         </Button>
                      </div>
                   </div>
                   <div className="space-y-3 p-6 border border-slate-200 bg-white shadow-sm rounded-sm">
                      <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> Stopped Vehicle Icon</label>
                      <div className="flex flex-col items-center gap-4 border-2 border-dashed border-slate-100 p-4">
                         {settings?.stopIcon ? (
                           <div className="relative w-12 h-12 border border-slate-200 p-1">
                              <Image src={settings.stopIcon} alt="Stop" fill className="object-contain" unoptimized />
                           </div>
                         ) : <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded"><Truck className="h-6 w-6 text-slate-200" /></div>}
                         <input type="file" accept="image/*" onChange={(e) => handleIconUpload(e, 'stopIcon')} className="hidden" id="up-stop-icon" />
                         <Button asChild size="sm" variant="outline" className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-300">
                            <label htmlFor="up-stop-icon" className="cursor-pointer">Upload New Node</label>
                         </Button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CnPrintLayout({ trip, company, consignor, consignee, shipTo }: any) {
  const copies = ["CONSIGNEE COPY", "DRIVER COPY", "CONSIGNOR COPY"];
  return (
    <div className="bg-white text-black font-sans">
      {copies.map((label, idx) => (
        <div key={label} className={cn("p-8 md:p-12 min-h-[297mm] flex flex-col border-black", idx < copies.length - 1 && "page-break-after-always border-b-[1px] border-dashed")}>
          {/* Header */}
          <div className="flex justify-between items-start border-b-[2px] border-black pb-6 mb-4">
            <div className="flex items-start gap-6 max-w-[65%]">
              {company?.logo && <img src={company.logo} alt="Logo" className="w-[68px] h-[68px] object-contain shrink-0" />}
              <div className="space-y-1">
                <h1 className="text-[19px] font-black uppercase leading-none tracking-tighter mb-2">{company?.companyName || 'Sikka Industries Hub'}</h1>
                <div className="text-[10px] leading-tight font-bold uppercase whitespace-pre-line text-slate-800">{company?.address}</div>
                <p className="text-[11px] font-black mt-2">GSTIN: {company?.gstin || 'N/A'} | PAN: {company?.pan || 'N/A'}</p>
                <p className="text-[10px] font-bold">Mob: {company?.mobile} | Email: {company?.email}</p>
                {company?.website && <p className="text-[10px] font-bold text-blue-800">{company?.website}</p>}
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <div className="border-2 border-black px-5 py-1.5 font-black text-[12px] uppercase tracking-widest bg-gray-50">{label}</div>
              <div className="space-y-0 text-right mt-4">
                <div className="text-xl font-black tracking-tighter">CN NO: {trip.cnNo}</div>
                <p className="text-sm font-black uppercase text-slate-600">DATE: {trip.cnDate ? format(new Date(trip.cnDate), 'dd-MM-yyyy') : 'N/A'}</p>
              </div>
              <div className="mt-6 text-[11px] font-black space-y-1">
                <p className="uppercase text-slate-500">FROM: <span className="text-black text-sm">{trip.from}</span></p>
                <p className="uppercase text-slate-500">Destination: <span className="text-black text-sm">{trip.destination}</span></p>
              </div>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="mb-6">
            <table className="w-full border-2 border-black text-[11px] border-collapse">
               <thead>
                 <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                   <th className="p-3 border-r-2 border-black text-center">Vehicle Number</th>
                   <th className="p-3 border-r-2 border-black text-center">Driver Mobile</th>
                   <th className="p-3 border-r-2 border-black text-center">Payment Term</th>
                   <th className="p-3 text-center">Trip ID</th>
                 </tr>
               </thead>
               <tbody>
                 <tr className="font-black">
                   <td className="p-3 border-r-2 border-black text-center uppercase text-base">{trip.vehicleNumber}</td>
                   <td className="p-3 border-r-2 border-black text-center text-base">{trip.driverMobile || 'N/A'}</td>
                   <td className="p-3 border-r-2 border-black text-center uppercase">{trip.paymentTerms || 'PAID'}</td>
                   <td className="p-3 text-center">{trip.tripId}</td>
                 </tr>
               </tbody>
            </table>
          </div>

          {/* Party Details */}
          <div className="grid grid-cols-3 border-2 border-black mb-6">
             <div className="p-3 border-r-2 border-black flex flex-col min-h-[140px]">
                <p className="font-black text-[9px] uppercase text-slate-500 border-b border-slate-200 mb-2 pb-1">Consignor</p>
                <p className="font-black text-[12px] uppercase leading-tight mb-2">{consignor?.customerName || trip.consignor}</p>
                <p className="text-[10px] leading-snug font-bold uppercase mb-auto text-slate-700">{consignor?.address || 'ADDRESS PENDING'}</p>
                <div className="mt-4 pt-2 border-t border-slate-100 space-y-0.5">
                  <p className="text-[10px] font-black">MOB: {consignor?.mobile || 'N/A'}</p>
                  <p className="text-[10px] font-black">GST: {consignor?.gstin || 'N/A'}</p>
                </div>
             </div>
             <div className="p-3 border-r-2 border-black flex flex-col min-h-[140px]">
                <p className="font-black text-[9px] uppercase text-slate-500 border-b border-slate-200 mb-2 pb-1">Consignee</p>
                <p className="font-black text-[12px] uppercase leading-tight mb-2">{consignee?.customerName || trip.consignee}</p>
                <p className="text-[10px] leading-snug font-bold uppercase mb-auto text-slate-700">{consignee?.address || 'ADDRESS PENDING'}</p>
                <div className="mt-4 pt-2 border-t border-slate-100 space-y-0.5">
                  <p className="text-[10px] font-black">MOB: {consignee?.mobile || 'N/A'}</p>
                  <p className="text-[10px] font-black">GST: {consignee?.gstin || 'N/A'}</p>
                </div>
             </div>
             <div className="p-3 flex flex-col min-h-[140px]">
                <p className="font-black text-[9px] uppercase text-slate-500 border-b border-slate-200 mb-2 pb-1">Ship to Party</p>
                <p className="font-black text-[12px] uppercase leading-tight mb-2">{shipTo?.customerName || trip.shipToParty}</p>
                <p className="text-[10px] leading-snug font-bold uppercase mb-auto text-slate-700">{shipTo?.address || 'ADDRESS PENDING'}</p>
                <div className="mt-4 pt-2 border-t border-slate-100 space-y-0.5">
                  <p className="text-[10px] font-black">MOB: {shipTo?.mobile || 'N/A'}</p>
                  <p className="text-[10px] font-black">GST: {shipTo?.gstin || 'N/A'}</p>
                </div>
             </div>
          </div>

          {/* Items Table */}
          <div className="flex-1">
            <table className="w-full border-2 border-black text-[11px] border-collapse">
               <thead>
                 <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                   <th className="p-3 border-r-2 border-black text-left w-32">Invoice No</th>
                   <th className="p-3 border-r-2 border-black text-left w-40">E-Waybill No</th>
                   <th className="p-3 border-r-2 border-black text-left">Product Description</th>
                   <th className="p-3 border-r-2 border-black text-center w-28">Unit</th>
                   <th className="p-3 text-right w-32">Weight</th>
                 </tr>
               </thead>
               <tbody>
                 {trip.cnItems?.map((item: any, i: number) => (
                   <tr key={i} className="border-b border-black font-bold align-top">
                     <td className="p-3 border-r-2 border-black uppercase">{item.invoiceNo}</td>
                     <td className="p-3 border-r-2 border-black uppercase text-[10px]">{item.ewaybillNo}</td>
                     <td className="p-3 border-r-2 border-black uppercase italic text-slate-600">{item.product}</td>
                     <td className="p-3 border-r-2 border-black text-center uppercase">{item.unit} {item.uom}</td>
                     <td className="p-3 text-right">{i === 0 ? `${trip.assignWeight} MT` : ''}</td>
                   </tr>
                 ))}
                 <tr className="bg-slate-50 font-black border-t-2 border-black h-12">
                    <td colSpan={3} className="p-3 text-right border-r-2 border-black uppercase tracking-widest text-[9px] text-slate-500">Grand Total</td>
                    <td className="p-3 border-r-2 border-black text-center text-sm uppercase">
                      {trip.cnItems?.reduce((acc: number, curr: any) => acc + (parseFloat(curr.unit) || 0), 0)} Total
                    </td>
                    <td className="p-3 text-right text-sm">{trip.assignWeight} MT</td>
                 </tr>
               </tbody>
            </table>
          </div>

          {/* Authorized Signature Section */}
          <div className="mt-16 flex justify-end">
             <div className="text-center min-w-[200px]">
                <div className="text-[11px] font-black uppercase tracking-widest border-t-2 border-black pt-2">
                  Authorized Signature
                </div>
             </div>
          </div>

          {/* Terms & Conditions */}
          <div className="mt-8 pt-6 border-t border-slate-200">
             <div className="space-y-3">
               <p className="text-[8px] leading-relaxed text-justify uppercase font-bold text-slate-500 tracking-tight">
                 Terms & Conditions: {company?.termsAndConditions?.length ? company.termsAndConditions.join(' | ') : 'Standard Sikka Industries logistics and transportation terms apply. Responsibility ends at unloading node. All disputes subject to local jurisdiction.'}
               </p>
               <p className="text-[10px] font-black italic text-[#1e3a8a] uppercase tracking-tighter text-center mt-4">
                 Note: This Lorry Receipt was generated digitally and is to be considered as original.
               </p>
             </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ZCodeRegistry({ tcodes, onExecute }: { tcodes: any[], onExecute: (code: string) => void }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">{tcodes.map(t => <div key={t.code} onClick={() => onExecute(t.code)} className="bg-white p-4 md:p-6 border hover:border-blue-400 cursor-pointer transition-all relative">
    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200" /><Badge className="mb-4">{t.module}</Badge><h3 className="text-xs font-black text-[#1e3a8a] uppercase">{t.code}</h3><p className="text-[10px] font-bold text-slate-500 uppercase">{t.description}</p></div>)}</div>;
}
