'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/firebase";
import { format } from "date-fns";

export default function SikkaAccountsHomePage() {
  const { user } = useUser();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';
  const displayName = isAdmin ? 'AJAY SOMRA' : (user?.displayName || user?.email?.split('@')[0]);

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
      {/* 1. BRANDING HERO */}
      <div className="relative aspect-[25/9] w-full max-w-5xl rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white group">
          <Image
              src="https://globalcompliancepaneltraining.wordpress.com/wp-content/uploads/2018/01/supply-chain-management.gif"
              alt="Supply Chain Management"
              fill
              priority
              className="object-cover transition-transform duration-1000 group-hover:scale-105"
              unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-blue-950/95 via-blue-900/30 to-transparent" />
          <div className="absolute bottom-12 left-12 text-white">
              <div className="flex items-center gap-4 mb-4">
                <Badge className="bg-amber-400 text-blue-900 font-black uppercase text-[11px] px-4 py-1 tracking-[0.2em] border-none shadow-xl">ERP Standard</Badge>
                <Badge variant="outline" className="text-white border-white/40 font-black text-[11px] px-4 py-1 tracking-widest backdrop-blur-md">v2.5.0-PRO</Badge>
              </div>
              <h2 className="text-6xl font-black tracking-tighter uppercase italic drop-shadow-2xl leading-none">Sikka Financial Control</h2>
              <p className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-200 mt-4 opacity-80">Enterprise Resource Planning (ERP) Module</p>
          </div>
      </div>

      <div className="flex flex-col items-center gap-4 opacity-40">
          <div className="flex items-center gap-3 text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">
              <span>Ready for Transactions</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{displayName}</span>
          </div>
          <p className="text-[10px] font-mono text-slate-400">{format(currentTime, 'dd-MMM-yyyy | HH:mm:ss')}</p>
      </div>
    </div>
  );
}
