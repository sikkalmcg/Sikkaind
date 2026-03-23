'use client';
import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WithId, MasterDataItem } from '@/types';
import { deleteMockMasterDataItem } from '@/lib/mock-data';
import ItemHistoryTable from '@/components/sikka-accounts/add-items/ItemHistoryTable';
import FreightMasterHistoryTable from '@/components/sikka-accounts/freight-master/FreightMasterHistoryTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from 'lucide-react';


function DisplayItemsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [dataVersion, setDataVersion] = useState(0);

    const refreshData = () => setDataVersion(v => v + 1);
    
    const handleEdit = (item: WithId<MasterDataItem>) => {
        router.push(`/sikka-accounts/master-data/add-items?id=${item.id}`);
    };

    const handleDelete = (itemId: string) => {
        deleteMockMasterDataItem(itemId);
        toast({ title: 'Item Removed', variant: 'destructive' });
        refreshData();
    };
    
    return (
        <div className="p-4 md:p-6 space-y-6">
             <Tabs defaultValue="material-master">
                <TabsList>
                    <TabsTrigger value="material-master">Material Master Data</TabsTrigger>
                    <TabsTrigger value="freight-master">Freight Master Data</TabsTrigger>
                </TabsList>
                <TabsContent value="material-master">
                    <ItemHistoryTable
                        key={`items-${dataVersion}`}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </TabsContent>
                <TabsContent value="freight-master">
                    <FreightMasterHistoryTable key={`freight-${dataVersion}`} />
                </TabsContent>
             </Tabs>
        </div>
    );
}

export default function DisplayItemsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <DisplayItemsPage />
    </Suspense>
  );
}
