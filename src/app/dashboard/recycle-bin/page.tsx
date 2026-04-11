'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { WithId, RecycledItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import ViewRecycledItemModal from '@/components/dashboard/recycle-bin/ViewRecycledItemModal';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, deleteDoc, addDoc, serverTimestamp, Timestamp, setDoc, writeBatch } from "firebase/firestore";
import { Loader2, WifiOff, Trash2, RotateCcw, AlertTriangle, Box, User, Clock, Layers } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecycleBinPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [viewingItem, setViewingItem] = useState<WithId<RecycledItem> | null>(null);
  const [isPurgingAll, setIsPurgingAll] = useState(false);

  const recycleQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "recycle_bin")) : null, 
    [firestore]
  );
  const { data: recycledItems, isLoading, error: dbError } = useCollection<RecycledItem>(recycleQuery);

  const handleRestoreItem = async (recycledItem: WithId<RecycledItem>) => {
    if (!firestore) return;
    try {
      const { data, pageName } = recycledItem;
      let targetRef = null;
      
      const { type, id: originalId, ...originalData } = data;
      const cleanData = { ...originalData, restoredAt: serverTimestamp() };

      if (type === 'FuelPump') targetRef = doc(firestore, "fuel_pumps", originalId);
      else if (type === 'Carrier') targetRef = doc(firestore, "carriers", originalId);
      else if (type === 'Plant') targetRef = doc(firestore, "accounts_plants", originalId);
      else if (type === 'FuelPayment') targetRef = doc(firestore, "fuel_payments", originalId);
      else if (type === 'Shipment') targetRef = doc(firestore, `plants/${data.originPlantId}/shipments`, originalId);
      else if (type === 'Vehicle') targetRef = doc(firestore, "vehicles", originalId);
      else if (type === 'Party') targetRef = doc(firestore, "accounts_parties", originalId);
      else if (type === 'Status') targetRef = doc(firestore, "shipment_status_masters", originalId);
      else if (type === 'QtyType') targetRef = doc(firestore, "material_types", originalId);
      else if (type === 'VehicleEntry') targetRef = doc(firestore, "vehicleEntries", originalId);
      else if (type === 'FuelEntry') targetRef = doc(firestore, `plants/${data.plantId}/fuel_entries`, originalId);
      else if (type === 'Trip') {
          targetRef = doc(firestore, `plants/${data.originPlantId}/trips`, originalId);
          // Dual Node Restoration: Trip must be restored to both plant and global registry
          await setDoc(doc(firestore, 'trips', originalId), cleanData);
      }

      if (!targetRef) throw new Error("Unknown registry type.");

      await setDoc(targetRef, cleanData);
      await deleteDoc(doc(firestore, "recycle_bin", recycledItem.id));

      toast({ title: 'Restoration Complete', description: `Record returned to ${pageName} successfully.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
    }
  };

  const handlePermanentlyDeleteItem = async (itemId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "recycle_bin", itemId));
      toast({ title: 'Permanently Purged', description: 'Record scrubbed from mission registry.', variant: 'destructive' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Purge Failed', description: error.message });
    }
  }

  const handlePurgeAll = async () => {
    if (!firestore || !recycledItems || recycledItems.length === 0) return;
    setIsPurgingAll(true);
    try {
        const batch = writeBatch(firestore);
        recycledItems.forEach((item) => {
            batch.delete(doc(firestore, "recycle_bin", item.id));
        });
        await batch.commit();
        toast({ title: 'Registry Scrubbed', description: `${recycledItems.length} records purged permanently.`, variant: 'destructive' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Purge Failed', description: error.message });
    } finally {
        setIsPurgingAll(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col h-full bg-[#f1f5f9] animate-in fade-in duration-500">
        <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="p-2 bg-primary text-white rounded-lg shadow-lg rotate-3">
                    <Trash2 className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight uppercase">SIKKA LMC Archive Hub</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry &gt; System Trash Node</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {dbError && <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-orange-200 tracking-wider"><WifiOff className="h-3 w-3" /> <span>Registry Unstable</span></div>}
                {recycledItems && recycledItems.length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="h-11 px-8 rounded-xl font-black uppercase text-[11px] tracking-widest gap-2 shadow-xl shadow-destructive/20 border-none transition-all active:scale-95" disabled={isPurgingAll}>
                                {isPurgingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                Scrub All Records
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-none shadow-2xl p-0 overflow-hidden">
                            <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-5">
                                <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl"><AlertTriangle className="h-6 w-6" /></div>
                                <div>
                                    <AlertDialogTitle className="text-xl font-black text-red-900 uppercase tracking-tight">Execute Registry Purge?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-red-700 font-bold text-[10px] uppercase tracking-widest mt-1">Authorized Data Disposal</AlertDialogDescription>
                                </div>
                            </div>
                            <div className="p-8"><p className="text-sm font-medium text-slate-600 leading-relaxed">This action will permanently erase <span className="font-black text-slate-900">{recycledItems.length}</span> records from the cloud. This process cannot be reversed by any mission operator.</p></div>
                            <AlertDialogFooter className="bg-slate-50 p-6 flex-row gap-3 border-t">
                                <AlertDialogCancel className="font-bold border-slate-200 rounded-xl px-8">Discard</AlertDialogCancel>
                                <AlertDialogAction onClick={handlePurgeAll} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[11px] tracking-widest px-10 rounded-xl shadow-lg shadow-red-100 border-none">Purge All Node</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        </div>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border shadow-sm"><Layers className="h-4 w-4 text-primary" /></div>
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-widest">Active Archive Registry</CardTitle>
                            <CardDescription className="text-[10px] font-bold text-slate-400 uppercase">Items stored for 30-day retention before auto-purge</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-8 text-slate-400">Page Node</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-4 text-slate-400">Operator</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-4 text-slate-400">Disposal Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-4 text-slate-400">Context</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-8 text-slate-400 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({length: 5}).map((_, i) => (<TableRow key={i}><TableCell colSpan={5} className="p-8"><Skeleton className="h-8 w-full" /></TableCell></TableRow>))
                                ) : recycledItems?.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center text-slate-400 italic font-medium text-sm">System Trash node is empty.</TableCell></TableRow>
                                ) : (
                                    recycledItems?.map(item => (
                                        <TableRow key={item.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                            <TableCell className="px-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 bg-slate-100 rounded-md group-hover:bg-primary/10 group-hover:text-primary transition-colors"><Box className="h-3.5 w-3.5" /></div>
                                                    <span className="text-xs font-black uppercase text-slate-700">{item.pageName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <User className="h-3 w-3" />
                                                    <span className="text-[11px] font-bold uppercase">{item.userName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <Clock className="h-3 w-3" />
                                                    <span className="text-[10px] font-mono">{format(item.deletedAt instanceof Timestamp ? item.deletedAt.toDate() : new Date(item.deletedAt), 'dd/MM/yy HH:mm')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4">
                                                <button onClick={() => setViewingItem(item)} className="h-auto p-0 font-bold text-xs text-primary uppercase tracking-tighter hover:underline">Inspect Data Node</button>
                                            </TableCell>
                                            <TableCell className="px-8 text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="sm" variant="ghost" className="h-8 rounded-lg font-black text-[10px] uppercase text-emerald-600 hover:bg-emerald-50 gap-2 border border-emerald-100 shadow-sm">
                                                                <RotateCcw className="h-3.5 w-3.5" /> Restore
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="border-none shadow-2xl">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="text-emerald-900 font-black uppercase tracking-tight">Initiate Restoration?</AlertDialogTitle>
                                                                <AlertDialogDescription className="text-sm font-medium">This will return the record to its original lifting node registry in real-time.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 flex-row gap-3">
                                                                <AlertDialogCancel className="font-bold border-slate-200 rounded-xl px-8 h-10 m-0">Wait</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleRestoreItem(item)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-8">Confirm Link</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>

                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-red-50 border border-red-50">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="border-none shadow-2xl">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="text-red-900 font-black uppercase tracking-tight">Final Purge Execution?</AlertDialogTitle>
                                                                <AlertDialogDescription className="text-sm font-medium text-red-700">Warning: This scrub action is permanent and cannot be reversed by mission control.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter className="bg-red-50 -mx-6 -mb-6 p-6 flex-row gap-3">
                                                                <AlertDialogCancel className="font-bold">Abort</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handlePermanentlyDeleteItem(item.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8 border-none">Purge Node</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
        
        {viewingItem && (
            <ViewRecycledItemModal 
                isOpen={!!viewingItem}
                onClose={() => setViewingItem(null)}
                item={viewingItem}
            />
        )}
    </main>
  );
}
