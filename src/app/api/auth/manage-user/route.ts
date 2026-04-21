import { adminAuth, adminDb, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Security Node API.
 * Performs atomic server-side identity provisioning and database sync.
 * Hardened to support verifyUser and resetPassword actions for the registry recovery pulse.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, userData, username, mobileNo, userId, newPassword } = body;

        // 1. Identity Verification Node (For Forgot Password)
        if (action === 'verifyUser') {
            if (!username || !mobileNo) {
                return NextResponse.json({ error: "Username and Mobile are required." }, { status: 400 });
            }

            const q = await adminDb.collection("users")
                .where("username", "==", username.toLowerCase())
                .where("mobile", "==", mobileNo)
                .limit(1)
                .get();

            if (q.empty) {
                return NextResponse.json({ error: "Identity node not found." }, { status: 404 });
            }

            const userDoc = q.docs[0];
            return NextResponse.json({ success: true, userId: userDoc.id });
        }

        // 2. Credential Reset Node
        if (action === 'resetPassword') {
            if (!userId || !newPassword) {
                return NextResponse.json({ error: "User ID and New Password required." }, { status: 400 });
            }

            const userSnap = await adminDb.collection("users").doc(userId).get();
            if (!userSnap.exists) {
                return NextResponse.json({ error: "Registry node missing." }, { status: 404 });
            }

            const data = userSnap.data();
            const uid = data?.uid;

            if (uid) {
                await adminAuth.updateUser(uid, { password: newPassword });
            }

            await adminDb.collection("users").doc(userId).update({
                password: newPassword, // Store in Firestore for "Normal Login" handshake
                passwordUpdatedAt: FieldValue.serverTimestamp()
            });

            return NextResponse.json({ success: true });
        }

        // 3. Identity Provisioning Node
        if (action === 'createUser') {
            if (!email || !password || !userData) {
                return NextResponse.json({ error: "Required params missing." }, { status: 400 });
            }
            
            try {
                let uid;
                try {
                    const existing = await adminAuth.getUserByEmail(email);
                    await adminAuth.updateUser(existing.uid, { password });
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

                const systemEmail = email.toLowerCase();
                const ts = FieldValue.serverTimestamp();
                
                await adminDb.collection("users").doc(systemEmail).set({
                    ...userData,
                    id: systemEmail,
                    uid: uid,
                    email: systemEmail,
                    createdAt: ts,
                    status: 'Active'
                }, { merge: true });

                const role = userData.jobRole?.toLowerCase();
                if (role === 'admin' || role === 'manager') {
                    await adminDb.collection("roles_admin").doc(uid).set({
                        email: systemEmail,
                        grantedAt: ts,
                        role: userData.jobRole
                    });
                }

                return NextResponse.json({ success: true, uid });
            } catch (error: any) {
                return NextResponse.json({ error: `Security Node Failure: ${error.message}` }, { status: 500 });
            }
        }

        // 4. System Bootstrap Node
        if (action === 'bootstrap') {
            const adminEmail = 'sikkaind.admin@sikka.com';
            const adminPassword = 'sikkaind';
            try {
                let uid;
                try {
                    const existing = await adminAuth.getUserByEmail(adminEmail);
                    await adminAuth.updateUser(existing.uid, { password: adminPassword });
                    uid = existing.uid;
                } catch (e: any) {
                    const created = await adminAuth.createUser({
                        email: adminEmail,
                        password: adminPassword,
                        emailVerified: true,
                        displayName: 'Sikka Admin'
                    });
                    uid = created.uid;
                }
                
                const ts = FieldValue.serverTimestamp();

                await adminDb.collection("users").doc(adminEmail).set({
                    username: 'sikkaind',
                    fullName: 'Sikka Admin',
                    email: adminEmail,
                    jobRole: 'Admin',
                    status: 'Active',
                    plantIds: [],
                    createdAt: ts,
                    id: adminEmail,
                    uid: uid,
                    access_logistics: true,
                    access_accounts: true,
                    password: adminPassword
                }, { merge: true });

                await adminDb.collection("roles_admin").doc(uid).set({
                    email: adminEmail,
                    grantedAt: ts,
                    role: 'Admin'
                });

                return NextResponse.json({ success: true });
            } catch (error: any) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        return NextResponse.json({ error: "Action node invalid." }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
