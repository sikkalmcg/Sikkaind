
"use client";

import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "CTO, FinStream Global",
    content: "Switching to ApertureCloud reduced our infrastructure costs by 35% while improving our platform reliability significantly.",
    avatar: "https://picsum.photos/seed/person1/100/100"
  },
  {
    name: "Marcus Thorne",
    role: "VP Engineering, Logistics Pro",
    content: "The global presence of Aperture allows us to serve our international customers with sub-10ms latency. The support team is top-notch.",
    avatar: "https://picsum.photos/seed/person2/100/100"
  }
];

export function Testimonials() {
  const logos = PlaceHolderImages.filter(img => img.id.startsWith('logo-'));

  return (
    <section id="testimonials" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-16 items-center">
          <div className="lg:w-1/2 space-y-8">
            <h2 className="text-4xl font-headline font-bold leading-tight">
              Trusted by Industry <br />
              <span className="text-primary">Leaders & Visionaries</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              From global financial institutions to rapidly scaling startups, ApertureCloud provides the backbone for tomorrow's innovations.
            </p>
            
            <div className="grid grid-cols-2 gap-8 items-center opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
              {logos.map((logo, i) => (
                <div key={i} className="flex justify-start">
                  <Image 
                    src={logo.imageUrl} 
                    alt={logo.description} 
                    width={140} 
                    height={70} 
                    className="object-contain max-h-12"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="lg:w-1/2 grid gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="border-none shadow-lg glass-card">
                <CardContent className="pt-8 space-y-6">
                  <Quote className="w-10 h-10 text-primary/20" />
                  <p className="text-lg italic text-foreground/80 leading-relaxed">
                    "{t.content}"
                  </p>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-primary/20">
                      <AvatarImage src={t.avatar} />
                      <AvatarFallback>{t.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-bold text-foreground">{t.name}</h4>
                      <p className="text-sm text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
