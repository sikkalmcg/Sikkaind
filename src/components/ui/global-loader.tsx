'use client';

import { useLoading } from '@/context/LoadingContext';
import { useEffect } from 'react';
import Image from 'next/image';

/**
 * Global ERP Loader Component for Sikka LMC.
 * Blocks all user interaction and displays a professional processing card.
 * Incorporates high-fidelity mission-save animation.
 */
export default function GlobalLoader() {
  const { isLoading } = useLoading();

  // Block body scroll when loader is active
  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="loader-overlay">
      <div className="loader-card animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center">
        {/* PROVISIONED SAVE ANIMATION NODE */}
        <div className="relative w-24 h-24 mb-4">
            <Image 
                src="https://cdn.pixabay.com/animation/2023/03/08/09/53/09-53-16-104_512.gif" 
                alt="Registry Processing" 
                fill 
                className="object-contain"
                unoptimized
            />
        </div>
        
        <div className="text-center">
            <h2 className="font-black uppercase tracking-tight text-xl text-slate-900 leading-none italic">Sikka ERP</h2>
            <p className="font-bold text-blue-600 uppercase text-[9px] tracking-[0.3em] mt-2">
              Registry Commitment Node Active
            </p>
        </div>
        
        <div className="mt-8 w-full flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 mb-3">
                <div className="h-1 w-1 rounded-full bg-blue-600 animate-ping" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing Manifest...</span>
            </div>
            
            <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-50">
                <div className="h-full bg-blue-600 animate-progress-indefinite w-1/3 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
            </div>
            
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-4 italic">
                Please do not refresh or disconnect from the registry.
            </p>
        </div>
      </div>
    </div>
  );
}
