'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, where, onSnapshot, doc, getDocs, orderBy, limit, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Loader2, WifiOff, ClipboardCheck, Factory, Search, Trash2, Weight, MapPin, Truck, History, Smartphone } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, normalizePlantId, parseSafeDate } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import TaskModal from '@/components/dashboard/supervisor-task/TaskModal';
import TaskHistoryTable from '@/components/dashboard/supervisor-task/TaskHistoryTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Pagination from '@/components/dashboard/vehicle-management/Pagination';

const LIVE_TASKS_PER_PAGE = 10;

/**
 * @fileOverview Supervisor Task Hub.
 * Optimized for high-density manifest verification and audit trails.
 */
function SupervisorTaskContent() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();

    const [selectedPlant, setSelectedPlant] = useState('all-plants');
    const [searchTerm, setSearchTerm] = useState('');
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [livePage, setLivePage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);
    
    const [vehicleEntries, setVehicleEntries] = useState<any[]>([]);
    const [trips, setTrips] = useState<any[]>([]);
    const [shipments, setShipments] = useState<any[]>([]);
    const [lrs, setLrs] = useState<any[]>([]);
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
        if (!firestore || !user || !allPlants) return;

        const syncAuth = async () => {
            try {
                const searchEmail = user.email;
                if (!searchEmail) return;
                
                const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
                const qSnap = await getDocs(q);
                let userDocSnap = null;
                if (!qSnap.empty) userDocSnap = qSnap.docs[0];

                let authIds: string[] = [];
                const isAdminSession = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
                const isRoot = isAdminSession || userDocSnap?.data()?.username === 'sikkaind';

                if (userDocSnap) {
                    const userData = userDocSnap.data();
                    authIds = isRoot ? allPlants.map((p: any) => p.id) : (userData.plantIds || []);
                } else if (isRoot) {
                    authIds = allPlants.map((p: any) => p.id);
                }

                setIsAdmin(isRoot);
                const normalized = authIds.map(normalizePlantId);
                setAuthorizedPlantIds(normalized);
                
                if (normalized.length > 0 && selectedPlant === 'all-plants' && !isRoot) {
                    setSelectedPlant(normalized[0]);
                }
            } catch (e) {
                console.error("Auth Handshake Failure:", e);
                setDbError(true);
            }
        };
        syncAuth();
    }, [firestore, user, allPlants]);

    useEffect(() => {
        if (!firestore || authorizedPlantIds.length === 0) return;

        const unsubscribers: (() => void)[] = [];
        setIsLoading(true);

        const normalizedAuthIds = authorizedPlantIds.map(id => id.toLowerCase());

        unsubscribers.push(onSnapshot(collection(firestore, "vehicleEntries"), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setVehicleEntries(list.filter(e => isAdmin || normalizedAuthIds.includes(normalizePlantId(e.plantId).toLowerCase())));
            setIsLoading(false);
        }, () => setDbError(true)));

        authorizedPlantIds.forEach(pId => {
            const pIdNorm = normalizePlantId(pId).toLowerCase();

            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/trips`), (snap) => {
                const list = snap.docs.map(d => ({ ...d.data(), id: d.id, originPlantId: pId }));
                setTrips(prev => {
                    const others = prev.filter(t => normalizePlantId(t.originPlantId).toLowerCase() !== pIdNorm);
                    return [...others, ...list];
                });
            }));

            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/shipments`), (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() }));
                setShipments(prev => {
                    const others = prev.filter(s => normalizePlantId(s.originPlantId).toLowerCase() !== pIdNorm);
                    return [...others, ...list];
                });
            }));

            unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/lrs`), (snap) => {
                const list = snap.docs.map(d => ({ ...d.data(), id: d.id, originPlantId: pId }));
                setLrs(prev => {
                    const others = prev.filter(l => normalizePlantId(l.originPlantId).toLowerCase() !== pIdNorm);
                    return [...others, ...list];
                });
            }));

            const historyRef = query(collection(firestore, `plants/${pId}/supervisor_tasks`), orderBy("timestamp", "desc"), limit(50));
            unsubscribers.push(onSnapshot(historyRef, (snap) => {
                const list = snap.docs.map(d => ({ ...d.data(), id: d.id, originPlantId: pId, timestamp: parseSafeDate(d.data().timestamp) }));
                setHistory(prev => {
                    const others = prev.filter(h => normalizePlantId(h.originPlantId).toLowerCase() !== pIdNorm);
                    const combined = [...others, ...list];
                    return combined.sort((a,b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
                });
            }));
        });

        return () => unsubscribers.forEach(u => u());
    }, [firestore, JSON.stringify(authorizedPlantIds), isAdmin]);

    const activeTasks = useMemo(() => {
        const tasksMap = new Map<string, any>();
        const normalizedAuthIds = authorizedPlantIds.map(id => id.toLowerCase());

        trips.forEach(trip => {
            const tripPlantId = normalizePlantId(trip.originPlantId).toLowerCase();
            const isAuthorized = isAdmin || normalizedAuthIds.includes(tripPlantId);
            
            if (!isAuthorized || trip.loadingVerified) return;

            const rawStatus = (trip.tripStatus || trip.currentStatusId || '').toLowerCase().trim().replace(/[\s/_-]+/g, '-');
            const validLoadingStatuses = ['assigned', 'vehicle-assigned', 'yard', 'loading', 'yard-loading', 'loaded', 'loading-complete'];
            
            if (!validLoadingStatuses.includes(rawStatus)) return;

            const shipId = Array.isArray(trip.shipmentIds) ? trip.shipmentIds[0] : trip.shipmentIds;
            const shipment = shipments.find(s => (s.id === shipId || s.shipmentId === shipId) && normalizePlantId(s.originPlantId).toLowerCase() === tripPlantId);
            
            if (shipment?.currentStatusId === 'Cancelled') return;

            const entryVNo = trip.vehicleNumber?.toUpperCase().replace(/\s/g, '');
            const entry = vehicleEntries.find(e => 
                e.vehicleNumber?.toUpperCase().replace(/\s/g, '') === entryVNo && 
                normalizePlantId(e.plantId).toLowerCase() === tripPlantId &&
                e.status === 'IN' &&
                !e.isTaskCompleted
            );

            const isReadyForTask = !!entry;
            const lr = lrs.find(l => (l.tripDocId === trip.id || l.tripId === trip.tripId || l.lrNumber === trip.lrNumber) && normalizePlantId(l.originPlantId).toLowerCase() === tripPlantId);
            const plantNode = allPlants?.find((p: any) => normalizePlantId(p.id).toLowerCase() === tripPlantId);
            const pName = plantNode?.name || trip.originPlantId;
            
            const plannedUnits = (shipment?.items || []).reduce((sum: number, i: any) => sum + (Number(i.units) || 0), 0) || Number(shipment?.totalUnits || trip.totalUnits || 0);

            tasksMap.set(trip.id, {
                id: trip.id,
                tripId: trip.tripId || '--', 
                lrNumber: lr?.lrNumber || trip.lrNumber || shipment?.lrNumber || '--',
                realTripId: trip.id,
                plantId: trip.originPlantId,
                plantName: pName,
                purpose: entry?.purpose || 'Loading',
                vehicleNumber: trip.vehicleNumber,
                driverName: trip.driverName || entry?.driverName || '--',
                driverMobile: trip.driverMobile || entry?.driverMobile || '--',
                from: trip.loadingPoint || shipment?.loadingPoint || pName,
                shipTo: trip.shipToParty || shipment?.shipToParty || shipment?.billToParty || '--',
                destination: trip.unloadingPoint || shipment?.unloadingPoint || trip.destination || '--',
                assignedQty: Number(trip.assignedQtyInTrip || trip.assignQty || shipment?.quantity || 0),
                plannedUnits,
                status: entry ? 'IN' : 'AWAITING ARRIVAL',
                isReadyForTask,
                entryData: entry,
                shipmentItems: shipment?.items || [],
                timestamp: parseSafeDate(trip.startDate) || new Date(),
                consignor: shipment?.consignor || trip.consignor || '--'
            });
        });

        return Array.from(tasksMap.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [trips, vehicleEntries, shipments, allPlants, lrs, authorizedPlantIds, isAdmin]);

    const filteredTasks = useMemo(() => {
        const selectedNorm = normalizePlantId(selectedPlant).toLowerCase();
        return activeTasks.filter(t => {
            const matchesPlant = selectedPlant === 'all-plants' || normalizePlantId(t.plantId).toLowerCase() === selectedNorm;
            const s = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm || 
                t.vehicleNumber?.toLowerCase().includes(s) || 
                t.driverName?.toLowerCase().includes(s) ||
                t.tripId?.toLowerCase().includes(s) ||
                t.lrNumber?.toLowerCase().includes(s);
            return matchesPlant && matchesSearch;
        });
    }, [activeTasks, selectedPlant, searchTerm]);

    const totalLivePages = Math.ceil(filteredTasks.length / LIVE_TASKS_PER_PAGE);
    const paginatedTasks = useMemo(() => {
        const start = (livePage - 1) * LIVE_TASKS_PER_PAGE;
        return filteredTasks.slice(start, start + LIVE_TASKS_PER_PAGE);
    }, [filteredTasks, livePage]);

    const flattenedHistory = useMemo(() => {
        const flattened: any[] = [];
        let sorted = [...history];
        
        if (selectedPlant !== 'all-plants') {
            const selectedNorm = normalizePlantId(selectedPlant).toLowerCase();
            sorted = sorted.filter(h => normalizePlantId(h.originPlantId).toLowerCase() === selectedNorm);
        }
        
        if (historySearchTerm) {
            const s = historySearchTerm.toLowerCase();
            sorted = sorted.filter(h => 
                h.tripId?.toLowerCase().includes(s) ||
                h.vehicleNumber?.toLowerCase().includes(s) ||
                h.lrNumber?.toLowerCase().includes(s) ||
                h.consignor?.toLowerCase().includes(s) ||
                h.shipTo?.toLowerCase().includes(s)
            );
        }

        sorted.forEach(taskDoc => {
            const items = taskDoc.items || [];
            if (items.length === 0) {
                flattened.push({ ...taskDoc, taskItem: null, taskId: taskDoc.id });
            } else {
                items.forEach((item: any, idx: number) => {
                    flattened.push({
                        ...taskDoc,
                        taskItem: item,
                        taskId: taskDoc.id,
                        isFirstOfTask: idx === 0,
                        originPlantId: taskDoc.originPlantId
                    });
                });
            }
        });
        return flattened;
    }, [history, selectedPlant, historySearchTerm]);

    const totalHistoryPages = Math.ceil(flattenedHistory.length / historyItemsPerPage);
    const paginatedHistory = useMemo(() => {
        const start = (historyPage - 1) * historyItemsPerPage;
        return flattenedHistory.slice(start, start + historyItemsPerPage);
    }, [flattenedHistory, historyPage, historyItemsPerPage]);

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
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase italic">Supervisor Task Hub</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lifting & Receiving Registry Verification</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Factory className="h-3 w-3" /> Plant Node Registry
                        </Label>
                        <Select value={selectedPlant} onValueChange={(v) => { setSelectedPlant(v); setLivePage(1); setHistoryPage(1); }}>
                            <SelectTrigger className="w-[220px] h-10 rounded-xl bg-white border-slate-200 font-bold shadow-sm">
                                <SelectValue placeholder="Pick node" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all-plants" className="font-black uppercase text-[10px] tracking-widest text-blue-600">All Authorized Nodes</SelectItem>
                                {(allPlants || []).filter((p: any) => isAdmin || authorizedPlantIds.some(aid => normalizePlantId(aid).toLowerCase() === normalizePlantId(p.id).toLowerCase())).map((p: any) => (
                                    <SelectItem key={p.id} value={normalizePlantId(p.id)} className="font-bold py-3 uppercase italic text-black">{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {dbError && (
                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold border border-orange-200 uppercase tracking-wider animate-pulse">
                            <WifiOff className="h-3 w-3" /> <span>REGISTRY SYNC ISSUE</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-10">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group">
                    <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Live Task Allocation</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Source: Gate Registry | Handshake Pulse</CardDescription>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-900 transition-colors" />
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
                                        <TableHead className="px-4 text-right">Qty (MT)</TableHead>
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
                                                    <Badge variant="outline" className={cn("text-[9px] font-black px-2 py-0.5 uppercase", task.purpose === 'Loading' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                                                        {task.purpose}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs text-center uppercase">{task.tripId}</TableCell>
                                                <TableCell className="px-4 font-bold text-slate-900 text-center uppercase">{task.lrNumber}</TableCell>
                                                <TableCell className="px-4 font-black text-slate-900 tracking-tighter text-[13px] text-center uppercase">{task.vehicleNumber}</TableCell>
                                                <TableCell className="px-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-700 uppercase">{task.driverName || '--'}</span>
                                                        <span className="text-[9px] font-mono text-slate-400">{task.driverMobile}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-[11px] truncate max-w-[120px] italic">"{task.from}"</TableCell>
                                                <TableCell className="px-4 font-bold text-slate-800 uppercase text-[11px] truncate max-w-[150px]">{task.shipTo}</TableCell>
                                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-[11px] truncate max-w-[150px]">{task.destination}</TableCell>
                                                <TableCell className="px-4 text-right font-black text-blue-900">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span>{Number(task.assignedQty).toFixed(3)}</span>
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

                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
                            <div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900 italic">Task Completion Ledger</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Audit trail of verified yard missions</CardDescription>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                                <Input 
                                    placeholder="Filter Ledger (Trip, LR, Vehicle)..." 
                                    value={historySearchTerm} 
                                    onChange={e => { setHistorySearchTerm(e.target.value); setHistoryPage(1); }}
                                    className="pl-10 h-10 w-[300px] rounded-xl bg-white border-slate-200 shadow-sm font-bold focus-visible:ring-blue-900"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-slate-400">Rows:</span>
                                <Select value={historyItemsPerPage.toString()} onValueChange={(v) => { setHistoryItemsPerPage(Number(v)); setHistoryPage(1); }}>
                                    <SelectTrigger className="h-9 w-[80px] rounded-lg border-slate-200 bg-white font-black text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {[10, 25, 50, 100].map(v => <SelectItem key={v} value={v.toString()} className="font-bold py-2">{v}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <TaskHistoryTable 
                            data={paginatedHistory} 
                            isAdmin={isAdmin} 
                            onRemove={handleRemoveHistoryTask} 
                            onEdit={(task) => setTaskModalData({ ...task, isHistoryEdit: true })}
                        />
                        <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
                            <Pagination 
                                currentPage={historyPage} 
                                totalPages={totalHistoryPages} 
                                onPageChange={setHistoryPage} 
                                itemCount={flattenedHistory.length}
                                canPreviousPage={historyPage > 1}
                                canNextPage={historyPage < totalHistoryPages}
                            />
                        </div>
                    </CardContent>
                </Card>
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

export default function SupervisorTaskPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-[#f8fafc]"><Loader2 className="h-10 w-10 animate-spin text-blue-900" /></div>}>
            <SupervisorTaskContent />
        </Suspense>
    );
}
