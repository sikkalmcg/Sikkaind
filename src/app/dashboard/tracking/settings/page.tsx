'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function GPSSettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();

    const handleSync = async () => {
        if (!apiKey) {
            toast({
                variant: 'destructive',
                title: 'API Key Missing',
                description: 'Please enter an API key to sync the registry node.',
            });
            return;
        }
        
        if (!firestore) {
            toast({
                variant: 'destructive',
                title: 'Database Error',
                description: 'Firestore connection not available. Please try again later.',
            });
            return;
        }

        setIsSyncing(true);
        try {
            // First, let's validate the key by fetching data
            const response = await fetch('/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey }),
            });

            // If the response is not OK, we generate a detailed error message
            if (!response.ok) {
                let errorMessage = 'The registry node endpoint failed to respond.';
                try {
                    const errorData = await response.json();
                    if (errorData.message) {
                        errorMessage = `API Error: ${errorData.message}`;
                    }
                } catch (e) {
                    const textError = await response.text();
                    errorMessage = `API Error: ${response.status} ${response.statusText}. Details: ${textError}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            // Now that the key is validated, save it to Firestore
            const settingsDoc = doc(firestore, 'gps_settings', 'api_config');
            await setDoc(settingsDoc, { 
                apiKey: apiKey,
                provider: 'wheelseye',
                syncedAt: new Date(),
            }, { merge: true });


            toast({
                title: 'Registry Synced Successfully',
                description: `API key has been registered. Found ${data.length} vehicles.`,
            });

        } catch (error) {
            console.error("Error syncing GPS data:", error);
            toast({
                variant: 'destructive',
                title: 'Sync Failed',
                description: (error as Error).message || 'An unexpected error occurred during sync.',
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="p-8 space-y-8 max-w-4xl mx-auto">
            <div className="text-center">
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">GPS Tracker Settings</h1>
                <p className="text-slate-500 mt-2">Configure your GPS tracker API to see live vehicle locations.</p>
            </div>

            <div className="bg-white p-10 rounded-3xl shadow-2xl border-slate-100 border-2">
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="api-key" className="text-sm font-black text-slate-700 uppercase tracking-widest">API Key</Label>
                        <Input 
                            id="api-key"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your GPS provider API key"
                            className="h-12 rounded-xl text-lg font-mono tracking-wider bg-slate-50 shadow-inner"
                        />
                    </div>
                    <Button 
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="w-full h-14 mt-4 rounded-2xl bg-blue-900 hover:bg-slate-900 text-white font-black uppercase text-sm tracking-[0.2em] shadow-xl transition-all active:scale-95"
                    >
                        {isSyncing ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <ShieldCheck className="mr-3 h-5 w-5" />
                        )}
                        Sync Registry Node
                    </Button>
                </div>
            </div>
        </div>
    );
}