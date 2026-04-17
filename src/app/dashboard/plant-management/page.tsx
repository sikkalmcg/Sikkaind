
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from "@/firebase";
import { collection, query, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, setDoc, orderBy, onSnapshot } from "firebase/firestore";
import type { WithId, Plant } from '@/types';
import PartyCreationTab from '@/components/dashboard/plant-management/PartyCreationTab';
import { Loader2, WifiOff, Building2, Settings2, Users, Edit2, Trash2 } from "lucide-react";
import { useSearchParams, useRouter } from 'next/navigation';
import { normalizePlantId } from '@/lib/utils';
import { useLoading } from '@/context/LoadingContext';
import { Badge } from '@/components/ui/badge';

// Zod Schemas
const plantSchema = z.object({
  id: z.string().min(1, 'Plant ID is required'),
  name: z.string().min(1, 'Plant name is required'),
  address: z.string().optional().default(''),
  isMainPlant: z.boolean().default(true),
});
type PlantFormValues = z.infer<typeof plantSchema>;

// Main Page Component
function PlantManagementContent() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultTab = searchParams.get('tab') || 'create-plant';

  const handleTabChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', val);
    router.replace(`/dashboard/plant-management?${params.toString()}`);
  };

  return (
    <main className="flex flex-1 flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-lg rotate-3">
                <Settings2 className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-blue-900 uppercase tracking-tight italic">Plant Registry Hub</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Lifting Node Master Registry Configuration</p>
            </div>
        </div>
        {!firestore && (
            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-black uppercase border border-orange-200">
                <WifiOff className="h-3 w-3" />
                <span>Registry Offline</span>
            </div>
        )}
      </div>

      <div className="p-4 md:p-8 space-y-8">
        <Tabs value={defaultTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="bg-transparent border-b h-14 rounded-none gap-10 p-0 mb-10 w-full justify-start overflow-x-auto no-scrollbar">
                <TabsTrigger value="create-plant" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2.5 whitespace-nowrap">
                    <Building2 className="h-4 w-4" /> Plant Configuration
                </TabsTrigger>
                <TabsTrigger value="party-creation" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 pb-4 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2.5 whitespace-nowrap">
                    <Users className="h-4 w-4" /> Party Registry
                </TabsTrigger>
            </TabsList>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                <TabsContent value="create-plant" className="m-0 focus-visible:ring-0">
                    <CreatePlantSection />
                </TabsContent>
                <TabsContent value="party-creation" className="m-0 focus-visible:ring-0">
                    <PartyCreationTab />
                </TabsContent>
            </div>
        </Tabs>
      </div>
    </main>
  );
}

// --- Helper Sections ---

