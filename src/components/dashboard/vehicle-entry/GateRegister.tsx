'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/date-picker';
import type { Plant, VehicleEntryExit, WithId, SubUser, LR } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileDown, Search, Trash2, Edit2, Save, X, History, ShieldCheck, WifiOff, Clock, Factory, AlertTriangle, Plus } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, isValid } from 'date-fns';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, onSnapshot, doc, serverTimestamp, updateDoc, deleteDoc, getDoc, Timestamp, getDocs, where, limit, addDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { cn, normalizePlantId, sanitizeRegistryNode } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';
import { useLoading } from '@/context/LoadingContext';
import { QtyTypes } from '@/lib/constants';
import { mockPlants } from '@/lib/mock-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const ITEMS_PER_PAGE = 15;

const editFormSchema = z.object({
    driverName: z.string().optional().default(''),
    driverMobile: z.string().optional().default(''),
    documentNo: z.string().optional().default(''),
    lrNumber: z.string().optional().default(''),
    billedQty: z.coerce.number().optional().default(0),
    qtyType: z.string().optional().default('MT'),
    outType: z.string().optional().default(''),
    items: z.string().optional().default(''),
    plantId: z.string().min(1, 'Plant node is required.'),
    from: z.string().optional().default(''),
    lrDate: z.date().nullable().optional(),
    totalUnits: z.coerce.number().optional().default(0),
});

// Helper to safely format dates
const safeFormat = (date: any, formatString: string) => {
    if (!date) return '--';
    const d = date instanceof Date ? date : date?.toDate ? date.toDate() : new Date(date);
    return isValid(d) ? format(d, formatString) : 'Invalid Date';
};


