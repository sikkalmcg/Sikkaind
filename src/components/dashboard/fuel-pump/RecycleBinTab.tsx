'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { WithId, RecycledItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface RecycleBinTabProps {
  recycledItems: WithId<RecycledItem>[];
  onRestore: (itemId: string) => void;
  onDelete: (itemId: string) => void;
}

export default function RecycleBinTab({ recycledItems, onRestore, onDelete }: RecycleBinTabProps) {
  const { toast } = useToast();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recycle Bin</CardTitle>
        <CardDescription>Restore or permanently delete removed items.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deleted From</TableHead>
                <TableHead>Item Details</TableHead>
                <TableHead>Deleted By</TableHead>
                <TableHead>Deleted At</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recycledItems.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">The recycle bin is empty.</TableCell></TableRow>
              ) : (
                recycledItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.pageName}</TableCell>
                    <TableCell>
                        <div className='text-sm'>
                            {item.data.type === 'FuelPump' && `Pump: ${item.data.name}`}
                            {item.data.type === 'FuelPayment' && `Payment for ${item.data.pumpName}: ${item.data.paidAmount.toLocaleString('en-IN')}`}
                        </div>
                    </TableCell>
                    <TableCell>{item.userName}</TableCell>
                    <TableCell>{format(new Date(item.deletedAt), 'PPpp')}</TableCell>
                    <TableCell className="text-right space-x-2">
                       <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="outline" size="sm">Restore</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will restore the item to its original location.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onRestore(item.id)}>Restore</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete Permanently</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone and will permanently delete the data.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(item.id)}>Confirm Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
