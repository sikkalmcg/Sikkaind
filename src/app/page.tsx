'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
  CheckCircle, Truck, Warehouse, Package, BarChart3, 
  MapPin, Laptop, Users, Globe, Tag, ShieldCheck, Headphones,
  ArrowRight, Radar
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * @fileOverview Sikka LMC Landing Page.
 * Streamlined Typography-Led Node. 
 * Carousel and image assets purged for a clean registry aesthetic.
 * Badge node removed as per latest mission requirement.
 */

export default function HomePage() {
  const solutions = [
    { title: 'Transportation Services', icon: Truck, points: ['Full Truck Load (FTL)', 'Dedicated Fleet Services', 'Pan-India Delivery', 'Real-time Tracking'] },
    { title: 'Warehousing Solutions', icon: Warehouse, points: ['Modern Infrastructure', 'Inventory Management', 'Stock Handling', 'System-Based Control'] },
    { title: 'CFA Services', icon: Package, points: ['Primary & Secondary Distribution', 'Order Processing', 'Inventory Control', 'Dispatch Management'] },
    { title: 'Supply Chain Management', icon: BarChart3, points: ['End-to-End Planning', 'Route Optimization', 'Cost Optimization', 'Vendor Coordination'] },
    { title: 'Distribution & Last Mile', icon: MapPin, points: ['Dealer Distribution', 'Fast Dispatch', 'Time-Bound Deliveries', 'POD Management'] },
    { title: 'Technology Operations', icon: Laptop, points: ['ERP Management', 'Real-Time Tracking', 'Automated Reporting', 'Digital Documentation'] }
  ];

  const whyChooseUs = [
    { title: 'Experienced Team', icon: Users },
    { title: 'Nationwide Network', icon: Globe },
    { title: 'Transparent Pricing', icon: Tag },
    { title: 'On-Time Delivery', icon: CheckCircle },
    { title: 'Safety & Compliance', icon: ShieldCheck },
    { title: 'Customer Support', icon: Headphones },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white font-body">
      {/* Brand Strip */}
      <section className="bg-slate-900 py-12 border-b border-white/5 shadow-inner text-center">
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tighter text-white uppercase italic leading-none">
            SIKKA INDUSTRIES & LOGISTICS
          </h1>
      </section>

      {/* Hero Content Section (Replaces Carousel) */}
      <section className="py-24 md:py-32 bg-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-24 opacity-[0.02] rotate-12 pointer-events-none">
            <Truck size={400} />
        </div>
        <div className="max-w-5xl mx-auto px-6 text-center space-y-8 relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-[1.1]">
                Intelligence-Driven <span className="text-blue-600">MOVEMENT</span> <br/>
                & SUPPLY CHAIN EXCELLENCE.
            </h2>
            <p className="text-lg md:text-xl text-slate-500 font-medium max-w-3xl mx-auto leading-relaxed">
                Optimizing nationwide distribution through a verified network of lifting nodes, 
                real-time GIS telemetry, and professional warehouse management.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-6">
                <Button asChild size="lg" className="h-14 px-10 bg-blue-900 hover:bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-blue-900/20 transition-all active:scale-95 border-none">
                    <Link href="/track-consignment" className="flex items-center gap-3">
                        <Radar className="h-5 w-5" /> Track Mission
                    </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-10 rounded-2xl font-black uppercase text-xs tracking-widest border-slate-200 hover:bg-slate-50 transition-all">
                    <Link href="/services">View Solutions</Link>
                </Button>
            </div>
        </div>
      </section>
        
      {/* LOGISTICS SOLUTIONS */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
              Our Solutions
            </h2>
            <div className="h-1.5 w-24 bg-blue-600 mx-auto mt-6 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {solutions.map((sol) => (
              <div key={sol.title} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 hover:-translate-y-2 transition-transform duration-500 group">
                <div className="flex items-center gap-5 mb-6">
                  <div className="p-4 bg-blue-50 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <sol.icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{sol.title}</h3>
                </div>
                <ul className="space-y-3">
                  {sol.points.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-[13px] text-slate-600 font-bold">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="py-16 bg-white border-y border-slate-100">
        <div className="max-w-[1100px] mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {whyChooseUs.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 group">
                <div className="p-2 bg-white rounded-lg shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-6">
              <div className="bg-blue-900 rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden group shadow-2xl">
                  <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
                      <BarChart3 className="h-48 w-48 md:h-64 md:w-64" />
                  </div>
                  <div className="relative z-10 space-y-8">
                      <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none italic">Ready to optimize <br/> your supply chain?</h2>
                      <p className="text-lg text-blue-100 font-medium opacity-90 max-w-xl">
                          Contact our mission control today to discuss verified logistics solutions 
                          tailored to your industry node.
                      </p>
                      <Button asChild variant="secondary" className="h-14 px-10 rounded-2xl font-black uppercase text-xs tracking-widest bg-white text-blue-900 hover:bg-blue-50 transition-all active:scale-95 border-none">
                          <Link href="/contact" className="flex items-center gap-2">
                              Contact Node <ArrowRight className="h-4 w-4" />
                          </Link>
                      </Button>
                  </div>
              </div>
          </div>
      </section>
    </div>
  );
}
