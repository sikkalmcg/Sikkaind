'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
    FileDown, 
    ArrowRightLeft,
    Search,
    ListTree
} from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * @fileOverview Trip Summary Hub.
 * Optimized UI node for visualizing consolidated mission analytics.
 * This version is initialized with an empty registry as per data clearance request.
 */
export default function TripSummaryPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // MISSION DATA NODE: Initialized as empty to satisfy data clearance requirements.
  // This ensures no historical mission data is surfaced in the registry hub.
  const trips: any[] = [];

  const filteredTrips = useMemo(() => {
    if (!searchTerm) return trips;
    const s = searchTerm.toLowerCase();
    return trips.filter(t => 
        Object.values(t).some(val => val?.toString().toLowerCase().includes(s))
    );
  }, [searchTerm]);

  return (
    <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500">
      <div className="sticky top-0 z-30 bg-white border-b px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-lg rotate-3">
                <ArrowRightLeft className="h-7 w-7" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-blue-600 tracking-tight uppercase italic">Trip Summary Hub</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">LMC Registry &gt; Consolidated Analytics</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <Input 
                placeholder="Search registry..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 w-[320px] h-11 rounded-2xl bg-slate-50 border-slate-200 shadow-inner font-bold focus-visible:ring-blue-600"
            />
          </div>
          <Button variant="outline" className="h-11 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
            <FileDown className="h-4 w-4 mr-2" /> Export Ledger
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border shadow-sm"><ListTree className="h-5 w-5 text-blue-600" /></div>
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700">Mission Registry Analytics</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Deep-registry extraction of all completed and active nodes</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className="w-full min-w-[1200px]">
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="h-14 hover:bg-transparent border-b">
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Plant</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Trip ID</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">LR Number</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Consignor</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">From</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Consignee</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Ship To</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTrips.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">
                                        Registry node is empty. No mission data detected.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTrips.map((trip) => (
                                    <TableRow key={trip.id} className="h-16 hover:bg-blue-50/20 transition-colors border-b border-slate-50 last:border-0 group">
                                        <TableCell className="px-8 font-black text-slate-600 uppercase text-xs">{trip.plant}</TableCell>
                                        <TableCell className="px-4 font-black text-blue-700 font-mono tracking-tighter text-xs uppercase">{trip.tripId}</TableCell>
                                        <TableCell className="px-4 font-black text-slate-900 uppercase text-xs">{trip.lrNumber}</TableCell>
                                        <TableCell className="px-4 text-center text-[11px] font-bold text-slate-500 font-mono">{trip.date}</TableCell>
                                        <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[150px]">{trip.consignor}</TableCell>
                                        <TableCell className="px-4 text-[11px] font-medium text-slate-500 uppercase italic truncate max-w-[120px]">{trip.from}</TableCell>
                                        <TableCell className="px-4 font-bold text-slate-700 uppercase text-xs truncate max-w-[150px]">{trip.consignee}</TableCell>
                                        <TableCell className="px-8 font-bold text-slate-700 uppercase text-xs truncate max-w-[200px]">{trip.shipTo}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
