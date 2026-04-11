
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Cpu, Database, BrainCircuit } from "lucide-react";

const products = [
  {
    title: "Aperture Compute",
    icon: <Cpu className="w-6 h-6" />,
    description: "Next-gen virtual machines with dedicated resources and instant scaling.",
    price: "$0.045",
    unit: "/vCPU hour",
    features: ["Dedicated Intel/AMD CPUs", "NvMe SSD Storage", "Auto-scaling groups", "Global VPC Peering"],
    color: "primary",
    tag: "Popular"
  },
  {
    title: "Global Storage",
    icon: <Database className="w-6 h-6" />,
    description: "Multi-region object storage with millisecond retrieval and infinite durability.",
    price: "$0.02",
    unit: "/GB month",
    features: ["Strong consistency", "Automatic replication", "Lifecycle policies", "Integrated CDN"],
    color: "accent",
    tag: "Enterprise Choice"
  },
  {
    title: "AI Engine",
    icon: <BrainCircuit className="w-6 h-6" />,
    description: "Fully managed ML platform for training and deploying large-scale models.",
    price: "Custom",
    unit: "Consultation required",
    features: ["NVIDIA H100 Clusters", "Jupyter environments", "Auto-Labeling", "One-click deployment"],
    color: "primary",
    tag: "New"
  }
];

export function Products() {
  return (
    <section id="products" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center space-y-4 mb-16">
          <Badge variant="secondary" className="px-4 py-1 text-primary">Product Suite</Badge>
          <h2 className="text-4xl font-headline font-bold">Cloud Infrastructure, <span className="text-primary">Optimized</span></h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Transparent pricing for enterprise-grade tools. No hidden fees, just pure performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {products.map((product, i) => (
            <Card key={i} className="relative overflow-hidden group hover:shadow-2xl transition-all duration-300 border-muted">
              {product.tag && (
                <div className="absolute top-0 right-0 px-4 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-bl-lg">
                  {product.tag}
                </div>
              )}
              <CardHeader className="space-y-4">
                <div className={`p-3 rounded-xl inline-block ${i === 1 ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                  {product.icon}
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">{product.title}</CardTitle>
                  <CardDescription className="text-sm mt-2">{product.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">{product.price}</span>
                  <span className="text-muted-foreground text-sm font-medium">{product.unit}</span>
                </div>
                <ul className="space-y-3">
                  {product.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-green-600" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant={i === 1 ? "default" : "outline"} className={`w-full h-12 ${i === 1 ? 'bg-accent hover:bg-accent/90 border-accent' : ''}`}>
                  Select Plan
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
