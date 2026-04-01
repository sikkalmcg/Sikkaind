'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
    FileDown, 
    ArrowRightLeft,
    Search,
    ListTree,
    Factory,
    ShieldCheck,
    Loader2,
    Truck,
    Weight,
    IndianRupee,
    Calendar,
    Layers,
    Filter,
    ChevronDown
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, limit, getDocs } from 'firebase/firestore';
import type { Plant, SubUser } from '@/types';
import { normalizePlantId } from '@/lib/utils';
import { DatePicker } from '@/components/date-picker';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Trip Summary Hub.
 * High-fidelity restoration of the consolidated analytics interface.
 * Registry data is cleared as requested, maintaining a professional audit-ready state.
 */
function TripSummaryContent() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  // Registry Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('all-plants');
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [fleetCategory, setFleetCategory] = useState('all');

  // Authorization State
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: allPlants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchAuth = async () => {
        setIsAuthLoading(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                userDocSnap = qSnap.docs[0];
            }

            let authIds: string[] = [];
            const activePlants = allPlants || [];
            const isRootAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isRootAdmin;
                authIds = isRoot ? activePlants.map(p => p.id) : (userData.plantIds || []);
                setIsAdmin(isRoot);
            } else if (isRootAdmin) {
                authIds = activePlants.map(p => p.id);
                setIsAdmin(true);
            }
            
            setAuthorizedPlantIds(authIds);
            if (authIds.length > 0) {
                if (isRootAdmin) setSelectedPlant('all-plants');
                else setSelectedPlant(authIds[0]);
            }
        } catch (error) {
            console.error("Auth Sync Error:", error);
        } finally {
            setIsAuthLoading(false);
        }
    };

    fetchAuth();
  }, [firestore, user, allPlants]);

  // DATA CLEARANCE RULE: Mission registry is force-zeroed per request
  const stats = {
    totalTrips: 0,
    totalWeight: "0.00",
    totalFreight: "0"
  };

  const filteredPlants = (allPlants || []).filter(p => isAdmin || authorizedPlantIds.includes(p.id));
  const isReadOnlyScope = !isAdmin && authorizedPlantIds.length === 1;

  return (
    <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
      {/* 1. HEADER TERMINAL */}
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg rotate-3">
                <ArrowRightLeft className="h-7 w-7" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-blue-600 tracking-tight uppercase italic leading-none">Trip Summary Hub</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">LMC Registry &gt; Consolidated Analytics</p>
            </div>
        </div>
        
        <Button variant="outline" className="h-11 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all self-end">
            <FileDown className="h-4 w-4 mr-2" /> Export Ledger
        </Button>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-10">
        
        {/* 2. STAT CARDS REGISTRY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] transition-transform duration-700 group-hover:scale-110">
                    <Truck size={120} />
                </div>
                <div className="relative z-10 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Mission Trips</p>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{stats.totalTrips}</h2>
                </div>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] transition-transform duration-700 group-hover:scale-110">
                    <Weight size={120} />
                </div>
                <div className="relative z-10 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Aggregate Manifest Weight</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-5xl font-black text-emerald-600 tracking-tighter">{stats.totalWeight}</h2>
                        <span className="text-xl font-black text-slate-300">MT</span>
                    </div>
                </div>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] transition-transform duration-700 group-hover:scale-110">
                    <IndianRupee size={120} />
                </div>
                <div className="relative z-10 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Accumulated Registry Freight</p>
                    <h2 className="text-5xl font-black text-blue-900 tracking-tighter">₹ {stats.totalFreight}</h2>
                </div>
            </Card>
        </div>

        {/* 3. FILTER MATRIX TERMINAL */}
        <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
            <div className="bg-slate-50/80 border-b p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                            <Factory className="h-3 w-3" /> Lifting Node Scope
                        </Label>
                        {isReadOnlyScope ? (
                            <div className="h-14 px-5 flex items-center bg-white border border-slate-200 rounded-2xl text-blue-900 font-black text-xs shadow-sm uppercase tracking-tighter w-full">
                                <ShieldCheck className="h-4 w-4 mr-2 text-blue-600" /> {allPlants?.find(p => p.id === authorizedPlantIds[0])?.name || authorizedPlantIds[0]}
                            </div>
                        ) : (
                            <Select value={selectedPlant} onValueChange={setSelectedPlant} disabled={isAuthLoading}>
                                <SelectTrigger className="h-14 bg-white rounded-2xl font-black text-slate-700 shadow-sm border-slate-200 focus:ring-blue-600">
                                    <SelectValue placeholder={isAuthLoading ? "Syncing..." : "Select Node"} />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    {isAdmin && (
                                        <SelectItem value="all-plants" className="font-black uppercase text-[10px] tracking-widest text-blue-600">
                                            All Authorized Nodes
                                        </SelectItem>
                                    )}
                                    {filteredPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic text-black">{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                            <Calendar className="h-3 w-3" /> Period Selection
                        </Label>
                        <div className="flex items-center gap-3">
                            <DatePicker date={fromDate} setDate={setFromDate} className="h-14 rounded-2xl bg-white border-slate-200 shadow-sm font-bold flex-1" />
                            <span className="text-[10px] font-black text-slate-300 uppercase">to</span>
                            <DatePicker date={toDate} setDate={setToDate} className="h-14 rounded-2xl bg-white border-slate-200 shadow-sm font-bold flex-1" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                            <Layers className="h-3 w-3" /> Fleet Category
                        </Label>
                        <Select value={fleetCategory} onValueChange={setFleetCategory}>
                            <SelectTrigger className="h-14 bg-white rounded-2xl font-black text-slate-700 shadow-sm border-slate-200">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                <SelectItem value="all" className="font-bold py-3 uppercase">All Categories</SelectItem>
                                <SelectItem value="own" className="font-bold py-3 uppercase">Own Fleet</SelectItem>
                                <SelectItem value="contract" className="font-bold py-3 uppercase">Contract Node</SelectItem>
                                <SelectItem value="market" className="font-bold py-3 uppercase">Market Node</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-3 max-w-lg">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2">
                        <Search className="h-3 w-3" /> Global Registry Search
                    </Label>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <Input 
                            placeholder="IDs, Vehicles, Parties..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-12 h-14 rounded-2xl bg-white border-slate-200 shadow-inner font-black text-slate-900 focus-visible:ring-blue-600 transition-all uppercase"
                        />
                    </div>
                </div>
            </div>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className="w-full min-w-[1200px]">
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="h-14 hover:bg-transparent border-b">
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Plant Node</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Trip ID</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">LR Number</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Mission Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Consignor Registry</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Lifting Point</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Consignee Registry</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Drop Node</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                                    Registry node is empty. No mission data detected in current scope.
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function TripSummaryPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <TripSummaryContent />
        </Suspense>
    );
}
