'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { 
  Radar, ShoppingCart, Package, Truck, MapPin, 
  CheckCircle, Loader2, ArrowLeft, AlertTriangle, Search,
  Map as MapIcon, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMongoStore, useCollection, useMemoMongo } from '@/mongodb';
import { collection } from '@/lib/mongo-store';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SHARED_HUB_ID = 'Sikkaind';

export default function TrackPage() {
  const db = useMongoStore();
  const [searchSo, setSearchSo] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState<'search' | 'order_details' | 'mapping'>('search');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [linkedTrips, setLinkedTrips] = React.useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);

  const ordersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const customersQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: customers } = useCollection(customersQuery);

  const handleTrack = () => {
    if (!searchSo) return;
    setLoading(true);
    setTimeout(() => {
      const val = searchSo.trim().toUpperCase();
      const order = orders?.find((o: any) => o.orderNo === val);
      if (order) {
        setSelectedOrder(order);
        const tList = trips?.filter((t: any) => t.orderNo === val) || [];
        setLinkedTrips(tList);
        setView('order_details');
      } else {
        alert("System Failure: Sale Order Not Found in Registry");
      }
      setLoading(false);
    }, 800);
  };

  const getCustomerPincode = (code: string) => {
    if (!customers || !code) return '-';
    const found = customers.find(c => c.customerCode === code || c.id === code);
    return found?.pincode || found?.postalCode || '-';
  };

  const handleSelectTrip = (trip: any) => {
    setSelectedTrip(trip);
    setView('mapping');
  };

  const handleOpenPrint = (tripId: string) => {
    window.open(`/print/cn/${tripId}?auto=true`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex flex-col font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-4 mb-8 shadow-sm">
         <div className="max-w-7xl mx-auto flex items-center justify-between">
           <div className="flex flex-col text-left">
             <h1 className="text-xl font-black text-[#1e3a8a] italic uppercase tracking-tighter leading-none">SIKKA INDUSTRIES</h1>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">& LOGISTICS • LIVE TRACKING</span>
           </div>
           {view !== 'search' && <Button onClick={() => setView(view === 'mapping' ? 'order_details' : 'search')} variant="outline" className="h-8 rounded-none text-[9px] font-black uppercase"><ArrowLeft className="h-3 w-3 mr-1" /> Back</Button>}
         </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-8 flex-1 pb-20">
        {view === 'search' && (
          <div className="bg-white border border-slate-300 p-12 space-y-10 shadow-lg mt-20 animate-fade-in text-black">
             <div className="flex flex-col items-center gap-4 mb-6">
                <Radar className="h-12 w-12 text-[#0056d2]" />
                <h2 className="text-lg font-black uppercase italic tracking-widest text-[#1e3a8a]">Shipment Trace Protocol</h2>
             </div>
             <div className="flex items-center gap-8 max-w-2xl mx-auto">
                <label className="text-[12px] font-black text-slate-500 w-[180px] text-right uppercase tracking-widest">Order Number:</label>
                <input value={searchSo} onChange={(e) => setSearchSo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTrack()} className="h-10 w-full border border-slate-400 bg-white px-4 text-[12px] font-black outline-none focus:bg-yellow-50 uppercase shadow-inner" placeholder="ENTER 10-DIGIT ORDER NO..." />
             </div>
             <div className="flex justify-center gap-4 pt-4">
                <Button onClick={handleTrack} disabled={loading} className="h-12 px-20 bg-[#0056d2] text-white rounded-none text-[11px] font-black uppercase shadow-xl hover:scale-105 transition-all">
                   {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Track Shipment'}
                </Button>
             </div>
          </div>
        )}

        {view === 'order_details' && (
          <div className="bg-white border border-slate-300 p-10 space-y-12 shadow-lg animate-fade-in text-black">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-10">
               <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consignor:</span>
                  <span className="text-xs font-black uppercase truncate ml-4" title={selectedOrder.consignorName}>{selectedOrder.consignorName}</span>
               </div>
               <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ship To Party:</span>
                  <span className="text-xs font-black uppercase truncate ml-4" title={selectedOrder.shipToParty}>{selectedOrder.shipToParty}</span>
               </div>
            </div>
            
            <div className="space-y-8">
                <h4 className="text-[12px] font-black text-[#1e3a8a] italic uppercase tracking-tighter border-b-2 border-blue-50 w-fit pb-1">
                   Order {selectedOrder.orderNo} synchronized with {linkedTrips.length} execution node(s).
                </h4>
                
                {linkedTrips.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {linkedTrips.map(t => (
                      <div 
                        key={t.id} 
                        className="p-6 bg-white border-2 border-slate-100 text-left hover:border-[#0056d2] transition-all shadow-sm group relative"
                      >
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-[#0056d2] font-black text-[14px]">{t.tripNo}</span>
                           <Radar className="h-4 w-4 text-slate-200" />
                        </div>
                        <div className="space-y-4">
                           <div className="space-y-0.5">
                              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Vehicle</span>
                              <p className="text-[11px] font-black text-slate-700">{t.vehicleNo}</p>
                           </div>
                           <div className="flex justify-between items-center border-t border-slate-50 pt-4 gap-2">
                              <Button onClick={() => handleSelectTrip(t)} variant="outline" className="flex-1 h-8 rounded-none text-[9px] font-black uppercase border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white">Live Map</Button>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 border-2 border-dashed border-slate-200 bg-slate-50 text-center space-y-4">
                    <AlertTriangle className="h-10 w-10 text-orange-400 mx-auto" />
                    <p className="text-[13px] font-black text-slate-600 italic uppercase max-w-md mx-auto leading-relaxed">
                      Currently your sale order {selectedOrder.orderNo} against Trip ID not generated, we will share trip ID shortly… Thanks for visit.
                    </p>
                  </div>
                )}
            </div>
          </div>
        )}

        {view === 'mapping' && selectedTrip && (
          <div className="bg-white border border-slate-300 p-10 shadow-xl space-y-12 animate-fade-in text-black">
             <div className="flex justify-between items-start border-b border-slate-200 pb-8 text-left">
                <div className="space-y-1">
                   <h3 className="text-[16px] font-black uppercase text-[#1e3a8a] italic tracking-tighter">Live Movement Trace: {selectedTrip.tripNo}</h3>
                   <div className="flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      <span>{selectedTrip.vehicleNo}</span>
                      <span>•</span>
                      <span>{selectedTrip.mode}</span>
                      <span>•</span>
                      <span className="text-emerald-600">{selectedTrip.status}</span>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-8 text-[10px] uppercase font-black text-slate-600">
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">Consignor</p><p className="truncate">{selectedTrip.consignorName}</p></div>
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">Consignee</p><p className="truncate">{selectedTrip.consigneeName}</p></div>
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">Ship To Party</p><p className="truncate">{selectedTrip.shipToParty}</p></div>
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">CN Number</p><p className="truncate">{selectedTrip.cnNumber || '-'}</p></div>
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">CN Date</p><p className="truncate">{selectedTrip.cnDate ? format(new Date(selectedTrip.cnDate), 'dd-MMM-yyyy') : '-'}</p></div>
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">Vehicle</p><p className="truncate">{selectedTrip.vehicleNo}</p></div>
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">Total Pkg</p><p className="truncate">{(selectedTrip.invoices || []).reduce((acc: number, i: any) => acc + (Number(i.pkg) || 0), 0) || '-'}</p></div>
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">Total Weight</p><p className="truncate">{selectedTrip.assignWeight} MT</p></div>
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">Start Point</p><p className="truncate">{selectedTrip.from}</p></div>
                <div className="space-y-1"><p className="text-slate-400 text-[9px]">Drop Point</p><p className="truncate">{selectedTrip.destination}</p></div>
             </div>
             <div className="space-y-1 text-left"><p className="text-slate-400 text-[9px] uppercase">Status By</p><p className="truncate text-[10px] uppercase font-black text-slate-600">{selectedTrip.statusBy || '-'}</p></div>

            <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 p-10 rounded-lg shadow-inner">
              <div className="flex items-center justify-between w-full relative">
                {/* Start Point */}
                <div className="flex flex-col items-center text-center w-48 shrink-0">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 border-4 border-white shadow-lg flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-xs font-black text-slate-700 mt-2 uppercase">Start Point</p>
                  <p className="text-[10px] text-slate-500 truncate">{selectedTrip.from}</p>
                </div>

                {/* Movement Track */}
                <div className="flex-1 h-2 bg-slate-200 rounded-full relative mx-4">
                  <div 
                    className={cn(
                      "absolute top-0 left-0 h-full rounded-full",
                      selectedTrip.status === 'REJECTION' ? 'bg-red-400' : 'bg-blue-400'
                    )}
                    style={{ 
                      width: 
                        selectedTrip.status === 'IN-TRANSIT' ? '50%' :
                        selectedTrip.status === 'ARRIVED' || selectedTrip.status === 'POD' || selectedTrip.status === 'CLOSED' ? '100%' :
                        selectedTrip.status === 'REJECTION' ? '100%' : '0%'
                    }}
                  />
                  {/* Vehicle Icon */}
                  <div 
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000 ease-in-out",
                      selectedTrip.status === 'IN-TRANSIT' && 'left-1/2 -translate-x-1/2',
                      (selectedTrip.status === 'ARRIVED' || selectedTrip.status === 'POD' || selectedTrip.status === 'CLOSED') && 'left-full -translate-x-full',
                      selectedTrip.status === 'REJECTION' && 'left-0',
                      selectedTrip.status === 'LOADING' && 'left-0'
                    )}
                  >
                    <div className={cn(
                      "p-2.5 rounded-full shadow-2xl border-2 border-white relative",
                      selectedTrip.status === 'REJECTION' ? 'bg-red-600' : 'bg-[#0056d2]',
                      (selectedTrip.status === 'IN-TRANSIT' || selectedTrip.status === 'REJECTION') && 'animate-bounce'
                    )}>
                      <Truck className={cn("h-5 w-5 text-white", selectedTrip.status === 'REJECTION' && 'rotate-180')} />
                    </div>
                    <div className="w-3 h-1.5 bg-black/30 rounded-[100%] blur-[2px] mt-1 shadow-md"></div>
                  </div>
                </div>

                {/* Drop Point */}
                <div className="flex flex-col items-center text-center w-48 shrink-0">
                  <div className="w-10 h-10 rounded-full bg-red-500 border-4 border-white shadow-lg flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-xs font-black text-slate-700 mt-2 uppercase">Drop Point</p>
                  <p className="text-[10px] text-slate-500 truncate">{selectedTrip.destination}</p>
                </div>
              </div>

              {/* Milestones */}
              <div className="mt-8 pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Out for Delivery</p>
                  <p className="text-sm font-black text-slate-600">{selectedTrip.outDate ? format(new Date(selectedTrip.outDate), 'dd-MMM-yyyy HH:mm') : '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Arrived at Destination</p>
                  <p className="text-sm font-black text-slate-600">{selectedTrip.arrivedDate ? format(new Date(selectedTrip.arrivedDate), 'dd-MMM-yyyy HH:mm') : '-'}</p>
                </div>
                <div className="space-y-1">
                  {selectedTrip.status === 'REJECTION' ? (
                    <>
                      <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Rejected / Returned</p>
                      <p className="text-sm font-black text-red-600">{selectedTrip.rejectionDate ? format(new Date(selectedTrip.rejectionDate), 'dd-MMM-yyyy HH:mm') : '-'}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unloaded / Completed</p>
                      <p className="text-sm font-black text-slate-600">{selectedTrip.unloadDate ? format(new Date(selectedTrip.unloadDate), 'dd-MMM-yyyy HH:mm') : '-'}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-12">
              <h4 className="text-[12px] font-black text-[#1e3a8a] italic uppercase tracking-tighter border-b-2 border-blue-50 w-fit pb-1 mb-4">
                Status History
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 uppercase tracking-widest font-black">Status</th>
                      <th className="p-2 uppercase tracking-widest font-black">Updated Date Time</th>
                      <th className="p-2 uppercase tracking-widest font-black">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTrip.statusHistory?.map((history: any, index: number) => (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="p-2 font-semibold">{history.status}</td>
                        <td className="p-2">{history.dateTime ? format(new Date(history.dateTime), 'dd-MMM-yyyy HH:mm') : '-'}</td>
                        <td className="p-2">{history.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
