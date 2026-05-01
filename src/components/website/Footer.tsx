
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Truck, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';

/**
 * @fileOverview Website Footer.
 * Centralized corporate nodes and contact registry.
 */
export default function Footer() {
  const logoImg = placeholderData.placeholderImages.find(p => p.id === 'logo-old');

  return (
    <footer className="bg-slate-900 text-white pt-12 pb-8 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-24 opacity-[0.03] rotate-12">
        <Truck className="h-96 w-96" />
      </div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-10">
          <div className="space-y-6 lg:col-span-2">
            <div className="flex items-center gap-4">
              <Link href="/">
                {logoImg?.url && (
                  <Image 
                    src={logoImg.url} 
                    alt="Sikka LMC Logo" 
                    width={160} 
                    height={50} 
                    className="object-contain" 
                    unoptimized={true}
                  />
                )}
              </Link>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed font-medium max-w-md">
              A premier logistics and supply chain enterprise delivering excellence across India through intelligence-driven movement and modern infrastructure.
            </p>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 w-fit">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-100">ISO 9001:2015 CERTIFIED</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-6">Contact Node</h4>
            <ul className="space-y-5">
              <li className="flex items-start gap-4">
                <div className="p-2 bg-white/5 rounded-lg"><Phone className="h-4 w-4 text-blue-400" /></div>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black uppercase text-slate-500">Call Center</p>
                  <p className="text-sm font-bold">+91 120 4290010</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="p-2 bg-white/5 rounded-lg"><Mail className="h-4 w-4 text-blue-400" /></div>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black uppercase text-slate-500">Support</p>
                  <p className="text-sm font-bold">queries@sikkaenterprises.com</p>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-6">Corporate HUB</h4>
            <div className="flex items-start gap-4 list-none">
              <div className="p-2 bg-white/5 rounded-lg"><MapPin className="h-4 w-4 text-blue-400" /></div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase text-slate-500">Headquarters</p>
                <p className="text-sm font-bold leading-relaxed text-slate-300 uppercase">
                  Ghaziabad – 201009,<br />
                  Uttar Pradesh, India
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col items-center justify-center">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 text-center">
            Copyright © {new Date().getFullYear()} Sikka Industries & Logistics.
          </p>
        </div>
      </div>
    </footer>
  );
}
