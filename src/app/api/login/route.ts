
import { adminDb as db, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";
import type { SubUser } from "@/types";

/**
 * @fileOverview Login API Route.
 * Performs session establishment and identity resolution.
 */
export async function POST(req: NextRequest) {
    const { uid, email } = await req.json();

    if (!uid) {
        return NextResponse.json({ error: "UID must be provided." }, { status: 400 });
    }

    try {
        // Registry Handshake: Resolve by UID or Email (for bootstrapped accounts)
        let userSnap = await db.collection("users").doc(uid).get();
        
        if (!userSnap.exists && email) {
            userSnap = await db.collection("users").doc(email).get();
        }

        if (!userSnap.exists) {
            return NextResponse.json({ redirect: '/modules' });
        }

        const profile = userSnap.data() as SubUser;
        
        // Repair Node: Ensure UID is stored in the email-keyed document for accurate activity indexing
        if (userSnap.id === email && (profile as any).uid !== uid) {
            await db.collection("users").doc(email).update({ uid: uid });
        }

        // Log Activity Node
        await db.collection("activity_logs").add({
            userId: uid,
            userName: profile.fullName || profile.username,
            action: 'Login',
            tcode: 'SYS_AUTH',
            pageName: 'Login Registry',
            timestamp: FieldValue.serverTimestamp(),
            description: `Session established for operator @${profile.username}.`
        });

        const accessible = [];
        if (profile.access_logistics) accessible.push('/dashboard');
        if (profile.access_accounts) accessible.push('/sikka-accounts/dashboard');
        
        const isAdmin = profile.jobRole === 'Manager' || profile.jobRole === 'Admin' || profile.username?.toLowerCase() === 'sikkaind';
        if (isAdmin) accessible.push('/user-management');

        // Resolve Default Terminal
        if (profile.defaultModule === 'Logistics' && profile.access_logistics) return NextResponse.json({ redirect: '/dashboard' });
        if (profile.defaultModule === 'Accounts' && profile.access_accounts) return NextResponse.json({ redirect: '/sikka-accounts/dashboard' });
        if (profile.defaultModule === 'Administration' && isAdmin) return NextResponse.json({ redirect: '/user-management' });

        const redirect = accessible.length === 1 ? accessible[0] : '/modules';
        return NextResponse.json({ redirect });
    } catch (e) {
        console.error("Login API Failure:", e);
        return NextResponse.json({ redirect: '/modules' });
    }
}
