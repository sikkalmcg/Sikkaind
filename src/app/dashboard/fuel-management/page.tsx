'use client';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FuelEntryForm from '@/components/dashboard/fuel-management/FuelEntryForm';
import FuelRecordTable from '@/components/dashboard/fuel-management/FuelRecordTable';
import { useToast } from '@/hooks/use-toast';
import type { FuelEntry } from '@/types';

export default function FuelManagementPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('entry');
  const [dataVersion, setDataVersion] = useState(0);

  const handleFuelEntrySaved = (data: Omit<FuelEntry, 'id'>) => {
    // Component now handles direct Firestore save
    setDataVersion(v => v + 1);
    setActiveTab('record');
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <h1 className="text-2xl font-semibold font-headline">Fuel Management</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="entry">Fuel Entry</TabsTrigger>
          <TabsTrigger value="record">Fuel Record</TabsTrigger>
        </TabsList>
        <TabsContent value="entry">
          <FuelEntryForm onSave={handleFuelEntrySaved} />
        </TabsContent>
        <TabsContent value="record">
          <FuelRecordTable key={dataVersion} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
