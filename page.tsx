'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useMongoStore, useCollectionOptimized, useMemoMongo } from '@/mongodb';
import { collection } from '@/lib/mongo-store';
import { useMemo } from 'react';

const SHARED_HUB_ID = 'Sikkaind';

export default function MK03DisplayVendors() {
  const db = useMongoStore();
  const [mounted, setMounted] = React.useState(false);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const vendorsQuery = useMemoMongo(() => collection(db, 'users', SHARED_HUB_ID, 'vendors'), [db]);
  const { data: vendors, isLoading } = useCollectionOptimized(vendorsQuery);

  const filtered = useMemo(() => {
    if (!vendors || !mounted) return [];
    let data = vendors as any[];

    const q = search.trim().toUpperCase();
    if (q) {
      data = data.filter((v: any) => {
        return (
          (v.vendorCode || '').toUpperCase().includes(q) ||
          (v.vendorName || '').toUpperCase().includes(q) ||
          (v.city || '').toUpperCase().includes(q)
        );
      });
    }
    return data;
  }, [vendors, mounted, search]);

  if (!mounted) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono text-black">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-8 shadow-sm flex items-center justify-between">
        <h2 className="text-[16px] font-bold uppercase italic">MK03 – Display Vendors</h2>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, name, or city..."
            className="h-8 w-64 border border-slate-300 px-3 text-xs font-normal outline-none bg-white"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-300 shadow-inner overflow-x-auto">
        <table className="w-full text-left text-[11px] min-w-[800px]">
          <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-slate-300 font-normal uppercase text-slate-500">
            <tr>
              <th className="p-3 border-r">Vendor Code</th>
              <th className="p-3 border-r">Vendor Name</th>
              <th className="p-3 border-r">City</th>
              <th className="p-3">Created At</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-20 text-center">
                  <div className="flex flex-col items-center justify-center gap-4 text-slate-300">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Loading Vendors...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length > 0 ? (
              filtered.map((v: any) => (
                <tr key={v.id} className="border-b border-slate-100 hover:bg-blue-50/20">
                  <td className="p-3 border-r">{v.vendorCode}</td>
                  <td className="p-3 border-r">{v.vendorName}</td>
                  <td className="p-3 border-r">{v.city}</td>
                  <td className="p-3">
                    {v.createdAt ? new Date(v.createdAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-20 text-center text-slate-300 italic uppercase font-black text-[10px] tracking-widest">
                  No vendors found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

```

मैंने यह नई फाइल आपके प्रोजेक्ट में जोड़ दी है। अब जब आप MK03 पेज पर जाएंगे, तो आपको वेंडर्स की लिस्ट एक टेबल में दिखाई देगी और आप उसे सर्च भी कर पाएंगे।

अगर आपको कोई और मदद चाहिए तो मुझे बताएं!

<!--
[PROMPT_SUGGESTION]MK03 पेज पर एक नया वेंडर जोड़ने के लिए एक फॉर्म जोड़ें।[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]क्या हम MK03 से वेंडर्स को एक्सपोर्ट कर सकते हैं?[/PROMPT_SUGGESTION]
-->