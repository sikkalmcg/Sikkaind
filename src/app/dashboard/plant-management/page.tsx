
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, setDoc, orderBy, onSnapshot } from "firebase/firestore";
import type { WithId, Plant, ShipmentStatusMaster, MasterQtyType, FuelPump } from '@/types';
import PartyCreationTab from '@/components/dashboard/plant-management/PartyCreationTab';
import CreatePumpForm from '@/components/dashboard/fuel-pump/CreatePumpForm';
import EditVendorModal from '@/components/dashboard/fuel-pump/EditVendorModal';
import PumpHistoryTable from '@/components/dashboard/fuel-pump/PumpHistoryTable';
import { Loader2, WifiOff, Building2, Fuel, Tag, Settings2, Users, Save, Edit2, ShieldCheck, MapPin, History, Trash2, Activity, Truck } from "lucide-react";
import { useSearchParams, useRouter } from 'next/navigation';
import { cn, normalizePlantId, sanitizeRegistryNode } from '@/lib/utils';
import { FuelPumpPaymentMethods } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const statusSchema = z.object({
  name: z.string().min(1, 'Status name is required'),
});
type StatusFormValues = z.infer<typeof statusSchema>;

const qtyTypeSchema = z.object({
    name: z.string().min(1, 'Qty Type name is required'),
});
type QtyTypeFormValues = z.infer<typeof qtyTypeSchema>;

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
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-slate-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3">
                <Settings2 className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tight">Logistics Plant Management</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Lifting Node Master Registry Configuration</p>
            </div>
        </div>
        {!firestore && (
            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-medium">
                <WifiOff className="h-3 w-3" />
                <span>Registry Offline</span>
            </div>
        )}
      </div>

      <Tabs value={defaultTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-transparent border-b h-12 rounded-none gap-8 p-0 mb-8 overflow-x-auto justify-start">
            <TabsTrigger value="create-plant" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2"><Building2 className="h-4 w-4" /> Plant Configuration</TabsTrigger>
            <TabsTrigger value="vendors" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2"><Truck className="h-4 w-4" /> Vendors</TabsTrigger>
            <TabsTrigger value="party-creation" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2"><Users className="h-4 w-4" /> Party Registry</TabsTrigger>
            <TabsTrigger value="create-status" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2"><Activity className="h-4 w-4" /> Status Master</TabsTrigger>
            <TabsTrigger value="create-qty-type" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2"><Tag className="h-4 w-4" /> Qty Types</TabsTrigger>
        </TabsList>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <TabsContent value="create-plant"><CreatePlantSection /></TabsContent>
            <TabsContent value="vendors"><FuelPumpSection /></TabsContent>
            <TabsContent value="party-creation"><PartyCreationTab /></TabsContent>
            <TabsContent value="create-status"><CreateStatusSection /></TabsContent>
            <TabsContent value="create-qty-type"><CreateQtyTypeSection /></TabsContent>
        </div>
      </Tabs>
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
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch plants.' });
                setPlantsLoading(false);
            });

            return () => unsubscribe();
        }
    }, [firestore, toast]);

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
        <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>{editingPlant ? 'Edit Plant' : 'Create Plant'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Form {...plantForm}>
                            <form onSubmit={plantForm.handleSubmit(onPlantSubmit)} className="space-y-4">
                                <FormField control={plantForm.control} name="id" render={({ field }) => <FormItem><FormLabel>Plant ID</FormLabel><FormControl><Input {...field} placeholder="e.g., JAI01" disabled={!!editingPlant} /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={plantForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Plant Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Jaipur Plant" /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={plantForm.control} name="address" render={({ field }) => <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} placeholder="Full address" /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={plantForm.control} name="isMainPlant" render={({ field }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><FormLabel>Is Main Plant?</FormLabel><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
                                <div className="flex justify-end gap-2 pt-4">
                                    {editingPlant && <Button type="button" variant="outline" onClick={() => setEditingPlant(null)}>Cancel</Button>}
                                    <Button type="submit">{editingPlant ? 'Update' : 'Create'}</Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2">
                <Card>
                    <CardHeader><CardTitle>Existing Plants</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>ID</TableHead><TableHead>Main</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {plantsLoading && <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                                {plants.map(plant => (
                                    <TableRow key={plant.id}>
                                        <TableCell>{plant.name}</TableCell>
                                        <TableCell><Badge variant="secondary">{plant.id}</Badge></TableCell>
                                        <TableCell>{plant.isMainPlant ? 'Yes' : 'No'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => setEditingPlant(plant)}><Edit2 className="h-4 w-4" /></Button>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the plant.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deletePlant(plant.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const FuelPumpSection = () => {
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
    <>
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
    </>
  );
}

const CreateStatusSection = () => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();
    const [statuses, setStatuses] = useState<WithId<ShipmentStatusMaster>[]>([]);
    const [statusesLoading, setStatusesLoading] = useState(true);

    useEffect(() => {
        if (firestore) {
            const statusesQuery = query(collection(firestore, 'shipment_status_master'), orderBy('name'));
            const unsubscribe = onSnapshot(statusesQuery, (querySnapshot) => {
                const statusData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as WithId<ShipmentStatusMaster>[];
                setStatuses(statusData);
                setStatusesLoading(false);
            }, (error) => {
                console.error("Error fetching statuses:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch statuses.' });
                setStatusesLoading(false);
            });

            return () => unsubscribe();
        }
    }, [firestore, toast]);

    const statusForm = useForm<StatusFormValues>({ resolver: zodResolver(statusSchema), defaultValues: { name: '' }});

    const onStatusSubmit = async (values: StatusFormValues) => {
        showLoader();
        try {
            await addDoc(collection(firestore, 'shipment_status_master'), { ...values, createdAt: serverTimestamp() });
            toast({ title: 'Success', description: 'Status created successfully.' });
            statusForm.reset();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create status.' });
        } finally {
            hideLoader();
        }
    };
    
    const deleteStatus = async (id: string) => {
        showLoader();
        try {
            await deleteDoc(doc(firestore, 'shipment_status_master', id));
            toast({ title: 'Success', description: 'Status deleted successfully.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete status.' });
        } finally {
            hideLoader();
        }
    };

    return (
         <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
                <Card>
                    <CardHeader><CardTitle>Create Status</CardTitle></CardHeader>
                    <CardContent>
                        <Form {...statusForm}>
                            <form onSubmit={statusForm.handleSubmit(onStatusSubmit)} className="space-y-4">
                                <FormField control={statusForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Status Name</FormLabel><FormControl><Input {...field} placeholder="e.g., In Transit" /></FormControl><FormMessage /></FormItem>} />
                                <Button type="submit">Create Status</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2">
                <Card>
                    <CardHeader><CardTitle>Existing Statuses</CardTitle></CardHeader>
                    <CardContent>
                       <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {statusesLoading && <TableRow><TableCell colSpan={2} className="text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                                {statuses.map(status => (
                                    <TableRow key={status.id}>
                                        <TableCell>{status.name}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the status.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteStatus(status.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const CreateQtyTypeSection = () => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();
    const [qtyTypes, setQtyTypes] = useState<WithId<MasterQtyType>[]>([]);
    const [qtyTypesLoading, setQtyTypesLoading] = useState(true);

    useEffect(() => {
        if (firestore) {
            const qtyTypesQuery = query(collection(firestore, 'master_qty_type'), orderBy('name'));
            const unsubscribe = onSnapshot(qtyTypesQuery, (querySnapshot) => {
                const typeData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as WithId<MasterQtyType>[];
                setQtyTypes(typeData);
                setQtyTypesLoading(false);
            }, (error) => {
                console.error("Error fetching quantity types:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch quantity types.' });
                setQtyTypesLoading(false);
            });

            return () => unsubscribe();
        }
    }, [firestore, toast]);

    const qtyTypeForm = useForm<QtyTypeFormValues>({ resolver: zodResolver(qtyTypeSchema), defaultValues: { name: '' }});

    const onQtyTypeSubmit = async (values: QtyTypeFormValues) => {
        showLoader();
        try {
            await addDoc(collection(firestore, 'master_qty_type'), { ...values, createdAt: serverTimestamp() });
            toast({ title: 'Success', description: 'Quantity type created.' });
            qtyTypeForm.reset();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create quantity type.' });
        } finally {
            hideLoader();
        }
    };
    
    const deleteQtyType = async (id: string) => {
        showLoader();
        try {
            await deleteDoc(doc(firestore, 'master_qty_type', id));
            toast({ title: 'Success', description: 'Quantity type deleted.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete type.' });
        } finally {
            hideLoader();
        }
    };
    
    return (
         <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
                <Card>
                    <CardHeader><CardTitle>Create Quantity Type</CardTitle></CardHeader>
                    <CardContent>
                        <Form {...qtyTypeForm}>
                            <form onSubmit={qtyTypeForm.handleSubmit(onQtyTypeSubmit)} className="space-y-4">
                                <FormField control={qtyTypeForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Type Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Tons, Liters" /></FormControl><FormMessage /></FormItem>} />
                                <Button type="submit">Create Type</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2">
                <Card>
                    <CardHeader><CardTitle>Existing Types</CardTitle></CardHeader>
                    <CardContent>
                       <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {qtyTypesLoading && <TableRow><TableCell colSpan={2} className="text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                                {qtyTypes.map(type => (
                                    <TableRow key={type.id}>
                                        <TableCell>{type.name}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the quantity type.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteQtyType(type.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </TableCell>
                                    </TableRow>
                                ))}
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
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin" /></div>}>
             <AlertDialog>
                <PlantManagementContent />
            </AlertDialog>
        </Suspense>
    );
}
