'use client';

import * as React from 'react';

type Props = {
  onScan: (rawText: string) => void;
};

/**
 * Minimal QR scanner placeholder.
 * Since camera scanning libs might not be installed yet, this component provides
 * an input box that accepts decoded QR text (useful for testing + integration).
 */
export function QRScanner({ onScan }: Props) {
  const [value, setValue] = React.useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste/Type scanned QR text here (CN or URL/JSON)"
          className="h-10 w-full border border-slate-400 px-3 text-xs font-normal outline-none focus:bg-yellow-50"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const txt = value.trim();
            if (!txt) return;
            onScan(txt);
            setValue('');
          }}
          className="h-10 px-4 bg-[#0056d2] text-white text-[11px] font-black uppercase rounded-none"
        >
          Use This QR
        </button>
        <button
          onClick={() => setValue('')}
          className="h-10 px-4 border border-slate-300 bg-white text-slate-600 text-[11px] font-black uppercase rounded-none"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

