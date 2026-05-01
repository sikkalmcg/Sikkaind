'use client';

import * as React from 'react';
import Image from 'next/image';
import { 
  Truck, Globe, Warehouse, Package, ShieldCheck, 
  Laptop, Users, Layers, Ship
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import placeholderData from '@/app/lib/placeholder-images.json';

export default function ServicesPage() {
  const getImg = (id: string) => placeholderData.placeholderImages.find(p => p.id === id);
  const heroImg = getImg('dashboard-bg');

  const mainServices = [
    {
      title: 'Domestic Transportation',
      description: 'We provide reliable PAN India domestic transportation services ensuring timely and secure movement of goods across industrial hubs, metro cities, and rural locations in India.',
      icon: Truck,
    },
    {
      title: 'Freight Forwarding',
      description: 'Our freight forwarding services provide seamless domestic and international cargo movement through air, sea, and multimodal transportation.',
      icon: Globe,
    },
    {
      title: 'Warehousing Facility',
      description: 'We offer modern warehousing facilities designed to support efficient inventory management and distribution operations.',
      icon: Warehouse,
    },
  ];

  return (
    <div className="bg-white min-h-screen font-body">
      <section className="relative h-[400px] flex items-center justify-center text-center text-white overflow-hidden">
        {heroImg && (
          <Image
            src={heroImg.url}
            alt="Services Hero"
            fill
            priority
            className="object-cover brightness-[0.3]"
            unoptimized
          />
        )}
        <div className="relative z-10 px-4 max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-4">
            Our Services
          </h1>
          <p className="text-lg md:text-xl font-medium text-blue-100 max-w-2xl mx-auto leading-relaxed">
            Comprehensive logistics and supply chain solutions tailored to your business needs.
          </p>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {mainServices.map((service, idx) => (
              <div key={idx} className="bg-white p-8 rounded-xl shadow-xl border border-slate-100 flex flex-col items-start transition-all hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-5">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <service.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-tight">
                    {service.title}
                  </h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed font-medium italic">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
