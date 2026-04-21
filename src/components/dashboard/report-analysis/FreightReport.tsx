'use client';
import { useState, useMemo, useEffect } from 'react';
import { format, isValid, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { mockPlants as initialPlants } from '@/lib/mock-data';
import type { WithId, Freight, Trip, Plant, Shipment, SubUser } from '@/types';
import ReportPagination from './ReportPagination';
import { ArrowUpDown, FileDown, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs, doc, getDoc, Timestamp, query, orderBy, where, limit } from "firebase/firestore";
import { Badge } from '@/components/ui/badge';
import { cn, normalizePlantId, parseSafeDate } from '@/lib/utils';

interface ReportProps {
  fromDate?: Date;
  toDate?: Date;
  searchTerm: string;
}

type EnrichedFreight = WithId<Freight> & {
    trip?: WithId<Trip>;
    plant?: WithId<Plant>;
    shipment?: WithId<Shipment>;
    addChargeAmount: number;
    plantName?: string;
    startDate?: Date;
    originPlantId?: string;
};

const ITEMS_PER_PAGE = 10;

export default function FreightReport({ fromDate, toDate, searchTerm }: ReportProps) {
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [data, setData] = useState<EnrichedFreight[]>([]);
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
        const lastIdentity = localStorage.getItem('slmc_last_identity');
        const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
        
        let userDocSnap = null;
        const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
        const userQSnap = await getDocs(userQ);
        if (!userQSnap.empty) {
            userDocSnap = userQSnap.docs[0];
        }
        
        let authorizedPlantIds: string[] = [];
        const activePlants = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : initialPlants;
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

        const allEnriched: EnrichedFreight[] = [];

        const plantFetchPromises = authorizedPlantIds.map(async (pId) => {
            const [tripSnap, shipSnap, freightSnap] = await Promise.all([
                getDocs(collection(firestore, `plants/${pId}/trips`)),
                getDocs(collection(firestore, `plants/${pId}/shipments`)),
                getDocs(query(collection(firestore, `plants/${pId}/freights`), orderBy("lastUpdated", "desc")))
            ]);

            const tripsMap = new Map(tripSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
            const shipsMap = new Map(shipSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
            const resolvedPlantId = normalizePlantId(pId);
            const plant = activePlants.find(p => normalizePlantId(p.id) === resolvedPlantId) || { id: pId, name: pId };

            freightSnap.forEach(docSnap => {
                const fData = docSnap.data();
                const trip: any = tripsMap.get(fData.tripId);
                if (!trip) return;

                // Restrict Freight Payment Ledger to Market Vehicles only
                if (trip.vehicleType !== 'Market Vehicle') return;

                const shipment = shipsMap.get(trip.shipmentIds[0]);
                const addChargeAmount = (fData.charges || []).reduce((acc: number, c: any) => acc + (c.amount || 0), 0);
                
                const startTime = parseSafeDate(trip.startDate) || new Date();

                allEnriched.push({
                    id: docSnap.id,
                    originPlantId: pId,
                    ...fData,
                    payments: (fData.payments || []).map((p: any) => ({
                        ...p,
                        paymentDate: parseSafeDate(p.paymentDate)
                    })),
                    trip: {
                        ...trip,
                        startDate: startTime
                    },
                    shipment,
                    plant: plant as any,
                    addChargeAmount,
                    plantName: (plant as any).name || resolvedPlantId,
                    startDate: startTime
                } as EnrichedFreight);
            });
        });

        await Promise.all(plantFetchPromises);
        setData(allEnriched.sort((a, b) => (b.startDate?.getTime() || 0) - (a.startDate?.getTime() || 0)));
    } catch (error) {
        console.error("Error fetching freight report:", error);
        setDbError(true);
        setData([]);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [firestore, user, allMasterPlants]);

  const filteredData = useMemo(() => {
    let filtered = data;
    
    if (fromDate) {
        filtered = filtered.filter(item => item.startDate && item.startDate >= startOfDay(fromDate));
    }
    if (toDate) {
        const to = endOfDay(toDate);
        filtered = filtered.filter(item => item.startDate && item.startDate <= to);
    }

    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(item =>
            Object.values(item).some(val => val?.toString().toLowerCase().includes(lowerSearch)) ||
            (item.trip && Object.values(item.trip).some(val => val?.toString().toLowerCase().includes(lowerSearch))) ||
            (item.shipment && Object.values(item.shipment).some(val => val?.toString().toLowerCase().includes(lowerSearch)))
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

  const headers = ['plantName', 'tripId', 'lrNumber', 'startDate', 'vehicleNumber', 'transporterName', 'loadingPoint', 'shipToParty', 'unloadingPoint', 'assignedQtyInTrip', 'freightRate', 'baseFreightAmount', 'addChargeAmount', 'totalFreightAmount', 'paidAmount', 'bankingRef', 'paymentDate', 'paymentStatus', 'podReceived'];
  const headerLabels: { [key: string]: string } = {
    plantName: 'Plant', tripId: 'Trip ID', lrNumber: 'LR Number', startDate: 'Date', vehicleNumber: 'Vehicle No', transporterName: 'Transporter', loadingPoint: 'FROM', shipToParty: 'Ship To Party', unloadingPoint: 'Destination', assignedQtyInTrip: 'Assigned Qty', freightRate: 'Freight Rate', baseFreightAmount: 'Freight Amount', addChargeAmount: 'Add Charge', totalFreightAmount: 'Total Freight', paidAmount: 'Paid Amount', bankingRef: 'Bank Ref', paymentDate: 'Pay Date', paymentStatus: 'Status', podReceived: 'POD Status'
  };
  
  const handleExport = () => {
    const dataToExport = sortedData.map(item => {
      const lastPayment = item.payments?.[item.payments.length - 1];
      const row: {[key: string]: any} = {};
      headers.forEach(key => {
        let val = (item as any)[key] ?? (item.trip as any)?.[key] ?? 'N/A';
        if (key.includes('Date') && val !== 'N/A') {
           val = format(new Date(val), 'dd-MM-yyyy');
        }
        if(key === 'paymentDate') val = lastPayment && isValid(new Date(lastPayment.paymentDate)) ? format(new Date(lastPayment.paymentDate), 'dd-MM-yyyy') : 'N/A';
        if(key === 'bankingRef') val = lastPayment?.referenceNo || 'N/A';
        if(key === 'podReceived') val = item.trip?.podReceived ? 'Received' : 'Pending';
        row[headerLabels[key]] = val;
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Freight Report");
    XLSX.writeFile(workbook, "FreightReport.xlsx");
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' ? '🔼' : '🔽';
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
            <div>
                <CardTitle className="text-xl font-black uppercase text-blue-900 flex items-center gap-2">
                    Freight Settlement Ledger
                    {dbError && <WifiOff className="h-4 w-4 text-orange-500" />}
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Registry audit of mission financial liquidation</CardDescription>
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
                            {headerLabels[key]}
                            {getSortIcon(key)}
                        </Button>
                    </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="h-16"><TableCell colSpan={headers.length} className="px-4"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={headers.length} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No records found matching criteria.</TableCell></TableRow>
              ) : (
                paginatedData.map(item => {
                    const lastPayment = item.payments?.[item.payments.length - 1];
                    return (
                        <TableRow key={item.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                            <TableCell className="px-4 font-bold text-slate-600 uppercase text-[11px]">{item.plantName || 'N/A'}</TableCell>
                            <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter uppercase">{item.trip?.tripId || 'N/A'}</TableCell>
                            <TableCell className="px-4 font-bold text-slate-800 text-[11px]">{item.trip?.lrNumber || 'N/A'}</TableCell>
                            <TableCell className="px-4 text-center text-xs font-bold text-slate-500 whitespace-nowrap">{item.trip ? format(new Date(item.trip.startDate), 'dd.MM.yy') : 'N/A'}</TableCell>
                            <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{item.trip?.vehicleNumber || 'N/A'}</TableCell>
                            <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400 truncate max-w-[120px]">{item.trip?.transporterName || 'N/A'}</TableCell>
                            <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400 truncate max-w-[120px]">{item.trip?.loadingPoint || 'N/A'}</TableCell>
                            <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400 truncate max-w-[120px]">{item.trip?.shipToParty || 'N/A'}</TableCell>
                            <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400 truncate max-w-[120px]">{item.trip?.unloadingPoint || 'N/A'}</TableCell>
                            <TableCell className="px-4 text-right font-bold text-blue-900">{(item.trip?.assignedQtyInTrip || 0).toFixed(3)} MT</TableCell>
                            <TableCell className="px-4 text-right text-[11px] font-bold text-slate-500">₹ {item.trip?.freightRate?.toLocaleString() || 'N/A'}</TableCell>
                            <TableCell className="px-4 text-right font-black text-slate-700">₹ {Number(item.baseFreightAmount).toLocaleString()}</TableCell>
                            <TableCell className="px-4 text-right font-bold text-orange-600">₹ {Number(item.addChargeAmount).toLocaleString()}</TableCell>
                            <TableCell className="px-4 text-right font-black text-slate-900">₹ {Number(item.totalFreightAmount).toLocaleString()}</TableCell>
                            <TableCell className="px-4 text-right font-black text-emerald-700 bg-emerald-50/10">₹ {Number(item.paidAmount).toLocaleString()}</TableCell>
                            <TableCell className="px-4 font-mono text-[10px] font-bold text-slate-400">{lastPayment?.referenceNo || 'N/A'}</TableCell>
                            <TableCell className="px-4 text-center text-[10px] font-bold text-slate-500 whitespace-nowrap">{lastPayment && isValid(new Date(lastPayment.paymentDate)) ? format(new Date(lastPayment.paymentDate), 'dd.MM.yy') : 'N/A'}</TableCell>
                            <TableCell className="px-4 text-center">
                                <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 h-6 border-slate-200", item.paymentStatus === 'Paid' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700')}>
                                    {item.paymentStatus}
                                </Badge>
                            </TableCell>
                            <TableCell className="px-6 text-center">
                                <Badge variant={item.trip?.podReceived ? "default" : "destructive"} className="text-[9px] h-6 px-2.5 uppercase font-black border-none shadow-sm">
                                    {item.trip?.podReceived ? 'Received' : 'Pending'}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    );
                })
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
  );
}
