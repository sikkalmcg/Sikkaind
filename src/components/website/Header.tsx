'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Radar, Lock } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';

export default function Header() {
  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');

  const navLinks = [
    { label: 'HOME', href: '/' },
    { label: 'SERVICES', href: '/services' },
    { label: 'ABOUT', href: '/about' },
    { label: 'CONTACT', href: '/#contact' },
  ];

  return (
    <header className="bg-white sticky top-0 z-[100] border-b border-slate-100 w-full font-body">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-12" aria-label="Global">
        <div className="flex flex-1 items-center justify-start">
          <Link href="/" className="flex items-center group">
            <div className="flex items-center gap-4">
              {logoAsset?.url && (
                <div className="relative w-[70px] h-[35px] md:w-[80px] md:h-[40px]">
                  <Image 
                    src={logoAsset.url}
                    alt="Sikka Logo"
                    fill
                    className="object-contain"
                    priority
                    unoptimized={true}
                  />
                </div>
              )}
              <div className="h-8 w-[1px] bg-slate-200" />
              <div className="flex flex-col">
                <span className="text-[14px] md:text-[18px] font-black text-[#1e3a8a] uppercase italic tracking-tight leading-none">
                  SIKKA INDUSTRIES
                </span>
                <span className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                  & LOGISTICS
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className="hidden lg:flex flex-1 items-center justify-center gap-8">
          {navLinks.map((link) => (
            <Link 
              key={link.label}
              href={link.href}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-[#1e3a8a] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-3 md:gap-4">
          <Button 
            asChild 
            className="bg-[#1e3a8a] hover:bg-[#162a63] text-white font-black uppercase text-[10px] tracking-widest rounded-xl px-5 md:px-7 h-11 shadow-[0_4px_12px_rgba(30,58,138,0.25)] border-none flex items-center gap-2"
          >
            <Link href="/login">
              <Lock className="h-3.5 w-3.5" /> PORTAL LOGIN
            </Link>
          </Button>

          <Button 
            asChild 
            variant="outline" 
            className="bg-white hover:bg-slate-50 text-slate-900 font-black uppercase text-[10px] tracking-widest rounded-xl px-5 md:px-7 h-11 border-slate-200 shadow-sm flex items-center gap-2"
          >
            <Link href="/track">
              <Radar className="h-4 w-4 text-blue-600" /> TRACK
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
