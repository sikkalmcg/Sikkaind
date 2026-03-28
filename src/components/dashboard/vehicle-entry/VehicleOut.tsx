'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Truck, 
    History, 
    Search, 
    FileDown, 
    Plus, 
    ShieldCheck, 
    Clock, 
    Loader2, 
    Factory,
    Calendar as CalendarIcon,
    ArrowRightLeft,
    CheckCircle2
} from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, updateDoc, serverTimestamp, getDocs, limit, Timestamp, orderBy, onSnapshot } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { cn, normalizePlantId } from '@/lib/utils';
import { DatePicker } from '@/components/date-picker';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';

const formSchema = z.object({
  plantId: z.string().min(1, "Select Plant Node."),
  entryId: z.string().min(1, "Pick an active vehicle node."),
  exitStatus: z.enum(['Loaded', 'Empty'], { required_error: "Pick Status" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function VehicleOut() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // States for History Filters
  const [fromDate, setFromDate] = useState<Date | undefined>(startOfDay(subDays(new Date(), 7)));
  const [toDate, setToDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [searchTerm, setSearchTerm] = useState('');

  const [activeEntries, setActiveEntries] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Authorized Plants
  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<any>(plantsQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { plantId: '', entryId: '', exitStatus: 'Loaded' },
  });

  const { watch, handleSubmit, reset, setValue } = form;
  const selectedPlantId = watch('plantId');

  // Sync Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Active Vehicles based on selected plant
  useEffect(() => {
    if (!firestore || !selectedPlantId) {
        setActiveEntries([]);
        return;
    }
    
    setIsLoading(true);
    const q = query(
        collection(firestore, "vehicleEntries"), 
        where("plantId", "==", normalizePlantId(selectedPlantId)),
        where("status", "==", "IN")
    );

    const unsub = onSnapshot(q, (snap) => {
        setActiveEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setIsLoading(false);
    });

    return () => unsub();
  }, [firestore, selectedPlantId]);

  // Fetch History
  useEffect(() => {
    if (!firestore) return;
    setIsLoadingHistory(true);
    
    const q = query(
        collection(firestore, "vehicleEntries"),
        where("status", "==", "OUT"),
        orderBy("exitTimestamp", "desc"),
        limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
        setHistory(snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            exitTimestamp: d.data().exitTimestamp instanceof Timestamp ? d.data().exitTimestamp.toDate() : new Date(d.data().exitTimestamp),
            entryTimestamp: d.data().entryTimestamp instanceof Timestamp ? d.data().entryTimestamp.toDate() : new Date(d.data().entryTimestamp),
        })));
        setIsLoadingHistory(false);
    });

    return () => unsub();
  }, [firestore]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;
    
    const entry = activeEntries.find(e => e.id === values.entryId);
    if (!entry) return;

    try {
        const ts = serverTimestamp();
        const entryRef = doc(firestore, "vehicleEntries", values.entryId);
        
        await updateDoc(entryRef, {
            status: 'OUT',
            outType: values.exitStatus,
            exitTimestamp: ts,
            lastUpdated: ts
        });

        // Update linked trip if exists
        if (entry.tripId) {
            const globalTripRef = doc(firestore, 'trips', entry.tripId);
            const plantTripRef = doc(firestore, `plants/${entry.plantId}/trips`, entry.tripId);
            
            const tripUpdate = {
                tripStatus: 'In Transit',
                outDate: ts,
                lastUpdated: ts
            };
            
            await updateDoc(globalTripRef, tripUpdate);
            try { await updateDoc(plantTripRef, tripUpdate); } catch(e) {}
        }

        toast({ title: 'Success', description: `Vehicle ${entry.vehicleNumber} marked as OUT.` });
        reset({ plantId: values.plantId, entryId: '', exitStatus: 'Loaded' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter(h => {
        const dateMatch = (!fromDate || h.exitTimestamp >= fromDate) && (!toDate || h.exitTimestamp <= toDate);
        if (!dateMatch) return false;
        
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return (
            h.vehicleNumber?.toLowerCase().includes(s) ||
            h.driverName?.toLowerCase().includes(s) ||
            h.lrNumber?.toLowerCase().includes(s) ||
            h.documentNo?.toLowerCase().includes(s)
        );
    });
  }, [history, fromDate, toDate, searchTerm]);

  const handleExport = () => {
    const dataToExport = filteredHistory.map(h => ({
        'Plant': plants?.find(p => p.id === h.plantId)?.name || h.plantId,
        'Vehicle No': h.vehicleNumber,
        'Pilot': h.driverName,
        'Status': h.outType,
        'Exit Date': format(h.exitTimestamp, 'dd-MM-yyyy'),
        'Exit Time': format(h.exitTimestamp, 'HH:mm'),
        'Stay (Hrs)': Math.floor((h.exitTimestamp.getTime() - h.entryTimestamp.getTime()) / (1000 * 60 * 60))
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gate Exit History");
    XLSX.writeFile(wb, "Gate_Exit_History.xlsx");
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
        {/* Form Section */}
        <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="p-8 pb-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-900 text-white rounded-xl shadow-lg">
                        <Plus className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-black uppercase text-blue-900 italic">FINALIZE GATE EXIT (OUT)</CardTitle>
                        <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">RECORD GATE DEPARTURE AND MISSION STATUS</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                <Form {...form}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                            {/* Exit Timestamp Box */}
                            <div className="p-6 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2 shadow-inner">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">EXIT TIMESTAMP</p>
                                <p className="text-sm font-black text-blue-900 font-mono tracking-tighter">
                                    {format(currentTime, 'dd-MM-yyyy HH:mm')}
                                </p>
                            </div>

                            <FormField name="plantId" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">PLANT NODE *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-12 bg-white rounded-xl font-black text-slate-700 shadow-sm border-slate-200">
                                                <SelectValue placeholder="Pick node" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            {plants?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic">{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />

                            <FormField name="entryId" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">VEHICLES CURRENTLY IN *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPlantId || isLoading}>
                                        <FormControl>
                                            <SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 shadow-sm border-slate-200">
                                                <SelectValue placeholder={isLoading ? "Syncing..." : "Pick vehicle"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            {activeEntries.map(e => <SelectItem key={e.id} value={e.id} className="font-bold py-3 uppercase">{e.vehicleNumber} | {e.driverName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />

                            <FormField name="exitStatus" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">EXIT STATUS *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-12 bg-white rounded-xl font-black text-slate-700 shadow-sm border-slate-200">
                                                <SelectValue placeholder="Pick Status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="Loaded" className="font-bold py-3">LOADED</SelectItem>
                                            <SelectItem value="Empty" className="font-bold py-3">EMPTY</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>

                        <div className="flex items-center justify-end gap-8 pt-4">
                            <Button type="button" variant="ghost" onClick={() => reset()} className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all">
                                DISCARD ENTRY
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={form.formState.isSubmitting} 
                                className="bg-blue-900/80 hover:bg-blue-900 text-white px-16 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95"
                            >
                                {form.formState.isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5 mr-3" />}
                                FINALIZE SYSTEM OUT
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>

        {/* History Section */}
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg">
                        <History className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase italic">GATE EXIT HISTORY</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">PERMANENT RECORD OF DEPARTURES</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                    <div className="grid gap-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">DATE RANGE REGISTRY</label>
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                            <DatePicker date={fromDate} setDate={setFromDate} className="border-none h-8 bg-transparent font-bold text-xs" />
                            <span className="text-slate-300 font-bold px-1">to</span>
                            <DatePicker date={toDate} setDate={setToDate} className="border-none h-8 bg-transparent font-bold text-xs" />
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">REGISTRY SEARCH</label>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                            <Input 
                                placeholder="Vehicle, LR, Invoice..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 h-10 w-[240px] rounded-xl border-slate-200 bg-white font-bold shadow-inner focus-visible:ring-blue-900"
                            />
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleExport} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-slate-600 bg-white shadow-sm hover:bg-slate-50">
                        <FileDown className="h-4 w-4" /> EXPORT HISTORY
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/80">
                                <TableRow className="h-14 hover:bg-transparent border-b">
                                    <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">PLANT</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">VEHICLE NO</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">PILOT</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center">EXIT STATUS</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center">GATE IN</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center">GATE OUT</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">STAY DURATION</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingHistory ? (
                                    <TableRow><TableCell colSpan={7} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin inline-block text-blue-900 opacity-20" /></TableCell></TableRow>
                                ) : filteredHistory.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No departure records found.</TableCell></TableRow>
                                ) : (
                                    filteredHistory.map((h) => {
                                        const stayHours = Math.floor((h.exitTimestamp.getTime() - h.entryTimestamp.getTime()) / (1000 * 60 * 60));
                                        const stayMins = Math.floor(((h.exitTimestamp.getTime() - h.entryTimestamp.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
                                        
                                        return (
                                            <TableRow key={h.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                                <TableCell className="px-8 font-black text-slate-600 uppercase text-xs">
                                                    {plants?.find(p => p.id === h.plantId)?.name || h.plantId}
                                                </TableCell>
                                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter text-[13px]">
                                                    {h.vehicleNumber}
                                                </TableCell>
                                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-[10px]">
                                                    {h.driverName}
                                                </TableCell>
                                                <TableCell className="px-4 text-center">
                                                    <Badge variant="outline" className={cn(
                                                        "text-[9px] font-black uppercase px-2.5 h-6",
                                                        h.outType === 'Loaded' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                                    )}>
                                                        {h.outType}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-4 text-center text-[10px] font-black text-slate-400 font-mono whitespace-nowrap">
                                                    {format(h.entryTimestamp, 'dd/MM HH:mm')}
                                                </TableCell>
                                                <TableCell className="px-4 text-center text-[10px] font-black text-blue-700 font-mono whitespace-nowrap">
                                                    {format(h.exitTimestamp, 'dd/MM HH:mm')}
                                                </TableCell>
                                                <TableCell className="px-8 text-right font-black text-slate-900 uppercase text-[10px]">
                                                    {stayHours}H {stayMins}M
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
    </div>
  );
}
