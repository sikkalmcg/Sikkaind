
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import placeholderData from '@/app/lib/placeholder-images.json';

/**
 * @fileOverview Portal Login page.
 * Replicates the legacy ERP-style login interface provided in the design.
 */
export default function LoginPage() {
  const [showPassword, setShowPassword] = React.useState(false);
  const officeImg = placeholderData.placeholderImages.find(p => p.id === 'login-office');

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4 font-body">
      <div className="w-full max-w-5xl bg-white shadow-2xl relative overflow-hidden flex flex-col">
        {/* Top Yellow Border */}
        <div className="h-1.5 w-full bg-yellow-500" />

        <div className="flex flex-col md:flex-row min-h-[500px]">
          {/* Left Column: Image */}
          <div className="w-full md:w-1/2 p-10 flex items-center justify-center">
            <div className="relative w-full aspect-[3/4] shadow-inner border border-slate-100 overflow-hidden">
              {officeImg && (
                <Image
                  src={officeImg.url}
                  alt={officeImg.description}
                  fill
                  className="object-cover"
                  unoptimized
                  data-ai-hint="modern office"
                />
              )}
              {/* Overlay Logo for the visual effect */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-white/90 p-4 rounded shadow-lg flex flex-col items-center">
                 <div className="w-12 h-12 bg-blue-900 flex items-center justify-center mb-1">
                    <span className="text-white font-black text-2xl italic">S</span>
                 </div>
                 <div className="text-[10px] font-black text-blue-900 uppercase leading-tight text-center">
                    Sikka Industries<br/>& Logistics
                 </div>
              </div>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="w-full md:w-1/2 p-10 md:p-20 flex flex-col justify-center space-y-12">
            <h1 className="text-3xl md:text-4xl font-black text-yellow-500 uppercase italic tracking-tighter">
              Sikka Industries
            </h1>

            <div className="space-y-8">
              <div className="flex items-center gap-6">
                <label className="w-32 text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-1">
                  User <span className="text-red-500">*</span>
                </label>
                <Input 
                  className="h-10 border-slate-300 rounded-none focus:ring-0 focus:border-blue-900"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="w-32 text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative flex-1">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    className="h-10 border-slate-300 rounded-none pr-10 focus:ring-0 focus:border-blue-900"
                  />
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-900"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="w-32" />
                <div className="flex items-center gap-6">
                  <Button className="bg-white hover:bg-slate-50 text-black border border-slate-800 rounded-none px-10 h-10 font-black uppercase text-[10px] tracking-widest shadow-sm">
                    Log On
                  </Button>
                  <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-900 transition-colors">
                    Initialize
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            © Sikka Industries & Logistics. Registry V2.5
          </p>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-slate-100 bg-slate-50">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sync Node: Safe</span>
          </div>
        </div>

        {/* Bottom Yellow Border */}
        <div className="h-1.5 w-full bg-yellow-500" />
      </div>
      
      {/* Back to Home Link */}
      <Link href="/" className="fixed bottom-4 right-4 text-[10px] font-black uppercase text-slate-400 hover:text-blue-900">
        Exit to Website
      </Link>
    </div>
  );
}
