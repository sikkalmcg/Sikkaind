'use client';
import { useState, useMemo, useEffect } from 'react';
import { format, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { mockPlants as initialPlants } from '@/lib/mock-data';
import type { WithId, Trip, Shipment, SubUser, Plant, Carrier, LR } from '@/types';
import ReportPagination from './ReportPagination';
import { ArrowUpDown, FileDown, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, onSnapshot, where, getDocs, limit, Timestamp } from "firebase/firestore";
import { cn, normalizePlantId, parseSafeDate } from '@/lib/utils';

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
    'startDate', 
    'lrNumber', 
    'lrDate', 
    'invoiceNumbers',
    'lrPackageName', 
    'carrierName', 
    'loadingPoint', 
    'consignor', 
    'billToParty', 
    'shipToParty', 
    'unloadingPoint', 
    'vehicleNumber', 
    'assignedQtyInTrip', 
    'currentStatusId',
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [lrs, setLrs] = useState<LR[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const firestore = useFirestore();
  const { user } = useUser();

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;
    const fetchAuth = async () => {
        try {
            const q = query(collection(firestore, "users"), where("email", "==", user.email), limit(1));
            const snap = await getDocs(q);
            let ids: string[] = [];
            const activePlants = allMasterPlants || initialPlants;
            const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (!snap.empty) {
                const userData = snap.docs[0].data() as SubUser;
                ids = (userData.username === 'sikkaind' || isAdmin) ? activePlants.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdmin) {
                ids = activePlants.map(p => p.id);
            }
            setAuthorizedPlantIds(ids);
        } catch (e) { setDbError(true); }
    };
    fetchAuth();
  }, [firestore, user, allMasterPlants]);

  useEffect(() => {
    if (!firestore || authorizedPlantIds.length === 0) return;
    setLoading(true);
    const unsubscribers: (() => void)[] = [];

    const normalizedAuthIds = authorizedPlantIds.map(normalizePlantId).map(id => id.toLowerCase());
    const isSystemAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    unsubscribers.push(onSnapshot(collection(firestore, "trips"), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data(), startDate: parseSafeDate(d.data().startDate) } as any));
        // MISSION CRITICAL: Enforce strict plant-based filtering for non-root sessions
        setTrips(list.filter(t => isSystemAdmin || normalizedAuthIds.includes(normalizePlantId(t.originPlantId).toLowerCase())));
        setLoading(false);
    }));

    unsubscribers.push(onSnapshot(collection(firestore, "carriers"), (snap) => {
        setCarriers(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }));

    authorizedPlantIds.forEach(pId => {
        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/shipments`), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as any));
            setShipments(prev => [...prev.filter(s => s.originPlantId !== pId), ...list]);
        }));
        unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/lrs`), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data(), date: parseSafeDate(d.data().date) } as any));
            setLrs(prev => [...prev.filter(l => l.originPlantId !== pId), ...list]);
        }));
    });

    return () => unsubscribers.forEach(u => u());
  }, [firestore, authorizedPlantIds, user]);

  const enrichedData = useMemo((): EnrichedTrip[] => {
    const plantsMap = new Map((allMasterPlants || initialPlants).map(p => [normalizePlantId(p.id), p.name]));
    const carriersMap = new Map(carriers.map(c => [c.id, c.name]));

    return trips.map(t => {
        const shipment = shipments.find(s => s.id === t.shipmentIds?.[0]);
        const lr = lrs.find(l => l.tripDocId === t.id || l.tripId === t.tripId || (l.lrNumber === t.lrNumber && l.originPlantId === t.originPlantId));
        
        let lrPackageName = '--';
        let invoiceNumbers = shipment?.invoiceNumber || t.invoiceNumbers || '--';
        
        const itemsManifest = lr?.items || t.items || shipment?.items || [];
        if (itemsManifest.length > 0) {
            const totalUnits = itemsManifest.reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0);
            const firstDesc = itemsManifest[0].itemDescription || itemsManifest[0].description || 'GENERAL CARGO';
            lrPackageName = `${totalUnits} U (${firstDesc})`;
            invoiceNumbers = Array.from(new Set(itemsManifest.map((i: any) => i.invoiceNumber || i.invoiceNo).filter(Boolean))).join(', ');
        }

        return {
            ...t,
            plantName: plantsMap.get(normalizePlantId(t.originPlantId)) || t.originPlantId,
            shipment,
            lrPackageName,
            invoiceNumbers: invoiceNumbers || '--',
            carrierName: carriersMap.get(t.carrierId || '') || t.carrierName || 'N/A',
            lrNumber: lr?.lrNumber || t.lrNumber || shipment?.lrNumber || '--',
            lrDate: parseSafeDate(lr?.date || t.lrDate || shipment?.lrDate),
            loadingPoint: t.loadingPoint || shipment?.loadingPoint || '--',
            consignor: t.consignor || shipment?.consignor || '--',
            billToParty: t.billToParty || shipment?.billToParty || '--',
            shipToParty: t.shipToParty || shipment?.shipToParty || '--',
            unloadingPoint: t.unloadingPoint || shipment?.unloadingPoint || t.destination || '--',
        };
    }).sort((a, b) => (b.startDate?.getTime() || 0) - (a.startDate?.getTime() || 0));
  }, [trips, shipments, lrs, carriers, allMasterPlants]);

  const filteredData = useMemo(() => {
    let filtered = enrichedData;
    if (fromDate) filtered = filtered.filter(item => item.startDate && item.startDate >= fromDate);
    if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter(item => item.startDate && item.startDate <= to);
    }
    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        filtered = filtered.filter(item =>
            Object.values(item).some(val => val?.toString().toLowerCase().includes(s)) ||
            (item.shipment && Object.values(item.shipment).some(val => val?.toString().toLowerCase().includes(s)))
        );
    }
    return filtered;
  }, [enrichedData, fromDate, toDate, searchTerm]);
  
  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = (a as any)[sortConfig.key] || '';
        const bVal = (b as any)[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleExport = () => {
    const dataToExport = sortedData.map(item => {
        const row: {[key: string]: any} = {};
        headers.forEach(key => {
            let value = (item as any)[key];
            if (key === 'shipmentId') value = item.shipment?.shipmentId;
            if (key === 'startDate' || key === 'lrDate') {
                value = value ? format(new Date(value), 'dd-MM-yyyy HH:mm') : 'N/A';
            }
            row[headerLabels[key]] = value ?? 'N/A';
        });
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Trips Report");
    XLSX.writeFile(workbook, `Trips_Audit_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <CardTitle className="text-xl font-black uppercase text-blue-900 flex items-center gap-2 italic">
                    Mission Performance Log
                    {dbError && <WifiOff className="h-4 w-4 text-orange-500" />}
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Registry audit across authorized plants</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="h-11 px-8 rounded-2xl font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-xl hover:bg-slate-50 transition-all">
                <FileDown className="h-4 w-4 mr-2" /> Export
            </Button>
        </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[2800px]">
            <TableHeader className="bg-slate-900 text-white h-14">
              <TableRow className="hover:bg-transparent border-none">
                {headers.map(key => (
                     <TableHead key={key} className="px-4 py-3">
                        <Button 
                            variant="ghost" 
                            onClick={() => {
                                let direction: 'asc' | 'desc' = 'asc';
                                if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
                                setSortConfig({ key, direction });
                            }} 
                            className="h-auto p-0 font-black text-[10px] uppercase tracking-widest text-blue-200 hover:text-white transition-colors"
                        >
                            {headerLabels[key]}
                            {sortConfig?.key === key ? (sortConfig.direction === 'asc' ? '🔼' : '🔽') : <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" />}
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
                <TableRow><TableCell colSpan={headers.length} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No records matching scope registry.</TableCell></TableRow>
              ) : (
                paginatedData.map(item => (
                  <TableRow key={item.id} className="h-16 hover:bg-blue-50/20 transition-all border-b border-slate-50 last:border-0 group text-[11px] font-medium text-slate-600">
                    <TableCell className="px-4 font-bold text-slate-600 uppercase whitespace-nowrap">{item.plantName}</TableCell>
                    <TableCell className="px-4 text-blue-700 font-black font-mono">{item.shipment?.shipmentId || '--'}</TableCell>
                    <TableCell className="px-4 font-mono text-blue-600 font-bold uppercase">{item.tripId}</TableCell>
                    <TableCell className="px-4 text-slate-500 whitespace-nowrap">{item.startDate ? format(item.startDate, 'dd/MM/yy HH:mm') : '--'}</TableCell>
                    <TableCell className="px-4 text-slate-900 font-black">{item.lrNumber || '--'}</TableCell>
                    <TableCell className="px-4 text-slate-500 whitespace-nowrap">{item.lrDate ? format(item.lrDate, 'dd/MM/yy') : '--'}</TableCell>
                    <TableCell className="px-4 truncate max-w-[120px]" title={item.invoiceNumbers}>{item.invoiceNumbers}</TableCell>
                    <TableCell className="px-4 truncate max-w-[150px]" title={item.lrPackageName}>{item.lrPackageName}</TableCell>
                    <TableCell className="px-4 truncate max-w-[150px]" title={item.carrierName}>{item.carrierName}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px]">{item.loadingPoint}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px] font-bold">{item.consignor}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px] font-bold">{item.billToParty}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px] font-bold">{item.shipToParty}</TableCell>
                    <TableCell className="px-4 truncate max-w-[100px]">{item.unloadingPoint}</TableCell>
                    <TableCell className="px-4 font-black text-slate-900 tracking-tighter uppercase">{item.vehicleNumber}</TableCell>
                    <TableCell className="px-4 text-right font-black text-blue-900">{item.assignedQtyInTrip} MT</TableCell>
                    <TableCell className="px-4">
                        <Badge variant="outline" className="text-[9px] h-6 font-black uppercase bg-blue-50 text-blue-700 border-blue-200">
                            {item.tripStatus}
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

