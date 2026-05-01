'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import placeholderData from '@/app/lib/placeholder-images.json';
import { useAuth, initiateAnonymousSignIn } from '@/firebase';

/**
 * @fileOverview Portal Login page.
 * Replicates the legacy ERP-style login interface with full-screen edge-to-edge layout.
 */
export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const loginImg = placeholderData.placeholderImages.find(p => p.id === 'login-hero');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Initiate non-blocking sign-in to establish Firebase session for Firestore access
    initiateAnonymousSignIn(auth);
    router.push('/dashboard');
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
          <div className="max-w-md mx-auto w-full space-y-12 md:space-y-16">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#1e3a8a] uppercase italic tracking-tighter text-center md:text-left">
              Sikka Industries & Logistics
            </h1>

            <form onSubmit={handleLogin} className="space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <label className="w-full sm:w-32 text-[11px] md:text-xs font-black text-[#1e3a8a] uppercase tracking-widest">
                  User <span className="text-red-500">*</span>
                </label>
                <Input 
                  required
                  className="h-11 border-slate-300 rounded-none bg-slate-50 focus:ring-1 focus:ring-blue-900 transition-all text-sm font-bold"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <label className="w-full sm:w-32 text-[11px] md:text-xs font-black text-[#1e3a8a] uppercase tracking-widest">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative flex-1">
                  <Input 
                    required
                    type={showPassword ? "text" : "password"}
                    className="h-11 border-slate-300 rounded-none bg-slate-50 pr-10 focus:ring-1 focus:ring-blue-900 transition-all text-sm font-bold"
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
                <div className="hidden sm:block w-32" />
                <div className="flex items-center gap-8 w-full sm:w-auto">
                  <Button 
                    type="submit" 
                    className="flex-1 sm:flex-none bg-white hover:bg-slate-50 text-black border-2 border-slate-800 rounded-none px-12 h-11 font-black uppercase text-[11px] tracking-widest shadow-md transition-all active:scale-95"
                  >
                    Log On
                  </Button>
                  <button 
                    type="button" 
                    className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-900 transition-colors"
                  >
                    Initialize
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="px-6 py-4 md:px-12 md:py-6 bg-white border-t border-slate-100 flex items-center justify-center shrink-0">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
          © 2026 Sikka Industries & Logistics. All Rights Reserved.
        </p>
      </div>
      
      {/* Back Link */}
      <Link href="/" className="fixed bottom-4 right-4 md:bottom-8 md:right-8 text-[10px] font-black uppercase text-slate-400 hover:text-blue-900 bg-white/80 backdrop-blur-sm p-2 rounded px-4 shadow-sm border border-slate-100">
        Exit to Website
      </Link>
    </div>
  );
}
