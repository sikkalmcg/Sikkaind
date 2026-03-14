'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, UserCircle, KeyRound, Info, Upload, Save } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Separator } from '@/components/ui/separator';
import { doc, updateDoc, getDoc, query, collection, where, limit, getDocs, serverTimestamp } from 'firebase/firestore';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoUpdate: (url: string) => void;
  currentAvatar: string | null | undefined;
}

const MAX_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const profileSchema = z.object({
  photo: z.any().optional()
    .refine((files) => !files || files?.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max image size is 1.5MB.`)
    .refine(
      (files) => !files || files?.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
  oldPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
  if (data.oldPassword || data.newPassword || data.confirmPassword) {
    return data.oldPassword && data.newPassword && data.confirmPassword;
  }
  return true;
}, {
  message: "All password fields are required to change password.",
  path: ["oldPassword"],
})
.refine(data => {
  if (data.newPassword) {
    return data.newPassword.length >= 6;
  }
  return true;
}, {
  message: "New password must be at least 6 characters.",
  path: ["newPassword"],
})
.refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match.",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof profileSchema>;

export default function UserProfileModal({ isOpen, onClose, onPhotoUpdate, currentAvatar }: UserProfileModalProps) {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const isAdmin = user?.email === 'sikkalmcg@gmail.com' || user?.email === 'sikkaind.admin@sikka.com';
  const displayName = isAdmin ? 'AJAY SOMRA' : user?.displayName || user?.email?.split('@')[0] || 'User';
  const username = isAdmin ? 'Sikkaind' : user?.email?.split('@')[0] || 'User';

  const form = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { photo: undefined, oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        form.setValue('photo', event.target.files);
        setPhotoPreview(URL.createObjectURL(file));
    }
  }

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !user) return;

    if (values.photo && values.photo.length > 0) {
        const file = values.photo[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;
            
            try {
                const lastIdentity = localStorage.getItem('slmc_last_identity');
                const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
                
                let userDocRef = null;
                const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) {
                    userDocRef = qSnap.docs[0].ref;
                } else {
                    userDocRef = doc(firestore, "users", user.uid);
                }

                await updateDoc(userDocRef, {
                    photoURL: dataUrl,
                    lastProfileUpdateAt: serverTimestamp()
                });

                onPhotoUpdate(dataUrl);
                toast({ title: "Success", description: "Profile photo updated in mission registry." });
            } catch (err) {
                console.error("Profile Sync Error:", err);
                toast({ variant: 'destructive', title: "Sync Error", description: "Failed to persist photo to cloud node." });
            }
        };
        reader.readAsDataURL(file);
    }

    if (values.newPassword) {
        toast({ title: "Success", description: "Password change protocol initiated (Simulation)." });
    }

    if ((values.photo && values.photo.length > 0) || values.newPassword) {
      handleClose();
      return;
    }

    if (!values.photo?.length && !values.newPassword) {
        toast({ title: "No Changes", description: "No new data nodes provided for update." });
        return;
    }
  };
  
  const handleClose = () => {
    form.reset();
    setPhotoPreview(null);
    onClose();
  }

  if (!user) return null;

  const displayAvatarUrl = photoPreview || currentAvatar;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl border-none shadow-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight text-blue-900">Operator Profile</DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">View and manage authorized registry identity</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-1 space-y-8">
                    <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2 border-b pb-2"><UserCircle className="h-4 w-4 text-blue-600"/> Profile Information</h3>
                    <FormField
                        control={form.control}
                        name="photo"
                        render={({ field }) => (
                            <FormItem className="flex flex-col items-center text-center">
                                <FormLabel htmlFor='photo-upload' className="cursor-pointer group relative">
                                    <Avatar className="h-40 w-40 ring-4 ring-slate-100 transition-all group-hover:ring-blue-100">
                                        <AvatarImage src={displayAvatarUrl || undefined} alt="User Avatar" className="object-cover" />
                                        <AvatarFallback className="bg-slate-100 text-slate-400 text-4xl font-black">{displayName[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Upload className="h-8 w-8 text-white" />
                                    </div>
                                </FormLabel>
                                <FormControl>
                                    <Input id="photo-upload" type="file" className="hidden" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={handlePhotoChange} />
                                </FormControl>
                                <Button type="button" variant="link" asChild className="mt-4"><label htmlFor="photo-upload" className="cursor-pointer font-black uppercase text-[10px] tracking-widest text-blue-600 hover:text-blue-800">Change Registry Photo</label></Button>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <div className="space-y-3 pt-4">
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-400">Full Name</span> <span className="text-xs font-black text-slate-900 uppercase">{displayName}</span></div>
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-400">Username</span> <span className="text-xs font-bold text-blue-700 font-mono">@{username}</span></div>
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-400">Job Role</span> <span className="text-xs font-black text-slate-800 uppercase italic">{isAdmin ? 'Master Administrator' : 'Registry Operator'}</span></div>
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-400">Registry Phone</span> <span className="text-xs font-mono font-bold">8860091900</span></div>
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-400">Status</span> <Badge className="bg-emerald-600 font-black uppercase text-[9px]">Active</Badge></div>
                    </div>
                </div>

                <div className="md:col-span-2 space-y-10">
                    <div className="space-y-6">
                        <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2 border-b pb-2"><KeyRound className="h-4 w-4 text-blue-600"/> Security Credentials</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <FormField control={form.control} name="oldPassword" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-slate-400">Current Password</FormLabel><FormControl><Input type="password" {...field} className="h-11 rounded-xl bg-slate-50 border-slate-200" /></FormControl><FormMessage /></FormItem>)} />
                             <div className="hidden md:block" />
                             <FormField control={form.control} name="newPassword" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">New Password</FormLabel><FormControl><Input type="password" {...field} className="h-11 rounded-xl border-blue-200" /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase text-blue-600">Confirm New</FormLabel><FormControl><Input type="password" {...field} className="h-11 rounded-xl border-blue-200" /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                     <Separator className="opacity-50" />
                    <div className="space-y-6">
                        <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2 border-b pb-2"><Info className="h-4 w-4 text-blue-600"/> System Telemetry</h3>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Session Established</p><p className="text-xs font-bold text-slate-800">{new Date().toLocaleString()}</p></div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Security Node</p><p className="text-xs font-black text-blue-900 uppercase">PROD-01-SIL</p></div>
                        </div>
                    </div>
                </div>
            </div>

            <DialogFooter className="pt-8 border-t bg-slate-50 -mx-6 -mb-6 p-6 flex-row justify-end gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="font-black uppercase text-[10px] tracking-widest text-slate-400 px-8 h-12">Discard Changes</Button>
              <Button type="submit" disabled={form.formState.isSubmitting} className="bg-blue-900 hover:bg-slate-900 px-12 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 border-none">
                {form.formState.isSubmitting ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                Commit Identity Update
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
