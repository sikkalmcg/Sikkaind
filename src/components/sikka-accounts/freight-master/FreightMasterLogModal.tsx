
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FreightMasterLog } from '@/types';
import { format } from 'date-fns';

interface FreightMasterLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: FreightMasterLog[];
}

export default function FreightMasterLogModal({ isOpen, onClose, logs }: FreightMasterLogModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit Log</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24">No history found.</TableCell></TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{log.user}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{format(new Date(log.timestamp), 'PPpp')}</TableCell>
                    <TableCell>{log.changes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
