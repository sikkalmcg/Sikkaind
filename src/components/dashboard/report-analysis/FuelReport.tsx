'use client';
import { useState, useMemo, useEffect } from 'react';
import { format, isValid, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { mockPlants as initialPlants } from '@/lib/mock-data';
import type { WithId, FuelEntry, SubUser, Plant } from '@/types';
import ReportPagination from './ReportPagination';
import { ArrowUpDown, FileDown, WifiOff, Loader2, Edit2, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs, doc, getDoc, Timestamp, query, orderBy, where, limit, deleteDoc } from "firebase/firestore";
import { normalizePlantId } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import ViewFuelEntryModal from '../fuel-management/ViewFuelEntryModal';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ReportProps {
  fromDate?: Date;
  toDate?: Date;
  searchTerm: string;
}

const ITEMS_PER_PAGE = 10;

const headers = [
    'slipNo', 'date', 'fuelType', 'pumpName', 'vehicleType', 'vehicleNumber', 
    'previousReading', 'currentReading', 'distance', 'fuelLiters', 'fuelRate', 'average', 
    'fuelAmount', 'paidAmount', 'balanceAmount', 'userName'
];

const headerLabels: { [key: string]: string } = {
  slipNo: 'Slip No',
  date: 'Date',
  fuelType: 'Fuel Type',
  pumpName: 'Pump',
  vehicleType: 'Vehicle Type',
  vehicleNumber: 'Vehicle No',
  previousReading: 'Last Reading',
  currentReading: 'Current ODO',
  distance: 'Distance',
  fuelLiters: 'Liters',
  fuelRate: 'Rate (INR)',
  average: 'Mileage',
  fuelAmount: 'Net Amount',
  paidAmount: 'Paid Amount',
  balanceAmount: 'Balance',
  userName: 'Entry User',
};


export default function FuelReport({ fromDate, toDate, searchTerm }: ReportProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [viewingEntry, setViewingEntry] = useState<WithId<FuelEntry> | null>(null);

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
        const [pumpSnap] = await Promise.all([
            getDocs(collection(firestore, "fuel_pumps"))
        ]);
        
        const activePlants = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : initialPlants;
        const pumpsMap = new Map(pumpSnap.docs.map(d => [d.id, d.data().name]));

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

        const allFetched: any[] = [];

        const plantFetchPromises = authorizedPlantIds.map(async (pId) => {
            const q = query(collection(firestore, `plants/${pId}/fuel_entries`), orderBy("date", "desc"));
            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                const entryData = docSnap.data();
                
                allFetched.push({
                    id: docSnap.id,
                    plantId: pId,
                    ...entryData,
                    date: entryData.date instanceof Timestamp ? entryData.date.toDate() : new Date(entryData.date),
                    pumpName: pumpsMap.get(entryData.pumpId) || 'N/A',
                });
            });
        });

        await Promise.all(plantFetchPromises);
        setData(allFetched.sort((a, b) => b.date.getTime() - a.date.getTime()));
    } catch (error) {
        console.error("Error fetching fuel report:", error);
        setDbError(true);
        setData([]);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [firestore, user, allMasterPlants]);

  const isAdmin = useMemo(() => {
    return user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
  }, [user]);

  const filteredData = useMemo(() => {
    let filtered = data;
    
    if (fromDate) filtered = filtered.filter(item => item.date >= startOfDay(fromDate));
    if (toDate) filtered = filtered.filter(item => item.date <= endOfDay(toDate));

    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(item =>
            Object.values(item).some(val => val?.toString().toLowerCase().includes(lowerSearch))
        );
    }

    return filtered;
  }, [data, fromDate, toDate, searchTerm]);
  
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
          row[headerLabels[key]] = item[key] ?? 'N/A';
          if (key === 'date' && row[headerLabels[key]] !== 'N/A') {
             row[headerLabels[key]] = format(new Date(row[headerLabels[key]]), 'dd-MM-yyyy');
          }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fuel Report");
    XLSX.writeFile(workbook, "FuelReport.xlsx");
  };

  const handleDelete = async (item: any) => {
    if (!firestore || !isAdmin) return;
    try {
        await deleteDoc(doc(firestore, `plants/${item.plantId}/fuel_entries`, item.id));
        toast({ title: "Purged", description: "Entry successfully removed from registry." });
        fetchData();
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Failed", description: e.message });
    }
  }

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-3 w-3 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' ? '🔼' : '🔽';
  };

  return (
    <>
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
              <div>
                  <CardTitle className="text-xl font-black uppercase text-blue-900 flex items-center gap-2">
                      Fuel consumption Record
                      {dbError && <WifiOff className="h-4 w-4 text-orange-500" />}
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Detailed extraction from mission fuel registry</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
                  <FileDown className="h-4 w-4" /> Export Ledger
              </Button>
          </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
          <Table className="min-w-[2200px]">
            <TableHeader className="bg-slate-50">
              <TableRow className="h-12 hover:bg-transparent border-b">
                {headers.map(key => (
                     <TableHead key={key} className="px-4 py-3">
                        <Button variant="ghost" onClick={() => requestSort(key)} className="h-auto p-0 font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-blue-900 transition-colors">
                            {headerLabels[key]}
                            {getSortIcon(key)}
                        </Button>
                    </TableHead>
                ))}
                <TableHead className="text-[10px] font-black uppercase px-6 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="h-16"><TableCell colSpan={headers.length + 1} className="px-4"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={headers.length + 1} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No entries detected in registry scope.</TableCell></TableRow>
              ) : (
                paginatedData.map(item => (
                    <TableRow key={item.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b last:border-0 group">
                      <TableCell className="px-4">
                        <Button variant="link" className="p-0 h-auto font-black text-blue-700 font-mono tracking-tighter" onClick={() => setViewingEntry(item)}>
                            {item.slipNo}
                        </Button>
                      </TableCell>
                      <TableCell className="px-4 text-center text-xs font-bold text-slate-500 whitespace-nowrap">{isValid(new Date(item.date)) ? format(new Date(item.date), 'dd.MM.yy') : 'N/A'}</TableCell>
                      <TableCell className="px-4 font-bold text-slate-800 text-[11px] uppercase truncate max-w-[150px]">{item.fuelType}</TableCell>
                      <TableCell className="px-4 font-bold text-slate-800 text-[11px] uppercase truncate max-w-[150px]">{item.pumpName}</TableCell>
                      <TableCell className="px-4 text-center"><Badge variant="outline" className="text-[9px] font-black uppercase">{item.vehicleType}</Badge></TableCell>
                      <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{item.vehicleNumber}</TableCell>
                      <TableCell className="px-4 text-center font-mono font-bold text-slate-400">{item.previousReading || '--'}</TableCell>
                      <TableCell className="px-4 text-center font-mono font-black text-slate-900">{item.currentReading || '--'}</TableCell>
                      <TableCell className="px-4 text-center font-bold text-blue-600">{item.distance ? `${item.distance} KM` : '--'}</TableCell>
                      <TableCell className="px-4 text-right font-black text-slate-900">{item.fuelLiters.toFixed(2)}</TableCell>
                      <TableCell className="px-4 text-right font-bold text-slate-500">₹ {item.fuelRate.toFixed(2)}</TableCell>
                      <TableCell className="px-4 text-center font-bold text-emerald-600 font-mono">{item.average?.toFixed(2)} KM/L</TableCell>
                      <TableCell className="px-4 text-right font-black text-blue-900">₹ {Number(item.fuelAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="px-4 text-right font-bold text-emerald-700">₹ {Number(item.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="px-4 text-right font-black text-red-600">₹ {Number(item.balanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400">{item.userName || '--'}</TableCell>
                      <TableCell className="px-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Edit2 className="h-4 w-4" /></Button>
                            {isAdmin && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Revoke Entry?</AlertDialogTitle><AlertDialogDescription>This will permanently erase slip {item.slipNo} from history.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Abort</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item)} className="bg-red-600">Confirm Purge</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <ReportPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemCount={filteredData.length}
          canPreviousPage={currentPage > 1}
          canNextPage={currentPage < totalPages}
        />
      </CardContent>
    </Card>
    {viewingEntry && (
        <ViewFuelEntryModal
            isOpen={!!viewingEntry}
            onClose={() => setViewingEntry(null)}
            entry={viewingEntry}
        />
    )}
    </>
  );
}
