'use client';
import { useMemo, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CreateCarrierForm from '@/components/dashboard/carrier-management/CreateCarrierForm';
import AddedCarriersTable from '@/components/dashboard/carrier-management/AddedCarriersTable';
import type { WithId, Carrier, Plant } from '@/types';
import { useToast } from '@/hooks/use-toast';
import EditCarrierModal from '@/components/dashboard/carrier-management/EditCarrierModal';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { Loader2, WifiOff } from 'lucide-react';

/**
 * @fileOverview Carrier Management Terminal.
 * Wrapped in Suspense to safely handshake with useSearchParams registry.
 */
function CarrierManagementContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const plantFilter = searchParams.get('plantId') || 'all';

  const [activeTab, setActiveTab] = useState('create');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<WithId<Carrier> | null>(null);

  useEffect(() => {
    if (!isEditModalOpen) {
      const timer = setTimeout(() => setEditingCarrier(null), 500);
      return () => clearTimeout(timer);
    }
  }, [isEditModalOpen]);

  const carriersQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, "carriers")) : null,
    [firestore]
  );
  const { data: carriers, isLoading: isLoadingCarriers, error: carriersError } = useCollection<Carrier>(carriersQuery);

  const plantsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, "logistics_plants")) : null,
    [firestore]
  );
  const { data: plants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

  const sanitizedCarriers = useMemo(() => {
    let filteredCarriers = carriers || [];
    if (plantFilter !== 'all') {
      filteredCarriers = filteredCarriers.filter(carrier => carrier.plantId === plantFilter);
    }
    return filteredCarriers.map(carrier => ({ name: '', gstin: '', pan: '', plantId: '', logoUrl: '', stateName: '', ...carrier }));
  }, [carriers, plantFilter]);

  const handleCarrierCreated = async (carrierData: Omit<Carrier, 'id'>) => {
    if (!firestore) return;
    try {
      await addDoc(collection(firestore, "carriers"), { ...carrierData, createdAt: serverTimestamp() });
      toast({ title: 'Success', description: 'Carrier created successfully.' });
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
          await addDoc(collection(firestore, "recycle_bin"), {
              pageName: "Carrier Management",
              userName: user.email?.split('@')[0] || "Admin",
              deletedAt: serverTimestamp(),
              data: { ...carrierSnap.data(), id: carrierId, type: 'Carrier' }
          });
          await deleteDoc(carrierRef);
          toast({ title: 'Moved to Bin', description: 'Carrier moved to Recycle Bin.' });
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
  };

  const handleCarrierUpdated = async (carrierId: string, data: Partial<Omit<Carrier, 'id'>>) => {
    try {
      if (!firestore) throw new Error("Firestore is not initialized.");

      if (!carrierId) {
        const errorMsg = "Cannot update: Critical information missing (carrier ID).";
        toast({ variant: 'destructive', title: 'Update Failed', description: errorMsg });
        throw new Error(errorMsg);
      }

      const cleanedData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null && v !== undefined));
      await updateDoc(doc(firestore, "carriers", carrierId), { ...cleanedData, lastUpdated: serverTimestamp() });
      toast({ title: 'Success', description: 'Carrier details updated successfully.' });
      handleCloseEditModal();
    } catch (error: any) {
      console.error("Update carrier error:", error);
      toast({ variant: 'destructive', title: "Database Error", description: `Could not update carrier: ${error.message}` });
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
            <TabsTrigger value="create" >Create Carrier</TabsTrigger>
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
              <>
                <AddedCarriersTable
                  carriers={sanitizedCarriers}
                  plants={plants || []}
                  onEdit={handleOpenEditModal}
                  onDelete={handleCarrierDeleted}
                />
              </>
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

export default function CarrierManagementPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-blue-900" /></div>}>
      <CarrierManagementContent />
    </Suspense>
  );
}
