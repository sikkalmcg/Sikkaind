
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from "@/firebase";
import { useLoading } from "@/context/LoadingContext";
import { Loader2, UserCheck, KeyRound, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

export default function LoginPage() {
    const auth = useAuth();
    const [identity, setIdentity] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const router = useRouter();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();

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

        if (!auth) {
            setError("Establishing link... Please retry.");
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
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const loginRes = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, email: user.email })
            });

            const loginData = await loginRes.json();

            if (!loginRes.ok) {
                throw new Error(loginData.error || "Registry authorization node rejected the session.");
            }

            setIsRedirecting(true);
            router.push(loginData.redirect || '/modules');
        } catch (err: any) {
            console.error("Login Error:", err);
            setError(err.message || "Invalid operator credentials. Access Denied.");
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
                                <div className="absolute inset-0 flex items-center justify-center text-slate-300 font-black italic text-xl uppercase tracking-tighter">Sikka Hub</div>
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
                                            className={cn("w-full p-1 border bg-white text-sm uppercase", hasTypo ? "border-red-500" : "border-gray-400")}
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
                                                    toast({ title: 'Bootstrap Successful', description: 'Admin account initialized. You can now login with SIKKAIND.' });
                                                } else {
                                                    toast({ variant: 'destructive', title: 'Bootstrap Failed', description: data.error || 'Identity node rejected.' });
                                                }
                                            } catch (e: any) {
                                                toast({ variant: 'destructive', title: 'Bootstrap Failed', description: 'Registry communication error.' });
                                            } finally {
                                                hideLoader();
                                            }
                                        }}
                                        className="text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors"
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
                        <p className="text-[9px] text-gray-400 font-bold uppercase">© SIKKA INDUSTRIES & LOGISTICS. REGISTRY v2.5</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
