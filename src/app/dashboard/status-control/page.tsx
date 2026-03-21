'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UpdateStatusForm from '@/components/dashboard/status-management/UpdateStatusForm';
import StatusHistory from '@/components/dashboard/status-management/StatusHistory';
import DeliveredModal from '@/components/dashboard/status-management/DeliveredModal';
import AvailableVehiclesTab from '@/components/dashboard/status-management/AvailableVehiclesTab';
import { mockPlants } from '@/lib/mock-data';
import type { WithId, Trip, StatusUpdate, SubUser, Plant, VehicleEntryExit, VehicleStatus, TripStatus, PODStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, getDoc, updateDoc, serverTimestamp, Timestamp, addDoc, orderBy, limit, runTransaction, onSnapshot, getDocs } from "firebase/firestore";
import { Loader2, WifiOff, Activity, ShieldCheck, History, Truck, Factory, Settings2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { normalizePlantId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';

function StatusControlContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'update-status');
  const [selectedPlant, setSelectedPlant] = useState('all-plants');
  const [activeTrips, setActiveTrips] = useState<WithId<Trip>[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<WithId<VehicleEntryExit>[]>([]);
  const [statusHistory, setStatusHistory] = useState<WithId<StatusUpdate>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [operatorFullName, setOperatorFullName] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tripForDelivery, setTripForDelivery] = useState<WithId<Trip> | null>(null);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', val);
    router.replace(`/dashboard/status-control?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchAuth = async () => {
        setIsAuthLoading(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                userDocSnap = qSnap.docs[0];
            } else {
                const directSnap = await getDoc(doc(firestore, "users", user.uid));
                if (directSnap.exists()) userDocSnap = directSnap;
            }

            const baseList = allMasterPlants && allMasterPlants.length > 0 ? allMasterPlants : mockPlants;
            let authIds: string[] = [];

            const isRootAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.jobRole === 'System Administrator' || userData.username?.toLowerCase() === 'sikkaind' || isRootAdmin;
                authIds = isRoot ? baseList.map(p => p.id) : (userData.plantIds || []);
                setIsAdmin(isRoot);
                setOperatorFullName(userData.fullName || userData.username || 'Operator');
            } else if (isRootAdmin) {
                authIds = baseList.map(p => p.id);
                setIsAdmin(true);
                setOperatorFullName('AJAY SOMRA');
            } else {
                setOperatorFullName(user.displayName || user.email?.split('@')[0] || 'Operator');
            }
            
            setAuthorizedPlantIds(authIds);
            
            if (authIds.length > 0) {
                if (isAdmin || isRootAdmin) setSelectedPlant('all-plants');
                else setSelectedPlant(authIds[0]);
            }
        } catch (error) {
            console.error("Status Control Auth Sync Error:", error);
        } finally {
            setIsAuthLoading(false);
        }
    };

    fetchAuth();
  }, [firestore, user, allMasterPlants, isAdmin]);

  useEffect(() => {
    if (!dbError && !isAuthLoading && authorizedPlantIds.length > 0 && firestore) {
        setIsLoading(true);
        const unsubscribers: (() => void)[] = [];

        const qVeh = query(collection(firestore, "vehicleEntries"), where("status", "==", "IN"));
        const unsubVehicles = onSnapshot(qVeh, (snap) => {
            const vehicles = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as WithId<VehicleEntryExit>))
                .filter(v => authorizedPlantIds.some(aid => normalizePlantId(aid) === normalizePlantId(v.plantId)));
            setAvailableVehicles(vehicles);
        });
        unsubscribers.push(unsubVehicles);

        authorizedPlantIds.forEach((pId) => {
            const tripRef = collection(firestore, `plants/${pId}/trips`);
            const unsubTrips = onSnapshot(tripRef, (snap) => {
                const plantTrips = snap.docs.map(doc => {
                    const data = doc.data();
                    return { 
                        id: doc.id, 
                        ...data,
                        originPlantId: pId,
                        startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : new Date(data.startDate)
                    } as WithId<Trip>;
                }).filter(t => {
                    const status = t.tripStatus?.toLowerCase();
                    return status !== 'trip closed' && status !== 'closed' && status !== 'cancelled';
                });

                setActiveTrips(prev => {
                    const others = prev.filter(t => t.originPlantId !== pId);
                    return [...others, ...plantTrips];
                });
                setIsLoading(false);
            });

            const historyRef = query(collection(firestore, `plants/${pId}/status_updates`), orderBy("timestamp", "desc"), limit(50));
            const unsubHistory = onSnapshot(historyRef, (snap) => {
                const plantHistory = snap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        id: doc.id,
                        originPlantId: pId,
                        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
                        previousStatusTimestamp: data.previousStatusTimestamp instanceof Timestamp ? data.previousStatusTimestamp.toDate() : (data.previousStatusTimestamp ? new Date(data.previousStatusTimestamp) : undefined)
                    } as WithId<StatusUpdate>;
                });

                setStatusHistory(prev => {
                    const others = prev.filter(h => h.originPlantId !== pId);
                    const combined = [...others, ...plantHistory];
                    return combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                });
            });

            unsubscribers.push(unsubTrips, unsubHistory);
        });

        return () => unsubscribers.forEach(unsub => unsub());
    }
  }, [firestore, user, authorizedPlantIds, isAuthLoading, dbError]);

  const filteredActiveTrips = useMemo(() => {
    if (!selectedPlant || selectedPlant === 'all-plants') return activeTrips;
    return activeTrips.filter(t => normalizePlantId(t.originPlantId) === normalizePlantId(selectedPlant));
  }, [activeTrips, selectedPlant]);

  const filteredAvailableVehicles = useMemo(() => {
    if (!selectedPlant || selectedPlant === 'all-plants') return availableVehicles;
    return availableVehicles.filter(v => normalizePlantId(v.plantId) === normalizePlantId(selectedPlant));
  }, [availableVehicles, selectedPlant]);

  const filteredStatusHistory = useMemo(() => {
    if (!selectedPlant || selectedPlant === 'all-plants') return statusHistory;
    return statusHistory.filter(h => normalizePlantId(h.originPlantId) === normalizePlantId(selectedPlant));
  }, [statusHistory, selectedPlant]);

  const handleStatusUpdate = async (id: string, newStatus: string, location: string, remarks?: string, isTripUpdate: boolean = true) => {
    if (!firestore || !user) return;

    const currentName = operatorFullName || (user.displayName || user.email?.split('@')[0] || 'Operator');

    if (isTripUpdate) {
        const trip = activeTrips.find(t => t.id === id);
        if (!trip) return;

        if (newStatus === 'Delivered') {
            setTripForDelivery(trip);
            setIsModalOpen(true);
        } else {
            showLoader();
            try {
                await runTransaction(firestore, async (transaction) => {
                    const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
                    const globalTripRef = doc(firestore, 'trips', trip.id);
                    const historyRef = doc(collection(firestore, `plants/${trip.originPlantId}/status_updates`));
                    
                    const currentStatus = trip.tripStatus;
                    
                    const updateData: any = {
                        tripStatus: newStatus as TripStatus,
                        currentStatusId: newStatus,
                        lastUpdated: serverTimestamp(),
                    };

                    if (newStatus === 'Arrived' || newStatus === 'Arrival for Delivery') {
                        updateData.arrivalDate = serverTimestamp();
                    }

                    if (newStatus === 'Under-Maintenance' || newStatus === 'Breakdown') {
                        updateData.vehicleStatus = newStatus as VehicleStatus;
                        if (trip.vehicleId) {
                            const vRef = doc(firestore, 'vehicles', trip.vehicleId);
                            const vSnap = await transaction.get(vRef);
                            if (vSnap.exists()) {
                                transaction.update(vRef, { status: newStatus as VehicleStatus });
                            }
                        }
                    }

                    transaction.update(tripRef, updateData);
                    transaction.update(globalTripRef, updateData);

                    // HIGH-FIDELITY HISTORY LOGGING
                    transaction.set(historyRef, {
                        tripId: trip.tripId,
                        vehicleNumber: trip.vehicleNumber || 'N/A',
                        shipToParty: trip.shipToParty || 'N/A',
                        unloadingPoint: trip.unloadingPoint || 'N/A',
                        previousStatus: currentStatus,
                        previousStatusTimestamp: trip.lastUpdated || trip.startDate,
                        newStatus: newStatus,
                        timestamp: serverTimestamp(),
                        updatedBy: currentName,
                        remarks: remarks || ''
                    });
                });

                toast({ title: 'Status Committed', description: `Mission registry updated to ${newStatus}.` });
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Registry Error', description: error.message });
            } finally {
                hideLoader();
            }
        }
    }
  };

  const handleDeliveryComplete = async (trip: WithId<Trip>, unloadQty: number, podBase64: string) => {
    if (!firestore || !user) return;
    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
            const globalTripRef = doc(firestore, 'trips', trip.id);
            const shipmentRef = doc(firestore, `plants/${trip.originPlantId}/shipments`, trip.shipmentIds[0]);
            const historyRef = doc(collection(firestore, `plants/${trip.originPlantId}/status_updates`));

            const ts = serverTimestamp();
            const currentName = operatorFullName || (user.displayName || user.email?.split('@')[0] || 'Operator');

            const podStatus: PODStatus = podBase64 ? 'Receipt Soft Copy' : 'Missing';

            const updateData = {
                tripStatus: 'Delivered' as TripStatus,
                podStatus: podStatus,
                currentStatusId: 'delivered',
                actualCompletionDate: ts,
                lastUpdated: ts,
                unloadQty: unloadQty,
                podReceived: !!podBase64,
                podUrl: podBase64 || null,
            };

            transaction.update(tripRef, updateData);
            transaction.update(globalTripRef, updateData);

            transaction.update(shipmentRef, {
                currentStatusId: 'Delivered',
                lastUpdateDate: ts,
            });

            // HIGH-FIDELITY DELIVERY LOGGING
            transaction.set(historyRef, {
                tripId: trip.tripId,
                vehicleNumber: trip.vehicleNumber || 'N/A',
                shipToParty: trip.shipToParty || 'N/A',
                unloadingPoint: trip.unloadingPoint || 'N/A',
                previousStatus: trip.tripStatus,
                newStatus: 'Delivered',
                timestamp: ts,
                updatedBy: currentName,
                remarks: `Material Successfully Unloaded. Qty: ${unloadQty} MT.`
            });
        });

        toast({ title: 'Mission Delivered', description: `Trip ${trip.tripId} status updated. Material successfully unloaded.` });
        setIsModalOpen(false);
        setTripForDelivery(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Closure Failed', description: error.message });
    } finally {
        hideLoader();
    }
  };

  const plantsList = (allMasterPlants && allMasterPlants.length > 0) ? allMasterPlants : mockPlants;
  const filteredPlants = plantsList.filter(p => isAdmin || authorizedPlantIds.some(aid => normalizePlantId(aid).toLowerCase() === normalizePlantId(p.id).toLowerCase()));
  const isReadOnlyScope = !isAdmin && authorizedPlantIds.length === 1;

  return (
    <>
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-blue-900 uppercase tracking-tight italic">Status Control Center</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Operational Node Transition Registry</p>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            {dbError && (
                <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold border border-orange-200 uppercase tracking-wider">
                    <WifiOff className="h-3 w-3" />
                    <span>Cloud Sync Issue</span>
                </div>
            )}
            <div className="flex flex-col gap-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <Factory className="h-3 w-3" /> Plant Node Registry
                </Label>
                {isReadOnlyScope ? (
                    <div className="h-10 px-5 flex items-center bg-blue-50 border border-blue-100 rounded-xl text-blue-900 font-black text-xs shadow-sm uppercase tracking-tighter min-w-[220px]">
                        <ShieldCheck className="h-4 w-4 mr-2 text-blue-600" /> {plantsList.find(p => p.id === authorizedPlantIds[0])?.name || authorizedPlantIds[0]}
                    </div>
                ) : (
                    <Select value={selectedPlant} onValueChange={setSelectedPlant} disabled={isAuthLoading}>
                        <SelectTrigger className="w-[220px] h-10 rounded-xl bg-white border-slate-200 font-bold shadow-sm">
                            <SelectValue placeholder={isAuthLoading ? "Syncing..." : "Select Node"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {isAdmin && (
                                <SelectItem value="all-plants" className="font-black uppercase text-[10px] tracking-widest text-blue-600">
                                    All Authorized Nodes
                                </SelectItem>
                            )}
                            {filteredPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
            </div>
        </div>
      </div>
      
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Mission Registry...</p>
            </div>
        ) : (
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-8">
                <TabsList className="bg-transparent border-b h-12 rounded-none gap-10 p-0 mb-8 w-full justify-start">
                    <TabsTrigger value="update-status" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                        <Settings2 className="h-4 w-4" /> Update Status
                    </TabsTrigger>
                    <TabsTrigger value="available-vehicles" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                        <Truck className="h-4 w-4" /> Gate Presence
                    </TabsTrigger>
                    <TabsTrigger value="status-history" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                        <History className="h-4 w-4" /> Registry Audit ({filteredStatusHistory.length})
                    </TabsTrigger>
                </TabsList>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <TabsContent value="update-status" className="focus-visible:ring-0">
                        <UpdateStatusForm 
                            activeTrips={filteredActiveTrips} 
                            availableVehicles={filteredAvailableVehicles} 
                            onStatusUpdate={handleStatusUpdate} 
                            key={`form-${selectedPlant}`} 
                        />
                    </TabsContent>
                    <TabsContent value="available-vehicles" className="focus-visible:ring-0">
                        <AvailableVehiclesTab plantsList={plantsList} filterPlantId={selectedPlant} />
                    </TabsContent>
                    <TabsContent value="status-history" className="focus-visible:ring-0">
                        <StatusHistory history={filteredStatusHistory} />
                    </TabsContent>
                </div>
            </Tabs>
        )}
      </div>

      {tripForDelivery && (
          <DeliveredModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            trip={tripForDelivery} 
            onSave={handleDeliveryComplete} 
          />
      )}
    </>
  );
}

export default function StatusControlPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-900" /></div>}>
      <main className="flex flex-1 flex-col h-full bg-slate-50/50 min-h-screen animate-in fade-in duration-500">
        <StatusControlContent />
      </main>
    </Suspense>
  );
}
