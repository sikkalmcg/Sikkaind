export function DashboardSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#f2f2f2] text-[#333]">
      <div className="mb-10 flex justify-between items-end">
        <div className="flex flex-col gap-3">
          <div className="h-10 w-64 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-96 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-6 border border-slate-200 bg-white rounded h-32">
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrackPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#f2f2f2] flex flex-col font-mono">
      <div className="bg-white border-b border-slate-300 px-8 py-4 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-8">
        <div className="bg-white border border-slate-300 p-12 space-y-10 shadow-lg mt-20">
          <div className="h-8 w-96 bg-slate-200 rounded animate-pulse mx-auto mb-6" />
          <div className="h-10 w-full bg-slate-200 rounded animate-pulse" />
          <div className="h-12 w-40 bg-slate-200 rounded animate-pulse mx-auto" />
        </div>
      </div>
    </div>
  );
}
