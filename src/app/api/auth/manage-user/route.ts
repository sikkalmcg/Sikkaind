
import { adminAuth as auth, adminDb as db, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Atomic Identity Provisioning API.
 * Ensures consistent JSON responses to prevent browser-side "Unexpected token <" errors.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, userData, username, mobile } = body;

        // REGISTRY HANDSHAKE Node: Verify SDK initialization
        if (!auth || !db) {
            return NextResponse.json({ 
                error: "Security Node Offline: Admin SDK failed to initialize. Please check environment credentials." 
            }, { status: 503 });
        }

        // AUTH NODE: PROVISION NEW USER + SYNC REGISTRY
        if (action === 'createUser') {
            if (!email || !password) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
            
            let uid;
            try {
                const existing = await auth.getUserByEmail(email);
                await auth.updateUser(existing.uid, { password });
                uid = existing.uid;
            } catch (e: any) {
                if (e.code === 'auth/user-not-found') {
                    const created = await auth.createUser({ 
                        email, 
                        password, 
                        emailVerified: true,
                        displayName: userData?.fullName || email.split('@')[0]
                    });
                    uid = created.uid;
                } else throw e;
            }

            const userRef = db.collection("users").doc(email);
            const finalUserData = {
                ...userData,
                uid,
                email,
                status: 'Active',
                createdAt: FieldValue.serverTimestamp(),
                lastUpdated: FieldValue.serverTimestamp()
            };
            await userRef.set(finalUserData, { merge: true });

            if (userData?.jobRole === 'Admin' || userData?.jobRole === 'Manager' || userData?.username === 'sikkaind') {
                await db.collection("roles_admin").doc(uid).set({
                    email,
                    role: userData.jobRole || 'Admin',
                    authorizedAt: FieldValue.serverTimestamp()
                });
            }

            return NextResponse.json({ success: true, uid });
        }

        // AUTH NODE: IDENTIFY OPERATOR FOR RECOVERY
        if (action === 'verifyUser') {
            const q = await db.collection("users")
                .where("username", "==", String(username).toLowerCase())
                .where("mobile", "==", mobile)
                .limit(1)
                .get();

            if (q.empty) {
                return NextResponse.json({ error: "Operator identity not recognized." }, { status: 404 });
            }

            return NextResponse.json({ success: true, email: q.docs[0].data().email });
        }

        // AUTH NODE: AUTHORIZED PASSWORD RESET
        if (action === 'resetPassword') {
            const q = await db.collection("users").where("email", "==", email).limit(1).get();
            if (q.empty) return NextResponse.json({ error: "Registry node missing." }, { status: 404 });

            const userDoc = q.docs[0];
            const uid = userDoc.data().uid;

            if (uid) {
                await auth.updateUser(uid, { password });
                await userDoc.ref.update({ 
                    password, 
                    lastPasswordChange: new Date().toISOString(),
                    lastUpdated: FieldValue.serverTimestamp()
                });
                return NextResponse.json({ success: true });
            }
            throw new Error("UID handshake failed.");
        }

        // AUTH NODE: BOOTSTRAP ROOT ADMIN
        if (action === 'bootstrap') {
            const adminEmail = 'sikkaind.admin@sikka.com';
            const adminPassword = 'sikkaind';

            let uid;
            try {
                const existing = await auth.getUserByEmail(adminEmail);
                uid = existing.uid;
                await auth.updateUser(uid, { password: adminPassword });
            } catch (e: any) {
                const created = await auth.createUser({
                    email: adminEmail,
                    password: adminPassword,
                    emailVerified: true,
                    displayName: 'Sikka Admin'
                });
                uid = created.uid;
            }

            await db.collection("users").doc(adminEmail).set({
                username: 'sikkaind',
                fullName: 'Sikka Admin',
                email: adminEmail,
                jobRole: 'Admin',
                status: 'Active',
                plantIds: ['1426'],
                createdAt: FieldValue.serverTimestamp(),
                uid: uid
            }, { merge: true });

            await db.collection("roles_admin").doc(uid).set({
                email: adminEmail,
                role: 'Admin',
                authorizedAt: FieldValue.serverTimestamp()
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action node." }, { status: 400 });
    } catch (error: any) {
        console.error("Provisioning failure:", error);
        return NextResponse.json({ error: `Identity Registry Error: ${error.message}` }, { status: 500 });
    }
}
