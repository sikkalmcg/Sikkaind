
'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  ArrowLeft,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useUser, useAuth, useFirestore } from '@/firebase';
import { useLoading } from "@/context/LoadingContext";
import { doc, getDoc, query, collection, where, limit, getDocs } from "firebase/firestore";
import type { SubUser } from "@/types";

export default function UserManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { showLoader, hideLoader } = useLoading();
  const [isAuthorizing, setIsVerifying] = useState(true);
  
  useEffect(() => {
    if (isUserLoading) {
      showLoader();
      return;
    }
    
    if (!user) {
      hideLoader();
      router.replace('/login');
      return;
    }

    const verifyAdminAccess = async () => {
        if (!firestore) return;
        setIsVerifying(true);
        try {
            const lastIdentity = localStorage.getItem('slmc_last_identity');
            const searchEmail = user.email || (lastIdentity?.includes('@') ? lastIdentity : `${lastIdentity}@sikka.com`);
            
            let userDocSnap = null;
            const q = query(collection(firestore, "users"), where("email", "==", searchEmail), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                userDocSnap = qSnap.docs[0];
            } else {
                const directRef = doc(firestore, "users", user.uid);
                const directSnap = await getDoc(directRef);
                if (directSnap.exists()) userDocSnap = directSnap;
            }

            const isRoot = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            if (!userDocSnap) {
                if (!isRoot) router.replace('/modules');
                return;
            }

            const profile = userDocSnap.data() as SubUser;
            const canManageUsers = isRoot || profile.username?.toLowerCase() === 'sikkaind' || profile.jobRole === 'Manager' || profile.jobRole === 'Admin';

            if (!canManageUsers) {
                router.replace('/modules');
                return;
            }

        } catch (e) {
            router.replace('/modules');
        } finally {
            setIsVerifying(false);
            hideLoader();
        }
    };

    verifyAdminAccess();
  }, [user, isUserLoading, router, firestore, showLoader, hideLoader]);

  const handleLogout = () => {
    if (auth) {
      auth.signOut();
    }
  };

  if (isUserLoading || isAuthorizing || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background flex-col gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Node Verification...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 animate-in fade-in duration-500">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/modules"
            className="flex items-center gap-2 text-lg font-semibold md:text-base group"
          >
            <ArrowLeft className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            <span className="font-black uppercase tracking-tight text-slate-600 group-hover:text-slate-900 transition-colors">Module Terminal</span>
          </Link>
        </nav>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <div className="ml-auto flex-1 sm:flex-initial">
             <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-blue-900 font-black text-[10px] uppercase shadow-sm">
                 <ShieldAlert className="h-3 w-3" /> Root Authorization Node
             </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="font-bold uppercase text-xs h-9 rounded-xl border-slate-200">
            Log out Registry
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {children}
      </main>
    </div>
  );
}
