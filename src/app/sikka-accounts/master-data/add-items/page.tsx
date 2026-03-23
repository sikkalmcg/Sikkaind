'use client';

import React, { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import type { Plant, WithId, MasterDataItem, MasterInvoiceType, MasterChargeType, MasterUnitType, SubUser } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, ToggleLeft, ToggleRight, Factory, WifiOff, Save } from 'lucide-react';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CreateFreightMasterTab from '@/components/sikka-accounts/freight-master/CreateFreightMasterTab';
import ItemHistoryTable from '@/components/sikka-accounts/add-items/ItemHistoryTable';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, orderBy, where, getDocs, limit } from "firebase/firestore";
import { useLoading } from '@/context/LoadingContext';

const formSchema = z.object({
  plantId: z.string().min(1, "PLANT ID is required"),
  invoiceTypeId: z.string().min(1, "Invoice type is required."),
  chargeTypeId: z.string().min(1, "Charge type is required."),
  itemDescription: z.string().min(1, "Item Description is required"),
  hsnSac: z.string().min(1, "HSN/SAC is required"),
  unitTypeId: z.string().min(1, "UOM type is required."),
  rate: z.coerce.number().positive(),
  isGstApplicable: z.boolean().default(false),
  gstRate: z.coerce.number().optional(),
  ota: z.boolean().default(false),
  validFrom: z.date().optional(),
  validTo: z.date().optional(),
  validityDate: z.date().optional(),
}).refine((data) => {
    if (data.isGstApplicable) {
        return data.gstRate !== undefined && data.gstRate > 0;
    }
    return true;
}, {
    message: "GST Rate is required if GST is applicable.",
    path: ["gstRate"],
}).refine((data) => {
    if (!data.ota) {
        return !!data.validFrom && !!data.validTo;
    }
    return !!data.validityDate;
}, {
    message: "Mandatory date fields missing.",
    path: ["validFrom"],
});

type FormValues = z.infer<typeof formSchema>;

