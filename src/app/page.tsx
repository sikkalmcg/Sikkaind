'use client';

import * as React from 'react';
import Image from 'next/image';
import Autoplay from 'embla-carousel-autoplay';
import herotruck from '@/assets/hero-trucks.jpg';
import herorake from '@/assets/hero-rake.png';
import herowarehouse from '@/assets/hero-warehouse.jpg';
// import heroai from '@/assets/hero-ai-analytics.png';
import herotracking from '@/assets/hero-tracking.png';
// import herofreight from '@/assets/hero-freight.png';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious,
  type CarouselApi
} from '@/components/ui/carousel';
import { 
  CheckCircle, Truck, Warehouse, Package, BarChart3, 
  MapPin, Laptop, Users, Globe, Tag, ShieldCheck, Headphones
} from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

/**
 * @fileOverview Sikka LMC Landing Page.
 * Optimized asset handshake node using the local placeholder registry.
 */

export default function HomePage() {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);

  const galleryItems = [
    {
      id: 'herotruck',
      title: 'Domestic Transportation',
      description: 'Optimized movement via road with real-time fleet visibility.',
      src: herotruck
    },
    {
      id: 'herowarehouse',
      title: 'Modern Warehousing',
      description: 'Advanced inventory management and scalable storage solutions.',
      src:herowarehouse
    },
    // {
    //   id: 'heroai',
    //   title: 'AI Video Analytics',
    //   description: 'AI-powered video analytics enables accurate loading and unloading count.',
    //   src: heroai
    // },
    {
      id: 'herorake',
      title: 'Rake & Bulk Handling',
      description: 'Specialized railhead clearing and bulk commodity logistics.',
      src: herorake
    },
    // {
    //   id: 'herofreight',
    //   title: 'Freight Forwarding',
    //   description: 'Seamless international air and sea freight coordination.',
    //   src: herofreight
    // },
    {
      id: 'herotracking',
      title: 'Real-Time Tracking',
      description: 'Advanced shipment monitoring for smarter decision-making.',
      src: herotracking
    }
  ];

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

  React.useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on('select', () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Brand Strip */}
      <section className="bg-slate-900 py-12 border-b border-white/5 shadow-inner text-center">
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tighter text-white uppercase italic leading-none">
            SIKKA INDUSTRIES & LOGISTICS
          </h1>
      </section>

      {/* Hero Carousel */}
      <section className="max-w-[1200px] mx-auto w-full px-4 sm:px-6 -mt-10 relative z-10">
        <div className="rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl border-[6px] border-white bg-slate-100">
          <Carousel
            setApi={setApi}
            plugins={[Autoplay({ delay: 5000 })]}
            className="w-full"
            opts={{ loop: true }}
          >
            <CarouselContent>
              {galleryItems.map((item, index) => (
                <CarouselItem key={index}>
                  <div className="relative aspect-[16/10] sm:aspect-[16/8] w-full group overflow-hidden bg-slate-900">
                    <Image
                      src={item.src}
                      alt={item.title}
                      fill
                      className="object-cover"
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end pb-12 px-10 text-white">
                      <h2 className="text-2xl sm:text-5xl font-black uppercase italic drop-shadow-2xl">{item.title}</h2>
                      <p className="text-sm sm:text-lg text-blue-100 font-bold opacity-90">{item.description}</p>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex left-8 bg-white/10 text-white" />
            <CarouselNext className="hidden md:flex right-8 bg-white/10 text-white" />
          </Carousel>
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
    </div>
  );
}
