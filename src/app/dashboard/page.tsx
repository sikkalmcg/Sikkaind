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
  Loader2, Radar, Settings, PlayCircle, ShoppingCart, CheckCircle, ArrowLeft, Share
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
import { format, subDays, isWithinInterval, startOfDay, endOfDay, isAfter, parse, addHours } from 'date-fns';
import { cn } from '@/lib/utils';
import placeholderData from '@/app/lib/placeholder-images.json';

type Screen = 'HOME' | 'OX01' | 'OX02' | 'OX03' | 'FM01' | 'FM02' | 'FM03' | 'XK01' | 'XK02' | 'XK03' | 'XK03_LIST' | 'XD01' | 'XD02' | 'XD03' | 'VA01' | 'VA02' | 'VA03' | 'VA04' | 'TR21' | 'TR24' | 'WGPS24' | 'SU01' | 'SU02' | 'SU03' | 'ZCODE' | 'SE38';

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
  { code: 'TR24', description: 'TRACK SHIPMENT', icon: Radar, module: 'Logistics' },
  { code: 'WGPS24', description: 'GPS TRACKING HUB', icon: Radar, module: 'Logistics' },
  { code: 'SE38', description: 'CUSTOM T-CODE REPORT', icon: FileText, module: 'System' },
  { code: 'SU01', description: 'USER MANAGEMENT: CREATE', icon: ShieldAlert, module: 'System' },
  { code: 'SU02', description: 'USER MANAGEMENT: CHANGE', icon: Edit3, module: 'System' },
  { code: 'SU03', description: 'USER MANAGEMENT: DISPLAY', icon: Info, module: 'System' },
  { code: 'ZCODE', description: 'SYSTEM: ALL ACTIVE T-CODES', icon: Grid2X2, module: 'System' },
];

const SHARED_HUB_ID = 'Sikkaind'; 

function VehicleLocation({ lat, lng, locationName, onClick }: { lat: number, lng: number, locationName?: string, onClick?: (loc: string) => void }) {
  const [loc, setLoc] = React.useState<string>(locationName || 'Syncing...');
  
  React.useEffect(() => {
    if (locationName) {
      setLoc(locationName);
      return;
    }
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const comps = results[0].address_components;
        let street = '', city = '';
        for (const c of comps) {
          if (c.types.includes('route')) street = c.long_name;
          if (c.types.includes('locality')) city = c.long_name;
        }
        const full = `${street}${street && city ? ' – ' : ''}${city}` || results[0].formatted_address;
        setLoc(full);
      } else {
        setLoc('Unknown Location');
      }
    });
  }, [lat, lng, locationName]);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick(loc);
    }
  };

  return (
    <span 
      onClick={handleClick}
      className={cn(
        "text-[10px] font-black text-[#1e3a8a] truncate max-w-[200px] cursor-pointer hover:underline underline-offset-2 uppercase tracking-tighter"
      )}
    >
      {loc}
    </span>
  );
}

