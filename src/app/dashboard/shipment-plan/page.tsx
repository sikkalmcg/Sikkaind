
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import CreatePlan from '@/components/dashboard/shipment-plan/CreatePlan';
import ShipmentData from '@/components/dashboard/shipment-plan/ShipmentData';
import EditShipmentModal from '@/components/dashboard/shipment-plan/EditShipmentModal';
import type { WithId, Shipment, Plant, SubUser } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, getDoc, updateDoc, serverTimestamp, runTransaction, getDocs, where, limit, onSnapshot, writeBatch, orderBy } from "firebase/firestore";
import { Loader2, WifiOff, Package, ListTree, Factory, ShieldCheck, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { normalizePlantId, sanitizeRegistryNode } from '@/lib/utils';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

function ShipmentPlanContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'create');
  const [selectedPlant, setSelectedPlant] = useState<string>('all-plants');
  
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [dbError, setDbError] = useState<boolean>(false);
  const [editingShipment, setEditingShipment] = useState<WithId<Shipment> | null>(null);

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', val);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const isAdminSession = useMemo(() => {
    return user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
  }, [user]);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: allMasterPlants } = useCollection<Plant>(plantsQuery);

  useEffect(() => {
    if (!firestore || !user) return;
    
    const fetchData = async () => {
      if (authorizedPlantIds.length === 0) setIsLoadingMeta(true);
      setDbError(false);
      try {
        const lastIdentity = localStorage.getItem('slmc_last_identity');
        const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
        
        let userDocSnap = null;
        const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            userDocSnap = qSnap.docs[0];
        }

        const baseList = (allMasterPlants && allMasterPlants.length > 0) ? allMasterPlants : mockPlants;
        let authIds: string[] = [];

        if (userDocSnap && userDocSnap.exists()) {
            const userData = userDocSnap.data() as SubUser;
            const isSikkaind = userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
            authIds = isSikkaind ? baseList.map(p => p.id) : (userData.plantIds || []);
        } else if (isAdminSession) {
            authIds = baseList.map(p => p.id);
        }

        setAuthorizedPlantIds(authIds);
        setPlants(baseList.filter(p => authIds.some(aid => normalizePlantId(aid).toLowerCase() === normalizePlantId(p.id).toLowerCase())));

      } catch (error) {
        setDbError(true);
      } finally {
        setIsLoadingMeta(false);
      }
    };
    
    fetchData();
  }, [firestore, user, allMasterPlants, isAdminSession]);

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
                const otherPlants = prev.filter(s => normalizePlantId(s.originPlantId) !== normalizePlantId(pId));
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

  const filteredShipments = useMemo(() => {
    if (selectedPlant === 'all-plants') return allShipments;
    const normId = normalizePlantId(selectedPlant);
    return allShipments.filter(s => normalizePlantId(s.originPlantId) === normId);
  }, [allShipments, selectedPlant]);

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
            
            const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System');

            transaction.update(shipRef, {
                currentStatusId: 'Cancelled',
                lastUpdateDate: ts,
                cancelledBy: currentName,
                cancelledAt: ts
            });

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

  const handleBulkDelete = async (ids: string[]) => {
    if (!firestore || !user || ids.length === 0) return;
    
    showLoader();
    try {
        const batch = writeBatch(firestore);
        const ts = serverTimestamp();
        const currentOperator = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || "Admin");

        for (const id of ids) {
            const shipment = allShipments.find(s => s.id === id);
            if (!shipment) continue;

            // Mission Node Archival Node: Move to recycle bin
            const recycleRef = doc(collection(firestore, "recycle_bin"));
            const sanitizedData = sanitizeRegistryNode({ ...shipment, id: shipment.id, type: 'Shipment' });
            batch.set(recycleRef, {
                pageName: "Order Plan Registry (Bulk)",
                userName: currentOperator,
                deletedAt: ts,
                data: sanitizedData
            });

            // Purge Node from primary registry
            const shipRef = doc(firestore, `plants/${shipment.originPlantId}/shipments`, id);
            batch.delete(shipRef);
        }

        await batch.commit();
        toast({ title: 'Bulk Purge Complete', description: `Successfully removed ${ids.length} mission nodes from registry.` });
    } catch (e: any) {
        console.error("Bulk Delete Error:", e);
        toast({ variant: 'destructive', title: 'Purge Failed', description: 'Registry synchronization error.' });
    } finally {
        hideLoader();
    }
  };

  if (isLoadingMeta && authorizedPlantIds.length === 0) {
    return (
        <div className="flex h-screen flex-col items-center justify-center bg-[#f8fafc]">
            <Loader2 className="h-12 w-12 animate-spin text-blue-900 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Lifting Node Registry...</p>
        </div>
    );
  }

  const isReadOnlyPlant = !isAdminSession && plants.length === 1;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-slate-50/50 min-h-screen animate-in fade-in duration-500">
        <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 -m-4 md:-m-8 mb-4 md:mb-0 shadow-sm">
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
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                        <Factory className="h-3 w-3" /> Plant Node registry
                    </Label>
                    {isReadOnlyPlant ? (
                        <div className="h-10 px-4 flex items-center bg-blue-50 border border-blue-100 rounded-xl text-blue-900 font-black text-xs shadow-sm uppercase min-w-[220px]">
                            <ShieldCheck className="h-3.5 w-3.5 mr-2 text-blue-600" /> {plants[0]?.name}
                        </div>
                    ) : (
                        <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                            <SelectTrigger className="w-[220px] h-10 rounded-xl bg-white border-slate-200 font-bold shadow-sm">
                                <SelectValue placeholder="Pick node" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all-plants" className="font-black uppercase text-[10px] tracking-widest text-blue-600">All Authorized Nodes</SelectItem>
                                {plants.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="font-bold py-3 uppercase italic text-black">{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                {dbError && (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-orange-200">
                        <WifiOff className="h-3 w-3" />
                        <span>Sync Issue</span>
                    </div>
                )}
            </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-8">
            <TabsList className="bg-transparent border-b h-12 rounded-none gap-10 p-0 mb-8">
                <TabsTrigger value="create" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                    <Package className="h-4 w-4" /> Create Order
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
                    <ListTree className="h-4 w-4" /> Order Ledger ({filteredShipments.length})
                </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="focus-visible:ring-0">
                <CreatePlan onShipmentCreated={() => handleTabChange('history')} authorizedPlants={plants} />
            </TabsContent>

            <TabsContent value="history" className="focus-visible:ring-0">
                <ShipmentData 
                    shipments={filteredShipments} 
                    plants={plants} 
                    onEdit={setEditingShipment} 
                    onDelete={handleCancelOrder} 
                    onBulkDelete={handleBulkDelete}
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

export default function ShipmentPlanPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <ShipmentPlanContent />
        </Suspense>
    );
}
