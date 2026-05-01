
"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Truck, 
  MapPin, 
  Phone, 
  ChevronRight, 
  Navigation,
  RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const activeShipments = [
  { id: "CF-1001", from: "LA Port", to: "Chicago Hub", status: "En Route", progress: 65, driver: "Alex Rivera" },
  { id: "CF-1002", from: "NYC Terminal", to: "Miami Center", status: "Starting", progress: 12, driver: "Sarah Smith" },
  { id: "CF-1003", from: "Seattle Dock", to: "Denver Base", status: "Near Destination", progress: 92, driver: "Mike Johnson" },
];

export default function LiveTracking() {
  return (
    <AppShell>
      <div className="space-y-6 h-full flex flex-col">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-headline font-bold tracking-tight">Live Shipment Tracking</h1>
            <p className="text-muted-foreground">Monitor your active fleet and real-time cargo status.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-4 flex-1">
          <Card className="lg:col-span-1 overflow-auto max-h-[calc(100vh-250px)]">
            <CardHeader className="sticky top-0 bg-card z-10 border-b">
              <CardTitle className="text-lg">Active Assets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {activeShipments.map((shipment) => (
                  <div 
                    key={shipment.id} 
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors space-y-3 group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-primary">{shipment.id}</div>
                      <Badge variant={shipment.progress > 80 ? "secondary" : "default"} className="text-[10px]">
                        {shipment.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent" />
                        <span className="truncate">{shipment.from}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="truncate font-medium">{shipment.to}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{shipment.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent transition-all duration-1000" 
                          style={{ width: `${shipment.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                       <span className="text-xs text-muted-foreground italic">Driver: {shipment.driver}</span>
                       <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent translate-x-0 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 h-[calc(100vh-250px)] relative overflow-hidden bg-[#e5e7eb]">
            <div className="absolute inset-0 opacity-40" 
              style={{
                backgroundImage: 'radial-gradient(#522999 0.5px, transparent 0.5px)',
                backgroundSize: '24px 24px'
              }}
            />
            {/* Mock Map UI */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-full h-full max-w-4xl max-h-[600px] flex items-center justify-center">
                {/* Simulated Roads/Routes */}
                <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 1000 600">
                  <path d="M100,300 Q400,100 900,500" fill="none" stroke="#522999" strokeWidth="4" strokeDasharray="10,5" />
                  <path d="M200,500 Q500,300 800,100" fill="none" stroke="#522999" strokeWidth="4" strokeDasharray="10,5" />
                </svg>

                {/* Truck Marker 1 */}
                <div className="absolute top-[35%] left-[45%] pointer-events-auto group">
                   <div className="relative">
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded shadow-lg border text-xs font-bold whitespace-nowrap hidden group-hover:block z-20">
                        CF-1001: En Route to Chicago
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-xl animate-bounce">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/20 rounded-full blur-sm" />
                   </div>
                </div>

                {/* Truck Marker 2 */}
                <div className="absolute top-[65%] left-[20%] pointer-events-auto group">
                   <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground shadow-xl">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/20 rounded-full blur-sm" />
                   </div>
                </div>

                {/* Origin Marker */}
                <div className="absolute top-[25%] left-[10%]">
                   <div className="w-6 h-6 rounded-full border-4 border-white bg-green-500 shadow-md" />
                </div>
                {/* Dest Marker */}
                <div className="absolute top-[80%] left-[85%]">
                   <div className="w-6 h-6 rounded-full border-4 border-white bg-red-500 shadow-md" />
                </div>
              </div>
            </div>

            <div className="absolute bottom-6 right-6 flex flex-col gap-2">
               <Button size="icon" className="rounded-full shadow-lg">
                  <Navigation className="w-5 h-5" />
               </Button>
               <Button variant="secondary" size="icon" className="rounded-full shadow-lg">
                  <Phone className="w-5 h-5" />
               </Button>
            </div>

            <div className="absolute top-6 left-6 z-10 max-w-xs">
              <Card className="shadow-2xl border-accent/20">
                <CardHeader className="p-4">
                  <CardTitle className="text-sm font-bold">Selected Asset Details</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                   <div className="flex gap-4">
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                         <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                         <p className="text-xs font-medium text-muted-foreground">Shipment ID</p>
                         <p className="font-bold">CF-1001</p>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                         <p className="text-muted-foreground">Speed</p>
                         <p className="font-bold">65 mph</p>
                      </div>
                      <div>
                         <p className="text-muted-foreground">ETA</p>
                         <p className="font-bold">2.5 Hours</p>
                      </div>
                   </div>
                </CardContent>
              </Card>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
