'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, Timestamp, orderBy, limit, deleteDoc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { Loader2, WifiOff, ClipboardList, ShieldCheck, Factory, User, Search, RefreshCcw, Trash2, AlertTriangle, ClipboardCheck, Weight, MapPin, Truck, AlertCircle } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, normalizePlantId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import TaskModal from '@/components/dashboard/supervisor-task/TaskModal';
import TaskHistoryTable from '@/components/dashboard/supervisor-task/TaskHistoryTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Pagination from '@/components/dashboard/vehicle-management/Pagination';

const LIVE_TASKS_PER_PAGE = 7;

export default function SupervisorTaskPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();

    const [selectedPlant, setSelectedPlant] = useState('all-plants');
    const [searchTerm, setSearchTerm] = useState('');
    const [livePage, setLivePage] = useState(1);
    
    const [vehicleEntries, setVehicleEntries] = useState<any[]>([]);
    const [trips, setTrips] = useState<any[]>([]);
    const [shipments, setShipments] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    
    const [taskModalData, setTaskModalData] = useState<any | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState(false);

    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
        [firestore]
    );
    const { data: allPlants } = useCollection<any>(plantsQuery);

    useEffect(() => {
        if (!firestore || !user) return;

        const syncAuth = async () => {
            try {
                const lastIdentity = localStorage.getItem('slmc_last_identity');
                const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
                
                let userDocSnap = null;
                const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) {
                    userDocSnap = qSnap.docs[0];
                } else {
                    const directRef = doc(firestore, "users", user.uid);
                    const directSnap = await getDoc(directRef);
                    if (directSnap.exists()) userDocSnap = directSnap;
                }

                const baseList = allPlants && allPlants.length > 0 ? allPlants : [];
                let authIds: string[] = [];
                const isAdminSession = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
                const isRoot = isAdminSession || userDocSnap?.data()?.username === 'sikkaind';

                if (userDocSnap) {
                    authIds = isRoot ? baseList.map(p => p.id) : (userDocSnap.data().plantIds || []);
                } else if (isRoot) {
                    authIds = baseList.map(p => p.id);
                }

                setIsAdmin(isRoot);
                setAuthorizedPlantIds(authIds);
                
                if (authIds.length > 0 && selectedPlant === 'all-plants' && !isRoot) {
                    setSelectedPlant(authIds[0]);
                }
            } catch (e) {
                setDbError(true);
            }
        };
        syncAuth();
    }, [firestore, user, allPlants, selectedPlant]);

    useEffect(() => {
        if (!firestore || authorizedPlantIds.length === 0) return;

        const unsubscribers: (() => void)[] = [];
        setIsLoading(true);

        const normalizedAuthIds = authorizedPlantIds.map(normalizePlantId);

        const qGate = collection(firestore, "vehicleEntries");
        const unsubGate = onSnapshot(qGate, (snap) => {
            const activeVehicles = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(d => isAdmin || normalizedAuthIds.includes(normalizePlantId(d.plantId)));
            setVehicleEntries(activeVehicles);
            setIsLoading(false);
        });
        unsubscribers.push(unsubGate);

        authorizedPlantIds.forEach(pId => {
            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/trips`), (snap) => {
                const plantTrips = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() }));
                setTrips(prev => {
                    const otherPlants = prev.filter(t => t.originPlantId !== pId);
                    return [...otherPlants, ...plantTrips];
                });
            }));

            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/shipments`), (snap) => {
                const plantShipments = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() }));
                setShipments(prev => {
                    const otherPlants = prev.filter(s => s.originPlantId !== pId);
                    return [...otherPlants, ...plantShipments];
                });
            }));

            const historyRef = query(
                collection(firestore, `plants/${pId}/supervisor_tasks`), 
                orderBy("timestamp", "desc"), 
                limit(50)
            );
            const unsubHistory = onSnapshot(historyRef, (snap) => {
                const plantHistory = snap.docs.map(d => ({
                    id: d.id,
                    originPlantId: pId,
                    ...d.data(),
                    timestamp: d.data().timestamp instanceof Timestamp ? d.data().timestamp.toDate() : new Date(d.data().timestamp)
                }));
                setHistory(prev => {
                    const otherPlants = prev.filter(h => h.originPlantId !== pId);
                    const combined = [...otherPlants, ...plantHistory];
                    return combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                });
            });
            unsubscribers.push(unsubHistory);
        });

        return () => unsubscribers.forEach(u => u());
    }, [firestore, authorizedPlantIds, isAdmin]);

    const activeTasks = useMemo(() => {
        const tasks: any[] = [];

        trips.forEach(trip => {
            const s = trip.tripStatus?.toLowerCase() || '';
            if (s !== 'assigned' && s !== 'vehicle assigned') return;

            const hasVehicle = trip.vehicleNumber && trip.vehicleNumber.trim() !== '';
            if (!hasVehicle) return;

            const entry = vehicleEntries.find(e => e.tripId === trip.id || (e.vehicleNumber === trip.vehicleNumber && e.status === 'IN'));
            if (entry?.isTaskCompleted) return;

            const shipment = shipments.find(s => s.id === trip.shipmentIds?.[0]);
            if (shipment?.currentStatusId === 'Cancelled') return;

            const normalizedPlantIdStr = normalizePlantId(trip.originPlantId);
            const pName = allPlants?.find((p: any) => normalizePlantId(p.id) === normalizedPlantIdStr)?.name || trip.originPlantId;

            tasks.push({
                id: entry?.id || `trip-${trip.id}`,
                tripId: trip.tripId,
                lrNumber: trip.lrNumber || shipment?.lrNumber || '--',
                realTripId: trip.id,
                plantId: trip.originPlantId,
                plantName: pName,
                purpose: 'Loading',
                vehicleNumber: trip.vehicleNumber,
                driverName: trip.driverName,
                driverMobile: trip.driverMobile,
                from: trip.loadingPoint || shipment?.loadingPoint || pName,
                shipTo: trip.shipToParty || shipment?.shipToParty || '--',
                destination: trip.unloadingPoint || shipment?.unloadingPoint || '--',
                assignedQty: trip.assignedQtyInTrip || 0,
                status: entry ? 'IN' : 'AWAITING ARRIVAL',
                isReadyForTask: !!entry, 
                entryData: entry,
                originalTask: entry || { id: trip.id, ...trip }
            });
        });

        vehicleEntries.forEach(entry => {
            if (entry.purpose !== 'Unloading' || entry.status !== 'IN' || entry.isTaskCompleted) return;

            const hasVehicle = entry.vehicleNumber && entry.vehicleNumber.trim() !== '';
            if (!hasVehicle) return;

            const normalizedEntryPlantId = normalizePlantId(entry.plantId);
            const pName = allPlants?.find((p: any) => normalizePlantId(p.id) === normalizedEntryPlantId)?.name || entry.plantId;

            tasks.push({
                id: entry.id,
                tripId: entry.tripId || '--',
                lrNumber: entry.lrNumber || '--',
                plantId: entry.plantId,
                plantName: pName,
                purpose: 'Unloading',
                vehicleNumber: entry.vehicleNumber,
                driverName: entry.driverName,
                driverMobile: entry.driverMobile || '--',
                from: entry.from || '--',
                shipTo: entry.shipToParty || '--',
                destination: entry.unloadingPoint || pName,
                assignedQty: entry.billedQty || 0,
                billedQty: entry.billedQty || 0,
                qtyType: entry.qtyType || 'MT',
                invoiceNo: entry.documentNo || '--',
                goodsDesc: entry.items || '--',
                status: 'IN',
                isReadyForTask: true,
                entryData: entry,
                originalTask: entry
            });
        });

        return tasks;
    }, [trips, vehicleEntries, shipments, allPlants]);

    const filteredTasks = useMemo(() => {
        return activeTasks.filter(t => {
            const matchesPlant = selectedPlant === 'all-plants' || normalizePlantId(t.plantId) === normalizePlantId(selectedPlant);
            const s = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm || 
                t.vehicleNumber?.toLowerCase().includes(s) || 
                t.driverName?.toLowerCase().includes(s) ||
                t.tripId?.toLowerCase().includes(s);
            return matchesPlant && matchesSearch;
        });
    }, [activeTasks, selectedPlant, searchTerm]);

    const totalLivePages = Math.ceil(filteredTasks.length / LIVE_TASKS_PER_PAGE);
    const paginatedTasks = useMemo(() => {
        const start = (livePage - 1) * LIVE_TASKS_PER_PAGE;
        return filteredTasks.slice(start, start + LIVE_TASKS_PER_PAGE);
    }, [filteredTasks, livePage]);

    const sortedHistory = useMemo(() => {
        let result = history;
        if (selectedPlant !== 'all-plants') {
            result = result.filter(h => normalizePlantId(h.originPlantId) === normalizePlantId(selectedPlant));
        }
        return result;
    }, [history, selectedPlant]);

    const handleRemoveHistoryTask = async (taskId: string, plantId: string) => {
        if (!isAdmin || !firestore) return;
        showLoader();
        try {
            await deleteDoc(doc(firestore, `plants/${plantId}/supervisor_tasks`, taskId));
            toast({ title: "Node Removed", description: "Registry history record permanently erased." });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Error", description: e.message });
        } finally {
            hideLoader();
        }
    };

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
            <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-xl rotate-3">
                        <ClipboardCheck className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Supervisor Task Hub</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lifting & Receiving Registry Verification</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Factory className="h-3 w-3" /> Plant Node registry
                        </Label>
                        {!isAdmin && authorizedPlantIds.length === 1 ? (
                            <div className="h-10 px-4 flex items-center bg-blue-50 border border-blue-100 rounded-xl text-blue-900 font-black text-xs shadow-sm uppercase min-w-[220px]">
                                <ShieldCheck className="h-3.5 w-3.5 mr-2 text-blue-600" /> {allPlants?.find((p: any) => normalizePlantId(p.id) === normalizePlantId(authorizedPlantIds[0]))?.name || authorizedPlantIds[0]}
                            </div>
                        ) : (
                            <Select value={selectedPlant} onValueChange={(v) => { setSelectedPlant(v); setLivePage(1); }}>
                                <SelectTrigger className="w-[220px] h-10 rounded-xl bg-white border-slate-200 font-bold shadow-sm">
                                    <SelectValue placeholder="Pick node" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all-plants" className="font-black uppercase text-[10px] tracking-widest text-blue-600">All Authorized Nodes</SelectItem>
                                    {(allPlants || []).filter(p => isAdmin || authorizedPlantIds.some(aid => normalizePlantId(aid) === normalizePlantId(p.id))).map(p => (
                                        <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    {dbError && (
                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold border border-orange-200 uppercase tracking-wider">
                            <WifiOff className="h-3 w-3" /> <span>Registry Sync Issue</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-10">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group">
                    <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Live Task Allocation</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Source: Assigned Fleet | Registry Handshake</CardDescription>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                            <Input 
                                placeholder="Search Vehicle, Pilot, Trip..." 
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setLivePage(1); }}
                                className="pl-10 h-10 w-[300px] rounded-xl bg-white border-slate-200 shadow-sm font-bold focus-visible:ring-blue-900"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table className="border-collapse w-full min-w-[1800px]">
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="h-12 border-b border-slate-100 hover:bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <TableHead className="px-6">Plant</TableHead>
                                        <TableHead className="px-4 text-center">Purpose</TableHead>
                                        <TableHead className="px-4 text-center">Trip ID</TableHead>
                                        <TableHead className="px-4 text-center">LR Number</TableHead>
                                        <TableHead className="px-4 text-center">Vehicle No</TableHead>
                                        <TableHead className="px-4">Pilot Detail</TableHead>
                                        <TableHead className="px-4">FROM</TableHead>
                                        <TableHead className="px-4">Ship To</TableHead>
                                        <TableHead className="px-4">Destination</TableHead>
                                        <TableHead className="px-4 text-right">Qty</TableHead>
                                        <TableHead className="px-4 text-center">Gate Status</TableHead>
                                        <TableHead className="px-8 text-right sticky right-0 bg-slate-50/50">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({length: 5}).map((_, i) => (
                                            <TableRow key={i} className="h-16"><TableCell colSpan={12} className="p-6"><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                                        ))
                                    ) : paginatedTasks.length === 0 ? (
                                        <TableRow><TableCell colSpan={12} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No assigned tasks detected in yard.</TableCell></TableRow>
                                    ) : (
                                        paginatedTasks.map((task) => (
                                            <TableRow key={task.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                                <TableCell className="px-6 font-bold text-slate-600 uppercase text-[11px]">{task.plantName}</TableCell>
                                                <TableCell className="px-4 text-center">
                                                    <Badge variant="outline" className={cn("text-[9px] uppercase font-black px-2 py-0.5", task.purpose === 'Loading' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                                        {task.purpose}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter uppercase text-[11px] text-center">{task.tripId}</TableCell>
                                                <TableCell className="px-4 font-bold text-slate-900 text-center uppercase">{task.lrNumber}</TableCell>
                                                <TableCell className="px-4 font-black text-slate-900 tracking-tighter uppercase text-[13px] text-center">{task.vehicleNumber}</TableCell>
                                                <TableCell className="px-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700">{task.driverName || '--'}</span>
                                                        <span className="font-mono text-[10px] text-slate-400">{task.driverMobile}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-[11px] truncate max-w-[120px] italic">"{task.from}"</TableCell>
                                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-[11px] truncate max-w-[150px]">{task.shipTo}</TableCell>
                                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-[11px] truncate max-w-[150px]">{task.destination}</TableCell>
                                                <TableCell className="px-4 text-right font-black text-blue-900">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span>{task.assignedQty} MT</span>
                                                        <Weight className="h-3 w-3 opacity-20" />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 text-center">
                                                    <Badge className={cn(
                                                        "font-black uppercase text-[8px] px-3 h-5 border-none shadow-sm",
                                                        task.status === 'IN' ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
                                                    )}>
                                                        {task.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-8 text-right sticky right-0 bg-white group-hover:bg-blue-50/30 transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="inline-block">
                                                                    <Button 
                                                                        disabled={!task.isReadyForTask}
                                                                        onClick={() => setTaskModalData(task)} 
                                                                        className={cn(
                                                                            "h-8 rounded-lg font-black text-[10px] uppercase tracking-widest px-6 shadow-lg border-none active:scale-95 transition-all",
                                                                            task.isReadyForTask ? "bg-blue-900 hover:bg-slate-900 text-white" : "bg-slate-100 text-slate-300 cursor-not-allowed"
                                                                        )}
                                                                    >
                                                                        Action Task
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            {!task.isReadyForTask && (
                                                                <TooltipContent className="bg-slate-900 text-white border-none shadow-2xl p-3">
                                                                    <p className="text-[10px] font-black uppercase flex items-center gap-2"><AlertCircle className="h-3 w-3 text-amber-400" /> Awaiting Arrival</p>
                                                                    <p className="text-xs font-medium mt-1">Task node activates upon gate entry registry pulse.</p>
                                                                </TooltipContent>
                                                            )}
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
                            <Pagination 
                                currentPage={livePage} 
                                totalPages={totalLivePages} 
                                onPageChange={setLivePage} 
                                itemCount={filteredTasks.length}
                                canPreviousPage={livePage > 1}
                                canNextPage={livePage < totalLivePages}
                            />
                        </div>
                    </CardContent>
                </Card>

                <TaskHistoryTable data={sortedHistory} isAdmin={isAdmin} onRemove={handleRemoveHistoryTask} />
            </div>

            {taskModalData && (
                <TaskModal 
                    isOpen={!!taskModalData}
                    onClose={() => setTaskModalData(null)}
                    task={taskModalData}
                    onSuccess={() => setTaskModalData(null)}
                />
            )}
        </main>
    );
}
