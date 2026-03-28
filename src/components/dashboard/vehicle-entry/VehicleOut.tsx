'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Truck, ShieldCheck } from 'lucide-react';

export default function VehicleOut() {
  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardHeader className="bg-slate-900 text-white p-8">
        <div className="flex items-center gap-4">
            <Truck className="h-8 w-8" />
            <div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight">Out-Gate Registry</CardTitle>
                <CardDescription className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mt-1">Finalize Departure & Sync Mission</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-20 text-center space-y-4 opacity-30 grayscale">
        <ShieldCheck className="h-16 w-16 mx-auto" />
        <p className="text-sm font-black uppercase tracking-[0.4em]">Establish departure node logic</p>
      </CardContent>
    </Card>
  );
}
