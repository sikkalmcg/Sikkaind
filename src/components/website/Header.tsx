
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu, X, Truck, LogIn, Radar, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import placeholderData from '@/app/lib/placeholder-images.json';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Services', href: '/services' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logoImg = placeholderData.placeholderImages.find(p => p.id === 'logo-old');

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  return (
    <header className="bg-white sticky top-0 z-[100] border-b border-slate-200 shadow-sm w-full">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="flex items-center group">
            {logoImg?.url && (
              <Image 
                src={logoImg.url} 
                alt="Sikka LMC Logo" 
                width={140} 
                height={40} 
                className="object-contain" 
                priority
              />
            )}
          </Link>
        </div>
        
        {/* Mobile Toggle Button */}
        <div className="flex lg:hidden">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl p-2.5 text-slate-900 bg-slate-50 border border-slate-200"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex lg:gap-x-10">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:text-blue-600",
                pathname === item.href ? "text-blue-600 border-b-2 border-blue-600 pb-1" : "text-slate-500"
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex lg:flex-1 lg:justify-end gap-4">
          <Button variant="ghost" asChild className="font-black uppercase text-[10px] tracking-widest hover:bg-slate-50">
            <Link href="/login">Portal Login</Link>
          </Button>
          <Button asChild className="bg-blue-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-xl px-6 shadow-lg shadow-blue-900/20 transition-all active:scale-95 border-none">
            <Link href="/track-consignment" className="flex items-center gap-2">
              <Radar className="h-4 w-4" /> Track Mission
            </Link>
          </Button>
        </div>
      </nav>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Mobile Menu Drawer */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 right-0 z-[120] w-full max-w-xs bg-white shadow-2xl transition-transform duration-300 ease-in-out transform flex flex-col",
        mobileMenuOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b bg-slate-50">
          <Link href="/" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
            {logoImg?.url && (
              <Image 
                src={logoImg.url} 
                alt="Sikka LMC Logo" 
                width={120} 
                height={35} 
                className="object-contain"
              />
            )}
          </Link>
          <button
            type="button"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors border border-transparent hover:border-slate-300"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "block text-sm font-black uppercase tracking-widest py-4 px-6 rounded-2xl transition-all border-2",
                pathname === item.href 
                  ? "bg-blue-50 border-blue-100 text-blue-900 shadow-sm" 
                  : "bg-white border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-100"
              )}
            >
              <div className="flex items-center justify-between">
                {item.name}
                <ChevronRight className={cn("h-4 w-4 transition-transform", pathname === item.href ? "translate-x-0" : "-translate-x-2 opacity-0")} />
              </div>
            </Link>
          ))}
        </div>

        <div className="p-6 border-t bg-slate-50 space-y-4">
          <Button variant="outline" asChild className="w-full h-14 font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl border-slate-200 bg-white text-slate-900 shadow-md transition-all active:scale-95">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-3">
              <LogIn className="h-4 w-4 text-blue-600" /> Portal Login
            </Link>
          </Button>
          <Button asChild className="w-full h-14 bg-blue-900 hover:bg-black text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-95 border-none">
            <Link href="/track-consignment" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-3">
              <Radar className="h-4 w-4" /> Track Mission
            </Link>
          </Button>
          <p className="text-center text-[8px] font-black uppercase text-slate-400 tracking-[0.3em] pt-2">© Sikka Industries & Logistics Registry</p>
        </div>
      </div>
    </header>
  );
}
