'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Radar, MapPin, Truck, PlayCircle, Loader2, ArrowRightLeft, UserCircle, Factory, ShieldCheck } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, onSnapshot, limit, Timestamp } from "firebase/firestore";
import { format } from 'date-fns';
import { cn, normalizePlantId } from '@/lib/utils';
import type { Trip, SubUser, Plant } from '@/types';

export default function UpcomingVehicles({ onVehicleInClick }: { onVehicleInClick: (trip: any) => void }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Authorization Node
  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchUpcoming = async () => {
        setIsLoading(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            if (!userQSnap.empty) userDocSnap = userQSnap.docs[0];

            let authPlantIds: string[] = [];
            const isAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdmin;
                authPlantIds = isRoot ? (plants || []).map(p => p.id) : (userData.plantIds || []);
            } else if (isAdmin) {
                authPlantIds = (plants || []).map(p => p.id);
            }

            if (authPlantIds.length === 0) {
                setIsLoading(false);
                return;
            }

            // Real-time listener for assigned trips
            const q = query(collection(firestore, "trips"), where("tripStatus", "==", "Assigned"));
            const unsub = onSnapshot(q, async (snap) => {
                const assigned = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                
                // Filter by authorized plants
                const filtered = assigned.filter(t => authPlantIds.some(aid => normalizePlantId(aid) === normalizePlantId(t.originPlantId)));
                
                // Cross-check with Gate Registry to exclude vehicles already IN
                const gateSnap = await getDocs(query(collection(firestore, "vehicleEntries"), where("status", "==", "IN")));
                const inVehicles = new Set(gateSnap.docs.map(d => d.data().vehicleNumber?.toUpperCase()));
                
                const reallyUpcoming = filtered.filter(t => !inVehicles.has(t.vehicleNumber?.toUpperCase()));
                
                setUpcomingTrips(reallyUpcoming);
                setIsLoading(false);
            });

            return () => unsub();
        } catch (e) {
            console.error(e);
            setIsLoading(false);
        }
    };

    fetchUpcoming();
  }, [firestore, user, plants]);

  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-slate-50 border-b p-8">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3"><Clock className="h-8 w-8" /></div>
                <div>
                    <CardTitle className="text-xl font-black uppercase italic tracking-tight text-blue-900">Upcoming Missions</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Vehicles Assigned & Awaiting Yard Arrival</CardDescription>
                </div>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-black uppercase text-[10px] h-8 px-4 flex gap-2">
                <Radar className="h-3 w-3 animate-pulse" /> Scanning Registry
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="h-14 hover:bg-transparent border-b">
                        <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Lifting Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Trip ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle registry</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Pilot detail</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Ship to party</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-400">Manifest weight</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={7} className="h-64 text-center"><Loader2 className="h-10 w-10 animate-spin inline-block text-blue-900 opacity-20" /></TableCell></TableRow>
                    ) : upcomingTrips.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                                No upcoming missions detected in registry scope.
                            </TableCell>
                        </TableRow>
                    ) : (
                        upcomingTrips.map((trip) => (
                            <TableRow key={trip.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                <TableCell className="px-8 font-black text-slate-600 uppercase text-xs">
                                    {plants?.find(p => p.id === trip.originPlantId)?.name || trip.originPlantId}
                                </TableCell>
                                <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs uppercase">
                                    {trip.tripId}
                                </TableCell>
                                <TableCell className="px-4 font-black text-slate-900 uppercase tracking-tighter text-[13px]">
                                    {trip.vehicleNumber}
                                </TableCell>
                                <TableCell className="px-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-700 uppercase">{trip.driverName || 'N/A'}</span>
                                        <span className="text-[9px] font-mono text-slate-400">{trip.driverMobile || '--'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[200px]">
                                    {trip.shipToParty || '--'}
                                </TableCell>
                                <TableCell className="px-4 text-right font-black text-blue-900">
                                    {trip.assignedQtyInTrip} MT
                                </TableCell>
                                <TableCell className="px-8 text-right">
                                    <Button 
                                        onClick={() => onVehicleInClick(trip)}
                                        className="h-9 px-6 rounded-xl bg-blue-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 border-none"
                                    >
                                        Initialize IN
                                    </Button>
                                </TableCell>
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
