'use client';

import { useLoading } from '@/context/LoadingContext';
import { Loader2 } from 'lucide-react';

export default function GlobalLoader() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white shadow-2xl border border-slate-100">
        <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">
          Establishing Registry Link...
        </p>
      </div>
    </div>
  );
}
