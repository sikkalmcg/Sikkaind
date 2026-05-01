'use client';

import * as React from 'react';
import Image from 'next/image';
import Autoplay from 'embla-carousel-autoplay';
import { 
  CheckCircle, Truck, Warehouse, ShieldCheck, Users, Activity, Globe 
} from 'lucide-react';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem 
} from '@/components/ui/carousel';
import placeholderData from '@/app/lib/placeholder-images.json';

const infrastructureStats = [
    { label: 'Daily Inland Movement', value: '500+ Trucks', icon: Truck },
    { label: 'Daily Handling Capacity', value: '5,000 MT', icon: Activity },
    { label: 'Warehousing Space', value: '4,50,000 Sq. Ft.', icon: Warehouse },
];

export default function AboutPage() {
    const getImg = (id: string) => placeholderData.placeholderImages.find(p => p.id === id);

    const capabilitiesSlides = [
        { src: getImg('office-3')?.url, hint: 'warehouse storage' },
        { src: getImg('office-2')?.url, hint: 'logistics network' },
        { src: getImg('office-4')?.url, hint: 'shipment tracking' },
    ];

    const expertiseSlides = [
        { src: getImg('office-5')?.url, hint: 'logistics office' },
        { src: getImg('office-1')?.url, hint: 'logistics office' },
    ];

    const heroImg = getImg('hero-warehouse');

    return (
        <div className="bg-white text-slate-800">
            <section className="relative py-20 md:py-32 text-white overflow-hidden min-h-[450px] flex items-center">
                {heroImg?.url && (
                    <Image
                        src={heroImg.url}
                        alt="Sikka Logistics Hub"
                        fill
                        priority
                        className="object-cover z-0 brightness-[0.25]"
                        unoptimized={true}
                    />
                )}
                <div className="container mx-auto px-4 relative z-10">
                    <div className="max-w-4xl space-y-6">
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-none">
                            About Us
                        </h1>
                        <p className="text-xl md:text-2xl font-light text-blue-100 max-w-2xl leading-relaxed">
                            Sikka Industries & Logistics is a world-class provider of innovative logistics, supply chain management, and manufacturing solutions.
                        </p>
                    </div>
                </div>
            </section>
            
            <section className="py-20 bg-slate-50">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tight">Our Core Identity</h2>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    With an extensive operational network across India and strong global partnerships, we deliver integrated freight forwarding, warehousing, and transportation services tailored to diverse industry requirements.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-4">
                                    {['Agro Exports', 'Freight Forwarding', 'Rice Exports', 'SCM'].map(tag => (
                                        <span key={tag} className="border border-blue-200 text-blue-700 bg-white font-bold uppercase text-[10px] px-4 py-1.5 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-2 h-full bg-blue-900" />
                            <h3 className="text-xl font-black text-blue-900 uppercase mb-4 flex items-center gap-3">
                                <Globe className="h-6 w-6" /> Nationwide Network
                            </h3>
                            <p className="text-slate-600 font-medium leading-relaxed">
                                Through strategic planning and operational excellence, we ensure seamless movement of goods across domestic and international markets.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight">Strong Infrastructure</h2>
                        <p className="text-slate-500 font-bold uppercase text-xs tracking-[0.3em] mt-2">Operational Capabilities & Scale</p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-8">
                        {infrastructureStats.map((stat, i) => (
                            <div key={i} className="p-10 text-center space-y-4 bg-slate-900 text-white rounded-[2rem] shadow-2xl transition-transform hover:-translate-y-2">
                                <div className="mx-auto bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl">
                                    <stat.icon className="h-8 w-8" />
                                </div>
                                <div>
                                    <p className="text-3xl font-black tracking-tighter mb-1">{stat.value}</p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">{stat.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-16 p-6 md:p-10 bg-slate-50 rounded-[3rem] border border-slate-200 grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tight">Capabilities Overview</h3>
                            <ul className="space-y-4">
                                {[
                                    'Dedicated railhead clearing and shipping tie-ups',
                                    'Strategic partnerships with logistics associates worldwide',
                                    'Reliable, scalable, and time-bound logistics solutions'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-slate-700 font-bold text-sm">
                                        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative aspect-video rounded-[2rem] overflow-hidden shadow-2xl border-4 md:border-8 border-white group bg-slate-200">
                            <Carousel
                                plugins={[Autoplay({ delay: 4000 })]}
                                className="w-full h-full"
                            >
                                <CarouselContent>
                                    {capabilitiesSlides.map((slide, idx) => (
                                        <CarouselItem key={idx}>
                                            <div className="relative aspect-video w-full">
                                                {slide.src && (
                                                    <Image 
                                                        src={slide.src} 
                                                        fill 
                                                        className="object-cover"
                                                        alt="Capability Slide"
                                                        data-ai-hint={slide.hint}
                                                        unoptimized={slide.src.startsWith('/assets/')}
                                                    />
                                                )}
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                            </Carousel>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