const CreatePlantSection = () => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();
    const [plants, setPlants] = useState<WithId<Plant>[]>([]);
    const [plantsLoading, setPlantsLoading] = useState(true);
    const [editingPlant, setEditingPlant] = useState<WithId<Plant> | null>(null);

    useEffect(() => {
        if (firestore) {
            const plantsQuery = query(collection(firestore, 'plants'), orderBy('name'));
            const unsubscribe = onSnapshot(plantsQuery, (querySnapshot) => {
                const plantData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as WithId<Plant>[];
                setPlants(plantData);
                setPlantsLoading(false);
            }, (error) => {
                console.error("Error fetching plants:", error);
                setPlantsLoading(false);
            });

            return () => unsubscribe();
        }
    }, [firestore]);

    const plantForm = useForm<PlantFormValues>({
        resolver: zodResolver(plantSchema),
        defaultValues: { id: '', name: '', address: '', isMainPlant: false },
    });

    useEffect(() => {
        if (editingPlant) {
            plantForm.reset(editingPlant);
        } else {
            plantForm.reset({ id: '', name: '', address: '', isMainPlant: false });
        }
    }, [editingPlant, plantForm]);

    const onPlantSubmit = async (values: PlantFormValues) => {
        showLoader();
        try {
            if (editingPlant) {
                const plantDoc = doc(firestore, 'plants', editingPlant.id);
                await updateDoc(plantDoc, { ...values });
                toast({ title: 'Success', description: 'Plant updated successfully.' });
            } else {
                const plantId = normalizePlantId(values.id);
                const plantDoc = doc(firestore, 'plants', plantId);
                const docSnap = await getDoc(plantDoc);
                if (docSnap.exists()) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Plant ID already exists.' });
                    hideLoader();
                    return;
                }
                await setDoc(plantDoc, { ...values, createdAt: serverTimestamp() });
                toast({ title: 'Success', description: 'Plant created successfully.' });
            }
            setEditingPlant(null);
        } catch (error) {
            console.error('Error saving plant:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save plant.' });
        } finally {
            hideLoader();
        }
    };
    
    const deletePlant = async (id: string) => {
        showLoader();
        try {
            await deleteDoc(doc(firestore, 'plants', id));
            toast({ title: 'Success', description: 'Plant deleted successfully.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete plant.' });
        } finally {
            hideLoader();
        }
    };

    return (
        <div className="grid md:grid-cols-12 gap-10 items-start">
            <div className="md:col-span-4">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader className="p-8 bg-slate-50 border-b">
                        <CardTitle className="text-lg font-black uppercase text-slate-700 italic">{editingPlant ? 'Edit Node' : 'Provision Plant'}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <Form {...plantForm}>
                            <form onSubmit={plantForm.handleSubmit(onPlantSubmit)} className="space-y-6">
                                <FormField control={plantForm.control} name="id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Plant Registry ID *</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g. JAI01" disabled={!!editingPlant} className="h-12 rounded-xl font-black text-blue-900 uppercase bg-slate-50 shadow-inner" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={plantForm.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Node Identification *</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g. JAIPUR HUB" className="h-12 rounded-xl font-bold bg-white" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={plantForm.control} name="address" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Physical Registry Address</FormLabel>
                                        <FormControl><Input {...field} placeholder="Full address particulars" className="h-12 rounded-xl bg-white" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={plantForm.control} name="isMainPlant" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-2xl border-2 p-5 shadow-sm bg-slate-50/50 border-slate-100">
                                        <FormLabel className="text-[10px] font-black uppercase text-blue-900">Primary Mission Node</FormLabel>
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-6 w-6 rounded-lg data-[state=checked]:bg-blue-900 shadow-md" /></FormControl>
                                    </FormItem>
                                )} />
                                <div className="flex justify-end gap-3 pt-6 border-t">
                                    {editingPlant && <Button type="button" variant="ghost" onClick={() => setEditingPlant(null)} className="font-black text-slate-400 uppercase text-[10px]">Discard</Button>}
                                    <Button type="submit" className="bg-blue-900 hover:bg-black text-white px-10 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 border-none">
                                        {editingPlant ? 'Update Node' : 'Initialize Node'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-8">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <CardHeader className="p-8 bg-slate-50 border-b">
                        <CardTitle className="text-lg font-black uppercase text-slate-700 italic">Active Node Ledger</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="h-12 hover:bg-transparent">
                                    <TableHead className="text-[10px] font-black uppercase px-8">Plant Identity</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4">Node ID</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center">Primary</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-8 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {plantsLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-48 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-blue-900 opacity-20" /></TableCell></TableRow>
                                ) : plants.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-48 text-center text-slate-400 italic">No plants defined in master registry.</TableCell></TableRow>
                                ) : (
                                    plants.map(plant => (
                                        <TableRow key={plant.id} className="h-16 hover:bg-blue-50/20 border-b border-slate-50 last:border-0 transition-colors group">
                                            <TableCell className="px-8 font-black text-slate-900 uppercase text-xs tracking-tight">{plant.name}</TableCell>
                                            <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter uppercase"><Badge variant="secondary" className="bg-blue-50 text-blue-900 border-none font-black h-5 px-3">ID: {plant.id}</Badge></TableCell>
                                            <TableCell className="px-4 text-center">
                                                {plant.isMainPlant ? <Badge className="bg-emerald-600 font-black uppercase text-[8px] px-3 h-5">PRIMARY</Badge> : <span className="text-[9px] font-bold text-slate-300">SECONDARY</span>}
                                            </TableCell>
                                            <TableCell className="px-8 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                    <Button variant="ghost" size="icon" onClick={() => setEditingPlant(plant)} className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-4 w-4" /></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent className="rounded-3xl border-none p-0 overflow-hidden">
                                                            <div className="p-8 bg-red-50 border-b border-red-100 flex items-center gap-4">
                                                                <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg"><Trash2 className="h-6 w-6" /></div>
                                                                <div>
                                                                    <AlertDialogTitle className="text-xl font-black text-red-900 uppercase">Revoke Plant node?</AlertDialogTitle>
                                                                    <p className="text-red-700 font-bold text-[9px] uppercase tracking-widest mt-1">Registry Disposal Protocol</p>
                                                                </div>
                                                            </div>
                                                            <div className="p-8"><p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-4 border-red-100 pl-4">"Deleting **{plant.name}** will scrub it from all new mission assignments. Associated history may be archived."</p></div>
                                                            <AlertDialogFooter className="bg-slate-50 p-6 flex-row gap-3 border-t">
                                                                <AlertDialogCancel className="font-bold border-slate-200 h-10 px-8 rounded-xl m-0">Abort</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => deletePlant(plant.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8 rounded-xl border-none shadow-lg">Confirm Purge</AlertDialogAction>
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
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};


// Page Export
export default function PlantManagementPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#f8fafc]"><Loader2 className="h-12 w-12 animate-spin text-blue-900 opacity-20" /></div>}>
            <AlertDialog>
                <PlantManagementContent />
            </AlertDialog>
        </Suspense>
    );
}
