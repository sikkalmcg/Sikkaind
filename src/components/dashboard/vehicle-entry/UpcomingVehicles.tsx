'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Radar, Loader2, Factory } from 'lucide-react';
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { Plant } from '@/types';
import { normalizePlantId } from '@/lib/utils';

/**
 * @fileOverview Upcoming Missions Component.
 * Optimized UI node for visualizing fleet assets awaiting yard arrival.
 * Receives synchronized data from parent registry.
 */
export default function UpcomingVehicles({ 
    data, 
    isLoading, 
    onVehicleInClick 
}: { 
    data: any[], 
    isLoading: boolean, 
    onVehicleInClick: (trip: any) => void 
}) {
  const firestore = useFirestore();
  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<Plant>(plantsQuery);

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
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                                No upcoming missions detected in registry scope.
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((trip) => {
                            const plantMatch = plants?.find(p => normalizePlantId(p.id) === normalizePlantId(trip.originPlantId));
                            return (
                                <TableRow key={trip.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                    <TableCell className="px-8 font-black text-slate-600 uppercase text-xs">
                                        {plantMatch?.name || trip.originPlantId}
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
                                        {Number(trip.assignedQtyInTrip || 0).toFixed(3)} {trip.materialTypeId}
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
