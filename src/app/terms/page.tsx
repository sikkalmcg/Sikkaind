'use client';

import { FileText, Gavel, ShieldAlert, CheckCircle } from 'lucide-react';

/**
 * @fileOverview Registry Terms Page.
 */
export default function TermsPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="bg-slate-900 py-20 text-white text-center">
        <div className="container mx-auto px-6">
          <Gavel className="h-16 w-16 text-blue-400 mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic">Registry Terms</h1>
          <p className="text-blue-200 font-bold uppercase tracking-[0.4em] mt-4">Mission Operational Protocol</p>
        </div>
      </section>

      <section className="py-24 max-w-4xl mx-auto px-6 space-y-12">
        <div className="space-y-4">
          <h2 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-3">
            <ShieldAlert className="text-blue-600 h-6 w-6" /> 1. Authorized Handshake
          </h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            Access to the Sikka LMC Portal is restricted to verified mission operators. Any unauthorized attempt to establish a registry pulse is a violation of the Security Node 04 policy.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-3">
            <CheckCircle className="text-blue-600 h-6 w-6" /> 2. Registry Fidelity
          </h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            Operators are responsible for the accuracy of all manual data nodes, including LR Numbers, Invoice Manifests, and Weight Registry. False data entry triggers a high-priority audit exception.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-3">
            <FileText className="text-blue-600 h-6 w-6" /> 3. Mission Termination
          </h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            Sikka Industries reserves the right to terminate any operator session or registry link in case of security desync or unauthorized asset movement tracking.
          </p>
        </div>

        <div className="p-10 bg-slate-900 text-white rounded-[3rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12"><Gavel size={180} /></div>
          <div className="relative z-10 space-y-4">
            <h4 className="text-xl font-black uppercase italic italic text-blue-400">Governance Node</h4>
            <p className="text-sm font-medium text-slate-300 leading-relaxed">
              These terms are governed by the operational laws of the Republic of India. By establishing a registry link, you accept full responsibility for your mission particulars.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
