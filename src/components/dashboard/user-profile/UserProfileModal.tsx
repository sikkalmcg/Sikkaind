'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  User, 
  Mail, 
  Briefcase, 
  Factory, 
  ShieldCheck, 
  KeyRound,
  Save,
  Smartphone
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { SubUser, WithId } from '@/types';
import ResetPasswordModal from '@/components/auth/ResetPasswordModal';

const formSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters.'),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits.'),
});

type FormValues = z.infer<typeof formSchema>;

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: WithId<SubUser>;
  setUserProfile?: (profile: WithId<SubUser>) => void;
}

export default function UserProfileModal({ 
  isOpen, 
  onClose, 
  userProfile,
  setUserProfile 
}: UserProfileModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: userProfile.fullName || '',
      mobile: userProfile.mobile || '',
    },
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (isOpen && userProfile) {
      form.reset({
        fullName: userProfile.fullName || '',
        mobile: userProfile.mobile || '',
      });
    }
  }, [isOpen, userProfile, form]);

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !userProfile.id) return;

    try {
      const userRef = doc(firestore, 'users', userProfile.id);
      await updateDoc(userRef, {
        ...values,
        lastUpdated: serverTimestamp(),
      });

      if (setUserProfile) {
        setUserProfile({ ...userProfile, ...values });
      }

      toast({
        title: 'Profile Updated',
        description: 'Your profile particulars have been synchronized.',
      });
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update profile node.',
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl p-0 border-none shadow-3xl overflow-hidden bg-white rounded-[2rem]">
          <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <Avatar className="h-20 w-20 border-4 border-white/10 shadow-xl">
                  <AvatarImage src={userProfile.photoURL} alt={userProfile.fullName} />
                  <AvatarFallback className="bg-blue-600 text-white text-2xl font-black">
                    {userProfile.fullName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 h-5 w-5 rounded-full border-4 border-slate-900" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic leading-none">
                  {userProfile.fullName}
                </DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-[0.4em] mt-2">
                  @{userProfile.username} | {userProfile.jobRole || 'Mission Operator'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-10 space-y-10">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                          <User className="h-3 w-3" /> Full Name Registry
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className="h-12 rounded-xl font-bold border-slate-200 focus-visible:ring-blue-900" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                          <Smartphone className="h-3 w-3" /> Contact Node
                        </FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={10} className="h-12 rounded-xl font-mono font-bold border-slate-200" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Mail className="h-3 w-3" /> System Email
                    </p>
                    <p className="text-sm font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                      {userProfile.email}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Briefcase className="h-3 w-3" /> Organizational Role
                    </p>
                    <p className="text-sm font-black text-blue-900 uppercase bg-blue-50 p-3 rounded-xl border border-blue-100">
                      {userProfile.jobRole || 'Standard Operator'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <Factory className="h-3 w-3" /> Authorized Lifting Nodes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {userProfile.plantIds?.length ? (
                      userProfile.plantIds.map((id) => (
                        <Badge key={id} variant="secondary" className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] px-3 h-6">
                          NODE: {id}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No specific nodes assigned.</p>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsResetPasswordOpen(true)}
                    className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 border-slate-200"
                  >
                    <KeyRound className="h-4 w-4 text-blue-600" />
                    Reset Credentials
                  </Button>

                  <div className="flex gap-3 w-full md:w-auto">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={onClose} 
                      className="flex-1 md:flex-none font-bold text-slate-400 uppercase text-[10px]"
                    >
                      Discard
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex-1 md:flex-none bg-blue-900 hover:bg-black text-white px-10 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20 border-none transition-all active:scale-95"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Sync Profile
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      <ResetPasswordModal 
        isOpen={isResetPasswordOpen} 
        onClose={() => setIsResetPasswordOpen(false)} 
      />
    </>
  );
}
