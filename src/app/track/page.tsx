
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
import { cn } from '@/lib/utils';

const STEPS = ['OPEN ORDER', 'LOADING', 'IN-TRANSIT', 'ARRIVED', 'DELIVERED'];

function getStatusIndex(status: string) {
  const s = status?.toUpperCase() || '';
  if (s === 'PLACED' || s === 'OPEN ORDER') return 0;
  if (s === 'LOADING') return 1;
  if (s === 'IN-TRANSIT') return 2;
  if (s === 'ARRIVED') return 3;
  if (s === 'POD' || s === 'CLOSED' || s === 'DELIVERED') return 4;
  return 0;
}

/**
 * @fileOverview Track Consignment page.
 * Strictly separates Sales Order view from Trip Tracking view with interactive state transitions.
 */
export default function TrackPage() {
  const db = useFirestore();
  const [type, setType] = React.useState('sales');
  const [value, setValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'order' | 'trip'>('order');
  const [animatedIndex, setAnimatedIndex] = React.useState(0);
  const [result, setResult] = React.useState<{
    found: boolean;
    data?: any;
    message?: string;
  } | null>(null);

  // Effect to handle the stepped animation when Trip view is active
  React.useEffect(() => {
    if (showResult && viewMode === 'trip' && result?.data?.status) {
      const targetIndex = getStatusIndex(result.data.status);
      let current = 0;
      setAnimatedIndex(0);

      const timer = setInterval(() => {
        if (current < targetIndex) {
          current += 1;
          setAnimatedIndex(current);
        } else {
          clearInterval(timer);
        }
      }, 2000); 

      return () => clearInterval(timer);
    }
  }, [showResult, viewMode, result?.data?.status]);

  const handleTrack = async (overrideValue?: string, overrideType?: string) => {
    const trackValue = (overrideValue || value).trim().toUpperCase();
    const trackType = overrideType || type;
    
    if (!trackValue) return;
    
    setLoading(true);
    setResult(null);

    try {
      const collectionName = trackType === 'sales' ? 'public_orders' : 'public_trips';
      const docRef = doc(db, collectionName, trackValue);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        setResult({ 
          found: false, 
          message: `No active mission node found for this ${trackType === 'sales' ? 'Sales Order' : 'Trip ID'}.` 
        });
        setShowResult(false);
      } else {
        const data = snap.data();
        setResult({ 
          found: true, 
          data: data,
        });
        setViewMode(trackType === 'sales' ? 'order' : 'trip');
        if (overrideValue) {
          setValue(overrideValue);
          setType(trackType);
        }
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
    setType('sales');
    setViewMode('order');
    setAnimatedIndex(0);
  };

  if (showResult && result?.found) {
    const data = result.data;
    const formattedDate = data.updatedAt ? format(new Date(data.updatedAt), 'dd-MMM-yyyy HH:mm').toUpperCase() : 'PENDING';
    const soNo = data.saleOrder || data.saleOrderNumber || data.id || 'N/A';
    const hasTrip = !!data.tripId;
    const currentRoute = data.route || 'TRANSIT PENDING';

    return (
      <div className="min-h-screen bg-white font-mono p-4 md:p-8 animate-fade-in">
        <div className="max-w-[1400px] mx-auto space-y-6">
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-900 transition-colors mb-2"
          >
            <ArrowLeft className="h-3 w-3" /> BACK TO SEARCH
          </button>

          {/* High Visibility Info Bar */}
          <div className="bg-[#0f172a] text-white rounded-[1.5rem] md:rounded-full px-8 py-5 flex flex-wrap items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <Package className="h-3 w-3" /> Sale Order
              </div>
              <p className="text-[11px] font-black text-blue-500">{soNo}</p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <User className="h-3 w-3" /> Consignor
              </div>
              <p className="text-[9px] font-black uppercase text-slate-100 truncate max-w-[150px]">{data.consignor || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <User className="h-3 w-3" /> Consignee
              </div>
              <p className="text-[9px] font-black uppercase text-slate-100 truncate max-w-[150px]">{data.consignee || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <MapPin className="h-3 w-3" /> Ship to Party
              </div>
              <p className="text-[9px] font-black uppercase text-slate-100 truncate max-w-[150px]">{data.shipToParty || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <ShoppingCart className="h-3 w-3" /> Order Quantity
              </div>
              <p className="text-[9px] font-black text-emerald-500">{data.orderQty || '0 MT'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-slate-500">
                <Truck className="h-3 w-3" /> Route
              </div>
              <p className="text-[9px] font-black uppercase text-blue-300">
                {currentRoute}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6 pt-4">
            {viewMode === 'order' && (
              <div className="space-y-6 w-full flex flex-col items-center">
                <div className="bg-[#f0f7ff] border-l-[6px] border-blue-600 rounded-[2rem] p-6 md:p-8 max-w-3xl w-full shadow-lg relative flex flex-col items-center text-center animate-slide-up">
                  {hasTrip ? (
                    <h2 className="text-sm md:text-base font-black italic text-slate-800 uppercase leading-relaxed tracking-tight">
                      YOUR TRIP ID IS <button onClick={() => handleTrack(data.tripId, 'trip')} className="text-blue-600 underline decoration-2 hover:text-black transition-colors">'{data.tripId}'</button> FOR THIS SALES ORDER NO. '{soNo}'
                    </h2>
                  ) : (
                    <h2 className="text-sm md:text-base font-black italic text-slate-800 uppercase leading-relaxed tracking-tight">
                      YOUR ORDER NO. '{soNo}' HAS BEEN BOOKED FOR DELIVERY. TRIP ID WILL BE SHARED SHORTLY ON <span className="text-blue-600 underline decoration-2">{formattedDate}</span>.
                    </h2>
                  )}
                </div>

                {data.delayRemark && (
                  <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-2xl flex flex-col items-center animate-slide-up">
                    <div className="flex items-center gap-2 mb-3 text-slate-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-[8px] font-black uppercase tracking-[0.2em]">Official Registry Note</span>
                    </div>
                    <p className="text-slate-700 text-sm md:text-base font-black italic text-center leading-relaxed">
                      "{data.delayRemark}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'trip' && (
              <div className="bg-[#0f172a] p-6 md:p-8 rounded-[1.5rem] text-white shadow-2xl relative overflow-hidden w-full max-w-3xl border-t-[6px] border-blue-600 animate-slide-up">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-500">Current Status</p>
                    <h2 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none">
                      {STEPS[animatedIndex] || data.status || 'PROCESSING'}
                    </h2>
                  </div>
                  <div className="opacity-[0.05] absolute top-6 right-6">
                    <Truck className="h-16 w-16 text-white" />
                  </div>
                </div>

                {/* Timeline Animation Component with Pauses */}
                <div className="py-6 relative mb-6">
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2" />
                  <div 
                    className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 transition-all duration-1000 ease-in-out" 
                    style={{ width: `${(animatedIndex / (STEPS.length - 1)) * 100}%` }}
                  />
                  
                  <div className="relative flex justify-between">
                    {STEPS.map((step, idx) => (
                      <div key={step} className="flex flex-col items-center gap-2 group">
                        <div className={cn(
                          "w-3 h-3 rounded-full border-2 z-10 transition-all duration-500 flex items-center justify-center",
                          idx <= animatedIndex ? "bg-blue-500 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-[#0f172a] border-white/20",
                          idx === animatedIndex && idx < getStatusIndex(data.status) && "animate-pulse scale-110"
                        )}>
                          {idx < animatedIndex && <CheckCircle className="h-2 w-2 text-white" />}
                        </div>
                        <span className={cn(
                          "text-[6px] md:text-[8px] font-black uppercase tracking-widest text-center whitespace-nowrap",
                          idx <= animatedIndex ? "text-blue-400" : "text-slate-600"
                        )}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-white/10 w-full mb-6" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em]">Vehicle No.</span>
                      <span className="text-sm md:text-lg font-black uppercase tracking-widest">{data.vehicleNumber || 'ASSIGNING...'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em]">Registry ID</span>
                      <span className="text-sm md:text-lg font-black tracking-widest">{data.tripId || soNo}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col justify-center items-end text-right space-y-2">
                     <div className="flex items-center gap-2 text-slate-300">
                        <MapPin className="h-3 w-3 text-blue-500" />
                        <span className="text-xs md:text-sm font-black uppercase tracking-widest">
                          {currentRoute}
                        </span>
                     </div>
                     <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Last Registry Sync: {formattedDate}
                     </p>
                  </div>
                </div>

                {data.delayRemark && (
                  <div className="mt-6 bg-white/5 p-4 rounded-xl border border-white/10">
                    <p className="text-[7px] font-black uppercase tracking-widest text-blue-500 mb-1">Delay Note</p>
                    <p className="text-slate-300 text-[11px] italic font-bold leading-relaxed">"{data.delayRemark}"</p>
                  </div>
                )}

                <div className="mt-8 flex justify-center">
                  <button 
                    onClick={handleBack}
                    className="text-[8px] font-black uppercase tracking-[0.4em] text-blue-500 hover:text-white transition-colors"
                  >
                    BACK TO SEARCH
                  </button>
                </div>
              </div>
            )}
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
              <SelectContent className="rounded-2xl border-slate-100">
                <SelectItem value="sales" className="font-bold py-3 uppercase">Sales Order No.</SelectItem>
                <SelectItem value="trip" className="font-bold py-3 uppercase">Trip ID</SelectItem>
              </SelectContent>
              <SelectTrigger className="h-14 rounded-2xl font-bold bg-slate-50 border-slate-100 focus:ring-blue-600 focus:ring-offset-0 transition-all text-slate-600">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
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
            onClick={() => handleTrack()}
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
      </div>
    </div>
  );
}
