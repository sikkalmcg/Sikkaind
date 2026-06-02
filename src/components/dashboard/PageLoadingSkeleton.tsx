'use client';

export function PageLoadingSkeleton() {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-10 bg-[#f2f2f2] font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-3 mb-10 shadow-sm">
        <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
      </div>

      <div className="px-2 space-y-4">
        <div className="bg-white p-6 border border-slate-300 shadow-sm">
          <div className="h-8 w-full bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
          <div className="space-y-3 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
