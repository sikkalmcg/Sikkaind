'use client';

import { useState, useMemo, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Truck, MapPin, Clock, History, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { format, differenceInHours } from 'date-fns';
import { normalizePlantId } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AvailableVehiclesTabProps {
  plantsList: any[];
  filterPlantId?: string;
}

export default function AvailableVehiclesTab({ plantsList, filterPlantId }: AvailableVehiclesTabProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    
    const q = query(collection(firestore, "vehicleEntries"), where("status", "==", "IN"));
    const unsub = onSnapshot(q, (snap) => {
        const active = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                entryTimestamp: data.entryTimestamp instanceof Timestamp ? data.entryTimestamp.toDate() : new Date(data.entryTimestamp)
            };
        });
        setVehicles(active);
        setLoading(false);
    });

    return () => unsub();
  }, [firestore]);

  const filtered = useMemo(() => {
    let result = vehicles;
    
    if (filterPlantId && filterPlantId !== 'all-plants') {
        const normId = normalizePlantId(filterPlantId);
        result = result.filter(v => normalizePlantId(v.plantId) === normId);
    }

    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        result = result.filter(v => 
            v.vehicleNumber?.toLowerCase().includes(s) ||
            v.driverName?.toLowerCase().includes(s) ||
            v.remarks?.toLowerCase().includes(s)
        );
    }

    return result.sort((a, b) => b.entryTimestamp.getTime() - a.entryTimestamp.getTime());
  }, [vehicles, filterPlantId, searchTerm]);

  const getStayHours = (entryTime: Date) => {
    return Math.max(0, differenceInHours(new Date(), entryTime));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
            <div>
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600"/> Yard Presence Registry
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Live monitoring of assets currently logged inside the gate</p>
            </div>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                <Input 
                    placeholder="Search Vehicle or Pilot..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 rounded-2xl bg-white border-slate-200 shadow-sm font-bold w-[300px]" 
                />
            </div>
        </div>

        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="h-14 hover:bg-transparent border-b">
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Lifting Node</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle Registry</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Pilot Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">In-Gate Timestamp</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Stay Duration</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Gate Remark</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin inline-block text-blue-900 opacity-20" /></TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No vehicles detected in current yard scope.</TableCell></TableRow>
                            ) : (
                                filtered.map((v) => {
                                    const plant = plantsList.find(p => normalizePlantId(p.id) === normalizePlantId(v.plantId));
                                    const hours = getStayHours(v.entryTimestamp);
                                    const isExcessive = hours > 24;

                                    return (
                                        <TableRow key={v.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                            <TableCell className="px-8 font-black text-slate-600 uppercase text-xs">
                                                {plant?.name || v.plantId}
                                            </TableCell>
                                            <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter text-[13px]">
                                                {v.vehicleNumber}
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700 uppercase">{v.driverName}</span>
                                                    <span className="text-[9px] font-mono text-slate-400">{v.driverMobile || '--'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 text-center font-black text-blue-700 text-[11px] font-mono uppercase">
                                                {format(v.entryTimestamp, 'dd/MM HH:mm')}
                                            </TableCell>
                                            <TableCell className="px-4 text-center">
                                                <Badge className={cn(
                                                    "font-black uppercase text-[10px] px-4 py-1 border-none shadow-sm",
                                                    isExcessive ? "bg-red-600 text-white animate-pulse" : "bg-blue-900 text-white"
                                                )}>
                                                    {hours} HRS
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-8 text-right italic font-bold text-slate-400 text-[11px] uppercase">
                                                {v.remarks || 'Standard Entry'}
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
    </div>
  );
}