import Link from 'next/link';
import { Truck, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 border-t border-white/5">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-white">
              <Truck className="h-6 w-6" />
              <span className="font-black text-xl tracking-tighter uppercase italic">SIKKA LMC</span>
            </div>
            <p className="text-sm leading-relaxed">
              Excellence in logistics, supply chain management, and industrial solutions since 2007.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold uppercase text-xs tracking-widest mb-6">Quick Links</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold uppercase text-xs tracking-widest mb-6">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-xs"><Mail className="h-4 w-4" /> queries@sikka.com</li>
              <li className="flex items-center gap-2 text-xs"><Phone className="h-4 w-4" /> +91 120 4290010</li>
              <li className="flex items-center gap-2 text-xs text-balance"><MapPin className="h-4 w-4 shrink-0" /> Ghaziabad, UP, India</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold uppercase text-xs tracking-widest mb-6">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-white/5 text-center text-[10px] uppercase tracking-widest">
          <p>&copy; {new Date().getFullYear()} Sikka Industries & Logistics. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
