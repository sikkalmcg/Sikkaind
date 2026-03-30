'use client';
import { useState } from 'react';
import { subDays } from 'date-fns';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { DatePicker } from "@/components/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VehicleEntryReport from '@/components/dashboard/report-analysis/VehicleEntryReport';
import TripsReport from '@/components/dashboard/report-analysis/TripsReport';
import FuelReport from '@/components/dashboard/report-analysis/FuelReport';
import FreightReport from '@/components/dashboard/report-analysis/FreightReport';
import { 
    BarChart3, 
    FileText, 
    IndianRupee, 
    Fuel, 
    Truck, 
    Search, 
    ChevronRight,
    Filter,
    LayoutDashboard
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const CreditCardIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
);

export default function ReportAnalysisPage() {
  const [activeTab, setActiveTab] = useState('vehicle-entry');
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState('');

  const reportCategories = [
    { 
        group: 'Financial Analysis',
        items: [
            { id: 'freight', label: 'Freight Payment Ledger', icon: IndianRupee, component: FreightReport },
            { id: 'fuel-pay', label: 'Fuel Settlement Registry', icon: CreditCardIcon, component: FuelReport },
        ]
    },
    {
        group: 'Fleet & Gate Operations',
        items: [
            { id: 'vehicle-entry', label: 'Gate Movement Registry', icon: Truck, component: VehicleEntryReport },
            { id: 'trips', label: 'Mission Performance Log', icon: FileText, component: TripsReport },
        ]
    }
  ];

  return (
    <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
      {/* ERP HEADER */}
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="p-2 bg-primary text-white rounded-lg shadow-lg rotate-3">
                <BarChart3 className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight uppercase">Registry Analytics</h1>
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
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Registry Search</Label>
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary" />
                    <Input 
                        placeholder="Filter results..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 w-[200px] rounded-xl border-slate-200 shadow-inner text-xs font-bold"
                    />
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden h-[calc(100vh-140px)]">
        {/* LEFT: REPORT CATEGORIES */}
        <aside className="lg:col-span-3 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            {reportCategories.map((group, idx) => (
                <div key={idx} className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-4">{group.group}</h4>
                    <div className="space-y-1">
                        {group.items.map((report) => {
                            const isActive = activeTab === report.id;
                            return (
                                <button
                                    key={report.id}
                                    onClick={() => setActiveTab(report.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 group border text-left",
                                        isActive 
                                            ? "bg-white border-primary shadow-lg shadow-primary/5 text-primary" 
                                            : "bg-transparent border-transparent text-slate-500 hover:bg-white hover:border-slate-200"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            isActive ? "bg-primary text-white" : "bg-white border text-slate-400 group-hover:text-primary"
                                        )}>
                                            <report.icon className="h-4 w-4" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-tight">{report.label}</span>
                                    </div>
                                    <ChevronRight className={cn("h-4 w-4 transition-transform", isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2")} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </aside>

        {/* RIGHT: REPORT VIEWER */}
        <div className="lg:col-span-9 overflow-hidden flex flex-col gap-6">
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden flex-1 flex flex-col">
                <CardHeader className="bg-slate-50 border-b px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg"><LayoutDashboard className="h-4 w-4 text-primary" /></div>
                            <div>
                                <CardTitle className="text-sm font-black uppercase tracking-widest">Active Report Viewer</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Real-time Data Extraction: {activeTab.toUpperCase()}</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase text-[9px] px-3">Sync Status: Optimal</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto">
                    <Tabs value={activeTab} className="w-full h-full">
                        <TabsContent value="vehicle-entry" className="m-0 border-none p-0 focus-visible:ring-0">
                            <VehicleEntryReport fromDate={fromDate} toDate={toDate} searchTerm={searchTerm} />
                        </TabsContent>
                        <TabsContent value="trips" className="m-0 border-none p-0 focus-visible:ring-0">
                            <TripsReport fromDate={fromDate} toDate={toDate} searchTerm={searchTerm} />
                        </TabsContent>
                        <TabsContent value="freight" className="m-0 border-none p-0 focus-visible:ring-0">
                            <FreightReport fromDate={fromDate} toDate={toDate} searchTerm={searchTerm} />
                        </TabsContent>
                        <TabsContent value="fuel-pay" className="m-0 border-none p-0 focus-visible:ring-0">
                            <FuelReport fromDate={fromDate} toDate={toDate} searchTerm={searchTerm} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
      </div>
    </main>
  );
}