'use client';

import { auth, db } from "@/lib/firebaseConfig";
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import loginimg from '@/assets/Sikka-login.jpeg';
import logoimg from '@/assets/logo-old.png';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    limit, 
    updateDoc, 
    serverTimestamp 
} from 'firebase/firestore';

import { Loader2, UserCheck, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';

// --- FORGOT PASSWORD MODAL COMPONENT ---
function ForgotPasswordModal({ onClose }: { onClose: () => void; }) {
    const [username, setUsername] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isVerified, setIsVerified] = useState(false);
    const [targetUserRef, setTargetUserRef] = useState<any>(null);

    // STEP 1: Match Username and Mobile in Database
    const handleVerifyIdentity = async () => {
        if (!username || mobileNumber.length !== 10) {
            setError("Enter Username and 10-digit Mobile No.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const q = query(
                collection(db, "users"),
                where("username", "==", username.toLowerCase().trim()),
                where("mobileNo", "==", mobileNumber.trim()),
                limit(1)
            );

            const snap = await getDocs(q);

            if (snap.empty) {
                setError("INVALID USERNAME OR INVALID NO.");
                setIsSubmitting(false);
                return;
            }

            setTargetUserRef(snap.docs[0].ref);
            setIsVerified(true);
            setError(null);
        } catch (e: any) {
            setError("Registry link failure. Please retry.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // STEP 2: Update Password in Database
    const handlePasswordChange = async () => {
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            setError("Min. 6 characters required.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await updateDoc(targetUserRef, {
                password: newPassword,
                passwordUpdatedAt: serverTimestamp(),
            });

            setMessage("Registry Updated Successfully.");
            setTimeout(onClose, 2000);
        } catch (e: any) {
            setError("Update failed. Permission denied.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden border-t-4 border-blue-600">
                <div className="p-6 bg-slate-50 border-b flex items-center gap-3">
                    {isVerified ? <KeyRound className="text-blue-600" /> : <UserCheck className="text-blue-600" />}
                    <h2 className="text-lg font-bold uppercase tracking-tight text-slate-800">
                        {isVerified ? "Set New Password" : "Identify Operator"}
                    </h2>
                </div>

                <div className="p-8 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                            <AlertCircle className="h-4 w-4" />
                            <p className="text-xs font-black uppercase">{error}</p>
                        </div>
                    )}

                    {!isVerified ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Username *</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded bg-slate-50 text-sm focus:outline-blue-500"
                                    placeholder="operator_id"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Mobile No. *</label>
                                <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                                    <span className="px-3 py-2 bg-gray-100 text-xs font-bold border-r text-gray-600">+91</span>
                                    <input
                                        type="text"
                                        value={mobileNumber}
                                        onChange={(e) => setMobileNumber(e.target.value)}
                                        className="flex-1 p-2 bg-white text-sm focus:outline-none"
                                        maxLength={10}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleVerifyIdentity}
                                disabled={isSubmitting}
                                className="w-full py-3 bg-blue-600 text-white text-xs font-black uppercase rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin mx-auto h-4 w-4" /> : 'Verify Identity'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-[10px] text-green-600 font-bold bg-green-50 p-2 border border-green-100 rounded">Identity confirmed for @{username}. Enter new credentials.</p>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-gray-500 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-blue-500"
                                />
                            </div>
                            <button
                                onClick={handlePasswordChange}
                                disabled={isSubmitting}
                                className="w-full py-3 bg-green-600 text-white text-xs font-black uppercase rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin mx-auto h-4 w-4" /> : 'Commit Change'}
                            </button>
                        </div>
                    )}

                    {message && <p className="text-center text-xs text-green-600 font-bold animate-pulse">{message}</p>}
                    
                    <button onClick={onClose} className="w-full text-center text-[10px] font-bold text-gray-400 uppercase hover:text-gray-600 pt-2">
                        Cancel & Return
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- MAIN LOGIN PAGE ---
export default function LoginPage() {
    const [identity, setIdentity] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isSubmitting) return; // Prevent multiple submissions

        if (!identity || !password) {
            setError('User and Password must be provided.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        if (!auth) {
            setError("Establishing link... Please retry.");
            setIsSubmitting(false);
            return;
        }

        let email = identity;
        if (!email.includes('@')) {
            const username = identity.toLowerCase();
            email = username === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${username}@sikka.com`;
        }

        localStorage.setItem('slmc_last_identity', identity.toLowerCase());

        try {
            await signInWithEmailAndPassword(auth, email, password);
            setIsRedirecting(true);
            
            // ALL users are redirected to the modules page
            router.push('/modules');

        } catch (err: any) {
            console.error("Login failed:", err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError("Invalid operator credentials. Access Denied.");
            } else {
                setError("System registry link failure. Please contact support.");
            }
            setIsSubmitting(false); // Re-enable form only on failure
        }
    };

    if (isRedirecting) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-gray-800" />
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-widest">Securing Session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-200 p-4 font-sans">
            {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />}
            
            <div className="w-full max-w-4xl bg-white shadow-lg" style={{ borderTop: '4px solid #F0B800', borderBottom: '4px solid #F0B800' }}>
                <div className="border p-2">
                    <div className="flex border">
                        <div className="w-1/2 p-4 hidden md:block">
                            <Image src={loginimg} alt="Sikka Logistics" width={400} height={100} priority />
                        </div>
                        <div className="w-full md:w-1/2 p-8">
                            <h1 className="text-2xl font-bold text-[#F0B800] mb-8 uppercase italic">Sikka Industries</h1>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="flex items-center space-x-4">
                                    <label className="w-24 text-[11px] font-black uppercase text-gray-600">User <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={identity}
                                        onChange={(e) => setIdentity(e.target.value)}
                                        className="flex-1 p-1 border border-gray-400 bg-white text-sm"
                                        placeholder="sikkaind"
                                    />
                                </div>
                                <div className="flex items-center space-x-4">
                                    <label className="w-24 text-[11px] font-black uppercase text-gray-600">Password <span className="text-red-500">*</span></label>
                                    <div className="flex-1 flex items-center border border-gray-400 bg-white">
                                        <input 
                                            type={showPassword ? 'text' : 'password'} 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="flex-1 p-1 bg-transparent text-sm focus:outline-none"
                                            placeholder="Sikka@lmc2105"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="p-1 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="pt-4 md:pl-28 flex flex-wrap gap-2">
                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting}
                                        className="px-6 py-1 text-[11px] font-black uppercase bg-gray-100 border border-gray-500 rounded-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? 'Verifying...' : 'Log On'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotPassword(true)}
                                        className="text-[11px] font-bold text-blue-600 hover:underline"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                                {error && <p className="md:pl-28 pt-2 text-[10px] text-red-600 font-black uppercase">{error}</p>}
                            </form>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-8 pb-2 px-4">
                        <p className="text-[9px] text-gray-400 font-bold">© SIKKA INDUSTRIES & LOGISTICS. SECURITY NODE 04.</p>
                        <Image src={logoimg} alt="Logo" width={100} height={28} style={{ height: 'auto' }} />
                    </div>
                </div>
            </div>
        </div>
    );
}