'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Trip, Plant, WithId, SubUser, VehicleEntryExit } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { UpcomingVehicleData } from '@/app/dashboard/vehicle-entry/page';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, getDocs, doc, getDoc, Timestamp, where, limit, onSnapshot, writeBatch, serverTimestamp } from "firebase/firestore";
import { WifiOff, Search, Truck, MapPin, Calendar, Plus, Phone, Signal, Clock, AlertTriangle } from "lucide-react";
import { format, differenceInHours, isAfter, subHours } from 'date-fns';
import { normalizePlantId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

interface UpcomingVehiclesProps {
  onVehicleInClick: (tripData: UpcomingVehicleData) => void;
}

/**
 * @fileOverview Assigned Allocation Monitor (Upcoming Vehicles).
 * Tracks vehicles assigned for loading that have not yet entered the gate.
 * Implements 48-hour auto-expiry rule for registry maintenance.
 */

export default function UpcomingVehicles({ onVehicleInClick }: UpcomingVehiclesProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoading();

  const [searchTerm, setSearchTerm] = useState('');
  const [allTrips, setAllTrips] = useState<WithId<Trip>[]>([]);
  const [inVehiclesList, setInVehiclesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [cleanupTriggered, setCleanupTriggered] = useState(false);

  // Fetch all Logistics Plants for name resolution
  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<Plant>(plantsQuery);

  /**
   * 48-HOUR AUTO EXPIRY LOGIC NODE
   * Rule: If assignment age > 48h and vehicle not IN, cancel assignment.
   * Hardened: Uses batch.set with merge to prevent existence errors.
   */
  const processRegistryCleanup = useCallback(async (trips: WithId<Trip>[]) => {
    if (!firestore || !user || trips.length === 0) return;
    
    const now = new Date();
    const expiredTrips = trips.filter(t => {
        const assignedAt = t.startDate instanceof Date ? t.startDate : (t.startDate as any)?.toDate();
        if (!assignedAt) return false;
        // Check if status is still 'Assigned' before expiring
        const isActive = ['Assigned', 'Vehicle Assigned'].includes(t.currentStatusId);
        return isActive && differenceInHours(now, assignedAt) >= 48;
    });

    if (expiredTrips.length > 0) {
        const batch = writeBatch(firestore);
        expiredTrips.forEach(t => {
            if (!t.originPlantId) return;

            const tripRef = doc(firestore, `plants/${t.originPlantId}/trips`, t.id);
            const globalRef = doc(firestore, 'trips', t.id);
            
            // Revert Statuses to Registry Defaults using SET with MERGE for reliability
            batch.set(tripRef, { 
                tripStatus: 'Cancelled', 
                currentStatusId: 'cancelled', 
                lastUpdated: serverTimestamp(),
                expiryReason: 'Auto-Purge: 48h Gate-IN Timeout'
            }, { merge: true });

            batch.set(globalRef, { 
                tripStatus: 'Cancelled', 
                currentStatusId: 'cancelled', 
                lastUpdated: serverTimestamp() 
            }, { merge: true });
            
            if (t.vehicleId) {
                const vRef = doc(firestore, 'vehicles', t.vehicleId);
                batch.update(vRef, { status: 'Available' });
            }
        });

        try {
            await batch.commit();
            console.log(`[REGISTRY] Purged ${expiredTrips.length} stale assignments (48h expiry).`);
        } catch (e: any) {
            console.error("Registry cleanup handshake failed:", e);
            // Surface actual error context if possible
            const permissionError = new FirestorePermissionError({
                path: 'trips_registry_cleanup',
                operation: 'write',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        }
    }
  }, [firestore, user]);

  // Registry Cleanup Effect: Run once on data load
  useEffect(() => {
    if (!cleanupTriggered && allTrips.length > 0) {
        processRegistryCleanup(allTrips);
        setCleanupTriggered(true);
    }
  }, [allTrips, cleanupTriggered, processRegistryCleanup]);

  useEffect(() => {
    if (!firestore || !user) return;

    let unsubIn: () => void;
    let unsubTrips: (() => void)[] = [];

    const fetchData = async () => {
        setLoading(true);
        setDbError(false);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            
            if (!userQSnap.empty) userDocSnap = userQSnap.docs[0];
            else {
                const directRef = doc(firestore, "users", user.uid);
                const directSnap = await getDoc(directRef);
                if (directSnap.exists()) userDocSnap = directSnap;
            }

            let authPlantIds: string[] = [];
            const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdmin;
                const allPlantsSnap = await getDocs(collection(firestore, "logistics_plants"));
                authPlantIds = isRoot ? allPlantsSnap.docs.map(d => d.id) : (userData.plantIds || []);
            } else if (isAdmin) {
                const allPlantsSnap = await getDocs(collection(firestore, "logistics_plants"));
                authPlantIds = allPlantsSnap.docs.map(d => d.id);
            }

            if (authPlantIds.length === 0) {
                setLoading(false);
                return;
            }

            const qIn = query(collection(firestore, "vehicleEntries"), where("status", "==", "IN"));
            unsubIn = onSnapshot(qIn, (snap) => {
                const vehiclesInYard = snap.docs.map(d => (d.data() as VehicleEntryExit).vehicleNumber);
                setInVehiclesList(vehiclesInYard);
            });

            const plantTrips: Record<string, WithId<Trip>[]> = {};
            unsubTrips = authPlantIds.map(pId => {
                const tripCol = collection(firestore, `plants/${pId}/trips`);
                const qU = query(tripCol);
                
                return onSnapshot(qU, (tripSnap) => {
                    const fetchedTrips = tripSnap.docs.map(d => ({
                        id: d.id,
                        ...d.data(),
                        startDate: d.data().startDate instanceof Timestamp ? d.data().startDate.toDate() : new Date(d.data().startDate)
                    } as WithId<Trip>));
                    
                    plantTrips[pId] = fetchedTrips;
                    const combined = Object.values(plantTrips).flat();
                    const activeOnly = combined.filter(t => !['delivered', 'cancelled', 'Closed'].includes(t.currentStatusId.toLowerCase()));
                    
                    setAllTrips(activeOnly.sort((a,b) => b.startDate.getTime() - a.startDate.getTime()));
                    setLoading(false);
                });
            });

        } catch (error) {
            setDbError(true);
            setLoading(false);
        }
    };

    fetchData();
    return () => {
        if (unsubIn) unsubIn();
        unsubTrips.forEach(u => u());
    };
  }, [firestore, user]);

  const filteredTrips = useMemo(() => {
    return allTrips.filter(t => {
      if (inVehiclesList.includes(t.vehicleNumber || '')) return false;
      const isActive = ['Assigned', 'in-transit', 'Vehicle Assigned'].includes(t.currentStatusId);
      if (!isActive) return false;

      const pName = plants?.find(p => normalizePlantId(p.id) === normalizePlantId(t.originPlantId))?.name || t.originPlantId || '';
      const s = searchTerm.toLowerCase();
      return (
        t.vehicleNumber?.toLowerCase().includes(s) ||
        t.tripId.toLowerCase().includes(s) ||
        pName.toLowerCase().includes(s) ||
        t.shipToParty?.toLowerCase().includes(s) ||
        t.driverMobile?.includes(s)
      );
    });
  }, [allTrips, inVehiclesList, searchTerm, plants]);

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50 border-b p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><Truck className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-xl font-black text-blue-900 uppercase">Assigned Allocation Monitor</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Expected Vehicles Registry (Gate IN Pending)</CardDescription>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {dbError && (
                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-orange-200">
                            <WifiOff className="h-3 w-3" />
                            <span>Registry Sync Error</span>
                        </div>
                    )}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                        <Input placeholder="Search Vehicle, Trip, Destination..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-[320px] h-10 rounded-xl bg-white border-slate-200 shadow-sm font-bold" />
                    </div>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50">
                <TableRow className="border-b border-slate-200 hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Plant</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Trip ID</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-center">Assigned Date & Time</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Vehicle Number</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Driver Name</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Driver Mobile</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-left">Destination</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-right">Assigned Qty</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider h-12 px-4 text-right">Action</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={9} className="py-4"><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
                ) : filteredTrips.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={9} className="h-64 text-center text-slate-400 italic font-medium">
                            <div className="flex flex-col items-center gap-3">
                                <Signal className="h-10 w-10 opacity-10" />
                                <p>No expected vehicles in registry.</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Assignments older than 48 hours are automatically purged.</p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredTrips.map((trip) => {
                        const plantName = plants?.find(p => normalizePlantId(p.id) === normalizePlantId(trip.originPlantId))?.name || trip.originPlantId;
                        const ageHrs = differenceInHours(new Date(), trip.startDate);
                        
                        return (
                            <TableRow key={trip.id} className="hover:bg-blue-50/20 transition-colors h-16 border-b border-slate-100 group">
                                <TableCell className="px-4">
                                    <p className="font-black text-blue-900 leading-none uppercase text-[11px]">{plantName}</p>
                                </TableCell>
                                <TableCell className="px-4">
                                    <span className="font-mono text-blue-600 font-black tracking-widest text-[11px] uppercase">{trip.tripId}</span>
                                </TableCell>
                                <TableCell className="px-4 text-center">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold text-slate-700">{format(trip.startDate, 'dd-MM-yyyy')}</span>
                                        <span className="text-[9px] font-black text-slate-400 font-mono tracking-tighter">{format(trip.startDate, 'HH:mm')}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4">
                                    <span className="font-black text-slate-900 tracking-tighter uppercase text-[13px]">{trip.vehicleNumber || '---'}</span>
                                </TableCell>
                                <TableCell className="px-4">
                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{trip.driverName || '---'}</span>
                                </TableCell>
                                <TableCell className="px-4">
                                    <span className="text-xs font-bold text-slate-500 font-mono">{trip.driverMobile || '---'}</span>
                                </TableCell>
                                <TableCell className="px-4">
                                    <div className="flex items-center gap-2 max-w-[200px]">
                                        <MapPin className="h-3 w-3 text-slate-300 shrink-0" />
                                        <span className="truncate font-bold text-slate-800 text-[11px] uppercase tracking-tight">{trip.unloadingPoint}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 text-right">
                                    <span className="font-black text-blue-900 text-sm tracking-tighter">{trip.assignedQtyInTrip.toFixed(3)} MT</span>
                                </TableCell>
                                <TableCell className="px-4 text-right">
                                    <div className="flex flex-col items-end gap-1.5">
                                        <Button size="sm" onClick={() => onVehicleInClick(trip)} className="bg-blue-900 hover:bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest px-6 h-8 rounded-lg shadow-lg border-none transition-all active:scale-95">
                                            IN Vehicle
                                        </Button>
                                        {ageHrs > 24 && (
                                            <span className="text-[8px] font-black text-orange-600 uppercase flex items-center gap-1">
                                                <AlertTriangle className="h-2 w-2" /> Expiring: {48 - ageHrs}h left
                                            </span>
                                        )}
                                    </div>
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
