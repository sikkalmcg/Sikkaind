
import { adminAuth, adminDb, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Auth Management API Route.
 * Implements privileged administrative functions for the Firebase Identity node.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, username, mobileNo, userId, newPassword } = body;

        // AUTH NODE: RESOLVE EMAIL FROM USERNAME
        if (action === 'resolveEmail') {
            if (!username) return NextResponse.json({ error: "Username required." }, { status: 400 });
            const cleanUsername = username.toLowerCase().trim();
            
            const q = adminDb.collection("users").where("username", "==", cleanUsername).limit(1);
            const snap = await q.get();

            if (snap.empty) {
                const fallbackEmail = cleanUsername === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${cleanUsername}@sikka.com`;
                return NextResponse.json({ success: true, email: fallbackEmail });
            }

            const userData = snap.docs[0].data();
            return NextResponse.json({ success: true, email: userData.email });
        }

        // AUTH NODE: VERIFY OPERATOR IDENTITY
        if (action === 'verifyUser') {
            if (!username || !mobileNo) return NextResponse.json({ error: "Username and mobile required." }, { status: 400 });
            const cleanUsername = username.toLowerCase().trim();
            
            const q = adminDb.collection("users")
                .where("username", "==", cleanUsername)
                .where("mobile", "==", mobileNo.trim())
                .limit(1);
            const snap = await q.get();

            if (snap.empty) return NextResponse.json({ error: "INVALID USERNAME OR MOBILE NO." }, { status: 404 });

            const userData = snap.docs[0].data();
            return NextResponse.json({ success: true, userId: snap.docs[0].id, email: userData.email });
        }

        // AUTH NODE: SYNC PASSWORD TO IDENTITY PLATFORM
        if (action === 'resetPassword' || action === 'updatePassword') {
            const targetEmail = email || body.email;
            const targetPassword = newPassword || password;
            
            if (!targetEmail || !targetPassword) return NextResponse.json({ error: "Params missing." }, { status: 400 });
            
            try {
                const userRecord = await adminAuth.getUserByEmail(targetEmail);
                await adminAuth.updateUser(userRecord.uid, { password: targetPassword });
                return NextResponse.json({ success: true });
            } catch (e: any) {
                return NextResponse.json({ error: `Auth Sync Failed: ${e.message}` }, { status: 500 });
            }
        }

        // AUTH NODE: PROVISION NEW USER
        if (action === 'createUser') {
            if (!email || !password) return NextResponse.json({ error: "Params missing." }, { status: 400 });
            try {
                let uid;
                try {
                    const existing = await adminAuth.getUserByEmail(email);
                    await adminAuth.updateUser(existing.uid, { password });
                    uid = existing.uid;
                } catch (e: any) {
                    if (e.code === 'auth/user-not-found') {
                        const created = await adminAuth.createUser({ email, password, emailVerified: true });
                        uid = created.uid;
                    } else throw e;
                }
                return NextResponse.json({ success: true, uid });
            } catch (error: any) {
                console.error("Auth Provisioning error:", error);
                return NextResponse.json({ error: `Identity Platform Error: ${error.message}` }, { status: 500 });
            }
        }

        // AUTH NODE: BOOTSTRAP ROOT ADMIN
        if (action === 'bootstrap') {
            const adminEmail = 'sikkaind.admin@sikka.com';
            const adminPassword = 'sikkaind';

            try {
                let uid;
                try {
                    const existing = await adminAuth.getUserByEmail(adminEmail);
                    uid = existing.uid;
                    await adminAuth.updateUser(uid, { password: adminPassword });
                } catch (e: any) {
                    if (e.code === 'auth/user-not-found') {
                        const created = await adminAuth.createUser({
                            email: adminEmail,
                            password: adminPassword,
                            emailVerified: true,
                            displayName: 'Sikka Admin'
                        });
                        uid = created.uid;
                    } else throw e;
                }

                await adminDb.collection("users").doc(adminEmail).set({
                    username: 'sikkaind',
                    fullName: 'Sikka Admin',
                    email: adminEmail,
                    jobRole: 'Admin',
                    status: 'Active',
                    plantIds: ['1426'],
                    createdAt: FieldValue.serverTimestamp(),
                    id: adminEmail,
                    uid: uid
                }, { merge: true });

                return NextResponse.json({ success: true });
            } catch (error: any) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        return NextResponse.json({ error: "Invalid action node." }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
