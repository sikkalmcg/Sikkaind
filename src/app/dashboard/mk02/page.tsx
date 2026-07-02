'use client';

import * as React from 'react';
import { useMongoStore, useCollectionOptimized, useMemoMongo, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from '@/mongodb';
import { collection, doc, serverTimestamp } from '@/lib/mongo-store';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const SHARED_HUB_ID = 'Sikkaind';

type AgentStatus = 'Active' | 'Inactive';

export default function VA_MK02_EditForwardingAgent() {
  const router = useRouter();
  const db = useMongoStore();
  const { user } = useUser();

  const [mounted, setMounted] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [selectedId, setSelectedId] = React.useState('');
  const [arrangeByName, setArrangeByName] = React.useState('');
  const [mobileNumber, setMobileNumber] = React.useState('');
  const [status, setStatus] = React.useState<AgentStatus>('Active');

  const [createdBy, setCreatedBy] = React.useState('');
  const [createdAtLabel, setCreatedAtLabel] = React.useState('');
  const [updatedByLabel, setUpdatedByLabel] = React.useState('');
  const [updatedAtLabel, setUpdatedAtLabel] = React.useState('');

  const [search, setSearch] = React.useState('');
  const [errors, setErrors] = React.useState<string[]>([]);

  const [historyEnabled] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const actingUser = React.useMemo(() => {
    // MongoUser in this repo exposes uid/displayName/email (not employeeName)
    return (user?.displayName || user?.email || user?.uid || 'Sikkaind_System').toString();
  }, [user]);

  const forwardingAgentsQuery = useMemoMongo(
    () => collection(db, 'users', SHARED_HUB_ID, 'forwarding_agents'),
    [db]
  );
  const { data: forwardingAgents } = useCollectionOptimized(forwardingAgentsQuery);

  const historyCollectionName = 'forwarding_agent_history';

  const filteredAgents = React.useMemo(() => {
    const all = forwardingAgents || [];
    const term = search.trim().toUpperCase();
    if (!term) return all;

    return all.filter((a: any) => {
      const name = (a?.arrangeByName || '').toString().toUpperCase();
      const mobile = (a?.mobileNumber || '').toString().toUpperCase();
      return name.includes(term) || mobile.includes(term);
    });
  }, [forwardingAgents, search]);

  React.useEffect(() => {
    if (!mounted) return;
    if (!selectedId) {
      setArrangeByName('');
      setMobileNumber('');
      setStatus('Active');
      setCreatedBy('');
      setCreatedAtLabel('');
      setUpdatedByLabel('');
      setUpdatedAtLabel('');
      return;
    }

    const agent = (forwardingAgents || []).find((a: any) => a?.id === selectedId);
    if (!agent) return;

    setArrangeByName(agent.arrangeByName || '');
    setMobileNumber(agent.mobileNumber || '');
    setStatus((agent.status as AgentStatus) || 'Active');

    setCreatedBy(agent.createdBy || '');
    setCreatedAtLabel(agent.createdAt ? new Date(agent.createdAt as any).toLocaleString() : '-');

    setUpdatedByLabel(agent.updatedBy || '');
    setUpdatedAtLabel(agent.updatedAt ? new Date(agent.updatedAt as any).toLocaleString() : '-');
  }, [mounted, selectedId, forwardingAgents]);

  const normalize = (s: string) => (s || '').trim();

  const validate = () => {
    const next: string[] = [];
    if (!normalize(arrangeByName)) next.push('arrangeByName');
    if (!normalize(mobileNumber)) next.push('mobileNumber');
    if (!['Active', 'Inactive'].includes(status)) next.push('status');
    setErrors(next);
    return next.length === 0;
  };

  const handleSave = async () => {
    if (!selectedId) {
      alert('Please select a forwarding agent to edit.');
      return;
    }
    if (!validate()) {
      alert('Error: Please fill mandatory fields.');
      return;
    }

    setIsSaving(true);
    try {
      updateDocumentNonBlocking(
        doc(db, 'users', SHARED_HUB_ID, 'forwarding_agents', selectedId),
        {
          arrangeByName: normalize(arrangeByName),
          mobileNumber: normalize(mobileNumber),
          status,
          updatedBy: actingUser,
          updatedAt: serverTimestamp(),
        }
      );

      if (historyEnabled) {
        const historyId = crypto.randomUUID();
        setDocumentNonBlocking(
          doc(db, 'users', SHARED_HUB_ID, historyCollectionName, historyId),
          {
            id: historyId,
            forwardingAgentId: selectedId,
            arrangeByName: normalize(arrangeByName),
            mobileNumber: normalize(mobileNumber),
            status,
            updatedBy: actingUser,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      alert('Forwarding Agent updated successfully');
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold uppercase italic">MK02 - Edit Forwarding Agent</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-8 rounded-none text-[10px] font-black uppercase" onClick={() => router.back()}>
            Back
          </Button>
          {isSaving && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
        </div>
      </div>

      <div className="bg-white border border-slate-300 shadow-sm p-12">
        <div className="flex items-center gap-6 mb-8">
          <label className="text-[12px] font-bold text-slate-600 w-52 text-right uppercase">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full border border-slate-400 px-3 text-[12px] font-black outline-none"
            placeholder="SEARCH by Arrange By or Mobile"
          />
        </div>

        <div className="flex items-center gap-6 mb-10">
          <label className="text-[12px] font-bold text-slate-600 w-52 text-right uppercase">Select Agent</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 w-full border border-slate-400 bg-white px-3 text-[12px] font-black outline-none uppercase"
          >
            <option value="">-- SELECT --</option>
            {filteredAgents.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.arrangeByName} ({a.mobileNumber})
              </option>
            ))}
          </select>
        </div>

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
              onChange={(e) => setStatus(e.target.value as AgentStatus)}
              className="h-9 w-80 border border-slate-400 bg-white px-3 text-[12px] font-black outline-none uppercase"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-6">
            <label className="text-[12px] font-bold text-slate-600 w-52 text-right uppercase">Updated By</label>
            <input value={actingUser} readOnly className="h-9 w-80 border border-slate-300 bg-slate-50 px-3 text-[12px] font-black text-[#0056d2]" />
          </div>

          <div className="col-span-2 mt-2 grid grid-cols-2 gap-x-24 gap-y-4">
            <div className="text-[12px] text-slate-600 font-bold uppercase">
              Created By: <span className="font-normal text-slate-800">{createdBy || '-'}</span>
              <div className="text-[10px] font-bold italic text-slate-400">Created Date: {createdAtLabel || '-'}</div>
            </div>
            <div className="text-[12px] text-slate-600 font-bold uppercase">
              Updated By (Last): <span className="font-normal text-slate-800">{updatedByLabel || '-'}</span>
              <div className="text-[10px] font-bold italic text-slate-400">Updated Date: {updatedAtLabel || '-'}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-12">
          <Button
            variant="outline"
            onClick={() => {
              setErrors([]);
              if (!selectedId) return;
              const agent = (forwardingAgents || []).find((a: any) => a?.id === selectedId);
              if (!agent) return;
              setArrangeByName(agent.arrangeByName || '');
              setMobileNumber(agent.mobileNumber || '');
              setStatus((agent.status as AgentStatus) || 'Active');
            }}
            className="h-9 rounded-none text-[10px] font-black uppercase border-slate-300"
          >
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedId} className="h-9 rounded-none bg-[#0056d2] text-white text-[10px] font-black uppercase px-10">
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="mt-8 text-[10px] font-bold uppercase italic text-slate-400">
        History: Updated snapshots are stored in <b>forwarding_agent_history</b> on every Save (MK02).
      </div>
    </div>
  );
}

