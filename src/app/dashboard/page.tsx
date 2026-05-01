
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Truck, Users } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';

/**
 * @fileOverview Modules Selection Dashboard.
 * Replicates the SLMC hub interface provided in the screenshot.
 */
export default function DashboardPage() {
  const bgImg = placeholderData.placeholderImages.find(p => p.id === 'dashboard-bg');
  const logoImg = placeholderData.placeholderImages.find(p => p.id === 'slmc-logo');

  const modules = [
    {
      title: 'Logistics Hub',
      description: 'Manage and track all logistics operations.',
      icon: Truck,
      color: 'text-blue-400',
      href: '/shipments/new',
    },
    {
      title: 'User Management',
      description: 'Administer user accounts and permissions.',
      icon: Users,
      color: 'text-purple-400',
      href: '/admin/users',
    }
  ];

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden font-body">
      {/* Background Image with Dark Overlay */}
      <div className="absolute inset-0 z-0">
        {bgImg && (
          <Image
            src={bgImg.url}
            alt="Logistics Background"
            fill
            className="object-cover"
            priority
            unoptimized
            data-ai-hint="logistics dark"
          />
        )}
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-[2px]" />
      </div>

      {/* Profile Avatar Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg border border-white/20">
          <span className="text-white font-bold text-lg">S</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl px-6 flex flex-col items-center space-y-16">
        {/* Central Logo */}
        <div className="bg-white p-4 rounded shadow-2xl animate-fade-in">
           {logoImg && (
             <Image 
                src={logoImg.url}
                alt="SLMC Logo"
                width={300}
                height={100}
                className="object-contain"
                unoptimized
             />
           )}
           <p className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-[0.2em] mt-2 border-t pt-2">
             Sikka Logistics Management Control
           </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {modules.map((mod) => (
            <Link 
              key={mod.title} 
              href={mod.href}
              className="group bg-slate-900/40 backdrop-blur-md border border-white/10 p-8 rounded-xl hover:bg-slate-900/60 hover:border-white/20 transition-all duration-300"
            >
              <div className="flex items-start gap-4 mb-4">
                <mod.icon className={`h-8 w-8 ${mod.color} mt-1`} />
                <div className="space-y-1">
                  <h2 className={`text-xl font-bold uppercase tracking-tight ${mod.color}`}>
                    {mod.title}
                  </h2>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    {mod.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center opacity-50">
          Sikka Industries & Logistics Hub • Registry V2.5
        </p>
      </div>
    </div>
  );
}
