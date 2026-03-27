'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu, X, Truck } from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Services', href: '/services' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-3 group">
            <div className="bg-blue-900 p-2 rounded-xl text-white shadow-lg group-hover:rotate-12 transition-transform">
              <Truck className="h-6 w-6" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic text-slate-900">
              Sikka LMC
            </span>
          </Link>
        </div>
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-slate-700"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="hidden lg:flex lg:gap-x-12">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "text-xs font-black uppercase tracking-widest transition-colors hover:text-blue-600",
                pathname === item.href ? "text-blue-600" : "text-slate-500"
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>
        <div className="hidden lg:flex lg:flex-1 lg:justify-end gap-4">
          <Button variant="ghost" asChild className="font-black uppercase text-[10px] tracking-widest">
            <Link href="/login">Portal Login</Link>
          </Button>
          <Button asChild className="bg-blue-900 hover:bg-black font-black uppercase text-[10px] tracking-widest rounded-xl px-6 shadow-lg shadow-blue-900/20">
            <Link href="/track-consignment">Track Mission</Link>
          </Button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white p-6 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
              <div className="bg-blue-900 p-2 rounded-xl text-white">
                <Truck className="h-6 w-6" />
              </div>
              <span className="text-xl font-black tracking-tighter uppercase italic">Sikka LMC</span>
            </Link>
            <button
              type="button"
              className="-m-2.5 rounded-md p-2.5 text-slate-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block text-lg font-black uppercase tracking-tight py-2 border-b border-slate-100",
                  pathname === item.href ? "text-blue-600" : "text-slate-900"
                )}
              >
                {item.name}
              </Link>
            ))}
            <div className="pt-8 flex flex-col gap-4">
              <Button variant="outline" asChild className="w-full h-12 font-black uppercase text-xs tracking-widest">
                <Link href="/login">Portal Login</Link>
              </Button>
              <Button asChild className="w-full h-12 bg-blue-900 font-black uppercase text-xs tracking-widest">
                <Link href="/track-consignment">Track Mission</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
