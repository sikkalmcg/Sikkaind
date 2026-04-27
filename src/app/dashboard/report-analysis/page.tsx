'use client';
import { useState, useMemo } from 'react';
import { subDays } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VehicleEntryReport from '@/components/dashboard/report-analysis/VehicleEntryReport';
import TripsReport from '@/components/dashboard/report-analysis/TripsReport';
import FreightReport from '@/components/dashboard/report-analysis/FreightReport';
import { 
    BarChart3, 
    FileText, 
    IndianRupee, 
    Truck, 
    Search, 
    ChevronRight,
    Filter,
    LayoutDashboard,
    ClipboardCheck,
    Navigation,
    ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview Registry Analytics Control Node.
 * UI OVERHAUL: Navigation moved to TOP CENTER for maximized ledger visibility.
 * Hardened: Strict plant isolation pulses active across all sub-terminals.
 */
export default function ReportAnalysisPage() {
  const [activeTab, setActiveTab] = useState('freight');
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState('');

  const reportCategories = [
    { id: 'freight', label: 'Freight Payment Ledger', icon: IndianRupee },
    { id: 'vehicle-entry', label: 'Gate Movement Registry', icon: Truck },
    { id: 'trips', label: 'Mission Performance Log', icon: FileText },
  ];

  return (
    <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500 overflow-hidden">
      {/* ERP HEADER */}
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3">
                <BarChart3 className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight uppercase">Registry Analytics</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Analytics {'&'} Performance {'&'} Audit</p>
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
            <div className="grid gap-1.5">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Period From</Label>
                <DatePicker date={fromDate} setDate={setFromDate} className="h-9 rounded-xl border-slate-200 shadow-sm" />
            </div>
            <div className="grid gap-1.5">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Period To</Label>
                <DatePicker date={toDate} setDate={setToDate} className="h-9 rounded-xl border-slate-200 shadow-sm" />
            </div>
            <div className="grid gap-1.5">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Global Search</Label>
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input 
                        placeholder="ID, Vehicle, Party..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 w-[200px] rounded-xl border-slate-200 shadow-inner text-xs font-bold"
                    />
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP CENTER NAVIGATION TERMINAL */}
        <div className="bg-slate-50 border-b p-4 flex justify-center shrink-0">
            <div className="bg-white p-1 rounded-2xl border-2 border-slate-200 shadow-inner flex items-center gap-2">
                {reportCategories.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                                "flex items-center gap-3 px-6 py-2.5 rounded-xl transition-all duration-300 font-black uppercase text-[10px] tracking-widest",
                                isActive 
                                    ? "bg-blue-900 text-white shadow-xl scale-105" 
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            <item.icon className={cn("h-4 w-4", isActive ? "text-blue-400" : "text-slate-300")} />
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>

        {/* REPORT VIEWER CONTENT */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-[1600px] mx-auto space-y-6">
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg"><LayoutDashboard className="h-4 w-4 text-blue-900" /></div>
                        <div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">Active Node extraction</h2>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Handshake Status: Optimal Pulse</p>
                        </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-black uppercase text-[9px] px-4 py-1 border-none shadow-md">
                        <ShieldCheck className="h-3 w-3 mr-2" /> Authorized Data Scope
                    </Badge>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {activeTab === 'freight' && (
                        <FreightReport fromDate={fromDate} toDate={toDate} searchTerm={searchTerm} />
                    )}
                    {activeTab === 'vehicle-entry' && (
                        <VehicleEntryReport fromDate={fromDate} toDate={toDate} searchTerm={searchTerm} />
                    )}
                    {activeTab === 'trips' && (
                        <TripsReport fromDate={fromDate} toDate={toDate} searchTerm={searchTerm} />
                    )}
                </div>
            </div>
        </div>
      </div>
    </main>
  );
}
