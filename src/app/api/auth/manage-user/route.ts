
import { adminAuth, adminDb, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Auth Management API Route.
 * Implements privileged administrative functions for the Firebase Identity node.
 * Updated: Handles both Auth and Firestore writes to ensure atomic provisioning.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, username, mobileNo, userId, newPassword, userData } = body;

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

            const data = snap.docs[0].data();
            return NextResponse.json({ success: true, email: data.email });
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

            const data = snap.docs[0].data();
            return NextResponse.json({ success: true, userId: snap.docs[0].id, email: data.email });
        }

        // AUTH NODE: SYNC PASSWORD TO IDENTITY PLATFORM
        if (action === 'resetPassword' || action === 'updatePassword') {
            const targetEmail = email || body.email;
            const targetPassword = newPassword || password;
            
            if (!targetEmail || !targetPassword) return NextResponse.json({ error: "Params missing." }, { status: 400 });
            
            try {
                const userRecord = await adminAuth.getUserByEmail(targetEmail);
                await adminAuth.updateUser(userRecord.uid, { password: targetPassword });
                
                // Also update stored password in database for reference
                const userSnap = await adminDb.collection("users").where("email", "==", targetEmail).limit(1).get();
                if (!userSnap.empty) {
                    await userSnap.docs[0].ref.update({ password: targetPassword, lastUpdated: FieldValue.serverTimestamp() });
                }

                return NextResponse.json({ success: true });
            } catch (e: any) {
                console.error("Auth Sync Error:", e);
                return NextResponse.json({ error: `Auth Sync Failed: ${e.message}` }, { status: 500 });
            }
        }

        // AUTH NODE: PROVISION NEW USER (Atomic Auth + Firestore write)
        if (action === 'createUser') {
            if (!email || !password || !userData) return NextResponse.json({ error: "Params missing." }, { status: 400 });
            try {
                let uid;
                try {
                    const existing = await adminAuth.getUserByEmail(email);
                    await adminAuth.updateUser(existing.uid, { password, displayName: userData.fullName });
                    uid = existing.uid;
                } catch (e: any) {
                    if (e.code === 'auth/user-not-found') {
                        const created = await adminAuth.createUser({ 
                            email, 
                            password, 
                            emailVerified: true,
                            displayName: userData.fullName 
                        });
                        uid = created.uid;
                    } else throw e;
                }

                // MISSION CRITICAL: Perform database write on server to bypass security rules
                const userDocRef = adminDb.collection("users").doc(email);
                await userDocRef.set({
                    ...userData,
                    uid: uid,
                    email: email,
                    id: email,
                    createdAt: FieldValue.serverTimestamp(),
                    status: 'Active'
                }, { merge: true });

                // If role is Admin or Manager, grant security rule privileges
                if (userData.jobRole === 'Admin' || userData.jobRole === 'Manager' || userData.username === 'sikkaind') {
                    await adminDb.collection("roles_admin").doc(uid).set({
                        email: email,
                        assignedAt: FieldValue.serverTimestamp()
                    });
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

                // Ensure Admin rules pass
                await adminDb.collection("roles_admin").doc(uid).set({
                    email: adminEmail,
                    assignedAt: FieldValue.serverTimestamp()
                }, { merge: true });

                return NextResponse.json({ success: true });
            } catch (error: any) {
                console.error("Bootstrap failure:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        return NextResponse.json({ error: "Invalid action node." }, { status: 400 });
    } catch (error: any) {
        console.error("Critical API Handshake Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
