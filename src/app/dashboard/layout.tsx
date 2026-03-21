"use client";

import { ReactNode, useEffect, useState, Suspense } from "react";
import { useUser, useFirestore } from "@/firebase";
import { useRouter, usePathname } from "next/navigation";
import LogisticsHeader from "@/components/dashboard/layout/LogisticsHeader";
import LogisticsSidebar from "@/components/dashboard/layout/LogisticsSidebar";
import { useLoading } from "@/context/LoadingContext";
import { doc, query, collection, where, limit, getDocs, getDoc } from "firebase/firestore";
import type { SubUser } from "@/types";
import { SikkaLogisticsPagePermissions, AdminPagePermissionsList, SikkaAccountsPagePermissions, JobRoles } from "@/lib/constants";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { showLoader, hideLoader } = useLoading();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

    const verifyAccess = async () => {
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
                if (!isRoot) {
                    router.replace('/modules');
                } else {
                    setIsVerifying(false);
                    hideLoader();
                }
                return;
            }

            const profile = userDocSnap.data() as SubUser;
            const isFullAdmin = isRoot || profile.username?.toLowerCase() === 'sikkaind';

            if (isFullAdmin) {
                setIsVerifying(false);
                hideLoader();
                return;
            }

            // --- STRICT ACCESS CONTROL PROTOCOL ---
            
            // 1. PRIMARY MODULE AUTHORIZATION (LOGISTICS)
            if (!profile.access_logistics) {
                router.replace('/modules');
                return;
            }

            // 2. DASHBOARD AUTHORIZATION RULE
            // If user doesn't have 'live-dashboard' permission, they can't see the /dashboard page.
            if (pathname === '/dashboard' && !profile.permissions?.includes('live-dashboard')) {
                router.replace('/modules');
                return;
            }

            // 3. SUB-PAGE REGISTRY VALIDATION
            const currentSubPage = pathname.split('/').pop();
            const allPerms = [
                ...SikkaLogisticsPagePermissions, 
                ...SikkaAccountsPagePermissions,
                ...AdminPagePermissionsList
            ];
            
            const matchingPerm = allPerms.find(p => p.id === currentSubPage || pathname.endsWith(`/${p.id}`));
            
            if (matchingPerm && !profile.permissions?.includes(matchingPerm.id)) {
                // Determine graceful redirect node
                if (profile.permissions?.includes('live-dashboard')) {
                    router.replace('/dashboard');
                } else {
                    router.replace('/modules');
                }
                return;
            }

        } catch (e) {
            console.error("Access Verification Failure:", e);
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
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <LogisticsSidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div className="h-16 border-b bg-white w-full animate-pulse" />}>
          <LogisticsHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        </Suspense>

        <main className="flex-1 overflow-auto relative">
          <div className="h-full w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
