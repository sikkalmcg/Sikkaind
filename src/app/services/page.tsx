'use client';

import * as React from 'react';
import Image from 'next/image';
import { 
  Truck, Globe, Warehouse, Package, ShieldCheck, 
  MapPin, Laptop, Users, Layers, Ship, CheckCircle
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
    {
      title: 'Manufacturing & Packaging Solutions',
      description: 'We provide value-added manufacturing support and packaging solutions tailored to supply chain requirements.',
      icon: Package,
    },
    {
      title: 'Regulatory Compliance Services',
      description: 'Our regulatory compliance services ensure smooth logistics operations in accordance with government norms and statutory requirements in India.',
      icon: ShieldCheck,
    },
  ];

  const whyChooseItems = [
    {
      title: 'PAN India Operational Network',
      description: 'Our extensive network across India enables seamless cargo movement, faster turnaround times, and consistent service delivery.',
      icon: Globe,
    },
    {
      title: 'HACCP-Certified Processes',
      description: 'We follow HACCP-compliant warehousing and handling standards, ensuring safety, hygiene, and quality control.',
      icon: ShieldCheck,
    },
    {
      title: 'Multimodal Transportation Expertise',
      description: 'Integrated road, rail, air, and sea solutions provide flexible, cost-effective, and time-bound freight management.',
      icon: Ship,
    },
    {
      title: 'Technology-Driven Tracking Systems',
      description: 'Advanced GPS tracking, Warehouse Management Systems (WMS), and real-time reporting tools offer complete shipment visibility.',
      icon: Laptop,
    },
    {
      title: 'Experienced Logistics Professionals',
      description: 'Our skilled operations team ensures structured planning, risk mitigation, and regulatory compliance at every stage.',
      icon: Users,
    },
    {
      title: 'Scalable & Customized Solutions',
      description: 'We design flexible logistics models that adapt to evolving business volumes, seasonal demand, and expansion strategies.',
      icon: Layers,
    },
  ];

  return (
    <div className="bg-white min-h-screen font-body">
      {/* HERO SECTION */}
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

      {/* MAIN SERVICES GRID */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mainServices.map((service, idx) => (
              <div 
                key={idx} 
                className={`bg-white p-8 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-start transition-all hover:shadow-xl ${idx >= 3 ? 'lg:col-span-1 lg:mx-auto lg:w-full' : ''}`}
              >
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

      {/* WHY CHOOSE SECTION */}
      <section className="py-24 bg-slate-50/50 border-t border-slate-100">
        <div className="container mx-auto px-6 max-w-7xl text-center">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight italic mb-4">
            Why Choose Our Services?
          </h2>
          <p className="text-slate-500 text-sm font-bold max-w-2xl mx-auto mb-16 leading-relaxed">
            We deliver dependable, end-to-end warehousing, logistics, and supply chain solutions designed to enhance operational efficiency.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChooseItems.map((item, idx) => (
              <div key={idx} className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm flex flex-col items-start text-left group hover:border-blue-200 transition-colors">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="text-md font-black text-slate-900 uppercase tracking-tight mb-3">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-20">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-[0.2em] px-10 h-14 rounded-lg shadow-xl shadow-blue-600/20">
              Request a Quote
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
