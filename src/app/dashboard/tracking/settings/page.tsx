'use client';

import { useState, ChangeEvent, useEffect, Suspense } from 'react';
import { FirebaseAppProvider, AuthProvider, FirestoreProvider, StorageProvider, useFirestore, useStorage } from 'reactfire';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { app } from '@/firebase';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, UploadCloud, CheckCircle2 } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

function SettingsContent() {
    const [apiKey, setApiKey] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const storage = useStorage();

    const [runningIconFile, setRunningIconFile] = useState<File | null>(null);
    const [selectedRunningIcon, setSelectedRunningIcon] = useState<string | null>(null);

    const [stoppedIconFile, setStoppedIconFile] = useState<File | null>(null);
    const [selectedStoppedIcon, setSelectedStoppedIcon] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;
        const fetchSettings = async () => {
            const settingsDoc = doc(firestore, 'gps_settings', 'api_config');
            const docSnap = await getDoc(settingsDoc);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setApiKey(data.apiKey || '');
                setSelectedRunningIcon(data.runningIconUrl || null);
                setSelectedStoppedIcon(data.stoppedIconUrl || null);
            }
        };
        fetchSettings();
    }, [firestore]);

    const handleRunningIconChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setRunningIconFile(file);
            setSelectedRunningIcon(URL.createObjectURL(file));
        }
    };

    const handleStoppedIconChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setStoppedIconFile(file);
            setSelectedStoppedIcon(URL.createObjectURL(file));
        }
    };

    const handleSync = async () => {
        if (!apiKey && !selectedRunningIcon && !selectedStoppedIcon) {
            toast({ variant: 'destructive', title: 'No Changes', description: 'Please provide an API key or select an icon.' });
            return;
        }
        
        if (!firestore || !storage) {
            toast({ variant: 'destructive', title: 'Service Error', description: 'Firestore or Storage connection not available.' });
            return;
        }

        setIsSyncing(true);
        try {
            let runningIconUrl = selectedRunningIcon;
            if (runningIconFile && selectedRunningIcon?.startsWith('blob:')) {
                const iconRef = ref(storage, `system_icons/running_icon_${Date.now()}`);
                await uploadBytes(iconRef, runningIconFile);
                runningIconUrl = await getDownloadURL(iconRef);
                toast({ title: 'Running Icon Uploaded', description: 'Your running icon has been saved.' });
            }

            let stoppedIconUrl = selectedStoppedIcon;
            if (stoppedIconFile && selectedStoppedIcon?.startsWith('blob:')) {
                const iconRef = ref(storage, `system_icons/stopped_icon_${Date.now()}`);
                await uploadBytes(iconRef, stoppedIconFile);
                stoppedIconUrl = await getDownloadURL(iconRef);
                toast({ title: 'Stopped Icon Uploaded', description: 'Your stopped icon has been saved.' });
            }

            await setDoc(doc(firestore, 'gps_settings', 'api_config'), { 
                apiKey: apiKey,
                runningIconUrl: runningIconUrl,
                stoppedIconUrl: stoppedIconUrl,
                provider: 'wheelseye',
                syncedAt: new Date(),
            }, { merge: true });

            toast({
                title: 'Settings Synced',
                description: 'Your GPS settings have been successfully updated.',
            });

        } catch (error) {
            console.error("Error syncing GPS settings:", error);
            toast({ variant: 'destructive', title: 'Sync Failed', description: (error as Error).message });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="p-8 space-y-8 max-w-6xl mx-auto">
            <div className="text-center">
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">GPS Tracker Settings</h1>
                <p className="text-slate-500 mt-2">Manage your GPS provider API key and select global icons for your fleet.</p>
            </div>

            <div className="bg-white p-10 rounded-3xl shadow-2xl border-slate-100 border-2 space-y-10">
                <div className="grid gap-4 max-w-md">
                    <Label htmlFor="api-key" className="text-sm font-black text-slate-700 uppercase tracking-widest">WheelsEye API Key</Label>
                    <Input 
                        id="api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your provider API key"
                        className="h-12 rounded-xl text-lg font-mono tracking-wider bg-slate-50 shadow-inner"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                        <Label className="text-sm font-black text-slate-700 uppercase tracking-widest">Running Vehicle Icon</Label>
                        <div className="mt-4 flex items-center gap-6">
                            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-4 group cursor-pointer hover:border-green-500 transition-all flex items-center justify-center h-32 w-32">
                                <Input
                                    id="running-icon-upload"
                                    type="file"
                                    accept="image/png, image/jpeg, image/gif, image/svg+xml"
                                    onChange={handleRunningIconChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="text-center text-slate-400 group-hover:text-green-500">
                                    <UploadCloud className="h-10 w-10 mx-auto mb-2" />
                                    <span className="text-xs font-bold">Upload Running</span>
                                </div>
                            </div>

                            {selectedRunningIcon && (
                                <div className='relative p-4 border-2 rounded-2xl flex items-center justify-center h-32 w-32 border-green-600 ring-4 ring-green-100'>
                                    <Image src={selectedRunningIcon} alt="Running Icon" width={80} height={80} className="object-contain" />
                                    <CheckCircle2 className="absolute -top-3 -right-3 h-7 w-7 text-white bg-green-600 rounded-full p-1" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <Label className="text-sm font-black text-slate-700 uppercase tracking-widest">Stopped Vehicle Icon</Label>
                        <div className="mt-4 flex items-center gap-6">
                            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-4 group cursor-pointer hover:border-red-500 transition-all flex items-center justify-center h-32 w-32">
                                <Input
                                    id="stopped-icon-upload"
                                    type="file"
                                    accept="image/png, image/jpeg, image/gif, image/svg+xml"
                                    onChange={handleStoppedIconChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="text-center text-slate-400 group-hover:text-red-500">
                                    <UploadCloud className="h-10 w-10 mx-auto mb-2" />
                                    <span className="text-xs font-bold">Upload Stopped</span>
                                </div>
                            </div>

                            {selectedStoppedIcon && (
                                <div className='relative p-4 border-2 rounded-2xl flex items-center justify-center h-32 w-32 border-red-600 ring-4 ring-red-100'>
                                    <Image src={selectedStoppedIcon} alt="Stopped Icon" width={80} height={80} className="object-contain" />
                                    <CheckCircle2 className="absolute -top-3 -right-3 h-7 w-7 text-white bg-red-600 rounded-full p-1" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-200">
                     <Button 
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="w-full h-14 mt-4 rounded-2xl bg-blue-900 hover:bg-slate-900 text-white font-black uppercase text-sm tracking-[0.2em] shadow-xl transition-all active:scale-95"
                    >
                        {isSyncing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-3 h-5 w-5" />}
                        Save & Sync Settings
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function GPSSettingsPage() {
    const firestoreInstance = getFirestore(app);
    const storageInstance = getStorage(app);
    const authInstance = getAuth(app);

    return (
        <FirebaseAppProvider firebaseApp={app}>
            <AuthProvider sdk={authInstance}>
                <FirestoreProvider sdk={firestoreInstance}>
                    <StorageProvider sdk={storageInstance}>
                        <Suspense fallback={<div className="w-full h-screen flex items-center justify-center">Loading Settings...</div>}>
                            <SettingsContent />
                        </Suspense>
                    </StorageProvider>
                </FirestoreProvider>
            </AuthProvider>
        </FirebaseAppProvider>
    );
}
