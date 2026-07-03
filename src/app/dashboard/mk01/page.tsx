'use client';

import * as React from 'react';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, useUser, useDoc } from '@/mongodb';
import { collection, doc, serverTimestamp } from '@/lib/mongo-store';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const SHARED_HUB_ID = 'Sikkaind';

export default function VA_MK01_CreateForwardingAgent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useMongoStore();
  const { user } = useUser();

  const mountedRef = React.useRef(false);
  const [mounted, setMounted] = React.useState(false);

  const [arrangeByName, setArrangeByName] = React.useState('');
  const [mobileNumber, setMobileNumber] = React.useState('');
  const [status, setStatus] = React.useState<'Active' | 'Inactive'>('Active');

  const [errors, setErrors] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  const [isBootstrapAdmin, setIsBootstrapAdmin] = React.useState(false);
  const [registryId, setRegistryId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsBootstrapAdmin(localStorage.getItem('sap_bootstrap_session') === 'true');
    setRegistryId(localStorage.getItem('sap_registry_id'));
    setMounted(true);
    mountedRef.current = true;
  }, []);

  const forwardingAgentsQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'forwarding_agents'),
    [db]
  );
  const { data: forwardingAgents } = useCollectionOptimized(forwardingAgentsQuery);

  // createdBy should show the logged-in user's name, not a random uid.
  // In this repo `MongoUser` has only: { uid, displayName, email }.
  // If displayName is null/empty, fallback to email/uid.
  // (If you store employeeName elsewhere in your auth flow, wire it into `displayName`.)
  const createdBy = React.useMemo(() => {
    const fallback = 'Sikkaind_System';
    return (
      user?.displayName ||
      user?.email ||
      user?.uid ||
      fallback
    ).toString();
  }, [user]);



  const normalize = (s: string) => (s || '').trim();

  const validate = () => {
    const nextErrors: string[] = [];
    if (!normalize(arrangeByName)) nextErrors.push('arrangeByName');
    if (!normalize(mobileNumber)) nextErrors.push('mobileNumber');
    if (!['Active', 'Inactive'].includes(status)) nextErrors.push('status');
    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const handleSave = async () => {
    if (!mounted) return;
    if (!validate()) {
      alert('Error: Please fill mandatory fields.');
      return;
    }

    const docId = crypto.randomUUID();

    // optional: prevent duplicate arrangeByName
    const already = (forwardingAgents || []).some(
      (a: any) => (a?.arrangeByName || '').toString().trim().toUpperCase() === arrangeByName.trim().toUpperCase()
    );
    if (already) {
      alert('Duplicate Arrange By Name is not allowed.');
      return;
    }

    setIsSaving(true);
    try {
      setDocumentNonBlocking(
        doc(db, 'users', SHARED_HUB_ID, 'forwarding_agents', docId),
        {
          id: docId,
          arrangeByName: normalize(arrangeByName),
          mobileNumber: normalize(mobileNumber),
          status,
          createdBy,
          createdAt: serverTimestamp(),
          updatedBy: '',
          updatedAt: null,
        },
        { merge: true }
      );

      setArrangeByName('');
      setMobileNumber('');
      setStatus('Active');
      setErrors([]);
      alert('Forwarding Agent created successfully');
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold uppercase italic">MK01 - Create Forwarding Agent</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-8 rounded-none text-[10px] font-black uppercase" onClick={() => router.back()}>
            Back
          </Button>
          {isSaving && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
        </div>
      </div>

      <div className="bg-white border border-slate-300 shadow-sm p-12">
        <div className="grid grid-cols-2 gap-x-24 gap-y-6">
          <div className="flex items-center gap-6">
            <label className="text-[12px] font-bold text-slate-600 w-52 text-right uppercase">Arrange By (Name) *</label>
            <input
              value={arrangeByName}
              onChange={(e) => setArrangeByName(e.target.value)}
              className={`h-9 w-80 border px-3 text-[12px] font-black outline-none ${errors.includes('arrangeByName') ? 'border-red-500 bg-red-50' : 'border-slate-400'}`}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="text-[12px] font-bold text-slate-600 w-52 text-right uppercase">Mobile Number *</label>
            <input
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className={`h-9 w-80 border px-3 text-[12px] font-black outline-none ${errors.includes('mobileNumber') ? 'border-red-500 bg-red-50' : 'border-slate-400'}`}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="text-[12px] font-bold text-slate-600 w-52 text-right uppercase">Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="h-9 w-80 border border-slate-400 bg-white px-3 text-[12px] font-black outline-none uppercase"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-6">
            <label className="text-[12px] font-bold text-slate-600 w-52 text-right uppercase">Created By</label>
            <input value={createdBy} readOnly className="h-9 w-80 border border-slate-300 bg-slate-50 px-3 text-[12px] font-black text-[#0056d2]" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-12">
          <Button variant="outline" onClick={() => {
            setArrangeByName('');
            setMobileNumber('');
            setStatus('Active');
            setErrors([]);
          }} className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300">
            Clear
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="h-9 rounded-none bg-[#0056d2] text-white text-[10px] font-black uppercase px-10">
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="mt-8 text-[10px] font-bold uppercase italic text-slate-400">
        Note: Created Date & Time is captured automatically.
      </div>
    </div>
  );
}