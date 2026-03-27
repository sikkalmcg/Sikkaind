'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    FileDown, 
    Loader2, 
    WifiOff, 
    Truck, 
    Navigation, 
    IndianRupee, 
    Search,
    ShieldCheck,
    Factory,
    Calendar,
    Filter,
    User,
    Weight,
    TrendingUp,
    Phone,
    ArrowRightLeft
} from 'lucide-react';
import { format, startOfDay, subDays, endOfDay, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import type { WithId, Trip, Shipment, LR, Plant, SubUser } from '@/types';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs, query, where, Timestamp, orderBy, limit, onSnapshot } from "firebase/firestore";
import { DatePicker } from '@/components/date-picker';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, normalizePlantId } from '@/lib/utils';
import MultiSelectPlantFilter from '@/components/dashboard/MultiSelectPlantFilter';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * @fileOverview Trip Summary Page.
 * Provides a consolidated overview of all mission trips with financial and manifest weights.
 * Update: Freight details (Rate, Amount, KPI) restricted to Market Vehicles only.
 */

type EnrichedTripRow = WithId<Trip> & {
    plantName: string;
    consignor: string;
    loadingPoint: string;
    billToParty: string;
    lrWeight: number;
};

const ITEMS_PER_PAGE = 10;

export default function TripSummaryPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    
    // FILTER STATE
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
    const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 31)));
    const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
    const [vehicleCategory, setVehicleCategory] = useState<string>('all');
    const [footerVehicleType, setFooterVehicleType] = useState<string>('all');

    // REGISTRY DATA
    const [trips, setTrips] = useState<WithId<Trip>[]>([]);
    const [shipments, setShipments] = useState<WithId<Shipment>[]>([]);
    const [lrs, setLrs] = useState<WithId<LR>[]>([]);
    const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [dbError, setDbError] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    // 1. Resolve Master Plant Registry
    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
        [firestore]
    );
    const { data: allPlants } = useCollection<Plant>(plantsQuery);

    // 2. Identity Handshake & Authorization
    useEffect(() => {
        if (!firestore || !user || !allPlants) return;

        const fetchAuth = async () => {
            setIsAuthLoading(true);
            try {
                const lastIdentity = localStorage.getItem('slmc_last_identity');
                const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
                
                let userDocSnap = null;
                const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) userDocSnap = qSnap.docs[0];

                let authIds: string[] = [];
                if (userDocSnap) {
                    const userData = userDocSnap.data() as SubUser;
                    authIds = (userData.username === 'sikkaind' || isAdminSession) ? allPlants.map(p => p.id) : (userData.plantIds || []);
                } else if (isAdminSession) {
                    authIds = allPlants.map(p => p.id);
                }
                
                setAuthorizedPlantIds(authIds);
                if (authIds.length > 0) setSelectedPlants(authIds);
            } catch (error) {
                setDbError(true);
            } finally {
                setIsAuthLoading(false);
            }
        };
        fetchAuth();
    }, [firestore, user, allPlants, isAdminSession]);

    // 3. Real-time Multi-Node Registry Extraction
    useEffect(() => {
        if (!firestore || authorizedPlantIds.length === 0) return;

        setIsLoading(true);
        const unsubscribers: (() => void)[] = [];

        authorizedPlantIds.forEach(pId => {
            const parseDate = (val: any) => val instanceof Timestamp ? val.toDate() : (val ? new Date(val) : new Date());

            // Trips
            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/trips`), (snap) => {
                const plantTrips = snap.docs.map(d => ({ 
                    id: d.id, 
                    originPlantId: pId, 
                    ...d.data(),
                    startDate: parseDate(d.data().startDate)
                } as WithId<Trip>));
                setTrips(prev => [...prev.filter(t => t.originPlantId !== pId), ...plantTrips]);
                setIsLoading(false);
            }, () => setDbError(true)));

            // Shipments
            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/shipments`), (snap) => {
                const plantShipments = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as WithId<Shipment>));
                setShipments(prev => [...prev.filter(s => s.originPlantId !== pId), ...plantShipments]);
            }));

            // LRs
            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/lrs`), (snap) => {
                const plantLrs = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as WithId<LR>));
                setLrs(prev => [...prev.filter(l => l.originPlantId !== pId), ...plantLrs]);
            }));
        });

        return () => unsubscribers.forEach(u => u());
    }, [firestore, JSON.stringify(authorizedPlantIds)]);

    // 4. Registry Join Logic
    const enrichedData: EnrichedTripRow[] = useMemo(() => {
        return trips.map(t => {
            const shipment = shipments.find(s => s.id === t.shipmentIds?.[0]);
            const lr = lrs.find(l => l.tripId === t.id || l.tripDocId === t.id);
            const plant = allPlants?.find(p => normalizePlantId(p.id) === normalizePlantId(t.originPlantId));

            return {
                ...t,
                plantName: plant?.name || t.originPlantId,
                consignor: shipment?.consignor || '--',
                loadingPoint: shipment?.loadingPoint || '--',
                billToParty: shipment?.billToParty || '--',
                lrWeight: Number(lr?.assignedTripWeight || 0),
            } as EnrichedTripRow;
        }).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    }, [trips, shipments, lrs, allPlants]);

    // 5. Advanced Filter Logic
    const filteredData = useMemo(() => {
        const start = fromDate ? startOfDay(fromDate) : null;
        const end = toDate ? endOfDay(toDate) : null;

        return enrichedData.filter(item => {
            // Plant Filter
            if (selectedPlants.length > 0 && !selectedPlants.includes(item.originPlantId)) return false;

            // Date Range Filter
            if (start && item.startDate < start) return false;
            if (end && item.startDate > end) return false;

            // Vehicle Category Filter (Top Header)
            if (vehicleCategory !== 'all' && item.vehicleType !== vehicleCategory) return false;

            // Vehicle Type Filter (Footer)
            if (footerVehicleType !== 'all' && item.vehicleType !== footerVehicleType) return false;

            // Search Filter
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                return [
                    item.tripId,
                    item.lrNumber,
                    item.vehicleNumber,
                    item.consignor,
                    item.unloadingPoint,
                    item.userName,
                    item.transporterName
                ].some(val => val?.toString().toLowerCase().includes(s));
            }

            return true;
        });
    }, [enrichedData, selectedPlants, fromDate, toDate, vehicleCategory, footerVehicleType, searchTerm]);

    // 6. Summary Stats
    const stats = useMemo(() => {
        return filteredData.reduce((acc, curr) => ({
            count: acc.count + 1,
            weight: acc.weight + (Number(curr.assignedQtyInTrip) || 0),
            // Only sum freight for market vehicles as per rule
            freight: curr.vehicleType === 'Market Vehicle' ? acc.freight + (Number(curr.freightAmount) || 0) : acc.freight
        }), { count: 0, weight: 0, freight: 0 });
    }, [filteredData]);

    const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

    // Registry Rule: Show freight only if filter is Market or All
    const isFreightVisible = vehicleCategory === 'all' || vehicleCategory === 'Market Vehicle';

    // 7. Excel Export Handbook
    const handleExport = () => {
        const rows = filteredData.map(t => {
            const row: any = {
                'Plant': t.plantName,
                'Trip ID': t.tripId,
                'LR Number': t.lrNumber || '--',
                'Date': format(t.startDate, 'dd-MM-yyyy HH:mm'),
                'Consignor': t.consignor,
                'From': t.loadingPoint,
                'Consignee': t.billToParty,
                'Ship To': t.shipToParty || '--',
                'Destination': t.unloadingPoint,
                'Transporter': t.transporterName || '--',
                'Transporter Mobile': t.transporterMobile || '--',
                'Assigned Weight': t.assignedQtyInTrip,
                'LR Weight': t.lrWeight,
                'Assigned Username': t.userName || 'System'
            };

            // Only include freight in export if applicable
            if (t.vehicleType === 'Market Vehicle') {
                row['Rate'] = t.freightRate || 0;
                row['Total Freight'] = t.freightAmount || 0;
            }

            return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trip Summary Registry");
        XLSX.writeFile(wb, `TripSummary_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
            {/* ERP HEADER */}
            <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm print:hidden">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary text-white rounded-lg shadow-lg rotate-3">
                        <ArrowRightLeft className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight uppercase">Trip Summary Hub</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">LMC Registry &gt; Consolidated Analytics</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {dbError && (
                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold border border-orange-200 uppercase tracking-wider">
                            <WifiOff className="h-3 w-3" /> <span>Registry Unstable</span>
                        </div>
                    )}
                    <Button variant="outline" onClick={handleExport} className="h-11 rounded-xl font-black uppercase text-[11px] tracking-widest border-slate-200 text-primary gap-2 shadow-sm hover:bg-slate-50">
                        <FileDown className="h-4 w-4" /> Export Ledger
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-10">
                {/* KPI INDICATORS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[
                        { label: 'Total Mission Trips', value: stats.count, icon: Truck, color: 'text-blue-900', bg: 'bg-blue-50', show: true },
                        { label: 'Aggregate Manifest Weight', value: `${stats.weight.toFixed(2)} MT`, icon: Weight, color: 'text-emerald-600', bg: 'bg-emerald-50', show: true },
                        { label: 'Accumulated Registry Freight', value: `₹ ${stats.freight.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-indigo-600', bg: 'bg-indigo-50', show: isFreightVisible },
                    ].filter(card => card.show).map((card, i) => (
                        <Card key={i} className="border-none shadow-md rounded-[2rem] group hover:shadow-xl transition-all">
                            <CardContent className="p-8">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{card.label}</p>
                                        <h4 className={cn("text-3xl font-black tracking-tighter leading-none", card.color)}>{card.value}</h4>
                                    </div>
                                    <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", card.bg, card.color)}>
                                        <card.icon className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* FILTER CONTROLS */}
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                            <div className="flex flex-wrap items-end gap-6">
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                        <Factory className="h-3 w-3" /> Lifting Node Scope
                                    </Label>
                                    {isAuthLoading ? (
                                        <div className="h-11 w-48 bg-slate-200 animate-pulse rounded-xl" />
                                    ) : (
                                        <MultiSelectPlantFilter 
                                            options={authorizedPlantIds.map(id => ({ id, name: allPlants?.find(p => p.id === id)?.name || id }))}
                                            selected={selectedPlants}
                                            onChange={setSelectedPlants}
                                        />
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                        <Calendar className="h-3 w-3" /> Period Selection
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <DatePicker date={fromDate} setDate={setFromDate} className="h-11 rounded-xl" />
                                        <span className="text-slate-300 font-bold">to</span>
                                        <DatePicker date={toDate} setDate={setTodayDate} className="h-11 rounded-xl" />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                        <Truck className="h-3 w-3" /> Fleet Category
                                    </Label>
                                    <Select value={vehicleCategory} onValueChange={setVehicleCategory}>
                                        <SelectTrigger className="h-11 w-[180px] rounded-xl font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">All Categories</SelectItem>
                                            <SelectItem value="Own Vehicle">Own Vehicle</SelectItem>
                                            <SelectItem value="Contract Vehicle">Contract Vehicle</SelectItem>
                                            <SelectItem value="Market Vehicle">Market Vehicle</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                        <Search className="h-3 w-3" /> Global Search
                                    </Label>
                                    <Input 
                                        placeholder="IDs, Vehicles, Parties..." 
                                        value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="h-11 w-[300px] rounded-xl border-slate-200 bg-white font-bold shadow-inner" 
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table className="border-collapse w-full min-w-[2200px]">
                                <TableHeader className="bg-slate-50 border-b">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] font-black uppercase px-6 h-14">Plant</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14">Trip ID</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14">LR Number</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14 text-center">Date</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14">Consignor</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14">From</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14">Consignee</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14">Ship To</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14">Destination</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14">Transporter Name</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14">Transporter Mobile</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14 text-right">Assigned weight</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 h-14 text-right">LR Weight</TableHead>
                                        
                                        {/* FINANCIAL HEADERS: Market Only */}
                                        {isFreightVisible && (
                                            <>
                                                <TableHead className="text-[10px] font-black uppercase px-4 h-14 text-right">Rate</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase px-4 h-14 text-right bg-blue-50/50">Total Freight</TableHead>
                                            </>
                                        )}
                                        
                                        <TableHead className="text-[10px] font-black uppercase px-6 h-14">Username</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}><TableCell colSpan={isFreightVisible ? 16 : 14} className="p-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                        ))
                                    ) : paginatedData.length === 0 ? (
                                        <TableRow><TableCell colSpan={isFreightVisible ? 16 : 14} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No mission records found in current scope.</TableCell></TableRow>
                                    ) : (
                                        paginatedData.map(row => {
                                            const isMarketRow = row.vehicleType === 'Market Vehicle';
                                            return (
                                                <TableRow key={row.id} className="h-16 hover:bg-blue-50/30 transition-all border-b border-slate-50 last:border-0 group">
                                                    <TableCell className="px-6 font-bold text-slate-600 uppercase text-[11px]">{row.plantName}</TableCell>
                                                    <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs">{row.tripId}</TableCell>
                                                    <TableCell className="px-4 font-black text-slate-900">{row.lrNumber || '--'}</TableCell>
                                                    <TableCell className="px-4 text-center text-[11px] font-bold text-slate-500 whitespace-nowrap">{format(row.startDate, 'dd.MM.yyyy')}</TableCell>
                                                    <TableCell className="px-4 font-black text-slate-800 uppercase text-[11px] truncate max-w-[150px]">{row.consignor}</TableCell>
                                                    <TableCell className="px-4 text-[11px] font-bold text-slate-500 uppercase truncate max-w-[120px]">{row.loadingPoint}</TableCell>
                                                    <TableCell className="px-4 font-black text-slate-800 uppercase text-[11px] truncate max-w-[150px]">{row.billToParty}</TableCell>
                                                    <TableCell className="px-4 text-[11px] font-bold text-slate-500 uppercase truncate max-w-[150px]">{row.shipToParty}</TableCell>
                                                    <TableCell className="px-4 text-[11px] font-black text-slate-900 uppercase truncate max-w-[150px]">{row.unloadingPoint}</TableCell>
                                                    <TableCell className="px-4 font-bold text-slate-700 uppercase text-[11px] truncate max-w-[180px]">{row.transporterName || '--'}</TableCell>
                                                    <TableCell className="px-4 font-mono text-[11px] text-slate-500">{row.transporterMobile || '--'}</TableCell>
                                                    <TableCell className="px-4 text-right font-bold text-slate-700">{row.assignedQtyInTrip.toFixed(3)}</TableCell>
                                                    <TableCell className="px-4 text-right font-black text-blue-900">{row.lrWeight.toFixed(3)}</TableCell>
                                                    
                                                    {/* FINANCIAL CELLS: Visible only if top category filter allows it */}
                                                    {isFreightVisible && (
                                                        <>
                                                            <TableCell className="px-4 text-right font-bold text-emerald-600">
                                                                {isMarketRow ? `₹ ${Number(row.freightRate || 0).toLocaleString()}` : '--'}
                                                            </TableCell>
                                                            <TableCell className="px-4 text-right font-black text-blue-900 bg-blue-50/20">
                                                                {isMarketRow ? `₹ ${Number(row.freightAmount || 0).toLocaleString()}` : '--'}
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    
                                                    <TableCell className="px-6 font-black text-slate-400 text-[10px] uppercase">{row.userName || 'System'}</TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    
                    {/* FOOTER SECTION */}
                    <div className="bg-slate-50 border-t p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 shrink-0">
                        <div className="flex items-center gap-10">
                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fleet Logic Node</Label>
                                <Select value={footerVehicleType} onValueChange={setFooterVehicleType}>
                                    <SelectTrigger className="h-10 w-[220px] rounded-xl bg-white border-slate-200 font-bold">
                                        <SelectValue placeholder="All Categories" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">Global Fleet Hierarchy</SelectItem>
                                        <SelectItem value="Own Vehicle">Own Vehicle Registry</SelectItem>
                                        <SelectItem value="Contract Vehicle">Contract Vehicle Registry</SelectItem>
                                        <SelectItem value="Market Vehicle">Market Vehicle Registry</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border shadow-sm">
                                <TrendingUp className="h-5 w-5 text-blue-600" />
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400 leading-none mb-1">Active Scope</p>
                                    <p className="text-sm font-black text-blue-900">{filteredData.length} Registry Entries</p>
                                </div>
                            </div>
                        </div>
                        
                        <Pagination 
                            currentPage={currentPage} 
                            totalPages={totalPages} 
                            onPageChange={setCurrentPage} 
                            itemCount={filteredData.length}
                            canPreviousPage={currentPage > 1}
                            canNextPage={currentPage < totalPages}
                        />
                    </div>
                </Card>
            </div>
        </main>
    );
}
