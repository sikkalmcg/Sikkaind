'use client';

import { useState, Suspense, useEffect, useCallback } from 'react';
import SelectionScreen, { type SelectionCriteria } from './SelectionScreen';
import ResultGrid from './ResultGrid';
import { useSikkaAccountsPage } from '@/context/SikkaAccountsPageContext';
import { Loader2 } from 'lucide-react';

function InvoiceReportPage() {
  const [selectionCriteria, setSelectionCriteria] = useState<SelectionCriteria | null>(null);
  const { setSaveAction, setStatusBar } = useSikkaAccountsPage();
  
  useEffect(() => {
    // Reports typically don't have a save action
    setSaveAction(null);
  }, [setSaveAction]);

  const handleExecute = useCallback((criteria: SelectionCriteria) => {
    setSelectionCriteria(criteria);
    setStatusBar({ message: "Data extraction successful.", type: 'success' });
  }, [setStatusBar]);

  const handleBackToSelection = useCallback(() => {
    setSelectionCriteria(null);
  }, []);

  return (
    <div className="h-full flex flex-col">
        {!selectionCriteria ? (
            <SelectionScreen onExecute={handleExecute} />
        ) : (
            <ResultGrid criteria={selectionCriteria} onBack={handleBackToSelection} />
        )}
    </div>
  );
}

export default function InvoiceReportPageWrapper() {
    return (
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-blue-900" /></div>}>
            <InvoiceReportPage />
        </Suspense>
    );
}