function CreateChangeItemPage() {
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { user } = useUser();
    const { showLoader, hideLoader } = useLoading();
    const { setSaveAction, setCancelAction, setStatusBar } = useSikkaAccountsPage();

    const [itemId, setItemId] = useState<string | null>(null);
    const isEditMode = !!itemId;
    const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
    const [activeTab, setActiveTab] = useState('material-master');

    const plantsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "accounts_plants"), orderBy("createdAt", "desc")) : null, 
        [firestore]
    );
    const { data: allPlants, isLoading: isLoadingPlants } = useCollection<Plant>(plantsQuery);

    const itQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_invoice_types")) : null, [firestore]);
    const ctQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_charge_types")) : null, [firestore]);
    const utQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "master_unit_types")) : null, [firestore]);

    const { data: allInvoiceTypes } = useCollection<MasterInvoiceType>(itQuery);
    const { data: allChargeTypes } = useCollection<MasterChargeType>(ctQuery);
    const { data: allUnitTypes } = useCollection<MasterUnitType>(utQuery);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            plantId: '',
            itemDescription: '',
            hsnSac: '',
            isGstApplicable: false,
            ota: false,
        },
    });

    const { watch, handleSubmit, reset, setValue } = form;
    const isGstApplicable = watch('isGstApplicable');
    const ota = watch('ota');
    const selectedPlantInput = watch('plantId');

    const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

    useEffect(() => {
        if (!allPlants || !user || !firestore) return;
        const syncAuth = async () => {
            const userDoc = await getDoc(doc(firestore, "users", user.uid));
            let authIds: string[] = [];
            if (userDoc.exists()) {
                const data = userDoc.data() as SubUser;
                authIds = (data.username === 'sikkaind' || isAdminSession) ? allPlants.map(p => p.id) : (data.accounts_plant_ids || []);
            } else if (isAdminSession) {
                authIds = allPlants.map(p => p.id);
            }
            const filtered = allPlants.filter(p => authIds.includes(p.id));
            setAuthorizedPlants(filtered);
            if (filtered.length > 0 && !selectedPlantInput) setValue('plantId', filtered[0].id);
        };
        syncAuth();
    }, [allPlants, user, isAdminSession, firestore, setValue, selectedPlantInput]);

    const invoiceTypes = useMemo(() => (allInvoiceTypes || []).filter(it => it.plantId === selectedPlantInput), [allInvoiceTypes, selectedPlantInput]);
    const chargeTypes = useMemo(() => (allChargeTypes || []).filter(ct => ct.plantId === selectedPlantInput), [allChargeTypes, selectedPlantInput]);
    const unitTypes = useMemo(() => (allUnitTypes || []).filter(ut => ut.plantId === selectedPlantInput), [allUnitTypes, selectedPlantInput]);

    useEffect(() => {
        const id = searchParams.get('id');
        setItemId(id);
        if (id && firestore) {
            const fetchItem = async () => {
                const docRef = doc(firestore, "master_items", id);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setActiveTab('material-master');
                    reset({
                        ...data,
                        validFrom: data.validFrom ? (data.validFrom as any).toDate() : undefined,
                        validTo: data.validTo ? (data.validTo as any).toDate() : undefined,
                        validityDate: data.validityDate ? (data.validityDate as any).toDate() : undefined,
                    } as any);
                }
            };
            fetchItem();
        }
    }, [searchParams, firestore, reset]);

    const onSubmit = useCallback(async (values: FormValues) => {
        if (!firestore || !user) return;
        showLoader();
        try {
            const currentName = isAdminSession ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || 'System Operator');
            
            const dataToSave: any = {
                ...values,
                updatedAt: serverTimestamp(),
                updatedBy: currentName,
            };

            if (values.ota) {
                dataToSave.validFrom = null;
                dataToSave.validTo = null;
            } else {
                dataToSave.validityDate = null;
            }

            // REGISTRY SANITIZATION NODE
            const sanitize = (obj: any): any => {
                if (Array.isArray(obj)) return obj.map(sanitize);
                if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && obj.constructor?.name !== 'FieldValue') {
                    return Object.fromEntries(
                        Object.entries(obj)
                            .filter(([_, v]) => v !== undefined)
                            .map(([k, v]) => [k, sanitize(v)])
                    );
                }
                return obj;
            };

            const cleanedPayload = sanitize(dataToSave);

            if (isEditMode && itemId) {
                await updateDoc(doc(firestore, "master_items", itemId), cleanedPayload);
                setStatusBar({ message: 'Master item updated successfully.', type: 'success' });
                router.push('/sikka-accounts/master-data/add-items');
            } else {
                await addDoc(collection(firestore, "master_items"), {
                    ...cleanedPayload,
                    createdAt: serverTimestamp(),
                    createdBy: currentName
                });
                setStatusBar({ message: 'Registry updated: New material master committed.', type: 'success' });
                reset();
            }
        } catch (error: any) {
            setStatusBar({ message: error.message, type: 'error' });
        } finally {
            hideLoader();
        }
    }, [firestore, user, isAdminSession, isEditMode, itemId, router, reset, setStatusBar, showLoader, hideLoader]);

    const onCancel = useCallback(() => {
        reset();
        setStatusBar({message: 'Data entry cancelled.', type: 'warning'});
    }, [reset, setStatusBar]);

    useEffect(() => {
        if (activeTab === 'material-master') {
            setSaveAction(() => form.handleSubmit(onSubmit)());
            setCancelAction(onCancel);
        }
        return () => {
            setSaveAction(null);
            setCancelAction(null);
        };
    }, [activeTab, form, onSubmit, onCancel, setSaveAction, setCancelAction]);

    const handleEditItem = (item: WithId<MasterDataItem>) => {
        setActiveTab('material-master');
        router.push(`/sikka-accounts/master-data/add-items?id=${item.id}`);
    };

    const handleDeleteItem = async (id: string) => {
        if (!firestore) return;
        showLoader();
        try {
            await deleteDoc(doc(firestore, "master_items", id));
            toast({ title: "Removed", description: "Material master purged from registry." });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Error", description: e.message });
        } finally {
            hideLoader();
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
                <TabsList className="bg-transparent border-b rounded-none h-12 gap-8 mb-8">
                    <TabsTrigger value="material-master" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 font-black uppercase text-xs">Create Material Master</TabsTrigger>
                    <TabsTrigger value="freight-master" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 font-black uppercase text-xs">Create Freight Master</TabsTrigger>
                    <TabsTrigger value="registry" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 font-black uppercase text-xs">Master Registry</TabsTrigger>
                </TabsList>

                <TabsContent value="material-master" className="m-0 focus-visible:ring-0">
                    <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50 border-b p-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-900 text-white rounded-lg"><Factory className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="text-xl font-black uppercase italic text-blue-900">MM01 – Create Material Master</CardTitle>
                                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Registry: Persistent Enterprise Node Configuration</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-10">
                            <Form {...form}>
                                <form className="space-y-10" onSubmit={form.handleSubmit(onSubmit)}>
                                    <div className='grid grid-cols-1 md:grid-cols-4 gap-10'>
                                        <FormField control={form.control} name="plantId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PLANT ID *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-black text-blue-900 border-slate-200 shadow-sm focus:ring-blue-900"><SelectValue placeholder="Pick Node" /></SelectTrigger></FormControl>
                                                    <SelectContent className="rounded-xl">
                                                        {authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-3">{p.id}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="invoiceTypeId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Invoice Type *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPlantInput}>
                                                    <FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-bold border-slate-200 shadow-sm focus:ring-blue-900"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                    <SelectContent className="rounded-xl">{invoiceTypes.map(t => <SelectItem key={t.id} value={t.id} className="font-bold py-3">{t.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="chargeTypeId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Charge Type *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPlantInput}>
                                                    <FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-bold border-slate-200 shadow-sm focus:ring-blue-900"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                    <SelectContent className="rounded-xl">{chargeTypes.map(t => <SelectItem key={t.id} value={t.id} className="font-bold py-3">{t.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="unitTypeId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">UOM *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPlantInput}>
                                                    <FormControl><SelectTrigger className="h-12 bg-white rounded-xl font-bold border-slate-200 shadow-sm focus:ring-blue-900"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                    <SelectContent className="rounded-xl">{unitTypes.map(t => <SelectItem key={t.id} value={t.id} className="font-bold py-3">{t.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="itemDescription" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Item Description *</FormLabel><FormControl><Input className="h-12 rounded-xl font-black text-slate-900 focus:ring-blue-900" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="hsnSac" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">HSN/SAC *</FormLabel><FormControl><Input className="h-12 rounded-xl font-mono font-bold focus:ring-blue-900" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="rate" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Standard Rate *</FormLabel><FormControl><Input type="number" className="h-12 rounded-xl font-black text-lg text-blue-900 shadow-inner focus:ring-blue-900" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        
                                        <div className="flex flex-wrap items-end gap-10 lg:col-span-4 bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner mt-4">
                                            <FormField control={form.control} name="isGstApplicable" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-slate-400">GST Active</FormLabel><FormControl><Switch className="mt-2" checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                            {isGstApplicable && <FormField control={form.control} name="gstRate" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">GST % *</FormLabel><FormControl><Input type="number" className="h-11 rounded-xl font-bold bg-white" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />}
                                            <FormField control={form.control} name="ota" render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400">One-Time (OTA)</FormLabel>
                                                    <Button type="button" variant="outline" size="icon" onClick={() => field.onChange(!field.value)} className="mt-2 rounded-xl h-11 w-11 bg-white border-slate-200">
                                                        {field.value ? <ToggleRight className="text-emerald-600 h-6 w-6"/> : <ToggleLeft className="text-slate-300 h-6 w-6"/>}
                                                    </Button>
                                                </FormItem>
                                            )} />
                                            
                                            {!ota ? (
                                                <>
                                                    <FormField control={form.control} name="validFrom" render={({ field }) => (<FormItem className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300"><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">From Date *</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 rounded-xl bg-white border-blue-200 shadow-sm" /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={form.control} name="validTo" render={({ field }) => (<FormItem className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300"><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">To Date *</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 rounded-xl bg-white border-blue-200 shadow-sm" /></FormControl><FormMessage /></FormItem>)} />
                                                </>
                                            ) : (
                                                <FormField control={form.control} name="validityDate" render={({ field }) => (<FormItem className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300"><FormLabel className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Validity Date *</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} className="h-11 rounded-xl bg-white border-emerald-200 shadow-sm" /></FormControl><FormMessage /></FormItem>)} />
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="freight-master" className="m-0 focus-visible:ring-0">
                    <CreateFreightMasterTab plants={authorizedPlants} />
                </TabsContent>

                <TabsContent value="registry" className="m-0 focus-visible:ring-0">
                    <ItemHistoryTable onEdit={handleEditItem} onDelete={handleDeleteItem} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function AddItemsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <CreateChangeItemPage />
    </Suspense>
  );
}
