'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Application Error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-50 to-red-100 px-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
            <div className="mb-4">
              <div className="inline-block p-4 bg-red-100 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Critical Error</h2>
            <p className="text-slate-600 text-sm mb-4 break-words">
              {error.message || 'A critical error occurred. The application cannot continue.'}
            </p>
            {error.digest && (
              <p className="text-slate-400 text-xs mb-6 font-mono">Error ID: {error.digest}</p>
            )}
            <button
              onClick={() => reset()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
