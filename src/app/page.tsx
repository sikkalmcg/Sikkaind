
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
 * Updated: Removed CTA section as requested.
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
      {/* LOGISTICS SOLUTIONS */}
      <section className="py-24 bg-white">
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
      <section className="py-16 bg-slate-50 border-y border-slate-100">
        <div className="max-w-[1100px] mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {whyChooseUs.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100 group shadow-sm">
                <div className="p-2 bg-slate-50 rounded-lg shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
