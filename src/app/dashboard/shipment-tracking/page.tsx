'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * @fileOverview Redundant GIS Telemetry page neutralized.
 * Real-time tracking node migrated to unified Trip Board modal.
 */
export default function NeutralizedPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/trip-board');
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Migrating GIS Node...</p>
        </div>
    </div>
  );
}
