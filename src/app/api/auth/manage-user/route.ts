import { adminAuth, adminDb, FieldValue } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, email, password, username, mobileNo, userId, newPassword } = body;

        if (action === 'resolveEmail') {
            if (!username) return NextResponse.json({ error: "Username required." }, { status: 400 });
            const cleanUsername = username.toLowerCase().trim();
            
            // Optimized query node
            const q = adminDb.collection("users").where("username", "==", cleanUsername).limit(1);
            const snap = await q.get();

            if (snap.empty) {
                const fallbackEmail = cleanUsername === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${cleanUsername}@sikka.com`;
                return NextResponse.json({ success: true, email: fallbackEmail });
            }

            const userData = snap.docs[0].data();
            return NextResponse.json({ success: true, email: userData.email });
        }

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

        if (action === 'resetPassword') {
            if (!userId || !newPassword) return NextResponse.json({ error: "Params missing." }, { status: 400 });
            const userRef = adminDb.collection("users").doc(userId);
            const userSnap = await userRef.get();

            if (!userSnap.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });

            const userData = userSnap.data()!;
            const email = userData.email || (userData.username === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${userData.username}@sikka.com`);

            await userRef.update({ password: newPassword, passwordUpdatedAt: FieldValue.serverTimestamp() });
            const userRecord = await adminAuth.getUserByEmail(email);
            await adminAuth.updateUser(userRecord.uid, { password: newPassword });

            return NextResponse.json({ success: true });
        }

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
                    id: adminEmail
                }, { merge: true });

                return NextResponse.json({ success: true });
            } catch (error: any) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        if (action === 'createUser') {
            if (!email || !password) return NextResponse.json({ error: "Params missing." }, { status: 400 });
            try {
                const existing = await adminAuth.getUserByEmail(email);
                await adminAuth.updateUser(existing.uid, { password });
                return NextResponse.json({ success: true, uid: existing.uid });
            } catch (e: any) {
                if (e.code === 'auth/user-not-found') {
                    const created = await adminAuth.createUser({ email, password, emailVerified: true });
                    return NextResponse.json({ success: true, uid: created.uid });
                }
                throw e;
            }
        }

        return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
