'use client';
import { useState, useMemo, useEffect } from 'react';
import { format, differenceInHours, startOfDay, endOfDay, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { mockPlants as initialPlants } from '@/lib/mock-data';
import type { WithId, VehicleEntryExit, Plant, SubUser, Trip } from '@/types';
import ReportPagination from './ReportPagination';
import { ArrowUpDown, FileDown, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, onSnapshot, query, Timestamp, orderBy, limit, where, getDocs } from "firebase/firestore";
import { cn, normalizePlantId, parseSafeDate } from '@/lib/utils';

interface ReportProps {
  fromDate?: Date;
  toDate?: Date;
  searchTerm: string;
}

type EnrichedVehicleMovement = WithId<VehicleEntryExit> & {
    plantName?: string;
    stayHours?: number;
};

const ITEMS_PER_PAGE = 15;

const headerLabels: { [key: string]: string } = {
  plantName: 'Plant',
  tripId: 'Trip ID',
  vehicleNumber: 'Vehicle Number',
  driverName: 'Driver Name',
  driverMobile: 'Mobile',
  licenseNumber: 'DL No',
  entryTimestamp: 'In Date Time',
  exitTimestamp: 'Out Date Time',
  purpose: 'In Purpose',
  outType: 'Out Type',
  lrNumber: 'LR Number',
  qty: 'Qty',
  stayHours: 'Stay Hour'
};

const headers = Object.keys(headerLabels);

export default function VehicleEntryReport({ fromDate, toDate, searchTerm }: ReportProps) {
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [entries, setEntries] = useState<VehicleEntryExit[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof EnrichedVehicleMovement; direction: 'asc' | 'desc' } | null>(null);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);

  const firestore = useFirestore();
  const { user } = useUser();

  const masterPlantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: allMasterPlants } = useCollection<Plant>(masterPlantsQuery);

  // 1. Authorization Handshake
  useEffect(() => {
    if (!firestore || !user) return;

    const fetchAuth = async () => {
        try {
            const searchEmail = user.email;
            if (!searchEmail) return;
            
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const snap = await getDocs(q);
            
            let authIds: string[] = [];
            const activePlants = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : initialPlants;
            const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (!snap.empty) {
                const userData = snap.docs[0].data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdmin;
                authIds = isRoot ? activePlants.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdmin) {
                authIds = activePlants.map(p => p.id);
            }
            setAuthorizedPlantIds(authIds);
        } catch (e) {
            setDbError(true);
        }
    };
    fetchAuth();
  }, [firestore, user, allMasterPlants]);

  // 2. Real-time Registry Sync
  useEffect(() => {
    if (!firestore || authorizedPlantIds.length === 0) return;

    const unsubscribers: (() => void)[] = [];
    setLoading(true);

    // Sync Gate Entries
    const unsubEntries = onSnapshot(query(collection(firestore, "vehicleEntries"), orderBy("entryTimestamp", "desc"), limit(500)), (snap) => {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        setLoading(false);
    }, () => setDbError(true));
    unsubscribers.push(unsubEntries);

    // Sync Trips for Data Join
    const unsubTrips = onSnapshot(collection(firestore, "trips"), (snap) => {
        setTrips(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    unsubscribers.push(unsubTrips);

    return () => unsubscribers.forEach(u => u());
  }, [firestore, authorizedPlantIds]);

  // 3. Logic Node: Enriched Data Mapping
  const enrichedData = useMemo(() => {
    const plantsMap = new Map((allMasterPlants || initialPlants).map(p => [normalizePlantId(p.id), p.name]));
    const normalizedAuthIds = authorizedPlantIds.map(normalizePlantId);
    const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    return entries
        .filter(entry => isAdmin || normalizedAuthIds.includes(normalizePlantId(entry.plantId)))
        .map(entry => {
            const entryIn = parseSafeDate(entry.entryTimestamp) || new Date();
            const entryOut = parseSafeDate(entry.exitTimestamp);
            
            // MISSION JOIN: Resolve LR/Qty from linked trip if missing in gate entry
            const linkedTrip = trips.find(t => t.id === entry.tripId || (t.vehicleNumber === entry.vehicleNumber && !['delivered', 'cancelled'].includes(t.currentStatusId?.toLowerCase())));
            
            const lrNumber = entry.lrNumber || linkedTrip?.lrNumber || '--';
            const qty = entry.qty || (linkedTrip?.assignedQtyInTrip ? `${linkedTrip.assignedQtyInTrip} MT` : '--');
            const tripId = entry.tripId || linkedTrip?.tripId || '--';

            let stayHours;
            if (entryOut) {
                stayHours = differenceInHours(entryOut, entryIn);
            } else {
                stayHours = differenceInHours(new Date(), entryIn);
            }

            return {
                ...entry,
                entryTimestamp: entryIn,
                exitTimestamp: entryOut,
                lrNumber,
                qty,
                tripId,
                plantName: plantsMap.get(normalizePlantId(entry.plantId)) || entry.plantId,
                stayHours
            } as EnrichedVehicleMovement;
        });
  }, [entries, trips, allMasterPlants, authorizedPlantIds, user]);

  const filteredData = useMemo(() => {
    let filtered = enrichedData;
    
    if (fromDate) filtered = filtered.filter(item => item.entryTimestamp >= startOfDay(fromDate));
    if (toDate) filtered = filtered.filter(item => item.entryTimestamp <= endOfDay(toDate));

    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        filtered = filtered.filter(item =>
            Object.values(item).some(val => val?.toString().toLowerCase().includes(s))
        );
    }

    return filtered;
  }, [enrichedData, fromDate, toDate, searchTerm]);
  
  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
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
            let value = (item as any)[key] ?? 'N/A';
             if (key.includes('Timestamp') && value instanceof Date) {
                value = format(value, 'dd-MM-yyyy HH:mm');
            }
            row[headerLabels[key]] = value;
        });
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vehicle Entry Report");
    XLSX.writeFile(workbook, `Vehicle_Entry_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const requestSort = (key: keyof EnrichedVehicleMovement) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: keyof EnrichedVehicleMovement) => {
    if (!sortConfig || sortConfig.key !== key) {
        return <ArrowUpDown className="ml-2 h-3 w-3 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' ? '🔼' : '🔽';
  }

  return (
    <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-xl font-black uppercase text-blue-900 flex items-center gap-2">
                        Gate Movement Registry
                        {dbError && <WifiOff className="h-4 w-4 text-orange-500" />}
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Complete record of arrival and departure transitions</CardDescription>
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
                        <Button 
                            variant="ghost" 
                            onClick={() => requestSort(key as keyof EnrichedVehicleMovement)}
                            className="h-auto p-0 font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-blue-900 transition-colors"
                        >
                            {headerLabels[key]}
                            {getSortIcon(key as keyof EnrichedVehicleMovement)}
                        </Button>
                    </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="h-16"><TableCell colSpan={headers.length} className="px-4 py-2"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={headers.length} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No records found matching criteria.</TableCell></TableRow>
              ) : (
                paginatedData.map(item => (
                  <TableRow key={item.id} className="hover:bg-blue-50/20 h-16 border-b border-slate-50 last:border-0 transition-all group text-[11px] font-medium text-slate-600">
                    <TableCell className="px-4 font-bold text-slate-600 uppercase whitespace-nowrap">{item.plantName || 'N/A'}</TableCell>
                    <TableCell className="px-4 font-mono text-[10px] text-blue-600 font-bold uppercase">{item.tripId || '--'}</TableCell>
                    <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{item.vehicleNumber}</TableCell>
                    <TableCell className="px-4 font-bold text-slate-700 truncate max-w-[120px]">{item.driverName || 'N/A'}</TableCell>
                    <TableCell className="px-4 font-mono font-bold text-slate-500">{item.driverMobile || 'N/A'}</TableCell>
                    <TableCell className="px-4 font-mono uppercase font-bold text-slate-400">{item.licenseNumber || 'N/A'}</TableCell>
                    <TableCell className="px-4 text-slate-500 whitespace-nowrap font-bold">{format(item.entryTimestamp, 'dd/MM/yy HH:mm')}</TableCell>
                    <TableCell className="px-4 text-blue-700 whitespace-nowrap font-black">{item.exitTimestamp ? format(item.exitTimestamp, 'dd/MM/yy HH:mm') : '--:--'}</TableCell>
                    <TableCell className="px-4">
                        <Badge variant="outline" className={cn("text-[9px] h-6 px-2 font-black uppercase border-slate-200", item.purpose === 'Loading' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700')}>
                            {item.purpose || 'N/A'}
                        </Badge>
                    </TableCell>
                    <TableCell className="px-4">
                        <Badge variant="secondary" className="text-[9px] h-6 px-2 font-black uppercase bg-slate-100 text-slate-600 border-none">
                            {item.outType || '--'}
                        </Badge>
                    </TableCell>
                    <TableCell className="px-4 font-bold text-slate-800">{item.lrNumber || '--'}</TableCell>
                    <TableCell className="px-4 text-right font-black text-blue-900 whitespace-nowrap">{item.qty || '--'}</TableCell>
                    <TableCell className="px-4 text-center">
                        <Badge className={cn("font-mono text-[10px] font-black h-6 px-3 border-none shadow-sm", item.stayHours && item.stayHours > 24 ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white')}>
                            {item.stayHours}h
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
