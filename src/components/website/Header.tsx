
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Radar, Lock } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';

/**
 * @fileOverview Website Header.
 * Simplified brand node focusing on the core identity.
 */
export default function Header() {
  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');

  return (
    <header className="bg-white sticky top-0 z-[100] border-b border-slate-200 shadow-sm w-full">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="flex items-center gap-1 group">
            {logoAsset?.url && (
              <Image 
                src={logoAsset.url}
                alt="Sikka LMC Logo"
                width={70}
                height={45}
                className="object-contain"
                priority
                unoptimized={true}
              />
            )}
            <div className="flex flex-col justify-center border-l-2 border-slate-100 pl-3 ml-2">
              <span className="text-[11px] md:text-[15px] font-black text-blue-900 uppercase italic tracking-tighter leading-none">SIKKA INDUSTRIES</span>
              <span className="text-[7px] md:text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-0.5">& LOGISTICS</span>
            </div>
          </Link>
        </div>
        
        <div className="flex flex-1 justify-end gap-4">
          <Button asChild className="bg-blue-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-xl px-6 shadow-lg shadow-blue-900/20 transition-all border-none">
            <Link href="/" className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" /> Portal
            </Link>
          </Button>

          <Button asChild variant="outline" className="hidden md:flex font-black uppercase text-[10px] tracking-widest rounded-xl px-6 border-slate-200 shadow-sm hover:bg-slate-50">
            <Link href="/" className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-blue-600" /> Track
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
