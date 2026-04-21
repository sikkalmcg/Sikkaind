'use client';
import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileDown, WifiOff, Loader2, Search, Factory, Signal } from 'lucide-react';
import { format, isValid } from 'date-fns';
import type { FuelEntry, WithId, SubUser, Plant } from '@/types';
import { mockFuelEntries, mockFuelPumps, mockPlants, mockVehicles } from '@/lib/mock-data';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs, doc, getDoc, Timestamp, query, orderBy, where, limit } from "firebase/firestore";
import { normalizePlantId } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function FuelDataTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WithId<FuelEntry>[]>([]);
  const [dbError, setDbError] = useState(false);

  const firestore = useFirestore();
  const { user } = useUser();

  // Fetch Master Registry of Logistics Plants for name resolution
  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: masterPlants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchData = async () => {
        setLoading(true);
        setDbError(false);
        try {
            // 1. HIGH-FIDELITY IDENTITY HANDSHAKE
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            
            if (!userQSnap.empty) {
                userDocSnap = userQSnap.docs[0];
            } else {
                const directRef = doc(firestore, "users", user.uid);
                const directSnap = await getDoc(directRef);
                if (directSnap.exists()) userDocSnap = directSnap;
            }

            let authorizedPlantIds: string[] = [];
            const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' || userDocSnap?.data()?.username === 'sikkaind';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdmin;
                const baseList = masterPlants && masterPlants.length > 0 ? masterPlants : mockPlants;
                authorizedPlantIds = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdmin) {
                const baseList = masterPlants && masterPlants.length > 0 ? masterPlants : mockPlants;
                authorizedPlantIds = baseList.map(p => p.id);
            }

            if (authorizedPlantIds.length === 0) {
                setLoading(false);
                setEntries([]);
                return;
            }

            // 2. Fetch Pumps & Vehicles Mapping node for resolution
            const [pumpSnap, vehicleSnap] = await Promise.all([
                getDocs(collection(firestore, "fuel_pumps")),
                getDocs(collection(firestore, "vehicles"))
            ]);
            
            const pumpsMap = new Map(pumpSnap.docs.map(d => [d.id, d.data().name]));
            const vehiclesMap = new Map(vehicleSnap.docs.map(d => [d.id, d.data().vehicleNumber]));

            const allFetched: WithId<FuelEntry>[] = [];

            // 3. REGISTRY EXTRACTION LOOP
            const fetchPromises = authorizedPlantIds.map(async (pId) => {
                try {
                    const q = query(collection(firestore, `plants/${pId}/fuel_entries`), orderBy("date", "desc"));
                    const snapshot = await getDocs(q);
                    snapshot.forEach(docSnap => {
                        const data = docSnap.data();
                        const entryDate = data.date instanceof Timestamp ? data.date.toDate() : (data.date ? new Date(data.date) : new Date());
                        
                        allFetched.push({
                            id: docSnap.id,
                            ...data,
                            date: entryDate,
                            payments: (data.payments || []).map((p: any) => ({
                                ...p,
                                date: p.date instanceof Timestamp ? p.date.toDate() : (p.date ? new Date(p.date) : new Date())
                            })),
                            pumpName: pumpsMap.get(data.pumpId) || 'N/A',
                            plantName: masterPlants?.find(p => normalizePlantId(p.id) === normalizePlantId(pId))?.name || pId,
                            vehicleNumber: data.vehicleType === 'Own Vehicle' ? (vehiclesMap.get(data.vehicleId) || data.vehicleNumber) : data.vehicleNumber,
                        } as WithId<FuelEntry>);
                    });
                } catch (e) {
                    console.warn(`Registry sync issue for node ${pId}`);
                }
            });

            await Promise.all(fetchPromises);
            setEntries(allFetched.sort((a,b) => b.date.getTime() - a.date.getTime()));

        } catch (error) {
            console.error("Fetch fuel data error:", error);
            setDbError(true);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [firestore, user, masterPlants]);

  const handleDownload = () => {
    const dataToExport = filteredEntries.map(entry => ({
        'Plant': entry.plantName || entry.plantId,
        'Pump Name': entry.pumpName || entry.pumpId,
        'Slip No': entry.slipNo,
        'Date': isValid(new Date(entry.date)) ? format(new Date(entry.date), 'dd-MMM-yyyy') : 'N/A',
        'Vehicle Number': entry.vehicleNumber,
        'Owner Name': entry.ownerName || 'N/A',
        'Fuel Ltr/Rate': `${entry.fuelLiters.toFixed(2)} / ${entry.fuelRate.toFixed(2)}`,
        'Fuel Amount': entry.fuelAmount,
        'Status': entry.paymentStatus,
        'Username': entry.userName || 'N/A',
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fuel Registry");
    XLSX.writeFile(workbook, `Fuel_Data_Registry_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e =>
        Object.values(e).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [entries, searchTerm]);
  
  return (
    <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
      <CardHeader className="bg-slate-50 border-b p-6">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><Signal className="h-5 w-5" /></div>
                <div>
                    <CardTitle className="text-xl font-black uppercase text-blue-900 italic">Fuel History Registry</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                        Consolidated real-time record across authorized lifting nodes
                    </CardDescription>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {dbError && (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-orange-200">
                        <WifiOff className="h-3 w-3" /> <span>Registry Unstable</span>
                    </div>
                )}
                <Button variant="outline" size="sm" onClick={handleDownload} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
                    <FileDown className="h-4 w-4" /> Export Excel
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-6 bg-slate-50/50 border-b flex items-center justify-between">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                <Input
                    placeholder="Search Vehicle, Slip, Pump, User..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-[350px] h-11 rounded-2xl border-slate-200 bg-white font-bold shadow-sm focus-visible:ring-blue-900"
                />
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 font-black uppercase text-[10px] h-8 px-4">
                    {filteredEntries.length} Records Detected
                </Badge>
            </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="h-12 hover:bg-transparent border-b">
                <TableHead className="text-[10px] font-black uppercase px-6 text-slate-400">Lifting Node</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Pump Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Slip No</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle Number</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-right">Ltr / Rate</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-right">Fuel Amount</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6 text-slate-400">Username</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="h-16"><TableCell colSpan={9} className="px-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : filteredEntries.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No entries detected in registry scope.</TableCell></TableRow>
              ) : (
                filteredEntries.map(entry => (
                    <TableRow key={entry.id} className="h-16 hover:bg-blue-50/30 transition-colors border-b last:border-0 group">
                      <TableCell className="px-6 font-bold text-slate-600 uppercase text-[11px]">{entry.plantName}</TableCell>
                      <TableCell className="px-4 font-bold text-slate-800 text-[11px] uppercase truncate max-w-[180px]">{entry.pumpName}</TableCell>
                      <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter">{entry.slipNo}</TableCell>
                      <TableCell className="px-4 text-center text-xs font-bold text-slate-500 whitespace-nowrap">{isValid(new Date(entry.date)) ? format(new Date(entry.date), 'dd.MM.yy') : 'N/A'}</TableCell>
                      <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{entry.vehicleNumber}</TableCell>
                      <TableCell className="px-4 text-right text-[11px] font-bold text-slate-500">{entry.fuelLiters.toFixed(2)} / {entry.fuelRate.toFixed(2)}</TableCell>
                      <TableCell className="px-4 text-right font-black text-blue-900">₹ {entry.fuelAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge className={cn(
                            "text-[9px] uppercase font-black px-2.5 h-6",
                            entry.paymentStatus === 'Paid' ? 'bg-emerald-600 text-white' : 
                            entry.paymentStatus === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-600 text-white'
                        )}>
                            {entry.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 text-[10px] font-black uppercase text-slate-400">{entry.userName || '--'}</TableCell>
                    </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
