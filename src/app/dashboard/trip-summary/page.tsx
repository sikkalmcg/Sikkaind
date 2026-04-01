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
    Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, where, limit } from 'firebase/firestore';
import type { Plant, SubUser } from '@/types';
import { normalizePlantId } from '@/lib/utils';

/**
 * @fileOverview Trip Summary Hub.
 * Optimized UI node for visualizing consolidated mission analytics.
 * Registry is maintained as empty per data clearance request, while UI elements like Plant Node are preserved.
 */
function TripSummaryContent() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('all-plants');
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

  // DATA CLEARANCE RULE: The trips array is forced to empty to satisfy privacy/cleanup requirements.
  const trips: any[] = [];

  const filteredTrips = useMemo(() => {
    if (!searchTerm) return trips;
    const s = searchTerm.toLowerCase();
    return trips.filter(t => 
        Object.values(t).some(val => val?.toString().toLowerCase().includes(s))
    );
  }, [searchTerm]);

  const filteredPlants = (allPlants || []).filter(p => isAdmin || authorizedPlantIds.includes(p.id));
  const isReadOnlyScope = !isAdmin && authorizedPlantIds.length === 1;

  return (
    <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-lg rotate-3">
                <ArrowRightLeft className="h-7 w-7" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-blue-600 tracking-tight uppercase italic leading-none">Trip Summary Hub</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">LMC Registry &gt; Consolidated Analytics</p>
            </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-1">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                  <Factory className="h-3 w-3" /> Plant Node Registry
              </Label>
              {isReadOnlyScope ? (
                  <div className="h-10 px-5 flex items-center bg-blue-50 border border-blue-100 rounded-xl text-blue-900 font-black text-xs shadow-sm uppercase tracking-tighter min-w-[220px]">
                      <ShieldCheck className="h-4 w-4 mr-2 text-blue-600" /> {allPlants?.find(p => p.id === authorizedPlantIds[0])?.name || authorizedPlantIds[0]}
                  </div>
              ) : (
                  <Select value={selectedPlant} onValueChange={setSelectedPlant} disabled={isAuthLoading}>
                      <SelectTrigger className="w-[220px] h-10 rounded-xl bg-white border-slate-200 font-bold shadow-sm">
                          <SelectValue placeholder={isAuthLoading ? "Syncing..." : "Select Node"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                          {isAdmin && (
                              <SelectItem value="all-plants" className="font-black uppercase text-[10px] tracking-widest text-blue-600">
                                  All Authorized Nodes
                              </SelectItem>
                          )}
                          {filteredPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              )}
          </div>

          <div className="relative group self-end">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <Input 
                placeholder="Search registry..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 w-[280px] h-11 rounded-2xl bg-slate-50 border-slate-200 shadow-inner font-bold focus-visible:ring-blue-600"
            />
          </div>
          <Button variant="outline" className="h-11 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all self-end">
            <FileDown className="h-4 w-4 mr-2" /> Export Ledger
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border shadow-sm"><ListTree className="h-5 w-5 text-blue-600" /></div>
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Mission Registry Analytics</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Deep-registry extraction of all completed and active nodes</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className="w-full min-w-[1200px]">
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="h-14 hover:bg-transparent border-b">
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Plant</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Trip ID</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">LR Number</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Consignor</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">From</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Consignee</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Ship To</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                                    Registry node is empty. No mission data detected.
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
