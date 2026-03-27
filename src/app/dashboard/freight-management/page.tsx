
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Trip, Freight, Shipment, Plant, SubUser } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import PendingFreightTable from '@/components/dashboard/freight-management/PendingFreightTable';
import PaidTripsTable from '@/components/dashboard/freight-management/PaidTripsTable';
import MakePaymentModal from '@/components/dashboard/freight-management/MakePaymentModal';
import ViewFreightModal from '@/components/dashboard/freight-management/ViewFreightModal';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, getDocs, doc, getDoc, query, onSnapshot, where, limit, Timestamp, orderBy } from "firebase/firestore";
import { Loader2, WifiOff, Filter, IndianRupee, Clock, CheckCircle2, TrendingUp, Search, Factory, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/ui/badge';
import { cn, normalizePlantId } from '@/lib/utils';

/**
 * @fileOverview Freight Settlement Hub (Freight Management).
 * Implements two-tab ERP workflow: Requested (Pending) -> Settled.
 */

function FreightManagementContent() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const searchParams = useSearchParams();

    // REGISTRY STATE
    const [freightRegistry, setFreightRegistry] = useState<WithId<Freight>[]>([]);
    const [tripRegistry, setTripRegistry] = useState<WithId<Trip>[]>([]);
    const [shipmentRegistry, setShipmentRegistry] = useState<WithId<Shipment>[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [dbError, setDbError] = useState(false);
    const [modalState, setModalState] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
    
    const [selectedPlant, setSelectedPlant] = useState<string>('all-plants');
    const [selectedTransporter, setSelectedTransporter] = useState<string>('all');
    const [localSearch, setLocalSearch] = useState(searchParams.get('search') || '');

    // 1. Fetch Master Registry of Plants for the Filter Dropdown
    const masterPlantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
        [firestore]
    );
    const { data: allPlants } = useCollection<Plant>(masterPlantsQuery);

    // Sync local search with global search node
    useEffect(() => {
        const globalSearch = searchParams.get('search');
        if (globalSearch !== null) {
            setLocalSearch(globalSearch);
        }
    }, [searchParams]);

    /**
     * MULTI-NODE REGISTRY SYNC
     */
    useEffect(() => {
        if (!firestore || !user) return;

        let unsubscribers: (() => void)[] = [];

        const setupSync = async () => {
            setIsLoading(true);
            try {
                const lastIdentity = localStorage.getItem('slmc_last_identity');
                const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
                
                let userDocSnap = null;
                const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) userDocSnap = qSnap.docs[0];

                const isAdminSession = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
                setIsAdmin(isAdminSession);
                
                let authIds: string[] = [];
                const activePlants = allPlants && allPlants.length > 0 ? allPlants : mockPlants;

                if (userDocSnap) {
                    const userData = userDocSnap.data() as SubUser;
                    authIds = (userData.username === 'sikkaind' || isAdminSession) ? activePlants.map(p => p.id) : (userData.plantIds || []);
                } else if (isAdminSession) {
                    authIds = activePlants.map(p => p.id);
                }

                setAuthorizedPlantIds(authIds);
                if (authIds.length > 0 && selectedPlant === 'all-plants' && !isAdminSession) {
                    setSelectedPlant(authIds[0]);
                }

                if (authIds.length === 0) {
                    setIsLoading(false);
                    return;
                }

                authIds.forEach(pId => {
                    const parseDate = (val: any) => val instanceof Timestamp ? val.toDate() : (val ? new Date(val) : new Date());

                    unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/freights`), (snap) => {
                        const plantFreights = snap.docs.map(d => {
                            const fData = d.data();
                            return { 
                                id: d.id, 
                                originPlantId: pId, 
                                ...fData,
                                lastUpdated: fData.lastUpdated ? parseDate(fData.lastUpdated) : new Date(),
                                payments: (fData.payments || []).map((p: any) => ({
                                    ...p,
                                    paymentDate: parseDate(p.paymentDate)
                                }))
                            } as WithId<Freight>;
                        });
                        setFreightRegistry(prev => [...prev.filter(f => f.originPlantId !== pId), ...plantFreights]);
                        setIsLoading(false);
                    }, (err) => setDbError(true)));

                    unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/trips`), (snap) => {
                        const plantTrips = snap.docs.map(d => ({ 
                            id: d.id, 
                            originPlantId: pId, 
                            ...d.data(),
                            startDate: d.data().startDate ? parseDate(d.data().startDate) : new Date()
                        } as WithId<Trip>));
                        setTripRegistry(prev => [...prev.filter(t => t.originPlantId !== pId), ...plantTrips]);
                    }));

                    unsubscribers.push(onSnapshot(collection(firestore, `plants/${pId}/shipments`), (snap) => {
                        const plantShipments = snap.docs.map(d => ({ id: d.id, originPlantId: pId, ...d.data() } as WithId<Shipment>));
                        setShipmentRegistry(prev => [...prev.filter(s => s.originPlantId !== pId), ...plantShipments]);
                    }));
                });

            } catch (error) {
                console.error("Settlement Sync Failure:", error);
                setDbError(true);
                setIsLoading(false);
            }
        };

        setupSync();
        return () => unsubscribers.forEach(u => u());
    }, [firestore, user, allPlants]);

    /**
     * REGISTRY JOIN LOGIC
     */
    const enrichedFreights = useMemo(() => {
        return freightRegistry.map(f => {
            const trip = tripRegistry.find(t => t.id === f.tripId);
            if (!trip) return null;
            
            const shipment = shipmentRegistry.find(s => s.id === trip.shipmentIds?.[0]);
            if (!shipment) return null;
            
            const activePlants = allPlants && allPlants.length > 0 ? allPlants : mockPlants;
            const plant = activePlants.find(p => normalizePlantId(p.id) === normalizePlantId(f.originPlantId)) || { id: f.originPlantId, name: f.originPlantId };

            const chargesTotal = (f.charges || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
            const baseAmt = Number(f.baseFreightAmount || f.totalFreightAmount || 0);
            const totalFreight = baseAmt + chargesTotal;
            
            const totalPaidRegistry = (f.payments || []).reduce((sum, p) => 
                sum + (Number(p.paidAmount || p.amount || 0) + Number(p.tdsAmount || 0) + Number(p.deductionAmount || 0)), 
            0);
            
            const advance = Number(f.advanceAmount || 0);
            const effectiveBalance = totalFreight - totalPaidRegistry - advance;

            return {
                ...f,
                trip,
                shipment,
                plant: plant as any,
                originPlantId: f.originPlantId,
                baseFreightAmount: baseAmt,
                advanceAmount: advance,
                totalFreightAmount: totalFreight,
                paidAmount: totalPaidRegistry + advance,
                balanceAmount: effectiveBalance <= 0.01 ? 0 : effectiveBalance
            } as any;
        }).filter((f): f is any => f !== null).sort((a,b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    }, [freightRegistry, tripRegistry, shipmentRegistry, allPlants]);

    const filteredFreights = useMemo(() => {
        let result = enrichedFreights;
        
        if (selectedPlant !== 'all-plants') {
            result = result.filter(f => normalizePlantId(f.originPlantId) === normalizePlantId(selectedPlant));
        }

        if (selectedTransporter !== 'all') {
            result = result.filter(f => f.trip.transporterName === selectedTransporter);
        }

        if (localSearch) {
            const s = localSearch.toLowerCase();
            result = result.filter(f => 
                f.trip.tripId.toLowerCase().includes(s) || 
                f.trip.vehicleNumber?.toLowerCase().includes(s) ||
                f.trip.lrNumber?.toLowerCase().includes(s) ||
                f.shipment.consignor?.toLowerCase().includes(s) ||
                f.shipment.billToParty?.toLowerCase().includes(s) ||
                (f.payments && f.payments.some((p: any) => p.slipNumber?.toLowerCase().includes(s)))
            );
        }
        return result;
    }, [enrichedFreights, selectedPlant, selectedTransporter, localSearch]);

    const summary = useMemo(() => {
        const res = { total: 0, paid: 0, pending: 0, count: 0 };
        filteredFreights.forEach(f => {
            const total = Number(f.totalFreightAmount || 0);
            const paid = Number(f.paidAmount || 0);
            res.total += total;
            res.paid += paid;
            res.pending += Math.max(0, total - paid);
            res.count++;
        });
        return res;
    }, [filteredFreights]);

    // TABLE CATEGORIZATION NODE
    const requestedFreights = useMemo(() => filteredFreights.filter(f => 
        f.trip.freightStatus === 'Requested' || f.trip.freightStatus === 'Under Process'
    ), [filteredFreights]);

    const settledFreights = useMemo(() => filteredFreights.filter(f => 
        f.trip.freightStatus === 'Paid' || f.trip.freightStatus === 'Closed'
    ), [filteredFreights]);

    const transporters = useMemo(() => {
        const names = tripRegistry
            .map(t => t.transporterName)
            .filter((name): name is string => !!name && name.trim() !== '');
        return Array.from(new Set(names)).sort();
    }, [tripRegistry]);

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3">
                        <IndianRupee className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight uppercase italic">Freight Settlement Hub</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry &gt; Downstream Financial Liquidation</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Factory className="h-3 w-3" /> Plant Node Registry
                        </Label>
                        <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                            <SelectTrigger className="w-[220px] h-10 rounded-xl bg-white border-slate-200 font-bold shadow-sm">
                                <SelectValue placeholder="Pick Node" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all-plants" className="font-black uppercase text-[10px] tracking-widest text-blue-600">All Plant Node</SelectItem>
                                {(allPlants || mockPlants).map(p => (
                                    <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-8">
                {/* KPI INDICATORS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Registry Freight', value: summary.total, icon: IndianRupee, color: 'text-blue-900', bg: 'bg-blue-50' },
                        { label: 'Settled Payments', value: summary.paid, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Outstanding Balance', value: summary.pending, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
                        { label: 'Active Trip Assets', value: summary.count, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', isQty: true },
                    ].map((card, i) => (
                        <Card key={i} className="border-none shadow-md rounded-2xl overflow-hidden group">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{card.label}</p>
                                        <h4 className={cn("text-2xl font-black tracking-tighter", card.color)}>
                                            {card.isQty ? card.value : `₹ ${Number(card.value).toLocaleString('en-IN')}`}
                                        </h4>
                                    </div>
                                    <div className={cn("p-2 rounded-lg transition-transform group-hover:scale-110", card.bg, card.color)}>
                                        <card.icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm border"><Filter className="h-4 w-4 text-blue-900" /></div>
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Settlement Registry</CardTitle>
                                    <CardDescription className="text-[10px] font-bold text-slate-400 uppercase">Apply scope constraints to ledger</CardDescription>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                                    <Input 
                                        placeholder="Search Trip, Vehicle, Party..." 
                                        value={localSearch}
                                        onChange={e => setLocalSearch(e.target.value)}
                                        className="pl-10 h-10 w-[300px] rounded-xl bg-white border-slate-200 shadow-sm font-bold focus-visible:ring-blue-900"
                                    />
                                </div>
                                <Select value={selectedTransporter} onValueChange={setSelectedTransporter}>
                                    <SelectTrigger className="w-[220px] h-10 rounded-xl bg-white border-slate-200 font-bold">
                                        <SelectValue placeholder="All Transporters" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">All Transporters</SelectItem>
                                        {transporters.map(name => (
                                            <SelectItem key={name} value={name}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex h-64 flex-col items-center justify-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Establishing Ledger Sync...</p>
                            </div>
                        ) : (
                            <Tabs defaultValue="request" className="w-full">
                                <TabsList className="bg-slate-50 px-6 h-12 border-b rounded-none w-full justify-start gap-8">
                                    <TabsTrigger value="request" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
                                        Requested Freight <span className="ml-2 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-[10px] font-black">{requestedFreights.length}</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="registry" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all">
                                        Settled History Registry <span className="ml-2 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black">{settledFreights.length}</span>
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="request" className="m-0 focus-visible:ring-0">
                                    <PendingFreightTable 
                                        data={requestedFreights} 
                                        onAction={setModalState}
                                    />
                                </TabsContent>
                                <TabsContent value="registry" className="m-0 focus-visible:ring-0">
                                    <PaidTripsTable 
                                        data={settledFreights} 
                                        isLoading={false}
                                    />
                                </TabsContent>
                            </Tabs>
                        )}
                    </CardContent>
                </Card>
            </div>

            {modalState?.type === 'make-payment' && (
                <MakePaymentModal 
                    isOpen={true}
                    onClose={() => setModalState(null)}
                    freight={modalState.data}
                    onSave={() => {}}
                />
            )}
            {modalState?.type === 'view' && (
                <ViewFreightModal 
                    isOpen={true}
                    onClose={() => setModalState(null)}
                    freight={modalState.data}
                />
            )}
        </div>
    );
}

export default function FreightManagementPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin" /></div>}>
            <FreightManagementContent />
        </Suspense>
    );
}
