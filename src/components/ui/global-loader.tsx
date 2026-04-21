'use client';

import { useLoading } from '@/context/LoadingContext';
import { Loader2 } from 'lucide-react';

/**
 * @fileOverview Mission Control Visual Feedback Node.
 * Displays a full-screen overlay during authorized registry operations.
 */
export default function GlobalLoader() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-sm font-black uppercase tracking-widest text-slate-600 animate-pulse italic">
          Synchronizing Registry...
        </p>
      </div>
    </div>
  );
}
