'use client';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CreateCarrierForm from '@/components/dashboard/carrier-management/CreateCarrierForm';
import AddedCarriersTable from '@/components/dashboard/carrier-management/AddedCarriersTable';
import type { WithId, Carrier, Plant } from '@/types';
import { useToast } from '@/hooks/use-toast';
import EditCarrierModal from '@/components/dashboard/carrier-management/EditCarrierModal';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { Loader2, WifiOff } from "lucide-react";

export default function CarrierManagementPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState('create');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<WithId<Carrier> | null>(null);

  // Real-time Firestore query for carriers
  const carriersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "carriers")) : null, 
    [firestore]
  );
  const { data: carriers, isLoading: isLoadingCarriers, error: carriersError } = useCollection<Carrier>(carriersQuery);

  // Points to logistics_plants for Hub management
  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

  const handleCarrierCreated = async (carrierData: Omit<Carrier, 'id'>) => {
    if (!firestore) return;
    try {
      const cleanedData = Object.fromEntries(
        Object.entries(carrierData).filter(([_, v]) => v !== undefined)
      );

      await addDoc(collection(firestore, "carriers"), {
        ...cleanedData,
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Success', description: 'Carrier created successfully in the cloud.' });
      setActiveTab('list');
    } catch (error: any) {
      console.error("Create carrier error:", error);
      toast({ variant: 'destructive', title: "Database Error", description: error.message });
    }
  };

  const handleCarrierDeleted = async (carrierId: string) => {
    if (!firestore || !user) return;
    try {
      const carrierRef = doc(firestore, "carriers", carrierId);
      const carrierSnap = await getDoc(carrierRef);

      if (carrierSnap.exists()) {
          const carrierData = carrierSnap.data();
          // Move to Recycle Bin
          await addDoc(collection(firestore, "recycle_bin"), {
              pageName: "Carrier Management",
              userName: user.email?.split('@')[0] || "Admin",
              deletedAt: serverTimestamp(),
              data: { ...carrierData, id: carrierId, type: 'Carrier' }
          });

          await deleteDoc(carrierRef);
          toast({
            title: 'Moved to Bin',
            description: 'The carrier has been moved to the Recycle Bin.',
          });
      }
    } catch (error: any) {
      console.error("Delete carrier error:", error);
      toast({ variant: 'destructive', title: "Database Error", description: error.message });
    }
  };

  const handleOpenEditModal = (carrier: WithId<Carrier>) => {
    setEditingCarrier(carrier);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCarrier(null);
  };

  const handleCarrierUpdated = async (carrierId: string, data: Partial<Omit<Carrier, 'id'>>) => {
    if (!firestore) return;
    try {
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );

      await updateDoc(doc(firestore, "carriers", carrierId), {
        ...cleanedData,
        lastUpdated: serverTimestamp()
      });
      toast({ title: 'Success', description: 'Carrier details updated in the cloud.' });
      handleCloseEditModal();
    } catch (error: any) {
      console.error("Update carrier error:", error);
      toast({ variant: 'destructive', title: "Database Error", description: error.message });
    }
  };

  const isDataLoading = isLoadingCarriers || isLoadingPlants;

  return (
    <>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold font-headline">Carrier Management</h1>
            {carriersError && (
                <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-medium">
                    <WifiOff className="h-3 w-3" />
                    <span>Cloud Connectivity Issue</span>
                </div>
            )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="create">Create Carrier</TabsTrigger>
            <TabsTrigger value="list">Added Carriers</TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <CreateCarrierForm onCarrierCreated={handleCarrierCreated} />
          </TabsContent>
          <TabsContent value="list">
            {isDataLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <AddedCarriersTable
                    carriers={carriers || []}
                    plants={plants || []}
                    onEdit={handleOpenEditModal}
                    onDelete={handleCarrierDeleted}
                />
            )}
          </TabsContent>
        </Tabs>
      </main>
      {editingCarrier && (
        <EditCarrierModal
            isOpen={isEditModalOpen}
            onClose={handleCloseEditModal}
            carrier={editingCarrier}
            onCarrierUpdated={handleCarrierUpdated}
        />
      )}
    </>
  );
}
