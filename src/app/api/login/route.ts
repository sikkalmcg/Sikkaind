
import { adminAuth, adminDb as db } from "@/lib/firebaseAdmin";
import { doc, getDoc, collection, query, where, getDocs, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { NextRequest, NextResponse } from "next/server";
import type { SubUser } from "@/types";

export async function POST(req: NextRequest) {
    const { uid } = await req.json();

    if (!uid) {
        return NextResponse.json({ error: "UID must be provided." }, { status: 400 });
    }

    try {
        const userDocRef = doc(db, "users", uid);
        let userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
            return NextResponse.json({ redirect: '/modules' });
        }

        const profile = userSnap.data() as SubUser;
        await addDoc(collection(db, "activity_logs"), {
            userId: uid,
            userName: profile.fullName || profile.username,
            action: 'Login',
            tcode: 'SYS_AUTH',
            pageName: 'Login Registry',
            timestamp: serverTimestamp(),
            description: `Session established for operator @${profile.username}.`
        });

        const accessible = [];
        if (profile.access_logistics) accessible.push('/dashboard');
        if (profile.access_accounts) accessible.push('/sikka-accounts/dashboard');
        
        const isAdmin = profile.jobRole === 'Manager' || profile.jobRole === 'Admin';
        if (isAdmin) accessible.push('/user-management');

        if (profile.defaultModule === 'Logistics' && profile.access_logistics) return NextResponse.json({ redirect: '/dashboard' });
        if (profile.defaultModule === 'Accounts' && profile.access_accounts) return NextResponse.json({ redirect: '/sikka-accounts/dashboard' });
        if (profile.defaultModule === 'Administration' && isAdmin) return NextResponse.json({ redirect: '/user-management' });

        const redirect = accessible.length === 1 ? accessible[0] : '/modules';
        return NextResponse.json({ redirect });
    } catch (e) {
        return NextResponse.json({ redirect: '/modules' });
    }
}
