
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDocs, query, where, Timestamp, collection, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/client/config';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/firebase/client/auth';
import type { Trip, Plant, Carrier, Shipment, LR } from '@/types';
import { DataTable } from './data-table';
import { getColumns } from './columns';
import { EnrichedLR } from '@/components/dashboard/vehicle-assign/PrintableLR';
import { useReactToPrint } from 'react-to-print';
import { PrintLRContext } from '@/lib/hooks/use-print-lr';
import { LRPrintLayout } from '@/components/dashboard/vehicle-assign/LRPrintLayout';


export default function TripboardTabs() {
  const [activeTab, setActiveTab] = useState('active');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [printLRData, setPrintLRData] = useState<EnrichedLR | null>(null);
  const printLROrderRef = React.useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const { user } = useAuth();

  const handlePrint = useReactToPrint({
    content: () => printLROrderRef.current,
  });

  const value: any = {
    print: (lr: EnrichedLR) => {
        setPrintLRData(lr);
    }
  }

  useEffect(() => {
    if (printLRData) {
        handlePrint();
    }
  }, [printLRData, handlePrint]);

  const fetchTrips = async (status: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'trips'),
        where('status', '==', status),
        where('carrierId', '==', user?.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const trips = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(trips);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast({
        title: 'Error fetching trips',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips(activeTab);
  }, [activeTab, user?.uid]);

  const handleViewLR = (trip: any) => {
    // ROOT CAUSE FIX: The weight field is a string with units (e.g., "5.206 MT").
    // Using parseFloat correctly extracts the number from this string.
    const finalWeight = 
      parseFloat(trip.totalWeight) || 
      parseFloat(trip.assignedTripWeight) || 
      parseFloat(trip.assignedQtyInTrip) || 
      parseFloat(trip.quantity) || 0;

    const lrData: EnrichedLR = {
      ...(trip.lr || {}),
      lrNumber: trip.lr?.lrNumber || trip.id,
      date: trip.lr?.date || new Date(),
      from: trip.from,
      to: trip.to,
      consignorName: trip.shipment?.consignorName,
      consignorAddress: trip.shipment?.consignorAddress,
      consignorGtin: trip.shipment?.consignorGtin,
      shipToParty: trip.shipment?.shipToParty,
      deliveryAddress: trip.shipment?.deliveryAddress,
      shipToGtin: trip.shipment?.shipToGtin,
      buyerName: trip.shipment?.buyerName,
      buyerAddress: trip.shipment?.buyerAddress,
      buyerGtin: trip.shipment?.buyerGtin,
      items: trip.shipment?.items || [],
      trip: trip,
      carrier: trip.carrier,
      shipment: trip.shipment,
      plant: trip.plant,
      // Pass the correctly parsed weight to the LR component under all possible props for robustness.
      totalWeight: finalWeight,
      assignedTripWeight: finalWeight,
      quantity: finalWeight,
      totalUnits: trip.totalUnits,
    };
    setPrintLRData(lrData);
  };

  const columns = useMemo(() => getColumns({ onViewLR: handleViewLR }), []);

  return (
    <div className='mt-10'>
        <div style={{ display: 'none' }}>
                <LRPrintLayout ref={printLROrderRef} lr={printLRData} />
        </div>
        <PrintLRContext.Provider value={value}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="unbilled">Unbilled</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <DataTable columns={columns} data={data} loading={loading} />
        </TabsContent>
        <TabsContent value="unbilled">
          <DataTable columns={columns} data={data} loading={loading} />
        </TabsContent>
        <TabsContent value="completed">
          <DataTable columns={columns} data={data} loading={loading} />
        </TabsContent>
      </Tabs>
      </PrintLRContext.Provider>
    </div>
  );
}
