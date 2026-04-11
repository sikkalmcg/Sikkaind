'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import type { FuelPayment, WithId, FuelPump } from '@/types';
import { format } from 'date-fns';

interface PaidRecordsTabProps {
  payments: WithId<FuelPayment>[];
  pumps: WithId<FuelPump>[];
  onPaymentDeleted: (paymentId: string) => void;
}

export default function PaidRecordsTab({ payments, pumps, onPaymentDeleted }: PaidRecordsTabProps) {
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paid Records</CardTitle>
        <CardDescription>History of all payments made to fuel pumps recorded in the cloud database.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Pump Name</TableHead>
                        <TableHead>Owner Name</TableHead>
                        <TableHead>Paid Amount</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Banking Ref</TableHead>
                        <TableHead>Payment Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payments.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No paid records found in the database.</TableCell></TableRow>
                    ) : (
                        payments.map(payment => {
                            const pump = pumps.find(p => p.id === payment.pumpId);
                            return (
                                <TableRow key={payment.id}>
                                    <TableCell className="font-medium text-primary">{pump?.name || 'N/A'}</TableCell>
                                    <TableCell>{pump?.ownerName || 'N/A'}</TableCell>
                                    <TableCell className="font-semibold">₹ {payment.paidAmount.toLocaleString('en-IN')}</TableCell>
                                    <TableCell>{payment.paymentMethod}</TableCell>
                                    <TableCell className="font-mono text-xs">{payment.bankingRef || 'N/A'}</TableCell>
                                    <TableCell>{format(new Date(payment.paymentDate), 'PP')}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => alert('Edit not implemented')}>Edit</Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm">Remove</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will move the record to the Recycle Bin. The pump balance and slip statuses will not be automatically reverted.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onPaymentDeleted(payment.id)}>Confirm</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
