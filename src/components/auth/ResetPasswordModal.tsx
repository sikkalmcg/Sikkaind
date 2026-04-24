'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShieldCheck, KeyRound, AlertTriangle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, serverTimestamp, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isForced?: boolean;
}

const passwordSchema = z.string().min(8, { message: 'Password must be at least 8 characters.' })
  .regex(/[A-Z]/, { message: 'Must contain an uppercase letter.' })
  .regex(/[a-z]/, { message: 'Must contain a lowercase letter.' })
  .regex(/[0-9]/, { message: 'Must contain a number.' })
  .regex(/[^A-Za-z0-9]/, { message: 'Must contain at least one special character (@#$%&*!).' });

const formSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required.'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type FormValues = z.infer<typeof formSchema>;

export default function ResetPasswordModal({ isOpen, onClose, isForced = false }: ResetPasswordModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const { isSubmitting } = form.formState;

  const handleResetPassword = async (values: FormValues) => {
    if (!firestore) return;
    setError(null);

    try {
      let userDocRef = null;
      let isSuperAdmin = false;

      // --- IDENTITY RESOLUTION HANDSHAKE ---
      if (user) {
        // Mode 1: Logged in (Forced Expiry Node)
        userDocRef = doc(firestore, "users", user.uid);
        isSuperAdmin = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
      } else {
        // Mode 2: Link Click (Pre-Auth Node)
        const lastIdentity = localStorage.getItem('slmc_last_identity');
        if (!lastIdentity) {
            setError("IDENTITY UNKNOWN. Please enter your username on the login screen first.");
            return;
        }

        let searchEmail = lastIdentity;
        if (!searchEmail.includes('@')) {
            const username = lastIdentity.toLowerCase();
            searchEmail = username === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${username}@sikka.com`;
        }

        isSuperAdmin = searchEmail === 'sikkaind.admin@sikka.com';

        const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            userDocRef = snap.docs[0].ref;
        }
      }

      if (!userDocRef) {
          setError("USER REGISTRY NOT FOUND. Please verify your identity.");
          return;
      }

      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
          setError("SECURITY CONTEXT ERROR. Identity not recognized.");
          return;
      }

      const registryData = userSnap.data();
      
      // --- REGISTRY BOOTSTRAP HANDSHAKE ---
      const storedPassword = registryData.password;
      const inputPassword = values.oldPassword;

      let isPasswordValid = inputPassword === storedPassword;
      
      if (!isPasswordValid && isSuperAdmin && !storedPassword) {
          if (inputPassword === 'Sikka@lmc2105') {
              isPasswordValid = true;
          }
      }

      if (!isPasswordValid) {
          setError("INCORRECT OLD PASSWORD. Registry match failed.");
          return;
      }

      // --- COMMITMENT NODE ---
      const updateData = {
        password: values.newPassword,
        passwordUpdatedAt: serverTimestamp(),
        lastPasswordChange: new Date().toISOString()
      };

      updateDoc(userDocRef, updateData)
        .then(() => {
            toast({
                title: 'Registry Updated',
                description: 'Your password has been successfully reset in the cloud.',
            });
            // Finalize and close terminal
            form.reset();
            setError(null);
            onClose();
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: userDocRef!.path,
                operation: 'update',
                requestResourceData: updateData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });

    } catch (e: any) {
      console.error("Password Update Error:", e);
      setError(e.message || 'Registry commitment failure.');
    }
  };

  const handleClose = () => {
    form.reset();
    setError(null);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border-none shadow-3xl p-0 overflow-hidden bg-white">
        <DialogHeader className="p-8 bg-slate-900 text-white flex flex-row items-center gap-5 space-y-0">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl">
                <KeyRound className="h-8 w-8 text-white" />
            </div>
            <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">
                    {isForced ? "MANDATORY PASSWORD RESET" : "PASSWORD RESET"}
                </DialogTitle>
                <DialogDescription className="text-blue-300 font-bold uppercase text-[9px] tracking-widest mt-1">
                    Security Policy Node: 60-Day Rotation
                </DialogDescription>
            </div>
        </DialogHeader>

        <div className="p-8 space-y-6">
            {isForced && (
                <Alert className="bg-red-50 border-red-100 text-red-800 rounded-xl flex items-center gap-3 shadow-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <AlertDescription className="text-[10px] font-black uppercase leading-tight">
                        Your session has expired (60 days limit). Please rotate your credentials to re-establish mission access.
                    </AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive" className="rounded-xl border-red-100 bg-red-50 text-red-800 shadow-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-[10px] font-black uppercase">{error}</AlertDescription>
                </Alert>
            )}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleResetPassword)} className="space-y-6">
                    <FormField name="oldPassword" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Old Password *</FormLabel>
                            <FormControl><Input type="password" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold shadow-inner" /></FormControl>
                            <FormMessage className="text-[9px] font-black uppercase" />
                        </FormItem>
                    )} />
                    
                    <FormField name="newPassword" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-blue-600 tracking-widest">New Secure Password *</FormLabel>
                            <FormControl><Input type="password" {...field} className="h-12 rounded-xl border-blue-200 focus-visible:ring-blue-900 shadow-sm font-bold" /></FormControl>
                            <FormMessage className="text-[9px] font-black uppercase" />
                        </FormItem>
                    )} />

                    <FormField name="confirmPassword" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Confirm Password *</FormLabel>
                            <FormControl><Input type="password" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold shadow-inner" /></FormControl>
                            <FormMessage className="text-[9px] font-black uppercase" />
                        </FormItem>
                    )} />

                    <DialogFooter className="pt-6 border-t flex flex-row justify-end gap-3 bg-slate-50 -mx-8 -mb-8 p-6">
                        <Button type="button" variant="ghost" onClick={handleClose} className="font-bold text-slate-400 uppercase text-[10px] tracking-widest px-8">
                            Discard
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="bg-blue-900 hover:bg-slate-900 px-10 h-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-blue-100 transition-all active:scale-95 border-none"
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                            Update Password
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
