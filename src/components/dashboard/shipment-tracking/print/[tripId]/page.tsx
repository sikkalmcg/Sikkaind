
'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { mockTrips, mockShipments, mockPlants } from '@/lib/mock-data';
import type { WithId, Trip, Shipment, Plant } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import TrackingDetails from '@/components/dashboard/shipment-tracking/TrackingDetails';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useFirestore } from "@/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import React from 'react';

type EnrichedTrip = WithId<Trip> & {
    shipment: WithId<Shipment>;
    plant: WithId<Plant>;
};

function PrintableReport({ trip }: { trip: EnrichedTrip }) {

    useEffect(() => {
        document.title = `Tracking_${trip.tripId}`;
        // Trigger print dialog on load
        const timer = setTimeout(() => {
            window.print();
        }, 1000);
        return () => clearTimeout(timer);
    }, [trip.tripId]);

    return (
        <div className="bg-white text-black p-8 font-sans">
            <header className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sikka LMC</h1>
                    <p className="text-lg text-gray-700">Shipment Tracking Report</p>
                </div>
                <div className="text-right">
                    <p className="font-mono text-lg">Trip ID: {trip.tripId}</p>
                    <p className="text-sm text-gray-600">Date: {format(new Date(), 'PP')}</p>
                </div>
            </header>
            
            <div className="flex justify-end mb-8 print:hidden">
                <Button onClick={() => window.print()}>Print Report</Button>
            </div>
            
            <TrackingDetails trip={trip} />
        </div>
    );
}

const Loader2 = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

function TrackingPrintContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  
  const tripId = params.tripId as string;
  const plantId = searchParams.get('plantId');
  
  const [tripData, setTripData] = useState<EnrichedTrip | null | undefined>(undefined);

  useEffect(() => {
    if (!firestore) return;

    const fetchData = async () => {
        try {
            let trip: any = null;
            let currentPlantId = plantId;

            // 1. Try to find the trip in the specified plant
            if (currentPlantId) {
                const tripRef = doc(firestore, `plants/${currentPlantId}/trips`, tripId);
                const tripSnap = await getDoc(tripRef);
                if (tripSnap.exists()) {
                    trip = { id: tripSnap.id, ...tripSnap.data() };
                }
            }

            // 2. Cross-plant lookup if not found (fallback)
            if (!trip) {
                for (const p of mockPlants) {
                    const tripRef = doc(firestore, `plants/${p.id}/trips`, tripId);
                    const tripSnap = await getDoc(tripRef);
                    if (tripSnap.exists()) {
                        trip = { id: tripSnap.id, ...tripSnap.data() };
                        currentPlantId = p.id;
                        break;
                    }
                }
            }

            // 3. Mock fallback
            if (!trip) {
                trip = mockTrips.find(t => t.id === tripId) || null;
                if (trip) currentPlantId = trip.originPlantId;
            }

            if (!trip || !currentPlantId) {
                setTripData(null);
                return;
            }

            // Standardize Trip Dates
            if (trip.startDate instanceof Timestamp) trip.startDate = trip.startDate.toDate();
            if (trip.outDate instanceof Timestamp) trip.outDate = trip.outDate.toDate();
            if (trip.arrivalDate instanceof Timestamp) trip.arrivalDate = trip.arrivalDate.toDate();
            if (trip.actualCompletionDate instanceof Timestamp) trip.actualCompletionDate = trip.actualCompletionDate.toDate();

            // Fetch Related Shipment
            const shipId = trip.shipmentIds[0];
            const shipRef = doc(firestore, `plants/${currentPlantId}/shipments`, shipId);
            const shipSnap = await getDoc(shipRef);
            let shipment: any = shipSnap.exists() ? { id: shipSnap.id, ...shipSnap.data() } : mockShipments.find(s => s.id === shipId);
            
            if (shipment && shipment.creationDate instanceof Timestamp) shipment.creationDate = shipment.creationDate.toDate();

            // Get Plant
            const plant = mockPlants.find(p => p.id === currentPlantId);

            if (trip && shipment && plant) {
                setTripData({ ...trip, shipment, plant } as EnrichedTrip);
            } else {
                setTripData(null);
            }
        } catch (error) {
            console.error("Error fetching trip print data:", error);
            setTripData(null);
        }
    };

    fetchData();
  }, [tripId, plantId, firestore]);

  if (tripData === undefined) {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Loading tracking data...</p>
        </div>
    );
  }
  
  if (tripData === null) {
    notFound();
  }

  return <PrintableReport trip={tripData} />;
}

export default function PrintTrackingPage() {
    return (
        <React.Suspense fallback={<div className="p-8"><Skeleton className="h-[800px] w-full" /></div>}>
            <TrackingPrintContent />
        </React.Suspense>
    );
}
