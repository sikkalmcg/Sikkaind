'use client';

import { ReactNode, useEffect, useState, Suspense } from "react";
import { useUser, useFirestore } from "@/firebase";
import { useRouter, usePathname } from "next/navigation";
import LogisticsHeader from "@/components/dashboard/layout/LogisticsHeader";
import LogisticsSidebar from "@/components/dashboard/layout/LogisticsSidebar";
import { useLoading } from "@/context/LoadingContext";
import { doc, getDoc, query, collection, where, getDocs, limit } from "firebase/firestore";
import type { SubUser } from "@/types";
import { SikkaLogisticsPagePermissions, AdminPagePermissionsList, SikkaAccountsPagePermissions } from "@/lib/constants";
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
            const isRoot = user.email === 'sikkaind.admin@sikka.com' || user.email === 'sikkalmcg@gmail.com';

            // --- UNIFIED USER LOOKUP (SAME AS MODULES PAGE) ---
            const searchEmail = user.email;
            if (!searchEmail) {
                throw new Error("User email not available for access verification.");
            }
            
            const userDocSnap = await getDoc(doc(firestore, "users", searchEmail));

            if (!userDocSnap.exists()) {
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

            // 2. SUB-PAGE REGISTRY VALIDATION
            const currentSubPage = pathname.split('/').pop();
            const allPerms = [
                ...SikkaLogisticsPagePermissions, 
                ...SikkaAccountsPagePermissions,
                ...AdminPagePermissionsList
            ];
            
            const matchingPerm = allPerms.find(p => p.id === currentSubPage || pathname.endsWith(`/${p.id}`));
            
            if (matchingPerm && !profile.permissions?.includes(matchingPerm.id)) {
                router.replace('/dashboard');
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
