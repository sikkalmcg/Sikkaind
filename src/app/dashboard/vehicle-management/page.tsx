'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import OwnVehicleTab from '@/components/dashboard/vehicle-management/OwnVehicleTab';
// import ContractVehicleTab from '@/components/dashboard/vehicle-management/ContractVehicleTab';

export default function VehicleManagementPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <h1 className="text-2xl font-semibold font-headline text-blue-900 uppercase tracking-tight">Vehicle Management</h1>
      {/* <Tabs defaultValue="own-vehicle" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="own-vehicle" className="font-bold uppercase text-xs">Own Vehicle</TabsTrigger>
          <TabsTrigger value="contract-vehicle" className="font-bold uppercase text-xs">Contract Vehicle</TabsTrigger>
        </TabsList>
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <TabsContent value="own-vehicle">
                <OwnVehicleTab />
            </TabsContent>
            <TabsContent value="contract-vehicle">
                <ContractVehicleTab />
            </TabsContent>
        </div>
      </Tabs> */}
    </main>
  );
}
