
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth, useFirestore } from "@/firebase";
import { useLoading } from "@/context/LoadingContext";
import { doc, getDoc } from 'firebase/firestore';
import { Eye, EyeOff, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { SubUser } from '@/types';

/**
 * @fileOverview Hardened Sikka Industries Login Terminal.
 * Performs client-side profile verification to bypass Admin SDK metadata errors.
 */
export default function LoginPage() {
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();

    const [identity, setIdentity] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const getImg = (id: string) => placeholderData.placeholderImages.find(p => p.id === id);
    const hasTypo = useMemo(() => identity.toLowerCase().trim() === 'sikkiand', [identity]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!identity || !password) {
            setError('User and Password must be provided.');
            return;
        }

        setError(null);
        showLoader();

        if (!auth || !firestore) {
            setError("Initializing registry handshake... Please try again in 5 seconds.");
            hideLoader();
            return;
        }

        let email = identity;
        if (!email.includes('@')) {
            const username = identity.toLowerCase().trim();
            email = username === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${username}@sikka.com`;
        }

        localStorage.setItem('slmc_last_identity', identity.toLowerCase());

        try {
            // 1. Authenticate with Identity Platform
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Client-Side Registry Lookup (Bypassing potentially unstable Admin SDK)
            let userSnap = await getDoc(doc(firestore, "users", email));
            if (!userSnap.exists()) {
                userSnap = await getDoc(doc(firestore, "users", user.uid));
            }

            if (!userSnap.exists()) {
                // If profile is missing but Auth is OK, send to modules to establish profile
                router.push('/modules');
                return;
            }

            const profile = userSnap.data() as SubUser;

            // 3. Audit Pulse (Non-blocking background call)
            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, email: user.email, profile })
            }).catch(() => console.warn("Audit pulse offline."));

            // 4. Resolve Terminal Redirect
            const accessible = [];
            if (profile.access_logistics) accessible.push('/dashboard');
            
            const isAdmin = profile.jobRole === 'Manager' || profile.jobRole === 'Admin' || profile.username?.toLowerCase() === 'sikkaind' || user.email === 'sikkaind.admin@sikka.com';
            if (isAdmin) accessible.push('/user-management');

            if (profile.defaultModule === 'Logistics' && profile.access_logistics) {
                router.push('/dashboard');
            } else if (profile.defaultModule === 'Administration' && isAdmin) {
                router.push('/user-management');
            } else {
                const redirect = accessible.length === 1 ? accessible[0] : '/modules';
                router.push(redirect);
            }

        } catch (err: any) {
            console.error("Login Error:", err);
            let msg = "Invalid operator credentials. Access Denied.";
            if (err.code === 'auth/user-not-found') msg = "Identity node not found in registry.";
            if (err.code === 'auth/wrong-password') msg = "Password mismatch for this node.";
            setError(msg);
            hideLoader();
        }
    };

    const loginImageAsset = getImg('loginlogo');

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-200 p-4 font-sans">
            <div className="w-full max-w-4xl bg-white shadow-lg" style={{ borderTop: '4px solid #F0B800', borderBottom: '4px solid #F0B800' }}>
                <div className="border p-2">
                    <div className="flex border">
                        <div className="w-1/2 p-4 hidden md:block relative min-h-[400px]">
                            {loginImageAsset?.url ? (
                                <Image 
                                    src={loginImageAsset.url} 
                                    alt="Sikka Industries Login" 
                                    fill 
                                    className="object-contain p-8" 
                                    priority 
                                    unoptimized={true}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-300 font-black italic text-xl uppercase tracking-tighter opacity-20">Sikka Hub Registry</div>
                            )}
                        </div>
                        <div className="w-full md:w-1/2 p-8">
                            <h1 className="text-2xl font-bold text-[#F0B800] mb-8 uppercase italic">Sikka Industries</h1>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="flex items-center space-x-4">
                                    <label className="w-24 text-[11px] font-black uppercase text-gray-600">User <span className="text-red-500">*</span></label>
                                    <div className="flex-1 relative">
                                        <input 
                                            type="text" 
                                            value={identity}
                                            onChange={(e) => setIdentity(e.target.value)}
                                            className={cn("w-full p-1 border bg-white text-sm uppercase focus:outline-none", hasTypo ? "border-red-500" : "border-gray-400")}
                                        />
                                        {hasTypo && (
                                            <button 
                                                type="button"
                                                onClick={() => setIdentity('sikkaind')}
                                                className="absolute -bottom-5 left-0 text-[9px] font-black text-blue-600 uppercase flex items-center gap-1 animate-bounce"
                                            >
                                                <Sparkles size={10} /> Did you mean "sikkaind"?
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <label className="w-24 text-[11px] font-black uppercase text-gray-600">Password <span className="text-red-500">*</span></label>
                                    <div className="flex-1 flex items-center border border-gray-400 bg-white">
                                        <input 
                                            type={showPassword ? 'text' : 'password'} 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="flex-1 p-1 bg-transparent text-sm focus:outline-none"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="p-1 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="pt-4 md:pl-28 flex flex-wrap gap-2 items-center">
                                    <button 
                                        type="submit" 
                                        className="px-6 py-1 text-[11px] font-black uppercase bg-gray-100 border border-gray-500 rounded-sm hover:bg-gray-200 transition-colors"
                                    >
                                        Log On
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            showLoader();
                                            try {
                                                const res = await fetch('/api/auth/manage-user', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ action: 'bootstrap' })
                                                });
                                                const data = await res.json();
                                                if (res.ok && data.success) {
                                                    toast({ title: 'Bootstrap OK', description: 'Admin identity provisioned. Login with SIKKAIND.' });
                                                } else {
                                                    toast({ variant: 'destructive', title: 'Registry Error', description: data.error || 'Identity node rejected.' });
                                                }
                                            } catch (e: any) {
                                                toast({ variant: 'destructive', title: 'Registry Link Error', description: 'Connection to server node failed.' });
                                            } finally {
                                                hideLoader();
                                            }
                                        }}
                                        className="text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors ml-2"
                                    >
                                        Initialize
                                    </button>
                                </div>
                                {error && (
                                    <div className="md:pl-28 pt-2">
                                        <p className="text-[10px] text-red-600 font-black uppercase leading-tight">{error}</p>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-8 pb-2 px-4">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">© SIKKA INDUSTRIES & LOGISTICS. REGISTRY v2.5</p>
                        <Badge variant="outline" className="border-slate-100 text-slate-300 text-[8px] font-black uppercase">Sync Node: Safe</Badge>
                    </div>
                </div>
            </div>
        </div>
    );
}
