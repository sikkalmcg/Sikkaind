'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { 
  Radar, ShoppingCart, Package, Truck, MapPin, 
  CheckCircle, Loader2, ArrowLeft, AlertTriangle, Search,
  Map as MapIcon, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SHARED_HUB_ID = 'Sikkaind';

export default function TrackPage() {
  const db = useFirestore();
  const [searchSo, setSearchSo] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState<'search' | 'order_details' | 'mapping'>('search');
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [linkedTrips, setLinkedTrips] = React.useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);

  const ordersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'sales_orders'), [db]);
  const tripsQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'trip_board'), [db]);
  const customersQuery = useMemoFirebase(() => collection(db, 'users', SHARED_HUB_ID, 'customers'), [db]);

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

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex flex-col font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-4 mb-8 shadow-sm">
         <div className="max-w-7xl mx-auto flex items-center justify-between">
           <div className="flex flex-col">
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
                              {t.cnNumber && (
                                <Button onClick={() => window.open(`/print/cn/${t.id}`, '_blank')} className="flex-1 h-8 rounded-none text-[9px] font-black uppercase bg-emerald-600 text-white"><ExternalLink className="h-3 w-3 mr-1" /> View CN</Button>
                              )}
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
             <div className="flex justify-between items-start border-b border-slate-100 pb-8">
                <div className="space-y-1">
                   <h3 className="text-[16px] font-black uppercase text-[#1e3a8a] italic tracking-tighter">Live Movement Trace: {selectedTrip.tripNo}</h3>
                   <div className="flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      <span>{selectedTrip.vehicleNo}</span>
                      <span>•</span>
                      <span>{selectedTrip.mode}</span>
                   </div>
                </div>
                <div className="flex gap-2">
                  {selectedTrip.cnNumber && (
                    <Button onClick={() => window.open(`/print/cn/${selectedTrip.id}`, '_blank')} variant="outline" className="rounded-none font-black text-[10px] px-6 h-9 uppercase border-emerald-600 text-emerald-600">View CN</Button>
                  )}
                  <Badge className="bg-[#0056d2] rounded-none font-black text-[10px] px-8 py-1.5 uppercase shadow-lg tracking-widest">{selectedTrip.status}</Badge>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                   <div className="relative pl-10 space-y-10 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                      <div className="relative">
                         <div className="absolute -left-[10px] top-1 w-5 h-5 rounded-full bg-emerald-500 border-[3px] border-white shadow-md z-10" />
                         <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Point Mark</span>
                            <p className="text-sm font-black text-slate-800 uppercase italic">Postal Code: {getCustomerPincode(selectedTrip.consignorCode)} ({selectedTrip.from})</p>
                            <span className="text-[8px] font-bold text-slate-300 italic uppercase">{selectedTrip.dispatchDate ? format(new Date(selectedTrip.dispatchDate), 'dd-MMM HH:mm') : 'Syncing...'}</span>
                         </div>
                      </div>

                      <div className="relative">
                         <div className="absolute -left-[10px] top-1 w-5 h-5 rounded-full bg-blue-500 border-[3px] border-white shadow-md z-10 animate-pulse" />
                         <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Execution</span>
                            <p className="text-sm font-black text-slate-800 uppercase italic">Vehicle {selectedTrip.vehicleNo} in {selectedTrip.status}</p>
                            <span className="text-[8px] font-bold text-slate-300 italic uppercase">Update Sync: ACTIVE</span>
                         </div>
                      </div>

                      <div className="relative">
                         <div className="absolute -left-[10px] top-1 w-5 h-5 rounded-full bg-red-500 border-[3px] border-white shadow-md z-10" />
                         <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Drop Point Mark</span>
                            <p className="text-sm font-black text-slate-800 uppercase italic">Postal Code: {getCustomerPincode(selectedTrip.shipToPartyCode)} ({selectedTrip.destination})</p>
                            <span className="text-[8px] font-bold text-slate-300 italic uppercase">EST. UNLOAD: {selectedTrip.unloadDate ? format(new Date(selectedTrip.unloadDate), 'dd-MMM HH:mm') : 'Pending Arrival'}</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="bg-slate-100 border-2 border-slate-200 rounded-sm relative flex flex-col items-center justify-center min-h-[350px] shadow-inner overflow-hidden group">
                   <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                   <MapIcon className="h-16 w-16 text-slate-300 mb-4" />
                   <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] italic">Satellite Geometry Active</span>
                   <p className="mt-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest">Mapping Pincode: {getCustomerPincode(selectedTrip.shipToPartyCode)}</p>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}