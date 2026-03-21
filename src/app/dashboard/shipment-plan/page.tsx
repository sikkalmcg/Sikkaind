'use client';
import { useState, useEffect } from 'react';
import CreatePlan from '@/components/dashboard/shipment-plan/CreatePlan';
import ShipmentData from '@/components/dashboard/shipment-plan/ShipmentData';
import EditShipmentModal from '@/components/dashboard/shipment-plan/EditShipmentModal';
import type { WithId, Shipment, Plant, SubUser } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, getDoc, updateDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { Loader2, WifiOff, Package, ListTree } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { useLoading } from '@/context/LoadingContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export default function ShipmentPlanPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [dbError, setDbError] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState('create');
  const [editingShipment, setEditingShipment] = useState<WithId<Shipment> | null>(null);

  // Snappy Protocol: Force finish loading after 4s
  useEffect(() => {
    if (isLoadingMeta) {
        const timer = setTimeout(() => setIsLoadingMeta(false), 4000);
        return () => clearTimeout(timer);
    }
  }, [isLoadingMeta]);

  // Fetch Master Logistics Plants List
  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;
    
    const fetchData = async () => {
      setIsLoadingMeta(true);
      setDbError(false);
      try {
        const userDocRef = doc(firestore, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        const baseList = (allMasterPlants && allMasterPlants.length > 0) ? allMasterPlants : mockPlants;
        let authIds: string[] = [];

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as SubUser;
            const isSikkaind = userData.username?.toLowerCase() === 'sikkaind' || user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
            authIds = isSikkaind ? baseList.map(p => p.id) : (userData.plantIds || []);
        } else if (user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com') {
            authIds = baseList.map(p => p.id);
        }

        setAuthorizedPlantIds(authIds);
        setPlants(baseList.filter(p => authIds.includes(p.id)));

      } catch (error) {
        setDbError(true);
      } finally {
        setIsLoadingMeta(false);
      }
    };
    
    fetchData();
  }, [firestore, user, allMasterPlants]);

  // Real-time listener for shipments
  const [allShipments, setAllShipments] = useState<WithId<Shipment>[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);

  useEffect(() => {
    if (!firestore || authorizedPlantIds.length === 0) return;

    setIsLoadingShipments(true);
    const unsubscribers = authorizedPlantIds.map(pId => {
        const colRef = collection(firestore, `plants/${pId}/shipments`);
        const q = query(colRef);
        return onSnapshot(q, (snapshot) => {
            const plantShipments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as WithId<Shipment>));
            
            setAllShipments(prev => {
                const otherPlants = prev.filter(s => s.originPlantId !== pId);
                const combined = [...otherPlants, ...plantShipments];
                return combined.sort((a, b) => {
                    const dateA = a.creationDate instanceof Date ? a.creationDate : (a.creationDate as any)?.toDate() || new Date();
                    const dateB = b.creationDate instanceof Date ? b.creationDate : (b.creationDate as any)?.toDate() || new Date();
                    return dateB.getTime() - dateA.getTime();
                });
            });
            setIsLoadingShipments(false);
        }, async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: colRef.path,
                operation: 'list',
            } satisfies SecurityRuleContext));
            setIsLoadingShipments(false);
        });
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [firestore, authorizedPlantIds]);

  const handleShipmentUpdated = async (id: string, data: Partial<Omit<Shipment, 'id'>>) => {
    if (!firestore || !editingShipment) return;
    const docRef = doc(firestore, `plants/${editingShipment.originPlantId}/shipments`, id);
    const updateData = { ...data, lastUpdateDate: serverTimestamp() };
    
    updateDoc(docRef, updateData)
        .then(() => {
            toast({ title: 'Registry Updated', description: 'Sale Order particulars successfully modified.' });
            setEditingShipment(null);
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: updateData
            } satisfies SecurityRuleContext));
        });
  };

  const handleCancelOrder = async (id: string) => {
    if (!firestore || !user) return;
    const shipment = allShipments.find(s => s.id === id);
    if (!shipment) return;

    if (shipment.balanceQty <= 0) {
        toast({ 
            variant: 'destructive', 
            title: 'Action Restricted', 
            description: 'This order is fully assigned to vehicles. Revocation blocked.' 
        });
        return;
    }
    
    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const shipRef = doc(firestore, `plants/${shipment.originPlantId}/shipments`, id);
            const ts = serverTimestamp();
            
            const currentName = user.displayName || user.email || 'System Operator';

            transaction.update(shipRef, {
                currentStatusId: 'Cancelled',
                lastUpdateDate: ts,
                cancelledBy: currentName,
                cancelledAt: ts
            });

            // Activity Log Entry
            const logRef = doc(collection(firestore, "activity_logs"));
            transaction.set(logRef, {
                userId: user.uid,
                userName: currentName,
                action: 'Cancel Order',
                tcode: 'Order Plan',
                pageName: 'LMC Ledger',
                timestamp: ts,
                description: `Revoked Sale Order ${shipment.shipmentId}. [Assigned: ${shipment.assignedQty} | Cancelled Balance: ${shipment.balanceQty}]`
            });

            // Notification Registry Entry
            const notifRef = doc(collection(firestore, `users/${user.uid}/notifications`));
            transaction.set(notifRef, {
                userId: user.uid,
                userName: currentName,
                actionType: 'Cancelled',
                module: 'Order Plan',
                message: `${currentName} – Cancelled Order – Order Plan – ${format(new Date(), 'dd MMM yyyy p')}`,
                plantId: shipment.originPlantId,
                timestamp: ts,
                isRead: false
            });
        });

        toast({ title: 'Order Revoked', description: `Registry updated for ${shipment.shipmentId}.` });
    } catch (e: any) {
        console.error("Transaction Error:", e);
        toast({ variant: 'destructive', title: 'Commit Failed', description: 'Could not update registry. Please try again.' });
    } finally {
        hideLoader();
    }
  };

  if (isLoadingMeta) {
    return (
        <div className="flex h-screen flex-col items-center justify-center bg-[#f8fafc]">
            <Loader2 className="h-12 w-12 animate-spin text-blue-900 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Lifting Node Registry...</p>
        </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3">
                    <Package className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tight">Order Plan Control</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Operational Lifecycle Management</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {dbError && (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-orange-200">
                        <WifiOff className="h-3 w-3" />
                        <span>Registry Link Interrupted</span>
                    </div>
                )}
            </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
            <TabsList className="bg-transparent border-b h-12 rounded-none gap-10 p-0 mb-8">
                <TabsTrigger value="create" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                    <Package className="h-4 w-4" /> Create Order
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                    <ListTree className="h-4 w-4" /> Order Ledger ({allShipments.length})
                </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="focus-visible:ring-0">
                <CreatePlan onShipmentCreated={() => setActiveTab('history')} />
            </TabsContent>

            <TabsContent value="history" className="focus-visible:ring-0">
                <ShipmentData 
                    shipments={allShipments} 
                    plants={plants} 
                    onEdit={setEditingShipment} 
                    onDelete={handleCancelOrder} 
                />
            </TabsContent>
        </Tabs>

        {editingShipment && (
            <EditShipmentModal 
                isOpen={!!editingShipment} 
                onClose={() => setEditingShipment(null)} 
                shipment={editingShipment} 
                onShipmentUpdated={handleShipmentUpdated} 
            />
        )}
    </main>
  );
}
