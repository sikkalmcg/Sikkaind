'use client';

import * as React from 'react';
import { Radar, Search, Package, Truck, CheckCircle, AlertCircle, Loader2, MapPin, User, ArrowRightLeft } from 'lucide-react';
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
import { doc, getDoc } from 'firebase/firestore';

/**
 * @fileOverview Track Consignment page.
 * Displays mission-critical details including Consignor, Consignee, Ship-to-party, Route, and Order Qty.
 */
export default function TrackPage() {
  const db = useFirestore();
  const [type, setType] = React.useState('sales');
  const [value, setValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{
    found: boolean;
    data?: any;
    message?: string;
  } | null>(null);

  const handleTrack = async () => {
    const cleanValue = value.trim().toUpperCase();
    if (!cleanValue) return;
    
    setLoading(true);
    setResult(null);

    try {
      const collectionName = type === 'sales' ? 'public_orders' : 'public_trips';
      const docRef = doc(db, collectionName, cleanValue);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        setResult({ 
          found: false, 
          message: `No active mission node found for this ${type === 'sales' ? 'Sales Order' : 'Trip ID'}.` 
        });
      } else {
        const data = snap.data();
        setResult({ 
          found: true, 
          data: data,
          message: data.status === 'PLACED' ? 'Order Placed - Vehicle will be assigned shortly.' : undefined
        });
      }
    } catch (error) {
      console.error('Tracking Error:', error);
      setResult({ found: false, message: 'System error during synchronization. Please check registry ID.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-slate-50 flex flex-col items-center justify-center p-6 py-12">
      <div className="w-full max-w-2xl space-y-10 bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-slide-up">
        <div className="flex flex-col items-center gap-6">
          <div className="p-5 bg-blue-900 rounded-[1.5rem] shadow-xl shadow-blue-900/20">
            <Radar className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic text-center">
            Track Consignment
          </h1>
        </div>

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
                <SelectItem value="sales" className="font-bold py-3 uppercase">Sales Order No.</SelectItem>
                <SelectItem value="trip" className="font-bold py-3 uppercase">Trip ID</SelectItem>
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

                <div className="bg-slate-900 p-8 rounded-[2rem] text-white space-y-6 shadow-xl">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Current Status</p>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter mt-1 leading-tight">
                        {result.data.status === 'PLACED' 
                          ? `YOUR ORDER NO. '${result.data.saleOrder}' HAS BEEN BOOKED FOR DELIVERY. TRIP ID WILL BE SHARED SHORTLY` 
                          : result.data.status}
                      </h3>
                    </div>
                    <Truck className="h-10 w-10 text-white/20 ml-4 shrink-0" />
                  </div>

                  <div className="space-y-3.5 pt-4 border-t border-white/10">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400 uppercase tracking-tighter">Vehicle No.</span>
                      <span className="uppercase">{result.data.vehicleNumber || 'ASSIGNING...'}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400 uppercase tracking-tighter">Registry ID</span>
                      <span>{result.data.saleOrder || result.data.tripId || 'N/A'}</span>
                    </div>
                    
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400 uppercase tracking-tighter">Consignor</span>
                      <span className="uppercase text-right ml-4">{result.data.consignor || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400 uppercase tracking-tighter">Consignee</span>
                      <span className="uppercase text-right ml-4">{result.data.consignee || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400 uppercase tracking-tighter">Ship-to-Party</span>
                      <span className="uppercase text-right ml-4">{result.data.shipToParty || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400 uppercase tracking-tighter">Order Qty.</span>
                      <span className="text-blue-400">{result.data.orderQty || 'N/A'}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                      <MapPin className="h-3 w-3 text-blue-400" />
                      <span className="text-[9px] font-bold uppercase truncate text-slate-400 tracking-tight">
                        {result.data.route || result.data.destination || 'TRANSIT PENDING'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
