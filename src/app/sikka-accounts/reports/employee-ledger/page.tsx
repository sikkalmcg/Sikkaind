'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, where, getDocs, Timestamp, limit } from "firebase/firestore";
import { Loader2, Landmark, Search, FileDown, User, Calendar, Calculator, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import * as XLSX from 'xlsx';
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isFuture, startOfDay, differenceInMinutes, isSameDay, isBefore } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function EmployeeLedgerPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const employeesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "employees"), where("status", "==", "Active")) : null, 
    [firestore]
  );
  const { data: employees } = useCollection<any>(employeesQuery);

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    // ERP Restriction: Registry cannot load future temporal nodes
    for (let i = 0; i < 12; i++) {
        const d = subMonths(now, i);
        options.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMM-yyyy').toUpperCase() });
    }
    return options;
  }, []);

  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttendance = useCallback(async () => {
    if (!firestore) return;
    setLoading(true);
    try {
        const [y, m] = selectedMonth.split('-');
        const start = startOfMonth(new Date(Number(y), Number(m) - 1));
        const end = endOfMonth(new Date(Number(y), Number(m) - 1));

        // Registry handshake: Fetch monthly temporal bucket
        const q = query(collection(firestore, "attendanceRecords"), orderBy("inTime", "desc"), limit(1000));
        const snap = await getDocs(q);
        
        const results = snap.docs.map(d => {
            const data = d.data();
            const inT = data.inTime instanceof Timestamp ? data.inTime.toDate() : new Date(data.inTime);
            const outT = data.outTime ? (data.outTime instanceof Timestamp ? data.outTime.toDate() : new Date(data.outTime)) : undefined;
            return { ...data, inTime: inT, outTime: outT };
        }).filter(a => a.inTime >= start && a.inTime <= end);

        setAttendance(results);
    } catch (e) {
        console.error("Ledger Sync Failure:", e);
    } finally {
        setLoading(false);
    }
  }, [firestore, selectedMonth]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const ledgerData = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    const interval = eachDayOfInterval({ 
        start: startOfMonth(new Date(Number(y), Number(m) - 1)), 
        end: endOfMonth(new Date(Number(y), Number(m) - 1)) 
    });

    // BUSINESS RULE: Exclude Sundays from standard working nodes
    const workDaysCount = interval.filter(d => !isSunday(d)).length;

    const empList = selectedEmployeeId === 'all' ? (employees || []) : (employees?.filter((e: any) => e.id === selectedEmployeeId) || []);

    return empList.map((emp: any) => {
        const empLogs = attendance.filter(a => a.employeeId === emp.id);
        
        let fullDays = 0;
        let halfDays = 0;
        let extraDays = 0;

        empLogs.forEach(a => {
            let hours = a.outTime ? differenceInMinutes(a.outTime, a.inTime) / 60 : 0;
            
            /**
             * Registry Rule: IN but no OUT
             * Automatic 16 hour credit for historical open nodes.
             */
            if (!a.outTime && !isSameDay(a.inTime, new Date()) && isBefore(a.inTime, new Date())) {
                hours = 16;
            }

            const isSun = isSunday(a.inTime);
            
            /**
             * Updated Classification Logic:
             * < 2h = Absent
             * 2h - 5h = Half Day
             * >= 5h = Full Day
             */
            if (hours >= 5) {
                if (isSun) extraDays++; else fullDays++;
            } else if (hours >= 2) {
                if (isSun) extraDays += 0.5; else halfDays++;
            }
        });

        // 2-HALF-DAY RULE: System auto-aggregates half-day nodes into single full-day credits
        const adjustedFullDays = fullDays + Math.floor(halfDays / 2);
        const remainingHalfDay = halfDays % 2;

        const totalAttendance = adjustedFullDays + (remainingHalfDay * 0.5);
        const absent = Math.max(0, workDaysCount - totalAttendance);

        return {
            ...emp,
            workDaysCount,
            totalAttendance,
            absent,
            extraDays,
            displayAttendance: `${adjustedFullDays} Days${remainingHalfDay > 0 ? ' + 1 Half Day' : ''}`
        };
    });
  }, [employees, attendance, selectedMonth, selectedEmployeeId]);

  const filtered = useMemo(() => ledgerData.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  ), [ledgerData, searchTerm]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(l => ({
        'Employee': l.name,
        'Month': selectedMonth,
        'Standard Work Days': l.workDaysCount,
        'Attendance Summary': l.displayAttendance,
        'Total Calculated Days': l.totalAttendance,
        'Absent Days': l.absent,
        'Extra Work (Sundays)': l.extraDays
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EmployeeLedger");
    XLSX.writeFile(wb, `ZEMP_Ledger_${selectedMonth}.xlsx`);
  };

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 border-b pb-6">
        <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3"><Landmark className="h-8 w-8" /></div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic leading-none">ZEMP – Employee Ledger</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Financial Payroll Handshake Module</p>
        </div>
      </div>

      <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-8 flex flex-wrap items-end gap-8">
            <div className="grid gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Month Registry *</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="h-12 w-[200px] rounded-xl font-black text-blue-900 shadow-inner border-slate-200">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {monthOptions.map(o => <SelectItem key={o.value} value={o.value} className="font-bold">{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Employee filter</label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="h-12 w-[240px] rounded-xl font-bold border-slate-200 shadow-sm">
                        <SelectValue placeholder="All Personnel" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        <SelectItem value="all">ALL ACTIVE STAFF</SelectItem>
                        {employees?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Global Registry search</label>
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input placeholder="Filter ledger records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-12 w-[320px] rounded-xl font-bold border-slate-200 focus-visible:ring-blue-900" />
                </div>
            </div>
            <div className="ml-auto">
                <Button onClick={handleExport} variant="outline" className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest border-slate-200 text-blue-900 bg-white hover:bg-slate-50 transition-all gap-2 shadow-sm border-none">
                    <FileDown className="h-4 w-4" /> Export Excel
                </Button>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-40">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Synchronizing Ledger node...</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="h-14 border-b border-slate-100">
                                <TableHead className="text-[10px] font-black uppercase px-8">Employee Identity</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Month Node</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Working Days</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center">Attendance Node</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center text-red-600">Absent Node</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-4 text-center text-emerald-600">Extra Work (SUN)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase px-8 text-right">Adjusted Summary</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No activity detected in mission registry.</TableCell></TableRow>
                            ) : (
                                filtered.map(item => (
                                    <TableRow key={item.id} className="h-16 hover:bg-blue-50/20 border-b last:border-0 group transition-colors">
                                        <TableCell className="px-8">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-900 group-hover:text-white transition-all shadow-sm"><User className="h-4 w-4" /></div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 uppercase text-xs tracking-tight">{item.name}</span>
                                                    <span className="text-[9px] font-bold text-slate-400">ID: {item.id.slice(-6).toUpperCase()}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 text-center font-bold text-slate-500 uppercase text-[10px]">{monthOptions.find(o => o.value === selectedMonth)?.label}</TableCell>
                                        <TableCell className="px-4 text-center font-black text-slate-900">{item.workDaysCount} DAYS</TableCell>
                                        <TableCell className="px-4 text-center font-black text-blue-900">{item.totalAttendance} DAYS</TableCell>
                                        <TableCell className="px-4 text-center font-black text-red-600">{item.absent} DAYS</TableCell>
                                        <TableCell className="px-4 text-center font-black text-emerald-600">
                                            <div className="flex flex-col">
                                                <span>{item.extraDays} DAYS</span>
                                                <span className="text-[8px] font-bold uppercase tracking-tighter opacity-60 flex items-center justify-center gap-1"><TrendingUp className="h-2 w-2" /> Sunday Labor</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-8 text-right">
                                            <Badge className="bg-slate-900 text-white font-black uppercase text-[10px] px-4 h-7 border-none shadow-md">
                                                {item.displayAttendance}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
