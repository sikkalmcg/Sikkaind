
'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Landmark, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/firebase';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Sikka Accounts Layout Node.
 * Provides the financial context header and secure navigation terminal.
 */
export default function AccountsLayout({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = () => {
        if (auth) auth.signOut();
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-50 animate-in fade-in duration-500">
            <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-white px-6 shadow-sm shrink-0">
                <nav className="flex items-center gap-6 text-sm font-medium">
                    <Link href="/modules" className="flex items-center gap-2 group">
                        <ArrowLeft className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        <span className="font-black uppercase tracking-tight text-slate-600 group-hover:text-slate-900">Module Terminal</span>
                    </Link>
                    <Separator orientation="vertical" className="h-6 bg-slate-200" />
                    <div className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-emerald-600" />
                        <span className="font-black uppercase tracking-widest text-emerald-900 italic">Accounts Hub</span>
                    </div>
                </nav>
                
                <div className="ml-auto flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-900 font-black text-[9px] uppercase shadow-sm">
                        <ShieldCheck className="h-3 w-3" /> Financial Control Node
                    </div>
                    <Button onClick={handleLogout} variant="outline" className="font-bold uppercase text-[10px] h-9 rounded-xl border-slate-200 shadow-sm">
                        Log out Registry
                    </Button>
                </div>
            </header>
            
            <main className="flex-1 flex flex-col overflow-hidden">
                {children}
            </main>
        </div>
    );
}
