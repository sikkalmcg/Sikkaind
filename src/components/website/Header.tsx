'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoUrl from '@/assets/logo-old.png'
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
  { href: '/services', label: 'Services' },
  { href: '/contact', label: 'Contact Us' },
];

export default function Header() {
  const pathname = usePathname();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-10 h-10 bg-gray-100 rounded-md" />
            <span className="font-bold text-xl text-blue-800 uppercase tracking-tighter italic">Sikka Industries</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-white shadow-md border-b border-slate-100">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-20 flex justify-between items-center gap-4 overflow-hidden">
          
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0 min-w-0">
            {/* LOGO CONTAINER */}
            <div className="relative w-12 h-12 flex-shrink-0 transition-transform group-hover:scale-110 overflow-hidden rounded-lg">
                <Image 
                  src={logoUrl} 
                  alt="Sikka Logo" 
                  fill 
                  className="object-contain" 
                  priority 
                />
            </div>
            
            <span className="font-black text-sm sm:text-base md:text-lg lg:text-xl text-blue-900 tracking-tighter uppercase leading-none whitespace-nowrap overflow-hidden transition-all shrink-0 italic">
              Sikka Industries <span className="hidden sm:inline">& Logistics</span>
            </span>
          </Link>
          
          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-6 flex-shrink-0">
            {navLinks.map(link => (
              <Link 
                key={link.href} 
                href={link.href} 
                className={`px-2 py-1 text-[11px] font-black uppercase tracking-widest transition-colors ${
                  pathname === link.href ? 'text-blue-900' : 'text-slate-500 hover:text-blue-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="h-6 w-px bg-slate-200 mx-2 hidden xl:block" />
            
            <Button asChild variant="outline" className="rounded-xl font-black text-[10px] uppercase tracking-widest border-slate-200 h-10 px-4">
              <Link href="/track-consignment">Track Consignment</Link>
            </Button>
            
            <Button asChild className="bg-blue-900 hover:bg-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest px-8 h-10 shadow-lg shadow-blue-100 transition-all active:scale-95 border-none">
              <Link href="/login">Login Access</Link>
            </Button>
          </nav>
          
          <div className="lg:hidden flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} className="text-blue-900">
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="fixed top-0 right-0 h-full w-3/4 max-w-xs bg-white p-8 shadow-2xl border-l-4 border-l-blue-900" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-4">
                <span className="font-black text-xs uppercase tracking-widest text-slate-400">Menu</span>
                <Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)} className="text-red-600 bg-red-50 rounded-full hover:bg-red-600 hover:text-white transition-all">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="flex flex-col gap-8">
                {navLinks.map(link => (
                  <Link 
                    key={link.href} 
                    href={link.href} 
                    onClick={() => setMenuOpen(false)} 
                    className={`text-sm font-black uppercase tracking-[0.2em] transition-colors ${
                      pathname === link.href ? 'text-blue-900' : 'text-slate-600 hover:text-blue-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="h-px bg-slate-100 w-full" />
                <Button asChild variant="outline" className="w-full justify-center rounded-xl font-black uppercase text-[11px] tracking-widest h-12" onClick={() => setMenuOpen(false)}>
                    <Link href="/track-consignment">Track Consignment</Link>
                </Button>
                <Button asChild className="w-full bg-blue-900 hover:bg-slate-900 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] h-12 shadow-xl shadow-blue-100" onClick={() => setMenuOpen(false)}>
                  <Link href="/login">Authorize Access</Link>
                </Button>
              </nav>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
