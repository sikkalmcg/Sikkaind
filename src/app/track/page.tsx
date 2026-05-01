'use client';

import * as React from 'react';
import { Radar, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * @fileOverview Track Consignment page.
 * Allows users to track shipments via Trip ID or Sales Order Number.
 */
export default function TrackPage() {
  const [type, setType] = React.useState('trip');
  const [value, setValue] = React.useState('');

  const handleTrack = () => {
    // Logic for tracking (simulation)
    if (value.trim()) {
      alert(`Initiating tracking for ${type.toUpperCase()}: ${value.toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-[80vh] bg-slate-50 flex flex-col items-center justify-center p-6">
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
                <SelectItem value="trip" className="font-bold py-3">TRIP ID</SelectItem>
                <SelectItem value="sales" className="font-bold py-3">SALES ORDER NO.</SelectItem>
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
              className="h-16 rounded-2xl font-black text-center text-slate-700 bg-slate-50 border-slate-100 placeholder:text-slate-300 text-lg uppercase tracking-wider focus:ring-blue-600 transition-all"
            />
          </div>

          <Button
            onClick={handleTrack}
            className="w-full h-16 bg-blue-900 hover:bg-black font-black uppercase text-xs tracking-[0.4em] rounded-2xl shadow-xl shadow-blue-900/30 transition-all active:scale-95 flex items-center justify-center gap-4"
          >
            <Search className="h-5 w-5" />
            Track Now
          </Button>
        </div>
      </div>
    </div>
  );
}
