'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { mockTrips as initialTrips, mockCarriers, mockShipments } from '@/lib/mock-data';
import type { WithId, Trip, Carrier, Shipment } from '@/types';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, getDoc } from "firebase/firestore";

interface GenerateLRProps {
    onTriggerGeneration: (trip: WithId<Trip>, carrier: WithId<Carrier>) => void;
    selectedPlantId: string;
}

export default function GenerateLR({ onTriggerGeneration, selectedPlantId }: GenerateLRProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [selectedShipment, setSelectedShipment] = useState<WithId<Shipment> | null>(null);
  const [isLoadingShipment, setIsLoadingShipment] = useState(false);

  // Fetch Trips for selected plant from Firestore
  const tripsQuery = useMemoFirebase(() => 
    firestore && selectedPlantId
    ? query(collection(firestore, `plants/${selectedPlantId}/trips`), where("lrGenerated", "==", false))
    : null, [firestore, selectedPlantId]);
    
  const { data: dbTrips, isLoading: isLoadingTrips, error: tripsError } = useCollection<Trip>(tripsQuery);

  // Fetch Carriers from Firestore
  const carriersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "carriers")) : null, 
    [firestore]
  );
  const { data: dbCarriers } = useCollection<Carrier>(carriersQuery);

  const availableCarriers = useMemo(() => {
    if (dbCarriers && dbCarriers.length > 0) return dbCarriers;
    return mockCarriers;
  }, [dbCarriers]);

  const availableTrips = useMemo(() => {
    if (isLoadingTrips) return [];
    if (dbTrips && dbTrips.length > 0) return dbTrips;
    if (!isLoadingTrips && (dbTrips?.length === 0 || tripsError)) {
        return initialTrips.filter(t => t.originPlantId === selectedPlantId && !t.lrGenerated);
    }
    return dbTrips || [];
  }, [dbTrips, isLoadingTrips, tripsError, selectedPlantId]);

  const selectedTrip = useMemo(() => availableTrips.find(t => t.id === selectedTripId), [availableTrips, selectedTripId]);
  const selectedCarrier = useMemo(() => availableCarriers.find(c => c.id === (selectedTrip?.carrierId || availableCarriers[0]?.id)), [availableCarriers, selectedTrip]);

  // Fetch shipment details when trip changes
  useEffect(() => {
    const fetchDetails = async () => {
        if (!selectedTrip || !firestore) {
            setSelectedShipment(null);
            return;
        }

        setIsLoadingShipment(true);
        try {
            const shipId = selectedTrip.shipmentIds[0];
            const shipRef = doc(firestore, `plants/${selectedTrip.originPlantId}/shipments`, shipId);
            const shipSnap = await getDoc(shipRef);

            if (shipSnap.exists()) {
                setSelectedShipment({ id: shipSnap.id, ...shipSnap.data() } as WithId<Shipment>);
            } else {
                const mockShip = mockShipments.find(s => s.id === shipId);
                setSelectedShipment(mockShip || null);
            }
        } catch (error) {
            console.error("Error fetching shipment details:", error);
        } finally {
            setIsLoadingShipment(false);
        }
    };

    fetchDetails();
  }, [selectedTrip, firestore]);

  const handleExecute = () => {
    if (!selectedTrip || !selectedCarrier) {
      toast({
        variant: 'destructive',
        title: 'Selection Required',
        description: 'Please select a trip. A carrier must be assigned to the selected trip.',
      });
      return;
    }
    onTriggerGeneration(selectedTrip, selectedCarrier);
  };

  return (
    <Card>
        <CardHeader>
            <CardTitle>Generate Lorry Receipt (LR)</CardTitle>
            <CardDescription>Select a trip from the plant to generate an LR. Details will auto-populate below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <div className="grid gap-1.5">
                    <Label>Trip ID</Label>
                    <Select value={selectedTripId} onValueChange={setSelectedTripId} disabled={isLoadingTrips}>
                        <SelectTrigger>
                            <SelectValue placeholder={isLoadingTrips ? "Loading trips..." : "Select a trip"} />
                        </SelectTrigger>
                        <SelectContent>
                            {availableTrips.map(trip => (
                                <SelectItem key={trip.id} value={trip.id}>
                                    {trip.tripId} ({trip.vehicleNumber})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-1.5">
                    <Label>Vehicle Number</Label>
                    <Input readOnly disabled value={selectedTrip?.vehicleNumber || ''} placeholder="N/A" />
                </div>

                <div className="grid gap-1.5">
                    <Label>Carrier</Label>
                    <Input readOnly disabled value={selectedCarrier?.name || ''} placeholder="N/A"/>
                </div>

                <div className="grid gap-1.5">
                    <Label>Consignor</Label>
                    <div className="relative">
                        <Input readOnly disabled value={selectedShipment?.consignor || ''} placeholder={isLoadingShipment ? "Loading..." : "N/A"} />
                        {isLoadingShipment && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                </div>

                <div className="grid gap-1.5">
                    <Label>From (Loading Point)</Label>
                    <Input readOnly disabled value={selectedShipment?.loadingPoint || ''} placeholder="N/A" />
                </div>

                <div className="grid gap-1.5">
                    <Label>Consignee</Label>
                    <Input readOnly disabled value={selectedShipment?.billToParty || ''} placeholder="N/A" />
                </div>

                <div className="grid gap-1.5">
                    <Label>Ship to</Label>
                    <Input readOnly disabled value={selectedShipment?.shipToParty || ''} placeholder="N/A" />
                </div>

                <div className="grid gap-1.5">
                    <Label>To (Unloading Point)</Label>
                    <Input readOnly disabled value={selectedShipment?.unloadingPoint || ''} placeholder="N/A" />
                </div>
            </div>

            <div className="flex gap-4 pt-4 border-t">
                <Button onClick={handleExecute} disabled={!selectedTripId || !selectedCarrier || isLoadingShipment}>Execute</Button>
                <Button variant="outline" onClick={() => { setSelectedTripId(''); setSelectedShipment(null); }}>Cancel</Button>
            </div>
        </CardContent>
    </Card>
  );
}
