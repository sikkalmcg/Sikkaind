'use client';

import { useState, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Truck, ShieldCheck, Factory, Loader2 } from 'lucide-react';
import VehicleRegistryTab from '@/components/dashboard/vehicle-management/VehicleRegistryTab';

/**
 * @fileOverview Vehicle Management Hub.
 * Master registry for all fleet assets categorized by operational node type.
 */
export default function VehicleManagementPage() {
  const [activeTab, setActiveTab] = useState('own-vehicle');

  return (
    <main className="flex flex-1 flex-col h-full bg-[#f8fafc] animate-in fade-in duration-500 overflow-hidden">
      <div className="sticky top-0 z-30 bg-white border-b px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-900 text-white rounded-2xl shadow-xl rotate-3">
            <Truck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight uppercase italic">Fleet Registry Hub</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Master Asset Node Configuration</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
          <TabsList className="bg-white border-b h-14 rounded-none gap-10 p-0 mb-8 w-full justify-start shadow-sm px-8">
            <TabsTrigger value="own-vehicle" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
              Own Fleet
            </TabsTrigger>
            <TabsTrigger value="contract-vehicle" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
              Contract Node
            </TabsTrigger>
            <TabsTrigger value="market-vehicle" className="data-[state=active]:border-b-4 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
              Market Node
            </TabsTrigger>
          </TabsList>

          <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-900" /></div>}>
            <div className="animate-in slide-in-from-bottom-2 duration-500">
              <TabsContent value="own-vehicle" className="m-0 focus-visible:ring-0">
                <VehicleRegistryTab type="Own Vehicle" />
              </TabsContent>
              <TabsContent value="contract-vehicle" className="m-0 focus-visible:ring-0">
                <VehicleRegistryTab type="Contract Vehicle" />
              </TabsContent>
              <TabsContent value="market-vehicle" className="m-0 focus-visible:ring-0">
                <VehicleRegistryTab type="Market Vehicle" />
              </TabsContent>
            </div>
          </Suspense>
        </Tabs>
      </div>
    </main>
  );
}
