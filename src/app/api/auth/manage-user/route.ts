import { adminAuth, adminDb, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * @fileOverview Security Node API.
 * Performs atomic server-side identity provisioning and database sync.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, username, mobileNo, userId, newPassword, userData } = body;

        if (action === 'createUser') {
            if (!email || !password || !userData) return NextResponse.json({ error: "Required params missing." }, { status: 400 });
            
            try {
                let uid;
                // 1. Authenticate Identity node
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

                // 2. Establish Firestore Registry Node
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

                // 3. Register Administrative Role if applicable
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
                console.error("Registry provisioning error:", error);
                return NextResponse.json({ error: `Security Node Failure: ${error.message}` }, { status: 500 });
            }
        }

        if (action === 'bootstrap') {
            const adminEmail = 'sikkaind.admin@sikka.com';
            const adminPassword = 'sikkaind';
            try {
                const created = await adminAuth.createUser({
                    email: adminEmail,
                    password: adminPassword,
                    emailVerified: true,
                    displayName: 'Sikka Admin'
                }).catch(async (e) => {
                    if (e.code === 'auth/email-already-exists') {
                        const user = await adminAuth.getUserByEmail(adminEmail);
                        return adminAuth.updateUser(user.uid, { password: adminPassword });
                    }
                    throw e;
                });
                
                const uid = (created as any).uid || (await adminAuth.getUserByEmail(adminEmail)).uid;
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
                    access_accounts: true
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
