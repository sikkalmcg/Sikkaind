'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import placeholderData from '@/app/lib/placeholder-images.json';
import { useAuth, initializeFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Portal Login page.
 * Strictly aligned with provided SAP-style design reference.
 */
export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { firestore: db } = React.useMemo(() => initializeFirebase(), []);

  const [credentials, setCredentials] = React.useState({ username: '', password: '' });
  const [errorMsg, setErrorMsg] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const loginHero = placeholderData.placeholderImages.find(p => p.id === 'login-hero');
  const slmcLogo = placeholderData.placeholderImages.find(p => p.id === 'slmc-logo');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    const username = credentials.username.trim();
    const password = credentials.password.trim();

    try {
      // Admin Credential Verification
      const isMasterAdmin = username === 'Sikkaind' && password === 'Sikka@lmc2105';

      await signInAnonymously(auth);
      
      if (isMasterAdmin) {
        localStorage.setItem('sap_bootstrap_session', 'true');
        localStorage.setItem('sap_user_role', 'admin');
        localStorage.removeItem('sap_registry_id');
        router.push('/dashboard');
        return;
      }

      const q = query(
        collection(db, 'user_registry'),
        where('username', '==', username),
        where('password', '==', password)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setErrorMsg('INVALID CREDENTIALS');
        await auth.signOut();
      } else {
        const userDoc = snapshot.docs[0];
        localStorage.setItem('sap_registry_id', userDoc.id);
        localStorage.removeItem('sap_bootstrap_session');
        localStorage.setItem('sap_user_role', 'user');
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg('SYSTEM HANDSHAKE ERROR');
      await auth.signOut();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f3f9] flex items-center justify-center p-4 font-mono">
      {/* Main SAP-Style Container */}
      <div className="w-full max-w-[1000px] bg-white relative shadow-xl overflow-hidden border-[6px] border-[#eeb81c] rounded-sm">
        
        <div className="flex flex-col md:flex-row min-h-[360px]">
          {/* Left Side: Hero Image */}
          <div className="w-full md:w-[48%] relative bg-slate-100 min-h-[200px] md:min-h-0 border-r border-slate-200">
            {loginHero && (
              <Image
                src={loginHero.url}
                alt="Logistics Operations"
                fill
                className="object-cover"
                unoptimized
                priority
              />
            )}
          </div>

          {/* Right Side: Login Hub */}
          <div className="w-full md:w-[52%] p-8 flex flex-col items-center justify-center relative">
            
            {/* Back to Website Option */}
            <div className="absolute top-4 left-4">
              <Link 
                href="/" 
                className="text-[9px] font-black text-[#1e3a8a] uppercase tracking-tighter hover:underline flex items-center gap-1 transition-all active:scale-95"
              >
                <ArrowLeft className="h-2.5 w-2.5" /> Back to website
              </Link>
            </div>

            {/* Logo Section */}
            <div className="mb-6 flex flex-col items-center">
              {slmcLogo && (
                <div className="relative w-[300px] h-[100px]">
                  <Image 
                    src={slmcLogo.url}
                    alt="SLMC Logo"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              )}
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="w-24 text-[12px] font-black text-slate-700 text-right">
                    User <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    className="flex-1 h-8 border border-slate-300 px-2 text-[12px] font-bold outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="w-24 text-[12px] font-black text-slate-700 text-right">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="flex-1 h-8 border border-slate-300 px-2 text-[12px] font-bold outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="text-[10px] font-black text-red-600 text-center uppercase tracking-tighter">
                  {errorMsg}
                </p>
              )}

              <div className="flex justify-center pt-4">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-[#f0f0f0] hover:bg-slate-200 text-black border border-black px-10 h-8 font-black text-[12px] shadow-sm transition-all active:translate-y-px"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log On'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Interior Footer */}
        <div className="absolute bottom-4 right-6 pointer-events-none">
          <p className="text-[10px] font-black text-[#0056d2] uppercase tracking-tighter">
            copyright @ Sikka Industries & Logistics. All Rights Reserved.
          </p>
        </div>

        {/* Decorative Bottom Shadow/Shape matching reference */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-1.5 bg-[#d4a017] rounded-t-full opacity-80" />
      </div>
    </div>
  );
}
