'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Settings2, 
    ShieldCheck, 
    Save, 
    Loader2,
    Globe,
    Lock,
    RefreshCcw,
    Zap,
    Upload,
    Truck,
    X
} from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, limit, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

const formSchema = z.object({
  provider: z.string().min(1, "Provider name is required."),
  apiUrl: z.string().url("Valid API URL required."),
  accessToken: z.string().min(1, "Access Token is mandatory."),
  refreshRate: z.coerce.number().min(10, "Minimum refresh rate is 10s."),
  dataMode: z.enum(['All Vehicles', 'Single Vehicle']),
  iconUrl: z.string().optional().or(z.literal('')),
});

export default function GPSSettingsPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [iconPreview, setIconPreview] = useState<string | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            provider: 'Wheelseye',
            apiUrl: 'https://api.wheelseye.com/currentLoc',
            accessToken: '53afc208-0981-48c7-b134-d85d2f33dc0c',
            refreshRate: 30,
            dataMode: 'All Vehicles',
            iconUrl: ''
        }
    });

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
                    toast({ variant: 'destructive', title: 'Access Denied', description: 'GPS Configuration is restricted to Admin users only.' });
                    router.replace('/dashboard');
                } else {
                    setIsAdmin(true);
                    
                    const snap = await getDoc(doc(firestore, "gps_settings", "wheelseye"));
                    if (snap.exists()) {
                        const data = snap.data();
                        form.reset(data as any);
                        if (data.iconUrl) setIconPreview(data.iconUrl);
                    }
                }
            } catch (e) {
                router.replace('/dashboard');
            } finally {
                setIsVerifying(false);
                setIsLoadingData(false);
            }
        };
        verifyAuth();
    }, [user, isUserLoading, firestore, router, toast, form]);

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            toast({ variant: 'destructive', title: "Size Violation", description: "Icon must be under 1MB." });
            return;
        }

        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            toast({ variant: 'destructive', title: "Format Error", description: "Supported formats: JPG, PNG, WEBP." });
            return;
        }

        const base64 = await convertFileToBase64(file);
        setIconPreview(base64);
        form.setValue('iconUrl', base64, { shouldDirty: true });
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!firestore) return;
        try {
            await setDoc(doc(firestore, "gps_settings", "wheelseye"), {
                ...values,
                updatedAt: serverTimestamp()
            });
            toast({ title: "Registry Synchronized", description: "Gateway and Asset Icon parameters updated." });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Sync Failed", description: e.message });
        }
    };

    if (isVerifying || isUserLoading || isLoadingData) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#f8fafc]">
                <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <main className="p-8 space-y-10 bg-[#f8fafc] animate-in fade-in duration-500 max-w-4xl mx-auto h-full overflow-y-auto">
            <div className="flex items-center gap-4 border-b pb-6">
                <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                    <Settings2 className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">GPS Integration Settings</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Authorized Gateway Configuration Node</p>
                </div>
            </div>

            <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-900 p-8 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Zap className="h-5 w-5 text-blue-400" />
                            <CardTitle className="text-white text-sm font-black uppercase tracking-widest">Gateway Configuration</CardTitle>
                        </div>
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 font-black uppercase text-[9px] px-4 py-1.5 rounded-full">
                            Security Partition Level 4
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-10">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <FormField name="provider" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Service Provider Node</FormLabel>
                                        <FormControl><Input {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-black text-blue-900" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="refreshRate" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Refresh Frequency (Seconds)</FormLabel>
                                        <FormControl><Input type="number" {...field} className="h-12 rounded-xl font-bold" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="apiUrl" control={form.control} render={({ field }) => (
                                    <FormItem className="col-span-full">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Registry Endpoint URL</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                                <Input {...field} className="h-12 pl-11 rounded-xl bg-slate-50 font-mono text-xs font-bold" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="accessToken" control={form.control} render={({ field }) => (
                                    <FormItem className="col-span-full">
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Authorization Token (Master)</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                                <Input type="password" {...field} className="h-12 pl-11 rounded-xl bg-slate-50 font-mono text-xs font-bold" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField name="dataMode" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Extraction Mode</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="All Vehicles" className="font-bold py-3 uppercase">All Vehicles API</SelectItem>
                                                <SelectItem value="Single Vehicle" className="font-bold py-3 uppercase">Single Vehicle API</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />

                                {/* TRUCK ICON UPLOAD NODE */}
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Map Truck Icon Registry</Label>
                                    <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                        <div className="relative h-16 w-16 bg-white rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden group">
                                            {iconPreview ? (
                                                <Image src={iconPreview} alt="Custom Truck Icon" fill className="object-contain p-1" unoptimized />
                                            ) : (
                                                <Truck className="h-8 w-8 text-slate-200" />
                                            )}
                                            <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                <Upload className="h-5 w-5 text-white" />
                                                <input type="file" className="hidden" accept="image/*" onChange={handleIconUpload} />
                                            </label>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <p className="text-[9px] font-black uppercase text-blue-600">Custom Marker Node</p>
                                            <p className="text-[10px] font-medium text-slate-400 leading-tight">This icon will reflect on all GIS map terminals globally.</p>
                                            {iconPreview && (
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    className="h-auto p-0 text-red-500 font-black text-[8px] uppercase tracking-widest gap-1 mt-1 hover:bg-transparent"
                                                    onClick={() => { setIconPreview(null); form.setValue('iconUrl', '', { shouldDirty: true }); }}
                                                >
                                                    <X className="h-2 w-2" /> Reset Default
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-10 border-t border-slate-100">
                                <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-900 hover:bg-black text-white px-12 h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-100 border-none transition-all active:scale-95 border-none">
                                    {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                                    Sync Registry Node
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </main>
    );
}
