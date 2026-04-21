'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Truck, ShieldCheck, Loader2 } from 'lucide-react';
import { useLoading } from '@/context/LoadingContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { isLoading, setIsLoading } = useLoading();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Registry Handshake: Synchronize session with server
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid: userCredential.user.uid,
          email: userCredential.user.email 
        }),
      });

      const data = await response.json();
      router.push(data.redirect || '/dashboard');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication Failure",
        description: error.message || "Invalid credentials provided to the node.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-slate-200">
        <CardHeader className="text-center space-y-2 pb-8">
          <div className="mx-auto bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-tighter italic text-slate-900">
            Sikka Logistics Portal
          </CardTitle>
          <CardDescription className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
            Identity Authorization Node
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Operator Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="operator@sikka.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="h-12 border-slate-200 focus:ring-blue-600 rounded-xl font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Access Token</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="h-12 border-slate-200 focus:ring-blue-600 rounded-xl font-medium"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-[0.2em] transition-all active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Authorize Access"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-slate-100 pt-6 bg-slate-50/50 rounded-b-xl">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Secure Mission Handshake</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
