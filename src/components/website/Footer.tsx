'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Footer() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Registry Logic: Safely handle null pathname during SSR
    const isAppPage = pathname && (
                      pathname.startsWith('/login') || 
                      pathname.startsWith('/dashboard') || 
                      pathname.startsWith('/modules') || 
                      pathname.startsWith('/sikka-accounts') || 
                      pathname.startsWith('/user-management'));

    if (!mounted || isAppPage) {
        return null;
    }

    return (
        <footer className="bg-slate-900 text-slate-300 border-t border-white/5">
            <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12 text-center md:text-left">
                    <div className="space-y-4">
                        <h3 className="font-black text-xl text-white uppercase tracking-tighter italic">Sikka LMC</h3>
                        <p className="text-sm font-medium text-slate-400 leading-relaxed">
                            A world-class provider of innovative logistics, supply chain management, manufacturing, and repacking solutions.
                        </p>
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-500">Corporate HQ • Ghaziabad</p>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-black text-lg text-white uppercase tracking-tight">Contact Registry</h3>
                        <div className="space-y-2 text-sm font-medium">
                            <p className="flex items-center justify-center md:justify-start gap-2">
                                <span className="text-blue-500 font-black">PH:</span> +91 120 4290010
                            </p>
                            <p className="flex items-center justify-center md:justify-start gap-2">
                                <span className="text-blue-500 font-black">EM:</span> queries@sikkaenterprises.com
                            </p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-black text-lg text-white uppercase tracking-tight">Mission Nodes</h3>
                        <ul className="text-sm font-bold uppercase tracking-widest space-y-2">
                            <li><a href="/" className="hover:text-blue-400 transition-colors">Home</a></li>
                            <li><a href="/about" className="hover:text-blue-400 transition-colors">About Us</a></li>
                            <li><a href="/services" className="hover:text-blue-400 transition-colors">Services</a></li>
                            <li><a href="/contact" className="hover:text-blue-400 transition-colors">Contact Us</a></li>
                        </ul>
                    </div>
                </div>
                <div className="mt-16 pt-8 border-t border-white/5 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                        Copyright © 2025 Sikka Industries & Logistics. All Rights Reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
