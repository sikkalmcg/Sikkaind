'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Radar } from 'lucide-react';

export default function UpcomingVehicles({ onVehicleInClick }: { onVehicleInClick: (trip: any) => void }) {
  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b p-8">
        <div className="flex items-center gap-4">
            <Clock className="h-8 w-8 text-blue-900" />
            <div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-blue-900">Upcoming Missions</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Awaiting Yard Arrival Signals</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-20 text-center space-y-4 opacity-30 grayscale">
        <Radar className="h-16 w-16 mx-auto" />
        <p className="text-sm font-black uppercase tracking-[0.4em]">Scanning Mission Registry...</p>
      </CardContent>
    </Card>
  );
}
