
"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight, ShieldCheck, Zap, Globe } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export function Hero() {
  const heroImage = PlaceHolderImages.find((img) => img.id === "hero-cloud");

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden hero-gradient">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Next-Gen Enterprise Infrastructure
          </div>
          
          <div className="space-y-4">
            <h1 className="font-headline text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight">
              Scale Your Enterprise <br />
              <span className="text-primary">Without Limits</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
              ApertureCloud provides the resilient, global infrastructure your business needs to innovate faster, stay secure, and grow exponentially.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" asChild className="h-14 px-8 text-lg bg-accent hover:bg-accent/90 group">
              <Link href="#consultation">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg">
              Explore Products
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-8 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="w-5 h-5" />
                <span className="font-bold">99.99%</span>
              </div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Uptime SLA</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <Globe className="w-5 h-5" />
                <span className="font-bold">25+</span>
              </div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Global Regions</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <Zap className="w-5 h-5" />
                <span className="font-bold">&lt;10ms</span>
              </div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Network Latency</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border-8 border-white">
            {heroImage && (
              <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                width={600}
                height={400}
                className="w-full h-auto object-cover"
                data-ai-hint="enterprise cloud"
              />
            )}
          </div>
          {/* Decorative elements */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-primary/20 rounded-full blur-3xl" />
        </div>
      </div>
    </section>
  );
}
