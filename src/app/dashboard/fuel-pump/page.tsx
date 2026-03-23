'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function FuelPumpRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Mission Registry: This page has been integrated into Plant Management.
    // Redirecting to maintain operational consistency.
    router.replace('/dashboard/plant-management?tab=fuel-pump');
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Syncing Master Registry...</p>
        </div>
    </div>
  );
}
