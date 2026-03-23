'use client';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { FuelPump, WithId } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PumpHistoryTableProps {
  pumps: WithId<FuelPump>[];
  onEdit: (pump: WithId<FuelPump>) => void;
  onDelete: (pumpId: string) => void;
}

export default function PumpHistoryTable({ pumps, onEdit, onDelete }: PumpHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredPumps = pumps.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.mobile.includes(searchTerm) ||
    (p.pan && p.pan.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.paymentMethod && p.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved Pump History</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
            placeholder="Search pumps..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="mb-4 max-w-sm"
        />
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Pump Name</TableHead>
                        <TableHead>Owner Name</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>PAN</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredPumps.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No fuel pumps found in database.</TableCell></TableRow>
                    ) : (
                        filteredPumps.map(pump => (
                            <TableRow key={pump.id}>
                                <TableCell className="font-medium">{pump.name}</TableCell>
                                <TableCell>{pump.ownerName}</TableCell>
                                <TableCell>{pump.mobile}</TableCell>
                                <TableCell>{pump.pan}</TableCell>
                                <TableCell>{pump.paymentMethod || 'N/A'}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => onEdit(pump)}>Edit</Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="sm">Remove</Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete the pump record from the cloud database.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => onDelete(pump.id)}>Confirm</AlertDialogAction>
                                            </AlertDialogFooter>
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
