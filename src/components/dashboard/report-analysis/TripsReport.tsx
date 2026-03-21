
'use client';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { mockPlants as initialPlants } from '@/lib/mock-data';
import type { WithId, Trip, Shipment, SubUser, Plant, Carrier } from '@/types';
import ReportPagination from './ReportPagination';
import { ArrowUpDown, FileDown, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs, doc, getDoc, Timestamp, query, orderBy, where, limit } from "firebase/firestore";
import { cn, normalizePlantId } from '@/lib/utils';

interface ReportProps {
  fromDate?: Date;
  toDate?: Date;
  searchTerm: string;
}

type EnrichedTrip = WithId<Trip> & {
    plantName?: string;
    shipment?: WithId<Shipment>;
    lrPackageName?: string;
    carrierName?: string;
    invoiceNumbers?: string;
};

const ITEMS_PER_PAGE = 15;

const headers = [
    'plantName', 
    'shipmentId', 
    'tripId', 
    'startDate', // Time & Date
    'lrNumber', 
    'lrDate', 
    'invoiceNumbers', // Invoice No.
    'lrPackageName', 
    'carrierName', 
    'loadingPoint', 
    'consignor', 
    'billToParty', 
    'shipToParty', 
    'unloadingPoint', 
    'vehicleNumber', 
    'assignedQtyInTrip', 
    'currentStatusId', // Assigned Status
    'podReceived'
];

const headerLabels: Record<string, string> = {
    plantName: 'Plant', 
    shipmentId: 'Shipment ID', 
    tripId: 'Trip ID', 
    startDate: 'Time & Date', 
    lrNumber: 'LR No.', 
    lrDate: 'LR Date', 
    invoiceNumbers: 'Invoice No.',
    lrPackageName: 'LR Package', 
    carrierName: 'Carrier Name', 
    loadingPoint: 'FROM', 
    consignor: 'Consignor', 
    billToParty: 'Bill To Party', 
    shipToParty: 'Ship To Party', 
    unloadingPoint: 'Destination', 
    vehicleNumber: 'Vehicle Number', 
    assignedQtyInTrip: 'Assigned Qty', 
    currentStatusId: 'Assigned Status',
    podReceived: 'POD Status'
};

