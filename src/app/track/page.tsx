'use client';

import * as React from 'react';
import { Radar, Search, Package, Truck, CheckCircle, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * @fileOverview Track Consignment page.
 * Allows users to track shipments via Trip ID or Sales Order Number.
 */
export default function TrackPage() {
  const db = useFirestore();
  const [type, setType] = React.useState('sales');
  const [value, setValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{
    found: boolean;
    order?: any;
    trip?: any;
    message?: string;
  } | null>(null);

  const handleTrack = async () => {
    if (!value.trim()) return;
    
    setLoading(true);
    setResult(null);

    try {
      if (type === 'sales') {
        // 1. Search for Sales Order
        const ordersRef = collectionGroup(db, 'sales_orders');
        const qOrder = query(ordersRef, where('saleOrder', '==', value.trim()), limit(1));
        const orderSnap = await getDocs(qOrder);

        if (orderSnap.empty) {
          setResult({ found: false, message: 'No such registry node found for this Sales Order.' });
        } else {
          const orderDoc = orderSnap.docs[0].data();
          const orderId = orderSnap.docs[0].id;

          // 2. Search for associated Trip
          const tripsRef = collectionGroup(db, 'trips');
          const qTrip = query(tripsRef, where('saleOrderId', '==', orderId), limit(1));
          const tripSnap = await getDocs(qTrip);

          if (tripSnap.empty) {
            setResult({ 
              found: true, 
              order: orderDoc, 
              message: 'Order Placed - Vehicle will be assigned shortly.' 
            });
          } else {
            setResult({ 
              found: true, 
              order: orderDoc, 
              trip: tripSnap.docs[0].data() 
            });
          }
        }
      } else {
        // 1. Search for Trip ID directly
        const tripsRef = collectionGroup(db, 'trips');
        const qTrip = query(tripsRef, where('tripId', '==', value.trim()), limit(1));
        const tripSnap = await getDocs(qTrip);

        if (tripSnap.empty) {
          setResult({ found: false, message: 'No such registry node found for this Trip ID.' });
        } else {
          setResult({ found: true, trip: tripSnap.docs[0].data() });
        }
      }
    } catch (error) {
      console.error('Tracking Error:', error);
      setResult({ found: false, message: 'System error during synchronization. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-slate-50 flex flex-col items-center justify-center p-6 py-12">
      <div className="w-full max-w-md space-y-10 bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-slide-up">
        {/* Header Section */}
        <div className="flex flex-col items-center gap-6">
          <div className="p-5 bg-blue-900 rounded-[1.5rem] shadow-xl shadow-blue-900/20">
            <Radar className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic text-center">
            Track Consignment
          </h1>
        </div>

        {/* Form Section */}
        <div className="space-y-8">
          <div className="space-y-2.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
              Registry Node Type *
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-14 rounded-2xl font-bold bg-slate-50 border-slate-100 focus:ring-blue-600 focus:ring-offset-0 transition-all text-slate-600">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-100">
                <SelectItem value="trip" className="font-bold py-3 uppercase">Trip ID</SelectItem>
                <SelectItem value="sales" className="font-bold py-3 uppercase">Sales Order No.</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
              Enter {type === 'trip' ? 'Trip ID' : 'Sales Order No.'} *
            </label>
            <Input
              placeholder={type === 'trip' ? 'E.G. T1000789' : 'E.G. SO1000123'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
              className="h-16 rounded-2xl font-black text-center text-slate-700 bg-slate-50 border-slate-100 placeholder:text-slate-300 text-lg uppercase tracking-wider focus:ring-blue-600 transition-all"
            />
          </div>

          <Button
            onClick={handleTrack}
            disabled={loading}
            className="w-full h-16 bg-blue-900 hover:bg-black font-black uppercase text-xs tracking-[0.4em] rounded-2xl shadow-xl shadow-blue-900/30 transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            Track Now
          </Button>
        </div>

        {/* Result Display */}
        {result && (
          <div className="animate-fade-in border-t border-slate-100 pt-8 mt-8">
            {!result.found ? (
              <div className="flex flex-col items-center gap-4 p-6 bg-red-50 rounded-3xl border border-red-100">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-xs font-black uppercase text-red-600 text-center tracking-tight">
                  {result.message}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-900" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mission Node Result</span>
                  </div>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </div>

                {result.trip ? (
                  <div className="bg-slate-900 p-8 rounded-[2rem] text-white space-y-6 shadow-xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Current Status</p>
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter mt-1">{result.trip.status}</h3>
                      </div>
                      <Truck className="h-10 w-10 text-white/20" />
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/10">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-400 uppercase">Vehicle No.</span>
                        <span className="uppercase">{result.trip.vehicleNumber}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-400 uppercase">Trip Registry</span>
                        <span>{result.trip.tripId}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <MapPin className="h-3 w-3 text-blue-400" />
                        <span className="text-[9px] font-bold uppercase truncate text-slate-400">{result.trip.route}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 p-8 rounded-[2rem] border border-blue-100 space-y-4 text-center">
                    <Package className="h-10 w-10 text-blue-900 mx-auto opacity-20" />
                    <p className="text-sm font-black uppercase text-blue-900 tracking-tight">
                      {result.message}
                    </p>
                    <div className="pt-2">
                      <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">
                        Registry: {result.order.saleOrder}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
