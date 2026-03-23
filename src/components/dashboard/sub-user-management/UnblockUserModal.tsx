'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { WithId, SubUser, UserStatus } from '@/types';

interface UnblockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: WithId<SubUser>;
  onSave: (userId: string, newPassword?: string) => void;
}

const passwordValidation = z.string().min(8, 'Password must be at least 8 characters long.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.');

const formSchema = z.object({
  newPassword: passwordValidation,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof formSchema>;

export default function UnblockUserModal({ isOpen, onClose, user, onSave }: UnblockUserModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const { formState: { isSubmitting } } = form;

  const onSubmit = (values: FormValues) => {
    onSave(user.id, values.newPassword);
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
        case 'Active': return 'bg-green-500/80';
        case 'Inactive': return 'bg-yellow-500/80 text-black';
        case 'Blocked': return 'bg-red-500/80';
        default: return 'bg-gray-500/80';
    }
}

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Unblock User</DialogTitle>
          <DialogDescription>Reset password to unblock the user account.</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-md">
          <div><p className="font-medium">Full Name:</p> <p>{user.fullName}</p></div>
          <div><p className="font-medium">Username:</p> <p>{user.username}</p></div>
          <div><p className="font-medium">Status:</p> <div><Badge className={getStatusColor(user.status)}>{user.status}</Badge></div></div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update & Unblock
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
