
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
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
    IndianRupee, 
    Search,
    ShieldCheck,
    Factory,
    Calendar,
    Weight,
    ArrowRightLeft
} from 'lucide-react';
import { format, startOfDay, subDays, endOfDay, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import type { WithId, Trip, Shipment, LR, Plant, SubUser } from '@/types';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, Timestamp, orderBy, onSnapshot, getDocs, limit } from "firebase/firestore";
import { DatePicker } from '@/components/date-picker';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, normalizePlantId } from '@/lib/utils';
import MultiSelectPlantFilter from '@/components/dashboard/MultiSelectPlantFilter';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { Skeleton } from '@/components/ui/skeleton';

type EnrichedTripRow = WithId<Trip> & {
    plantName: string;
    consignor: string;
    loadingPoint: string;
    billToParty: string;
    lrWeight: number;
    plant?: Plant;
};

const ITEMS_PER_PAGE = 10;

function TripSummaryContent() {
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
    const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 30)));
    const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
    const [vehicleCategory, setVehicleCategory] = useState<string>('all');

    const [trips, setTrips] = useState<WithId<Trip>[]>([]);
    const [shipments, setShipments] = useState<WithId<Shipment>[]>([]);
    const [lrs, setLrs] = useState<WithId<LR>[]>([]);
    const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [dbError, setDbError] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
        [firestore]
    );
    const { data: allPlants } = useCollection<Plant>(plantsQuery);

    useEffect(() => {
        if (!firestore || !user || !allPlants) return;

        const fetchAuth = async () => {
            setIsAuthLoading(true);
            try {
                const searchEmail = user.email;
                if (!searchEmail) return;
                
                const userSnap = await getDocs(query(collection(firestore, "users"), where("email", "==", searchEmail)));
                
                let authIds: string[] = [];
                if (!userSnap.empty) {
                    const userData = userSnap.docs[0].data() as SubUser;
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

    useEffect(() => {
        if (!firestore || authorizedPlantIds.length === 0) return;

        setIsLoading(true);
        const unsubscribers: (() => void)[] = [];

        authorizedPlantIds.forEach(pId => {
            const parseDate = (val: any) => val instanceof Timestamp ? val.toDate() : (val ? new Date(val) : new Date());

            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/trips`), (snap) => {
                const plantTrips = snap.docs.map(d => ({ 
                    id: d.id, 
                    originPlantId: pId, 
                    ...d.data(),
                    startDate: parseDate(d.data().startDate)
                } as WithId<Trip>));
                setTrips(prev => [...prev.filter(t => t.originPlantId !== pId), ...plantTrips]);
                setIsLoading(false);
            }));

            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/shipments`), (snap) => {
                const plantShipments = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as WithId<Shipment>));
                setShipments(prev => [...prev.filter(s => s.originPlantId !== pId), ...plantShipments]);
            }));

            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/lrs`), (snap) => {
                const plantLrs = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as WithId<LR>));
                setLrs(prev => [...prev.filter(l => l.originPlantId !== pId), ...plantLrs]);
            }));
        });

        return () => unsubscribers.forEach(u => u());
    }, [firestore, JSON.stringify(authorizedPlantIds)]);

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
                plant
            } as EnrichedTripRow;
        }).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    }, [trips, shipments, lrs, allPlants]);

    const filteredData = useMemo(() => {
        const start = fromDate ? startOfDay(fromDate) : null;
        const end = toDate ? endOfDay(toDate) : null;

        return enrichedData.filter(item => {
            if (selectedPlants.length > 0 && !selectedPlants.includes(item.originPlantId)) return false;
            if (start && item.startDate < start) return false;
            if (end && item.startDate > end) return false;
            if (vehicleCategory !== 'all' && item.vehicleType !== vehicleCategory) return false;

            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                return [
                    item.tripId,
                    item.lrNumber,
                    item.vehicleNumber,
                    item.consignor,
                    item.unloadingPoint
                ].some(val => val?.toString().toLowerCase().includes(s));
            }

            return true;
        });
    }, [enrichedData, selectedPlants, fromDate, toDate, vehicleCategory, searchTerm]);

    const stats = useMemo(() => {
        return filteredData.reduce((acc, curr) => ({
            count: acc.count + 1,
            weight: acc.weight + (Number(curr.assignedQtyInTrip) || 0),
            freight: acc.freight + (Number(curr.freightAmount) || 0)
        }), { count: 0, weight: 0, freight: 0 });
    }, [filteredData]);

    const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

    const handleExport = () => {
        const rows = filteredData.map(t => ({
            'Plant': t.plantName,
            'Trip ID': t.tripId,
            'LR Number': t.lrNumber || '--',
            'Date': format(t.startDate, 'dd-MM-yyyy HH:mm'),
            'Consignor': t.consignor,
            'From': t.loadingPoint,
            'Consignee': t.billToParty,
            'Ship To': t.shipToParty || '--',
            'Destination': t.unloadingPoint,
            'Assigned Weight': t.assignedQtyInTrip,
            'Freight': t.freightAmount || 0
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trip Summary Ledger");
        XLSX.writeFile(wb, `Trip_Summary_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
            <div className="sticky top-0 z-30 bg-white border-b px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl rotate-3">
                        <ArrowRightLeft className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-blue-600 tracking-tight uppercase italic">Trip Summary Hub</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">LMC Registry &gt; Consolidated Analytics</p>
                    </div>
                </div>
                
                <Button variant="outline" onClick={handleExport} className="h-12 px-8 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] border-slate-200 text-blue-600 gap-3 shadow-sm hover:bg-slate-50 transition-all active:scale-95">
                    <FileDown className="h-5 w-5" /> Export Ledger
                </Button>
            </div>

            <div className="flex-1 p-8 overflow-y-auto space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { label: 'Total Mission Trips', value: stats.count, icon: Truck, color: 'text-blue-900', bg: 'bg-blue-50' },
                        { label: 'Aggregate Manifest Weight', value: `${stats.weight.toFixed(2)} MT`, icon: Weight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Accumulated Registry Freight', value: `₹ ${stats.freight.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    ].map((card, i) => (
                        <Card key={i} className="border-none shadow-xl rounded-[2.5rem] bg-white group hover:-translate-y-1 transition-all duration-500 overflow-hidden">
                            <CardContent className="p-10 relative">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] transition-transform duration-1000 group-hover:scale-110">
                                    <card.icon size={120} />
                                </div>
                                <div className="flex justify-between items-start">
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{card.label}</p>
                                        <h4 className={cn("text-4xl font-black tracking-tighter leading-none", card.color)}>{card.value}</h4>
                                    </div>
                                    <div className={cn("p-4 rounded-2xl shadow-inner", card.bg, card.color)}>
                                        <card.icon className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-10">
                        <div className="flex flex-col space-y-10">
                            <div className="flex flex-wrap items-end gap-10">
                                <div className="grid gap-3">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                                        <Factory className="h-3 w-3" /> Lifting Node Scope
                                    </Label>
                                    <MultiSelectPlantFilter 
                                        options={authorizedPlantIds.map(id => ({ id, name: allPlants?.find(p => p.id === id)?.name || id }))}
                                        selected={selectedPlants}
                                        onChange={setSelectedPlants}
                                        isLoading={isAuthLoading}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                                        <Calendar className="h-3 w-3" /> Period Selection
                                    </Label>
                                    <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                        <DatePicker date={fromDate} setDate={setFromDate} className="h-9 border-none shadow-none font-bold" />
                                        <span className="text-slate-200 font-bold px-1">to</span>
                                        <DatePicker date={toDate} setDate={setTodayDate} className="h-9 border-none shadow-none font-bold" />
                                    </div>
                                </div>
                                <div className="grid gap-3">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                                        <Truck className="h-3 w-3" /> Fleet Category
                                    </Label>
                                    <Select value={vehicleCategory} onValueChange={setVehicleCategory}>
                                        <SelectTrigger className="h-11 w-[220px] rounded-xl bg-white border-slate-200 font-bold shadow-sm focus:ring-blue-600">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all" className="font-bold py-3 uppercase italic">All Categories</SelectItem>
                                            <SelectItem value="Own Vehicle" className="font-bold py-3 uppercase italic">Own Fleet</SelectItem>
                                            <SelectItem value="Contract Vehicle" className="font-bold py-3 uppercase italic">Contractor Node</SelectItem>
                                            <SelectItem value="Market Vehicle" className="font-bold py-3 uppercase italic">Market Node</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                                    <Search className="h-3 w-3" /> Global Search
                                </Label>
                                <div className="relative group max-w-sm">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                    <Input 
                                        placeholder="IDs, Vehicles, Parties..." 
                                        value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="h-14 pl-12 rounded-2xl border-slate-200 bg-white font-bold shadow-inner focus-visible:ring-blue-600" 
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table className="border-collapse w-full min-w-[1800px] table-fixed">
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="h-14 hover:bg-transparent border-b">
                                        <TableHead className="text-[10px] font-black uppercase px-10 text-slate-400 w-32">Plant</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-36">Trip ID</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-36">LR Number</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400 w-28">Date</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-48">Consignor</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-40">From</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-48 font-black">Consignee</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400 w-48">Ship To</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase px-10 text-slate-400 w-48">Destination</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}><TableCell colSpan={9} className="p-8"><Skeleton className="h-10 w-full rounded-2xl" /></TableCell></TableRow>
                                        ))
                                    ) : paginatedData.length === 0 ? (
                                        <TableRow><TableCell colSpan={9} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No mission records found in current scope.</TableCell></TableRow>
                                    ) : (
                                        paginatedData.map((row, idx) => (
                                            <TableRow key={row.id} className="h-16 hover:bg-blue-50/30 transition-all border-b border-slate-50 last:border-0 group">
                                                <TableCell className="px-10 font-bold text-slate-500 uppercase text-[11px] truncate">{row.plantName}</TableCell>
                                                <TableCell className="px-4 font-black text-blue-600 font-mono tracking-tighter text-xs uppercase">{row.tripId}</TableCell>
                                                <TableCell className="px-4 font-black text-slate-900 uppercase text-[11px]">{row.lrNumber || '--'}</TableCell>
                                                <TableCell className="px-4 text-center text-[11px] font-bold text-slate-400 whitespace-nowrap">{format(row.startDate, 'dd.MM.yy')}</TableCell>
                                                <TableCell className="px-4 font-black text-slate-800 uppercase text-[11px] truncate">{row.consignor}</TableCell>
                                                <TableCell className="px-4 text-[11px] font-bold text-slate-400 uppercase italic truncate">{row.loadingPoint}</TableCell>
                                                <TableCell className="px-4 font-black text-slate-900 uppercase text-[11px] truncate">{row.billToParty}</TableCell>
                                                <TableCell className="px-4 text-[11px] font-bold text-slate-400 uppercase truncate">{row.shipToParty || '--'}</TableCell>
                                                <TableCell className="px-10 text-[11px] font-black text-slate-900 uppercase truncate">{row.unloadingPoint}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="p-8 bg-slate-50 border-t flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">LMC Registry Manifest Synchronized</span>
                            </div>
                            <Pagination 
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                                canPreviousPage={currentPage > 1}
                                canNextPage={currentPage < totalPages}
                                itemCount={filteredData.length}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}

export default function TripSummaryPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}>
            <TripSummaryContent />
        </Suspense>
    );
}
