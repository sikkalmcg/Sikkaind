
'use client';
import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Eye, FileDown, WifiOff, Loader2, Search, Factory, Signal, Truck, MapPin, Calendar, Weight, IndianRupee } from 'lucide-react';
import { format, isValid } from 'date-fns';
import type { FuelEntry, Vehicle, WithId, Plant, FuelPump, SubUser } from '@/types';
import { mockFuelEntries, mockVehicles, mockFuelPumps, mockPlants } from '@/lib/mock-data';
import ViewFuelEntryModal from './ViewFuelEntryModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs, doc, getDoc, Timestamp, query, orderBy, where, limit } from "firebase/firestore";
import { normalizePlantId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function FuelRecordTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [entries, setEntries] = useState<WithId<FuelEntry>[]>([]);
  const [viewingEntry, setViewingEntry] = useState<WithId<FuelEntry> | null>(null);

  const firestore = useFirestore();
  const { user } = useUser();

  // Fetch Master Data for resolution
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
            // 1. High-Fidelity Identity Handshake
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

            let authPlantIds: string[] = [];
            const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' || userDocSnap?.data()?.username === 'sikkaind';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdmin;
                const basePlants = masterPlants && masterPlants.length > 0 ? masterPlants : mockPlants;
                authPlantIds = isRoot ? basePlants.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdmin) {
                const basePlants = masterPlants && masterPlants.length > 0 ? masterPlants : mockPlants;
                authPlantIds = basePlants.map(p => p.id);
            }

            if (authPlantIds.length === 0) {
                setLoading(false);
                return;
            }

            // 2. Pumps & Vehicles Mapping node
            const pumpSnap = await getDocs(collection(firestore, "fuel_pumps"));
            const pumpsMap = new Map(pumpSnap.docs.map(d => [d.id, d.data().name]));
            
            const vehicleSnap = await getDocs(collection(firestore, "vehicles"));
            const vehiclesMap = new Map(vehicleSnap.docs.map(d => [d.id, d.data()]));

            const allFetched: WithId<FuelEntry>[] = [];

            // 3. Registry Extraction across authorized partitions
            const fetchPromises = authPlantIds.map(async (pId) => {
                const q = query(collection(firestore, `plants/${pId}/fuel_entries`), orderBy("date", "desc"));
                const snapshot = await getDocs(q);
                
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const entry: any = { 
                        id: docSnap.id, 
                        ...data,
                        date: data.date instanceof Timestamp ? data.date.toDate() : (data.date ? new Date(data.date) : new Date()),
                        tripDate: data.tripDate instanceof Timestamp ? data.tripDate.toDate() : (data.tripDate ? new Date(data.tripDate) : undefined),
                        payments: (data.payments || []).map((p: any) => ({
                            ...p,
                            date: p.date instanceof Timestamp ? p.date.toDate() : (p.date ? new Date(p.date) : new Date())
                        })),
                        pumpName: pumpsMap.get(data.pumpId) || 'N/A',
                        plantName: masterPlants?.find(p => normalizePlantId(p.id) === normalizePlantId(pId))?.name || pId
                    };

                    if (data.vehicleType === 'Own Vehicle' && data.vehicleId) {
                        const vData = vehiclesMap.get(data.vehicleId) as any;
                        entry.vehicleNumber = vData?.vehicleNumber || data.vehicleNumber;
                        entry.driverName = vData?.driverName || data.driverName;
                    }

                    allFetched.push(entry);
                });
            });

            await Promise.all(fetchPromises);

            if (allFetched.length === 0) {
                setEntries([]);
            } else {
                setEntries(allFetched.sort((a,b) => b.date.getTime() - a.date.getTime()));
            }

        } catch (error) {
            console.error("Fuel Registry Error:", error);
            setDbError(true);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [firestore, user, masterPlants]);

  const handleDownload = () => {
    const dataToExport = filteredEntries.map(entry => {
        return {
            'Fuel Slip No': entry.slipNo,
            'Entry Date': isValid(new Date(entry.date)) ? format(new Date(entry.date), 'dd-MM-yyyy') : 'N/A',
            'Pump': entry.pumpName || 'N/A',
            'Vehicle Type': entry.vehicleType,
            'Vehicle Number': entry.vehicleNumber,
            'Trip Date': entry.tripDate ? format(new Date(entry.tripDate), 'dd-MM-yyyy') : '--',
            'Trip Destination': entry.tripDestination || '--',
            'Weight': entry.weight || '--',
            'Freight': entry.freight || '--',
            'Fuel Amount': entry.fuelAmount,
            'Paid Amount': entry.paidAmount,
            'Balance Amount': entry.balanceAmount,
            'Status': entry.paymentStatus,
            'Username': entry.userName || 'N/A'
        };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fuel Records");
    XLSX.writeFile(workbook, "FuelRegistryExport.xlsx");
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e =>
        Object.values(e).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [entries, searchTerm]);
  
  return (
    <>
    <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
      <CardHeader className="bg-slate-50 border-b p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg"><Signal className="h-5 w-5" /></div>
                <div>
                    <CardTitle className="text-xl font-black uppercase text-blue-900 italic">Fuel History Registry</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                        {dbError ? "Operating in local/fallback mode" : "Cloud-synchronized manifest across authorized nodes"}
                    </CardDescription>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input 
                        placeholder="Search registry..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-10 w-[280px] h-10 rounded-xl border-slate-200 bg-white font-bold" 
                    />
                </div>
                <Button variant="outline" size="sm" onClick={handleDownload} className="h-10 px-5 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 hover:bg-slate-50 shadow-sm">
                    <FileDown className="h-4 w-4" /> Export Registry
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1800px]">
            <TableHeader className="bg-slate-50/50">
              <TableRow className="h-12 hover:bg-transparent border-b">
                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Fuel Slip</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Entry Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Pump Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Vehicle Type</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle No.</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Trip Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4">Trip Destination</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-right">Weight (MT)</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-right">Freight (₹)</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-right">Fuel Amount</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-right">Paid</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-4 text-right">Balance</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="h-16"><TableCell colSpan={13} className="px-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : filteredEntries.length === 0 ? (
                <TableRow><TableCell colSpan={13} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.2em] opacity-40">No entries detected in registry scope.</TableCell></TableRow>
              ) : (
                filteredEntries.map(entry => {
                  return (
                    <TableRow key={entry.id} className="h-16 hover:bg-blue-50/30 transition-colors border-b last:border-0 group">
                      <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter">{entry.slipNo}</TableCell>
                      <TableCell className="px-4 text-center text-xs font-bold text-slate-500 whitespace-nowrap">{isValid(new Date(entry.date)) ? format(new Date(entry.date), 'dd.MM.yy') : 'N/A'}</TableCell>
                      <TableCell className="px-4 font-bold text-slate-800 text-[11px] uppercase truncate max-w-[150px]">{entry.pumpName || 'N/A'}</TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge variant="outline" className="text-[9px] font-black uppercase bg-slate-50">{entry.vehicleType}</Badge>
                      </TableCell>
                      <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter">{entry.vehicleNumber}</TableCell>
                      <TableCell className="px-4 text-center text-xs font-bold text-slate-500">
                        {entry.tripDate ? format(new Date(entry.tripDate), 'dd.MM.yy') : '--'}
                      </TableCell>
                      <TableCell className="px-4 text-[11px] font-bold text-slate-600 truncate max-w-[150px] uppercase">
                        {entry.tripDestination || '--'}
                      </TableCell>
                      <TableCell className="px-4 text-right font-bold text-slate-700">{entry.weight || '--'}</TableCell>
                      <TableCell className="px-4 text-right font-black text-slate-900">
                        {entry.freight ? `₹ ${Number(entry.freight).toLocaleString()}` : '--'}
                      </TableCell>
                      <TableCell className="px-4 text-right font-black text-slate-900">₹ {entry.fuelAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="px-4 text-right">
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-help font-black text-emerald-600 underline decoration-emerald-200 decoration-dashed underline-offset-4">
                                        ₹ {entry.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent className="p-0 border-none shadow-2xl rounded-xl overflow-hidden">
                                    {entry.payments?.length > 0 ? (
                                        <div className="bg-white min-w-[280px]">
                                            <div className="bg-slate-900 p-3 text-white text-[9px] font-black uppercase tracking-widest">Settlement History</div>
                                            <Table>
                                                <TableHeader className="bg-slate-50"><TableRow className="h-8"><TableHead className="text-[8px] h-8">Mode</TableHead><TableHead className="text-[8px] h-8 text-right">Amt</TableHead><TableHead className="text-[8px] h-8 text-center">Date</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {entry.payments.map((p, i) => (
                                                        <TableRow key={i} className="h-8"><TableCell className="text-[9px] py-1 font-bold">{p.method}</TableCell><TableCell className="text-[9px] py-1 text-right font-black text-blue-900">₹ {p.amount}</TableCell><TableCell className="text-[9px] py-1 text-center font-mono">{format(new Date(p.date), 'dd/MM/yy')}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : <div className="p-4 text-[10px] font-bold uppercase text-slate-400">No liquidation recorded.</div>}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="px-4 text-right font-black text-red-600">₹ {entry.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="px-6 text-right">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-white" onClick={() => setViewingEntry(entry)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
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
