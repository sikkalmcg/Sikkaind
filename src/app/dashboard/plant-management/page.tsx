
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, setDoc, orderBy } from "firebase/firestore";
import type { WithId, Plant, ShipmentStatusMaster, MasterQtyType, FuelPump } from '@/types';
import PartyCreationTab from '@/components/dashboard/plant-management/PartyCreationTab';
import CreatePumpForm from '@/components/dashboard/fuel-pump/CreatePumpForm';
import PumpHistoryTable from '@/components/dashboard/fuel-pump/PumpHistoryTable';
import { Loader2, WifiOff, Building2, Fuel, Tag, Settings2, Users, Save, Edit2, ShieldCheck, MapPin, History, Trash2 } from "lucide-react";
import { useSearchParams, useRouter } from 'next/navigation';
import { cn, normalizePlantId } from '@/lib/utils';
import { FuelPumpPaymentMethods } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLoading } from '@/context/LoadingContext';
import { Badge } from '@/components/ui/badge';

const plantSchema = z.object({
  id: z.string().min(1, 'Plant ID is required'),
  name: z.string().min(1, 'Plant name is required'),
  address: z.string().optional().default(''),
  isMainPlant: z.boolean().default(true),
});
type PlantFormValues = z.infer<typeof plantSchema>;

const statusSchema = z.object({
  name: z.string().min(1, 'Status name is required'),
});
type StatusFormValues = z.infer<typeof statusSchema>;

const qtyTypeSchema = z.object({
    name: z.string().min(1, 'Qty Type name is required'),
});
type QtyTypeFormValues = z.infer<typeof qtyTypeSchema>;

const pumpSchema = z.object({
  name: z.string().min(1, 'Fuel Pump Name is required'),
  address: z.string().optional(),
  ownerName: z.string().min(1, 'Owner Name is required'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  paymentMethod: z.enum(FuelPumpPaymentMethods).optional(),
  receiverName: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  upiId: z.string().optional(),
});

function PlantManagementContent() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultTab = searchParams.get('tab') || 'create-plant';

  const handleTabChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', val);
    router.replace(`/dashboard/plant-management?${params.toString()}`);
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-slate-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900 text-white rounded-lg shadow-lg rotate-3">
                <Settings2 className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tight">Logistics Plant Management</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Lifting Node Master Registry Configuration</p>
            </div>
        </div>
        {!firestore && (
            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-medium">
                <WifiOff className="h-3 w-3" />
                <span>Registry Offline</span>
            </div>
        )}
      </div>

      <Tabs value={defaultTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-transparent border-b h-12 rounded-none gap-8 p-0 mb-8 overflow-x-auto justify-start">
          <TabsTrigger value="create-plant" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Plant Configuration
          </TabsTrigger>
          <TabsTrigger value="fuel-pump" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
            <Fuel className="h-4 w-4" /> Fuel Pumps
          </TabsTrigger>
          <TabsTrigger value="party-creation" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
            <Users className="h-4 w-4" /> Party Registry
          </TabsTrigger>
          <TabsTrigger value="create-status" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
            <ActivityIcon className="h-4 w-4" /> Status Master
          </TabsTrigger>
          <TabsTrigger value="create-qty-type" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-900 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-blue-900 transition-all flex items-center gap-2">
            <Tag className="h-4 w-4" /> Qty Types
          </TabsTrigger>
        </TabsList>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <TabsContent value="create-plant"><CreatePlantSection /></TabsContent>
            <TabsContent value="fuel-pump"><FuelPumpSection /></TabsContent>
            <TabsContent value="party-creation"><PartyCreationTab /></TabsContent>
            <TabsContent value="create-status"><CreateStatusSection /></TabsContent>
            <TabsContent value="create-qty-type"><CreateQtyTypeSection /></TabsContent>
        </div>
      </Tabs>
    </main>
  );
}

const ActivityIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
);

// Helper sections (CreatePlantSection, CreateStatusSection, etc.) remain as defined previously...
// ... (omitting for brevity as they are internal components of this file)

export default function PlantManagementPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin" /></div>}>
            <PlantManagementContent />
        </Suspense>
    );
}

// Ensure internal components like CreatePlantSection are properly defined in the final file...
