'use client';

import * as React from 'react';
import { 
  Radar, Search, Package, Truck, CheckCircle, 
  AlertCircle, Loader2, MapPin, User, ArrowLeft, 
  ShoppingCart, AlertTriangle 
} from 'lucide-react';
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
import { format } from 'date-fns';

/**
 * @fileOverview Track Consignment page.
 * Displays mission-critical details in a high-visibility layout matching the requested design.
 */
export default function TrackPage() {
  const db = useFirestore();
  const [type, setType] = React.useState('sales');
  const [value, setValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);
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
        setShowResult(false);
      } else {
        const data = snap.data();
        setResult({ 
          found: true, 
          data: data,
        });
        setShowResult(true);
      }
    } catch (error) {
      console.error('Tracking Error:', error);
      setResult({ found: false, message: 'System error during synchronization. Please check registry ID.' });
      setShowResult(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setShowResult(false);
    setValue('');
    setResult(null);
  };

  if (showResult && result?.found && type === 'sales') {
    const data = result.data;
    const formattedDate = data.updatedAt ? format(new Date(data.updatedAt), 'dd-MMM-yyyy HH:mm').toUpperCase() : 'PENDING';

    return (
      <div className="min-h-screen bg-white font-mono p-4 md:p-8 animate-fade-in">
        <div className="max-w-[1400px] mx-auto space-y-8">
          {/* Top Navigation */}
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-3 w-3" /> BACK TO SEARCH
          </button>

          {/* High Visibility Info Bar */}
          <div className="bg-[#0f172a] text-white rounded-[1.5rem] md:rounded-full px-8 py-6 flex flex-wrap items-center justify-between gap-8 shadow-2xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <Package className="h-3 w-3" /> Sale Order
              </div>
              <p className="text-[12px] font-black text-blue-500">{data.saleOrder}</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <User className="h-3 w-3" /> Consignor
              </div>
              <p className="text-[10px] font-black uppercase text-slate-100">{data.consignor || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <User className="h-3 w-3" /> Consignee
              </div>
              <p className="text-[10px] font-black uppercase text-slate-100">{data.consignee || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <MapPin className="h-3 w-3" /> Ship to Party
              </div>
              <p className="text-[10px] font-black uppercase text-slate-100">{data.shipToParty || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <ShoppingCart className="h-3 w-3" /> Order Quantity
              </div>
              <p className="text-[10px] font-black text-emerald-500">{data.orderQty || '0 MT'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <Truck className="h-3 w-3" /> Route
              </div>
              <p className="text-[10px] font-black uppercase text-blue-300">
                {data.route || 'TRANSIT PENDING'}
              </p>
            </div>
          </div>

          {/* Mission Status Content */}
          <div className="flex justify-center pt-8">
            <div className="bg-[#f0f7ff] border-l-[6px] border-blue-600 rounded-[2.5rem] p-10 md:p-16 max-w-4xl w-full shadow-lg relative flex flex-col items-center text-center">
               <h2 className="text-xl md:text-2xl font-black italic text-slate-800 uppercase leading-relaxed tracking-tight">
                SALE ORDER <span className="text-blue-700">{data.saleOrder}</span> IS BOOKED FOR DISPATCH ON <span className="text-blue-600 underline decoration-2">{formattedDate}</span>. VEHICLE WILL BE ASSIGNED SHORTLY.
               </h2>

               {/* Official Delay Registry Node */}
               <div className="mt-12 bg-orange-500 p-6 rounded-[1.5rem] shadow-xl border border-orange-600 max-w-lg w-full">
                  <div className="flex items-center justify-center gap-3 text-white mb-4">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="text-[11px] font-black uppercase tracking-widest">Official Delay Registry Node</span>
                  </div>
                  <p className="text-white text-[12px] font-black italic bg-black/10 p-4 rounded-xl border border-white/20 leading-relaxed">
                    "Discussed with customer Delivery on Monday 27-April-2026"
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        {result && !result.found && (
          <div className="animate-fade-in border-t border-slate-100 pt-8 mt-8">
            <div className="flex flex-col items-center gap-4 p-6 bg-red-50 rounded-3xl border border-red-100">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-xs font-black uppercase text-red-600 text-center tracking-tight">
                {result.message}
              </p>
            </div>
          </div>
        )}

        {result && result.found && type === 'trip' && (
           <div className="animate-fade-in border-t border-slate-100 pt-8 mt-8">
              <div className="bg-slate-900 p-8 rounded-[2rem] text-white space-y-6 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Current Status</p>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter mt-1 leading-tight">
                      {result.data.status}
                    </h3>
                  </div>
                  <Truck className="h-10 w-10 text-white/20 ml-4 shrink-0" />
                </div>
                <div className="space-y-3.5 pt-4 border-t border-white/10 relative z-10">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-400 uppercase tracking-tighter">Vehicle No.</span>
                    <span className="uppercase">{result.data.vehicleNumber || 'ASSIGNING...'}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-400 uppercase tracking-tighter">Registry ID</span>
                    <span>{result.data.tripId}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                    <MapPin className="h-3 w-3 text-blue-400" />
                    <span className="text-[9px] font-black uppercase truncate text-slate-400 tracking-tight">
                      {result.data.route || 'TRANSIT PENDING'}
                    </span>
                  </div>
                </div>
                <Button onClick={handleBack} variant="ghost" className="w-full text-[10px] font-black uppercase text-blue-400 mt-4 hover:bg-white/5">Back to Search</Button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}
