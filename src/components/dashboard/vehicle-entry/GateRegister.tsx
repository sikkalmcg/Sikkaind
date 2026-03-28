
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, History, Search, FileDown, Loader2, WifiOff, Clock, User, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { format, differenceInHours } from 'date-fns';
import { cn, normalizePlantId } from '@/lib/utils';
import * as XLSX from 'xlsx';
import type { VehicleEntryExit, Plant } from '@/types';

export default function GateRegister({ plants: providedPlants = [] }: { plants?: any[] }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [entries, setEntries] = useState<VehicleEntryExit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Master Registry for name resolution if not provided
  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: masterPlants } = useCollection<Plant>(plantsQuery);

  const activePlants = useMemo(() => {
    return providedPlants.length > 0 ? providedPlants : (masterPlants || []);
  }, [providedPlants, masterPlants]);

  useEffect(() => {
    if (!firestore || !user) return;

    // Registry Listener: Latest 100 movements
    const q = query(collection(firestore, "vehicleEntries"), orderBy("entryTimestamp", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snap) => {
        const allEntries = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setEntries(allEntries);
        setIsLoading(false);
    }, (error) => {
        console.error("Registry Sync Failure:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return entries;
    const s = searchTerm.toLowerCase();
    return entries.filter(e => 
        e.vehicleNumber?.toLowerCase().includes(s) ||
        e.driverName?.toLowerCase().includes(s) ||
        e.lrNumber?.toLowerCase().includes(s) ||
        e.purpose?.toLowerCase().includes(s)
    );
  }, [entries, searchTerm]);

  const handleExport = () => {
    const exportData = filteredData.map(e => ({
        'Plant': activePlants.find(p => p.id === e.plantId)?.name || e.plantId,
        'Vehicle No': e.vehicleNumber,
        'Pilot': e.driverName,
        'Purpose': e.purpose,
        'Status': e.status,
        'In Date/Time': e.entryTimestamp ? format(e.entryTimestamp.toDate ? e.entryTimestamp.toDate() : new Date(e.entryTimestamp), 'dd-MM-yy HH:mm') : '--',
        'Out Date/Time': e.exitTimestamp ? format(e.exitTimestamp.toDate ? e.exitTimestamp.toDate() : new Date(e.exitTimestamp), 'dd-MM-yy HH:mm') : '--',
        'Operator': e.userName || 'System'
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gate Registry");
    XLSX.writeFile(wb, "Gate_Control_Registry.xlsx");
  };

  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-slate-50 border-b p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3"><ClipboardCheck className="h-8 w-8" /></div>
                <div>
                    <CardTitle className="text-xl font-black uppercase italic tracking-tight text-blue-900">Gate History Ledger</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Historical Movement Audit Node</CardDescription>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input 
                        placeholder="Quick search registry..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 w-[300px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900 font-bold shadow-inner"
                    />
                </div>
                <Button variant="outline" onClick={handleExport} className="h-11 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
                    <FileDown className="h-4 w-4" /> Export Ledger
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="h-14 hover:bg-transparent border-b">
                        <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Lifting Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle Number</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Pilot</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center">Purpose</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center">Status</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center">Gate IN</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center">Gate OUT</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Stay Time</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={8} className="h-64 text-center"><Loader2 className="h-10 w-10 animate-spin inline-block text-blue-900 opacity-20" /></TableCell></TableRow>
                    ) : filteredData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                                No movement records detected in history.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredData.map((e) => {
                            const inTime = e.entryTimestamp?.toDate ? e.entryTimestamp.toDate() : new Date(e.entryTimestamp);
                            const outTime = e.exitTimestamp ? (e.exitTimestamp.toDate ? e.exitTimestamp.toDate() : new Date(e.exitTimestamp)) : null;
                            const stay = outTime ? differenceInHours(outTime, inTime) : differenceInHours(new Date(), inTime);

                            return (
                                <TableRow key={e.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                    <TableCell className="px-8 font-black text-slate-600 uppercase text-xs">
                                        {activePlants.find(p => p.id === e.plantId)?.name || e.plantId}
                                    </TableCell>
                                    <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter text-[13px]">
                                        {e.vehicleNumber}
                                    </TableCell>
                                    <TableCell className="px-4 font-bold text-slate-700 uppercase text-[10px]">
                                        {e.driverName}
                                    </TableCell>
                                    <TableCell className="px-4 text-center">
                                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2.5 h-6", e.purpose === 'Loading' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                            {e.purpose}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 text-center">
                                        <Badge className={cn("text-[9px] font-black uppercase px-3 h-6 border-none shadow-sm", e.status === 'IN' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white')}>
                                            {e.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 text-center text-[10px] font-black text-slate-500 font-mono whitespace-nowrap">
                                        {format(inTime, 'dd/MM HH:mm')}
                                    </TableCell>
                                    <TableCell className="px-4 text-center text-[10px] font-black text-blue-700 font-mono whitespace-nowrap">
                                        {outTime ? format(outTime, 'dd/MM HH:mm') : '--:--'}
                                    </TableCell>
                                    <TableCell className="px-8 text-right font-black text-slate-900">
                                        {stay} HRS
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
