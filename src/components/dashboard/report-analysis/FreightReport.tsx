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
import { 
    ArrowUpDown, 
    FileDown, 
    WifiOff, 
    Loader2, 
    Eye, 
    IndianRupee, 
    Clock,
    Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs, doc, getDoc, Timestamp, query, orderBy, where, limit } from "firebase/firestore";
import { Badge } from '@/components/ui/badge';
import { cn, normalizePlantId, parseSafeDate } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ViewFreightModal from '../freight-management/ViewFreightModal';

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
    detentionAmount: number;
    plantName?: string;
    startDate?: Date;
    originPlantId?: string;
    entryTime?: Date;
    outDate?: Date;
    arrivalDate?: Date;
    unloadTime?: Date;
};

const ITEMS_PER_PAGE = 15;

/**
 * @fileOverview Freight Settlement Ledger Report.
 * Rule Node: Total Freight = Base Amt - Charges.
 * Integration: Added Vehicle IN/OUT, Arrived, and Unload timestamps.
 */
export default function FreightReport({ fromDate, toDate, searchTerm }: ReportProps) {
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [data, setData] = useState<EnrichedFreight[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewingFreight, setViewingFreight] = useState<EnrichedFreight | null>(null);

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
        const isRootAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

        if (userDocSnap) {
            const userData = userDocSnap.data() as SubUser;
            const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isRootAdmin;
            authorizedPlantIds = isRoot ? activePlants.map(p => p.id) : (userData.plantIds || []);
        } else if (isRootAdmin) {
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
                getDocs(collection(firestore, `plants/${pId}/freights`))
            ]);

            const shipsMap = new Map(shipSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
            const freightsMap = new Map(freightSnap.docs.map(d => [d.data().tripId, { id: d.id, ...d.data() }]));
            
            const resolvedPlantId = normalizePlantId(pId);
            const plantNode = activePlants.find(p => normalizePlantId(p.id) === resolvedPlantId) || { id: pId, name: pId };

            tripSnap.forEach(tripDoc => {
                const trip: any = { id: tripDoc.id, ...tripDoc.data() };
                
                if (trip.vehicleType !== 'Market Vehicle' && trip.vehicleType !== 'Contract Vehicle') return;

                const shipment = shipsMap.get(trip.shipmentIds?.[0]);
                const fData: any = freightsMap.get(trip.id) || {};
                
                let baseFreightAmount = Number(fData.baseFreightAmount);
                if (!baseFreightAmount) {
                    baseFreightAmount = trip.isFixRate 
                        ? Number(trip.fixedAmount || 0) 
                        : (Number(trip.freightRate || 0) * Number(trip.assignedQtyInTrip || 0));
                }

                const totalCharges = (fData.charges || []).reduce((acc: number, c: any) => acc + (Number(c.amount) || 0), 0);
                const detentionAmount = (fData.charges || []).filter((c: any) => c.type === 'Detention').reduce((acc: number, c: any) => acc + (Number(c.amount) || 0), 0);
                const otherCharges = totalCharges - detentionAmount;

                const startTime = parseSafeDate(trip.startDate) || new Date();
                const netFreightAmount = baseFreightAmount - totalCharges;
                const totalPaid = Number(fData.paidAmount) || 0;

                allEnriched.push({
                    id: fData.id || `f-${trip.id}`,
                    originPlantId: pId,
                    ...fData,
                    trip: { ...trip, startDate: startTime },
                    shipment,
                    plant: plantNode as any,
                    addChargeAmount: otherCharges,
                    detentionAmount: detentionAmount,
                    baseFreightAmount,
                    totalFreightAmount: netFreightAmount,
                    paidAmount: totalPaid,
                    balanceAmount: netFreightAmount - totalPaid,
                    paymentStatus: fData.paymentStatus || 'Awaiting Post',
                    plantName: (plantNode as any).name || resolvedPlantId,
                    startDate: startTime,
                    entryTime: parseSafeDate(trip.entryTime),
                    outDate: parseSafeDate(trip.outDate),
                    arrivalDate: parseSafeDate(trip.arrivalDate),
                    unloadTime: parseSafeDate(trip.actualCompletionDate)
                } as EnrichedFreight);
            });
        });

        await Promise.all(plantFetchPromises);
        setData(allEnriched.sort((a, b) => (b.startDate?.getTime() || 0) - (a.startDate?.getTime() || 0)));
    } catch (error) {
        console.error("Freight Registry Sync Failure:", error);
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
    
    if (fromDate) filtered = filtered.filter(item => item.startDate && item.startDate >= startOfDay(fromDate));
    if (toDate) filtered = filtered.filter(item => item.startDate && item.startDate <= endOfDay(toDate));

    if (statusFilter !== 'all') {
        const s = statusFilter.toLowerCase();
        if (s === 'paid') filtered = filtered.filter(item => item.paymentStatus?.toLowerCase() === 'paid');
        if (s === 'unpaid') filtered = filtered.filter(item => item.paymentStatus?.toLowerCase() === 'unpaid' || item.paymentStatus?.toLowerCase() === 'pending' || item.paymentStatus?.toLowerCase() === 'awaiting post');
        if (s === 'partial') filtered = filtered.filter(item => item.paymentStatus?.toLowerCase().includes('partial'));
    }

    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(item =>
            item.trip?.tripId?.toLowerCase().includes(lowerSearch) ||
            item.trip?.vehicleNumber?.toLowerCase().includes(lowerSearch) ||
            item.trip?.lrNumber?.toLowerCase().includes(lowerSearch) ||
            item.trip?.transporterName?.toLowerCase().includes(lowerSearch) ||
            item.plantName?.toLowerCase().includes(lowerSearch)
        );
    }

    return filtered;
  }, [data, fromDate, toDate, searchTerm, statusFilter]);
  
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

  const headerLabels: Record<string, string> = {
    plantName: 'Plant', tripId: 'Trip ID', lrNumber: 'LR Number', startDate: 'Date', 
    entryTime: 'Veh IN', outDate: 'Veh OUT', arrivalDate: 'Arrived', unloadTime: 'Unload',
    vehicleNumber: 'Vehicle No', transporterName: 'Transporter', baseFreightAmount: 'Base Amt', 
    detentionAmount: 'Detention', addChargeAmount: 'Other Charge', totalFreightAmount: 'Net Freight', 
    paidAmount: 'Paid', paymentStatus: 'Status'
  };
  
  const handleExport = () => {
    const dataToExport = sortedData.map(item => ({
        'Lifting Plant': item.plantName,
        'Trip ID Registry': item.trip?.tripId,
        'LR Number': item.trip?.lrNumber,
        'Mission Date': item.startDate ? format(item.startDate, 'dd-MM-yyyy') : '--',
        'Vehicle IN': item.entryTime ? format(item.entryTime, 'dd-MM HH:mm') : '--',
        'Vehicle OUT': item.outDate ? format(item.outDate, 'dd-MM HH:mm') : '--',
        'Arrived At Destination': item.arrivalDate ? format(item.arrivalDate, 'dd-MM HH:mm') : '--',
        'Unloaded Timestamp': item.unloadTime ? format(item.unloadTime, 'dd-MM HH:mm') : '--',
        'Vehicle Number': item.trip?.vehicleNumber,
        'Transporter node': item.trip?.transporterName || 'Self',
        'Base Amount (F)': item.baseFreightAmount,
        'Detention Registry': item.detentionAmount,
        'Additional Charges': item.addChargeAmount,
        'Net Settlement Freight': item.totalFreightAmount,
        'Paid Registry': item.paidAmount,
        'Payment Status': item.paymentStatus
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Freight Analytics");
    XLSX.writeFile(workbook, "Freight_Settlement_Analytics.xlsx");
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-3 w-3 text-slate-400" />;
    return sortConfig.direction === 'asc' ? '🔼' : '🔽';
  };

  const formatSafeTime = (date?: Date) => {
      if (!date || !isValid(date)) return '--:--';
      return format(date, 'dd/MM HH:mm');
  };

  return (
    <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
      <CardHeader className="p-8 border-b bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-lg rotate-3"><IndianRupee className="h-6 w-6" /></div>
              <div>
                  <CardTitle className="text-xl font-black uppercase text-blue-900 italic leading-none">Freight Settlement Ledger</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Rule: Net Freight = Base - (Deductions/Charges)</CardDescription>
              </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-inner">
                  <span className="text-[9px] font-black uppercase text-slate-400 pl-2">Status Node:</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 w-[140px] border-none shadow-none font-black text-xs uppercase bg-transparent text-blue-900">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                          <SelectItem value="all" className="font-bold py-2">ALL RECORDS</SelectItem>
                          <SelectItem value="paid" className="font-bold py-2 text-emerald-600">FULLY PAID</SelectItem>
                          <SelectItem value="unpaid" className="font-bold py-2 text-red-600">UNPAID NODE</SelectItem>
                          <SelectItem value="partial" className="font-bold py-2 text-amber-600">PARTIAL SYNC</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} className="h-11 px-8 rounded-2xl font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-xl hover:bg-slate-50 transition-all">
                  <FileDown className="h-4 w-4 mr-2" /> Export
              </Button>
          </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[3400px]">
            <TableHeader className="bg-slate-900 text-white h-14">
              <TableRow className="hover:bg-transparent border-none">
                 {Object.keys(headerLabels).map(key => (
                     <TableHead key={key} className="px-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => {
                                let direction: 'asc' | 'desc' = 'asc';
                                if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
                                setSortConfig({ key, direction });
                            }} 
                            className="h-auto p-0 font-black text-[10px] uppercase tracking-widest text-blue-200 hover:text-white transition-colors"
                        >
                            {headerLabels[key]}{getSortIcon(key)}
                        </Button>
                    </TableHead>
                ))}
                <TableHead className="w-16 sticky right-0 bg-slate-900"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="h-16"><TableCell colSpan={17} className="px-4"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={17} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No authorized mission nodes detected in registry.</TableCell></TableRow>
              ) : (
                paginatedData.map(item => (
                    <TableRow 
                        key={item.id} 
                        className="h-16 hover:bg-blue-50/20 transition-all border-b border-slate-50 last:border-0 group cursor-pointer"
                        onClick={() => setViewingFreight(item)}
                    >
                        <TableCell className="px-4 font-bold text-slate-600 uppercase text-[11px]">{item.plantName}</TableCell>
                        <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter uppercase">{item.trip?.tripId}</TableCell>
                        <TableCell className="px-4 font-black text-slate-900 uppercase text-[11px]">{item.trip?.lrNumber || '--'}</TableCell>
                        <TableCell className="px-4 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap">{item.startDate ? format(item.startDate, 'dd.MM.yy') : '--'}</TableCell>
                        
                        <TableCell className="px-4 text-center text-[10px] font-black text-slate-400 font-mono">{formatSafeTime(item.entryTime)}</TableCell>
                        <TableCell className="px-4 text-center text-[10px] font-black text-blue-600 font-mono">{formatSafeTime(item.outDate)}</TableCell>
                        <TableCell className="px-4 text-center text-[10px] font-black text-indigo-600 font-mono">{formatSafeTime(item.arrivalDate)}</TableCell>
                        <TableCell className="px-4 text-center text-[10px] font-black text-emerald-600 font-mono">{formatSafeTime(item.unloadTime)}</TableCell>

                        <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{item.trip?.vehicleNumber}</TableCell>
                        <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400 truncate max-w-[150px]">{item.trip?.transporterName || 'SELF'}</TableCell>
                        <TableCell className="px-4 text-right font-black text-slate-900">₹ {Number(item.baseFreightAmount).toLocaleString()}</TableCell>
                        <TableCell className="px-4 text-right font-black text-amber-600 bg-amber-50/5">₹ {Number(item.detentionAmount).toLocaleString()}</TableCell>
                        <TableCell className="px-4 text-right font-bold text-orange-600">₹ {Number(item.addChargeAmount).toLocaleString()}</TableCell>
                        <TableCell className="px-4 text-right font-black text-blue-900 bg-blue-50/10">₹ {Number(item.totalFreightAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="px-4 text-right font-black text-emerald-700">₹ {Number(item.paidAmount).toLocaleString()}</TableCell>
                        <TableCell className="px-4 text-center">
                            <Badge variant="outline" className={cn(
                                "text-[9px] font-black uppercase px-2.5 h-6 border shadow-sm",
                                item.paymentStatus === 'Paid' ? 'bg-emerald-600 text-white border-emerald-600' : 
                                ['unpaid', 'pending', 'awaiting post'].includes(item.paymentStatus?.toLowerCase()) ? 'bg-red-600 text-white border-red-600' : 'bg-amber-100 text-amber-700 border-amber-200'
                            )}>
                                {item.paymentStatus}
                            </Badge>
                        </TableCell>
                        <TableCell className="px-6 text-right sticky right-0 bg-white group-hover:bg-blue-50/50 transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-100 rounded-xl opacity-0 group-hover:opacity-100 transition-all"><Eye size={16}/></Button>
                        </TableCell>
                    </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-6 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase text-slate-400 leading-none">Net Freight Aggregate</span>
                    <p className="text-xl font-black text-blue-900 tracking-tighter">₹ {filteredData.reduce((s, i) => s + (Number(i.totalFreightAmount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase text-slate-400 leading-none">Unpaid Balance Node</span>
                    <p className="text-xl font-black text-red-600 tracking-tighter">₹ {filteredData.reduce((s, i) => s + (Number(i.balanceAmount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
            </div>
            <ReportPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemCount={filteredData.length}
                canPreviousPage={currentPage > 1}
                canNextPage={currentPage < totalPages}
            />
        </div>
      </CardContent>

      {viewingFreight && (
          <ViewFreightModal 
            isOpen={!!viewingFreight} 
            onClose={() => setViewingFreight(null)} 
            freight={viewingFreight as any} 
          />
      )}
    </Card>
  );
}
