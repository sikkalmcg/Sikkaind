'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Smartphone, 
    Plus, 
    Search, 
    Trash2, 
    ShieldCheck, 
    Loader2,
    RefreshCcw,
    Truck,
    Lock,
    AlertTriangle
} from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, deleteDoc, doc, orderBy, where, getDocs, limit, updateDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SubUser, Vehicle } from '@/types';
import { useLoading } from '@/context/LoadingContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  vehicleNumber: z.string().min(1, "Vehicle number is required.").transform(v => v.toUpperCase().replace(/\s/g, '')),
  deviceNumber: z.string().min(1, "Device ID/IMEI is required."),
  provider: z.string().default('Wheelseye'),
});

export default function GPSRegistryPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { showLoader, hideLoader } = useLoading();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            router.replace('/login');
            return;
        }

        const verifyAuth = async () => {
            if (!firestore) return;
            try {
                const lastIdentity = localStorage.getItem('slmc_last_identity');
                const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
                
                let userDocSnap = null;
                const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) {
                    userDocSnap = qSnap.docs[0];
                }

                const isRoot = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com' || userDocSnap?.data()?.username === 'sikkaind';
                
                if (!isRoot) {
                    toast({ variant: 'destructive', title: 'Access Denied', description: 'This registry node is restricted to Admin users only.' });
                    router.replace('/dashboard');
                } else {
                    setIsAdmin(true);
                }
            } catch (e) {
                router.replace('/dashboard');
            } finally {
                setIsVerifying(false);
            }
        };
        verifyAuth();
    }, [user, isUserLoading, firestore, router, toast]);

    // Registry Handshake: Fetch from main Vehicles collection
    const registryQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, "vehicles"), orderBy("vehicleNumber")) : null, 
        [firestore]
    );
    const { data: registry, isLoading } = useCollection<Vehicle>(registryQuery);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { vehicleNumber: '', deviceNumber: '', provider: 'Wheelseye' }
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!firestore) return;
        showLoader();
        try {
            const vNo = values.vehicleNumber.toUpperCase().replace(/\s/g, '');
            const q = query(collection(firestore, "vehicles"), where("vehicleNumber", "==", vNo), limit(1));
            const snap = await getDocs(q);

            if (!snap.empty) {
                // Update Existing Node
                const vDoc = snap.docs[0];
                await updateDoc(doc(firestore, "vehicles", vDoc.id), {
                    gpsImeiNo: values.deviceNumber,
                    gps_provider: values.provider,
                    gps_enabled: true,
                    lastGpsUpdate: serverTimestamp()
                });
                toast({ title: "Registry Updated", description: `GPS mapping synchronized for ${vNo}.` });
            } else {
                // Provision New Node
                await addDoc(collection(firestore, "vehicles"), {
                    vehicleNumber: vNo,
                    gpsImeiNo: values.deviceNumber,
                    gps_provider: values.provider,
                    gps_enabled: true,
                    vehicleType: 'Market Vehicle', // Default for direct entry
                    status: 'available',
                    createdAt: serverTimestamp()
                });
                toast({ title: "Node Provisioned", description: `New vehicle ${vNo} added to GPS registry.` });
            }
            form.reset();
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Error", description: e.message });
        } finally {
            hideLoader();
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        showLoader();
        try {
            // Logic: Remove GPS parameters but keep the vehicle in registry
            await updateDoc(doc(firestore, "vehicles", id), {
                gpsImeiNo: "",
                gps_enabled: false,
                gps_provider: ""
            });
            toast({ title: "Node Purged", description: "GPS mapping removed from vehicle." });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Error", description: e.message });
        } finally {
            hideLoader();
        }
    };

    const filtered = (registry || []).filter(r => 
        r.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.gpsImeiNo && r.gpsImeiNo.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (isVerifying || isUserLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Verifying Admin Node...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <main className="p-8 space-y-10 bg-[#f8fafc] animate-in fade-in duration-500 h-full overflow-y-auto">
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                    <Smartphone className="h-7 w-7" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-blue-900 tracking-tight uppercase italic">GPS Vehicle Registry</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">LMC Hardware-to-Asset Mapping Node</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <Card className="lg:col-span-4 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col h-fit">
                    <CardHeader className="bg-slate-50 border-b p-8">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Provision Device Node</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField name="vehicleNumber" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Vehicle Registry *</FormLabel>
                                        <FormControl><Input placeholder="XX00XX0000" {...field} className="h-11 rounded-xl font-black uppercase" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="deviceNumber" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">IMEI / Device Number *</FormLabel>
                                        <FormControl><Input placeholder="866XXXXXXXXXXXX" {...field} className="h-11 rounded-xl font-mono font-bold" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="provider" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400">Service Provider</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="Wheelseye" className="font-bold py-2.5">Wheelseye</SelectItem>
                                                <SelectItem value="Intugine" className="font-bold py-2.5">Intugine</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full bg-blue-900 hover:bg-black text-white rounded-xl h-12 font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">
                                    {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                    Sync Device Node
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-8 border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Authorized GPS Ledger</CardTitle>
                            <CardDescription className="text-[9px] font-bold text-slate-400 uppercase mt-1">Verified Hardware mapping</CardDescription>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                            <Input 
                                placeholder="Search registry..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 h-10 w-[240px] rounded-xl border-slate-200 font-bold"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow className="h-12 hover:bg-transparent text-[10px] font-black uppercase text-slate-400 border-b">
                                        <TableHead className="px-8">Vehicle Number</TableHead>
                                        <TableHead className="px-4">Device ID (IMEI)</TableHead>
                                        <TableHead className="px-4">Provider</TableHead>
                                        <TableHead className="px-4 text-center">GPS Status</TableHead>
                                        <TableHead className="px-8 text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({length: 5}).map((_, i) => (
                                            <TableRow key={i} className="h-14"><TableCell colSpan={5} className="px-8"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                        ))
                                    ) : filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No GPS nodes found in registry.</TableCell></TableRow>
                                    ) : (
                                        filtered.map((item) => {
                                            const hasGps = !!item.gpsImeiNo;
                                            return (
                                                <TableRow key={item.id} className="h-14 border-b border-slate-50 hover:bg-blue-50/20 transition-all group">
                                                    <TableCell className="px-8 font-black text-slate-900 uppercase text-xs tracking-tighter">
                                                        {item.vehicleNumber}
                                                    </TableCell>
                                                    <TableCell className="px-4 font-mono text-[11px] font-bold text-blue-700">
                                                        {item.gpsImeiNo || '--'}
                                                    </TableCell>
                                                    <TableCell className="px-4 text-[10px] font-black uppercase text-slate-400">
                                                        {item.gps_provider || '--'}
                                                    </TableCell>
                                                    <TableCell className="px-4 text-center">
                                                        <Badge className={cn(
                                                            "font-black uppercase text-[8px] px-3 h-5 border-none shadow-sm min-w-[90px] justify-center",
                                                            hasGps ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
                                                        )}>
                                                            {hasGps ? 'GPS ACTIVE' : 'PENDING MAPPING'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="px-8 text-right">
                                                        {hasGps && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(item.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
