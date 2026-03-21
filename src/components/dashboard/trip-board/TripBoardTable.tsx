'use client';
import { useState, useMemo, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { 
    ArrowUpDown, 
    MoreVertical, 
    Eye, 
    Ban, 
    RotateCcw, 
    AlertTriangle, 
    ExternalLink, 
    Edit2, 
    FileText, 
    Lock, 
    Radar, 
    Truck, 
    MapPin, 
    ShieldCheck,
    FileUp,
    CheckCircle2
} from 'lucide-react';
import { TRIP_BOARD_COLUMNS } from './TripBoardLayoutModal';
import Pagination from '@/components/dashboard/vehicle-management/Pagination';
import { cn, normalizePlantId } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useUser, useAuth, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';

const ITEMS_PER_PAGE = 10;

interface TripBoardTableProps {
  data: any[];
  activeTab: string;
  canVerifyPod?: boolean;
  onVerifyPod?: (trip: any) => void;
  onUploadPod?: (trip: any) => void;
  onGenerateLR?: (trip: any) => void;
  onViewLR?: (trip: any) => void;
  onViewTrip?: (trip: any) => void;
  onUpdatePod?: (trip: any) => void;
  onCancelTrip?: (trip: any) => void;
  onEditTrip?: (trip: any) => void;
  onTrack?: (trip: any) => void;
  onEditVehicle?: (trip: any) => void;
}

const getTripStatusColor = (status: string) => {
    const s = status?.toLowerCase().replace(/[\s_-]+/g, '-') || '';
    switch(s) {
        case 'available': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'assigned':
        case 'vehicle-assigned': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'loaded':
        case 'loading-complete': return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'in-transit': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'arrival-for-delivery':
        case 'arrived': return 'bg-teal-50 text-teal-700 border-teal-200';
        case 'delivered':
        case 'closed': return 'bg-slate-900 text-white border-transparent';
        default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
};

const getPodStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    switch(s) {
        case 'missing':
        case 'pending': return 'bg-red-50 text-red-600 border-red-100';
        case 'receipt soft copy':
        case 'uploaded':
        case 'unverified': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'receipt hard copy':
        case 'verified': return 'bg-emerald-600 text-white border-transparent shadow-sm shadow-emerald-200';
        default: return 'bg-slate-100 text-slate-400 border-slate-200';
    }
};

export default function TripBoardTable({ 
    data, 
    activeTab, 
    canVerifyPod,
    onVerifyPod,
    onUploadPod, 
    onGenerateLR, 
    onViewLR, 
    onViewTrip, 
    onUpdatePod,
    onCancelTrip,
    onEditTrip,
    onEditVehicle
}: TripBoardTableProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [displayedColumns, setDisplayedColumns] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [gpsMaster, setGpsMaster] = useState<Record<string, boolean>>({});

  const isAdminSession = user?.email === 'sikkaind.admin@sikka.com' || user?.email === 'sikkalmcg@gmail.com';

  useEffect(() => {
    const saved = localStorage.getItem(`trip_board_layout_${activeTab}`);
    if (saved) {
      const ids = JSON.parse(saved) as string[];
      setDisplayedColumns(ids.map(id => TRIP_BOARD_COLUMNS.find(c => c.id === id)).filter(Boolean).filter(c => c.id !== 'freightStatus'));
    } else {
      setDisplayedColumns(TRIP_BOARD_COLUMNS.filter(c => c.id !== 'freightStatus'));
    }
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (!firestore) return;
    const fetchGpsStatus = async () => {
        const q = query(collection(firestore, "vehicles"), where("gps_enabled", "==", true));
        const snap = await getDocs(q);
        const map: Record<string, boolean> = {};
        snap.docs.forEach(d => { map[d.data().vehicleNumber] = true; });
        setGpsMaster(map);
    };
    fetchGpsStatus();
  }, [firestore]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    let items = [...data];
    if (sortConfig) {
      items.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [data, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedData = sortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const formatValue = (key: string, value: any) => {
    if (value === undefined || value === null || value === '') return '--';
    if (key.toLowerCase().includes('date')) {
      try {
        const d = value instanceof Timestamp ? value.toDate() : new Date(value);
        if (!isValid(d)) return '--';
        return format(d, key.toLowerCase().includes('create') ? 'dd/MM/yy HH:mm' : 'dd/MM/yy');
      } catch (e) {
        return '--';
      }
    }
    if (typeof value === 'number') return value.toFixed(3);
    return value;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[2.5rem] border-2 border-slate-200 shadow-2xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-slate-50 sticky top-0 z-20">
              <TableRow className="hover:bg-transparent border-b-2 border-slate-200">
                {displayedColumns.map((col, i) => (
                  <TableHead 
                    key={col.id} 
                    className={cn(
                        "h-14 px-6 py-3 border-r border-slate-100 last:border-r-0",
                        i < 2 && "sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]"
                    )}
                  >
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort(col.id)}
                      className="h-auto p-0 font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-blue-900 transition-colors gap-2"
                    >
                      {col.label}
                      <ArrowUpDown className="h-3 w-3 text-slate-300" />
                    </Button>
                  </TableHead>
                ))}
                <TableHead className="h-14 px-4 text-center font-black text-[10px] uppercase tracking-widest text-slate-500 border-r border-slate-100">Trip Status</TableHead>
                <TableHead className="h-14 px-4 text-center font-black text-[10px] uppercase tracking-widest text-slate-500 border-r border-slate-100">POD Status</TableHead>
                <TableHead className="h-14 px-8 text-right font-black text-[10px] uppercase tracking-widest text-slate-500 sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={displayedColumns.length + 3} className="h-64 text-center text-slate-400 italic font-medium uppercase tracking-[0.3em] opacity-40">No mission records found in registry.</TableCell></TableRow>
              ) : (
                paginatedData.map((row, idx) => {
                  const canEdit = isAdminSession || user?.uid === row.userId;
                  const gpsEnabled = gpsMaster[row.vehicleNumber] === true;
                  const isLrMissing = !row.lrNumber;
                  const podStatus = (row.podStatus || 'Pending').toLowerCase();
                  const isPodUploaded = row.podReceived === true;

                  return (
                    <TableRow key={row.id || idx} className="hover:bg-blue-50/20 transition-all h-16 text-[11px] font-medium text-slate-600 border-b border-slate-50 last:border-0 group">
                      {displayedColumns.map((col, i) => (
                        <TableCell 
                          key={col.id} 
                          className={cn(
                              "px-6 py-2 border-r border-slate-50 last:border-r-0 whitespace-nowrap",
                              i < 2 && "sticky left-0 bg-white group-hover:bg-blue-50/20 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors"
                          )}
                        >
                          {col.id === 'shipmentId' || col.id === 'tripId' ? (
                            <span className="font-black text-blue-700 font-mono text-[11px] tracking-widest uppercase">{row[col.id]}</span>
                          ) : col.id === 'lrNumber' ? (
                            row.lrNumber ? (
                              <button 
                                onClick={() => row.lrGenerated ? onViewLR?.(row) : null}
                                className={cn("font-black uppercase", row.lrGenerated ? "text-blue-700 hover:underline decoration-blue-200 underline-offset-4" : "text-slate-400 italic")}
                              >
                                {row.lrNumber}
                              </button>
                            ) : (
                                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 text-[9px] font-black uppercase flex items-center gap-1">
                                    <AlertTriangle className="h-2.5 w-2.5" /> LR Pending
                                </Badge>
                            )
                          ) : col.id === 'vehicleNumber' ? (
                            <div className="flex items-center gap-3">
                                <button 
                                    onDoubleClick={() => onEditVehicle?.(row)}
                                    className="font-black text-slate-900 tracking-tighter uppercase text-[13px]"
                                >
                                    {row[col.id]}
                                </button>
                                {gpsEnabled && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="GPS Active" />}
                            </div>
                          ) : (
                            formatValue(col.id, row[col.id])
                          )}
                        </TableCell>
                      ))}
                      
                      <TableCell className="px-4 text-center border-r border-slate-50">
                          <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-3 h-6 border shadow-sm", getTripStatusColor(row.tripStatus))}>
                              {row.tripStatus || 'N/A'}
                          </Badge>
                      </TableCell>

                      <TableCell className="px-4 text-center border-r border-slate-50">
                          <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-3 h-6 border shadow-sm", getPodStatusColor(row.podStatus))}>
                              {row.podStatus || 'Pending'}
                          </Badge>
                      </TableCell>
                      
                      <TableCell className="text-right px-6 sticky right-0 bg-white/95 group-hover:bg-blue-50/95 backdrop-blur-sm z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] transition-colors">
                          <div className="flex justify-end items-center gap-3">
                              {isLrMissing && activeTab === 'loading' && (
                                  <Button 
                                      size="sm" 
                                      className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase shadow-lg border-none px-6 rounded-xl transition-all active:scale-95"
                                      onClick={() => onGenerateLR?.(row)}
                                  >
                                      Generate LR
                                  </Button>
                              )}

                              {activeTab === 'pod-pending' && !isPodUploaded && (
                                  <Button 
                                      size="sm" 
                                      className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase shadow-lg border-none px-6 rounded-xl transition-all active:scale-95 flex items-center gap-2"
                                      onClick={() => onUploadPod?.(row)}
                                  >
                                      <FileUp className="h-3 w-3" /> Upload POD
                                  </Button>
                              )}

                              <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-blue-900 hover:bg-slate-50">
                                          <MoreVertical className="h-5 w-5" />
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuPortal>
                                      <DropdownMenuContent align="end" className="w-64 p-2 border-slate-200 shadow-3xl z-[100] bg-white rounded-2xl animate-in zoom-in-95 duration-200">
                                          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 px-3 border-b pb-2 flex items-center gap-2">
                                              <ShieldCheck className="h-3 w-3" /> Mission Control Node
                                          </DropdownMenuLabel>
                                          
                                          <DropdownMenuItem onClick={() => onViewTrip?.(row)} className="gap-3 font-bold py-3 cursor-pointer rounded-xl hover:bg-blue-50 transition-colors">
                                              <div className="p-1.5 bg-blue-50 rounded-lg"><Eye className="h-4 w-4 text-blue-600" /></div>
                                              <div className="flex flex-col"><span className="text-xs">Inspect Details</span><span className="text-[9px] font-medium text-slate-400">Full mission manifest</span></div>
                                          </DropdownMenuItem>

                                          {activeTab === 'loading' && (
                                              <>
                                                <DropdownMenuItem onClick={() => onGenerateLR?.(row)} className="gap-3 font-bold py-3 cursor-pointer rounded-xl hover:bg-emerald-50 transition-colors">
                                                    <div className="p-1.5 bg-emerald-50 rounded-lg"><FileText className="h-4 w-4 text-emerald-600" /></div>
                                                    <div className="flex flex-col"><span className="text-xs">{row.lrNumber ? 'Modify LR Registry' : 'Initialize LR Node'}</span><span className="text-[9px] font-medium text-slate-400">Lorry receipt particulars</span></div>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    disabled={!canEdit}
                                                    onClick={() => onEditTrip?.(row)} 
                                                    className="gap-3 font-bold py-3 cursor-pointer rounded-xl hover:bg-indigo-50 transition-colors"
                                                >
                                                    <div className="p-1.5 bg-indigo-50 rounded-lg"><Edit2 className="h-4 w-4 text-indigo-600" /></div>
                                                    <div className="flex flex-col"><span className="text-xs">Edit Allocation</span><span className="text-[9px] font-medium text-slate-400">Modify trip assignment</span></div>
                                                </DropdownMenuItem>
                                              </>
                                          )}

                                          {activeTab === 'pod-pending' && (
                                              <>
                                                <DropdownMenuItem onClick={() => onUploadPod?.(row)} className="gap-3 font-bold py-3 cursor-pointer rounded-xl hover:bg-amber-50 transition-colors">
                                                    <div className="p-1.5 bg-amber-50 rounded-lg"><FileUp className="h-4 w-4 text-amber-600" /></div>
                                                    <div className="flex flex-col"><span className="text-xs">{isPodUploaded ? 'Update Registry' : 'Upload Document'}</span><span className="text-[9px] font-medium text-slate-400">Proof of Delivery node</span></div>
                                                </DropdownMenuItem>
                                                
                                                {isPodUploaded && canVerifyPod && (
                                                    <DropdownMenuItem onClick={() => onVerifyPod?.(row)} className="gap-3 font-bold py-3 cursor-pointer rounded-xl hover:bg-emerald-50 transition-colors">
                                                        <div className="p-1.5 bg-emerald-50 rounded-lg"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
                                                        <div className="flex flex-col"><span className="text-xs text-emerald-700">Verify POD</span><span className="text-[9px] font-medium text-slate-400">Authorized audit handshake</span></div>
                                                    </DropdownMenuItem>
                                                )}
                                              </>
                                          )}

                                          <DropdownMenuItem onClick={() => router.push(`/dashboard/tracking/consignment?search=${row.tripId}`)} className="gap-3 font-bold py-3 cursor-pointer rounded-xl hover:bg-blue-50 transition-colors">
                                              <div className="p-1.5 bg-blue-50 rounded-lg"><Radar className="h-4 w-4 text-blue-600" /></div>
                                              <div className="flex flex-col"><span className="text-xs text-blue-700">Track Mission</span><span className="text-[9px] font-medium text-slate-400">Live GIS telemetry</span></div>
                                          </DropdownMenuItem>

                                          <DropdownMenuSeparator className="my-2 bg-slate-100" />
                                          
                                          <DropdownMenuItem onClick={() => onCancelTrip?.(row)} className="gap-3 font-bold py-3 text-red-600 cursor-pointer rounded-xl hover:bg-red-50 transition-colors">
                                              <div className="p-1.5 bg-red-50 rounded-lg"><Ban className="h-4 w-4 text-red-600" /></div>
                                              <div className="flex flex-col"><span className="text-xs">Revoke Mission</span><span className="text-[9px] font-medium text-red-400">Purge trip from registry</span></div>
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenuPortal>
                              </DropdownMenu>
                          </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-[1.5rem] px-8 py-3 shadow-md flex items-center justify-between">
        <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
            itemCount={sortedData.length}
            canPreviousPage={currentPage > 1}
            canNextPage={currentPage < totalPages}
        />
      </div>
    </div>
  );
}
