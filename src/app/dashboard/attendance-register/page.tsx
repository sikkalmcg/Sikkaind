'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, orderBy, Timestamp, where, deleteDoc } from "firebase/firestore";
import { Loader2, UserCheck, Search, FileDown, Edit2, Clock, History, Trash2, AlertCircle, ShieldAlert, Save, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import * as XLSX from 'xlsx';
import { format, differenceInMinutes, subDays, startOfDay, endOfDay, isSameDay, isBefore, eachDayOfInterval, isValid, isAfter } from 'date-fns';
import { cn, normalizePlantId } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/date-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const formSchema = z.object({
  plantId: z.string().min(1, 'Plant node selection is required.'),
  employeeId: z.string().min(1, 'Employee identification is mandatory.'),
  timestamp: z.date({ required_error: 'Date and Time required.' }),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Registry Logic Node: Attendance Classification
 * Updated Rules: 
 * < 2h = Absent
 * 2h - 5h = Half Day
 * >= 5h = Full Day
 */
const calculateAttendanceType = (hours: number) => {
    if (hours < 2) return 'Absent';
    if (hours < 5) return 'Half Day';
    return 'Full Day';
};

export default function AttendanceRegisterPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setTodayDate] = useState<Date>();
  const [activeEntry, setActiveEntry] = useState<any | null>(null);
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);

  // Initialize dates after hydration to prevent Internal Server Error
  useEffect(() => {
    setFromDate(startOfDay(subDays(new Date(), 7)));
    setTodayDate(endOfDay(new Date()));
  }, []);

  const isAdmin = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  const employeesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "employees"), where("status", "==", "Active")) : null, 
    [firestore]
  );
  const { data: employees } = useCollection<any>(employeesQuery);

  const plantsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "logistics_plants")) : null, 
    [firestore]
  );
  const { data: plants } = useCollection<any>(plantsQuery);

  const attendanceQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, "attendanceRecords"), orderBy("inTime", "desc")) : null, 
    [firestore]
  );
  const { data: attendance, isLoading } = useCollection<any>(attendanceQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      plantId: '',
      employeeId: '',
      timestamp: new Date() 
    }
  });

  const selectedEmployeeId = form.watch('employeeId');

  useEffect(() => {
    if (selectedEmployeeId && attendance) {
        const openRecord = attendance.find(a => a.employeeId === selectedEmployeeId && !a.outTime);
        if (openRecord) {
            const inT = openRecord.inTime instanceof Timestamp ? openRecord.inTime.toDate() : new Date(openRecord.inTime);
            setActiveEntry({ ...openRecord, inTime: inT });
            form.setValue('plantId', openRecord.plantId);
        } else {
            setActiveEntry(null);
        }
    } else {
        setActiveEntry(null);
    }
  }, [selectedEmployeeId, attendance, form]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore) return;
    const emp = employees?.find(e => e.id === values.employeeId);
    const combinedName = emp ? `${emp.name} S/o ${emp.fatherName}` : 'Unknown Node';
    
    try {
      if (activeEntry) {
        const inT = activeEntry.inTime;
        const outT = values.timestamp;
        const hours = Number((differenceInMinutes(outT, inT) / 60).toFixed(2));
        const type = calculateAttendanceType(hours);

        await updateDoc(doc(firestore, "attendanceRecords", activeEntry.id), {
            outTime: outT,
            attendanceType: type,
            workingHours: hours,
            lastUpdated: serverTimestamp(),
        });
        toast({ title: 'Registry Handshake Closed', description: `OUT marked for ${combinedName}. Hours: ${hours} (${type})` });
      } else {
        await addDoc(collection(firestore, "attendanceRecords"), {
            plantId: values.plantId,
            employeeId: values.employeeId,
            employeeName: combinedName,
            inTime: values.timestamp,
            date: format(values.timestamp, 'yyyy-MM-dd'),
            createdAt: serverTimestamp(),
        });
        toast({ title: 'Registry Synchronized', description: `IN marked for ${combinedName}.` });
      }
      
      form.reset({ 
        plantId: '',
        employeeId: '',
        timestamp: new Date() 
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Registry Error', description: error.message });
    }
  };

  const handleRemove = async (id: string) => {
    if (!firestore || !isAdmin) return;
    try {
        await deleteDoc(doc(firestore, "attendanceRecords", id));
        toast({ title: 'Node Purged', description: 'Registry entry permanently removed.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Purge Failed', description: e.message });
    }
  };

  const enrichedData = useMemo(() => {
    if (!employees || !attendance || !fromDate || !toDate) return [];

    const start = fromDate;
    const end = toDate;
    
    const today = new Date();
    const effectiveEnd = isAfter(end, today) ? endOfDay(today) : end;
    
    if (!isValid(start) || !isValid(effectiveEnd)) return [];

    const dateRange = eachDayOfInterval({ start, end: effectiveEnd });
    const results: any[] = [];

    dateRange.reverse().forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        
        employees.forEach(emp => {
            const combinedName = `${emp.name} S/o ${emp.fatherName}`;
            const dayRecords = attendance.filter(a => a.employeeId === emp.id && a.date === dateStr);

            if (dayRecords.length > 0) {
                dayRecords.forEach(a => {
                    const inT = a.inTime instanceof Timestamp ? a.inTime.toDate() : new Date(a.inTime);
                    let outT = a.outTime ? (a.outTime instanceof Timestamp ? a.outTime.toDate() : new Date(a.outTime)) : undefined;
                    
                    let hours = outT ? Number((differenceInMinutes(outT, inT) / 60).toFixed(2)) : 0;
                    let type = outT ? calculateAttendanceType(hours) : 'IN (Active)';

                    if (!outT && !isSameDay(inT, new Date()) && isBefore(inT, new Date())) {
                        hours = 16;
                        type = 'Full Day (Auto-16h)';
                    }

                    const plantName = plants?.find(p => normalizePlantId(p.id) === normalizePlantId(a.plantId))?.name || a.plantId;

                    results.push({ 
                        ...a, 
                        inTime: inT, 
                        outTime: outT, 
                        hours, 
                        type, 
                        plantName,
                        employeeName: combinedName,
                        sortDate: inT,
                        isVirtual: false
                    });
                });
            } else {
                results.push({
                    id: `virtual-absent-${emp.id}-${dateStr}`,
                    employeeId: emp.id,
                    employeeName: combinedName,
                    plantName: '', 
                    inTime: null,
                    outTime: null,
                    hours: null,
                    type: 'Absent',
                    date: dateStr,
                    isVirtual: true,
                    sortDate: day
                });
            }
        });
    });

    return results.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
  }, [attendance, plants, employees, fromDate, toDate]);

  const filtered = useMemo(() => enrichedData.filter(a => 
    a.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.plantName?.toLowerCase().includes(searchTerm.toLowerCase())
  ), [enrichedData, searchTerm]);

  const handleExport = () => {
    const dataToExport = filtered.map(a => ({
      'Date': a.date,
      'Plant': a.plantName || '',
      'Employee': a.employeeName,
      'In Time': a.inTime ? format(a.inTime, 'dd-MM-yyyy HH:mm') : '',
      'Out Time': a.outTime ? format(a.outTime, 'dd-MM-yyyy HH:mm') : '',
      'Hours': a.hours !== null ? a.hours : '',
      'Type': a.type
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AttendanceRegistry");
    XLSX.writeFile(wb, `Attendance_Manifest_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 space-y-10 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
                <UserCheck className="h-8 w-8" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Personnel Attendance HUB</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Workforce Presence Registry Node</p>
            </div>
        </div>
      </div>

      <div className="space-y-10">
            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3"><UserCheck className="h-5 w-5" /></div>
                    <div>
                    <CardTitle className="text-xl font-black uppercase text-blue-900 italic">Mark Presence</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Personnel Presence Handshake terminal</CardDescription>
                    </div>
                </div>
                </CardHeader>
                <CardContent className="p-10">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <FormField name="employeeId" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Employee Entity *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger className="h-11 font-bold border-slate-200">
                                <SelectValue placeholder="Select Employee" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl">
                                {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.name} S/o {e.fatherName}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        </FormItem>
                        )} />
                        <FormField name="plantId" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Entry Plant *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!!activeEntry}>
                            <FormControl><SelectTrigger className="h-11 bg-white font-bold border-slate-200 shadow-sm focus:ring-blue-900"><SelectValue placeholder="Select node" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">
                                {plants?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        </FormItem>
                        )} />
                        <FormField name="timestamp" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className={cn("text-[10px] font-black uppercase tracking-widest", activeEntry ? "text-orange-600" : "text-blue-600")}>
                                {activeEntry ? 'Out-Date/TIME' : 'IN-Date/TIME'} *
                            </FormLabel>
                            <FormControl><Input type="datetime-local" value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ''} onChange={(e) => field.onChange(new Date(e.target.value))} className="h-11 font-black text-blue-900 border-blue-900/20" /></FormControl>
                        </FormItem>
                        )} />
                        <div className="flex items-end gap-2 pb-0.5">
                            <Button type="button" onClick={() => form.setValue('timestamp', new Date())} variant="outline" className="h-11 px-4 gap-2 font-black uppercase text-[9px] tracking-widest border-blue-200 text-blue-700 bg-blue-50/50 shadow-sm">
                                <Clock className="h-3 w-3" /> Sync Now
                            </Button>
                        </div>
                    </div>

                    {activeEntry && (
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                            <p className="text-xs font-bold text-orange-800 uppercase tracking-tight">
                                Active Entry Detected: Marking OUT for IN node registered at {format(activeEntry.inTime, 'dd/MM/yy HH:mm')}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 justify-end pt-4 border-t">
                        <Button type="submit" disabled={form.formState.isSubmitting} className={cn("px-12 h-11 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl border-none transition-all active:scale-95", activeEntry ? "bg-orange-600 hover:bg-slate-900 shadow-orange-100" : "bg-blue-900 hover:bg-slate-900 shadow-blue-100")}>
                        {form.formState.isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                        {activeEntry ? 'Close Registry (OUT)' : 'Initialize Node (IN)'}
                        </Button>
                    </div>
                    </form>
                </Form>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border shadow-sm"><History className="h-5 w-5 text-blue-900" /></div>
                    <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight text-blue-900 italic">Daily Presence Ledger</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live operational workforce manifest</CardDescription>
                    </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                    <div className="grid gap-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Registry Range</Label>
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                            <DatePicker date={fromDate} setDate={setFromDate} className="border-none h-8" />
                            <span className="text-slate-300 px-1">to</span>
                            <DatePicker date={toDate} setDate={setTodayDate} className="border-none h-8" />
                        </div>
                    </div>
                    <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-900 transition-colors" />
                    <Input placeholder="Filter records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-[240px] h-10 rounded-xl bg-white border-slate-200 shadow-sm font-bold" />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExport} className="h-10 px-6 gap-2 font-black text-[11px] uppercase border-slate-200 text-blue-900 bg-white shadow-sm hover:bg-slate-50 transition-all">
                    <FileDown className="h-4 w-4" /> Export Excel
                    </Button>
                </div>
                </CardHeader>
                <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="h-14 hover:bg-transparent border-b">
                        <TableHead className="text-[10px] font-black uppercase px-8 text-slate-400">Entry Plant</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-slate-400">Full Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">IN Registry</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">OUT Registry</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-right text-slate-400">Hours</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-4 text-center text-slate-400">Type</TableHead>
                        <TableHead className="text-[10px] font-black uppercase px-8 text-right text-slate-400">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                        <TableRow><TableCell colSpan={7} className="text-center h-48"><Loader2 className="animate-spin inline-block h-8 w-8 text-blue-900" /></TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="h-48 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-40">No records matching registry scope.</TableCell></TableRow>
                        ) : (
                        filtered.map((a) => (
                            <TableRow key={a.id} className={cn("h-16 hover:bg-blue-50/30 transition-colors border-b last:border-0 group", a.isVirtual && "bg-slate-50/30")}>
                            <TableCell className="px-8 font-black text-slate-600 uppercase text-xs tracking-tight">{a.plantName}</TableCell>
                            <TableCell className="px-4 font-black text-slate-900 uppercase text-xs">{a.employeeName}</TableCell>
                            <TableCell className="px-4 text-center font-mono font-bold text-blue-700">{a.inTime ? format(a.inTime, 'dd/MM/yy HH:mm') : ''}</TableCell>
                            <TableCell className="px-4 text-center font-mono font-bold text-slate-500">{a.outTime ? format(a.outTime, 'dd/MM/yy HH:mm') : ''}</TableCell>
                            <TableCell className="px-4 text-right font-black text-slate-900">{a.hours !== null ? a.hours : ''}</TableCell>
                            <TableCell className="px-4 text-center">
                                <Badge className={cn(
                                    "font-black uppercase text-[9px] px-3 border-none shadow-sm", 
                                    a.type.includes('Full Day') ? 'bg-emerald-600 text-white' : (a.type === 'Half Day' ? 'bg-orange-50 text-orange-700' : 'bg-red-600 text-white')
                                )}>
                                    {a.type}
                                </Badge>
                            </TableCell>
                            <TableCell className="px-8 text-right">
                                {isAdmin && !a.isVirtual && (
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50" onClick={() => setEditingAttendance(a)}><Edit2 className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="border-none shadow-3xl p-0 overflow-hidden bg-white rounded-3xl">
                                                <AlertDialogHeader className="p-8 bg-red-50 border-b border-red-100 flex flex-row items-center gap-5 space-y-0">
                                                    <div className="bg-red-600 p-3 rounded-2xl shadow-xl">
                                                        <ShieldAlert className="h-8 w-8 text-white" />
                                                    </div>
                                                    <div className="text-left">
                                                        <AlertDialogTitle className="text-xl font-black text-red-900 uppercase tracking-tight leading-none">Security Registry Purge</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-red-700 font-bold uppercase text-[9px] mt-2 tracking-widest">Authorized Deletion Handshake Required</AlertDialogDescription>
                                                    </div>
                                                </AlertDialogHeader>
                                                <div className="p-10 space-y-6">
                                                    <p className="text-sm font-medium text-slate-600 leading-relaxed italic">"You are about to permanently erase the attendance record for **{a.employeeName}** from the mission database."</p>
                                                    <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4 shadow-sm">
                                                        <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                                                        <p className="text-[10px] font-bold text-amber-800 leading-normal uppercase">
                                                            This action is logged in the system audit registry and cannot be reversed by mission control.
                                                        </p>
                                                    </div>
                                                </div>
                                                <AlertDialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                                                    <AlertDialogCancel className="font-bold border-slate-200 rounded-xl px-8 h-11 m-0">Abort</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRemove(a.id)} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest shadow-xl border-none transition-all active:scale-95">Confirm Purge</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                )}
                            </TableCell>
                            </TableRow>
                        ))
                        )}
                    </TableBody>
                    </Table>
                </div>
                </CardContent>
            </Card>
      </div>

      {editingAttendance && (
          <Dialog open={!!editingAttendance} onOpenChange={() => setEditingAttendance(null)}>
              <DialogContent className="max-w-md border-none shadow-3xl p-0 overflow-hidden bg-white rounded-3xl">
                  <DialogHeader className="p-6 bg-slate-900 text-white">
                      <DialogTitle className="text-xl font-black uppercase italic tracking-tight">Manual Node Correction</DialogTitle>
                      <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] mt-1">Registry Ref: {editingAttendance.employeeName}</DialogDescription>
                  </DialogHeader>
                  <div className="p-8 space-y-6">
                      <div className="grid gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-1">IN-Date/TIME Registry</label>
                            <Input type="datetime-local" value={format(editingAttendance.inTime, "yyyy-MM-dd'T'HH:mm")} onChange={e => setEditingAttendance({...editingAttendance, inTime: new Date(e.target.value)})} className="h-12 rounded-xl font-black text-blue-900 shadow-inner" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-1">Out-Date/TIME Registry</label>
                            <Input type="datetime-local" value={editingAttendance.outTime ? format(editingAttendance.outTime, "yyyy-MM-dd'T'HH:mm") : ""} onChange={e => setEditingAttendance({...editingAttendance, outTime: new Date(e.target.value)})} className="h-12 rounded-xl font-black text-blue-900 shadow-inner" />
                          </div>
                      </div>
                  </div>
                  <DialogFooter className="p-6 bg-slate-50 border-t flex-row justify-end gap-3">
                      <Button variant="ghost" onClick={() => setEditingAttendance(null)} className="font-bold text-slate-400">Discard</Button>
                      <Button onClick={async () => {
                          const inT = editingAttendance.inTime;
                          const outT = editingAttendance.outTime;
                          const hours = outT ? Number((differenceInMinutes(outT, inT) / 60).toFixed(2)) : 0;
                          const type = calculateAttendanceType(hours);
                          
                          await updateDoc(doc(firestore!, "attendanceRecords", editingAttendance.id), {
                              inTime: inT,
                              outTime: outT || null,
                              attendanceType: type,
                              workingHours: hours,
                              lastUpdated: serverTimestamp()
                          });
                          toast({ title: 'Success', description: 'Node corrected.' });
                          setEditingAttendance(null);
                      }} className="bg-blue-900 hover:bg-slate-900 text-white font-black uppercase text-[10px] h-11 px-10 rounded-xl shadow-lg border-none">Save Correction</Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      )}
    </div>
  );
}