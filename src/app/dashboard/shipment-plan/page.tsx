
'use client';
import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import CreatePlan from '@/components/dashboard/shipment-plan/CreatePlan';
import ShipmentData from '@/components/dashboard/shipment-plan/ShipmentData';
import EditShipmentModal from '@/components/dashboard/shipment-plan/EditShipmentModal';
import type { WithId, Shipment, Plant, SubUser } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import { useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, doc, updateDoc, serverTimestamp, runTransaction, getDocs, where, limit, onSnapshot, writeBatch, orderBy, deleteDoc } from "firebase/firestore";
import { Loader2, WifiOff, Package, ListTree, Factory, ShieldCheck, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { normalizePlantId, sanitizeRegistryNode } from '@/lib/utils';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * @fileOverview Order Plan Control (Master Hub).
 * UI REFINEMENT: Unified navigation tabs into the primary header for high-density ERP layout.
 * Hardened: Robust path resolution for mission revocation and bulk purge nodes.
 * Fixed: Robust scroll-to-top logic node using RAF and multi-stage timeout to block auto-scroll jump.
 */
function ShipmentPlanContent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const activeTab = (searchParams.get('tab') || 'create');
  const [selectedPlant, setSelectedPlant] = useState<string>('all-plants');
  
  const [plants, setPlants] = useState<WithId<Plant>[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [dbError, setDbError] = useState<boolean>(false);
  const [editingShipment, setEditingShipment] = useState<WithId<Shipment> | null>(null);

  // Registry Pulse: Reset scroll to top on tab change or mount
  // Hardened to prevent jump to "Invoice Number" section
  useEffect(() => {
    const forceScrollTop = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
            // Also reset window scroll to be safe
            window.scrollTo(0, 0);
        }
    };

    // Stage 1: Immediate Reset
    forceScrollTop();

    // Stage 2: Animation Frame Sync
    const raf = requestAnimationFrame(forceScrollTop);

    // Stage 3: Delayed Pulse (Overrides browser autofocus on lower inputs)
    const timer1 = setTimeout(forceScrollTop, 50);
    const timer2 = setTimeout(forceScrollTop, 150);
    const timer3 = setTimeout(forceScrollTop, 300);

    return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        cancelAnimationFrame(raf);
    };
  }, [activeTab, pathname]);

  const handleTabChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', val);
    // MISSION FIX: Enable scroll reset during router transition
    router.replace(`${pathname}?${params.toString()}`, { scroll: true });
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
            toast({ title: 'Registry Updated', description: 'Order particulars successfully modified.' });
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

    const plantId = normalizePlantId(shipment.originPlantId);
    if (!plantId) {
        toast({ variant: 'destructive', title: "Revocation Blocked", description: "Lifting Node origin not resolved." });
        return;
    }
    
    showLoader();
    try {
        await runTransaction(firestore, async (transaction) => {
            const shipRef = doc(firestore, `plants/${plantId}/shipments`, id);
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
                description: `Revoked Sale Order ${shipment.shipmentId}.`
            });
        });

        toast({ title: 'Order Revoked', description: `Registry updated for ${shipment.shipmentId}.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Commit Failed', description: e.message || 'Registry handshake error.' });
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
        const currentOperator = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0]);

        for (const id of ids) {
            const shipment = allShipments.find(s => s.id === id);
            if (!shipment) continue;
            
            const plantId = normalizePlantId(shipment.originPlantId);
            if (!plantId) continue;

            const recycleRef = doc(collection(firestore, "recycle_bin"));
            batch.set(recycleRef, {
                pageName: "Order Plan (Bulk)",
                userName: currentOperator,
                deletedAt: ts,
                data: sanitizeRegistryNode({ ...shipment, id: shipment.id, type: 'Shipment' })
            });
            batch.delete(doc(firestore, `plants/${plantId}/shipments`, id));
        }
        await batch.commit();
        toast({ title: 'Bulk Purge Complete', description: `${ids.length} orders removed from registry.` });
    } catch (e: any) {
        console.error("Purge Error:", e);
        toast({ variant: 'destructive', title: 'Purge Failed', description: e.message || 'Registry synchronization error.' });
    } finally {
        hideLoader();
    }
  };

  if (isLoadingMeta && authorizedPlantIds.length === 0) {
    return (
        <div className="flex h-screen flex-col items-center justify-center bg-[#f8fafc]">
            <Loader2 className="h-12 w-12 animate-spin text-blue-900 mb-4" />
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Syncing Plant Registry...</p>
        </div>
    );
  }

  const isReadOnlyPlant = !isAdminSession && plants.length === 1;

  return (
    <div className="flex flex-1 flex-col h-full bg-[#f8fafc] overflow-hidden">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
            {/* UNIFIED HEADER TERMINAL */}
            <div className="bg-white border-b px-4 md:px-8 py-2 md:py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm relative z-30">
                <div className="flex flex-wrap items-center gap-8 md:gap-12">
                    {/* TITLE NODE */}
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-blue-900 text-white rounded-xl shadow-lg rotate-3 shrink-0">
                            <Package className="h-5 w-5" />
                        </div>
                        <h1 className="text-sm md:text-xl font-black text-blue-900 uppercase tracking-tight italic leading-none truncate">Order Plan Control</h1>
                    </div>

                    {/* NAVIGATION TABS NODE */}
                    <TabsList className="bg-transparent h-auto p-0 border-b-0 gap-6 md:gap-10 justify-start">
                        <TabsTrigger value="create" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-1 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
                            <Package className="h-3.5 w-3.5" /> Create Order
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-1 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
                            <ListTree className="h-3.5 w-3.5" /> Order Ledger 
                            <Badge className="ml-1 md:ml-2 bg-slate-100 text-slate-500 border-none font-black text-[7px] md:text-[8px] px-1.5 h-4 md:h-5">{filteredShipments.length}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>
                
                {/* LIFTING SCOPE SELECT */}
                <div className="flex items-center gap-2 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100 shadow-inner w-full md:w-auto">
                    <div className="flex flex-col gap-0.5 flex-1 md:flex-none">
                        <Label className="text-[7px] md:text-[8px] font-black uppercase text-slate-400 px-1">Lifting Scope</Label>
                        {isReadOnlyPlant ? (
                            <div className="h-8 md:h-9 px-3 flex items-center bg-white border border-slate-200 rounded-lg text-blue-900 font-black text-[9px] md:text-[10px] shadow-sm uppercase min-w-[160px]">
                                <ShieldCheck className="h-3 w-3 mr-2 text-blue-600" /> {plants[0]?.name}
                            </div>
                        ) : (
                            <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                                <SelectTrigger className="w-full md:w-[180px] h-8 md:h-9 rounded-lg bg-white border-slate-200 font-bold shadow-sm text-[9px] md:text-[10px]">
                                    <SelectValue placeholder="Pick node" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all-plants" className="font-black uppercase text-[9px] tracking-widest text-blue-600">All Authorized Plants</SelectItem>
                                    {plants.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="font-bold py-2 uppercase italic text-black">{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            </div>

            {/* CONTENT NODE */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <TabsContent value="create" className="focus-visible:ring-0 m-0">
                        <CreatePlan onShipmentCreated={() => handleTabChange('history')} authorizedPlants={plants} />
                    </TabsContent>

                    <TabsContent value="history" className="focus-visible:ring-0 m-0">
                        <ShipmentData 
                            shipments={filteredShipments} 
                            plants={plants} 
                            onEdit={setEditingShipment} 
                            onDelete={handleCancelOrder} 
                            onBulkDelete={handleBulkDelete}
                        />
                    </TabsContent>
                </div>
            </div>
        </Tabs>

        {editingShipment && (
            <EditShipmentModal 
                isOpen={!!editingShipment} 
                onClose={() => setEditingShipment(null)} 
                shipment={editingShipment} 
                onShipmentUpdated={handleShipmentUpdated} 
            />
        )}
    </div>
  );
}

export default function ShipmentPlanPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <ShipmentPlanContent />
        </Suspense>
    );
}
