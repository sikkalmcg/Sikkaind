'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileDown, WifiOff, Search, Factory, ShieldCheck, History, Edit2, Trash2, Truck } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { WithId, MarketVehicle, Plant, SubUser } from '@/types';
import { mockPlants } from '@/lib/mock-data';
import Pagination from './Pagination';
import EditMarketVehicleModal from './EditMarketVehicleModal';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, Timestamp, getDocs, limit } from "firebase/firestore";
import { normalizePlantId } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const formSchema = z.object({
  plantId: z.string().min(1, 'Plant is required.'),
  vehicleNumber: z.string().min(1, 'Vehicle Number is required.').transform(v => v.toUpperCase().replace(/\s/g, '')),
  driverName: z.string().optional().default(''),
  driverMobile: z.string().optional().default('').refine(val => !val || /^\d{10}$/.test(val), 'Mobile number must be 10 digits.'),
  licenseNumber: z.string().optional().default(''),
  transporterName: z.string().min(1, 'Transporter Name is required.'),
  address: z.string().optional(),
  transporterMobile: z.string().regex(/^\d{10}$/, 'Transporter mobile must be 10 digits.'),
  pan: z.string().regex(panRegex, 'Invalid PAN format.').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

const ITEMS_PER_PAGE = 10;

export default function MarketVehicleTab() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingVehicle, setEditingVehicle] = useState<WithId<MarketVehicle> | null>(null);
  const [authorizedPlants, setAuthorizedPlants] = useState<WithId<Plant>[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Registry Sanitization Logic Node
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

  // 1. Fetch Master Registry of Logistics Plants
  const allPlantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants"), orderBy("createdAt", "desc")) : null, 
    [firestore]
  );
  const { data: allPlants, isLoading: isLoadingPlants } = useCollection<Plant>(allPlantsQuery);

  // 2. Resolve Authorized Plant Nodes for the current user
  useEffect(() => {
    if (!firestore || !user || isLoadingPlants || !allPlants) return;

    const fetchAuthPlants = async () => {
        setIsAuthLoading(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                userDocSnap = qSnap.docs[0];
            } else {
                const uidSnap = await getDoc(doc(firestore, "users", user.uid));
                if (uidSnap.exists()) userDocSnap = uidSnap;
            }

            let authIds: string[] = [];
            const isAdminSession = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (userDocSnap) {
                const userData = userDocSnap.data() as SubUser;
                const isRoot = userData.username?.toLowerCase() === 'sikkaind' || isAdminSession;
                authIds = isRoot ? allPlants.map(p => p.id) : (userData.plantIds || []);
            } else if (isAdminSession) {
                authIds = allPlants.map(p => p.id);
            }

            const filtered = allPlants.filter(p => authIds.includes(p.id));
            setAuthorizedPlants(filtered);
            if (filtered.length > 0 && !form.getValues('plantId')) {
                form.setValue('plantId', filtered[0].id);
            }
        } catch (e) {
            console.error("Vehicle Auth Sync Error:", e);
            setAuthorizedPlants(allPlants);
        } finally {
            setIsAuthLoading(false);
        }
    };
    fetchAuthPlants();
  }, [firestore, user, allPlants, isLoadingPlants]);

  // 3. Fetch Registered Transporter Vehicles
  const vehiclesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'vehicles'), where('vehicleType', '==', 'Market Vehicle')) : null,
    [firestore]
  );
  
  const { data: dbVehicles, isLoading: isLoadingVehicles, error: dbError } = useCollection<MarketVehicle>(vehiclesQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantId: '',
      vehicleNumber: '',
      driverName: '',
      driverMobile: '',
      licenseNumber: '',
      transporterName: '',
      address: '',
      transporterMobile: '',
      pan: '',
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: FormValues) => {
    if (!firestore) return;
    try {
      const cleanedPayload = sanitize({
        ...values,
        vehicleType: 'Market Vehicle',
        status: 'available',
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(firestore, 'vehicles'), cleanedPayload);
      toast({ title: 'Success', description: 'Transporter vehicle details stored in master registry.' });
      form.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const handleExport = () => {
    const dataToExport = filteredVehicles.map(v => ({
      'Plant': authorizedPlants.find(p => normalizePlantId(p.id) === normalizePlantId(v.plantId))?.name || v.plantId,
      'Vehicle Number': v.vehicleNumber,
      'Driver Name': v.driverName || 'N/A',
      'Mobile': v.driverMobile || 'N/A',
      'DL Number': v.licenseNumber || 'N/A',
      'Transporter Name': v.transporterName,
      'PAN': v.pan || 'N/A',
      'Transporter Mobile': v.transporterMobile
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transporters");
    XLSX.writeFile(workbook, "Transporters.xlsx");
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !user) return;
    try {
      const vehicleRef = doc(firestore, 'vehicles', id);
      const vehicleSnap = await getDoc(vehicleRef);
      if (vehicleSnap.exists()) {
          const data = vehicleSnap.data();
          const currentOperator = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' ? 'AJAY SOMRA' : (user.displayName || user.email?.split('@')[0] || "Admin");

          await addDoc(collection(firestore, "recycle_bin"), {
              pageName: "Vehicle Management (Market)",
              userName: currentOperator,
              deletedAt: serverTimestamp(),
              data: { ...data, id: id, type: 'Vehicle' }
          });
          await deleteDoc(vehicleRef);
          toast({ title: 'Moved to Bin', description: 'Transporter record moved to Recycle Bin.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const handleUpdate = async (id: string, data: FormValues) => {
    if (!firestore) return;
    try {
      const cleanedPayload = sanitize({
        ...data,
        lastUpdated: serverTimestamp()
      });
      await updateDoc(doc(firestore, 'vehicles', id), cleanedPayload);
      toast({ title: 'Success', description: 'Transporter details updated in registry.' });
      setEditingVehicle(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const filteredVehicles = useMemo(() =>
    (dbVehicles || []).filter(v =>
      v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.driverName && v.driverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      v.transporterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (authorizedPlants.find(p => normalizePlantId(p.id) === normalizePlantId(v.plantId))?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ), [dbVehicles, searchTerm, authorizedPlants]
  );

  const totalPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE);
  const paginatedVehicles = filteredVehicles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <div className="space-y-6">
        <Card className="border-none shadow-md">
          <CardHeader className="bg-slate-50/50 border-b">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary text-white rounded-lg shadow-lg rotate-3"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-xl font-bold uppercase">Provision Transporter Vehicle</CardTitle>
                        <CardDescription className="text-xs font-medium uppercase text-slate-400">Registry: Third-party spot market assignments</CardDescription>
                    </div>
                </div>
                {dbError && (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-bold uppercase border border-orange-200">
                        <WifiOff className="h-3 w-3" />
                        <span>Cloud Registry Sync Issue</span>
                    </div>
                )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <FormField control={form.control} name="plantId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Factory className="h-3 w-3" /> Plant Node Registry *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger className="h-11 bg-white font-bold border-slate-200 shadow-sm">
                                    <SelectValue placeholder={isLoadingPlants || isAuthLoading ? "Syncing..." : "Pick Node"} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                                {authorizedPlants.map(p => <SelectItem key={p.id} value={p.id} className="font-bold py-2.5">{p.name} ({p.id})</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleNumber" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vehicle Registry *</FormLabel><FormControl><Input {...field} placeholder="XX00XX0000" className="h-11 font-black text-blue-900 uppercase shadow-inner" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="driverName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pilot Name</FormLabel><FormControl><Input {...field} className="h-11 font-bold" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="driverMobile" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pilot Contact</FormLabel><FormControl><Input {...field} placeholder="10 Digits" className="h-11 font-mono" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="licenseNumber" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">DL Registry</FormLabel><FormControl><Input {...field} className="h-11 font-mono uppercase" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="transporterName" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Transporter Name *</FormLabel><FormControl><Input {...field} className="h-11 font-black text-slate-800" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="transporterMobile" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Transporter Contact *</FormLabel><FormControl><Input {...field} className="h-11 font-mono" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="pan" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PAN Registry</FormLabel><FormControl><Input {...field} placeholder="Optional" className="h-11 font-mono uppercase" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="address" render={({ field }) => (<FormItem className="md:col-span-4"><FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Transporter Office Address</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="flex gap-3 justify-end pt-6 border-t">
                  <Button type="button" variant="ghost" onClick={() => form.reset()} className="h-11 px-8 font-black uppercase text-[11px] tracking-widest text-slate-400">Discard Form</Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-900 hover:bg-slate-900 px-12 h-11 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-100 border-none transition-all active:scale-95 border-none">
                    {isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : null}
                    Add Transporter
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
                <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900 italic">TRANSPORTER REGISTRY</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Master record of external fleet partnerships</CardDescription>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input placeholder="Search transporter registry..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 w-[320px] h-11 rounded-2xl bg-white border-slate-200 shadow-sm font-bold" />
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-11 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50">
                    <FileDown className="h-4 w-4" /> Export Registry
                </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="h-14 hover:bg-transparent border-b">
                        <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Plant Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Vehicle Number</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Pilot Detail</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Transporter Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">PAN Registry</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Fleet Contact</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingVehicles ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={7} className="p-8"><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : paginatedVehicles.length > 0 ? (
                    paginatedVehicles.map(v => (
                      <TableRow key={v.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b last:border-0 group">
                        <TableCell className="px-8 font-black text-slate-600 uppercase text-xs">
                            {authorizedPlants.find(p => normalizePlantId(p.id) === normalizePlantId(v.plantId))?.name || v.plantId}
                        </TableCell>
                        <TableCell className="px-4 font-black text-blue-900 uppercase tracking-tight text-[13px]">{v.vehicleNumber}</TableCell>
                        <TableCell className="px-4">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-700 text-xs">{v.driverName || '--'}</span>
                                <span className="text-[10px] font-mono text-slate-400">{v.driverMobile || '--'}</span>
                            </div>
                        </TableCell>
                        <TableCell className="px-4 font-black text-slate-800 uppercase text-xs truncate max-w-[180px]">{v.transporterName}</TableCell>
                        <TableCell className="px-4 text-center font-mono text-xs font-bold text-slate-500 uppercase">{v.pan || 'N/A'}</TableCell>
                        <TableCell className="px-4 text-center font-mono text-[11px] font-black text-slate-600">{v.transporterMobile}</TableCell>
                        <TableCell className="px-8 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-blue-600 hover:bg-blue-50" onClick={() => setEditingVehicle(v)}><Edit2 className="h-4 w-4" /></Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent className="border-none shadow-2xl">
                                        <AlertDialogHeader>
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Truck className="h-5 w-5" /></div>
                                                <AlertDialogTitle className="font-black uppercase tracking-tight text-red-900">Revoke Transporter Identity?</AlertDialogTitle>
                                            </div>
                                            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                                                This will permanently erase the market vehicle record for **{v.vehicleNumber}** from the registry. This action is logged for audit compliance.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 border-t mt-4 flex-row justify-end gap-3">
                                            <AlertDialogCancel className="font-bold border-slate-200">Abort</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(v.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8 border-none shadow-lg">Confirm Purge</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={7} className="h-64 text-center text-slate-400 italic font-medium text-sm">No transporter assets detected in registry.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="p-6 bg-slate-50 border-t flex items-center justify-between">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemCount={filteredVehicles.length} canPreviousPage={currentPage > 1} canNextPage={currentPage < totalPages} />
            </div>
          </CardContent>
        </Card>
      </div>
      {editingVehicle && (
        <EditMarketVehicleModal
          isOpen={!!editingVehicle}
          onClose={() => setEditingVehicle(null)}
          vehicle={editingVehicle}
          onSave={handleUpdate}
        />
      )}
    </>
  );
}
