
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Cloud, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4",
        isScrolled ? "bg-white/80 backdrop-blur-md border-b shadow-sm" : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-primary p-2 rounded-lg transition-transform group-hover:scale-110">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <span className="font-headline font-bold text-xl tracking-tight text-primary">
            Aperture<span className="text-foreground">Cloud</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="#products" className="text-sm font-medium hover:text-primary transition-colors">
            Products
          </Link>
          <Link href="#testimonials" className="text-sm font-medium hover:text-primary transition-colors">
            Success Stories
          </Link>
          <Link href="/admin/headlines" className="text-sm font-medium hover:text-primary transition-colors text-muted-foreground italic">
            AI Assistant
          </Link>
          <Button asChild variant="default" className="bg-accent hover:bg-accent/90">
            <Link href="#consultation">Request Consultation</Link>
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-6 h-6" />
        </Button>
      </div>
    </nav>
  );
}
