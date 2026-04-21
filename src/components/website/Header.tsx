
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu, X, Radar, ChevronRight, User, Users, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import placeholderData from '@/app/lib/placeholder-images.json';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * @fileOverview Website Header Handbook.
 * Features: Dual Portal Selector (Client vs Employee) and responsive registry navigation.
 */
export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const logoAsset = placeholderData.placeholderImages.find(p => p.id === 'logo-old');

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
            {logoAsset?.url ? (
              <Image 
                src={logoAsset.url}
                alt="Sikka LMC Logo"
                width={140}
                height={40}
                className="object-contain"
                priority
                unoptimized={true}
              />
            ) : (
              <span className="text-xl font-bold text-blue-900 italic">SIKKA LMC</span>
            )}
          </Link>
        </div>
        
        <div className="flex lg:hidden">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl p-2.5 text-slate-900 bg-slate-50 border border-slate-200"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="hidden lg:flex lg:gap-x-10">
          {[
            { name: 'Home', href: '/' },
            { name: 'Services', href: '/services' },
            { name: 'About', href: '/about' },
            { name: 'Contact', href: '/contact' },
          ].map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:text-blue-600",
                pathname === item.href ? "text-blue-600 border-b-2 border-blue-600 pb-1" : "text-slate-50"
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex lg:flex-1 lg:justify-end gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className="bg-blue-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-xl px-6 shadow-lg shadow-blue-900/20 transition-all active:scale-95 border-none">
                    <Lock className="h-3.5 w-3.5 mr-2" /> Portal Login
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-3xl border-slate-200 mt-2">
                <Link href="/login?mode=client">
                    <DropdownMenuItem className="gap-3 py-3 rounded-xl cursor-pointer hover:bg-blue-50 group">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <User className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-black uppercase text-[10px] tracking-tight">Client Login</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase leading-none">Read-Only Access</span>
                        </div>
                    </DropdownMenuItem>
                </Link>
                <Link href="/login?mode=employee">
                    <DropdownMenuItem className="gap-3 py-3 rounded-xl cursor-pointer hover:bg-emerald-50 group mt-1">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Users className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-black uppercase text-[10px] tracking-tight">Employee Login</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase leading-none">Read/Write Registry</span>
                        </div>
                    </DropdownMenuItem>
                </Link>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button asChild variant="outline" className="font-black uppercase text-[10px] tracking-widest rounded-xl px-6 border-slate-200 shadow-sm hover:bg-slate-50">
            <Link href="/track-consignment" className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-blue-600" /> Track Mission
            </Link>
          </Button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      <div className={cn(
        "lg:hidden fixed inset-y-0 right-0 z-[120] w-full max-w-xs bg-white shadow-2xl transition-transform duration-300 ease-in-out transform flex flex-col",
        mobileMenuOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b bg-slate-50">
          <Link href="/" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
            {logoAsset?.url ? (
              <Image 
                src={logoAsset.url}
                alt="Sikka LMC Logo"
                width={140}
                height={40}
                className="object-contain"
                priority
                unoptimized={true}
              />
            ) : (
              <span className="text-xl font-bold text-blue-900 italic">SIKKA LMC</span>
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
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-4">
          <div className="grid grid-cols-1 gap-2">
            <Link href="/login?mode=client" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl group active:scale-95 transition-all">
                <div className="p-2.5 bg-blue-900 text-white rounded-xl shadow-lg"><User size={20} /></div>
                <div className="flex flex-col">
                    <span className="text-xs font-black uppercase text-blue-900 tracking-tight">Client Portal</span>
                    <span className="text-[8px] font-bold text-blue-400 uppercase">View Mission Registry</span>
                </div>
            </Link>
            <Link href="/login?mode=employee" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl group active:scale-95 transition-all">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg"><Users size={20} /></div>
                <div className="flex flex-col">
                    <span className="text-xs font-black uppercase text-slate-900 tracking-tight">Employee Portal</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Full Registry Operations</span>
                </div>
            </Link>
          </div>

          <Separator className="opacity-50" />

          {[
            { name: 'Home', href: '/' },
            { name: 'Services', href: '/services' },
            { name: 'About', href: '/about' },
            { name: 'Contact', href: '/contact' },
          ].map((item) => (
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

        <div className="p-6 border-t bg-slate-50 space-y-4 text-center">
            <Link href="/track-consignment" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-3 w-full h-12 bg-white border border-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest text-blue-600 shadow-sm">
              <Radar className="h-4 w-4" /> Track Mission
            </Link>
          <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.3em] pt-2">© Sikka Industries & Logistics Registry</p>
        </div>
      </div>
    </header>
  );
}

function Separator({ className }: { className?: string }) {
    return <div className={cn("h-px w-full bg-slate-200", className)} />;
}
