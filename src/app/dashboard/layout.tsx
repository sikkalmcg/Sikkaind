
'use client';

import { ReactNode, useEffect, useState, Suspense, useMemo } from "react";
import { useUser, useAuth, useFirestore } from "@/firebase";
import { useRouter, usePathname } from "next/navigation";
import LogisticsHeader from "@/components/dashboard/layout/LogisticsHeader";
import LogisticsSidebar from "@/components/dashboard/layout/LogisticsSidebar";
import { useLoading } from "@/context/LoadingContext";
import { doc, getDoc } from "firebase/firestore";
import type { SubUser } from "@/types";
import { SikkaLogisticsPagePermissions, AdminPagePermissionsList, SikkaAccountsPagePermissions } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { handleFirestoreError, OperationType } from "@/lib/utils";

/**
 * @fileOverview Dashboard Layout Plant.
 * Manages core authorization pulse and sidebar/header integration.
 * Updated: Enforces strict READ-ONLY pathing for Client nodes.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthorizing, setIsVerifying] = useState(true);
  const [userProfile, setUserProfile] = useState<SubUser | null>(null);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

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

    const verifyAccess = async () => {
        if (!firestore) return;
        setIsVerifying(true);
        try {
            const isRoot = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';
            const searchEmail = user.email;
            if (!searchEmail) throw new Error("User email not available.");
            
            const userDocRef = doc(firestore, "users", searchEmail);
            const userDocSnap = await getDoc(userDocRef).catch(e => {
                handleFirestoreError(e, OperationType.GET, userDocRef.path);
                throw e;
            });

            if (!userDocSnap.exists()) {
                if (!isRoot) router.replace('/modules');
                else { setIsVerifying(false); hideLoader(); }
                return;
            }

            const profile = userDocSnap.data() as SubUser;
            setUserProfile(profile);

            // CLIENT ENFORCEMENT Node: Only allow Trip Board access for Client Role
            if (profile.jobRole === 'Client') {
                if (pathname !== '/dashboard/trip-board' && !pathname.startsWith('/dashboard/tracking/')) {
                    router.replace('/dashboard/trip-board');
                    return;
                }
                setIsVerifying(false);
                hideLoader();
                return;
            }

            const isFullAdmin = isRoot || profile.username?.toLowerCase() === 'sikkaind';

            if (isFullAdmin) {
                setIsVerifying(false);
                hideLoader();
                return;
            }

            const currentSubPage = pathname.split('/').pop();
            const allPerms = [...SikkaLogisticsPagePermissions, ...SikkaAccountsPagePermissions, ...AdminPagePermissionsList];
            const matchingPerm = allPerms.find(p => p.id === currentSubPage || pathname.endsWith(`/${p.id}`));
            
            if (matchingPerm && !profile.permissions?.includes(matchingPerm.id)) {
                router.replace('/dashboard');
                return;
            }
        } catch (e) {
            router.replace('/modules');
        } finally {
            setIsVerifying(false);
            hideLoader();
        }
    };

    verifyAccess();
  }, [user, isUserLoading, router, firestore, pathname, showLoader, hideLoader]);

  if (isUserLoading || isAuthorizing || !user) {
    return (
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden flex-col items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-900" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-4">Verifying Credentials Registry...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <LogisticsSidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div className="h-16 border-b bg-white w-full animate-pulse" />}>
          <LogisticsHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        </Suspense>

        <main className="flex-1 relative overflow-hidden bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
