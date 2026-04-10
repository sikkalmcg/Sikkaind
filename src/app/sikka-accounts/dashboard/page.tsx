'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    IndianRupee, 
    Landmark, 
    ArrowUpRight, 
    ArrowDownRight, 
    History, 
    ShieldCheck, 
    PieChart,
    ArrowRightLeft,
    TrendingUp,
    FileText,
    Loader2,
    CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

/**
 * @fileOverview Sikka Accounts Dashboard.
 * Primary financial registry overview terminal.
 */
export default function AccountsDashboard() {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    const kpiNodes = [
        { label: 'Total Registry Revenue', value: '₹ 0.00', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Outstanding Liabilities', value: '₹ 0.00', icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Settled Payments', value: '₹ 0.00', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Pending Audits', value: '0 Nodes', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
    ];

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50 flex-col gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 animate-pulse">Syncing Financial Registry...</p>
            </div>
        );
    }

    return (
        <main className="flex flex-1 flex-col h-full bg-[#f8fafc] p-8 space-y-10 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
                <div className="flex items-center gap-5">
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl rotate-3">
                        <Landmark className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic leading-none">Accounts Hub Dashboard</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-2">Financial Registry & Liquidation Node</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Badge className="bg-emerald-600 text-white font-black uppercase text-[10px] px-6 h-10 border-none shadow-lg">Secure Ledger Sync: OK</Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {kpiNodes.map((node, i) => (
                    <Card key={i} className="border-none shadow-xl rounded-[2rem] bg-white group transition-all hover:scale-105">
                        <CardContent className="p-8 flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{node.label}</p>
                                <h2 className={cn("text-3xl font-black tracking-tighter", node.color)}>{node.value}</h2>
                            </div>
                            <div className={cn("p-3 rounded-2xl shadow-inner", node.bg, node.color)}>
                                <node.icon className="h-6 w-6" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <Card className="lg:col-span-8 border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden flex flex-col h-[500px]">
                    <CardHeader className="p-8 bg-slate-50 border-b flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <History className="h-5 w-5 text-blue-900" />
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Recent Liquidation Pulse</CardTitle>
                        </div>
                        <Badge variant="outline" className="font-black text-[9px] uppercase border-slate-200">View Master Ledger</Badge>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                        <div className="p-6 bg-slate-50 rounded-full mb-4"><PieChart size={48} className="text-slate-300" /></div>
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-400">No recent transactions detected</p>
                        <p className="text-[10px] font-medium text-slate-300 mt-1">LMC Registry node is currently waiting for sync pulse.</p>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4 border-none shadow-2xl rounded-[3rem] bg-slate-900 text-white overflow-hidden p-10 relative group">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 transition-transform duration-1000 group-hover:scale-110">
                        <IndianRupee size={240} />
                    </div>
                    <div className="relative z-10 space-y-10 h-full flex flex-col">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black uppercase italic tracking-tight text-blue-400">Registry Snapshot</h3>
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.3em]">Authorized Financial handbook</p>
                        </div>
                        <Separator className="bg-white/10" />
                        <div className="space-y-8 flex-1">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowRightLeft className="text-blue-400 h-5 w-5" /></div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase text-slate-500">Mission Type</p>
                                    <p className="text-xs font-bold uppercase">Consolidated Freight Node</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ShieldCheck className="text-emerald-400 h-5 w-5" /></div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase text-slate-500">Audit Status</p>
                                    <p className="text-xs font-bold uppercase">Verified Registry Active</p>
                                </div>
                            </div>
                        </div>
                        <Button variant="outline" className="w-full h-14 border-white/20 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all active:scale-95">
                            Extract Audit Manifest
                        </Button>
                    </div>
                </Card>
            </div>
        </main>
    );
}
