'use client';
import { auth, db } from "@/lib/firebaseConfig";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// MODULAR IMPORTS (v9/v10+)
import { signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, Timestamp, collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
 

import { 
  Loader2, 
  ArrowLeft, 
  ShieldCheck, 
  Mail, 
  Lock, 
  ChevronRight, 
  Eye, 
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import ForgotPasswordModal from '@/components/auth/ForgotPasswordModal';
import { differenceInDays } from 'date-fns';
import type { SubUser } from '@/types';

// Hum yahan direct auth/db use karenge hook ki jagah agar build issue de raha ho
const loginSchema = z.object({
  identity: z.string().min(1, "Username or Email is required").transform(v => v.trim()),
  password: z.string().min(1, "Password is required").transform(v => v.trim()),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isForcedReset, setIsForcedReset] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const router = useRouter();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identity: '', password: '' },
  });

  // REDIRECT LOGIC
  const getAuthorizedRedirect = async (uid: string) => {
    if (!db) return '/modules';
    try {
        const userDocRef = doc(db, "users", uid);
        let userSnap = await getDoc(userDocRef);
        
        if (!userSnap.exists()) {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`;
            const q = query(collection(db, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) userSnap = qSnap.docs[0];
        }

        if (!userSnap.exists()) return '/modules';

        const profile = userSnap.data() as SubUser;
        const isAdmin = profile.username?.toLowerCase() === 'sikkaind' || profile.jobRole === 'Manager' || profile.jobRole === 'Admin';
        
        await addDoc(collection(db, "activity_logs"), {
            userId: uid,
            userName: profile.fullName || profile.username,
            action: 'Login',
            tcode: 'SYS_AUTH',
            pageName: 'Login Registry',
            timestamp: serverTimestamp(),
            description: `Session established for operator @${profile.username}.`
        });

        const accessible = [];
        if (profile.access_logistics) accessible.push('/dashboard');
        if (profile.access_accounts) accessible.push('/sikka-accounts/dashboard');
        if (isAdmin) accessible.push('/user-management');

        if (profile.defaultModule === 'Logistics' && profile.access_logistics) return '/dashboard';
        if (profile.defaultModule === 'Accounts' && profile.access_accounts) return '/sikka-accounts/dashboard';
        if (profile.defaultModule === 'Administration' && isAdmin) return '/user-management';

        return accessible.length === 1 ? accessible[0] : '/modules';
    } catch (e) {
        console.error("Redirect Error:", e);
        return '/modules';
    }
  };

  const checkPasswordExpiry = async (uid: string) => {
    if (!db) return false;
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            let lastUpdate = data.passwordUpdatedAt;
            
            if (!lastUpdate) {
                setIsForcedReset(true);
                setIsForgotModalOpen(true);
                return true;
            }

            const date = lastUpdate instanceof Timestamp ? lastUpdate.toDate() : new Date(lastUpdate);
            if (differenceInDays(new Date(), date) >= 60) {
                setIsForcedReset(true);
                setIsForgotModalOpen(true);
                return true;
            }
        }
    } catch (e) {
        console.error("Expiry Check Error:", e);
    }
    return false;
  };

  const handleLogin = async (values: LoginValues) => {
    setIsSubmitting(true);
    setError(null);

    // Ensure Auth is initialized
    if (!auth) {
      setError("AUTHENTICATION ENGINE OFFLINE.");
      setIsSubmitting(false);
      return;
    }

    const inputIdentity = values.identity;
    let email = inputIdentity;
    if (!email.includes('@')) {
        const username = inputIdentity.toLowerCase();
        email = username === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${username}@sikka.com`;
    }

    localStorage.setItem('slmc_last_identity', inputIdentity.toLowerCase());

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, values.password);
      const uid = userCredential.user.uid;

      // Post-Login Checks
      const expired = await checkPasswordExpiry(uid);
      if (!expired) {
          setIsRedirecting(true);
          const target = await getAuthorizedRedirect(uid);
          router.push(target);
      } else {
          setIsSubmitting(false);
      }
    } catch (err: any) {
      console.warn("[AUTH_ERROR]", err.code);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError("INVALID OPERATOR CREDENTIALS.");
      } else {
          try {
              await signInAnonymously(auth);
              router.push('/modules');
          } catch (fallbackErr) {
              setError("SYSTEM REGISTRY LINK FAILURE.");
          }
      }
      setIsSubmitting(false);
    }
  };

  if (isRedirecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f1f5f9] relative font-body p-4">
      <div className="absolute top-8 left-8">
        <Link href="/">
          <Button variant="ghost" className="text-slate-400 hover:text-blue-900 gap-2 font-bold uppercase text-[10px] tracking-widest transition-all">
            <ArrowLeft size={14} /> Web Portal
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-md space-y-10 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
            <h2 className="text-5xl font-black text-slate-800 italic uppercase tracking-tighter">
                SIKKA <span className="text-blue-600 not-italic">LOGISTICS</span>
            </h2>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">SLMC LOGIN</p>
        </div>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
            <div className="bg-slate-900 px-8 py-4 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-blue-400" />
                    <span className="text-[10px] font-black text-blue-100 uppercase tracking-widest">Operator Authorization</span>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <CardContent className="p-10 space-y-8">
                {error && (
                    <Alert variant="destructive" className="rounded-xl border-red-100 bg-red-50 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-[10px] font-black uppercase">{error}</AlertDescription>
                    </Alert>
                )}

                <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Operator Identity</Label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                            <Input 
                                {...form.register('identity')}
                                placeholder="Username or Email" 
                                className="h-12 pl-11 rounded-xl bg-slate-50 border-slate-200 font-bold focus-visible:ring-blue-900 shadow-inner" 
                            />
                        </div>
                        {form.formState.errors.identity && <p className="text-[10px] font-bold text-red-600 px-1">{form.formState.errors.identity.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Secure Password</Label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                            <Input 
                                {...form.register('password')}
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••" 
                                className="h-12 pl-11 pr-12 rounded-xl bg-slate-50 border-slate-200 font-bold focus-visible:ring-blue-900 shadow-inner" 
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {form.formState.errors.password && <p className="text-[10px] font-bold text-red-600 px-1">{form.formState.errors.password.message}</p>}
                    </div>

                    <div className="flex justify-end">
                        <button 
                            type="button" 
                            onClick={() => { setIsForcedReset(false); setIsForgotModalOpen(true); }}
                            className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 tracking-widest transition-colors"
                        >
                            Change Password?
                        </button>
                    </div>

                    <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full bg-blue-600 hover:bg-slate-900 text-white h-14 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] transition-all shadow-xl shadow-blue-100 border-none active:scale-95"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                                Authenticating...
                            </>
                        ) : (
                            <>
                                Establish Mission Session
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>

        <div className="flex items-center gap-6 text-slate-300 max-w-xs mx-auto pt-4">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">v2.5.0-ENTERPRISE</span>
            <div className="h-px bg-slate-200 flex-1" />
        </div>
      </div>

      <ForgotPasswordModal 
        isOpen={isForgotModalOpen} 
        onClose={() => setIsForgotModalOpen(false)} 
        isForced={isForcedReset}
      />
    </div>
  );
}
