
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import placeholderData from '@/app/lib/placeholder-images.json';
import { useAuth, initializeFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * @fileOverview Portal Login page.
 * Implements strict credential-based access control against the user_registry collection.
 */
export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { firestore: db } = React.useMemo(() => initializeFirebase(), []);

  const [showPassword, setShowPassword] = React.useState(false);
  const [credentials, setCredentials] = React.useState({ username: '', password: '' });
  const [errorMsg, setErrorMsg] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const loginImg = placeholderData.placeholderImages.find(p => p.id === 'login-hero');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // Background handshake to establish Firebase session for Firestore queries
      await signInAnonymously(auth);
      
      // Strict Registry Check
      const q = query(
        collection(db, 'user_registry'),
        where('username', '==', credentials.username),
        where('password', '==', credentials.password)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Special Case: Initial Admin Bootstrap
        const allSnap = await getDocs(collection(db, 'user_registry'));
        const isBootstrapAdmin = credentials.username.trim() === 'Sikkaind' && credentials.password.trim() === 'Sikka@lmc2105';
        
        if (allSnap.empty && isBootstrapAdmin) {
           router.push('/dashboard');
           return;
        }

        setErrorMsg('Access Denied: Invalid Credentials or Unregistered Account');
        await auth.signOut();
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg('Mission Handshake Error: ' + err.message);
      await auth.signOut();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-body">
      {/* Top Yellow Border */}
      <div className="h-2 w-full bg-yellow-500 shrink-0" />

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left Column: Image - Edge to edge */}
        <div className="w-full md:w-[45%] flex items-center justify-center bg-white relative">
          <div className="relative w-full h-full min-h-[300px] md:min-h-0 group">
            {loginImg && (
              <Image
                src={loginImg.url}
                alt="Login Hero"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                unoptimized
                data-ai-hint="statue logistics"
              />
            )}
            {/* Overlay Logo Card */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-white/95 p-4 md:p-6 shadow-2xl flex flex-col items-center min-w-[140px] md:min-w-[180px]">
               <div className="w-10 h-10 md:w-14 md:h-14 bg-[#1e3a8a] flex items-center justify-center mb-2">
                  <span className="text-white font-black text-xl md:text-3xl italic">S</span>
               </div>
               <div className="text-[8px] md:text-[11px] font-black text-[#1e3a8a] uppercase leading-tight text-center tracking-tighter">
                  Sikka Industries<br/>& Logistics
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="w-full md:w-[55%] p-8 md:p-16 lg:p-24 flex flex-col justify-center bg-white">
          <div className="max-w-xl mx-auto w-full space-y-12 md:space-y-16">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-[#1e3a8a] uppercase italic tracking-tighter text-center md:text-left whitespace-nowrap">
              Sikka Industries & Logistics
            </h1>

            <form onSubmit={handleLogin} className="space-y-10">
              {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-none flex items-center gap-3 animate-fade-in">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <p className="text-[11px] font-black uppercase text-red-600 tracking-tight">{errorMsg}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <label className="w-full sm:w-40 text-[11px] md:text-xs font-black text-[#1e3a8a] uppercase tracking-widest shrink-0">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="flex-1">
                  <Input 
                    required
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    className="h-11 w-full border-slate-300 rounded-none bg-slate-50 focus:ring-1 focus:ring-blue-900 transition-all text-sm font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <label className="w-full sm:w-40 text-[11px] md:text-xs font-black text-[#1e3a8a] uppercase tracking-widest shrink-0">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative flex-1">
                  <Input 
                    required
                    type={showPassword ? "text" : "password"}
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="h-11 w-full border-slate-300 rounded-none bg-slate-50 pr-10 focus:ring-1 focus:ring-blue-900 transition-all text-sm font-bold"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-900"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 pt-6">
                <div className="hidden sm:block w-40" />
                <div className="flex items-center gap-8 w-full sm:w-auto">
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="flex-1 sm:flex-none bg-white hover:bg-slate-50 text-black border-2 border-slate-800 rounded-none px-12 h-11 font-black uppercase text-[11px] tracking-widest shadow-md transition-all active:scale-95"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log On'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="px-6 py-4 md:px-12 md:py-6 bg-white border-t border-slate-100 flex items-center justify-center shrink-0">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
          © {new Date().getFullYear()} Sikka Industries & Logistics. All Rights Reserved.
        </p>
      </div>
      
      {/* Back Link */}
      <Link href="/" className="fixed bottom-4 right-4 md:bottom-8 md:right-8 text-[10px] font-black uppercase text-slate-400 hover:text-blue-900 bg-white/80 backdrop-blur-sm p-2 rounded px-4 shadow-sm border border-slate-100">
        Exit to Website
      </Link>
    </div>
  );
}
