
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from "@/firebase";
import { useLoading } from "@/context/LoadingContext";
import { Loader2, UserCheck, KeyRound, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import placeholderData from '@/app/lib/placeholder-images.json';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

function ForgotPasswordModal({ onClose }: { onClose: () => void; }) {
    const [username, setUsername] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isVerified, setIsVerified] = useState(false);
    const [targetUserId, setTargetUserId] = useState<string | null>(null);

    const handleVerifyIdentity = async () => {
        if (!username || mobileNumber.length !== 10) {
            setError("Enter Username and 10-digit Mobile No.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/manage-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verifyUser', username, mobileNo: mobileNumber })
            });

            if (res.ok) {
                const data = await res.json();
                setTargetUserId(data.userId);
                setIsVerified(true);
                setError(null);
            } else {
                const data = await res.json();
                setError(data.error || "INVALID USERNAME OR INVALID NO.");
            }
        } catch (e: any) {
            setError("Registry link failure. Please retry.");
        } finally {
            setIsSubmitting(false);
        }
    };

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
            const res = await fetch('/api/auth/manage-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resetPassword', userId: targetUserId, newPassword })
            });

            if (res.ok) {
                setMessage("Registry Updated Successfully.");
                setTimeout(onClose, 2000);
            } else {
                const data = await res.json();
                setError(data.error || "Update failed. Permission denied.");
            }
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

export default function LoginPage() {
    const auth = useAuth();
    const [identity, setIdentity] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const router = useRouter();
    const { toast } = useToast();
    const { showLoader, hideLoader } = useLoading();

    const getImg = (id: string) => placeholderData.placeholderImages.find(p => p.id === id);

    const hasTypo = useMemo(() => identity.toLowerCase().trim() === 'sikkiand', [identity]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!identity || !password) {
            setError('User and Password must be provided.');
            return;
        }

        setError(null);
        showLoader();

        if (!auth) {
            setError("Establishing link... Please retry.");
            hideLoader();
            return;
        }

        let email = identity;
        if (!email.includes('@')) {
            const username = identity.toLowerCase().trim();
            email = username === 'sikkaind' ? 'sikkaind.admin@sikka.com' : `${username}@sikka.com`;
        }

        localStorage.setItem('slmc_last_identity', identity.toLowerCase());

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const loginRes = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, email: user.email })
            });
            const loginData = await loginRes.json();

            setIsRedirecting(true);
            router.push(loginData.redirect || '/modules');
        } catch (err: any) {
            console.error("Login Error:", err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email') {
                setError("Invalid operator credentials. Access Denied.");
            } else {
                setError("System registry link failure. Please contact support.");
            }
            hideLoader();
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
                        <div className="w-1/2 p-4 hidden md:block relative min-h-[400px]">
                            {getImg('logo')?.url && (
                                <Image 
                                    src={getImg('logo')!.url} 
                                    alt="Sikka Industries Login" 
                                    fill 
                                    className="object-contain p-8" 
                                    priority 
                                    unoptimized={true}
                                />
                            )}
                        </div>
                        <div className="w-full md:w-1/2 p-8">
                            <h1 className="text-2xl font-bold text-[#F0B800] mb-8 uppercase italic">Sikka Industries</h1>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="flex items-center space-x-4">
                                    <label className="w-24 text-[11px] font-black uppercase text-gray-600">User <span className="text-red-500">*</span></label>
                                    <div className="flex-1 relative">
                                        <input 
                                            type="text" 
                                            value={identity}
                                            onChange={(e) => setIdentity(e.target.value)}
                                            className={cn("w-full p-1 border bg-white text-sm uppercase", hasTypo ? "border-red-500" : "border-gray-400")}
                                            placeholder=""
                                        />
                                        {hasTypo && (
                                            <button 
                                                type="button"
                                                onClick={() => setIdentity('sikkaind')}
                                                className="absolute -bottom-5 left-0 text-[9px] font-black text-blue-600 uppercase flex items-center gap-1 animate-bounce"
                                            >
                                                <Sparkles size={10} /> Did you mean "sikkaind"?
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <label className="w-24 text-[11px] font-black uppercase text-gray-600">Password <span className="text-red-500">*</span></label>
                                    <div className="flex-1 flex items-center border border-gray-400 bg-white">
                                        <input 
                                            type={showPassword ? 'text' : 'password'} 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="flex-1 p-1 bg-transparent text-sm focus:outline-none"
                                            placeholder=""
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
                                <div className="pt-4 md:pl-28 flex flex-wrap gap-2 items-center">
                                    <button 
                                        type="submit" 
                                        className="px-6 py-1 text-[11px] font-black uppercase bg-gray-100 border border-gray-500 rounded-sm hover:bg-gray-200 transition-colors"
                                    >
                                        Log On
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            showLoader();
                                            try {
                                                const res = await fetch('/api/auth/manage-user', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ action: 'bootstrap' })
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                    toast({ title: 'Bootstrap Successful', description: 'Admin account initialized.' });
                                                }
                                            } catch (e: any) {
                                                console.error(e);
                                            } finally {
                                                hideLoader();
                                            }
                                        }}
                                        className="text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                        Initialize
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotPassword(true)}
                                        className="text-[11px] font-bold text-blue-600 hover:underline"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                                {error && (
                                    <div className="md:pl-28 pt-2 flex flex-col gap-1">
                                        <p className="text-[10px] text-red-600 font-black uppercase">{error}</p>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase italic">If this is a new setup, click INITIALIZE above.</p>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-8 pb-2 px-4">
                        <p className="text-[9px] text-gray-400 font-bold uppercase">© SIKKA INDUSTRIES & LOGISTICS. SECURITY NODE 04.</p>
                        {getImg('logo-old')?.url && (
                            <Image 
                                src={getImg('logo-old')!.url} 
                                alt="Logo" 
                                width={100} 
                                height={28} 
                                style={{ height: 'auto' }} 
                                unoptimized={true}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
