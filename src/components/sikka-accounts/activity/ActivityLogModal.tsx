'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockActivityLog } from '@/lib/mock-data';
import type { WithId, Activity } from '@/types';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActivityLogModal({ isOpen, onClose }: ActivityLogModalProps) {
    const [activities, setActivities] = useState<WithId<Activity>[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setTimeout(() => {
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const recentActivities = mockActivityLog
                    .filter(log => new Date(log.timestamp) > sevenDaysAgo)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setActivities(recentActivities);
                setLoading(false);
            }, 300);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>User Activity</DialogTitle>
                    <DialogDescription>Your activity from the last 7 days.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>T-Code</TableHead>
                                <TableHead>Page Name</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin" /></TableCell></TableRow>
                            ) : activities.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">No recent activity found.</TableCell></TableRow>
                            ) : (
                                activities.map(log => (
                                    <TableRow key={log.id}>
                                        <TableCell>{format(new Date(log.timestamp), 'PP')}</TableCell>
                                        <TableCell>{format(new Date(log.timestamp), 'p')}</TableCell>
                                        <TableCell>{log.tcode}</TableCell>
                                        <TableCell>{log.pageName}</TableCell>
                                        <TableCell>{log.action}</TableCell>
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
