
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import type { WithId, SubUser, Activity } from '@/types';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    user: WithId<SubUser>;
    date: Date;
    logs: Activity[];
  }
}

export default function ActivityLogModal({ isOpen, onClose, data }: ActivityLogModalProps) {
    const { user, date, logs } = data;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>User Activity Log</DialogTitle>
                    <DialogDescription>
                        Displaying activity for <span className="font-semibold">{user.fullName} ({user.username})</span> on <span className="font-semibold">{format(date, 'PPP')}</span>.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[60vh] rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">Time</TableHead>
                                <TableHead>Activity Log Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-24 text-center">
                                        No activity recorded for selected user on this date.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell className="font-mono">{format(new Date(log.timestamp), 'HH:mm:ss')}</TableCell>
                                        <TableCell>{log.description}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>

                <DialogFooter>
                    <Button onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
