
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Truck, Mail, Phone, MapPin, Globe, ShieldCheck } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';

export default function Footer() {
  const logoImg = placeholderData.placeholderImages.find(p => p.id === 'logo-old');

  return (
    <footer className="bg-slate-900 text-white pt-24 pb-12 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-24 opacity-[0.03] rotate-12">
        <Truck className="h-96 w-96" />
      </div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <Link href="/">
                {logoImg?.url && (
                  <Image 
                    src={logoImg.url} 
                    alt="Sikka LMC Logo" 
                    width={160} 
                    height={45} 
                    className="object-contain brightness-0 invert" 
                  />
                )}
              </Link>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              A premier logistics and supply chain enterprise delivering excellence across India through intelligence-driven movement and modern infrastructure.
            </p>
            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">ISO 9001:2015 CERTIFIED</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-8">Registry Links</h4>
            <ul className="space-y-4">
              {['Home', 'Services', 'About Us', 'Contact', 'Track Consignment', 'Portal Login'].map((item) => (
                <li key={item}>
                  <Link 
                    href={item === 'Home' ? '/' : `/${item.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-slate-400 hover:text-white text-sm font-bold transition-colors flex items-center gap-2 group"
                  >
                    <div className="h-1 w-1 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-8">Contact Node</h4>
            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <div className="p-2 bg-white/5 rounded-lg"><Phone className="h-4 w-4 text-blue-400" /></div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-500">Call Center</p>
                  <p className="text-sm font-bold">+91 120 4290010</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="p-2 bg-white/5 rounded-lg"><Mail className="h-4 w-4 text-blue-400" /></div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-500">Registry Support</p>
                  <p className="text-sm font-bold">queries@sikka.com</p>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-8">Corporate HUB</h4>
            <li className="flex items-start gap-4 list-none">
              <div className="p-2 bg-white/5 rounded-lg"><MapPin className="h-4 w-4 text-blue-400" /></div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-500">Headquarters</p>
                <p className="text-sm font-bold leading-relaxed text-slate-300">
                  Sikka Industries & Logistics<br />
                  Ghaziabad – 201009,<br />
                  Uttar Pradesh, India
                </p>
              </div>
            </li>
          </div>
        </div>

        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
            © {new Date().getFullYear()} Sikka Industries & Logistics. Registry v2.5
          </p>
          <div className="flex items-center gap-8">
            <Link href="/privacy" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Privacy Node</Link>
            <Link href="/terms" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Registry Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