function LiveTrackingMapDialog({ isOpen, onOpenChange, trip, gpsVehicle, customers, settings, isCompact = false }: any) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!isOpen || !trip || !gpsVehicle || !window.google || isCompact) return;
    
    setLoading(true);
    const geocoder = new window.google.maps.Geocoder();
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#1e3a8a', strokeWeight: 5 }
    });

    const consignor = customers?.find((c: any) => c.customerName?.toUpperCase() === trip.consignor?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === trip.consignor?.toUpperCase());
    const shipTo = customers?.find((c: any) => c.customerName?.toUpperCase() === trip.shipToParty?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === trip.shipToParty?.toUpperCase());

    const p1 = new Promise((resolve) => {
      if (consignor?.postalCode) {
        geocoder.geocode({ address: consignor.postalCode }, (res, status) => {
          if (status === 'OK') resolve(res[0].geometry.location);
          else resolve(null);
        });
      } else resolve(null);
    });

    const p2 = new Promise((resolve) => {
      if (shipTo?.postalCode) {
        geocoder.geocode({ address: shipTo.postalCode }, (res, status) => {
          if (status === 'OK') resolve(res[0].geometry.location);
          else resolve(null);
        });
      } else resolve(null);
    });

    Promise.all([p1, p2]).then(([origin, dest]: any) => {
      if (!mapRef.current) return;
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: gpsVehicle.latitude, lng: gpsVehicle.longitude },
        zoom: 12,
      });
      directionsRenderer.setMap(map);

      if (origin) {
        new window.google.maps.Marker({
          position: origin,
          map,
          label: { text: 'Start Point', className: 'bg-white px-2 py-1 border border-slate-300 text-[8px] font-black uppercase rounded shadow-sm mb-8' },
          icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        });
      }

      if (dest) {
        new window.google.maps.Marker({
          position: dest,
          map,
          label: { text: 'Drop Point', className: 'bg-white px-2 py-1 border border-slate-300 text-[8px] font-black uppercase rounded shadow-sm mb-8' },
          icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        });
      }

      const vIcon = gpsVehicle.speed > 0 ? settings?.activeIcon : settings?.stopIcon;
      new window.google.maps.Marker({
        position: { lat: gpsVehicle.latitude, lng: gpsVehicle.longitude },
        map,
        title: gpsVehicle.vehicleNumber,
        icon: {
          url: vIcon || 'https://maps.google.com/mapfiles/ms/icons/truck.png',
          scaledSize: new window.google.maps.Size(40, 40)
        }
      });

      if (origin && dest) {
        directionsService.route({
          origin,
          destination: dest,
          travelMode: window.google.maps.TravelMode.DRIVING,
        }, (result, status) => {
          if (status === 'OK') directionsRenderer.setDirections(result);
        });
      }
      setLoading(false);
    });
  }, [isOpen, trip, gpsVehicle, customers, settings, isCompact]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-5xl p-0 overflow-hidden bg-white border-none rounded-xl", isCompact ? "h-[12vh]" : "h-[85vh]")}>
        <DialogHeader className="bg-[#1e3a8a] text-white px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <Radar className="h-4 w-4" /> {isCompact ? 'Live Tracking' : 'Live Tracking: ' + trip?.vehicleNumber}
          </DialogTitle>
          <button onClick={() => onOpenChange(false)} className="hover:opacity-70"><X className="h-5 w-5" /></button>
        </DialogHeader>
        <div className="relative w-full h-full bg-slate-50">
          {isCompact ? (
             <div className="p-4 grid grid-cols-3 gap-8">
                <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Ship to Party</span><span className="text-[10px] font-black uppercase truncate">{trip?.shipToParty}</span></div>
                <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">Route</span><span className="text-[10px] font-black uppercase truncate">{trip?.route}</span></div>
                <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">Vehicle Number</span><span className="text-[10px] font-black uppercase">{trip?.vehicleNumber}</span></div>
             </div>
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center gap-3">
                   <Loader2 className="h-10 w-10 animate-spin text-[#1e3a8a]" />
                   <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1e3a8a]">Live Map Synchronization...</span>
                </div>
              )}
              <div ref={mapRef} className="w-full h-full" />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

  const [se38Search, setSe38Search] = React.useState({ plant: '', vendor: '', company: '', customer: '', from: format(subDays(new Date(), 7), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') });
  const [se38Results, setSe38Results] = React.useState<any[] | null>(null);

  const [viewMode, setViewMode] = React.useState<'list' | 'tracking'>('list');
  const [trackingNode, setTrackingNode] = React.useState<any>(null);

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

  const settingsRef = useMemoFirebase(() => doc(db, 'users', SHARED_HUB_ID, 'settings', 'gps_config'), [db]);
  const { data: settings } = useDoc(settingsRef);

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
      headers = "Plant,Consignor,Consignee Code,Consignee Name,Ship to Party Code,Ship to Party Name,Weight,UOM";
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
        const idxCons = getIdx('Consignor');
        const idxCeeCode = getIdx('ConsigneeCode');
        const idxShipCode = getIdx('ShiptoPartyCode');
        const idxW = getIdx('Weight');
        const idxU = getIdx('UOM');

        if (idxP === -1 || idxCons === -1 || idxCeeCode === -1 || idxShipCode === -1 || idxW === -1 || idxU === -1) {
          setStatusMsg({ text: 'Error: Mandatory headers missing (Plant, Consignor, Consignee Code, Ship to Party Code, Weight, UOM)', type: 'error' });
          return;
        }

        const orderGroups: Record<string, any> = {};
        let rejectedCount = 0;

        dataRows.forEach((row, rowIndex) => {
          const cols = parseCsvRow(row);
          const plant = cols[idxP];
          const cons = cols[idxCons];
          const ceeCode = cols[idxCeeCode];
          const shipCode = cols[idxShipCode];
          const weight = parseFloat(cols[idxW] || '0');
          const uom = cols[idxU];

          if (!plant || !cons || !ceeCode || !shipCode || isNaN(weight) || !uom) {
            rejectedCount++;
            return;
          }

          const consigneeMaster = rawCustomers?.find(c => c.customerCode?.toString().toUpperCase() === ceeCode.toUpperCase());
          const shipToMaster = rawCustomers?.find(c => c.customerCode?.toString().toUpperCase() === shipCode.toUpperCase());
          const consignorMaster = rawCustomers?.find(c => (c.customerName?.toUpperCase() === cons.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === cons.toUpperCase()));

          const consigneeNameFinal = consigneeMaster?.customerName || 'UNKNOWN CONSIGNEE';
          const shipToNameFinal = shipToMaster?.customerName || 'UNKNOWN SHIP TO';
          
          const soNo = `SO-B${Date.now().toString().slice(-6)}${rowIndex}`;

          if (!orderGroups[soNo]) {
            orderGroups[soNo] = {
              plantCode: plant,
              saleOrder: soNo,
              consignor: cons,
              from: consignorMaster?.city || '',
              consignee: consigneeNameFinal,
              shipToParty: shipToNameFinal,
              destination: shipToMaster?.city || '',
              deliveryAddress: shipToMaster?.address || '',
              weight: 0,
              weightUom: uom,
              status: 'OPEN',
              createdAt: new Date().toISOString(),
              saleOrderDate: format(new Date(), "yyyy-MM-dd'T'HH:mm")
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
    if (!user || activeScreen === 'HOME' || (activeScreen.endsWith('03') && activeScreen !== 'SE38')) return;

    if (activeScreen === 'SE38') {
      const { plant, from, to, vendor, company, customer } = se38Search;
      if (!plant || !from || !to) {
        setStatusMsg({ text: 'Error: Mandatory fields (Plant, From Date, To Date) missing', type: 'error' });
        return;
      }
      if (from > to) {
        setStatusMsg({ text: 'Error: Invalid date range (From > To)', type: 'error' });
        return;
      }
      
      let results = (rawTrips || []).filter(t => {
        const matchesPlant = t.plantCode === plant;
        const tripDate = (t.createdAt || t.updatedAt || '').split('T')[0];
        const matchesDate = tripDate >= from && tripDate <= to;
        
        if (!matchesPlant || !matchesDate) return false;
        
        if (vendor) {
          if (t.vendorCode !== vendor) return false;
        }
        
        if (company) {
          const c = (rawCompanies || []).find(comp => comp.companyCode === company);
          if (c && !c.plantCodes?.includes(t.plantCode)) return false;
          if (!c) return false;
        }
        
        if (customer) {
          const cust = (rawCustomers || []).find(c => c.customerCode === customer);
          if (cust && t.shipToParty !== cust.customerName && t.consignee !== cust.customerName && t.consignor !== cust.customerName) return false;
          if (!cust) return false;
        }
        
        return true;
      });
      
      setSe38Results(results);
      setStatusMsg({ text: `Sync complete: ${results.length} records found`, type: 'success' });
      return;
    }

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
  }, [user, activeScreen, formData, allOrders, rawPlants, allUsers, db, isBootstrapAdmin, rawCustomers, rawCompanies, rawVendors, rawOrders, se38Search, rawTrips]);

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
      setSe38Results(null);
      setViewMode('list');
      setStatusMsg({ text: `Transaction ${clean} executed`, type: 'info' });
    } else { setStatusMsg({ text: `T-Code ${clean} not found`, type: 'error' }); }
    setTCode('');
  }, [isAuthorized]);

  const handleBack = React.useCallback(() => {
    if (activeScreen === 'TR21' && viewMode === 'tracking') {
      setViewMode('list');
      return;
    }
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
  }, [screenStack, activeScreen, viewMode]);

  const handleCancel = React.useCallback(() => {
    if (activeScreen === 'HOME' || (activeScreen.endsWith('03') && activeScreen !== 'SE38')) return;
    setFormData({}); setSearchId(''); setStatusMsg({ text: 'Operation cancelled', type: 'info' });
  }, [activeScreen]);

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
  const showList = (activeScreen.endsWith('02') || activeScreen.endsWith('03')) && !formData.id && activeScreen !== 'SE38';
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

  const isSuPage = activeScreen.startsWith('SU');
  const isSe38Page = activeScreen === 'SE38';
  const isFlatPage = isSuPage || (activeScreen === 'TR21' && viewMode === 'tracking') || isSe38Page || (showForm && activeScreen !== 'HOME') || (showList && activeScreen !== 'HOME');

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
             {logoAsset && <Image src={logoAsset.url} alt="SLMC" width={80} height={30} className="object-contain" unoptimized data-ai-hint="logistics logo" />}
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
             <button onClick={handleSave} disabled={activeScreen === 'HOME' || (isReadOnly && activeScreen !== 'SE38')} 
               className={cn("p-1 rounded", (activeScreen === 'HOME' || (isReadOnly && activeScreen !== 'SE38')) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")} 
               title={activeScreen === 'SE38' ? "Execute (F8)" : "Save (F8)"}>
               {activeScreen === 'SE38' ? <PlayCircle className="h-4 w-4 text-blue-600" /> : <Save className="h-4 w-4 text-slate-600" />}
             </button>
             <button onClick={handleBack} className="p-1 hover:bg-slate-200 rounded" title="Back Step-by-Step (F3)"><Undo2 className="h-4 w-4 text-slate-600" /></button>
             <button onClick={handleCancel} disabled={activeScreen === 'HOME' || (isReadOnly && activeScreen !== 'SE38')} className={cn("p-1 rounded", (activeScreen === 'HOME' || (isReadOnly && activeScreen !== 'SE38')) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-200")} title="Cancel (F12)"><XCircle className="h-4 w-4 text-slate-600" /></button>
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
              {MASTER_TCODES.filter(t => t.code.endsWith('01') || t.code === 'TR21' || t.code === 'TR24' || t.code === 'VA04' || t.code === 'ZCODE' || t.code === 'WGPS24' || t.code === 'SE38').map((item) => (
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
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f2f2f2] print:bg-white">
            {activeScreen === 'HOME' ? (
              <div className="flex-1 overflow-y-auto p-2 md:p-4 relative animate-fade-in">
                <h1 className="text-2xl md:text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter mb-8">Sikka Logistics Management Control</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 md:p-6 border border-slate-300 shadow-sm mb-12">
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
              <div className={cn(
                "animate-slide-up print:p-0 print:border-none print:shadow-none flex flex-col w-full h-full overflow-y-auto bg-[#f2f2f2] green-scrollbar",
              )}>
                 {showForm && <div className="space-y-0 min-h-full">
                   <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10">
                      <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">
                        {MASTER_TCODES.find(t => t.code === activeScreen)?.description || activeScreen}
                      </h2>
                   </div>
                   <div className="px-10 pb-20 max-w-full">
                     {activeScreen.startsWith('OX') && <PlantForm data={formData} onChange={setFormData} disabled={isReadOnly} />}
                     {activeScreen.startsWith('FM') && <CompanyForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}
                     {activeScreen.startsWith('XK') && <VendorForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}
                     {activeScreen.startsWith('XD') && <CustomerForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}
                     {activeScreen.startsWith('VA') && activeScreen !== 'VA03' && activeScreen !== 'VA04' && <SalesOrderForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} allCustomers={accessibleCustomers} />}
                     {activeScreen === 'VA04' && <CancelOrderForm data={formData} onChange={setFormData} allOrders={allOrders} onPost={handleSave} onCancel={() => setFormData({})} />}
                     {activeScreen.startsWith('SU') && <UserForm data={formData} onChange={setFormData} disabled={isReadOnly} allPlants={accessiblePlants} />}
                   </div>
                 </div>}
                 {showList && <div className="space-y-0 min-h-full">
                   <div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 flex items-center justify-between">
                      <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">
                        {MASTER_TCODES.find(t => t.code === activeScreen)?.description || activeScreen} - REGISTRY
                      </h2>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AUTHORIZED HUB NODE</div>
                   </div>
                   <div className="px-10 pb-20 max-w-full">
                     <div className="bg-white border-b-2 border-slate-300 p-6 mb-8 flex flex-col md:flex-row items-center gap-8">
                       <div className="flex flex-col gap-2 flex-1 w-full"><label className="text-[11px] font-black uppercase text-slate-500 block tracking-widest">Search Criteria</label>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
                             {activeScreen.startsWith('XD') ? <>
                                 <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Customer ID</label><input className="h-8 border border-slate-400 px-3 text-xs font-black outline-none bg-white" value={xdSearch.customerId} onChange={(e) => setXdSearch({...xdSearch, customerId: e.target.value})} onKeyDown={handleSearchIdEnter} /></div>
                                 <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Select Plant</label><select className="h-8 border border-slate-400 bg-white px-2 text-xs font-bold" value={xdSearch.plant} onChange={(e) => setXdSearch({...xdSearch, plant: e.target.value})}><option value="">ALL PLANTS</option>{accessiblePlants.map(p => <option key={p.id} value={p.plantCode}>{p.plantCode}</option>)}</select></div>
                                 <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Select Type</label><select className="h-8 border border-slate-400 bg-white px-2 text-xs font-bold" value={xdSearch.type} onChange={(e) => setXdSearch({...xdSearch, type: e.target.value})}><option value="">ALL TYPES</option><option value="Consignor">Consignor</option><option value="Consignee - Ship to Party">Consignee - Ship to Party</option></select></div>
                                 <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Enter Name</label><input className="h-8 border border-slate-400 px-3 text-xs font-black outline-none" value={xdSearch.name} onChange={(e) => setXdSearch({...xdSearch, name: e.target.value})} /></div>
                               </> : <div className="col-span-1 md:col-span-4 flex items-center gap-4"><input className="h-9 w-full max-w-2xl border border-slate-400 px-4 text-xs font-black outline-none bg-white focus:ring-1 focus:ring-blue-500 uppercase tracking-widest" value={searchId} onChange={(e) => setSearchId(e.target.value)} onKeyDown={handleSearchIdEnter} placeholder="ENTER IDENTIFIER AND PRESS ENTER..." /></div>}
                          </div>
                       </div>
                     </div>
                     <RegistryList onSelectItem={setFormData} listData={getRegistryList()} activeScreen={activeScreen} />
                   </div>
                 </div>}
                 {activeScreen === 'TR21' && viewMode === 'list' && (
                   <DripBoard 
                     orders={allOrders} 
                     trips={allTrips} 
                     vendors={accessibleVendors} 
                     plants={accessiblePlants} 
                     companies={accessibleCompanies} 
                     customers={accessibleCustomers} 
                     onStatusUpdate={setStatusMsg}
                     viewMode={viewMode}
                     setViewMode={setViewMode}
                     trackingNode={trackingNode}
                     setTrackingNode={setTrackingNode}
                     settings={settings}
                   />
                 )}
                 {activeScreen === 'TR21' && viewMode === 'tracking' && (
                    <Tr21TrackingPage 
                      node={trackingNode} 
                      onBack={() => setViewMode('list')} 
                      customers={accessibleCustomers}
                      settings={settings}
                    />
                 )}
                 {activeScreen === 'TR24' && <TrackShipmentScreen trips={allTrips} orders={allOrders} customers={accessibleCustomers} />}
                 {activeScreen === 'WGPS24' && <GpsTrackingHub trips={allTrips} onStatusUpdate={setStatusMsg} db={db} settings={settings} settingsRef={settingsRef} />}
                 {activeScreen === 'SE38' && <Se38Report search={se38Search} results={se38Results} onSearchChange={setSe38Search} allPlants={accessiblePlants} allVendors={accessibleVendors} allCompanies={accessibleCompanies} allCustomers={accessibleCustomers} />}
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
    <div className="mb-10 w-full animate-fade-in">
      {title && (
        <div className="flex items-center gap-6 mb-6">
          <span className="text-[13px] font-black text-slate-800 min-w-[120px] uppercase tracking-widest">{title}</span>
          <div className="h-px bg-slate-300 flex-1" />
        </div>
      )}
      <div className="space-y-4 pl-12">
        {children}
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text", disabled, placeholder, rightElement }: any) {
  return (
    <div className="flex items-center gap-8 group">
      <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">{label}:</label>
      <div className="relative w-[320px]">
        <input 
          type={type} 
          value={value || ''} 
          onChange={(e: any) => onChange(e.target.value)} 
          disabled={disabled} 
          placeholder={placeholder} 
          className="h-8 w-full border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm disabled:opacity-60" 
        />
        {rightElement && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
    </div>
  );
}

function FormSelect({ label, value, options, onChange, disabled, placeholder }: any) {
  return (
    <div className="flex items-center gap-8 group">
      <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">{label}:</label>
      <select 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        disabled={disabled} 
        className="h-8 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm disabled:opacity-60"
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((o: any, idx: number) => {
          const v = typeof o === 'string' ? o : o.value; 
          const l = typeof o === 'string' ? o : o.label;
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
    const cleanName = val.includes(' - ') ? val.split(' - ').slice(0, -1).join(' - ') : val;
    setInputValue(cleanName);
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
    <div className="flex items-center gap-8 group relative">
      <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase tracking-tight">{label}:</label>
      <div className="relative w-[320px]">
        <input 
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
          className="h-8 w-full border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase shadow-sm" 
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Search className="h-3 w-3 text-slate-400" />
        </div>
      </div>
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute top-full left-[212px] w-[320px] bg-white border border-slate-300 shadow-2xl z-[110] mt-1 max-h-[250px] overflow-y-auto">
          {filteredOptions.map((opt: string, idx: number) => (
            <div 
              key={idx} 
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                "px-4 py-2 text-[11px] font-black cursor-pointer border-b border-slate-50 last:border-0",
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
  return <div className="space-y-10"><SectionGrouping title="PRIMARY DATA">
    <FormInput label="PLANT CODE" value={data.plantCode} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
    <FormInput label="PLANT NAME" value={data.plantName} onChange={(v: string) => onChange({...data, plantName: v})} disabled={disabled} /></SectionGrouping>
    <SectionGrouping title="LOCATION DATA"><FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
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

  return <div className="space-y-10">
    <SectionGrouping title="PLANT ASSIGNMENT">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Assigned Plants:</label>
        <div className="flex flex-wrap gap-2 w-full max-w-[600px]">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none transition-all", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300 hover:border-blue-500")}>{p}</button>)}</div>
      </div>
    </SectionGrouping>
    <SectionGrouping title="IDENTIFICATION">
      <FormInput label="COMPANY CODE" value={data.companyCode} onChange={(v: string) => onChange({...data, companyCode: v})} disabled={disabled} />
      <FormInput label="COMPANY NAME" value={data.companyName} onChange={(v: string) => onChange({...data, companyName: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="LOCATION">
      <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
      <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
      <FormInput label="STATE" value={data.state} onChange={(v: string) => onChange({...data, state: v})} disabled={disabled} />
      <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="TAX & ASSETS">
      <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
      <FormInput label="PAN" value={data.pan} onChange={(v: string) => onChange({...data, pan: v})} disabled={disabled} />
      <FormInput label="WEBSITE" value={data.website} onChange={(v: string) => onChange({...data, website: v})} disabled={disabled} />
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Company Logo:</label>
        <div className="flex items-center gap-4">
          <input type="file" accept="image/*" onChange={handleFile} disabled={disabled} className="hidden" id="fm01-logo-up" />
          <label htmlFor="fm01-logo-up" className={cn("px-4 h-8 border border-slate-400 bg-white flex items-center text-[10px] font-black cursor-pointer shadow-sm uppercase tracking-widest", disabled && "opacity-50 cursor-not-allowed")}>
            {data.logo ? "CHANGE IMAGE" : "UPLOAD LOGO"}
          </label>
          {data.logo && (
            <div className="h-10 w-10 border border-slate-300 overflow-hidden bg-white shrink-0 relative group">
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
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  
  return <div className="space-y-10">
    <SectionGrouping title="PLANT MAPPING">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Assigned Hubs:</label>
        <div className="flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none transition-all", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{p}</button>)}</div>
      </div>
    </SectionGrouping>
    <SectionGrouping title="IDENTIFICATION">
      <FormInput label="VENDOR CODE" value={data.vendorCode} disabled={true} placeholder="AUTO-NODE-GEN" />
      <FormInput label="VENDOR NAME" value={data.vendorName} onChange={(v: string) => onChange({...data, vendorName: v})} disabled={disabled} />
      <FormInput label="VENDOR FIRM" value={data.vendorFirmName} onChange={(v: string) => onChange({...data, vendorFirmName: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="DETAILS">
      <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
      <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
      <FormInput label="SPECIAL ROUTE" value={data.route} onChange={(v: string) => onChange({...data, route: v})} disabled={disabled} />
    </SectionGrouping></div>;
}

function CustomerForm({ data, onChange, disabled, allPlants }: any) {
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handleToggle = (p: string) => { if (disabled) return; const curr = data.plantCodes || []; onChange({...data, plantCodes: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  return <div className="space-y-10">
    <SectionGrouping title="PLANT HUB">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Assigned Hubs:</label>
        <div className="flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handleToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none transition-all", data.plantCodes?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{p}</button>)}</div>
      </div>
    </SectionGrouping>
    <SectionGrouping title="IDENTIFICATION">
      <FormInput label="CUSTOMER CODE" value={data.customerCode} onChange={(v: string) => onChange({...data, customerCode: v})} disabled={disabled} />
      <FormInput label="CUSTOMER NAME" value={data.customerName} onChange={(v: string) => onChange({...data, customerName: v})} disabled={disabled} />
      <FormSelect label="CUSTOMER TYPE" value={data.customerType} options={["Consignor", "Consignee - Ship to Party"]} onChange={(v: string) => onChange({...data, customerType: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="LOCATION">
      <FormInput label="ADDRESS" value={data.address} onChange={(v: string) => onChange({...data, address: v})} disabled={disabled} />
      <FormInput label="CITY" value={data.city} onChange={(v: string) => onChange({...data, city: v})} disabled={disabled} />
      <FormInput label="POSTAL CODE" value={data.postalCode} onChange={(v: string) => onChange({...data, postalCode: v})} disabled={disabled} />
      <FormInput label="GSTIN" value={data.gstin} onChange={(v: string) => onChange({...data, gstin: v})} disabled={disabled} />
    </SectionGrouping></div>;
}

function SalesOrderForm({ data, onChange, disabled, allPlants, allCustomers }: any) {
  const pOpts = (allPlants || []).map((p: any) => p.plantCode);
  const filtered = (allCustomers || []).filter((c: any) => c.plantCodes?.includes(data.plantCode));
  const cons = filtered.filter((c: any) => c.customerType === 'Consignor');
  const ships = filtered.filter((c: any) => c.customerType === 'Consignee - Ship to Party');

  React.useEffect(() => {
    if (!data.saleOrderDate && !disabled) {
      onChange({ ...data, saleOrderDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
    }
  }, [data.saleOrderDate, disabled, onChange, data]);
  
  return <div className="space-y-10">
    <SectionGrouping title="HEADER">
      <FormSelect label="PLANT HUB" value={data.plantCode} options={pOpts} onChange={(v: string) => onChange({...data, plantCode: v})} disabled={disabled} />
      <FormInput label="SALE ORDER NO" value={data.saleOrder} onChange={(v: string) => onChange({...data, saleOrder: v})} disabled={disabled} />
      <FormInput label="ORDER BOOK DATE TIME" type="datetime-local" value={data.saleOrderDate} onChange={(v: string) => onChange({...data, saleOrderDate: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="COORDINATION">
      <FormSearchInput 
        label="CONSIGNOR" 
        value={data.consignor} 
        options={cons.map(c => c.customerName + ' - ' + c.city)} 
        onChange={(v: string) => {
          const matching = cons.find(c => (c.customerName + ' - ' + c.city).toUpperCase() === v?.toUpperCase());
          const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v;
          onChange({...data, consignor: nameOnly, from: matching?.city || ''});
        }} 
        disabled={disabled} 
      />
      <FormInput label="FROM CITY" value={data.from} disabled={true} />
      <FormSearchInput 
        label="CONSIGNEE" 
        value={data.consignee} 
        options={ships.map(c => c.customerName + ' - ' + c.city)} 
        onChange={(v: string) => {
          const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v;
          onChange({...data, consignee: nameOnly});
        }} 
        disabled={disabled} 
      />
      <FormSearchInput 
        label="SHIP TO PARTY" 
        value={data.shipToParty} 
        options={ships.map(c => c.customerName + ' - ' + c.city)} 
        onChange={(v: string) => {
          const matching = ships.find(c => (c.customerName + ' - ' + c.city).toUpperCase() === v?.toUpperCase());
          const nameOnly = v.includes(' - ') ? v.split(' - ').slice(0, -1).join(' - ') : v;
          onChange({...data, shipToParty: nameOnly, destination: matching?.city || '', deliveryAddress: matching?.address || ''});
        }} 
        disabled={disabled} 
      />
      <FormInput label="DESTINATION" value={data.destination} disabled={true} />
      <FormInput label="WEIGHT" type="number" value={data.weight} onChange={(v: string) => onChange({...data, weight: v})} disabled={disabled} />
      <FormSelect label="UOM" value={data.weightUom} options={["MT", "LTR"]} onChange={(v: string) => onChange({...data, weightUom: v})} disabled={disabled} />
    </SectionGrouping>
  </div>;
}

function UserForm({ data, onChange, disabled, allPlants }: any) {
  const [showPassword, setShowPassword] = React.useState(false);
  const pList = (allPlants || []).map((p: any) => p.plantCode);
  const handlePToggle = (p: string) => { if (disabled) return; const curr = data.plants || []; onChange({...data, plants: curr.includes(p) ? curr.filter((i: string) => i !== p) : [...curr, p]}); };
  const handleTToggle = (c: string) => { if (disabled) return; const curr = data.tcodes || []; onChange({...data, tcodes: curr.includes(c) ? curr.filter((i: string) => i !== c) : [...curr, c]}); };
  
  return <div className="space-y-12">
    <SectionGrouping title="USER IDENTIFICATION">
      <FormInput label="FULL NAME" value={data.fullName} onChange={(v: string) => onChange({...data, fullName: v})} disabled={disabled} />
      <FormInput label="USERNAME" value={data.username} onChange={(v: string) => onChange({...data, username: v})} disabled={disabled} />
      <FormInput label="PASSWORD" type={showPassword ? "text" : "password"} value={data.password} onChange={(v: string) => onChange({...data, password: v})} disabled={disabled} rightElement={<button onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-blue-900">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
      <FormInput label="MOBILE" value={data.mobile} onChange={(v: string) => onChange({...data, mobile: v})} disabled={disabled} />
    </SectionGrouping>
    <SectionGrouping title="PLANT ACCESS">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">Authorized Plants:</label>
        <div className="flex flex-wrap gap-2">{pList.map((p: string) => <button key={p} onClick={() => handlePToggle(p)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none", data.plants?.includes(p) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{p}</button>)}</div>
      </div>
    </SectionGrouping>
    <SectionGrouping title="TRANSACTION ACCESS">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-slate-600 w-[180px] text-right shrink-0 uppercase">T-Code Registry:</label>
        <div className="flex flex-wrap gap-2">{MASTER_TCODES.map(t => <button key={t.code} onClick={() => handleTToggle(t.code)} disabled={disabled} className={cn("px-4 py-1.5 text-[10px] font-black border uppercase rounded-none", data.tcodes?.includes(t.code) ? "bg-[#1e3a8a] text-white border-[#1e3a8a]" : "bg-white text-slate-500 border-slate-300")}>{t.code}</button>)}</div>
      </div>
    </SectionGrouping>
  </div>;
}

function CancelOrderForm({ data, onChange, allOrders, onPost, onCancel }: any) {
  return <div className="space-y-12">
    <SectionGrouping title="CANCELLATION">
      <div className="flex items-center gap-8">
        <label className="text-[12px] font-bold text-red-600 w-[180px] text-right shrink-0 uppercase">Order Number:</label>
        <input className="h-10 w-[320px] border border-red-200 px-3 text-[12px] font-black outline-none bg-red-50/20 focus:ring-1 focus:ring-red-500 uppercase" placeholder="ORDER NO + ENTER" value={data.saleOrder || ''} onChange={e => onChange({ ...data, saleOrder: e.target.value.toUpperCase() })} onKeyDown={e => { if (e.key === 'Enter') { const o = allOrders?.find((ord: any) => ord.saleOrder === data.saleOrder); if (o) onChange({...data, ...o}); } }} />
      </div>
    </SectionGrouping>
    <div className="pl-[212px] flex gap-4"><Button onClick={onCancel} variant="outline" className="h-10 px-8 text-[10px] font-black uppercase">Exit</Button><Button onClick={onPost} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] px-10 h-10 shadow-lg">Execute Cancellation</Button></div></div>;
}

function RegistryList({ onSelectItem, listData, activeScreen }: any) {
  const isSuPage = activeScreen?.startsWith('SU');
  const isVendorRegistry = activeScreen?.startsWith('XK');
  const headers = isSuPage ? ['Full Name', 'Username', 'Authentication Node', 'Authorized Hub Node'] : isVendorRegistry ? ['Vendor Code', 'Vendor Name', 'Vendor Firm Name', 'Mobile', 'Special Route'] : ['ID', 'Name / Description', 'Type / Details', 'Sync Hub'];
  
  return <div className="w-full bg-white border border-slate-300 shadow-sm overflow-hidden">
    <table className="w-full text-left border-collapse min-w-[700px]">
      <thead className="bg-[#f0f0f0] border-b-2 border-slate-300 h-10">
        <tr className="text-[10px] font-black uppercase text-slate-600">
          {headers.map(c => <th key={c} className="p-3 border-r border-slate-200 last:border-0">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {listData?.map((item: any) => (
          <tr key={item.id} onClick={() => onSelectItem(item)} className="border-b border-slate-100 hover:bg-[#e8f0fe] cursor-pointer transition-colors text-[11px] font-bold group">
            {isSuPage ? (
              <><td className="p-4 font-black text-[#0056d2] uppercase">{item.fullName}</td><td className="p-4 uppercase">{item.username}</td><td className="p-4"><span className="bg-slate-50 px-2 py-1 border border-slate-200 text-slate-500 font-mono">{item.password}</span></td><td className="p-4 uppercase text-slate-500 italic tracking-tight">{item.plants?.join(', ') || 'NOT REGISTERED'}</td></>
            ) : isVendorRegistry ? (
              <><td className="p-3 font-black text-[#0056d2]">{item.vendorCode}</td><td className="p-3 uppercase">{item.vendorName}</td><td className="p-3 uppercase">{item.vendorFirmName}</td><td className="p-3">{item.mobile}</td><td className="p-3 italic text-slate-500">{item.route}</td></>
            ) : (
              <><td className="p-3 font-black text-[#0056d2]">{item.saleOrder || item.plantCode || item.customerCode || item.vendorCode || item.companyCode || item.id.slice(0, 8)}</td><td className="p-3 uppercase">{item.customerName || item.plantName || item.vendorName || item.companyName || item.fullName || item.username || `${item.consignor} → ${item.consignee}`}</td><td className="p-3 italic text-slate-500">{item.city || item.customerType || item.vendorCode || 'DATA'}</td><td className="p-3 text-slate-400">{format(new Date(item.updatedAt || new Date()), 'dd-MM-yyyy')}</td></>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}

function DripBoard({ orders, trips, vendors, plants, companies, customers, onStatusUpdate, viewMode, setViewMode, trackingNode, setTrackingNode, settings }: any) {
  const { user } = useUser(); const db = useFirestore(); 
  const [activeTab, setActiveTab] = React.useState('Open Orders'); 
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null); 
  const [isPopupOpen, setIsPopupOpen] = React.useState(false); 
  const [assignData, setAssignData] = React.useState<any>({ fleetType: 'Own Vehicle', isFixedRate: false, rate: 0, freightAmount: 0 }); 
  const [vendorSearch, setVendorSearch] = React.useState(''); 
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 15;
  const [fromDate, setFromDate] = React.useState(format(subDays(new Date(), 4), 'yyyy-MM-dd'));
  const [toDate, setToDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [isOutPopupOpen, setIsOutPopupOpen] = React.useState(false);
  const [outData, setOutData] = React.useState<any>({ tripId: '', vehicleNumber: '', route: '', date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  const [isAssignmentPopupOpen, setIsAssignmentPopupOpen] = React.useState(false);
  const [assignmentMode, setAssignmentMode] = React.useState<'edit' | 'unassign' | null>(null);
  const [selectedTripForAssignment, setSelectedTripForAssignment] = React.useState<any>(null);
  const [isTrackModePopupOpen, setIsTrackModePopupOpen] = React.useState(false);
  const [selectedTripForTrackMode, setSelectedTripForTrackMode] = React.useState<any>(null);
  const [trackModeData, setTrackModeData] = React.useState({ mode: 'GPS Tracking' });
  const [isArrivedPopupOpen, setIsArrivedPopupOpen] = React.useState(false);
  const [arrivedData, setArrivedData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  const [isRejectPopupOpen, setIsRejectPopupOpen] = React.useState(false);
  const [rejectData, setRejectData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), remark: '' });
  const [isUnloadPopupOpen, setIsUnloadPopupOpen] = React.useState(false);
  const [unloadData, setUnloadData] = React.useState<any>({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') });
  const [isPodPopupOpen, setIsPodPopupOpen] = React.useState(false);
  const [selectedTripForPod, setSelectedTripForPod] = React.useState<any>(null);
  const [podFile, setPodFile] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isClosedViewPopupOpen, setIsClosedViewPopupOpen] = React.useState(false);
  const [selectedTripForClosed, setSelectedTripForClosed] = React.useState<any>(null);
  const [closedViewMode, setClosedViewMode] = React.useState<'view' | 'upload'>('view');
  const [isCnPopupOpen, setIsCnPopupOpen] = React.useState(false);
  const [selectedTripForCn, setSelectedTripForCn] = React.useState<any>(null);
  const [cnFormData, setCnFormData] = React.useState<any>({ cnNo: '', cnNoAuto: '', cnDate: format(new Date(), 'yyyy-MM-dd'), paymentTerms: 'PAID', items: [{ invoiceNo: '', ewaybillNo: '', product: '', unit: '', uom: 'BAG' }] });
  const [isCnPreviewOpen, setIsCnPreviewOpen] = React.useState(false);
  const [selectedTripForPreview, setSelectedTripForPreview] = React.useState<any>(null);
  const [cnPreviewStatus, setCnPreviewStatus] = React.useState<'idle' | 'generated'>('idle');
  const [gpsData, setGpsData] = React.useState<any[]>([]);

  const [isDelayRemarkPopupOpen, setIsDelayRemarkPopupOpen] = React.useState(false);
  const [selectedOrderForRemark, setSelectedOrderForRemark] = React.useState<any>(null);
  const [delayRemarkInput, setDelayRemarkInput] = React.useState('');

  const fetchGps = React.useCallback(async () => {
    try {
      const res = await fetch('/api/gps');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.list) setGpsData(json.data.list);
      }
    } catch (e) {}
  }, []);
  
  React.useEffect(() => { 
    fetchGps(); const i = setInterval(fetchGps, 30000); return () => clearInterval(i); 
  }, [fetchGps]);

  const TABS = ['Open Orders', 'Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'];
  const getStats = (o: any) => { const tot = parseFloat(o.weight) || 0; const ass = trips?.filter((t: any) => t.saleOrderId === o.id).reduce((a: number, t: any) => a + (t.assignWeight || 0), 0) || 0; return { tot, ass, bal: tot - ass, uom: o.weightUom || 'MT' }; };
  const fOrders = React.useMemo(() => (orders || []).filter(o => o.status !== 'CANCELLED').map(o => { const stats = getStats(o); const route = (o.from && o.destination) ? `${o.from} → ${o.destination}` : (o.route || ''); return { ...o, ...stats, route }; }).filter(o => { const bal = o.bal > 0; const itemDate = new Date(o.createdAt); return bal && isWithinInterval(itemDate, { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) }); }), [orders, trips, fromDate, toDate]);
  const fTrips = React.useMemo(() => { if (!trips) return []; const map: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' }; return trips.filter(t => t.status === map[activeTab]).map(t => { const route = (t.from && t.destination && !t.route?.includes('→')) ? `${t.from} → ${t.destination}` : t.route; return { ...t, route }; }).filter(t => isWithinInterval(new Date(t.createdAt), { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) })); }, [trips, activeTab, fromDate, toDate]);
  const tabCounts = React.useMemo(() => { const counts: Record<string, number> = {}; counts['Open Orders'] = fOrders.length; ['Loading', 'In-Transit', 'Arrived', 'Reject', 'POD Verify', 'Closed'].forEach(t => { const map: any = { 'Loading': 'LOADING', 'In-Transit': 'IN-TRANSIT', 'Arrived': 'ARRIVED', 'Reject': 'REJECTION', 'POD Verify': 'POD', 'Closed': 'CLOSED' }; counts[t] = (trips || []).filter(tr => tr.status === map[t] && isWithinInterval(new Date(tr.createdAt), { start: startOfDay(new Date(fromDate)), end: endOfDay(new Date(toDate)) })).length; }); return counts; }, [fOrders, trips, fromDate, toDate]);
  const filteredData = React.useMemo(() => { const rawData = activeTab === 'Open Orders' ? fOrders : fTrips; if (!searchQuery) return rawData; const lowerQuery = searchQuery.toLowerCase(); return rawData.filter((item: any) => Object.values(item).some(val => String(val).toLowerCase().includes(lowerQuery))); }, [activeTab, fOrders, fTrips, searchQuery]);
  const paginatedData = React.useMemo(() => { const start = (currentPage - 1) * itemsPerPage; return filteredData.slice(start, start + itemsPerPage); }, [filteredData, currentPage]);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

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
      freightAmount: 0,
      assignDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      vendorName: '',
      vendorFirmName: '',
      vendorMobile: '',
      arrangeBy: '',
      vehicleNumber: '',
      driverMobile: ''
    }); 
    setIsPopupOpen(true); 
  };
  
  const handleDelayRemark = (o: any) => {
    setSelectedOrderForRemark(o);
    setDelayRemarkInput(o.delayRemark || '');
    setIsDelayRemarkPopupOpen(true);
  };

  const handlePostDelayRemark = () => {
    if (!selectedOrderForRemark) return;
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'sales_orders', selectedOrderForRemark.id), {
      delayRemark: delayRemarkInput,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setIsDelayRemarkPopupOpen(false);
    onStatusUpdate({ text: 'Delay Remark Saved', type: 'success' });
  };

  const handleAssignmentClick = (t: any) => { setSelectedTripForAssignment(t); setAssignmentMode(null); setAssignData({ vehicleNumber: t.vehicleNumber, driverMobile: t.driverMobile, assignWeight: t.assignWeight, fleetType: t.fleetType, vendorName: t.vendorName, vendorMobile: t.vendorMobile, employee: t.employee, rate: t.rate, freightAmount: t.freightAmount, isFixedRate: t.isFixedRate, plantCode: t.plantCode, consignee: t.consignee, shipToParty: t.shipToParty, route: t.route }); setIsAssignmentPopupOpen(true); };
  
  const handlePodFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2048 * 1024) {
      alert("Error: File size must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPodFile(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClosedUpdatePost = () => {
    if (!selectedTripForClosed || !podFile) return;
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForClosed.id), { 
      podFile: podFile, 
      podUploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString() 
    }, { merge: true });
    setIsClosedViewPopupOpen(false);
    onStatusUpdate({ text: `POD Node Updated`, type: 'success' });
  };

  const handleAssignmentPost = () => { if (!assignmentMode) { onStatusUpdate({ text: 'Selection Required', type: 'error' }); return; } if (assignmentMode === 'unassign') { deleteDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForAssignment.id)); onStatusUpdate({ text: `Trip Unassigned`, type: 'success' }); } else { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForAssignment.id), { vehicleNumber: assignData.vehicleNumber, driverMobile: assignData.driverMobile, assignWeight: parseFloat(assignData.assignWeight || 0), fleetType: assignData.fleetType, vendorName: assignData.vendorName || '', vendorMobile: assignData.vendorMobile || '', employee: assignData.employee || '', rate: parseFloat(assignData.rate || 0) || 0, freightAmount: parseFloat(assignData.freightAmount || 0) || 0, isFixedRate: !!assignData.isFixedRate, updatedAt: new Date().toISOString() }, { merge: true }); onStatusUpdate({ text: `Trip Updated`, type: 'success' }); } setIsAssignmentPopupOpen(false); };
  const handleTrackModeAction = (t: any) => { setSelectedTripForTrackMode(t); setTrackModeData({ mode: t.trackMode || 'GPS Tracking' }); setIsTrackModePopupOpen(true); };
  const handleTrackModePost = () => { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForTrackMode.id), { trackMode: trackModeData.mode, updatedAt: new Date().toISOString() }, { merge: true }); setIsTrackModePopupOpen(false); onStatusUpdate({ text: `Mode Synced`, type: 'success' }); };
  const handleOpenMapPage = (t: any, gps: any) => { setTrackingNode({ trip: t, gps }); setViewMode('tracking'); };
  const handleOutVehicle = (t: any) => { setOutData({ tripId: t.tripId, id: t.id, vehicleNumber: t.vehicleNumber, route: t.route, date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm') }); setIsOutPopupOpen(true); };
  const handleConfirmOut = () => { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', outData.id), { status: 'IN-TRANSIT', outDate: outData.date, outTime: outData.time, updatedAt: new Date().toISOString() }, { merge: true }); setIsOutPopupOpen(false); onStatusUpdate({ text: `Vehicle IN-TRANSIT`, type: 'success' }); };
  const handleArrivedAction = (t: any) => { setArrivedData({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), trip: t }); setIsArrivedPopupOpen(true); };
  const handleArrivedPost = () => { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', arrivedData.trip.id), { status: 'ARRIVED', arrivedDate: arrivedData.date, arrivedTime: arrivedData.time, updatedAt: new Date().toISOString() }, { merge: true }); setIsArrivedPopupOpen(false); onStatusUpdate({ text: `Arrived Registry Synced`, type: 'success' }); };
  const handleRejectAction = (t: any) => { setRejectData({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), remark: '', trip: t }); setIsRejectPopupOpen(true); };
  const handleRejectPost = () => { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', rejectData.trip.id), { status: 'REJECTION', rejectionDate: rejectData.date, rejectionTime: rejectData.time, rejectionRemark: rejectData.remark, updatedAt: new Date().toISOString() }, { merge: true }); setIsRejectPopupOpen(false); onStatusUpdate({ text: `Node Rejected`, type: 'success' }); };
  const handleUnloadAction = (t: any) => { setUnloadData({ date: format(new Date(), 'yyyy-MM-dd'), time: format(new Date(), 'HH:mm'), trip: t }); setIsUnloadPopupOpen(true); };
  const handleUnloadPost = () => { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', unloadData.trip.id), { status: 'POD', unloadDate: unloadData.date, unloadTime: unloadData.time, updatedAt: new Date().toISOString() }, { merge: true }); setIsUnloadPopupOpen(false); onStatusUpdate({ text: `Unload Node Synced`, type: 'success' }); };
  const handlePodUploadAction = (t: any) => { setSelectedTripForPod(t); setPodFile(null); setIsPodPopupOpen(true); };
  const handlePodPost = () => { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForPod.id), { status: 'CLOSED', podFile: podFile, podUploadedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true }); setIsPodPopupOpen(false); onStatusUpdate({ text: `Node CLOSED`, type: 'success' }); };
  const handleViewAction = (t: any) => { setSelectedTripForClosed(t); setClosedViewMode('view'); setPodFile(t.podFile || null); setIsClosedViewPopupOpen(true); };
  const handleAddCn = (t: any) => { setSelectedTripForCn(t); const company = (companies || []).find((c: any) => c.plantCodes?.includes(t.plantCode)); setCnFormData({ cnNo: t.cnNo || '', cnDate: t.cnDate || format(new Date(), 'yyyy-MM-dd'), paymentTerms: t.paymentTerms || 'PAID', carrierName: company?.companyName || 'AUTO-ASSIGN PENDING', items: t.cnItems || [{ invoiceNo: '', ewaybillNo: '', product: '', unit: '', uom: 'BAG' }] }); setIsCnPopupOpen(true); };
  const handleCnPost = () => { setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', selectedTripForCn.id), { cnNo: cnFormData.cnNo, cnDate: cnFormData.cnDate, paymentTerms: cnFormData.paymentTerms, carrierName: cnFormData.carrierName, cnItems: cnFormData.items, updatedAt: new Date().toISOString() }, { merge: true }); setIsCnPopupOpen(false); onStatusUpdate({ text: `CN Synced`, type: 'success' }); };
  const handleCnPreviewClick = (t: any) => { const order = (orders || []).find((o: any) => o.id === t.saleOrderId); setSelectedTripForPreview({ ...t, order }); setCnPreviewStatus('idle'); setIsCnPreviewOpen(true); };

  const handleCreateTrip = () => {
    const tripId = `T-${selectedOrder.saleOrder.slice(-5)}-${Math.floor(100 + Math.random() * 899)}`;
    const docId = crypto.randomUUID();
    const payload = {
      id: docId,
      tripId,
      saleOrderId: selectedOrder.id,
      saleOrderNumber: selectedOrder.saleOrder,
      saleOrderDate: selectedOrder.saleOrderDate || '',
      plantCode: assignData.plantCode,
      consignee: assignData.consignee,
      shipToParty: assignData.shipToParty,
      route: assignData.route,
      assignWeight: parseFloat(assignData.assignWeight),
      vehicleType: assignData.fleetType?.toUpperCase(),
      fleetType: assignData.fleetType,
      vehicleNumber: assignData.vehicleNumber,
      driverMobile: assignData.driverMobile,
      vendorName: assignData.vendorName || '',
      vendorCode: assignData.vendorCode || '',
      vendorFirmName: assignData.vendorFirmName || '',
      vendorMobile: assignData.vendorMobile || '',
      arrangeBy: assignData.arrangeBy || '',
      rate: parseFloat(assignData.rate || 0),
      freightAmount: parseFloat(assignData.freightAmount || 0),
      isFixedRate: !!assignData.isFixedRate,
      status: 'LOADING',
      createdAt: new Date().toISOString(),
      assignDate: assignData.assignDate || new Date().toISOString()
    };
    setDocumentNonBlocking(doc(db, 'users', SHARED_HUB_ID, 'trips', docId), payload, { merge: true });
    setIsPopupOpen(false);
    onStatusUpdate({ text: `Trip Node ${tripId} Synchronized`, type: 'success' });
  };

  return <div className="flex flex-col h-full space-y-0">
    <div className="bg-white border-b border-slate-300 px-8 py-3 mb-4 print:hidden">
       <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">DRIP BOARD CONTROL</h2>
    </div>
    <div className="px-8 space-y-4">
      <div className="flex flex-col md:flex-row items-center gap-6 bg-white border border-slate-300 p-4 rounded-none shadow-sm print:hidden">
        <div className="flex items-center gap-4 flex-1">
          <label className="text-[11px] font-black uppercase text-slate-500 min-w-[60px]">Search:</label>
          <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="h-8 w-full max-w-sm border border-slate-300 px-3 text-[11px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase tracking-widest" placeholder="FILTER NODES..." />
        </div>
        <div className="flex items-center gap-6 border-l border-slate-200 pl-6">
          <div className="flex items-center gap-3"><label className="text-[10px] font-black uppercase text-slate-400">From:</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 border border-slate-300 px-2 text-[10px] font-black outline-none" /></div>
          <div className="flex items-center gap-3"><label className="text-[10px] font-black uppercase text-slate-400">To:</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 border border-slate-300 px-2 text-[10px] font-black outline-none" /></div>
        </div>
      </div>
      <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 overflow-x-auto print:hidden">{TABS.map(t => (<button key={t} onClick={() => setActiveTab(t)} className={cn("px-6 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-r border-slate-300 transition-all", activeTab === t ? "bg-white text-[#0056d2] -mb-px" : "text-slate-500 hover:text-slate-700")}>{t} ({tabCounts[t] || 0})</button>))}</div>
      <div className="flex-1 flex flex-col overflow-hidden bg-white border border-slate-300"><div className="flex-1 overflow-auto"><table className="w-full text-left border-collapse min-w-[1000px]"><thead><tr className="bg-[#f0f0f0] text-[9px] font-black uppercase sticky top-0 border-b border-slate-300 z-10 print:hidden">{activeTab === 'Open Orders' ? ['Plant', 'Sale Order', 'Consignor', 'Consignee', 'Ship to Party', 'Route', 'Order Qty', 'Assign Qty', 'Balance Qty', 'Action'].map(h => <th key={h} className="p-3 border-r border-slate-200">{h}</th>) : ['Plant', 'Trip ID', 'Sale Order', 'Consignee', 'Ship to Party', 'Route', 'Vehicle No', 'Assign Qty', 'CN Number', 'Action'].map(h => <th key={h} className="p-3 border-r border-slate-200">{h}</th>)}</tr></thead>
            <tbody>{paginatedData.map((item: any) => {
                  if (activeTab === 'Open Orders') {
                    const o = item; 
                    const isDelayed = (new Date().getTime() - new Date(o.createdAt).getTime()) > 24 * 60 * 60 * 1000;
                    return (<tr key={o.id} className="border-b border-slate-100 hover:bg-[#e8f0fe] cursor-pointer text-[11px] font-bold"><td className="p-3">{o.plantCode}</td><td className="p-3 text-[#0056d2] font-black">{o.saleOrder}</td><td className="p-3 uppercase">{o.consignor}</td><td className="p-3 uppercase">{o.consignee}</td><td className="p-3 uppercase">{o.shipToParty}</td><td className="p-3 uppercase">{o.route}</td><td className="p-3 font-black">{o.tot} {o.uom}</td><td className="p-3 text-emerald-600">{o.ass} {o.uom}</td><td className="p-3 text-red-600 font-black">{o.bal} {o.uom}</td><td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button onClick={() => handleAssign(o)} size="sm" className="bg-[#0056d2] text-white font-black text-[9px] h-7 rounded-none uppercase">Assign</Button>
                          {isDelayed && (
                            <Button onClick={() => handleDelayRemark(o)} size="sm" className="bg-[#facc15] text-[#1e3a8a] hover:bg-[#eab308] font-black text-[9px] h-7 rounded-none uppercase">Delay Remark</Button>
                          )}
                        </div>
                    </td></tr>);
                  } else {
                    const t = item; const gpsVehicle = gpsData.find(v => v.vehicleNumber === t.vehicleNumber);
                    return (<tr key={t.id} className="border-b border-slate-100 hover:bg-[#e8f0fe] cursor-pointer text-[11px] font-bold"><td className="p-3">{t.plantCode}</td><td className="p-3 text-[#0056d2] font-black">{t.tripId}</td><td className="p-3 uppercase">{t.saleOrderNumber}</td><td className="p-3 uppercase">{t.consignee}</td><td className="p-3 uppercase">{t.shipToParty}</td><td className="p-3 uppercase">{t.route}</td><td className="p-3 uppercase">{t.vehicleNumber}</td><td className="p-3 text-emerald-600 font-black">{t.assignWeight} MT</td><td className="p-3"><div className="flex items-center gap-2">{t.cnNo ? (<button onClick={() => handleCnPreviewClick(t)} className="font-black text-[#0056d2] uppercase">{t.cnNo}</button>) : ""}<button onClick={() => handleAddCn(t)} className="p-1 text-slate-400 hover:text-blue-600"><Plus className="h-3 w-3" /></button></div></td>
                        <td className="p-3"><div className="flex items-center gap-2">
                              {activeTab === 'Loading' && (<><Button onClick={() => handleOutVehicle(t)} size="sm" className="text-[9px] bg-emerald-600 text-white font-black h-7 rounded-none uppercase">Out</Button><Button onClick={() => handleAssignmentClick(t)} size="sm" className="text-[9px] bg-yellow-400 text-black font-black h-7 rounded-none uppercase">Assign</Button></>)}
                              {activeTab === 'In-Transit' && (<><Button onClick={() => handleArrivedAction(t)} size="sm" className="text-[9px] bg-[#0056d2] text-white font-black h-7 rounded-none uppercase">Arrived</Button>{gpsVehicle && <VehicleLocation lat={gpsVehicle.latitude} lng={gpsVehicle.longitude} locationName={gpsVehicle.location} onClick={() => handleOpenMapPage(t, gpsVehicle)} />}</>)}
                              {activeTab === 'Arrived' && (<><Button onClick={() => handleUnloadAction(t)} size="sm" className="text-[9px] bg-emerald-600 text-white font-black h-7 rounded-none uppercase">Unload</Button><Button onClick={() => handleRejectAction(t)} size="sm" className="text-[9px] bg-red-600 text-white font-black h-7 rounded-none uppercase">Reject</Button></>)}
                              {activeTab === 'POD Verify' && (<Button onClick={() => handlePodUploadAction(t)} size="sm" className="text-[9px] bg-[#0056d2] text-white font-black h-7 rounded-none uppercase">POD</Button>)}
                              {activeTab === 'Closed' && (<Button onClick={() => handleViewAction(t)} size="sm" className="text-[9px] bg-[#0056d2] text-white font-black h-7 rounded-none uppercase">View</Button>)}
                            </div></td></tr>);
                  }
                })}</tbody></table></div>
        <div className="p-3 bg-[#f8fafc] border-t border-slate-300 flex items-center justify-between print:hidden">
          <div className="text-[9px] font-black text-slate-500 uppercase">Records: {filteredData.length} Registry Items</div>
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-7 px-3 text-[9px] font-black uppercase rounded-none border-slate-300">Previous</Button>
            <div className="h-7 px-4 flex items-center text-[9px] font-black text-[#1e3a8a] bg-blue-50 border border-blue-100 rounded-none">PAGE {currentPage} / {totalPages || 1}</div>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p + 1)} className="h-7 px-3 text-[9px] font-black uppercase rounded-none border-slate-300">Next</Button></div></div></div>
    </div>
    
    <Dialog open={isPopupOpen} onOpenChange={setIsPopupOpen}>
      <DialogContent className="max-w-[1200px] max-h-[90vh] bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden flex flex-col">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4 shrink-0">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Truck className="h-4 w-4" /> TR21 – Assign Vehicle</DialogTitle>
        </DialogHeader>
        <div className="p-10 space-y-10 overflow-y-auto green-scrollbar flex-1">
          <SectionGrouping title="POPUP HEADER">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12 mb-4">
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plant Hub</span><span className="text-[12px] font-black text-[#1e3a8a]">{selectedOrder?.plantCode}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sale Order</span><span className="text-[12px] font-black text-[#1e3a8a]">{selectedOrder?.saleOrder}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Consignee Node</span><span className="text-[12px] font-black uppercase truncate">{selectedOrder?.consignee}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ship to Party</span><span className="text-[12px] font-black uppercase truncate">{selectedOrder?.shipToParty}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route Node</span><span className="text-[12px] font-black uppercase truncate">{selectedOrder?.route}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Balance Qty</span><span className="text-[12px] font-black text-red-600">{selectedOrder?.bal} {selectedOrder?.uom}</span></div>
             </div>
          </SectionGrouping>
          <SectionGrouping title="CENTRE SECTION">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <FormInput label="VEHICLE NO" value={assignData.vehicleNumber} onChange={(v: string) => setAssignData({...assignData, vehicleNumber: v.toUpperCase()})} placeholder="HR 38 X 1234" />
                <FormInput label="DRIVER MOBILE" value={assignData.driverMobile} onChange={(v: string) => setAssignData({...assignData, driverMobile: v})} placeholder="10 DIGIT MOBILE" />
                <FormSelect label="FLEET TYPE" value={assignData.fleetType} options={["Own Vehicle", "Contract Vehicle", "Market Vehicle", "Arrange by Party"]} onChange={(v: string) => setAssignData({...assignData, fleetType: v})} />
                <FormInput label="ASSIGN QTY (MT)" type="number" value={assignData.assignWeight} onChange={(v: string) => {
                  const w = parseFloat(v) || 0;
                  const r = parseFloat(assignData.rate) || 0;
                  setAssignData({
                    ...assignData, 
                    assignWeight: v,
                    freightAmount: !assignData.isFixedRate ? (w * r).toFixed(2) : assignData.freightAmount
                  });
                }} />
                <FormInput label="ASSIGN DATE TIME" type="datetime-local" value={assignData.assignDate} onChange={(v: string) => setAssignData({...assignData, assignDate: v})} />
             </div>

             {assignData.fleetType === 'Market Vehicle' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 pt-4 border-t border-slate-200 mt-4 animate-fade-in">
                  <FormSelect 
                    label="VENDOR NAME" 
                    value={assignData.vendorName} 
                    options={vendors.map((v: any) => ({ value: v.vendorName, label: v.vendorName }))} 
                    onChange={(v: string) => {
                      const match = vendors.find((vend: any) => vend.vendorName === v);
                      setAssignData({
                        ...assignData, 
                        vendorName: v, 
                        vendorCode: match?.vendorCode || '', 
                        vendorFirmName: match?.vendorFirmName || '', 
                        vendorMobile: match?.mobile || ''
                      });
                    }} 
                  />
                  <FormInput label="VENDOR FIRM" value={assignData.vendorFirmName} disabled={true} />
                  <FormInput label="MOBILE" value={assignData.vendorMobile} disabled={true} />
                  <FormInput label="ARRANGE BY" value={assignData.arrangeBy} onChange={(v: string) => setAssignData({...assignData, arrangeBy: v})} placeholder="MANUAL ENTRY" />
                  <FormInput label="RATE" type="number" value={assignData.rate} onChange={(v: string) => {
                    const r = parseFloat(v) || 0; 
                    const w = parseFloat(assignData.assignWeight) || 0;
                    setAssignData({
                      ...assignData, 
                      rate: v, 
                      freightAmount: !assignData.isFixedRate ? (r * w).toFixed(2) : assignData.freightAmount
                    });
                  }} />
                  <div className="flex items-center gap-8 pl-[180px]">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={assignData.isFixedRate} 
                        onCheckedChange={(c) => setAssignData({...assignData, isFixedRate: !!c})} 
                        id="assign-fix-rate" 
                      />
                      <label htmlFor="assign-fix-rate" className="text-[10px] font-black uppercase cursor-pointer text-slate-500">Fix Rate Mode</label>
                    </div>
                  </div>
                  <FormInput 
                    label="FREIGHT AMOUNT" 
                    type="number" 
                    value={assignData.freightAmount} 
                    disabled={!assignData.isFixedRate} 
                    onChange={(v: string) => setAssignData({...assignData, freightAmount: v})} 
                  />
                </div>
             )}
          </SectionGrouping>
        </div>
        <div className="p-6 bg-white border-t border-slate-300 flex justify-end gap-3 shrink-0">
          <Button onClick={() => setIsPopupOpen(false)} variant="outline" className="h-10 px-8 rounded-none text-[10px] font-black uppercase border-slate-400">Exit</Button>
          <Button onClick={handleCreateTrip} className="h-10 px-12 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-lg">Post Assignment</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isAssignmentPopupOpen} onOpenChange={setIsAssignmentPopupOpen}>
      <DialogContent className="max-w-md bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden">
        <DialogHeader className="bg-[#1e3a8a] px-6 py-4">
          <DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Edit3 className="h-4 w-4" /> Assignment Management</DialogTitle>
        </DialogHeader>
        <div className="p-8 space-y-8">
          <RadioGroup value={assignmentMode || ''} onValueChange={(v: any) => setAssignmentMode(v)} className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2 bg-white p-4 border border-slate-200">
              <RadioGroupItem value="edit" id="r-edit" /><Label htmlFor="r-edit" className="text-[10px] font-black uppercase cursor-pointer">Edit Assignment</Label>
            </div>
            <div className="flex items-center space-x-2 bg-white p-4 border border-slate-200">
              <RadioGroupItem value="unassign" id="r-unassign" /><Label htmlFor="r-unassign" className="text-[10px] font-black uppercase cursor-pointer text-red-600">Unassign Trip</Label>
            </div>
          </RadioGroup>
          {assignmentMode === 'edit' && (
            <div className="space-y-4 animate-fade-in border-t border-slate-200 pt-6">
              <FormInput label="VEHICLE NO" value={assignData.vehicleNumber} onChange={(v: any) => setAssignData({...assignData, vehicleNumber: v.toUpperCase()})} />
              <FormInput label="DRIVER MOBILE" value={assignData.driverMobile} onChange={(v: any) => setAssignData({...assignData, driverMobile: v})} />
              <FormInput label="ASSIGN QTY *" type="number" value={assignData.assignWeight} onChange={(v: any) => setAssignData({...assignData, assignWeight: v})} />
              <FormInput label="RATE" type="number" value={assignData.rate} onChange={(v: any) => setAssignData({...assignData, rate: v})} />
            </div>
          )}
          {assignmentMode === 'unassign' && (
            <div className="bg-red-50 p-4 border border-red-100 text-center animate-pulse"><p className="text-[10px] font-black text-red-600 uppercase">CAUTION: This node will be permanently unassigned.</p></div>
          )}
          <div className="flex justify-end gap-3">
            <Button onClick={() => setIsAssignmentPopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase">Cancel</Button>
            <Button onClick={handleAssignmentPost} disabled={!assignmentMode} className="h-9 px-8 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Execute Sync</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isDelayRemarkPopupOpen} onOpenChange={setIsDelayRemarkPopupOpen}><DialogContent className="max-w-md bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden"><DialogHeader className="bg-[#1e3a8a] px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Clock className="h-4 w-4" /> Delay Remark Registry</DialogTitle></DialogHeader>
        <div className="p-8 space-y-6">
          <div className="bg-white p-4 border border-slate-200 rounded-none space-y-3 shadow-inner opacity-90">
             <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Sale Order</span><span className="text-[11px] font-black text-[#1e3a8a]">{selectedOrderForRemark?.saleOrder}</span></div>
             <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Booked On</span><span className="text-[10px] font-black">{selectedOrderForRemark?.createdAt && format(new Date(selectedOrderForRemark.createdAt), 'dd-MMM-yy HH:mm')}</span></div>
             <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Ship to Party</span><span className="text-[10px] font-black uppercase truncate max-w-[200px]">{selectedOrderForRemark?.shipToParty}</span></div>
             <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Route</span><span className="text-[10px] font-black uppercase truncate max-w-[200px]">{selectedOrderForRemark?.route}</span></div>
             <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Balance Qty</span><span className="text-[10px] font-black text-red-600">{selectedOrderForRemark?.bal} {selectedOrderForRemark?.weightUom}</span></div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Delay Remark *</label>
            <textarea value={delayRemarkInput} onChange={e => setDelayRemarkInput(e.target.value)} className="w-full h-24 border border-slate-400 bg-white p-3 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase resize-none" placeholder="ENTER DELAY REASON..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => setIsDelayRemarkPopupOpen(false)} variant="outline" className="h-9 px-6 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 rounded-none text-[10px] font-black uppercase">Cancel</Button>
            <Button onClick={handlePostDelayRemark} className="h-9 px-10 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Post Sync</Button>
          </div>
        </div></DialogContent></Dialog>

    <Dialog open={isTrackModePopupOpen} onOpenChange={setIsTrackModePopupOpen}><DialogContent className="max-w-md bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden"><DialogHeader className="bg-[#1e3a8a] px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Radar className="h-4 w-4" /> Mode Registry</DialogTitle></DialogHeader>
        <div className="p-8 space-y-8"><div className="flex items-center gap-6"><label className="text-[12px] font-bold text-slate-600 w-[120px] text-right uppercase">Track Mode:</label><select value={trackModeData.mode} onChange={e => setTrackModeData({ mode: e.target.value })} className="h-9 w-[220px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase"><option value="GPS Tracking">GPS Tracking</option><option value="SIM Tracking">SIM Tracking</option></select></div><div className="flex justify-end gap-3"><Button onClick={() => setIsTrackModePopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handleTrackModePost} className="h-9 px-8 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Post Sync</Button></div></div></DialogContent></Dialog>

    <Dialog open={isArrivedPopupOpen} onOpenChange={setIsArrivedPopupOpen}><DialogContent className="max-w-md bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden"><DialogHeader className="bg-[#1e3a8a] px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><MapPin className="h-4 w-4" /> Arrival Node</DialogTitle></DialogHeader>
        <div className="p-8 space-y-6"><SectionGrouping title="DATE TIME"><FormInput label="ARRIVED DATE" type="date" value={arrivedData.date} onChange={(v: string) => setArrivedData({...arrivedData, date: v})} /><FormInput label="ARRIVED TIME" type="time" value={arrivedData.time} onChange={(v: string) => setArrivedData({...arrivedData, time: v})} /></SectionGrouping><div className="flex justify-end gap-3"><Button onClick={() => setIsArrivedPopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handleArrivedPost} className="h-9 px-8 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Execute</Button></div></div></DialogContent></Dialog>

    <Dialog open={isRejectPopupOpen} onOpenChange={setIsRejectPopupOpen}><DialogContent className="max-w-md bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden"><DialogHeader className="bg-red-600 px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><XCircle className="h-4 w-4" /> Reject Registry</DialogTitle></DialogHeader>
        <div className="p-8 space-y-6"><SectionGrouping title="REJECTION DATA"><FormInput label="DATE" type="date" value={rejectData.date} onChange={(v: string) => setRejectData({...rejectData, date: v})} /><FormInput label="TIME" type="time" value={rejectData.time} onChange={(v: string) => setRejectData({...rejectData, time: v})} /><div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-[180px] text-right uppercase shrink-0">REMARK:</label><textarea value={rejectData.remark} onChange={e => setRejectData({...rejectData, remark: e.target.value})} className="h-20 w-[320px] border border-slate-400 bg-white px-2 py-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-red-500 uppercase resize-none" placeholder="REASON..." /></div></SectionGrouping><div className="flex justify-end gap-3"><Button onClick={() => setIsRejectPopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handleRejectPost} className="h-9 px-8 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Post Node</Button></div></div></DialogContent></Dialog>

    <Dialog open={isUnloadPopupOpen} onOpenChange={setIsUnloadPopupOpen}><DialogContent className="max-w-md bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden"><DialogHeader className="bg-emerald-600 px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><Package className="h-4 w-4" /> Unload Node</DialogTitle></DialogHeader>
        <div className="p-8 space-y-6"><SectionGrouping title="TIMESTAMP"><FormInput label="UNLOAD DATE" type="date" value={unloadData.date} onChange={(v: string) => setUnloadData({...unloadData, date: v})} /><FormInput label="UNLOAD TIME" type="time" value={unloadData.time} onChange={(v: string) => setUnloadData({...unloadData, time: v})} /></SectionGrouping><div className="flex justify-end gap-3"><Button onClick={() => setIsUnloadPopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handleUnloadPost} className="h-9 px-8 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Post Unload</Button></div></div></DialogContent></Dialog>

    <Dialog open={isPodPopupOpen} onOpenChange={setIsPodPopupOpen}><DialogContent className="max-w-md bg-[#f2f2f2] p-0 rounded-none border-none shadow-2xl overflow-hidden"><DialogHeader className="bg-[#1e3a8a] px-6 py-4"><DialogTitle className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-3"><UploadCloud className="h-4 w-4" /> Upload POD</DialogTitle></DialogHeader>
        <div className="p-8 space-y-6 flex flex-col items-center justify-center"><input type="file" accept="image/*,.pdf" ref={fileInputRef} onChange={handlePodFileChange} className="hidden" />
          <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-blue-50 transition-all">
            {podFile ? <div className="text-emerald-600 font-black text-xs uppercase">Document Ready</div> : <><UploadCloud className="h-8 w-8 text-[#1e3a8a]" /><span className="text-[10px] font-black uppercase">Select Registry File</span></>}
          </div><div className="flex justify-end gap-3 w-full"><Button onClick={() => setIsPodPopupOpen(false)} variant="outline" className="h-9 px-6 rounded-none text-[10px] font-black uppercase">Cancel</Button><Button onClick={handlePodPost} disabled={!podFile} className="h-9 px-8 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Post & Close</Button></div></div></DialogContent></Dialog>
  </div>;
}

function Tr21TrackingPage({ node, onBack, customers, settings }: any) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [distance, setDistance] = React.useState<string>('Syncing...');

  React.useEffect(() => {
    if (!window.google || !node) return;
    const { trip, gps } = node;
    const geocoder = new window.google.maps.Geocoder();
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#1e3a8a', strokeWeight: 5 }
    });

    const consMaster = customers?.find((c: any) => c.customerName?.toUpperCase() === trip.consignor?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === trip.consignor?.toUpperCase());
    const shipMaster = customers?.find((c: any) => c.customerName?.toUpperCase() === trip.shipToParty?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === trip.shipToParty?.toUpperCase());

    const p1 = new Promise(r => { if (consMaster?.postalCode) geocoder.geocode({ address: consMaster.postalCode }, (res: any) => r(res?.[0]?.geometry?.location)); else r(null); });
    const p2 = new Promise(r => { if (shipMaster?.postalCode) geocoder.geocode({ address: shipMaster.postalCode }, (res: any) => r(res?.[0]?.geometry?.location)); else r(null); });

    Promise.all([p1, p2]).then(([origin, dest]: any) => {
      if (!mapRef.current) return;
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: gps.latitude, lng: gps.longitude },
        zoom: 12,
      });
      directionsRenderer.setMap(map);

      if (origin) {
        new window.google.maps.Marker({
          position: origin,
          map,
          label: { text: 'Start Point', className: 'bg-white px-2 py-1 border border-black text-[9px] font-black uppercase rounded shadow-md mb-10' },
          icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        });
      }

      if (dest) {
        new window.google.maps.Marker({
          position: dest,
          map,
          label: { text: 'Drop Point', className: 'bg-white px-2 py-1 border border-black text-[9px] font-black uppercase rounded shadow-md mb-10' },
          icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        });
      }

      const vIcon = gps.speed > 0 ? settings?.activeIcon : settings?.stopIcon;
      new window.google.maps.Marker({
        position: { lat: gps.latitude, lng: gps.longitude },
        map,
        icon: { url: vIcon || 'https://maps.google.com/mapfiles/ms/icons/truck.png', scaledSize: new window.google.maps.Size(40, 40) }
      });

      if (origin && dest) {
        directionsService.route({
          origin,
          destination: dest,
          travelMode: window.google.maps.TravelMode.DRIVING,
        }, (result, status) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(result);
            setDistance(result.routes[0].legs[0].distance?.text || 'N/A');
          }
        });
      }
    });
  }, [node, customers, settings]);

  return (
    <div className="flex flex-col h-full bg-white border-none overflow-hidden">
      <div className="bg-[#1e3a8a] text-white px-8 py-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-12">
           <button onClick={onBack} className="hover:bg-white/10 p-2 -ml-2 transition-colors">
             <ArrowLeft className="h-6 w-6" />
           </button>
           <div className="flex flex-col gap-1">
             <span className="text-[10px] font-black uppercase text-blue-200 tracking-widest opacity-70">Ship to Party</span>
             <span className="text-[13px] font-black uppercase leading-none">{node.trip.shipToParty}</span>
           </div>
           <div className="h-10 w-px bg-white/20" />
           <div className="flex flex-col gap-1">
             <span className="text-[10px] font-black uppercase text-blue-200 tracking-widest opacity-70">Vehicle Number</span>
             <span className="text-[13px] font-black uppercase leading-none">{node.trip.vehicleNumber}</span>
           </div>
           <div className="h-10 w-px bg-white/20" />
           <div className="flex flex-col gap-1">
             <span className="text-[10px] font-black uppercase text-blue-200 tracking-widest opacity-70">Route</span>
             <span className="text-[13px] font-black uppercase leading-none">{node.trip.route}</span>
           </div>
        </div>
        <div className="text-right flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase text-blue-200 tracking-widest opacity-70">Live Distance</span>
          <span className="text-2xl font-black italic text-[#ffff00] tracking-tighter drop-shadow-sm">{distance}</span>
        </div>
      </div>
      <div ref={mapRef} className="flex-1 bg-slate-100" />
      <div className="px-8 py-3 bg-white border-t border-slate-200 flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest">
         <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
           <span>Live GPS Synchronization Active</span>
         </div>
      </div>
    </div>
  );
}

function GpsTrackingHub({ trips, onStatusUpdate, db, settings, settingsRef }: any) {
  const [activeTab, setActiveTab] = React.useState('Tracking MAP'); const [vehicles, setVehicles] = React.useState<any[]>([]); const [loading, setLoading] = React.useState(true); const [map, setMap] = React.useState<any>(null); const markersRef = React.useRef<any[]>([]); const infoWindowRef = React.useRef<any>(null);

  const fetchGpsData = React.useCallback(async () => {
    const internalApiUrl = '/api/gps'; const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 15000);
    try { const response = await fetch(internalApiUrl, { method: "GET", headers: { "Content-Type": "application/json" }, signal: controller.signal }); clearTimeout(timeoutId); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); const json = await response.json(); if (json?.data?.list) setVehicles(json.data.list); setLoading(false); } catch (error: any) { clearTimeout(timeoutId); console.error("GPS API handshake failure:", error.message); setLoading(false); }
  }, []);

  React.useEffect(() => { fetchGpsData(); const interval = setInterval(fetchGpsData, 30000); return () => clearInterval(interval); }, [fetchGpsData]);

  const showVehicleInfo = React.useCallback((v: any, marker?: any) => {
    if (!window.google || !map) return; if (!infoWindowRef.current) infoWindowRef.current = new window.google.maps.InfoWindow();
    const geocoder = new window.google.maps.Geocoder(); const latlng = { lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) };
    geocoder.geocode({ location: latlng }, (results: any, status: any) => { if (status === 'OK' && results[0]) {
        const comps = results[0].address_components; let street = '', city = '';
        for (const c of comps) { if (c.types.includes('route')) street = c.long_name; if (c.types.includes('locality')) city = c.long_name; }
        const locStr = [street, city].filter(Boolean).join(', ') || results[0].formatted_address;
        const content = `<div style="font-family: monospace; font-size: 11px; font-weight: bold; padding: 10px; min-width: 180px;"><div style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; margin-bottom: 8px; padding-bottom: 4px; font-size: 13px; letter-spacing: -0.5px;">${v.vehicleNumber}</div><div style="color: #64748b; font-size: 9px; margin-bottom: 2px; text-transform: uppercase;">Live Node Location:</div><div style="color: #0f172a; line-height: 1.4;">${locStr}</div><div style="margin-top: 8px; color: #1e3a8a; font-size: 9px; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 4px;"><span>SPEED: ${v.speed} KM/H</span><span>${v.createdDateReadable}</span></div></div>`;
        infoWindowRef.current.setContent(content); if (marker) infoWindowRef.current.open(map, marker); else { infoWindowRef.current.setPosition(latlng); infoWindowRef.current.open(map); }
        map.panTo(latlng); if (map.getZoom() < 14) map.setZoom(15);
      }
    });
  }, [map]);

  React.useEffect(() => { if (activeTab === 'Tracking MAP') { const scriptId = 'google-maps-script'; if (!document.getElementById(scriptId)) { const script = document.createElement('script'); script.id = scriptId; script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBDWcih2hNy8F3S0KR1A5dtv1I7HQfodiU&libraries=places`; script.async = true; script.defer = true; document.head.appendChild(script); } } }, [activeTab]);
  React.useEffect(() => {
    if (!map || !vehicles.length || !window.google) return; markersRef.current.forEach(m => m.setMap(null)); markersRef.current = [];
    const newMarkers: any[] = [];
    vehicles.forEach((v: any) => {
      const pos = { lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) }; const isActive = v.speed > 0;
      const iconUrl = isActive ? (settings?.activeIcon || 'https://maps.google.com/mapfiles/ms/icons/truck.png') : (settings?.stopIcon || 'https://maps.google.com/mapfiles/ms/icons/truck.png');
      const marker = new window.google.maps.Marker({ position: pos, map: map, title: v.vehicleNumber, icon: { url: iconUrl, scaledSize: new window.google.maps.Size(40, 40) } });
      marker.addListener('click', () => showVehicleInfo(v, marker)); newMarkers.push(marker);
    });
    markersRef.current = newMarkers;
  }, [map, vehicles, settings, showVehicleInfo]);

  const handleIconUpload = async (e: any, type: 'activeIcon' | 'stopIcon') => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { const dataUrl = ev.target?.result as string; setDocumentNonBlocking(settingsRef, { [type]: dataUrl }, { merge: true }); onStatusUpdate({ text: `${type === 'activeIcon' ? 'Active' : 'Stop'} icon synchronized`, type: 'success' }); }; reader.readAsDataURL(file); };

  return <div className="flex flex-col h-full space-y-0">
    <div className="bg-white border-b border-slate-300 px-8 py-3 mb-4 flex items-center justify-between">
       <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">GPS TRACKING HUB</h2>
       <div className="flex border-b border-slate-300 bg-[#dae4f1]/30 overflow-x-auto no-scrollbar">{['Tracking MAP', 'Setting'].map(t => (<button key={t} onClick={() => setActiveTab(t)} className={cn("px-6 py-2 text-[9px] font-black uppercase tracking-widest whitespace-nowrap", activeTab === t ? "bg-white text-[#0056d2] -mb-px" : "text-slate-500 hover:text-slate-700")}>{t}</button>))}</div>
    </div>
    <div className="flex-1 bg-white border border-slate-300 overflow-hidden flex flex-col md:flex-row mx-8 mb-12 shadow-sm">{activeTab === 'Tracking MAP' ? (<><div className="w-full md:w-80 border-r border-slate-200 flex flex-col h-full overflow-hidden"><div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Vehicle Registry</span><Badge variant="outline" className="text-[8px]">{vehicles.length} Units</Badge></div><div className="flex-1 overflow-y-auto green-scrollbar h-[350px]">{loading ? (<div className="p-10 flex flex-col items-center gap-2"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /><span className="text-[8px] font-black uppercase text-slate-400">Loading GPS Nodes...</span></div>) : vehicles.map((v: any) => (<div key={v.vehicleNumber} onClick={() => showVehicleInfo(v)} className="p-4 border-b border-slate-50 hover:bg-blue-50 cursor-pointer transition-colors group flex flex-col gap-1 min-h-[70px]"><div className="flex justify-between items-start"><span className="text-[11px] font-black text-[#1e3a8a]">{v.vehicleNumber}</span><span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded", v.speed > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{v.speed > 0 ? `${v.speed} KM/H` : 'STOPPED'}</span></div><p className="text-[9px] text-slate-400 font-bold uppercase truncate">{v.createdDateReadable || 'SYNCING...'}</p></div>))}</div></div><div className="flex-1 relative bg-slate-100"><div id="google-map" ref={(el) => { if (el && !map && window.google) { const newMap = new window.google.maps.Map(el, { center: { lat: 28.6139, lng: 77.2090 }, zoom: 5, disableDefaultUI: false }); setMap(newMap); } }} className="w-full h-full" /></div></>) : (<div className="p-8 space-y-10 max-w-2xl mx-auto w-full overflow-y-auto"><div className="space-y-6"><h3 className="text-sm font-black text-[#1e3a8a] uppercase tracking-tighter border-b border-slate-100 pb-2">GPS ICON SYNCHRONIZATION</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-3 p-6 border border-slate-200 bg-white shadow-sm rounded-sm"><label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Active Vehicle Icon</label><div className="flex flex-col items-center gap-4 border-2 border-dashed border-slate-100 p-4">{settings?.activeIcon ? (<div className="relative w-12 h-12 border border-slate-200 p-1"><Image src={settings.activeIcon} alt="Active" fill className="object-contain" unoptimized /></div>) : <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded"><Truck className="h-6 w-6 text-slate-200" /></div>}<input type="file" accept="image/*" onChange={(e) => handleIconUpload(e, 'activeIcon')} className="hidden" id="up-active-icon" /><Button asChild size="sm" variant="outline" className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-300"><label htmlFor="up-active-icon" className="cursor-pointer">Upload New Node</label></Button></div></div><div className="space-y-3 p-6 border border-slate-200 bg-white shadow-sm rounded-sm"><label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> Stopped Vehicle Icon</label><div className="flex flex-col items-center gap-4 border-2 border-dashed border-slate-100 p-4">{settings?.stopIcon ? (<div className="relative w-12 h-12 border border-slate-200 p-1"><Image src={settings.stopIcon} alt="Stop" fill className="object-contain" unoptimized /></div>) : <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded"><Truck className="h-6 w-6 text-slate-200" /></div>}<input type="file" accept="image/*" onChange={(e) => handleIconUpload(e, 'stopIcon')} className="hidden" id="up-stop-icon" /><Button asChild size="sm" variant="outline" className="h-8 text-[9px] font-black uppercase tracking-widest border-slate-300"><label htmlFor="up-stop-icon" className="cursor-pointer">Upload New Node</label></Button></div></div></div></div></div>)}</div></div>;
}

function TrackShipmentScreen({ trips, orders, customers }: any) {
  const [refType, setRefType] = React.useState('');
  const [refValue, setRefValue] = React.useState('');
  const [activeStep, setActiveStep] = React.useState(-1);
  const [trackingData, setTrackingData] = React.useState<any>(null);
  const [linkedTrips, setLinkedTrips] = React.useState<any[]>([]);
  const [view, setView] = React.useState<'search' | 'so_details' | 'track_view'>('search');
  const [animating, setAnimating] = React.useState(false);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [gpsData, setGpsData] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchGps = async () => { try { const res = await fetch('/api/gps'); if (res.ok) { const json = await res.json(); if (json?.data?.list) setGpsData(json.data.list); } } catch (e) {} };
    fetchGps(); const i = setInterval(fetchGps, 30000); return () => clearInterval(i);
  }, []);

  const handleTrackNow = () => {
    if (!refValue) return;
    const val = refValue.trim().toUpperCase();
    if (refType === 'Sale Order') {
      const order = orders?.find((o: any) => o.saleOrder === val || o.id === val);
      if (order) {
        setTrackingData(order);
        const tList = trips?.filter((t: any) => t.saleOrderId === order.id) || [];
        setLinkedTrips(tList);
        setView('so_details');
      } else { alert("Registry Failure: Sale Order Not Found"); }
    } else {
      const trip = trips?.find((t: any) => t.tripId === val || t.id === val);
      if (trip) {
        setTrackingData(trip);
        setLinkedTrips([trip]);
        setView('track_view');
        startAnimation(trip);
      } else { alert("Registry Failure: Trip ID Not Found"); }
    }
  };

  const startAnimation = (trip: any) => {
    let target = 0;
    if (trip.status === 'LOADING') target = 1;
    else if (trip.status === 'IN-TRANSIT') target = 2;
    else if (trip.status === 'ARRIVED') target = 3;
    else if (trip.status === 'CLOSED') target = 4;
    else if (trip.status === 'REJECTION') target = 4;

    setAnimating(true);
    let current = 0;
    setActiveStep(0);
    const interval = setInterval(() => {
      if (current < target) {
        current++;
        setActiveStep(current);
      } else {
        clearInterval(interval);
        setAnimating(false);
      }
    }, 2000);
  };

  const renderMap = () => {
    if (!window.google || !trackingData || !linkedTrips.length) return;
    const geocoder = new window.google.maps.Geocoder();
    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({ suppressMarkers: true, polylineOptions: { strokeColor: '#1e3a8a', strokeWeight: 5 } });
    
    const cons = customers?.find((c: any) => c.customerName?.toUpperCase() === trackingData.consignor?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === trackingData.consignor?.toUpperCase());
    const ship = customers?.find((c: any) => c.customerName?.toUpperCase() === trackingData.shipToParty?.toUpperCase() || (c.customerName + ' - ' + c.city)?.toUpperCase() === trackingData.shipToParty?.toUpperCase());
    
    Promise.all([
      new Promise(r => geocoder.geocode({ address: cons?.postalCode || 'India' }, (res: any) => r(res?.[0]?.geometry?.location))),
      new Promise(r => geocoder.geocode({ address: ship?.postalCode || 'India' }, (res: any) => r(res?.[0]?.geometry?.location)))
    ]).then(([origin, dest]: any) => {
      if (!mapRef.current) return;
      const map = new window.google.maps.Map(mapRef.current, { center: origin || { lat: 20, lng: 78 }, zoom: 5 });
      directionsRenderer.setMap(map);
      if (origin && dest) directionsService.route({ origin, destination: dest, travelMode: window.google.maps.TravelMode.DRIVING }, (res, stat) => { if (stat === 'OK') directionsRenderer.setDirections(res); });
      const gps = gpsData.find(v => v.vehicleNumber === trackingData.vehicleNumber);
      if (gps) new window.google.maps.Marker({ position: { lat: gps.latitude, lng: gps.longitude }, map, icon: { url: 'https://maps.google.com/mapfiles/ms/icons/truck.png', scaledSize: new window.google.maps.Size(40, 40) } });
    });
  };

  React.useEffect(() => { if (view === 'track_view' && trackingData) renderMap(); }, [view, trackingData, gpsData]);

  if (view === 'search') {
    return <div className="space-y-0 min-h-full">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10"><h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">TRACK SHIPMENT REGISTRY</h2></div>
      <div className="px-10 pb-20 space-y-12 max-w-2xl"><SectionGrouping title="SELECTION"><div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-600 w-[180px] text-right uppercase shrink-0">Ref Type:</label><select value={refType} onChange={e => setRefType(e.target.value)} className="h-9 w-[320px] border border-slate-400 bg-white px-2 text-[12px] font-black outline-none focus:ring-1 focus:ring-blue-500 uppercase"><option value="">SELECT OPTION...</option><option value="Sale Order">Sale Order</option><option value="Trip ID">Trip ID</option></select></div>
        {refType && <FormInput label={refType.toUpperCase()} value={refValue} onChange={setRefValue} placeholder={`ENTER ${refType.toUpperCase()}...`} />}
      </SectionGrouping><div className="pl-[212px] flex gap-4"><Button onClick={() => setRefValue('')} variant="outline" className="h-9 px-8 rounded-none text-[10px] font-black uppercase">Clear</Button><Button onClick={handleTrackNow} className="h-9 px-10 bg-[#0056d2] text-white rounded-none text-[10px] font-black uppercase shadow-md">Track Now</Button></div></div></div>;
  }

  if (view === 'so_details') {
    return <div className="space-y-0 min-h-full">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 flex items-center justify-between"><h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">SALE ORDER NODE</h2><Button onClick={() => setView('search')} variant="outline" className="h-8 text-[9px] font-black uppercase rounded-none border-slate-300">New Search</Button></div>
      <div className="px-10 pb-20"><SectionGrouping title="ORDER DETAILS">
          <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-400 w-[180px] text-right uppercase">Booked On:</label><span className="text-[12px] font-black uppercase">{format(new Date(trackingData.createdAt), 'dd-MMM-yyyy HH:mm')}</span></div>
          <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-400 w-[180px] text-right uppercase">Weight:</label><span className="text-[12px] font-black text-emerald-600">{trackingData.weight} {trackingData.weightUom}</span></div>
          <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-400 w-[180px] text-right uppercase">Route:</label><span className="text-[12px] font-black text-[#1e3a8a] uppercase">{trackingData.from} → {trackingData.destination}</span></div>
          <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-400 w-[180px] text-right uppercase">Consignee:</label><span className="text-[12px] font-black uppercase truncate">{trackingData.consignee}</span></div>
          <div className="flex items-center gap-8"><label className="text-[12px] font-bold text-slate-400 w-[180px] text-right uppercase">Ship To:</label><span className="text-[12px] font-black uppercase truncate">{trackingData.shipToParty}</span></div>
        </SectionGrouping>
        {linkedTrips && linkedTrips.length > 0 ? (
          <div className="bg-blue-50 border-y border-blue-200 p-8 space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Linked Trip Nodes Found:</p>
            <div className="flex flex-wrap gap-4">
              {linkedTrips.map((t: any) => (
                <button 
                  key={t.id} 
                  onClick={() => { setTrackingData(t); startAnimation(t); setView('track_view'); }}
                  className="bg-white border border-[#1e3a8a] text-[#1e3a8a] px-5 py-3 text-[11px] font-black uppercase hover:bg-[#1e3a8a] hover:text-white transition-all shadow-sm flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  TRACK TRIP: {t.tripId}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 border-y border-orange-200 p-8 text-center"><p className="text-sm font-black italic uppercase text-slate-800 leading-relaxed">Pending Trip Node Synchronization...</p></div>
        )}
      </div></div>;
  }

  const steps = [
    { label: 'Order Booked', icon: ShoppingCart },
    { label: 'Loading', icon: Package },
    { label: 'IN-Transit', icon: Truck },
    { label: 'Arrived', icon: MapPin },
    { label: trackingData.status === 'REJECTION' ? 'Reject' : 'Delivered', icon: trackingData.status === 'REJECTION' ? AlertTriangle : CheckCircleIcon }
  ];

  return <div className="space-y-0 min-h-full">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 flex items-center justify-between"><h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">LIVE TRIP TRACKING</h2><Button onClick={() => setView(linkedTrips.length > 1 ? 'so_details' : 'search')} variant="outline" className="h-8 text-[9px] font-black uppercase rounded-none border-slate-300">Back</Button></div>
      <div className="px-10 pb-20 space-y-8">
        <SectionGrouping title="REGISTRY HUB">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-4 border-b border-slate-100 pb-8">
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</span><span className="text-[13px] font-black uppercase text-[#1e3a8a]">{trackingData.vehicleNumber}</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Consignee Node</span><span className="text-[13px] font-black uppercase truncate">{trackingData.consignee}</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Qty</span><span className="text-[13px] font-black text-emerald-600">{trackingData.assignWeight} MT</span></div>
              <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route Hub</span><span className="text-[13px] font-black uppercase text-blue-600 truncate">{trackingData.route}</span></div>
           </div>
           {trackingData.delayRemark && (
             <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200">
               <label className="text-[9px] font-black uppercase text-yellow-700 tracking-widest block mb-1">Delay Remark Registered:</label>
               <p className="text-[11px] font-black uppercase text-[#1e3a8a]">{trackingData.delayRemark}</p>
             </div>
           )}
        </SectionGrouping>
        <div className="p-10 relative overflow-hidden bg-white border border-slate-200 shadow-sm">
          <div className="flex justify-between relative z-10">
            {steps.map((s, i) => {
              const isCompleted = i < activeStep;
              const isActive = i === activeStep;
              const statusColor = isCompleted ? "text-emerald-600" : isActive ? "text-yellow-600" : "text-red-500";
              const iconBg = isCompleted ? "bg-emerald-50 border-emerald-200 text-emerald-600" : isActive ? "bg-yellow-50 border-yellow-300 text-yellow-600 shadow-md scale-110" : "bg-red-50 border-red-100 text-red-500";
              
              return (
                <div key={s.label} className="flex flex-col items-center gap-4 group relative">
                  <div className={cn("w-14 h-14 rounded-none border-2 flex items-center justify-center transition-all duration-500", iconBg)}>
                    <s.icon className="h-7 w-7" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", statusColor)}>{s.label}</p>
                    {i <= activeStep && <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(trackingData.createdAt), 'dd-MMM-yy HH:mm')}</p>}
                  </div>
                </div>
              );
            })}
            <div className="absolute top-[28px] left-[10%] right-[10%] h-[2px] bg-slate-100 -z-0" />
            <div className="absolute top-[-15px] z-20 transition-all duration-[2000ms] ease-in-out" style={{ left: `${(activeStep / (steps.length - 1)) * 80 + 10}%`, transform: 'translateX(-50%)' }}>
              <div className="bg-white p-3 shadow-2xl border border-blue-100 animate-bounce">
                <Truck className="h-10 w-10 text-[#1e3a8a]" />
              </div>
            </div>
          </div>
        </div>
        {trackingData.status === 'REJECTION' && <div className="bg-red-50 border border-red-200 p-4 text-center"><p className="text-[10px] font-black text-red-600 uppercase">REJECTION: {trackingData.rejectionRemark}</p></div>}
        <div className="h-[400px] border border-slate-300 shadow-inner"><div ref={mapRef} className="w-full h-full" /></div>
      </div></div>;
}

function Se38Report({ search, results, onSearchChange, allPlants, allVendors, allCompanies, allCustomers }: any) {
  const handleExport = () => {
    if (!results || results.length === 0) return;
    const headers = [
      'Plant', 'Sale Order', 'Sale Order Date Time', 'Consignor', 'Consignee', 'Ship to Party', 'Destination',
      'Trip ID', 'Trip Create Date Time', 'Vehicle Number', 'Driver Mobile', 'Carrier Name', 'CN Number',
      'Invoice Number', 'E-waybill Number', 'Product', 'Unit', 'Unit UOM', 'Assign Qty', 'Weight UOM',
      'Vendor Name', 'Vendor Firm', 'Vendor Mobile', 'Fleet Type', 'Payment Term', 'Employee', 'Rate',
      'Freight Amount', 'Vehicle Out Date Time', 'Vehicle Arrived Date Time', 'Unload Date Time',
      'Reject Date Time', 'POD Status', 'Vehicle Resent Date Time', 'SRN Number', 'SRN Date'
    ];

    const rows = results.map((t: any) => [
      t.plantCode, t.saleOrderNumber, t.saleOrderDate || '', t.consignor, t.consignee, t.shipToParty, t.destination,
      t.tripId, t.createdAt, t.vehicleNumber, t.driverMobile, t.carrierName || '', t.cnNo || '',
      t.invoiceNumber || '', t.ewaybillNumber || '', t.product || '', t.unit || '', t.unitUom || '', t.assignWeight, t.weightUom || 'MT',
      t.vendorName, t.vendorFirmName || '', t.vendorMobile || '', t.fleetType || '', t.paymentTerms || '', t.employee || '', t.rate,
      t.freightAmount, (t.outDate || '') + ' ' + (t.outTime || ''), (t.arrivedDate || '') + ' ' + (t.arrivedTime || ''), (t.unloadDate || '') + ' ' + (t.unloadTime || ''),
      (t.rejectionDate || '') + ' ' + (t.rejectionTime || ''), t.status, '', '', ''
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${search.plant}_${search.from}_${search.to}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (results) {
    return (
      <div className="flex flex-col h-full bg-white animate-fade-in">
        <div className="bg-[#f0f0f0] border-b border-slate-300 p-2 flex items-center gap-4">
          <Button onClick={handleExport} className="h-7 bg-white border border-slate-400 hover:bg-slate-50 text-[#1e3a8a] font-black text-[9px] uppercase px-4 rounded-none shadow-sm">
            <Download className="h-3 w-3 mr-2" /> Export Node
          </Button>
        </div>
        <div className="flex-1 overflow-auto green-scrollbar">
          <table className="w-full text-left border-collapse min-w-[3500px]">
            <thead className="sticky top-0 bg-[#f2f2f2] border-b-2 border-slate-300 z-20">
              <tr className="text-[9px] font-black uppercase text-slate-600">
                {[
                  'Plant', 'Sale Order', 'Sale Order Date Time', 'Consignor', 'Consignee', 'Ship to Party', 'Destination',
                  'Trip ID', 'Trip Create Date Time', 'Vehicle Number', 'Driver Mobile', 'Carrier Name', 'CN Number',
                  'Invoice Number', 'E-waybill Number', 'Product', 'Unit', 'Unit UOM', 'Assign Qty', 'Weight UOM',
                  'Vendor Name', 'Vendor Firm', 'Vendor Mobile', 'Fleet Type', 'Payment Term', 'Employee', 'Rate',
                  'Freight Amount', 'Vehicle Out Date Time', 'Vehicle Arrived Date Time', 'Unload Date Time',
                  'Reject Date Time', 'POD Status', 'Vehicle Resent Date Time', 'SRN Number', 'SRN Date'
                ].map(h => <th key={h} className="p-3 border-r border-slate-200">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {results.map((t: any) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-[#e8f0fe] text-[10px] font-bold">
                  <td className="p-3">{t.plantCode}</td>
                  <td className="p-3">{t.saleOrderNumber}</td>
                  <td className="p-3">{t.saleOrderDate || ''}</td>
                  <td className="p-3 uppercase">{t.consignor}</td>
                  <td className="p-3 uppercase">{t.consignee}</td>
                  <td className="p-3 uppercase">{t.shipToParty}</td>
                  <td className="p-3 uppercase">{t.destination}</td>
                  <td className="p-3 font-black text-blue-700">{t.tripId}</td>
                  <td className="p-3">{format(new Date(t.createdAt), 'dd-MMM-yy HH:mm')}</td>
                  <td className="p-3 uppercase">{t.vehicleNumber}</td>
                  <td className="p-3">{t.driverMobile}</td>
                  <td className="p-3 uppercase">{t.carrierName}</td>
                  <td className="p-3">{t.cnNo}</td>
                  <td className="p-3">{t.invoiceNumber}</td>
                  <td className="p-3">{t.ewaybillNumber}</td>
                  <td className="p-3 uppercase">{t.product}</td>
                  <td className="p-3">{t.unit}</td>
                  <td className="p-3 uppercase">{t.unitUom}</td>
                  <td className="p-3 text-emerald-700 font-black">{t.assignWeight}</td>
                  <td className="p-3 uppercase">{t.weightUom}</td>
                  <td className="p-3 uppercase">{t.vendorName}</td>
                  <td className="p-3 uppercase">{t.vendorFirmName}</td>
                  <td className="p-3">{t.vendorMobile}</td>
                  <td className="p-3 uppercase">{t.fleetType}</td>
                  <td className="p-3 uppercase">{t.paymentTerms}</td>
                  <td className="p-3 uppercase">{t.employee}</td>
                  <td className="p-3">{t.rate}</td>
                  <td className="p-3">{t.freightAmount}</td>
                  <td className="p-3">{t.outDate && t.outTime ? `${t.outDate} ${t.outTime}` : ''}</td>
                  <td className="p-3">{t.arrivedDate && t.arrivedTime ? `${t.arrivedDate} ${t.arrivedTime}` : ''}</td>
                  <td className="p-3">{t.unloadDate && t.unloadTime ? `${t.unloadDate} ${t.unloadTime}` : ''}</td>
                  <td className="p-3">{t.rejectionDate && t.rejectionTime ? `${t.rejectionDate} ${t.rejectionTime}` : ''}</td>
                  <td className="p-3 uppercase">{t.status}</td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0 min-h-full animate-fade-in">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10">
        <h2 className="text-[16px] font-bold text-slate-800 tracking-tight uppercase">Custom T-Code Report: Selection</h2>
      </div>
      <div className="px-10 pb-20">
        <SectionGrouping title="Selection Criteria">
          <FormSelect label="Plant *" value={search.plant} options={allPlants.map((p: any) => p.plantCode)} onChange={(v: string) => onSearchChange({ ...search, plant: v })} />
          <FormSearchInput 
            label="Vendor" 
            value={search.vendor} 
            options={allVendors.map((v: any) => `${v.vendorCode} - ${v.vendorName}`)} 
            onChange={(v: string) => {
              const code = v.includes(' - ') ? v.split(' - ')[0] : v;
              onSearchChange({ ...search, vendor: code });
            }} 
          />
          <FormSearchInput 
            label="Carrier" 
            value={search.company} 
            options={allCompanies.map((c: any) => `${c.companyCode} - ${c.companyName}`)} 
            onChange={(v: string) => {
              const code = v.includes(' - ') ? v.split(' - ')[0] : v;
              onSearchChange({ ...search, company: code });
            }} 
          />
          <FormSearchInput 
            label="Customer" 
            value={search.customer} 
            options={allCustomers.map((c: any) => `${c.customerCode} - ${c.customerName}`)} 
            onChange={(v: string) => {
              const code = v.includes(' - ') ? v.split(' - ')[0] : v;
              onSearchChange({ ...search, customer: code });
            }} 
          />
        </SectionGrouping>
        <SectionGrouping title="Date Range">
          <FormInput label="From Date *" type="date" value={search.from} onChange={(v: string) => onSearchChange({ ...search, from: v })} />
          <FormInput label="To Date *" type="date" value={search.to} onChange={(v: string) => onSearchChange({ ...search, to: v })} />
        </SectionGrouping>
      </div>
    </div>
  );
}

function ZCodeRegistry({ tcodes, onExecute }: { tcodes: any[], onExecute: (code: string) => void }) {
  return <div className="px-10 py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{tcodes.map(t => <div key={t.code} onClick={() => onExecute(t.code)} className="bg-white p-6 border border-slate-300 hover:border-blue-500 cursor-pointer transition-all flex flex-col gap-3"><Badge className="w-fit rounded-none bg-slate-100 text-slate-600 border-slate-200 uppercase text-[8px] font-black">{t.module}</Badge><h3 className="text-xs font-black text-[#1e3a8a] uppercase">{t.code}</h3><p className="text-[10px] font-bold text-slate-500 uppercase">{t.description}</p></div>)}</div>;
}

function Se38ReportComponent({ search, results, onSearchChange, allPlants, allVendors, allCompanies, allCustomers }: any) {
    return <Se38Report search={search} results={results} onSearchChange={onSearchChange} allPlants={allPlants} allVendors={allVendors} allCompanies={allCompanies} allCustomers={allCustomers} />;
}
