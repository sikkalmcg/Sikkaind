'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TCODE_DESCRIPTIONS } from '@/lib/sikka-accounts-constants';
import { addMockFavorite } from '@/lib/mock-data';

interface AddFavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFavoriteAdded: () => void;
}

const formSchema = z.object({
  tcode: z.string().min(1, 'T-Code is required.'),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddFavoriteModal({ isOpen, onClose, onFavoriteAdded }: AddFavoriteModalProps) {
    const { toast } = useToast();
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { tcode: '' },
    });

    const { formState: { isSubmitting } } = form;

    const onSubmit = (values: FormValues) => {
        const tcodeUpper = values.tcode.trim().toUpperCase();
        const description = TCODE_DESCRIPTIONS[tcodeUpper];

        if (!description) {
            toast({
                variant: 'destructive',
                title: 'Invalid T-Code',
                description: `Transaction code "${tcodeUpper}" is not valid.`,
            });
            return;
        }

        try {
            addMockFavorite(tcodeUpper, description);
            toast({
                title: 'Favorite Added',
                description: `"${description}" was added to your favorites.`,
            });
            onFavoriteAdded();
            onClose();
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message,
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Favorite</DialogTitle>
                    <DialogDescription>Enter a transaction code to add it to your favorites list.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="tcode"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Transaction Code</FormLabel>
                                    <FormControl><Input {...field} autoFocus /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
