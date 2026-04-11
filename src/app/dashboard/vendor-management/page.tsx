'use client';

import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, orderBy, onSnapshot } from "firebase/firestore";
import type { WithId, FuelPump } from '@/types';
import CreatePumpForm from '@/components/dashboard/fuel-pump/CreatePumpForm';
import EditVendorModal from '@/components/dashboard/fuel-pump/EditVendorModal';
import PumpHistoryTable from '@/components/dashboard/fuel-pump/PumpHistoryTable';
import { Loader2, WifiOff, Users, Settings2, Truck } from "lucide-react";
import { sanitizeRegistryNode } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { AlertDialog } from "@/components/ui/alert-dialog";

export default function VendorManagementPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin" /></div>}>
             <AlertDialog>
                <VendorManagementContent />
            </AlertDialog>
        </Suspense>
    );
}

function VendorManagementContent() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const { toast } = useToast();
  
  const [pumps, setPumps] = useState<WithId<FuelPump>[]>([]);
  const [pumpsLoading, setPumpsLoading] = useState(true);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<WithId<FuelPump> | null>(null);

  useEffect(() => {
      if (firestore) {
          const pumpsQuery = query(collection(firestore, 'fuel_pumps'), orderBy('name'));
          const unsubscribe = onSnapshot(pumpsQuery, (querySnapshot) => {
              const pumpData = querySnapshot.docs.map(d => ({id: d.id, ...d.data()})) as WithId<FuelPump>[];
              setPumps(pumpData);
              setPumpsLoading(false);
          }, (error) => {
              console.error("Error fetching pumps:", error);
              setPumpsLoading(false);
          });

          return () => unsubscribe();
      }
  }, [firestore]);

  const handleDeleteVendor = async (id: string) => {
      if (!firestore || !user) return;
      showLoader();
      try {
          const vendorRef = doc(firestore, "fuel_pumps", id);
          const vendorSnap = await getDoc(vendorRef);
          if (vendorSnap.exists()) {
              const data = vendorSnap.data();
              const operator = user.email?.split('@')[0] || "Admin";
              await addDoc(collection(firestore, "recycle_bin"), {
                  pageName: "Vendor Management",
                  userName: operator,
                  deletedAt: serverTimestamp(),
                  data: { ...data, id, type: 'FuelPump' }
              });
              await deleteDoc(vendorRef);
              toast({ title: 'Vendor Removed', description: 'Identity moved to system archive.' });
          }
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
      } finally {
          hideLoader();
      }
  };

  const handleUpdateVendor = async (id: string, data: Partial<FuelPump>) => {
      if (!firestore) return;
      showLoader();
      try {
          const sanitized = sanitizeRegistryNode(data);
          await updateDoc(doc(firestore, "fuel_pumps", id), { ...sanitized, updatedAt: serverTimestamp() });
          toast({ title: 'Registry Updated', description: 'Vendor particulars modified successfully.' });
          setEditOpen(false);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
      } finally {
          hideLoader();
      }
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-slate-50/50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3">
                <Truck className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tight">Vendor Management</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Transporter & Service Registry</p>
            </div>
        </div>
        {!firestore && (
            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-medium">
                <WifiOff className="h-3 w-3" />
                <span>Registry Offline</span>
            </div>
        )}
      </div>

    <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Vendor Registry</CardTitle>
                <CardDescription>Manage all registered transporter and service vendors.</CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)}>Add New Vendor</Button>
        </CardHeader>
        <CardContent>
            <PumpHistoryTable 
                pumps={pumps} 
                isLoading={pumpsLoading} 
                onEdit={(p) => { setEditingVendor(p); setEditOpen(true); }} 
                onDelete={handleDeleteVendor} 
            />
            <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader><DialogTitle>Register New Vendor</DialogTitle></DialogHeader>
                    <CreatePumpForm onSave={async (data) => {
                        if(firestore) {
                            const sanitizedData = sanitizeRegistryNode(data);
                            await addDoc(collection(firestore, 'fuel_pumps'), { ...sanitizedData, createdAt: serverTimestamp() });
                            setCreateOpen(false);
                        }
                    }} />
                </DialogContent>
            </Dialog>
        </CardContent>
    </Card>
    {editingVendor && (
        <EditVendorModal 
            isOpen={isEditOpen}
            onClose={() => setEditOpen(false)}
            vendor={editingVendor}
            onSave={handleUpdateVendor}
        />
    )}
    </main>
  );
}
