'use client';

import { ShieldCheck, Lock, Eye, FileText } from 'lucide-react';

/**
 * @fileOverview Privacy Policy Page.
 */
export default function PrivacyPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="bg-slate-900 py-20 text-white">
        <div className="container mx-auto px-6 text-center">
          <ShieldCheck className="h-16 w-16 text-blue-400 mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic">Privacy Node</h1>
          <p className="text-blue-200 font-bold uppercase tracking-[0.4em] mt-4">Data Protection Manifest</p>
        </div>
      </section>

      <section className="py-24 max-w-4xl mx-auto px-6 space-y-12">
        <div className="space-y-4">
          <h2 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-3">
            <Lock className="text-blue-600 h-6 w-6" /> 1. Data Collection Node
          </h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            Sikka Industries & Logistics collects mission-critical data required for authorized logistics handshakes. This includes operator credentials, fleet telemetry, and document registries necessary for operational transparency.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-3">
            <Eye className="text-blue-600 h-6 w-6" /> 2. Visibility & Sharing
          </h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            Access to registry data is restricted to authorized personnel based on job roles. Telemetry data is synchronized with partner nodes (e.g., Wheelseye) exclusively for real-time mission tracking.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-3">
            <FileText className="text-blue-600 h-6 w-6" /> 3. Retention Policy
          </h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            In accordance with Enterprise Security Node 04, activity logs are retained for a 21-day audit window before automated purging occurs. Mission manifests (LR/Invoices) are stored in the permanent cloud registry for statutory compliance.
          </p>
        </div>

        <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 flex items-start gap-6">
          <ShieldCheck className="h-8 w-8 text-blue-600 shrink-0 mt-1" />
          <div className="space-y-2">
            <h4 className="font-black text-blue-900 uppercase">Authorized Security Protocol</h4>
            <p className="text-sm font-bold text-blue-700 uppercase leading-relaxed">
              Your identity node is encrypted and synchronized with our secure cloud terminal. For any privacy-related enquiries, contact sil@sikkaenterprises.com.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