export default function TripsReport({ fromDate, toDate, searchTerm }: ReportProps) {
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [data, setData] = useState<EnrichedTrip[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const firestore = useFirestore();
  const { user } = useUser();

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);

  const fetchData = async () => {
    if (!firestore || !user) return;
    setLoading(true);
    setDbError(false);
    try {
        const [carrierSnap] = await Promise.all([
            getDocs(collection(firestore, "carriers"))
        ]);
        
        const activePlants = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : initialPlants;
        const plantsMap = new Map(activePlants.map(p => [normalizePlantId(p.id), p.name]));
        const carriersMap = new Map(carrierSnap.docs.map(c => [c.id, c.data().name]));

        // HIGH-FIDELITY IDENTITY HANDSHAKE
        const lastIdentity = localStorage.getItem('slmc_last_identity');
        const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
        
        let userDocSnap = null;
        const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
        const userQSnap = await getDocs(userQ);
        if (!userQSnap.empty) {
            userDocSnap = userQSnap.docs[0];
        } else {
            const uidSnap = await getDoc(doc(firestore, "users", user.uid));
            if (uidSnap.exists()) userDocSnap = uidSnap;
        }
        
        let authorizedPlantIds: string[] = [];
        const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' || userDocSnap?.data()?.username === 'sikkaind';

        if (userDocSnap) {
            const userData = userDocSnap.data() as SubUser;
            const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdmin;
            authorizedPlantIds = isRoot ? activePlants.map(p => p.id) : (userData.plantIds || []);
        } else if (isAdmin) {
            authorizedPlantIds = activePlants.map(p => p.id);
        }

        if (authorizedPlantIds.length === 0) {
            setLoading(false);
            return;
        }

        const allEnriched: EnrichedTrip[] = [];

        const fetchPromises = authorizedPlantIds.map(async (pId) => {
            const [shipSnap, lrSnap, tripSnap] = await Promise.all([
                getDocs(collection(firestore, `plants/${pId}/shipments`)),
                getDocs(collection(firestore, `plants/${pId}/lrs`)),
                getDocs(query(collection(firestore, `plants/${pId}/trips`), orderBy("startDate", "desc")))
            ]);

            const shipsMap = new Map();
            shipSnap.forEach(d => shipsMap.set(d.id, { id: d.id, ...d.data() }));

            const lrsByTripMap = new Map();
            lrSnap.forEach(d => lrsByTripMap.set(d.data().tripDocId || d.data().tripId, { id: d.id, ...d.data() }));

            tripSnap.forEach(docSnap => {
                const tripData = docSnap.data();
                const tripId = docSnap.id;
                
                const trip: any = { 
                    id: tripId, 
                    ...tripData,
                    startDate: tripData.startDate instanceof Timestamp ? tripData.startDate.toDate() : (tripData.startDate ? new Date(tripData.startDate) : new Date()),
                    lrDate: tripData.lrDate instanceof Timestamp ? tripData.lrDate.toDate() : (tripData.lrDate ? new Date(tripData.lrDate) : undefined),
                };

                const shipment = shipsMap.get(trip.shipmentIds[0]);
                const lr = lrsByTripMap.get(tripId);
                const resolvedPlantId = normalizePlantId(pId);
                
                let lrPackageName = '--';
                let invoiceNumbers = shipment?.invoiceNumber || '--';
                
                if (lr && lr.items && lr.items.length > 0) {
                    const totalUnits = lr.items.reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0);
                    const firstDesc = lr.items[0].productDescription || 'Items';
                    lrPackageName = `${totalUnits} U (${firstDesc})`;
                    invoiceNumbers = Array.from(new Set(lr.items.map((i: any) => i.invoiceNumber).filter(Boolean))).join(', ');
                }

                allEnriched.push({ 
                    ...trip, 
                    plantName: plantsMap.get(resolvedPlantId) || pId, 
                    shipment,
                    lrPackageName,
                    invoiceNumbers,
                    carrierName: carriersMap.get(trip.carrierId || '') || 'N/A'
                });
            });
        });

        await Promise.all(fetchPromises);
        setData(allEnriched.sort((a, b) => b.startDate.getTime() - a.startDate.getTime()));

    } catch (error) {
        console.error("Error fetching trips report:", error);
        setDbError(true);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [firestore, user, allMasterPlants]);

  const filteredData = useMemo(() => {
    let filtered = data;
    if (fromDate) filtered = filtered.filter(item => item.startDate >= fromDate);
    if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter(item => item.startDate <= to);
    }
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(item =>
            Object.values(item).some(val => val?.toString().toLowerCase().includes(lowerSearch)) ||
            (item.shipment && Object.values(item.shipment).some(val => val?.toString().toLowerCase().includes(lowerSearch))) ||
            item.lrPackageName?.toLowerCase().includes(lowerSearch) ||
            item.carrierName?.toLowerCase().includes(lowerSearch) ||
            item.invoiceNumbers?.toLowerCase().includes(lowerSearch)
        );
    }
    return filtered;
  }, [data, fromDate, toDate, searchTerm]);
  
  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = (a as any)[sortConfig.key] || (a.trip as any)?.[sortConfig.key] || '';
        const bVal = (b as any)[sortConfig.key] || (b.trip as any)?.[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 text-slate-400" />;
    return sortConfig.direction === 'asc' ? '🔼' : '🔽';
  };

  const handleExport = () => {
    const dataToExport = sortedData.map(item => {
        const row: {[key: string]: any} = {};
        headers.forEach(key => {
            let value;
            if(key === 'shipmentId') value = item.shipment?.shipmentId;
            else if (key === 'loadingPoint') value = item.shipment?.loadingPoint;
            else if (key === 'consignor') value = item.shipment?.consignor;
            else if (key === 'billToParty') value = item.shipment?.billToParty;
            else if (key === 'shipToParty') value = item.shipToParty;
            else if (key === 'podReceived') value = item.podReceived ? 'Received' : 'Pending';
            else value = (item as any)[key];
            
            if (key === 'startDate' || key === 'lrDate') {
                value = value ? format(new Date(value), key === 'startDate' ? 'dd-MM-yyyy HH:mm' : 'dd-MM-yyyy') : 'N/A';
            }
            row[headerLabels[key]] = value ?? 'N/A';
        });
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Trips Report");
    XLSX.writeFile(workbook, "TripsReport.xlsx");
  };

  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'border-slate-200';
    switch(status.toLowerCase()) {
        case 'assigned':
        case 'vehicle assigned': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'loading complete': return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'in-transit': return 'bg-purple-50 text-purple-700 border-purple-200';
        case 'arrival-for-delivery': return 'bg-teal-50 text-teal-700 border-teal-200';
        case 'delivered': return 'bg-green-50 text-green-700 border-green-200';
        default: return 'border-slate-200';
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-xl font-black uppercase text-blue-900 flex items-center gap-2">
                        Mission Performance Log
                        {dbError && <WifiOff className="h-4 w-4 text-orange-500" />}
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Detailed lifecycle monitoring of trip nodes</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
                    <FileDown className="h-4 w-4" /> Export Ledger
                </Button>
            </div>
        </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="h-12 hover:bg-transparent">
                {headers.map(key => (
                     <TableHead key={key} className="px-4 py-3">
                        <Button variant="ghost" onClick={() => requestSort(key)} className="h-auto p-0 font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-blue-900 transition-colors">
                            {headerLabels[key]}{getSortIcon(key)}
                        </Button>
                    </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="h-16"><TableCell colSpan={headers.length} className="px-4"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={headers.length} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No records found matching criteria.</TableCell></TableRow>
              ) : (
                paginatedData.map(item => (
                  <TableRow key={item.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group text-[11px] font-medium text-slate-600">
                    <TableCell className="px-4 font-bold text-slate-600 whitespace-nowrap">{item.plantName || 'N/A'}</TableCell>
                    <TableCell className="px-4 text-blue-700 font-black font-mono">{item.shipment?.shipmentId || '--'}</TableCell>
                    <TableCell className="px-4 font-mono text-blue-600 font-bold uppercase">{item.tripId}</TableCell>
                    <TableCell className="px-4 text-slate-500 whitespace-nowrap">{format(new Date(item.startDate), 'dd/MM/yy HH:mm')}</TableCell>
                    <TableCell className="px-4 text-slate-900 font-black">{item.lrNumber || '--'}</TableCell>
                    <TableCell className="px-4 text-slate-500 whitespace-nowrap">{item.lrDate ? format(new Date(item.lrDate), 'dd/MM/yy') : '--'}</TableCell>
                    <TableCell className="px-4 truncate max-w-[120px]" title={item.invoiceNumbers}>{item.invoiceNumbers || '--'}</TableCell>
                    <TableCell className="px-4 truncate max-w-[150px]" title={item.lrPackageName}>{item.lrPackageName || '--'}</TableCell>
                    <TableCell className="px-4 truncate max-w-[150px]" title={item.carrierName}>{item.carrierName || '--'}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px]">{item.shipment?.loadingPoint || '--'}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px] font-bold">{item.shipment?.consignor || '--'}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px] font-bold">{item.shipment?.billToParty || '--'}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px] font-bold">{item.shipToParty || '--'}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px]">{item.unloadingPoint || '--'}</TableCell>
                    <TableCell className="px-4 font-black text-slate-900 tracking-tighter uppercase">{item.vehicleNumber || 'N/A'}</TableCell>
                    <TableCell className="px-4 text-right font-black text-blue-900">{item.assignedQtyInTrip} MT</TableCell>
                    <TableCell className="px-4">
                        <Badge variant="outline" className={cn("text-[9px] h-6 font-black uppercase tracking-tighter whitespace-nowrap", getStatusBadgeColor(item.currentStatusId))}>
                            {item.currentStatusId}
                        </Badge>
                    </TableCell>
                    <TableCell className="px-4 text-center">
                        <Badge variant={item.podReceived ? "default" : "destructive"} className="text-[9px] h-6 px-2.5 uppercase font-black border-none shadow-sm">
                            {item.podReceived ? 'Received' : 'Pending'}
                        </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <ReportPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filteredData.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
      </CardContent>
    </Card>
  );
}
