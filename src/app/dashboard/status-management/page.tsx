'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import UpdateStatusForm from '@/components/dashboard/status-management/UpdateStatusForm';
import StatusHistory from '@/components/dashboard/status-management/StatusHistory';
import DeliveredModal from '@/components/dashboard/status-management/DeliveredModal';
import AvailableVehiclesTab from '@/components/dashboard/status-management/AvailableVehiclesTab';
import { mockTrips, mockPlants } from '@/lib/mock-data';
import type { WithId, Trip, StatusUpdate, SubUser, Plant } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from "@/firebase";
import { collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp, Timestamp, addDoc, orderBy, limit } from "firebase/firestore";
import { Loader2, WifiOff, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSearchParams } from 'next/navigation';

function StatusManagementContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'update-status');
  const [selectedPlant, setSelectedPlant] = useState('all-plants');
  const [activeTrips, setActiveTrips] = useState<WithId<Trip>[]>([]);
  const [statusHistory, setStatusHistory] = useState<WithId<StatusUpdate>[]>([]);
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tripForDelivery, setTripForDelivery] = useState<WithId<Trip> | null>(null);

  const refreshData = () => setDataVersion(v => v + 1);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchData = async () => {
        setIsLoading(true);
        setDbError(false);
        try {
            // 1. Fetch Master Plants
            const plantSnap = await getDocs(collection(firestore, "plants"));
            const masterPlants = plantSnap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<Plant>));
            const activePlants = masterPlants.length > 0 ? masterPlants : mockPlants;
            setPlants(activePlants);

            // 2. Get Authorized Plant IDs for the user
            const userDocRef = doc(firestore, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            let authorizedPlantIds: string[] = [];
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as SubUser;
                const username = userData.username?.toLowerCase();
                const isSikkaind = username === 'sikkaind' || user.email === 'sikkaind.admin@sikka.com';
                
                if (isSikkaind) {
                    authorizedPlantIds = activePlants.map(d => d.id);
                } else {
                    authorizedPlantIds = userData.plantIds || [];
                }
            } else if (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') {
                authorizedPlantIds = activePlants.map(d => d.id);
            }

            if (authorizedPlantIds.length === 0) {
                setIsLoading(false);
                return;
            }

            // 3. Fetch Active Trips & Status Updates in Parallel per Plant
            const allActive: WithId<Trip>[] = [];
            const allHistory: WithId<StatusUpdate>[] = [];

            const fetchPromises = authorizedPlantIds.map(async (pId) => {
                try {
                    const [tripSnap, historySnap] = await Promise.all([
                        getDocs(collection(firestore, `plants/${pId}/trips`)),
                        getDocs(query(
                            collection(firestore, `plants/${pId}/status_updates`),
                            orderBy("timestamp", "desc"),
                            limit(30)
                        ))
                    ]);

                    tripSnap.forEach(doc => {
                        const data = doc.data();
                        const status = data.currentStatusId?.toLowerCase();
                        if (status !== 'delivered' && status !== 'cancelled') {
                            allActive.push({ 
                                id: doc.id, 
                                ...data,
                                originPlantId: pId,
                                startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : new Date(data.startDate)
                            } as WithId<Trip>);
                        }
                    });

                    historySnap.forEach(doc => {
                        const data = doc.data();
                        allHistory.push({
                            id: doc.id,
                            ...data,
                            originPlantId: pId,
                            timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
                            previousStatusTimestamp: data.previousStatusTimestamp instanceof Timestamp ? data.previousStatusTimestamp.toDate() : (data.previousStatusTimestamp ? new Date(data.previousStatusTimestamp) : undefined)
                        } as WithId<StatusUpdate>);
                    });
                } catch (e) {
                    console.warn(`Could not fetch data for plant ${pId}:`, e);
                }
            });

            await Promise.all(fetchPromises);

            if (allActive.length === 0 && allHistory.length === 0) {
                // Fallback to filtered mock trips if cloud results are empty
                const filteredMock = mockTrips.filter(t => 
                    authorizedPlantIds.includes(t.originPlantId) && 
                    !['delivered', 'cancelled'].includes(t.currentStatusId.toLowerCase())
                );
                setActiveTrips(filteredMock);
            } else {
                setActiveTrips(allActive);
                setStatusHistory(allHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
            }

        } catch (error) {
            console.error("Error fetching status management data:", error);
            setDbError(true);
            toast({ variant: "destructive", title: "Sync Failed", description: "Could not load data from cloud." });
        } finally {
            setIsLoading(false);
        }
    };

    fetchData();
  }, [firestore, user, dataVersion, toast]);

  // Derived filtered data
  const filteredActiveTrips = useMemo(() => {
    if (selectedPlant === 'all-plants') return activeTrips;
    return activeTrips.filter(t => t.originPlantId === selectedPlant);
  }, [activeTrips, selectedPlant]);

  const filteredStatusHistory = useMemo(() => {
    if (selectedPlant === 'all-plants') return statusHistory;
    return statusHistory.filter(h => h.originPlantId === selectedPlant);
  }, [statusHistory, selectedPlant]);
  
  const handleStatusUpdate = async (tripId: string, newStatus: string, location: string, remarks?: string) => {
    const trip = activeTrips.find(t => t.id === tripId);
    if (!trip || !firestore || !user) return;

    if (newStatus.toLowerCase() === 'delivered') {
      setTripForDelivery(trip);
      setIsModalOpen(true);
    } else {
      try {
          const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
          const historyRef = collection(firestore, `plants/${trip.originPlantId}/status_updates`);
          
          const updateData: any = {
              currentStatusId: newStatus,
              lastUpdated: serverTimestamp(),
          };
          if (newStatus.toLowerCase() === 'arrival for delivery' || newStatus.toLowerCase() === 'arrival-for-delivery') {
              updateData.arrivalDate = serverTimestamp();
          }
          await updateDoc(tripRef, updateData);

          // Log to Status History
          const displayName = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
          await addDoc(historyRef, {
              tripId: trip.tripId,
              vehicleNumber: trip.vehicleNumber || 'N/A',
              shipToParty: trip.shipToParty || 'N/A',
              unloadingPoint: trip.unloadingPoint || 'N/A',
              previousStatus: trip.currentStatusId,
              previousStatusTimestamp: trip.lastUpdated || trip.startDate,
              newStatus: newStatus,
              timestamp: serverTimestamp(),
              updatedBy: displayName || 'System',
              remarks: remarks || ''
          });

          toast({
            title: 'Status Updated',
            description: `Trip ${trip.tripId} status has been updated to ${newStatus}.`,
          });
          refreshData();
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
    }
  };

  const handleDeliveryComplete = async (trip: WithId<Trip>, unloadQty: number, podBase64: string) => {
    if (!firestore || !user) return;

    try {
        const tripRef = doc(firestore, `plants/${trip.originPlantId}/trips`, trip.id);
        const shipmentRef = doc(firestore, `plants/${trip.originPlantId}/shipments`, trip.shipmentIds[0]);
        const historyRef = collection(firestore, `plants/${trip.originPlantId}/status_updates`);

        const updateTimestamp = serverTimestamp();

        await updateDoc(tripRef, {
            currentStatusId: 'delivered',
            actualCompletionDate: updateTimestamp,
            lastUpdated: updateTimestamp,
            unloadQty: unloadQty,
            podReceived: true,
            podUrl: podBase64,
        });

        await updateDoc(shipmentRef, {
            currentStatusId: 'delivered',
            lastUpdateDate: updateTimestamp,
        });

        // Log to Status History
        const displayName = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);
        await addDoc(historyRef, {
            tripId: trip.tripId,
            vehicleNumber: trip.vehicleNumber || 'N/A',
            shipToParty: trip.shipToParty || 'N/A',
            unloadingPoint: trip.unloadingPoint || 'N/A',
            previousStatus: trip.currentStatusId,
            previousStatusTimestamp: trip.lastUpdated || trip.startDate,
            newStatus: 'delivered',
            timestamp: updateTimestamp,
            updatedBy: displayName || 'System',
            remarks: `Unload Qty: ${unloadQty}. POD Uploaded.`
        });

        toast({ title: 'Trip Completed', description: `Trip ${trip.tripId} has been marked as Delivered.` });
        
        setIsModalOpen(false);
        setTripForDelivery(null);
        refreshData();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold font-headline text-blue-900">Status Management</h1>
        <div className="flex items-center gap-4">
            {dbError && (
                <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-medium">
                    <WifiOff className="h-3 w-3" />
                    <span>Operating in Offline/Demo Mode</span>
                </div>
            )}
            <div className="flex flex-col gap-1.5 min-w-[240px]">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Filter className="h-3 w-3" />
                    Scope By Plant:
                </Label>
                <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="All Authorized Plants" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all-plants">All Authorized Plants</SelectItem>
                        {plants.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
      </div>
      
      {isLoading ? (
          <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Fetching live trip status...</p>
              </div>
          </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="update-status">Update Status</TabsTrigger>
            <TabsTrigger value="available-vehicles">Available Vehicle</TabsTrigger>
            <TabsTrigger value="status-history">Status History</TabsTrigger>
            </TabsList>

            <TabsContent value="update-status">
            <Card>
                <CardHeader>
                <CardTitle>Update Trip Status</CardTitle>
                <CardDescription>Select an active trip from {selectedPlant === 'all-plants' ? 'any plant' : plants.find(p => p.id === selectedPlant)?.name} to update its status.</CardDescription>
                </CardHeader>
                <CardContent>
                    <UpdateStatusForm 
                        activeTrips={filteredActiveTrips}
                        availableVehicles={[]}
                        onStatusUpdate={handleStatusUpdate}
                        key={`${dataVersion}-${selectedPlant}`} 
                    />
                </CardContent>
            </Card>
            </TabsContent>

            <TabsContent value="available-vehicles">
            <AvailableVehiclesTab plantsList={plants} filterPlantId={selectedPlant === 'all-plants' ? undefined : selectedPlant} />
            </TabsContent>

            <TabsContent value="status-history">
            <StatusHistory history={filteredStatusHistory} />
            </TabsContent>
        </Tabs>
      )}

      {tripForDelivery && (
        <DeliveredModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          trip={tripForDelivery}
          onSave={handleDeliveryComplete}
        />
      )}
    </div>
  );
}

export default function StatusManagementPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-blue-900" /></div>}>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <StatusManagementContent />
      </main>
    </Suspense>
  );
}