function EditRegistryModal({ 
    isOpen, 
    onClose, 
    entry, 
    onSave,
    plants
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    entry: WithId<VehicleEntryExit>; 
    onSave: (id: string, data: any) => Promise<void>;
    plants: WithId<Plant>[];
}) {
    const form = useForm<z.infer<typeof editFormSchema>>({
        resolver: zodResolver(editFormSchema),
        defaultValues: {
            driverName: entry.driverName || '',
            driverMobile: entry.driverMobile || '',
            documentNo: entry.documentNo || '',
            lrNumber: entry.lrNumber || '',
            billedQty: entry.billedQty || 0,
            qtyType: entry.qtyType || 'MT',
            outType: entry.outType || '',
            items: entry.items || '',
            plantId: entry.plantId,
            from: entry.from || '',
            lrDate: entry.lrDate ? (entry.lrDate instanceof Date ? entry.lrDate : (entry.lrDate as any).toDate()) : null,
            totalUnits: entry.totalUnits || 0,
        }
    });

    const { handleSubmit, control, formState: { isSubmitting } } = form;
    const isOutward = entry.purpose === 'Loading';
    const outTypeOptions = isOutward ? ['Loaded', 'Empty'] : ['Unloaded', 'Not Unload'];

    const handleSave = async (values: z.infer<typeof editFormSchema>) => {
        await onSave(entry.id, values);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl border-none shadow-2xl p-0 overflow-hidden bg-white rounded-3xl">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                        <Edit2 className="h-5 w-5 text-blue-400" /> Correct Registry Entry
                    </DialogTitle>
                    <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                        MISSION Node: {entry.vehicleNumber} | ID: {entry.id}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                    <Form {...form}>
                        <form onSubmit={handleSubmit(handleSave)} className="space-y-8">
                            <section className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 border-b pb-2">Core Registry Context</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <FormField control={control} name="plantId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Plant Node</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-10 font-bold border-slate-200 bg-white"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">
                                                    {plants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="driverName" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pilot Name</FormLabel><FormControl><Input {...field} className="h-10 font-bold" /></FormControl></FormItem>
                                    )} />
                                    <FormField control={control} name="driverMobile" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pilot Mobile</FormLabel><FormControl><Input {...field} className="h-10 font-mono" /></FormControl></FormItem>
                                    )} />
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] px-1 border-b pb-2">Mission Particulars ({entry.purpose})</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <FormField control={control} name="lrNumber" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">LR Number</FormLabel><FormControl><Input {...field} className="h-10 font-black text-blue-700" /></FormControl></FormItem>
                                    )} />

                                    {!isOutward ? (
                                        <FormField control={control} name="from" render={({ field }) => (
                                            <FormItem className="md:col-span-2"><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">From (Lifting Site) *</FormLabel><FormControl><Input {...field} className="h-10 font-bold border-blue-200" placeholder="Origin of cargo" /></FormControl></FormItem>
                                        )} />
                                    ) : (
                                        <>
                                            <FormField control={control} name="lrDate" render={({ field }) => (
                                                <FormItem className="flex flex-col"><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">LR Date</FormLabel><FormControl><DatePicker date={field.value || undefined} setDate={(d) => field.onChange(d || null)} className="h-10 w-full" /></FormControl></FormItem>
                                            )} />
                                            <FormField control={control} name="totalUnits" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Total Units</FormLabel><FormControl><Input type="number" {...field} className="h-10 font-black text-center" /></FormControl></FormItem>
                                            )} />
                                        </>
                                    )}

                                    <FormField control={control} name="documentNo" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Invoice / Doc Ref</FormLabel><FormControl><Input {...field} className="h-10 font-bold" /></FormControl></FormItem>
                                    )} />
                                    <FormField control={control} name="billedQty" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{isOutward ? 'Weight (MT)' : 'Quantity'}</FormLabel><FormControl><Input type="number" step="0.001" {...field} className="h-10 font-black text-blue-900" /></FormControl></FormItem>
                                    )} />
                                    <FormField control={control} name="qtyType" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Weight Unit</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-10 font-bold border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">{QtyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="outType" render={({ field }) => (
                                        <FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Exit Status</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-10 font-bold border-slate-200"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent className="rounded-xl">{outTypeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="items" render={({ field }) => (
                                        <FormItem className="col-span-full"><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Goods Manifest Description</FormLabel><FormControl><Input {...field} className="h-10 font-medium" /></FormControl></FormItem>
                                    )} />
                                </div>
                            </section>

                            <DialogFooter className="bg-slate-50 -mx-8 -mb-8 p-6 border-t flex-row justify-end gap-3">
                                <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400">Discard</Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 px-10 h-11 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-blue-100 border-none transition-all active:scale-95">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Correction
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function GateRegister({ plants: initialPlantsList }: { plants: WithId<Plant>[] }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoading();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [toDate, setTodayDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [filterType, setFilterType] = useState<'Inward' | 'Outward'>('Outward');
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [deleteModalItem, setDeleteModalItem] = useState<WithId<VehicleEntryExit> | null>(null);
  const [editingItem, setEditingItem] = useState<WithId<VehicleEntryExit> | null>(null);

  const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const masterPlants = useMemo(() => {
    return initialPlantsList.length > 0 ? initialPlantsList : mockPlants;
  }, [initialPlantsList]);

  const authorizedPlants = useMemo(() => {
    if (isAdmin) return masterPlants;
    return masterPlants.filter(p => authorizedPlantIds.some(aid => normalizePlantId(aid) === normalizePlantId(p.id)));
  }, [masterPlants, authorizedPlantIds, isAdmin]);

  const isReadOnlyPlant = !isAdmin && authorizedPlantIds.length === 1;

  useEffect(() => {
    if (isAuthLoading) return; // Wait for auth check to complete

    if (isAdmin) {
        if (selectedPlant !== 'all-plants') {
            setSelectedPlant('all-plants');
        }
    } else if (authorizedPlantIds.length > 0) {
        const isSelectedPlantValid = authorizedPlantIds.some(id => normalizePlantId(id) === normalizePlantId(selectedPlant));
        if (!selectedPlant || !isSelectedPlantValid) {
            setSelectedPlant(authorizedPlantIds[0]);
        }
    } else {
        // No plants authorized, maybe set to a specific state or empty
        setSelectedPlant('');
    }
  }, [isAuthLoading, authorizedPlantIds, isAdmin]); // Removed selectedPlant from dependencies


  const filteredData = useMemo(() => {
    return data.filter(e => {
        const entryTimestampDate = e.entryTimestamp?.toDate ? e.entryTimestamp.toDate() : null;
        if (!entryTimestampDate || !isValid(entryTimestampDate)) return false;

        if (fromDate && entryTimestampDate < startOfDay(fromDate)) return false;
        if (toDate && entryTimestampDate > endOfDay(toDate)) return false;

        if (selectedPlant && selectedPlant !== 'all-plants' && normalizePlantId(e.plantId) !== normalizePlantId(selectedPlant)) return false;

        const targetPurpose = filterType === 'Inward' ? 'Unloading' : 'Loading';
        if (e.purpose !== targetPurpose) return false;

        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return (
            e.vehicleNumber?.toLowerCase().includes(s) ||
            e.lrNumber?.toLowerCase().includes(s) ||
            e.documentNo?.toLowerCase().includes(s) ||
            e.driverName?.toLowerCase().includes(s) ||
            e.driverMobile?.includes(s) ||
            e.plantId?.toLowerCase().includes(s) ||
            e.items?.toLowerCase().includes(s)
        );
    });
  }, [data, filterType, fromDate, toDate, searchTerm, selectedPlant]);

  const handleExport = useCallback(() => {
    const dataToExport = filteredData.map(e => ({
        'Plant ID': e.plantId,
        'Vehicle Number': e.vehicleNumber,
        'Pilot Name': e.driverName || 'N/A',
        'Pilot Mobile': e.driverMobile || 'N/A',
        'Purpose': e.purpose,
        'Status': e.status,
        'Remarks': e.remarks || '--',
        'In Time': safeFormat(e.entryTimestamp, 'dd-MM-yyyy HH:mm'),
        'Out Time': safeFormat(e.exitTimestamp, 'dd-MM-yyyy HH:mm'),
        'Out Type': e.outType || '--',
        'LR Number': e.lrNumber || '--',
        'Invoice Number': e.documentNo || '--',
        'Qty': `${e.billedQty || 0} ${e.qtyType || 'MT'}`,
        'Total Units': e.totalUnits || '--',
        'Items': e.items || '--'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gate Register");
    XLSX.writeFile(workbook, `Gate_Register_${filterType}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  }, [filteredData, filterType]);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchAuth = async () => {
        setIsAuthLoading(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const userQ = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const userQSnap = await getDocs(userQ);
            if (!userQSnap.empty) {
                userDocSnap = userQSnap.docs[0];
            } else {
                const directRef = doc(firestore, "users", user.uid);
                const directSnap = await getDoc(directRef);
                if (directSnap.exists()) userDocSnap = directSnap;
            }

            let authPlantIds: string[] = [];
            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                authPlantIds = userData?.plantIds || [];
            } else if (isAdmin) {
                authPlantIds = masterPlants.map(p => p.id);
            }

            setAuthorizedPlantIds(authPlantIds);
        } catch (e) {
            // Handle error silently
        } finally {
            setIsAuthLoading(false);
        }
    };
    fetchAuth();
  }, [firestore, user, isAdmin, masterPlants]);

  useEffect(() => {
    if (!firestore || !user || isAuthLoading) return;

    setIsLoading(true);
    setDbError(false);
    
    const q = collection(firestore, "vehicleEntries");
    const unsubscribe = onSnapshot(q, async (snap) => {
        try {
            const results = await Promise.all(snap.docs.map(async (d) => {
                const docData = d.data();
                const entry = {
                    id: d.id,
                    ...docData,
                    // Keep as Timestamps for now
                    entryTimestamp: docData.entryTimestamp,
                    exitTimestamp: docData.exitTimestamp,
                } as any;

                const normalizedEntryPlantId = normalizePlantId(entry.plantId);
                const isAuthorized = isAdmin || authorizedPlantIds.some(aid => normalizePlantId(aid) === normalizedEntryPlantId);

                if (!isAuthorized) return null;

                if (entry.purpose === 'Loading' && entry.tripId && entry.plantId) {
                    try {
                        const lrSnap = await getDocs(query(collection(firestore, `plants/${entry.plantId}/lrs`), where("tripId", "==", entry.tripId), limit(1)));
                        if (!lrSnap.empty) {
                            const lr = lrSnap.docs[0].data() as LR;
                            entry.lrUnit = lr.items?.[0]?.unitType || 'Unit';
                            entry.lrWeight = lr.assignedTripWeight || entry.billedQty;
                            entry.lrDate = lr.date; // Keep as timestamp
                            entry.totalUnits = lr.items?.reduce((sum, item) => sum + (Number(item.units) || 0), 0) || 0;
                        }
                    } catch (lrError) {
                        // console.error("Error fetching LR data:", lrError);
                    }
                }

                return entry;
            }));

            const filtered = results
                .filter(r => r !== null)
                .sort((a, b) => {
                    const timeA = a.entryTimestamp?.toDate ? a.entryTimestamp.toDate().getTime() : 0;
                    const timeB = b.entryTimestamp?.toDate ? b.entryTimestamp.toDate().getTime() : 0;
                    return timeB - timeA;
                });
            setData(filtered);
        } catch (e) {
            setDbError(true);
        } finally {
            setIsLoading(false);
        }
    }, async (error) => {
        const contextualError = new FirestorePermissionError({
            path: q.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', contextualError);
        setDbError(true);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user, isAdmin, authorizedPlantIds, isAuthLoading]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginated = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getStatusBadge = (entry: any) => {
    if (entry.status === 'Cancelled') {
        return <Badge className="bg-red-600 text-white font-black uppercase text-[9px] px-3 border-none shadow-sm min-w-[80px] justify-center">Cancelled</Badge>;
    }
    
    if (entry.status === 'IN') {
        if (entry.purpose === 'Unloading') {
            return (
                <Badge className="bg-blue-600 text-white font-black uppercase text-[9px] px-3 border-none shadow-sm min-w-[80px] justify-center">
                    Process
                </Badge>
            );
        }
        const isAssigned = entry.remarks === 'Assigned' || !!entry.tripId;
        return (
            <Badge className={cn(
                "font-black uppercase text-[9px] px-3 border-none shadow-sm min-w-[80px] justify-center",
                isAssigned ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
            )}>
                {isAssigned ? 'Assigned' : 'Available'}
            </Badge>
        );
    }
    return <Badge className="bg-slate-600 text-white font-black uppercase text-[9px] px-3 border-none shadow-sm min-w-[80px] justify-center">Closed</Badge>;
  };

  const handlePermanentRemove = async (id: string) => {
    if (!firestore || !user) return;
    showLoader();
    const docRef = doc(firestore, 'vehicleEntries', id);
    const userSnap = await getDoc(doc(firestore, "users", user.uid));
    const currentName = userSnap.exists() ? (userSnap.data() as SubUser).fullName : (user.displayName || user.email?.split('@')[0] || 'Operator');
    const entry = data.find(e => e.id === id);

    if (!entry) {
        hideLoader();
        return;
    }

    // Move to Recycle Bin Registry before Purge
    const sanitizedData = sanitizeRegistryNode({ ...entry, id: id, type: 'VehicleEntry' });
    
    await addDoc(collection(firestore, "recycle_bin"), {
        pageName: "Gate Register",
        userName: currentName,
        deletedAt: serverTimestamp(),
        data: sanitizedData
    });

    deleteDoc(docRef)
        .then(async () => {
            await addDoc(collection(firestore, "activity_logs"), {
                userId: user.uid,
                userName: currentName,
                action: 'Delete',
                tcode: 'Vehicle Entry',
                pageName: 'Gate Register',
                timestamp: serverTimestamp(),
                description: `Permanently purged gate entry record for ${entry.vehicleNumber}. ID: ${id}`
            });
            toast({ title: 'Record Purged', description: 'Registry entry successfully archived in recycle bin and erased.' });
            setDeleteModalItem(null);
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete',
            } satisfies SecurityRuleContext));
        })
        .finally(() => hideLoader());
  };

  const handleUpdateEntry = async (id: string, updatedData: any) => {
    if (!firestore || !user) return;
    showLoader();
    const docRef = doc(firestore, 'vehicleEntries', id);
    const userSnap = await getDoc(doc(firestore, "users", user.uid));
    const currentName = userSnap.exists() ? (userSnap.data() as SubUser).fullName : (user.displayName || user.email?.split('@')[0] || 'System Operator');
    
    const finalUpdate = sanitizeRegistryNode({
        ...updatedData,
        lastUpdated: serverTimestamp(),
        updatedBy: currentName
    });

    updateDoc(docRef, finalUpdate)
        .then(async () => {
            await addDoc(collection(firestore, "activity_logs"), {
                userId: user.uid,
                userName: currentName,
                action: 'Edit',
                tcode: 'Vehicle Entry',
                pageName: 'Gate Register',
                timestamp: serverTimestamp(),
                description: `Modified gate registry particulars for vehicle ${updatedData.vehicleNumber}.`
            });
            toast({ title: 'Success', description: 'Registry corrected successfully.' });
            setEditingItem(null);
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: finalUpdate
            } satisfies SecurityRuleContext));
        })
        .finally(() => hideLoader());
  };

  const isOutwardMode = filterType === 'Outward';
  const authorizedPlantName = useMemo(() => {
    if (!isReadOnlyPlant) return '';
    const plantId = authorizedPlantIds[0];
    return masterPlants.find(p => p.id === plantId || normalizePlantId(p.id) === normalizePlantId(plantId))?.name || plantId;
  }, [isReadOnlyPlant, authorizedPlantIds, masterPlants]);

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
        <div className="bg-slate-900 px-8 py-4 flex flex-wrap items-end justify-between gap-6 border-b border-white/10 shrink-0">
            <div className="flex flex-wrap items-end gap-6">
                <div className="grid gap-1.5">
                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest flex items-center gap-2"><Factory className="h-2.5 w-2.5" /> PLANT NODE</label>
                    {isAuthLoading ? (
                        <div className="h-10 w-[180px] bg-white/5 border border-white/10 rounded-xl animate-pulse" />
                    ) : isReadOnlyPlant ? (
                        <div className="h-10 px-4 flex items-center bg-white/10 border border-white/20 rounded-xl text-blue-100 font-black text-xs shadow-sm uppercase tracking-tighter min-w-[180px]">
                            <ShieldCheck className="h-3.5 w-3.5 mr-2 text-emerald-400" /> {authorizedPlantName}
                        </div>
                    ) : (
                        <Select value={selectedPlant} onValueChange={(v) => {setSelectedPlant(v); setCurrentPage(1);}}>
                            <SelectTrigger className="h-10 w-[180px] bg-white/5 border-white/10 text-white font-black uppercase text-xs">
                                <SelectValue placeholder="Select Node" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {isAdmin && <SelectItem value="all-plants" className="font-black text-blue-600 uppercase text-[10px] tracking-widest">All Authorized Nodes</SelectItem>}
                                {authorizedPlants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <div className="grid gap-1.5">
                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Registry Logic</label>
                    <Select value={filterType} onValueChange={(v: any) => {setFilterType(v); setCurrentPage(1);}}>
                        <SelectTrigger className="h-10 w-[160px] bg-white/5 border-white/10 text-white font-black uppercase text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="Outward">Outward (Loading)</SelectItem>
                            <SelectItem value="Inward">Inward (Unloading)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-1.5">
                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Period From</label>
                    <DatePicker date={fromDate} setDate={setFromDate} className="h-10 bg-white/5 border-white/10 text-white rounded-xl shadow-inner" />
                </div>
                <div className="grid gap-1.5">
                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Period To</label>
                    <DatePicker date={toDate} setDate={setTodayDate} className="h-10 bg-white/5 border-white/10 text-white rounded-xl shadow-inner" />
                </div>
                <div className="grid gap-1.5">
                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Registry Search</label>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-white transition-colors" />
                        <Input placeholder="Vehicle, LR, Invoice, Pilot..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 h-10 bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-blue-500 shadow-inner" />
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {dbError && (
                    <div className="flex items-center gap-2 text-orange-400 bg-white/5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10">
                        <WifiOff className="h-3 w-3" />
                        <span>Cloud Issue</span>
                    </div>
                )}
                <Button variant="outline" size="sm" onClick={handleExport} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-white/10 bg-white/5 text-white hover:bg-white/10 shadow-lg">
                    <FileDown className="h-4 w-4" /> Export Excel
                </Button>
            </div>
        </div>

        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table className="table-fixed w-full border-collapse min-w-[1400px]">
                    <colgroup>
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '140px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '120px' }} />
                        {isOutwardMode && (
                            <>
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '90px' }} />
                            </>
                        )}
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '80px' }} />
                    </colgroup>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="border-b border-slate-200 h-14 hover:bg-transparent">
                            <TableHead className="text-[10px] font-black uppercase px-4 text-center">Plant ID</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-center">Vehicle No</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4">Pilot Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-center">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4">
                                {isOutwardMode ? 'LR Number' : 'From'}
                            </TableHead>
                            {isOutwardMode && (
                                <>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center">LR Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase px-4 text-center">Total Unit</TableHead>
                                </>
                            )}
                            <TableHead className="text-[10px] font-black uppercase px-4 text-center">In Time</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-center">Out Time</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-center">Out Type</TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-right">
                                {isOutwardMode ? 'Weight' : 'Qty'}
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase px-4 text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <TableRow key={i} className="h-16">
                                    <TableCell colSpan={isOutwardMode ? 12 : 10} className="p-0 px-4"><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : paginated.length === 0 ? (
                            <TableRow><TableCell colSpan={isOutwardMode ? 12 : 10} className="h-64 text-center text-slate-400 italic font-medium">Registry is empty for selected filters.</TableCell></TableRow>
                        ) : (
                            paginated.map(e => (
                                <TableRow key={e.id} className="hover:bg-blue-50/50 h-16 border-b border-slate-100 transition-colors border-b last:border-0 group text-[11px] font-medium text-slate-600">
                                    <TableCell className="px-4 text-center font-black text-blue-900 uppercase">
                                        {e.plantId}
                                    </TableCell>
                                    <TableCell className="px-4 text-center font-black text-blue-900 tracking-tighter uppercase text-[13px]">{e.vehicleNumber}</TableCell>
                                    <TableCell className="px-4 whitespace-nowrap truncate max-w-[120px] font-bold text-slate-700">{e.driverName || '--'}</TableCell>
                                    <TableCell className="px-4 text-center">
                                        {getStatusBadge(e)}
                                    </TableCell>
                                    <TableCell className="px-4 font-bold text-slate-800 truncate" title={isOutwardMode ? (e.lrNumber || '--') : (e.from || '--')}>
                                        {isOutwardMode ? (e.lrNumber || '--') : (e.from || '--')}
                                    </TableCell>
                                    {isOutwardMode && (
                                        <>
                                            <TableCell className="px-4 text-center whitespace-nowrap text-slate-500 font-mono">
                                                {safeFormat(e.lrDate, 'dd/MM/yy')}
                                            </TableCell>
                                            <TableCell className="px-4 text-center font-black text-slate-900">
                                                {e.totalUnits || '--'}
                                            </TableCell>
                                        </>
                                    )}
                                    <TableCell className="px-4 text-center whitespace-nowrap text-slate-500 font-mono">{safeFormat(e.entryTimestamp, 'dd/MM/yy HH:mm')}</TableCell>
                                    <TableCell className="px-4 text-center whitespace-nowrap text-blue-700 font-black font-mono text-[11px]">
                                        {safeFormat(e.exitTimestamp, 'dd/MM/yy HH:mm')}
                                    </TableCell>
                                    <TableCell className="px-4 text-center">
                                        <Badge variant="secondary" className="text-[9px] uppercase font-black px-2 py-0.5 bg-slate-100 text-slate-600 min-w-[80px] justify-center">
                                            {e.outType || '--'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 text-right font-black text-blue-900">
                                        {isOutwardMode 
                                            ? (e.lrWeight ? `${e.lrWeight} MT` : '--') 
                                            : (e.billedQty ? `${e.billedQty} ${e.qtyType || 'MT'}` : '--')
                                        }
                                    </TableCell>
                                    <TableCell className="px-4 text-center">
                                        <div className="flex justify-center gap-1.5 transition-opacity">
                                            {isAdmin && (
                                                <>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => setEditingItem(e)}><Edit2 className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setDeleteModalItem(e)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
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

      <div className="bg-white border border-slate-200 rounded-2xl px-8 py-3 shadow-md flex items-center justify-between">
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filteredData.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
      </div>

      <Dialog open={!!deleteModalItem} onOpenChange={() => setDeleteModalItem(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl bg-white">
            <DialogHeader className="p-8 bg-red-50 border-b border-red-100 flex flex-row items-center gap-5 space-y-0">
                <div className="bg-red-600 p-3 rounded-2xl shadow-xl"><ShieldCheck className="h-8 w-8 text-white" /></div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-red-900">Security Purge Registry?</DialogTitle>
                    <DialogDescription className="text-red-700 font-bold text-[10px] uppercase tracking-widest mt-1">Authorized Deletion Handshake</DialogDescription>
                </div>
            </DialogHeader>
            {deleteModalItem && (
                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-200 text-sm">
                        <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400">Vehicle No</p><p className="font-black text-slate-900">{deleteModalItem.vehicleNumber}</p></div>
                        <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400">Registry Ref</p><p className="font-bold text-blue-700">{deleteModalItem.lrNumber || deleteModalItem.documentNo || '--'}</p></div>
                        <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400">In Date</p><p className="font-bold text-slate-700">{safeFormat(deleteModalItem.entryTimestamp, 'dd MMM yy')}</p></div>
                        <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400">Plant Node</p><p className="font-black text-slate-900 uppercase">{deleteModalItem.plantId}</p></div>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3 shadow-inner">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                            Warning: This action will permanently erase the record from the cloud. This process is irreversible and logged in the system audit trail.
                        </p>
                    </div>
                </div>
            )}
            <DialogFooter className="bg-slate-50 p-6 flex-row justify-end gap-3 border-t">
                <Button variant="ghost" onClick={() => setDeleteModalItem(null)} className="font-bold border-slate-200 rounded-xl px-8 h-10 m-0">Abort</Button>
                <Button onClick={() => handlePermanentRemove(deleteModalItem!.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[11px] tracking-widest px-10 h-10 rounded-xl shadow-lg shadow-red-100 border-none transition-all active:scale-95">Confirm Purge</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingItem && (
          <EditRegistryModal 
            isOpen={!!editingItem} 
            onClose={() => setEditingItem(null)} 
            entry={editingItem} 
            onSave={handleUpdateEntry} 
            plants={masterPlants}
          />
      )}
    </div>
  );
}
