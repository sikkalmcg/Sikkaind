'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardCheck, History } from 'lucide-react';

export default function GateRegister({ plants }: { plants: any[] }) {
  return (
    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b p-8">
        <div className="flex items-center gap-4">
            <ClipboardCheck className="h-8 w-8 text-blue-900" />
            <div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tight text-blue-900">Gate History Ledger</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Historical Movement Audit Node</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-20 text-center space-y-4 opacity-30 grayscale">
        <History className="h-16 w-16 mx-auto" />
        <p className="text-sm font-black uppercase tracking-[0.4em]">Audit Trail Syncing...</p>
      </CardContent>
    </Card>
  );
}
