'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Edit2, Search, Lock, Truck, Factory, ShieldCheck } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import type { VehicleEntryExit, Plant, WithId, SubUser } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc, updateDoc, getDoc, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import AvailableVehicleStatusModal from './AvailableVehicleStatusModal';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, normalizePlantId } from '@/lib/utils';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AvailableVehiclesTabProps {
    plantsList?: WithId<Plant>[];
    filterPlantId?: string;
}

const ITEMS_PER_PAGE = 10;

export default function AvailableVehiclesTab({ plantsList, filterPlantId }: AvailableVehiclesTabProps) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<'all' | 'Loading' | 'Unloading'>('all');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WithId<VehicleEntryExit>[]>([]);
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [statusModalItem, setStatusModalItem] = useState<WithId<VehicleEntryExit> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync Plants for Name Resolution
  useEffect(() => {
    if (!db) return;
    if (plantsList && plantsList.length > 0) {
        setPlants(plantsList);
        return;
    }
    const fetchPlants = async () => {
        try {
            const snap = await getDocs(collection(db, "logistics_plants"));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Plant>));
            setPlants(list.length > 0 ? list : mockPlants);
        } catch (e) {
            setPlants(mockPlants);
        }
    };
    fetchPlants();
  }, [db, plantsList]);

  // Robust Registry Listener with Identity Handshake
  useEffect(() => {
    if (!db || !user) return;

    let unsubscribe: () => void = () => {};

    const setupListener = async () => {
        setLoading(true);
        try {
            // 1. High-Fidelity Identity Handshake
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(db, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            
            if (!userQSnap.empty) {
                userDocSnap = userQSnap.docs[0];
            } else {
                const uidSnap = await getDoc(doc(db, "users", user.uid));
                if (uidSnap.exists()) userDocSnap = uidSnap;
            }
            
            let authorizedPlantIds: string[] = [];
            const isRootAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isRootAdmin;
                
                if (isRoot) {
                    authorizedPlantIds = plants.map(p => p.id);
                } else {
                    authorizedPlantIds = userData.plantIds || [];
                }
            } else if (isRootAdmin) {
                authorizedPlantIds = plants.map(p => p.id);
            }

            // 2. Real-time Registry Filter
            const q = query(collection(db, "vehicleEntries"), where("status", "==", "IN"));

            unsubscribe = onSnapshot(q, (querySnapshot) => {
                const results: any[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const normalizedEntryPlantId = normalizePlantId(data.plantId);
                    
                    const isAuthorized = isRootAdmin || authorizedPlantIds.some(authId => 
                        normalizePlantId(authId) === normalizedEntryPlantId
                    );
                    
                    if (isAuthorized) {
                        results.push({ 
                            id: doc.id, 
                            ...data,
                            entryTimestamp: data.entryTimestamp instanceof Timestamp 
                                ? data.entryTimestamp.toDate() 
                                : (data.entryTimestamp ? new Date(data.entryTimestamp) : new Date())
                        });
                    }
                });

                results.sort((a, b) => b.entryTimestamp.getTime() - a.entryTimestamp.getTime());
                setEntries(results);
                setLoading(false);
            }, (error) => {
                console.error("Registry Sync Failure:", error);
                setLoading(false);
            });
        } catch (error) {
            console.error("Auth Setup Error:", error);
            setLoading(false);
        }
    };

    setupListener();
    return () => unsubscribe();
  }, [db, user, plants]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
        const pName = plants.find(p => normalizePlantId(p.id) === normalizePlantId(e.plantId))?.name || e.plantId || 'N/A';
        
        const matchesSearch = e.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (e.driverName && e.driverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            pName.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesPlantFilter = !filterPlantId || filterPlantId === 'all-plants' || normalizePlantId(e.plantId) === normalizePlantId(filterPlantId);

        let matchesPurpose = true;
        if (purposeFilter === 'Loading') {
            matchesPurpose = e.purpose === 'Loading';
        } else if (purposeFilter === 'Unloading') {
            matchesPurpose = e.purpose === 'Unloading';
        }

        return matchesSearch && matchesPlantFilter && matchesPurpose;
    });
  }, [entries, searchTerm, plants, filterPlantId, purposeFilter]);

  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE);
  const paginatedEntries = filteredEntries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleUpdateStatusSave = async (newStatus: string) => {
    if (!db || !statusModalItem || !user) return;

    try {
        const docRef = doc(db, 'vehicleEntries', statusModalItem.id);
        const currentName = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' 
            ? 'AJAY SOMRA' 
            : (user.displayName || user.email?.split('@')[0] || 'System Operator');
        
        await updateDoc(docRef, {
            remarks: newStatus,
            statusUpdatedAt: serverTimestamp(),
            statusUpdatedBy: currentName
        });

        await addDoc(collection(db, "activity_logs"), {
            userId: user.uid,
            userName: currentName,
            action: 'Edit',
            tcode: 'Status Management',
            pageName: 'Gate Registry',
            timestamp: serverTimestamp(),
            description: `Vehicle Status Transition: ${statusModalItem.vehicleNumber} marked as ${newStatus}.`
        });

        toast({ title: 'Registry Updated', description: `Vehicle ${statusModalItem.vehicleNumber} status changed to ${newStatus}.` });
        setStatusModalItem(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    }
  };

  const checkIsLocked = (entry: VehicleEntryExit) => {
    const currentStatus = entry.remarks || (entry.purpose === 'Unloading' ? 'In Process' : 'Available');
    if (entry.purpose === 'Unloading') return currentStatus !== 'In Process';
    if (entry.purpose === 'Loading') return !['Available', 'Under Maintenance', 'Break-down', 'Pilot Not Available', 'IN'].includes(currentStatus);
    return true;
  };

  const getStatusBadgeStyle = (entry: VehicleEntryExit) => {
    const s = entry.remarks || (entry.purpose === 'Unloading' ? 'In Process' : 'Available');
    switch(s) {
        case 'Available': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'Under Maintenance': return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'Break-down': return 'bg-red-100 text-red-700 border-red-200';
        case 'In Process': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Assigned': return 'bg-blue-600 text-white border-blue-700';
        default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  const getStayBadgeColor = (hours: number) => {
    if (hours > 48) return 'bg-red-500 text-white';
    if (hours > 24) return 'bg-orange-500 text-white';
    if (hours > 12) return 'bg-yellow-500 text-black';
    return 'bg-green-500 text-white';
  };

  return (
    <>
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border shadow-sm"><Truck className="h-5 w-5 text-blue-900" /></div>
                <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900">Gate Inventory Registry</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live monitor of vehicles within lifting nodes</CardDescription>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input 
                        placeholder="Search registry..." 
                        value={searchTerm} 
                        onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} 
                        className="pl-10 w-[280px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm focus-visible:ring-blue-900 font-bold" 
                    />
                </div>
                
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Purpose Filter</Label>
                    <Select value={purposeFilter} onValueChange={(v: any) => {setPurposeFilter(v); setCurrentPage(1);}}>
                        <SelectTrigger className="h-11 w-[180px] rounded-xl bg-white border-slate-200 font-bold">
                            <SelectValue placeholder="All Purpose" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Purpose</SelectItem>
                            <SelectItem value="Loading">Loading</SelectItem>
                            <SelectItem value="Unloading">Unloading</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-6 text-slate-400">Plant</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">Vehicle Registry</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">Pilot Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-slate-400">Contact</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-center">Purpose</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-center">Operational Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-center">In Time</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-4 text-center">Stay</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-14 px-6 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={9} className="p-6"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : paginatedEntries.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-64 text-center text-slate-400 italic font-medium">No vehicles detected in current gate registry scope.</TableCell></TableRow>
              ) : (
                paginatedEntries.map(entry => {
                  const stayHours = differenceInHours(new Date(), entry.entryTimestamp);
                  const pName = plants.find(p => normalizePlantId(p.id) === normalizePlantId(entry.plantId))?.name || entry.plantId || 'N/A';
                  const isLocked = checkIsLocked(entry);

                  return (
                    <TableRow key={entry.id} className="h-16 hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0 group">
                      <TableCell className="px-6 font-bold text-slate-600 uppercase whitespace-nowrap">{pName}</TableCell>
                      <TableCell className="px-4 font-black text-slate-900 tracking-tighter uppercase whitespace-nowrap">{entry.vehicleNumber}</TableCell>
                      <TableCell className="px-4 whitespace-nowrap truncate max-w-[120px] font-bold text-slate-700">{entry.driverName}</TableCell>
                      <TableCell className="px-4 font-mono text-xs font-bold text-slate-500">{entry.driverMobile}</TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge variant="outline" className={cn("text-[9px] uppercase font-black px-2 py-0.5", entry.purpose === 'Loading' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'border-orange-200 text-orange-700 bg-orange-50')}>
                            {entry.purpose || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge className={cn("text-[9px] h-6 uppercase font-black px-3 py-1 border shadow-sm", getStatusBadgeStyle(entry))}>
                            {entry.remarks || (entry.purpose === 'Unloading' ? 'In Process' : 'Available')}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-center whitespace-nowrap text-slate-500 font-mono text-[11px] font-bold">{format(entry.entryTimestamp, 'dd/MM/yy HH:mm')}</TableCell>
                      <TableCell className="px-4 text-center">
                        <Badge className={cn("text-[10px] font-black h-6 px-3", getStayBadgeColor(stayHours))}>
                            {stayHours}h
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-block">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            disabled={isLocked}
                                            onClick={() => setStatusModalItem(entry)} 
                                            className={cn(
                                                "h-8 rounded-lg font-black text-[10px] uppercase border-slate-200 transition-all",
                                                isLocked ? "bg-slate-50 text-slate-300 opacity-50 cursor-not-allowed" : "text-blue-900 hover:bg-slate-50"
                                            )}
                                        >
                                            <Edit2 className="mr-2 h-3 w-3" />
                                            Status
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {isLocked && (
                                    <TooltipContent className="bg-slate-900 text-white border-none shadow-xl">
                                        <p className="text-xs font-bold uppercase tracking-tight">Status locked due to current workflow stage</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
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

    <div className="bg-white border border-slate-200 rounded-[1.5rem] px-8 py-3 shadow-md flex items-center justify-between mt-6">
        <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
            itemCount={filteredEntries.length}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
        />
    </div>

    {statusModalItem && (
        <AvailableVehicleStatusModal
            isOpen={!!statusModalItem}
            onClose={() => setStatusModalItem(null)}
            item={statusModalItem}
            plantName={plants.find(p => normalizePlantId(p.id) === normalizePlantId(statusModalItem.plantId))?.name || 'N/A'}
            onSave={handleUpdateStatusSave}
        />
    )}
    </>
  );
}
